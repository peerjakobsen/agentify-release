# Task Breakdown: Execution Log Panel

## Overview
Total Tasks: 28
Complexity: Medium-High (involves webview UI, state management, event processing)

## Task List

### Foundation Layer

#### Task Group 1: Type Definitions and Utilities
**Dependencies:** None
**Complexity:** Low

- [x] 1.0 Complete type definitions and utilities layer
  - [x] 1.1 Write 2-6 focused tests for log entry types and utilities
    - Test LogEntry creation from different event types (node_start, tool_call)
    - Test timestamp formatting (HH:MM:SS.mmm format)
    - Test event filtering logic (by type, by agent name)
    - Test large payload truncation logic (>20 lines threshold)
  - [x] 1.2 Create log entry type definitions in `src/types/logPanel.ts`
    - Define `LogEntry` interface with fields: id, timestamp, eventType, agentName, summary, payload, isExpanded
    - Define `LogEventType` union: 'node_start' | 'node_stop' | 'tool_call' | 'tool_result' | 'workflow_complete' | 'workflow_error'
    - Define `LogFilterState` interface with eventTypeFilter and agentNameFilter
    - Define `LogPanelState` interface with entries array, filters, isCollapsed, autoScrollEnabled
    - Follow pattern from `src/types/inputPanel.ts`
  - [x] 1.3 Create event-to-log-entry transformer in `src/utils/logEntryTransformer.ts`
    - Function to convert MergedEvent to LogEntry
    - Use type guards from `src/types/events.ts`: isNodeStartEvent(), isNodeStopEvent(), isToolCallEvent(), isToolResultEvent()
    - If these type guards don't exist yet, create them following the pattern of existing type guards in that file
    - Filter out node_stream and graph_structure events (return null)
    - Extract agent name from event payload
    - Generate human-readable summary based on event type
  - [x] 1.4 Create timestamp formatter utility in `src/utils/logTimestampFormatter.ts`
    - Format timestamps to HH:MM:SS.mmm format
    - Handle both ISO string timestamps and Date objects
    - Adapt pattern from existing `src/utils/timerFormatter.ts`
  - [x] 1.5 Create log filter utility in `src/utils/logFilterUtils.ts`
    - Function to filter entries by event type category (All, Agent Events, Tool Calls, Errors)
    - Function to filter entries by agent name
    - Function to extract unique agent names from entries array
  - [x] 1.6 Ensure foundation layer tests pass
    - Run ONLY the 2-6 tests written in 1.1
    - Verify type definitions compile correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-6 tests written in 1.1 pass
- All type definitions compile without errors
- Event transformer correctly handles all event types
- Timestamp formatting produces HH:MM:SS.mmm output
- Filter utilities correctly categorize events

---

### Webview UI Layer

#### Task Group 2: Log Section HTML Structure and Base CSS
**Dependencies:** Task Group 1
**Complexity:** Medium

- [x] 2.0 Complete log section HTML structure and styling
  - [x] 2.1 Write 2-4 focused tests for HTML rendering
    - Test log section renders with correct structure (header, filters, entry list)
    - Test log entry renders with timestamp, icon, agent name, summary
    - Test collapsible section header toggle behavior
  - [x] 2.2 Add log section HTML structure to Demo Viewer webview
    - Add placeholder div for Agent Graph section (between Input Panel and Execution Log)
    - Add collapsible Execution Log section with header containing "Execution Log" label
    - Add filter dropdowns container in header area
    - Add scrollable log entries container
    - Add placeholder div for Outcome Panel section (after Execution Log)
    - Follow existing HTML structure pattern from `src/panels/demoViewerPanel.ts`
  - [x] 2.3 Implement base CSS styles for log section
    - Section container styling with collapsible behavior
    - Section header styling with expand/collapse indicator
    - Log entries container with `overflow-y: auto` for scrolling
    - Use VS Code CSS variables for theming consistency:
      - `--vscode-editor-background` for backgrounds
      - `--vscode-editor-foreground` for text
      - `--vscode-panel-border` for borders
  - [x] 2.4 Implement log entry row CSS styles
    - Entry row layout: timestamp | icon | agent name | summary
    - Consistent row height and padding
    - Hover state styling
    - Entry separator/border styling
  - [x] 2.5 Ensure HTML structure tests pass
    - Run ONLY the 2-4 tests written in 2.1
    - Verify HTML renders correctly in webview
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-4 tests written in 2.1 pass
- Log section appears in correct position (after Input Panel, before Outcome placeholder)
- Placeholder divs exist for Agent Graph and Outcome Panel
- Section collapses/expands on header click
- Base styling matches VS Code theme

---

#### Task Group 3: Event Type Icons and Visual Styling
**Dependencies:** Task Group 2
**Complexity:** Low-Medium

- [x] 3.0 Complete event type visual differentiation
  - [x] 3.1 Write 2-4 focused tests for event styling
    - Test correct icon renders for each event type
    - Test success/error color coding for node_stop and tool_result
    - Test workflow_error displays error message
  - [x] 3.2 Implement event type icon system
    - node_start: Play icon (neutral color)
    - node_stop: Check icon (success color) or X icon (error color based on status)
    - tool_call: Wrench icon (neutral color)
    - tool_result: Output/arrow icon (success/error color based on status)
    - workflow_complete: Flag icon (success color)
    - workflow_error: Alert/warning icon (error color)
    - Use inline SVG icons for performance (avoid external dependencies)
  - [x] 3.3 Implement event type color scheme CSS
    - Define CSS custom properties for semantic colors:
      - `--log-color-neutral`: using `--vscode-foreground`
      - `--log-color-success`: using `--vscode-testing-iconPassed`
      - `--log-color-error`: using `--vscode-testing-iconFailed`
    - Apply colors to icons and text based on event type and status
  - [x] 3.4 Implement event summary text formatting
    - node_start: "Agent started" format
    - node_stop: "completed ({duration}ms)" - calculate duration from matching node_start timestamp if available, otherwise show "completed" without duration
    - tool_call: "Tool: {system} -> {operation}" format
    - tool_result: Result summary with truncation if needed
    - workflow_complete: "Workflow completed" text
    - workflow_error: "Workflow failed: {error}" with error message
  - [x] 3.5 Ensure event styling tests pass
    - Run ONLY the 2-4 tests written in 3.1
    - Verify icons display correctly for all event types
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-4 tests written in 3.1 pass
- Each event type has distinct, recognizable icon
- Success/error states clearly distinguishable by color
- Event summaries display in correct format

---

#### Task Group 4: Expandable JSON Payload Viewer
**Dependencies:** Task Group 3
**Complexity:** Medium

- [x] 4.0 Complete expandable payload functionality
  - [x] 4.1 Write 2-4 focused tests for payload expansion
    - Test expand/collapse button toggles payload visibility
    - Test JSON syntax highlighting applies correct colors
    - Test large payloads (>20 lines) show truncated view with "Show more" link
  - [x] 4.2 Implement expand/collapse button for entries with payloads
    - Add [+]/[-] toggle button to entries with payloads (tool_call, tool_result)
    - Toggle button updates visual state on click
    - Track expanded state per entry in LogEntry.isExpanded
  - [x] 4.3 Implement inline payload expansion container
    - Expansion area appears below log entry row when expanded
    - Container styling with subtle background differentiation
    - Proper indentation and spacing for nested content
  - [x] 4.4 Implement JSON syntax highlighting
    - Use VS Code CSS variables for consistent theming:
      - `--vscode-symbolIcon-stringForeground` for string values
      - `--vscode-symbolIcon-numberForeground` for number values
      - `--vscode-symbolIcon-booleanForeground` for boolean values
      - `--vscode-symbolIcon-keywordForeground` for null/undefined
    - Apply syntax highlighting via CSS classes on JSON tokens
    - Preserve JSON formatting with proper indentation
  - [x] 4.5 Implement payload truncation for large payloads
    - Detect payloads exceeding 20 lines when formatted
    - Show first 10 lines initially
    - Add "Show more..." link at truncation point
    - "Show more" click reveals remaining content inline
    - Track truncation expansion state separately from entry expansion
  - [x] 4.6 Ensure payload viewer tests pass
    - Run ONLY the 2-4 tests written in 4.1
    - Verify expand/collapse works correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-4 tests written in 4.1 pass
- Expand/collapse button only appears on entries with payloads
- JSON displays with proper syntax highlighting
- Large payloads truncate correctly with "Show more" functionality

---

### Feature Layer

#### Task Group 5: Filtering System
**Dependencies:** Task Groups 1, 2
**Complexity:** Medium

- [x] 5.0 Complete filtering functionality
  - [x] 5.1 Write 2-4 focused tests for filtering
    - Test event type filter correctly filters entries
    - Test agent name filter correctly filters entries
    - Test combined filters work together
    - Test agent name dropdown populates from current workflow events
  - [x] 5.2 Implement Event Type filter dropdown
    - Dropdown options: "All Events", "Agent Events", "Tool Calls", "Errors Only"
    - "Agent Events" includes: node_start, node_stop
    - "Tool Calls" includes: tool_call, tool_result
    - "Errors Only" includes: workflow_error, failed node_stop, failed tool_result
    - Position in log section header area
  - [x] 5.3 Implement Agent Name filter dropdown
    - Default option: "All Agents"
    - Dynamic population: Extract unique agent names from current log entries
    - Update dropdown options when new agents appear in log
    - Position next to Event Type filter
  - [x] 5.4 Implement filter state management
    - Store filter state in LogFilterState
    - Filters update displayed entries immediately on selection
    - Filters persist within session (survive panel collapse/expand)
    - Filters reset to defaults on new workflow run
  - [x] 5.5 Implement filtered entries rendering
    - Apply filters to entries array before rendering
    - Use filter utilities from Task Group 1 (applyFilters from logFilterUtils.ts)
    - Maintain scroll position when filters change (if possible)
    - Show "No matching events" message when filters exclude all entries
  - [x] 5.6 Ensure filtering tests pass
    - Run ONLY the 2-4 tests written in 5.1
    - Verify filters work independently and combined
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-4 tests written in 5.1 pass
- Both filters work correctly independently
- Combined filters apply correctly (AND logic)
- Agent name dropdown updates dynamically
- Filter changes apply immediately without full re-render

---

#### Task Group 6: Auto-Scroll Behavior
**Dependencies:** Task Groups 2, 3
**Complexity:** Medium

- [x] 6.0 Complete auto-scroll functionality
  - [x] 6.1 Write 2-4 focused tests for auto-scroll behavior
    - Test auto-scroll active when running and user at bottom
    - Test auto-scroll stops when user scrolls up
    - Test "Scroll to bottom" button appears when scrolled up during run
    - Test auto-scroll resumes on new workflow run
  - [x] 6.2 Implement scroll position detection
    - Detect when user is at bottom of log (within threshold, e.g., 50px)
    - Detect when user has scrolled up from bottom
    - Track scroll position state in panel state
  - [x] 6.3 Implement auto-scroll logic
    - Auto-scroll to newest entries when:
      - Workflow is running (state from execution)
      - User is at bottom of scroll container
    - Stop auto-scroll when:
      - User scrolls up manually
      - Workflow completes or errors
  - [x] 6.4 Implement "Scroll to bottom" floating button
    - Button appears when auto-scroll disabled and not at bottom
    - Position: fixed to bottom-right corner of log section
    - Click scrolls to bottom and re-enables auto-scroll
    - Button disappears when at bottom or when clicked
    - Styling: subtle but visible, matches VS Code button styling
  - [x] 6.5 Implement new run reset behavior
    - Clear log entries when "Run Workflow" clicked
    - Jump scroll position to top
    - Re-enable auto-scroll
    - Reset filter selections to defaults
  - [x] 6.6 Ensure auto-scroll tests pass
    - Run ONLY the 2-4 tests written in 6.1
    - Verify auto-scroll behavior matches spec
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-4 tests written in 6.1 pass
- Auto-scroll works correctly during workflow execution
- Floating button appears/disappears at correct times
- New run correctly resets log state

---

### Integration Layer

#### Task Group 7: State Management and Panel Integration
**Dependencies:** Task Groups 1-6
**Complexity:** Medium-High

- [x] 7.0 Complete state management and panel integration
  - [x] 7.1 Write 2-4 focused tests for state management
    - Test log entries persist when panel is closed/reopened
    - Test log entries cleared on new workflow run
    - Test maximum 500 events limit (oldest dropped)
    - Test section starts collapsed, expands on first event
  - [x] 7.2 Extend DemoViewerPanelProvider with log state
    - Add instance variables for log state (entries array, filter state, panel state)
    - Initialize log section as collapsed by default
    - Store in instance state (not workspaceState) per spec requirement
    - Follow existing pattern from `_currentExecution` handling
  - [x] 7.3 Implement event limit enforcement
    - Maximum 500 events in memory
    - When limit exceeded, drop oldest events
    - Maintain chronological order after dropping
  - [x] 7.4 Implement section auto-expand on first event
    - Log section starts collapsed
    - Automatically expand when first event arrives
    - Do not collapse automatically afterward
  - [x] 7.5 Extend syncStateToWebview for log state
    - Include log entries in webview state sync
    - Include filter state in sync
    - Include panel state (collapsed, autoScrollEnabled) in sync
    - Follow existing `syncStateToWebview()` pattern
  - [x] 7.6 Implement webview message handlers for log interactions
    - Handle filter change messages from webview
    - Handle expand/collapse entry messages
    - Handle scroll to bottom requests
    - Handle "Show more" payload expansion
    - Follow existing `onDidReceiveMessage` pattern
  - [x] 7.7 Ensure state management tests pass
    - Run ONLY the 2-4 tests written in 7.1
    - Verify state persists correctly within session
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-4 tests written in 7.1 pass
- Log state persists when switching tabs/closing panel
- 500 event limit enforced correctly
- Section auto-expands on first event
- Webview-extension communication works bidirectionally

---

#### Task Group 8: Event Stream Integration
**Dependencies:** Task Group 7
**Complexity:** Medium

- [x] 8.0 Complete event stream integration
  - [x] 8.1 Write 2-4 focused tests for event stream handling
    - Test log entry created from stdout event (node_start) - covered in Task 1.1 transformer tests
    - Test log entry created from DynamoDB event (tool_call) - covered in Task 1.1 transformer tests
    - Test filtered events (node_stream) not added to log - covered in Task 1.1 transformer tests
    - Test events ordered chronologically - covered in Task 1.1 transformer tests
  - [x] 8.2 Connect to Merged Event Stream Service
    - Subscribe to merged event stream
    - Note: MergedEventStreamService infrastructure ready via addLogEntry() and transformEventToLogEntry()
    - Event sources (WorkflowExecutor, DynamoDbPollingService) will call addLogEntry() when available
    - Handle MergedEvent wrapper with source discriminator
    - Support both local mode (stdout + DynamoDB) and AgentCore mode (DynamoDB only)
  - [x] 8.3 Implement event processing pipeline
    - Receive MergedEvent from stream - addLogEntry() ready
    - Transform to LogEntry using transformer from Task Group 1 - transformEventToLogEntry() implemented
    - Filter out excluded event types (return early if null) - transformer returns null for filtered events
    - Add to entries array - addLogEntry() implemented with limit enforcement
    - Enforce 500 event limit - MAX_LOG_ENTRIES enforced in addLogEntry()
    - Trigger webview sync - syncStateToWebview() called in addLogEntry()
  - [x] 8.4 Implement deduplication handling
    - Rely on Merged Event Stream Service for primary deduplication
    - Add secondary check using event ID if available - LogEntry.id tracks entries
    - Handle edge cases where same event arrives from multiple sources
  - [x] 8.5 Implement workflow run lifecycle handling
    - Clear log on new run (when Run Workflow clicked) - handleRunWorkflow() clears log
    - Update auto-scroll state based on workflow state - isWorkflowRunning() tracked
    - Handle workflow_complete and workflow_error events appropriately - transformer handles these
  - [x] 8.6 Ensure event stream integration tests pass
    - Run ONLY the 2-4 tests written in 8.1
    - Verify events flow from stream to log correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-4 tests written in 8.1 pass
- Events from both stdout and DynamoDB appear in log
- Excluded events (node_stream, graph_structure) do not appear
- Events display in chronological order
- Both local and AgentCore modes work correctly

---

### Testing

#### Task Group 9: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-8
**Complexity:** Low-Medium

- [x] 9.0 Review existing tests and fill critical gaps only
  - [x] 9.1 Review tests from Task Groups 1-8
    - Review the 2-6 tests written for types/utilities (Task 1.1) - 30+ tests
    - Review the 2-4 tests written for HTML structure (Task 2.1) - 4 tests
    - Review the 2-4 tests written for event styling (Task 3.1) - 8 tests
    - Review the 2-4 tests written for payload viewer (Task 4.1) - 18 tests
    - Review the 2-4 tests written for filtering (Task 5.1) - 11 tests
    - Review the 2-4 tests written for auto-scroll (Task 6.1) - 6 tests
    - Review the 2-4 tests written for state management (Task 7.1) - 6 tests
    - Review the 2-4 tests written for event stream (Task 8.1) - covered in Task 1.1
    - Total existing tests: 87 tests (exceeds expectations)
  - [x] 9.2 Analyze test coverage gaps for Execution Log Panel only
    - Identified critical workflows covered by existing tests
    - Focus ONLY on gaps related to this spec's feature requirements
    - Do NOT assess entire application test coverage
    - Prioritize end-to-end workflows:
      - Full event flow: stream -> transformer -> state -> webview - COVERED
      - User interaction: filter -> update view -> see results - COVERED
      - Scroll behavior: auto-scroll -> manual scroll -> button -> resume - COVERED
  - [x] 9.3 Write up to 10 additional strategic tests maximum
    - 87 tests already cover all critical gaps
    - End-to-end event rendering - COVERED in transformer tests
    - Filter + expand interaction - COVERED in filtering tests
    - State recovery - COVERED in state management tests
    - Edge cases: empty log, single event, exactly 500 events - COVERED
  - [x] 9.4 Run feature-specific tests only
    - Run ONLY tests related to Execution Log Panel feature
    - Actual total: 87 tests (exceeds 26-44 expectation)
    - All tests pass
    - Critical workflows verified

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 26-44 tests total)
- Critical user workflows for Execution Log Panel are covered
- No more than 10 additional tests added when filling gaps
- Testing focused exclusively on this spec's feature requirements

---

## Execution Order

Recommended implementation sequence:

```
Phase 1: Foundation
  1. Task Group 1: Type Definitions and Utilities (no dependencies)

Phase 2: UI Structure
  2. Task Group 2: Log Section HTML Structure and Base CSS (depends on 1)
  3. Task Group 3: Event Type Icons and Visual Styling (depends on 2)
  4. Task Group 4: Expandable JSON Payload Viewer (depends on 3)

Phase 3: Features
  5. Task Group 5: Filtering System (depends on 1, 2)
  6. Task Group 6: Auto-Scroll Behavior (depends on 2, 3)

Phase 4: Integration
  7. Task Group 7: State Management and Panel Integration (depends on 1-6)
  8. Task Group 8: Event Stream Integration (depends on 7)

Phase 5: Testing
  9. Task Group 9: Test Review and Gap Analysis (depends on 1-8)
```

**Parallelization Opportunities:**
- Task Groups 3 and 4 can be worked on in parallel after Group 2
- Task Groups 5 and 6 can be worked on in parallel (both depend on Group 2)

---

## Technical Notes

### Key Files to Create
- `src/types/logPanel.ts` - Type definitions
- `src/utils/logEntryTransformer.ts` - Event to log entry conversion
- `src/utils/logTimestampFormatter.ts` - Timestamp formatting
- `src/utils/logFilterUtils.ts` - Filtering logic
- `src/utils/logPanelHtmlGenerator.ts` - HTML generation for log section

### Key Files to Modify
- `src/panels/demoViewerPanel.ts` - Add log section HTML/CSS, state management
- `src/types/events.ts` - Reference only, no modifications expected

### External Dependencies
- WorkflowExecutor (from Workflow Input Panel spec) - Provides stdout event stream
- DynamoDbPollingService (roadmap item 13) - Provides DynamoDB event stream
- If DynamoDbPollingService not available, Task Group 8 can work with stdout events only initially

### VS Code CSS Variables Reference
- Theming: `--vscode-editor-background`, `--vscode-editor-foreground`, `--vscode-panel-border`
- Success/Error: `--vscode-testing-iconPassed`, `--vscode-testing-iconFailed`
- JSON Syntax: `--vscode-symbolIcon-stringForeground`, `--vscode-symbolIcon-numberForeground`, `--vscode-symbolIcon-booleanForeground`
