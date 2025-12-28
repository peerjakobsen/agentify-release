# Specification: Execution Log Panel

## Goal
Display a chronological, filterable log of workflow execution events within the Demo Viewer panel, showing merged stdout and DynamoDB events with timestamps, type indicators, agent names, and expandable JSON payload details.

## User Stories
- As a developer, I want to see real-time execution events during workflow runs so that I can understand what agents and tools are doing
- As a developer, I want to expand event payloads inline so that I can inspect tool inputs and outputs without leaving the panel

## Specific Requirements

**Log Section Layout**
- Position within Demo Viewer panel below Input Panel section
- Collapsible section with header showing "Execution Log" label
- Layout order: Input Panel -> Agent Graph (placeholder div) -> Execution Log -> Outcome Panel (placeholder div)
- Continuous vertical scroll within the panel (not tabs)
- Section starts collapsed by default, expands when first event arrives

**Event Entry Display**
- Each entry displays: timestamp (HH:MM:SS.mmm format), event type icon, agent/node name, event summary
- Event types with distinct styling:
  - `node_start`: Play icon, neutral color, "Agent started" text
  - `node_stop`: Check icon, success/error color based on status, "Agent completed (Xs)" with duration
  - `tool_call`: Wrench icon, neutral color, "Tool: {system} -> {operation}" format
  - `tool_result`: Output icon, success/error color based on status, result summary
  - `workflow_complete`: Flag icon, success color, "Workflow completed" text
  - `workflow_error`: Alert icon, error color, "Workflow failed: {error}" with message
- Filtered out (not displayed): `node_stream` events, `graph_structure` events

**Expandable Payload Details**
- Expand/collapse button [+]/[-] on entries with payloads (tool_call, tool_result, agent_span)
- Inline expansion below the log entry row
- JSON syntax highlighting using VS Code CSS variables:
  - `--vscode-symbolIcon-stringForeground` for string values
  - `--vscode-symbolIcon-numberForeground` for number values
  - `--vscode-symbolIcon-booleanForeground` for boolean values
- Large payloads (>20 lines): Show first 10 lines with "Show more..." link
- "Show more" reveals remaining content inline

**Filtering Controls**
- Two dropdown filters positioned in log section header area
- Event Type filter: "All Events", "Agent Events", "Tool Calls", "Errors Only"
- Agent Name filter: "All Agents" + dynamic list populated from current workflow's unique agent names
- Filters update immediately on selection without full re-render
- Filters persist within session, reset on new workflow run

**Auto-Scroll Behavior**
- Running state + user at bottom: Auto-scroll to newest events
- Running state + user scrolled up: Stop auto-scroll, show floating "Scroll to bottom" button
- Completed/Error state: Disable auto-scroll, allow free scrolling
- New run started: Clear log, jump to top, resume auto-scroll
- Floating button: Positioned bottom-right corner of log section with fixed positioning

**State Management**
- Clear log only when "Run Workflow" button clicked
- Retain log entries during IDE session (switching tabs, closing/reopening Demo Viewer)
- Do NOT persist log across IDE restart
- Store events array in DemoViewerPanelProvider instance state (not workspaceState)
- Maximum 500 events in memory (drop oldest if exceeded)

**Event Stream Integration**
- Consume events from Merged Event Stream Service (roadmap item 12)
- Handle both local mode (stdout + DynamoDB) and AgentCore mode (DynamoDB only)
- Events arrive via MergedEvent wrapper with source discriminator
- Deduplicated and chronologically ordered by Merged Event Stream Service

## Existing Code to Leverage

**`src/types/events.ts` - Event Type System**
- Use existing `MergedEvent<T>` wrapper interface for unified event handling
- Use `StdoutEvent` union type for stdout events (NodeStartEvent, NodeStopEvent, WorkflowCompleteEvent)
- Use `DynamoDbEvent` union type for DynamoDB events (ToolCallEvent, AgentSpanEvent)
- Use existing type guards: `isNodeStartEvent()`, `isNodeStopEvent()`, `isToolCallEvent()`, `isWorkflowCompleteEvent()`

**`src/panels/demoViewerPanel.ts` - Webview Panel Pattern**
- Follow existing webview HTML/CSS structure with VS Code CSS variables
- Use same Content Security Policy pattern for scripts and styles
- Follow `postMessage`/`onDidReceiveMessage` pattern for extension-webview communication
- Extend existing `syncStateToWebview()` pattern to include log events
- Use instance variables (like `_currentExecution`) for session-scoped state

**`src/utils/timerFormatter.ts` - Time Formatting**
- Adapt `formatTime()` pattern for timestamp display formatting

**`src/utils/inputPanelStateMachine.ts` - State Machine Pattern**
- Consider similar state machine approach for log section states (collapsed, expanded, scrolling)

**`src/types/inputPanel.ts` - Type Definitions Pattern**
- Follow same pattern for defining LogEntry, LogFilterState, and LogPanelState types

## Out of Scope
- Agent Graph visualization (Phase 3 separate spec - only placeholder div needed)
- Outcome Panel visualization (separate spec - only placeholder div needed)
- Cross-panel bidirectional highlighting between log and Agent Graph (Phase 3 enhancement)
- Full-text search within event payloads
- Log persistence across IDE restart
- Virtual scrolling optimization (implement only if performance issues arise)
- Pagination for large event counts (not needed for typical 50-200 events)
- Export log to file functionality
- Event timestamp timezone configuration
- Custom event filtering expressions
