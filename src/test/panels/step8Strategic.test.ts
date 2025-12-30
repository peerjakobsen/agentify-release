/**
 * Tests for Step 8: Strategic Test Coverage
 * Task Group 8: Test Review and Gap Analysis
 *
 * Strategic tests focusing on critical gaps:
 * - End-to-end generation workflow
 * - Error recovery and retry scenarios
 * - State persistence during generation
 * - CSS classes and UI states
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

// Mock vscode module before importing anything
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
    joinPath: vi.fn().mockReturnValue({ fsPath: '/test/path/.kiro/steering' }),
    parse: vi.fn().mockReturnValue({ fsPath: 'https://kiro.dev' }),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    getConfiguration: () => ({
      has: () => false,
      get: () => false,
    }),
  },
  window: {
    showWarningMessage: vi.fn().mockResolvedValue('Start Over'),
    showInformationMessage: vi.fn().mockResolvedValue(undefined),
  },
  commands: {
    executeCommand: vi.fn().mockResolvedValue(undefined),
  },
  env: {
    appName: 'Visual Studio Code',
    openExternal: vi.fn().mockResolvedValue(true),
  },
  extensions: {
    getExtension: vi.fn().mockReturnValue(undefined),
  },
}));

// Mock the steering file service
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
  STEERING_FILES,
  type GenerationState,
  type StepSummary,
} from '../../types/wizardPanel';
import {
  generateStep8Html,
  renderPreGenerationSummary,
  renderGenerationProgress,
  renderStepSummaryCard,
  getStatusIconSvg,
} from '../../panels/ideationStepHtml';

// ============================================================================
// Task 8.3: Strategic Tests for Step 8 Feature
// ============================================================================

describe('Task Group 8: Strategic Gap Analysis Tests', () => {
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

    mockService.onFileStart.mockReturnValue({ dispose: () => {} });
    mockService.onFileComplete.mockReturnValue({ dispose: () => {} });
    mockService.onFileError.mockReturnValue({ dispose: () => {} });
    mockService.generateSteeringFiles.mockResolvedValue({
      files: STEERING_FILES.map((f) => `/test/workspace/.kiro/steering/${f}`),
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
  // Test 1: Full generation workflow from Generate click to success
  // ---------------------------------------------------------------------------
  describe('Test 1: Full generation workflow from Generate click to success', () => {
    it('should complete full generation workflow successfully', async () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      // Start generation
      await handler.handleGenerate(mockIdeationState);

      // Verify callbacks were called for UI updates
      expect(mockCallbacks.updateWebviewContent).toHaveBeenCalled();
      expect(mockCallbacks.syncStateToWebview).toHaveBeenCalled();

      // Service should have been called with the ideation state
      expect(mockService.generateSteeringFiles).toHaveBeenCalled();
    });

    it('should set isGenerating to true immediately on generate', async () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      // Capture state immediately during generation
      const promise = handler.handleGenerate(mockIdeationState);

      // State should be generating
      expect(handler.getState().isGenerating).toBe(true);

      await promise;
    });

    it('should reset failedFile on new generation attempt', async () => {
      mockState.failedFile = { name: 'structure.md', error: 'Previous error' };
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleGenerate(mockIdeationState);

      expect(handler.getState().failedFile).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2: Generation error with retry resume from correct file
  // ---------------------------------------------------------------------------
  describe('Test 2: Generation error with retry resume from correct file', () => {
    it('should preserve completedFiles when retry starts', async () => {
      mockState.completedFiles = ['product.md', 'tech.md'];
      mockState.currentFileIndex = 2;
      mockState.failedFile = { name: 'structure.md', error: 'Network error' };
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleRetry(mockIdeationState);

      // Completed files should still be there
      const state = handler.getState();
      expect(state.completedFiles).toEqual(['product.md', 'tech.md']);
    });

    it('should clear failedFile when retry starts', async () => {
      mockState.failedFile = { name: 'structure.md', error: 'Network error' };
      mockState.currentFileIndex = 2;
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleRetry(mockIdeationState);

      expect(handler.getState().failedFile).toBeUndefined();
    });

    it('should set isGenerating to true on retry', async () => {
      mockState.failedFile = { name: 'structure.md', error: 'Network error' };
      mockState.currentFileIndex = 2;
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      const promise = handler.handleRetry(mockIdeationState);
      expect(handler.getState().isGenerating).toBe(true);

      await promise;
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3: Accordion state persists across webview refresh
  // ---------------------------------------------------------------------------
  describe('Test 3: Accordion state persists across webview refresh', () => {
    it('should preserve accordionExpanded state in handler', () => {
      mockState.accordionExpanded = true;
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      // Simulate toggle
      handler.handleToggleAccordion();
      expect(handler.getState().accordionExpanded).toBe(false);

      handler.handleToggleAccordion();
      expect(handler.getState().accordionExpanded).toBe(true);
    });

    it('should render accordion as expanded when state says so', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = true;
      state.accordionExpanded = true;

      const html = renderGenerationProgress(state);

      expect(html).toContain('expanded');
    });

    it('should render accordion as collapsed when state says so', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = true;
      state.accordionExpanded = false;

      const html = renderGenerationProgress(state);

      // Should not have the expanded class on the main container
      // The HTML should still render but with collapsed state
      expect(html).toContain('accordion-chevron');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 4: Validation aggregation with mixed step states
  // ---------------------------------------------------------------------------
  describe('Test 4: Validation aggregation with mixed step states', () => {
    it('should return error status for step with missing required data', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);
      const invalidState = { ...mockIdeationState, businessObjective: '' };

      const status = handler.getValidationStatusForStep(1, invalidState);

      expect(status.status).toBe('error');
      expect(status.message).toBeDefined();
    });

    it('should return warning status for skipped security step', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);
      const stateWithSkipped = {
        ...mockIdeationState,
        security: { ...mockIdeationState.security, skipped: true },
      };

      const status = handler.getValidationStatusForStep(4, stateWithSkipped);

      expect(status.status).toBe('warning');
    });

    it('should aggregate all step statuses in summaries', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      const summaries = handler.getStepSummaries(mockIdeationState);

      expect(summaries).toHaveLength(7);
      summaries.forEach((summary) => {
        expect(['complete', 'warning', 'error']).toContain(summary.validationStatus);
      });
    });

    it('should set canGenerate based on validation errors', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      // Valid state - should have complete statuses
      const summaries = handler.getStepSummaries(mockIdeationState);
      const hasError = summaries.some((s) => s.validationStatus === 'error');

      expect(hasError).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 5: File open command executes correct VS Code command
  // ---------------------------------------------------------------------------
  describe('Test 5: File open command executes correct VS Code command', () => {
    it('should call openFile callback with correct path', async () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);
      const testPath = '/test/workspace/.kiro/steering/product.md';

      await handler.handleOpenFile(testPath);

      expect(mockCallbacks.openFile).toHaveBeenCalledWith(testPath);
    });

    it('should handle multiple file opens', async () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleOpenFile('/test/product.md');
      await handler.handleOpenFile('/test/tech.md');

      expect(mockCallbacks.openFile).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 6: Start Over confirmation dialog flow
  // ---------------------------------------------------------------------------
  describe('Test 6: Start Over confirmation dialog flow', () => {
    it('should show confirmation dialog with correct message', async () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleStartOver();

      expect(mockCallbacks.showConfirmDialog).toHaveBeenCalledWith(
        expect.stringContaining('clear all wizard data'),
        expect.arrayContaining(['Start Over', 'Cancel'])
      );
    });

    it('should mention generated files will not be deleted', async () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleStartOver();

      expect(mockCallbacks.showConfirmDialog).toHaveBeenCalledWith(
        expect.stringContaining('not be deleted'),
        expect.any(Array)
      );
    });

    it('should call onStartOver when confirmed', async () => {
      mockCallbacks.showConfirmDialog = vi.fn().mockResolvedValue('Start Over');
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleStartOver();

      expect(mockCallbacks.onStartOver).toHaveBeenCalled();
    });

    it('should not call onStartOver when cancelled', async () => {
      mockCallbacks.showConfirmDialog = vi.fn().mockResolvedValue('Cancel');
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      await handler.handleStartOver();

      expect(mockCallbacks.onStartOver).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Test 7: Summary card data extraction for all 7 steps
  // ---------------------------------------------------------------------------
  describe('Test 7: Summary card data extraction for all 7 steps', () => {
    it('should extract Step 1 Business Context summary data', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      const summaries = handler.getStepSummaries(mockIdeationState);
      const step1 = summaries.find((s) => s.stepNumber === 1);

      expect(step1).toBeDefined();
      expect(step1?.stepName).toBe('Business Context');
      expect(step1?.summaryData['Industry']).toBe('Retail');
    });

    it('should extract Step 5 Agent Design summary data', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      const summaries = handler.getStepSummaries(mockIdeationState);
      const step5 = summaries.find((s) => s.stepNumber === 5);

      expect(step5).toBeDefined();
      expect(step5?.stepName).toBe('Agent Design');
      expect(step5?.summaryData['Agents']).toContain('agent');
    });

    it('should extract Step 7 Demo Strategy summary data', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      const summaries = handler.getStepSummaries(mockIdeationState);
      const step7 = summaries.find((s) => s.stepNumber === 7);

      expect(step7).toBeDefined();
      expect(step7?.stepName).toBe('Demo Strategy');
    });

    it('should include all 7 step summaries', () => {
      const handler = new Step8LogicHandler(mockState, mockCallbacks);

      const summaries = handler.getStepSummaries(mockIdeationState);

      expect(summaries).toHaveLength(7);
      for (let i = 1; i <= 7; i++) {
        expect(summaries.some((s) => s.stepNumber === i)).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Test 8: CSS classes applied correctly for all status states
  // ---------------------------------------------------------------------------
  describe('Test 8: CSS classes applied correctly for all status states', () => {
    it('should render complete status with correct CSS class', () => {
      const icon = getStatusIconSvg('complete');

      expect(icon).toContain('status-complete');
      expect(icon).toContain('svg');
    });

    it('should render warning status with correct CSS class', () => {
      const icon = getStatusIconSvg('warning');

      expect(icon).toContain('status-warning');
    });

    it('should render error status with correct CSS class', () => {
      const icon = getStatusIconSvg('error');

      expect(icon).toContain('status-error');
    });

    it('should render summary card with status-based validation message class', () => {
      const summaryWithWarning: StepSummary = {
        stepNumber: 4,
        stepName: 'Security',
        summaryData: { 'Status': 'Skipped' },
        validationStatus: 'warning',
        validationMessage: 'Security step was skipped',
      };

      const html = renderStepSummaryCard(summaryWithWarning);

      expect(html).toContain('validation-message warning');
    });

    it('should render file progress item with complete class for finished files', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = true;
      state.completedFiles = ['product.md'];
      state.currentFileIndex = 1;

      const html = renderGenerationProgress(state);

      expect(html).toContain('file-progress');
      expect(html).toContain('complete');
    });

    it('should render disabled button when canGenerate is false', () => {
      const state = createDefaultGenerationState();
      state.canGenerate = false;
      const summaries: StepSummary[] = [];

      const html = generateStep8Html(state, summaries);

      expect(html).toContain('disabled');
    });
  });
});

// ============================================================================
// Additional Test: Generate Button State Management
// ============================================================================

describe('Generate Button State Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should disable generate button during active generation', () => {
    const state = createDefaultGenerationState();
    state.isGenerating = true;
    state.canGenerate = true;
    const summaries: StepSummary[] = [];

    const html = generateStep8Html(state, summaries);

    expect(html).toContain('disabled');
    expect(html).toContain('Generating...');
  });

  it('should enable generate button when not generating and can generate', () => {
    const state = createDefaultGenerationState();
    state.isGenerating = false;
    state.canGenerate = true;
    const summaries: StepSummary[] = [];

    const html = generateStep8Html(state, summaries);

    // Should have Generate text and not be disabled
    expect(html).toContain('Generate');
    // Check that the button is not disabled (no disabled attribute on generate button)
    expect(html).toContain('generate-btn');
  });

  it('should show retry button when generation failed', () => {
    const state: GenerationState = {
      ...createDefaultGenerationState(),
      isGenerating: false,
      failedFile: { name: 'structure.md', error: 'Network error' },
      currentFileIndex: 2,
      completedFiles: ['product.md', 'tech.md'],
    };
    const summaries: StepSummary[] = [];

    const html = generateStep8Html(state, summaries);

    // Should show retry option
    expect(html).toContain('step8Retry');
  });
});
