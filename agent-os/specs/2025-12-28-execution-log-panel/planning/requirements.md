# Spec Requirements: Execution Log Panel

## Initial Description
Create chronological log panel displaying events from DynamoDB with timestamps, event types, agent names, and expandable payload details

## Requirements Discussion

### First Round Questions

**Q1:** I assume the Execution Log Panel will be a new section within the existing Demo Viewer panel, positioned below the Input Panel section (prompt textarea, run button, timer, execution info). Is that correct, or should it be a separate collapsible panel or tab within the Demo Viewer?
**Answer:** Section within Demo Viewer panel, below Input Panel. Layout order (top to bottom): Input Panel -> Agent Graph (Phase 3 placeholder) -> Execution Log -> Outcome Panel (separate spec placeholder). Not tabs - continuous vertical scroll with collapsible sections. Tabs hide information useful to see simultaneously during demos.

**Q2:** I'm thinking the log should auto-scroll to the newest events during workflow execution but allow users to scroll freely when paused/completed. Should we also include a "scroll to bottom" button that appears when the user has scrolled up?
**Answer:** Running + user at bottom: Auto-scroll to newest events. Running + user scrolled up: Stop auto-scroll, show "Scroll to bottom" floating button. Completed/Error: No auto-scroll, free scrolling. New run started: Jump to top, resume auto-scroll. Button appears in bottom-right corner of log section.

**Q3:** I assume we'll show all DynamoDB event types (tool_call, agent_start, agent_end) in the log with distinct visual styling (icons, colors) for each type. Should we also merge in real-time stdout events (node_start, node_stop, node_stream) when running in local mode, or keep this panel focused only on DynamoDB-sourced events?
**Answer:** Merge both stdout + DynamoDB events. Show in log: node_start (stdout) as "Agent started", node_stop (stdout) as "Agent completed (duration)", tool_call (DynamoDB) as "Tool: system -> operation", tool_result (DynamoDB) as success/error summary, workflow_complete (stdout) as "Workflow completed", workflow_error (stdout) as "Workflow failed: error". Don't show: node_stream (too verbose), graph_structure (internal initialization). Note: Merged Event Stream Service (roadmap item 12) handles deduplication and chronological ordering.

**Q4:** For the expandable payload details, I'm assuming we'll use a collapsible JSON viewer with syntax highlighting for the input and output objects in tool_call events. Should this expand inline below the log entry, or open in a side panel/modal for larger payloads?
**Answer:** Inline expansion, not modal. Click [+] expands below the log entry. For large payloads (>20 lines): show first 10 lines with "Show more..." link. Use VS Code's built-in code styling variables for JSON syntax highlighting: --vscode-symbolIcon-stringForeground for strings, --vscode-symbolIcon-numberForeground for numbers, --vscode-symbolIcon-booleanForeground for booleans.

**Q5:** I assume basic filtering by event type and/or agent name would be useful. Should this be a simple dropdown filter at the top of the log, or should we also support a search/filter text input for payload contents?
**Answer:** Dropdown filters at top, no full-text search. Event Type filter: All, Agent Events, Tool Calls, Errors. Agent Name filter: All, {dynamic list from current workflow's agents}.

**Q6:** Should clicking on an agent name in the log highlight/select that agent in the Agent Graph visualization (when it's built in Phase 3), or keep the panels independent for now?
**Answer:** Keep panels independent for this spec. Note as future enhancement for Phase 3 (Agent Graph can add bidirectional highlighting).

**Q7:** I assume the log should clear and start fresh when the user clicks "Run Workflow" for a new execution. Should we also persist the last execution's log in workspace storage so users can review it after IDE restart, or always start empty?
**Answer:** Do not persist logs across IDE restart. Within single IDE session: switching tabs/panels or closing/reopening Demo Viewer should NOT clear log. Only "Run Workflow" clears the log. Use panel provider's instance state (not workspaceState).

**Q8:** What's the expected maximum number of events for a typical workflow? I'm assuming 50-200 events per run, so infinite scroll without pagination should work. If workflows could generate thousands of events, should we implement pagination or a "load more" pattern?
**Answer:** 50-200 events typical, infinite scroll without pagination. Virtual scrolling only if performance becomes an issue (unlikely for MVP).

### Existing Code to Reference

No similar existing features identified for reference.

### Follow-up Questions

No follow-up questions needed - user provided comprehensive answers.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
Not applicable - no visual files found.

## Requirements Summary

### Functional Requirements

**Layout and Structure:**
- New section within Demo Viewer panel, positioned below Input Panel
- Layout order: Input Panel -> Agent Graph (Phase 3 placeholder) -> Execution Log -> Outcome Panel (placeholder)
- Continuous vertical scroll with collapsible sections (not tabs)
- Collapsible section header for the Execution Log

**Event Display:**
- Chronological list of merged events from stdout and DynamoDB sources
- Each log entry shows: timestamp, event type icon, agent name, event summary
- Distinct visual styling (icons, colors) for each event type:
  - node_start: "Agent started" indicator
  - node_stop: "Agent completed (duration)" with timing
  - tool_call: "Tool: system -> operation" format
  - tool_result: Success/error summary
  - workflow_complete: "Workflow completed" status
  - workflow_error: "Workflow failed: error" with error message
- Filtered out events: node_stream (verbose), graph_structure (internal)

**Expandable Payload Details:**
- Inline expansion below log entry (not modal)
- Click [+] button to expand/collapse
- JSON syntax highlighting using VS Code CSS variables
- Large payloads (>20 lines): Show first 10 lines with "Show more..." link

**Filtering:**
- Dropdown filters positioned at top of log section
- Event Type filter options: All, Agent Events, Tool Calls, Errors
- Agent Name filter: All + dynamic list from current workflow's agents

**Auto-Scroll Behavior:**
- Running + user at bottom: Auto-scroll to newest events
- Running + user scrolled up: Stop auto-scroll, show floating "Scroll to bottom" button
- Completed/Error state: No auto-scroll, free scrolling
- New run started: Jump to top, resume auto-scroll
- Floating button positioned in bottom-right corner of log section

**State Management:**
- Clear log only when "Run Workflow" clicked
- Retain log during IDE session (switching tabs, closing/reopening panel)
- Do NOT persist across IDE restart
- Use panel provider's instance state (not workspaceState)

### Reusability Opportunities

- Existing `demoViewerPanel.ts` provides the panel structure and webview patterns
- Existing `src/types/events.ts` defines all event type interfaces (StdoutEvent, DynamoDbEvent, MergedEvent)
- Existing type guards (isToolCallEvent, isNodeStartEvent, etc.) for event type discrimination
- VS Code CSS variables already used in existing HTML for consistent theming
- Merged Event Stream Service (roadmap item 12) will handle event deduplication and ordering

### Scope Boundaries

**In Scope:**
- Log section UI within Demo Viewer panel
- Display of merged stdout + DynamoDB events
- Timestamp formatting and display
- Event type icons and visual differentiation
- Agent name display
- Expandable JSON payload viewer with syntax highlighting
- "Show more" truncation for large payloads
- Dropdown filters for event type and agent name
- Auto-scroll behavior with floating "Scroll to bottom" button
- Session-based state retention (not workspace persistence)

**Out of Scope:**
- Agent Graph visualization (Phase 3, separate spec)
- Outcome Panel (separate spec)
- Cross-panel linking/highlighting (deferred to Phase 3)
- Full-text search within payloads
- Log persistence across IDE restart
- Virtual scrolling optimization (only if performance issues arise)
- Pagination (not needed for typical 50-200 events)

### Technical Considerations

- Depends on Merged Event Stream Service (roadmap item 12) for unified event stream
- Must handle both local mode (stdout + DynamoDB) and AgentCore mode (DynamoDB only)
- JSON syntax highlighting via VS Code CSS variables:
  - `--vscode-symbolIcon-stringForeground` for strings
  - `--vscode-symbolIcon-numberForeground` for numbers
  - `--vscode-symbolIcon-booleanForeground` for booleans
- Event types defined in `src/types/events.ts`:
  - StdoutEvent: GraphStructureEvent, NodeStartEvent, NodeStopEvent, NodeStreamEvent, WorkflowCompleteEvent
  - DynamoDbEvent: ToolCallEvent, AgentSpanEvent
- Use existing webview HTML/CSS pattern from `demoViewerPanel.ts`
- Instance state management within DemoViewerPanelProvider class
