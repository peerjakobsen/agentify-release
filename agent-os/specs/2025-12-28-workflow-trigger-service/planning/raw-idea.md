# Raw Feature Idea

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
