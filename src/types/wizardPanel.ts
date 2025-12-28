/**
 * Wizard Panel Types
 * Types and interfaces for the Ideation Wizard panel functionality
 */

/**
 * Enum representing the wizard steps
 * Each step corresponds to a distinct phase in the agent ideation workflow
 * Order matches roadmap items 13-23
 */
export enum WizardStep {
  /** Step 1: Capture business context and requirements (Roadmap Item 13) */
  BusinessContext = 1,
  /** Step 2: AI-assisted gap filling and clarification (Roadmap Item 15) */
  AIGapFilling = 2,
  /** Step 3: Define measurable business outcomes (Roadmap Item 16) */
  OutcomeDefinition = 3,
  /** Step 4: Security and compliance configuration (Roadmap Item 17) - Optional */
  Security = 4,
  /** Step 5: Design agent architecture and workflows (Roadmap Items 18-20) */
  AgentDesign = 5,
  /** Step 6: Generate mock data for testing (Roadmap Item 21) */
  MockData = 6,
  /** Step 7: Define demo strategy and scenarios (Roadmap Item 23) */
  DemoStrategy = 7,
  /** Step 8: Generate final agent workflow */
  Generate = 8,
}

/**
 * Step configuration for display purposes
 */
export interface WizardStepConfig {
  /** Step number (1-6) */
  step: WizardStep;
  /** Display label for the step */
  label: string;
  /** Short description of the step */
  description: string;
}

/**
 * Wizard steps configuration array with labels for display
 * Order matches the WizardStep enum values and roadmap items 13-23
 */
export const WIZARD_STEPS: WizardStepConfig[] = [
  {
    step: WizardStep.BusinessContext,
    label: 'Business Context',
    description: 'Define your business objective and context',
  },
  {
    step: WizardStep.AIGapFilling,
    label: 'AI Gap Filling',
    description: 'AI-assisted clarification and gap filling',
  },
  {
    step: WizardStep.OutcomeDefinition,
    label: 'Outcomes',
    description: 'Define measurable business outcomes and KPIs',
  },
  {
    step: WizardStep.Security,
    label: 'Security',
    description: 'Configure compliance and approval gates',
  },
  {
    step: WizardStep.AgentDesign,
    label: 'Agent Design',
    description: 'Design agent architecture and workflows',
  },
  {
    step: WizardStep.MockData,
    label: 'Mock Data',
    description: 'Generate mock data for testing',
  },
  {
    step: WizardStep.DemoStrategy,
    label: 'Demo Strategy',
    description: 'Define demo strategy and scenarios',
  },
  {
    step: WizardStep.Generate,
    label: 'Generate',
    description: 'Generate final agent workflow',
  },
];

/**
 * Industry vertical options for the dropdown
 */
export const INDUSTRY_OPTIONS: string[] = [
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

/**
 * System category with associated systems
 */
export interface SystemCategory {
  /** Category name (e.g., 'CRM', 'ERP') */
  category: string;
  /** List of systems in this category */
  systems: string[];
}

/**
 * System options grouped by category
 */
export const SYSTEM_OPTIONS: SystemCategory[] = [
  {
    category: 'CRM',
    systems: ['Salesforce', 'HubSpot', 'Dynamics'],
  },
  {
    category: 'ERP',
    systems: ['SAP S/4HANA', 'Oracle', 'NetSuite'],
  },
  {
    category: 'Data',
    systems: ['Databricks', 'Snowflake', 'Redshift'],
  },
  {
    category: 'HR',
    systems: ['Workday', 'SuccessFactors'],
  },
  {
    category: 'Service',
    systems: ['ServiceNow', 'Zendesk'],
  },
];

/**
 * Uploaded file metadata and content
 */
export interface UploadedFile {
  /** Original filename */
  name: string;
  /** File size in bytes */
  size: number;
  /** File content as Uint8Array */
  data: Uint8Array;
}

// ============================================================================
// Step 3: Outcome Definition Types (Roadmap Item 16)
// ============================================================================

/**
 * Success metric definition
 * Represents a measurable KPI for the demo
 */
export interface SuccessMetric {
  /** Metric name (e.g., "Order accuracy") */
  name: string;
  /** Target value (e.g., "95") */
  targetValue: string;
  /** Unit of measurement (e.g., "%", "hours", "count") */
  unit: string;
}

/**
 * Stakeholder options for outcome definition
 */
export const STAKEHOLDER_OPTIONS: string[] = [
  'Operations',
  'Finance',
  'Supply Chain',
  'Customer Service',
  'Executive',
];

/**
 * Outcome definition state for Step 3
 */
export interface OutcomeDefinitionState {
  /** Primary outcome statement describing the business result */
  primaryOutcome: string;
  /** Array of success metrics/KPIs */
  successMetrics: SuccessMetric[];
  /** Selected stakeholders who benefit */
  stakeholders: string[];
}

// ============================================================================
// Step 4: Security & Guardrails Types (Roadmap Item 17)
// ============================================================================

/**
 * Data sensitivity classification levels
 */
export type DataSensitivity = 'public' | 'internal' | 'confidential' | 'restricted';

/**
 * Data sensitivity options with descriptions
 */
export const DATA_SENSITIVITY_OPTIONS: Array<{ value: DataSensitivity; label: string; description: string }> = [
  { value: 'public', label: 'Public', description: 'Data that can be freely shared' },
  { value: 'internal', label: 'Internal', description: 'Data for internal use only' },
  { value: 'confidential', label: 'Confidential', description: 'Sensitive business data' },
  { value: 'restricted', label: 'Restricted', description: 'Highly sensitive, regulated data' },
];

/**
 * Compliance framework options
 */
export const COMPLIANCE_FRAMEWORKS: string[] = [
  'SOC 2',
  'HIPAA',
  'PCI-DSS',
  'GDPR',
  'FedRAMP',
];

/**
 * Human approval gate options
 */
export const APPROVAL_GATE_OPTIONS: string[] = [
  'Before external API calls',
  'Before data modification',
  'Before sending recommendations',
  'Before financial transactions',
];

/**
 * Industry-specific compliance defaults
 */
export const INDUSTRY_COMPLIANCE_DEFAULTS: Record<string, string[]> = {
  'Healthcare': ['HIPAA'],
  'Life Sciences': ['HIPAA'],
  'FSI': ['PCI-DSS', 'SOC 2'],
  'Public Sector': ['FedRAMP'],
};

/**
 * Security and guardrails state for Step 4
 */
export interface SecurityState {
  /** Data sensitivity classification */
  dataSensitivity: DataSensitivity;
  /** Selected compliance frameworks */
  complianceFrameworks: string[];
  /** Selected human approval gates */
  approvalGates: string[];
  /** Optional guardrail notes/constraints */
  guardrailNotes: string;
  /** Whether this step was skipped */
  skipped: boolean;
}

/**
 * Wizard state interface
 * Holds all form data and navigation state for the ideation wizard
 */
export interface WizardState {
  /**
   * Current step number (1-8)
   * @default 1
   */
  currentStep: number;

  // -------------------------------------------------------------------------
  // Step 1: Business Context
  // -------------------------------------------------------------------------

  /**
   * Business objective/problem statement text
   * Required field for Step 1
   */
  businessObjective: string;

  /**
   * Selected industry vertical
   * Required field for Step 1
   */
  industry: string;

  /**
   * Custom industry text when "Other" is selected
   * Optional, only used when industry === 'Other'
   */
  customIndustry?: string;

  /**
   * Array of selected system names
   * Optional field with soft warning if empty
   */
  systems: string[];

  /**
   * Custom systems text for additional systems not in the list
   * Optional field
   */
  customSystems?: string;

  /**
   * Uploaded file metadata and content
   * Optional field for additional context
   */
  uploadedFile?: UploadedFile;

  // -------------------------------------------------------------------------
  // Step 3: Outcome Definition (Roadmap Item 16)
  // -------------------------------------------------------------------------

  /**
   * Outcome definition state
   * Contains primary outcome, success metrics, and stakeholders
   */
  outcome: OutcomeDefinitionState;

  // -------------------------------------------------------------------------
  // Step 4: Security & Guardrails (Roadmap Item 17)
  // -------------------------------------------------------------------------

  /**
   * Security and guardrails state
   * Contains data sensitivity, compliance, approval gates, and notes
   */
  security: SecurityState;

  // -------------------------------------------------------------------------
  // Navigation State
  // -------------------------------------------------------------------------

  /**
   * Highest step that has been visited/completed
   * Used to determine which steps can be navigated to directly
   * @default 1
   */
  highestStepReached: number;

  /**
   * Whether validation has been attempted (for showing errors)
   * @default false
   */
  validationAttempted: boolean;
}

/**
 * Type of validation error field
 */
export type WizardValidationErrorType =
  | 'businessObjective'
  | 'industry'
  | 'systems'
  | 'file'
  | 'primaryOutcome'
  | 'successMetrics';

/**
 * Severity level for validation errors
 */
export type WizardValidationSeverity = 'error' | 'warning';

/**
 * Validation error for wizard form fields
 */
export interface WizardValidationError {
  /**
   * Field that has the validation error
   */
  type: WizardValidationErrorType;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Severity level - 'error' blocks navigation, 'warning' does not
   */
  severity: WizardValidationSeverity;
}

/**
 * Combined validation state for the wizard
 */
export interface WizardValidationState {
  /**
   * Whether all required validations passed (no blocking errors)
   */
  isValid: boolean;

  /**
   * Array of validation errors and warnings
   */
  errors: WizardValidationError[];

  /**
   * Whether there are any warnings present
   */
  hasWarnings: boolean;
}

/**
 * Message commands for webview-extension communication
 * Ensures type-safe message handling
 */
export const WIZARD_COMMANDS = {
  /** Navigate to next step */
  NEXT_STEP: 'nextStep',
  /** Navigate to previous step */
  PREVIOUS_STEP: 'previousStep',
  /** Navigate to specific step */
  GO_TO_STEP: 'goToStep',
  /** Update business objective text */
  UPDATE_BUSINESS_OBJECTIVE: 'updateBusinessObjective',
  /** Update industry selection */
  UPDATE_INDUSTRY: 'updateIndustry',
  /** Update custom industry text */
  UPDATE_CUSTOM_INDUSTRY: 'updateCustomIndustry',
  /** Toggle system checkbox */
  TOGGLE_SYSTEM: 'toggleSystem',
  /** Update custom systems text */
  UPDATE_CUSTOM_SYSTEMS: 'updateCustomSystems',
  /** Upload a file */
  UPLOAD_FILE: 'uploadFile',
  /** Remove uploaded file */
  REMOVE_FILE: 'removeFile',
  /** Sync state to webview */
  SYNC_STATE: 'syncState',
} as const;

/**
 * Type for wizard command values
 */
export type WizardCommand = (typeof WIZARD_COMMANDS)[keyof typeof WIZARD_COMMANDS];

/**
 * Message sent from webview to extension
 */
export interface WizardMessage {
  command: WizardCommand;
  [key: string]: unknown;
}

/**
 * State synchronization message sent to webview
 */
export interface WizardStateSyncMessage {
  type: 'stateSync';
  state: WizardState;
  validation: WizardValidationState;
  steps: WizardStepConfig[];
}

/**
 * Default wizard state factory
 * Creates a fresh WizardState with default values
 */
export function createDefaultWizardState(): WizardState {
  return {
    currentStep: 1,
    // Step 1: Business Context
    businessObjective: '',
    industry: '',
    customIndustry: undefined,
    systems: [],
    customSystems: undefined,
    uploadedFile: undefined,
    // Step 3: Outcome Definition
    outcome: {
      primaryOutcome: '',
      successMetrics: [],
      stakeholders: [],
    },
    // Step 4: Security & Guardrails
    security: {
      dataSensitivity: 'internal',
      complianceFrameworks: [],
      approvalGates: [],
      guardrailNotes: '',
      skipped: false,
    },
    // Navigation
    highestStepReached: 1,
    validationAttempted: false,
  };
}

/**
 * File upload constraints
 */
export const FILE_UPLOAD_CONSTRAINTS = {
  /** Maximum file size in bytes (5MB) */
  MAX_SIZE_BYTES: 5 * 1024 * 1024,
  /** Maximum file size for display */
  MAX_SIZE_DISPLAY: '5MB',
  /** Accepted file extensions */
  ACCEPTED_EXTENSIONS: ['.pdf', '.docx', '.txt', '.md'],
  /** Accepted MIME types */
  ACCEPTED_MIME_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
  ],
} as const;
