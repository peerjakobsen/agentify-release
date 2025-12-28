# Spec Requirements: DynamoDB Polling Service

## Initial Description

Implement polling service for workflow events:
1. Poll `infrastructure.dynamodb.tableName` every 500ms using AWS SDK DocumentClient
2. Query by `workflow_id` (partition key) with `timestamp` (sort key) greater than last-polled timestamp to fetch only new events
3. Start polling when `handleRunWorkflow()` generates a workflow_id
4. Stop polling on `workflow_complete`/`workflow_error` event, panel dispose, or new workflow run
5. Exponential backoff on errors (1s, 2s, 4s, max 30s) with automatic recovery
6. Emit events to subscribers (for merging with stdout stream)
7. Track seen event IDs for deduplication

Service is separate from panel lifecycle - panel subscribes to events, service manages AWS calls.

## Requirements Discussion

### First Round Questions

**Q1:** I assume the polling service should be a standalone singleton that the `DemoViewerPanel` creates/subscribes to during `handleRunWorkflow()`, and then the service automatically stops when it receives a terminal event (`workflow_complete` or `workflow_error`). Is that correct, or should the panel explicitly call a `stop()` method after receiving the terminal event?

**Answer:** Auto-stop on terminal events is correct. The service should be a singleton that:
- Starts polling when `handleRunWorkflow()` calls `startPolling(workflowId)`
- Auto-stops when it receives `workflow_complete` or `workflow_error`
- No explicit `stop()` needed for terminal events
The panel doesn't need to know about terminal events for stopping purposes - the service handles its own lifecycle.

**Q2:** Looking at the DynamoDB table schema (partition key: `workflow_id`, sort key: `timestamp`), I'm thinking we should track seen events using a `Set<string>` where the key is `${workflow_id}:${timestamp}:${event_type}`. Should we also include `agent_name` in the deduplication key to handle edge cases where two agents emit events at the exact same millisecond?

**Answer:** Use `${workflow_id}:${timestamp}` only. Since workflow_id (PK) + timestamp (SK) is the DynamoDB primary key, items are already unique by definition. Deduplication protects against network retries and edge cases in timestamp-based pagination.

**Q3:** I assume the service should use an EventEmitter-style pattern where the panel subscribes with callbacks like `onEvent(event: DynamoDbEvent)` and `onError(error: Error)`. Is that correct, or would you prefer an RxJS Observable pattern or a VS Code EventEmitter (`vscode.EventEmitter<T>`)?

**Answer:** Use `vscode.EventEmitter<T>` - idiomatic for VS Code extensions, integrates with Disposable pattern:
```typescript
export class DynamoDbPollingService implements vscode.Disposable {
  private readonly _onEvent = new vscode.EventEmitter<DynamoDbEvent>();
  readonly onEvent = this._onEvent.event;

  private readonly _onError = new vscode.EventEmitter<Error>();
  readonly onError = this._onError.event;
}
```

**Q4:** For exponential backoff (1s, 2s, 4s, max 30s), should the service automatically reset the backoff timer to 500ms after a successful poll, or should it gradually step down (30s -> 15s -> 7s -> ... -> 500ms) to avoid hammering the API after a transient outage?

**Answer:** Immediate reset to 500ms after successful poll. Simplicity wins for a demo tool - resume normal polling immediately to catch up on missed events.

**Q5:** When a new workflow run starts while polling is still active for a previous run, I assume we should: (1) immediately stop polling for the old workflow_id, (2) clear the seen event IDs set, and (3) start fresh polling for the new workflow_id. Is that the expected behavior, or should we allow concurrent polling for multiple workflows?

**Answer:** Stop, clear, start fresh. No concurrent polling. One workflow at a time is the expected usage pattern for this demo tool.

**Q6:** The spec mentions "panel subscribes to events, service manages AWS calls." If the panel is disposed (user closes sidebar), should the polling service continue running in the background (consuming resources but ready for re-subscription), or should it stop polling until a panel re-subscribes?

**Answer:** Stop polling when no subscribers remain, but keep the service instance alive. Use reference counting:
- Panel disposed -> subscriber count drops to 0 -> polling stops
- Panel reopened -> new subscription -> can call `startPolling()` if workflow still running
- Service singleton survives for reuse

**Q7:** When polling starts, should we fetch ALL events for the workflow_id (timestamp > 0), or should we only fetch events from the moment polling starts (timestamp > Date.now())? The former would catch events that occurred before the extension connected; the latter would be more efficient for long-running workflows.

**Answer:** Fetch ALL events for the workflow_id (timestamp > 0). The workflow process starts before polling begins, so events may already be in DynamoDB by the time we start polling. Need the complete picture.

### Existing Code to Reference

**Similar Features Identified:**
- Service: `src/services/dynamoDbClient.ts` - DynamoDB DocumentClient singleton pattern with lazy initialization
- Service: `src/services/workflowExecutor.ts` - Lifecycle management pattern with dispose(), subprocess handling
- Service: `src/services/configService.ts` - VS Code EventEmitter pattern for `onConfigChanged`
- Panel: `src/panels/demoViewerPanel.ts` - Subscriber pattern, `addLogEntry()` / `addLogEntries()` methods for event handling
- Types: `src/types/events.ts` - `DynamoDbEvent`, `ToolCallEvent`, `AgentSpanEvent` type definitions
- Types: `src/types/config.ts` - `AgentifyConfig` with `infrastructure.dynamodb.tableName` and `region`

### Follow-up Questions

No follow-up questions needed - all requirements are clear.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A

## Requirements Summary

### Functional Requirements

**Core Polling Behavior:**
- Poll DynamoDB table every 500ms using AWS SDK DocumentClient
- Query by `workflow_id` (partition key) with `timestamp` (sort key) greater than last-polled timestamp
- Fetch ALL events for workflow_id on initial poll (timestamp > 0)
- Emit events to subscribers via `vscode.EventEmitter<DynamoDbEvent>`
- Emit errors via separate `vscode.EventEmitter<Error>`

**Lifecycle Management:**
- Start polling when `startPolling(workflowId)` is called
- Auto-stop on terminal events (`workflow_complete` or `workflow_error`)
- Stop and clear state when new workflow starts (no concurrent polling)
- Stop polling when subscriber count drops to 0 (reference counting)
- Service singleton survives for reuse after stopping

**Error Handling:**
- Exponential backoff on errors: 1s, 2s, 4s, max 30s
- Immediate reset to 500ms after successful poll
- Automatic recovery after transient failures

**Deduplication:**
- Track seen events using `Set<string>` with key `${workflow_id}:${timestamp}`
- Protects against network retries and pagination edge cases

### Reusability Opportunities

**Existing Patterns to Follow:**
- Singleton pattern from `dynamoDbClient.ts`
- `vscode.EventEmitter<T>` pattern from `configService.ts`
- `vscode.Disposable` implementation pattern from `workflowExecutor.ts`
- Event type definitions from `src/types/events.ts`

**Integration Points:**
- Use `getDynamoDbDocumentClientAsync()` from `dynamoDbClient.ts`
- Read table config from `AgentifyConfig.infrastructure.dynamodb`
- Panel calls `startPolling(workflowId)` from `handleRunWorkflow()`
- Panel subscribes to `onEvent` and `onError` events

### Scope Boundaries

**In Scope:**
- DynamoDB polling service implementation
- Event emission to subscribers
- Deduplication logic
- Exponential backoff with automatic recovery
- Reference counting for subscriber management
- Auto-stop on terminal events
- Stop/clear/restart on new workflow

**Out of Scope:**
- Merged event stream service (combining stdout + DynamoDB) - separate spec item #12
- Panel UI changes for displaying DynamoDB events
- DynamoDB table creation (already exists - spec item #1)
- stdout event parsing (separate service exists)

### Technical Considerations

**Service Interface:**
```typescript
export class DynamoDbPollingService implements vscode.Disposable {
  // Events
  private readonly _onEvent = new vscode.EventEmitter<DynamoDbEvent>();
  readonly onEvent = this._onEvent.event;

  private readonly _onError = new vscode.EventEmitter<Error>();
  readonly onError = this._onError.event;

  // Lifecycle
  startPolling(workflowId: string): void;
  stopPolling(): void;
  dispose(): void;

  // State
  isPolling(): boolean;
  getCurrentWorkflowId(): string | null;
}
```

**Polling Constants:**
- Base interval: 500ms
- Backoff sequence: 1000ms, 2000ms, 4000ms, 8000ms, 16000ms, 30000ms (max)
- Reset to 500ms after successful poll

**DynamoDB Query Pattern:**
- Table: `infrastructure.dynamodb.tableName` from config
- Region: `infrastructure.dynamodb.region` from config
- Query: `workflow_id = :wfId AND timestamp > :lastTimestamp`
- Sort: Ascending by timestamp
- Initial lastTimestamp: 0 (fetch all events)

**Dependencies:**
- `@aws-sdk/lib-dynamodb` (DynamoDBDocumentClient)
- `vscode` (EventEmitter, Disposable)
- Existing `getDynamoDbDocumentClientAsync()` from `dynamoDbClient.ts`
- Existing `ConfigService` for reading table configuration
