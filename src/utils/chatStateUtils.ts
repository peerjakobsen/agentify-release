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
  MessagePane,
} from '../types/chatPanel';
import type { ToolCallEvent } from '../types/events';

/**
 * Extended ToolCallEvent with calculated duration
 */
export interface MergedToolCallEvent extends ToolCallEvent {
  /** Duration in milliseconds (calculated from timestamp difference) */
  duration_ms?: number;
}

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
    entryAgentName: null,
    activeMessagePane: null,
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
 * Determines which pane a message should be routed to based on from_agent field
 *
 * @param fromAgent - The from_agent field from node_start event (null for entry agent)
 * @returns 'conversation' if fromAgent is null, 'collaboration' otherwise
 */
export function determineMessagePane(fromAgent: string | null): MessagePane {
  return fromAgent === null ? 'conversation' : 'collaboration';
}

/**
 * Adds a user message to the chat state
 * User messages always route to the conversation pane (left pane)
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
    pane: 'conversation',
    toolCalls: [],
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
 * @param pane - Target pane for this message ('conversation' or 'collaboration')
 * @returns Updated chat session state with new agent message
 */
export function addAgentMessage(
  state: ChatSessionState,
  agentName: string,
  pane: MessagePane
): ChatSessionState {
  const agentMessage: ChatMessage = {
    id: generateMessageId(),
    role: 'agent',
    agentName,
    content: '',
    timestamp: Date.now(),
    isStreaming: true,
    pane,
    toolCalls: [],
  };

  return {
    ...state,
    messages: [...state.messages, agentMessage],
    activeAgentName: agentName,
    streamingContent: '',
    activeMessagePane: pane,
  };
}

/**
 * Adds a handoff message to the collaboration pane
 * Handoff messages represent the prompt sent from one agent to another during handoffs.
 * They appear as sender-style messages (right-aligned, like user messages visually).
 *
 * @param state - Current chat session state
 * @param senderAgentName - Name of the agent sending the handoff
 * @param handoffPrompt - The prompt/instruction being sent to the next agent
 * @returns Updated chat session state with handoff message added
 */
export function addHandoffMessage(
  state: ChatSessionState,
  senderAgentName: string,
  handoffPrompt: string
): ChatSessionState {
  const handoffMessage: ChatMessage = {
    id: generateMessageId(),
    role: 'agent',
    agentName: senderAgentName,
    content: handoffPrompt,
    timestamp: Date.now(),
    isStreaming: false,
    pane: 'collaboration',
    isSender: true,
    toolCalls: [],
  };

  return {
    ...state,
    messages: [...state.messages, handoffMessage],
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
 * Sets endTimestamp to mark when the agent finished processing
 *
 * @param state - Current chat session state
 * @returns Updated chat session state with finalized message
 */
export function finalizeAgentMessage(state: ChatSessionState): ChatSessionState {
  const endTimestamp = Date.now();

  // Find the active streaming message
  const updatedMessages = state.messages.map((message) => {
    if (message.role === 'agent' && message.isStreaming && message.agentName === state.activeAgentName) {
      return {
        ...message,
        content: state.streamingContent,
        isStreaming: false,
        endTimestamp,
      };
    }
    return message;
  });

  return {
    ...state,
    messages: updatedMessages,
    activeAgentName: null,
    streamingContent: '',
    activeMessagePane: null,
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
 * Error messages route to the conversation pane (left pane)
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
    pane: 'conversation',
    toolCalls: [],
  };

  return {
    ...state,
    messages: [...state.messages, errorChatMessage],
    activeAgentName: null,
    streamingContent: '',
    activeMessagePane: null,
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

// ============================================================================
// Tool Call Matching and Pairing Functions
// ============================================================================

/**
 * Generates a unique tool call ID from event properties
 * Used for pairing started/completed events and for HTML data attributes
 *
 * @param event - ToolCallEvent to generate ID for
 * @returns Composite key: "agent_name-system-operation-timestamp"
 */
export function generateToolId(event: ToolCallEvent): string {
  return `${event.agent_name}-${event.system}-${event.operation}-${event.timestamp}`;
}

/**
 * Generates a pairing key for matching started/completed events
 * Does not include timestamp since paired events have different timestamps
 *
 * @param event - ToolCallEvent to generate pairing key for
 * @returns Composite key: "agent_name-system-operation"
 */
function generatePairingKey(event: ToolCallEvent): string {
  return `${event.agent_name}-${event.system}-${event.operation}`;
}

/**
 * Merges tool call pairs by matching started events with their completed/failed counterparts
 * Calculates duration_ms from timestamp differences
 *
 * Tool calls emit TWO events:
 * 1. First with status='started'
 * 2. Then with status='completed' or 'failed'
 *
 * @param toolEvents - Array of ToolCallEvent from DynamoDB polling
 * @returns Array of merged events with calculated duration
 */
export function mergeToolCallPairs(toolEvents: ToolCallEvent[]): MergedToolCallEvent[] {
  // Group events by pairing key (agent_name + system + operation)
  const eventGroups = new Map<string, ToolCallEvent[]>();

  for (const event of toolEvents) {
    const key = generatePairingKey(event);
    const group = eventGroups.get(key) || [];
    group.push(event);
    eventGroups.set(key, group);
  }

  const mergedEvents: MergedToolCallEvent[] = [];

  for (const [key, events] of eventGroups) {
    // Sort events by timestamp to find started/completed pairs
    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

    // Find started event (first one)
    const startedEvent = sortedEvents.find(e => e.status === 'started');
    // Find completed/failed event (any status that's not 'started')
    const completedEvent = sortedEvents.find(e => e.status === 'completed' || e.status === 'failed');

    if (startedEvent && completedEvent) {
      // Paired events - merge into completed with duration
      const duration_ms = completedEvent.timestamp - startedEvent.timestamp;
      mergedEvents.push({
        ...completedEvent,
        duration_ms,
      });
    } else if (startedEvent) {
      // Unpaired started event - still running
      mergedEvents.push({
        ...startedEvent,
      });
    } else if (completedEvent) {
      // Completed without started (edge case) - include as-is
      mergedEvents.push({
        ...completedEvent,
      });
    }
  }

  return mergedEvents;
}

/**
 * Normalizes an agent name for matching purposes
 * Handles mismatches between Python agent names ('escalation') and
 * display names ('Escalation Handler') by extracting the base identifier
 *
 * @param name - Agent name to normalize
 * @returns Lowercase base identifier (e.g., 'escalation' from 'Escalation Handler')
 */
function normalizeAgentName(name: string): string {
  // Convert to lowercase and extract first word/identifier
  // 'Escalation Handler' -> 'escalation'
  // 'Triage Agent' -> 'triage'
  // 'Technical Support' -> 'technical'
  // 'escalation' -> 'escalation' (already normalized)
  const lower = name.toLowerCase();
  const firstWord = lower.split(/[\s_-]/)[0];
  return firstWord;
}

/**
 * Checks if two agent names match after normalization
 * Handles various naming formats:
 * - 'escalation' matches 'Escalation Handler'
 * - 'triage' matches 'Triage Agent'
 * - 'technical' matches 'Technical Support'
 *
 * @param eventAgentName - Agent name from tool event (e.g., 'escalation')
 * @param messageAgentName - Agent name from chat message (e.g., 'Escalation Handler')
 * @returns true if the names refer to the same agent
 */
function agentNamesMatch(eventAgentName: string, messageAgentName: string): boolean {
  const normalizedEvent = normalizeAgentName(eventAgentName);
  const normalizedMessage = normalizeAgentName(messageAgentName);
  return normalizedEvent === normalizedMessage;
}

/**
 * Matches tool events to agent messages based on agent name and timestamp range
 *
 * Matching formula:
 * normalizeAgentName(toolEvent.agent_name) === normalizeAgentName(message.agentName) &&
 * toolEvent.timestamp >= message.timestamp &&
 * toolEvent.timestamp <= (message.endTimestamp || Date.now())
 *
 * @param messages - Array of ChatMessage to populate with tool calls
 * @param toolEvents - Array of ToolCallEvent from DynamoDB polling
 * @returns New messages array with populated toolCalls fields
 */
export function matchToolEventsToMessages(
  messages: ChatMessage[],
  toolEvents: ToolCallEvent[]
): ChatMessage[] {
  // First, merge tool call pairs
  const mergedEvents = mergeToolCallPairs(toolEvents);

  // Create a new messages array with matched tool calls
  return messages.map((message) => {
    // Only match tool calls for agent messages
    if (message.role !== 'agent' || !message.agentName) {
      return message;
    }

    // Extract agentName for use in filter (TypeScript narrowing)
    const messageAgentName = message.agentName;

    // Determine the end timestamp (use Date.now() if streaming)
    const endTimestamp = message.endTimestamp ?? Date.now();

    // Find tool events that belong to this message
    const matchedTools = mergedEvents.filter((event) => {
      // Skip events without agent_name
      const eventAgentName = event.agent_name;
      if (!eventAgentName) {
        return false;
      }

      // Match by agent name (with normalization for display name vs. internal name)
      if (!agentNamesMatch(eventAgentName, messageAgentName)) {
        return false;
      }

      // Match by timestamp range
      return event.timestamp >= message.timestamp && event.timestamp <= endTimestamp;
    });

    // Return message with matched tool calls
    if (matchedTools.length > 0) {
      return {
        ...message,
        toolCalls: matchedTools,
      };
    }

    return message;
  });
}
