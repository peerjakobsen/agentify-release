/**
 * Log Entry Transformer
 * Transforms MergedEvents into LogEntry objects for the execution log panel
 */

import type {
  MergedEvent,
  AgentifyEvent,
  NodeStartEvent,
  NodeStopEvent,
  ToolCallEvent,
  WorkflowCompleteEvent,
  AgentSpanEvent,
} from '../types/events';
import {
  isNodeStartEvent,
  isNodeStopEvent,
  isNodeStreamEvent,
  isToolCallEvent,
  isWorkflowCompleteEvent,
  isGraphStructureEvent,
  isAgentSpanEvent,
} from '../types/events';
import type { LogEntry, LogEventType, LogEntryStatus } from '../types/logPanel';
import { formatDuration } from './logTimestampFormatter';

/**
 * Counter for generating unique entry IDs
 */
let entryIdCounter = 0;

/**
 * Generates a unique entry ID
 */
function generateEntryId(): string {
  entryIdCounter += 1;
  return `log-${Date.now()}-${entryIdCounter}`;
}

/**
 * Resets the entry ID counter (useful for testing)
 */
export function resetEntryIdCounter(): void {
  entryIdCounter = 0;
}

/**
 * Determines if a tool call status indicates an error
 */
function isToolCallError(status: string): boolean {
  return status === 'failed';
}

/**
 * Determines if a node completion status indicates an error
 */
function isNodeCompletionError(status: string): boolean {
  return status === 'failed';
}

/**
 * Transforms a NodeStartEvent to a LogEntry
 */
function transformNodeStartEvent(event: NodeStartEvent): LogEntry {
  return {
    id: generateEntryId(),
    timestamp: event.timestamp,
    eventType: 'node_start',
    agentName: event.node_id,
    summary: 'Agent started',
    isExpanded: false,
    isTruncationExpanded: false,
    status: 'neutral',
  };
}

/**
 * Transforms a NodeStopEvent to a LogEntry
 */
function transformNodeStopEvent(event: NodeStopEvent): LogEntry {
  const isError = isNodeCompletionError(event.status);
  const duration = event.execution_time_ms;
  const durationText = duration !== undefined ? ` (${formatDuration(duration)})` : '';

  return {
    id: generateEntryId(),
    timestamp: event.timestamp,
    eventType: 'node_stop',
    agentName: event.node_id,
    summary: isError ? `Agent failed${durationText}` : `Agent completed${durationText}`,
    isExpanded: false,
    isTruncationExpanded: false,
    status: isError ? 'error' : 'success',
    durationMs: duration,
  };
}

/**
 * Transforms a ToolCallEvent to a LogEntry (for started status)
 */
function transformToolCallStartEvent(event: ToolCallEvent): LogEntry {
  return {
    id: generateEntryId(),
    timestamp: event.timestamp,
    eventType: 'tool_call',
    agentName: event.agent_name,
    summary: `Tool: ${event.system} -> ${event.operation}`,
    payload: {
      system: event.system,
      operation: event.operation,
      input: event.input,
    },
    isExpanded: false,
    isTruncationExpanded: false,
    status: 'neutral',
  };
}

/**
 * Transforms a ToolCallEvent to a LogEntry (for completed/failed status)
 */
function transformToolCallResultEvent(event: ToolCallEvent): LogEntry {
  const isError = isToolCallError(event.status);

  return {
    id: generateEntryId(),
    timestamp: event.timestamp,
    eventType: 'tool_result',
    agentName: event.agent_name,
    summary: isError
      ? `Tool failed: ${event.error_message || 'Unknown error'}`
      : `Tool completed: ${event.system} -> ${event.operation}`,
    payload: {
      system: event.system,
      operation: event.operation,
      output: event.output,
      ...(event.error_message && { error: event.error_message }),
    },
    isExpanded: false,
    isTruncationExpanded: false,
    status: isError ? 'error' : 'success',
    errorMessage: event.error_message,
  };
}

/**
 * Transforms a WorkflowCompleteEvent to a LogEntry
 */
function transformWorkflowCompleteEvent(event: WorkflowCompleteEvent): LogEntry {
  const isError = event.status === 'failed' || event.status === 'cancelled';
  const durationText = event.execution_time_ms !== undefined
    ? ` (${formatDuration(event.execution_time_ms)})`
    : '';

  if (isError) {
    return {
      id: generateEntryId(),
      timestamp: event.timestamp,
      eventType: 'workflow_error',
      agentName: 'Workflow',
      summary: `Workflow ${event.status}${durationText}`,
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'error',
      durationMs: event.execution_time_ms,
    };
  }

  return {
    id: generateEntryId(),
    timestamp: event.timestamp,
    eventType: 'workflow_complete',
    agentName: 'Workflow',
    summary: `Workflow completed${durationText}`,
    isExpanded: false,
    isTruncationExpanded: false,
    status: 'success',
    durationMs: event.execution_time_ms,
  };
}

/**
 * Transforms an AgentSpanEvent to a LogEntry
 */
function transformAgentSpanEvent(event: AgentSpanEvent): LogEntry | null {
  if (event.event_type === 'agent_start') {
    return {
      id: generateEntryId(),
      timestamp: event.timestamp,
      eventType: 'node_start',
      agentName: event.agent_name,
      summary: `Agent started: ${event.role}`,
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    };
  }

  if (event.event_type === 'agent_end') {
    const durationText = event.duration_ms !== undefined
      ? ` (${formatDuration(event.duration_ms)})`
      : '';

    return {
      id: generateEntryId(),
      timestamp: event.timestamp,
      eventType: 'node_stop',
      agentName: event.agent_name,
      summary: `Agent completed${durationText}`,
      payload: event.output ? { output: event.output } : undefined,
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'success',
      durationMs: event.duration_ms,
    };
  }

  return null;
}

/**
 * Transforms a MergedEvent to a LogEntry
 * Returns null for events that should be filtered out (node_stream, graph_structure)
 *
 * @param mergedEvent - The merged event to transform
 * @returns LogEntry or null if the event should be filtered out
 */
export function transformEventToLogEntry(mergedEvent: MergedEvent): LogEntry | null {
  const event = mergedEvent.event;

  // Filter out node_stream events (too verbose)
  if (isNodeStreamEvent(event)) {
    return null;
  }

  // Filter out graph_structure events (internal initialization)
  if (isGraphStructureEvent(event)) {
    return null;
  }

  // Transform based on event type
  if (isNodeStartEvent(event)) {
    return transformNodeStartEvent(event);
  }

  if (isNodeStopEvent(event)) {
    return transformNodeStopEvent(event);
  }

  if (isToolCallEvent(event)) {
    // Tool call events can represent either the start (status: 'started')
    // or the result (status: 'completed' or 'failed')
    if (event.status === 'started') {
      return transformToolCallStartEvent(event);
    }
    return transformToolCallResultEvent(event);
  }

  if (isWorkflowCompleteEvent(event)) {
    return transformWorkflowCompleteEvent(event);
  }

  if (isAgentSpanEvent(event)) {
    return transformAgentSpanEvent(event);
  }

  // Unknown event type - filter out
  return null;
}

/**
 * Transforms an array of MergedEvents to LogEntries
 * Filters out events that should not be displayed
 *
 * @param events - Array of merged events
 * @returns Array of log entries
 */
export function transformEventsToLogEntries(events: MergedEvent[]): LogEntry[] {
  const entries: LogEntry[] = [];

  for (const event of events) {
    const entry = transformEventToLogEntry(event);
    if (entry !== null) {
      entries.push(entry);
    }
  }

  return entries;
}

/**
 * Creates a workflow error log entry for unexpected errors
 *
 * @param errorMessage - The error message
 * @param timestamp - Optional timestamp (defaults to now)
 * @returns LogEntry for the error
 */
export function createWorkflowErrorEntry(
  errorMessage: string,
  timestamp?: number
): LogEntry {
  return {
    id: generateEntryId(),
    timestamp: timestamp ?? Date.now(),
    eventType: 'workflow_error',
    agentName: 'Workflow',
    summary: `Workflow failed: ${errorMessage}`,
    isExpanded: false,
    isTruncationExpanded: false,
    status: 'error',
    errorMessage,
  };
}
