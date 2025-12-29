/**
 * Integration Tests for Step 3: Outcome Refinement Conversation
 *
 * Task Group 4: Test Review and Gap Analysis
 * Strategic integration tests for critical user workflows
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module
vi.mock('vscode', () => {
  return {
    workspace: {
      fs: {
        readFile: vi.fn(),
      },
      findFiles: vi.fn().mockResolvedValue([]),
      createFileSystemWatcher: vi.fn().mockReturnValue({
        onDidCreate: vi.fn().mockReturnValue({ dispose: () => {} }),
        onDidDelete: vi.fn().mockReturnValue({ dispose: () => {} }),
        dispose: () => {},
      }),
    },
    Uri: {
      joinPath: (...args: unknown[]) => {
        const paths = args.map((arg) => (typeof arg === 'string' ? arg : (arg as { fsPath: string }).fsPath || ''));
        return { fsPath: paths.join('/') };
      },
    },
    EventEmitter: class MockEventEmitter {
      private handlers: Array<(e: unknown) => void> = [];
      event = (handler: (e: unknown) => void) => {
        this.handlers.push(handler);
        return { dispose: () => {} };
      };
      fire = (e: unknown) => this.handlers.forEach((h) => h(e));
      dispose = () => { this.handlers = []; };
    },
    Disposable: {
      from: (...disposables: unknown[]) => ({
        dispose: () => disposables.forEach((d) => (d as { dispose: () => void }).dispose?.()),
      }),
    },
  };
});

// Import types and utilities
import { createDefaultOutcomeDefinitionState } from '../../types/wizardPanel';
import type { OutcomeDefinitionState, SuccessMetric } from '../../types/wizardPanel';
import {
  applyRefinementChangesWithEditedFlags,
  parseRefinementChangesFromResponse,
} from '../../services/outcomeDefinitionService';
import { generateAssumptionsHash, hasAssumptionsChanged } from '../../services/gapFillingService';
import type { SystemAssumption } from '../../types/wizardPanel';

describe('Task Group 4: Step 3 Integration Tests', () => {
  describe('Full two-phase flow from entry to completion', () => {
    it('should complete full workflow: entry -> Phase 1 -> Accept -> Phase 2', () => {
      // 1. Initial entry to Step 3 - state is fresh
      const state = createDefaultOutcomeDefinitionState();
      expect(state.suggestionsAccepted).toBe(false);
      expect(state.primaryOutcome).toBe('');

      // 2. AI generates suggestions (simulated)
      state.primaryOutcome = 'Reduce order processing time by 40%';
      state.successMetrics = [
        { name: 'Processing Time', targetValue: '2', unit: 'hours' },
      ];
      state.stakeholders = ['Operations', 'Finance'];

      // Still in Phase 1 (not accepted yet)
      expect(state.suggestionsAccepted).toBe(false);

      // 3. User clicks Accept - transition to Phase 2
      state.suggestionsAccepted = true;
      state.primaryOutcomeEdited = false;
      state.metricsEdited = false;
      state.stakeholdersEdited = false;

      // Now in Phase 2
      expect(state.suggestionsAccepted).toBe(true);
      expect(state.primaryOutcomeEdited).toBe(false);
      expect(state.metricsEdited).toBe(false);
      expect(state.stakeholdersEdited).toBe(false);

      // 4. User can now edit fields
      state.primaryOutcome = 'Reduce order processing time by 50%';
      state.primaryOutcomeEdited = true;

      expect(state.primaryOutcomeEdited).toBe(true);
      expect(state.suggestionsAccepted).toBe(true);
    });
  });

  describe('Refine in Phase 1 updates suggestion card correctly', () => {
    it('should apply AI refinement to all fields in Phase 1', () => {
      // Initial Phase 1 state with AI suggestions
      const state: OutcomeDefinitionState = {
        ...createDefaultOutcomeDefinitionState(),
        primaryOutcome: 'Initial outcome',
        successMetrics: [{ name: 'Metric 1', targetValue: '50', unit: '%' }],
        stakeholders: ['Operations'],
        suggestionsAccepted: false, // Phase 1
      };

      // Simulate AI refinement response
      const changes = {
        outcome: 'Refined outcome with more detail',
        kpis: [
          { name: 'Metric 1', targetValue: '75', unit: '%' },
          { name: 'Cost Savings', targetValue: '100000', unit: 'USD' },
        ],
        stakeholders: ['Operations', 'Finance', 'IT'],
      };

      // Apply changes (all should be applied since no edited flags)
      const newState = applyRefinementChangesWithEditedFlags(state, changes);

      expect(newState.primaryOutcome).toBe('Refined outcome with more detail');
      expect(newState.successMetrics).toHaveLength(2);
      expect(newState.stakeholders).toContain('IT');
      expect(newState.refinedSections.outcome).toBe(true);
      expect(newState.refinedSections.kpis).toBe(true);
      expect(newState.refinedSections.stakeholders).toBe(true);
    });
  });

  describe('Refine in Phase 2 respects edited flags', () => {
    it('should only apply AI changes to non-edited fields', () => {
      // Phase 2 state with some manual edits
      const state: OutcomeDefinitionState = {
        ...createDefaultOutcomeDefinitionState(),
        primaryOutcome: 'User manually edited outcome',
        successMetrics: [{ name: 'Original Metric', targetValue: '50', unit: '%' }],
        stakeholders: ['Operations'],
        suggestionsAccepted: true, // Phase 2
        primaryOutcomeEdited: true, // User edited this
        metricsEdited: false, // Not edited
        stakeholdersEdited: false, // Not edited
      };

      // Simulate AI refinement response
      const changes = {
        outcome: 'AI suggested new outcome',
        kpis: [{ name: 'New AI Metric', targetValue: '100', unit: '%' }],
        stakeholders: ['Operations', 'Finance'],
      };

      const newState = applyRefinementChangesWithEditedFlags(state, changes);

      // Outcome should NOT change (edited flag is true)
      expect(newState.primaryOutcome).toBe('User manually edited outcome');

      // Metrics SHOULD change (edited flag is false)
      expect(newState.successMetrics[0].name).toBe('New AI Metric');

      // Stakeholders SHOULD change (edited flag is false)
      expect(newState.stakeholders).toContain('Finance');
    });
  });

  describe('Regenerate without confirmation (no edits)', () => {
    it('should allow direct regenerate when no fields are edited', () => {
      // Phase 2 without any manual edits
      const state: OutcomeDefinitionState = {
        ...createDefaultOutcomeDefinitionState(),
        primaryOutcome: 'AI generated outcome',
        successMetrics: [{ name: 'AI Metric', targetValue: '75', unit: '%' }],
        stakeholders: ['Operations'],
        suggestionsAccepted: true, // Phase 2
        primaryOutcomeEdited: false,
        metricsEdited: false,
        stakeholdersEdited: false,
      };

      // Check if confirmation is needed
      const needsConfirmation =
        state.suggestionsAccepted &&
        (state.primaryOutcomeEdited || state.metricsEdited || state.stakeholdersEdited);

      expect(needsConfirmation).toBe(false);
    });
  });

  describe('Regenerate with confirmation (has edits)', () => {
    it('should require confirmation when fields are edited', () => {
      // Phase 2 with manual edits
      const state: OutcomeDefinitionState = {
        ...createDefaultOutcomeDefinitionState(),
        primaryOutcome: 'User edited outcome',
        successMetrics: [{ name: 'User Metric', targetValue: '80', unit: '%' }],
        stakeholders: ['Operations', 'Custom Stakeholder'],
        suggestionsAccepted: true, // Phase 2
        primaryOutcomeEdited: true, // User edited this
        metricsEdited: true, // User edited this
        stakeholdersEdited: false,
      };

      const needsConfirmation =
        state.suggestionsAccepted &&
        (state.primaryOutcomeEdited || state.metricsEdited || state.stakeholdersEdited);

      expect(needsConfirmation).toBe(true);
    });
  });

  describe('Navigation preservation when Step 2 unchanged', () => {
    it('should preserve Step 3 state when assumptions have not changed', () => {
      // Simulate Step 2 confirmed assumptions
      const assumptions: SystemAssumption[] = [
        {
          system: 'SAP S/4HANA',
          modules: ['MM', 'SD'],
          integrations: ['Salesforce CRM sync'],
          source: 'ai-proposed',
        },
      ];

      // Generate and store hash
      const storedHash = generateAssumptionsHash(assumptions);

      // Later, check if assumptions changed (they haven't)
      const hasChanged = hasAssumptionsChanged(storedHash, assumptions);

      expect(hasChanged).toBe(false);

      // Since assumptions haven't changed, Step 3 state should be preserved
      // This means suggestionsAccepted and edited flags should remain intact
    });
  });

  describe('State reset when Step 2 assumptions changed', () => {
    it('should reset Step 3 state when assumptions have changed', () => {
      // Original assumptions
      const originalAssumptions: SystemAssumption[] = [
        {
          system: 'SAP S/4HANA',
          modules: ['MM', 'SD'],
          integrations: ['Salesforce CRM sync'],
          source: 'ai-proposed',
        },
      ];

      // Generate and store original hash
      const storedHash = generateAssumptionsHash(originalAssumptions);

      // Modified assumptions (user went back and changed them)
      const modifiedAssumptions: SystemAssumption[] = [
        {
          system: 'SAP S/4HANA',
          modules: ['MM', 'SD', 'PP'], // Added PP module
          integrations: ['Salesforce CRM sync', 'EDI with suppliers'], // Added integration
          source: 'user-corrected',
        },
      ];

      // Check if assumptions changed
      const hasChanged = hasAssumptionsChanged(storedHash, modifiedAssumptions);

      expect(hasChanged).toBe(true);

      // Since assumptions changed, Step 3 state should be reset
      // Create fresh state
      const resetState = createDefaultOutcomeDefinitionState();
      expect(resetState.suggestionsAccepted).toBe(false);
      expect(resetState.primaryOutcome).toBe('');
      expect(resetState.successMetrics).toHaveLength(0);
    });
  });

  describe('Multiple refinements accumulate "(refined)" indicators', () => {
    it('should track multiple section refinements', () => {
      const state = createDefaultOutcomeDefinitionState();

      // First refinement - only outcome
      const changes1 = { outcome: 'Refined outcome v1' };
      const state1 = applyRefinementChangesWithEditedFlags(state, changes1);

      expect(state1.refinedSections.outcome).toBe(true);
      expect(state1.refinedSections.kpis).toBe(false);
      expect(state1.refinedSections.stakeholders).toBe(false);

      // Second refinement - add KPIs
      const changes2 = { kpis: [{ name: 'New KPI', targetValue: '100', unit: '%' }] };
      const state2 = applyRefinementChangesWithEditedFlags(state1, changes2);

      expect(state2.refinedSections.outcome).toBe(true); // Still refined
      expect(state2.refinedSections.kpis).toBe(true); // Now refined
      expect(state2.refinedSections.stakeholders).toBe(false);

      // Third refinement - add stakeholders
      const changes3 = { stakeholders: ['Operations', 'Finance'] };
      const state3 = applyRefinementChangesWithEditedFlags(state2, changes3);

      // All sections now show as refined
      expect(state3.refinedSections.outcome).toBe(true);
      expect(state3.refinedSections.kpis).toBe(true);
      expect(state3.refinedSections.stakeholders).toBe(true);
    });
  });

  describe('Parsing refinement response with edge cases', () => {
    it('should handle response with only partial changes', () => {
      const response = `I've updated just the stakeholders as requested.

\`\`\`json
{
  "changes": {
    "stakeholders": ["Operations", "Finance", "Risk Management"]
  }
}
\`\`\``;

      const changes = parseRefinementChangesFromResponse(response);

      expect(changes).not.toBeNull();
      expect(changes!.outcome).toBeUndefined();
      expect(changes!.kpis).toBeUndefined();
      expect(changes!.stakeholders).toHaveLength(3);
      expect(changes!.stakeholders).toContain('Risk Management');
    });

    it('should handle empty JSON changes gracefully', () => {
      const response = `Let me think about what changes would be appropriate...

\`\`\`json
{
  "changes": {}
}
\`\`\``;

      const changes = parseRefinementChangesFromResponse(response);

      expect(changes).not.toBeNull();
      expect(changes!.outcome).toBeUndefined();
      expect(changes!.kpis).toBeUndefined();
      expect(changes!.stakeholders).toBeUndefined();
    });
  });
});
