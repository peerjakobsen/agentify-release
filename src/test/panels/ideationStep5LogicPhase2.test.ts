/**
 * Tests for Step 5 Logic Handler Extension - Phase 2 Agent Design Editing
 * Task Group 2: Logic handler extension for Step 5 Agent Design Editing feature
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Step5LogicHandler } from '../../panels/ideationStep5Logic';
import {
  createDefaultAgentDesignState,
  type AgentDesignState,
  type ProposedAgent,
  type ProposedEdge,
} from '../../types/wizardPanel';

// Mock vscode module
vi.mock('vscode', () => ({
  default: {
    EventEmitter: class {
      event = vi.fn();
      fire = vi.fn();
      dispose = vi.fn();
    },
  },
  EventEmitter: class {
    event = vi.fn();
    fire = vi.fn();
    dispose = vi.fn();
  },
}));

// ============================================================================
// Task 2.1: 6 Focused Tests for Logic Handler
// ============================================================================

describe('Task Group 2: Step 5 Logic Handler Extension', () => {
  let handler: Step5LogicHandler;
  let mockState: AgentDesignState;
  let mockCallbacks: {
    updateWebviewContent: () => void;
    syncStateToWebview: () => void;
  };

  beforeEach(() => {
    mockState = createDefaultAgentDesignState();
    mockCallbacks = {
      updateWebviewContent: vi.fn(),
      syncStateToWebview: vi.fn(),
    };
    handler = new Step5LogicHandler(undefined, mockState, mockCallbacks);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Test 1: handleAcceptSuggestionsPhase2() sets proposalAccepted: true', () => {
    it('should set proposalAccepted to true and store originalOrchestration', () => {
      // Setup: Add some proposed content
      mockState.proposedOrchestration = 'graph';
      mockState.proposedAgents = [
        {
          id: 'planner',
          name: 'Planning Agent',
          role: 'Plans workflow',
          tools: ['sap_get_inventory'],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
      ];
      handler.setState(mockState);

      // Act
      handler.handleAcceptSuggestionsPhase2();

      // Assert
      const state = handler.getState();
      expect(state.proposalAccepted).toBe(true);
      expect(state.originalOrchestration).toBe('graph');
      expect(mockCallbacks.updateWebviewContent).toHaveBeenCalled();
      expect(mockCallbacks.syncStateToWebview).toHaveBeenCalled();
    });
  });

  describe('Test 2: handleUpdateAgent() sets appropriate edited flags', () => {
    beforeEach(() => {
      // Setup: Add an agent
      mockState.proposedAgents = [
        {
          id: 'planner',
          name: 'Planning Agent',
          role: 'Plans workflow',
          tools: ['sap_get_inventory'],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
      ];
      handler.setState(mockState);
    });

    it('should set nameEdited to true when updating agent name', () => {
      handler.handleUpdateAgentName('planner', 'New Name');

      const state = handler.getState();
      const agent = state.proposedAgents.find((a) => a.id === 'planner');

      expect(agent?.name).toBe('New Name');
      expect(agent?.nameEdited).toBe(true);
      expect(agent?.roleEdited).toBe(false);
      expect(agent?.toolsEdited).toBe(false);
    });

    it('should set roleEdited to true when updating agent role', () => {
      handler.handleUpdateAgentRole('planner', 'New role description');

      const state = handler.getState();
      const agent = state.proposedAgents.find((a) => a.id === 'planner');

      expect(agent?.role).toBe('New role description');
      expect(agent?.roleEdited).toBe(true);
      expect(agent?.nameEdited).toBe(false);
    });

    it('should set toolsEdited to true when adding a tool', () => {
      handler.handleAddAgentTool('planner', 'new_tool');

      const state = handler.getState();
      const agent = state.proposedAgents.find((a) => a.id === 'planner');

      expect(agent?.tools).toContain('new_tool');
      expect(agent?.toolsEdited).toBe(true);
    });

    it('should set toolsEdited to true when removing a tool', () => {
      handler.handleRemoveAgentTool('planner', 0);

      const state = handler.getState();
      const agent = state.proposedAgents.find((a) => a.id === 'planner');

      expect(agent?.tools).not.toContain('sap_get_inventory');
      expect(agent?.toolsEdited).toBe(true);
    });
  });

  describe('Test 3: handleAddAgent() generates unique ID', () => {
    it('should generate agent_1 for first added agent', () => {
      handler.handleAddAgent();

      const state = handler.getState();
      expect(state.proposedAgents).toHaveLength(1);
      expect(state.proposedAgents[0].id).toBe('agent_1');
      expect(state.proposedAgents[0].name).toBe('');
      expect(state.proposedAgents[0].role).toBe('');
      expect(state.proposedAgents[0].tools).toEqual([]);
    });

    it('should generate sequential IDs for multiple agents', () => {
      handler.handleAddAgent();
      handler.handleAddAgent();
      handler.handleAddAgent();

      const state = handler.getState();
      expect(state.proposedAgents).toHaveLength(3);
      expect(state.proposedAgents[0].id).toBe('agent_1');
      expect(state.proposedAgents[1].id).toBe('agent_2');
      expect(state.proposedAgents[2].id).toBe('agent_3');
    });

    it('should find next available ID when agents exist', () => {
      // Setup: Add existing agent with AI-generated ID
      mockState.proposedAgents = [
        {
          id: 'planner',
          name: 'Planning Agent',
          role: 'Plans',
          tools: [],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
      ];
      handler.setState(mockState);

      handler.handleAddAgent();

      const state = handler.getState();
      expect(state.proposedAgents).toHaveLength(2);
      expect(state.proposedAgents[1].id).toBe('agent_1');
    });
  });

  describe('Test 4: handleRemoveAgent() removes associated edges', () => {
    beforeEach(() => {
      // Setup: Add agents and edges
      mockState.proposedAgents = [
        {
          id: 'planner',
          name: 'Planner',
          role: 'Plans',
          tools: [],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
        {
          id: 'executor',
          name: 'Executor',
          role: 'Executes',
          tools: [],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
        {
          id: 'validator',
          name: 'Validator',
          role: 'Validates',
          tools: [],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
      ];
      mockState.proposedEdges = [
        { from: 'planner', to: 'executor' },
        { from: 'executor', to: 'validator' },
        { from: 'validator', to: 'output' },
      ];
      handler.setState(mockState);
    });

    it('should remove agent and all edges containing that agent', () => {
      handler.handleRemoveAgent('executor');

      const state = handler.getState();

      // Agent should be removed
      expect(state.proposedAgents.find((a) => a.id === 'executor')).toBeUndefined();
      expect(state.proposedAgents).toHaveLength(2);

      // Edges containing executor should be removed
      expect(state.proposedEdges.find((e) => e.from === 'executor')).toBeUndefined();
      expect(state.proposedEdges.find((e) => e.to === 'executor')).toBeUndefined();

      // Other edges should remain
      expect(state.proposedEdges.find((e) => e.from === 'validator')).toBeDefined();
    });

    it('should remove all edges for agent with multiple connections', () => {
      // Add more edges involving planner
      mockState.proposedEdges.push({ from: 'planner', to: 'validator' });
      handler.setState(mockState);

      handler.handleRemoveAgent('planner');

      const state = handler.getState();

      // All edges with planner should be removed
      expect(state.proposedEdges.filter((e) => e.from === 'planner' || e.to === 'planner')).toHaveLength(0);
    });
  });

  describe('Test 5: handleConfirmDesign() copies to confirmed fields', () => {
    beforeEach(() => {
      // Setup: Add proposal data
      mockState.proposedAgents = [
        {
          id: 'planner',
          name: 'Planning Agent',
          role: 'Plans workflow',
          tools: ['sap_query'],
          nameEdited: true,
          roleEdited: false,
          toolsEdited: false,
        },
      ];
      mockState.proposedOrchestration = 'graph';
      mockState.proposedEdges = [{ from: 'planner', to: 'executor' }];
      mockState.proposalAccepted = true;
      handler.setState(mockState);
    });

    it('should copy proposed fields to confirmed fields', () => {
      const result = handler.handleConfirmDesign();

      const state = handler.getState();

      expect(result).toBe(true);
      expect(state.confirmedAgents).toHaveLength(1);
      expect(state.confirmedAgents[0].name).toBe('Planning Agent');
      expect(state.confirmedAgents[0].nameEdited).toBe(true);
      expect(state.confirmedOrchestration).toBe('graph');
      expect(state.confirmedEdges).toHaveLength(1);
      expect(state.confirmedEdges[0].from).toBe('planner');
    });

    it('should make a deep copy of agents to prevent reference issues', () => {
      handler.handleConfirmDesign();

      const state = handler.getState();

      // Modify proposed agent and verify confirmed is not affected
      state.proposedAgents[0].name = 'Modified Name';

      expect(state.confirmedAgents[0].name).toBe('Planning Agent');
    });
  });

  describe('Test 6: AI refinement respects edited flags', () => {
    beforeEach(() => {
      // Setup: Agent with some edited flags
      mockState.proposedAgents = [
        {
          id: 'planner',
          name: 'User Edited Name',
          role: 'Original AI role',
          tools: ['user_added_tool'],
          nameEdited: true,
          roleEdited: false,
          toolsEdited: true,
        },
      ];
      mockState.proposalAccepted = true;
      handler.setState(mockState);
    });

    it('should preserve edited fields when merging AI response', () => {
      // Simulate AI response with new values
      const aiProposal = {
        agents: [
          {
            id: 'planner',
            name: 'AI Generated Name',
            role: 'AI Generated Role',
            tools: ['ai_tool_1', 'ai_tool_2'],
            nameEdited: false,
            roleEdited: false,
            toolsEdited: false,
          },
        ],
      };

      // Apply AI proposal respecting edited flags
      handler.mergeAiProposalRespectingEditedFlags(aiProposal.agents);

      const state = handler.getState();
      const agent = state.proposedAgents.find((a) => a.id === 'planner');

      // Name was edited by user - should NOT be overwritten
      expect(agent?.name).toBe('User Edited Name');

      // Role was NOT edited - should be updated from AI
      expect(agent?.role).toBe('AI Generated Role');

      // Tools were edited by user - should NOT be overwritten
      expect(agent?.tools).toContain('user_added_tool');
      expect(agent?.tools).not.toContain('ai_tool_1');
    });

    it('should update all fields for agents with no edited flags', () => {
      // Setup: Agent with no edits
      mockState.proposedAgents = [
        {
          id: 'planner',
          name: 'Original Name',
          role: 'Original Role',
          tools: ['original_tool'],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
      ];
      handler.setState(mockState);

      const aiProposal = {
        agents: [
          {
            id: 'planner',
            name: 'AI Name',
            role: 'AI Role',
            tools: ['ai_tool'],
            nameEdited: false,
            roleEdited: false,
            toolsEdited: false,
          },
        ],
      };

      handler.mergeAiProposalRespectingEditedFlags(aiProposal.agents);

      const state = handler.getState();
      const agent = state.proposedAgents.find((a) => a.id === 'planner');

      expect(agent?.name).toBe('AI Name');
      expect(agent?.role).toBe('AI Role');
      expect(agent?.tools).toEqual(['ai_tool']);
    });
  });

  // ============================================================================
  // Additional Tests for Edge and Orchestration Methods (Task 2.5)
  // ============================================================================

  describe('Edge and Orchestration Methods', () => {
    beforeEach(() => {
      mockState.proposedAgents = [
        {
          id: 'planner',
          name: 'Planner',
          role: 'Plans',
          tools: [],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
        {
          id: 'executor',
          name: 'Executor',
          role: 'Executes',
          tools: [],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
      ];
      mockState.proposedEdges = [{ from: 'planner', to: 'executor' }];
      handler.setState(mockState);
    });

    it('should add empty edge with handleAddEdge()', () => {
      handler.handleAddEdge();

      const state = handler.getState();
      expect(state.proposedEdges).toHaveLength(2);
      expect(state.proposedEdges[1]).toEqual({ from: '', to: '' });
    });

    it('should remove edge at index with handleRemoveEdge()', () => {
      handler.handleRemoveEdge(0);

      const state = handler.getState();
      expect(state.proposedEdges).toHaveLength(0);
    });

    it('should update edge field with handleUpdateEdge()', () => {
      handler.handleUpdateEdge(0, 'to', 'validator');

      const state = handler.getState();
      expect(state.proposedEdges[0].to).toBe('validator');
    });

    it('should update orchestration with handleUpdateOrchestration()', () => {
      handler.handleUpdateOrchestration('swarm');

      const state = handler.getState();
      expect(state.proposedOrchestration).toBe('swarm');
    });

    it('should apply edge suggestion with handleApplyEdgeSuggestion()', () => {
      mockState.edgeSuggestion = {
        edges: [
          { from: 'planner', to: 'executor' },
          { from: 'executor', to: 'validator' },
        ],
        visible: true,
      };
      handler.setState(mockState);

      handler.handleApplyEdgeSuggestion();

      const state = handler.getState();
      expect(state.proposedEdges).toHaveLength(2);
      expect(state.edgeSuggestion).toBeUndefined();
    });

    it('should dismiss edge suggestion with handleDismissEdgeSuggestion()', () => {
      mockState.edgeSuggestion = {
        edges: [{ from: 'planner', to: 'executor' }],
        visible: true,
      };
      handler.setState(mockState);

      handler.handleDismissEdgeSuggestion();

      const state = handler.getState();
      expect(state.edgeSuggestion).toBeUndefined();
    });
  });

  // ============================================================================
  // Additional Tests for Validation Methods (Task 2.8)
  // ============================================================================

  describe('Validation Helper Methods', () => {
    beforeEach(() => {
      mockState.proposedAgents = [
        {
          id: 'planner',
          name: 'Planner',
          role: 'Plans',
          tools: [],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
        {
          id: 'executor',
          name: 'Executor',
          role: 'Executes',
          tools: [],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
        {
          id: 'orphan',
          name: 'Orphan Agent',
          role: 'No connections',
          tools: [],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
      ];
      mockState.proposedEdges = [{ from: 'planner', to: 'executor' }];
      handler.setState(mockState);
    });

    it('should return orphan agents with getOrphanAgents()', () => {
      const orphans = handler.getOrphanAgents();

      expect(orphans).toHaveLength(1);
      expect(orphans[0].id).toBe('orphan');
    });

    it('should return true for hasEntryPoint() when agent has no incoming edges', () => {
      const result = handler.hasEntryPoint();

      // 'planner' has no incoming edges, so it's an entry point
      expect(result).toBe(true);
    });

    it('should return false for hasEntryPoint() when all agents have incoming edges', () => {
      mockState.proposedEdges = [
        { from: 'planner', to: 'executor' },
        { from: 'executor', to: 'planner' }, // Creates a cycle with no entry point
      ];
      // Remove orphan so all agents are in cycle
      mockState.proposedAgents = mockState.proposedAgents.filter((a) => a.id !== 'orphan');
      handler.setState(mockState);

      const result = handler.hasEntryPoint();

      // Both agents have incoming edges, so no entry point
      expect(result).toBe(false);
    });

    it('should return validation warnings with getValidationWarnings()', () => {
      const warnings = handler.getValidationWarnings();

      expect(warnings).toBeInstanceOf(Array);
      // Should include orphan warning
      const orphanWarning = warnings.find((w) => w.includes('orphan') || w.includes('Orphan'));
      expect(orphanWarning).toBeDefined();
    });
  });

  // ============================================================================
  // Additional Tests for Confirmation Methods (Task 2.6)
  // ============================================================================

  describe('Confirmation Methods', () => {
    beforeEach(() => {
      mockState.proposedAgents = [
        {
          id: 'planner',
          name: 'Planner',
          role: 'Plans',
          tools: ['tool_1'],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
      ];
      mockState.proposedOrchestration = 'workflow';
      mockState.proposedEdges = [{ from: 'planner', to: 'output' }];
      handler.setState(mockState);
    });

    it('should copy proposals to confirmed fields with handleAcceptAndContinue()', () => {
      const result = handler.handleAcceptAndContinue();

      const state = handler.getState();

      expect(result).toBe(true);
      expect(state.confirmedAgents).toHaveLength(1);
      expect(state.confirmedAgents[0].id).toBe('planner');
      expect(state.confirmedOrchestration).toBe('workflow');
      expect(state.confirmedEdges).toHaveLength(1);
    });
  });

  // ============================================================================
  // Additional Tests for Back Navigation (Task 2.5b)
  // ============================================================================

  describe('Back Navigation to Step 5', () => {
    it('should preserve Phase 2 state when navigating back from Step 6', () => {
      // Setup: User has confirmed design
      mockState.proposalAccepted = true;
      mockState.confirmedAgents = [
        {
          id: 'planner',
          name: 'Confirmed Agent',
          role: 'Confirmed role',
          tools: ['confirmed_tool'],
          nameEdited: true,
          roleEdited: false,
          toolsEdited: false,
        },
      ];
      mockState.confirmedOrchestration = 'graph';
      mockState.confirmedEdges = [{ from: 'planner', to: 'executor' }];
      handler.setState(mockState);

      handler.handleBackNavigationToStep5();

      const state = handler.getState();

      // Should stay in Phase 2
      expect(state.proposalAccepted).toBe(true);
      // Confirmed state should be preserved
      expect(state.confirmedAgents).toHaveLength(1);
      expect(state.confirmedOrchestration).toBe('graph');
    });
  });
});
