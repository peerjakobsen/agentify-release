# Task Breakdown: Dual-Pane Conversation UI

## Overview

**Feature**: Split Demo Viewer chat into two side-by-side panes separating user-facing conversation from internal agent collaboration.

**Total Task Groups**: 6
**Estimated Complexity**: Medium

## Architecture Context

**Pane Layout:**
- Left pane ("Conversation"): User messages + Entry agent responses only
- Right pane ("Agent Collaboration"): Internal agent-to-agent handoffs and responses

**Message Alignment in Collaboration Pane:**
- Sender agent (from_agent) messages: right-aligned (blue, like user messages)
- Receiver agent responses: left-aligned (gray, like agent messages)

**Event Field Mapping:**
- Python templates emit `event_type` field (not `type`)
- TypeScript handler (`demoViewerChatLogic.ts`) already supports both via `getEventType()`

**Empty States:**
- Conversation pane: Shows input guidance when empty
- Collaboration pane: Shows "No agent collaboration in this workflow" when empty
- Always render dual-pane layout (no fallback to single-pane)

## Task List

### Foundation Layer

#### Task Group 1: Event Schema and Type Definitions
**Dependencies:** None
**Complexity:** Small
**Test File:** `src/test/types/chatPanel.test.ts`

- [x] 1.0 Complete event schema and type definitions
  - [x] 1.1 Write 4-6 focused tests for type changes in `src/test/types/chatPanel.test.ts`
    - Test `NodeStartEvent` includes `from_agent` and `handoff_prompt` fields
    - Test type guards handle new optional fields gracefully (existing `isNodeStartEvent()` unchanged)
    - Test `ChatMessage` pane routing field
    - Test `ChatSessionState` entry agent and active pane tracking
  - [x] 1.2 Update `NodeStartEvent` interface in `src/types/events.ts`
    - Add `from_agent: string | null` field with JSDoc comment
    - Add `handoff_prompt: string` field with JSDoc comment
    - Note: Entry agent has `from_agent: null`, subsequent agents have sender name
    - Note: Existing `isNodeStartEvent()` type guard remains unchanged (checks only event.type)
  - [x] 1.3 Extend `ChatMessage` interface in `src/types/chatPanel.ts`
    - Add `pane: 'conversation' | 'collaboration'` field for routing
    - Add JSDoc documenting pane assignment logic
  - [x] 1.4 Extend `ChatSessionState` interface in `src/types/chatPanel.ts`
    - Add `entryAgentName: string | null` to track first agent
    - Add `activeMessagePane: 'conversation' | 'collaboration' | null` to track which pane the streaming message belongs to
    - Add JSDoc explaining entry agent identification from first `node_start`
    - Add JSDoc explaining activeMessagePane usage for streaming content routing
  - [x] 1.5 Ensure type definition tests pass
    - Run ONLY the 4-6 tests written in 1.1
    - Verify TypeScript compilation succeeds
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- `NodeStartEvent` has `from_agent` and `handoff_prompt` fields
- `ChatMessage` has `pane` routing field
- `ChatSessionState` tracks `entryAgentName`
- TypeScript compilation succeeds with no errors
- Type guards work correctly with new fields

---

### UI Layer

#### Task Group 2: Dual-Pane CSS Styles
**Dependencies:** Task Group 1
**Complexity:** Small
**Test File:** `src/test/panels/demoViewerChatStyles.test.ts`

- [x] 2.0 Complete dual-pane CSS styles
  - [x] 2.1 Write 3-5 visual regression tests in `src/test/panels/demoViewerChatStyles.test.ts`
    - Test dual-pane container renders with 50/50 split
    - Test pane headers display correctly ("Conversation", "Agent Collaboration")
    - Test independent scroll containers work for each pane
    - Test empty state styling in collaboration pane
  - [x] 2.2 Add dual-pane container styles in `src/panels/demoViewerChatStyles.ts`
    - `.dual-pane-container` with flexbox, 50/50 split via `flex: 1`
    - `.pane-left` and `.pane-right` for individual pane containers
    - Pane border/separator between left and right panes
  - [x] 2.3 Add pane header styles
    - `.pane-header` with label text styling
    - Header colors matching VS Code theme variables
    - Font size 11px, uppercase, subtle visual separation
  - [x] 2.4 Add independent scroll container styles
    - `.pane-messages` with `overflow-y: auto`, `max-height: 350px`
    - Ensure each pane scrolls independently
    - Reuse existing `.chat-messages` padding and gap patterns
  - [x] 2.5 Add collaboration pane empty state styles
    - `.collaboration-empty-state` for "No agent collaboration" message
    - Center-aligned, muted text color, consistent with existing empty state
  - [x] 2.6 Ensure CSS tests pass
    - Run ONLY the 3-5 tests written in 2.1
    - Verify styles render correctly in webview
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- Dual-pane layout renders with equal width panes
- Headers display "Conversation" and "Agent Collaboration"
- Each pane scrolls independently
- Empty state displays correctly in collaboration pane
- Styles consistent with existing VS Code theme

---

#### Task Group 3: HTML Generation Updates
**Dependencies:** Task Groups 1, 2
**Complexity:** Medium
**Test File:** `src/test/utils/chatPanelHtmlGenerator.test.ts`

- [x] 3.0 Complete HTML generation for dual-pane layout
  - [x] 3.1 Write 4-6 focused tests in `src/test/utils/chatPanelHtmlGenerator.test.ts`
    - Test `generateDualPaneContainerHtml()` produces correct structure
    - Test `generateConversationPaneHtml()` filters messages correctly
    - Test `generateCollaborationPaneHtml()` filters messages correctly
    - Test empty state renders when no collaboration messages exist
    - Test message bubbles route to correct panes based on `pane` field
  - [x] 3.2 Create `generatePaneHeaderHtml()` function in `src/utils/chatPanelHtmlGenerator.ts`
    - Parameter: `label: string`
    - Returns header HTML with label text
    - Simple reusable function for both pane headers
  - [x] 3.3 Create `generateConversationPaneHtml()` function
    - Parameters: `messages: ChatMessage[]`, `streamingContent: string`, `activeAgentName: string | null`
    - Filter messages where `pane === 'conversation'`
    - Reuse `generateMessageBubbleHtml()` for message rendering
    - Include header "Conversation"
    - Return complete left pane HTML
  - [x] 3.4 Create `generateCollaborationPaneHtml()` function
    - Parameters: `messages: ChatMessage[]`, `streamingContent: string`, `activeAgentName: string | null`, `activeMessagePane: string | null`
    - Filter messages where `pane === 'collaboration'`
    - Return empty state HTML when no collaboration messages
    - Empty state text: "No agent collaboration in this workflow"
    - Include header "Agent Collaboration"
    - Message alignment: Sender (from_agent) right-aligned, receiver (current agent) left-aligned
    - Only show streaming content if `activeMessagePane === 'collaboration'`
    - Return complete right pane HTML
  - [x] 3.5 Create `generateDualPaneContainerHtml()` function
    - Parameters: same as existing `generateChatMessagesHtml()`
    - Calls `generateConversationPaneHtml()` for left pane
    - Calls `generateCollaborationPaneHtml()` for right pane
    - Wraps both in `.dual-pane-container` div
  - [x] 3.6 Update `generateChatPanelHtml()` to use dual-pane generator
    - Replace `generateChatMessagesHtml()` call with `generateDualPaneContainerHtml()`
    - Pass `activeMessagePane` from state for streaming content routing
    - Always render dual-pane layout (no fallback to single-pane)
    - Empty conversation pane shows input guidance
    - Empty collaboration pane shows "No agent collaboration" message
  - [x] 3.7 Ensure HTML generation tests pass
    - Run ONLY the 4-6 tests written in 3.1
    - Verify HTML structure is correct
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- Dual-pane HTML structure renders correctly
- Messages filter to correct panes based on `pane` field
- Empty state displays when no collaboration messages
- Existing message bubble styling preserved
- No regression in empty state or single message scenarios

---

### Logic Layer

#### Task Group 4: Message Routing and State Management
**Dependencies:** Task Groups 1, 2, 3
**Complexity:** Medium
**Test Files:** `src/test/utils/chatStateUtils.test.ts`, `src/test/panels/demoViewerChatLogic.test.ts`

- [x] 4.0 Complete message routing and state management
  - [x] 4.1 Write 5-7 focused tests in `src/test/utils/chatStateUtils.test.ts` and `src/test/panels/demoViewerChatLogic.test.ts`
    - Test first `node_start` sets `entryAgentName` in state
    - Test user messages always route to `pane: 'conversation'` (internal, no parameter)
    - Test messages with `from_agent === null` route to conversation pane
    - Test messages with `from_agent !== null` route to collaboration pane
    - Test handoff prompts appear as sender messages (right-aligned) in collaboration pane
    - Test agent responses appear correctly in their assigned panes
    - Test `activeMessagePane` is set correctly on node_start
  - [x] 4.2 Update `addAgentMessage()` in `src/utils/chatStateUtils.ts`
    - Add `pane: 'conversation' | 'collaboration'` parameter (required, no default)
    - Set `pane` field on created `ChatMessage` object
    - Set `activeMessagePane` in returned state to match the pane parameter
    - Note: `addUserMessage()` always sets `pane: 'conversation'` internally (no parameter needed)
  - [x] 4.3 Create `determineMessagePane()` helper function in `src/utils/chatStateUtils.ts`
    - Parameter: `fromAgent: string | null`
    - Returns `'conversation'` if `fromAgent === null`
    - Returns `'collaboration'` if `fromAgent !== null`
    - Simple utility for consistent pane determination
  - [x] 4.4 Create `addHandoffMessage()` function in `src/utils/chatStateUtils.ts`
    - Parameters: `state`, `senderAgentName: string`, `handoffPrompt: string`
    - Creates sender-style message for handoff prompt:
      - Right-aligned in collaboration pane (like user messages visually)
      - Labeled with sender agent name
      - `role: 'agent'` but with `isSender: true` flag for styling
    - Sets `pane: 'collaboration'`
    - Returns updated state with handoff message added
    - Note: Receiver agent's response will be left-aligned when it streams/completes
  - [x] 4.5 Update `handleNodeStartEvent()` in `src/panels/demoViewerChatLogic.ts`
    - Extract `from_agent` and `handoff_prompt` from event
    - If first `node_start` received: set `entryAgentName` in state
    - If `from_agent !== null`: add handoff message to collaboration pane using `addHandoffMessage()`
    - Determine pane using `determineMessagePane(from_agent)`
    - Pass pane to `addAgentMessage()` for streaming message
    - State's `activeMessagePane` will be set by `addAgentMessage()` for streaming content routing
  - [x] 4.6 Update `handleNodeStopEvent()` in `src/panels/demoViewerChatLogic.ts`
    - Finalize agent message to correct pane based on tracked state
    - Ensure streaming content routes to same pane as node_start
  - [x] 4.7 Update initial state creation for `entryAgentName` and `activeMessagePane`
    - Initialize `entryAgentName: null` in `createInitialChatState()`
    - Initialize `activeMessagePane: null` in `createInitialChatState()`
    - Ensure state reset clears both fields for new conversations
  - [x] 4.8 Ensure routing and state tests pass
    - Run ONLY the 5-7 tests written in 4.1
    - Verify message routing works correctly end-to-end
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- Entry agent correctly identified from first `node_start`
- User messages always appear in conversation pane
- Entry agent responses appear in conversation pane
- Internal agent handoffs and responses appear in collaboration pane
- Handoff prompts labeled with sender agent name
- State management correctly tracks entry agent and pane assignments

---

### Template Layer

#### Task Group 5: Python Template Updates
**Dependencies:** Task Group 1
**Complexity:** Medium
**Test File:** `src/test/resources/pythonTemplates.test.ts`

- [x] 5.0 Complete Python orchestrator template updates
  - [x] 5.1 Write 4-6 focused tests in `src/test/resources/pythonTemplates.test.ts`
    - Test entry agent emits `from_agent: null`, `handoff_prompt: <user prompt>`
    - Test subsequent agents emit `from_agent: <sender>`, `handoff_prompt: <enhanced prompt>`
    - Test event structure matches TypeScript `NodeStartEvent` interface
    - Test all three orchestrator patterns emit correct fields
  - [x] 5.2 Update `resources/agents/main_graph.py` node_start emission
    - Add `previous_agent_name` variable tracking (initialize to `None`)
    - Add `from_agent` field to `node_start` event: value is `previous_agent_name`
    - Add `handoff_prompt` field to `node_start` event: value is `current_prompt`
    - Update `previous_agent_name = agent_name` after each agent completes
    - Maintain existing event fields (`node_id`, `node_name`, `timestamp`, etc.)
    - Use `event_type` field (not `type`) for consistency with existing Python templates
  - [x] 5.3 Update `resources/agents/main_swarm.py` node_start emission
    - Add `previous_agent_name` variable tracking (initialize to `None`)
    - Add `from_agent` field to `node_start` event
    - Add `handoff_prompt` field to `node_start` event
    - Update `previous_agent_name` after each agent completes
    - Note: Swarm pattern may have different handoff semantics - align with existing patterns
  - [x] 5.4 Update `resources/agents/main_workflow.py` node_start emission
    - Add `previous_agent_name` variable tracking (initialize to `None`)
    - Add `from_agent` field to `node_start` event
    - Add `handoff_prompt` field to `node_start` event
    - Update `previous_agent_name` after each agent completes
    - Note: Workflow pattern is typically linear - simpler tracking
  - [x] 5.5 Verify Python template consistency
    - Ensure all three templates emit identical event structure for `node_start`
    - Verify field names match TypeScript interface exactly (snake_case)
    - Use `event_type` field (TypeScript handler's `getEventType()` already supports both)
    - Check `emit_event()` calls include new fields
  - [x] 5.6 Ensure Python template tests pass
    - Run ONLY the 4-6 tests written in 5.1
    - Verify event JSON structure is correct
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- All three Python templates emit `from_agent` and `handoff_prompt` in `node_start`
- Entry agent correctly emits `from_agent: null`
- Subsequent agents correctly emit `from_agent: <previous_agent_name>`
- `handoff_prompt` contains the prompt text sent to the agent
- Event structure consistent across all orchestrator patterns

---

### Integration

#### Task Group 6: Test Review and Integration Verification
**Dependencies:** Task Groups 1-5
**Complexity:** Small
**Test File:** `src/test/integration/dualPaneIntegration.test.ts`

- [x] 6.0 Review existing tests and verify end-to-end integration
  - [x] 6.1 Review tests from Task Groups 1-5
    - Review the 4-6 type tests in `src/test/types/chatPanel.test.ts`
    - Review the 3-5 CSS tests in `src/test/panels/demoViewerChatStyles.test.ts`
    - Review the 4-6 HTML generation tests in `src/test/utils/chatPanelHtmlGenerator.test.ts`
    - Review the 5-7 routing logic tests in `src/test/utils/chatStateUtils.test.ts` and `src/test/panels/demoViewerChatLogic.test.ts`
    - Review the 4-6 Python template tests in `src/test/resources/pythonTemplates.test.ts`
    - Total existing tests: approximately 20-30 tests
  - [x] 6.2 Analyze test coverage gaps for dual-pane feature
    - Identify critical end-to-end workflows lacking coverage
    - Focus on user journeys: single-agent workflow, multi-agent handoffs
    - Prioritize integration points between layers
  - [x] 6.3 Write up to 8 additional integration tests in `src/test/integration/dualPaneIntegration.test.ts`
    - Test complete flow: user message -> entry agent -> collaboration pane routing
    - Test single-agent scenario shows empty collaboration pane
    - Test multi-agent scenario shows handoffs in collaboration pane
    - Test streaming tokens appear in correct pane during execution (using `activeMessagePane`)
    - Test pane assignment persists after workflow completion
  - [x] 6.4 Run feature-specific tests only
    - Run tests from 1.1, 2.1, 3.1, 4.1, 5.1, and 6.3
    - Expected total: approximately 28-38 tests
    - Verify all dual-pane feature tests pass
    - Do NOT run entire application test suite
  - [x] 6.5 Manual integration verification
    - Start Demo Viewer with a multi-agent workflow
    - Verify conversation pane shows user + entry agent only
    - Verify collaboration pane shows agent handoffs
    - Verify empty state when running single-agent workflow

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 28-38 tests)
- End-to-end user workflows verified manually
- No regressions in existing Demo Viewer functionality
- Dual-pane layout displays correctly in VS Code webview

---

## Execution Order

**Recommended implementation sequence:**

1. **Task Group 1: Event Schema and Type Definitions** - Foundation for all other work
2. **Task Group 5: Python Template Updates** - Can run in parallel after Group 1 (no TypeScript dependencies)
3. **Task Group 2: Dual-Pane CSS Styles** - After Group 1 types
4. **Task Group 3: HTML Generation Updates** - After Groups 1, 2
5. **Task Group 4: Message Routing and State Management** - After Groups 1, 2, 3
6. **Task Group 6: Test Review and Integration** - After all implementation complete

**Parallel execution opportunity:**
- Task Groups 2, 3, 4 (TypeScript UI/Logic) can proceed in sequence after Group 1
- Task Group 5 (Python templates) can run in parallel with Groups 2, 3, 4

---

## Files Modified Summary

| File | Task Groups | Changes |
|------|-------------|---------|
| `src/types/events.ts` | 1 | Add `from_agent`, `handoff_prompt` to `NodeStartEvent` |
| `src/types/chatPanel.ts` | 1 | Add `pane` to `ChatMessage`, `entryAgentName` and `activeMessagePane` to `ChatSessionState` |
| `src/panels/demoViewerChatStyles.ts` | 2 | Add dual-pane CSS styles |
| `src/utils/chatPanelHtmlGenerator.ts` | 3 | Add dual-pane HTML generation functions |
| `src/utils/chatStateUtils.ts` | 4 | Add pane routing utilities, update `addAgentMessage()` |
| `src/panels/demoViewerChatLogic.ts` | 4 | Update event handlers for pane routing |
| `resources/agents/main_graph.py` | 5 | Emit `from_agent`, `handoff_prompt` in `node_start` |
| `resources/agents/main_swarm.py` | 5 | Emit `from_agent`, `handoff_prompt` in `node_start` |
| `resources/agents/main_workflow.py` | 5 | Emit `from_agent`, `handoff_prompt` in `node_start` |
| Test files (new) | 1-6 | See test file paths in each Task Group |

---

## Complexity Summary

| Task Group | Complexity | Estimated Sub-tasks | Key Risk |
|------------|------------|---------------------|----------|
| 1. Types & Events | Small | 5 | None - straightforward interface additions |
| 2. CSS Styles | Small | 6 | Flexbox layout in VS Code webview |
| 3. HTML Generation | Medium | 7 | Message filtering and pane assignment |
| 4. Routing & State | Medium | 8 | Entry agent identification, activeMessagePane tracking |
| 5. Python Templates | Medium | 6 | Consistency across three orchestrator patterns |
| 6. Integration | Small | 5 | End-to-end verification |

**Overall Feature Complexity:** Medium
