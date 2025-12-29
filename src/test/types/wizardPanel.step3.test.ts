/**
 * Tests for Wizard Panel Types - Step 3: Outcome Definition
 * Task Group 1: Type Definitions and Constants for Step 3
 * 5 focused tests for new types and constants
 */

import { describe, it, expect } from 'vitest';
import {
  STAKEHOLDER_OPTIONS,
  WIZARD_COMMANDS,
  createDefaultWizardState,
  type OutcomeSuggestions,
  type OutcomeDefinitionState,
  type SuccessMetric,
} from '../../types/wizardPanel';

describe('Task Group 1: Step 3 Types and Constants', () => {
  describe('OutcomeSuggestions interface', () => {
    it('should validate OutcomeSuggestions structure with all required fields', () => {
      // Test valid OutcomeSuggestions object
      const suggestions: OutcomeSuggestions = {
        primaryOutcome: 'Reduce order processing time by 40% through AI-powered automation',
        suggestedKPIs: [
          { name: 'Order Processing Time', targetValue: '2', unit: 'hours' },
          { name: 'Order Accuracy', targetValue: '99', unit: '%' },
          { name: 'Customer Satisfaction', targetValue: '4.5', unit: '/5' },
        ],
        stakeholders: ['Operations', 'Customer Service', 'IT'],
      };

      expect(suggestions.primaryOutcome).toBeTruthy();
      expect(suggestions.suggestedKPIs).toBeInstanceOf(Array);
      expect(suggestions.suggestedKPIs).toHaveLength(3);
      expect(suggestions.stakeholders).toBeInstanceOf(Array);
      expect(suggestions.stakeholders).toHaveLength(3);

      // Verify KPI structure
      const firstKPI = suggestions.suggestedKPIs[0];
      expect(firstKPI.name).toBe('Order Processing Time');
      expect(firstKPI.targetValue).toBe('2');
      expect(firstKPI.unit).toBe('hours');
    });
  });

  describe('STAKEHOLDER_OPTIONS expanded list', () => {
    it('should contain all 10 required stakeholder options', () => {
      // Verify the expanded list contains all required options
      const requiredStakeholders = [
        'Operations',
        'Finance',
        'Supply Chain',
        'Customer Service',
        'Executive',
        'IT',
        'Sales',
        'Marketing',
        'HR',
        'Legal',
      ];

      expect(STAKEHOLDER_OPTIONS).toHaveLength(10);

      requiredStakeholders.forEach((stakeholder) => {
        expect(STAKEHOLDER_OPTIONS).toContain(stakeholder);
      });
    });
  });

  describe('OutcomeDefinitionState with Step 3 tracking fields', () => {
    it('should initialize Step 3 state with correct defaults including loading and edit flags', () => {
      const state = createDefaultWizardState();
      const outcomeState = state.outcome;

      // Verify basic fields
      expect(outcomeState.primaryOutcome).toBe('');
      expect(outcomeState.successMetrics).toEqual([]);
      expect(outcomeState.stakeholders).toEqual([]);

      // Verify new Step 3 tracking fields
      expect(outcomeState.isLoading).toBe(false);
      expect(outcomeState.loadingError).toBeUndefined();
      expect(outcomeState.primaryOutcomeEdited).toBe(false);
      expect(outcomeState.metricsEdited).toBe(false);
      expect(outcomeState.stakeholdersEdited).toBe(false);
      expect(outcomeState.customStakeholders).toEqual([]);
    });

    it('should accept valid OutcomeDefinitionState with all fields populated', () => {
      const outcomeState: OutcomeDefinitionState = {
        primaryOutcome: 'Improve operational efficiency by 30%',
        successMetrics: [
          { name: 'Processing Time', targetValue: '50', unit: '% reduction' },
          { name: 'Cost Savings', targetValue: '1M', unit: 'USD' },
        ],
        stakeholders: ['Operations', 'Finance', 'Executive'],
        isLoading: false,
        loadingError: undefined,
        primaryOutcomeEdited: true,
        metricsEdited: true,
        stakeholdersEdited: false,
        customStakeholders: ['Board of Directors', 'External Auditors'],
      };

      expect(outcomeState.primaryOutcome).toBe('Improve operational efficiency by 30%');
      expect(outcomeState.successMetrics).toHaveLength(2);
      expect(outcomeState.stakeholders).toHaveLength(3);
      expect(outcomeState.primaryOutcomeEdited).toBe(true);
      expect(outcomeState.customStakeholders).toHaveLength(2);
    });
  });

  describe('WIZARD_COMMANDS for Step 3', () => {
    it('should define all Step 3 outcome definition commands', () => {
      // Verify Step 3 specific commands exist
      expect(WIZARD_COMMANDS.UPDATE_PRIMARY_OUTCOME).toBe('updatePrimaryOutcome');
      expect(WIZARD_COMMANDS.ADD_METRIC).toBe('addMetric');
      expect(WIZARD_COMMANDS.REMOVE_METRIC).toBe('removeMetric');
      expect(WIZARD_COMMANDS.UPDATE_METRIC).toBe('updateMetric');
      expect(WIZARD_COMMANDS.TOGGLE_STAKEHOLDER).toBe('toggleStakeholder');
      expect(WIZARD_COMMANDS.ADD_CUSTOM_STAKEHOLDER).toBe('addCustomStakeholder');
      expect(WIZARD_COMMANDS.REGENERATE_OUTCOME_SUGGESTIONS).toBe('regenerateOutcomeSuggestions');
      expect(WIZARD_COMMANDS.DISMISS_OUTCOME_ERROR).toBe('dismissOutcomeError');

      // Verify commands follow existing camelCase naming pattern
      expect(WIZARD_COMMANDS.UPDATE_PRIMARY_OUTCOME).toMatch(/^[a-z][a-zA-Z]+$/);
      expect(WIZARD_COMMANDS.ADD_METRIC).toMatch(/^[a-z][a-zA-Z]+$/);
      expect(WIZARD_COMMANDS.REGENERATE_OUTCOME_SUGGESTIONS).toMatch(/^[a-z][a-zA-Z]+$/);
    });
  });

  describe('SuccessMetric interface', () => {
    it('should validate SuccessMetric structure used in suggestedKPIs', () => {
      const metric: SuccessMetric = {
        name: 'Order Accuracy',
        targetValue: '95',
        unit: '%',
      };

      expect(metric.name).toBe('Order Accuracy');
      expect(metric.targetValue).toBe('95');
      expect(metric.unit).toBe('%');

      // Test with various unit types
      const metricsWithDifferentUnits: SuccessMetric[] = [
        { name: 'Response Time', targetValue: '2', unit: 'hours' },
        { name: 'Cost Reduction', targetValue: '500000', unit: 'USD' },
        { name: 'NPS Score', targetValue: '75', unit: 'points' },
        { name: 'Completion Rate', targetValue: '99.9', unit: '%' },
      ];

      metricsWithDifferentUnits.forEach((m) => {
        expect(typeof m.name).toBe('string');
        expect(typeof m.targetValue).toBe('string');
        expect(typeof m.unit).toBe('string');
      });
    });
  });
});
