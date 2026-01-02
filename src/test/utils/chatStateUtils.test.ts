/**
 * Tests for Chat State Utilities
 * Task Group 1: State Management Layer
 *
 * Tests for chat state interfaces and manipulation utilities
 * for the Demo Viewer chat UI.
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialChatState,
  addUserMessage,
  addAgentMessage,
  appendToStreamingContent,
  finalizeAgentMessage,
  updatePipelineStage,
  resetChatState,
  addErrorMessage,
  hasActiveStreaming,
  determineMessagePane,
  addHandoffMessage,
} from '../../utils/chatStateUtils';
import type {
  ChatMessage,
  ChatSessionState,
  AgentPipelineStage,
} from '../../types/chatPanel';

// ============================================================================
// Task 1.1: 4 Focused Tests for State Management Layer
// ============================================================================

describe('Task Group 1: Chat State Types and Data Structures', () => {
  describe('Test 1: ChatMessage interface creation with required fields', () => {
    it('should create a user message with all required fields', () => {
      const state = createInitialChatState();
      const updatedState = addUserMessage(state, 'Test prompt');

      const message = updatedState.messages[0];
      expect(message).toBeDefined();
      expect(message.id).toMatch(/^msg-[0-9a-f]{8}$/);
      expect(message.role).toBe('user');
      expect(message.content).toBe('Test prompt');
      expect(message.timestamp).toBeGreaterThan(0);
      expect(message.isStreaming).toBe(false);
    });

    it('should create an agent message with agent name and streaming flag', () => {
      const state = createInitialChatState();
      const updatedState = addAgentMessage(state, 'Triage Agent', 'conversation');

      const message = updatedState.messages[0];
      expect(message).toBeDefined();
      expect(message.id).toMatch(/^msg-[0-9a-f]{8}$/);
      expect(message.role).toBe('agent');
      expect(message.agentName).toBe('Triage Agent');
      expect(message.content).toBe('');
      expect(message.isStreaming).toBe(true);
    });

    it('should increment turn count when adding user message', () => {
      const state = createInitialChatState();
      expect(state.turnCount).toBe(0);

      const stateAfterFirst = addUserMessage(state, 'First prompt');
      expect(stateAfterFirst.turnCount).toBe(1);
    });
  });

  describe('Test 2: AgentPipelineStage interface with stage tracking', () => {
    it('should add a new pipeline stage with pending status', () => {
      const state = createInitialChatState();
      const updatedState = updatePipelineStage(state, 'Triage', 'pending');

      expect(updatedState.pipelineStages).toHaveLength(1);
      expect(updatedState.pipelineStages[0].name).toBe('Triage');
      expect(updatedState.pipelineStages[0].status).toBe('pending');
    });

    it('should update existing pipeline stage status', () => {
      let state = createInitialChatState();
      state = updatePipelineStage(state, 'Triage', 'pending');
      state = updatePipelineStage(state, 'Triage', 'active');

      expect(state.pipelineStages).toHaveLength(1);
      expect(state.pipelineStages[0].status).toBe('active');
    });

    it('should track multiple agents in pipeline', () => {
      let state = createInitialChatState();
      state = updatePipelineStage(state, 'Triage', 'completed');
      state = updatePipelineStage(state, 'Technical', 'active');
      state = updatePipelineStage(state, 'Output', 'pending');

      expect(state.pipelineStages).toHaveLength(3);
      expect(state.pipelineStages[0]).toEqual({ name: 'Triage', status: 'completed' });
      expect(state.pipelineStages[1]).toEqual({ name: 'Technical', status: 'active' });
      expect(state.pipelineStages[2]).toEqual({ name: 'Output', status: 'pending' });
    });
  });

  describe('Test 3: ChatSessionState interface initialization via createInitialChatState()', () => {
    it('should initialize with generated workflow_id in short format', () => {
      const state = createInitialChatState();
      expect(state.workflowId).toMatch(/^wf-[a-f0-9]{8}$/);
    });

    it('should initialize with generated session_id', () => {
      const state = createInitialChatState();
      expect(state.sessionId).toMatch(/^ses-[0-9a-f]{8}$/);
    });

    it('should initialize with default values for all fields', () => {
      const state = createInitialChatState();

      expect(state.turnCount).toBe(0);
      expect(state.startTime).toBe(0);
      expect(state.messages).toEqual([]);
      expect(state.pipelineStages).toEqual([]);
      expect(state.activeAgentName).toBeNull();
      expect(state.streamingContent).toBe('');
    });

    it('should generate unique IDs on each call', () => {
      const state1 = createInitialChatState();
      const state2 = createInitialChatState();

      expect(state1.workflowId).not.toBe(state2.workflowId);
      expect(state1.sessionId).not.toBe(state2.sessionId);
    });
  });

  describe('Test 4: State utilities correctly manipulate messages and streaming content', () => {
    it('should accumulate streaming tokens with appendToStreamingContent()', () => {
      let state = createInitialChatState();
      state = addAgentMessage(state, 'Technical Agent', 'conversation');

      state = appendToStreamingContent(state, 'Hello ');
      expect(state.streamingContent).toBe('Hello ');

      state = appendToStreamingContent(state, 'world!');
      expect(state.streamingContent).toBe('Hello world!');
    });

    it('should finalize agent message by moving streaming content', () => {
      let state = createInitialChatState();
      state = addAgentMessage(state, 'Technical Agent', 'conversation');
      state = appendToStreamingContent(state, 'Analysis complete.');

      expect(state.messages[0].isStreaming).toBe(true);
      expect(state.messages[0].content).toBe('');

      state = finalizeAgentMessage(state);

      expect(state.messages[0].isStreaming).toBe(false);
      expect(state.messages[0].content).toBe('Analysis complete.');
      expect(state.activeAgentName).toBeNull();
      expect(state.streamingContent).toBe('');
    });

    it('should reset state correctly with resetChatState()', () => {
      let state = createInitialChatState();
      const originalWorkflowId = state.workflowId;

      state = addUserMessage(state, 'Test');
      state = addAgentMessage(state, 'Agent', 'conversation');
      state = updatePipelineStage(state, 'Triage', 'completed');

      const resetState = resetChatState();

      expect(resetState.workflowId).not.toBe(originalWorkflowId);
      expect(resetState.messages).toEqual([]);
      expect(resetState.pipelineStages).toEqual([]);
      expect(resetState.turnCount).toBe(0);
    });

    it('should add error message correctly', () => {
      let state = createInitialChatState();
      state = addErrorMessage(state, 'Workflow failed');

      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].role).toBe('agent');
      expect(state.messages[0].agentName).toBe('System');
      expect(state.messages[0].content).toBe('Error: Workflow failed');
      expect(state.messages[0].isStreaming).toBe(false);
    });

    it('should track active streaming state correctly', () => {
      let state = createInitialChatState();
      expect(hasActiveStreaming(state)).toBe(false);

      state = addAgentMessage(state, 'Agent', 'conversation');
      expect(hasActiveStreaming(state)).toBe(true);

      state = finalizeAgentMessage(state);
      expect(hasActiveStreaming(state)).toBe(false);
    });
  });
});

// ============================================================================
// Task 4.1: 5-7 Focused Tests for Message Routing and State Management
// ============================================================================

describe('Task Group 4: Message Routing and State Management', () => {
  describe('Test 1: User messages always route to conversation pane', () => {
    it('should always set pane to conversation for user messages', () => {
      const state = createInitialChatState();
      const updatedState = addUserMessage(state, 'Hello agent');

      expect(updatedState.messages[0].pane).toBe('conversation');
    });

    it('should route multiple user messages to conversation pane', () => {
      let state = createInitialChatState();
      state = addUserMessage(state, 'First message');
      state = addUserMessage(state, 'Second message');

      expect(state.messages[0].pane).toBe('conversation');
      expect(state.messages[1].pane).toBe('conversation');
    });
  });

  describe('Test 2: determineMessagePane helper function', () => {
    it('should return conversation when fromAgent is null', () => {
      const pane = determineMessagePane(null);
      expect(pane).toBe('conversation');
    });

    it('should return collaboration when fromAgent is a string', () => {
      const pane = determineMessagePane('Triage Agent');
      expect(pane).toBe('collaboration');
    });

    it('should return collaboration for any non-null fromAgent', () => {
      expect(determineMessagePane('Agent A')).toBe('collaboration');
      expect(determineMessagePane('Coordinator')).toBe('collaboration');
      expect(determineMessagePane('')).toBe('collaboration');
    });
  });

  describe('Test 3: addAgentMessage routes to correct pane based on parameter', () => {
    it('should route agent message to conversation pane when pane is conversation', () => {
      const state = createInitialChatState();
      const updatedState = addAgentMessage(state, 'Entry Agent', 'conversation');

      expect(updatedState.messages[0].pane).toBe('conversation');
      expect(updatedState.activeMessagePane).toBe('conversation');
    });

    it('should route agent message to collaboration pane when pane is collaboration', () => {
      const state = createInitialChatState();
      const updatedState = addAgentMessage(state, 'Internal Agent', 'collaboration');

      expect(updatedState.messages[0].pane).toBe('collaboration');
      expect(updatedState.activeMessagePane).toBe('collaboration');
    });

    it('should set activeMessagePane to match the pane parameter', () => {
      let state = createInitialChatState();

      state = addAgentMessage(state, 'Agent 1', 'conversation');
      expect(state.activeMessagePane).toBe('conversation');

      state = finalizeAgentMessage(state);
      state = addAgentMessage(state, 'Agent 2', 'collaboration');
      expect(state.activeMessagePane).toBe('collaboration');
    });
  });

  describe('Test 4: addHandoffMessage creates sender-style message in collaboration pane', () => {
    it('should create a handoff message with sender agent name', () => {
      const state = createInitialChatState();
      const updatedState = addHandoffMessage(state, 'Triage Agent', 'Please analyze this data');

      expect(updatedState.messages).toHaveLength(1);
      expect(updatedState.messages[0].agentName).toBe('Triage Agent');
      expect(updatedState.messages[0].content).toBe('Please analyze this data');
    });

    it('should set isSender flag to true for handoff messages', () => {
      const state = createInitialChatState();
      const updatedState = addHandoffMessage(state, 'Coordinator', 'Handle this request');

      expect(updatedState.messages[0].isSender).toBe(true);
    });

    it('should route handoff messages to collaboration pane', () => {
      const state = createInitialChatState();
      const updatedState = addHandoffMessage(state, 'Agent A', 'Handoff prompt');

      expect(updatedState.messages[0].pane).toBe('collaboration');
    });

    it('should set role to agent for handoff messages', () => {
      const state = createInitialChatState();
      const updatedState = addHandoffMessage(state, 'Agent', 'Prompt');

      expect(updatedState.messages[0].role).toBe('agent');
    });

    it('should not set isStreaming for handoff messages', () => {
      const state = createInitialChatState();
      const updatedState = addHandoffMessage(state, 'Agent', 'Prompt');

      expect(updatedState.messages[0].isStreaming).toBe(false);
    });
  });

  describe('Test 5: Initial state includes entryAgentName and activeMessagePane', () => {
    it('should initialize entryAgentName to null', () => {
      const state = createInitialChatState();
      expect(state.entryAgentName).toBeNull();
    });

    it('should initialize activeMessagePane to null', () => {
      const state = createInitialChatState();
      expect(state.activeMessagePane).toBeNull();
    });

    it('should reset entryAgentName and activeMessagePane on state reset', () => {
      let state = createInitialChatState();
      state = {
        ...state,
        entryAgentName: 'Some Agent',
        activeMessagePane: 'collaboration',
      };

      const resetState = resetChatState();

      expect(resetState.entryAgentName).toBeNull();
      expect(resetState.activeMessagePane).toBeNull();
    });
  });

  describe('Test 6: Complete pane routing flow simulation', () => {
    it('should correctly route messages in a multi-agent workflow', () => {
      let state = createInitialChatState();

      // User sends message -> conversation pane
      state = addUserMessage(state, 'Analyze this data');
      expect(state.messages[0].pane).toBe('conversation');

      // Entry agent response (from_agent === null) -> conversation pane
      const entryPane = determineMessagePane(null);
      state = addAgentMessage(state, 'Triage Agent', entryPane);
      state = appendToStreamingContent(state, 'Routing to technical...');
      state = finalizeAgentMessage(state);
      expect(state.messages[1].pane).toBe('conversation');

      // Handoff prompt -> collaboration pane
      state = addHandoffMessage(state, 'Triage Agent', 'Please perform technical analysis');
      expect(state.messages[2].pane).toBe('collaboration');
      expect(state.messages[2].isSender).toBe(true);

      // Internal agent response (from_agent !== null) -> collaboration pane
      const internalPane = determineMessagePane('Triage Agent');
      state = addAgentMessage(state, 'Technical Agent', internalPane);
      state = appendToStreamingContent(state, 'Analysis complete.');
      state = finalizeAgentMessage(state);
      expect(state.messages[3].pane).toBe('collaboration');

      // Verify message count and pane distribution
      expect(state.messages).toHaveLength(4);
      const conversationMessages = state.messages.filter(m => m.pane === 'conversation');
      const collaborationMessages = state.messages.filter(m => m.pane === 'collaboration');
      expect(conversationMessages).toHaveLength(2);
      expect(collaborationMessages).toHaveLength(2);
    });
  });

  describe('Test 7: activeMessagePane tracks streaming message pane', () => {
    it('should clear activeMessagePane when message is finalized', () => {
      let state = createInitialChatState();
      state = addAgentMessage(state, 'Agent', 'conversation');
      expect(state.activeMessagePane).toBe('conversation');

      state = finalizeAgentMessage(state);
      expect(state.activeMessagePane).toBeNull();
    });

    it('should track correct pane during streaming in collaboration', () => {
      let state = createInitialChatState();
      state = addAgentMessage(state, 'Internal Agent', 'collaboration');

      expect(state.activeMessagePane).toBe('collaboration');

      state = appendToStreamingContent(state, 'Token 1');
      expect(state.activeMessagePane).toBe('collaboration');

      state = appendToStreamingContent(state, ' Token 2');
      expect(state.activeMessagePane).toBe('collaboration');
    });
  });
});
