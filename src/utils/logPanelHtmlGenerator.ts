/**
 * Log Panel HTML Generator
 * Generates HTML for the Execution Log section of the Demo Viewer webview
 */

import type { LogEntry, LogFilterState, EventTypeFilterCategory } from '../types/logPanel';
import { formatLogTimestamp } from './logTimestampFormatter';
import { shouldTruncatePayload, truncatePayload } from './logFilterUtils';
import {
  PAYLOAD_TRUNCATION_THRESHOLD,
  PAYLOAD_TRUNCATION_PREVIEW_LINES,
  SCROLL_BOTTOM_THRESHOLD,
} from '../types/logPanel';

/**
 * Options for generating the log section HTML
 */
export interface LogSectionHtmlOptions {
  entries: LogEntry[];
  isCollapsed: boolean;
  uniqueAgentNames: string[];
  filters: LogFilterState;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Get the icon SVG for an event type
 * Icons are inline SVG for performance (avoids external dependencies)
 */
function getEventIcon(eventType: LogEntry['eventType'], status: LogEntry['status']): string {
  switch (eventType) {
    case 'node_start':
      // Play icon (neutral color)
      return '<svg class="log-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2v12l10-6L4 2z"/></svg>';
    case 'node_stop':
      if (status === 'error') {
        // X icon for error
        return '<svg class="log-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>';
      }
      // Check icon for success
      return '<svg class="log-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>';
    case 'tool_call':
      // Wrench icon (neutral color)
      return '<svg class="log-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M11.92 5.28a.75.75 0 01.04 1.06l-.04.04-1.5 1.5 2.28 2.28a.75.75 0 01-1.06 1.06l-2.28-2.28-4.5 4.5a.75.75 0 01-1.06-1.06l4.5-4.5-1.5-1.5a.75.75 0 01.04-1.1l.02-.01.04-.03 2.5-2.5a3.25 3.25 0 014.52 4.52l-.02.02z"/></svg>';
    case 'tool_result':
      // Output/arrow icon (success/error color based on status)
      return '<svg class="log-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8.22 2.97a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06l2.97-2.97H3.75a.75.75 0 010-1.5h7.44L8.22 4.03a.75.75 0 010-1.06z"/></svg>';
    case 'workflow_complete':
      // Flag icon (success color)
      return '<svg class="log-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2.5a.5.5 0 01.5-.5h9a.5.5 0 01.4.8L10.5 6l2.4 3.2a.5.5 0 01-.4.8H4v4a.5.5 0 01-1 0v-11z"/></svg>';
    case 'workflow_error':
      // Alert/warning icon (error color)
      return '<svg class="log-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM7 4.75a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0v-3.5zm.75 6.5a1 1 0 100-2 1 1 0 000 2z"/></svg>';
    default:
      return '';
  }
}

/**
 * Get CSS class for entry status
 */
function getStatusClass(status: LogEntry['status']): string {
  switch (status) {
    case 'success':
      return 'status-success';
    case 'error':
      return 'status-error';
    default:
      return 'status-neutral';
  }
}

/**
 * JSON token types for syntax highlighting
 */
type JsonTokenType = 'string' | 'number' | 'boolean' | 'null' | 'key' | 'punctuation';

/**
 * Tokenize JSON string for syntax highlighting
 * Returns HTML with span elements for each token type
 */
export function tokenizeJson(jsonString: string): string {
  // Pattern to match JSON tokens
  // Order matters: keys must be matched before general strings
  const patterns: Array<{ type: JsonTokenType; regex: RegExp }> = [
    // Match property keys (string followed by colon)
    { type: 'key', regex: /"([^"\\]|\\.)*"\s*(?=:)/g },
    // Match string values
    { type: 'string', regex: /"([^"\\]|\\.)*"/g },
    // Match numbers (including negatives and decimals)
    { type: 'number', regex: /-?\d+\.?\d*(?:[eE][+-]?\d+)?/g },
    // Match boolean values
    { type: 'boolean', regex: /\b(true|false)\b/g },
    // Match null
    { type: 'null', regex: /\bnull\b/g },
  ];

  // Create a map of positions to tokens
  const tokens: Array<{ start: number; end: number; type: JsonTokenType; text: string }> = [];

  for (const { type, regex } of patterns) {
    let match: RegExpExecArray | null;
    const regexClone = new RegExp(regex.source, regex.flags);
    while ((match = regexClone.exec(jsonString)) !== null) {
      // Check if this position is already covered by another token
      const isOverlapping = tokens.some(
        (t) => match!.index < t.end && match!.index + match![0].length > t.start
      );
      if (!isOverlapping) {
        tokens.push({
          start: match.index,
          end: match.index + match[0].length,
          type,
          text: match[0],
        });
      }
    }
  }

  // Sort tokens by position
  tokens.sort((a, b) => a.start - b.start);

  // Build highlighted HTML
  let result = '';
  let lastIndex = 0;

  for (const token of tokens) {
    // Add any non-token text before this token
    if (token.start > lastIndex) {
      result += escapeHtml(jsonString.slice(lastIndex, token.start));
    }
    // Add the highlighted token
    result += `<span class="json-${token.type}">${escapeHtml(token.text)}</span>`;
    lastIndex = token.end;
  }

  // Add any remaining text after the last token
  if (lastIndex < jsonString.length) {
    result += escapeHtml(jsonString.slice(lastIndex));
  }

  return result;
}

/**
 * Generate HTML for the payload content with syntax highlighting
 */
export function generatePayloadHtml(
  payload: Record<string, unknown>,
  isTruncationExpanded: boolean,
  entryId: string
): string {
  const needsTruncation = shouldTruncatePayload(payload, PAYLOAD_TRUNCATION_THRESHOLD);

  if (!needsTruncation || isTruncationExpanded) {
    // Show full payload
    const jsonString = JSON.stringify(payload, null, 2);
    const highlighted = tokenizeJson(jsonString);
    return `<pre class="payload-content">${highlighted}</pre>`;
  }

  // Show truncated payload with "Show more" link
  const { truncated, remainingLines, totalLines } = truncatePayload(
    payload,
    PAYLOAD_TRUNCATION_PREVIEW_LINES
  );
  const highlighted = tokenizeJson(truncated);

  return `
    <pre class="payload-content payload-truncated">${highlighted}</pre>
    <button class="payload-show-more" data-entry-id="${escapeHtml(entryId)}">
      Show more... (${remainingLines} more lines)
    </button>
  `.trim();
}

/**
 * Generate HTML for a single log entry row
 */
export function generateLogEntryHtml(entry: LogEntry): string {
  const timestampFormatted = formatLogTimestamp(entry.timestamp);
  const icon = getEventIcon(entry.eventType, entry.status);
  const statusClass = getStatusClass(entry.status);
  const hasPayload = entry.payload !== undefined && Object.keys(entry.payload).length > 0;
  const expandButtonHtml = hasPayload
    ? `<button class="log-entry-expand-btn" data-entry-id="${escapeHtml(entry.id)}">${entry.isExpanded ? '[-]' : '[+]'}</button>`
    : '';

  // Generate payload expansion container if expanded
  let payloadHtml = '';
  if (hasPayload && entry.isExpanded && entry.payload) {
    payloadHtml = `
      <div class="log-entry-payload" data-entry-id="${escapeHtml(entry.id)}">
        ${generatePayloadHtml(entry.payload, entry.isTruncationExpanded, entry.id)}
      </div>
    `.trim();
  }

  return `
    <div class="log-entry-wrapper" data-entry-id="${escapeHtml(entry.id)}">
      <div class="log-entry ${statusClass}" data-entry-id="${escapeHtml(entry.id)}">
        <span class="log-entry-timestamp">${timestampFormatted}</span>
        <span class="log-entry-icon ${statusClass}">${icon}</span>
        <span class="log-entry-agent">${escapeHtml(entry.agentName)}</span>
        <span class="log-entry-summary">${escapeHtml(entry.summary)}</span>
        ${expandButtonHtml}
      </div>
      ${payloadHtml}
    </div>
  `.trim();
}

/**
 * Generate the filter dropdowns HTML
 */
function generateFiltersHtml(
  filters: LogFilterState,
  uniqueAgentNames: string[]
): string {
  const eventTypeOptions = [
    { value: 'all', label: 'All Events' },
    { value: 'agent_events', label: 'Agent Events' },
    { value: 'tool_calls', label: 'Tool Calls' },
    { value: 'errors_only', label: 'Errors Only' },
  ];

  const eventTypeOptionsHtml = eventTypeOptions
    .map(opt => `<option value="${opt.value}" ${filters.eventTypeFilter === opt.value ? 'selected' : ''}>${opt.label}</option>`)
    .join('');

  const agentNameOptionsHtml = [
    `<option value="all" ${!filters.agentNameFilter || filters.agentNameFilter === 'all' ? 'selected' : ''}>All Agents</option>`,
    ...uniqueAgentNames.map(name =>
      `<option value="${escapeHtml(name)}" ${filters.agentNameFilter === name ? 'selected' : ''}>${escapeHtml(name)}</option>`
    ),
  ].join('');

  return `
    <div class="log-filters">
      <select id="eventTypeFilter" class="log-filter-select">
        ${eventTypeOptionsHtml}
      </select>
      <select id="agentNameFilter" class="log-filter-select">
        ${agentNameOptionsHtml}
      </select>
    </div>
  `.trim();
}

/**
 * Generate HTML for the log entries list
 */
function generateEntriesHtml(entries: LogEntry[]): string {
  if (entries.length === 0) {
    return '<div class="log-entries-empty">No events to display</div>';
  }

  return entries.map(entry => generateLogEntryHtml(entry)).join('\n');
}

/**
 * Generate HTML for the scroll to bottom button
 * Positioned at bottom-right corner of log section
 */
export function generateScrollToBottomButton(): string {
  return `
    <button class="scroll-to-bottom-btn" id="scrollToBottomBtn" title="Scroll to bottom">
      <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
        <path d="M8 11.5l-4-4 .7-.7 3.3 3.3 3.3-3.3.7.7z"/>
      </svg>
      Scroll to bottom
    </button>
  `.trim();
}

/**
 * Generate HTML for the complete log section
 */
export function generateLogSectionHtml(options: LogSectionHtmlOptions): string {
  const { entries, isCollapsed, uniqueAgentNames, filters } = options;
  const collapsedClass = isCollapsed ? 'collapsed' : '';
  const collapseIndicator = isCollapsed ? '&#9658;' : '&#9660;'; // Right arrow or down arrow

  const filtersHtml = generateFiltersHtml(filters, uniqueAgentNames);
  const entriesHtml = generateEntriesHtml(entries);
  const scrollToBottomBtn = generateScrollToBottomButton();

  return `
    <div class="log-section ${collapsedClass}" id="executionLogSection">
      <div class="log-section-header" id="logSectionHeader">
        <span class="collapse-indicator">${collapseIndicator}</span>
        <span class="log-section-title">Execution Log</span>
        ${filtersHtml}
      </div>
      <div class="log-entries-wrapper">
        <div class="log-entries-container" id="logEntriesContainer">
          ${entriesHtml}
        </div>
        ${scrollToBottomBtn}
      </div>
    </div>
  `.trim();
}

/**
 * Generate CSS styles for the log section
 * Includes semantic color custom properties for theming consistency
 */
export function generateLogSectionCss(): string {
  return `
    /* Semantic Color Custom Properties
     * These map to VS Code theme variables for consistent theming
     */
    :root {
      --log-color-neutral: var(--vscode-foreground);
      --log-color-success: var(--vscode-testing-iconPassed, #4ec9b0);
      --log-color-error: var(--vscode-testing-iconFailed, #f48771);
    }

    /* Log Section Container */
    .log-section {
      border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #444));
      border-radius: 4px;
      margin-top: 16px;
      overflow: hidden;
    }

    .log-section.collapsed .log-entries-wrapper {
      display: none;
    }

    /* Log Section Header */
    .log-section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background-color: var(--vscode-editor-background);
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #444));
      cursor: pointer;
      user-select: none;
    }

    .log-section-header:hover {
      background-color: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05));
    }

    .collapse-indicator {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      min-width: 12px;
    }

    .log-section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
    }

    /* Log Filters */
    .log-filters {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }

    .log-filter-select {
      font-size: 11px;
      padding: 2px 6px;
      background-color: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border, var(--vscode-panel-border, #444));
      border-radius: 3px;
      cursor: pointer;
    }

    .log-filter-select:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }

    /* Log Entries Wrapper (contains container + scroll button) */
    .log-entries-wrapper {
      position: relative;
    }

    /* Log Entries Container */
    .log-entries-container {
      max-height: 300px;
      overflow-y: auto;
      background-color: var(--vscode-editor-background);
    }

    .log-entries-empty {
      padding: 24px 12px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }

    /* Log Entry Wrapper (contains row + payload) */
    .log-entry-wrapper {
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #333));
    }

    .log-entry-wrapper:last-child {
      border-bottom: none;
    }

    /* Log Entry Row */
    .log-entry {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      font-size: 12px;
    }

    .log-entry:hover {
      background-color: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05));
    }

    /* Log Entry Components */
    .log-entry-timestamp {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
      min-width: 90px;
    }

    .log-entry-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .log-entry-icon .log-icon {
      width: 14px;
      height: 14px;
    }

    /* Status-based icon coloring using semantic custom properties */
    .log-entry-icon.status-neutral {
      color: var(--log-color-neutral);
    }

    .log-entry-icon.status-success {
      color: var(--log-color-success);
    }

    .log-entry-icon.status-error {
      color: var(--log-color-error);
    }

    .log-entry-agent {
      font-weight: 500;
      color: var(--vscode-editor-foreground);
      white-space: nowrap;
      min-width: 100px;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .log-entry-summary {
      flex: 1;
      color: var(--vscode-editor-foreground);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .log-entry-expand-btn {
      background: none;
      border: none;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      padding: 2px 4px;
      font-size: 11px;
      font-family: var(--vscode-editor-font-family, monospace);
    }

    .log-entry-expand-btn:hover {
      text-decoration: underline;
    }

    /* Status-based text coloring for error entries */
    .log-entry.status-error .log-entry-summary {
      color: var(--log-color-error);
    }

    /* Status classes for general use */
    .status-neutral {
      /* Uses default foreground color */
    }

    .status-success {
      /* Uses success color for icons */
    }

    .status-error {
      /* Uses error color for icons and text */
    }

    /* Payload Expansion Container */
    .log-entry-payload {
      padding: 8px 12px 8px 36px;
      background-color: var(--vscode-editorWidget-background, rgba(0, 0, 0, 0.2));
      border-top: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #333));
    }

    .payload-content {
      margin: 0;
      padding: 8px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
      line-height: 1.4;
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #333));
      border-radius: 3px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .payload-truncated {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom: none;
    }

    .payload-show-more {
      display: block;
      width: 100%;
      padding: 6px 8px;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-textLink-foreground);
      border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #333));
      border-top: none;
      border-radius: 0 0 3px 3px;
      cursor: pointer;
      font-size: 11px;
      font-family: var(--vscode-font-family);
      text-align: left;
    }

    .payload-show-more:hover {
      background-color: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05));
      text-decoration: underline;
    }

    /* JSON Syntax Highlighting
     * Uses VS Code CSS variables for consistent theming
     */
    .json-string {
      color: var(--vscode-symbolIcon-stringForeground, #ce9178);
    }

    .json-number {
      color: var(--vscode-symbolIcon-numberForeground, #b5cea8);
    }

    .json-boolean {
      color: var(--vscode-symbolIcon-booleanForeground, #569cd6);
    }

    .json-null {
      color: var(--vscode-symbolIcon-keywordForeground, #569cd6);
    }

    .json-key {
      color: var(--vscode-symbolIcon-propertyForeground, #9cdcfe);
    }

    /* Placeholder Sections */
    .placeholder-section {
      border: 1px dashed var(--vscode-panel-border, var(--vscode-widget-border, #444));
      border-radius: 4px;
      margin-top: 16px;
      padding: 24px 12px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      text-transform: uppercase;
    }

    /* Scroll to bottom button
     * Floating button positioned at bottom-right corner of log section
     * Appears when user scrolls up during workflow run
     */
    .scroll-to-bottom-btn {
      position: absolute;
      bottom: 8px;
      right: 8px;
      display: none;
      align-items: center;
      gap: 4px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 11px;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      z-index: 10;
    }

    .scroll-to-bottom-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .scroll-to-bottom-btn:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }

    .scroll-to-bottom-btn.visible {
      display: flex;
    }

    .scroll-to-bottom-btn svg {
      flex-shrink: 0;
    }
  `;
}

/**
 * Generate JavaScript handlers for log section interactions
 * Includes scroll position detection and auto-scroll behavior
 */
export function generateLogSectionJs(): string {
  return `
    // Log section collapse/expand toggle
    const logSectionHeader = document.getElementById('logSectionHeader');
    const logSection = document.getElementById('executionLogSection');

    if (logSectionHeader && logSection) {
      logSectionHeader.addEventListener('click', function(e) {
        // Don't toggle if clicking on filters
        if (e.target.closest('.log-filters')) return;

        const isCollapsed = logSection.classList.toggle('collapsed');
        const indicator = logSectionHeader.querySelector('.collapse-indicator');
        if (indicator) {
          indicator.innerHTML = isCollapsed ? '&#9658;' : '&#9660;';
        }

        vscode.postMessage({
          command: 'logSectionToggle',
          isCollapsed: isCollapsed
        });
      });
    }

    // Event type filter change
    const eventTypeFilter = document.getElementById('eventTypeFilter');
    if (eventTypeFilter) {
      eventTypeFilter.addEventListener('change', function(e) {
        e.stopPropagation();
        vscode.postMessage({
          command: 'logFilterChange',
          filterType: 'eventType',
          value: e.target.value
        });
      });
    }

    // Agent name filter change
    const agentNameFilter = document.getElementById('agentNameFilter');
    if (agentNameFilter) {
      agentNameFilter.addEventListener('change', function(e) {
        e.stopPropagation();
        vscode.postMessage({
          command: 'logFilterChange',
          filterType: 'agentName',
          value: e.target.value
        });
      });
    }

    // Entry expand/collapse handlers
    document.addEventListener('click', function(e) {
      const expandBtn = e.target.closest('.log-entry-expand-btn');
      if (expandBtn) {
        const entryId = expandBtn.dataset.entryId;
        vscode.postMessage({
          command: 'logEntryToggle',
          entryId: entryId
        });
      }

      // Handle "Show more" button click
      const showMoreBtn = e.target.closest('.payload-show-more');
      if (showMoreBtn) {
        const entryId = showMoreBtn.dataset.entryId;
        vscode.postMessage({
          command: 'logPayloadShowMore',
          entryId: entryId
        });
      }
    });

    // Scroll position detection for auto-scroll behavior
    const logEntriesContainer = document.getElementById('logEntriesContainer');
    const scrollToBottomBtn = document.getElementById('scrollToBottomBtn');
    const SCROLL_THRESHOLD = ${SCROLL_BOTTOM_THRESHOLD};

    // Track whether user has manually scrolled up
    let userScrolledUp = false;

    function isAtBottom() {
      if (!logEntriesContainer) return true;
      return logEntriesContainer.scrollHeight - logEntriesContainer.scrollTop - logEntriesContainer.clientHeight < SCROLL_THRESHOLD;
    }

    function updateScrollButtonVisibility() {
      if (!scrollToBottomBtn) return;
      // Show button when not at bottom
      if (!isAtBottom()) {
        scrollToBottomBtn.classList.add('visible');
      } else {
        scrollToBottomBtn.classList.remove('visible');
      }
    }

    function scrollToBottom() {
      if (!logEntriesContainer) return;
      logEntriesContainer.scrollTop = logEntriesContainer.scrollHeight;
      userScrolledUp = false;
      updateScrollButtonVisibility();

      // Notify extension that user scrolled to bottom
      vscode.postMessage({
        command: 'logScrollToBottom'
      });
    }

    if (logEntriesContainer) {
      logEntriesContainer.addEventListener('scroll', function() {
        const atBottom = isAtBottom();

        // Detect manual scroll up
        if (!atBottom) {
          userScrolledUp = true;
        }

        updateScrollButtonVisibility();

        // Notify extension of scroll position change
        vscode.postMessage({
          command: 'logScrollPosition',
          isAtBottom: atBottom,
          userScrolledUp: userScrolledUp
        });
      });
    }

    // Scroll to bottom button click handler
    if (scrollToBottomBtn) {
      scrollToBottomBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        scrollToBottom();
      });
    }

    // Function to auto-scroll when new entries are added (called from updateLogSection)
    function autoScrollIfNeeded(shouldAutoScroll, isWorkflowRunning) {
      if (!logEntriesContainer) return;

      // Auto-scroll when:
      // 1. Workflow is running AND
      // 2. User hasn't manually scrolled up (or auto-scroll should be enabled)
      if (isWorkflowRunning && shouldAutoScroll && !userScrolledUp) {
        scrollToBottom();
      }

      updateScrollButtonVisibility();
    }

    // Reset auto-scroll state (called when new workflow run starts)
    function resetAutoScrollState() {
      userScrolledUp = false;
      if (scrollToBottomBtn) {
        scrollToBottomBtn.classList.remove('visible');
      }
    }

    // Expose functions globally for use in updateLogSection
    window.logAutoScroll = {
      autoScrollIfNeeded: autoScrollIfNeeded,
      resetAutoScrollState: resetAutoScrollState,
      scrollToBottom: scrollToBottom,
      updateScrollButtonVisibility: updateScrollButtonVisibility,
      isAtBottom: isAtBottom
    };
  `;
}
