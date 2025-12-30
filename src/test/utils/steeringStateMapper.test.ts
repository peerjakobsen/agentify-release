/**
 * Tests for Steering State Mapper Utility Module (Task Group 1)
 *
 * These tests validate the state transformation functions that convert
 * WizardState sections into context objects for steering document prompts.
 */

import { describe, it, expect } from 'vitest';
import {
  mapToProductContext,
  mapToCustomerContext,
  mapToIntegrationContext,
  mapToTechContext,
  mapToStructureContext,
  mapToSecurityContext,
  mapToDemoContext,
  mapToAgentifyContext,
  analyzeSharedTools,
  type ProductContext,
  type CustomerContext,
  type IntegrationContext,
} from '../../utils/steeringStateMapper';
import type { WizardState, ProposedAgent } from '../../types/wizardPanel';
import { createDefaultWizardState } from '../../types/wizardPanel';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a minimal WizardState with populated fields for testing
 */
function createPopulatedWizardState(): WizardState {
  const state = createDefaultWizardState();

  // Step 1: Business Context
  state.businessObjective = 'Automate inventory replenishment across retail stores';
  state.industry = 'Retail';
  state.systems = ['SAP S/4HANA', 'Salesforce'];

  // Step 2: AI Gap Filling
  state.aiGapFillingState.confirmedAssumptions = [
    {
      system: 'SAP S/4HANA',
      modules: ['MM', 'SD'],
      integrations: ['Salesforce -> SAP: opportunity sync'],
      source: 'user-corrected',
    },
  ];

  // Step 3: Outcome Definition
  state.outcome.primaryOutcome = 'Reduce stockouts by 50%';
  state.outcome.successMetrics = [
    { name: 'Order accuracy', targetValue: '95', unit: '%' },
    { name: 'Processing time', targetValue: '2', unit: 'hours' },
  ];
  state.outcome.stakeholders = ['Operations', 'Finance'];

  // Step 4: Security
  state.security.dataSensitivity = 'confidential';
  state.security.complianceFrameworks = ['SOC 2'];
  state.security.approvalGates = ['Before external API calls'];
  state.security.guardrailNotes = 'No PII in logs';

  // Step 5: Agent Design
  state.agentDesign.confirmedAgents = [
    {
      id: 'inventory_agent',
      name: 'Inventory Agent',
      role: 'Manages inventory levels and stock monitoring',
      tools: ['sap_get_inventory', 'sap_check_stock', 'shared_notify'],
      nameEdited: false,
      roleEdited: false,
      toolsEdited: false,
    },
    {
      id: 'planner_agent',
      name: 'Planner Agent',
      role: 'Creates replenishment plans and forecasts',
      tools: ['sap_get_inventory', 'salesforce_query', 'shared_notify'],
      nameEdited: false,
      roleEdited: false,
      toolsEdited: false,
    },
    {
      id: 'executor_agent',
      name: 'Executor Agent',
      role: 'Executes approved replenishment orders',
      tools: ['sap_create_order', 'exclusive_audit'],
      nameEdited: false,
      roleEdited: false,
      toolsEdited: false,
    },
  ];
  state.agentDesign.confirmedOrchestration = 'graph';
  state.agentDesign.confirmedEdges = [
    { from: 'inventory_agent', to: 'planner_agent' },
    { from: 'planner_agent', to: 'executor_agent', condition: 'approval_granted' },
  ];

  // Step 6: Mock Data
  state.mockData.mockDefinitions = [
    {
      tool: 'sap_get_inventory',
      system: 'SAP S/4HANA',
      operation: 'getInventory',
      description: 'Retrieve inventory levels',
      mockRequest: { materialId: 'string' },
      mockResponse: { quantity: 100 },
      sampleData: [{ materialId: 'MAT001', quantity: 100 }],
      expanded: false,
      requestEdited: false,
      responseEdited: false,
      sampleDataEdited: false,
    },
  ];

  // Step 7: Demo Strategy
  state.demoStrategy.persona = {
    name: 'Maria Chen',
    role: 'Regional Inventory Manager',
    painPoint: 'Spends 2 hours daily on manual stock reconciliation',
  };
  state.demoStrategy.ahaMoments = [
    {
      id: 'aha-1',
      title: 'Real-time inventory sync',
      triggerType: 'tool',
      triggerName: 'sap_get_inventory',
      talkingPoint: 'Notice how inventory updates instantly across all stores',
    },
  ];
  state.demoStrategy.narrativeScenes = [
    {
      id: 'scene-1',
      title: 'Morning Check-In',
      description: 'Maria reviews overnight inventory changes',
      highlightedAgents: ['inventory_agent'],
    },
  ];

  return state;
}

// ============================================================================
// Test 1: mapToProductContext
// ============================================================================

describe('mapToProductContext', () => {
  it('should extract businessObjective, industry, and rename outcome to outcomes', () => {
    const state = createPopulatedWizardState();
    const context = mapToProductContext(state);

    // Verify businessObjective extraction
    expect(context.businessObjective).toBe('Automate inventory replenishment across retail stores');

    // Verify industry extraction
    expect(context.industry).toBe('Retail');

    // Verify outcome is renamed to outcomes
    expect(context.outcomes).toBeDefined();
    expect(context.outcomes.primaryOutcome).toBe('Reduce stockouts by 50%');
    expect(context.outcomes.successMetrics).toHaveLength(2);
    expect(context.outcomes.stakeholders).toContain('Operations');
  });

  it('should return correctly structured context object', () => {
    const state = createPopulatedWizardState();
    const context = mapToProductContext(state);

    // Verify structure matches ProductContext interface
    expect(context).toHaveProperty('businessObjective');
    expect(context).toHaveProperty('industry');
    expect(context).toHaveProperty('outcomes');
    expect(context.outcomes).toHaveProperty('primaryOutcome');
    expect(context.outcomes).toHaveProperty('successMetrics');
    expect(context.outcomes).toHaveProperty('stakeholders');
  });

  it('should handle missing optional state sections gracefully', () => {
    const state = createDefaultWizardState();
    const context = mapToProductContext(state);

    expect(context.businessObjective).toBe('');
    expect(context.industry).toBe('');
    expect(context.outcomes.primaryOutcome).toBe('');
    expect(context.outcomes.successMetrics).toEqual([]);
    expect(context.outcomes.stakeholders).toEqual([]);
  });
});

// ============================================================================
// Test 2: mapToCustomerContext
// ============================================================================

describe('mapToCustomerContext', () => {
  it('should extract industry, systems, and rename aiGapFillingState to gapFilling', () => {
    const state = createPopulatedWizardState();
    const context = mapToCustomerContext(state);

    // Verify industry extraction
    expect(context.industry).toBe('Retail');

    // Verify systems extraction
    expect(context.systems).toContain('SAP S/4HANA');
    expect(context.systems).toContain('Salesforce');

    // Verify aiGapFillingState is renamed to gapFilling
    expect(context.gapFilling).toBeDefined();
    expect(context.gapFilling.confirmedAssumptions).toHaveLength(1);
    expect(context.gapFilling.confirmedAssumptions[0].system).toBe('SAP S/4HANA');
  });

  it('should return correctly structured context object', () => {
    const state = createPopulatedWizardState();
    const context = mapToCustomerContext(state);

    // Verify structure matches CustomerContext interface
    expect(context).toHaveProperty('industry');
    expect(context).toHaveProperty('systems');
    expect(context).toHaveProperty('gapFilling');
    expect(context.gapFilling).toHaveProperty('confirmedAssumptions');
  });

  it('should handle missing optional state sections gracefully', () => {
    const state = createDefaultWizardState();
    const context = mapToCustomerContext(state);

    expect(context.industry).toBe('');
    expect(context.systems).toEqual([]);
    expect(context.gapFilling.confirmedAssumptions).toEqual([]);
  });
});

// ============================================================================
// Test 3: mapToIntegrationContext and analyzeSharedTools
// ============================================================================

describe('mapToIntegrationContext', () => {
  it('should produce sharedTools and perAgentTools arrays', () => {
    const state = createPopulatedWizardState();
    const context = mapToIntegrationContext(state);

    // Verify sharedTools is computed
    expect(context.sharedTools).toBeDefined();
    expect(Array.isArray(context.sharedTools)).toBe(true);

    // Verify perAgentTools is computed
    expect(context.perAgentTools).toBeDefined();
    expect(Array.isArray(context.perAgentTools)).toBe(true);

    // Verify systems and agentDesign are included
    expect(context.systems).toContain('SAP S/4HANA');
    expect(context.agentDesign).toBeDefined();
    expect(context.agentDesign.confirmedAgents).toHaveLength(3);
  });

  it('should return correctly structured context object', () => {
    const state = createPopulatedWizardState();
    const context = mapToIntegrationContext(state);

    // Verify structure matches IntegrationContext interface
    expect(context).toHaveProperty('systems');
    expect(context).toHaveProperty('agentDesign');
    expect(context).toHaveProperty('mockData');
    expect(context).toHaveProperty('sharedTools');
    expect(context).toHaveProperty('perAgentTools');
  });
});

describe('analyzeSharedTools', () => {
  it('should correctly identify tools used by multiple agents', () => {
    const agents: ProposedAgent[] = [
      {
        id: 'agent_a',
        name: 'Agent A',
        role: 'Role A',
        tools: ['shared_tool_1', 'shared_tool_2', 'exclusive_a'],
        nameEdited: false,
        roleEdited: false,
        toolsEdited: false,
      },
      {
        id: 'agent_b',
        name: 'Agent B',
        role: 'Role B',
        tools: ['shared_tool_1', 'shared_tool_2', 'exclusive_b'],
        nameEdited: false,
        roleEdited: false,
        toolsEdited: false,
      },
      {
        id: 'agent_c',
        name: 'Agent C',
        role: 'Role C',
        tools: ['shared_tool_1', 'exclusive_c'],
        nameEdited: false,
        roleEdited: false,
        toolsEdited: false,
      },
    ];

    const result = analyzeSharedTools(agents);

    // shared_tool_1 is used by all 3 agents
    // shared_tool_2 is used by 2 agents
    expect(result.sharedTools).toContain('shared_tool_1');
    expect(result.sharedTools).toContain('shared_tool_2');
    expect(result.sharedTools).not.toContain('exclusive_a');
    expect(result.sharedTools).not.toContain('exclusive_b');
    expect(result.sharedTools).not.toContain('exclusive_c');
  });

  it('should correctly identify unique tools per agent', () => {
    const agents: ProposedAgent[] = [
      {
        id: 'agent_a',
        name: 'Agent A',
        role: 'Role A',
        tools: ['shared_tool', 'exclusive_a'],
        nameEdited: false,
        roleEdited: false,
        toolsEdited: false,
      },
      {
        id: 'agent_b',
        name: 'Agent B',
        role: 'Role B',
        tools: ['shared_tool', 'exclusive_b1', 'exclusive_b2'],
        nameEdited: false,
        roleEdited: false,
        toolsEdited: false,
      },
    ];

    const result = analyzeSharedTools(agents);

    // Verify perAgentTools structure
    expect(result.perAgentTools).toHaveLength(2);

    const agentATools = result.perAgentTools.find((p) => p.agentId === 'agent_a');
    expect(agentATools).toBeDefined();
    expect(agentATools?.tools).toContain('exclusive_a');
    expect(agentATools?.tools).not.toContain('shared_tool');

    const agentBTools = result.perAgentTools.find((p) => p.agentId === 'agent_b');
    expect(agentBTools).toBeDefined();
    expect(agentBTools?.tools).toContain('exclusive_b1');
    expect(agentBTools?.tools).toContain('exclusive_b2');
  });

  it('should return empty arrays for empty agents', () => {
    const result = analyzeSharedTools([]);

    expect(result.sharedTools).toEqual([]);
    expect(result.perAgentTools).toEqual([]);
  });

  it('should handle agents with no tools', () => {
    const agents: ProposedAgent[] = [
      {
        id: 'agent_a',
        name: 'Agent A',
        role: 'Role A',
        tools: [],
        nameEdited: false,
        roleEdited: false,
        toolsEdited: false,
      },
    ];

    const result = analyzeSharedTools(agents);

    expect(result.sharedTools).toEqual([]);
    expect(result.perAgentTools).toHaveLength(1);
    expect(result.perAgentTools[0].tools).toEqual([]);
  });
});

// ============================================================================
// Test 4: Handle missing/empty optional state sections
// ============================================================================

describe('Mapper fallback handling for missing state sections', () => {
  it('should handle empty WizardState for all mappers', () => {
    const state = createDefaultWizardState();

    // All mappers should return valid objects without throwing
    expect(() => mapToProductContext(state)).not.toThrow();
    expect(() => mapToTechContext(state)).not.toThrow();
    expect(() => mapToStructureContext(state)).not.toThrow();
    expect(() => mapToCustomerContext(state)).not.toThrow();
    expect(() => mapToIntegrationContext(state)).not.toThrow();
    expect(() => mapToSecurityContext(state)).not.toThrow();
    expect(() => mapToDemoContext(state)).not.toThrow();
    expect(() => mapToAgentifyContext(state)).not.toThrow();
  });

  it('should return safe defaults for undefined state properties', () => {
    // Create a minimal state with potential undefined properties
    const state = createDefaultWizardState();

    // Security context should handle skipped security
    state.security.skipped = true;
    const securityContext = mapToSecurityContext(state);
    expect(securityContext.security).toBeDefined();
    expect(securityContext.security.dataSensitivity).toBeDefined();

    // Demo context should handle empty persona
    const demoContext = mapToDemoContext(state);
    expect(demoContext.demoStrategy).toBeDefined();
    expect(demoContext.demoStrategy.persona).toBeDefined();

    // Tech context should handle empty agent design
    const techContext = mapToTechContext(state);
    expect(techContext.agentDesign).toBeDefined();
    expect(techContext.agentDesign.confirmedAgents).toEqual([]);
  });

  it('should produce valid JSON-serializable output', () => {
    const state = createPopulatedWizardState();

    // All contexts should be JSON-serializable
    const contexts = [
      mapToProductContext(state),
      mapToTechContext(state),
      mapToStructureContext(state),
      mapToCustomerContext(state),
      mapToIntegrationContext(state),
      mapToSecurityContext(state),
      mapToDemoContext(state),
      mapToAgentifyContext(state),
    ];

    for (const context of contexts) {
      expect(() => JSON.stringify(context)).not.toThrow();
      const serialized = JSON.stringify(context);
      expect(() => JSON.parse(serialized)).not.toThrow();
    }
  });
});

// ============================================================================
// Test 5: Individual mapper structure validation
// ============================================================================

describe('Each mapper returns correctly structured context object', () => {
  it('mapToTechContext should include agentDesign and security', () => {
    const state = createPopulatedWizardState();
    const context = mapToTechContext(state);

    expect(context).toHaveProperty('agentDesign');
    expect(context).toHaveProperty('security');
    expect(context.agentDesign.confirmedAgents).toBeDefined();
    expect(context.agentDesign.confirmedOrchestration).toBe('graph');
    expect(context.security.dataSensitivity).toBe('confidential');
  });

  it('mapToStructureContext should include confirmedAgents and mockDefinitions', () => {
    const state = createPopulatedWizardState();
    const context = mapToStructureContext(state);

    expect(context).toHaveProperty('agentDesign');
    expect(context).toHaveProperty('mockData');
    expect(context.agentDesign.confirmedAgents).toHaveLength(3);
    expect(context.mockData.mockDefinitions).toHaveLength(1);
  });

  it('mapToSecurityContext should include all security fields', () => {
    const state = createPopulatedWizardState();
    const context = mapToSecurityContext(state);

    expect(context.security).toHaveProperty('dataSensitivity');
    expect(context.security).toHaveProperty('complianceFrameworks');
    expect(context.security).toHaveProperty('approvalGates');
    expect(context.security).toHaveProperty('guardrailNotes');
    expect(context.security.complianceFrameworks).toContain('SOC 2');
  });

  it('mapToDemoContext should include persona, ahaMoments, and narrativeScenes', () => {
    const state = createPopulatedWizardState();
    const context = mapToDemoContext(state);

    expect(context).toHaveProperty('demoStrategy');
    expect(context).toHaveProperty('industry');
    expect(context).toHaveProperty('agentDesign');
    expect(context.demoStrategy.persona.name).toBe('Maria Chen');
    expect(context.demoStrategy.ahaMoments).toHaveLength(1);
    expect(context.demoStrategy.narrativeScenes).toHaveLength(1);
  });

  it('mapToAgentifyContext should include confirmedAgents and orchestration', () => {
    const state = createPopulatedWizardState();
    const context = mapToAgentifyContext(state);

    expect(context).toHaveProperty('agentDesign');
    expect(context.agentDesign.confirmedAgents).toHaveLength(3);
    expect(context.agentDesign.confirmedOrchestration).toBe('graph');
  });
});
