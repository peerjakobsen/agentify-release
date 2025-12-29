/**
 * Tests for Agent Design Phase 2 - Type Definitions and State Structure
 * Task Group 1: Type definitions for Step 5 Agent Design Editing feature
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultAgentDesignState,
  WIZARD_COMMANDS,
  type ProposedAgent,
  type AgentDesignState,
  type ProposedEdge,
  type OrchestrationPattern,
} from '../../types/wizardPanel';

// ============================================================================
// Task 1.1: 4 Focused Tests for Type Definitions
// ============================================================================

describe('Task Group 1: Type Definitions and State Structure', () => {
  describe('Test 1: createDefaultAgentDesignState() includes Phase 2 fields', () => {
    it('should initialize all Phase 2 fields with correct defaults', () => {
      const state = createDefaultAgentDesignState();

      // Verify existing Phase 1 fields
      expect(state.proposedAgents).toEqual([]);
      expect(state.proposedOrchestration).toBe('workflow');
      expect(state.proposedEdges).toEqual([]);
      expect(state.orchestrationReasoning).toBe('');
      expect(state.proposalAccepted).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeUndefined();
      expect(state.step4Hash).toBeUndefined();
      expect(state.aiCalled).toBe(false);

      // Verify new Phase 2 fields
      expect(state.confirmedAgents).toEqual([]);
      expect(state.confirmedOrchestration).toBe('workflow');
      expect(state.confirmedEdges).toEqual([]);
      expect(state.originalOrchestration).toBe('workflow');
      expect(state.edgeSuggestion).toBeUndefined();
    });
  });

  describe('Test 2: ProposedAgent edited flags are properly initialized', () => {
    it('should support edited flags on ProposedAgent interface', () => {
      // Create an agent with all fields including edited flags
      const agent: ProposedAgent = {
        id: 'planner',
        name: 'Planning Agent',
        role: 'Coordinates task breakdown and workflow planning',
        tools: ['sap_get_inventory', 'salesforce_query_accounts'],
        nameEdited: false,
        roleEdited: false,
        toolsEdited: false,
      };

      // Verify all fields exist with correct types
      expect(agent.id).toBe('planner');
      expect(agent.name).toBe('Planning Agent');
      expect(agent.role).toBeTruthy();
      expect(agent.tools).toBeInstanceOf(Array);
      expect(agent.nameEdited).toBe(false);
      expect(agent.roleEdited).toBe(false);
      expect(agent.toolsEdited).toBe(false);

      // Test that edited flags can be set to true
      const editedAgent: ProposedAgent = {
        ...agent,
        nameEdited: true,
        roleEdited: true,
        toolsEdited: false,
      };

      expect(editedAgent.nameEdited).toBe(true);
      expect(editedAgent.roleEdited).toBe(true);
      expect(editedAgent.toolsEdited).toBe(false);
    });
  });

  describe('Test 3: New wizard commands are properly typed', () => {
    it('should define all Phase 2 wizard commands with correct values', () => {
      // Phase transition commands
      expect(WIZARD_COMMANDS.ACCEPT_SUGGESTIONS_PHASE2).toBe('acceptSuggestionsPhase2');
      expect(WIZARD_COMMANDS.ACCEPT_AND_CONTINUE).toBe('acceptAndContinue');

      // Agent editing commands
      expect(WIZARD_COMMANDS.UPDATE_AGENT_NAME).toBe('updateAgentName');
      expect(WIZARD_COMMANDS.UPDATE_AGENT_ROLE).toBe('updateAgentRole');
      expect(WIZARD_COMMANDS.ADD_AGENT_TOOL).toBe('addAgentTool');
      expect(WIZARD_COMMANDS.REMOVE_AGENT_TOOL).toBe('removeAgentTool');

      // Agent add/remove commands
      expect(WIZARD_COMMANDS.ADD_AGENT).toBe('addAgent');
      expect(WIZARD_COMMANDS.REMOVE_AGENT).toBe('removeAgent');

      // Orchestration commands
      expect(WIZARD_COMMANDS.UPDATE_ORCHESTRATION).toBe('updateOrchestration');

      // Edge commands
      expect(WIZARD_COMMANDS.ADD_EDGE).toBe('addEdge');
      expect(WIZARD_COMMANDS.REMOVE_EDGE).toBe('removeEdge');
      expect(WIZARD_COMMANDS.UPDATE_EDGE).toBe('updateEdge');
      expect(WIZARD_COMMANDS.APPLY_EDGE_SUGGESTION).toBe('applyEdgeSuggestion');
      expect(WIZARD_COMMANDS.DISMISS_EDGE_SUGGESTION).toBe('dismissEdgeSuggestion');

      // Confirmation command
      expect(WIZARD_COMMANDS.CONFIRM_DESIGN).toBe('confirmDesign');

      // Verify all commands follow camelCase naming pattern
      const phase2Commands = [
        WIZARD_COMMANDS.ACCEPT_SUGGESTIONS_PHASE2,
        WIZARD_COMMANDS.ACCEPT_AND_CONTINUE,
        WIZARD_COMMANDS.UPDATE_AGENT_NAME,
        WIZARD_COMMANDS.UPDATE_AGENT_ROLE,
        WIZARD_COMMANDS.ADD_AGENT_TOOL,
        WIZARD_COMMANDS.REMOVE_AGENT_TOOL,
        WIZARD_COMMANDS.ADD_AGENT,
        WIZARD_COMMANDS.REMOVE_AGENT,
        WIZARD_COMMANDS.UPDATE_ORCHESTRATION,
        WIZARD_COMMANDS.ADD_EDGE,
        WIZARD_COMMANDS.REMOVE_EDGE,
        WIZARD_COMMANDS.UPDATE_EDGE,
        WIZARD_COMMANDS.APPLY_EDGE_SUGGESTION,
        WIZARD_COMMANDS.DISMISS_EDGE_SUGGESTION,
        WIZARD_COMMANDS.CONFIRM_DESIGN,
      ];

      phase2Commands.forEach((command) => {
        expect(command).toMatch(/^[a-z][a-zA-Z0-9]+$/);
      });
    });
  });

  describe('Test 4: State serialization/deserialization preserves Phase 2 fields', () => {
    it('should serialize and deserialize AgentDesignState with all Phase 2 fields', () => {
      // Create a fully populated state with Phase 2 fields
      const originalState: AgentDesignState = {
        // AI Proposal fields
        proposedAgents: [
          {
            id: 'planner',
            name: 'Planning Agent',
            role: 'Plans the workflow',
            tools: ['sap_get_inventory'],
            nameEdited: true,
            roleEdited: false,
            toolsEdited: false,
          },
          {
            id: 'executor',
            name: 'Executor Agent',
            role: 'Executes tasks',
            tools: ['salesforce_update'],
            nameEdited: false,
            roleEdited: true,
            toolsEdited: true,
          },
        ],
        proposedOrchestration: 'graph',
        proposedEdges: [
          { from: 'planner', to: 'executor' },
          { from: 'executor', to: 'output', condition: 'approved' },
        ],
        orchestrationReasoning: 'Graph pattern allows conditional branching.',

        // Accept/Edit state
        proposalAccepted: true,
        isLoading: false,
        error: undefined,

        // Change detection
        step4Hash: 'abc123hash',
        aiCalled: true,

        // Phase 2 confirmed fields
        confirmedAgents: [
          {
            id: 'planner',
            name: 'Updated Planning Agent',
            role: 'Plans the workflow',
            tools: ['sap_get_inventory', 'new_tool'],
            nameEdited: true,
            roleEdited: false,
            toolsEdited: true,
          },
        ],
        confirmedOrchestration: 'workflow',
        confirmedEdges: [{ from: 'planner', to: 'executor' }],
        originalOrchestration: 'graph',
        edgeSuggestion: {
          edges: [
            { from: 'planner', to: 'executor' },
            { from: 'executor', to: 'output' },
          ],
          visible: true,
        },
      };

      // Serialize to JSON
      const serialized = JSON.stringify(originalState);

      // Deserialize back to object
      const deserializedState: AgentDesignState = JSON.parse(serialized);

      // Verify all Phase 1 fields are preserved
      expect(deserializedState.proposedAgents).toHaveLength(2);
      expect(deserializedState.proposedAgents[0].id).toBe('planner');
      expect(deserializedState.proposedAgents[0].nameEdited).toBe(true);
      expect(deserializedState.proposedOrchestration).toBe('graph');
      expect(deserializedState.proposedEdges).toHaveLength(2);
      expect(deserializedState.proposedEdges[1].condition).toBe('approved');
      expect(deserializedState.orchestrationReasoning).toBe('Graph pattern allows conditional branching.');
      expect(deserializedState.proposalAccepted).toBe(true);
      expect(deserializedState.step4Hash).toBe('abc123hash');
      expect(deserializedState.aiCalled).toBe(true);

      // Verify all Phase 2 fields are preserved
      expect(deserializedState.confirmedAgents).toHaveLength(1);
      expect(deserializedState.confirmedAgents[0].name).toBe('Updated Planning Agent');
      expect(deserializedState.confirmedAgents[0].toolsEdited).toBe(true);
      expect(deserializedState.confirmedOrchestration).toBe('workflow');
      expect(deserializedState.confirmedEdges).toHaveLength(1);
      expect(deserializedState.originalOrchestration).toBe('graph');
      expect(deserializedState.edgeSuggestion).toBeDefined();
      expect(deserializedState.edgeSuggestion?.edges).toHaveLength(2);
      expect(deserializedState.edgeSuggestion?.visible).toBe(true);
    });

    it('should handle undefined edgeSuggestion correctly', () => {
      const stateWithoutSuggestion: AgentDesignState = {
        proposedAgents: [],
        proposedOrchestration: 'workflow',
        proposedEdges: [],
        orchestrationReasoning: '',
        proposalAccepted: false,
        isLoading: false,
        error: undefined,
        step4Hash: undefined,
        aiCalled: false,
        confirmedAgents: [],
        confirmedOrchestration: 'workflow',
        confirmedEdges: [],
        originalOrchestration: 'workflow',
        edgeSuggestion: undefined,
      };

      const serialized = JSON.stringify(stateWithoutSuggestion);
      const deserialized: AgentDesignState = JSON.parse(serialized);

      expect(deserialized.edgeSuggestion).toBeUndefined();
    });
  });
});
