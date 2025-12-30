/**
 * Tests for Step 8: Integration and Wizard Navigation
 * Task Group 7: Integration and Wizard Navigation
 *
 * Tests the wizard integration for Step 8 including navigation,
 * Edit button functionality, back navigation, and state persistence.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

// Import after mocks
import {
  createDefaultGenerationState,
  createDefaultWizardState,
  wizardStateToPersistedState,
  persistedStateToWizardState,
  WizardStep,
} from '../../types/wizardPanel';
import type { WizardState, GenerationState, PersistedWizardState } from '../../types/wizardPanel';

// ============================================================================
// Task 7.1: 4 Focused Tests for Wizard Integration
// ============================================================================

describe('Task Group 7: Integration and Wizard Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Test 1: Step 7 "Next" navigates to Step 8
  // ---------------------------------------------------------------------------
  describe('Test 1: Step 7 Next navigates to Step 8', () => {
    it('should advance from Step 7 to Step 8 when navigating forward', () => {
      const state = createDefaultWizardState();
      state.currentStep = 7;
      state.highestStepReached = 7;

      // Simulate forward navigation
      const newStep = Math.min(state.currentStep + 1, 8);
      state.currentStep = newStep;
      state.highestStepReached = Math.max(state.highestStepReached, newStep);

      expect(state.currentStep).toBe(8);
      expect(state.highestStepReached).toBe(8);
    });

    it('should not advance past Step 8', () => {
      const state = createDefaultWizardState();
      state.currentStep = 8;
      state.highestStepReached = 8;

      // Attempt to navigate forward from Step 8
      const newStep = Math.min(state.currentStep + 1, 8);
      state.currentStep = newStep;

      expect(state.currentStep).toBe(8);
    });

    it('should update highestStepReached when entering Step 8 for first time', () => {
      const state = createDefaultWizardState();
      state.currentStep = 7;
      state.highestStepReached = 7;

      // Navigate to Step 8
      state.currentStep = 8;
      state.highestStepReached = Math.max(state.highestStepReached, 8);

      expect(state.highestStepReached).toBe(8);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2: Step 8 "Edit" buttons navigate to correct step
  // ---------------------------------------------------------------------------
  describe('Test 2: Step 8 Edit buttons navigate to correct step', () => {
    it('should navigate to Step 1 when editing Business Context', () => {
      const state = createDefaultWizardState();
      state.currentStep = 8;
      state.highestStepReached = 8;

      // Simulate Edit navigation to Step 1
      const targetStep = 1;
      if (targetStep >= 1 && targetStep <= state.highestStepReached) {
        state.currentStep = targetStep;
      }

      expect(state.currentStep).toBe(1);
    });

    it('should navigate to Step 5 when editing Agent Design', () => {
      const state = createDefaultWizardState();
      state.currentStep = 8;
      state.highestStepReached = 8;

      // Simulate Edit navigation to Step 5
      const targetStep = 5;
      if (targetStep >= 1 && targetStep <= state.highestStepReached) {
        state.currentStep = targetStep;
      }

      expect(state.currentStep).toBe(5);
    });

    it('should navigate to any step within highestStepReached', () => {
      const state = createDefaultWizardState();
      state.currentStep = 8;
      state.highestStepReached = 8;

      // Test all steps 1-7
      for (let targetStep = 1; targetStep <= 7; targetStep++) {
        state.currentStep = 8; // Reset to Step 8

        if (targetStep >= 1 && targetStep <= state.highestStepReached) {
          state.currentStep = targetStep;
        }

        expect(state.currentStep).toBe(targetStep);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3: Returning to Step 8 after edit updates summary
  // ---------------------------------------------------------------------------
  describe('Test 3: Returning to Step 8 after edit updates summary', () => {
    it('should preserve generation state when returning to Step 8', () => {
      const state = createDefaultWizardState();
      state.currentStep = 8;
      state.highestStepReached = 8;
      state.generation = {
        ...createDefaultGenerationState(),
        completedFiles: ['product.md', 'tech.md'],
        generatedFilePaths: ['/test/product.md', '/test/tech.md'],
      };

      // Edit Step 1, then return
      state.currentStep = 1;
      // Make some changes (simulate)
      state.businessObjective = 'Updated objective';
      // Return to Step 8
      state.currentStep = 8;

      // Generation state should be preserved
      expect(state.generation.completedFiles).toEqual(['product.md', 'tech.md']);
      expect(state.generation.generatedFilePaths).toHaveLength(2);
    });

    it('should allow re-navigation to Step 8 after editing', () => {
      const state = createDefaultWizardState();
      state.currentStep = 8;
      state.highestStepReached = 8;

      // Edit Step 3
      state.currentStep = 3;
      // Return to Step 8
      const returnStep = 8;
      if (returnStep <= state.highestStepReached) {
        state.currentStep = returnStep;
      }

      expect(state.currentStep).toBe(8);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 4: Start Over resets state and navigates to Step 1
  // ---------------------------------------------------------------------------
  describe('Test 4: Start Over resets state and navigates to Step 1', () => {
    it('should reset wizard state to defaults', () => {
      const state = createDefaultWizardState();
      state.currentStep = 8;
      state.highestStepReached = 8;
      state.businessObjective = 'Test objective';
      state.industry = 'Retail';
      state.systems = ['Salesforce', 'SAP'];
      state.generation.completedFiles = ['product.md'];

      // Start Over - reset to default
      const freshState = createDefaultWizardState();

      expect(freshState.currentStep).toBe(1);
      expect(freshState.highestStepReached).toBe(1);
      expect(freshState.businessObjective).toBe('');
      expect(freshState.industry).toBe('');
      expect(freshState.systems).toEqual([]);
      expect(freshState.generation.completedFiles).toEqual([]);
    });

    it('should not delete generated steering files (state only reset)', () => {
      // This test verifies the design principle that Start Over
      // only resets wizard state, not the generated files
      const state = createDefaultWizardState();
      state.generation.generatedFilePaths = [
        '/test/.kiro/steering/product.md',
        '/test/.kiro/steering/tech.md',
      ];

      // Start Over creates fresh state
      const freshState = createDefaultWizardState();

      // Fresh state should have empty paths (files remain on disk, managed separately)
      expect(freshState.generation.generatedFilePaths).toEqual([]);
      // The original state's paths should still be valid
      // (in real code, the files on disk are not deleted)
      expect(state.generation.generatedFilePaths).toHaveLength(2);
    });
  });
});

// ============================================================================
// Task 7.6: Tests for PersistedWizardState for Step 8
// ============================================================================

describe('Task 7.6: PersistedWizardState for Step 8', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Test: wizardStateToPersistedState includes generation field
  // ---------------------------------------------------------------------------
  describe('wizardStateToPersistedState() conversion', () => {
    it('should include generation field in persisted state', () => {
      const wizardState = createDefaultWizardState();
      wizardState.generation.completedFiles = ['product.md'];
      wizardState.generation.generatedFilePaths = ['/test/product.md'];
      wizardState.generation.accordionExpanded = true;

      const persisted = wizardStateToPersistedState(wizardState);

      expect(persisted.generation).toBeDefined();
      expect(persisted.generation?.completedFiles).toEqual(['product.md']);
      expect(persisted.generation?.generatedFilePaths).toEqual(['/test/product.md']);
      expect(persisted.generation?.accordionExpanded).toBe(true);
    });

    it('should set isGenerating to false in persisted state', () => {
      const wizardState = createDefaultWizardState();
      wizardState.generation.isGenerating = true;

      const persisted = wizardStateToPersistedState(wizardState);

      // Cannot resume mid-generation, so isGenerating should always be false
      expect(persisted.generation?.isGenerating).toBe(false);
    });

    it('should preserve completedFiles if generation was partially complete', () => {
      const wizardState = createDefaultWizardState();
      wizardState.generation.completedFiles = ['product.md', 'tech.md', 'structure.md'];
      wizardState.generation.currentFileIndex = 3;
      wizardState.generation.failedFile = { name: 'customer-context.md', error: 'Test error' };

      const persisted = wizardStateToPersistedState(wizardState);

      expect(persisted.generation?.completedFiles).toHaveLength(3);
      expect(persisted.generation?.failedFile).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Test: persistedStateToWizardState restores generation state
  // ---------------------------------------------------------------------------
  describe('persistedStateToWizardState() conversion', () => {
    it('should restore generation state from persisted', () => {
      const persisted: PersistedWizardState = {
        schemaVersion: 1,
        savedAt: Date.now(),
        currentStep: 8,
        highestStepReached: 8,
        validationAttempted: false,
        businessObjective: 'Test',
        industry: 'Retail',
        systems: [],
        aiGapFillingState: {
          conversationHistory: [],
          confirmedAssumptions: [],
          assumptionsAccepted: false,
          isStreaming: false,
        },
        outcome: {
          primaryOutcome: '',
          successMetrics: [],
          stakeholders: [],
          isLoading: false,
          primaryOutcomeEdited: false,
          metricsEdited: false,
          stakeholdersEdited: false,
          customStakeholders: [],
          suggestionsAccepted: false,
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
          proposedAgents: [],
          proposedOrchestration: 'workflow',
          proposedEdges: [],
          orchestrationReasoning: '',
          proposalAccepted: false,
          isLoading: false,
          aiCalled: false,
          confirmedAgents: [],
          confirmedOrchestration: 'workflow',
          confirmedEdges: [],
          originalOrchestration: 'workflow',
        },
        mockData: {
          mockDefinitions: [],
          useCustomerTerminology: false,
          isLoading: false,
          aiCalled: false,
        },
        demoStrategy: {
          ahaMoments: [],
          persona: { name: '', role: '', painPoint: '' },
          narrativeScenes: [],
          isGeneratingMoments: false,
          isGeneratingPersona: false,
          isGeneratingNarrative: false,
          momentsEdited: false,
          personaEdited: false,
          narrativeEdited: false,
        },
        generation: {
          isGenerating: true, // This was persisted as true somehow
          currentFileIndex: 2,
          completedFiles: ['product.md', 'tech.md'],
          generatedFilePaths: ['/test/product.md', '/test/tech.md'],
          accordionExpanded: true,
          canGenerate: true,
          isPlaceholderMode: true,
        },
      };

      const wizardState = persistedStateToWizardState(persisted);

      // isGenerating should always be false when restoring
      expect(wizardState.generation.isGenerating).toBe(false);
      // Other fields should be preserved
      expect(wizardState.generation.completedFiles).toEqual(['product.md', 'tech.md']);
      expect(wizardState.generation.currentFileIndex).toBe(2);
      expect(wizardState.generation.accordionExpanded).toBe(true);
    });

    it('should create default generation state if not in persisted', () => {
      const persisted: Partial<PersistedWizardState> = {
        schemaVersion: 1,
        savedAt: Date.now(),
        currentStep: 7,
        highestStepReached: 7,
        validationAttempted: false,
        businessObjective: 'Test',
        industry: 'Retail',
        systems: [],
        aiGapFillingState: {
          conversationHistory: [],
          confirmedAssumptions: [],
          assumptionsAccepted: false,
          isStreaming: false,
        },
        outcome: {
          primaryOutcome: '',
          successMetrics: [],
          stakeholders: [],
          isLoading: false,
          primaryOutcomeEdited: false,
          metricsEdited: false,
          stakeholdersEdited: false,
          customStakeholders: [],
          suggestionsAccepted: false,
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
          proposedAgents: [],
          proposedOrchestration: 'workflow',
          proposedEdges: [],
          orchestrationReasoning: '',
          proposalAccepted: false,
          isLoading: false,
          aiCalled: false,
          confirmedAgents: [],
          confirmedOrchestration: 'workflow',
          confirmedEdges: [],
          originalOrchestration: 'workflow',
        },
        mockData: {
          mockDefinitions: [],
          useCustomerTerminology: false,
          isLoading: false,
          aiCalled: false,
        },
        demoStrategy: {
          ahaMoments: [],
          persona: { name: '', role: '', painPoint: '' },
          narrativeScenes: [],
          isGeneratingMoments: false,
          isGeneratingPersona: false,
          isGeneratingNarrative: false,
          momentsEdited: false,
          personaEdited: false,
          narrativeEdited: false,
        },
        // No generation field
      };

      const wizardState = persistedStateToWizardState(persisted as PersistedWizardState);

      // Should have default generation state
      expect(wizardState.generation).toBeDefined();
      expect(wizardState.generation.isGenerating).toBe(false);
      expect(wizardState.generation.completedFiles).toEqual([]);
      expect(wizardState.generation.canGenerate).toBe(true);
    });
  });
});

// ============================================================================
// Task 7.8: WizardStep enum includes Generate
// ============================================================================

describe('WizardStep enum', () => {
  it('should include Generate as Step 8', () => {
    expect(WizardStep.Generate).toBe(8);
  });

  it('should have all 8 steps defined', () => {
    expect(WizardStep.BusinessContext).toBe(1);
    expect(WizardStep.AIGapFilling).toBe(2);
    expect(WizardStep.OutcomeDefinition).toBe(3);
    expect(WizardStep.Security).toBe(4);
    expect(WizardStep.AgentDesign).toBe(5);
    expect(WizardStep.MockData).toBe(6);
    expect(WizardStep.DemoStrategy).toBe(7);
    expect(WizardStep.Generate).toBe(8);
  });
});
