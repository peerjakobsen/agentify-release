# Task Breakdown: stdout Event Streaming & Panel Integration

## Overview
Total Tasks: 5 Task Groups

This feature refactors StdoutEventParser to use vscode.EventEmitter pattern and integrates it with DemoViewerPanel to merge stdout and DynamoDB events into a unified execution log with Outcome Panel triggers.

## Task List

### Service Layer

#### Task Group 1: StdoutEventParser EventEmitter Refactor
**Dependencies:** None

- [x] 1.0 Complete StdoutEventParser refactoring
  - [x] 1.1 Write 4-6 focused tests for StdoutEventParser EventEmitter functionality
    - Test that `onEvent` fires when valid JSON line is processed
    - Test that `onParseError` fires when malformed JSON is received
    - Test that `dispose()` properly cleans up EventEmitter subscriptions
    - Test singleton pattern (`getStdoutEventParser()`, `resetStdoutEventParser()`)
    - Test subscription to `WorkflowTriggerService.onStdoutLine` receives lines
    - Skip exhaustive testing of all event types (existing parsing logic unchanged)
  - [x] 1.2 Add vscode.EventEmitter members to StdoutEventParser
    - Add `private readonly _onEvent = new vscode.EventEmitter<MergedEvent<StdoutEvent>>()`
    - Add `public readonly onEvent = this._onEvent.event`
    - Add `private readonly _onParseError = new vscode.EventEmitter<{error: Error, rawData: string}>()`
    - Add `public readonly onParseError = this._onParseError.event`
    - Reference pattern from: `src/services/dynamoDbPollingService.ts`
  - [x] 1.3 Implement vscode.Disposable interface
    - Add `implements vscode.Disposable` to class declaration
    - Add `private _disposables: vscode.Disposable[] = []` for tracking subscriptions
    - Implement `dispose()` method that disposes `_onEvent`, `_onParseError`, and all `_disposables`
  - [x] 1.4 Subscribe to WorkflowTriggerService.onStdoutLine in constructor
    - Import and call `getWorkflowTriggerService()`
    - Subscribe: `service.onStdoutLine((line) => this.processLine(line))`
    - Push subscription to `_disposables` array
  - [x] 1.5 Replace callback invocations with EventEmitter.fire()
    - Replace `callback(event)` calls with `this._onEvent.fire(mergedEvent)`
    - Replace error callback with `this._onParseError.fire({error, rawData})`
    - Remove callback parameters from constructor
    - Keep existing `processChunk()`, `processLine()`, `isValidEvent()`, `generateEventId()` logic
  - [x] 1.6 Implement singleton pattern with factory functions
    - Add `let instance: StdoutEventParser | null = null` at module level
    - Add `export function getStdoutEventParser(): StdoutEventParser` that creates or returns instance
    - Add `export function resetStdoutEventParser(): void` that disposes and nulls instance
    - Reference pattern from: `src/services/dynamoDbPollingService.ts`
  - [x] 1.7 Ensure StdoutEventParser tests pass
    - Run ONLY the 4-6 tests written in 1.1
    - Verify EventEmitter pattern works correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 1.1 pass
- `onEvent` emits `MergedEvent<StdoutEvent>` when valid JSON parsed
- `onParseError` emits when JSON parsing fails
- Singleton pattern works correctly
- `dispose()` cleans up all resources
- Existing parsing logic preserved unchanged

**Files to Modify:**
- `src/services/stdoutEventParser.ts`

---

### Utility Layer

#### Task Group 2: Event to LogEntry Transformation
**Dependencies:** None (can run in parallel with Task Group 1)

- [x] 2.0 Complete event transformation utility
  - [x] 2.1 Write 5-7 focused tests for transformEventToLogEntry function
    - Test `node_start` transforms to "node_id started" with status "neutral"
    - Test `node_stop` (completed) transforms with checkmark and execution time
    - Test `node_stop` (failed) transforms with X and status "error"
    - Test `tool_call` transforms to "system -> operation" with payload
    - Test `workflow_complete` transforms with checkmark and total time
    - Test `workflow_error` transforms with X and error message
    - Test `node_stream` and `graph_structure` return `null` (skip display)
  - [x] 2.2 Create new utility file for event transformation
    - Create file at `src/utils/eventTransformer.ts`
    - Import types from `src/types/events.ts` and `src/types/logPanel.ts`
    - Import type guards (`isNodeStartEvent`, `isNodeStopEvent`, etc.) from events.ts
  - [x] 2.3 Implement transformEventToLogEntry function
    - Signature: `export function transformEventToLogEntry(mergedEvent: MergedEvent): LogEntry | null`
    - Use type guards to determine event type
    - Return `null` for `node_stream` and `graph_structure` events
    - Generate unique `id` using `mergedEvent.id` or timestamp
  - [x] 2.4 Implement transformation for node events
    - `node_start`: summary "node_id started", status "neutral"
    - `node_stop` (status === 'completed'): summary "node_id completed (Xs)", status "success"
    - `node_stop` (status === 'failed' or 'skipped'): summary "node_id failed", status "error"
    - Include relevant event data in LogEntry payload
  - [x] 2.5 Implement transformation for tool events
    - `tool_call`: summary "system -> operation", status "neutral"
    - Include input data in LogEntry payload for expandable details
    - Note: `tool_result` is nested under `tool_call` in DynamoDB schema (out of scope)
  - [x] 2.6 Implement transformation for workflow terminal events
    - `workflow_complete`: summary "Workflow completed (Xs)", status "success"
    - `workflow_error`: summary "Workflow failed: error_message", status "error"
    - Include full event data in payload
  - [x] 2.7 Ensure transformation tests pass
    - Run ONLY the 5-7 tests written in 2.1
    - Verify all event types transform correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 5-7 tests written in 2.1 pass
- All displayable event types transform to correct LogEntry format
- `node_stream` and `graph_structure` return `null`
- Status values correctly set based on event type/state
- Execution times formatted as seconds with 1 decimal place

**Files to Create:**
- `src/utils/eventTransformer.ts`

**Files to Reference:**
- `src/types/events.ts`
- `src/types/logPanel.ts`

---

### Panel Integration Layer

#### Task Group 3: DemoViewerPanel Event Integration
**Dependencies:** Task Group 1, Task Group 2

- [x] 3.0 Complete DemoViewerPanel event integration
  - [x] 3.1 Write 6-8 focused tests for DemoViewerPanel event handling
    - Test subscription to StdoutEventParser.onEvent adds entries to log
    - Test subscription to DynamoDbPollingService.onEvent adds entries to log
    - Test 50ms debounce batches rapid events correctly
    - Test events sorted by timestamp after merge
    - Test `workflow_complete` from stdout triggers setOutcomeSuccess()
    - Test `workflow_error` from stdout triggers setOutcomeError()
    - Test `graph_structure` stored but not added to log
    - Test `node_stream` stored but not added to log
  - [x] 3.2 Add Phase 3 event storage properties
    - Add `private _graphStructure: GraphStructureEvent | null = null`
    - Add `private _nodeStreamBuffer: Map<string, string> = new Map()` for streaming tokens by node_id
    - Add clearing of Phase 3 data in `handleRunWorkflow()` method
  - [x] 3.3 Add debounce batching properties
    - Add `private _pendingEvents: MergedEvent[] = []`
    - Add `private _sortDebounceTimer: ReturnType<typeof setTimeout> | null = null`
  - [x] 3.4 Implement flushPendingEvents method
    - Create `private flushPendingEvents(): void`
    - Transform each pending event via `transformEventToLogEntry()`
    - Filter out null results (node_stream, graph_structure)
    - Merge transformed entries with existing `_logPanelState.entries`
    - Sort merged array by `timestamp` ascending
    - Clear `_pendingEvents` array
    - Update webview with new state
  - [x] 3.5 Implement addEventToBatch method
    - Create `private addEventToBatch(mergedEvent: MergedEvent): void`
    - Store `graph_structure` event to `_graphStructure` (don't add to batch)
    - Append `node_stream` data to `_nodeStreamBuffer` by node_id (don't add to batch)
    - For displayable events: push to `_pendingEvents`
    - Clear existing debounce timer if set
    - Set new 50ms timer to call `flushPendingEvents()`
  - [x] 3.6 Subscribe to event sources in subscribeToWorkflowService
    - Import `getStdoutEventParser()` and subscribe to `onEvent`
    - Subscribe to `DynamoDbPollingService.onEvent` (already may exist)
    - Push subscriptions to `_serviceSubscriptions` array
    - Handle incoming events via `addEventToBatch()`
  - [x] 3.7 Implement Outcome Panel triggers for stdout terminal events
    - In event handler, check if `mergedEvent.source === 'stdout'`
    - On `workflow_complete`: call `this.setOutcomeSuccess(event.result, event.sources)`
    - On `workflow_error`: call `this.setOutcomeError(event.error_message, event.error_code)`
    - Do NOT trigger outcome from DynamoDB events
  - [x] 3.8 Ensure DemoViewerPanel tests pass
    - Run ONLY the 6-8 tests written in 3.1
    - Verify event merging and sorting works correctly
    - Verify Outcome Panel triggers work correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 6-8 tests written in 3.1 pass
- Events from both sources merge into unified sorted log
- 50ms debounce prevents excessive re-sorting during rapid bursts
- Outcome Panel updates on workflow_complete/workflow_error from stdout only
- Phase 3 data stored without log display
- Subscriptions properly disposed on panel close

**Files to Modify:**
- `src/panels/demoViewerPanel.ts`

**Files to Reference:**
- `src/services/dynamoDbPollingService.ts`

---

### Error Handling Layer

#### Task Group 4: Parse Error Logging
**Dependencies:** Task Group 1

- [x] 4.0 Complete parse error logging to Output channel
  - [x] 4.1 Write 2-3 focused tests for parse error logging
    - Test that parse errors are logged to Output channel
    - Test log format: `[StdoutEventParser] Malformed JSON: {truncated rawData}...`
    - Test that parse errors do NOT appear in UI log panel
  - [x] 4.2 Create or get shared Output channel in DemoViewerPanel
    - Add `private _outputChannel: vscode.OutputChannel | null = null`
    - Create channel: `vscode.window.createOutputChannel('Agentify')` on first use
    - Consider making this a shared singleton if other services need it
  - [x] 4.3 Subscribe to StdoutEventParser.onParseError
    - Subscribe in `subscribeToWorkflowService()` method
    - Push subscription to `_serviceSubscriptions` array
  - [x] 4.4 Implement parse error logging handler
    - Log format: `[StdoutEventParser] Malformed JSON: ${rawData.substring(0, 100)}...`
    - Use `_outputChannel.appendLine()` for logging
    - Do NOT add parse errors to UI log panel (keep demo experience clean)
  - [x] 4.5 Ensure parse error logging tests pass
    - Run ONLY the 2-3 tests written in 4.1
    - Verify errors logged to Output channel
    - Verify UI remains clean
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-3 tests written in 4.1 pass
- Parse errors logged to 'Agentify' Output channel
- Log messages truncated to 100 characters
- UI log panel remains free of parse error noise

**Files to Modify:**
- `src/panels/demoViewerPanel.ts`

---

### Testing

#### Task Group 5: Test Review & Gap Analysis
**Dependencies:** Task Groups 1-4

- [x] 5.0 Review existing tests and fill critical gaps only
  - [x] 5.1 Review tests from Task Groups 1-4
    - Review the 4-6 tests written for StdoutEventParser (Task 1.1) - **8 tests**
    - Review the 5-7 tests written for eventTransformer (Task 2.1) - **8 tests**
    - Review the 6-8 tests written for DemoViewerPanel (Task 3.1) - **23 tests**
    - Review the 2-3 tests written for parse error logging (Task 4.1) - included in DemoViewerPanel tests
    - Total existing tests: **39 tests** (exceeds target of 17-24)
  - [x] 5.2 Analyze test coverage gaps for THIS feature only
    - Identify critical integration points that lack coverage - **All covered**
    - Check end-to-end flow: stdout line -> parsed event -> log entry -> UI - **Covered by Task Group 3 tests**
    - Check Outcome Panel trigger flow works end-to-end - **Covered by tests 3.1.5 and 3.1.6**
    - Focus ONLY on gaps related to this spec's feature requirements
    - Do NOT assess entire application test coverage
  - [x] 5.3 Write up to 8 additional strategic tests maximum
    - Add integration test: full event flow from WorkflowTriggerService through to log display - **Covered by existing tests**
    - Add integration test: workflow_complete triggers Outcome Panel correctly - **Covered by test 3.1.5**
    - Add edge case test: rapid event burst correctly debounced and sorted - **Covered by test 3.1.3**
    - Add edge case test: mixed stdout and DynamoDB events merge correctly - **Covered by tests 3.1.1 & 3.1.2**
    - Add edge case test: disposal properly cleans up all subscriptions - **Covered by disposal test**
    - Skip tests for out-of-scope Phase 3 visualization features
    - Do NOT write comprehensive coverage for all scenarios
    - **No additional tests needed - all scenarios covered**
  - [x] 5.4 Run feature-specific tests only
    - Run ONLY tests related to this spec's feature
    - Expected total: approximately 25-32 tests maximum - **39 tests passing**
    - Do NOT run the entire application test suite
    - Verify all critical workflows pass - **All pass**
  - [x] 5.5 Verify acceptance criteria across all task groups
    - StdoutEventParser emits events via EventEmitter pattern - **Verified**
    - Events transform correctly to LogEntry format - **Verified**
    - DemoViewerPanel merges and sorts events from both sources - **Verified**
    - Outcome Panel triggers on stdout terminal events only - **Verified**
    - Parse errors logged to Output channel, not UI - **Verified**

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 25-32 tests total) - **39 tests pass**
- Critical user workflows for this feature are covered - **All covered**
- No more than 8 additional tests added when filling in testing gaps - **0 additional tests needed**
- Testing focused exclusively on this spec's feature requirements - **Yes**

---

## Execution Order

Recommended implementation sequence:

```
Task Group 1 (StdoutEventParser)  ----+
                                       |
Task Group 2 (Event Transformer)  ----+---> Task Group 3 (Panel Integration)
                                       |
                                       +---> Task Group 4 (Error Logging)
                                                        |
                                                        v
                                              Task Group 5 (Test Review)
```

1. **Task Groups 1 & 2 (Parallel)**: Service refactoring and utility creation can proceed simultaneously as they have no dependencies on each other
2. **Task Groups 3 & 4 (After 1 & 2)**: Panel integration depends on both the refactored StdoutEventParser and the event transformer utility
3. **Task Group 5 (Final)**: Test review and gap analysis after all implementation complete

---

## Key Technical Notes

**Event Source Split:**
- stdout events: `graph_structure`, `node_start`, `node_stop`, `node_stream`, `workflow_complete`, `workflow_error`
- DynamoDB events: `tool_call`, `agent_start`, `agent_end`

**Display vs Storage:**
- Display in log: `node_start`, `node_stop`, `tool_call`, `workflow_complete`, `workflow_error`
- Store only (Phase 3): `graph_structure`, `node_stream`

**Key Files:**
- `src/services/stdoutEventParser.ts` - Main refactoring target
- `src/panels/demoViewerPanel.ts` - Panel integration
- `src/utils/eventTransformer.ts` - New utility file
- `src/services/dynamoDbPollingService.ts` - Reference pattern
- `src/types/events.ts` - Type definitions
