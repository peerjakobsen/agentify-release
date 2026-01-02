# Spec Requirements: Demo Viewer Chat UI

## Initial Description
Replace single prompt textarea with chat-style conversation in the Demo Viewer panel. This should reuse Ideation Wizard Step 2 patterns.

Key requirements from the roadmap (Item 35):
- Message bubbles (user right-aligned, agent left-aligned)
- Streaming response display during agent execution
- Inline agent status: "Triage -> Technical (pending)" (text-based before graph)
- Session info bar: workflow_id, turn count, elapsed time
- "New Conversation" button to reset session
- Reuse streaming token handling and message bubble styling from Step 2
- Size estimate: Medium

## Requirements Discussion

### First Round Questions

**Q1:** The roadmap mentions "Streaming response display during agent execution" - should this stream agent output tokens as they arrive via stdout (similar to how Step 2 streams Claude responses), showing them in the agent's message bubble in real-time? Or should streaming work differently for workflow execution?
**Answer:** Stream agent output tokens via stdout (similar to Step 2). Listen to `node_stream` events from `StdoutEventParser.onEvent`. Display streaming tokens in the active agent's message bubble in real-time. Use the same `handleStreamingToken` pattern from Step 2 (`_streamingResponse += token`).

**Q2:** For the inline agent status display (e.g., "Triage -> Technical (pending)"), should this be shown as a status bar above the chat messages? Should it also show the currently active agent's streaming text, or should each agent's output appear as separate chat bubbles?
**Answer:** Both status bar above messages AND separate message bubbles per agent:
- Status bar above chat messages: Show agent pipeline progress (e.g., "Triage -> Technical (pending)"). Updated by `node_start`/`node_stop` stdout events.
- Separate chat bubbles per agent: Each agent's output appears as a distinct message bubble (left-aligned, gray) with the agent name label.
- When an agent is streaming, show tokens in that agent's bubble with a "typing" indicator.

**Q3:** Should the new chat UI replace the textarea entirely with a chat input at the bottom (like Step 2), or keep the input at the bottom but show conversation history above it?
**Answer:** Option (b) - Keep input at bottom with conversation history above:
- Top: Session info bar (workflow_id, turn count, elapsed time)
- Middle: Scrollable conversation history (user prompts right-aligned, agent responses left-aligned)
- Bottom: Text input + "Send" button

**Q4:** For message presentation, should user messages appear in blue bubbles (right-aligned) and agent responses in gray bubbles (left-aligned) with the agent name as a label?
**Answer:** Yes:
- User messages: Blue bubbles, right-aligned
- Agent responses: Gray bubbles, left-aligned, with agent name label above or inside the bubble
- For multi-agent workflows, each agent gets its own bubble sequence

**Q5:** The "Send" button pattern specifies no Enter shortcut. Should this match Step 2 exactly (Enter submits), or should Demo Viewer chat be button-only?
**Answer:** Button-only to prevent accidental workflow triggers during demos. Remove keydown handler for Enter in the chat input. Differs from Step 2 intentionally for demo safety.

**Q6:** Should the "New Conversation" button clear the chat history AND generate a new workflow_id/session_id, or just clear the chat history visually?
**Answer:** Option (a) - Clear chat history AND generate new workflow_id/session_id:
- Clear visible chat history
- Generate new workflow_id and session_id
- Reset turn count to 0
- Clear any streaming state
- Keep the input panel visible

**Q7:** What should be EXCLUDED from this initial implementation?
**Answer:** Exclusions for Item 35:
- EXCLUDE: Conversation history persistence across IDE restarts
- EXCLUDE: Editing/deleting previous messages
- EXCLUDE: Multi-turn session continuation (that's Item 36)
- EXCLUDE: `--conversation-context` arg (requires Item 36)
- EXCLUDE: Partial execution detection (that's Item 37)

INCLUDE in Item 35:
- Chat UI layout with message bubbles
- Streaming token display
- Agent status bar (text-based)
- Session info bar (workflow_id, turn count=1, elapsed time)
- "New Conversation" button
- Single-turn execution (each prompt is independent until Item 36)

### Existing Code to Reference

**Similar Features Identified:**
- Feature: Step 2 Chat Conversation UI - Path: `src/panels/tabbedPanel.ts`
  - Chat container and message bubble patterns (lines 363-500 in ideationStyles.ts)
  - `postStreamingToken()` method for real-time token display
  - State sync pattern via `handleStateSync()`
- Feature: Step 2 Logic Handler - Path: `src/panels/ideationStep2Logic.ts`
  - `handleStreamingToken()` pattern (`_streamingResponse += token`)
  - `handleStreamingComplete()` for finalizing messages
  - Conversation history management (`conversationHistory` array)
- Feature: Workflow Trigger Service - Path: `src/services/workflowTriggerService.ts`
  - `onStdoutLine` event for receiving raw stdout data
  - `onProcessStateChange` for tracking workflow state
  - `start()` method that returns `{workflowId, traceId}`
- Feature: Stdout Event Parser - Path: `src/services/stdoutEventParser.ts`
  - `onEvent` for typed stdout events (`node_start`, `node_stream`, `node_stop`)
  - Event schema validation
- Feature: Demo Viewer Panel - Path: `src/panels/demoViewerPanel.ts`
  - Existing execution log and outcome panel patterns
  - Timer/elapsed time display
  - Current prompt input and Run Workflow button (to be replaced)
- Feature: Ideation Styles - Path: `src/panels/ideationStyles.ts`
  - Chat message CSS (`.chat-container`, `.chat-message`, `.message-text`)
  - Streaming indicator (`.typing-indicator`, `.streaming-text`)
  - Message bubble styling (`.claude-message`, `.user-message`)

### Follow-up Questions
No follow-up questions needed. All requirements were clearly defined.

## Visual Assets

### Files Provided:
No image files provided in the visuals folder.

### ASCII Mockup Provided:
```
+-------------------------------------------------------------+
|  Session: wf-a1b2c3d4 | Turn: 1 | Elapsed: 0:04             |
+-------------------------------------------------------------+
|  Status: Triage -> Technical (pending) -> Output            |
+-------------------------------------------------------------+
|                                                             |
|  +----------------------------------------------+  <- User  |
|  | Analyze the Q3 inventory for anomalies       |           |
|  +----------------------------------------------+           |
|                                                             |
|  + Triage Agent -------------------------------------+      |
|  | Routing to Technical Analysis team based on       |      |
|  | request type: inventory data analysis.            |      |
|  +---------------------------------------------------+      |
|                                                             |
|  + Technical Agent ----------------------------------+      |
|  | Analyzing Q3 inventory data...                    | live |
|  | |                                                 | stream
|  +---------------------------------------------------+      |
|                                                             |
+-------------------------------------------------------------+
|  +---------------------------------------------+ [Send]     |
|  | Enter your prompt...                        |            |
|  +---------------------------------------------+            |
|                                       [New Conversation]    |
+-------------------------------------------------------------+
```

### Visual Insights:
- Three-tier layout: session info bar -> status bar -> chat area -> input area
- Session info bar shows: workflow_id (short format), turn count, elapsed time
- Status bar shows pipeline progress with checkmarks and pending indicators
- User messages right-aligned in contained bubbles
- Agent messages left-aligned with agent name as header
- Streaming indicator (cursor block) shown in active agent bubble
- Input area at bottom with Send button inline, New Conversation button below
- Fidelity level: ASCII wireframe (layout guide, not exact design)

## Requirements Summary

### Functional Requirements
- Replace current single textarea + "Run Workflow" button with chat-style interface
- Display user prompts as right-aligned blue message bubbles
- Display agent responses as left-aligned gray message bubbles with agent name labels
- Stream agent output tokens in real-time to the active agent's message bubble
- Show typing indicator while agent is streaming
- Display session info bar with workflow_id, turn count (always 1 for this phase), and elapsed time
- Display agent status bar showing pipeline progress (e.g., "Triage -> Technical (pending)")
- Update status bar based on `node_start`/`node_stop` stdout events
- Provide "Send" button for submitting prompts (button-only, no Enter key shortcut)
- Provide "New Conversation" button that resets chat history and generates new IDs
- Each workflow run is independent (single-turn execution)

### Technical Requirements
- Subscribe to `StdoutEventParser.onEvent` for `node_stream`, `node_start`, `node_stop` events
- Use `_streamingResponse += token` pattern from Step 2 for accumulating streaming text
- Maintain conversation history array in component state (not persisted)
- Generate new workflow_id/session_id on "New Conversation" click
- Reuse CSS patterns from `ideationStyles.ts` for message bubbles
- Integrate with existing `WorkflowTriggerService` for workflow execution

### Reusability Opportunities
- Chat container CSS from Step 2 (`.chat-container`, `.chat-messages`)
- Message bubble styling (`.chat-message`, `.claude-message`, `.user-message`)
- Streaming text display (`.streaming-text`, `.typing-indicator`)
- Token handling pattern (`handleStreamingToken`, `postStreamingToken`)
- Timer display utilities from existing Demo Viewer (`formatTime`)

### Scope Boundaries
**In Scope:**
- Chat UI layout with message bubbles
- Streaming token display from agent execution
- Agent status bar (text-based pipeline progress)
- Session info bar (workflow_id, turn count, elapsed time)
- "New Conversation" button with full reset
- Single-turn execution (each prompt independent)
- CSS styling reused from Ideation Wizard Step 2

**Out of Scope:**
- Conversation history persistence across IDE restarts
- Editing or deleting previous messages
- Multi-turn session continuation (Item 36)
- `--conversation-context` CLI argument (Item 36)
- Partial execution detection (Item 37)
- Agent graph visualization (Phase 4, Items 25-26)

### Technical Considerations
- Must integrate with existing `WorkflowTriggerService` and `StdoutEventParser`
- Event types to handle: `node_start`, `node_stream`, `node_stop`, `workflow_complete`, `workflow_error`
- Status bar updates derived from stdout events, not DynamoDB polling
- Button-only submission (no Enter key) differs intentionally from Step 2 for demo safety
- Timer continues from existing implementation, shown in session info bar
- Turn count will always be 1 until Item 36 implements multi-turn support
