# Raw Idea: stdout Event Streaming & Panel Integration

Parse real-time JSON line events from `WorkflowTriggerService.onStdoutLine` following the schema in `agentify-integration.md`: `graph_structure`, `node_start`/`node_stream`/`node_stop`, `tool_call`/`tool_result`, `workflow_complete`/`workflow_error`. Create `StdoutEventParser` service that:

**Parsing:**
- Subscribes to `WorkflowTriggerService.onStdoutLine`
- Parses JSON, validates against event schema
- Emits typed `StdoutEvent` via `vscode.EventEmitter`
- Handles malformed JSON gracefully (log warning, skip)

**Panel Integration:**
- `DemoViewerPanel` subscribes to both `StdoutEventParser.onEvent` and `DynamoDbPollingService.onEvent`
- Events collected into single array, sorted by timestamp for Execution Log display
- `workflow_complete`/`workflow_error` events trigger Outcome Panel update
- `graph_structure`/`node_*` events reserved for Phase 3 Agent Graph visualization

No separate merge service needed — panel handles trivial array combination.
