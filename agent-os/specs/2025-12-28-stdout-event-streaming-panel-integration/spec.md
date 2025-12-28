# Specification: stdout Event Streaming & Panel Integration

## Goal
Refactor StdoutEventParser to use vscode.EventEmitter pattern, integrate it with DemoViewerPanel to merge stdout and DynamoDB events into a unified execution log, and trigger Outcome Panel updates on workflow completion events.

## User Stories
- As a developer, I want to see real-time workflow events from both stdout and DynamoDB merged into a single chronological log so that I can monitor agent execution progress
- As a developer, I want to see workflow results in the Outcome Panel immediately when the workflow completes so that I can quickly assess the outcome

## Specific Requirements

**StdoutEventParser EventEmitter Refactor**
- Implement `vscode.Disposable` interface for proper resource cleanup
- Add `private readonly _onEvent = new vscode.EventEmitter<MergedEvent<StdoutEvent>>()` with public `readonly onEvent = this._onEvent.event`
- Add `private readonly _onParseError = new vscode.EventEmitter<{error: Error, rawData: string}>()` with public `readonly onParseError = this._onParseError.event`
- Subscribe to `WorkflowTriggerService.onStdoutLine` in constructor
- Replace callback invocations with `this._onEvent.fire(mergedEvent)` and `this._onParseError.fire({error, rawData})`
- Implement singleton pattern with `getStdoutEventParser()` and `resetStdoutEventParser()` functions
- Dispose EventEmitters in `dispose()` method

**50ms Debounce Batching for Event Merging**
- Add `private pendingEvents: MergedEvent[] = []` array to DemoViewerPanel
- Add `private sortDebounceTimer: ReturnType<typeof setTimeout> | null = null` timer reference
- When event arrives, push to `pendingEvents` and reset debounce timer
- After 50ms, call `flushPendingEvents()` to sort and merge into `_logPanelState.entries`
- Sort merged array by `event.timestamp` ascending

**Event to LogEntry Transformation**
- Create `transformEventToLogEntry(mergedEvent: MergedEvent): LogEntry | null` function in new utility file
- `node_start`: summary "Play icon {node_id} started", status "neutral"
- `node_stop` (completed): summary "Checkmark {node_id} completed ({execution_time_ms/1000}s)", status "success"
- `node_stop` (failed/skipped): summary "X {node_id} failed", status "error"
- `tool_call`: summary "Wrench {system} -> {operation}", status "neutral", include input in payload
- `workflow_complete`: summary "Checkmark Workflow completed ({execution_time_ms/1000}s)", status "success"
- `workflow_error`: summary "X Workflow failed: {error_message}", status "error"
- Return `null` for `node_stream` and `graph_structure` events (skip log display)

**DemoViewerPanel Event Subscription**
- Subscribe to `StdoutEventParser.onEvent` in `subscribeToWorkflowService()`
- Subscribe to `DynamoDbPollingService.onEvent` in `subscribeToWorkflowService()`
- Push subscriptions to `_serviceSubscriptions` array for disposal
- Transform incoming events via `transformEventToLogEntry()` before adding to pending batch

**Phase 3 Event Storage**
- Add `private _graphStructure: GraphStructureEvent | null = null` to store graph structure
- Add `private _nodeStreamBuffer: Map<string, string> = new Map()` for streaming tokens by node_id
- Store `graph_structure` event without adding to log
- Store `node_stream` data appended to buffer by node_id, without adding to log
- Clear stored Phase 3 data on new workflow run (in `handleRunWorkflow`)

**Outcome Panel Triggers from stdout Events**
- On `workflow_complete` event from stdout: call `setOutcomeSuccess(event.result, event.sources)`
- On `workflow_error` event from stdout: call `setOutcomeError(event.error_message, event.error_code)`
- Do NOT trigger outcome panel from DynamoDB events (DynamoDB never receives terminal events)
- Check `mergedEvent.source === 'stdout'` before triggering outcome updates

**Parse Error Logging**
- Subscribe to `StdoutEventParser.onParseError` in DemoViewerPanel
- Create or get shared Output channel: `vscode.window.createOutputChannel('Agentify')`
- Log format: `[StdoutEventParser] Malformed JSON: {rawData.substring(0, 100)}...`
- Do not display parse errors in UI (keep demo experience clean)

## Visual Design
No visual assets provided - UI already exists in DemoViewerPanel.

## Existing Code to Leverage

**DynamoDbPollingService EventEmitter Pattern**
- Located at `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/dynamoDbPollingService.ts`
- Use exact same pattern: private `_onEvent` EventEmitter, public `onEvent` getter
- Copy singleton pattern with `getInstance()` and `resetInstance()` functions
- Copy `vscode.Disposable` implementation pattern

**StdoutEventParser Existing Parsing Logic**
- Located at `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/stdoutEventParser.ts`
- Keep `processChunk()`, `processLine()`, `isValidEvent()`, `generateEventId()` methods
- Keep `EventDeduplicator` class unchanged
- Keep `orderEventsByTimestamp()` utility function

**WorkflowTriggerService onStdoutLine**
- Located at `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/workflowTriggerService.ts`
- Subscribe pattern: `service.onStdoutLine((line) => this.processLine(line))`
- Access via `getWorkflowTriggerService()` singleton

**DemoViewerPanel Log Entry Methods**
- Located at `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/demoViewerPanel.ts`
- Use existing `addLogEntry()` and `addLogEntries()` methods
- Use existing `setOutcomeSuccess()` and `setOutcomeError()` methods
- Follow existing subscription pattern in `subscribeToWorkflowService()`

**Event Type Definitions**
- Located at `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/events.ts`
- All stdout event types already defined: `GraphStructureEvent`, `NodeStartEvent`, `NodeStopEvent`, `NodeStreamEvent`, `WorkflowCompleteEvent`, `WorkflowErrorEvent`
- `MergedEvent<T>` wrapper type already exists
- Type guards (`isNodeStartEvent`, `isWorkflowCompleteEvent`, etc.) already exist

## Out of Scope
- Agent Graph visualization using `graph_structure` and `node_*` events (Phase 3, item 24)
- Graph animation showing node execution progress (Phase 3, item 25)
- Collapsible log sections grouped by agent (Phase 3, item 26)
- Filtering execution log by agent name or event type (Phase 3, item 26)
- Virtual scrolling for large event lists (Phase 3, item 26)
- Displaying `node_stream` events in the execution log (Phase 3, too noisy)
- Processing `tool_result` as separate events (nested under `tool_call` in DynamoDB schema)
- AgentCore mode DynamoDB-only event handling (terminal events only come from stdout)
- Modifying the existing log entry HTML rendering or CSS styling
