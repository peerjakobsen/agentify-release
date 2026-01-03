/**
 * Steering State Mapper Utility Module
 *
 * Transforms WizardState sections into context objects for steering document prompts.
 * Each mapper function extracts and transforms the relevant state sections for a specific
 * steering document, handling fallback scenarios when optional sections are missing.
 *
 * @see spec.md - State Mapping via Utility Module
 * @see tasks.md - Task Group 1: State Mapper Utility Module
 */

import type {
  WizardState,
  OutcomeDefinitionState,
  SecurityState,
  AgentDesignState,
  MockDataState,
  DemoStrategyState,
  AIGapFillingState,
  ProposedAgent,
  SystemAssumption,
  SuccessMetric,
  AhaMoment,
  DemoPersona,
  NarrativeScene,
  MockToolDefinition,
  ProposedEdge,
  OrchestrationPattern,
} from '../types/wizardPanel';

// ============================================================================
// Context Interfaces
// ============================================================================

/**
 * Context for product-steering.prompt.md
 * Captures business vision, objectives, and success criteria
 */
export interface ProductContext {
  businessObjective: string;
  industry: string;
  outcomes: {
    primaryOutcome: string;
    successMetrics: SuccessMetric[];
    stakeholders: string[];
  };
}

/**
 * Context for tech-steering.prompt.md
 * Captures agent architecture, orchestration patterns, and security policies
 */
export interface TechContext {
  agentDesign: {
    confirmedAgents: ProposedAgent[];
    confirmedOrchestration: OrchestrationPattern;
    confirmedEdges: ProposedEdge[];
  };
  security: {
    dataSensitivity: string;
    complianceFrameworks: string[];
    approvalGates: string[];
    guardrailNotes: string;
  };
}

/**
 * Context for structure-steering.prompt.md
 * Captures project folder layout and file organization
 */
export interface StructureContext {
  agentDesign: {
    confirmedAgents: ProposedAgent[];
  };
  mockData: {
    mockDefinitions: MockToolDefinition[];
  };
}

/**
 * Context for customer-context-steering.prompt.md
 * Captures enterprise landscape and integration patterns
 */
export interface CustomerContext {
  industry: string;
  systems: string[];
  gapFilling: {
    confirmedAssumptions: SystemAssumption[];
  };
}

/**
 * Shared tool analysis result for integration context
 */
export interface SharedToolInfo {
  toolName: string;
  system: string;
  usedByAgents: string[];
}

/**
 * Per-agent exclusive tools
 */
export interface PerAgentToolInfo {
  agentId: string;
  agentName: string;
  tools: string[];
}

/**
 * Context for integration-landscape-steering.prompt.md
 * Captures connected systems, shared tools, and data flow patterns
 */
export interface IntegrationContext {
  systems: string[];
  agentDesign: {
    confirmedAgents: ProposedAgent[];
  };
  mockData: {
    mockDefinitions: MockToolDefinition[];
  };
  sharedTools: string[];
  perAgentTools: PerAgentToolInfo[];
}

/**
 * Context for security-policies-steering.prompt.md
 * Captures data classification, compliance, and guardrails
 */
export interface SecurityContext {
  security: {
    dataSensitivity: string;
    complianceFrameworks: string[];
    approvalGates: string[];
    guardrailNotes: string;
    skipped: boolean;
  };
}

/**
 * Context for demo-strategy-steering.prompt.md
 * Captures demo persona, aha moments, and narrative flow
 */
export interface DemoContext {
  demoStrategy: {
    ahaMoments: AhaMoment[];
    persona: DemoPersona;
    narrativeScenes: NarrativeScene[];
  };
  industry: string;
  agentDesign: {
    confirmedAgents: Array<{
      id: string;
      name: string;
    }>;
  };
}

/**
 * Context for agentify-integration-steering.prompt.md
 * Captures observability contract and event emission patterns
 */
export interface AgentifyContext {
  agentDesign: {
    confirmedAgents: ProposedAgent[];
    confirmedOrchestration: OrchestrationPattern;
  };
}

/**
 * Agent tool mapping for Cedar policy context
 * Maps agent IDs to their assigned tools
 */
export interface AgentToolMapping {
  [agentId: string]: string[];
}

/**
 * Context for cedar-policies.prompt.md
 * Captures security inputs and agent/tool definitions for Cedar policy generation
 *
 * Task Group 3: Policy Context Mapper
 */
export interface CedarPolicyContext {
  /** Security configuration from Step 4 */
  security: {
    dataSensitivity: string;
    complianceFrameworks: string[];
    approvalGates: string[];
    guardrailNotes: string;
  };
  /** Agents with their tools from Step 5 */
  agents: Array<{
    id: string;
    name: string;
    tools: string[];
  }>;
  /** Flat list of all tools across all agents */
  allTools: string[];
  /** Mapping of agent IDs to their tool arrays */
  agentToolMapping: AgentToolMapping;
}

// ============================================================================
// Mapper Functions
// ============================================================================

/**
 * Map WizardState to ProductContext for product.md generation
 * Extracts businessObjective, industry; renames state.outcome to outcomes
 *
 * @param state - The complete wizard state
 * @returns ProductContext for prompt consumption
 */
export function mapToProductContext(state: WizardState): ProductContext {
  const outcome = state.outcome || createDefaultOutcome();

  return {
    businessObjective: state.businessObjective || '',
    industry: state.industry || '',
    outcomes: {
      primaryOutcome: outcome.primaryOutcome || '',
      successMetrics: outcome.successMetrics || [],
      stakeholders: outcome.stakeholders || [],
    },
  };
}

/**
 * Map WizardState to TechContext for tech.md generation
 * Extracts agentDesign and security sections
 *
 * @param state - The complete wizard state
 * @returns TechContext for prompt consumption
 */
export function mapToTechContext(state: WizardState): TechContext {
  const agentDesign = state.agentDesign || createDefaultAgentDesign();
  const security = state.security || createDefaultSecurity();

  return {
    agentDesign: {
      confirmedAgents: agentDesign.confirmedAgents || [],
      confirmedOrchestration: agentDesign.confirmedOrchestration || 'workflow',
      confirmedEdges: agentDesign.confirmedEdges || [],
    },
    security: {
      dataSensitivity: security.dataSensitivity || 'internal',
      complianceFrameworks: security.complianceFrameworks || [],
      approvalGates: security.approvalGates || [],
      guardrailNotes: security.guardrailNotes || '',
    },
  };
}

/**
 * Map WizardState to StructureContext for structure.md generation
 * Extracts agentDesign.confirmedAgents and mockData.mockDefinitions
 *
 * @param state - The complete wizard state
 * @returns StructureContext for prompt consumption
 */
export function mapToStructureContext(state: WizardState): StructureContext {
  const agentDesign = state.agentDesign || createDefaultAgentDesign();
  const mockData = state.mockData || createDefaultMockData();

  return {
    agentDesign: {
      confirmedAgents: agentDesign.confirmedAgents || [],
    },
    mockData: {
      mockDefinitions: mockData.mockDefinitions || [],
    },
  };
}

/**
 * Map WizardState to CustomerContext for customer-context.md generation
 * Extracts industry, systems; renames state.aiGapFillingState to gapFilling
 *
 * @param state - The complete wizard state
 * @returns CustomerContext for prompt consumption
 */
export function mapToCustomerContext(state: WizardState): CustomerContext {
  const aiGapFillingState = state.aiGapFillingState || createDefaultAIGapFilling();

  return {
    industry: state.industry || '',
    systems: state.systems || [],
    gapFilling: {
      confirmedAssumptions: aiGapFillingState.confirmedAssumptions || [],
    },
  };
}

/**
 * Map WizardState to IntegrationContext for integration-landscape.md generation
 * Includes systems, agentDesign, mockData, and pre-computed shared/per-agent tools
 *
 * @param state - The complete wizard state
 * @returns IntegrationContext for prompt consumption
 */
export function mapToIntegrationContext(state: WizardState): IntegrationContext {
  const agentDesign = state.agentDesign || createDefaultAgentDesign();
  const mockData = state.mockData || createDefaultMockData();
  const confirmedAgents = agentDesign.confirmedAgents || [];

  // Analyze shared tools
  const toolAnalysis = analyzeSharedTools(confirmedAgents);

  return {
    systems: state.systems || [],
    agentDesign: {
      confirmedAgents: confirmedAgents,
    },
    mockData: {
      mockDefinitions: mockData.mockDefinitions || [],
    },
    sharedTools: toolAnalysis.sharedTools,
    perAgentTools: toolAnalysis.perAgentTools,
  };
}

/**
 * Map WizardState to SecurityContext for security-policies.md generation
 * Extracts security section (dataSensitivity, complianceFrameworks, approvalGates, guardrailNotes)
 *
 * @param state - The complete wizard state
 * @returns SecurityContext for prompt consumption
 */
export function mapToSecurityContext(state: WizardState): SecurityContext {
  const security = state.security || createDefaultSecurity();

  return {
    security: {
      dataSensitivity: security.dataSensitivity || 'internal',
      complianceFrameworks: security.complianceFrameworks || [],
      approvalGates: security.approvalGates || [],
      guardrailNotes: security.guardrailNotes || '',
      skipped: security.skipped || false,
    },
  };
}

/**
 * Map WizardState to DemoContext for demo-strategy.md generation
 * Extracts demoStrategy (persona, ahaMoments, narrativeScenes)
 *
 * @param state - The complete wizard state
 * @returns DemoContext for prompt consumption
 */
export function mapToDemoContext(state: WizardState): DemoContext {
  const demoStrategy = state.demoStrategy || createDefaultDemoStrategy();
  const agentDesign = state.agentDesign || createDefaultAgentDesign();

  return {
    demoStrategy: {
      ahaMoments: demoStrategy.ahaMoments || [],
      persona: demoStrategy.persona || { name: '', role: '', painPoint: '' },
      narrativeScenes: demoStrategy.narrativeScenes || [],
    },
    industry: state.industry || '',
    agentDesign: {
      confirmedAgents: (agentDesign.confirmedAgents || []).map((agent) => ({
        id: agent.id,
        name: agent.name,
      })),
    },
  };
}

/**
 * Map WizardState to AgentifyContext for agentify-integration.md generation
 * Extracts confirmedAgents and orchestration pattern
 *
 * @param state - The complete wizard state
 * @returns AgentifyContext for prompt consumption
 */
export function mapToAgentifyContext(state: WizardState): AgentifyContext {
  const agentDesign = state.agentDesign || createDefaultAgentDesign();

  return {
    agentDesign: {
      confirmedAgents: agentDesign.confirmedAgents || [],
      confirmedOrchestration: agentDesign.confirmedOrchestration || 'workflow',
    },
  };
}

/**
 * Map WizardState to CedarPolicyContext for cedar-policies.prompt.md generation
 * Extracts SecurityState and AgentDesignState for Cedar policy generation
 *
 * Task Group 3: Policy Context Mapper
 *
 * @param state - The complete wizard state
 * @returns CedarPolicyContext for Cedar policy prompt consumption
 */
export function mapToCedarPolicyContext(state: WizardState): CedarPolicyContext {
  const security = state.security || createDefaultSecurity();
  const agentDesign = state.agentDesign || createDefaultAgentDesign();
  const confirmedAgents = agentDesign.confirmedAgents || [];

  // Build flat list of all tools across all agents
  const allTools = buildFlatToolList(confirmedAgents);

  // Build agent-to-tool mapping
  const agentToolMapping = buildAgentToolMapping(confirmedAgents);

  return {
    security: {
      dataSensitivity: security.dataSensitivity || 'internal',
      complianceFrameworks: security.complianceFrameworks || [],
      approvalGates: security.approvalGates || [],
      guardrailNotes: security.guardrailNotes || '',
    },
    agents: confirmedAgents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      tools: agent.tools || [],
    })),
    allTools,
    agentToolMapping,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Result of analyzing shared tools across agents
 */
export interface SharedToolsAnalysis {
  sharedTools: string[];
  perAgentTools: PerAgentToolInfo[];
}

/**
 * Analyze tools across agents to identify shared and exclusive tools
 *
 * @param confirmedAgents - Array of confirmed agents with their tools
 * @returns Object containing sharedTools array and perAgentTools array
 */
export function analyzeSharedTools(confirmedAgents: ProposedAgent[]): SharedToolsAnalysis {
  if (!confirmedAgents || confirmedAgents.length === 0) {
    return {
      sharedTools: [],
      perAgentTools: [],
    };
  }

  // Count tool usage across agents
  const toolUsageCount = new Map<string, string[]>();

  for (const agent of confirmedAgents) {
    const tools = agent.tools || [];
    for (const tool of tools) {
      const usedBy = toolUsageCount.get(tool) || [];
      usedBy.push(agent.id);
      toolUsageCount.set(tool, usedBy);
    }
  }

  // Identify shared tools (used by 2+ agents)
  const sharedTools: string[] = [];
  for (const [tool, agents] of toolUsageCount) {
    if (agents.length >= 2) {
      sharedTools.push(tool);
    }
  }

  // Compute per-agent exclusive tools
  const perAgentTools: PerAgentToolInfo[] = confirmedAgents.map((agent) => {
    const agentTools = agent.tools || [];
    const exclusiveTools = agentTools.filter((tool) => !sharedTools.includes(tool));

    return {
      agentId: agent.id,
      agentName: agent.name,
      tools: exclusiveTools,
    };
  });

  return {
    sharedTools,
    perAgentTools,
  };
}

/**
 * Build a flat list of all tools across all agents
 * Used for Cedar policy generation targeting
 *
 * Task Group 3: Policy Context Mapper
 *
 * @param confirmedAgents - Array of confirmed agents with their tools
 * @returns Array of unique tool names
 */
export function buildFlatToolList(confirmedAgents: ProposedAgent[]): string[] {
  if (!confirmedAgents || confirmedAgents.length === 0) {
    return [];
  }

  const toolSet = new Set<string>();

  for (const agent of confirmedAgents) {
    const tools = agent.tools || [];
    for (const tool of tools) {
      toolSet.add(tool);
    }
  }

  return Array.from(toolSet).sort();
}

/**
 * Build agent-to-tool mapping for Cedar policy generation
 * Maps each agent ID to its array of tools
 *
 * Task Group 3: Policy Context Mapper
 *
 * @param confirmedAgents - Array of confirmed agents with their tools
 * @returns Object mapping agent IDs to tool arrays
 */
export function buildAgentToolMapping(confirmedAgents: ProposedAgent[]): AgentToolMapping {
  if (!confirmedAgents || confirmedAgents.length === 0) {
    return {};
  }

  const mapping: AgentToolMapping = {};

  for (const agent of confirmedAgents) {
    mapping[agent.id] = agent.tools || [];
  }

  return mapping;
}

/**
 * Format a tool name for Cedar Action syntax
 * Generates Action names in format: TargetName___tool_name (triple underscore)
 *
 * Task Group 3: Policy Context Mapper
 *
 * @param targetName - The system/target name (e.g., "SAP", "Salesforce")
 * @param toolName - The tool name in snake_case (e.g., "get_inventory")
 * @returns Formatted Cedar action name
 */
export function formatCedarActionName(targetName: string, toolName: string): string {
  // Sanitize target name: remove special characters, capitalize first letter of each word
  const sanitizedTarget = targetName
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');

  // Sanitize tool name: ensure snake_case, remove special characters
  const sanitizedTool = toolName
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();

  // Combine with triple underscore separator
  return `${sanitizedTarget}___${sanitizedTool}`;
}

/**
 * Extract target name from a tool identifier
 * Parses tool names that follow the pattern "system_action" or "system___action"
 *
 * Task Group 3: Policy Context Mapper
 *
 * @param toolName - The full tool name
 * @returns Object with target and action components
 */
export function parseToolName(toolName: string): { target: string; action: string } {
  // Check for triple underscore separator first
  if (toolName.includes('___')) {
    const parts = toolName.split('___');
    return {
      target: parts[0] || 'Unknown',
      action: parts.slice(1).join('___'),
    };
  }

  // Fall back to underscore separator (first underscore splits target from action)
  const underscoreIndex = toolName.indexOf('_');
  if (underscoreIndex > 0) {
    return {
      target: toolName.substring(0, underscoreIndex),
      action: toolName.substring(underscoreIndex + 1),
    };
  }

  // No separator found - use tool name as both
  return {
    target: toolName,
    action: toolName,
  };
}

// ============================================================================
// Default State Factories (for fallback handling)
// ============================================================================

/**
 * Create default OutcomeDefinitionState for fallback
 */
function createDefaultOutcome(): Partial<OutcomeDefinitionState> {
  return {
    primaryOutcome: '',
    successMetrics: [],
    stakeholders: [],
  };
}

/**
 * Create default AIGapFillingState for fallback
 */
function createDefaultAIGapFilling(): Partial<AIGapFillingState> {
  return {
    confirmedAssumptions: [],
  };
}

/**
 * Create default SecurityState for fallback
 */
function createDefaultSecurity(): Partial<SecurityState> {
  return {
    dataSensitivity: 'internal',
    complianceFrameworks: [],
    approvalGates: [],
    guardrailNotes: '',
    skipped: false,
  };
}

/**
 * Create default AgentDesignState for fallback
 */
function createDefaultAgentDesign(): Partial<AgentDesignState> {
  return {
    confirmedAgents: [],
    confirmedOrchestration: 'workflow',
    confirmedEdges: [],
  };
}

/**
 * Create default MockDataState for fallback
 */
function createDefaultMockData(): Partial<MockDataState> {
  return {
    mockDefinitions: [],
  };
}

/**
 * Create default DemoStrategyState for fallback
 */
function createDefaultDemoStrategy(): Partial<DemoStrategyState> {
  return {
    ahaMoments: [],
    persona: {
      name: '',
      role: '',
      painPoint: '',
    },
    narrativeScenes: [],
  };
}
