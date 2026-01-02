# Specification: Workflow Session Continuation

## Goal
Enable multi-turn conversations within the same workflow session for the Agentify Demo Viewer, allowing users to continue conversations with agents across multiple turns while maintaining the same workflowId.

## User Stories
- As a demo user, I want to send follow-up messages to agents so that I can have a natural back-and-forth conversation within the same workflow session
- As a demo user, I want to start a new conversation that clears all history so that I can begin fresh without prior context

## Specific Requirements

**Session State Management**
- Maintain same `workflowId` across all conversation turns within a session
- Track `turnCount` starting at 1 for the first turn, incrementing on each follow-up
- Store `conversationTurns[]` array containing human prompts and entry agent responses only
- Entry agent name is already captured via first `node_start` event (from Item 37)
- Reuse same `traceId` across all turns for X-Ray correlation

**Conversation Context Format**
- JSON structure: `{ "entry_agent": "agent_id", "turns": [ { "role": "human", "content": "..." }, { "role": "entry_agent", "content": "..." } ] }`
- Include entry agent name at top level so orchestrator knows routing target
- Turns array maintains chronological order; no timestamps needed
- Only include left pane content (human + entry agent), never internal collaboration

**CLI Contract Updates**
- Add `--conversation-context` argument (optional, omitted on turn 1)
- Add `--turn-number` argument (required, starts at 1)
- Keep `--prompt` for current user message only (not combined with history)
- Orchestrator is responsible for combining prompt + context appropriately

**Event Schema Updates**
- Add `turn_number` field to all stdout events (graph_structure, node_start, node_stop, workflow_complete, workflow_error)
- Extension passes `--turn-number` CLI arg; orchestrator includes in emitted events
- Session bar displays "Turn: N" indicator using this field

**Dual-Pane UI Behavior**
- Left pane (conversation): Accumulates messages across turns (continuous history)
- Right pane (collaboration): Clears when follow-up is sent (fresh per turn)
- Input re-enables after each turn completes or reaches partial state
- Follow-up prompts route to left pane as user messages

**New Conversation Reset**
- Generate fresh `workflowId` via `generateWorkflowId()`
- Clear both panes completely (reset `messages[]` array)
- Reset `turnCount` to 0
- Clear `conversationTurns[]` array
- Entry agent re-identified from new workflow's first `node_start`

## Existing Code to Leverage

**BedrockConversationService conversation history pattern**
- Uses `_conversationHistory: ConversationMessage[]` array with role/content
- Methods `_appendUserMessage()` and `_appendAssistantMessage()` for building history
- `resetConversation()` clears array for new sessions
- Pattern can be adapted for building conversation context JSON

**ChatSessionState existing fields**
- Already has `workflowId`, `sessionId`, `turnCount`, `entryAgentName` fields
- `addUserMessage()` in chatStateUtils already increments turnCount
- Foundation exists; needs `conversationTurns[]` array added

**Entry agent response capture in handleNodeStopEvent**
- Extracts `response` field from `node_stop` event via `eventAny.response`
- This response content populates the entry agent turn in conversation context
- Already identifies entry agent via `this._sessionState.entryAgentName`

**orchestrator_utils.py parse_arguments pattern**
- Uses `argparse` with `parser.add_argument()` for CLI args
- `validate_arguments()` function for validation logic
- Add new `--conversation-context` and `--turn-number` arguments following same pattern

**workflowTriggerService.ts CLI args building**
- Builds `args` array with `[entryScriptPath, '--prompt', prompt, '--workflow-id', workflowId, '--trace-id', traceId]`
- Add `--turn-number` and `--conversation-context` to this array conditionally
- Generate context JSON from session state before spawn

## Out of Scope
- Session persistence across IDE restarts (demos are ephemeral)
- Automatic session timeout or expiry (user controls via "New Conversation")
- Conversation forking or branching
- AgentCore Memory integration (separate future roadmap item)
- Maximum turn limit enforcement (let demos run freely)
- Undo or rollback to previous turn
- Streaming the conversation context to Python (pass as single JSON string)
- Context size limits or truncation (demos are short-lived)
- Turn-level event filtering in Demo Viewer UI (future enhancement)
- Persisting conversation history to DynamoDB (events already capture turns via turn_number field)
