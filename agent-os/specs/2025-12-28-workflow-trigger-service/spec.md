# Specification: Workflow Trigger Service

## Goal
Extract subprocess execution logic from `DemoViewerPanel.handleRunWorkflow()` into a dedicated singleton service using vscode.EventEmitter pattern for real-time streaming of raw subprocess I/O.

## User Stories
- As a panel developer, I want to subscribe to raw stdout/stderr events so that I can process workflow output in real-time without promise-based blocking
- As a workflow orchestrator, I want to kill running processes and start new ones synchronously so that I avoid race conditions from overlapping executions

## Specific Requirements

**Singleton Service Pattern**
- Follow the exact pattern from `DynamoDbPollingService` with `getWorkflowTriggerService()` and `resetWorkflowTriggerService()` functions
- Class implements `vscode.Disposable` interface for proper resource cleanup
- Lazy initialization on first `getInstance()` call
- Reset function disposes current instance and sets singleton to null

**Event Emission with vscode.EventEmitter**
- Private `_onStdoutLine` EventEmitter with public `onStdoutLine: Event<string>` for complete stdout lines
- Private `_onStderr` EventEmitter with public `onStderr: Event<string>` for stderr output
- Private `_onProcessStateChange` EventEmitter with public `onProcessStateChange: Event<ProcessState>` for state transitions
- Private `_onProcessExit` EventEmitter with public `onProcessExit: Event<{code: number | null, signal: string | null}>` for process termination
- All EventEmitters disposed in `dispose()` method

**Process State Management**
- `ProcessState` type: `'idle' | 'running' | 'completed' | 'failed' | 'killed'`
- Initial state is `idle`, transitions to `running` on `start()`, then to terminal state on exit
- Fire `onProcessStateChange` event on every state transition
- `getState(): ProcessState` method returns current state

**Line-Buffered stdout Streaming**
- Maintain internal string buffer for incomplete stdout chunks
- Split incoming data on newline characters (`\n`)
- Emit complete lines immediately via `onStdoutLine`
- Hold partial last line in buffer until next chunk completes it
- Flush remaining buffer on process exit (emit if non-empty)

**Subprocess Spawning**
- Use `child_process.spawn()` with `stdio: ['ignore', 'pipe', 'pipe']`
- Command: `{config.workflow.pythonPath}` (default `'python3'`)
- Args array: `[entryScriptPath, '--prompt', prompt, '--workflow-id', workflowId, '--trace-id', traceId]`
- Entry script path resolved relative to workspace root
- Working directory set to workspace root via `cwd` option

**Environment Variables**
- Inherit `process.env` as base
- Add `AGENTIFY_TABLE_NAME` from `config.infrastructure.dynamodb.tableName`
- Add `AGENTIFY_TABLE_REGION` from `config.infrastructure.dynamodb.region`
- Pass env object to spawn options

**ID Generation**
- Import `generateWorkflowId()` and `generateTraceId()` from `src/utils/idGenerator.ts`
- Call both functions in `start()` method before spawning
- Return `{ workflowId, traceId }` from `start()` method

**Graceful Process Termination**
- `kill()` method sends `SIGTERM` first
- Set 1-second timeout, then send `SIGKILL` if process still running
- Transition state to `killed` after termination
- Clear active process reference

**Synchronous Kill on New Start**
- If `start()` called while process is running, call `kill()` first
- Wait for previous process termination before spawning new process
- Prevents stdout handler conflicts from overlapping processes
- `start()` returns `Promise<{ workflowId, traceId }>` to support async kill wait

**Pre-flight Validation**
- Check `config.workflow.entryScript` is configured (not null/undefined)
- Check entry script file exists at resolved path using `fs.existsSync()`
- Throw descriptive error on validation failure before spawning
- Let invalid `pythonPath` fail naturally at spawn time

## Existing Code to Leverage

**DynamoDbPollingService singleton pattern**
- Copy the singleton instance variable, `getInstance()`, and `resetInstance()` function pattern
- Copy the `implements vscode.Disposable` interface structure
- Follow the same EventEmitter declaration style (private `_on*` with public `on*` exposure)

**WorkflowExecutor subprocess logic**
- Migrate the `spawn()` call with stdio configuration
- Migrate CLI argument array construction pattern
- Migrate environment variable setup with DynamoDB config
- Migrate SIGTERM/SIGKILL termination with 1-second timeout

**idGenerator utilities**
- Import directly: `import { generateWorkflowId, generateTraceId } from '../utils/idGenerator'`
- No duplication of ID generation logic

**ConfigService integration**
- Use `getConfigService()` singleton to retrieve workflow and infrastructure config
- Access `config.workflow.entryScript`, `config.workflow.pythonPath`
- Access `config.infrastructure.dynamodb.tableName`, `config.infrastructure.dynamodb.region`

## Out of Scope
- DynamoDB polling (handled by DynamoDbPollingService)
- stdout JSON parsing (handled by future stdout Event Streaming service)
- Event merging from multiple sources (handled by future Merged Event Stream Service)
- UI updates and rendering (handled by DemoViewerPanel which subscribes to events)
- Timer display and elapsed time tracking (handled by DemoViewerPanel)
- Validation of pythonPath existence (let spawn fail if invalid)
- Retry logic for failed processes
- Multiple concurrent workflow executions (one at a time only)
- Process output logging to file
- Workflow result persistence
