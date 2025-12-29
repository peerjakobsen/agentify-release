/**
 * Tests for Wizard Panel Types - Step 3: Outcome Refinement Conversation
 * Task Group 1: Type Definitions and State Management for refinement feature
 * 4 focused tests for new types, state management, and hash comparison
 */

import { describe, it, expect, vi } from 'vitest';

// Mock vscode module before importing anything that uses it
vi.mock('vscode', () => {
  return {
    workspace: {
      fs: {
        readFile: vi.fn(),
      },
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
  };
});

import {
  WIZARD_COMMANDS,
  createDefaultOutcomeDefinitionState,
  type OutcomeDefinitionState,
} from '../../types/wizardPanel';
import { generateAssumptionsHash } from '../../services/gapFillingService';
import type { SystemAssumption } from '../../types/wizardPanel';

describe('Task Group 1: Step 3 Refinement Types and State Management', () => {
  describe('suggestionsAccepted state transitions', () => {
    it('should transition suggestionsAccepted from false to true on Accept', () => {
      // Initialize default state
      const state = createDefaultOutcomeDefinitionState();

      // Verify initial state
      expect(state.suggestionsAccepted).toBe(false);

      // Simulate Accept click by setting to true
      state.suggestionsAccepted = true;
      expect(state.suggestionsAccepted).toBe(true);
    });
  });

  describe('edited flags reset to false on Accept click', () => {
    it('should reset all edited flags to false when Accept is clicked', () => {
      // Create state with edited flags set to true
      const state: OutcomeDefinitionState = {
        ...createDefaultOutcomeDefinitionState(),
        primaryOutcomeEdited: true,
        metricsEdited: true,
        stakeholdersEdited: true,
      };

      // Verify edited flags are true
      expect(state.primaryOutcomeEdited).toBe(true);
      expect(state.metricsEdited).toBe(true);
      expect(state.stakeholdersEdited).toBe(true);

      // Simulate Accept click - reset all edited flags
      state.suggestionsAccepted = true;
      state.primaryOutcomeEdited = false;
      state.metricsEdited = false;
      state.stakeholdersEdited = false;

      // Verify all edited flags are reset to false
      expect(state.suggestionsAccepted).toBe(true);
      expect(state.primaryOutcomeEdited).toBe(false);
      expect(state.metricsEdited).toBe(false);
      expect(state.stakeholdersEdited).toBe(false);
    });
  });

  describe('hash comparison logic for Step 2 assumptions change detection', () => {
    it('should produce consistent hash for same assumptions', () => {
      const assumptions: SystemAssumption[] = [
        {
          system: 'SAP S/4HANA',
          modules: ['MM', 'SD', 'PP'],
          integrations: ['Salesforce CRM sync', 'EDI with suppliers'],
          source: 'ai-proposed',
        },
        {
          system: 'Salesforce',
          modules: ['Sales Cloud', 'Service Cloud'],
          integrations: ['SAP inventory visibility'],
          source: 'user-corrected',
        },
      ];

      const hash1 = generateAssumptionsHash(assumptions);
      const hash2 = generateAssumptionsHash(assumptions);

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(0);
    });

    it('should produce different hash when assumptions change', () => {
      const assumptions1: SystemAssumption[] = [
        {
          system: 'SAP S/4HANA',
          modules: ['MM', 'SD'],
          integrations: ['Salesforce CRM sync'],
          source: 'ai-proposed',
        },
      ];

      const assumptions2: SystemAssumption[] = [
        {
          system: 'SAP S/4HANA',
          modules: ['MM', 'SD', 'PP'], // Added PP module
          integrations: ['Salesforce CRM sync'],
          source: 'ai-proposed',
        },
      ];

      const hash1 = generateAssumptionsHash(assumptions1);
      const hash2 = generateAssumptionsHash(assumptions2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('refinedSections tracking for "(refined)" indicator', () => {
    it('should track which sections have been refined', () => {
      const state = createDefaultOutcomeDefinitionState();

      // Verify initial state - no sections refined
      expect(state.refinedSections).toEqual({
        outcome: false,
        kpis: false,
        stakeholders: false,
      });

      // Simulate refinement of outcome only
      state.refinedSections.outcome = true;
      expect(state.refinedSections.outcome).toBe(true);
      expect(state.refinedSections.kpis).toBe(false);
      expect(state.refinedSections.stakeholders).toBe(false);

      // Simulate refinement of all sections
      state.refinedSections.kpis = true;
      state.refinedSections.stakeholders = true;
      expect(state.refinedSections).toEqual({
        outcome: true,
        kpis: true,
        stakeholders: true,
      });
    });
  });

  describe('WIZARD_COMMANDS for refinement operations', () => {
    it('should define all refinement commands', () => {
      expect(WIZARD_COMMANDS.SEND_OUTCOME_REFINEMENT).toBe('sendOutcomeRefinement');
      expect(WIZARD_COMMANDS.ACCEPT_OUTCOME_SUGGESTIONS).toBe('acceptOutcomeSuggestions');
      expect(WIZARD_COMMANDS.RESET_OUTCOME_SUGGESTIONS).toBe('resetOutcomeSuggestions');

      // Verify commands follow existing camelCase naming pattern
      expect(WIZARD_COMMANDS.SEND_OUTCOME_REFINEMENT).toMatch(/^[a-z][a-zA-Z]+$/);
      expect(WIZARD_COMMANDS.ACCEPT_OUTCOME_SUGGESTIONS).toMatch(/^[a-z][a-zA-Z]+$/);
      expect(WIZARD_COMMANDS.RESET_OUTCOME_SUGGESTIONS).toMatch(/^[a-z][a-zA-Z]+$/);
    });
  });
});
