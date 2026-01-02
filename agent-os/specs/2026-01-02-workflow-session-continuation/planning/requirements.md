# Spec Requirements: Workflow Session Continuation (Item 38)

## Initial Description
Enable multi-turn conversations within the same workflow session for the Agentify Demo Viewer. This builds on Item 35.1 (Dual-Pane Conversation UI) and Item 37 (Partial Execution Detection) to allow users to continue conversations with agents across multiple turns.

## Requirements Discussion

### First Round Questions

**Q1:** I assume a "session" maintains the same `workflowId` across all conversation turns, meaning follow-up prompts reuse the existing workflow ID rather than generating a new one. Is that correct, or should each turn generate a new `workflowId` while sharing a `sessionId`?
**Answer:** Same workflowId across all turns. The workflow represents the entire conversation session, not individual turns. Rationale: DynamoDB events accumulate under one partition key (queryable as a complete conversation), Demo Viewer shows one continuous workflow execution, Trace ID correlation in X-Ray spans the whole session, simpler than managing separate workflow_id + session_id concepts. The turn_number field handles turn-level filtering.

**Q2:** I'm thinking the conversation context passed to main.py should only include the human messages and entry agent responses (left pane content), excluding internal agent collaboration (right pane). Should the context format be a simple JSON array, or do you need additional metadata per turn?
**Answer:** Simple array with role and content, plus entry agent name at top level:
```json
{
  "entry_agent": "triage_agent",
  "turns": [
    {"role": "human", "content": "I need help with my order"},
    {"role": "entry_agent", "content": "I'd be happy to help. What's your order number?"},
    {"role": "human", "content": "ORD-12345"}
  ]
}
```
Entry agent name at top level so orchestrator knows which agent to route to. No timestamps needed - order implies sequence.

**Q3:** I assume the Agent Collaboration pane (right pane) should clear its content when a follow-up is sent, showing fresh collaboration for each turn rather than accumulating all historical collaboration. Is that correct?
**Answer:** Yes, clear the right pane when a follow-up is sent. Each turn gets fresh collaboration. Reasons: Internal collaboration from turn 1 isn't relevant to turn 2's processing, accumulating would create visual noise, the left pane already shows conversation continuity. The right pane always reflects "what's happening now" for the current turn.

**Q4:** I'm assuming "New Conversation" button should: (a) generate fresh workflowId, (b) clear all messages from both panes, (c) reset the turnCount to 0. Is that correct?
**Answer:** Complete reset: Generate fresh workflowId (new wf-xxx), clear both panes completely, reset turnCount to 0, clear conversationTurns[] array, entry agent re-identified from first node_start of new conversation. No context preserved - it's a genuinely new conversation.

**Q5:** The roadmap mentions a new `--conversation-context` CLI argument. I assume this is an optional argument (first turn has empty context), and the orchestrator will prepend the conversation history to the prompt before sending to the entry agent. Is that correct?
**Answer:** Separate arguments - prompt and context distinct:
```bash
python main.py \
  --prompt "ORD-12345" \
  --workflow-id "wf-abc123" \
  --trace-id "80e1afed..." \
  --conversation-context '{"entry_agent": "triage_agent", "turns": [...]}'
```
- `--prompt`: Current user message (what they just typed)
- `--conversation-context`: History (empty/omitted on turn 1)

The orchestrator is responsible for combining them appropriately. Extension passes both separately. Turn 1 behavior: --conversation-context omitted entirely (argparse default to None or empty string).

**Q6:** I assume all DynamoDB events across multiple turns should remain queryable by the same workflowId. Should we add a turn_number field to events for easier filtering?
**Answer:** Yes, add turn_number to all stdout events:
```json
{
  "workflow_id": "wf-abc123",
  "trace_id": "80e1afed...",
  "timestamp": 1234567890,
  "turn_number": 2,
  "event_type": "node_start",
  "payload": {...}
}
```
Benefits: Session bar can show "Turn: 2", Demo Viewer could filter by turn (future enhancement), debugging - "which turn caused this error?". The extension passes --turn-number as an additional CLI arg. First turn = 1.

**Q7:** Are there any behaviors you explicitly want excluded from this spec?
**Answer:** Explicitly out of scope for Item 38:
- Session persistence across IDE restarts (demos are ephemeral)
- Automatic session timeout/expiry (user controls via "New Conversation")
- Conversation forking (no clear demo use case)
- AgentCore Memory integration (separate future roadmap item)
- Maximum turn limit enforcement (let it run; demos are short-lived)
- Undo/rollback to previous turn (too complex for MVP)

### Existing Code to Reference

**Similar Features Identified:**
- Feature: BedrockConversationService - Path: `src/services/bedrockConversationService.ts`
  - Manages multi-turn conversation history for Ideation Wizard Step 2
  - Pattern for maintaining conversation state across interactions
- Feature: chatStateUtils turnCount - Path: `src/utils/chatStateUtils.ts`
  - Already has `turnCount` field in ChatSessionState
  - Foundation for turn tracking infrastructure
- Feature: Entry agent response capture - Path: `src/panels/demoViewerChatLogic.ts`
  - `handleNodeStopEvent` already captures entry agent responses via `response` field
  - This can be used to build conversation context

### Follow-up Questions
None needed - answers were comprehensive.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A

## Requirements Summary

### Functional Requirements

**Session State Management:**
- Maintain same `workflowId` across all conversation turns within a session
- Track `turnCount` starting at 1 for the first turn
- Store `conversationTurns[]` array containing human and entry agent exchanges
- Entry agent identified from first `node_start` event (per Item 37)

**Conversation Context Format:**
```json
{
  "entry_agent": "agent_id",
  "turns": [
    {"role": "human", "content": "..."},
    {"role": "entry_agent", "content": "..."}
  ]
}
```

**CLI Contract Changes:**
- New `--conversation-context` argument (optional, omitted on turn 1)
- New `--turn-number` argument (required, starts at 1)
- Full CLI signature for turn 2+:
  ```bash
  python main.py \
    --prompt "current message" \
    --workflow-id "wf-abc123" \
    --trace-id "80e1afed..." \
    --turn-number 2 \
    --conversation-context '{"entry_agent":"...","turns":[...]}'
  ```

**Event Schema Updates:**
- Add `turn_number` field to all stdout events (graph_structure, node_start, node_stop, workflow_complete, workflow_error)

**UI Behavior:**
- Left pane (conversation): Accumulates messages across turns (continuous conversation history)
- Right pane (collaboration): Clears when follow-up is sent (fresh collaboration per turn)
- Session bar: Shows "Turn: N" indicator
- Input: Re-enabled after each turn completes or reaches partial state

**New Conversation Reset:**
- Generate fresh `workflowId`
- Clear both panes completely
- Reset `turnCount` to 0
- Clear `conversationTurns[]` array
- Entry agent re-identified from new workflow's first `node_start`

### Reusability Opportunities
- `BedrockConversationService` pattern for conversation history management
- Existing `turnCount` field in `ChatSessionState`
- Entry agent response capture in `handleNodeStopEvent`
- `orchestrator_utils.py` argument parsing pattern for new CLI args

### Scope Boundaries

**In Scope:**
- Session state management in WorkflowTriggerService
- Conversation context passing via new CLI arguments
- Turn number tracking in events and UI
- Right pane clearing on follow-up
- Left pane message accumulation
- Python orchestrator template updates for --conversation-context and --turn-number
- orchestrator_utils.py updates for new argument parsing

**Out of Scope:**
- Session persistence across IDE restarts
- Automatic session timeout/expiry
- Conversation forking
- AgentCore Memory integration
- Maximum turn limit enforcement
- Undo/rollback to previous turn

### Technical Considerations

**Files to Modify:**
- `src/services/workflowTriggerService.ts` - Add session state management, conversation context building
- `src/utils/chatStateUtils.ts` - Add conversationTurns[] management, turn tracking utilities
- `src/panels/demoViewerChatLogic.ts` - Handle follow-up sends, right pane clearing, turn increment
- `src/types/chatPanel.ts` - Add ConversationTurn type, extend ChatSessionState
- `resources/agents/shared/orchestrator_utils.py` - Add --conversation-context and --turn-number argument parsing
- `resources/agents/main_graph.py` - Handle conversation context in orchestration
- `resources/agents/main_swarm.py` - Handle conversation context in orchestration
- `resources/agents/main_workflow.py` - Handle conversation context in orchestration

**Integration Points:**
- Item 35.1 (Dual-Pane UI): Message routing to correct panes
- Item 37 (Partial Execution Detection): Entry agent identification, partial state triggers continuation

**Key Implementation Details:**
- Conversation context built from left pane messages only (human + entry agent)
- Entry agent response captured from `node_stop` event's `response` field
- Same `workflowId` and `traceId` reused across turns for correlation
- Extension passes turn_number, orchestrator includes in all events
