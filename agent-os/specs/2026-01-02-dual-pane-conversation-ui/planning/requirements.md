# Spec Requirements: Dual-Pane Conversation UI

## Initial Description

Split Demo Viewer chat into side-by-side panes for clearer conversation flow:

**Left Pane: Human <-> Entry Agent**
- User messages (blue, right-aligned) labeled "Human"
- Entry agent responses only (gray, left-aligned)
- Entry agent identified from `get_entry_agent()` / first node_start

**Right Pane: Agent <-> Agent Collaboration**
- Agent handoff prompts (blue, right-aligned) labeled with sending agent name
- Receiving agent responses (gray, left-aligned)
- Shows internal collaboration invisible to end users

**Event Changes:**
- Add `handoff_prompt` to `node_start` event (the prompt sent to agent)
- Add `from_agent` to `node_start` event (null for entry agent)

**Routing Logic:**
- Entry agent responses -> Left pane (user-facing)
- All other agent responses -> Right pane (internal)
- Agent-to-agent prompts visible in right pane

**Files to modify:**
- `src/types/chatPanel.ts`, `src/utils/chatStateUtils.ts`, `src/panels/demoViewerChatLogic.ts`
- `src/panels/demoViewerChatStyles.ts`, `src/utils/chatPanelHtmlGenerator.ts`
- `resources/agents/main_*.py` templates (add handoff_prompt, from_agent fields)

This is a Medium-sized feature that builds on the existing Item 35 (Demo Viewer Chat UI) to provide a clearer separation between user-facing conversation and internal agent collaboration.

## Requirements Discussion

### First Round Questions

**Q1:** I assume the "entry agent" should be identified from the first `node_start` event received (the agent that receives the user's prompt). Is that correct, or should we also support explicit `get_entry_agent()` configuration in `.agentify/config.json`?
**Answer:** Use the first `node_start` event received. No need for config - the first agent to start is definitionally the entry agent. Keep it simple. Future enhancement if needed for complex graph patterns.

**Q2:** I'm thinking a 50/50 horizontal split between the two panes would work well, with a header label above each pane ("Human <-> Entry Agent" and "Agent Collaboration"). Should the panes be resizable, or is a fixed 50/50 split sufficient for demo purposes?
**Answer:** Fixed 50/50 split is sufficient. Headers should be:
- Left: "Conversation" (cleaner than "Human <-> Entry Agent")
- Right: "Agent Collaboration"

**Q3:** I assume both panes should have independent scroll containers so users can scroll through long conversations in either pane separately. Is that correct?
**Answer:** Yes, each pane needs its own scroll container. Left pane typically shorter than right pane.

**Q4:** For the left pane, I assume user messages should be labeled "Human" (not "You" or the user's name). Is that correct?
**Answer:** Use "You" for user messages in left pane (more natural in chat UI). For entry agent responses, use the actual agent name (e.g., "Triage Agent", "Coordinator").

**Q5:** For the right pane, when Agent A hands off to Agent B, I'm assuming we show the handoff prompt as a message from Agent A (blue, right-aligned) and Agent B's response as left-aligned. Should we also show any explicit "Handing off to Agent B..." indicator, or just let the message labels convey the flow?
**Answer:** No explicit "Handing off to..." indicator needed. The message labels convey the flow naturally:
- Right pane: sender (blue, right-aligned) -> receiver (gray, left-aligned)
- Visual pattern is self-explanatory

**Q6:** What should happen when there's only a single agent (no agent-to-agent collaboration)? I assume the right pane should show an empty state like "No agent collaboration in this workflow" rather than being hidden entirely. Is that correct?
**Answer:** Show empty state, don't hide the pane: "No agent collaboration in this workflow". Maintains UI consistency and educates users.

**Q7:** The raw idea mentions adding `handoff_prompt` and `from_agent` to `node_start` events. I assume:
- `from_agent: null` indicates entry agent (receives user prompt)
- `from_agent: "AgentName"` indicates which agent handed off
- `handoff_prompt: string` contains the prompt text sent to this agent

Is this understanding correct, or do you have a different schema in mind?
**Answer:** Confirmed as proposed. Updated NodeStartEvent:
```typescript
export interface NodeStartEvent extends BaseEvent {
  type: 'node_start';
  node_id: string;
  /** Agent that triggered this node (null for entry agent receiving user prompt) */
  from_agent: string | null;
  /** Prompt/instruction sent to this agent */
  handoff_prompt: string;
}
```

**Q8:** Is there anything that should explicitly NOT be included in this feature (e.g., no visual graph integration yet, no changes to DynamoDB events, etc.)?
**Answer:** Explicitly NOT included:
- No visual graph integration (Phase 4, Item 25)
- No DynamoDB schema changes - stdout events only
- No changes to Execution Log panel
- No changes to Outcome Panel
- No multi-turn session continuation (Item 38)
- No partial execution detection (Item 37)

Focus is purely on:
- Splitting the chat area into two panes
- Routing messages to correct pane based on from_agent
- Updating event types with new fields
- Updating bundled main.py templates to emit the new fields

### Existing Code to Reference

**Similar Features Identified:**
- Feature: Demo Viewer Chat UI (Item 35) - Path: `src/panels/demoViewerChatLogic.ts`, `src/panels/demoViewerChatStyles.ts`, `src/utils/chatPanelHtmlGenerator.ts`
- Components to potentially reuse: Message bubble styling, streaming token handling, session info bar
- Backend logic to reference: `src/types/events.ts` for event type definitions, `src/types/chatPanel.ts` for chat state types

No similar dual-pane patterns identified in the existing codebase - this is a new layout pattern.

### Follow-up Questions

No follow-up questions needed - answers were comprehensive.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
- ASCII diagrams in the answers serve as sufficient guidance
- Fixed 50/50 horizontal split layout
- Left pane: "Conversation" header
- Right pane: "Agent Collaboration" header
- Fidelity level: Conceptual/text-based specification

## Requirements Summary

### Functional Requirements

**Dual-Pane Layout:**
- Split the existing single chat container into two side-by-side panes
- Fixed 50/50 horizontal split (not resizable)
- Each pane has its own header label and independent scroll container
- Left pane header: "Conversation"
- Right pane header: "Agent Collaboration"

**Left Pane (User-Facing Conversation):**
- User messages: labeled "You", blue background, right-aligned
- Entry agent responses: labeled with actual agent name, gray background, left-aligned
- Entry agent = first agent to receive `node_start` event
- Shows only the human-to-entry-agent conversation

**Right Pane (Agent Collaboration):**
- Sending agent prompts (handoffs): labeled with sender agent name, blue background, right-aligned
- Receiving agent responses: labeled with receiver agent name, gray background, left-aligned
- Shows all agent-to-agent interactions
- Empty state: "No agent collaboration in this workflow" when single-agent workflow

**Message Routing Logic:**
- `from_agent === null` -> Entry agent, response goes to LEFT pane
- `from_agent !== null` -> Internal agent, handoff prompt and response go to RIGHT pane
- User messages always go to LEFT pane

**Event Schema Updates:**
- Add `from_agent: string | null` to `NodeStartEvent`
- Add `handoff_prompt: string` to `NodeStartEvent`
- No changes to DynamoDB events - stdout events only

**Python Template Updates:**
- Update `resources/agents/main_*.py` templates to emit new fields
- Entry agent: `from_agent: null`, `handoff_prompt: <user prompt>`
- Subsequent agents: `from_agent: <sender name>`, `handoff_prompt: <handoff instruction>`

### Reusability Opportunities

- Reuse existing message bubble styling from `demoViewerChatStyles.ts`
- Reuse streaming token handling from `chatStateUtils.ts`
- Reuse HTML generation patterns from `chatPanelHtmlGenerator.ts`
- Extend `ChatSessionState` to track messages per pane

### Scope Boundaries

**In Scope:**
- Splitting chat area into two panes with headers
- Independent scroll containers per pane
- Message routing based on `from_agent` field
- Entry agent identification from first `node_start`
- Updating `NodeStartEvent` type with new fields
- Updating bundled Python templates to emit new fields
- Empty state for right pane when no collaboration
- "You" label for user messages, agent names for agent messages

**Out of Scope:**
- Visual graph integration (Phase 4, Item 25)
- DynamoDB schema changes
- Changes to Execution Log panel
- Changes to Outcome Panel
- Multi-turn session continuation (Item 38)
- Partial execution detection (Item 37)
- Resizable pane widths
- Config-based entry agent specification

### Technical Considerations

**Files to Modify:**
- `src/types/events.ts` - Add `from_agent` and `handoff_prompt` to `NodeStartEvent`
- `src/types/chatPanel.ts` - Extend state types for dual-pane messages
- `src/utils/chatStateUtils.ts` - Add pane routing utilities
- `src/panels/demoViewerChatLogic.ts` - Update event handlers for pane routing
- `src/panels/demoViewerChatStyles.ts` - Add dual-pane layout CSS
- `src/utils/chatPanelHtmlGenerator.ts` - Generate dual-pane HTML structure
- `resources/agents/main_*.py` - Update orchestrator templates

**State Management:**
- Track `entryAgentName` (set from first `node_start`)
- Separate message arrays or routing flag per message for pane assignment
- Maintain independent streaming state per pane if needed

**Event Flow:**
1. User sends message -> Add to left pane
2. First `node_start` received -> Set as entry agent, route to left pane
3. Entry agent `node_stop` with response -> Add to left pane
4. Subsequent `node_start` with `from_agent` -> Add handoff to right pane
5. Subsequent `node_stop` with response -> Add to right pane
