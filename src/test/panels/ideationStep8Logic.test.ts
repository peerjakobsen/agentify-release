/**
 * Tests for Step 8: Generation Logic Handler
 * Task Group 3: Step 8 Logic Handler
 *
 * Tests the Step8LogicHandler class that orchestrates steering file
 * generation and provides step summaries for the pre-generation UI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock service before mocking modules
const mockService = {
  onFileStart: vi.fn().mockReturnValue({ dispose: () => {} }),
  onFileComplete: vi.fn().mockReturnValue({ dispose: () => {} }),
  onFileError: vi.fn().mockReturnValue({ dispose: () => {} }),
  generateSteeringFiles: vi.fn(),
  dispose: vi.fn(),
};

// Mock vscode module before importing the logic handler
vi.mock('vscode', () => ({
  EventEmitter: class {
    private listeners: ((data: unknown) => void)[] = [];
    event = (listener: (data: unknown) => void) => {
      this.listeners.push(listener);
      return { dispose: () => {} };
    };
    fire = (data: unknown) => {
      this.listeners.forEach((l) => l(data));
    };
    dispose = vi.fn();
  },
  Uri: {
    file: vi.fn().mockReturnValue({ fsPath: '/test/path' }),
    joinPath: vi.fn().mockReturnValue({ fsPath: '/test/path' }),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
  },
  window: {
    showWarningMessage: vi.fn().mockResolvedValue('Start Over'),
  },
  commands: {
    executeCommand: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock the steering file service - use the pre-defined mockService
vi.mock('../../services/steeringFileService', () => ({
  getSteeringFileService: () => mockService,
  resetSteeringFileService: vi.fn(),
  SteeringFileService: vi.fn(),
}));

// Import after mocks
import {
  Step8LogicHandler,
  type Step8ContextInputs,
  type Step8Callbacks,
} from '../../panels/ideationStep8Logic';
import {
  createDefaultGenerationState,
  type GenerationState,
} from '../../types/wizardPanel';

// ============================================================================
// Task 3.1: 6 Focused Tests for Step8LogicHandler
// ============================================================================

describe('Task Group 3: Step8LogicHandler', () => {
  // Common test fixtures
  let mockState: GenerationState;
  let mockCallbacks: Step8Callbacks;
  let mockIdeationState: Step8ContextInputs;

  const createValidIdeationState = (): Step8ContextInputs => ({
    businessObjective: 'Automate inventory management',
    industry: 'Retail',
    systems: ['SAP S/4HANA', 'Salesforce'],
    aiGapFillingState: {
      confirmedAssumptions: [{ system: 'SAP', modules: ['MM'], integrations: [], source: 'ai-proposed' }],
      assumptionsAccepted: true,
      conversationHistory: [],
      isStreaming: false,
    },
    outcome: {
      primaryOutcome: 'Reduce manual effort by 50%',
      successMetrics: [{ name: 'Processing Time', targetValue: '50', unit: '%' }],
      stakeholders: ['Operations'],
      isLoading: false,
      primaryOutcomeEdited: false,
      metricsEdited: false,
      stakeholdersEdited: false,
      customStakeholders: [],
      suggestionsAccepted: true,
      refinedSections: { outcome: false, kpis: false, stakeholders: false },
    },
    security: {
      dataSensitivity: 'internal',
      complianceFrameworks: [],
      approvalGates: [],
      guardrailNotes: '',
      skipped: false,
    },
    agentDesign: {
      confirmedAgents: [
        { id: 'planner', name: 'Planner', role: 'Plans tasks', tools: ['sap_get_inventory'], nameEdited: false, roleEdited: false, toolsEdited: false },
      ],
      confirmedOrchestration: 'workflow',
      confirmedEdges: [],
      proposedAgents: [],
      proposedOrchestration: 'workflow',
      proposedEdges: [],
      orchestrationReasoning: '',
      proposalAccepted: true,
      isLoading: false,
      aiCalled: true,
      originalOrchestration: 'workflow',
    },
    mockData: {
      mockDefinitions: [
        { tool: 'sap_get_inventory', system: 'SAP', operation: 'get', description: '', mockRequest: {}, mockResponse: {}, sampleData: [{}], expanded: true, requestEdited: false, responseEdited: false, sampleDataEdited: false },
      ],
      useCustomerTerminology: false,
      isLoading: false,
      aiCalled: true,
    },
    demoStrategy: {
      ahaMoments: [{ id: '1', title: 'Wow moment', triggerType: 'agent', triggerName: 'planner', talkingPoint: 'Amazing!' }],
      persona: { name: 'Maria', role: 'Manager', painPoint: 'Manual work' },
      narrativeScenes: [{ id: '1', title: 'Scene 1', description: 'Description', highlightedAgents: ['planner'] }],
      isGeneratingMoments: false,
      isGeneratingPersona: false,
      isGeneratingNarrative: false,
      momentsEdited: false,
      personaEdited: false,
      narrativeEdited: false,
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock service return values after clearAllMocks
    mockService.onFileStart.mockReturnValue({ dispose: () => {} });
    mockService.onFileComplete.mockReturnValue({ dispose: () => {} });
    mockService.onFileError.mockReturnValue({ dispose: () => {} });
    mockService.generateSteeringFiles.mockResolvedValue({
      files: [
        '/test/workspace/.kiro/steering/product.md',
        '/test/workspace/.kiro/steering/tech.md',
        '/test/workspace/.kiro/steering/structure.md',
        '/test/workspace/.kiro/steering/customer-context.md',
        '/test/workspace/.kiro/steering/integration-landscape.md',
        '/test/workspace/.kiro/steering/security-policies.md',
        '/test/workspace/.kiro/steering/demo-strategy.md',
      ],
      placeholder: true,
    });

    mockState = createDefaultGenerationState();
    mockCallbacks = {
      updateWebviewContent: vi.fn(),
      syncStateToWebview: vi.fn(),
      showConfirmDialog: vi.fn().mockResolvedValue('Start Over'),
      openFile: vi.fn().mockResolvedValue(undefined),
      onStartOver: vi.fn(),
    };
    mockIdeationState = createValidIdeationState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Test 1: Constructor initializes with state and callbacks
  // ---------------------------------------------------------------------------
  describe('Test 1: Constructor initializes with state and callbacks', () => {
    it('should initialize handler with provided state', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      expect(handler.getState()).toBe(mockState);
    });

    it('should allow updating state via setState', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);
      const newState = createDefaultGenerationState();
      newState.isGenerating = true;

      handler.setState(newState);

      expect(handler.getState()).toBe(newState);
      expect(handler.getState().isGenerating).toBe(true);
    });

    it('should dispose without errors', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      expect(() => handler.dispose()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2: handleGenerate() sets isGenerating to true
  // ---------------------------------------------------------------------------
  describe('Test 2: handleGenerate() sets isGenerating to true', () => {
    it('should set isGenerating to true when generation starts', async () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      // Start generation (async)
      const promise = handler.handleGenerate(mockIdeationState);

      // Check state immediately - isGenerating should be true
      expect(handler.getState().isGenerating).toBe(true);

      await promise;
    });

    it('should reset generation state before starting', async () => {
      mockState.completedFiles = ['old-file.md'];
      mockState.failedFile = { name: 'failed.md', error: 'test' };
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleGenerate(mockIdeationState);

      expect(handler.getState().failedFile).toBeUndefined();
    });

    it('should not start generation if canGenerate is false', async () => {
      mockState.canGenerate = false;
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleGenerate(mockIdeationState);

      expect(handler.getState().isGenerating).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3: handleRetry() resumes from failed file index
  // ---------------------------------------------------------------------------
  describe('Test 3: handleRetry() resumes from failed file index', () => {
    it('should clear failedFile when retrying', async () => {
      mockState.failedFile = { name: 'structure.md', error: 'Test error' };
      mockState.currentFileIndex = 2;
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleRetry(mockIdeationState);

      expect(handler.getState().failedFile).toBeUndefined();
    });

    it('should set isGenerating true when retrying', async () => {
      mockState.failedFile = { name: 'structure.md', error: 'Test error' };
      mockState.currentFileIndex = 2;
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      const promise = handler.handleRetry(mockIdeationState);
      expect(handler.getState().isGenerating).toBe(true);

      await promise;
    });
  });

  // ---------------------------------------------------------------------------
  // Test 4: handleStartOver() calls confirmation callback
  // ---------------------------------------------------------------------------
  describe('Test 4: handleStartOver() calls confirmation callback', () => {
    it('should call showConfirmDialog with correct message', async () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleStartOver();

      expect(mockCallbacks.showConfirmDialog).toHaveBeenCalledWith(
        'This will clear all wizard data. Generated files will not be deleted.',
        ['Start Over', 'Cancel']
      );
    });

    it('should call onStartOver callback when user confirms', async () => {
      mockCallbacks.showConfirmDialog = vi.fn().mockResolvedValue('Start Over');
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleStartOver();

      expect(mockCallbacks.onStartOver).toHaveBeenCalled();
    });

    it('should not call onStartOver when user cancels', async () => {
      mockCallbacks.showConfirmDialog = vi.fn().mockResolvedValue('Cancel');
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleStartOver();

      expect(mockCallbacks.onStartOver).not.toHaveBeenCalled();
    });

    it('should not call onStartOver when dialog is dismissed', async () => {
      mockCallbacks.showConfirmDialog = vi.fn().mockResolvedValue(undefined);
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleStartOver();

      expect(mockCallbacks.onStartOver).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Test 5: aggregateValidationStatus() returns correct status per step
  // ---------------------------------------------------------------------------
  describe('Test 5: aggregateValidationStatus() returns correct status per step', () => {
    it('should return complete for Step 1 with valid data', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      const status = handler.getValidationStatusForStep(1, mockIdeationState);

      expect(status.status).toBe('complete');
    });

    it('should return error for Step 1 with missing businessObjective', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);
      mockIdeationState.businessObjective = '';

      const status = handler.getValidationStatusForStep(1, mockIdeationState);

      expect(status.status).toBe('error');
      expect(status.message).toContain('Business objective');
    });

    it('should return warning for Step 4 when skipped', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);
      mockIdeationState.security.skipped = true;

      const status = handler.getValidationStatusForStep(4, mockIdeationState);

      expect(status.status).toBe('warning');
      expect(status.message).toContain('skipped');
    });

    it('should return warning for Step 7 with no aha moments', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);
      mockIdeationState.demoStrategy.ahaMoments = [];

      const status = handler.getValidationStatusForStep(7, mockIdeationState);

      expect(status.status).toBe('warning');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 6: getStepSummaries() returns summaries for Steps 1-7
  // ---------------------------------------------------------------------------
  describe('Test 6: getStepSummaries() returns summaries for Steps 1-7', () => {
    it('should return 7 step summaries', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      const summaries = handler.getStepSummaries(mockIdeationState);

      expect(summaries).toHaveLength(7);
    });

    it('should include correct step names', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      const summaries = handler.getStepSummaries(mockIdeationState);

      expect(summaries[0].stepName).toBe('Business Context');
      expect(summaries[1].stepName).toBe('AI Gap Filling');
      expect(summaries[2].stepName).toBe('Outcomes');
      expect(summaries[3].stepName).toBe('Security');
      expect(summaries[4].stepName).toBe('Agent Design');
      expect(summaries[5].stepName).toBe('Mock Data');
      expect(summaries[6].stepName).toBe('Demo Strategy');
    });

    it('should include summary data for each step', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      const summaries = handler.getStepSummaries(mockIdeationState);

      expect(summaries[0].summaryData['Industry']).toBe('Retail');
      expect(summaries[4].summaryData['Agents']).toBe('1 agent');
      expect(summaries[5].summaryData['Tools']).toBe('1 tool');
    });

    it('should include validation status for each step', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      const summaries = handler.getStepSummaries(mockIdeationState);

      summaries.forEach((summary) => {
        expect(['complete', 'warning', 'error']).toContain(summary.validationStatus);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Additional Tests for Supporting Functionality
  // ---------------------------------------------------------------------------
  describe('handleToggleAccordion()', () => {
    it('should toggle accordion expanded state', () => {
      mockState.accordionExpanded = false;
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      handler.handleToggleAccordion();

      expect(handler.getState().accordionExpanded).toBe(true);

      handler.handleToggleAccordion();

      expect(handler.getState().accordionExpanded).toBe(false);
    });

    it('should call updateWebviewContent', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      handler.handleToggleAccordion();

      expect(mockCallbacks.updateWebviewContent).toHaveBeenCalled();
    });
  });

  describe('handleOpenFile()', () => {
    it('should call openFile callback with file path', async () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleOpenFile('/test/path/product.md');

      expect(mockCallbacks.openFile).toHaveBeenCalledWith('/test/path/product.md');
    });
  });
});
