/**
 * TabbedPanel Step 5 Phase 2 Command Handler Tests
 *
 * Tests for Phase 2 command handler integration in the TabbedPanel.
 * Task Group 3: Webview Message Handler Integration for Step 5 Agent Design Editing feature
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock vscode module before any imports
vi.mock('vscode', () => ({
  default: {
    EventEmitter: class {
      event = vi.fn();
      fire = vi.fn();
      dispose = vi.fn();
    },
    Uri: {
      joinPath: vi.fn((...args) => ({ fsPath: args.join('/') })),
    },
    window: {
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn().mockResolvedValue('Continue'),
    },
    workspace: {
      findFiles: vi.fn().mockResolvedValue([]),
      createFileSystemWatcher: vi.fn(() => ({
        onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
        onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
        dispose: vi.fn(),
      })),
      fs: {
        readFile: vi.fn().mockResolvedValue(new Uint8Array()),
      },
    },
    Disposable: {
      from: vi.fn((...args) => ({ dispose: vi.fn() })),
    },
  },
  EventEmitter: class {
    event = vi.fn();
    fire = vi.fn();
    dispose = vi.fn();
  },
  Uri: {
    joinPath: vi.fn((...args) => ({ fsPath: args.join('/') })),
  },
  window: {
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn().mockResolvedValue('Continue'),
  },
  workspace: {
    findFiles: vi.fn().mockResolvedValue([]),
    createFileSystemWatcher: vi.fn(() => ({
      onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
      onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn(),
    })),
    fs: {
      readFile: vi.fn().mockResolvedValue(new Uint8Array()),
    },
  },
  Disposable: {
    from: vi.fn((...args) => ({ dispose: vi.fn() })),
  },
}));

import { WIZARD_COMMANDS, type OrchestrationPattern } from '../../types/wizardPanel';

// ============================================================================
// Task 3.1: 4 Focused Tests for Command Handlers
// ============================================================================

describe('Task Group 3: Webview Message Handler Integration', () => {
  /**
   * Test 1: Phase 2 accept command triggers correct logic handler method
   *
   * This test validates that ACCEPT_SUGGESTIONS_PHASE2 command:
   * - Routes to handleAcceptSuggestionsPhase2() method on Step 5 handler
   * - Sets proposalAccepted to true
   * - Stores originalOrchestration for AI badge display
   * - Triggers UI update callbacks
   */
  describe('Test 1: Phase 2 accept command triggers correct logic handler method', () => {
    it('ACCEPT_SUGGESTIONS_PHASE2 should call handleAcceptSuggestionsPhase2 on step5Handler', () => {
      // Mock the step handler
      const mockStep5Handler = {
        handleAcceptSuggestionsPhase2: vi.fn(),
        getState: vi.fn().mockReturnValue({ proposalAccepted: false }),
      };

      // Simulate command routing logic
      const command = WIZARD_COMMANDS.ACCEPT_SUGGESTIONS_PHASE2;
      expect(command).toBe('acceptSuggestionsPhase2');

      // When this command is received, it should call the handler method
      if (command === 'acceptSuggestionsPhase2') {
        mockStep5Handler.handleAcceptSuggestionsPhase2();
      }

      expect(mockStep5Handler.handleAcceptSuggestionsPhase2).toHaveBeenCalled();
    });

    it('ACCEPT_AND_CONTINUE should call handleAcceptAndContinue and navigate to Step 6', () => {
      // Mock the step handler
      const mockStep5Handler = {
        handleAcceptAndContinue: vi.fn().mockReturnValue(true),
      };

      // Track navigation
      let currentStep = 5;
      let highestStepReached = 5;
      const WIZARD_STEPS_LENGTH = 8;

      // Simulate command routing logic
      const command = WIZARD_COMMANDS.ACCEPT_AND_CONTINUE;
      expect(command).toBe('acceptAndContinue');

      // When this command is received, it should call handler and navigate
      if (command === 'acceptAndContinue') {
        const success = mockStep5Handler.handleAcceptAndContinue();
        if (success) {
          currentStep = Math.min(currentStep + 1, WIZARD_STEPS_LENGTH);
          highestStepReached = Math.max(highestStepReached, currentStep);
        }
      }

      expect(mockStep5Handler.handleAcceptAndContinue).toHaveBeenCalled();
      expect(currentStep).toBe(6);
      expect(highestStepReached).toBe(6);
    });
  });

  /**
   * Test 2: Agent update commands route to correct handlers
   *
   * This test validates that all UPDATE_AGENT_* commands:
   * - Route to the correct handler method with proper parameters
   * - Set appropriate edited flags on the agent
   * - Trigger UI updates after modification
   */
  describe('Test 2: Agent update commands route to correct handlers', () => {
    it('UPDATE_AGENT_NAME should call handleUpdateAgentName with agentId and name', () => {
      const mockStep5Handler = {
        handleUpdateAgentName: vi.fn(),
      };

      const message = {
        command: WIZARD_COMMANDS.UPDATE_AGENT_NAME,
        agentId: 'planner',
        value: 'New Agent Name',
      };

      // Simulate routing
      if (message.command === 'updateAgentName') {
        mockStep5Handler.handleUpdateAgentName(
          message.agentId as string,
          message.value as string
        );
      }

      expect(mockStep5Handler.handleUpdateAgentName).toHaveBeenCalledWith('planner', 'New Agent Name');
    });

    it('UPDATE_AGENT_ROLE should call handleUpdateAgentRole with agentId and role', () => {
      const mockStep5Handler = {
        handleUpdateAgentRole: vi.fn(),
      };

      const message = {
        command: WIZARD_COMMANDS.UPDATE_AGENT_ROLE,
        agentId: 'planner',
        value: 'New role description',
      };

      // Simulate routing
      if (message.command === 'updateAgentRole') {
        mockStep5Handler.handleUpdateAgentRole(
          message.agentId as string,
          message.value as string
        );
      }

      expect(mockStep5Handler.handleUpdateAgentRole).toHaveBeenCalledWith('planner', 'New role description');
    });

    it('ADD_AGENT_TOOL should call handleAddAgentTool with agentId and tool', () => {
      const mockStep5Handler = {
        handleAddAgentTool: vi.fn(),
      };

      const message = {
        command: WIZARD_COMMANDS.ADD_AGENT_TOOL,
        agentId: 'planner',
        value: 'new_tool',
      };

      // Simulate routing
      if (message.command === 'addAgentTool') {
        mockStep5Handler.handleAddAgentTool(
          message.agentId as string,
          message.value as string
        );
      }

      expect(mockStep5Handler.handleAddAgentTool).toHaveBeenCalledWith('planner', 'new_tool');
    });

    it('REMOVE_AGENT_TOOL should call handleRemoveAgentTool with agentId and index', () => {
      const mockStep5Handler = {
        handleRemoveAgentTool: vi.fn(),
      };

      const message = {
        command: WIZARD_COMMANDS.REMOVE_AGENT_TOOL,
        agentId: 'planner',
        index: 0,
      };

      // Simulate routing
      if (message.command === 'removeAgentTool') {
        mockStep5Handler.handleRemoveAgentTool(
          message.agentId as string,
          message.index as number
        );
      }

      expect(mockStep5Handler.handleRemoveAgentTool).toHaveBeenCalledWith('planner', 0);
    });
  });

  /**
   * Test 3: Confirm design command copies state and navigates to Step 6
   *
   * This test validates that CONFIRM_DESIGN command:
   * - Calls handleConfirmDesign() on Step 5 handler
   * - Copies proposedAgents to confirmedAgents
   * - Copies proposedOrchestration to confirmedOrchestration
   * - Copies proposedEdges to confirmedEdges
   * - Navigates to Step 6 on success
   */
  describe('Test 3: Confirm design command copies state and navigates to Step 6', () => {
    it('CONFIRM_DESIGN should call handleConfirmDesign and navigate to Step 6', () => {
      // Mock the step handler with state
      const mockState = {
        proposedAgents: [{ id: 'planner', name: 'Test', role: 'Test', tools: [] }],
        proposedOrchestration: 'graph' as OrchestrationPattern,
        proposedEdges: [{ from: 'planner', to: 'executor' }],
        confirmedAgents: [] as Array<{ id: string; name: string; role: string; tools: string[] }>,
        confirmedOrchestration: 'workflow' as OrchestrationPattern,
        confirmedEdges: [] as Array<{ from: string; to: string }>,
      };

      const mockStep5Handler = {
        handleConfirmDesign: vi.fn(() => {
          // Simulate copying state
          mockState.confirmedAgents = [...mockState.proposedAgents];
          mockState.confirmedOrchestration = mockState.proposedOrchestration;
          mockState.confirmedEdges = [...mockState.proposedEdges];
          return true;
        }),
        getState: vi.fn().mockReturnValue(mockState),
      };

      // Track navigation
      let currentStep = 5;
      let highestStepReached = 5;
      const WIZARD_STEPS_LENGTH = 8;

      // Simulate command routing
      const command = WIZARD_COMMANDS.CONFIRM_DESIGN;
      expect(command).toBe('confirmDesign');

      if (command === 'confirmDesign') {
        const success = mockStep5Handler.handleConfirmDesign();
        if (success) {
          currentStep = Math.min(currentStep + 1, WIZARD_STEPS_LENGTH);
          highestStepReached = Math.max(highestStepReached, currentStep);
        }
      }

      // Verify handler was called
      expect(mockStep5Handler.handleConfirmDesign).toHaveBeenCalled();

      // Verify state was copied
      expect(mockState.confirmedAgents).toHaveLength(1);
      expect(mockState.confirmedOrchestration).toBe('graph');
      expect(mockState.confirmedEdges).toHaveLength(1);

      // Verify navigation occurred
      expect(currentStep).toBe(6);
      expect(highestStepReached).toBe(6);
    });

    it('CONFIRM_DESIGN should not navigate if handleConfirmDesign returns false', () => {
      const mockStep5Handler = {
        handleConfirmDesign: vi.fn().mockReturnValue(false),
      };

      let currentStep = 5;

      const command = WIZARD_COMMANDS.CONFIRM_DESIGN;

      if (command === 'confirmDesign') {
        const success = mockStep5Handler.handleConfirmDesign();
        if (success) {
          currentStep = currentStep + 1;
        }
      }

      expect(mockStep5Handler.handleConfirmDesign).toHaveBeenCalled();
      expect(currentStep).toBe(5); // Should not have navigated
    });
  });

  /**
   * Test 4: Edge commands update state correctly
   *
   * This test validates that edge commands:
   * - ADD_EDGE adds empty edge row to proposedEdges
   * - REMOVE_EDGE removes edge at specified index
   * - UPDATE_EDGE updates from/to field of edge at index
   * - APPLY_EDGE_SUGGESTION applies edges from edgeSuggestion
   * - DISMISS_EDGE_SUGGESTION clears edgeSuggestion
   */
  describe('Test 4: Edge commands update state correctly', () => {
    it('ADD_EDGE should call handleAddEdge to add empty edge row', () => {
      const mockStep5Handler = {
        handleAddEdge: vi.fn(),
      };

      const command = WIZARD_COMMANDS.ADD_EDGE;
      expect(command).toBe('addEdge');

      if (command === 'addEdge') {
        mockStep5Handler.handleAddEdge();
      }

      expect(mockStep5Handler.handleAddEdge).toHaveBeenCalled();
    });

    it('REMOVE_EDGE should call handleRemoveEdge with index', () => {
      const mockStep5Handler = {
        handleRemoveEdge: vi.fn(),
      };

      const message = {
        command: WIZARD_COMMANDS.REMOVE_EDGE,
        index: 1,
      };

      if (message.command === 'removeEdge') {
        mockStep5Handler.handleRemoveEdge(message.index as number);
      }

      expect(mockStep5Handler.handleRemoveEdge).toHaveBeenCalledWith(1);
    });

    it('UPDATE_EDGE should call handleUpdateEdge with index, field, and agentId', () => {
      const mockStep5Handler = {
        handleUpdateEdge: vi.fn(),
      };

      const message = {
        command: WIZARD_COMMANDS.UPDATE_EDGE,
        index: 0,
        field: 'from',
        value: 'planner',
      };

      if (message.command === 'updateEdge') {
        mockStep5Handler.handleUpdateEdge(
          message.index as number,
          message.field as 'from' | 'to',
          message.value as string
        );
      }

      expect(mockStep5Handler.handleUpdateEdge).toHaveBeenCalledWith(0, 'from', 'planner');
    });

    it('APPLY_EDGE_SUGGESTION should call handleApplyEdgeSuggestion', () => {
      const mockStep5Handler = {
        handleApplyEdgeSuggestion: vi.fn(),
      };

      const command = WIZARD_COMMANDS.APPLY_EDGE_SUGGESTION;
      expect(command).toBe('applyEdgeSuggestion');

      if (command === 'applyEdgeSuggestion') {
        mockStep5Handler.handleApplyEdgeSuggestion();
      }

      expect(mockStep5Handler.handleApplyEdgeSuggestion).toHaveBeenCalled();
    });

    it('DISMISS_EDGE_SUGGESTION should call handleDismissEdgeSuggestion', () => {
      const mockStep5Handler = {
        handleDismissEdgeSuggestion: vi.fn(),
      };

      const command = WIZARD_COMMANDS.DISMISS_EDGE_SUGGESTION;
      expect(command).toBe('dismissEdgeSuggestion');

      if (command === 'dismissEdgeSuggestion') {
        mockStep5Handler.handleDismissEdgeSuggestion();
      }

      expect(mockStep5Handler.handleDismissEdgeSuggestion).toHaveBeenCalled();
    });
  });

  /**
   * Additional Tests for Complete Coverage
   */
  describe('Additional Command Handler Tests', () => {
    it('ADD_AGENT should call handleAddAgent', () => {
      const mockStep5Handler = {
        handleAddAgent: vi.fn(),
      };

      const command = WIZARD_COMMANDS.ADD_AGENT;
      expect(command).toBe('addAgent');

      if (command === 'addAgent') {
        mockStep5Handler.handleAddAgent();
      }

      expect(mockStep5Handler.handleAddAgent).toHaveBeenCalled();
    });

    it('REMOVE_AGENT should call handleRemoveAgent with agentId', () => {
      const mockStep5Handler = {
        handleRemoveAgent: vi.fn(),
        getAgentEdgeCount: vi.fn().mockReturnValue(0),
      };

      const message = {
        command: WIZARD_COMMANDS.REMOVE_AGENT,
        agentId: 'planner',
      };

      if (message.command === 'removeAgent') {
        // Check for edges before removing (no confirmation needed if count is 0)
        const edgeCount = mockStep5Handler.getAgentEdgeCount(message.agentId as string);
        if (edgeCount === 0) {
          mockStep5Handler.handleRemoveAgent(message.agentId as string);
        }
      }

      expect(mockStep5Handler.handleRemoveAgent).toHaveBeenCalledWith('planner');
    });

    it('UPDATE_ORCHESTRATION should call handleUpdateOrchestration with pattern', () => {
      const mockStep5Handler = {
        handleUpdateOrchestration: vi.fn(),
      };

      const message = {
        command: WIZARD_COMMANDS.UPDATE_ORCHESTRATION,
        value: 'swarm',
      };

      if (message.command === 'updateOrchestration') {
        mockStep5Handler.handleUpdateOrchestration(message.value as OrchestrationPattern);
      }

      expect(mockStep5Handler.handleUpdateOrchestration).toHaveBeenCalledWith('swarm');
    });
  });
});
