/**
 * Tests for Step 8: Button Handlers
 * Task Group 6: Button Handlers and Post-Generation UI
 *
 * Tests the button handlers for Step 8 including Generate, Generate & Open in Kiro,
 * Start Over, and related UI interactions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the steering file service FIRST (before other mocks)
vi.mock('../../services/steeringFileService', () => {
  const mockService = {
    onFileStart: vi.fn().mockReturnValue({ dispose: () => {} }),
    onFileComplete: vi.fn().mockReturnValue({ dispose: () => {} }),
    onFileError: vi.fn().mockReturnValue({ dispose: () => {} }),
    generateSteeringFiles: vi.fn().mockResolvedValue({
      success: true,
      files: ['/test/workspace/.kiro/steering/product.md'],
    }),
    retryFailedFiles: vi.fn().mockResolvedValue({
      success: true,
      files: ['/test/workspace/.kiro/steering/structure.md'],
    }),
    dispose: vi.fn(),
  };

  return {
    getSteeringFileService: () => mockService,
    resetSteeringFileService: vi.fn(),
    SteeringFileService: vi.fn(),
    __test__: { mockService },
  };
});

// Create mock config object
const mockConfigObject = {
  has: () => false,
  get: () => false,
};

// Mock vscode module
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
    getConfiguration: () => mockConfigObject,
  },
  window: {
    showInformationMessage: vi.fn().mockResolvedValue(undefined),
    showWarningMessage: vi.fn().mockResolvedValue(undefined),
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

// Import after mocks
import { Step8LogicHandler, Step8ContextInputs, Step8Callbacks } from '../../panels/ideationStep8Logic';
import { createDefaultGenerationState } from '../../types/wizardPanel';
import {
  renderStep8ActionButtons,
} from '../../panels/ideationStepHtml';

// ============================================================================
// Task 6.1: 5 Focused Tests for Button Handlers
// ============================================================================

describe('Task Group 6: Button Handlers', () => {
  let mockCallbacks: Step8Callbacks;
  let mockInputs: Step8ContextInputs;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCallbacks = {
      updateWebviewContent: vi.fn(),
      syncStateToWebview: vi.fn(),
      showConfirmDialog: vi.fn().mockResolvedValue('Cancel'),
      openFile: vi.fn().mockResolvedValue(undefined),
      onStartOver: vi.fn(),
      getWizardState: vi.fn().mockReturnValue({}),
      getContext: vi.fn().mockReturnValue(undefined),
    };

    mockInputs = {
      businessObjective: 'Reduce manual effort by 50%',
      industry: 'Retail',
      systems: ['Salesforce', 'SAP'],
      aiGapFillingState: {
        isLoading: false,
        isStreaming: false,
        conversationHistory: [],
        confirmedAssumptions: [{ id: '1', category: 'test', content: 'test' }],
        assumptionsAccepted: true,
        refinedSections: {},
        hasError: false,
        errorRetryable: false,
      },
      outcome: {
        primaryOutcome: 'Automate order processing',
        successMetrics: [{ name: 'Efficiency', targetValue: '50', unit: '%' }],
        stakeholders: ['Operations', 'IT'],
        customStakeholders: [],
        isLoading: false,
        suggestionsAccepted: true,
        primaryOutcomeEdited: false,
        metricsEdited: false,
        stakeholdersEdited: false,
      },
      security: {
        dataSensitivity: 'internal',
        complianceFrameworks: ['SOC2'],
        approvalGates: ['Manager'],
        guardrailNotes: '',
        skipped: false,
      },
      agentDesign: {
        isLoading: false,
        proposedAgents: [],
        proposedOrchestration: 'sequential',
        orchestrationReasoning: '',
        proposedEdges: [],
        confirmedAgents: [{ id: '1', name: 'Agent 1', role: 'Role', tools: [] }],
        confirmedOrchestration: 'sequential',
        confirmedEdges: [],
        phase: 'confirmed',
        lastInputHash: '',
        phase2Enabled: false,
        edgeSuggestion: undefined,
      },
      mockData: {
        isLoading: false,
        mockDefinitions: [],
        useCustomerTerminology: false,
        expandedAccordions: [],
        lastInputHash: '',
      },
      demoStrategy: {
        isLoading: false,
        loadingSection: undefined,
        ahaMoments: [{ title: 'Test', triggerType: 'agent', triggerName: 'Agent 1', talkingPoint: 'Demo' }],
        persona: { name: 'Test User', role: 'Manager', painPoint: 'Manual work' },
        narrativeScenes: [{ title: 'Scene 1', description: 'Description', highlightedAgents: [] }],
        lastInputHash: '',
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Test 1: "Generate" button triggers handleGenerate()
  // ---------------------------------------------------------------------------
  describe('Test 1: Generate button triggers handleGenerate()', () => {
    it('should call handleGenerate when Generate button is clicked', async () => {
      const state = createDefaultGenerationState();
      state.canGenerate = true;

      const handler = new Step8LogicHandler(state, mockCallbacks);

      // Simulate clicking Generate button
      await handler.handleGenerate(mockInputs);

      // Verify state was updated
      expect(mockCallbacks.updateWebviewContent).toHaveBeenCalled();
      expect(mockCallbacks.syncStateToWebview).toHaveBeenCalled();
    });

    it('should set isGenerating to true when Generate is triggered', async () => {
      const state = createDefaultGenerationState();
      state.canGenerate = true;

      const handler = new Step8LogicHandler(state, mockCallbacks);

      // Call handleGenerate
      const promise = handler.handleGenerate(mockInputs);

      // Wait a bit for the state to be set
      await new Promise((resolve) => setTimeout(resolve, 50));

      // State should be generating
      expect(handler.getState().isGenerating).toBe(true);

      // Wait for completion
      await promise;
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2: "Generate" button disabled during generation
  // ---------------------------------------------------------------------------
  describe('Test 2: Generate button disabled during generation', () => {
    it('should render Generate button as disabled when isGenerating is true', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = true;
      state.canGenerate = true;

      const html = renderStep8ActionButtons(state);

      expect(html).toContain('disabled');
      expect(html).toContain('Generating...');
    });

    it('should render Generate button with tooltip when disabled during generation', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = true;
      state.canGenerate = true;

      const html = renderStep8ActionButtons(state);

      expect(html).toContain('Generation in progress');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3: "Generate & Open in Kiro" button calls handleGenerateAndOpenKiro()
  // ---------------------------------------------------------------------------
  describe('Test 3: Generate & Open in Kiro button calls handleGenerateAndOpenKiro()', () => {
    it('should call handleGenerateAndOpenKiro when button is clicked', async () => {
      const state = createDefaultGenerationState();
      state.canGenerate = true;

      const handler = new Step8LogicHandler(state, mockCallbacks);

      // Simulate clicking Generate & Open in Kiro button
      await handler.handleGenerateAndOpenKiro(mockInputs);

      // Verify callbacks were called
      expect(mockCallbacks.updateWebviewContent).toHaveBeenCalled();
      expect(mockCallbacks.syncStateToWebview).toHaveBeenCalled();
    });

    it('should render Generate & Open in Kiro button', () => {
      const state = createDefaultGenerationState();
      state.canGenerate = true;

      const html = renderStep8ActionButtons(state);

      expect(html).toContain('Generate & Open in Kiro');
      expect(html).toContain('step8GenerateAndOpenKiro');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 4: "Start Over" button triggers confirmation dialog
  // ---------------------------------------------------------------------------
  describe('Test 4: Start Over button triggers confirmation dialog', () => {
    it('should call showConfirmDialog when Start Over is clicked', async () => {
      const state = createDefaultGenerationState();

      const handler = new Step8LogicHandler(state, mockCallbacks);

      // Simulate clicking Start Over button
      await handler.handleStartOver();

      // Verify confirmation dialog was shown
      expect(mockCallbacks.showConfirmDialog).toHaveBeenCalledWith(
        expect.stringContaining('clear all wizard data'),
        ['Start Over', 'Cancel']
      );
    });

    it('should call onStartOver callback when user confirms', async () => {
      mockCallbacks.showConfirmDialog = vi.fn().mockResolvedValue('Start Over');
      const state = createDefaultGenerationState();

      const handler = new Step8LogicHandler(state, mockCallbacks);

      // Simulate clicking Start Over and confirming
      await handler.handleStartOver();

      // Verify onStartOver was called
      expect(mockCallbacks.onStartOver).toHaveBeenCalled();
    });

    it('should not call onStartOver callback when user cancels', async () => {
      mockCallbacks.showConfirmDialog = vi.fn().mockResolvedValue('Cancel');
      const state = createDefaultGenerationState();

      const handler = new Step8LogicHandler(state, mockCallbacks);

      // Simulate clicking Start Over and canceling
      await handler.handleStartOver();

      // Verify onStartOver was NOT called
      expect(mockCallbacks.onStartOver).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Test 5: "Generate" button disabled when canGenerate is false
  // ---------------------------------------------------------------------------
  describe('Test 5: Generate button disabled when canGenerate is false', () => {
    it('should render Generate button as disabled when canGenerate is false', () => {
      const state = createDefaultGenerationState();
      state.canGenerate = false;
      state.isGenerating = false;

      const html = renderStep8ActionButtons(state);

      expect(html).toContain('disabled');
    });

    it('should show validation error tooltip when canGenerate is false', () => {
      const state = createDefaultGenerationState();
      state.canGenerate = false;
      state.isGenerating = false;

      const html = renderStep8ActionButtons(state);

      expect(html).toContain('Fix validation errors to generate');
    });

    it('should not start generation when canGenerate is false', async () => {
      const state = createDefaultGenerationState();
      state.canGenerate = false;

      const handler = new Step8LogicHandler(state, mockCallbacks);

      // Try to generate
      await handler.handleGenerate(mockInputs);

      // State should not have changed to generating
      expect(handler.getState().isGenerating).toBe(false);
      expect(handler.getState().completedFiles).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Additional Tests for Coverage
  // ---------------------------------------------------------------------------
  describe('Additional button handler tests', () => {
    it('should handle retry button correctly', async () => {
      const state = createDefaultGenerationState();
      state.canGenerate = true;
      state.currentFileIndex = 2;
      state.failedFile = { name: 'structure.md', error: 'Test error' };

      const handler = new Step8LogicHandler(state, mockCallbacks);

      // Call handleRetry
      await handler.handleRetry(mockInputs);

      // Verify callbacks were called
      expect(mockCallbacks.updateWebviewContent).toHaveBeenCalled();
      expect(mockCallbacks.syncStateToWebview).toHaveBeenCalled();
    });

    it('should handle toggle accordion correctly', () => {
      const state = createDefaultGenerationState();
      state.accordionExpanded = false;

      const handler = new Step8LogicHandler(state, mockCallbacks);

      // Toggle accordion
      handler.handleToggleAccordion();

      // Verify state changed
      expect(handler.getState().accordionExpanded).toBe(true);
      expect(mockCallbacks.updateWebviewContent).toHaveBeenCalled();
    });

    it('should handle open file correctly', async () => {
      const state = createDefaultGenerationState();

      const handler = new Step8LogicHandler(state, mockCallbacks);

      // Call handleOpenFile
      await handler.handleOpenFile('/test/path/product.md');

      // Verify openFile callback was called
      expect(mockCallbacks.openFile).toHaveBeenCalledWith('/test/path/product.md');
    });

    it('should render both action buttons', () => {
      const state = createDefaultGenerationState();
      state.canGenerate = true;

      const html = renderStep8ActionButtons(state);

      expect(html).toContain('generate-btn');
      expect(html).toContain('generate-kiro-btn');
      expect(html).toContain('step8Generate');
      expect(html).toContain('step8GenerateAndOpenKiro');
    });
  });
});
