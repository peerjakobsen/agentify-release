# Tool Call Visualization - Raw Idea

## Feature Overview

Show tool calls inline with agent messages in the collaboration pane.

## Description from roadmap item 35.2

### Data Source
- DynamoDB stores tool events via `@instrument_tool` decorator
- Events include: `workflow_id`, `agent`, `tool_name`, `parameters`, `status`, `duration_ms`
- Polling already fetches these events (existing DynamoDB integration)

### UI Design (inline chips below agent messages)
- Tool chips appear below agent messages showing which tools were called
- Chips show tool name, status icon, and duration

### Tool Chip States
- ⏳ Running (animated): Tool started, waiting for completion
- ✓ Completed (green): Tool finished successfully with duration
- ✗ Failed (red): Tool errored with hover tooltip for error message

### Implementation approach
- Match tool events to agent messages by `agent` field and timestamp
- Group consecutive tool calls under same agent message
- Optionally expandable to show parameters/output (click to expand)

### Files to modify
- `src/types/events.ts` — Already has `ToolCallEvent` interface
- `src/types/chatPanel.ts` — Add `toolCalls: ToolCallEvent[]` to `ChatMessage`
- `src/utils/chatStateUtils.ts` — Match tool events to agent messages
- `src/panels/demoViewerChatStyles.ts` — Tool chip CSS styles
- `src/utils/chatPanelHtmlGenerator.ts` — Render tool chips inline
