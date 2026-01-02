/**
 * Chat Panel Types
 * Type definitions for the Demo Viewer chat UI state management
 *
 * Implements chat-style conversation interface with message bubbles,
 * streaming token display, and agent pipeline status tracking.
 */

/**
 * Role of the message author in the chat conversation
 */
export type ChatMessageRole = 'user' | 'agent';

/**
 * Status of an agent in the pipeline
 */
export type AgentPipelineStatus = 'pending' | 'active' | 'completed';

/**
 * Individual chat message in the conversation
 */
export interface ChatMessage {
  /** Unique identifier for the message */
  id: string;
  /** Role of the message author */
  role: ChatMessageRole;
  /** Agent name (only for agent messages) */
  agentName?: string;
  /** Message content text */
  content: string;
  /** Timestamp when message was created */
  timestamp: number;
  /** Whether the message is currently streaming */
  isStreaming: boolean;
}

/**
 * Agent pipeline stage for status bar display
 */
export interface AgentPipelineStage {
  /** Agent name/identifier */
  name: string;
  /** Current status of this agent in the pipeline */
  status: AgentPipelineStatus;
}

/**
 * Chat session state containing conversation data and workflow info
 */
export interface ChatSessionState {
  /** Workflow identifier (short format: "wf-a1b2c3d4") */
  workflowId: string;
  /** Session identifier for tracking */
  sessionId: string;
  /** Turn count (always 1 for this phase, multi-turn is Item 36) */
  turnCount: number;
  /** Timestamp when the workflow started */
  startTime: number;
  /** Array of chat messages in the conversation */
  messages: ChatMessage[];
  /** Array of agent pipeline stages for status bar */
  pipelineStages: AgentPipelineStage[];
  /** Name of the currently active agent (if any) */
  activeAgentName: string | null;
  /** Accumulated streaming content for the active agent */
  streamingContent: string;
}

/**
 * UI state for the chat panel
 */
export interface ChatUiState {
  /** Whether the input is disabled */
  inputDisabled: boolean;
  /** Whether a workflow is currently running */
  isWorkflowRunning: boolean;
  /** Error message to display (if any) */
  errorMessage: string | null;
  /** Elapsed time in milliseconds since workflow start */
  elapsedTimeMs: number | null;
}

/**
 * Combined chat panel state including session and UI state
 */
export interface ChatPanelState {
  /** Session state containing conversation data */
  session: ChatSessionState;
  /** UI state for display control */
  ui: ChatUiState;
}
