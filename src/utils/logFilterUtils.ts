/**
 * Log Filter Utilities
 * Functions for filtering log entries by event type and agent name
 */

import type { LogEntry, EventTypeFilterCategory, LogFilterState } from '../types/logPanel';

/**
 * Event types that belong to the 'agent_events' category
 */
const AGENT_EVENT_TYPES = ['node_start', 'node_stop'];

/**
 * Event types that belong to the 'tool_calls' category
 */
const TOOL_CALL_EVENT_TYPES = ['tool_call', 'tool_result'];

/**
 * Event types that belong to the 'errors_only' category
 */
const ERROR_EVENT_TYPES = ['workflow_error'];

/**
 * Checks if an entry matches the event type filter category
 *
 * @param entry - The log entry to check
 * @param filter - The event type filter category
 * @returns True if the entry matches the filter
 */
export function matchesEventTypeFilter(
  entry: LogEntry,
  filter: EventTypeFilterCategory
): boolean {
  switch (filter) {
    case 'all':
      return true;

    case 'agent_events':
      return AGENT_EVENT_TYPES.includes(entry.eventType);

    case 'tool_calls':
      return TOOL_CALL_EVENT_TYPES.includes(entry.eventType);

    case 'errors_only':
      // Include explicit error events
      if (ERROR_EVENT_TYPES.includes(entry.eventType)) {
        return true;
      }
      // Include entries with error status (failed node_stop, failed tool_result)
      return entry.status === 'error';

    default:
      return true;
  }
}

/**
 * Checks if an entry matches the agent name filter
 *
 * @param entry - The log entry to check
 * @param agentName - The agent name to filter by (null or 'all' means show all)
 * @returns True if the entry matches the filter
 */
export function matchesAgentNameFilter(
  entry: LogEntry,
  agentName: string | null
): boolean {
  // Null or 'all' means show all agents
  if (agentName === null || agentName === 'all') {
    return true;
  }

  return entry.agentName === agentName;
}

/**
 * Filters entries by event type category
 *
 * @param entries - Array of log entries
 * @param filter - Event type filter category
 * @returns Filtered array of log entries
 */
export function filterByEventType(
  entries: LogEntry[],
  filter: EventTypeFilterCategory
): LogEntry[] {
  if (filter === 'all') {
    return entries;
  }

  return entries.filter((entry) => matchesEventTypeFilter(entry, filter));
}

/**
 * Filters entries by agent name
 *
 * @param entries - Array of log entries
 * @param agentName - Agent name to filter by (null or 'all' means show all)
 * @returns Filtered array of log entries
 */
export function filterByAgentName(
  entries: LogEntry[],
  agentName: string | null
): LogEntry[] {
  if (agentName === null || agentName === 'all') {
    return entries;
  }

  return entries.filter((entry) => matchesAgentNameFilter(entry, agentName));
}

/**
 * Applies all active filters to log entries
 *
 * @param entries - Array of log entries
 * @param filters - Filter state object
 * @returns Filtered array of log entries
 */
export function applyFilters(
  entries: LogEntry[],
  filters: LogFilterState
): LogEntry[] {
  let result = entries;

  // Apply event type filter
  result = filterByEventType(result, filters.eventTypeFilter);

  // Apply agent name filter
  result = filterByAgentName(result, filters.agentNameFilter);

  return result;
}

/**
 * Extracts unique agent names from log entries
 * Excludes 'Workflow' as it's a special system-level entry
 *
 * @param entries - Array of log entries
 * @returns Sorted array of unique agent names
 */
export function extractUniqueAgentNames(entries: LogEntry[]): string[] {
  const names = new Set<string>();

  for (const entry of entries) {
    // Exclude 'Workflow' as it's not a real agent
    if (entry.agentName && entry.agentName !== 'Workflow') {
      names.add(entry.agentName);
    }
  }

  // Return sorted array
  return Array.from(names).sort();
}

/**
 * Gets display labels for event type filter options
 *
 * @returns Object mapping filter values to display labels
 */
export function getEventTypeFilterLabels(): Record<EventTypeFilterCategory, string> {
  return {
    all: 'All Events',
    agent_events: 'Agent Events',
    tool_calls: 'Tool Calls',
    errors_only: 'Errors Only',
  };
}

/**
 * Counts entries matching each filter category
 * Useful for showing counts in filter dropdown
 *
 * @param entries - Array of log entries
 * @returns Object with counts for each category
 */
export function countEntriesByCategory(
  entries: LogEntry[]
): Record<EventTypeFilterCategory, number> {
  return {
    all: entries.length,
    agent_events: filterByEventType(entries, 'agent_events').length,
    tool_calls: filterByEventType(entries, 'tool_calls').length,
    errors_only: filterByEventType(entries, 'errors_only').length,
  };
}

/**
 * Checks if a payload should be truncated based on line count
 *
 * @param payload - The payload object
 * @param threshold - Number of lines threshold (default: 20)
 * @returns True if the payload exceeds the threshold
 */
export function shouldTruncatePayload(
  payload: Record<string, unknown> | undefined,
  threshold: number = 20
): boolean {
  if (!payload) {
    return false;
  }

  const jsonString = JSON.stringify(payload, null, 2);
  const lineCount = jsonString.split('\n').length;

  return lineCount > threshold;
}

/**
 * Truncates a JSON payload to a specified number of lines
 *
 * @param payload - The payload object
 * @param maxLines - Maximum number of lines to show (default: 10)
 * @returns Object with truncated content and remaining line count
 */
export function truncatePayload(
  payload: Record<string, unknown>,
  maxLines: number = 10
): { truncated: string; remainingLines: number; totalLines: number } {
  const jsonString = JSON.stringify(payload, null, 2);
  const lines = jsonString.split('\n');
  const totalLines = lines.length;

  if (totalLines <= maxLines) {
    return {
      truncated: jsonString,
      remainingLines: 0,
      totalLines,
    };
  }

  const truncatedLines = lines.slice(0, maxLines);
  const remainingLines = totalLines - maxLines;

  return {
    truncated: truncatedLines.join('\n'),
    remainingLines,
    totalLines,
  };
}
