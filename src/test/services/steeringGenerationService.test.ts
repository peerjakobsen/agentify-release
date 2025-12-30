/**
 * Tests for Steering Generation Service (Task Groups 2 & 3)
 *
 * These tests validate the core service functionality including prompt loading,
 * caching, EventEmitter pattern, model ID retrieval, and generation methods.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

// Mock vscode namespace
vi.mock('vscode', () => {
  // EventEmitter mock
  class MockEventEmitter<T> {
    private listeners: ((e: T) => void)[] = [];

    public event = (listener: (e: T) => void) => {
      this.listeners.push(listener);
      return { dispose: () => {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) this.listeners.splice(index, 1);
      }};
    };

    public fire(data: T) {
      this.listeners.forEach(l => l(data));
    }

    public dispose() {
      this.listeners = [];
    }
  }

  return {
    EventEmitter: MockEventEmitter,
    Uri: {
      joinPath: vi.fn((...parts: (vscode.Uri | string)[]) => {
        const base = typeof parts[0] === 'string' ? parts[0] : (parts[0] as { path: string }).path;
        const rest = parts.slice(1).join('/');
        return { path: `${base}/${rest}`, fsPath: `${base}/${rest}` };
      }),
    },
    workspace: {
      fs: {
        readFile: vi.fn(),
      },
    },
    Disposable: class {
      static from(..._disposables: { dispose(): unknown }[]) {
        return { dispose: () => {} };
      }
    },
  };
});

// Mock bedrockClient
vi.mock('../../services/bedrockClient', () => ({
  getBedrockClientAsync: vi.fn(),
}));

// Mock configService
vi.mock('../../services/configService', () => ({
  getConfigService: vi.fn(),
}));

import {
  SteeringGenerationService,
  getSteeringGenerationService,
  resetSteeringGenerationService,
  type GeneratedFile,
  type GenerationResult,
  type FileProgressEvent,
  type FileCompleteEvent,
  type FileErrorEvent,
  STEERING_PROMPT_FILES,
  STEERING_FILE_KEYS,
} from '../../services/steeringGenerationService';
import { getBedrockClientAsync } from '../../services/bedrockClient';
import { getConfigService } from '../../services/configService';
import { createDefaultWizardState, type WizardState } from '../../types/wizardPanel';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a mock VS Code extension context
 */
function createMockContext(): vscode.ExtensionContext {
  return {
    extensionUri: { path: '/test/extension', fsPath: '/test/extension' } as vscode.Uri,
  } as vscode.ExtensionContext;
}

/**
 * Creates mock prompt file content
 */
function createMockPromptContent(name: string): Uint8Array {
  const content = `# System Prompt for ${name}\n\nYou are a helpful assistant generating steering documents.`;
  return new TextEncoder().encode(content);
}

/**
 * Creates a mock Bedrock response for ConverseCommand
 */
function createMockBedrockResponse(content: string) {
  return {
    output: {
      message: {
        content: [{ text: content }],
      },
    },
    stopReason: 'end_turn',
  };
}

/**
 * Creates a populated WizardState for testing
 */
function createPopulatedWizardState(): WizardState {
  const state = createDefaultWizardState();

  // Step 1: Business Context
  state.businessObjective = 'Automate inventory replenishment across retail stores';
  state.industry = 'Retail';
  state.systems = ['SAP S/4HANA', 'Salesforce'];

  // Step 2: AI Gap Filling
  state.aiGapFillingState.confirmedAssumptions = [
    {
      system: 'SAP S/4HANA',
      modules: ['MM', 'SD'],
      integrations: ['Salesforce -> SAP: opportunity sync'],
      source: 'user-corrected',
    },
  ];

  // Step 3: Outcome Definition
  state.outcome.primaryOutcome = 'Reduce stockouts by 50%';
  state.outcome.successMetrics = [
    { name: 'Order accuracy', targetValue: '95', unit: '%' },
  ];
  state.outcome.stakeholders = ['Operations', 'Finance'];

  // Step 4: Security
  state.security.dataSensitivity = 'confidential';
  state.security.complianceFrameworks = ['SOC 2'];
  state.security.approvalGates = ['Before external API calls'];
  state.security.guardrailNotes = 'No PII in logs';

  // Step 5: Agent Design
  state.agentDesign.confirmedAgents = [
    {
      id: 'inventory_agent',
      name: 'Inventory Agent',
      role: 'Manages inventory levels',
      tools: ['sap_get_inventory'],
      nameEdited: false,
      roleEdited: false,
      toolsEdited: false,
    },
    {
      id: 'planner_agent',
      name: 'Planner Agent',
      role: 'Creates replenishment plans',
      tools: ['salesforce_query'],
      nameEdited: false,
      roleEdited: false,
      toolsEdited: false,
    },
  ];
  state.agentDesign.confirmedOrchestration = 'workflow';
  state.agentDesign.confirmedEdges = [
    { from: 'inventory_agent', to: 'planner_agent' },
  ];

  // Step 6: Mock Data
  state.mockData.mockDefinitions = [
    {
      tool: 'sap_get_inventory',
      system: 'SAP S/4HANA',
      operation: 'getInventory',
      description: 'Retrieve inventory levels',
      mockRequest: { materialId: 'string' },
      mockResponse: { quantity: 100 },
      sampleData: [{ materialId: 'MAT001', quantity: 100 }],
      expanded: false,
      requestEdited: false,
      responseEdited: false,
      sampleDataEdited: false,
    },
  ];

  // Step 7: Demo Strategy
  state.demoStrategy.persona = {
    name: 'Maria Chen',
    role: 'Regional Inventory Manager',
    painPoint: 'Spends 2 hours daily on manual stock reconciliation',
  };
  state.demoStrategy.ahaMoments = [
    {
      id: 'aha-1',
      title: 'Real-time inventory sync',
      triggerType: 'tool',
      triggerName: 'sap_get_inventory',
      talkingPoint: 'Notice how inventory updates instantly',
    },
  ];
  state.demoStrategy.narrativeScenes = [
    {
      id: 'scene-1',
      title: 'Morning Check-In',
      description: 'Maria reviews overnight inventory changes',
      highlightedAgents: ['inventory_agent'],
    },
  ];

  return state;
}

/**
 * Creates a mock Bedrock client with configurable behavior
 */
function createMockBedrockClient(options: {
  successContent?: string;
  shouldFail?: boolean;
  failureMessage?: string;
  delayMs?: number;
}) {
  return {
    send: vi.fn().mockImplementation(async () => {
      if (options.delayMs) {
        await new Promise(resolve => setTimeout(resolve, options.delayMs));
      }
      if (options.shouldFail) {
        const error = new Error(options.failureMessage || 'Mock failure') as Error & { name: string };
        error.name = 'ThrottlingException';
        throw error;
      }
      return createMockBedrockResponse(options.successContent || '# Generated Document');
    }),
  };
}

// ============================================================================
// Test 1: Prompt Loading and Caching
// ============================================================================

describe('SteeringGenerationService - Prompt Loading and Caching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSteeringGenerationService();
  });

  afterEach(() => {
    resetSteeringGenerationService();
  });

  it('should load prompts from file system on first call and cache for subsequent calls', async () => {
    const mockContext = createMockContext();
    const mockReadFile = vi.mocked(vscode.workspace.fs.readFile);

    // Setup mock to return different content for each prompt file
    mockReadFile.mockImplementation(async (uri: vscode.Uri) => {
      const path = uri.path || uri.fsPath;
      const fileName = path.split('/').pop() || 'unknown';
      return createMockPromptContent(fileName);
    });

    const service = getSteeringGenerationService(mockContext);

    // First call should load all prompts
    const prompt1 = await service.loadPrompt('product');
    expect(mockReadFile).toHaveBeenCalled();
    expect(prompt1).toContain('System Prompt');

    // Track call count after first load
    const callCountAfterFirstLoad = mockReadFile.mock.calls.length;

    // Second call for same prompt should use cache (no additional file reads)
    const prompt2 = await service.loadPrompt('product');
    expect(mockReadFile.mock.calls.length).toBe(callCountAfterFirstLoad);
    expect(prompt2).toBe(prompt1);
  });

  it('should map prompt filenames correctly (e.g., product-steering.prompt.md -> product.md)', () => {
    // Verify prompt file mappings constant
    expect(STEERING_PROMPT_FILES['product']).toBe('product-steering.prompt.md');
    expect(STEERING_PROMPT_FILES['tech']).toBe('tech-steering.prompt.md');
    expect(STEERING_PROMPT_FILES['structure']).toBe('structure-steering.prompt.md');
    expect(STEERING_PROMPT_FILES['customer-context']).toBe('customer-context-steering.prompt.md');
    expect(STEERING_PROMPT_FILES['integration-landscape']).toBe('integration-landscape-steering.prompt.md');
    expect(STEERING_PROMPT_FILES['security-policies']).toBe('security-policies-steering.prompt.md');
    expect(STEERING_PROMPT_FILES['demo-strategy']).toBe('demo-strategy-steering.prompt.md');
    expect(STEERING_PROMPT_FILES['agentify-integration']).toBe('agentify-integration-steering.prompt.md');
  });
});

// ============================================================================
// Test 2: EventEmitter Pattern
// ============================================================================

describe('SteeringGenerationService - EventEmitter Pattern', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSteeringGenerationService();
  });

  afterEach(() => {
    resetSteeringGenerationService();
  });

  it('should expose onFileStart, onFileComplete, onFileError events', () => {
    const mockContext = createMockContext();
    const service = getSteeringGenerationService(mockContext);

    // Verify events are defined
    expect(service.onFileStart).toBeDefined();
    expect(service.onFileComplete).toBeDefined();
    expect(service.onFileError).toBeDefined();

    // Verify events are functions (event subscriptions)
    expect(typeof service.onFileStart).toBe('function');
    expect(typeof service.onFileComplete).toBe('function');
    expect(typeof service.onFileError).toBe('function');
  });

  it('should fire progress events with index metadata (fileName, index, total)', async () => {
    const mockContext = createMockContext();
    const service = getSteeringGenerationService(mockContext);

    // Subscribe to events
    const fileStartEvents: FileProgressEvent[] = [];
    const fileCompleteEvents: FileCompleteEvent[] = [];
    const fileErrorEvents: FileErrorEvent[] = [];

    service.onFileStart((event) => fileStartEvents.push(event));
    service.onFileComplete((event) => fileCompleteEvents.push(event));
    service.onFileError((event) => fileErrorEvents.push(event));

    // Fire test events via internal emitters (testing the emitter interface)
    // @ts-expect-error - accessing private for testing
    service._onFileStart.fire({ fileName: 'product.md', index: 0, total: 8 });
    // @ts-expect-error - accessing private for testing
    service._onFileComplete.fire({ fileName: 'product.md', index: 0, total: 8, content: '# Product' });
    // @ts-expect-error - accessing private for testing
    service._onFileError.fire({ fileName: 'tech.md', index: 1, total: 8, error: 'Test error' });

    // Verify events were received with correct structure
    expect(fileStartEvents).toHaveLength(1);
    expect(fileStartEvents[0]).toEqual({ fileName: 'product.md', index: 0, total: 8 });

    expect(fileCompleteEvents).toHaveLength(1);
    expect(fileCompleteEvents[0]).toEqual({ fileName: 'product.md', index: 0, total: 8, content: '# Product' });

    expect(fileErrorEvents).toHaveLength(1);
    expect(fileErrorEvents[0]).toEqual({ fileName: 'tech.md', index: 1, total: 8, error: 'Test error' });
  });

  it('should dispose EventEmitters properly on service dispose', () => {
    const mockContext = createMockContext();
    const service = getSteeringGenerationService(mockContext);

    // Subscribe to event
    let eventFired = false;
    service.onFileStart(() => { eventFired = true; });

    // Dispose the service
    service.dispose();

    // After dispose, events should not fire (or throw)
    // @ts-expect-error - accessing private for testing
    service._onFileStart.fire({ fileName: 'test.md', index: 0, total: 1 });
    expect(eventFired).toBe(false); // EventEmitter disposed, no listeners
  });
});

// ============================================================================
// Test 3: Model ID Retrieval
// ============================================================================

describe('SteeringGenerationService - Model ID Retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSteeringGenerationService();
  });

  afterEach(() => {
    resetSteeringGenerationService();
  });

  it('should use infrastructure.bedrock.modelId when provided', async () => {
    const mockContext = createMockContext();
    const mockGetConfigService = vi.mocked(getConfigService);

    mockGetConfigService.mockReturnValue({
      getConfig: vi.fn().mockResolvedValue({
        infrastructure: {
          bedrock: {
            modelId: 'custom-bedrock-model',
          },
        },
      }),
    } as any);

    const service = getSteeringGenerationService(mockContext);
    const modelId = await service.getModelId();

    expect(modelId).toBe('custom-bedrock-model');
  });

  it('should use default model ID when no config override exists', async () => {
    const mockContext = createMockContext();
    const mockGetConfigService = vi.mocked(getConfigService);

    mockGetConfigService.mockReturnValue({
      getConfig: vi.fn().mockResolvedValue(null),
    } as any);

    const service = getSteeringGenerationService(mockContext);
    const modelId = await service.getModelId();

    expect(modelId).toBe('global.anthropic.claude-sonnet-4-5-20250929-v1:0');
  });
});

// ============================================================================
// Test 4: Singleton Pattern
// ============================================================================

describe('SteeringGenerationService - Singleton Pattern', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSteeringGenerationService();
  });

  afterEach(() => {
    resetSteeringGenerationService();
  });

  it('should return same instance on subsequent calls to getter', () => {
    const mockContext = createMockContext();

    const service1 = getSteeringGenerationService(mockContext);
    const service2 = getSteeringGenerationService(mockContext);

    expect(service1).toBe(service2);
  });

  it('should reset instance when resetSteeringGenerationService is called', () => {
    const mockContext = createMockContext();

    const service1 = getSteeringGenerationService(mockContext);
    resetSteeringGenerationService();
    const service2 = getSteeringGenerationService(mockContext);

    expect(service1).not.toBe(service2);
  });
});

// ============================================================================
// Test 5: Interface Contracts
// ============================================================================

describe('SteeringGenerationService - Interface Contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSteeringGenerationService();
  });

  afterEach(() => {
    resetSteeringGenerationService();
  });

  it('should define GeneratedFile interface with correct fields', () => {
    // Type assertion test - if this compiles, the interface is correct
    const testFile: GeneratedFile = {
      fileName: 'product.md',
      content: '# Product Description',
      status: 'created',
    };

    expect(testFile.fileName).toBe('product.md');
    expect(testFile.content).toBe('# Product Description');
    expect(testFile.status).toBe('created');

    // Test with optional error field
    const failedFile: GeneratedFile = {
      fileName: 'tech.md',
      content: '',
      status: 'failed',
      error: 'Generation failed',
    };

    expect(failedFile.status).toBe('failed');
    expect(failedFile.error).toBe('Generation failed');
  });

  it('should define GenerationResult interface with correct fields', () => {
    // Type assertion test for successful generation
    const successResult: GenerationResult = {
      success: true,
      files: [
        { fileName: 'product.md', content: '# Product', status: 'created' },
      ],
    };

    expect(successResult.success).toBe(true);
    expect(successResult.files).toHaveLength(1);

    // Type assertion test for partial failure
    const partialResult: GenerationResult = {
      success: false,
      files: [
        { fileName: 'product.md', content: '# Product', status: 'created' },
        { fileName: 'tech.md', content: '', status: 'failed', error: 'Failed' },
      ],
      errors: [{ file: 'tech.md', error: 'Failed' }],
    };

    expect(partialResult.success).toBe(false);
    expect(partialResult.errors).toHaveLength(1);
  });

  it('should define FileCompleteEvent with content field extending FileProgressEvent', () => {
    const completeEvent: FileCompleteEvent = {
      fileName: 'product.md',
      index: 0,
      total: 8,
      content: '# Product Steering Document\n\nThis is the generated content.',
    };

    expect(completeEvent.fileName).toBe('product.md');
    expect(completeEvent.index).toBe(0);
    expect(completeEvent.total).toBe(8);
    expect(completeEvent.content).toContain('Product Steering Document');
  });
});

// ============================================================================
// Test 6: Service Implements Disposable
// ============================================================================

describe('SteeringGenerationService - vscode.Disposable Implementation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSteeringGenerationService();
  });

  afterEach(() => {
    resetSteeringGenerationService();
  });

  it('should implement vscode.Disposable interface', () => {
    const mockContext = createMockContext();
    const service = getSteeringGenerationService(mockContext);

    // Verify dispose method exists
    expect(typeof service.dispose).toBe('function');

    // Dispose should not throw
    expect(() => service.dispose()).not.toThrow();
  });

  it('should clear prompt cache on dispose', async () => {
    const mockContext = createMockContext();
    const mockReadFile = vi.mocked(vscode.workspace.fs.readFile);
    mockReadFile.mockResolvedValue(createMockPromptContent('test'));

    const service = getSteeringGenerationService(mockContext);

    // Load a prompt to populate cache
    await service.loadPrompt('product');
    const callCountAfterFirstLoad = mockReadFile.mock.calls.length;

    // Dispose and reset
    service.dispose();
    resetSteeringGenerationService();

    // Get new instance and load again - should read from file again
    const newService = getSteeringGenerationService(mockContext);
    await newService.loadPrompt('product');

    // New service should have loaded from file (not using old cache)
    expect(mockReadFile.mock.calls.length).toBeGreaterThan(callCountAfterFirstLoad);
  });
});

// ============================================================================
// Task Group 3 Tests: Generation Methods and Retry Logic
// ============================================================================

describe('SteeringGenerationService - Generation Methods (Task Group 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSteeringGenerationService();

    // Setup default mocks
    const mockReadFile = vi.mocked(vscode.workspace.fs.readFile);
    mockReadFile.mockImplementation(async (uri: vscode.Uri) => {
      const path = uri.path || uri.fsPath;
      const fileName = path.split('/').pop() || 'unknown';
      return createMockPromptContent(fileName);
    });

    const mockGetConfigService = vi.mocked(getConfigService);
    mockGetConfigService.mockReturnValue({
      getConfig: vi.fn().mockResolvedValue(null),
    } as any);
  });

  afterEach(() => {
    resetSteeringGenerationService();
  });

  // Test 3.1a: generateSteeringFiles returns all 8 files on success
  it('should return all 8 files on successful generation', async () => {
    const mockContext = createMockContext();
    const mockBedrockClient = createMockBedrockClient({
      successContent: '# Generated Steering Document\n\nContent here.',
    });
    vi.mocked(getBedrockClientAsync).mockResolvedValue(mockBedrockClient as any);

    const service = getSteeringGenerationService(mockContext);
    const state = createPopulatedWizardState();

    const result = await service.generateSteeringFiles(state);

    // Should return all 8 files
    expect(result.files).toHaveLength(8);
    expect(result.success).toBe(true);

    // Verify all expected file names are present
    const fileNames = result.files.map(f => f.fileName);
    expect(fileNames).toContain('product.md');
    expect(fileNames).toContain('tech.md');
    expect(fileNames).toContain('structure.md');
    expect(fileNames).toContain('customer-context.md');
    expect(fileNames).toContain('integration-landscape.md');
    expect(fileNames).toContain('security-policies.md');
    expect(fileNames).toContain('demo-strategy.md');
    expect(fileNames).toContain('agentify-integration.md');

    // All files should have 'created' status
    result.files.forEach(file => {
      expect(file.status).toBe('created');
      expect(file.content).toContain('Generated Steering Document');
    });
  });

  // Test 3.1b: Partial success model (failed files have error, others succeed)
  it('should handle partial success with some files failing', async () => {
    const mockContext = createMockContext();
    let callCount = 0;

    const mockBedrockClient = {
      send: vi.fn().mockImplementation(async () => {
        callCount++;
        // Fail on 3rd and 6th calls to simulate partial failure
        if (callCount === 3 || callCount === 6) {
          const error = new Error('Generation failed') as Error & { name: string };
          error.name = 'ValidationException';
          throw error;
        }
        return createMockBedrockResponse(`# Generated Document ${callCount}`);
      }),
    };
    vi.mocked(getBedrockClientAsync).mockResolvedValue(mockBedrockClient as any);

    const service = getSteeringGenerationService(mockContext);
    const state = createPopulatedWizardState();

    const result = await service.generateSteeringFiles(state);

    // Should return all 8 files (some failed)
    expect(result.files).toHaveLength(8);
    expect(result.success).toBe(false);

    // Count successes and failures
    const successFiles = result.files.filter(f => f.status === 'created');
    const failedFiles = result.files.filter(f => f.status === 'failed');

    expect(successFiles.length).toBe(6);
    expect(failedFiles.length).toBe(2);

    // Failed files should have error messages
    failedFiles.forEach(file => {
      expect(file.error).toBeDefined();
      expect(file.content).toBe('');
    });

    // Errors array should contain the failures
    expect(result.errors).toBeDefined();
    expect(result.errors).toHaveLength(2);
  });

  // Test 3.1c: Retry logic retries up to 2 times with exponential backoff
  it('should retry failed generations up to 2 times with exponential backoff', async () => {
    const mockContext = createMockContext();
    let attemptCount = 0;
    const attemptTimestamps: number[] = [];

    const mockBedrockClient = {
      send: vi.fn().mockImplementation(async () => {
        attemptCount++;
        attemptTimestamps.push(Date.now());

        // Fail first 2 attempts, succeed on 3rd
        if (attemptCount <= 2) {
          const error = new Error('Throttled') as Error & { name: string };
          error.name = 'ThrottlingException';
          throw error;
        }
        return createMockBedrockResponse('# Generated after retry');
      }),
    };
    vi.mocked(getBedrockClientAsync).mockResolvedValue(mockBedrockClient as any);

    const service = getSteeringGenerationService(mockContext);
    const state = createPopulatedWizardState();

    // Generate just one file to test retry behavior
    // Using internal method for focused testing
    // @ts-expect-error - accessing private for testing
    const result = await service._generateWithRetry('product', {});

    // Should have made 3 attempts (initial + 2 retries)
    expect(attemptCount).toBe(3);
    expect(result).toContain('Generated after retry');

    // Verify exponential backoff timing (roughly)
    // Backoff should be ~1000ms, then ~2000ms
    if (attemptTimestamps.length >= 3) {
      const firstBackoff = attemptTimestamps[1] - attemptTimestamps[0];
      const secondBackoff = attemptTimestamps[2] - attemptTimestamps[1];
      // Allow some tolerance for timing
      expect(firstBackoff).toBeGreaterThanOrEqual(900);
      expect(secondBackoff).toBeGreaterThanOrEqual(1800);
    }
  });

  // Test 3.1d: Events fire for each document as it completes (non-deterministic order)
  it('should fire events for each document as it completes', async () => {
    const mockContext = createMockContext();
    const mockBedrockClient = createMockBedrockClient({
      successContent: '# Document Content',
    });
    vi.mocked(getBedrockClientAsync).mockResolvedValue(mockBedrockClient as any);

    const service = getSteeringGenerationService(mockContext);
    const state = createPopulatedWizardState();

    // Track events
    const startEvents: FileProgressEvent[] = [];
    const completeEvents: FileCompleteEvent[] = [];

    service.onFileStart(event => startEvents.push(event));
    service.onFileComplete(event => completeEvents.push(event));

    await service.generateSteeringFiles(state);

    // Should fire start and complete events for all 8 files
    expect(startEvents).toHaveLength(8);
    expect(completeEvents).toHaveLength(8);

    // Each event should have proper index metadata
    startEvents.forEach(event => {
      expect(event.total).toBe(8);
      expect(event.index).toBeGreaterThanOrEqual(0);
      expect(event.index).toBeLessThan(8);
      expect(event.fileName).toMatch(/\.md$/);
    });

    completeEvents.forEach(event => {
      expect(event.total).toBe(8);
      expect(event.content).toBeDefined();
    });
  });

  // Test 3.1e: retryFiles only regenerates specified files
  it('should only regenerate specified files when using retryFiles', async () => {
    const mockContext = createMockContext();
    const generatedFiles: string[] = [];

    const mockBedrockClient = {
      send: vi.fn().mockImplementation(async (command: any) => {
        // Extract file info from the command's user message
        const userMessage = command?.input?.messages?.[0]?.content?.[0]?.text || '';
        // Track which files are being generated
        generatedFiles.push('generated');
        return createMockBedrockResponse(`# Regenerated Document`);
      }),
    };
    vi.mocked(getBedrockClientAsync).mockResolvedValue(mockBedrockClient as any);

    const service = getSteeringGenerationService(mockContext);
    const state = createPopulatedWizardState();

    // Retry only 2 specific files
    const result = await service.retryFiles(state, ['product.md', 'tech.md']);

    // Should only return the 2 requested files
    expect(result.files).toHaveLength(2);
    expect(result.files.map(f => f.fileName)).toContain('product.md');
    expect(result.files.map(f => f.fileName)).toContain('tech.md');

    // Bedrock should have been called only twice
    expect(mockBedrockClient.send).toHaveBeenCalledTimes(2);
  });

  // Test 3.1f: Events include index and total metadata for UI ordering
  it('should include index and total metadata in events for UI ordering', async () => {
    const mockContext = createMockContext();
    const mockBedrockClient = createMockBedrockClient({
      successContent: '# Test Document',
    });
    vi.mocked(getBedrockClientAsync).mockResolvedValue(mockBedrockClient as any);

    const service = getSteeringGenerationService(mockContext);
    const state = createPopulatedWizardState();

    const allEvents: FileProgressEvent[] = [];
    service.onFileStart(event => allEvents.push(event));

    await service.generateSteeringFiles(state);

    // Verify metadata structure
    expect(allEvents.length).toBe(8);
    allEvents.forEach(event => {
      expect(typeof event.index).toBe('number');
      expect(typeof event.total).toBe('number');
      expect(event.total).toBe(8);
      expect(event.index).toBeGreaterThanOrEqual(0);
      expect(event.index).toBeLessThan(8);
    });

    // Verify all indices are unique (0-7)
    const indices = allEvents.map(e => e.index).sort((a, b) => a - b);
    expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});
