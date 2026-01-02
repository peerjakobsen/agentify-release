/**
 * Chat State Utilities
 * State manipulation functions for the Demo Viewer chat UI
 *
 * Implements patterns similar to ideationStep2Logic.ts for
 * streaming token handling and message management.
 */

import { generateWorkflowId, generateTraceId } from './idGenerator';
import type {
  ChatMessage,
  ChatSessionState,
  AgentPipelineStage,
  AgentPipelineStatus,
  ChatUiState,
  ChatPanelState,
} from '../types/chatPanel';

/**
 * Generates a unique message ID
 * Format: "msg-" + 8 character hex string
 */
function generateMessageId(): string {
  return 'msg-' + Math.random().toString(16).slice(2, 10);
}

/**
 * Generates a unique session ID
 * Format: "ses-" + 8 character hex string
 */
function generateSessionId(): string {
  return 'ses-' + Math.random().toString(16).slice(2, 10);
}

/**
 * Creates a fresh ChatSessionState with generated IDs
 * Uses existing generateWorkflowId() from idGenerator.ts
 *
 * @returns Fresh ChatSessionState with new workflow_id and session_id
 */
export function createInitialChatState(): ChatSessionState {
  return {
    workflowId: generateWorkflowId(),
    sessionId: generateSessionId(),
    turnCount: 0,
    startTime: 0,
    messages: [],
    pipelineStages: [],
    activeAgentName: null,
    streamingContent: '',
  };
}

/**
 * Creates default UI state for the chat panel
 *
 * @returns Default ChatUiState
 */
export function createInitialUiState(): ChatUiState {
  return {
    inputDisabled: false,
    isWorkflowRunning: false,
    errorMessage: null,
    elapsedTimeMs: null,
  };
}

/**
 * Creates combined default chat panel state
 *
 * @returns Default ChatPanelState
 */
export function createInitialChatPanelState(): ChatPanelState {
  return {
    session: createInitialChatState(),
    ui: createInitialUiState(),
  };
}

/**
 * Adds a user message to the chat state
 *
 * @param state - Current chat session state
 * @param content - Message content text
 * @returns Updated chat session state with new user message
 */
export function addUserMessage(state: ChatSessionState, content: string): ChatSessionState {
  const userMessage: ChatMessage = {
    id: generateMessageId(),
    role: 'user',
    content: content.trim(),
    timestamp: Date.now(),
    isStreaming: false,
  };

  return {
    ...state,
    messages: [...state.messages, userMessage],
    turnCount: state.turnCount + 1,
  };
}

/**
 * Adds a new agent message bubble to the chat state
 * The message starts in streaming mode with empty content
 *
 * @param state - Current chat session state
 * @param agentName - Name of the agent creating the message
 * @returns Updated chat session state with new agent message
 */
export function addAgentMessage(state: ChatSessionState, agentName: string): ChatSessionState {
  const agentMessage: ChatMessage = {
    id: generateMessageId(),
    role: 'agent',
    agentName,
    content: '',
    timestamp: Date.now(),
    isStreaming: true,
  };

  return {
    ...state,
    messages: [...state.messages, agentMessage],
    activeAgentName: agentName,
    streamingContent: '',
  };
}

/**
 * Appends a token to the streaming content
 * Uses the _streamingResponse += token pattern from Step 2
 *
 * @param state - Current chat session state
 * @param token - Token text to append
 * @returns Updated chat session state with appended streaming content
 */
export function appendToStreamingContent(state: ChatSessionState, token: string): ChatSessionState {
  return {
    ...state,
    streamingContent: state.streamingContent + token,
  };
}

/**
 * Finalizes the active agent message by moving streaming content to message content
 * Similar to handleStreamingComplete() pattern from Step 2
 *
 * @param state - Current chat session state
 * @returns Updated chat session state with finalized message
 */
export function finalizeAgentMessage(state: ChatSessionState): ChatSessionState {
  // Find the active streaming message
  const updatedMessages = state.messages.map((message) => {
    if (message.role === 'agent' && message.isStreaming && message.agentName === state.activeAgentName) {
      return {
        ...message,
        content: state.streamingContent,
        isStreaming: false,
      };
    }
    return message;
  });

  return {
    ...state,
    messages: updatedMessages,
    activeAgentName: null,
    streamingContent: '',
  };
}

/**
 * Updates a pipeline stage status
 *
 * @param state - Current chat session state
 * @param agentName - Name of the agent to update
 * @param status - New status for the agent
 * @returns Updated chat session state with updated pipeline stage
 */
export function updatePipelineStage(
  state: ChatSessionState,
  agentName: string,
  status: AgentPipelineStatus
): ChatSessionState {
  // Check if stage already exists
  const existingIndex = state.pipelineStages.findIndex((stage) => stage.name === agentName);

  let updatedStages: AgentPipelineStage[];

  if (existingIndex >= 0) {
    // Update existing stage
    updatedStages = state.pipelineStages.map((stage, index) =>
      index === existingIndex ? { ...stage, status } : stage
    );
  } else {
    // Add new stage
    const newStage: AgentPipelineStage = { name: agentName, status };
    updatedStages = [...state.pipelineStages, newStage];
  }

  return {
    ...state,
    pipelineStages: updatedStages,
  };
}

/**
 * Sets the workflow start time and updates UI state
 *
 * @param state - Current chat session state
 * @returns Updated chat session state with start time set
 */
export function setWorkflowStartTime(state: ChatSessionState): ChatSessionState {
  return {
    ...state,
    startTime: Date.now(),
  };
}

/**
 * Resets the chat state for a new conversation
 * Generates new workflow_id and session_id
 *
 * @returns Fresh chat session state with new IDs
 */
export function resetChatState(): ChatSessionState {
  return createInitialChatState();
}

/**
 * Adds an error message to the chat
 *
 * @param state - Current chat session state
 * @param errorMessage - Error message text
 * @returns Updated chat session state with error message
 */
export function addErrorMessage(state: ChatSessionState, errorMessage: string): ChatSessionState {
  const errorChatMessage: ChatMessage = {
    id: generateMessageId(),
    role: 'agent',
    agentName: 'System',
    content: `Error: ${errorMessage}`,
    timestamp: Date.now(),
    isStreaming: false,
  };

  return {
    ...state,
    messages: [...state.messages, errorChatMessage],
    activeAgentName: null,
    streamingContent: '',
  };
}

/**
 * Gets the last message in the conversation
 *
 * @param state - Current chat session state
 * @returns Last message or undefined if no messages
 */
export function getLastMessage(state: ChatSessionState): ChatMessage | undefined {
  return state.messages[state.messages.length - 1];
}

/**
 * Checks if there is an active streaming message
 *
 * @param state - Current chat session state
 * @returns True if there is an active streaming message
 */
export function hasActiveStreaming(state: ChatSessionState): boolean {
  return state.activeAgentName !== null && state.messages.some((m) => m.isStreaming);
}
