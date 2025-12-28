/**
 * Tests for Wizard Panel Types
 * Validates type definitions and constants for the Ideation Wizard panel
 */

import { describe, it, expect } from 'vitest';
import {
  WizardStep,
  WIZARD_STEPS,
  INDUSTRY_OPTIONS,
  SYSTEM_OPTIONS,
  WIZARD_COMMANDS,
  FILE_UPLOAD_CONSTRAINTS,
  createDefaultWizardState,
  type WizardState,
  type WizardValidationError,
  type WizardValidationState,
  type UploadedFile,
  type WizardStepConfig,
} from '../../types/wizardPanel';

describe('WizardPanel Types', () => {
  describe('WizardState interface', () => {
    it('should create a valid default wizard state with all required fields', () => {
      const state = createDefaultWizardState();

      // Verify all required fields exist with correct default values
      expect(state.currentStep).toBe(1);
      expect(state.businessObjective).toBe('');
      expect(state.industry).toBe('');
      expect(state.systems).toEqual([]);
      expect(state.highestStepReached).toBe(1);
      expect(state.validationAttempted).toBe(false);

      // Verify optional fields are undefined by default
      expect(state.customIndustry).toBeUndefined();
      expect(state.customSystems).toBeUndefined();
      expect(state.uploadedFile).toBeUndefined();
    });

    it('should accept valid wizard state with all fields populated', () => {
      const uploadedFile: UploadedFile = {
        name: 'test.pdf',
        size: 1024,
        data: new Uint8Array([1, 2, 3]),
      };

      const state: WizardState = {
        currentStep: 2,
        businessObjective: 'Test objective',
        industry: 'Other',
        customIndustry: 'Custom Industry',
        systems: ['Salesforce', 'HubSpot'],
        customSystems: 'Custom System',
        uploadedFile,
        highestStepReached: 2,
        validationAttempted: true,
      };

      expect(state.currentStep).toBe(2);
      expect(state.businessObjective).toBe('Test objective');
      expect(state.industry).toBe('Other');
      expect(state.customIndustry).toBe('Custom Industry');
      expect(state.systems).toHaveLength(2);
      expect(state.uploadedFile?.name).toBe('test.pdf');
      expect(state.uploadedFile?.data).toBeInstanceOf(Uint8Array);
    });
  });

  describe('WizardValidationError type', () => {
    it('should allow required field error types (businessObjective, industry)', () => {
      const businessObjectiveError: WizardValidationError = {
        type: 'businessObjective',
        message: 'Business objective is required',
        severity: 'error',
      };

      const industryError: WizardValidationError = {
        type: 'industry',
        message: 'Industry is required',
        severity: 'error',
      };

      expect(businessObjectiveError.type).toBe('businessObjective');
      expect(businessObjectiveError.severity).toBe('error');
      expect(industryError.type).toBe('industry');
      expect(industryError.severity).toBe('error');
    });

    it('should allow warning type for systems field', () => {
      const systemsWarning: WizardValidationError = {
        type: 'systems',
        message: 'No systems selected',
        severity: 'warning',
      };

      expect(systemsWarning.type).toBe('systems');
      expect(systemsWarning.severity).toBe('warning');
    });

    it('should create valid validation state with errors and warnings', () => {
      const validationState: WizardValidationState = {
        isValid: false,
        errors: [
          { type: 'businessObjective', message: 'Required', severity: 'error' },
          { type: 'systems', message: 'Recommended', severity: 'warning' },
        ],
        hasWarnings: true,
      };

      expect(validationState.isValid).toBe(false);
      expect(validationState.errors).toHaveLength(2);
      expect(validationState.hasWarnings).toBe(true);
    });
  });

  describe('UploadedFile interface', () => {
    it('should store file metadata and Uint8Array content', () => {
      const fileContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // PDF magic bytes
      const uploadedFile: UploadedFile = {
        name: 'document.pdf',
        size: 4,
        data: fileContent,
      };

      expect(uploadedFile.name).toBe('document.pdf');
      expect(uploadedFile.size).toBe(4);
      expect(uploadedFile.data).toBeInstanceOf(Uint8Array);
      expect(uploadedFile.data.length).toBe(4);
    });
  });

  describe('Constants', () => {
    it('should define all 6 wizard steps with correct labels', () => {
      expect(WIZARD_STEPS).toHaveLength(6);

      const expectedLabels = [
        'Business Context',
        'AI Gap Filling',
        'Agent Design',
        'Mock Data',
        'Demo Strategy',
        'Generate',
      ];

      WIZARD_STEPS.forEach((stepConfig: WizardStepConfig, index: number) => {
        expect(stepConfig.step).toBe(index + 1);
        expect(stepConfig.label).toBe(expectedLabels[index]);
        expect(stepConfig.description).toBeTruthy();
      });
    });

    it('should define all industry options including Other', () => {
      expect(INDUSTRY_OPTIONS).toContain('Retail');
      expect(INDUSTRY_OPTIONS).toContain('FSI');
      expect(INDUSTRY_OPTIONS).toContain('Healthcare');
      expect(INDUSTRY_OPTIONS).toContain('Other');
      expect(INDUSTRY_OPTIONS).toHaveLength(11);
    });

    it('should define system options grouped by category', () => {
      expect(SYSTEM_OPTIONS).toHaveLength(5);

      const crmCategory = SYSTEM_OPTIONS.find((c) => c.category === 'CRM');
      expect(crmCategory?.systems).toContain('Salesforce');
      expect(crmCategory?.systems).toContain('HubSpot');
      expect(crmCategory?.systems).toContain('Dynamics');

      const erpCategory = SYSTEM_OPTIONS.find((c) => c.category === 'ERP');
      expect(erpCategory?.systems).toContain('SAP S/4HANA');
    });

    it('should define file upload constraints with 5MB limit', () => {
      expect(FILE_UPLOAD_CONSTRAINTS.MAX_SIZE_BYTES).toBe(5 * 1024 * 1024);
      expect(FILE_UPLOAD_CONSTRAINTS.MAX_SIZE_DISPLAY).toBe('5MB');
      expect(FILE_UPLOAD_CONSTRAINTS.ACCEPTED_EXTENSIONS).toContain('.pdf');
      expect(FILE_UPLOAD_CONSTRAINTS.ACCEPTED_EXTENSIONS).toContain('.docx');
      expect(FILE_UPLOAD_CONSTRAINTS.ACCEPTED_EXTENSIONS).toContain('.txt');
      expect(FILE_UPLOAD_CONSTRAINTS.ACCEPTED_EXTENSIONS).toContain('.md');
    });

    it('should define wizard commands for message handling', () => {
      expect(WIZARD_COMMANDS.NEXT_STEP).toBe('nextStep');
      expect(WIZARD_COMMANDS.PREVIOUS_STEP).toBe('previousStep');
      expect(WIZARD_COMMANDS.GO_TO_STEP).toBe('goToStep');
      expect(WIZARD_COMMANDS.UPDATE_BUSINESS_OBJECTIVE).toBe('updateBusinessObjective');
      expect(WIZARD_COMMANDS.UPDATE_INDUSTRY).toBe('updateIndustry');
      expect(WIZARD_COMMANDS.TOGGLE_SYSTEM).toBe('toggleSystem');
      expect(WIZARD_COMMANDS.UPLOAD_FILE).toBe('uploadFile');
      expect(WIZARD_COMMANDS.REMOVE_FILE).toBe('removeFile');
    });
  });

  describe('WizardStep enum', () => {
    it('should define steps with correct numeric values', () => {
      expect(WizardStep.BusinessContext).toBe(1);
      expect(WizardStep.AIGapFilling).toBe(2);
      expect(WizardStep.AgentDesign).toBe(3);
      expect(WizardStep.MockData).toBe(4);
      expect(WizardStep.DemoStrategy).toBe(5);
      expect(WizardStep.Generate).toBe(6);
    });
  });
});
