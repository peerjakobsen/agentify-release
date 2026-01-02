# Demo Viewer Chat UI - Raw Idea

**Feature:** Demo Viewer Chat UI (Item 35 from roadmap)

**Description:** Replace single prompt textarea with chat-style conversation in the Demo Viewer panel. This should reuse Ideation Wizard Step 2 patterns.

**Key Requirements from Roadmap:**
- UI Layout:
  - Message bubbles (user right-aligned, agent left-aligned)
  - Streaming response display during agent execution
  - Inline agent status: "Triage ✓ → Technical (pending)" (text-based before graph)
  - Session info bar: workflow_id, turn count, elapsed time
  - "New Conversation" button to reset session

- Reuse from Ideation Wizard:
  - Streaming token handling from Step 2 (`handleStreamingToken`)
  - Message bubble styling from Step 2 conversation UI
  - "Send" button pattern (no Enter shortcut)

- Files to modify:
  - `src/panels/demoViewerPanel.ts` — Replace prompt section with chat UI
  - New CSS in webview for message bubbles

- Size estimate: M (Medium)
