/**
 * Tests for Ideation Wizard Panel Step 1 Form Components
 * Validates business objective, industry dropdown, system checkboxes, and file upload
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDefaultWizardState,
  FILE_UPLOAD_CONSTRAINTS,
  INDUSTRY_OPTIONS,
  SYSTEM_OPTIONS,
  type WizardState,
  type WizardValidationError,
  type WizardValidationState,
} from '../../types/wizardPanel';

/**
 * Step 1 validation logic (extracted for testing)
 * This mirrors the validation in IdeationWizardPanelProvider
 */
function validateStep1(state: WizardState): WizardValidationState {
  const errors: WizardValidationError[] = [];

  // businessObjective: Required
  if (!state.businessObjective.trim()) {
    errors.push({
      type: 'businessObjective',
      message: 'Business objective is required',
      severity: 'error',
    });
  }

  // industry: Required
  if (!state.industry) {
    errors.push({
      type: 'industry',
      message: 'Please select an industry',
      severity: 'error',
    });
  }

  // systems: Optional with soft warning
  if (state.systems.length === 0) {
    errors.push({
      type: 'systems',
      message: 'Consider selecting systems your workflow will integrate with',
      severity: 'warning',
    });
  }

  // File validation (if file uploaded)
  if (state.uploadedFile) {
    if (state.uploadedFile.size > FILE_UPLOAD_CONSTRAINTS.MAX_SIZE_BYTES) {
      errors.push({
        type: 'file',
        message: `File size exceeds ${FILE_UPLOAD_CONSTRAINTS.MAX_SIZE_DISPLAY} limit`,
        severity: 'error',
      });
    }
  }

  const blockingErrors = errors.filter((e) => e.severity === 'error');
  const hasWarnings = errors.some((e) => e.severity === 'warning');

  return {
    isValid: blockingErrors.length === 0,
    errors,
    hasWarnings,
  };
}

/**
 * Check if file extension is valid
 */
function isValidFileExtension(filename: string): boolean {
  const extension = '.' + filename.split('.').pop()?.toLowerCase();
  return FILE_UPLOAD_CONSTRAINTS.ACCEPTED_EXTENSIONS.includes(extension);
}

describe('IdeationWizardPanel Step 1 Form', () => {
  let defaultState: WizardState;

  beforeEach(() => {
    defaultState = createDefaultWizardState();
  });

  describe('Business Objective Textarea', () => {
    it('should require business objective - show error when empty', () => {
      const state: WizardState = {
        ...defaultState,
        businessObjective: '',
        industry: 'Retail',
      };

      const validation = validateStep1(state);
      const businessError = validation.errors.find((e) => e.type === 'businessObjective');

      expect(businessError).toBeDefined();
      expect(businessError?.severity).toBe('error');
      expect(validation.isValid).toBe(false);
    });

    it('should accept non-empty business objective', () => {
      const state: WizardState = {
        ...defaultState,
        businessObjective: 'Automate customer support workflows',
        industry: 'Retail',
      };

      const validation = validateStep1(state);
      const businessError = validation.errors.find((e) => e.type === 'businessObjective');

      expect(businessError).toBeUndefined();
      expect(validation.isValid).toBe(true);
    });

    it('should trim whitespace when validating business objective', () => {
      const state: WizardState = {
        ...defaultState,
        businessObjective: '   ',
        industry: 'Retail',
      };

      const validation = validateStep1(state);
      const businessError = validation.errors.find((e) => e.type === 'businessObjective');

      expect(businessError).toBeDefined();
      expect(validation.isValid).toBe(false);
    });
  });

  describe('Industry Dropdown', () => {
    it('should require industry selection - show error when not selected', () => {
      const state: WizardState = {
        ...defaultState,
        businessObjective: 'Test objective',
        industry: '',
      };

      const validation = validateStep1(state);
      const industryError = validation.errors.find((e) => e.type === 'industry');

      expect(industryError).toBeDefined();
      expect(industryError?.severity).toBe('error');
      expect(validation.isValid).toBe(false);
    });

    it('should accept valid industry selection', () => {
      const state: WizardState = {
        ...defaultState,
        businessObjective: 'Test objective',
        industry: 'Healthcare',
      };

      const validation = validateStep1(state);
      const industryError = validation.errors.find((e) => e.type === 'industry');

      expect(industryError).toBeUndefined();
      expect(validation.isValid).toBe(true);
    });

    it('should accept "Other" industry with optional custom text', () => {
      const state: WizardState = {
        ...defaultState,
        businessObjective: 'Test objective',
        industry: 'Other',
        customIndustry: 'Aerospace',
      };

      const validation = validateStep1(state);
      expect(validation.isValid).toBe(true);
    });

    it('should include all required industry options', () => {
      const requiredIndustries = [
        'Retail',
        'FSI',
        'Healthcare',
        'Life Sciences',
        'Manufacturing',
        'Energy',
        'Telecom',
        'Public Sector',
        'Media & Entertainment',
        'Travel & Hospitality',
        'Other',
      ];

      requiredIndustries.forEach((industry) => {
        expect(INDUSTRY_OPTIONS).toContain(industry);
      });
    });
  });

  describe('System Checkboxes', () => {
    it('should show soft warning when no systems selected', () => {
      const state: WizardState = {
        ...defaultState,
        businessObjective: 'Test objective',
        industry: 'Retail',
        systems: [],
      };

      const validation = validateStep1(state);
      const systemsWarning = validation.errors.find((e) => e.type === 'systems');

      expect(systemsWarning).toBeDefined();
      expect(systemsWarning?.severity).toBe('warning');
      // Warning does NOT block validation
      expect(validation.isValid).toBe(true);
      expect(validation.hasWarnings).toBe(true);
    });

    it('should not show warning when systems are selected', () => {
      const state: WizardState = {
        ...defaultState,
        businessObjective: 'Test objective',
        industry: 'Retail',
        systems: ['Salesforce'],
      };

      const validation = validateStep1(state);
      const systemsWarning = validation.errors.find((e) => e.type === 'systems');

      expect(systemsWarning).toBeUndefined();
      expect(validation.hasWarnings).toBe(false);
    });

    it('should support multiple system selections', () => {
      const state: WizardState = {
        ...defaultState,
        businessObjective: 'Test objective',
        industry: 'Retail',
        systems: ['Salesforce', 'HubSpot', 'Databricks'],
      };

      const validation = validateStep1(state);
      expect(validation.isValid).toBe(true);
      expect(state.systems).toHaveLength(3);
    });

    it('should include systems grouped by category', () => {
      const categories = SYSTEM_OPTIONS.map((c) => c.category);
      expect(categories).toContain('CRM');
      expect(categories).toContain('ERP');
      expect(categories).toContain('Data');
      expect(categories).toContain('HR');
      expect(categories).toContain('Service');

      const crmSystems = SYSTEM_OPTIONS.find((c) => c.category === 'CRM')?.systems;
      expect(crmSystems).toContain('Salesforce');
      expect(crmSystems).toContain('HubSpot');
      expect(crmSystems).toContain('Dynamics');
    });
  });

  describe('File Upload Validation', () => {
    it('should accept file within size limit', () => {
      const state: WizardState = {
        ...defaultState,
        businessObjective: 'Test objective',
        industry: 'Retail',
        uploadedFile: {
          name: 'requirements.pdf',
          size: 1024 * 1024, // 1MB
          data: new Uint8Array(1024),
        },
      };

      const validation = validateStep1(state);
      const fileError = validation.errors.find((e) => e.type === 'file');

      expect(fileError).toBeUndefined();
      expect(validation.isValid).toBe(true);
    });

    it('should reject file exceeding 5MB limit', () => {
      const state: WizardState = {
        ...defaultState,
        businessObjective: 'Test objective',
        industry: 'Retail',
        uploadedFile: {
          name: 'large-file.pdf',
          size: 6 * 1024 * 1024, // 6MB
          data: new Uint8Array(1024),
        },
      };

      const validation = validateStep1(state);
      const fileError = validation.errors.find((e) => e.type === 'file');

      expect(fileError).toBeDefined();
      expect(fileError?.severity).toBe('error');
      expect(validation.isValid).toBe(false);
    });

    it('should accept valid file formats: .pdf, .docx, .txt, .md', () => {
      const validFiles = ['document.pdf', 'report.docx', 'notes.txt', 'readme.md'];

      validFiles.forEach((filename) => {
        expect(isValidFileExtension(filename)).toBe(true);
      });
    });

    it('should reject invalid file formats', () => {
      const invalidFiles = ['script.exe', 'image.png', 'archive.zip', 'data.json'];

      invalidFiles.forEach((filename) => {
        expect(isValidFileExtension(filename)).toBe(false);
      });
    });

    it('should handle file at exactly 5MB limit', () => {
      const state: WizardState = {
        ...defaultState,
        businessObjective: 'Test objective',
        industry: 'Retail',
        uploadedFile: {
          name: 'exactly-5mb.pdf',
          size: FILE_UPLOAD_CONSTRAINTS.MAX_SIZE_BYTES, // Exactly 5MB
          data: new Uint8Array(1024),
        },
      };

      const validation = validateStep1(state);
      const fileError = validation.errors.find((e) => e.type === 'file');

      expect(fileError).toBeUndefined();
      expect(validation.isValid).toBe(true);
    });

    it('should allow form submission without file', () => {
      const state: WizardState = {
        ...defaultState,
        businessObjective: 'Test objective',
        industry: 'Retail',
        uploadedFile: undefined,
      };

      const validation = validateStep1(state);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Combined Validation', () => {
    it('should show all errors when multiple required fields are missing', () => {
      const state: WizardState = {
        ...defaultState,
        businessObjective: '',
        industry: '',
        systems: [],
      };

      const validation = validateStep1(state);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThanOrEqual(2);

      const businessError = validation.errors.find((e) => e.type === 'businessObjective');
      const industryError = validation.errors.find((e) => e.type === 'industry');
      const systemsWarning = validation.errors.find((e) => e.type === 'systems');

      expect(businessError).toBeDefined();
      expect(industryError).toBeDefined();
      expect(systemsWarning).toBeDefined();
      expect(systemsWarning?.severity).toBe('warning');
    });

    it('should pass validation with all required fields filled', () => {
      const state: WizardState = {
        ...defaultState,
        businessObjective: 'Automate customer onboarding',
        industry: 'FSI',
        systems: ['Salesforce', 'SAP S/4HANA'],
      };

      const validation = validateStep1(state);

      expect(validation.isValid).toBe(true);
      expect(validation.hasWarnings).toBe(false);
      expect(validation.errors).toHaveLength(0);
    });

    it('should be valid with warnings only', () => {
      const state: WizardState = {
        ...defaultState,
        businessObjective: 'Test objective',
        industry: 'Healthcare',
        systems: [], // Will generate warning
      };

      const validation = validateStep1(state);

      expect(validation.isValid).toBe(true);
      expect(validation.hasWarnings).toBe(true);
    });
  });
});
