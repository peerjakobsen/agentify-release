# Raw Idea: Item 38 - Workflow Session Continuation

**Feature Description:**
Enable multi-turn conversations within same workflow session.

**Session State (builds on 35.1 dual-pane):**
- `WorkflowTriggerService` maintains: `{workflowId, sessionId, conversationTurns[]}`
- Each turn = `{userPrompt, entryAgentResponse, timestamp}`
- Internal agent collaboration (right pane) NOT included in conversation context
- DynamoDB events linked by same workflow_id across turns

**main.py Template Changes:**
- New `--conversation-context` arg: JSON array of human ↔ entry agent exchanges only
- Orchestrator builds combined prompt from conversation history
- Entry agent sees full conversation; internal agents see current context only

**Session Lifecycle:**
- Start: User sends first prompt → generate workflow_id/session_id
- Continue: User sends follow-up → same IDs, append to conversationTurns
- Complete: workflow_complete with no pending question OR user clicks "New Conversation"

**Integration with Dual-Pane UI:**
- Follow-up user messages appear in LEFT pane
- New agent collaboration appears in RIGHT pane (fresh per turn)
- Turn indicator shows: "Turn: 2" in session bar

**Files:**
- `src/services/workflowTriggerService.ts` — Session state management
- `src/utils/chatStateUtils.ts` — Turn tracking utilities
- `resources/agents/shared/orchestrator_utils.py` — Parse conversation context arg

**Size:** Large (L)
