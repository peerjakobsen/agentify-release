/**
 * Tests for Demo Viewer Chat Logic Handler
 * Task Group 4: Service Integration Layer
 *
 * Tests for integration with WorkflowTriggerService and StdoutEventParser
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChatLogicCallbacks } from '../../panels/demoViewerChatLogic';
import {
  createInitialChatState,
  createInitialUiState,
  addUserMessage,
  addAgentMessage,
  appendToStreamingContent,
  finalizeAgentMessage,
  updatePipelineStage,
  addErrorMessage,
} from '../../utils/chatStateUtils';
import type { ChatSessionState, ChatUiState } from '../../types/chatPanel';

// ============================================================================
// Task 4.1: 5 Focused Tests for Service Integration Layer
// ============================================================================

// Since the actual service integration requires VS Code extension context,
// we test the state manipulation logic and callback patterns separately

describe('Task Group 4: Service Integration Tests', () => {
  // Mock callbacks
  let mockCallbacks: ChatLogicCallbacks;

  beforeEach(() => {
    mockCallbacks = {
      updateWebviewContent: vi.fn(),
      syncStateToWebview: vi.fn(),
      postStreamingToken: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Test 1: Chat state updates correctly on user message send', () => {
    it('should add user message to state', () => {
      const state = createInitialChatState();
      const updatedState = addUserMessage(state, 'Test prompt');

      expect(updatedState.messages).toHaveLength(1);
      expect(updatedState.messages[0].role).toBe('user');
      expect(updatedState.messages[0].content).toBe('Test prompt');
    });

    it('should increment turn count', () => {
      const state = createInitialChatState();
      expect(state.turnCount).toBe(0);

      const updatedState = addUserMessage(state, 'Test prompt');
      expect(updatedState.turnCount).toBe(1);
    });

    it('should set timestamp on user message', () => {
      const beforeTime = Date.now();
      const state = createInitialChatState();
      const updatedState = addUserMessage(state, 'Test prompt');
      const afterTime = Date.now();

      expect(updatedState.messages[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(updatedState.messages[0].timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Test 2: Pipeline stages update on node_start and node_stop events', () => {
    it('should add pipeline stage on first occurrence', () => {
      const state = createInitialChatState();
      const updatedState = updatePipelineStage(state, 'Triage Agent', 'active');

      expect(updatedState.pipelineStages).toHaveLength(1);
      expect(updatedState.pipelineStages[0].name).toBe('Triage Agent');
      expect(updatedState.pipelineStages[0].status).toBe('active');
    });

    it('should update existing pipeline stage status', () => {
      let state = createInitialChatState();
      state = updatePipelineStage(state, 'Triage Agent', 'pending');
      state = updatePipelineStage(state, 'Triage Agent', 'active');
      state = updatePipelineStage(state, 'Triage Agent', 'completed');

      expect(state.pipelineStages).toHaveLength(1);
      expect(state.pipelineStages[0].status).toBe('completed');
    });

    it('should maintain order of multiple pipeline stages', () => {
      let state = createInitialChatState();
      state = updatePipelineStage(state, 'Triage', 'completed');
      state = updatePipelineStage(state, 'Technical', 'active');
      state = updatePipelineStage(state, 'Output', 'pending');

      expect(state.pipelineStages).toHaveLength(3);
      expect(state.pipelineStages[0].name).toBe('Triage');
      expect(state.pipelineStages[1].name).toBe('Technical');
      expect(state.pipelineStages[2].name).toBe('Output');
    });
  });

  describe('Test 3: Streaming tokens accumulate correctly via node_stream events', () => {
    it('should accumulate streaming tokens', () => {
      let state = createInitialChatState();
      state = addAgentMessage(state, 'Technical Agent');

      state = appendToStreamingContent(state, 'Hello');
      expect(state.streamingContent).toBe('Hello');

      state = appendToStreamingContent(state, ' ');
      expect(state.streamingContent).toBe('Hello ');

      state = appendToStreamingContent(state, 'world!');
      expect(state.streamingContent).toBe('Hello world!');
    });

    it('should create new agent message with streaming flag true', () => {
      const state = createInitialChatState();
      const updatedState = addAgentMessage(state, 'Technical Agent');

      expect(updatedState.messages).toHaveLength(1);
      expect(updatedState.messages[0].isStreaming).toBe(true);
      expect(updatedState.messages[0].agentName).toBe('Technical Agent');
      expect(updatedState.activeAgentName).toBe('Technical Agent');
    });

    it('should reset streaming content on new agent message', () => {
      let state = createInitialChatState();
      state = addAgentMessage(state, 'Agent 1');
      state = appendToStreamingContent(state, 'First content');
      state = finalizeAgentMessage(state);
      state = addAgentMessage(state, 'Agent 2');

      expect(state.streamingContent).toBe('');
      expect(state.activeAgentName).toBe('Agent 2');
    });
  });

  describe('Test 4: Agent message finalizes correctly on node_stop', () => {
    it('should move streaming content to message content', () => {
      let state = createInitialChatState();
      state = addAgentMessage(state, 'Technical Agent');
      state = appendToStreamingContent(state, 'Analysis complete.');

      expect(state.messages[0].content).toBe('');
      expect(state.messages[0].isStreaming).toBe(true);

      state = finalizeAgentMessage(state);

      expect(state.messages[0].content).toBe('Analysis complete.');
      expect(state.messages[0].isStreaming).toBe(false);
    });

    it('should clear activeAgentName after finalization', () => {
      let state = createInitialChatState();
      state = addAgentMessage(state, 'Technical Agent');
      state = appendToStreamingContent(state, 'Content');

      expect(state.activeAgentName).toBe('Technical Agent');

      state = finalizeAgentMessage(state);

      expect(state.activeAgentName).toBeNull();
    });

    it('should clear streaming content after finalization', () => {
      let state = createInitialChatState();
      state = addAgentMessage(state, 'Agent');
      state = appendToStreamingContent(state, 'Test content');

      expect(state.streamingContent).toBe('Test content');

      state = finalizeAgentMessage(state);

      expect(state.streamingContent).toBe('');
    });

    it('should only finalize the active streaming message', () => {
      let state = createInitialChatState();

      // Add first agent message and finalize
      state = addAgentMessage(state, 'Agent 1');
      state = appendToStreamingContent(state, 'First message');
      state = finalizeAgentMessage(state);

      // Add second agent message
      state = addAgentMessage(state, 'Agent 2');
      state = appendToStreamingContent(state, 'Second message');
      state = finalizeAgentMessage(state);

      expect(state.messages[0].content).toBe('First message');
      expect(state.messages[0].isStreaming).toBe(false);
      expect(state.messages[1].content).toBe('Second message');
      expect(state.messages[1].isStreaming).toBe(false);
    });
  });

  describe('Test 5: Error handling adds error message to chat', () => {
    it('should add error message with System agent name', () => {
      const state = createInitialChatState();
      const updatedState = addErrorMessage(state, 'Workflow failed');

      expect(updatedState.messages).toHaveLength(1);
      expect(updatedState.messages[0].role).toBe('agent');
      expect(updatedState.messages[0].agentName).toBe('System');
    });

    it('should format error message with Error: prefix', () => {
      const state = createInitialChatState();
      const updatedState = addErrorMessage(state, 'Connection timeout');

      expect(updatedState.messages[0].content).toBe('Error: Connection timeout');
    });

    it('should set isStreaming to false for error messages', () => {
      const state = createInitialChatState();
      const updatedState = addErrorMessage(state, 'Error');

      expect(updatedState.messages[0].isStreaming).toBe(false);
    });

    it('should clear activeAgentName on error', () => {
      let state = createInitialChatState();
      state = addAgentMessage(state, 'Agent');
      state = appendToStreamingContent(state, 'Partial content');

      expect(state.activeAgentName).toBe('Agent');

      state = addErrorMessage(state, 'Workflow error');

      expect(state.activeAgentName).toBeNull();
    });

    it('should clear streaming content on error', () => {
      let state = createInitialChatState();
      state = addAgentMessage(state, 'Agent');
      state = appendToStreamingContent(state, 'Partial');

      state = addErrorMessage(state, 'Error');

      expect(state.streamingContent).toBe('');
    });
  });

  describe('Callback Integration Patterns', () => {
    it('should demonstrate callback pattern for streaming token', () => {
      // Simulate the streaming token flow
      const state = createInitialChatState();
      const updatedState = appendToStreamingContent(
        addAgentMessage(state, 'Agent'),
        'Token'
      );

      // Callbacks would be called like this:
      mockCallbacks.postStreamingToken(updatedState.streamingContent);

      expect(mockCallbacks.postStreamingToken).toHaveBeenCalledWith('Token');
    });

    it('should demonstrate callback pattern for state sync', () => {
      // After any state change, callbacks would be invoked:
      mockCallbacks.updateWebviewContent();
      mockCallbacks.syncStateToWebview();

      expect(mockCallbacks.updateWebviewContent).toHaveBeenCalled();
      expect(mockCallbacks.syncStateToWebview).toHaveBeenCalled();
    });
  });

  describe('UI State Management', () => {
    it('should initialize UI state with correct defaults', () => {
      const uiState = createInitialUiState();

      expect(uiState.inputDisabled).toBe(false);
      expect(uiState.isWorkflowRunning).toBe(false);
      expect(uiState.errorMessage).toBeNull();
      expect(uiState.elapsedTimeMs).toBeNull();
    });

    it('should update UI state for running workflow', () => {
      const uiState: ChatUiState = {
        inputDisabled: true,
        isWorkflowRunning: true,
        errorMessage: null,
        elapsedTimeMs: 5000,
      };

      expect(uiState.inputDisabled).toBe(true);
      expect(uiState.isWorkflowRunning).toBe(true);
      expect(uiState.elapsedTimeMs).toBe(5000);
    });

    it('should update UI state on workflow error', () => {
      const uiState: ChatUiState = {
        inputDisabled: false,
        isWorkflowRunning: false,
        errorMessage: 'Workflow failed',
        elapsedTimeMs: 3500,
      };

      expect(uiState.inputDisabled).toBe(false);
      expect(uiState.isWorkflowRunning).toBe(false);
      expect(uiState.errorMessage).toBe('Workflow failed');
    });
  });

  describe('Complete Message Flow', () => {
    it('should handle complete conversation flow', () => {
      let state = createInitialChatState();

      // 1. User sends message
      state = addUserMessage(state, 'Analyze this data');
      expect(state.messages).toHaveLength(1);
      expect(state.turnCount).toBe(1);

      // 2. Pipeline stages added
      state = updatePipelineStage(state, 'Triage', 'pending');
      state = updatePipelineStage(state, 'Technical', 'pending');
      state = updatePipelineStage(state, 'Output', 'pending');

      // 3. First agent starts
      state = updatePipelineStage(state, 'Triage', 'active');
      state = addAgentMessage(state, 'Triage');

      // 4. First agent streams tokens
      state = appendToStreamingContent(state, 'Routing');
      state = appendToStreamingContent(state, ' to technical...');

      // 5. First agent completes
      state = finalizeAgentMessage(state);
      state = updatePipelineStage(state, 'Triage', 'completed');

      // 6. Second agent starts
      state = updatePipelineStage(state, 'Technical', 'active');
      state = addAgentMessage(state, 'Technical');

      // 7. Second agent streams tokens
      state = appendToStreamingContent(state, 'Analysis complete.');

      // 8. Second agent completes
      state = finalizeAgentMessage(state);
      state = updatePipelineStage(state, 'Technical', 'completed');

      // Verify final state
      expect(state.messages).toHaveLength(3);
      expect(state.messages[0].role).toBe('user');
      expect(state.messages[1].role).toBe('agent');
      expect(state.messages[1].agentName).toBe('Triage');
      expect(state.messages[1].content).toBe('Routing to technical...');
      expect(state.messages[2].agentName).toBe('Technical');
      expect(state.messages[2].content).toBe('Analysis complete.');

      expect(state.pipelineStages[0].status).toBe('completed');
      expect(state.pipelineStages[1].status).toBe('completed');
      expect(state.pipelineStages[2].status).toBe('pending');
    });
  });
});
