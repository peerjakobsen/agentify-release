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
  createDefaultAIGapFillingState,
  type WizardState,
  type WizardValidationError,
  type WizardValidationState,
  type UploadedFile,
  type WizardStepConfig,
  type SystemAssumption,
  type AIGapFillingState,
  type ConversationMessage,
  type AssumptionSource,
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

      // Verify AI gap-filling defaults (Step 2)
      expect(state.aiGapFillingState.conversationHistory).toEqual([]);
      expect(state.aiGapFillingState.confirmedAssumptions).toEqual([]);
      expect(state.aiGapFillingState.assumptionsAccepted).toBe(false);
      expect(state.aiGapFillingState.isStreaming).toBe(false);
      expect(state.aiGapFillingState.step1InputHash).toBeUndefined();
      expect(state.aiGapFillingState.streamingError).toBeUndefined();

      // Verify outcome definition defaults (Step 3)
      expect(state.outcome.primaryOutcome).toBe('');
      expect(state.outcome.successMetrics).toEqual([]);
      expect(state.outcome.stakeholders).toEqual([]);

      // Verify security defaults (Step 4)
      expect(state.security.dataSensitivity).toBe('internal');
      expect(state.security.complianceFrameworks).toEqual([]);
      expect(state.security.approvalGates).toEqual([]);
      expect(state.security.guardrailNotes).toBe('');
      expect(state.security.skipped).toBe(false);
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
        aiGapFillingState: {
          conversationHistory: [],
          confirmedAssumptions: [],
          assumptionsAccepted: false,
          isStreaming: false,
        },
        outcome: {
          primaryOutcome: 'Reduce stockouts by 30%',
          successMetrics: [{ name: 'Order accuracy', targetValue: '95', unit: '%' }],
          stakeholders: ['Operations', 'Finance'],
        },
        security: {
          dataSensitivity: 'confidential',
          complianceFrameworks: ['SOC 2'],
          approvalGates: ['Before external API calls'],
          guardrailNotes: 'No PII in demo data',
          skipped: false,
        },
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
      expect(state.outcome.primaryOutcome).toBe('Reduce stockouts by 30%');
      expect(state.outcome.successMetrics).toHaveLength(1);
      expect(state.security.dataSensitivity).toBe('confidential');
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
    it('should define all 8 wizard steps with correct labels', () => {
      expect(WIZARD_STEPS).toHaveLength(8);

      const expectedLabels = [
        'Business Context',
        'AI Gap Filling',
        'Outcomes',
        'Security',
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
      expect(WizardStep.OutcomeDefinition).toBe(3);
      expect(WizardStep.Security).toBe(4);
      expect(WizardStep.AgentDesign).toBe(5);
      expect(WizardStep.MockData).toBe(6);
      expect(WizardStep.DemoStrategy).toBe(7);
      expect(WizardStep.Generate).toBe(8);
    });
  });

  // ============================================================================
  // AI Gap-Filling Conversation Types (Task Group 1 - 4 Focused Tests)
  // ============================================================================

  describe('SystemAssumption interface', () => {
    it('should validate SystemAssumption structure with all required fields', () => {
      const assumption: SystemAssumption = {
        system: 'SAP S/4HANA',
        modules: ['MM', 'SD', 'PP'],
        integrations: ['Salesforce CRM sync', 'EDI with suppliers'],
        source: 'ai-proposed',
      };

      // Verify all required fields exist with correct types
      expect(assumption.system).toBe('SAP S/4HANA');
      expect(assumption.modules).toBeInstanceOf(Array);
      expect(assumption.modules).toHaveLength(3);
      expect(assumption.modules).toContain('MM');
      expect(assumption.modules).toContain('SD');
      expect(assumption.modules).toContain('PP');
      expect(assumption.integrations).toBeInstanceOf(Array);
      expect(assumption.integrations).toHaveLength(2);
      expect(assumption.integrations).toContain('Salesforce CRM sync');
      expect(assumption.source).toBe('ai-proposed');

      // Verify empty arrays are valid
      const minimalAssumption: SystemAssumption = {
        system: 'Custom System',
        modules: [],
        integrations: [],
        source: 'user-corrected',
      };

      expect(minimalAssumption.modules).toEqual([]);
      expect(minimalAssumption.integrations).toEqual([]);
    });
  });

  describe('AIGapFillingState interface', () => {
    it('should validate AIGapFillingState required fields and optional fields', () => {
      // Test default state creation
      const defaultState = createDefaultAIGapFillingState();

      // Verify all required fields exist
      expect(defaultState.conversationHistory).toBeInstanceOf(Array);
      expect(defaultState.conversationHistory).toEqual([]);
      expect(defaultState.confirmedAssumptions).toBeInstanceOf(Array);
      expect(defaultState.confirmedAssumptions).toEqual([]);
      expect(defaultState.assumptionsAccepted).toBe(false);
      expect(defaultState.isStreaming).toBe(false);

      // Verify optional fields are undefined by default
      expect(defaultState.step1InputHash).toBeUndefined();
      expect(defaultState.streamingError).toBeUndefined();

      // Test populated state with all fields
      const populatedState: AIGapFillingState = {
        conversationHistory: [
          {
            role: 'assistant',
            content: 'Based on your requirements, I propose the following assumptions.',
            timestamp: Date.now(),
            parsedAssumptions: [
              { system: 'SAP', modules: ['MM'], integrations: [], source: 'ai-proposed' },
            ],
          },
        ],
        confirmedAssumptions: [
          { system: 'SAP', modules: ['MM'], integrations: [], source: 'ai-proposed' },
        ],
        assumptionsAccepted: true,
        isStreaming: false,
        step1InputHash: 'abc123hash',
        streamingError: undefined,
      };

      expect(populatedState.conversationHistory).toHaveLength(1);
      expect(populatedState.confirmedAssumptions).toHaveLength(1);
      expect(populatedState.assumptionsAccepted).toBe(true);
      expect(populatedState.step1InputHash).toBe('abc123hash');

      // Test error state
      const errorState: AIGapFillingState = {
        conversationHistory: [],
        confirmedAssumptions: [],
        assumptionsAccepted: false,
        isStreaming: false,
        streamingError: 'Response interrupted. Try again?',
      };

      expect(errorState.streamingError).toBe('Response interrupted. Try again?');
    });
  });

  describe('AssumptionSource type', () => {
    it('should only allow valid source enum values (ai-proposed or user-corrected)', () => {
      // Test ai-proposed source
      const aiProposedAssumption: SystemAssumption = {
        system: 'Salesforce',
        modules: ['Sales Cloud'],
        integrations: [],
        source: 'ai-proposed',
      };
      expect(aiProposedAssumption.source).toBe('ai-proposed');

      // Test user-corrected source
      const userCorrectedAssumption: SystemAssumption = {
        system: 'SAP IBP',
        modules: ['Demand Planning'],
        integrations: ['S/4HANA integration'],
        source: 'user-corrected',
      };
      expect(userCorrectedAssumption.source).toBe('user-corrected');

      // Verify source can be assigned to type
      const validSources: AssumptionSource[] = ['ai-proposed', 'user-corrected'];
      expect(validSources).toContain(aiProposedAssumption.source);
      expect(validSources).toContain(userCorrectedAssumption.source);
      expect(validSources).toHaveLength(2);

      // TypeScript compilation ensures only valid values can be assigned
      // Invalid values like 'other' would cause a compile error
    });
  });

  describe('ConversationMessage interface', () => {
    it('should validate ConversationMessage structure for chat history', () => {
      // Test user message
      const userMessage: ConversationMessage = {
        role: 'user',
        content: 'Actually, we use SAP IBP instead of APO',
        timestamp: 1704067200000,
      };

      expect(userMessage.role).toBe('user');
      expect(userMessage.content).toBe('Actually, we use SAP IBP instead of APO');
      expect(userMessage.timestamp).toBe(1704067200000);
      expect(userMessage.parsedAssumptions).toBeUndefined();

      // Test assistant message with parsed assumptions
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: 'I understand. Let me update the assumptions to reflect SAP IBP.',
        timestamp: 1704067260000,
        parsedAssumptions: [
          {
            system: 'SAP IBP',
            modules: ['Demand Planning', 'Supply Planning'],
            integrations: ['S/4HANA synchronization'],
            source: 'user-corrected',
          },
        ],
      };

      expect(assistantMessage.role).toBe('assistant');
      expect(assistantMessage.content).toContain('SAP IBP');
      expect(assistantMessage.timestamp).toBe(1704067260000);
      expect(assistantMessage.parsedAssumptions).toBeDefined();
      expect(assistantMessage.parsedAssumptions).toHaveLength(1);
      expect(assistantMessage.parsedAssumptions?.[0].system).toBe('SAP IBP');
      expect(assistantMessage.parsedAssumptions?.[0].source).toBe('user-corrected');

      // Test role type constraints
      const validRoles: ConversationMessage['role'][] = ['user', 'assistant'];
      expect(validRoles).toContain(userMessage.role);
      expect(validRoles).toContain(assistantMessage.role);
    });
  });

  describe('WIZARD_COMMANDS for Step 2', () => {
    it('should define Step 2 AI gap-filling conversation commands', () => {
      // Verify Step 2 specific commands exist and follow naming pattern
      expect(WIZARD_COMMANDS.SEND_CHAT_MESSAGE).toBe('sendChatMessage');
      expect(WIZARD_COMMANDS.ACCEPT_ASSUMPTIONS).toBe('acceptAssumptions');
      expect(WIZARD_COMMANDS.REGENERATE_ASSUMPTIONS).toBe('regenerateAssumptions');
      expect(WIZARD_COMMANDS.RETRY_LAST_MESSAGE).toBe('retryLastMessage');

      // Verify commands follow existing camelCase naming pattern
      expect(WIZARD_COMMANDS.SEND_CHAT_MESSAGE).toMatch(/^[a-z][a-zA-Z]+$/);
      expect(WIZARD_COMMANDS.ACCEPT_ASSUMPTIONS).toMatch(/^[a-z][a-zA-Z]+$/);
      expect(WIZARD_COMMANDS.REGENERATE_ASSUMPTIONS).toMatch(/^[a-z][a-zA-Z]+$/);
      expect(WIZARD_COMMANDS.RETRY_LAST_MESSAGE).toMatch(/^[a-z][a-zA-Z]+$/);
    });
  });
});
