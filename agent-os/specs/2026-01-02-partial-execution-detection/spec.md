# Specification: Partial Execution Detection

## Goal
Detect when an agent workflow pauses waiting for user input (partial execution) and provide clear visual feedback in the Demo Viewer chat UI, enabling seamless multi-turn conversations.

## User Stories
- As a user, I want to see when the agent is waiting for my response so that I know the workflow is paused and I need to provide additional information.
- As a user, I want to see a clear status indicator showing whether the workflow is running, waiting, complete, or errored so that I understand the current state at a glance.

## Specific Requirements

**Workflow Status State Machine**
- Add new `workflowStatus` field with values: `'running' | 'partial' | 'complete' | 'error'`
- Initial state is `'running'` when workflow starts
- Transition `running -> partial` when entry agent's `node_stop` received AND no `workflow_complete` yet
- Transition `running -> complete` or `partial -> complete` when `workflow_complete` event arrives
- Transition `running -> error` or `partial -> error` when `workflow_error` event arrives
- Transition `partial -> running` when user sends follow-up message (new turn)
- Reset to `'running'` when user clicks "New Conversation"

**Entry Agent Detection**
- Entry agent identified from first `node_stop` event (already tracked via `entryAgentName` from first `node_start`)
- Compare `node_stop` agent name against stored `entryAgentName` to determine if entry agent completed
- Partial detection triggers immediately when entry agent stops without `workflow_complete`
- No timeout or delay needed for detection

**Partial Execution Indicator (Left Pane)**
- Render as separate `div.partial-execution-indicator` element below entry agent's response bubble
- Display text: "...awaiting your response" with animated ellipsis
- Style: Left-aligned, smaller font (11px), italicized, muted color (`--vscode-descriptionForeground`)
- Show only when `workflowStatus === 'partial'`
- Persists until: user submits follow-up, `workflow_complete` arrives, or "New Conversation" clicked

**Session Info Bar Status Badge**
- Add status badge to session info bar alongside existing workflow_id, turn count, elapsed time
- Badge displays icon based on `workflowStatus`:
  - Running: Spinner icon (animated CSS spinner)
  - Partial: Hourglass icon (Unicode character)
  - Complete: Green checkmark icon (Unicode with green color)
  - Error: Red X icon (Unicode with red color)
- Position badge at the end of the session info bar items

**Event Handler Updates**
- `handleNodeStopEvent`: Check if stopped agent matches `entryAgentName`, if yes and no `workflow_complete` received, set status to `'partial'`
- `handleWorkflowCompleteEvent`: Set status to `'complete'`, clear any partial indicator
- `handleWorkflowErrorEvent`: Set status to `'error'` (distinct from partial state)
- `handleSendMessage`: Set status back to `'running'` when user sends follow-up message

**State Clearing Rules**
- Partial indicator clears when user submits follow-up (transitions to `'running'`)
- Partial indicator clears when `workflow_complete` event arrives (transitions to `'complete'`)
- All status clears when user clicks "New Conversation" (full state reset)

## Visual Design
No visual mockups provided. Use existing VS Code theme variables and styling patterns from current implementation.

## Existing Code to Leverage

**`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/chatPanel.ts`**
- Add `workflowStatus` field to `ChatUiState` interface (alongside existing `isWorkflowRunning` boolean)
- Existing `ChatSessionState.entryAgentName` already tracks entry agent from first `node_start`
- Follow existing type patterns for the new `WorkflowStatus` type union

**`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/utils/chatStateUtils.ts`**
- Add new state transition functions following existing patterns (e.g., `updatePipelineStage`, `finalizeAgentMessage`)
- Create `setWorkflowStatus(state, status)` function for status transitions
- Reuse `createInitialUiState()` pattern for default status value

**`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/demoViewerChatLogic.ts`**
- Add detection logic in existing `handleNodeStopEvent` method (around line 440)
- Add status transition in existing `handleWorkflowCompleteEvent` method (around line 486)
- Add status transition in existing `handleWorkflowErrorEvent` method (around line 518)
- Modify existing `handleSendMessage` to reset status to `'running'`

**`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/demoViewerChatStyles.ts`**
- Add `.partial-execution-indicator` CSS class following existing message styling patterns
- Add `.workflow-status-badge` CSS classes with state variants (`.running`, `.partial`, `.complete`, `.error`)
- Reuse existing animation keyframes (`spin`, `blink`) for status indicators

**`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/utils/chatPanelHtmlGenerator.ts`**
- Modify `generateConversationPaneHtml` to conditionally render partial indicator after last entry agent message
- Modify `generateSessionInfoBarHtml` to include status badge element
- Create new `generatePartialIndicatorHtml()` function following existing generator patterns

## Out of Scope
- Multiple concurrent partial workflows (only single workflow tracking needed)
- Storing partial state for recovery after IDE restart (in-memory only)
- Timeout-based auto-detection (using immediate event-based detection instead)
- Persisting partial state in DynamoDB (client-side state only)
- Retry or resume functionality from partial state
- Visual indication in Agent Graph panel (Phase 4 feature)
- Special visual distinction in the Agent Collaboration pane (right pane unchanged)
- Notification or toast messages for state changes
- Keyboard shortcuts related to partial execution
- Analytics or logging for partial execution events
