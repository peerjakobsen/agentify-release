# Task Breakdown: Tool Call Visualization

## Overview
Total Tasks: 4 Task Groups (18 major sub-tasks)

This feature displays tool call chips inline with agent messages in both conversation and collaboration panes, showing running/completed/failed states with expandable details for sales demo visibility.

## Architecture Context

### Tool Call Event Model
ToolCallEvent uses a status field with three values:
- `'started'`: Tool call began execution
- `'completed'`: Tool call finished successfully (has `output`)
- `'failed'`: Tool call encountered error (has `error_message`)

**Important:** Tool calls emit TWO events - first with status='started', then status='completed' or 'failed'. Duration is calculated from timestamp difference between the paired events.

### Tool ID Generation
Since ToolCallEvent lacks an `id` field, generate unique IDs using:
```typescript
const toolId = `${event.agent_name}-${event.system}-${event.operation}-${event.timestamp}`;
```

### Tool-to-Message Matching
Tool events belong to a message when:
```typescript
toolEvent.agent_name === message.agentName &&
toolEvent.timestamp >= message.timestamp &&
toolEvent.timestamp <= (message.endTimestamp || Date.now())
```

### Spinner Style
Use existing CSS spinner pattern (not codicons) for consistency with pipeline spinner:
```css
.tool-chip-spinner {
  width: 10px;
  height: 10px;
  border: 2px solid var(--vscode-descriptionForeground);
  border-top-color: var(--vscode-button-background);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
```

### Tool Chips in Both Panes
Tool chips appear in BOTH conversation and collaboration panes. Entry agents in the conversation pane often make tool calls that should be visible.

---

## Task List

### Types and State Layer

#### Task Group 1: Data Types and State Management
**Dependencies:** None
**Test File:** `src/test/utils/toolCallMatching.test.ts`

- [x] 1.0 Complete types and state layer
  - [x] 1.1 Write 6-8 focused tests for type extensions and state matching
    - Test `ChatMessage` interface accepts `endTimestamp` and `toolCalls` fields
    - Test `mergeToolCallPairs()` correctly pairs started/completed events by composite key
    - Test `mergeToolCallPairs()` calculates duration from timestamp differences
    - Test `matchToolEventsToMessages()` correctly matches by agent_name AND timestamp range
    - Test matching handles streaming messages (no endTimestamp) using Date.now()
    - Test parallel tool calls from same agent are grouped correctly
    - Test unpaired 'started' events are included as running tools
  - [x] 1.2 Extend `ChatMessage` interface in `src/types/chatPanel.ts`
    - Add `endTimestamp?: number` field with JSDoc: "Timestamp when agent finished (set on node_stop). Undefined while streaming."
    - Add `toolCalls: ToolCallEvent[]` field with JSDoc: "Tool call events matched to this message by agent and time range."
    - Add import: `import type { ToolCallEvent } from './events';`
  - [x] 1.3 Update `addAgentMessage()` in `src/utils/chatStateUtils.ts`
    - Initialize `toolCalls: []` when creating new agent messages
    - No changes needed for `endTimestamp` (undefined while streaming, set on node_stop)
  - [x] 1.4 Update `finalizeAgentMessage()` in `src/utils/chatStateUtils.ts`
    - Set `endTimestamp: Date.now()` when finalizing message
    - Follow existing immutable update pattern
  - [x] 1.5 Add `generateToolId()` helper function in `src/utils/chatStateUtils.ts`
    - Accept `ToolCallEvent` parameter
    - Return composite key: `${event.agent_name}-${event.system}-${event.operation}-${event.timestamp}`
  - [x] 1.6 Add `mergeToolCallPairs()` function in `src/utils/chatStateUtils.ts`
    - Accept `toolEvents: ToolCallEvent[]` parameter
    - Group by composite key (agent_name + system + operation)
    - For each group, pair 'started' with subsequent 'completed'/'failed' event
    - Calculate `duration_ms` from timestamp difference when paired
    - Return merged events with calculated duration
    - Unpaired 'started' events remain as-is (still running)
  - [x] 1.7 Add `matchToolEventsToMessages()` function in `src/utils/chatStateUtils.ts`
    - Accept `messages: ChatMessage[]` and `toolEvents: ToolCallEvent[]` parameters
    - First call `mergeToolCallPairs()` to consolidate paired events
    - Return new messages array with populated `toolCalls` arrays
    - Matching formula: `toolEvent.agent_name === message.agentName && toolEvent.timestamp >= message.timestamp && toolEvent.timestamp <= (message.endTimestamp || Date.now())`
    - Only include 'completed' or 'failed' events (not 'started' that have been paired)
    - Include unpaired 'started' events (still running)
    - Use immutable update patterns consistent with existing functions
  - [x] 1.8 Ensure types and state layer tests pass
    - Run ONLY the tests in `src/test/utils/toolCallMatching.test.ts`
    - Verify TypeScript compilation succeeds
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 6-8 tests written in 1.1 pass
- `ChatMessage` interface includes new fields
- `mergeToolCallPairs()` correctly pairs and calculates duration
- `matchToolEventsToMessages()` correctly groups tool events to messages
- All state updates remain immutable

**Files to Modify:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/chatPanel.ts`
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/utils/chatStateUtils.ts`

---

### Styling Layer

#### Task Group 2: Tool Chip CSS Styles
**Dependencies:** None (can run in parallel with Task Group 1)
**Test File:** `src/test/panels/toolChipStyles.test.ts`

- [x] 2.0 Complete CSS styling layer
  - [x] 2.1 Write 3-4 focused tests for CSS class presence and structure
    - Test `getDemoViewerChatStyles()` includes `.tool-chips-container` class
    - Test styles include `.tool-chip.running`, `.tool-chip.completed`, `.tool-chip.failed` classes
    - Test styles include `.tool-chip-details` for expanded view
    - Test styles include `.tool-chip-spinner` for running state animation
  - [x] 2.2 Add tool chips container styles in `src/panels/demoViewerChatStyles.ts`
    - Add `.tool-chips-container` with `display: flex; flex-wrap: wrap; gap: 4px;`
    - Add `margin-top: 8px;` for spacing from message content
  - [x] 2.3 Add base tool chip styles
    - Add `.tool-chip` base styles with `padding: 4px 8px; border-radius: 4px; font-size: 11px;`
    - Add `display: inline-flex; align-items: center; gap: 4px;`
    - Add `cursor: pointer;` for click interaction
  - [x] 2.4 Add tool chip running state styles
    - Add `.tool-chip.running` with `background: var(--vscode-input-background);`
    - Add `.tool-chip-spinner` using existing `@keyframes spin` pattern (CSS spinner, not codicon)
    - Add `color: var(--vscode-descriptionForeground);` for muted text
  - [x] 2.5 Add tool chip completed state styles
    - Add `.tool-chip.completed` with `background: rgba(115, 201, 145, 0.1);`
    - Add `color: var(--vscode-testing-iconPassed);` for green tint
    - Use Unicode checkmark instead of codicon
  - [x] 2.6 Add tool chip failed state styles
    - Add `.tool-chip.failed` with `background: var(--vscode-inputValidation-errorBackground);`
    - Add `border: 1px solid var(--vscode-inputValidation-errorBorder);`
    - Use Unicode X instead of codicon
  - [x] 2.7 Add expanded tool details styles
    - Add `.tool-chip-details` container with `margin-top: 8px; padding: 8px; background: var(--vscode-input-background); border-radius: 4px;`
    - Add `.tool-chip-details-section` with `margin-bottom: 8px;`
    - Add `.tool-chip-details-label` with `font-weight: 500; font-size: 10px; text-transform: uppercase; margin-bottom: 4px;`
    - Add `.tool-chip-json` with `font-family: var(--vscode-editor-font-family); font-size: 11px; white-space: pre-wrap; word-break: break-all;`
    - Add `.tool-chip-error-text` with `color: var(--vscode-errorForeground);`
    - Add `.tool-chip-show-more` with `color: var(--vscode-textLink-foreground); cursor: pointer; font-size: 11px;`
  - [x] 2.8 Ensure CSS layer tests pass
    - Run ONLY the tests in `src/test/panels/toolChipStyles.test.ts`
    - Verify styles string contains expected class names
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 3-4 tests written in 2.1 pass
- All tool chip states have distinct visual styles
- Styles use VS Code theme variables consistently
- Uses CSS spinner (not codicons) for running state
- Expanded details are styled for readability

**Files to Modify:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/demoViewerChatStyles.ts`

---

### HTML Generation Layer

#### Task Group 3: Tool Chip HTML Generation
**Dependencies:** Task Groups 1 and 2
**Test File:** `src/test/utils/toolChipHtmlGenerator.test.ts`

- [x] 3.0 Complete HTML generation layer
  - [x] 3.1 Write 5-7 focused tests for HTML generation
    - Test `generateToolChipsHtml()` returns empty string for empty array
    - Test generates correct HTML for running state with spinner div
    - Test generates correct HTML for completed state with checkmark and duration
    - Test generates correct HTML for failed state with X icon and "FAILED" text
    - Test `generateToolChipDetailsHtml()` formats JSON input/output correctly
    - Test output truncation with "Show more" link when > 500 characters
    - Test `escapeHtml()` is applied to system, operation, input, output fields
  - [x] 3.2 Export `escapeHtml()` function in `src/utils/chatPanelHtmlGenerator.ts`
    - Change from private function to exported function
    - No logic changes needed, just add `export` keyword
  - [x] 3.3 Add `generateToolChipHtml()` function in `src/utils/chatPanelHtmlGenerator.ts`
    - Accept `tool: ToolCallEvent` and `toolId: string` parameters
    - Accept optional `duration?: number` for completed tools
    - Generate chip HTML with status class: `.tool-chip.running`, `.tool-chip.completed`, `.tool-chip.failed`
    - Include `data-tool-id="${toolId}"` attribute for expansion toggle
    - Running state: `<div class="tool-chip-spinner"></div> ${system}: ${operation}`
    - Completed state: checkmark + `${system}: ${operation} (${duration}ms)`
    - Failed state: X mark + `${system}: ${operation} - FAILED`
    - Use `escapeHtml()` for system and operation fields
  - [x] 3.4 Add `generateToolChipDetailsHtml()` function
    - Accept `tool: ToolCallEvent` and `duration?: number` parameters
    - Generate details section with sections for: Input, Output (if exists), Error (if failed), Duration
    - Format JSON with `JSON.stringify(data, null, 2)`
    - Truncate output > 500 characters with `<span class="tool-chip-show-more" data-tool-id="${toolId}" data-action="expand-output">Show more...</span>`
    - Use `escapeHtml()` for all content fields
    - Wrap in `<div class="tool-chip-details" data-tool-id="${toolId}" style="display: none;">` (hidden by default)
  - [x] 3.5 Add `generateToolChipsHtml()` function
    - Accept `toolCalls: ToolCallEvent[]` and optional `durations: Map<string, number>` parameters
    - Return empty string if array is empty
    - Generate `.tool-chips-container` wrapping individual chip HTML + details HTML
    - Use `generateToolId()` from chatStateUtils for unique IDs
  - [x] 3.6 Integrate tool chips into `generateMessageBubbleHtml()`
    - Check if `message.toolCalls` exists and has items
    - Call `generateToolChipsHtml()` after `.message-content` div
    - Only add for agent messages (not user messages)
    - Import `generateToolId` from chatStateUtils
  - [x] 3.7 Ensure HTML generation tests pass
    - Run ONLY the tests in `src/test/utils/toolChipHtmlGenerator.test.ts`
    - Verify generated HTML structure is correct
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 5-7 tests written in 3.1 pass
- Tool chips render with correct status icons (Unicode, not codicons)
- HTML properly escapes user-provided content
- Expansion details show formatted JSON
- Details hidden by default with `display: none`

**Files to Modify:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/utils/chatPanelHtmlGenerator.ts`

---

### Event Handling and Integration

#### Task Group 4: Webview Event Handling and Integration Tests
**Dependencies:** Task Groups 1-3
**Test Files:** `src/test/integration/toolCallVisualization.test.ts`

- [x] 4.0 Complete event handling and integration
  - [x] 4.1 Add tool chip toggle JavaScript to webview HTML
    - Location: Inline `<script>` in the webview HTML generation (tabbedPanel.ts or equivalent)
    - Add click event listener for `.tool-chip` elements
    - Toggle visibility of corresponding `.tool-chip-details` element using `data-tool-id`
    - Toggle between `display: none` and `display: block`
  - [x] 4.2 Add "Show more" click handler for truncated output
    - Add click event listener for `.tool-chip-show-more` elements
    - Send message to extension host to fetch full output
    - Replace truncated content with full content
  - [x] 4.3 Write 4-6 integration tests
    - Test full flow: ToolCallEvent array -> matchToolEventsToMessages -> generateMessageBubbleHtml with chips
    - Test agent message with no tool calls renders without chip container
    - Test multiple parallel tool calls render in flex-wrap container
    - Test running tool chip updates to completed when paired event arrives
    - Test failed tool call shows error in expanded details
  - [x] 4.4 Run feature-specific tests
    - Run tests in:
      - `src/test/utils/toolCallMatching.test.ts`
      - `src/test/panels/toolChipStyles.test.ts`
      - `src/test/utils/toolChipHtmlGenerator.test.ts`
      - `src/test/integration/toolCallVisualization.test.ts`
    - Expected total: approximately 18-25 tests
    - Verify TypeScript compilation
    - Do NOT run the entire application test suite

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 18-25 tests total)
- Tool chip click toggles expansion inline (pushes content down)
- "Show more" link expands truncated output
- Critical integration points for tool visualization are covered

**Files to Modify:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/tabbedPanel.ts` (or webview HTML source)

---

## Execution Order

Recommended implementation sequence:

1. **Task Group 1: Data Types and State Management** - Foundation for tool event handling
2. **Task Group 2: Tool Chip CSS Styles** - Can run in parallel with Group 1
3. **Task Group 3: Tool Chip HTML Generation** - Depends on Groups 1 and 2
4. **Task Group 4: Webview Event Handling** - Final integration and testing

**Parallel Execution Opportunity:**
- Task Groups 1 and 2 can be executed in parallel as they modify different files with no dependencies between them.

---

## Key Files Reference

| File | Task Groups | Purpose |
|------|-------------|---------|
| `src/types/chatPanel.ts` | 1 | ChatMessage interface extension |
| `src/types/events.ts` | 1 (read-only) | Existing ToolCallEvent interface |
| `src/utils/chatStateUtils.ts` | 1 | Tool event matching and pairing functions |
| `src/panels/demoViewerChatStyles.ts` | 2 | Tool chip CSS styles |
| `src/utils/chatPanelHtmlGenerator.ts` | 3 | Tool chip HTML generation, escapeHtml export |
| `src/panels/tabbedPanel.ts` | 4 | Webview JavaScript for expansion toggle |
| `src/test/utils/toolCallMatching.test.ts` | 1 | Type and matching tests |
| `src/test/panels/toolChipStyles.test.ts` | 2 | CSS class presence tests |
| `src/test/utils/toolChipHtmlGenerator.test.ts` | 3 | HTML generation tests |
| `src/test/integration/toolCallVisualization.test.ts` | 4 | End-to-end integration tests |

---

## Existing Code to Leverage

- **ToolCallEvent interface** (`src/types/events.ts`): Already has `agent_name`, `system`, `operation`, `input`, `output`, `status`, `error_message` fields. Note: `status` can be 'started', 'completed', or 'failed'.
- **isToolCallEvent type guard** (`src/types/events.ts`): Use when filtering events
- **escapeHtml utility** (`src/utils/chatPanelHtmlGenerator.ts`): For XSS prevention - needs to be exported
- **@keyframes spin animation** (`src/panels/demoViewerChatStyles.ts`): Existing spinner animation, reuse for tool chip spinner
- **Error styling pattern** (`.chat-error-message` in demoViewerChatStyles.ts): Reference for failed state styling
- **Immutable update patterns** (`src/utils/chatStateUtils.ts`): Follow for state manipulation
- **generateMessageId pattern** (`src/utils/chatStateUtils.ts`): Reference for ID generation style

---

## Explicit Exclusions

Per Q&A decisions, these features are NOT in scope for this implementation:
- Tool call filtering/search
- Aggregated metrics (total calls, avg duration)
- Retry/re-run functionality
- Tool call grouping by system
- Copy tool input/output to clipboard
- Codicon usage (use Unicode/CSS instead for consistency)
