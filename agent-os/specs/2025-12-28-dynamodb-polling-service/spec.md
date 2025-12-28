# Specification: DynamoDB Polling Service

## Goal
Implement a polling service that fetches workflow events from DynamoDB at regular intervals, emits them to subscribers via VS Code EventEmitter, and manages its own lifecycle including automatic stop on terminal events and exponential backoff on errors.

## User Stories
- As a developer running a workflow, I want to see DynamoDB events (tool calls, agent spans) appear in real-time so that I can observe agent behavior beyond stdout streaming
- As a developer, I want the polling to automatically stop when the workflow completes or errors so that resources are not wasted

## Specific Requirements

**Singleton Service Pattern**
- Create `DynamoDbPollingService` class implementing `vscode.Disposable`
- Use lazy singleton pattern similar to `dynamoDbClient.ts` with `getDynamoDbPollingService()` factory function
- Service instance survives across workflow runs; only polling state resets
- Provide `resetDynamoDbPollingService()` for testing and cleanup

**VS Code EventEmitter Integration**
- Expose `onEvent: vscode.Event<DynamoDbEvent>` for event subscribers
- Expose `onError: vscode.Event<Error>` for error subscribers
- EventEmitters disposed in `dispose()` method
- Follow pattern established in `configService.ts` for event subscription

**Polling Lifecycle**
- `startPolling(workflowId: string)` begins polling for a specific workflow
- Initial poll fetches ALL events (timestamp > 0) to catch events emitted before polling started
- Poll interval: 500ms between successful polls
- Auto-stop on receiving `workflow_complete` or `workflow_error` event (check `event_type` field)
- If new workflow starts while polling active: stop current, clear state, start fresh
- Stop polling when subscriber count drops to 0 (reference counting via subscription tracking)

**DynamoDB Query Implementation**
- Use `getDynamoDbDocumentClientAsync()` from existing `dynamoDbClient.ts`
- Read `tableName` and `region` from `ConfigService.getConfig().infrastructure.dynamodb`
- Query expression: `workflow_id = :wfId AND #ts > :lastTimestamp`
- Use `#ts` as expression attribute name for `timestamp` (reserved word)
- Sort results ascending by timestamp to process events in order
- Update `lastTimestamp` to highest timestamp from results after each poll

**Deduplication Logic**
- Maintain `Set<string>` of seen event keys
- Key format: `${workflow_id}:${timestamp}` (composite primary key is already unique)
- Skip emitting events already in the seen set
- Clear seen set when `startPolling()` called with new workflow_id

**Exponential Backoff on Errors**
- On DynamoDB error: 1s -> 2s -> 4s -> 8s -> 16s -> 30s (max)
- Reset to 500ms immediately after successful poll
- Emit error via `onError` EventEmitter on each failure
- Continue polling with backoff until explicitly stopped or workflow terminal event received

**Service State Methods**
- `isPolling(): boolean` returns whether actively polling
- `getCurrentWorkflowId(): string | null` returns current workflow or null
- `stopPolling(): void` manually stops polling and clears interval
- `dispose(): void` stops polling and disposes all EventEmitters

## Existing Code to Leverage

**`src/services/dynamoDbClient.ts`**
- Use `getDynamoDbDocumentClientAsync()` for DynamoDB DocumentClient access
- Client already configured with region, credentials, and retry strategy
- Do NOT create new DynamoDB client; reuse existing singleton

**`src/services/configService.ts`**
- Reference `vscode.EventEmitter<T>` pattern for `onEvent` and `onError` events
- Use `getConfigService().getConfig()` to read `infrastructure.dynamodb.tableName` and `region`
- Follow subscription disposal pattern with `vscode.Disposable` return type

**`src/services/workflowExecutor.ts`**
- Reference `dispose()` pattern for resource cleanup
- Follow class structure with private members and public interface
- Note: polling service does NOT use subprocess; only DynamoDB queries

**`src/types/events.ts`**
- Use existing `DynamoDbEvent` type (union of `ToolCallEvent | AgentSpanEvent`)
- Events have `event_type` field (not `type`) to distinguish from stdout events
- Check `event_type === 'workflow_complete'` or `event_type === 'workflow_error'` for terminal detection

**`src/panels/demoViewerPanel.ts`**
- Panel will call `startPolling(workflowId)` in `handleRunWorkflow()` after generating workflow_id
- Panel subscribes to `onEvent` and `onError` to receive events
- Panel disposes subscription when disposed (reducing subscriber count)

## Out of Scope
- Merged event stream service combining stdout + DynamoDB events (separate spec item #12)
- Panel UI changes for displaying DynamoDB events
- DynamoDB table creation or schema changes (table already exists per spec item #1)
- Stdout event parsing (handled by separate existing service)
- Concurrent polling for multiple workflows (single workflow at a time)
- Pagination handling for DynamoDB query results (assume results fit in single response)
- WebSocket or push-based alternatives to polling
- Caching of events beyond deduplication set
- Metrics or logging of polling performance
- Unit tests (will be added in implementation phase)
