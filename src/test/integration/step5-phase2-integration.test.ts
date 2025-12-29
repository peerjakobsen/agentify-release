/**
 * Integration Tests for Step 5 Phase 2: Agent Design Editing
 *
 * Task Group 6: Test Review and Integration Verification
 * Strategic integration tests covering critical user workflows
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode module
vi.mock('vscode', () => {
  return {
    workspace: {
      fs: {
        readFile: vi.fn(),
      },
      findFiles: vi.fn().mockResolvedValue([]),
      createFileSystemWatcher: vi.fn().mockReturnValue({
        onDidCreate: vi.fn().mockReturnValue({ dispose: () => {} }),
        onDidDelete: vi.fn().mockReturnValue({ dispose: () => {} }),
        dispose: () => {},
      }),
    },
    Uri: {
      joinPath: (...args: unknown[]) => {
        const paths = args.map((arg) => (typeof arg === 'string' ? arg : (arg as { fsPath: string }).fsPath || ''));
        return { fsPath: paths.join('/') };
      },
    },
    EventEmitter: class MockEventEmitter {
      private handlers: Array<(e: unknown) => void> = [];
      event = (handler: (e: unknown) => void) => {
        this.handlers.push(handler);
        return { dispose: () => {} };
      };
      fire = (e: unknown) => this.handlers.forEach((h) => h(e));
      dispose = () => { this.handlers = []; };
    },
    Disposable: {
      from: (...disposables: unknown[]) => ({
        dispose: () => disposables.forEach((d) => (d as { dispose: () => void }).dispose?.()),
      }),
    },
    window: {
      showWarningMessage: vi.fn().mockResolvedValue('Continue'),
    },
  };
});

// Import types and utilities
import {
  createDefaultAgentDesignState,
  type AgentDesignState,
  type ProposedAgent,
  type ProposedEdge,
  type OrchestrationPattern,
} from '../../types/wizardPanel';
import { Step5LogicHandler } from '../../panels/ideationStep5Logic';

// ============================================================================
// Task Group 6: Strategic Integration Tests (7 tests to fill gaps)
// ============================================================================

describe('Task Group 6: Step 5 Phase 2 Integration Tests', () => {
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

  /**
   * Test 1: Full Phase 1 -> Phase 2 -> Confirm Design workflow
   *
   * This test validates the complete user journey from receiving an AI proposal
   * through accepting it, editing agents, and confirming the design.
   */
  describe('Test 1: Full Phase 1 -> Phase 2 -> Confirm Design workflow', () => {
    it('should complete full workflow: AI proposal -> Accept -> Edit -> Confirm', () => {
      // 1. Initial state is fresh (Phase 1)
      const state = handler.getState();
      expect(state.proposalAccepted).toBe(false);
      expect(state.proposedAgents).toEqual([]);

      // 2. Simulate AI generates proposal (from service)
      handler.setState({
        ...state,
        proposedAgents: [
          {
            id: 'planner',
            name: 'Planning Agent',
            role: 'Coordinates workflow planning',
            tools: ['sap_get_inventory'],
            nameEdited: false,
            roleEdited: false,
            toolsEdited: false,
          },
          {
            id: 'executor',
            name: 'Execution Agent',
            role: 'Executes tasks',
            tools: ['salesforce_update'],
            nameEdited: false,
            roleEdited: false,
            toolsEdited: false,
          },
        ],
        proposedOrchestration: 'workflow',
        proposedEdges: [{ from: 'planner', to: 'executor' }],
        orchestrationReasoning: 'Workflow pattern for linear process',
        aiCalled: true,
      });

      // Still in Phase 1 (not accepted yet)
      expect(handler.getState().proposalAccepted).toBe(false);

      // 3. User clicks "Accept Suggestions" - transition to Phase 2
      handler.handleAcceptSuggestionsPhase2();
      expect(handler.getState().proposalAccepted).toBe(true);
      expect(handler.getState().originalOrchestration).toBe('workflow');

      // 4. User edits agent name in Phase 2
      handler.handleUpdateAgentName('planner', 'Order Processing Agent');
      const agentAfterEdit = handler.getState().proposedAgents.find((a) => a.id === 'planner');
      expect(agentAfterEdit?.name).toBe('Order Processing Agent');
      expect(agentAfterEdit?.nameEdited).toBe(true);

      // 5. User adds a tool
      handler.handleAddAgentTool('planner', 'erp_validate_order');
      expect(handler.getState().proposedAgents.find((a) => a.id === 'planner')?.tools).toContain('erp_validate_order');

      // 6. User confirms design
      const success = handler.handleConfirmDesign();
      expect(success).toBe(true);

      // 7. Verify confirmed state is populated
      const finalState = handler.getState();
      expect(finalState.confirmedAgents).toHaveLength(2);
      expect(finalState.confirmedAgents[0].name).toBe('Order Processing Agent');
      expect(finalState.confirmedOrchestration).toBe('workflow');
      expect(finalState.confirmedEdges).toHaveLength(1);
    });
  });

  /**
   * Test 2: Back-navigation from Step 6 returns to Phase 2 with confirmed state preserved
   *
   * When user navigates back from Step 6, they should return to Phase 2 editing mode
   * with all their confirmed state intact.
   */
  describe('Test 2: Back-navigation from Step 6 preserves Phase 2 state', () => {
    it('should preserve Phase 2 state when navigating back from Step 6', () => {
      // Setup: User has completed Phase 2 and confirmed design
      mockState.proposalAccepted = true;
      mockState.proposedAgents = [
        {
          id: 'planner',
          name: 'User Edited Agent',
          role: 'Custom role',
          tools: ['custom_tool'],
          nameEdited: true,
          roleEdited: true,
          toolsEdited: true,
        },
      ];
      mockState.proposedOrchestration = 'graph';
      mockState.proposedEdges = [{ from: 'planner', to: 'executor' }];
      mockState.confirmedAgents = [
        {
          id: 'planner',
          name: 'User Edited Agent',
          role: 'Custom role',
          tools: ['custom_tool'],
          nameEdited: true,
          roleEdited: true,
          toolsEdited: true,
        },
      ];
      mockState.confirmedOrchestration = 'graph';
      mockState.confirmedEdges = [{ from: 'planner', to: 'executor' }];
      mockState.originalOrchestration = 'workflow';
      handler.setState(mockState);

      // Simulate back navigation from Step 6
      handler.handleBackNavigationToStep5();

      const state = handler.getState();

      // Should remain in Phase 2
      expect(state.proposalAccepted).toBe(true);

      // Confirmed state should be preserved
      expect(state.confirmedAgents).toHaveLength(1);
      expect(state.confirmedAgents[0].name).toBe('User Edited Agent');
      expect(state.confirmedOrchestration).toBe('graph');

      // Proposed state (editable) should be preserved
      expect(state.proposedAgents[0].nameEdited).toBe(true);
    });

    it('should NOT reset to Phase 1 on back navigation', () => {
      // Setup: Confirmed design exists
      mockState.proposalAccepted = true;
      mockState.confirmedAgents = [
        {
          id: 'test',
          name: 'Test',
          role: 'Test',
          tools: [],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
      ];
      handler.setState(mockState);

      handler.handleBackNavigationToStep5();

      // proposalAccepted should still be true
      expect(handler.getState().proposalAccepted).toBe(true);
    });
  });

  /**
   * Test 3: AI regeneration does not overwrite edited agent fields
   *
   * When user requests AI refinement in Phase 2, any fields they have manually
   * edited (nameEdited, roleEdited, toolsEdited) should be protected.
   */
  describe('Test 3: AI regeneration respects edited agent fields', () => {
    it('should NOT overwrite user-edited fields during AI regeneration', () => {
      // Setup: Phase 2 with user edits
      mockState.proposalAccepted = true;
      mockState.proposedAgents = [
        {
          id: 'planner',
          name: 'User Custom Name', // User edited this
          role: 'Original AI Role', // Not edited
          tools: ['user_added_tool'], // User edited this
          nameEdited: true,
          roleEdited: false,
          toolsEdited: true,
        },
      ];
      handler.setState(mockState);

      // Simulate AI response with new values
      const aiProposal: ProposedAgent[] = [
        {
          id: 'planner',
          name: 'AI Generated Name',
          role: 'AI Generated Role',
          tools: ['ai_tool_1', 'ai_tool_2'],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
      ];

      handler.mergeAiProposalRespectingEditedFlags(aiProposal);

      const state = handler.getState();
      const agent = state.proposedAgents.find((a) => a.id === 'planner');

      // Name was edited - should be preserved
      expect(agent?.name).toBe('User Custom Name');

      // Role was NOT edited - should be updated from AI
      expect(agent?.role).toBe('AI Generated Role');

      // Tools were edited - should be preserved
      expect(agent?.tools).toContain('user_added_tool');
      expect(agent?.tools).not.toContain('ai_tool_1');
    });

    it('should update all fields for unedited agents', () => {
      // Setup: Agent with no edits
      mockState.proposalAccepted = true;
      mockState.proposedAgents = [
        {
          id: 'executor',
          name: 'Original Name',
          role: 'Original Role',
          tools: ['original_tool'],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
      ];
      handler.setState(mockState);

      const aiProposal: ProposedAgent[] = [
        {
          id: 'executor',
          name: 'AI Name',
          role: 'AI Role',
          tools: ['ai_tool'],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
      ];

      handler.mergeAiProposalRespectingEditedFlags(aiProposal);

      const agent = handler.getState().proposedAgents.find((a) => a.id === 'executor');

      // All fields should be updated since none were edited
      expect(agent?.name).toBe('AI Name');
      expect(agent?.role).toBe('AI Role');
      expect(agent?.tools).toEqual(['ai_tool']);
    });
  });

  /**
   * Test 4: Removing all edges then adding new ones
   *
   * User should be able to clear all edges and build a new edge configuration
   * from scratch without issues.
   */
  describe('Test 4: Removing all edges then adding new ones', () => {
    it('should allow removing all edges and adding new ones', () => {
      // Setup: Existing edges
      mockState.proposalAccepted = true;
      mockState.proposedAgents = [
        { id: 'a', name: 'Agent A', role: 'Role', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
        { id: 'b', name: 'Agent B', role: 'Role', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
        { id: 'c', name: 'Agent C', role: 'Role', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
      ];
      mockState.proposedEdges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ];
      handler.setState(mockState);

      // Remove all edges (in reverse order to avoid index shifting issues)
      handler.handleRemoveEdge(1);
      handler.handleRemoveEdge(0);

      expect(handler.getState().proposedEdges).toHaveLength(0);

      // Add new edges with different configuration
      handler.handleAddEdge();
      handler.handleUpdateEdge(0, 'from', 'c');
      handler.handleUpdateEdge(0, 'to', 'a');

      handler.handleAddEdge();
      handler.handleUpdateEdge(1, 'from', 'a');
      handler.handleUpdateEdge(1, 'to', 'b');

      const finalEdges = handler.getState().proposedEdges;
      expect(finalEdges).toHaveLength(2);
      expect(finalEdges[0]).toEqual({ from: 'c', to: 'a' });
      expect(finalEdges[1]).toEqual({ from: 'a', to: 'b' });
    });
  });

  /**
   * Test 5: Orchestration change -> apply suggestion workflow
   *
   * When user changes orchestration pattern, AI suggests new edges.
   * User can apply or dismiss the suggestion.
   */
  describe('Test 5: Orchestration change -> apply suggestion workflow', () => {
    it('should allow user to apply AI edge suggestions after orchestration change', () => {
      // Setup: Initial state with workflow pattern
      mockState.proposalAccepted = true;
      mockState.proposedAgents = [
        { id: 'a', name: 'A', role: 'R', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
        { id: 'b', name: 'B', role: 'R', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
      ];
      mockState.proposedOrchestration = 'workflow';
      mockState.originalOrchestration = 'workflow';
      mockState.proposedEdges = [{ from: 'a', to: 'b' }];
      handler.setState(mockState);

      // User changes orchestration pattern
      handler.handleUpdateOrchestration('graph');
      expect(handler.getState().proposedOrchestration).toBe('graph');

      // Simulate AI edge suggestion response
      handler.setState({
        ...handler.getState(),
        edgeSuggestion: {
          edges: [
            { from: 'a', to: 'b' },
            { from: 'b', to: 'a', condition: 'feedback' },
          ],
          visible: true,
        },
      });

      // User applies the suggestion
      handler.handleApplyEdgeSuggestion();

      const state = handler.getState();
      expect(state.proposedEdges).toHaveLength(2);
      expect(state.edgeSuggestion).toBeUndefined();
    });

    it('should allow user to dismiss AI edge suggestions', () => {
      // Setup with suggestion
      mockState.proposalAccepted = true;
      mockState.proposedOrchestration = 'swarm';
      mockState.proposedEdges = [{ from: 'x', to: 'y' }];
      mockState.edgeSuggestion = {
        edges: [{ from: 'a', to: 'b' }],
        visible: true,
      };
      handler.setState(mockState);

      // User dismisses the suggestion
      handler.handleDismissEdgeSuggestion();

      const state = handler.getState();
      expect(state.edgeSuggestion).toBeUndefined();
      // Original edges should be preserved
      expect(state.proposedEdges).toEqual([{ from: 'x', to: 'y' }]);
    });
  });

  /**
   * Test 6: Multiple agent additions/removals in sequence
   *
   * User should be able to add and remove multiple agents in sequence
   * without state corruption or ID conflicts.
   */
  describe('Test 6: Multiple agent additions/removals in sequence', () => {
    it('should handle multiple agent additions without ID conflicts', () => {
      // Setup: Start with existing AI-generated agents
      mockState.proposalAccepted = true;
      mockState.proposedAgents = [
        { id: 'planner', name: 'Planner', role: 'Plans', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
      ];
      handler.setState(mockState);

      // Add multiple agents
      handler.handleAddAgent(); // Should be agent_1
      handler.handleAddAgent(); // Should be agent_2
      handler.handleAddAgent(); // Should be agent_3

      const state = handler.getState();
      expect(state.proposedAgents).toHaveLength(4);

      const ids = state.proposedAgents.map((a) => a.id);
      expect(ids).toContain('planner');
      expect(ids).toContain('agent_1');
      expect(ids).toContain('agent_2');
      expect(ids).toContain('agent_3');
    });

    it('should handle mixed add/remove operations correctly', () => {
      // Setup
      mockState.proposalAccepted = true;
      mockState.proposedAgents = [
        { id: 'a', name: 'A', role: 'R', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
        { id: 'b', name: 'B', role: 'R', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
      ];
      mockState.proposedEdges = [{ from: 'a', to: 'b' }];
      handler.setState(mockState);

      // Add one
      handler.handleAddAgent();
      expect(handler.getState().proposedAgents).toHaveLength(3);

      // Remove one (the one with edges)
      handler.handleRemoveAgent('a');
      expect(handler.getState().proposedAgents).toHaveLength(2);
      // Edge should be removed too
      expect(handler.getState().proposedEdges.find((e) => e.from === 'a' || e.to === 'a')).toBeUndefined();

      // Add another
      handler.handleAddAgent();
      expect(handler.getState().proposedAgents).toHaveLength(3);
    });

    it('should generate unique incrementing IDs even after removal', () => {
      // Setup
      mockState.proposalAccepted = true;
      mockState.proposedAgents = [];
      handler.setState(mockState);

      // Add agent_1
      handler.handleAddAgent();
      const firstId = handler.getState().proposedAgents[0].id;
      expect(firstId).toBe('agent_1');

      // Remove agent_1
      handler.handleRemoveAgent('agent_1');
      expect(handler.getState().proposedAgents).toHaveLength(0);

      // Add new agent - the implementation uses incrementing counter to avoid
      // potential issues with stale references, so it generates the next ID
      handler.handleAddAgent();
      expect(handler.getState().proposedAgents).toHaveLength(1);

      // Verify a unique ID is generated (implementation uses incrementing counter)
      const newId = handler.getState().proposedAgents[0].id;
      expect(newId).toMatch(/^agent_\d+$/);

      // Add another agent to verify IDs continue to increment without conflicts
      handler.handleAddAgent();
      expect(handler.getState().proposedAgents).toHaveLength(2);

      const allIds = handler.getState().proposedAgents.map((a) => a.id);
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length); // All IDs are unique
    });
  });

  /**
   * Test 7: Validation warnings appear for various invalid states
   *
   * Validation warnings should be informational and non-blocking.
   * They should appear for orphan agents and missing entry points.
   */
  describe('Test 7: Validation warnings for various invalid states', () => {
    it('should detect orphan agents (agents with no connections)', () => {
      // Setup: Agents where one is not connected
      mockState.proposalAccepted = true;
      mockState.proposedAgents = [
        { id: 'connected1', name: 'C1', role: 'R', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
        { id: 'connected2', name: 'C2', role: 'R', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
        { id: 'orphan', name: 'Orphan', role: 'R', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
      ];
      mockState.proposedEdges = [{ from: 'connected1', to: 'connected2' }];
      handler.setState(mockState);

      const orphans = handler.getOrphanAgents();

      expect(orphans).toHaveLength(1);
      expect(orphans[0].id).toBe('orphan');
    });

    it('should detect missing entry point (all agents have incoming edges)', () => {
      // Setup: Circular dependency with no entry point
      mockState.proposalAccepted = true;
      mockState.proposedAgents = [
        { id: 'a', name: 'A', role: 'R', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
        { id: 'b', name: 'B', role: 'R', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
      ];
      mockState.proposedEdges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' }, // Creates cycle
      ];
      handler.setState(mockState);

      const hasEntry = handler.hasEntryPoint();

      expect(hasEntry).toBe(false);
    });

    it('should return true for hasEntryPoint when valid entry exists', () => {
      // Setup: Valid workflow with entry point
      mockState.proposalAccepted = true;
      mockState.proposedAgents = [
        { id: 'entry', name: 'Entry', role: 'R', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
        { id: 'process', name: 'Process', role: 'R', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
      ];
      mockState.proposedEdges = [{ from: 'entry', to: 'process' }]; // entry has no incoming edges
      handler.setState(mockState);

      const hasEntry = handler.hasEntryPoint();

      expect(hasEntry).toBe(true);
    });

    it('should generate appropriate validation warnings', () => {
      // Setup: Multiple validation issues
      mockState.proposalAccepted = true;
      mockState.proposedAgents = [
        { id: 'a', name: 'A', role: 'R', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
        { id: 'b', name: 'B', role: 'R', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
        { id: 'orphan', name: 'Orphan Agent', role: 'R', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
      ];
      // Circular edges + orphan
      mockState.proposedEdges = [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ];
      handler.setState(mockState);

      const warnings = handler.getValidationWarnings();

      expect(warnings).toBeInstanceOf(Array);
      expect(warnings.length).toBeGreaterThan(0);

      // Should include warning about orphan
      const orphanWarning = warnings.find((w) => w.toLowerCase().includes('orphan'));
      expect(orphanWarning).toBeDefined();
    });

    it('should return empty warnings for valid configuration', () => {
      // Setup: Valid configuration
      mockState.proposalAccepted = true;
      mockState.proposedAgents = [
        { id: 'entry', name: 'Entry', role: 'R', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
        { id: 'exit', name: 'Exit', role: 'R', tools: [], nameEdited: false, roleEdited: false, toolsEdited: false },
      ];
      mockState.proposedEdges = [{ from: 'entry', to: 'exit' }];
      handler.setState(mockState);

      const warnings = handler.getValidationWarnings();

      // Should have no warnings for a valid linear workflow
      expect(warnings).toHaveLength(0);
    });
  });
});
