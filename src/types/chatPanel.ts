/**
 * Chat Panel Types
 * Type definitions for the Demo Viewer chat UI state management
 *
 * Implements chat-style conversation interface with message bubbles,
 * streaming token display, and agent pipeline status tracking.
 */

import type { ToolCallEvent } from './events';

/**
 * Role of the message author in the chat conversation
 */
export type ChatMessageRole = 'user' | 'agent';

/**
 * Status of an agent in the pipeline
 */
export type AgentPipelineStatus = 'pending' | 'active' | 'completed';

/**
 * Pane routing for dual-pane conversation UI
 * - 'conversation': Left pane - User messages and entry agent responses
 * - 'collaboration': Right pane - Agent-to-agent handoffs and responses
 */
export type MessagePane = 'conversation' | 'collaboration';

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
  /**
   * Target pane for this message in the dual-pane layout.
   * - 'conversation': Displays in left pane (user + entry agent)
   * - 'collaboration': Displays in right pane (agent-to-agent)
   *
   * Routing logic:
   * - User messages always route to 'conversation'
   * - Messages with from_agent === null route to 'conversation' (entry agent)
   * - Messages with from_agent !== null route to 'collaboration' (internal agents)
   */
  pane: MessagePane;
  /**
   * Whether this is a sender message (handoff prompt) in the collaboration pane.
   * When true, displays with right-aligned styling like user messages.
   * Used for handoff prompts where the sending agent's prompt appears before
   * the receiving agent's response.
   */
  isSender?: boolean;
  /**
   * Timestamp when agent finished processing (set on node_stop event).
   * Undefined while the agent is still streaming.
   * Used for matching tool events to messages by time range.
   */
  endTimestamp?: number;
  /**
   * Tool call events matched to this message by agent name and time range.
   * Populated by matchToolEventsToMessages() utility function.
   * Tool chips are rendered inline below the message content.
   */
  toolCalls: ToolCallEvent[];
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
  /**
   * Name of the entry agent (first agent to receive user prompt).
   * Identified from the first node_start event received in the workflow.
   * null until the first node_start event is processed.
   */
  entryAgentName: string | null;
  /**
   * Which pane the currently streaming message belongs to.
   * Used to route streaming content to the correct pane during agent execution.
   * - 'conversation': Streaming content displays in left pane
   * - 'collaboration': Streaming content displays in right pane
   * - null: No message currently streaming
   */
  activeMessagePane: MessagePane | null;
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
