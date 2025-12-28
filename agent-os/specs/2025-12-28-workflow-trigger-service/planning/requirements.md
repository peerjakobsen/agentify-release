# Spec Requirements: Workflow Trigger Service

## Initial Description

**Workflow Trigger Service** — Extract subprocess execution logic from `DemoViewerPanel.handleRunWorkflow()` into a dedicated service with clean separation:

**ID Generation:**
- `workflow_id`: `wf-{8-char-uuid}` (e.g., `wf-a1b2c3d4`)
- `trace_id`: 32-char hex string, OTEL-compatible (e.g., `80e1afed08e019fc1110464cfa66635c`)

**Subprocess Spawning:**
- Command: `{workflow.pythonPath} {workflow.entryScript}` from `.agentify/config.json`
- CLI args: `--prompt`, `--workflow-id`, `--trace-id`
- Env vars: `AGENTIFY_TABLE_NAME` (from `infrastructure.dynamodb.tableName`), `AGENTIFY_TABLE_REGION` (from `infrastructure.dynamodb.region`)
- Working directory: workspace root

**Event Emission (vscode.EventEmitter pattern):**
- `onStdoutLine: Event<string>` — raw stdout lines (item 11 parses these)
- `onStderr: Event<string>` — stderr output for error display
- `onProcessStateChange: Event<ProcessState>` — `idle` | `running` | `completed` | `failed` | `killed`
- `onProcessExit: Event<{code: number | null, signal: string | null}>`

**Process Lifecycle:**
- `start(prompt: string): {workflowId, traceId}` — spawns process, returns IDs
- `kill(): void` — terminates current process (for reset/new run)
- `getState(): ProcessState` — current process state
- Only one workflow at a time — calling `start()` while running kills previous process

**Integration:**
- Singleton service (like `DynamoDbPollingService`)
- `DemoViewerPanel.handleRunWorkflow()` calls this service instead of spawning directly
- Panel subscribes to events for UI updates

This service handles raw subprocess I/O; stdout JSON parsing is handled by item 11.

## Requirements Discussion

### First Round Questions

**Q1:** I notice there's already a `WorkflowExecutor` class in `src/services/workflowExecutor.ts` that handles subprocess spawning with a promise-based API. I assume this new Workflow Trigger Service will replace `WorkflowExecutor` with an event-emitter-based approach rather than extending it. Is that correct, or should both coexist?
**Answer:** Replace. The promise-based API doesn't fit real-time streaming needs. The new service uses vscode.EventEmitter pattern to match DynamoDbPollingService. Migration path: Create new WorkflowTriggerService with EventEmitter pattern, update DemoViewerPanel to use new service, delete old WorkflowExecutor class. No coexistence needed — it's the same codebase, clean replacement.

**Q2:** The raw idea specifies ID generation (workflow_id and trace_id) as part of the service. Currently, ID generation lives in `src/utils/idGenerator.ts`. I'm assuming the service will import and use the existing `generateWorkflowId()` and `generateTraceId()` utilities rather than duplicating that logic. Is that correct?
**Answer:** Correct — use existing utilities. The service imports from `src/utils/idGenerator.ts`. No duplication.

**Q3:** For `onStdoutLine`, I'm assuming stdout will be line-buffered so each event contains a complete line (handling cases where data chunks split mid-line). Is that the expected behavior, or should raw chunks be emitted as-is?
**Answer:** Yes, line-buffered. Each `onStdoutLine` event must contain a complete line because item 11 parses JSON Lines format. Internal buffer for incomplete lines, emit complete lines only.

**Q4:** The current `WorkflowExecutor` uses a callback pattern (`onStdout`, `onStderr`, `onComplete`, `onError`). Should the new service support both the EventEmitter pattern AND callbacks for backward compatibility during migration, or is a clean break to EventEmitters only acceptable?
**Answer:** Clean break to EventEmitter only. No backward compatibility needed because: same codebase, same developer; panel will be updated in same PR; old WorkflowExecutor deleted after migration.

**Q5:** For the `kill()` method, the current `WorkflowExecutor.dispose()` uses SIGTERM with a 1-second timeout before SIGKILL. I assume the same graceful termination approach for the new `kill()` method. Is that correct, or should kill be immediate (SIGKILL only)?
**Answer:** Yes, SIGTERM then timeout then SIGKILL. Same pattern as existing `WorkflowExecutor.dispose()` with 1 second grace period. Agents might need to emit `workflow_error` or clean up resources before terminating.

**Q6:** The raw idea states "calling `start()` while running kills previous process." Should this kill be synchronous (wait for termination before spawning new) or fire-and-forget (kill and immediately spawn new)?
**Answer:** Synchronous (wait for termination). Avoids race conditions. Fire-and-forget could cause stdout handler conflicts if old process emits events after new process starts.

**Q7:** Should the service handle any pre-flight validation (e.g., checking if entry script exists, Python path is valid) before attempting to spawn, or should validation remain in the panel layer?
**Answer:** Yes, basic validation in the service. Fail fast with clear errors: check `workflow.entryScript` is configured, check entry script file exists, `pythonPath` validation optional (let spawn fail if invalid). Panel layer handles display of validation errors, service handles detection.

**Q8:** Is there anything that should be explicitly excluded from this service? For example, should the service handle DynamoDB polling coordination, or is that strictly separate?
**Answer:** Yes, these are OUT OF SCOPE: DynamoDB polling (Item 8 - DynamoDbPollingService), stdout JSON parsing (Item 11 - stdout Event Streaming), Event merging (Item 12 - Merged Event Stream Service), UI updates (DemoViewerPanel subscribes to events), Timer display (DemoViewerPanel tracks start time). This service is pure subprocess I/O — spawn, stream raw lines, lifecycle management.

### Existing Code to Reference

**Similar Features Identified:**
- Feature: DynamoDbPollingService - Path: `src/services/dynamoDbPollingService.ts`
  - Singleton pattern with `getInstance()` and `resetInstance()` functions
  - vscode.EventEmitter pattern for `onEvent` and `onError`
  - Lifecycle methods (`startPolling`, `stopPolling`, `dispose`)
  - State tracking (`isPolling()`, `getCurrentWorkflowId()`)
- Feature: WorkflowExecutor (to be replaced) - Path: `src/services/workflowExecutor.ts`
  - Subprocess spawning logic with `child_process.spawn()`
  - CLI argument construction
  - Environment variable setup for DynamoDB
  - Graceful termination with SIGTERM/SIGKILL
- Feature: ID Generator utilities - Path: `src/utils/idGenerator.ts`
  - `generateWorkflowId()` function
  - `generateTraceId()` function

### Follow-up Questions

No follow-up questions needed. All requirements are clear.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
Not applicable — this is a backend service with no UI components.

## Requirements Summary

### Functional Requirements
- Create singleton `WorkflowTriggerService` using vscode.EventEmitter pattern
- Spawn Python subprocess with CLI args (`--prompt`, `--workflow-id`, `--trace-id`)
- Set environment variables (`AGENTIFY_TABLE_NAME`, `AGENTIFY_TABLE_REGION`)
- Line-buffer stdout output (emit complete lines only for JSON Lines parsing)
- Emit events: `onStdoutLine`, `onStderr`, `onProcessStateChange`, `onProcessExit`
- Track process state: `idle` | `running` | `completed` | `failed` | `killed`
- Generate workflow_id and trace_id using existing utilities
- Graceful termination with SIGTERM (1s timeout) then SIGKILL
- Synchronous kill when starting new workflow while one is running
- Pre-flight validation (check entryScript configured, file exists)

### Reusability Opportunities
- Singleton pattern from `DynamoDbPollingService`
- EventEmitter pattern from `DynamoDbPollingService`
- Subprocess spawning from `WorkflowExecutor` (being replaced)
- ID generation from `src/utils/idGenerator.ts`
- Graceful termination pattern from `WorkflowExecutor.dispose()`

### Scope Boundaries

**In Scope:**
- Subprocess spawning and lifecycle management
- Raw stdout line streaming (line-buffered)
- Raw stderr streaming
- Process state tracking and events
- ID generation (using existing utilities)
- Pre-flight validation (config and file existence)
- Graceful process termination
- Singleton service pattern

**Out of Scope:**
- DynamoDB polling (handled by DynamoDbPollingService - Item 8)
- stdout JSON parsing (handled by Item 11 - stdout Event Streaming)
- Event merging (handled by Item 12 - Merged Event Stream Service)
- UI updates (handled by DemoViewerPanel which subscribes to events)
- Timer display (handled by DemoViewerPanel)
- pythonPath validation (let spawn fail if invalid)

### Technical Considerations
- Must replace existing `WorkflowExecutor` class (delete after migration)
- Update `DemoViewerPanel.handleRunWorkflow()` to use new service
- Follow TypeScript patterns from existing services
- Use vscode.EventEmitter for all event emission
- Internal line buffer for handling partial stdout chunks
- Working directory must be workspace root
- Config read from `.agentify/config.json` via ConfigService
