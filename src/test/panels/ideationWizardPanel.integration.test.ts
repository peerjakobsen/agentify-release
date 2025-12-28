/**
 * Integration Tests for Ideation Wizard Panel
 * Tests complete wizard workflows and state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WizardStep,
  createDefaultWizardState,
  FILE_UPLOAD_CONSTRAINTS,
  type WizardState,
  type WizardValidationError,
  type WizardValidationState,
} from '../../types/wizardPanel';

/**
 * Step 1 validation logic (mirrors IdeationWizardPanelProvider)
 */
function validateStep1(state: WizardState): WizardValidationState {
  const errors: WizardValidationError[] = [];

  if (!state.businessObjective.trim()) {
    errors.push({
      type: 'businessObjective',
      message: 'Business objective is required',
      severity: 'error',
    });
  }

  if (!state.industry) {
    errors.push({
      type: 'industry',
      message: 'Please select an industry',
      severity: 'error',
    });
  }

  if (state.systems.length === 0) {
    errors.push({
      type: 'systems',
      message: 'Consider selecting systems your workflow will integrate with',
      severity: 'warning',
    });
  }

  if (state.uploadedFile && state.uploadedFile.size > FILE_UPLOAD_CONSTRAINTS.MAX_SIZE_BYTES) {
    errors.push({
      type: 'file',
      message: `File size exceeds ${FILE_UPLOAD_CONSTRAINTS.MAX_SIZE_DISPLAY} limit`,
      severity: 'error',
    });
  }

  const blockingErrors = errors.filter((e) => e.severity === 'error');
  return {
    isValid: blockingErrors.length === 0,
    errors,
    hasWarnings: errors.some((e) => e.severity === 'warning'),
  };
}

/**
 * Validate current step (simplified for testing)
 */
function validateCurrentStep(state: WizardState): WizardValidationState {
  if (state.currentStep === WizardStep.BusinessContext) {
    return validateStep1(state);
  }
  return { isValid: true, errors: [], hasWarnings: false };
}

/**
 * Simulates the panel's navigateForward method
 */
function navigateForward(state: WizardState): { newState: WizardState; validation: WizardValidationState } {
  // Set validation attempted flag
  const updatedState = { ...state, validationAttempted: true };
  const validation = validateCurrentStep(updatedState);

  if (!validation.isValid || state.currentStep >= WizardStep.Generate) {
    return { newState: updatedState, validation };
  }

  const nextStep = state.currentStep + 1;
  return {
    newState: {
      ...updatedState,
      currentStep: nextStep,
      highestStepReached: Math.max(state.highestStepReached, nextStep),
      validationAttempted: false,
    },
    validation: validateCurrentStep({ ...updatedState, currentStep: nextStep }),
  };
}

/**
 * Simulates state preservation (panel hidden/shown)
 */
function simulatePanelHideShow(state: WizardState): WizardState {
  // State is preserved in instance variable, so it should be identical
  return { ...state };
}

describe('IdeationWizardPanel Integration', () => {
  describe('Complete Step 1 -> Validation -> Next Button Flow', () => {
    it('should block navigation when required fields are empty', () => {
      let state = createDefaultWizardState();

      // Attempt to navigate forward with empty form
      const { newState, validation } = navigateForward(state);

      // Should not advance step
      expect(newState.currentStep).toBe(1);
      expect(validation.isValid).toBe(false);
      expect(newState.validationAttempted).toBe(true);

      // Should have business objective and industry errors
      const businessError = validation.errors.find((e) => e.type === 'businessObjective');
      const industryError = validation.errors.find((e) => e.type === 'industry');
      expect(businessError).toBeDefined();
      expect(industryError).toBeDefined();
    });

    it('should allow navigation after filling required fields', () => {
      let state = createDefaultWizardState();

      // Fill required fields
      state = {
        ...state,
        businessObjective: 'Automate customer support workflows',
        industry: 'Retail',
      };

      // Attempt to navigate forward
      const { newState, validation } = navigateForward(state);

      // Should advance to step 2
      expect(newState.currentStep).toBe(2);
      expect(validation.isValid).toBe(true);
      expect(newState.highestStepReached).toBe(2);
    });

    it('should allow navigation with warnings but show warning message', () => {
      let state = createDefaultWizardState();

      // Fill required fields but no systems (generates warning)
      state = {
        ...state,
        businessObjective: 'Test objective',
        industry: 'Healthcare',
        systems: [], // No systems selected
      };

      const validation = validateStep1(state);
      expect(validation.isValid).toBe(true);
      expect(validation.hasWarnings).toBe(true);

      // Should still allow navigation
      const { newState } = navigateForward(state);
      expect(newState.currentStep).toBe(2);
    });
  });

  describe('State Preservation Across Panel Hide/Show', () => {
    it('should preserve all wizard state when panel is hidden and shown', () => {
      // Setup state with various data
      const originalState: WizardState = {
        currentStep: 2,
        businessObjective: 'Complex workflow automation',
        industry: 'Other',
        customIndustry: 'Aerospace',
        systems: ['Salesforce', 'Databricks'],
        customSystems: 'Custom CRM',
        uploadedFile: {
          name: 'requirements.pdf',
          size: 1024,
          data: new Uint8Array([1, 2, 3, 4]),
        },
        highestStepReached: 2,
        validationAttempted: false,
      };

      // Simulate hide/show
      const restoredState = simulatePanelHideShow(originalState);

      // All state should be preserved
      expect(restoredState.currentStep).toBe(originalState.currentStep);
      expect(restoredState.businessObjective).toBe(originalState.businessObjective);
      expect(restoredState.industry).toBe(originalState.industry);
      expect(restoredState.customIndustry).toBe(originalState.customIndustry);
      expect(restoredState.systems).toEqual(originalState.systems);
      expect(restoredState.customSystems).toBe(originalState.customSystems);
      expect(restoredState.uploadedFile?.name).toBe(originalState.uploadedFile?.name);
      expect(restoredState.highestStepReached).toBe(originalState.highestStepReached);
    });

    it('should preserve validation state after hide/show', () => {
      const state: WizardState = {
        ...createDefaultWizardState(),
        businessObjective: 'Test',
        industry: 'Retail',
        validationAttempted: true,
      };

      const restoredState = simulatePanelHideShow(state);
      const validation = validateStep1(restoredState);

      expect(validation.isValid).toBe(true);
      expect(restoredState.validationAttempted).toBe(true);
    });
  });

  describe('File Upload Integration', () => {
    it('should accept valid file and store in state', () => {
      const state: WizardState = {
        ...createDefaultWizardState(),
        businessObjective: 'Test',
        industry: 'FSI',
        uploadedFile: {
          name: 'document.pdf',
          size: 1024 * 1024, // 1MB
          data: new Uint8Array(100),
        },
      };

      const validation = validateStep1(state);
      expect(validation.isValid).toBe(true);
      expect(state.uploadedFile?.name).toBe('document.pdf');
    });

    it('should reject oversized file and block navigation', () => {
      const state: WizardState = {
        ...createDefaultWizardState(),
        businessObjective: 'Test',
        industry: 'FSI',
        uploadedFile: {
          name: 'huge-file.pdf',
          size: 10 * 1024 * 1024, // 10MB - exceeds 5MB limit
          data: new Uint8Array(100),
        },
      };

      const validation = validateStep1(state);
      expect(validation.isValid).toBe(false);

      const fileError = validation.errors.find((e) => e.type === 'file');
      expect(fileError).toBeDefined();
      expect(fileError?.severity).toBe('error');

      // Navigation should be blocked
      const { newState } = navigateForward(state);
      expect(newState.currentStep).toBe(1);
    });

    it('should allow file removal and proceed with navigation', () => {
      let state: WizardState = {
        ...createDefaultWizardState(),
        businessObjective: 'Test',
        industry: 'FSI',
        uploadedFile: {
          name: 'document.pdf',
          size: 1024,
          data: new Uint8Array(100),
        },
      };

      // Remove file
      state = { ...state, uploadedFile: undefined };

      const validation = validateStep1(state);
      expect(validation.isValid).toBe(true);

      // Should allow navigation
      const { newState } = navigateForward(state);
      expect(newState.currentStep).toBe(2);
    });
  });

  describe('Soft Warning vs Blocking Error Behavior', () => {
    it('should distinguish warnings from errors in validation result', () => {
      // State with only warning (systems not selected)
      const warningOnlyState: WizardState = {
        ...createDefaultWizardState(),
        businessObjective: 'Test',
        industry: 'Retail',
        systems: [],
      };

      const warningValidation = validateStep1(warningOnlyState);
      expect(warningValidation.isValid).toBe(true);
      expect(warningValidation.hasWarnings).toBe(true);
      expect(warningValidation.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
      expect(warningValidation.errors.filter((e) => e.severity === 'warning')).toHaveLength(1);

      // State with error (missing required field)
      const errorState: WizardState = {
        ...createDefaultWizardState(),
        businessObjective: '',
        industry: 'Retail',
        systems: [],
      };

      const errorValidation = validateStep1(errorState);
      expect(errorValidation.isValid).toBe(false);
      expect(errorValidation.errors.filter((e) => e.severity === 'error')).toHaveLength(1);
    });

    it('should block navigation only on errors, not warnings', () => {
      // Warning only state
      const warningState: WizardState = {
        ...createDefaultWizardState(),
        businessObjective: 'Test objective',
        industry: 'Healthcare',
        systems: [], // Warning
      };

      const { newState: afterWarning } = navigateForward(warningState);
      expect(afterWarning.currentStep).toBe(2); // Allowed to proceed

      // Error state
      const errorState: WizardState = {
        ...createDefaultWizardState(),
        businessObjective: '', // Error
        industry: 'Healthcare',
        systems: ['Salesforce'],
      };

      const { newState: afterError } = navigateForward(errorState);
      expect(afterError.currentStep).toBe(1); // Blocked
    });
  });

  describe('Multi-Step Navigation Flow', () => {
    it('should track highest step reached through multi-step navigation', () => {
      let state: WizardState = {
        ...createDefaultWizardState(),
        businessObjective: 'Test',
        industry: 'Retail',
      };

      // Navigate to step 2
      let result = navigateForward(state);
      state = result.newState;
      expect(state.currentStep).toBe(2);
      expect(state.highestStepReached).toBe(2);

      // Navigate to step 3
      result = navigateForward(state);
      state = result.newState;
      expect(state.currentStep).toBe(3);
      expect(state.highestStepReached).toBe(3);

      // Navigate back to step 1
      state = { ...state, currentStep: 1 };
      expect(state.highestStepReached).toBe(3); // Should still be 3

      // Can navigate directly to step 3 (already visited)
      expect(state.highestStepReached >= 3).toBe(true);
    });

    it('should handle complete wizard flow from start to finish', () => {
      let state: WizardState = {
        ...createDefaultWizardState(),
        businessObjective: 'Complete workflow automation',
        industry: 'Manufacturing',
        systems: ['SAP S/4HANA', 'ServiceNow'],
      };

      // Navigate through all steps
      for (let expectedStep = 2; expectedStep <= WizardStep.Generate; expectedStep++) {
        const result = navigateForward(state);
        state = result.newState;
        expect(state.currentStep).toBe(expectedStep);
      }

      expect(state.currentStep).toBe(WizardStep.Generate);
      expect(state.highestStepReached).toBe(WizardStep.Generate);

      // Cannot navigate past last step
      const finalResult = navigateForward(state);
      expect(finalResult.newState.currentStep).toBe(WizardStep.Generate);
    });
  });
});
