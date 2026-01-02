# Raw Idea: Partial Execution Detection

**Item 37: Partial Execution Detection**

Detect and handle "needs more info" workflow pauses:

**Detection Strategy (simplified by 35.1):**
- Entry agent identified from first `node_start` (per 35.1)
- Partial execution = entry agent's `node_stop` received WITHOUT subsequent `workflow_complete`
- This means: entry agent responded (asking for info) but workflow paused

**Behavior:**
- Partial: Entry agent response in LEFT pane, input enabled, "Awaiting your response..." indicator
- Complete: Final result shown, input enabled for new queries

**UI Indicators:**
- Partial: Subtle "..." or typing indicator in left pane after entry agent bubble
- Complete: Green checkmark or "Complete" badge

**Integration with Dual-Pane (35.1):**
- Partial execution naturally shows in LEFT pane (entry agent asking for info)
- RIGHT pane may show some internal processing before pause
- Follow-up continues the same session (item 38)

**Files:**
- `src/panels/demoViewerChatLogic.ts` — Partial execution detection in event handlers
- `src/utils/chatStateUtils.ts` — Partial state tracking

Size: S (Small)
