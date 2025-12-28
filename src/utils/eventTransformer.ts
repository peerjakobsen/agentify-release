/**
 * Event to LogEntry Transformation Utility
 *
 * Transforms MergedEvent objects from stdout and DynamoDB sources
 * into LogEntry objects for display in the execution log panel.
 */

import type {
  MergedEvent,
  AgentifyEvent,
} from '../types/events';
import {
  isNodeStartEvent,
  isNodeStopEvent,
  isNodeStreamEvent,
  isGraphStructureEvent,
  isToolCallEvent,
  isWorkflowCompleteEvent,
  isWorkflowErrorEvent,
} from '../types/events';
import type { LogEntry, LogEventType } from '../types/logPanel';

/**
 * Counter for generating unique IDs within the same millisecond
 */
let idCounter = 0;

/**
 * Generates a unique ID for a log entry
 *
 * @param timestamp - The event timestamp in milliseconds
 * @returns A unique identifier string
 */
function generateLogEntryId(timestamp: number): string {
  idCounter = (idCounter + 1) % 10000;
  return `log-${timestamp}-${idCounter}`;
}

/**
 * Formats execution time in milliseconds to seconds with 1 decimal place
 *
 * @param ms - Execution time in milliseconds
 * @returns Formatted string like "1.2s"
 */
function formatExecutionTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Transforms a MergedEvent into a LogEntry for display in the execution log
 *
 * Returns null for events that should not be displayed in the log:
 * - node_stream: Too noisy, reserved for Phase 3
 * - graph_structure: Reserved for Phase 3 Agent Graph visualization
 *
 * @param mergedEvent - The merged event from stdout or DynamoDB
 * @returns LogEntry for displayable events, or null for skipped events
 */
export function transformEventToLogEntry(mergedEvent: MergedEvent): LogEntry | null {
  const event = mergedEvent.event;

  // Skip events that should not appear in the log
  if (isNodeStreamEvent(event) || isGraphStructureEvent(event)) {
    return null;
  }

  // Transform based on event type
  if (isNodeStartEvent(event)) {
    return transformNodeStartEvent(event, mergedEvent);
  }

  if (isNodeStopEvent(event)) {
    return transformNodeStopEvent(event, mergedEvent);
  }

  if (isToolCallEvent(event)) {
    return transformToolCallEvent(event, mergedEvent);
  }

  if (isWorkflowCompleteEvent(event)) {
    return transformWorkflowCompleteEvent(event, mergedEvent);
  }

  if (isWorkflowErrorEvent(event)) {
    return transformWorkflowErrorEvent(event, mergedEvent);
  }

  // Unknown event type - skip
  return null;
}

/**
 * Transforms a node_start event to LogEntry
 * Summary format: "node_id started"
 */
function transformNodeStartEvent(
  event: ReturnType<typeof extractNodeStartEvent>,
  mergedEvent: MergedEvent
): LogEntry {
  return {
    id: generateLogEntryId(event.timestamp),
    timestamp: event.timestamp,
    eventType: 'node_start' as LogEventType,
    agentName: event.node_id,
    summary: `\u25B6 ${event.node_id} started`,
    payload: {
      workflow_id: event.workflow_id,
      node_id: event.node_id,
    },
    isExpanded: false,
    isTruncationExpanded: false,
    status: 'neutral',
  };
}

/**
 * Transforms a node_stop event to LogEntry
 * - Completed: "node_id completed (Xs)" with success status
 * - Failed/Skipped: "node_id failed" with error status
 */
function transformNodeStopEvent(
  event: ReturnType<typeof extractNodeStopEvent>,
  mergedEvent: MergedEvent
): LogEntry {
  const isCompleted = event.status === 'completed';
  const formattedTime = formatExecutionTime(event.execution_time_ms);

  return {
    id: generateLogEntryId(event.timestamp),
    timestamp: event.timestamp,
    eventType: 'node_stop' as LogEventType,
    agentName: event.node_id,
    summary: isCompleted
      ? `\u2713 ${event.node_id} completed (${formattedTime})`
      : `\u2717 ${event.node_id} failed`,
    payload: {
      workflow_id: event.workflow_id,
      node_id: event.node_id,
      status: event.status,
      execution_time_ms: event.execution_time_ms,
    },
    isExpanded: false,
    isTruncationExpanded: false,
    status: isCompleted ? 'success' : 'error',
    durationMs: event.execution_time_ms,
  };
}

/**
 * Transforms a tool_call event to LogEntry
 * Summary format: "system -> operation"
 * Includes input data in payload for expandable details
 */
function transformToolCallEvent(
  event: ReturnType<typeof extractToolCallEvent>,
  mergedEvent: MergedEvent
): LogEntry {
  return {
    id: generateLogEntryId(event.timestamp),
    timestamp: event.timestamp,
    eventType: 'tool_call' as LogEventType,
    agentName: event.agent_name,
    summary: `\uD83D\uDD27 ${event.system} \u2192 ${event.operation}`,
    payload: {
      workflow_id: event.workflow_id,
      agent_name: event.agent_name,
      system: event.system,
      operation: event.operation,
      input: event.input,
      status: event.status,
      ...(event.output && { output: event.output }),
      ...(event.error_message && { error_message: event.error_message }),
    },
    isExpanded: false,
    isTruncationExpanded: false,
    status: 'neutral',
  };
}

/**
 * Transforms a workflow_complete event to LogEntry
 * Summary format: "Workflow completed (Xs)"
 */
function transformWorkflowCompleteEvent(
  event: ReturnType<typeof extractWorkflowCompleteEvent>,
  mergedEvent: MergedEvent
): LogEntry {
  const formattedTime = formatExecutionTime(event.execution_time_ms);

  return {
    id: generateLogEntryId(event.timestamp),
    timestamp: event.timestamp,
    eventType: 'workflow_complete' as LogEventType,
    agentName: 'workflow',
    summary: `\u2705 Workflow completed (${formattedTime})`,
    payload: {
      workflow_id: event.workflow_id,
      status: event.status,
      execution_time_ms: event.execution_time_ms,
      execution_order: event.execution_order,
      ...(event.result && { result: event.result }),
      ...(event.sources && { sources: event.sources }),
    },
    isExpanded: false,
    isTruncationExpanded: false,
    status: 'success',
    durationMs: event.execution_time_ms,
  };
}

/**
 * Transforms a workflow_error event to LogEntry
 * Summary format: "Workflow failed: error_message"
 */
function transformWorkflowErrorEvent(
  event: ReturnType<typeof extractWorkflowErrorEvent>,
  mergedEvent: MergedEvent
): LogEntry {
  // Truncate error message for summary if too long
  const truncatedError =
    event.error_message.length > 50
      ? event.error_message.substring(0, 50) + '...'
      : event.error_message;

  return {
    id: generateLogEntryId(event.timestamp),
    timestamp: event.timestamp,
    eventType: 'workflow_error' as LogEventType,
    agentName: 'workflow',
    summary: `\u274C Workflow failed: ${truncatedError}`,
    payload: {
      workflow_id: event.workflow_id,
      error_message: event.error_message,
      ...(event.error_code && { error_code: event.error_code }),
      ...(event.execution_time_ms && { execution_time_ms: event.execution_time_ms }),
    },
    isExpanded: false,
    isTruncationExpanded: false,
    status: 'error',
    errorMessage: event.error_message,
  };
}

// Type extraction helpers for TypeScript inference
function extractNodeStartEvent(event: AgentifyEvent) {
  if (isNodeStartEvent(event)) return event;
  throw new Error('Not a NodeStartEvent');
}

function extractNodeStopEvent(event: AgentifyEvent) {
  if (isNodeStopEvent(event)) return event;
  throw new Error('Not a NodeStopEvent');
}

function extractToolCallEvent(event: AgentifyEvent) {
  if (isToolCallEvent(event)) return event;
  throw new Error('Not a ToolCallEvent');
}

function extractWorkflowCompleteEvent(event: AgentifyEvent) {
  if (isWorkflowCompleteEvent(event)) return event;
  throw new Error('Not a WorkflowCompleteEvent');
}

function extractWorkflowErrorEvent(event: AgentifyEvent) {
  if (isWorkflowErrorEvent(event)) return event;
  throw new Error('Not a WorkflowErrorEvent');
}
