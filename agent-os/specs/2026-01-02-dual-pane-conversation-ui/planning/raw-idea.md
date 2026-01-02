# Item 35.1: Dual-Pane Conversation UI

Split Demo Viewer chat into side-by-side panes for clearer conversation flow:

**Left Pane: Human ↔ Entry Agent**
- User messages (blue, right-aligned) labeled "Human"
- Entry agent responses only (gray, left-aligned)
- Entry agent identified from `get_entry_agent()` / first node_start

**Right Pane: Agent ↔ Agent Collaboration**
- Agent handoff prompts (blue, right-aligned) labeled with sending agent name
- Receiving agent responses (gray, left-aligned)
- Shows internal collaboration invisible to end users

**Event Changes:**
- Add `handoff_prompt` to `node_start` event (the prompt sent to agent)
- Add `from_agent` to `node_start` event (null for entry agent)

**Routing Logic:**
- Entry agent responses → Left pane (user-facing)
- All other agent responses → Right pane (internal)
- Agent-to-agent prompts visible in right pane

**Files to modify:**
- `src/types/chatPanel.ts`, `src/utils/chatStateUtils.ts`, `src/panels/demoViewerChatLogic.ts`
- `src/panels/demoViewerChatStyles.ts`, `src/utils/chatPanelHtmlGenerator.ts`
- `resources/agents/main_*.py` templates (add handoff_prompt, from_agent fields)

This is a Medium-sized feature that builds on the existing Item 35 (Demo Viewer Chat UI) to provide a clearer separation between user-facing conversation and internal agent collaboration.
