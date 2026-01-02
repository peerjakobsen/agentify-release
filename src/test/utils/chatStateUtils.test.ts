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
      const updatedState = addAgentMessage(state, 'Triage Agent');

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
      state = addAgentMessage(state, 'Technical Agent');

      state = appendToStreamingContent(state, 'Hello ');
      expect(state.streamingContent).toBe('Hello ');

      state = appendToStreamingContent(state, 'world!');
      expect(state.streamingContent).toBe('Hello world!');
    });

    it('should finalize agent message by moving streaming content', () => {
      let state = createInitialChatState();
      state = addAgentMessage(state, 'Technical Agent');
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
      state = addAgentMessage(state, 'Agent');
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

      state = addAgentMessage(state, 'Agent');
      expect(hasActiveStreaming(state)).toBe(true);

      state = finalizeAgentMessage(state);
      expect(hasActiveStreaming(state)).toBe(false);
    });
  });
});
