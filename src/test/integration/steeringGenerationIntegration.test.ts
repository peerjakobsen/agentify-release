/**
 * Integration Tests for Steering Generation Service (Task Group 4)
 *
 * These tests validate the integration points between the steering generation
 * service, type constants, and service exports for the complete steering file
 * generation pipeline.
 *
 * @see spec.md - Steering Generation Service specification
 * @see tasks.md - Task Group 4: Type Updates and Integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

// Mock vscode namespace
vi.mock('vscode', () => {
  // EventEmitter mock
  class MockEventEmitter<T> {
    private listeners: ((e: T) => void)[] = [];
    private _disposed = false;

    public event = (listener: (e: T) => void) => {
      this.listeners.push(listener);
      return {
        dispose: () => {
          const index = this.listeners.indexOf(listener);
          if (index !== -1) this.listeners.splice(index, 1);
        },
      };
    };

    public fire(data: T) {
      if (!this._disposed) {
        this.listeners.forEach((l) => l(data));
      }
    }

    public dispose() {
      this._disposed = true;
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

import { STEERING_FILES, createDefaultWizardState, type WizardState } from '../../types/wizardPanel';
import {
  SteeringGenerationService,
  getSteeringGenerationService,
  resetSteeringGenerationService,
  type GeneratedFile,
  type GenerationResult,
  type FileProgressEvent,
  type FileCompleteEvent,
  type FileErrorEvent,
  STEERING_FILE_KEYS,
  STEERING_PROMPT_FILES,
} from '../../services/steeringGenerationService';
import { getBedrockClientAsync } from '../../services/bedrockClient';
import { getConfigService } from '../../services/configService';

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
 * Creates a populated WizardState for integration testing
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
  state.outcome.successMetrics = [{ name: 'Order accuracy', targetValue: '95', unit: '%' }];
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
  ];
  state.agentDesign.confirmedOrchestration = 'workflow';
  state.agentDesign.confirmedEdges = [];

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

// ============================================================================
// Integration Test 1: STEERING_FILES Constant
// ============================================================================

describe('STEERING_FILES Constant Integration (Task 4.1a)', () => {
  it('should have exactly 8 entries in the correct order', () => {
    // Verify count
    expect(STEERING_FILES).toHaveLength(8);

    // Verify exact order matches specification
    expect(STEERING_FILES[0]).toBe('product.md');
    expect(STEERING_FILES[1]).toBe('tech.md');
    expect(STEERING_FILES[2]).toBe('structure.md');
    expect(STEERING_FILES[3]).toBe('customer-context.md');
    expect(STEERING_FILES[4]).toBe('integration-landscape.md');
    expect(STEERING_FILES[5]).toBe('security-policies.md');
    expect(STEERING_FILES[6]).toBe('demo-strategy.md');
    expect(STEERING_FILES[7]).toBe('agentify-integration.md');
  });

  it('should match service STEERING_FILE_KEYS when .md extension is added', () => {
    // STEERING_FILE_KEYS in service should match STEERING_FILES pattern
    const serviceFiles = STEERING_FILE_KEYS.map((key) => `${key}.md`);
    expect(serviceFiles).toEqual(STEERING_FILES);
  });

  it('should have matching prompt files for all steering files', () => {
    // Each STEERING_FILE_KEYS entry should have a corresponding prompt
    for (const key of STEERING_FILE_KEYS) {
      expect(STEERING_PROMPT_FILES[key]).toBeDefined();
      expect(STEERING_PROMPT_FILES[key]).toMatch(/\.prompt\.md$/);
    }
  });
});

// ============================================================================
// Integration Test 2: Service Exports Interface
// ============================================================================

describe('Service Exports Interface (Task 4.1b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSteeringGenerationService();
  });

  afterEach(() => {
    resetSteeringGenerationService();
  });

  it('should export FileProgressEvent, FileCompleteEvent, FileErrorEvent interfaces', () => {
    // Type assertions - if these compile, the interfaces are correctly exported
    const progressEvent: FileProgressEvent = {
      fileName: 'product.md',
      index: 0,
      total: 8,
    };

    const completeEvent: FileCompleteEvent = {
      fileName: 'product.md',
      index: 0,
      total: 8,
      content: '# Generated Content',
    };

    const errorEvent: FileErrorEvent = {
      fileName: 'product.md',
      index: 0,
      total: 8,
      error: 'Generation failed',
    };

    // Verify structure
    expect(progressEvent.fileName).toBe('product.md');
    expect(completeEvent.content).toBe('# Generated Content');
    expect(errorEvent.error).toBe('Generation failed');
  });

  it('should export GeneratedFile interface with all required fields', () => {
    const successFile: GeneratedFile = {
      fileName: 'product.md',
      content: '# Product Steering Document',
      status: 'created',
    };

    const failedFile: GeneratedFile = {
      fileName: 'tech.md',
      content: '',
      status: 'failed',
      error: 'Network error',
    };

    expect(successFile.status).toBe('created');
    expect(failedFile.error).toBe('Network error');
  });

  it('should export singleton getter with correct signature', () => {
    const mockContext = createMockContext();

    // Verify getter function exists and returns service instance
    expect(typeof getSteeringGenerationService).toBe('function');

    const service = getSteeringGenerationService(mockContext);
    expect(service).toBeInstanceOf(SteeringGenerationService);

    // Verify it returns the same instance (singleton pattern)
    const service2 = getSteeringGenerationService(mockContext);
    expect(service).toBe(service2);
  });

  it('should export reset function for testing cleanup', () => {
    expect(typeof resetSteeringGenerationService).toBe('function');

    const mockContext = createMockContext();
    const service1 = getSteeringGenerationService(mockContext);
    resetSteeringGenerationService();
    const service2 = getSteeringGenerationService(mockContext);

    // After reset, should get a new instance
    expect(service1).not.toBe(service2);
  });
});

// ============================================================================
// Integration Test 3: End-to-End Generation with Mock Bedrock
// ============================================================================

describe('End-to-End Generation Integration (Task 4.1c)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSteeringGenerationService();

    // Setup default file system mock
    const mockReadFile = vi.mocked(vscode.workspace.fs.readFile);
    mockReadFile.mockImplementation(async (uri: vscode.Uri) => {
      const path = uri.path || uri.fsPath;
      const fileName = path.split('/').pop() || 'unknown';
      return createMockPromptContent(fileName);
    });

    // Setup default config mock
    const mockGetConfigService = vi.mocked(getConfigService);
    mockGetConfigService.mockReturnValue({
      getConfig: vi.fn().mockResolvedValue(null),
    } as any);
  });

  afterEach(() => {
    resetSteeringGenerationService();
  });

  it('should generate all 8 steering files end-to-end with mock Bedrock', async () => {
    const mockContext = createMockContext();

    // Setup mock Bedrock client to return successful responses
    const mockBedrockClient = {
      send: vi.fn().mockImplementation(async () => {
        return createMockBedrockResponse('# Generated Steering Document\n\nContent generated successfully.');
      }),
    };
    vi.mocked(getBedrockClientAsync).mockResolvedValue(mockBedrockClient as any);

    const service = getSteeringGenerationService(mockContext);
    const state = createPopulatedWizardState();

    // Track events
    const startEvents: FileProgressEvent[] = [];
    const completeEvents: FileCompleteEvent[] = [];

    service.onFileStart((event) => startEvents.push(event));
    service.onFileComplete((event) => completeEvents.push(event));

    // Execute generation
    const result = await service.generateSteeringFiles(state);

    // Verify result structure
    expect(result.success).toBe(true);
    expect(result.files).toHaveLength(8);
    expect(result.errors).toBeUndefined();

    // Verify all files have correct status
    for (const file of result.files) {
      expect(file.status).toBe('created');
      expect(file.content).toContain('Generated Steering Document');
    }

    // Verify events fired for all 8 files
    expect(startEvents).toHaveLength(8);
    expect(completeEvents).toHaveLength(8);

    // Verify file names include agentify-integration.md
    const fileNames = result.files.map((f) => f.fileName);
    expect(fileNames).toContain('agentify-integration.md');
    expect(fileNames).toContain('product.md');
    expect(fileNames).toContain('demo-strategy.md');
  });

  it('should handle partial failures gracefully', async () => {
    const mockContext = createMockContext();
    let callCount = 0;

    // Setup mock that fails on specific calls
    const mockBedrockClient = {
      send: vi.fn().mockImplementation(async () => {
        callCount++;
        // Fail on the 4th call (customer-context.md)
        if (callCount === 4) {
          const error = new Error('Simulated API failure') as Error & { name: string };
          error.name = 'ValidationException';
          throw error;
        }
        return createMockBedrockResponse(`# Document ${callCount}`);
      }),
    };
    vi.mocked(getBedrockClientAsync).mockResolvedValue(mockBedrockClient as any);

    const service = getSteeringGenerationService(mockContext);
    const state = createPopulatedWizardState();

    const result = await service.generateSteeringFiles(state);

    // Verify partial success model
    expect(result.success).toBe(false);
    expect(result.files).toHaveLength(8);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBe(1);

    // Verify successful files are still created
    const successFiles = result.files.filter((f) => f.status === 'created');
    const failedFiles = result.files.filter((f) => f.status === 'failed');

    expect(successFiles.length).toBe(7);
    expect(failedFiles.length).toBe(1);
  });
});

// ============================================================================
// Integration Test 4: Service Dispose Resources
// ============================================================================

describe('Service Dispose Resources (Task 4.1d)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSteeringGenerationService();
  });

  afterEach(() => {
    resetSteeringGenerationService();
  });

  it('should dispose resources correctly when service is disposed', () => {
    const mockContext = createMockContext();
    const service = getSteeringGenerationService(mockContext);

    // Subscribe to events
    let startFired = false;
    let completeFired = false;
    let errorFired = false;

    service.onFileStart(() => {
      startFired = true;
    });
    service.onFileComplete(() => {
      completeFired = true;
    });
    service.onFileError(() => {
      errorFired = true;
    });

    // Dispose the service
    expect(() => service.dispose()).not.toThrow();

    // After dispose, events should not fire to listeners
    // @ts-expect-error - accessing private for testing
    service._onFileStart.fire({ fileName: 'test.md', index: 0, total: 1 });
    // @ts-expect-error - accessing private for testing
    service._onFileComplete.fire({ fileName: 'test.md', index: 0, total: 1, content: 'test' });
    // @ts-expect-error - accessing private for testing
    service._onFileError.fire({ fileName: 'test.md', index: 0, total: 1, error: 'test' });

    // Events should not have fired to the listeners after dispose
    expect(startFired).toBe(false);
    expect(completeFired).toBe(false);
    expect(errorFired).toBe(false);
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

  it('should implement vscode.Disposable interface', () => {
    const mockContext = createMockContext();
    const service = getSteeringGenerationService(mockContext);

    // Verify dispose method exists and is callable
    expect(typeof service.dispose).toBe('function');
    expect(service.dispose.length).toBe(0); // Takes no arguments

    // Should be safe to call dispose multiple times
    expect(() => {
      service.dispose();
      service.dispose();
    }).not.toThrow();
  });
});
