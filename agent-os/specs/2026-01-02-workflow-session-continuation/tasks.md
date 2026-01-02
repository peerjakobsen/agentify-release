# Task Breakdown: Workflow Session Continuation (Item 38)

## Overview
Total Tasks: 39 tasks across 6 task groups

This feature enables multi-turn conversations within the same workflow session for the Agentify Demo Viewer, allowing users to continue conversations with agents across multiple turns while maintaining the same workflowId.

## Test File Paths

| Test File | Purpose |
|-----------|---------|
| `src/test/types/chatPanel.test.ts` | ConversationTurn type, ConversationContext interface, and utility function tests |
| `src/test/types/workflowStatus.test.ts` | Workflow status state transition tests |

## Architecture Context

### Session Identity Model
All conversation turns share the same `workflowId`. There is no separate `sessionId` concept for multi-turn tracking. The `workflowId` generated on the first turn is reused for all subsequent turns.

### Conversation Context JSON Format
The conversation context passed to Python via CLI follows this structure:
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

The `entry_agent` field at the top level identifies which agent the user is conversing with. The `turns` array contains only the human <-> entry agent exchanges (left pane content). Internal agent collaboration (right pane) is NOT included.

### CLI Invocation Pattern
```bash
# Turn 1 (first message)
python main.py \
  --prompt "I need help with my order" \
  --workflow-id "wf-abc123" \
  --trace-id "80e1afed..." \
  --turn-number 1

# Turn 2+ (follow-up)
python main.py \
  --prompt "ORD-12345" \
  --workflow-id "wf-abc123" \
  --trace-id "80e1afed..." \
  --turn-number 2 \
  --conversation-context '{"entry_agent":"triage_agent","turns":[...]}'
```

### Dual-Pane Behavior
- **Left pane (conversation):** Accumulates across turns - never cleared on follow-up
- **Right pane (collaboration):** Cleared when follow-up sent - fresh per turn
- **Session bar:** Shows "Turn: N" indicator using turn_number from events

### Entry Agent Name Flow
1. First `node_start` event received -> `entryAgentName` set in `ChatSessionState`
2. Entry agent responses captured in `conversationTurns[]` with role `'entry_agent'`
3. `buildConversationContext()` reads `entryAgentName` from state to populate the context JSON
4. Context passed to `WorkflowTriggerService.continue()` which adds it to CLI args

---

## Task List

### Type Definitions Layer

#### Task Group 1: Type Definitions and Interfaces
**Dependencies:** None

- [x] 1.0 Complete type definitions
  - [x] 1.1 Write 3-5 focused tests for ConversationTurn type and ChatSessionState extensions
    - Test ConversationTurn interface structure (role, content)
    - Test ChatSessionState conversationTurns[] array handling
    - Test conversation context JSON structure validation
  - [x] 1.2 Create ConversationTurn type in chatPanel.ts (after line 22)
    - Define `role: 'human' | 'entry_agent'`
    - Define `content: string`
    - Add JSDoc explaining this is for CLI context passing, not UI display
    - Follow existing type patterns in file
  - [x] 1.3 Extend ChatSessionState interface (lines 85-109)
    - Add `conversationTurns: ConversationTurn[]`
    - Update JSDoc for `turnCount` to note it's actively incremented per turn
  - [x] 1.4 Create ConversationContext type (after ConversationTurn)
    - Define `entry_agent: string`
    - Define `turns: ConversationTurn[]`
    - Add JSDoc documenting JSON structure for CLI passing with example
  - [x] 1.5 Ensure type definition tests pass
    - Run ONLY the 3-5 tests written in 1.1
    - Verify TypeScript compilation succeeds

**Acceptance Criteria:**
- The 3-5 tests written in 1.1 pass
- ConversationTurn type correctly defines role/content structure
- ChatSessionState includes conversationTurns[] array
- ConversationContext type matches CLI JSON contract
- TypeScript compilation succeeds without errors

**Files Modified:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/chatPanel.ts` (added ConversationTurnRole, ConversationTurn, ConversationContext types; extended ChatSessionState)

---

### State Management Layer

#### Task Group 2: Chat State Utilities
**Dependencies:** Task Group 1

- [x] 2.0 Complete state management utilities
  - [x] 2.1 Write 4-6 focused tests for conversation state utilities
    - Test addConversationTurn() adds human turn correctly
    - Test addConversationTurn() adds entry_agent turn correctly
    - Test buildConversationContext() generates correct JSON structure
    - Test buildConversationContext() returns null when conversationTurns is empty
    - Test clearConversationTurns() resets array
    - Test clearCollaborationMessages() removes only collaboration pane messages
  - [x] 2.2 Update createInitialChatState() to include conversationTurns (lines 50-63)
    - Initialize `conversationTurns: []`
    - Maintain existing field initialization
  - [x] 2.3 Implement addConversationTurn() utility function (after line 100)
    - Accept `state: ChatSessionState`, `role: 'human' | 'entry_agent'`, `content: string` parameters
    - Append new turn to conversationTurns[] array
    - Return updated ChatSessionState
    - Follow immutable update pattern from existing utilities
  - [x] 2.4 Implement buildConversationContext() utility function (after addConversationTurn)
    - Accept `state: ChatSessionState` parameter
    - Return `ConversationContext` object with `entry_agent` (from `state.entryAgentName`) and `turns`
    - Return `null` if `conversationTurns` is empty (turn 1 case)
    - Include JSDoc with JSON format example
  - [x] 2.5 Implement clearCollaborationMessages() utility function (after buildConversationContext)
    - Filter messages array to remove `pane === 'collaboration'`
    - Preserve conversation pane messages (user + entry agent)
    - Return updated ChatSessionState
  - [x] 2.6 Update resetChatState() for new conversation (lines 206-208)
    - Ensure conversationTurns[] is reset (already handled by createInitialChatState())
    - No additional changes needed if createInitialChatState() is updated in 2.2
  - [x] 2.7 Ensure state utility tests pass
    - Run ONLY the 4-6 tests written in 2.1
    - Verify all utility functions work correctly

**Acceptance Criteria:**
- The 4-6 tests written in 2.1 pass
- createInitialChatState() initializes conversationTurns as empty array
- addConversationTurn() correctly appends turns with role/content
- buildConversationContext() generates correct JSON structure, returns null for empty turns
- clearCollaborationMessages() preserves conversation pane, clears collaboration
- resetChatState() clears all conversation state including turns

**Files Modified:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/utils/chatStateUtils.ts` (added addConversationTurn, buildConversationContext, clearCollaborationMessages functions; updated createInitialChatState)

---

### Service Layer

#### Task Group 3: WorkflowTriggerService Session Management
**Dependencies:** Task Group 2

- [x] 3.0 Complete service layer session management
  - [x] 3.1 Write 4-6 focused tests for session continuation
    - Test start() passes --turn-number 1 on first turn
    - Test continue() passes --turn-number N on follow-up turns
    - Test continue() passes --conversation-context JSON correctly
    - Test continue() reuses same workflowId and traceId
    - Test hasActiveSession() returns correct boolean
    - Test CLI args array construction for multi-turn scenario
  - [x] 3.2 Add session state fields to WorkflowTriggerService (after line 45)
    - Add `private _currentWorkflowId: string | null = null`
    - Add `private _currentTraceId: string | null = null`
    - Add `private _currentTurnNumber: number = 0`
    - Initialize fields in constructor (already null) and reset in dispose() (line ~175)
  - [x] 3.3 Update start() method to track session and add turn number (lines 96-163)
    - Store workflowId and traceId in private fields after generation
    - Set `_currentTurnNumber` to 1
    - Add `'--turn-number', '1'` to args array (before spawn call)
    - Return `{ workflowId, traceId }` as before
  - [x] 3.4 Implement continue() method for follow-up turns (after start() method)
    - Accept `prompt: string`, `conversationContext: ConversationContext` parameters
    - Reuse stored `_currentWorkflowId` and `_currentTraceId`
    - Increment `_currentTurnNumber`
    - Build args with `--turn-number` and `--conversation-context` (JSON.stringify)
    - Spawn subprocess with same pattern as start()
    - Return `{ workflowId, traceId }` (existing IDs)
  - [x] 3.5 Add hasActiveSession() accessor method (after continue())
    - Return `this._currentWorkflowId !== null`
    - Used by demoViewerChatLogic to determine start vs continue
  - [x] 3.6 Add resetSession() method (after hasActiveSession())
    - Set `_currentWorkflowId = null`
    - Set `_currentTraceId = null`
    - Set `_currentTurnNumber = 0`
    - Called on new conversation
  - [x] 3.7 Ensure service layer tests pass
    - Run ONLY the 4-6 tests written in 3.1
    - Verify session tracking and CLI arg construction

**Acceptance Criteria:**
- The 4-6 tests written in 3.1 pass
- start() initializes session state and passes --turn-number 1
- continue() reuses session IDs and increments turn number
- continue() passes --conversation-context as JSON string
- hasActiveSession() correctly reports session status
- resetSession() clears all session state

**Files Modified:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/workflowTriggerService.ts` (added session state fields, continue() method, hasActiveSession(), resetSession(), getCurrentTurnNumber())

---

### Python CLI Layer

#### Task Group 4: Python Orchestrator Updates
**Dependencies:** None (can run in parallel with Task Groups 1-3)

- [x] 4.0 Complete Python CLI layer updates
  - [x] 4.1 Write 4-6 focused tests for CLI argument parsing
    - Test --turn-number argument parsing (required, integer)
    - Test --conversation-context argument parsing (optional, JSON string)
    - Test turn_number field included in all event emissions
    - Test validation of turn-number (must be positive integer >= 1)
  - [x] 4.2 Add --turn-number argument to orchestrator_utils.py parse_arguments() (lines 24-48)
    - Add `parser.add_argument('--turn-number', required=True, type=int)`
    - Add help text: `'Turn number in the conversation (starts at 1)'`
  - [x] 4.3 Add --conversation-context argument to parse_arguments() (lines 24-48)
    - Add `parser.add_argument('--conversation-context', required=False, default=None)`
    - Add help text: `'JSON string containing conversation history for multi-turn sessions'`
  - [x] 4.4 Update validate_arguments() for new arguments (lines 50-64)
    - Validate `turn_number` is a positive integer (>= 1)
    - Validate `conversation_context` is valid JSON if provided (or None)
    - Add error messages for invalid values
  - [x] 4.5 Add turn_number to emit_workflow_error() (lines 195-205)
    - Add `turn_number: int` parameter (optional, default=None)
    - Include `"turn_number": turn_number` in event dict when provided
    - Note: emit_event() signature unchanged; turn_number added at call sites
  - [x] 4.6 Update main_graph.py to pass turn_number in all events
    - Add `args.turn_number` to graph_structure event (lines 90-99)
    - Add `args.turn_number` to all node_start events (lines 103-114)
    - Add `args.turn_number` to all node_stop events (lines 120-131, 141-152)
    - Add `args.turn_number` to workflow_complete event (lines 158-166)
    - Pass turn_number to emit_workflow_error() calls
  - [x] 4.7 Update main_swarm.py with same turn_number changes
    - Mirror changes from main_graph.py
    - Maintain swarm-specific orchestration logic
  - [x] 4.8 Update main_workflow.py with same turn_number changes
    - Mirror changes from main_graph.py
    - Maintain workflow-specific orchestration logic
  - [x] 4.9 Ensure Python CLI tests pass
    - Run ONLY the 4-6 tests written in 4.1
    - Verify argument parsing and event emission

**Acceptance Criteria:**
- The 4-6 tests written in 4.1 pass
- --turn-number argument is required and validated as positive integer
- --conversation-context argument is optional and parsed as JSON string
- All events (graph_structure, node_start, node_stop, workflow_complete, workflow_error) include turn_number field
- All three main.py templates updated consistently

**Files Modified:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/resources/agents/shared/orchestrator_utils.py` (added --turn-number, --conversation-context args; updated validate_arguments and emit_workflow_error)
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/resources/agents/main_graph.py` (added turn_number to all events)
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/resources/agents/main_swarm.py` (added turn_number to all events)
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/resources/agents/main_workflow.py` (added turn_number to all events)

---

### UI Integration Layer

#### Task Group 5: Demo Viewer Chat Logic Integration
**Dependencies:** Task Groups 2, 3, 4

- [x] 5.0 Complete UI integration
  - [x] 5.1 Write 5-8 focused tests for UI integration
    - Test handleSendMessage() calls continue() on follow-up (hasActiveSession() === true)
    - Test handleSendMessage() calls start() on first turn (hasActiveSession() === false)
    - Test follow-up clears collaboration pane messages
    - Test entry agent response is captured in conversationTurns[]
    - Test human message is captured in conversationTurns[]
    - Test handleNewConversation() resets all state including conversationTurns
    - Test conversation context is built correctly before continue()
  - [x] 5.2 Update handleSendMessage() for multi-turn support (lines 107-140)
    - After addUserMessage(), call addConversationTurn() with role 'human' and content
    - Check if session exists using `getWorkflowTriggerService().hasActiveSession()`
    - If active session: call clearCollaborationMessages() then continue() with buildConversationContext()
    - If no active session: call start() (existing behavior)
    - Note: first message has hasActiveSession() === false, follow-ups have true
  - [x] 5.3 Update handleNodeStopEvent() to capture entry agent response (lines 286-324)
    - Check if stopped agent is entry agent (`agentName === this._sessionState.entryAgentName`)
    - If entry agent, call addConversationTurn() with role 'entry_agent' and response content
    - Response already extracted in eventAny.response (line ~296)
  - [x] 5.4 Add import for new utilities at top of file
    - Add `addConversationTurn`, `buildConversationContext`, `clearCollaborationMessages` to imports from chatStateUtils
    - Add `ConversationContext` type import from chatPanel types
  - [x] 5.5 Update handleNewConversation() for complete reset (lines 143-168)
    - Call `getWorkflowTriggerService().resetSession()` before resetChatState()
    - Reset conversationTurns via resetChatState() (already handled)
    - Clear both panes (already handled by resetChatState)
    - Entry agent re-identified from first node_start (existing behavior)
  - [x] 5.6 Add UI state indicator for turn number
    - Store current turn number from session state or service
    - Make available for session bar "Turn: N" display
    - Update on each handleSendMessage()
  - [x] 5.7 Ensure UI integration tests pass
    - Run ONLY the 5-8 tests written in 5.1
    - Verify multi-turn conversation flow works end-to-end

**Acceptance Criteria:**
- The 5-8 tests written in 5.1 pass
- First message triggers start(), follow-ups trigger continue()
- Collaboration pane clears on follow-up send
- Entry agent responses captured in conversationTurns[]
- Human messages captured in conversationTurns[]
- New Conversation resets all state including session and turns
- Turn number available for UI display

**Files Modified:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/demoViewerChatLogic.ts` (updated imports, handleSendMessage, handleNodeStopEvent, handleNewConversation)

---

### Testing

#### Task Group 6: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-5

- [x] 6.0 Review existing tests and fill critical gaps only
  - [x] 6.1 Review tests from Task Groups 1-5
    - Review the 3-5 tests from Task Group 1 (type definitions)
    - Review the 4-6 tests from Task Group 2 (state utilities)
    - Review the 4-6 tests from Task Group 3 (service layer)
    - Review the 4-6 tests from Task Group 4 (Python CLI)
    - Review the 5-8 tests from Task Group 5 (UI integration)
    - Total existing tests: approximately 20-31 tests
  - [x] 6.2 Analyze test coverage gaps for THIS feature only
    - Identify critical multi-turn workflows that lack coverage
    - Focus on integration between layers (service -> Python -> UI)
    - Do NOT assess entire application test coverage
    - Prioritize end-to-end conversation continuation flow
  - [x] 6.3 Write up to 8 additional strategic tests maximum
    - Add end-to-end test: complete 3-turn conversation flow
    - Add integration test: conversation context JSON round-trip
    - Add edge case: follow-up sent during partial state (workflowStatus === 'partial')
    - Add edge case: new conversation after multi-turn session
    - Focus on cross-layer integration points
    - Do NOT write comprehensive coverage for all scenarios
  - [x] 6.4 Run feature-specific tests only
    - Run ONLY tests related to this spec's feature
    - Expected total: approximately 28-39 tests maximum
    - Do NOT run the entire application test suite
    - Verify critical multi-turn workflows pass

**Acceptance Criteria:**
- All feature-specific tests pass (42 tests total)
- Critical multi-turn conversation flows covered
- Tests added to existing chatPanel.test.ts for new types and utilities
- Testing focused exclusively on session continuation feature

**Files Modified:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/test/types/chatPanel.test.ts` (extended with Multi-Turn Conversation Type Definitions and Utility Functions tests)

---

## Execution Order

Recommended implementation sequence:

```
Task Group 1: Type Definitions (no dependencies)
     |
     v
Task Group 2: State Utilities (depends on Task Group 1)
     |
     +---> Task Group 4: Python CLI (can run in parallel)
     |
     v
Task Group 3: Service Layer (depends on Task Group 2)
     |
     v
Task Group 5: UI Integration (depends on Task Groups 2, 3, 4)
     |
     v
Task Group 6: Test Review (depends on all previous groups)
```

**Parallel Execution Opportunity:**
- Task Group 4 (Python CLI) can be executed in parallel with Task Groups 2 and 3
- This allows backend Python changes to proceed while TypeScript layer is built

---

## Key Implementation Notes

### Conversation Context JSON Format
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

### CLI Invocation Examples

**Turn 1 (first message):**
```bash
python main.py \
  --prompt "I need help with my order" \
  --workflow-id "wf-abc123" \
  --trace-id "80e1afed..." \
  --turn-number 1
```

**Turn 2+ (follow-up):**
```bash
python main.py \
  --prompt "ORD-12345" \
  --workflow-id "wf-abc123" \
  --trace-id "80e1afed..." \
  --turn-number 2 \
  --conversation-context '{"entry_agent":"triage_agent","turns":[...]}'
```

### Integration Points
- **Item 35.1 (Dual-Pane UI):** Message routing to correct panes already implemented
- **Item 37 (Partial Execution Detection):** Entry agent identification already implemented, partial state triggers continuation capability

---

## Out of Scope

The following behaviors are explicitly excluded from this spec based on architectural decisions:

| Exclusion | Reason |
|-----------|--------|
| Session persistence across IDE restarts | Demos are ephemeral; complex state serialization not justified |
| Automatic session timeout/expiry | Not needed for demo context; user controls via "New Conversation" button |
| Conversation forking | Advanced feature with no clear demo use case |
| AgentCore Memory integration | Separate future roadmap item; Item 38 solves "multi-turn within workflow", not "memory across workflows" |
| Maximum turn limit enforcement | Let it run; demos are short-lived |
| Undo/rollback to previous turn | Too complex for MVP |

---

## Files Summary

### TypeScript Files
| File | Changes |
|------|---------|
| `src/types/chatPanel.ts` | Add ConversationTurnRole, ConversationTurn, ConversationContext types; extend ChatSessionState with conversationTurns |
| `src/utils/chatStateUtils.ts` | Add addConversationTurn(), buildConversationContext(), clearCollaborationMessages(); update createInitialChatState() |
| `src/services/workflowTriggerService.ts` | Add session tracking fields, continue() method, hasActiveSession(), resetSession(), getCurrentTurnNumber() |
| `src/panels/demoViewerChatLogic.ts` | Update handleSendMessage(), handleNodeStopEvent(), handleNewConversation() for multi-turn support |

### Python Files
| File | Changes |
|------|---------|
| `resources/agents/shared/orchestrator_utils.py` | Add --turn-number, --conversation-context args; update validate_arguments() and emit_workflow_error() |
| `resources/agents/main_graph.py` | Add turn_number to all events |
| `resources/agents/main_swarm.py` | Add turn_number to all events |
| `resources/agents/main_workflow.py` | Add turn_number to all events |

### Test Files
| File | Purpose |
|------|---------|
| `src/test/types/chatPanel.test.ts` | Type definitions, state utilities, and multi-turn conversation tests (42 tests total) |
| `src/test/types/workflowStatus.test.ts` | Workflow status state transition tests (12 tests) |
