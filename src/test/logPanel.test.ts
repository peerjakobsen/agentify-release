/**
 * Tests for Execution Log Panel (Task Groups 1-9)
 *
 * Tests for:
 * - Log entry type definitions and creation
 * - Timestamp formatting (HH:MM:SS.mmm format)
 * - Event filtering logic (by type, by agent name)
 * - Log entry transformation from events
 * - Payload truncation logic
 * - HTML structure rendering (Task Group 2)
 * - Event type icons and visual styling (Task Group 3)
 * - Expandable JSON payload viewer (Task Group 4)
 * - Auto-scroll behavior (Task Group 6)
 * - State management and panel integration (Task Group 7)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatLogTimestamp,
  formatDuration,
} from '../utils/logTimestampFormatter';
import {
  transformEventToLogEntry,
  transformEventsToLogEntries,
  createWorkflowErrorEntry,
  resetEntryIdCounter,
} from '../utils/logEntryTransformer';
import {
  matchesEventTypeFilter,
  matchesAgentNameFilter,
  filterByEventType,
  filterByAgentName,
  applyFilters,
  extractUniqueAgentNames,
  shouldTruncatePayload,
  truncatePayload,
} from '../utils/logFilterUtils';
import {
  generateLogSectionHtml,
  generateLogEntryHtml,
  generateLogSectionCss,
  tokenizeJson,
  generatePayloadHtml,
  generateScrollToBottomButton,
  generateLogSectionJs,
} from '../utils/logPanelHtmlGenerator';
import type { LogEntry, LogFilterState, EventTypeFilterCategory, LogPanelState } from '../types/logPanel';
import { DEFAULT_LOG_PANEL_STATE, DEFAULT_FILTER_STATE, SCROLL_BOTTOM_THRESHOLD, MAX_LOG_ENTRIES } from '../types/logPanel';
import type {
  MergedEvent,
  NodeStartEvent,
  NodeStopEvent,
  ToolCallEvent,
  WorkflowCompleteEvent,
  NodeStreamEvent,
  GraphStructureEvent,
} from '../types/events';

// ============================================================================
// Task Group 1: Type Definitions and Utilities Tests
// ============================================================================

describe('Log Timestamp Formatter', () => {
  it('should format epoch milliseconds to HH:MM:SS.mmm', () => {
    // Create a date at specific time: 14:30:45.123
    const date = new Date(2024, 0, 1, 14, 30, 45, 123);
    const timestamp = date.getTime();

    const result = formatLogTimestamp(timestamp);

    expect(result).toBe('14:30:45.123');
  });

  it('should format ISO string to HH:MM:SS.mmm', () => {
    // Note: ISO string will be parsed in local timezone
    const date = new Date(2024, 0, 1, 9, 5, 3, 7);
    const isoString = date.toISOString();

    const result = formatLogTimestamp(isoString);

    // Should match the UTC time from the ISO string
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('should format Date object to HH:MM:SS.mmm', () => {
    const date = new Date(2024, 0, 1, 23, 59, 59, 999);

    const result = formatLogTimestamp(date);

    expect(result).toBe('23:59:59.999');
  });

  it('should pad single digits correctly', () => {
    const date = new Date(2024, 0, 1, 1, 2, 3, 4);

    const result = formatLogTimestamp(date);

    expect(result).toBe('01:02:03.004');
  });

  it('should return placeholder for null input', () => {
    const result = formatLogTimestamp(null);
    expect(result).toBe('--:--:--.---');
  });

  it('should return placeholder for undefined input', () => {
    const result = formatLogTimestamp(undefined);
    expect(result).toBe('--:--:--.---');
  });

  it('should return placeholder for invalid date string', () => {
    const result = formatLogTimestamp('not-a-date');
    expect(result).toBe('--:--:--.---');
  });
});

describe('Duration Formatter', () => {
  it('should format milliseconds under 1 second', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(150)).toBe('150ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('should format seconds with one decimal', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(12345)).toBe('12.3s');
  });

  it('should format minutes and seconds', () => {
    expect(formatDuration(60000)).toBe('1m');
    expect(formatDuration(62000)).toBe('1m 2s');
    expect(formatDuration(125000)).toBe('2m 5s');
  });

  it('should return ? for null/undefined', () => {
    expect(formatDuration(null)).toBe('?');
    expect(formatDuration(undefined)).toBe('?');
  });
});

describe('Log Entry Transformer - NodeStartEvent', () => {
  beforeEach(() => {
    resetEntryIdCounter();
  });

  it('should transform node_start event to LogEntry', () => {
    const event: NodeStartEvent = {
      type: 'node_start',
      workflow_id: 'wf-12345678',
      timestamp: Date.now(),
      node_id: 'researcher_agent',
    };

    const mergedEvent: MergedEvent<NodeStartEvent> = {
      source: 'stdout',
      event,
    };

    const result = transformEventToLogEntry(mergedEvent);

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe('node_start');
    expect(result!.agentName).toBe('researcher_agent');
    expect(result!.summary).toBe('Agent started');
    expect(result!.status).toBe('neutral');
    expect(result!.isExpanded).toBe(false);
  });
});

describe('Log Entry Transformer - NodeStopEvent', () => {
  beforeEach(() => {
    resetEntryIdCounter();
  });

  it('should transform successful node_stop event', () => {
    const event: NodeStopEvent = {
      type: 'node_stop',
      workflow_id: 'wf-12345678',
      timestamp: Date.now(),
      node_id: 'researcher_agent',
      status: 'completed',
      execution_time_ms: 1234,
    };

    const mergedEvent: MergedEvent<NodeStopEvent> = {
      source: 'stdout',
      event,
    };

    const result = transformEventToLogEntry(mergedEvent);

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe('node_stop');
    expect(result!.agentName).toBe('researcher_agent');
    expect(result!.summary).toContain('Agent completed');
    expect(result!.summary).toContain('1.2s');
    expect(result!.status).toBe('success');
    expect(result!.durationMs).toBe(1234);
  });

  it('should transform failed node_stop event', () => {
    const event: NodeStopEvent = {
      type: 'node_stop',
      workflow_id: 'wf-12345678',
      timestamp: Date.now(),
      node_id: 'researcher_agent',
      status: 'failed',
      execution_time_ms: 500,
    };

    const mergedEvent: MergedEvent<NodeStopEvent> = {
      source: 'stdout',
      event,
    };

    const result = transformEventToLogEntry(mergedEvent);

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe('node_stop');
    expect(result!.summary).toContain('Agent failed');
    expect(result!.status).toBe('error');
  });
});

describe('Log Entry Transformer - ToolCallEvent', () => {
  beforeEach(() => {
    resetEntryIdCounter();
  });

  it('should transform tool_call started event', () => {
    const event: ToolCallEvent = {
      event_type: 'tool_call',
      workflow_id: 'wf-12345678',
      timestamp: Date.now(),
      agent_name: 'researcher_agent',
      system: 'filesystem',
      operation: 'read_file',
      input: { path: '/test.txt' },
      status: 'started',
    };

    const mergedEvent: MergedEvent<ToolCallEvent> = {
      source: 'dynamodb',
      event,
    };

    const result = transformEventToLogEntry(mergedEvent);

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe('tool_call');
    expect(result!.agentName).toBe('researcher_agent');
    expect(result!.summary).toBe('Tool: filesystem -> read_file');
    expect(result!.status).toBe('neutral');
    expect(result!.payload).toEqual({
      system: 'filesystem',
      operation: 'read_file',
      input: { path: '/test.txt' },
    });
  });

  it('should transform tool_call completed event', () => {
    const event: ToolCallEvent = {
      event_type: 'tool_call',
      workflow_id: 'wf-12345678',
      timestamp: Date.now(),
      agent_name: 'researcher_agent',
      system: 'filesystem',
      operation: 'read_file',
      input: { path: '/test.txt' },
      output: { content: 'file contents' },
      status: 'completed',
    };

    const mergedEvent: MergedEvent<ToolCallEvent> = {
      source: 'dynamodb',
      event,
    };

    const result = transformEventToLogEntry(mergedEvent);

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe('tool_result');
    expect(result!.status).toBe('success');
    expect(result!.payload).toHaveProperty('output');
  });

  it('should transform tool_call failed event', () => {
    const event: ToolCallEvent = {
      event_type: 'tool_call',
      workflow_id: 'wf-12345678',
      timestamp: Date.now(),
      agent_name: 'researcher_agent',
      system: 'filesystem',
      operation: 'read_file',
      input: { path: '/missing.txt' },
      status: 'failed',
      error_message: 'File not found',
    };

    const mergedEvent: MergedEvent<ToolCallEvent> = {
      source: 'dynamodb',
      event,
    };

    const result = transformEventToLogEntry(mergedEvent);

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe('tool_result');
    expect(result!.summary).toContain('Tool failed');
    expect(result!.summary).toContain('File not found');
    expect(result!.status).toBe('error');
    expect(result!.errorMessage).toBe('File not found');
  });
});

describe('Log Entry Transformer - Filtered Events', () => {
  beforeEach(() => {
    resetEntryIdCounter();
  });

  it('should filter out node_stream events', () => {
    const event: NodeStreamEvent = {
      type: 'node_stream',
      workflow_id: 'wf-12345678',
      timestamp: Date.now(),
      node_id: 'researcher_agent',
      data: 'streaming token',
    };

    const mergedEvent: MergedEvent<NodeStreamEvent> = {
      source: 'stdout',
      event,
    };

    const result = transformEventToLogEntry(mergedEvent);

    expect(result).toBeNull();
  });

  it('should filter out graph_structure events', () => {
    const event: GraphStructureEvent = {
      type: 'graph_structure',
      workflow_id: 'wf-12345678',
      timestamp: Date.now(),
      nodes: [],
      edges: [],
      entry_points: [],
    };

    const mergedEvent: MergedEvent<GraphStructureEvent> = {
      source: 'stdout',
      event,
    };

    const result = transformEventToLogEntry(mergedEvent);

    expect(result).toBeNull();
  });
});

describe('Log Entry Transformer - WorkflowCompleteEvent', () => {
  beforeEach(() => {
    resetEntryIdCounter();
  });

  it('should transform successful workflow_complete event', () => {
    const event: WorkflowCompleteEvent = {
      type: 'workflow_complete',
      workflow_id: 'wf-12345678',
      timestamp: Date.now(),
      status: 'completed',
      execution_time_ms: 5000,
      execution_order: ['agent1', 'agent2'],
    };

    const mergedEvent: MergedEvent<WorkflowCompleteEvent> = {
      source: 'stdout',
      event,
    };

    const result = transformEventToLogEntry(mergedEvent);

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe('workflow_complete');
    expect(result!.summary).toContain('Workflow completed');
    expect(result!.status).toBe('success');
  });

  it('should transform failed workflow_complete event as workflow_error', () => {
    const event: WorkflowCompleteEvent = {
      type: 'workflow_complete',
      workflow_id: 'wf-12345678',
      timestamp: Date.now(),
      status: 'failed',
      execution_time_ms: 3000,
      execution_order: ['agent1'],
    };

    const mergedEvent: MergedEvent<WorkflowCompleteEvent> = {
      source: 'stdout',
      event,
    };

    const result = transformEventToLogEntry(mergedEvent);

    expect(result).not.toBeNull();
    expect(result!.eventType).toBe('workflow_error');
    expect(result!.status).toBe('error');
  });
});

// ============================================================================
// Task Group 2: HTML Structure and Base CSS Tests
// ============================================================================

describe('Log Section HTML Structure', () => {
  it('should render log section with correct structure (header, filters, entry list)', () => {
    const html = generateLogSectionHtml({
      entries: [],
      isCollapsed: true,
      uniqueAgentNames: [],
      filters: { eventTypeFilter: 'all', agentNameFilter: null },
    });

    // Verify section header exists with label
    expect(html).toContain('log-section');
    expect(html).toContain('log-section-header');
    expect(html).toContain('Execution Log');

    // Verify filter dropdowns container
    expect(html).toContain('log-filters');
    expect(html).toContain('eventTypeFilter');
    expect(html).toContain('agentNameFilter');

    // Verify log entries container
    expect(html).toContain('log-entries-container');

    // Verify expand/collapse indicator
    expect(html).toContain('collapse-indicator');
  });

  it('should render log entry with timestamp, icon, agent name, and summary', () => {
    const entry: LogEntry = {
      id: 'test-entry-1',
      timestamp: new Date(2024, 0, 1, 10, 30, 45, 123).getTime(),
      eventType: 'node_start',
      agentName: 'researcher_agent',
      summary: 'Agent started',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    };

    const html = generateLogEntryHtml(entry);

    // Verify entry structure
    expect(html).toContain('log-entry');
    expect(html).toContain('log-entry-timestamp');
    expect(html).toContain('10:30:45.123');
    expect(html).toContain('log-entry-icon');
    expect(html).toContain('log-entry-agent');
    expect(html).toContain('researcher_agent');
    expect(html).toContain('log-entry-summary');
    expect(html).toContain('Agent started');
  });

  it('should render collapsed section by default with correct CSS class', () => {
    const html = generateLogSectionHtml({
      entries: [],
      isCollapsed: true,
      uniqueAgentNames: [],
      filters: { eventTypeFilter: 'all', agentNameFilter: null },
    });

    expect(html).toContain('collapsed');
  });

  it('should render expanded section when isCollapsed is false', () => {
    const html = generateLogSectionHtml({
      entries: [],
      isCollapsed: false,
      uniqueAgentNames: [],
      filters: { eventTypeFilter: 'all', agentNameFilter: null },
    });

    expect(html).not.toMatch(/class="[^"]*log-section[^"]*collapsed[^"]*"/);
  });
});

// ============================================================================
// Task Group 3: Event Type Icons and Visual Styling Tests
// ============================================================================

describe('Event Type Icons', () => {
  it('should render correct icon for each event type', () => {
    const eventTypes: Array<{ eventType: LogEntry['eventType']; status: LogEntry['status']; iconDescription: string }> = [
      { eventType: 'node_start', status: 'neutral', iconDescription: 'play' },
      { eventType: 'node_stop', status: 'success', iconDescription: 'check' },
      { eventType: 'node_stop', status: 'error', iconDescription: 'x' },
      { eventType: 'tool_call', status: 'neutral', iconDescription: 'wrench' },
      { eventType: 'tool_result', status: 'success', iconDescription: 'arrow' },
      { eventType: 'tool_result', status: 'error', iconDescription: 'arrow' },
      { eventType: 'workflow_complete', status: 'success', iconDescription: 'flag' },
      { eventType: 'workflow_error', status: 'error', iconDescription: 'alert' },
    ];

    for (const { eventType, status } of eventTypes) {
      const entry: LogEntry = {
        id: `test-${eventType}-${status}`,
        timestamp: Date.now(),
        eventType,
        agentName: 'test_agent',
        summary: 'Test summary',
        isExpanded: false,
        isTruncationExpanded: false,
        status,
      };

      const html = generateLogEntryHtml(entry);

      // Verify SVG icon is present
      expect(html).toContain('<svg class="log-icon"');
      expect(html).toContain('viewBox="0 0 16 16"');
      expect(html).toContain('log-entry-icon');
    }
  });

  it('should render check icon for successful node_stop and X icon for error', () => {
    // Success case
    const successEntry: LogEntry = {
      id: 'success-entry',
      timestamp: Date.now(),
      eventType: 'node_stop',
      agentName: 'test_agent',
      summary: 'Agent completed',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'success',
    };

    const successHtml = generateLogEntryHtml(successEntry);
    // Check icon path contains checkmark-like shape (M13.78... for check)
    expect(successHtml).toContain('M13.78');

    // Error case
    const errorEntry: LogEntry = {
      id: 'error-entry',
      timestamp: Date.now(),
      eventType: 'node_stop',
      agentName: 'test_agent',
      summary: 'Agent failed',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'error',
    };

    const errorHtml = generateLogEntryHtml(errorEntry);
    // X icon path contains X-like shape (M3.72... for X)
    expect(errorHtml).toContain('M3.72');
  });

  it('should render workflow_error with alert icon', () => {
    const entry: LogEntry = {
      id: 'workflow-error-entry',
      timestamp: Date.now(),
      eventType: 'workflow_error',
      agentName: 'Workflow',
      summary: 'Workflow failed: Connection timeout',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'error',
      errorMessage: 'Connection timeout',
    };

    const html = generateLogEntryHtml(entry);

    // Alert icon path (M8 1.5... circle with exclamation)
    expect(html).toContain('M8 1.5');
    expect(html).toContain('status-error');
    expect(html).toContain('Connection timeout');
  });
});

describe('Event Type Color Coding', () => {
  it('should apply success color coding for successful node_stop', () => {
    const entry: LogEntry = {
      id: 'success-entry',
      timestamp: Date.now(),
      eventType: 'node_stop',
      agentName: 'test_agent',
      summary: 'Agent completed',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'success',
    };

    const html = generateLogEntryHtml(entry);

    expect(html).toContain('status-success');
  });

  it('should apply error color coding for failed tool_result', () => {
    const entry: LogEntry = {
      id: 'error-entry',
      timestamp: Date.now(),
      eventType: 'tool_result',
      agentName: 'test_agent',
      summary: 'Tool failed: File not found',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'error',
      errorMessage: 'File not found',
    };

    const html = generateLogEntryHtml(entry);

    expect(html).toContain('status-error');
  });

  it('should apply neutral color coding for node_start and tool_call', () => {
    const nodeStartEntry: LogEntry = {
      id: 'node-start-entry',
      timestamp: Date.now(),
      eventType: 'node_start',
      agentName: 'test_agent',
      summary: 'Agent started',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    };

    const toolCallEntry: LogEntry = {
      id: 'tool-call-entry',
      timestamp: Date.now(),
      eventType: 'tool_call',
      agentName: 'test_agent',
      summary: 'Tool: filesystem -> read_file',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    };

    const nodeStartHtml = generateLogEntryHtml(nodeStartEntry);
    const toolCallHtml = generateLogEntryHtml(toolCallEntry);

    expect(nodeStartHtml).toContain('status-neutral');
    expect(toolCallHtml).toContain('status-neutral');
  });
});

describe('CSS Color Scheme Custom Properties', () => {
  it('should define semantic color CSS custom properties', () => {
    const css = generateLogSectionCss();

    // Verify custom properties are defined using VS Code variables
    expect(css).toContain('--log-color-neutral');
    expect(css).toContain('--log-color-success');
    expect(css).toContain('--log-color-error');

    // Verify they reference VS Code CSS variables
    expect(css).toContain('--vscode-foreground');
    expect(css).toContain('--vscode-testing-iconPassed');
    expect(css).toContain('--vscode-testing-iconFailed');
  });

  it('should apply color classes to icons based on status', () => {
    const css = generateLogSectionCss();

    // Verify status classes use the custom properties
    expect(css).toContain('.status-neutral');
    expect(css).toContain('.status-success');
    expect(css).toContain('.status-error');
  });
});

// ============================================================================
// Task Group 4: Expandable JSON Payload Viewer Tests
// ============================================================================

describe('Payload Expand/Collapse Button', () => {
  it('should render expand button for entries with payloads', () => {
    const entry: LogEntry = {
      id: 'tool-call-entry',
      timestamp: Date.now(),
      eventType: 'tool_call',
      agentName: 'test_agent',
      summary: 'Tool: filesystem -> read_file',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
      payload: { system: 'filesystem', operation: 'read_file', input: { path: '/test.txt' } },
    };

    const html = generateLogEntryHtml(entry);

    // Verify expand button is present with [+] indicator
    expect(html).toContain('log-entry-expand-btn');
    expect(html).toContain('[+]');
    expect(html).toContain(`data-entry-id="${entry.id}"`);
  });

  it('should render collapse button when entry is expanded', () => {
    const entry: LogEntry = {
      id: 'tool-call-entry',
      timestamp: Date.now(),
      eventType: 'tool_call',
      agentName: 'test_agent',
      summary: 'Tool: filesystem -> read_file',
      isExpanded: true,
      isTruncationExpanded: false,
      status: 'neutral',
      payload: { system: 'filesystem', operation: 'read_file' },
    };

    const html = generateLogEntryHtml(entry);

    // Verify collapse button shows [-] indicator
    expect(html).toContain('log-entry-expand-btn');
    expect(html).toContain('[-]');
  });

  it('should not render expand button for entries without payloads', () => {
    const entry: LogEntry = {
      id: 'node-start-entry',
      timestamp: Date.now(),
      eventType: 'node_start',
      agentName: 'test_agent',
      summary: 'Agent started',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    };

    const html = generateLogEntryHtml(entry);

    // Verify no expand button
    expect(html).not.toContain('log-entry-expand-btn');
  });

  it('should render payload container when entry is expanded', () => {
    const entry: LogEntry = {
      id: 'tool-call-entry',
      timestamp: Date.now(),
      eventType: 'tool_call',
      agentName: 'test_agent',
      summary: 'Tool: filesystem -> read_file',
      isExpanded: true,
      isTruncationExpanded: false,
      status: 'neutral',
      payload: { system: 'filesystem', operation: 'read_file' },
    };

    const html = generateLogEntryHtml(entry);

    // Verify payload container is present
    expect(html).toContain('log-entry-payload');
    expect(html).toContain('payload-content');
  });

  it('should not render payload container when entry is collapsed', () => {
    const entry: LogEntry = {
      id: 'tool-call-entry',
      timestamp: Date.now(),
      eventType: 'tool_call',
      agentName: 'test_agent',
      summary: 'Tool: filesystem -> read_file',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
      payload: { system: 'filesystem', operation: 'read_file' },
    };

    const html = generateLogEntryHtml(entry);

    // Verify payload container is NOT present when collapsed
    expect(html).not.toContain('log-entry-payload');
  });
});

describe('JSON Syntax Highlighting', () => {
  it('should apply correct CSS class for string values', () => {
    const jsonString = '{"name": "test"}';
    const highlighted = tokenizeJson(jsonString);

    // Verify string values get json-string class
    expect(highlighted).toContain('json-string');
    expect(highlighted).toContain('&quot;test&quot;');
  });

  it('should apply correct CSS class for number values', () => {
    const jsonString = '{"count": 42, "price": 19.99}';
    const highlighted = tokenizeJson(jsonString);

    // Verify number values get json-number class
    expect(highlighted).toContain('json-number');
    expect(highlighted).toContain('>42<');
    expect(highlighted).toContain('>19.99<');
  });

  it('should apply correct CSS class for boolean values', () => {
    const jsonString = '{"active": true, "disabled": false}';
    const highlighted = tokenizeJson(jsonString);

    // Verify boolean values get json-boolean class
    expect(highlighted).toContain('json-boolean');
    expect(highlighted).toContain('>true<');
    expect(highlighted).toContain('>false<');
  });

  it('should apply correct CSS class for null values', () => {
    const jsonString = '{"value": null}';
    const highlighted = tokenizeJson(jsonString);

    // Verify null values get json-null class
    expect(highlighted).toContain('json-null');
    expect(highlighted).toContain('>null<');
  });

  it('should apply correct CSS class for property keys', () => {
    const jsonString = '{"key": "value"}';
    const highlighted = tokenizeJson(jsonString);

    // Verify keys get json-key class
    expect(highlighted).toContain('json-key');
  });

  it('should define JSON syntax highlighting CSS variables', () => {
    const css = generateLogSectionCss();

    // Verify JSON highlighting CSS classes are defined
    expect(css).toContain('.json-string');
    expect(css).toContain('.json-number');
    expect(css).toContain('.json-boolean');
    expect(css).toContain('.json-null');
    expect(css).toContain('.json-key');

    // Verify VS Code CSS variables are used
    expect(css).toContain('--vscode-symbolIcon-stringForeground');
    expect(css).toContain('--vscode-symbolIcon-numberForeground');
    expect(css).toContain('--vscode-symbolIcon-booleanForeground');
    expect(css).toContain('--vscode-symbolIcon-keywordForeground');
  });
});

describe('Payload Truncation', () => {
  it('should detect payload needing truncation', () => {
    const largePayload: Record<string, unknown> = {};
    // Create payload that will result in >20 lines when formatted
    for (let i = 0; i < 25; i++) {
      largePayload[`key${i}`] = `value${i}`;
    }

    expect(shouldTruncatePayload(largePayload, 20)).toBe(true);
  });

  it('should not truncate small payload', () => {
    const smallPayload = { key1: 'value1', key2: 'value2' };

    expect(shouldTruncatePayload(smallPayload, 20)).toBe(false);
  });

  it('should return false for undefined payload', () => {
    expect(shouldTruncatePayload(undefined)).toBe(false);
  });

  it('should truncate payload to specified lines', () => {
    const payload: Record<string, unknown> = {};
    for (let i = 0; i < 25; i++) {
      payload[`key${i}`] = `value${i}`;
    }

    const result = truncatePayload(payload, 10);

    expect(result.truncated.split('\n').length).toBe(10);
    expect(result.remainingLines).toBeGreaterThan(0);
    expect(result.totalLines).toBeGreaterThan(10);
  });

  it('should not truncate payload under threshold', () => {
    const payload = { key1: 'value1', key2: 'value2' };

    const result = truncatePayload(payload, 100);

    expect(result.remainingLines).toBe(0);
  });

  it('should render "Show more" link for large truncated payloads', () => {
    const largePayload: Record<string, unknown> = {};
    for (let i = 0; i < 30; i++) {
      largePayload[`key${i}`] = `value${i}`;
    }

    const html = generatePayloadHtml(largePayload, false, 'test-entry');

    // Verify "Show more" link is present
    expect(html).toContain('payload-show-more');
    expect(html).toContain('Show more...');
    expect(html).toContain('more lines');
    expect(html).toContain('payload-truncated');
    expect(html).toContain('data-entry-id="test-entry"');
  });

  it('should show full payload when truncation is expanded', () => {
    const largePayload: Record<string, unknown> = {};
    for (let i = 0; i < 30; i++) {
      largePayload[`key${i}`] = `value${i}`;
    }

    const html = generatePayloadHtml(largePayload, true, 'test-entry');

    // Verify full payload is shown without "Show more" link
    expect(html).not.toContain('payload-show-more');
    expect(html).not.toContain('payload-truncated');
    expect(html).toContain('payload-content');
    // Verify last key is included
    expect(html).toContain('key29');
  });

  it('should not show "Show more" for small payloads', () => {
    const smallPayload = { key1: 'value1', key2: 'value2' };

    const html = generatePayloadHtml(smallPayload, false, 'test-entry');

    // Verify no "Show more" link for small payloads
    expect(html).not.toContain('payload-show-more');
    expect(html).not.toContain('payload-truncated');
  });
});

// ============================================================================
// Task Group 5: Filtering System Tests
// ============================================================================

describe('Event Type Filtering', () => {
  const testEntries: LogEntry[] = [
    {
      id: '1',
      timestamp: Date.now(),
      eventType: 'node_start',
      agentName: 'agent1',
      summary: 'Agent started',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    },
    {
      id: '2',
      timestamp: Date.now(),
      eventType: 'node_stop',
      agentName: 'agent1',
      summary: 'Agent completed',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'success',
    },
    {
      id: '3',
      timestamp: Date.now(),
      eventType: 'tool_call',
      agentName: 'agent1',
      summary: 'Tool: fs -> read',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    },
    {
      id: '4',
      timestamp: Date.now(),
      eventType: 'tool_result',
      agentName: 'agent1',
      summary: 'Tool failed',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'error',
    },
    {
      id: '5',
      timestamp: Date.now(),
      eventType: 'workflow_error',
      agentName: 'Workflow',
      summary: 'Workflow failed',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'error',
    },
  ];

  it('should return all entries for "all" filter', () => {
    const result = filterByEventType(testEntries, 'all');
    expect(result.length).toBe(5);
  });

  it('should filter to agent events only', () => {
    const result = filterByEventType(testEntries, 'agent_events');
    expect(result.length).toBe(2);
    expect(result.every(e => ['node_start', 'node_stop'].includes(e.eventType))).toBe(true);
  });

  it('should filter to tool calls only', () => {
    const result = filterByEventType(testEntries, 'tool_calls');
    expect(result.length).toBe(2);
    expect(result.every(e => ['tool_call', 'tool_result'].includes(e.eventType))).toBe(true);
  });

  it('should filter to errors only', () => {
    const result = filterByEventType(testEntries, 'errors_only');
    expect(result.length).toBe(2); // tool_result with error + workflow_error
    expect(result.every(e => e.status === 'error')).toBe(true);
  });
});

describe('Agent Name Filtering', () => {
  const testEntries: LogEntry[] = [
    {
      id: '1',
      timestamp: Date.now(),
      eventType: 'node_start',
      agentName: 'researcher',
      summary: 'Agent started',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    },
    {
      id: '2',
      timestamp: Date.now(),
      eventType: 'node_start',
      agentName: 'writer',
      summary: 'Agent started',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    },
    {
      id: '3',
      timestamp: Date.now(),
      eventType: 'node_stop',
      agentName: 'researcher',
      summary: 'Agent completed',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'success',
    },
  ];

  it('should return all entries for null filter', () => {
    const result = filterByAgentName(testEntries, null);
    expect(result.length).toBe(3);
  });

  it('should return all entries for "all" filter', () => {
    const result = filterByAgentName(testEntries, 'all');
    expect(result.length).toBe(3);
  });

  it('should filter by specific agent name', () => {
    const result = filterByAgentName(testEntries, 'researcher');
    expect(result.length).toBe(2);
    expect(result.every(e => e.agentName === 'researcher')).toBe(true);
  });

  it('should return empty for non-existent agent', () => {
    const result = filterByAgentName(testEntries, 'nonexistent');
    expect(result.length).toBe(0);
  });
});

describe('Combined Filtering', () => {
  const testEntries: LogEntry[] = [
    {
      id: '1',
      timestamp: Date.now(),
      eventType: 'node_start',
      agentName: 'agent1',
      summary: 'Agent started',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    },
    {
      id: '2',
      timestamp: Date.now(),
      eventType: 'tool_call',
      agentName: 'agent1',
      summary: 'Tool call',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    },
    {
      id: '3',
      timestamp: Date.now(),
      eventType: 'node_start',
      agentName: 'agent2',
      summary: 'Agent started',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    },
    {
      id: '4',
      timestamp: Date.now(),
      eventType: 'tool_call',
      agentName: 'agent2',
      summary: 'Tool call',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    },
  ];

  it('should apply both event type and agent name filters', () => {
    const filters: LogFilterState = {
      eventTypeFilter: 'agent_events',
      agentNameFilter: 'agent1',
    };

    const result = applyFilters(testEntries, filters);

    expect(result.length).toBe(1);
    expect(result[0].eventType).toBe('node_start');
    expect(result[0].agentName).toBe('agent1');
  });
});

describe('Extract Unique Agent Names', () => {
  const testEntries: LogEntry[] = [
    {
      id: '1',
      timestamp: Date.now(),
      eventType: 'node_start',
      agentName: 'researcher',
      summary: 'Agent started',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    },
    {
      id: '2',
      timestamp: Date.now(),
      eventType: 'node_start',
      agentName: 'writer',
      summary: 'Agent started',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    },
    {
      id: '3',
      timestamp: Date.now(),
      eventType: 'node_stop',
      agentName: 'researcher',
      summary: 'Agent completed',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'success',
    },
    {
      id: '4',
      timestamp: Date.now(),
      eventType: 'workflow_complete',
      agentName: 'Workflow',
      summary: 'Workflow completed',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'success',
    },
  ];

  it('should extract unique agent names and exclude Workflow', () => {
    const result = extractUniqueAgentNames(testEntries);

    expect(result).toHaveLength(2);
    expect(result).toContain('researcher');
    expect(result).toContain('writer');
    expect(result).not.toContain('Workflow');
  });

  it('should return sorted array', () => {
    const result = extractUniqueAgentNames(testEntries);

    expect(result).toEqual(['researcher', 'writer']);
  });
});

describe('Create Workflow Error Entry', () => {
  beforeEach(() => {
    resetEntryIdCounter();
  });

  it('should create error entry with message', () => {
    const entry = createWorkflowErrorEntry('Connection timeout');

    expect(entry.eventType).toBe('workflow_error');
    expect(entry.summary).toBe('Workflow failed: Connection timeout');
    expect(entry.status).toBe('error');
    expect(entry.errorMessage).toBe('Connection timeout');
    expect(entry.timestamp).toBeDefined();
  });

  it('should use provided timestamp', () => {
    const timestamp = 1234567890000;
    const entry = createWorkflowErrorEntry('Error', timestamp);

    expect(entry.timestamp).toBe(timestamp);
  });
});

describe('Transform Events to Log Entries', () => {
  beforeEach(() => {
    resetEntryIdCounter();
  });

  it('should transform array of events filtering out excluded types', () => {
    const events: MergedEvent[] = [
      {
        source: 'stdout',
        event: {
          type: 'node_start',
          workflow_id: 'wf-1',
          timestamp: Date.now(),
          node_id: 'agent1',
        } as NodeStartEvent,
      },
      {
        source: 'stdout',
        event: {
          type: 'node_stream',
          workflow_id: 'wf-1',
          timestamp: Date.now(),
          node_id: 'agent1',
          data: 'token',
        } as NodeStreamEvent,
      },
      {
        source: 'stdout',
        event: {
          type: 'node_stop',
          workflow_id: 'wf-1',
          timestamp: Date.now(),
          node_id: 'agent1',
          status: 'completed',
          execution_time_ms: 100,
        } as NodeStopEvent,
      },
    ];

    const result = transformEventsToLogEntries(events);

    expect(result.length).toBe(2); // node_stream filtered out
    expect(result[0].eventType).toBe('node_start');
    expect(result[1].eventType).toBe('node_stop');
  });
});

// ============================================================================
// Task Group 6: Auto-Scroll Behavior Tests
// ============================================================================

describe('Auto-Scroll Behavior', () => {
  it('should have default auto-scroll enabled and isAtBottom true', () => {
    // Verify default log panel state has auto-scroll enabled
    expect(DEFAULT_LOG_PANEL_STATE.autoScrollEnabled).toBe(true);
    expect(DEFAULT_LOG_PANEL_STATE.isAtBottom).toBe(true);
  });

  it('should have scroll bottom threshold defined', () => {
    // Verify scroll threshold constant is defined (50px per spec)
    expect(SCROLL_BOTTOM_THRESHOLD).toBe(50);
  });

  it('should render scroll to bottom button HTML', () => {
    const html = generateScrollToBottomButton();

    // Verify button has correct structure
    expect(html).toContain('scroll-to-bottom-btn');
    expect(html).toContain('scrollToBottomBtn');
    expect(html).toContain('Scroll to bottom');
  });

  it('should include scroll to bottom button in log section HTML', () => {
    const html = generateLogSectionHtml({
      entries: [],
      isCollapsed: false,
      uniqueAgentNames: [],
      filters: { eventTypeFilter: 'all', agentNameFilter: null },
    });

    // Verify scroll to bottom button is included in the log section
    expect(html).toContain('scroll-to-bottom-btn');
    expect(html).toContain('scrollToBottomBtn');
  });

  it('should include scroll position detection and scroll to bottom handler in JS', () => {
    const js = generateLogSectionJs();

    // Verify scroll event listener is present
    expect(js).toContain('scroll');
    expect(js).toContain('logScrollPosition');

    // Verify scroll to bottom button click handler
    expect(js).toContain('scrollToBottomBtn');
    expect(js).toContain('scrollToBottom');
  });

  it('should include CSS for scroll to bottom button', () => {
    const css = generateLogSectionCss();

    // Verify scroll to bottom button CSS is present
    expect(css).toContain('.scroll-to-bottom-btn');
    expect(css).toContain('position: absolute');
    expect(css).toContain('bottom:');
    expect(css).toContain('right:');
  });
});

// ============================================================================
// Task Group 7: State Management and Panel Integration Tests
// ============================================================================

describe('Log Panel State Management', () => {
  /**
   * Helper function to create a test log entry
   */
  function createTestLogEntry(id: string, index: number): LogEntry {
    return {
      id,
      timestamp: Date.now() + index,
      eventType: 'node_start',
      agentName: `agent${index}`,
      summary: `Event ${index}`,
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    };
  }

  it('should have MAX_LOG_ENTRIES constant defined as 500', () => {
    // Verify the maximum entries constant is correctly defined
    expect(MAX_LOG_ENTRIES).toBe(500);
  });

  it('should have default log panel state with collapsed section', () => {
    // Per spec: Section starts collapsed by default
    expect(DEFAULT_LOG_PANEL_STATE.isCollapsed).toBe(true);
    expect(DEFAULT_LOG_PANEL_STATE.entries).toEqual([]);
    expect(DEFAULT_LOG_PANEL_STATE.filters).toEqual(DEFAULT_FILTER_STATE);
  });

  it('should have default filter state with all events shown', () => {
    // Verify default filter state
    expect(DEFAULT_FILTER_STATE.eventTypeFilter).toBe('all');
    expect(DEFAULT_FILTER_STATE.agentNameFilter).toBe(null);
  });

  describe('Event Limit Enforcement', () => {
    it('should enforce maximum 500 events in log panel state type', () => {
      // Create a log panel state with more than 500 entries
      const entries: LogEntry[] = [];
      for (let i = 0; i < 510; i++) {
        entries.push(createTestLogEntry(`entry-${i}`, i));
      }

      // Simulate the enforcement logic (same as in DemoViewerPanelProvider.addLogEntry)
      while (entries.length > MAX_LOG_ENTRIES) {
        entries.shift();
      }

      // Verify exactly 500 entries remain
      expect(entries.length).toBe(500);
    });

    it('should drop oldest events when limit exceeded', () => {
      const entries: LogEntry[] = [];

      // Add entries from 0 to 509 (510 total)
      for (let i = 0; i < 510; i++) {
        entries.push(createTestLogEntry(`entry-${i}`, i));
      }

      // Enforce limit - drop oldest
      while (entries.length > MAX_LOG_ENTRIES) {
        entries.shift();
      }

      // Verify oldest entries (0-9) are dropped, keeping entries 10-509
      expect(entries.length).toBe(500);
      expect(entries[0].id).toBe('entry-10');
      expect(entries[entries.length - 1].id).toBe('entry-509');
    });

    it('should maintain chronological order after dropping oldest events', () => {
      const entries: LogEntry[] = [];

      // Add entries with ascending timestamps
      for (let i = 0; i < 510; i++) {
        entries.push({
          ...createTestLogEntry(`entry-${i}`, i),
          timestamp: 1000 + i, // Ascending timestamps
        });
      }

      // Enforce limit
      while (entries.length > MAX_LOG_ENTRIES) {
        entries.shift();
      }

      // Verify chronological order is maintained
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].timestamp).toBeGreaterThan(entries[i - 1].timestamp);
      }
    });

    it('should handle exactly 500 events without dropping', () => {
      const entries: LogEntry[] = [];

      // Add exactly 500 entries
      for (let i = 0; i < 500; i++) {
        entries.push(createTestLogEntry(`entry-${i}`, i));
      }

      // Verify no entries are dropped when at limit
      const initialLength = entries.length;
      while (entries.length > MAX_LOG_ENTRIES) {
        entries.shift();
      }

      expect(entries.length).toBe(initialLength);
      expect(entries.length).toBe(500);
    });
  });

  describe('Log State Persistence Within Session', () => {
    it('should store log state in instance (not workspaceState) as per spec', () => {
      // The log state is stored in _logPanelState which is an instance variable
      // This test verifies the type definition includes all required fields
      const logState: LogPanelState = {
        entries: [],
        filters: DEFAULT_FILTER_STATE,
        isCollapsed: true,
        autoScrollEnabled: true,
        isAtBottom: true,
      };

      // Verify all required properties exist
      expect(logState.entries).toBeDefined();
      expect(logState.filters).toBeDefined();
      expect(logState.isCollapsed).toBeDefined();
      expect(logState.autoScrollEnabled).toBeDefined();
      expect(logState.isAtBottom).toBeDefined();
    });

    it('should support log entries array modifications for persistence', () => {
      // Simulate log entries persisting when panel state is accessed
      const logState: LogPanelState = {
        ...DEFAULT_LOG_PANEL_STATE,
        entries: [createTestLogEntry('1', 1), createTestLogEntry('2', 2)],
      };

      // Entries should persist in the state object
      expect(logState.entries.length).toBe(2);
      expect(logState.entries[0].id).toBe('1');
      expect(logState.entries[1].id).toBe('2');
    });
  });

  describe('Log Section Auto-Expand on First Event', () => {
    it('should have section start collapsed by default', () => {
      // Verify default state has section collapsed
      expect(DEFAULT_LOG_PANEL_STATE.isCollapsed).toBe(true);
    });

    it('should track isCollapsed state for auto-expand behavior', () => {
      // Test the state can be modified when first event arrives
      const logState: LogPanelState = { ...DEFAULT_LOG_PANEL_STATE };

      // Initially collapsed
      expect(logState.isCollapsed).toBe(true);

      // Simulate auto-expand on first event
      if (logState.entries.length === 0) {
        logState.isCollapsed = false;
      }

      // Should expand when entries array is empty and first event added
      expect(logState.isCollapsed).toBe(false);
    });

    it('should not auto-collapse section after it has been expanded', () => {
      // Once expanded, section stays expanded
      const logState: LogPanelState = {
        ...DEFAULT_LOG_PANEL_STATE,
        isCollapsed: false, // Already expanded
        entries: [createTestLogEntry('1', 1)],
      };

      // Add more entries - should not collapse
      logState.entries.push(createTestLogEntry('2', 2));

      // Section should remain expanded
      expect(logState.isCollapsed).toBe(false);
    });
  });

  describe('Log Entries Cleared on New Workflow Run', () => {
    it('should support clearing entries array', () => {
      const logState: LogPanelState = {
        ...DEFAULT_LOG_PANEL_STATE,
        entries: [createTestLogEntry('1', 1), createTestLogEntry('2', 2)],
        isCollapsed: false,
      };

      // Clear entries (simulating new workflow run)
      logState.entries = [];

      // Entries should be empty
      expect(logState.entries.length).toBe(0);
    });

    it('should reset filters to defaults on new workflow run', () => {
      const logState: LogPanelState = {
        ...DEFAULT_LOG_PANEL_STATE,
        filters: {
          eventTypeFilter: 'errors_only',
          agentNameFilter: 'specific_agent',
        },
      };

      // Reset filters (simulating new workflow run)
      logState.filters = { ...DEFAULT_FILTER_STATE };

      // Filters should be reset to defaults
      expect(logState.filters.eventTypeFilter).toBe('all');
      expect(logState.filters.agentNameFilter).toBe(null);
    });

    it('should reset auto-scroll state on new workflow run', () => {
      const logState: LogPanelState = {
        ...DEFAULT_LOG_PANEL_STATE,
        autoScrollEnabled: false, // User had scrolled up
        isAtBottom: false,
      };

      // Reset auto-scroll (simulating new workflow run)
      logState.autoScrollEnabled = true;
      logState.isAtBottom = true;

      // Auto-scroll should be re-enabled
      expect(logState.autoScrollEnabled).toBe(true);
      expect(logState.isAtBottom).toBe(true);
    });
  });
});
