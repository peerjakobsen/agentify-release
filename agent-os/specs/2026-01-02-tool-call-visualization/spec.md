# Specification: Tool Call Visualization

## Goal
Display tool call chips inline with agent messages in both conversation and collaboration panes, showing running/completed/failed states with expandable details for sales demo visibility.

## User Stories
- As a sales presenter, I want to see tool calls appear inline with agent messages so that customers can see the "magic" of systems being queried in real-time
- As a demo viewer, I want to click on tool chips to see detailed input/output so that I can understand what data was fetched without disrupting the presentation flow

## Specific Requirements

**ChatMessage Interface Extension**
- Add `endTimestamp?: number` field to track when agent stops processing (set on `node_stop` event)
- Add `toolCalls: ToolCallEvent[]` field to store matched tool calls for each message
- Initialize `toolCalls` as empty array when creating new agent messages
- Set `endTimestamp` when `node_stop` event arrives for the agent

**Tool Event to Message Matching**
- Match tool events to agent messages using compound condition: `agent_name` match AND timestamp within agent's active timespan
- Matching formula: `toolEvent.agent_name === message.agentName && toolEvent.timestamp >= message.timestamp && toolEvent.timestamp <= message.endTimestamp`
- For streaming messages where `endTimestamp` is not yet set, use `Date.now()` as the upper bound
- Add `matchToolEventsToMessages()` function in `chatStateUtils.ts` that takes messages array and tool events array

**Tool Chip Container Layout**
- Render tool chips below message content in a flex container: `display: flex; flex-wrap: wrap; gap: 4px;`
- Container appears after the message text bubble, before the next message
- Parallel tool calls wrap to multiple lines naturally without horizontal scrolling
- Container class: `.tool-chips-container`

**Tool Chip Running State**
- Display VS Code codicon spinner: `.codicon-loading.codicon-modifier-spin`
- Chip format: `[spinner] [system]: [operation]`
- Use muted background color: `var(--vscode-input-background)`
- No duration shown while running

**Tool Chip Completed State**
- Display checkmark icon using codicon: `.codicon-check`
- Chip format: `[checkmark] [system]: [operation] (142ms)`
- Use subtle green tint: `background: rgba(115, 201, 145, 0.1)` with `color: var(--vscode-testing-iconPassed)`
- Duration displayed in parentheses after operation name

**Tool Chip Failed State**
- Display error icon using codicon: `.codicon-error`
- Chip format: `[error-icon] [system]: [operation] - FAILED`
- Use red-tinted background: `var(--vscode-inputValidation-errorBackground)` with `border: 1px solid var(--vscode-inputValidation-errorBorder)`
- Red styling immediately visible without expansion required

**Expandable Tool Details**
- Click on chip toggles inline expansion (pushes content down, does not overlay)
- Track expanded state per tool call using data attribute or component state
- Expanded section shows: input parameters, output result, error message (if failed), duration
- Input/output displayed as JSON with basic formatting (indentation via `JSON.stringify(data, null, 2)`)
- Output truncated with "Show more" link if exceeds 500 characters
- Error message prominently styled with red text when present

**HTML Generation for Tool Chips**
- Add `generateToolChipsHtml()` function to `chatPanelHtmlGenerator.ts`
- Generate chip HTML with appropriate status class: `.tool-chip.running`, `.tool-chip.completed`, `.tool-chip.failed`
- Include data attributes for expansion toggle: `data-tool-id="[unique-id]"`
- Use `escapeHtml()` for all user-provided content (system, operation, input, output, error_message)

## Existing Code to Leverage

**ToolCallEvent Interface (src/types/events.ts)**
- Already defines `agent_name`, `system`, `operation`, `input`, `output`, `status`, `error_message` fields
- Status enum: `'started' | 'completed' | 'failed'` maps directly to chip visual states
- Use `isToolCallEvent()` type guard when filtering events

**CSS Animation Patterns (src/panels/demoViewerChatStyles.ts)**
- Existing `@keyframes spin` animation (line 380) for spinner rotation
- Pipeline spinner pattern (lines 111-118) shows border-based spinner approach
- VS Code theming variables consistently used throughout file

**escapeHtml Utility (src/utils/chatPanelHtmlGenerator.ts)**
- Function already exists (lines 21-30) for XSS prevention
- Use for all tool call fields: system, operation, input, output, error_message

**Message Bubble Pattern (src/utils/chatPanelHtmlGenerator.ts)**
- `generateMessageBubbleHtml()` shows structure to follow for tool chip placement
- Insert tool chips container after `.message-content` div within `.chat-message` wrapper

**State Utilities Pattern (src/utils/chatStateUtils.ts)**
- Follow immutable update patterns used in existing functions like `addAgentMessage()` and `finalizeAgentMessage()`
- Add tool event matching function that returns new state with populated `toolCalls` arrays

## Out of Scope
- Tool call filtering or search functionality
- Aggregated metrics display (total calls, average duration, success rate)
- Retry/re-run failed tool functionality
- Tool call grouping by system or category
- Copy to clipboard for tool input/output
- "Show/Hide Tool Calls" toggle for hiding all chips
- Syntax highlighting for JSON in expanded view (basic formatting only)
- Persistent expansion state across re-renders
- Tool call notifications or sounds
- Export or logging of tool call data from the UI
