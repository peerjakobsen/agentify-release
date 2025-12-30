/**
 * Tests for Step 8: Generation Logic Handler
 * Task Group 3: Step 8 Logic Handler
 * Task Group 4: Step 8 Integration with SteeringFileService
 *
 * Tests the Step8LogicHandler class that orchestrates steering file
 * generation and provides step summaries for the pre-generation UI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode module before importing the logic handler
// Create mocks inside the factory to avoid hoisting issues
vi.mock('vscode', () => {
  const showWarningMessage = vi.fn();
  const showErrorMessage = vi.fn();
  const showInformationMessage = vi.fn();

  return {
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
      parse: vi.fn().mockReturnValue({ fsPath: '/test/path' }),
    },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    },
    window: {
      showWarningMessage,
      showErrorMessage,
      showInformationMessage,
    },
    commands: {
      executeCommand: vi.fn().mockResolvedValue(undefined),
    },
    env: {
      openExternal: vi.fn().mockResolvedValue(undefined),
    },
    // Export test mocks
    __test__: {
      showWarningMessage,
      showErrorMessage,
      showInformationMessage,
    },
  };
});

// Mock the steering file service
vi.mock('../../services/steeringFileService', () => {
  const onFileStart = vi.fn().mockReturnValue({ dispose: () => {} });
  const onFileComplete = vi.fn().mockReturnValue({ dispose: () => {} });
  const onFileError = vi.fn().mockReturnValue({ dispose: () => {} });
  const generateSteeringFiles = vi.fn();
  const retryFailedFiles = vi.fn();
  const dispose = vi.fn();

  const mockService = {
    onFileStart,
    onFileComplete,
    onFileError,
    generateSteeringFiles,
    retryFailedFiles,
    dispose,
  };

  return {
    getSteeringFileService: () => mockService,
    resetSteeringFileService: vi.fn(),
    SteeringFileService: vi.fn(),
    __test__: { mockService },
  };
});

// Mock environment utilities
vi.mock('../../utils/environment', () => ({
  isKiroEnvironment: vi.fn().mockReturnValue(false),
  getKiroLearnMoreUrl: vi.fn().mockReturnValue('https://kiro.example.com'),
}));

// Import after mocks
import * as vscode from 'vscode';
import {
  Step8LogicHandler,
  type Step8ContextInputs,
  type Step8Callbacks,
} from '../../panels/ideationStep8Logic';
import {
  createDefaultGenerationState,
  createDefaultWizardState,
  type GenerationState,
  type WizardState,
} from '../../types/wizardPanel';
import * as steeringFileServiceModule from '../../services/steeringFileService';

// Type for accessing test mocks
const vscodeMocks = (vscode as unknown as { __test__: {
  showWarningMessage: ReturnType<typeof vi.fn>;
  showErrorMessage: ReturnType<typeof vi.fn>;
  showInformationMessage: ReturnType<typeof vi.fn>;
}}).__test__;

const serviceMocks = (steeringFileServiceModule as unknown as { __test__: {
  mockService: {
    onFileStart: ReturnType<typeof vi.fn>;
    onFileComplete: ReturnType<typeof vi.fn>;
    onFileError: ReturnType<typeof vi.fn>;
    generateSteeringFiles: ReturnType<typeof vi.fn>;
    retryFailedFiles: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  };
}}).__test__;

// ============================================================================
// Task Groups 3 & 4: Tests for Step8LogicHandler
// ============================================================================

describe('Task Groups 3 & 4: Step8LogicHandler', () => {
  // Common test fixtures
  let mockState: GenerationState;
  let mockCallbacks: Step8Callbacks;
  let mockIdeationState: Step8ContextInputs;
  let mockWizardState: WizardState;

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
      dataSensitivity: 'internal' as const,
      complianceFrameworks: [],
      approvalGates: [],
      guardrailNotes: '',
      skipped: false,
    },
    agentDesign: {
      confirmedAgents: [
        { id: 'planner', name: 'Planner', role: 'Plans tasks', tools: ['sap_get_inventory'], nameEdited: false, roleEdited: false, toolsEdited: false },
      ],
      confirmedOrchestration: 'workflow' as const,
      confirmedEdges: [],
      proposedAgents: [],
      proposedOrchestration: 'workflow' as const,
      proposedEdges: [],
      orchestrationReasoning: '',
      proposalAccepted: true,
      isLoading: false,
      aiCalled: true,
      originalOrchestration: 'workflow' as const,
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
    serviceMocks.mockService.onFileStart.mockReturnValue({ dispose: () => {} });
    serviceMocks.mockService.onFileComplete.mockReturnValue({ dispose: () => {} });
    serviceMocks.mockService.onFileError.mockReturnValue({ dispose: () => {} });

    // Updated to new GenerationResult interface
    serviceMocks.mockService.generateSteeringFiles.mockResolvedValue({
      success: true,
      files: [
        '/test/workspace/.kiro/steering/product.md',
        '/test/workspace/.kiro/steering/tech.md',
        '/test/workspace/.kiro/steering/structure.md',
        '/test/workspace/.kiro/steering/customer-context.md',
        '/test/workspace/.kiro/steering/integration-landscape.md',
        '/test/workspace/.kiro/steering/security-policies.md',
        '/test/workspace/.kiro/steering/demo-strategy.md',
        '/test/workspace/.kiro/steering/agentify-integration.md',
      ],
    });

    serviceMocks.mockService.retryFailedFiles.mockResolvedValue({
      success: true,
      files: ['/test/workspace/.kiro/steering/structure.md'],
    });

    // Reset window mocks after clearAllMocks
    vscodeMocks.showWarningMessage.mockResolvedValue('Start Over');
    vscodeMocks.showErrorMessage.mockResolvedValue(undefined);
    vscodeMocks.showInformationMessage.mockResolvedValue(undefined);

    mockState = createDefaultGenerationState();
    mockWizardState = createDefaultWizardState();

    // Task 4.2: Updated callbacks to include getWizardState
    mockCallbacks = {
      updateWebviewContent: vi.fn(),
      syncStateToWebview: vi.fn(),
      showConfirmDialog: vi.fn().mockResolvedValue('Start Over'),
      openFile: vi.fn().mockResolvedValue(undefined),
      onStartOver: vi.fn(),
      getWizardState: vi.fn().mockReturnValue(mockWizardState),
      getContext: vi.fn().mockReturnValue(undefined),
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
      // Create an invalid state that will fail validation
      mockIdeationState.businessObjective = '';
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleGenerate(mockIdeationState);

      // Handler should not have started generation due to validation failure
      expect(serviceMocks.mockService.generateSteeringFiles).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3: handleRetry() resumes from failed file
  // ---------------------------------------------------------------------------
  describe('Test 3: handleRetry() resumes from failed file', () => {
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

    it('should call retryFailedFiles with correct files', async () => {
      mockState.failedFile = { name: 'structure.md', error: 'Test error' };
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleRetry(mockIdeationState);

      expect(serviceMocks.mockService.retryFailedFiles).toHaveBeenCalled();
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
  // Task 4.4: canProceedWithGeneration() validation enforcement
  // ---------------------------------------------------------------------------
  describe('Task 4.4: canProceedWithGeneration() validation enforcement', () => {
    it('should return true when all steps pass validation', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      const canProceed = handler.canProceedWithGeneration(mockIdeationState);

      expect(canProceed).toBe(true);
    });

    it('should return false when any step has error status', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);
      mockIdeationState.businessObjective = ''; // This will cause error

      const canProceed = handler.canProceedWithGeneration(mockIdeationState);

      expect(canProceed).toBe(false);
    });

    it('should return true even with warning statuses', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);
      mockIdeationState.security.skipped = true; // This causes warning, not error

      const canProceed = handler.canProceedWithGeneration(mockIdeationState);

      expect(canProceed).toBe(true);
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

  // ---------------------------------------------------------------------------
  // Task 4.5: Success handling integration
  // ---------------------------------------------------------------------------
  describe('Task 4.5: Success handling with toast', () => {
    it('should store generated file paths on success', async () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleGenerate(mockIdeationState);

      expect(handler.getState().generatedFilePaths.length).toBe(8);
    });

    it('should auto-collapse accordion on success', async () => {
      mockState.accordionExpanded = true;
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleGenerate(mockIdeationState);

      expect(handler.getState().accordionExpanded).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Task 4.2: WizardState passing
  // ---------------------------------------------------------------------------
  describe('Task 4.2: WizardState passing to service', () => {
    it('should call getWizardState callback when generating', async () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleGenerate(mockIdeationState);

      expect(mockCallbacks.getWizardState).toHaveBeenCalled();
    });

    it('should pass wizard state to generateSteeringFiles', async () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleGenerate(mockIdeationState);

      expect(serviceMocks.mockService.generateSteeringFiles).toHaveBeenCalledWith(mockWizardState);
    });
  });
});
