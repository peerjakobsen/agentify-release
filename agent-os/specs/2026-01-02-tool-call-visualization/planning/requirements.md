# Spec Requirements: Tool Call Visualization

## Initial Description
Show tool calls inline with agent messages in the collaboration pane of the Demo Viewer. Tool chips appear below agent messages showing which tools were called, with status icons (running, completed, failed) and duration. Data comes from DynamoDB via the existing `@instrument_tool` decorator which stores `workflow_id`, `agent`, `tool_name`, `parameters`, `status`, and `duration_ms`.

## Requirements Discussion

### First Round Questions

**Q1:** I assume tool chips should appear for all agent messages in both panes (conversation and collaboration), not just the collaboration pane. The raw idea mentions "collaboration pane" but tool calls could occur for the entry agent too. Is showing tools in both panes correct, or should we limit it to only the collaboration pane?
**Answer:** Both panes. Entry agent often makes tool calls too (e.g., triage agent querying CRM). For sales demos, showing tool calls everywhere helps customers see the "magic." Keep styling consistent across panes. Future iteration could add "Show/Hide Tool Calls" toggle.

**Q2:** For the running state animation, I'm thinking a subtle spinner or pulse animation on the chip rather than an emoji. Should the running indicator be a small spinner icon next to the tool name, a pulsing/glowing border effect on the chip, or is the emoji-based approach (hourglass) preferred for simplicity?
**Answer:** Small CSS spinner icon next to tool name. Use VS Code's `vscode-codicon` spinner class (`.codicon-loading.codicon-modifier-spin`). More polished than emoji for sales demos. Pulsing border can be distracting with multiple parallel calls. Example: `[spinner SAP S/4HANA: get_inventory]` where spinner is CSS spinner.

**Q3:** I assume expandable tool details should show on click (not hover), revealing input parameters, output result, and error message. Is this the expected behavior? Should the expansion be inline (pushes content down) or a tooltip/popover overlay?
**Answer:** Inline expansion (pushes content down). Presenters can point at details on screen without them disappearing. Consistent with VS Code panels. Should show:
- Input parameters (JSON, syntax highlighted if reasonable)
- Output result (truncated with "show more" if very long)
- Error message (if failed, prominently styled)
- Duration (e.g., "142ms")

**Q4:** For matching tool events to agent messages, the ToolCallEvent has `agent_name` but messages have `agentName`. I assume we match by same agent name AND tool event timestamp falls within the agent's message timespan (between node_start and node_stop). Is this matching logic correct, or should it be purely timestamp-based?
**Answer:** Agent name AND timestamp within agent's active timespan:
```
toolBelongsToMessage =
  toolEvent.agent_name === message.agentName &&
  toolEvent.timestamp >= message.timestamp &&
  toolEvent.timestamp <= message.endTimestamp (or now if streaming)
```
Pure timestamp-based would break with parallel agent execution in graph/swarm patterns.

**Q5:** If an agent makes multiple tool calls in parallel, should they appear in a single row wrapping to multiple lines if needed, stacked vertically (one chip per line), or in a scrollable horizontal row?
**Answer:** Wrapping to multiple lines in a flex container. Horizontal scroll hides tools (bad for demos). Stacked vertically takes too much space. CSS: `display: flex; flex-wrap: wrap; gap: 4px;`

**Q6:** For failed tool calls, should the error message appear only on hover (as a tooltip), immediately visible in red text below the chip, or in the expanded detail view only?
**Answer:** Tiered approach:
- Chip itself: Red/warning background + error icon (immediately visible)
- Expanded view: Full error message text
- No tooltip-only errors (too easy to miss during demos)
- Example: `[error-icon SAP S/4HANA: get_inventory - FAILED]` with red-tinted background

**Q7:** Is there anything we should explicitly exclude from this initial implementation?
**Answer:** Exclude all:
- Tool call filtering/search (not needed for demos)
- Aggregated metrics (nice-to-have, not MVP)
- Retry/re-run functionality (demos restart workflows)
- Tool call grouping by system (premature optimization)
- Copy to clipboard (add later if requested)

Focus only on:
- Rendering chips inline with agent messages
- Running/completed/failed states with visual feedback
- Expandable details (inline)
- Matching tools to correct agent message

### Existing Code to Reference

No similar existing features identified for reference by user. However, based on codebase analysis:

**Relevant Existing Patterns:**
- `src/types/events.ts` - Already has `ToolCallEvent` interface with `agent_name`, `system`, `operation`, `input`, `output`, `status`, `error_message` fields
- `src/types/chatPanel.ts` - `ChatMessage` interface to extend with `toolCalls` and `endTimestamp`
- `src/utils/chatStateUtils.ts` - State manipulation functions to add tool event matching logic
- `src/panels/demoViewerChatStyles.ts` - CSS styles following VS Code theming patterns
- `src/utils/chatPanelHtmlGenerator.ts` - HTML generation with `escapeHtml()` and message bubble patterns
- Streaming indicator patterns in `demoViewerChatStyles.ts` (lines 354-382) for animation reference

### Follow-up Questions

**Follow-up 1:** You mentioned `message.endTimestamp` for matching tool events. The current `ChatMessage` interface doesn't have an `endTimestamp` field - it only has `timestamp` (creation time). Should we add `endTimestamp?: number` to `ChatMessage`, derive it from the next message's timestamp as a proxy, or use a different approach?
**Answer:** Option A - Add `endTimestamp?: number` to `ChatMessage` (set when `node_stop` event arrives)

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A - No visual files to analyze.

## Requirements Summary

### Functional Requirements
- Display tool call chips inline below agent messages in both conversation and collaboration panes
- Show tool chips with: system name, operation name, status icon, and duration (when completed)
- Support three visual states for tool chips:
  - **Running**: CSS spinner icon (`.codicon-loading.codicon-modifier-spin`) + tool name
  - **Completed**: Green checkmark icon + tool name + duration (e.g., "142ms")
  - **Failed**: Red error icon + tool name + "FAILED" text + red-tinted background
- Enable click-to-expand for tool details showing:
  - Input parameters (JSON formatted, syntax highlighted if reasonable)
  - Output result (JSON formatted, truncated with "show more" for long content)
  - Error message (prominently styled for failed calls)
  - Duration
- Match tool events to agent messages using: `agent_name` match AND `timestamp` within message's active timespan
- Layout parallel tool calls in a wrapping flex container (`flex-wrap: wrap; gap: 4px`)
- Add `endTimestamp?: number` field to `ChatMessage` interface (set on `node_stop` event)
- Add `toolCalls: ToolCallEvent[]` field to `ChatMessage` interface

### Reusability Opportunities
- Existing `ToolCallEvent` interface in `src/types/events.ts` already has required fields
- VS Code codicon classes available for spinner and status icons
- Existing CSS theming variables in `demoViewerChatStyles.ts` for consistent styling
- `escapeHtml()` utility in `chatPanelHtmlGenerator.ts` for safe rendering

### Scope Boundaries
**In Scope:**
- Rendering tool chips inline with agent messages (both panes)
- Running/completed/failed visual states
- Click-to-expand inline detail view
- Matching tool events to correct agent message by name + timestamp
- Adding `endTimestamp` and `toolCalls` fields to `ChatMessage`

**Out of Scope:**
- Tool call filtering or search functionality
- Aggregated metrics (total calls, average duration)
- Retry/re-run failed tool functionality
- Tool call grouping by system
- Copy to clipboard functionality
- "Show/Hide Tool Calls" toggle (future iteration)

### Technical Considerations
- Use VS Code's codicon classes for icons (`.codicon-loading`, `.codicon-check`, `.codicon-error`)
- Follow existing CSS patterns in `demoViewerChatStyles.ts` using VS Code theme variables
- Tool events come from DynamoDB polling (existing `DynamoDbPollingService`)
- Must handle streaming messages where `endTimestamp` is not yet set (use current time)
- Parallel tool calls possible - flex-wrap layout handles gracefully
- Keep styling consistent between conversation and collaboration panes

### Files to Modify
- `src/types/chatPanel.ts` - Add `toolCalls: ToolCallEvent[]` and `endTimestamp?: number` to `ChatMessage`
- `src/utils/chatStateUtils.ts` - Add function to match tool events to agent messages
- `src/panels/demoViewerChatStyles.ts` - Add tool chip CSS styles (container, chip, states, expanded)
- `src/utils/chatPanelHtmlGenerator.ts` - Add functions to render tool chips and expanded details
