# Task Breakdown: Partial Execution Detection

## Overview
Total Tasks: 26
Size: S (Small)

This feature detects when an agent workflow pauses waiting for user input and provides visual feedback in the Demo Viewer chat UI. It builds on the existing Dual-Pane UI (Item 35.1).

## Architecture Context

### Detection Model
Partial execution detection uses an **optimistic detection approach**:
1. When the entry agent's `node_stop` event is received, we assume it might be partial
2. If the workflow is still marked as running (`isWorkflowRunning === true`), we set status to `'partial'`
3. If `workflow_complete` arrives later (immediately or within ms), it overrides to `'complete'`
4. If `workflow_error` arrives, it sets status to `'error'`

This approach is safe because:
- Complete workflows emit `workflow_complete` immediately after the final `node_stop`
- Partial workflows (asking for clarification) do NOT emit `workflow_complete`
- The UI briefly showing "partial" then "complete" is imperceptible to users

### Event Flow

```
User prompt → workflow starts → isWorkflowRunning=true, workflowStatus='running'
     ↓
Entry agent node_start → entryAgentName set
     ↓
Entry agent node_stop → workflowStatus='partial' (optimistic)
     ↓
BRANCH A: workflow_complete arrives → workflowStatus='complete', isWorkflowRunning=false
BRANCH B: no workflow_complete → remains 'partial', user sees indicator
     ↓
User sends follow-up → workflowStatus='running', continues session
```

### UI Elements
- **Partial Indicator**: Displays below entry agent's response in the Conversation pane (left)
- **Status Badge**: Displays in session info bar with icon + label for current status

## Test File Paths

| Task Group | Test File |
|------------|-----------|
| Task Group 1 | `src/test/types/workflowStatus.test.ts` |
| Task Group 2 | `src/test/panels/partialDetection.test.ts` |
| Task Group 3 | `src/test/utils/partialIndicatorHtml.test.ts` |
| Task Group 4 | `src/test/integration/partialExecutionFlow.test.ts` |

## Task List

### Type and State Layer

#### Task Group 1: Types and State Management
**Dependencies:** None

- [x] 1.0 Complete type and state layer
  - [x] 1.1 Write 3-4 focused tests for workflow status state transitions
    - **File:** `src/test/types/workflowStatus.test.ts`
    - Test `setWorkflowStatus()` transitions between states
    - Test that `createInitialUiState()` returns `'running'` as default
    - Test state clears on `resetChatState()`
  - [x] 1.2 Add `WorkflowStatus` type to chatPanel.ts
    - **File:** `src/types/chatPanel.ts`
    - Add type union: `export type WorkflowStatus = 'running' | 'partial' | 'complete' | 'error';`
    - Add `workflowStatus: WorkflowStatus` field to `ChatUiState` interface (lines 108-119)
    - Follow existing type patterns (e.g., `AgentPipelineStatus` on line 17)
    - Export the type for use in other files
  - [x] 1.3 Create `setWorkflowStatus()` function in chatStateUtils.ts
    - **File:** `src/utils/chatStateUtils.ts`
    - Create `setWorkflowStatus(uiState: ChatUiState, status: WorkflowStatus): ChatUiState`
    - Follow existing patterns like `updatePipelineStage()` (lines 247-272)
  - [x] 1.4 Update `createInitialUiState()` to include default `workflowStatus`
    - **File:** `src/utils/chatStateUtils.ts`
    - Add `workflowStatus: 'running'` to return object (lines 63-70)
  - [x] 1.5 Ensure type and state tests pass
    - Run ONLY the 3-4 tests written in 1.1
    - Verify TypeScript compilation succeeds

**Acceptance Criteria:**
- `WorkflowStatus` type exported from chatPanel.ts
- `workflowStatus` field exists on `ChatUiState`
- `setWorkflowStatus()` function returns new state with updated status
- Default status is `'running'`

### Detection Logic Layer

#### Task Group 2: Event Handler Updates
**Dependencies:** Task Group 1

- [x] 2.0 Complete detection logic layer
  - [x] 2.1 Write 3-4 focused tests for partial execution detection
    - **File:** `src/test/panels/partialDetection.test.ts`
    - Test `handleNodeStopEvent` sets status to `'partial'` when entry agent stops (workflow still running)
    - Test `handleWorkflowCompleteEvent` sets status to `'complete'`
    - Test `handleSendMessage` resets status to `'running'`
  - [x] 2.2 Import and integrate workflow status in DemoViewerChatLogic
    - **File:** `src/panels/demoViewerChatLogic.ts`
    - Import `setWorkflowStatus` from chatStateUtils
    - Import `WorkflowStatus` type from chatPanel
    - Add helper method `updateWorkflowStatus(status: WorkflowStatus)` to update `_uiState`
  - [x] 2.3 Modify `handleNodeStopEvent` for partial detection
    - **File:** `src/panels/demoViewerChatLogic.ts`
    - After finalizing message and updating pipeline stage:
    - Check if stopped agent matches `_sessionState.entryAgentName`
    - Check if `_uiState.isWorkflowRunning === true` (workflow hasn't completed yet)
    - If BOTH conditions true, call `updateWorkflowStatus('partial')`
    - Detection is immediate (no timeout needed)
  - [x] 2.4 Modify `handleWorkflowCompleteEvent` to set complete status
    - **File:** `src/panels/demoViewerChatLogic.ts`
    - Call `updateWorkflowStatus('complete')` BEFORE setting `isWorkflowRunning = false`
    - This overrides any previous `'partial'` status
  - [x] 2.5 Modify `handleWorkflowErrorEvent` to set error status
    - **File:** `src/panels/demoViewerChatLogic.ts`
    - Call `updateWorkflowStatus('error')` in the error handling flow
    - Error is distinct from partial state
  - [x] 2.6 Modify `handleSendMessage` to reset status
    - **File:** `src/panels/demoViewerChatLogic.ts`
    - Call `updateWorkflowStatus('running')` when user sends follow-up message
    - This transitions `partial -> running` for new turns
    - Add after the line that sets `isWorkflowRunning: true`
  - [x] 2.7 Modify `handleNewConversation` to reset status
    - **File:** `src/panels/demoViewerChatLogic.ts`
    - Ensure `workflowStatus` resets to `'running'` via `createInitialUiState()`
    - No explicit call needed if using `createInitialUiState()` (already has default)
  - [x] 2.8 Ensure detection logic tests pass
    - Run ONLY the 3-4 tests written in 2.1
    - Verify state transitions work correctly

**Acceptance Criteria:**
- Entry agent `node_stop` while workflow running triggers `'partial'` status
- `workflow_complete` event sets status to `'complete'`
- `workflow_error` event sets status to `'error'`
- User follow-up message resets status to `'running'`
- New conversation resets all status

### UI Rendering Layer

#### Task Group 3: CSS and HTML Generation
**Dependencies:** Task Group 2

- [x] 3.0 Complete UI rendering layer
  - [x] 3.1 Write 2-3 focused tests for UI rendering
    - **File:** `src/test/utils/partialIndicatorHtml.test.ts`
    - Test `generatePartialIndicatorHtml()` returns correct HTML
    - Test `generateWorkflowStatusBadgeHtml()` returns correct icon per status
    - Test indicator only renders when `workflowStatus === 'partial'`
  - [x] 3.2 Add CSS styles for partial indicator
    - **File:** `src/panels/demoViewerChatStyles.ts`
    - Add `.partial-execution-indicator` class:
      - `text-align: left`
      - `font-size: 11px`
      - `font-style: italic`
      - `color: var(--vscode-descriptionForeground)`
      - `padding: 8px 4px`
    - Add `.ellipsis-animation` class with keyframes for animated "..." effect
  - [x] 3.3 Add CSS styles for workflow status badge
    - **File:** `src/panels/demoViewerChatStyles.ts`
    - Add `.workflow-status-badge` base class:
      - `display: inline-flex`
      - `align-items: center`
      - `gap: 4px`
      - `font-size: 11px`
    - Add `.workflow-status-badge.running` with spinner (reuse `spin` keyframes ~line 327)
    - Add `.workflow-status-badge.partial` with hourglass icon styling
    - Add `.workflow-status-badge.complete` with `color: var(--vscode-testing-iconPassed, #73c991)`
    - Add `.workflow-status-badge.error` with `color: var(--vscode-errorForeground, #f48771)`
  - [x] 3.4 Create `generatePartialIndicatorHtml()` function
    - **File:** `src/utils/chatPanelHtmlGenerator.ts`
    - Create function following existing generator patterns
    - Render `div.partial-execution-indicator` with text "Awaiting your response..."
    - Include animated ellipsis span
    - Use internal `escapeHtml()` if needed (already available in this file)
  - [x] 3.5 Create `generateWorkflowStatusBadgeHtml()` function
    - **File:** `src/utils/chatPanelHtmlGenerator.ts`
    - Accept `workflowStatus: WorkflowStatus` parameter
    - Render appropriate icon AND label based on status:
      - Running: CSS spinner + "Running"
      - Partial: Hourglass ⌛ (U+231B) + "Awaiting Input"
      - Complete: Checkmark ✓ (U+2713) + "Complete"
      - Error: X mark ✗ (U+2717) + "Error"
  - [x] 3.6 Modify `generateSessionInfoBarHtml()` to include status badge
    - **File:** `src/utils/chatPanelHtmlGenerator.ts`
    - Add `workflowStatus: WorkflowStatus` as 4th parameter (lines 44-67)
    - Add divider and status badge section after elapsed time
    - Call `generateWorkflowStatusBadgeHtml()` for badge content
  - [x] 3.7 Modify `generateConversationPaneHtml()` to render partial indicator
    - **File:** `src/utils/chatPanelHtmlGenerator.ts`
    - Add `workflowStatus: WorkflowStatus` parameter to function signature (lines 263-294)
    - After rendering messages, if `workflowStatus === 'partial'`:
      - Append `generatePartialIndicatorHtml()` output to the pane
  - [x] 3.8 Update `generateChatPanelHtml()` to pass workflowStatus
    - **File:** `src/utils/chatPanelHtmlGenerator.ts`
    - Pass `ui.workflowStatus` to `generateSessionInfoBarHtml()` (lines 357-400)
    - Pass `ui.workflowStatus` to `generateDualPaneContainerHtml()`
    - Update `generateDualPaneContainerHtml()` to accept and forward workflowStatus
  - [x] 3.9 Ensure UI rendering tests pass
    - Run ONLY the 2-3 tests written in 3.1
    - Verify HTML output is correct

**Acceptance Criteria:**
- Partial indicator renders below entry agent response when status is `'partial'`
- Status badge displays in session info bar with correct icon and label per status
- CSS styles match VS Code theme variables
- Animations work correctly (spinner, ellipsis)

### Testing

#### Task Group 4: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-3

- [x] 4.0 Review existing tests and fill critical gaps
  - [x] 4.1 Review tests from Task Groups 1-3
    - Review 3-4 tests from state layer (Task 1.1)
    - Review 3-4 tests from detection logic (Task 2.1)
    - Review 2-3 tests from UI rendering (Task 3.1)
    - Total existing tests: approximately 8-11 tests
  - [x] 4.2 Analyze test coverage gaps for this feature
    - **File:** `src/test/integration/partialExecutionFlow.test.ts`
    - Identify critical integration points lacking coverage
    - Focus on state machine transitions across components
    - Prioritize end-to-end detection -> render workflow
  - [x] 4.3 Write up to 5 additional tests if needed
    - Test full flow: node_stop -> partial status -> indicator renders
    - Test state override: partial -> complete when workflow_complete arrives (within same turn)
    - Test state machine: partial -> running when user sends follow-up
    - Test indicator clears on new conversation
  - [x] 4.4 Run feature-specific tests
    - Run all tests related to partial execution detection
    - Expected total: approximately 13-16 tests maximum
    - Verify all state transitions and rendering work correctly

**Acceptance Criteria:**
- All feature-specific tests pass
- State machine transitions covered
- UI rendering for all 4 status states verified
- Integration between detection and rendering confirmed

## Execution Order

Recommended implementation sequence:

1. **Type and State Layer (Task Group 1)** - Foundation types and state functions
2. **Detection Logic Layer (Task Group 2)** - Event handler modifications for detection
3. **UI Rendering Layer (Task Group 3)** - CSS styles and HTML generators
4. **Test Review (Task Group 4)** - Verify coverage and fill gaps

## Files Modified Summary

| File | Task Groups | Changes |
|------|-------------|---------|
| `src/types/chatPanel.ts` | 1 | Add `WorkflowStatus` type (exported), add field to `ChatUiState` |
| `src/utils/chatStateUtils.ts` | 1 | Add `setWorkflowStatus()`, update `createInitialUiState()` |
| `src/panels/demoViewerChatLogic.ts` | 2 | Detection in event handlers, status transitions, helper method |
| `src/panels/demoViewerChatStyles.ts` | 3 | CSS for indicator (`.partial-execution-indicator`) and status badge (`.workflow-status-badge`) |
| `src/utils/chatPanelHtmlGenerator.ts` | 3 | HTML generators for indicator and badge, update existing functions |
| `src/test/types/workflowStatus.test.ts` | 1, 4 | Type and state transition tests |
| `src/test/panels/partialDetection.test.ts` | 2, 4 | Detection logic tests |
| `src/test/utils/partialIndicatorHtml.test.ts` | 3, 4 | HTML generation tests |
| `src/test/integration/partialExecutionFlow.test.ts` | 4 | End-to-end integration tests |

## State Machine Reference

```
Initial State: 'running'

Optimistic Detection Transitions:
  running + user_sends_message            -> 'running' (start workflow)
  running + node_stop(entry_agent)        -> 'partial' (assume partial until proven complete)
  partial + workflow_complete             -> 'complete' (override - workflow finished)
  partial + workflow_error                -> 'error' (override - workflow failed)
  partial + user_sends_follow_up          -> 'running' (continue conversation)

Direct Completion Transitions:
  running + workflow_complete             -> 'complete'
  running + workflow_error                -> 'error'

Reset Transitions:
  any + new_conversation                  -> 'running' (full reset via createInitialUiState)

Note: The 'partial' state may be set briefly even for complete workflows,
because node_stop arrives before workflow_complete. This is by design -
the status badge update is imperceptible to users when workflow_complete
follows immediately.
```

## Out of Scope

Per Q&A decisions, these items are explicitly out of scope for this feature:
- Multiple concurrent partial workflows
- IDE restart recovery of partial state
- Timeout-based detection (we use immediate detection)
- Persisting partial state to DynamoDB
- Retry/resume functionality
- Agent Graph visual indication of partial state
