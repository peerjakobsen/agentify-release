/**
 * Wizard Panel Types
 * Types and interfaces for the Ideation Wizard panel functionality
 */

// ============================================================================
// Wizard State Persistence Types (Task Group 1)
// ============================================================================

/**
 * Schema version for persisted wizard state
 * Increment when making breaking changes to PersistedWizardState
 * Task 1.2: Version constant for compatibility checking
 */
export const WIZARD_STATE_SCHEMA_VERSION = 1;

/**
 * Metadata for a previously uploaded file
 * Task 1.3: Stores file metadata without binary data for persistence
 */
export interface PersistedFileMetadata {
  /** Original filename */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** Unix timestamp when file was uploaded (milliseconds) */
  uploadedAt: number;
  /** Always true - indicates file needs re-upload */
  requiresReupload: true;
}

/**
 * Persisted wizard state for storage
 * Task 1.4: Full persisted state structure
 */
export interface PersistedWizardState {
  // -------------------------------------------------------------------------
  // Metadata
  // -------------------------------------------------------------------------

  /** Schema version for compatibility checking */
  schemaVersion: number;
  /** Unix timestamp when state was saved (milliseconds) */
  savedAt: number;

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  /** Current step number (1-8) */
  currentStep: number;
  /** Highest step that has been visited */
  highestStepReached: number;
  /** Whether validation has been attempted */
  validationAttempted: boolean;

  // -------------------------------------------------------------------------
  // Step 1: Business Context
  // -------------------------------------------------------------------------

  /** Business objective/problem statement text */
  businessObjective: string;
  /** Selected industry vertical */
  industry: string;
  /** Custom industry text when "Other" is selected */
  customIndustry?: string;
  /** Array of selected system names */
  systems: string[];
  /** Custom systems text for additional systems */
  customSystems?: string;
  /** Metadata for previously uploaded file (binary data not persisted) */
  uploadedFileMetadata?: PersistedFileMetadata;

  // -------------------------------------------------------------------------
  // Step 2-8: State Objects
  // -------------------------------------------------------------------------

  /** AI gap-filling conversation state */
  aiGapFillingState: AIGapFillingState;
  /** Outcome definition state */
  outcome: OutcomeDefinitionState;
  /** Security and guardrails state */
  security: SecurityState;
  /** Agent design state */
  agentDesign: AgentDesignState;
  /** Mock data state */
  mockData: MockDataState;
  /** Demo strategy state */
  demoStrategy: DemoStrategyState;
  /** Generation state for Step 8 */
  generation?: GenerationState;
}

/**
 * Resume banner state for UI display
 * Task 4.2: Interface for resume banner visibility and data
 */
export interface ResumeBannerState {
  /** Whether the banner is visible */
  visible: boolean;
  /** Truncated business objective for preview */
  businessObjectivePreview: string;
  /** Step number reached in previous session */
  stepReached: number;
  /** Unix timestamp when state was last saved */
  savedAt: number;
  /** Whether the session is older than 7 days */
  isExpired: boolean;
  /** Whether the schema version doesn't match */
  isVersionMismatch: boolean;
}

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
// Step 2: AI Gap-Filling Conversation Types (Roadmap Item 15)
// ============================================================================

/**
 * Source of an assumption - either proposed by AI or corrected by user
 */
export type AssumptionSource = 'ai-proposed' | 'user-corrected';

/**
 * System assumption representing Claude's proposed or user-refined assumption
 * about a system's modules and integrations
 */
export interface SystemAssumption {
  /** System name (e.g., 'SAP S/4HANA') */
  system: string;
  /** Array of modules within the system (e.g., ['MM', 'SD', 'PP']) */
  modules: string[];
  /** Array of integration descriptions (e.g., ['Salesforce CRM sync']) */
  integrations: string[];
  /** Source of the assumption - 'ai-proposed' for initial, 'user-corrected' for refined */
  source: AssumptionSource;
}

/**
 * Chat message in the AI gap-filling conversation
 * Represents either a user message or assistant (Claude) response
 */
export interface ConversationMessage {
  /** Message role - 'user' for human input, 'assistant' for Claude response */
  role: 'user' | 'assistant';
  /** Message content text */
  content: string;
  /** Unix timestamp when message was created */
  timestamp: number;
  /** Parsed assumptions from assistant messages (if any) */
  parsedAssumptions?: SystemAssumption[];
}

/**
 * AI Gap-Filling state for Step 2
 * Tracks conversation history, confirmed assumptions, and streaming state
 */
export interface AIGapFillingState {
  /** Array of conversation messages between user and assistant */
  conversationHistory: ConversationMessage[];
  /** Array of confirmed/accepted assumptions */
  confirmedAssumptions: SystemAssumption[];
  /** Whether assumptions have been accepted by user */
  assumptionsAccepted: boolean;
  /** Whether Claude is currently streaming a response */
  isStreaming: boolean;
  /** Hash of Step 1 inputs for change detection */
  step1InputHash?: string;
  /** Error message from last streaming attempt (for retry UI) */
  streamingError?: string;
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
 * Expanded list includes all business function stakeholders
 */
export const STAKEHOLDER_OPTIONS: string[] = [
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

/**
 * AI-suggested outcome response format
 * Represents the JSON structure returned by Claude for outcome suggestions
 */
export interface OutcomeSuggestions {
  /** Primary outcome statement describing the business result */
  primaryOutcome: string;
  /** Array of suggested success metrics/KPIs (typically 3-5 items) */
  suggestedKPIs: SuccessMetric[];
  /** Array of suggested stakeholders (from STAKEHOLDER_OPTIONS plus custom AI suggestions) */
  stakeholders: string[];
}

/**
 * Tracking which sections have been refined via conversational refinement
 */
export interface RefinedSectionsState {
  /** Whether outcome was refined from original AI suggestion */
  outcome: boolean;
  /** Whether KPIs were refined from original AI suggestion */
  kpis: boolean;
  /** Whether stakeholders were refined from original AI suggestion */
  stakeholders: boolean;
}

/**
 * Outcome definition state for Step 3
 * Includes AI loading state, user edit tracking, and two-phase flow state
 */
export interface OutcomeDefinitionState {
  /** Primary outcome statement describing the business result */
  primaryOutcome: string;
  /** Array of success metrics/KPIs */
  successMetrics: SuccessMetric[];
  /** Selected stakeholders who benefit (from static list) */
  stakeholders: string[];
  /** Whether AI suggestions are currently loading */
  isLoading: boolean;
  /** Error message if AI suggestions failed to load */
  loadingError?: string;
  /** Whether user has edited the primary outcome field */
  primaryOutcomeEdited: boolean;
  /** Whether user has edited any success metrics */
  metricsEdited: boolean;
  /** Whether user has edited stakeholder selections */
  stakeholdersEdited: boolean;
  /** AI-suggested stakeholders outside the static STAKEHOLDER_OPTIONS list */
  customStakeholders: string[];
  /** Whether AI suggestions have been accepted (Phase 1 -> Phase 2 transition) */
  suggestionsAccepted: boolean;
  /** Hash of Step 2 confirmed assumptions for change detection */
  step2AssumptionsHash?: string;
  /** Tracking which sections have been refined via conversation */
  refinedSections: RefinedSectionsState;
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

// ============================================================================
// Step 5: Agent Design Proposal Types (Roadmap Item 18)
// ============================================================================

/**
 * Orchestration pattern type for agent workflows
 * - graph: Complex, conditional workflows with decision points
 * - swarm: Parallel, autonomous agents with emergent coordination
 * - workflow: Sequential, linear pipelines with defined steps
 */
export type OrchestrationPattern = 'graph' | 'swarm' | 'workflow';

/**
 * Proposed agent in the AI-generated agent team
 * Contains the agent's identity, role description, assigned tools, and edit tracking flags
 *
 * Task 1.2: Extended with edited flags to track user modifications
 * Following pattern from OutcomeDefinitionState edited flags
 */
export interface ProposedAgent {
  /** Lowercase agent identifier (e.g., 'planner', 'executor') used in flow notation */
  id: string;
  /** Display name for the agent (e.g., 'Planning Agent') */
  name: string;
  /** Description of the agent's role and responsibilities */
  role: string;
  /** Array of tools assigned to this agent in snake_case format (e.g., 'sap_get_inventory') */
  tools: string[];
  /** Whether user has edited the agent's name (prevents AI overwrite on regeneration) */
  nameEdited: boolean;
  /** Whether user has edited the agent's role (prevents AI overwrite on regeneration) */
  roleEdited: boolean;
  /** Whether user has edited the agent's tools (prevents AI overwrite on regeneration) */
  toolsEdited: boolean;
}

/**
 * Edge representing a relationship between two agents in the workflow
 * Used to define the execution flow between agents
 */
export interface ProposedEdge {
  /** Source agent ID (lowercase) */
  from: string;
  /** Target agent ID (lowercase) */
  to: string;
  /** Optional condition for conditional edges (e.g., 'requires_approval') */
  condition?: string;
}

/**
 * Edge suggestion from AI when orchestration pattern changes
 * Non-blocking suggestion card displayed below orchestration dropdown
 */
export interface EdgeSuggestion {
  /** Proposed edges for the new orchestration pattern */
  edges: ProposedEdge[];
  /** Whether the suggestion card is visible */
  visible: boolean;
}

/**
 * Agent design state for Step 5
 * Tracks AI-proposed agent team, orchestration pattern, and user acceptance
 *
 * Task 1.3: Extended with Phase 2 editing fields for confirmed state and edge suggestions
 */
export interface AgentDesignState {
  // -------------------------------------------------------------------------
  // AI Proposal Fields
  // -------------------------------------------------------------------------

  /** Array of proposed agents from AI */
  proposedAgents: ProposedAgent[];
  /** Orchestration pattern selected by AI ('graph', 'swarm', or 'workflow') */
  proposedOrchestration: OrchestrationPattern;
  /** Array of edges defining agent relationships */
  proposedEdges: ProposedEdge[];
  /** AI's reasoning for the selected orchestration pattern (2-3 sentences) */
  orchestrationReasoning: string;

  // -------------------------------------------------------------------------
  // Accept/Edit State
  // -------------------------------------------------------------------------

  /** Whether the user has accepted the proposal (Phase 1 -> Phase 2 transition) */
  proposalAccepted: boolean;
  /** Whether AI is currently generating a proposal */
  isLoading: boolean;
  /** Error message if AI proposal failed */
  error?: string;

  // -------------------------------------------------------------------------
  // Change Detection
  // -------------------------------------------------------------------------

  /** Hash of Steps 1-4 inputs for change detection */
  step4Hash?: string;
  /** Whether AI has been called for this step */
  aiCalled: boolean;

  // -------------------------------------------------------------------------
  // Phase 2: Confirmed State (for downstream consumption)
  // -------------------------------------------------------------------------

  /** Confirmed agents after user editing (copied from proposedAgents on confirm) */
  confirmedAgents: ProposedAgent[];
  /** Confirmed orchestration pattern (copied from proposedOrchestration on confirm) */
  confirmedOrchestration: OrchestrationPattern;
  /** Confirmed edges (copied from proposedEdges on confirm) */
  confirmedEdges: ProposedEdge[];

  // -------------------------------------------------------------------------
  // Phase 2: Orchestration Tracking
  // -------------------------------------------------------------------------

  /** Original orchestration pattern from AI suggestion (for "AI Suggested" badge) */
  originalOrchestration: OrchestrationPattern;
  /** AI-suggested edges when orchestration pattern changes (non-blocking) */
  edgeSuggestion?: EdgeSuggestion;
}

/**
 * AI response structure for agent design proposals
 * Represents the JSON structure returned by Claude
 */
export interface AgentProposalResponse {
  /** Array of proposed agents */
  agents: ProposedAgent[];
  /** Selected orchestration pattern */
  orchestrationPattern: OrchestrationPattern;
  /** Array of edges defining workflow */
  edges: ProposedEdge[];
  /** Reasoning for the selected pattern */
  reasoning: string;
}

// ============================================================================
// Step 6: Mock Data Strategy Types (Roadmap Item 21)
// ============================================================================

/**
 * Mock tool definition for a single tool's mock data configuration
 * Contains the tool identity, mock request/response schemas, and sample data
 *
 * Task 1.2: Interface with edited flags to track user modifications
 * Following pattern from ProposedAgent interface with edited flags
 */
export interface MockToolDefinition {
  /** Tool name in snake_case format (e.g., 'sap_get_inventory') */
  tool: string;
  /** System the tool belongs to (e.g., 'SAP S/4HANA') */
  system: string;
  /** Operation type (e.g., 'getInventory', 'queryAccounts') */
  operation: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** Mock request schema as JSON object */
  mockRequest: object;
  /** Mock response schema as JSON object */
  mockResponse: object;
  /** Sample data rows (max 5 rows) */
  sampleData: object[];
  /** Whether the accordion is expanded in UI */
  expanded: boolean;
  /** Whether user has edited the mock request (prevents AI overwrite on regeneration) */
  requestEdited: boolean;
  /** Whether user has edited the mock response (prevents AI overwrite on regeneration) */
  responseEdited: boolean;
  /** Whether user has edited the sample data (prevents AI overwrite on regeneration) */
  sampleDataEdited: boolean;
}

/**
 * Mock data state for Step 6
 * Tracks AI-generated mock definitions and user modifications
 *
 * Task 1.3: State interface following AgentDesignState pattern
 */
export interface MockDataState {
  /** Array of mock tool definitions from AI */
  mockDefinitions: MockToolDefinition[];
  /** Whether to use customer-specific terminology in sample data */
  useCustomerTerminology: boolean;
  /** Whether AI is currently generating mock definitions */
  isLoading: boolean;
  /** Error message if AI mock generation failed */
  error?: string;
  /** Hash of Step 5 confirmed agents for change detection */
  step5Hash?: string;
  /** Whether AI has been called for this step */
  aiCalled: boolean;
}

// ============================================================================
// Step 7: Demo Strategy Types (Roadmap Item 23)
// ============================================================================

/**
 * Aha moment - a key demonstration point tied to a specific agent or tool
 * Task 1.2: Represents impressive capabilities to highlight in the demo
 */
export interface AhaMoment {
  /** Unique identifier for the moment */
  id: string;
  /** Title describing what should impress the audience */
  title: string;
  /** Type of trigger - either an agent or a tool */
  triggerType: 'agent' | 'tool';
  /** Name of the agent or tool that triggers this moment */
  triggerName: string;
  /** Suggested talking point for the presenter */
  talkingPoint: string;
}

/**
 * Demo persona - a realistic user profile for the demo narrative
 * Task 1.2: Single persona to focus the demo story
 */
export interface DemoPersona {
  /** Persona name (e.g., "Maria, Regional Inventory Manager") */
  name: string;
  /** Role description (e.g., "Reviews morning replenishment recommendations for 12 stores") */
  role: string;
  /** Pain point the agent addresses (e.g., "Currently spends 2 hours manually checking stock levels") */
  painPoint: string;
}

/**
 * Narrative scene - a scene in the demo flow
 * Task 1.2: Ordered scene with agent highlighting
 */
export interface NarrativeScene {
  /** Unique identifier for the scene */
  id: string;
  /** Scene title (e.g., "Morning Check-In") */
  title: string;
  /** Scene description (max 500 characters) */
  description: string;
  /** Array of agent IDs highlighted in this scene */
  highlightedAgents: string[];
}

/**
 * Demo strategy state for Step 7
 * Task 1.2: Tracks aha moments, persona, narrative scenes, and generation state
 */
export interface DemoStrategyState {
  /** Array of aha moments (max 5) */
  ahaMoments: AhaMoment[];
  /** Demo persona (single) */
  persona: DemoPersona;
  /** Array of narrative scenes (max 8) */
  narrativeScenes: NarrativeScene[];
  /** Whether AI is generating aha moments */
  isGeneratingMoments: boolean;
  /** Whether AI is generating persona */
  isGeneratingPersona: boolean;
  /** Whether AI is generating narrative */
  isGeneratingNarrative: boolean;
  /** Whether user has edited aha moments */
  momentsEdited: boolean;
  /** Whether user has edited persona */
  personaEdited: boolean;
  /** Whether user has edited narrative */
  narrativeEdited: boolean;
}

// ============================================================================
// Step 8: Generation Types (Wizard Step 8 - Generate)
// ============================================================================

/**
 * Steering files to be generated
 * Task 1.4: Constant array of steering file names
 * Task 4.2: Updated to include all 8 files including agentify-integration.md
 */
/**
 * Steering files written to .kiro/steering/ directory
 * These files provide technical steering context for Kiro IDE
 */
export const STEERING_FILES: string[] = [
  'product.md',
  'tech.md',
  'structure.md',
  'customer-context.md',
  'integration-landscape.md',
  'security-policies.md',
  'agentify-integration.md',
];

/**
 * Files written to project root (human-facing documentation)
 * These are generated alongside steering files but placed at root level
 */
export const ROOT_DOC_FILES: Record<string, string> = {
  'demo-strategy.md': 'DEMO.md',
};

/**
 * Validation status for a step summary
 * Task 1.3: Status levels for pre-generation summary cards
 */
export type StepValidationStatus = 'complete' | 'warning' | 'error';

/**
 * Step summary for pre-generation display
 * Task 1.3: Interface for summary card data
 */
export interface StepSummary {
  /** Step number (1-7) */
  stepNumber: number;
  /** Step display name */
  stepName: string;
  /** Key-value pairs of summary data to display */
  summaryData: Record<string, string>;
  /** Validation status for the step */
  validationStatus: StepValidationStatus;
  /** Optional validation message to display */
  validationMessage?: string;
}

/**
 * Failed file information during generation
 * Task 1.2: Tracks which file failed and the error
 */
export interface FailedFile {
  /** File name that failed to generate */
  name: string;
  /** Error message from the failure */
  error: string;
}

/**
 * Generation state for Step 8
 * Task 1.2: Interface following MockDataState pattern
 * Task 2.6: Removed isPlaceholderMode - now using real generation
 * Phase 2: Extended with roadmap generation fields
 */
export interface GenerationState {
  // -------------------------------------------------------------------------
  // Phase 1: Steering File Generation
  // -------------------------------------------------------------------------

  /** Whether steering file generation is in progress */
  isGenerating: boolean;
  /** Current file index being generated (-1 if not started) */
  currentFileIndex: number;
  /** Array of completed file names */
  completedFiles: string[];
  /** Information about failed file (if any) */
  failedFile?: FailedFile;
  /** Array of generated file paths (full paths) */
  generatedFilePaths: string[];
  /** Whether the progress accordion is expanded */
  accordionExpanded: boolean;
  /** Whether generation can proceed (no 'error' validation status) */
  canGenerate: boolean;

  // -------------------------------------------------------------------------
  // Phase 2: Roadmap Generation
  // -------------------------------------------------------------------------

  /** Whether roadmap generation is in progress */
  roadmapGenerating: boolean;
  /** Whether roadmap has been successfully generated */
  roadmapGenerated: boolean;
  /** Path to the generated roadmap.md file */
  roadmapFilePath: string;
  /** Error message if roadmap generation failed */
  roadmapError?: string;
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

  /**
   * Metadata for previously uploaded file (from resumed session)
   * Task 1.6: Used by UI to show re-upload indicator
   */
  uploadedFileMetadata?: PersistedFileMetadata;

  // -------------------------------------------------------------------------
  // Step 2: AI Gap-Filling Conversation (Roadmap Item 15)
  // -------------------------------------------------------------------------

  /**
   * AI gap-filling conversation state
   * Contains conversation history, confirmed assumptions, and streaming state
   */
  aiGapFillingState: AIGapFillingState;

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
  // Step 5: Agent Design (Roadmap Item 18)
  // -------------------------------------------------------------------------

  /**
   * Agent design state
   * Contains proposed agents, orchestration pattern, and acceptance state
   */
  agentDesign: AgentDesignState;

  // -------------------------------------------------------------------------
  // Step 6: Mock Data Strategy (Roadmap Item 21)
  // -------------------------------------------------------------------------

  /**
   * Mock data state
   * Contains mock tool definitions and customer terminology settings
   */
  mockData: MockDataState;

  // -------------------------------------------------------------------------
  // Step 7: Demo Strategy (Roadmap Item 23)
  // -------------------------------------------------------------------------

  /**
   * Demo strategy state
   * Contains aha moments, persona, and narrative scenes
   */
  demoStrategy: DemoStrategyState;

  // -------------------------------------------------------------------------
  // Step 8: Generation (Wizard Step 8)
  // -------------------------------------------------------------------------

  /**
   * Generation state
   * Contains generation progress, completed files, and error state
   * Task 1.7: Added for Step 8 generation tracking
   */
  generation: GenerationState;

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
 *
 * Task 1.4: Extended with Phase 2 action commands for Step 5 Agent Design Editing
 * Task 1.5: Extended with Step 6 Mock Data Strategy commands
 * Task 5.2: Extended with Resume Banner commands
 * Task 1.6: Extended with Step 7 Demo Strategy commands
 * Task 1.5: Extended with Step 8 Generation commands
 * Phase 2: Extended with Roadmap Generation commands
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
  // Step 2: AI Gap-Filling Conversation commands
  /** Send a chat message in the gap-filling conversation */
  SEND_CHAT_MESSAGE: 'sendChatMessage',
  /** Accept all proposed assumptions from Claude */
  ACCEPT_ASSUMPTIONS: 'acceptAssumptions',
  /** Regenerate assumptions by resending context to Claude */
  REGENERATE_ASSUMPTIONS: 'regenerateAssumptions',
  /** Retry the last message after an error */
  RETRY_LAST_MESSAGE: 'retryLastMessage',
  // Step 3: Outcome Definition commands
  /** Update the primary outcome text */
  UPDATE_PRIMARY_OUTCOME: 'updatePrimaryOutcome',
  /** Add a new empty metric row */
  ADD_METRIC: 'addMetric',
  /** Remove a metric at specified index */
  REMOVE_METRIC: 'removeMetric',
  /** Update a metric field (name, targetValue, or unit) */
  UPDATE_METRIC: 'updateMetric',
  /** Toggle a stakeholder checkbox */
  TOGGLE_STAKEHOLDER: 'toggleStakeholder',
  /** Add a custom stakeholder from text input */
  ADD_CUSTOM_STAKEHOLDER: 'addCustomStakeholder',
  /** Regenerate all outcome suggestions from AI */
  REGENERATE_OUTCOME_SUGGESTIONS: 'regenerateOutcomeSuggestions',
  /** Dismiss the outcome loading error message */
  DISMISS_OUTCOME_ERROR: 'dismissOutcomeError',
  // Step 3: Outcome Refinement commands (Roadmap Item 16.5)
  /** Send a refinement message in the outcome conversation */
  SEND_OUTCOME_REFINEMENT: 'sendOutcomeRefinement',
  /** Accept AI suggestions and transition to Phase 2 */
  ACCEPT_OUTCOME_SUGGESTIONS: 'acceptOutcomeSuggestions',
  /** Reset outcome suggestions and return to Phase 1 */
  RESET_OUTCOME_SUGGESTIONS: 'resetOutcomeSuggestions',
  // Step 5: Agent Design commands (Roadmap Item 18)
  /** Regenerate agent design proposal */
  REGENERATE_AGENT_PROPOSAL: 'regenerateAgentProposal',
  /** Accept agent design proposal and navigate to Step 6 */
  ACCEPT_AGENT_PROPOSAL: 'acceptAgentProposal',
  /** Signal intent to adjust agent design (placeholder for Item 19) */
  ADJUST_AGENT_PROPOSAL: 'adjustAgentProposal',
  /** Toggle orchestration reasoning expand/collapse */
  TOGGLE_ORCHESTRATION_REASONING: 'toggleOrchestrationReasoning',
  // -------------------------------------------------------------------------
  // Step 5 Phase 2: Agent Design Editing commands (Roadmap Item 19)
  // Task 1.4: New commands for Phase 2 manual editing
  // -------------------------------------------------------------------------
  /** Accept suggestions and transition to Phase 2 (stays on Step 5 in editable mode) */
  ACCEPT_SUGGESTIONS_PHASE2: 'acceptSuggestionsPhase2',
  /** Accept proposal and continue directly to Step 6 (skip manual editing) */
  ACCEPT_AND_CONTINUE: 'acceptAndContinue',
  /** Update agent name field */
  UPDATE_AGENT_NAME: 'updateAgentName',
  /** Update agent role field */
  UPDATE_AGENT_ROLE: 'updateAgentRole',
  /** Add a tool to an agent */
  ADD_AGENT_TOOL: 'addAgentTool',
  /** Remove a tool from an agent */
  REMOVE_AGENT_TOOL: 'removeAgentTool',
  /** Add a new empty agent card */
  ADD_AGENT: 'addAgent',
  /** Remove an agent (and its associated edges) */
  REMOVE_AGENT: 'removeAgent',
  /** Update orchestration pattern selection */
  UPDATE_ORCHESTRATION: 'updateOrchestration',
  /** Add a new edge row */
  ADD_EDGE: 'addEdge',
  /** Remove an edge at specified index */
  REMOVE_EDGE: 'removeEdge',
  /** Update an edge's from or to field */
  UPDATE_EDGE: 'updateEdge',
  /** Apply AI-suggested edges from edge suggestion card */
  APPLY_EDGE_SUGGESTION: 'applyEdgeSuggestion',
  /** Dismiss edge suggestion card */
  DISMISS_EDGE_SUGGESTION: 'dismissEdgeSuggestion',
  /** Confirm design and navigate to Step 6 */
  CONFIRM_DESIGN: 'confirmDesign',
  // -------------------------------------------------------------------------
  // Step 6: Mock Data Strategy commands (Roadmap Item 21)
  // Task 1.5: Commands for mock data editing and management
  // -------------------------------------------------------------------------
  /** Update mock request JSON for a tool */
  STEP6_UPDATE_REQUEST: 'step6UpdateRequest',
  /** Update mock response JSON for a tool */
  STEP6_UPDATE_RESPONSE: 'step6UpdateResponse',
  /** Add a new sample data row to a tool */
  STEP6_ADD_ROW: 'step6AddRow',
  /** Update a sample data row for a tool */
  STEP6_UPDATE_ROW: 'step6UpdateRow',
  /** Delete a sample data row from a tool */
  STEP6_DELETE_ROW: 'step6DeleteRow',
  /** Toggle accordion expand/collapse for a tool */
  STEP6_TOGGLE_ACCORDION: 'step6ToggleAccordion',
  /** Regenerate all mock definitions from AI */
  STEP6_REGENERATE_ALL: 'step6RegenerateAll',
  /** Import sample data from CSV/JSON file */
  STEP6_IMPORT_DATA: 'step6ImportData',
  /** Toggle customer terminology setting */
  STEP6_TOGGLE_TERMINOLOGY: 'step6ToggleTerminology',
  // -------------------------------------------------------------------------
  // Step 7: Demo Strategy commands (Roadmap Item 23)
  // Task 1.6: Commands for demo strategy management
  // -------------------------------------------------------------------------
  /** Add a new aha moment */
  STEP7_ADD_MOMENT: 'step7AddMoment',
  /** Update an existing aha moment */
  STEP7_UPDATE_MOMENT: 'step7UpdateMoment',
  /** Remove an aha moment */
  STEP7_REMOVE_MOMENT: 'step7RemoveMoment',
  /** Update persona name */
  STEP7_UPDATE_PERSONA_NAME: 'step7UpdatePersonaName',
  /** Update persona role */
  STEP7_UPDATE_PERSONA_ROLE: 'step7UpdatePersonaRole',
  /** Update persona pain point */
  STEP7_UPDATE_PERSONA_PAIN_POINT: 'step7UpdatePersonaPainPoint',
  /** Add a new narrative scene */
  STEP7_ADD_SCENE: 'step7AddScene',
  /** Update an existing narrative scene */
  STEP7_UPDATE_SCENE: 'step7UpdateScene',
  /** Remove a narrative scene */
  STEP7_REMOVE_SCENE: 'step7RemoveScene',
  /** Move a scene up in the order */
  STEP7_MOVE_SCENE_UP: 'step7MoveSceneUp',
  /** Move a scene down in the order */
  STEP7_MOVE_SCENE_DOWN: 'step7MoveSceneDown',
  /** Generate aha moments via AI */
  STEP7_GENERATE_MOMENTS: 'step7GenerateMoments',
  /** Generate persona via AI */
  STEP7_GENERATE_PERSONA: 'step7GeneratePersona',
  /** Generate narrative via AI */
  STEP7_GENERATE_NARRATIVE: 'step7GenerateNarrative',
  /** Generate all sections via AI sequentially */
  STEP7_GENERATE_ALL: 'step7GenerateAll',
  // -------------------------------------------------------------------------
  // Step 8: Generation commands (Wizard Step 8)
  // Task 1.5: Commands for steering file generation
  // -------------------------------------------------------------------------
  /** Generate steering files */
  STEP8_GENERATE: 'step8Generate',
  /** Generate steering files and open in Kiro */
  STEP8_GENERATE_AND_OPEN_KIRO: 'step8GenerateAndOpenKiro',
  /** Start over (reset wizard) */
  STEP8_START_OVER: 'step8StartOver',
  /** Open a generated file */
  STEP8_OPEN_FILE: 'step8OpenFile',
  /** Retry generation from failed file */
  STEP8_RETRY: 'step8Retry',
  /** Toggle progress accordion */
  STEP8_TOGGLE_ACCORDION: 'step8ToggleAccordion',
  /** Edit a specific step from summary */
  STEP8_EDIT_STEP: 'step8EditStep',
  // -------------------------------------------------------------------------
  // Step 8 Phase 2: Roadmap Generation commands
  // -------------------------------------------------------------------------
  /** Generate roadmap.md from steering files */
  GENERATE_ROADMAP: 'generateRoadmap',
  /** Open the generated roadmap.md file */
  OPEN_ROADMAP: 'openRoadmap',
  /** Open the .kiro/steering folder in explorer */
  OPEN_KIRO_FOLDER: 'openKiroFolder',
  // -------------------------------------------------------------------------
  // Resume Banner commands (Task 5.2)
  // -------------------------------------------------------------------------
  /** Resume previous session from persisted state */
  RESUME_SESSION: 'resumeSession',
  /** Start fresh by clearing persisted state */
  START_FRESH: 'startFresh',
  /** Dismiss the resume banner without action */
  DISMISS_RESUME_BANNER: 'dismissResumeBanner',
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
 * Creates default AI gap-filling state
 * Used to initialize or reset Step 2 state
 */
export function createDefaultAIGapFillingState(): AIGapFillingState {
  return {
    conversationHistory: [],
    confirmedAssumptions: [],
    assumptionsAccepted: false,
    isStreaming: false,
    step1InputHash: undefined,
    streamingError: undefined,
  };
}

/**
 * Creates default outcome definition state
 * Used to initialize or reset Step 3 state
 */
export function createDefaultOutcomeDefinitionState(): OutcomeDefinitionState {
  return {
    primaryOutcome: '',
    successMetrics: [],
    stakeholders: [],
    isLoading: false,
    loadingError: undefined,
    primaryOutcomeEdited: false,
    metricsEdited: false,
    stakeholdersEdited: false,
    customStakeholders: [],
    suggestionsAccepted: false,
    step2AssumptionsHash: undefined,
    refinedSections: {
      outcome: false,
      kpis: false,
      stakeholders: false,
    },
  };
}

/**
 * Creates default agent design state
 * Used to initialize or reset Step 5 state
 *
 * Task 1.5: Updated to include Phase 2 fields with defaults
 */
export function createDefaultAgentDesignState(): AgentDesignState {
  return {
    // AI Proposal - empty until AI generates
    proposedAgents: [],
    proposedOrchestration: 'workflow',
    proposedEdges: [],
    orchestrationReasoning: '',
    // Accept/Edit State
    proposalAccepted: false,
    isLoading: false,
    error: undefined,
    // Change Detection
    step4Hash: undefined,
    aiCalled: false,
    // Phase 2: Confirmed State - empty until user confirms
    confirmedAgents: [],
    confirmedOrchestration: 'workflow',
    confirmedEdges: [],
    // Phase 2: Orchestration Tracking
    originalOrchestration: 'workflow',
    edgeSuggestion: undefined,
  };
}

/**
 * Creates default mock data state
 * Used to initialize or reset Step 6 state
 *
 * Task 1.4: Factory function following createDefaultAgentDesignState() pattern
 */
export function createDefaultMockDataState(): MockDataState {
  return {
    // Mock definitions - empty until AI generates
    mockDefinitions: [],
    // Customer terminology setting
    useCustomerTerminology: false,
    // Loading state
    isLoading: false,
    error: undefined,
    // Change detection
    step5Hash: undefined,
    aiCalled: false,
  };
}

/**
 * Creates default demo strategy state
 * Used to initialize or reset Step 7 state
 *
 * Task 1.3: Factory function following createDefaultMockDataState() pattern
 */
export function createDefaultDemoStrategyState(): DemoStrategyState {
  return {
    // Aha moments - empty until user adds or AI generates
    ahaMoments: [],
    // Persona - empty until user adds or AI generates
    persona: {
      name: '',
      role: '',
      painPoint: '',
    },
    // Narrative scenes - empty until user adds or AI generates
    narrativeScenes: [],
    // Loading flags - all false by default
    isGeneratingMoments: false,
    isGeneratingPersona: false,
    isGeneratingNarrative: false,
    // Edited flags - all false by default
    momentsEdited: false,
    personaEdited: false,
    narrativeEdited: false,
  };
}

/**
 * Creates default generation state
 * Used to initialize or reset Step 8 state
 *
 * Task 1.6: Factory function following createDefaultMockDataState() pattern
 * Task 2.6: Removed isPlaceholderMode - now using real generation
 * Phase 2: Extended with roadmap generation defaults
 */
export function createDefaultGenerationState(): GenerationState {
  return {
    // Phase 1: Generation progress
    isGenerating: false,
    currentFileIndex: -1,
    completedFiles: [],
    failedFile: undefined,
    generatedFilePaths: [],
    // UI state
    accordionExpanded: false,
    // Validation
    canGenerate: true,
    // Phase 2: Roadmap generation
    roadmapGenerating: false,
    roadmapGenerated: false,
    roadmapFilePath: '',
    roadmapError: undefined,
  };
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
    uploadedFileMetadata: undefined,
    // Step 2: AI Gap-Filling Conversation
    aiGapFillingState: createDefaultAIGapFillingState(),
    // Step 3: Outcome Definition
    outcome: createDefaultOutcomeDefinitionState(),
    // Step 4: Security & Guardrails
    security: {
      dataSensitivity: 'internal',
      complianceFrameworks: [],
      approvalGates: [],
      guardrailNotes: '',
      skipped: false,
    },
    // Step 5: Agent Design
    agentDesign: createDefaultAgentDesignState(),
    // Step 6: Mock Data Strategy
    mockData: createDefaultMockDataState(),
    // Step 7: Demo Strategy
    demoStrategy: createDefaultDemoStrategyState(),
    // Step 8: Generation
    generation: createDefaultGenerationState(),
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

// ============================================================================
// State Conversion Functions (Task Group 1)
// ============================================================================

/**
 * Maximum number of messages to keep in conversation history when persisting
 * Task 3.2: Limit to prevent state file bloat
 */
export const MAX_CONVERSATION_HISTORY = 10;

/**
 * Truncate conversation history to a maximum number of messages
 * Task 3.2: Keeps most recent messages (from end)
 *
 * @param messages Array of conversation messages
 * @param limit Maximum number of messages to keep (default 10)
 * @returns Truncated messages array
 */
export function truncateConversationHistory(
  messages: ConversationMessage[],
  limit: number = MAX_CONVERSATION_HISTORY
): ConversationMessage[] {
  if (messages.length <= limit) {
    return messages;
  }
  return messages.slice(-limit);
}

/**
 * Apply conversation truncation to all conversation arrays in wizard state
 * Task 3.3: Called before serialization
 *
 * @param state Wizard state with conversation histories
 * @param limit Maximum messages per conversation
 * @returns State with truncated conversations
 */
export function applyConversationTruncation(
  state: WizardState,
  limit: number = MAX_CONVERSATION_HISTORY
): WizardState {
  return {
    ...state,
    aiGapFillingState: {
      ...state.aiGapFillingState,
      conversationHistory: truncateConversationHistory(
        state.aiGapFillingState.conversationHistory,
        limit
      ),
    },
  };
}

/**
 * Convert WizardState to PersistedWizardState for storage
 * Task 1.5: Extracts all persisted fields, handles file metadata
 * Task 7.6: Includes generation state
 *
 * @param state Current wizard state
 * @returns Persisted state ready for JSON serialization
 */
export function wizardStateToPersistedState(state: WizardState): PersistedWizardState {
  // Apply conversation truncation before persisting
  const truncatedState = applyConversationTruncation(state);

  // Handle uploaded file - store metadata only, not binary data
  let uploadedFileMetadata: PersistedFileMetadata | undefined;
  if (truncatedState.uploadedFile) {
    uploadedFileMetadata = {
      fileName: truncatedState.uploadedFile.name,
      fileSize: truncatedState.uploadedFile.size,
      uploadedAt: Date.now(),
      requiresReupload: true,
    };
  } else if (truncatedState.uploadedFileMetadata) {
    // Preserve existing metadata if no new file
    uploadedFileMetadata = truncatedState.uploadedFileMetadata;
  }

  return {
    // Metadata
    schemaVersion: WIZARD_STATE_SCHEMA_VERSION,
    savedAt: Date.now(),

    // Navigation
    currentStep: truncatedState.currentStep,
    highestStepReached: truncatedState.highestStepReached,
    validationAttempted: truncatedState.validationAttempted,

    // Step 1: Business Context
    businessObjective: truncatedState.businessObjective,
    industry: truncatedState.industry,
    customIndustry: truncatedState.customIndustry,
    systems: truncatedState.systems,
    customSystems: truncatedState.customSystems,
    uploadedFileMetadata,

    // Step 2-8: State Objects
    aiGapFillingState: truncatedState.aiGapFillingState,
    outcome: truncatedState.outcome,
    security: truncatedState.security,
    agentDesign: truncatedState.agentDesign,
    mockData: truncatedState.mockData,
    demoStrategy: truncatedState.demoStrategy,
    // Task 7.6: Include generation state (with isGenerating always false on restore)
    generation: {
      ...truncatedState.generation,
      isGenerating: false, // Cannot resume mid-generation
      roadmapGenerating: false, // Cannot resume mid-generation
    },
  };
}

/**
 * Convert PersistedWizardState back to WizardState
 * Task 1.7: Restores state, sets uploadedFile to undefined
 * Task 7.6: Restores generation state with isGenerating = false
 *
 * @param persisted Previously saved state
 * @returns Full wizard state with file metadata preserved
 */
export function persistedStateToWizardState(persisted: PersistedWizardState): WizardState {
  return {
    // Navigation
    currentStep: persisted.currentStep,
    highestStepReached: persisted.highestStepReached,
    validationAttempted: persisted.validationAttempted,

    // Step 1: Business Context
    businessObjective: persisted.businessObjective,
    industry: persisted.industry,
    customIndustry: persisted.customIndustry,
    systems: persisted.systems,
    customSystems: persisted.customSystems,
    uploadedFile: undefined, // Binary data not persisted
    uploadedFileMetadata: persisted.uploadedFileMetadata, // Preserve for UI display

    // Step 2-8: State Objects
    aiGapFillingState: persisted.aiGapFillingState,
    outcome: persisted.outcome,
    security: persisted.security,
    agentDesign: persisted.agentDesign,
    mockData: persisted.mockData,
    demoStrategy: persisted.demoStrategy ?? createDefaultDemoStrategyState(),
    // Task 7.6: Restore generation state with isGenerating = false
    generation: persisted.generation
      ? {
          ...persisted.generation,
          isGenerating: false, // Cannot resume mid-generation
          roadmapGenerating: false, // Cannot resume mid-generation
          // Ensure roadmap fields exist even if persisted state is old
          roadmapGenerated: (persisted.generation as GenerationState).roadmapGenerated ?? false,
          roadmapFilePath: (persisted.generation as GenerationState).roadmapFilePath ?? '',
          roadmapError: (persisted.generation as GenerationState).roadmapError,
        }
      : createDefaultGenerationState(),
  };
}
