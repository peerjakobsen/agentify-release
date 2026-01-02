# Specification: Dual-Pane Conversation UI

## Goal

Split the Demo Viewer chat interface into two side-by-side panes to clearly separate user-facing conversation (Human <-> Entry Agent) from internal agent collaboration (Agent <-> Agent handoffs), providing better visibility into multi-agent workflow dynamics.

## User Stories

- As a developer, I want to see my conversation with the entry agent separately from internal agent collaboration so I can understand what the end user would see versus what happens behind the scenes
- As a demo viewer, I want to observe agent-to-agent handoff prompts so I can understand how agents communicate and route work internally

## Specific Requirements

**Dual-Pane Layout Structure**
- Split existing single `.chat-container` into two side-by-side panes with fixed 50/50 horizontal split
- Each pane has its own header label: Left pane "Conversation", Right pane "Agent Collaboration"
- Each pane has its own independent scroll container for separate scrolling
- Panes are not resizable - fixed width split is sufficient for demo purposes
- Layout uses CSS flexbox with `flex: 1` for equal width distribution

**Left Pane: User-Facing Conversation**
- User messages labeled "You", blue background, right-aligned (existing styling)
- Entry agent responses labeled with actual agent name, gray background, left-aligned
- Entry agent identified from first `node_start` event received (first agent to start is the entry agent)
- Only shows messages where `from_agent === null` (entry agent) and user messages
- Reuse existing message bubble styling from `demoViewerChatStyles.ts`

**Right Pane: Agent Collaboration**
- Handoff prompts displayed as sender message: blue background, right-aligned, labeled with sending agent name
- Receiving agent responses: gray background, left-aligned, labeled with receiver agent name
- Shows all interactions where `from_agent !== null` (non-entry agents)
- Empty state when no agent collaboration: "No agent collaboration in this workflow"
- Empty state maintains UI consistency and educates users about multi-agent patterns

**Event Schema Updates**
- Add `from_agent: string | null` to `NodeStartEvent` - identifies which agent triggered this node (null for entry agent)
- Add `handoff_prompt: string` to `NodeStartEvent` - contains the prompt/instruction sent to this agent
- For entry agent: `from_agent: null`, `handoff_prompt` contains user's original prompt
- For subsequent agents: `from_agent` is sender agent name, `handoff_prompt` is the enhanced prompt
- Update type guards in `events.ts` if needed for the new fields

**Message Routing Logic**
- Track `entryAgentName` in state - set from first `node_start` event received
- User messages always route to LEFT pane
- Messages with `from_agent === null` route to LEFT pane (entry agent responses)
- Messages with `from_agent !== null` route to RIGHT pane (internal agent collaboration)
- Add handoff prompt as "sender message" in right pane when `node_start` received with `from_agent !== null`
- Add agent response to same pane when corresponding `node_stop` received

**State Management Updates**
- Add `entryAgentName: string | null` to `ChatSessionState` to track identified entry agent
- Add `pane: 'conversation' | 'collaboration'` field to `ChatMessage` for routing
- Update `addAgentMessage()` to accept pane parameter based on `from_agent` value
- Maintain separate streaming state tracking per pane if needed
- First `node_start` sets `entryAgentName` and message routes to conversation pane

**Python Template Updates**
- Update `resources/agents/main_graph.py`, `main_swarm.py`, `main_workflow.py` to emit new fields
- Entry agent `node_start`: `from_agent: null`, `handoff_prompt: <original user prompt>`
- Subsequent agent `node_start`: `from_agent: <previous agent name>`, `handoff_prompt: <enhanced prompt>`
- Pass `current_prompt` variable as `handoff_prompt` in `emit_event()` calls
- Track `previous_agent_name` variable to populate `from_agent` field

## Existing Code to Leverage

**`src/panels/demoViewerChatStyles.ts` (lines 125-141)**
- `.chat-container` and `.chat-messages` CSS can be adapted for dual-pane layout
- Message bubble styling (`.chat-message`, `.user-message`, `.agent-message`) can be reused directly
- Streaming text and typing indicator styles remain unchanged

**`src/utils/chatPanelHtmlGenerator.ts` (lines 187-216)**
- `generateChatMessagesHtml()` pattern to replicate for each pane
- `generateMessageBubbleHtml()` function can be reused with pane-aware message filtering
- `escapeHtml()` utility function available for any new HTML generation

**`src/utils/chatStateUtils.ts` (lines 111-127)**
- `addAgentMessage()` function to extend with pane routing parameter
- `finalizeAgentMessage()` pattern to maintain for streaming completion
- State update patterns using spread operator to follow

**`src/panels/demoViewerChatLogic.ts` (lines 324-373)**
- `handleNodeStartEvent()` and `handleNodeStopEvent()` methods to modify for pane routing
- Event type extraction using `getEventType()` helper already handles Python field naming differences
- Callback pattern (`_callbacks.updateWebviewContent()`) to maintain for UI updates

**`resources/agents/main_graph.py` (lines 251-277)**
- `emit_event()` calls for `node_start` and `node_stop` events show current structure
- `current_prompt` variable already tracks the enhanced prompt to pass as `handoff_prompt`
- `agent_name` and `current_agent` variables available for `from_agent` tracking

## Out of Scope

- Visual graph integration with the conversation panes (Phase 4, Item 25)
- DynamoDB schema changes - only stdout events are modified
- Changes to Execution Log panel
- Changes to Outcome Panel result display
- Multi-turn session continuation (Item 38)
- Partial execution detection (Item 37)
- Resizable pane widths - fixed 50/50 split only
- Config-based entry agent specification - use first `node_start` only
- Synchronized scrolling between panes
- Collapsible panes or toggle to show/hide either pane
