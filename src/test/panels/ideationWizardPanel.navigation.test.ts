/**
 * Tests for Ideation Wizard Panel Navigation Logic
 * Validates wizard step navigation, state transitions, and validation gating
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WizardStep,
  createDefaultWizardState,
  type WizardState,
  type WizardValidationState,
} from '../../types/wizardPanel';

/**
 * Navigation logic functions that will be implemented in the panel
 * These are pure functions extracted for testability
 */

/**
 * Determines if forward navigation is allowed from the current step
 */
function canNavigateForward(state: WizardState, validation: WizardValidationState): boolean {
  // Cannot navigate forward from the last step
  if (state.currentStep >= WizardStep.Generate) {
    return false;
  }
  // Can only navigate forward if validation passes (no blocking errors)
  return validation.isValid;
}

/**
 * Determines if backward navigation is allowed from the current step
 */
function canNavigateBackward(state: WizardState): boolean {
  // Can always go back except from step 1
  return state.currentStep > WizardStep.BusinessContext;
}

/**
 * Determines if direct navigation to a target step is allowed
 */
function canNavigateToStep(state: WizardState, targetStep: number): boolean {
  // Cannot navigate to current step
  if (targetStep === state.currentStep) {
    return false;
  }
  // Cannot navigate to invalid steps
  if (targetStep < WizardStep.BusinessContext || targetStep > WizardStep.Generate) {
    return false;
  }
  // Can navigate to completed steps (steps <= highestStepReached)
  // Cannot skip ahead to unvisited steps
  return targetStep <= state.highestStepReached;
}

/**
 * Calculates the next state after navigation attempt
 */
function navigateForward(state: WizardState, validation: WizardValidationState): WizardState {
  if (!canNavigateForward(state, validation)) {
    return state;
  }
  const nextStep = state.currentStep + 1;
  return {
    ...state,
    currentStep: nextStep,
    highestStepReached: Math.max(state.highestStepReached, nextStep),
  };
}

/**
 * Calculates the previous state after backward navigation
 */
function navigateBackward(state: WizardState): WizardState {
  if (!canNavigateBackward(state)) {
    return state;
  }
  return {
    ...state,
    currentStep: state.currentStep - 1,
  };
}

/**
 * Calculates the state after direct step navigation
 */
function navigateToStep(state: WizardState, targetStep: number): WizardState {
  if (!canNavigateToStep(state, targetStep)) {
    return state;
  }
  return {
    ...state,
    currentStep: targetStep,
  };
}

describe('IdeationWizardPanel Navigation', () => {
  let defaultState: WizardState;
  let validValidation: WizardValidationState;
  let invalidValidation: WizardValidationState;

  beforeEach(() => {
    defaultState = createDefaultWizardState();
    validValidation = {
      isValid: true,
      errors: [],
      hasWarnings: false,
    };
    invalidValidation = {
      isValid: false,
      errors: [{ type: 'businessObjective', message: 'Required', severity: 'error' }],
      hasWarnings: false,
    };
  });

  describe('Forward navigation', () => {
    it('should allow forward navigation when validation passes', () => {
      const canNavigate = canNavigateForward(defaultState, validValidation);
      expect(canNavigate).toBe(true);

      const newState = navigateForward(defaultState, validValidation);
      expect(newState.currentStep).toBe(2);
      expect(newState.highestStepReached).toBe(2);
    });

    it('should block forward navigation when validation fails', () => {
      const canNavigate = canNavigateForward(defaultState, invalidValidation);
      expect(canNavigate).toBe(false);

      const newState = navigateForward(defaultState, invalidValidation);
      expect(newState.currentStep).toBe(1); // Unchanged
    });

    it('should not allow forward navigation from last step', () => {
      const stateAtLastStep: WizardState = {
        ...defaultState,
        currentStep: WizardStep.Generate,
        highestStepReached: WizardStep.Generate,
      };

      const canNavigate = canNavigateForward(stateAtLastStep, validValidation);
      expect(canNavigate).toBe(false);
    });

    it('should allow forward navigation with warnings (soft warnings do not block)', () => {
      const warningValidation: WizardValidationState = {
        isValid: true, // Still valid despite warnings
        errors: [{ type: 'systems', message: 'No systems selected', severity: 'warning' }],
        hasWarnings: true,
      };

      const canNavigate = canNavigateForward(defaultState, warningValidation);
      expect(canNavigate).toBe(true);
    });
  });

  describe('Backward navigation', () => {
    it('should always allow backward navigation from steps 2-6', () => {
      const stateAtStep2: WizardState = {
        ...defaultState,
        currentStep: 2,
        highestStepReached: 2,
      };

      const canNavigate = canNavigateBackward(stateAtStep2);
      expect(canNavigate).toBe(true);

      const newState = navigateBackward(stateAtStep2);
      expect(newState.currentStep).toBe(1);
    });

    it('should not allow backward navigation from step 1', () => {
      const canNavigate = canNavigateBackward(defaultState);
      expect(canNavigate).toBe(false);

      const newState = navigateBackward(defaultState);
      expect(newState.currentStep).toBe(1); // Unchanged
    });

    it('should allow backward navigation regardless of validation state', () => {
      const stateAtStep2: WizardState = {
        ...defaultState,
        currentStep: 2,
        highestStepReached: 2,
      };

      // Even with invalid data, can go back
      const canNavigate = canNavigateBackward(stateAtStep2);
      expect(canNavigate).toBe(true);
    });
  });

  describe('Direct step click navigation', () => {
    it('should allow clicking on completed steps', () => {
      const stateAtStep3: WizardState = {
        ...defaultState,
        currentStep: 3,
        highestStepReached: 3,
      };

      // Can click step 1 (completed)
      expect(canNavigateToStep(stateAtStep3, 1)).toBe(true);
      // Can click step 2 (completed)
      expect(canNavigateToStep(stateAtStep3, 2)).toBe(true);

      const newState = navigateToStep(stateAtStep3, 1);
      expect(newState.currentStep).toBe(1);
    });

    it('should not allow clicking on unvisited steps', () => {
      const stateAtStep2: WizardState = {
        ...defaultState,
        currentStep: 2,
        highestStepReached: 2,
      };

      // Cannot click step 3 (not yet visited)
      expect(canNavigateToStep(stateAtStep2, 3)).toBe(false);
      // Cannot click step 4 (not yet visited)
      expect(canNavigateToStep(stateAtStep2, 4)).toBe(false);

      const newState = navigateToStep(stateAtStep2, 4);
      expect(newState.currentStep).toBe(2); // Unchanged
    });

    it('should not allow clicking on current step', () => {
      const stateAtStep2: WizardState = {
        ...defaultState,
        currentStep: 2,
        highestStepReached: 2,
      };

      expect(canNavigateToStep(stateAtStep2, 2)).toBe(false);
    });

    it('should not allow clicking on invalid step numbers', () => {
      expect(canNavigateToStep(defaultState, 0)).toBe(false);
      expect(canNavigateToStep(defaultState, 7)).toBe(false);
      expect(canNavigateToStep(defaultState, -1)).toBe(false);
    });
  });

  describe('Step validation gating', () => {
    it('should track highest step reached correctly', () => {
      let state = createDefaultWizardState();
      expect(state.highestStepReached).toBe(1);

      // Navigate forward
      state = navigateForward(state, validValidation);
      expect(state.currentStep).toBe(2);
      expect(state.highestStepReached).toBe(2);

      // Navigate forward again
      state = navigateForward(state, validValidation);
      expect(state.currentStep).toBe(3);
      expect(state.highestStepReached).toBe(3);

      // Navigate back - highest should remain 3
      state = navigateBackward(state);
      expect(state.currentStep).toBe(2);
      expect(state.highestStepReached).toBe(3);

      // Can now click step 3 (already visited)
      expect(canNavigateToStep(state, 3)).toBe(true);
    });
  });
});
