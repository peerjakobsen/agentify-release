/**
 * Log Panel Types
 * Types and interfaces for the Execution Log Panel functionality
 */

/**
 * Event types that can appear in the execution log
 */
export type LogEventType =
  | 'node_start'
  | 'node_stop'
  | 'tool_call'
  | 'tool_result'
  | 'workflow_complete'
  | 'workflow_error';

/**
 * Filter categories for event type filtering
 */
export type EventTypeFilterCategory =
  | 'all'
  | 'agent_events'
  | 'tool_calls'
  | 'errors_only';

/**
 * Status for log entries that can succeed or fail
 */
export type LogEntryStatus = 'success' | 'error' | 'neutral';

/**
 * Represents a single log entry in the execution log
 */
export interface LogEntry {
  /**
   * Unique identifier for the log entry
   */
  id: string;

  /**
   * Timestamp when the event occurred (epoch milliseconds)
   */
  timestamp: number;

  /**
   * Type of event
   */
  eventType: LogEventType;

  /**
   * Name of the agent or node associated with this event
   */
  agentName: string;

  /**
   * Human-readable summary of the event
   */
  summary: string;

  /**
   * Optional payload data (tool inputs, outputs, etc.)
   */
  payload?: Record<string, unknown>;

  /**
   * Whether this entry's payload is currently expanded in the UI
   */
  isExpanded: boolean;

  /**
   * Whether the truncated payload content is expanded
   */
  isTruncationExpanded: boolean;

  /**
   * Status of the entry (for success/error coloring)
   */
  status: LogEntryStatus;

  /**
   * Duration in milliseconds (for node_stop events)
   */
  durationMs?: number;

  /**
   * Error message (for error events)
   */
  errorMessage?: string;
}

/**
 * Filter state for the execution log
 */
export interface LogFilterState {
  /**
   * Current event type filter category
   */
  eventTypeFilter: EventTypeFilterCategory;

  /**
   * Current agent name filter (null or 'all' means show all agents)
   */
  agentNameFilter: string | null;
}

/**
 * State of the execution log panel
 */
export interface LogPanelState {
  /**
   * Array of log entries
   */
  entries: LogEntry[];

  /**
   * Current filter state
   */
  filters: LogFilterState;

  /**
   * Whether the log section is collapsed
   */
  isCollapsed: boolean;

  /**
   * Whether auto-scroll is enabled
   */
  autoScrollEnabled: boolean;

  /**
   * Whether user is at bottom of scroll container
   */
  isAtBottom: boolean;
}

/**
 * Default filter state
 */
export const DEFAULT_FILTER_STATE: LogFilterState = {
  eventTypeFilter: 'all',
  agentNameFilter: null,
};

/**
 * Default log panel state
 */
export const DEFAULT_LOG_PANEL_STATE: LogPanelState = {
  entries: [],
  filters: DEFAULT_FILTER_STATE,
  isCollapsed: true,
  autoScrollEnabled: true,
  isAtBottom: true,
};

/**
 * Maximum number of log entries to keep in memory
 */
export const MAX_LOG_ENTRIES = 500;

/**
 * Line threshold for payload truncation
 */
export const PAYLOAD_TRUNCATION_THRESHOLD = 20;

/**
 * Number of lines to show initially for truncated payloads
 */
export const PAYLOAD_TRUNCATION_PREVIEW_LINES = 10;

/**
 * Scroll threshold in pixels for auto-scroll detection
 */
export const SCROLL_BOTTOM_THRESHOLD = 50;

/**
 * Messages from webview to extension for log interactions
 */
export interface LogPanelMessage {
  command: string;
  entryId?: string;
  filterType?: EventTypeFilterCategory;
  agentName?: string;
  [key: string]: unknown;
}

/**
 * State synchronization message for log panel
 */
export interface LogPanelStateMessage {
  type: 'logStateSync';
  entries: LogEntry[];
  filters: LogFilterState;
  isCollapsed: boolean;
  autoScrollEnabled: boolean;
  uniqueAgentNames: string[];
}
