# Spec Requirements: Partial Execution Detection

## Initial Description
Detect and handle "needs more info" workflow pauses in the Demo Viewer chat UI. This feature builds on Item 35.1 (Dual-Pane Conversation UI) and supports Item 38 (Workflow Session Continuation) for multi-turn conversations.

The core detection strategy: Entry agent's `node_stop` received WITHOUT subsequent `workflow_complete` indicates a partial execution where the agent is awaiting user response.

## Requirements Discussion

### First Round Questions

**Q1:** I assume the detection happens when the entry agent's `node_stop` is received but no `workflow_complete` follows within a reasonable timeframe. What timeout should we use - are you thinking we immediately mark as "partial" after the entry agent's `node_stop` if no `workflow_complete` has arrived yet, or should we wait a brief period (e.g., 500ms-2s) to account for network latency before showing the partial indicator?

**Answer:** Immediate detection, no delay. When `node_stop` arrives for entry agent without `workflow_complete`, mark as partial immediately. State machine: `node_stop (entry agent)` -> Partial, `workflow_complete` -> Complete (overrides Partial). False positives are fine - just update state if `workflow_complete` arrives later.

**Q2:** If the entry agent asks multiple clarifying questions in sequence (e.g., asks for customer ID, then asks for date range), should each response be treated as a separate partial execution state, or do you want to track this as one ongoing "awaiting info" session until `workflow_complete`?

**Answer:** Single ongoing "awaiting info" session. Don't reset/re-trigger partial state for each clarifying response. Partial indicator persists until: user submits follow-up, `workflow_complete` arrives, or user clicks "New Conversation".

**Q3:** I'm thinking that when partial execution is detected, the RIGHT pane (Agent Collaboration) might show some internal agent activity that occurred before the pause. Should we visually distinguish this "paused" collaboration state differently from an active workflow, or just leave it as-is showing whatever agents ran?

**Answer:** Leave as-is, no special visual distinction. The partial indicator in left pane is the single source of truth for workflow state. Keep it simple.

**Q4:** The roadmap mentions "Subtle '...' or typing indicator in left pane after entry agent bubble." I'm assuming this should appear immediately below the entry agent's response bubble as a separate element (not inside the bubble). Should it persist until the user submits their follow-up, or should it auto-hide after a certain time?

**Answer:** Separate element below entry agent's response bubble. Style: Subtle, muted - "...awaiting your response" or animated "...". Position: Left-aligned, smaller font, italicized. Persistence: Stays until user action (NOT auto-hide). Example structure: `.partial-execution-indicator` div.

**Q5:** For the "Complete" state (green checkmark or badge), where should this appear - in the session info bar alongside workflow_id/elapsed time, next to the final agent response, or both?

**Answer:** Session info bar only. Add `workflowStatus: 'running' | 'partial' | 'complete' | 'error'` to session state. Status badges: Running (spinner), Partial (hourglass), Complete (checkmark green), Error (X red).

**Q6:** If the workflow errors out (e.g., `workflow_error` event), should that be treated as a failed partial execution, or as a distinct error state? Currently errors show an error message in the conversation pane.

**Answer:** Distinct states - don't conflate them. `workflow_error` -> Error state (red indicator). Entry agent stops without `workflow_complete` and no error -> Partial state.

**Q7:** Is there anything that should be explicitly OUT OF SCOPE for this feature?

**Answer:** Out of scope:
- Multiple concurrent partial workflows
- Storing partial state for recovery after IDE restart
- Timeout-based auto-detection
- Partial state in DynamoDB
- Retry/resume from partial
- Visual indication in Agent Graph

### Existing Code to Reference

No similar existing features identified for reference.

### Follow-up Questions

None required - answers were comprehensive.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A

## Requirements Summary

### Functional Requirements

**Detection Logic:**
- Entry agent identified from first `node_start` event (existing implementation in 35.1)
- Partial execution detected when: entry agent's `node_stop` received AND no `workflow_complete` yet
- Immediate detection - no timeout/delay needed
- State can transition: Running -> Partial -> Complete (if `workflow_complete` arrives later)
- `workflow_error` event triggers Error state (distinct from Partial)

**Workflow Status State Machine:**
```
Initial: 'running'
Transitions:
  running + node_stop(entry_agent) -> 'partial'
  running + workflow_complete -> 'complete'
  running + workflow_error -> 'error'
  partial + workflow_complete -> 'complete'
  partial + workflow_error -> 'error'
  partial + user_sends_message -> 'running' (new turn)
  partial + new_conversation -> reset to 'running'
```

**UI Indicators:**
1. **Partial Execution Indicator (Left Pane)**
   - Separate element below entry agent's response bubble
   - Text: "...awaiting your response" or animated "..."
   - Style: Left-aligned, smaller font, italicized, muted color
   - Visibility: Shows only when `workflowStatus === 'partial'`
   - Persistence: Stays until user submits follow-up, `workflow_complete` arrives, or "New Conversation"

2. **Session Info Bar Status Badge**
   - New field: `workflowStatus: 'running' | 'partial' | 'complete' | 'error'`
   - Badge displays:
     - Running: Spinner icon
     - Partial: Hourglass icon
     - Complete: Green checkmark icon
     - Error: Red X icon
   - Location: Session info bar (alongside workflow_id, turn count, elapsed time)

**State Clearing:**
- Partial indicator clears when:
  - User submits follow-up message (transitions to 'running')
  - `workflow_complete` event arrives (transitions to 'complete')
  - User clicks "New Conversation" (resets state)

### Reusability Opportunities

- Pipeline status bar already has status tracking patterns (pending/active/completed)
- Existing `ChatUiState.isWorkflowRunning` boolean can inform new `workflowStatus` design
- CSS styling patterns from existing message bubbles for indicator styling

### Scope Boundaries

**In Scope:**
- Detecting partial execution from event sequence (node_stop without workflow_complete)
- Adding `workflowStatus` field to session/UI state
- Showing partial indicator below entry agent response in left pane
- Showing status badge in session info bar
- Clearing indicator on user action or workflow_complete

**Out of Scope:**
- Multiple concurrent partial workflows
- Storing partial state for recovery after IDE restart
- Timeout-based auto-detection (using immediate detection instead)
- Partial state persistence in DynamoDB
- Retry/resume from partial state
- Visual indication in Agent Graph (Phase 4 feature)
- Special visual distinction in collaboration pane

### Technical Considerations

**Files to Modify:**
- `src/types/chatPanel.ts` - Add `workflowStatus` to `ChatSessionState` or `ChatUiState`
- `src/utils/chatStateUtils.ts` - Add status transition functions
- `src/panels/demoViewerChatLogic.ts` - Add detection logic in `handleNodeStopEvent`
- `src/panels/demoViewerChatStyles.ts` - Add partial indicator CSS
- `src/utils/chatPanelHtmlGenerator.ts` - Render partial indicator and status badge

**Event Handling Changes:**
- `handleNodeStopEvent`: Check if stopped agent is entry agent, set status to 'partial' if no workflow_complete
- `handleWorkflowCompleteEvent`: Set status to 'complete'
- `handleWorkflowErrorEvent`: Set status to 'error'
- `handleSendMessage`: Reset status to 'running' when user sends follow-up

**State Dependencies:**
- Requires `entryAgentName` from existing implementation (set on first node_start)
- Builds on dual-pane routing from Item 35.1
- Prepares for multi-turn sessions in Item 38
