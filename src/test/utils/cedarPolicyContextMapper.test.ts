/**
 * Tests for Cedar Policy Context Mapper
 *
 * Task Group 3: Policy Context Mapper
 * Tests mapToCedarPolicyContext and related utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  mapToCedarPolicyContext,
  buildFlatToolList,
  buildAgentToolMapping,
  formatCedarActionName,
  parseToolName,
  type CedarPolicyContext,
} from '../../utils/steeringStateMapper';
import type { WizardState, ProposedAgent } from '../../types/wizardPanel';

// Helper to create a minimal wizard state for testing
function createMinimalWizardState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    currentStep: 1,
    businessObjective: '',
    industry: '',
    systems: [],
    aiGapFillingState: {
      conversationHistory: [],
      confirmedAssumptions: [],
      assumptionsAccepted: false,
      isStreaming: false,
    },
    outcome: {
      primaryOutcome: '',
      successMetrics: [],
      stakeholders: [],
      isLoading: false,
      primaryOutcomeEdited: false,
      metricsEdited: false,
      stakeholdersEdited: false,
      customStakeholders: [],
      suggestionsAccepted: false,
      refinedSections: { outcome: false, kpis: false, stakeholders: false },
    },
    security: {
      dataSensitivity: 'internal',
      complianceFrameworks: [],
      approvalGates: [],
      guardrailNotes: '',
      skipped: false,
    },
    agentDesign: {
      proposedAgents: [],
      proposedOrchestration: 'workflow',
      proposedEdges: [],
      orchestrationReasoning: '',
      proposalAccepted: false,
      isLoading: false,
      aiCalled: false,
      confirmedAgents: [],
      confirmedOrchestration: 'workflow',
      confirmedEdges: [],
      originalOrchestration: 'workflow',
    },
    mockData: {
      mockDefinitions: [],
      useCustomerTerminology: false,
      isLoading: false,
      aiCalled: false,
    },
    demoStrategy: {
      ahaMoments: [],
      persona: { name: '', role: '', painPoint: '' },
      narrativeScenes: [],
      isGeneratingMoments: false,
      isGeneratingPersona: false,
      isGeneratingNarrative: false,
      momentsEdited: false,
      personaEdited: false,
      narrativeEdited: false,
    },
    generation: {
      isGenerating: false,
      currentFileIndex: -1,
      completedFiles: [],
      generatedFilePaths: [],
      accordionExpanded: false,
      canGenerate: true,
      roadmapGenerating: false,
      roadmapGenerated: false,
      roadmapFilePath: '',
    },
    highestStepReached: 1,
    validationAttempted: false,
    ...overrides,
  } as WizardState;
}

// Helper to create a proposed agent
function createProposedAgent(id: string, name: string, tools: string[]): ProposedAgent {
  return {
    id,
    name,
    role: `${name} role`,
    tools,
    nameEdited: false,
    roleEdited: false,
    toolsEdited: false,
  };
}

describe('mapToCedarPolicyContext', () => {
  // Test 3.1.1: Extraction of SecurityState fields
  it('should extract SecurityState fields correctly', () => {
    const state = createMinimalWizardState({
      security: {
        dataSensitivity: 'confidential',
        complianceFrameworks: ['HIPAA', 'SOC 2'],
        approvalGates: ['Before external API calls'],
        guardrailNotes: 'No PII in logs',
        skipped: false,
      },
    });

    const context = mapToCedarPolicyContext(state);

    expect(context.security.dataSensitivity).toBe('confidential');
    expect(context.security.complianceFrameworks).toEqual(['HIPAA', 'SOC 2']);
    expect(context.security.approvalGates).toEqual(['Before external API calls']);
    expect(context.security.guardrailNotes).toBe('No PII in logs');
  });

  // Test 3.1.2: Extraction of AgentDesignState with tools arrays
  it('should extract AgentDesignState with tools arrays', () => {
    const agents = [
      createProposedAgent('planner', 'Planning Agent', ['sap_get_inventory', 'salesforce_query']),
      createProposedAgent('executor', 'Execution Agent', ['sap_update_stock', 'email_send']),
    ];

    const state = createMinimalWizardState({
      agentDesign: {
        proposedAgents: [],
        proposedOrchestration: 'workflow',
        proposedEdges: [],
        orchestrationReasoning: '',
        proposalAccepted: true,
        isLoading: false,
        aiCalled: true,
        confirmedAgents: agents,
        confirmedOrchestration: 'graph',
        confirmedEdges: [],
        originalOrchestration: 'workflow',
      },
    });

    const context = mapToCedarPolicyContext(state);

    expect(context.agents).toHaveLength(2);
    expect(context.agents[0].id).toBe('planner');
    expect(context.agents[0].name).toBe('Planning Agent');
    expect(context.agents[0].tools).toEqual(['sap_get_inventory', 'salesforce_query']);
    expect(context.agents[1].id).toBe('executor');
    expect(context.agents[1].tools).toEqual(['sap_update_stock', 'email_send']);
  });

  // Test 3.1.3: Flat tool list generation across all agents
  it('should build flat tool list across all agents', () => {
    const agents = [
      createProposedAgent('agent1', 'Agent 1', ['tool_a', 'tool_b']),
      createProposedAgent('agent2', 'Agent 2', ['tool_b', 'tool_c']),
    ];

    const state = createMinimalWizardState({
      agentDesign: {
        proposedAgents: [],
        proposedOrchestration: 'workflow',
        proposedEdges: [],
        orchestrationReasoning: '',
        proposalAccepted: true,
        isLoading: false,
        aiCalled: true,
        confirmedAgents: agents,
        confirmedOrchestration: 'workflow',
        confirmedEdges: [],
        originalOrchestration: 'workflow',
      },
    });

    const context = mapToCedarPolicyContext(state);

    // Should have unique tools only, sorted alphabetically
    expect(context.allTools).toEqual(['tool_a', 'tool_b', 'tool_c']);
  });

  // Test 3.1.4: Agent-to-tool mapping output
  it('should build agent-to-tool mapping', () => {
    const agents = [
      createProposedAgent('planner', 'Planning Agent', ['sap_get_inventory']),
      createProposedAgent('executor', 'Execution Agent', ['sap_update_stock', 'email_send']),
    ];

    const state = createMinimalWizardState({
      agentDesign: {
        proposedAgents: [],
        proposedOrchestration: 'workflow',
        proposedEdges: [],
        orchestrationReasoning: '',
        proposalAccepted: true,
        isLoading: false,
        aiCalled: true,
        confirmedAgents: agents,
        confirmedOrchestration: 'workflow',
        confirmedEdges: [],
        originalOrchestration: 'workflow',
      },
    });

    const context = mapToCedarPolicyContext(state);

    expect(context.agentToolMapping).toEqual({
      planner: ['sap_get_inventory'],
      executor: ['sap_update_stock', 'email_send'],
    });
  });

  // Test 3.1.5: Default values when state is empty
  it('should provide defaults for empty state', () => {
    const state = createMinimalWizardState();

    const context = mapToCedarPolicyContext(state);

    expect(context.security.dataSensitivity).toBe('internal');
    expect(context.security.complianceFrameworks).toEqual([]);
    expect(context.security.approvalGates).toEqual([]);
    expect(context.agents).toEqual([]);
    expect(context.allTools).toEqual([]);
    expect(context.agentToolMapping).toEqual({});
  });
});

describe('buildFlatToolList', () => {
  it('should return empty array for empty agents', () => {
    const result = buildFlatToolList([]);
    expect(result).toEqual([]);
  });

  it('should return empty array for null agents', () => {
    const result = buildFlatToolList(null as unknown as ProposedAgent[]);
    expect(result).toEqual([]);
  });

  it('should deduplicate tools across agents', () => {
    const agents = [
      createProposedAgent('agent1', 'Agent 1', ['shared_tool', 'unique_a']),
      createProposedAgent('agent2', 'Agent 2', ['shared_tool', 'unique_b']),
    ];

    const result = buildFlatToolList(agents);

    expect(result).toContain('shared_tool');
    expect(result.filter((t) => t === 'shared_tool')).toHaveLength(1);
  });

  it('should sort tools alphabetically', () => {
    const agents = [
      createProposedAgent('agent1', 'Agent 1', ['zebra_tool', 'apple_tool']),
    ];

    const result = buildFlatToolList(agents);

    expect(result).toEqual(['apple_tool', 'zebra_tool']);
  });
});

describe('buildAgentToolMapping', () => {
  it('should return empty object for empty agents', () => {
    const result = buildAgentToolMapping([]);
    expect(result).toEqual({});
  });

  it('should map each agent to its tools', () => {
    const agents = [
      createProposedAgent('agent1', 'Agent 1', ['tool_a']),
      createProposedAgent('agent2', 'Agent 2', ['tool_b', 'tool_c']),
    ];

    const result = buildAgentToolMapping(agents);

    expect(result).toEqual({
      agent1: ['tool_a'],
      agent2: ['tool_b', 'tool_c'],
    });
  });

  it('should handle agents with no tools', () => {
    const agents = [
      createProposedAgent('agent1', 'Agent 1', []),
    ];

    const result = buildAgentToolMapping(agents);

    expect(result).toEqual({
      agent1: [],
    });
  });
});

describe('formatCedarActionName', () => {
  it('should format action name with triple underscore', () => {
    const result = formatCedarActionName('SAP', 'get_inventory');
    expect(result).toBe('Sap___get_inventory');
  });

  it('should capitalize target name properly', () => {
    const result = formatCedarActionName('salesforce crm', 'query_accounts');
    expect(result).toBe('SalesforceCrm___query_accounts');
  });

  it('should remove special characters from target name', () => {
    const result = formatCedarActionName('SAP S/4HANA', 'get_data');
    expect(result).toBe('SapS4hana___get_data');
  });

  it('should convert tool name to lowercase', () => {
    const result = formatCedarActionName('Target', 'GET_DATA');
    expect(result).toBe('Target___get_data');
  });

  it('should remove special characters from tool name', () => {
    const result = formatCedarActionName('Target', 'get-data!@#');
    expect(result).toBe('Target___getdata');
  });
});

describe('parseToolName', () => {
  it('should parse triple underscore separator', () => {
    const result = parseToolName('SAP___get_inventory');
    expect(result).toEqual({ target: 'SAP', action: 'get_inventory' });
  });

  it('should parse single underscore as separator', () => {
    const result = parseToolName('sap_get_inventory');
    expect(result).toEqual({ target: 'sap', action: 'get_inventory' });
  });

  it('should handle tool name with no separator', () => {
    const result = parseToolName('toolname');
    expect(result).toEqual({ target: 'toolname', action: 'toolname' });
  });

  it('should handle complex triple underscore cases', () => {
    const result = parseToolName('SAP___get_inventory___detail');
    expect(result).toEqual({ target: 'SAP', action: 'get_inventory___detail' });
  });
});

describe('CedarPolicyContext Interface', () => {
  it('should have correct structure', () => {
    const context: CedarPolicyContext = {
      security: {
        dataSensitivity: 'confidential',
        complianceFrameworks: ['HIPAA'],
        approvalGates: ['Before financial transactions'],
        guardrailNotes: 'Test notes',
      },
      agents: [
        { id: 'agent1', name: 'Test Agent', tools: ['tool1'] },
      ],
      allTools: ['tool1'],
      agentToolMapping: { agent1: ['tool1'] },
    };

    expect(context.security.dataSensitivity).toBe('confidential');
    expect(context.agents).toHaveLength(1);
    expect(context.allTools).toContain('tool1');
    expect(context.agentToolMapping['agent1']).toContain('tool1');
  });
});
