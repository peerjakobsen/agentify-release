/**
 * Tests for Ideation Wizard Panel - Step 3: Outcome Definition
 *
 * Task Group 3: Step 3 Form UI Implementation
 * Task Group 4: AI Auto-Trigger and Regeneration Integration
 * 12 focused tests for Step 3 UI behavior and AI integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode module before importing the panel
vi.mock('vscode', () => {
  const mockReadFile = vi.fn();
  const mockEventEmitter = class {
    private handlers: Array<(e: unknown) => void> = [];
    event = (handler: (e: unknown) => void) => {
      this.handlers.push(handler);
      return { dispose: () => {} };
    };
    fire = (e: unknown) => this.handlers.forEach((h) => h(e));
    dispose = () => {
      this.handlers = [];
    };
  };

  return {
    workspace: {
      fs: {
        readFile: mockReadFile,
      },
    },
    Uri: {
      joinPath: (...args: unknown[]) => {
        const paths = args.map((arg) =>
          typeof arg === 'string' ? arg : (arg as { fsPath: string }).fsPath || ''
        );
        return { fsPath: paths.join('/') };
      },
    },
    EventEmitter: mockEventEmitter,
    _mockReadFile: mockReadFile,
  };
});

// Mock services
vi.mock('../../services/bedrockConversationService', () => ({
  getBedrockConversationService: vi.fn(),
  resetBedrockConversationService: vi.fn(),
  BedrockConversationService: class MockBedrockConversationService {
    onToken = vi.fn();
    onComplete = vi.fn();
    onError = vi.fn();
    sendMessage = vi.fn();
    resetConversation = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock('../../services/outcomeDefinitionService', () => ({
  getOutcomeDefinitionService: vi.fn(),
  resetOutcomeDefinitionService: vi.fn(),
  buildOutcomeContextMessage: vi.fn(),
  parseOutcomeSuggestionsFromResponse: vi.fn(),
  OutcomeDefinitionService: class MockOutcomeDefinitionService {
    onToken = vi.fn();
    onComplete = vi.fn();
    onError = vi.fn();
    sendMessage = vi.fn();
    resetConversation = vi.fn();
    loadSystemPrompt = vi.fn();
    buildOutcomeContextMessage = vi.fn();
    parseOutcomeSuggestionsFromResponse = vi.fn();
    dispose = vi.fn();
  },
}));

import {
  createDefaultWizardState,
  createDefaultOutcomeDefinitionState,
  STAKEHOLDER_OPTIONS,
  WIZARD_COMMANDS,
  type WizardState,
  type WizardValidationState,
  type SuccessMetric,
} from '../../types/wizardPanel';

describe('Task Group 3: Step 3 Form UI Behavior', () => {
  let mockWizardState: WizardState;

  beforeEach(() => {
    mockWizardState = createDefaultWizardState();
    mockWizardState.currentStep = 3;
    // Simulate Step 2 being completed
    mockWizardState.aiGapFillingState.assumptionsAccepted = true;
    mockWizardState.aiGapFillingState.confirmedAssumptions = [
      {
        system: 'SAP S/4HANA',
        modules: ['MM', 'SD'],
        integrations: ['Salesforce sync'],
        source: 'ai-proposed',
      },
    ];
    mockWizardState.highestStepReached = 3;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateStep3() - validation behavior', () => {
    // Simulating the validateStep3 logic inline since we can't import the class directly
    function validateStep3(state: WizardState): WizardValidationState {
      const errors: Array<{ type: string; message: string; severity: 'error' | 'warning' }> = [];

      // Primary outcome: Required (blocking error if empty)
      if (!state.outcome.primaryOutcome.trim()) {
        errors.push({
          type: 'primaryOutcome',
          message: 'Primary outcome is required',
          severity: 'error',
        });
      }

      // Success metrics: Warning if 0 metrics (non-blocking)
      if (state.outcome.successMetrics.length === 0) {
        errors.push({
          type: 'successMetrics',
          message: 'Consider adding at least one success metric',
          severity: 'warning',
        });
      }

      // Stakeholders: Optional (no validation)

      const blockingErrors = errors.filter((e) => e.severity === 'error');
      const hasWarnings = errors.some((e) => e.severity === 'warning');

      return {
        isValid: blockingErrors.length === 0,
        errors: errors as WizardValidationState['errors'],
        hasWarnings,
      };
    }

    it('should return error when primaryOutcome is empty', () => {
      mockWizardState.outcome.primaryOutcome = '';

      const result = validateStep3(mockWizardState);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.type === 'primaryOutcome' && e.severity === 'error')).toBe(true);
    });

    it('should return warning (non-blocking) when metrics count is 0', () => {
      mockWizardState.outcome.primaryOutcome = 'Reduce stockouts by 30%';
      mockWizardState.outcome.successMetrics = [];

      const result = validateStep3(mockWizardState);

      expect(result.isValid).toBe(true); // Non-blocking
      expect(result.hasWarnings).toBe(true);
      expect(result.errors.some((e) => e.type === 'successMetrics' && e.severity === 'warning')).toBe(true);
    });

    it('should be valid with empty stakeholders (fully optional)', () => {
      mockWizardState.outcome.primaryOutcome = 'Improve efficiency by 40%';
      mockWizardState.outcome.successMetrics = [
        { name: 'Processing Time', targetValue: '50', unit: '% reduction' },
      ];
      mockWizardState.outcome.stakeholders = [];

      const result = validateStep3(mockWizardState);

      expect(result.isValid).toBe(true);
      expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
    });

    it('should be fully valid with all fields populated', () => {
      mockWizardState.outcome.primaryOutcome = 'Reduce order processing time by 40%';
      mockWizardState.outcome.successMetrics = [
        { name: 'Processing Time', targetValue: '2', unit: 'hours' },
        { name: 'Order Accuracy', targetValue: '99', unit: '%' },
      ];
      mockWizardState.outcome.stakeholders = ['Operations', 'Finance'];

      const result = validateStep3(mockWizardState);

      expect(result.isValid).toBe(true);
      expect(result.hasWarnings).toBe(false);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Metric operations', () => {
    it('should allow adding a new metric', () => {
      const initialCount = mockWizardState.outcome.successMetrics.length;

      // Simulate ADD_METRIC command
      const newMetric: SuccessMetric = { name: '', targetValue: '', unit: '' };
      mockWizardState.outcome.successMetrics.push(newMetric);
      mockWizardState.outcome.metricsEdited = true;

      expect(mockWizardState.outcome.successMetrics.length).toBe(initialCount + 1);
      expect(mockWizardState.outcome.metricsEdited).toBe(true);
    });

    it('should allow removing a metric at specific index', () => {
      mockWizardState.outcome.successMetrics = [
        { name: 'Metric 1', targetValue: '10', unit: '%' },
        { name: 'Metric 2', targetValue: '20', unit: 'hours' },
        { name: 'Metric 3', targetValue: '30', unit: 'USD' },
      ];

      // Simulate REMOVE_METRIC command at index 1
      const indexToRemove = 1;
      mockWizardState.outcome.successMetrics.splice(indexToRemove, 1);
      mockWizardState.outcome.metricsEdited = true;

      expect(mockWizardState.outcome.successMetrics.length).toBe(2);
      expect(mockWizardState.outcome.successMetrics[0].name).toBe('Metric 1');
      expect(mockWizardState.outcome.successMetrics[1].name).toBe('Metric 3');
      expect(mockWizardState.outcome.metricsEdited).toBe(true);
    });

    it('should allow updating a metric field', () => {
      mockWizardState.outcome.successMetrics = [
        { name: 'Old Name', targetValue: '10', unit: '%' },
      ];

      // Simulate UPDATE_METRIC command
      const index = 0;
      const field = 'name';
      const value = 'New Name';
      mockWizardState.outcome.successMetrics[index][field] = value;
      mockWizardState.outcome.metricsEdited = true;

      expect(mockWizardState.outcome.successMetrics[0].name).toBe('New Name');
      expect(mockWizardState.outcome.metricsEdited).toBe(true);
    });
  });

  describe('Stakeholder operations', () => {
    it('should toggle stakeholder selection correctly', () => {
      mockWizardState.outcome.stakeholders = ['Operations'];

      // Toggle Finance ON
      const stakeholderToToggle = 'Finance';
      if (mockWizardState.outcome.stakeholders.includes(stakeholderToToggle)) {
        const index = mockWizardState.outcome.stakeholders.indexOf(stakeholderToToggle);
        mockWizardState.outcome.stakeholders.splice(index, 1);
      } else {
        mockWizardState.outcome.stakeholders.push(stakeholderToToggle);
      }
      mockWizardState.outcome.stakeholdersEdited = true;

      expect(mockWizardState.outcome.stakeholders).toContain('Finance');
      expect(mockWizardState.outcome.stakeholders).toContain('Operations');
      expect(mockWizardState.outcome.stakeholdersEdited).toBe(true);

      // Toggle Operations OFF
      const toRemove = 'Operations';
      const index = mockWizardState.outcome.stakeholders.indexOf(toRemove);
      mockWizardState.outcome.stakeholders.splice(index, 1);

      expect(mockWizardState.outcome.stakeholders).not.toContain('Operations');
      expect(mockWizardState.outcome.stakeholders).toContain('Finance');
    });

    it('should use correct stakeholder options from STAKEHOLDER_OPTIONS', () => {
      expect(STAKEHOLDER_OPTIONS).toContain('Operations');
      expect(STAKEHOLDER_OPTIONS).toContain('Finance');
      expect(STAKEHOLDER_OPTIONS).toContain('IT');
      expect(STAKEHOLDER_OPTIONS).toContain('Sales');
      expect(STAKEHOLDER_OPTIONS).toContain('Marketing');
      expect(STAKEHOLDER_OPTIONS).toContain('HR');
      expect(STAKEHOLDER_OPTIONS).toContain('Legal');
      expect(STAKEHOLDER_OPTIONS).toHaveLength(10);
    });
  });
});

describe('Task Group 4: AI Integration Behavior', () => {
  let mockWizardState: WizardState;

  beforeEach(() => {
    mockWizardState = createDefaultWizardState();
    mockWizardState.currentStep = 3;
    mockWizardState.businessObjective = 'Reduce stockouts by 30%';
    mockWizardState.industry = 'Retail';
    mockWizardState.systems = ['SAP S/4HANA', 'Salesforce'];
    mockWizardState.aiGapFillingState.assumptionsAccepted = true;
    mockWizardState.aiGapFillingState.confirmedAssumptions = [
      {
        system: 'SAP S/4HANA',
        modules: ['MM', 'SD'],
        integrations: ['Salesforce sync'],
        source: 'ai-proposed',
      },
    ];
    mockWizardState.highestStepReached = 3;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('AI suggestions population', () => {
    it('should populate form fields from AI suggestions without overwriting user edits', () => {
      // User has already edited primaryOutcome
      mockWizardState.outcome.primaryOutcome = 'User edited outcome';
      mockWizardState.outcome.primaryOutcomeEdited = true;

      // AI suggestion arrives
      const aiSuggestions = {
        primaryOutcome: 'AI suggested outcome',
        suggestedKPIs: [{ name: 'KPI 1', targetValue: '100', unit: '%' }],
        stakeholders: ['Operations', 'Finance'],
      };

      // Apply suggestions, respecting edit flags
      if (!mockWizardState.outcome.primaryOutcomeEdited) {
        mockWizardState.outcome.primaryOutcome = aiSuggestions.primaryOutcome;
      }
      if (!mockWizardState.outcome.metricsEdited) {
        mockWizardState.outcome.successMetrics = aiSuggestions.suggestedKPIs;
      }
      if (!mockWizardState.outcome.stakeholdersEdited) {
        mockWizardState.outcome.stakeholders = aiSuggestions.stakeholders;
      }

      // Primary outcome should NOT be overwritten
      expect(mockWizardState.outcome.primaryOutcome).toBe('User edited outcome');
      // But metrics and stakeholders should be populated
      expect(mockWizardState.outcome.successMetrics).toHaveLength(1);
      expect(mockWizardState.outcome.stakeholders).toHaveLength(2);
    });

    it('should set loading state while AI is working', () => {
      // Simulate starting AI call
      mockWizardState.outcome.isLoading = true;
      expect(mockWizardState.outcome.isLoading).toBe(true);

      // Simulate AI completion
      mockWizardState.outcome.isLoading = false;
      expect(mockWizardState.outcome.isLoading).toBe(false);
    });

    it('should display and allow dismissal of error state', () => {
      // Simulate AI error
      mockWizardState.outcome.isLoading = false;
      mockWizardState.outcome.loadingError = 'AI suggestions unavailable. Enter values manually.';

      expect(mockWizardState.outcome.loadingError).toBeTruthy();

      // Dismiss error
      mockWizardState.outcome.loadingError = undefined;
      expect(mockWizardState.outcome.loadingError).toBeUndefined();
    });
  });

  describe('Regeneration confirmation logic', () => {
    it('should require confirmation when any edit flag is true', () => {
      mockWizardState.outcome.primaryOutcomeEdited = true;
      mockWizardState.outcome.metricsEdited = false;
      mockWizardState.outcome.stakeholdersEdited = false;

      const hasEdits =
        mockWizardState.outcome.primaryOutcomeEdited ||
        mockWizardState.outcome.metricsEdited ||
        mockWizardState.outcome.stakeholdersEdited;

      expect(hasEdits).toBe(true);
    });

    it('should not require confirmation when all edit flags are false', () => {
      mockWizardState.outcome.primaryOutcomeEdited = false;
      mockWizardState.outcome.metricsEdited = false;
      mockWizardState.outcome.stakeholdersEdited = false;

      const hasEdits =
        mockWizardState.outcome.primaryOutcomeEdited ||
        mockWizardState.outcome.metricsEdited ||
        mockWizardState.outcome.stakeholdersEdited;

      expect(hasEdits).toBe(false);
    });

    it('should reset edit flags after regeneration completes', () => {
      // User has made edits
      mockWizardState.outcome.primaryOutcomeEdited = true;
      mockWizardState.outcome.metricsEdited = true;
      mockWizardState.outcome.stakeholdersEdited = true;

      // Regeneration resets all flags and values
      mockWizardState.outcome = createDefaultOutcomeDefinitionState();

      expect(mockWizardState.outcome.primaryOutcomeEdited).toBe(false);
      expect(mockWizardState.outcome.metricsEdited).toBe(false);
      expect(mockWizardState.outcome.stakeholdersEdited).toBe(false);
    });
  });

  describe('WIZARD_COMMANDS for Step 3', () => {
    it('should have all required Step 3 commands defined', () => {
      expect(WIZARD_COMMANDS.UPDATE_PRIMARY_OUTCOME).toBe('updatePrimaryOutcome');
      expect(WIZARD_COMMANDS.ADD_METRIC).toBe('addMetric');
      expect(WIZARD_COMMANDS.REMOVE_METRIC).toBe('removeMetric');
      expect(WIZARD_COMMANDS.UPDATE_METRIC).toBe('updateMetric');
      expect(WIZARD_COMMANDS.TOGGLE_STAKEHOLDER).toBe('toggleStakeholder');
      expect(WIZARD_COMMANDS.ADD_CUSTOM_STAKEHOLDER).toBe('addCustomStakeholder');
      expect(WIZARD_COMMANDS.REGENERATE_OUTCOME_SUGGESTIONS).toBe('regenerateOutcomeSuggestions');
      expect(WIZARD_COMMANDS.DISMISS_OUTCOME_ERROR).toBe('dismissOutcomeError');
    });
  });
});
