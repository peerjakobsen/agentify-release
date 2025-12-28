# Task Breakdown: DynamoDB Polling Service

## Overview
Total Tasks: 4 Task Groups with 24 Sub-tasks

This feature implements a polling service for a VS Code extension that fetches workflow events from DynamoDB at regular intervals, emits them to subscribers via VS Code EventEmitter, and manages its own lifecycle including automatic stop on terminal events and exponential backoff on errors.

## Task List

### Service Foundation

#### Task Group 1: Core Service Structure
**Dependencies:** None

- [x] 1.0 Complete core service structure
  - [x] 1.1 Write 2-6 focused tests for service foundation
    - Test singleton pattern (same instance returned on multiple calls)
    - Test EventEmitter subscription works (can subscribe and receive fire event)
    - Test dispose() cleans up EventEmitters
    - Test initial state (isPolling returns false, getCurrentWorkflowId returns null)
  - [x] 1.2 Create `DynamoDbPollingService` class implementing `vscode.Disposable`
    - Location: `src/services/dynamoDbPollingService.ts`
    - Private fields for state: `_workflowId`, `_isPolling`, `_lastTimestamp`, `_seenEventKeys`
    - Private field for interval: `_pollIntervalId: NodeJS.Timeout | null`
    - Private field for backoff: `_currentBackoffMs`
    - Follow class structure from `src/services/workflowExecutor.ts`
  - [x] 1.3 Implement VS Code EventEmitter pattern
    - Private `_onEvent = new vscode.EventEmitter<DynamoDbEvent>()`
    - Public `onEvent = this._onEvent.event`
    - Private `_onError = new vscode.EventEmitter<Error>()`
    - Public `onError = this._onError.event`
    - Follow pattern from `src/services/configService.ts`
  - [x] 1.4 Implement lazy singleton pattern
    - Private module-level `let instance: DynamoDbPollingService | null = null`
    - Export `getDynamoDbPollingService(): DynamoDbPollingService` factory function
    - Export `resetDynamoDbPollingService(): void` for testing cleanup
    - Follow pattern from `src/services/dynamoDbClient.ts`
  - [x] 1.5 Implement state accessor methods
    - `isPolling(): boolean` returns `this._isPolling`
    - `getCurrentWorkflowId(): string | null` returns `this._workflowId`
  - [x] 1.6 Implement `dispose()` method
    - Stop polling if active
    - Dispose `_onEvent` and `_onError` EventEmitters
    - Clear all internal state
  - [x] 1.7 Ensure service foundation tests pass
    - Run ONLY the tests written in 1.1
    - Verify singleton pattern works
    - Verify EventEmitters initialize correctly

**Acceptance Criteria:**
- The tests written in 1.1 pass
- Singleton returns same instance on multiple calls
- EventEmitter subscription and firing works
- State methods return correct initial values
- dispose() properly cleans up resources

### DynamoDB Query Layer

#### Task Group 2: Query Implementation
**Dependencies:** Task Group 1

- [x] 2.0 Complete DynamoDB query implementation
  - [x] 2.1 Write 2-6 focused tests for query logic
    - Test query correctly filters by workflow_id and timestamp
    - Test events are sorted ascending by timestamp
    - Test lastTimestamp updates to highest timestamp from results
    - Test deduplication skips already-seen events
  - [x] 2.2 Implement private `_queryEvents()` method
    - Use `getDynamoDbDocumentClientAsync()` from `src/services/dynamoDbClient.ts`
    - Read `tableName` from `getConfigService().getConfig().infrastructure.dynamodb.tableName`
    - Query expression: `workflow_id = :wfId AND #ts > :lastTimestamp`
    - Use `ExpressionAttributeNames: { '#ts': 'timestamp' }` (reserved word)
    - Use `ExpressionAttributeValues: { ':wfId': workflowId, ':lastTimestamp': lastTimestamp }`
  - [x] 2.3 Implement result processing
    - Sort results ascending by `timestamp` field
    - Update `_lastTimestamp` to highest timestamp from results
    - Return sorted array of `DynamoDbEvent` items
  - [x] 2.4 Implement deduplication logic
    - Maintain `_seenEventKeys: Set<string>`
    - Generate key as `${workflow_id}:${timestamp}`
    - Filter out events whose key already exists in set
    - Add new event keys to set after filtering
  - [x] 2.5 Ensure query layer tests pass
    - Run ONLY the tests written in 2.1
    - Verify query construction is correct
    - Verify deduplication works

**Acceptance Criteria:**
- The tests written in 2.1 pass
- Query correctly uses partition key (workflow_id) and sort key (timestamp)
- Results are processed in ascending timestamp order
- Deduplication prevents duplicate event emission
- lastTimestamp advances correctly after each query

### Polling Lifecycle

#### Task Group 3: Lifecycle Management
**Dependencies:** Task Group 2

- [x] 3.0 Complete polling lifecycle management
  - [x] 3.1 Write 2-6 focused tests for lifecycle management
    - Test startPolling() begins polling and sets isPolling to true
    - Test auto-stop on `workflow_complete` event
    - Test auto-stop on `workflow_error` event
    - Test new workflow stops previous polling and clears state
    - Test exponential backoff progression on errors
    - Test backoff resets to 500ms after successful poll
  - [x] 3.2 Implement `startPolling(workflowId: string)` method
    - If already polling different workflow: call `stopPolling()` first
    - If same workflow already polling: return (no-op)
    - Set `_workflowId = workflowId`
    - Set `_isPolling = true`
    - Set `_lastTimestamp = 0` (fetch all events initially)
    - Clear `_seenEventKeys` Set
    - Reset `_currentBackoffMs = 500`
    - Call `_startPollInterval()`
  - [x] 3.3 Implement private `_startPollInterval()` method
    - Clear existing interval if any
    - Set `_pollIntervalId = setInterval(() => this._poll(), this._currentBackoffMs)`
    - Execute first poll immediately with `this._poll()`
  - [x] 3.4 Implement private `_poll()` method
    - If not polling, return early
    - Try: call `_queryEvents()` and process results
    - On success: emit each new event via `_onEvent.fire(event)`
    - On success: check for terminal events and call `_handleTerminalEvent()` if found
    - On success: reset backoff to 500ms, restart interval if backoff changed
    - Catch errors: call `_handlePollError(error)`
  - [x] 3.5 Implement terminal event detection
    - Check each event's `event_type` field
    - Terminal events: `workflow_complete` or `workflow_error`
    - On terminal event: emit the event first, then call `stopPolling()`
  - [x] 3.6 Implement `stopPolling()` method
    - Clear interval: `clearInterval(this._pollIntervalId)`
    - Set `_pollIntervalId = null`
    - Set `_isPolling = false`
    - Keep `_workflowId` for reference (can be cleared in dispose or new start)
  - [x] 3.7 Implement exponential backoff on errors
    - Define backoff sequence: 1000, 2000, 4000, 8000, 16000, 30000 (max)
    - On error: emit error via `_onError.fire(error)`
    - On error: advance to next backoff level (capped at 30000ms)
    - On error: restart interval with new backoff timing
    - On success: reset `_currentBackoffMs = 500`
  - [x] 3.8 Ensure lifecycle management tests pass
    - Run ONLY the tests written in 3.1
    - Verify start/stop lifecycle works
    - Verify terminal event detection stops polling
    - Verify backoff works correctly

**Acceptance Criteria:**
- The tests written in 3.1 pass
- startPolling() initializes state and begins polling
- Polling auto-stops on workflow_complete or workflow_error
- New workflow properly stops previous and starts fresh
- Exponential backoff increases on errors, resets on success
- stopPolling() cleanly stops the interval

### Testing

#### Task Group 4: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-3

- [x] 4.0 Review existing tests and fill critical gaps only
  - [x] 4.1 Review tests from Task Groups 1-3
    - Review the 2-6 tests written for service foundation (Task 1.1)
    - Review the 2-6 tests written for query logic (Task 2.1)
    - Review the 2-6 tests written for lifecycle management (Task 3.1)
    - Total existing tests: approximately 6-18 tests
  - [x] 4.2 Analyze test coverage gaps for THIS feature only
    - Identify critical integration points that lack coverage
    - Focus ONLY on gaps related to the polling service requirements
    - Prioritize end-to-end workflows over unit test gaps
    - Consider: concurrent start calls, rapid start/stop cycles, malformed DynamoDB responses
  - [x] 4.3 Write up to 8 additional strategic tests maximum
    - Add maximum of 8 new tests to fill identified critical gaps
    - Focus on integration between components
    - Suggested gap areas if not covered:
      - Full polling cycle: start -> receive events -> terminal event -> stop
      - Error recovery: error -> backoff -> success -> resume normal
      - Edge case: empty query results
      - Edge case: startPolling called while already polling same workflow
  - [x] 4.4 Run feature-specific tests only
    - Run ONLY tests related to the DynamoDB polling service
    - Expected total: approximately 14-26 tests maximum
    - Do NOT run the entire application test suite
    - Verify all critical workflows pass

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 14-26 tests total)
- Critical user workflows for this feature are covered
- No more than 8 additional tests added when filling in testing gaps
- Testing focused exclusively on the polling service requirements

## Execution Order

Recommended implementation sequence:
1. Service Foundation (Task Group 1) - Establish class structure, singleton, EventEmitters
2. DynamoDB Query Layer (Task Group 2) - Implement query and deduplication logic
3. Polling Lifecycle (Task Group 3) - Implement start/stop, terminal detection, backoff
4. Test Review and Gap Analysis (Task Group 4) - Ensure comprehensive test coverage

## Files to Create/Modify

**New Files:**
- `src/services/dynamoDbPollingService.ts` - Main polling service implementation
- `src/test/dynamoDbPollingService.test.ts` - Test file for polling service

**Existing Files to Reference (read-only):**
- `src/services/dynamoDbClient.ts` - Singleton pattern, DynamoDB client access
- `src/services/configService.ts` - EventEmitter pattern, config access
- `src/services/workflowExecutor.ts` - Disposable pattern, class structure
- `src/types/events.ts` - DynamoDbEvent type definition
- `src/types/config.ts` - AgentifyConfig with infrastructure.dynamodb settings

## Constants Reference

```typescript
// Polling intervals
const BASE_POLL_INTERVAL_MS = 500;
const BACKOFF_SEQUENCE_MS = [1000, 2000, 4000, 8000, 16000, 30000];
const MAX_BACKOFF_MS = 30000;

// Terminal event types
const TERMINAL_EVENT_TYPES = ['workflow_complete', 'workflow_error'];
```

## Integration Notes

After this service is implemented, the `DemoViewerPanel` will integrate with it:
- Call `getDynamoDbPollingService().startPolling(workflowId)` in `handleRunWorkflow()`
- Subscribe to `onEvent` to receive DynamoDB events
- Subscribe to `onError` to handle polling errors
- Subscription automatically disposed when panel is disposed

This integration is OUT OF SCOPE for this spec and will be handled separately.
