# Task Breakdown: Workflow Trigger Service

## Overview
Total Tasks: 22
Estimated Complexity: Medium (backend service with subprocess management)

This spec creates a new `WorkflowTriggerService` singleton that replaces the existing `WorkflowExecutor` class, using vscode.EventEmitter pattern for real-time subprocess I/O streaming.

## Task List

### Service Foundation

#### Task Group 1: Singleton Service Setup
**Dependencies:** None
**Complexity:** Low

- [x] 1.0 Complete service foundation
  - [x] 1.1 Write 3-5 focused tests for singleton pattern
    - Test `getWorkflowTriggerService()` returns instance
    - Test same instance returned on repeated calls
    - Test `resetWorkflowTriggerService()` disposes and nulls instance
    - Test new instance created after reset
  - [x] 1.2 Create `src/services/workflowTriggerService.ts` with singleton pattern
    - Copy singleton pattern from `DynamoDbPollingService` (see `getDynamoDbPollingService()` and `resetDynamoDbPollingService()` functions)
    - Export `getWorkflowTriggerService()` function
    - Export `resetWorkflowTriggerService()` function
    - Class implements `vscode.Disposable` interface
    - Lazy initialization on first call
  - [x] 1.3 Add ProcessState type and state tracking
    - Define `ProcessState` type: `'idle' | 'running' | 'completed' | 'failed' | 'killed'`
    - Add private `_state: ProcessState` field, initialized to `'idle'`
    - Add public `getState(): ProcessState` method
  - [x] 1.4 Ensure singleton tests pass
    - Run ONLY the 3-5 tests written in 1.1

**Acceptance Criteria:**
- Singleton pattern works correctly
- ProcessState type is exported
- Service implements vscode.Disposable
- Tests pass

---

### Event System

#### Task Group 2: EventEmitter Implementation
**Dependencies:** Task Group 1
**Complexity:** Low

- [x] 2.0 Complete event emitter system
  - [x] 2.1 Write 4-6 focused tests for event emission
    - Test `onStdoutLine` event fires with string payload
    - Test `onStderr` event fires with string payload
    - Test `onProcessStateChange` event fires on state transition
    - Test `onProcessExit` event fires with `{code, signal}` payload
    - Test all emitters disposed in `dispose()` method
  - [x] 2.2 Add stdout line EventEmitter
    - Private `_onStdoutLine = new vscode.EventEmitter<string>()`
    - Public `onStdoutLine = this._onStdoutLine.event`
  - [x] 2.3 Add stderr EventEmitter
    - Private `_onStderr = new vscode.EventEmitter<string>()`
    - Public `onStderr = this._onStderr.event`
  - [x] 2.4 Add process state change EventEmitter
    - Private `_onProcessStateChange = new vscode.EventEmitter<ProcessState>()`
    - Public `onProcessStateChange = this._onProcessStateChange.event`
  - [x] 2.5 Add process exit EventEmitter
    - Define `ProcessExitInfo` interface: `{code: number | null, signal: string | null}`
    - Private `_onProcessExit = new vscode.EventEmitter<ProcessExitInfo>()`
    - Public `onProcessExit = this._onProcessExit.event`
  - [x] 2.6 Implement dispose() method
    - Call `dispose()` on all four EventEmitters
    - Clear any active process reference
    - Reset state to `'idle'`
  - [x] 2.7 Ensure event emitter tests pass
    - Run ONLY the 4-6 tests written in 2.1

**Acceptance Criteria:**
- All four EventEmitters declared (stdout, stderr, state change, exit)
- Public events properly exposed
- dispose() cleans up all emitters
- Tests pass

---

### Core Logic

#### Task Group 3: Line-Buffered stdout Streaming
**Dependencies:** Task Group 2
**Complexity:** Medium

- [x] 3.0 Complete line buffering logic
  - [x] 3.1 Write 4-6 focused tests for line buffering
    - Test complete line emitted immediately
    - Test partial line held in buffer
    - Test multiple lines in single chunk split correctly
    - Test partial line completed by next chunk
    - Test buffer flushed on process exit (non-empty content)
    - Test empty buffer not flushed on exit
  - [x] 3.2 Add stdout buffer field
    - Private `_stdoutBuffer: string = ''`
  - [x] 3.3 Implement `_handleStdoutData(data: Buffer)` method
    - Convert Buffer to string
    - Append to `_stdoutBuffer`
    - Split on newline character (`\n`)
    - Emit all complete lines via `_onStdoutLine.fire()`
    - Retain incomplete last segment in buffer
  - [x] 3.4 Implement `_flushStdoutBuffer()` method
    - Check if `_stdoutBuffer` is non-empty
    - If non-empty, emit remaining content via `_onStdoutLine.fire()`
    - Clear buffer to empty string
  - [x] 3.5 Ensure line buffering tests pass
    - Run ONLY the 4-6 tests written in 3.1

**Acceptance Criteria:**
- Complete lines emitted immediately
- Partial lines buffered correctly
- Buffer flushed on process exit
- Tests pass

---

#### Task Group 4: Subprocess Spawning
**Dependencies:** Task Groups 2, 3
**Complexity:** Medium

- [x] 4.0 Complete subprocess spawning
  - [x] 4.1 Write 5-7 focused tests for spawning
    - Test `start()` returns `{workflowId, traceId}`
    - Test state transitions to `'running'` on start
    - Test spawn called with correct pythonPath and args
    - Test environment variables include AGENTIFY_TABLE_NAME and AGENTIFY_TABLE_REGION
    - Test cwd set to workspace root
    - Test validation error thrown when entryScript not configured
    - Test validation error thrown when entry script file not found
    - Test spawn uses pythonPath from config (or defaults to 'python')
  - [x] 4.2 Add process reference field
    - Private `_activeProcess: ChildProcess | null = null`
    - Import `{ spawn, ChildProcess }` from `'child_process'`
  - [x] 4.3 Implement pre-flight validation
    - Check `config.workflow.entryScript` is not null/undefined
    - Check entry script file exists via `fs.existsSync()`
    - Throw descriptive Error on validation failure
    - Import `* as fs` from `'fs'`
  - [x] 4.4 Implement `start(prompt: string): Promise<{workflowId, traceId}>` method
    - Generate IDs using `generateWorkflowId()` and `generateTraceId()` from `'../utils/idGenerator'`
    - Get config via `getConfigService()`
    - Get pythonPath from `config.workflow.pythonPath`, defaulting to `'python'` if not set
    - Run pre-flight validation
    - Build entry script path relative to workspace root
    - Build args array: `[entryScriptPath, '--prompt', prompt, '--workflow-id', workflowId, '--trace-id', traceId]`
    - Spawn command is pythonPath, args array starts with entryScriptPath
    - Build env object: spread `process.env`, add AGENTIFY_TABLE_NAME, add AGENTIFY_TABLE_REGION
    - Call `spawn(pythonPath, args, { stdio: ['ignore', 'pipe', 'pipe'], cwd: workspaceRoot, env: envObject })`
    - Update state to `'running'`, fire `_onProcessStateChange`
    - Wire stdout.on('data') to `_handleStdoutData()`
    - Wire stderr.on('data') to `_onStderr.fire()`
    - Return `{workflowId, traceId}`
  - [x] 4.5 Implement process exit handling
    - Listen to `'close'` event on spawned process
    - Call `_flushStdoutBuffer()`
    - Determine terminal state: `'completed'` if code === 0, else `'failed'`
    - Update state, fire `_onProcessStateChange`
    - Fire `_onProcessExit` with `{code, signal}`
    - Clear `_activeProcess` to null
  - [x] 4.6 Implement spawn error handling
    - Listen to `'error'` event on spawned process
    - Update state to `'failed'`, fire `_onProcessStateChange`
    - Fire `_onProcessExit` with `{code: null, signal: null}`
    - Clear `_activeProcess` to null
  - [x] 4.7 Ensure subprocess spawning tests pass
    - Run ONLY the 5-7 tests written in 4.1

**Acceptance Criteria:**
- start() generates and returns IDs
- Subprocess spawned with correct config
- State transitions properly
- Pre-flight validation works
- Tests pass

---

#### Task Group 5: Process Termination
**Dependencies:** Task Group 4
**Complexity:** Medium

- [x] 5.0 Complete process termination
  - [x] 5.1 Write 4-5 focused tests for termination
    - Test `kill()` sends SIGTERM to active process
    - Test SIGKILL sent after 1-second timeout if still running
    - Test state transitions to `'killed'`
    - Test `start()` while running kills previous process first
    - Test new process not spawned until previous terminates
  - [x] 5.2 Implement `kill(): Promise<void>` method
    - Guard: return immediately if no active process
    - Send SIGTERM to `_activeProcess`
    - Set 1-second timeout
    - After timeout, check if process still running, send SIGKILL
    - Return Promise that resolves when process terminates
    - Update state to `'killed'`, fire `_onProcessStateChange`
    - Clear `_activeProcess` to null
  - [x] 5.3 Add synchronous kill on new start
    - At beginning of `start()`, check if `_activeProcess` is not null
    - If running, call `await this.kill()`
    - Wait for termination before proceeding with spawn
  - [x] 5.4 Ensure termination tests pass
    - Run ONLY the 4-5 tests written in 5.1

**Acceptance Criteria:**
- kill() terminates with SIGTERM then SIGKILL
- State transitions to 'killed'
- start() waits for previous process to terminate
- Tests pass

---

### Integration

#### Task Group 6: DemoViewerPanel Integration
**Dependencies:** Task Groups 1-5
**Complexity:** Medium

- [x] 6.0 Complete panel integration
  - [x] 6.1 Write 3-4 focused integration tests
    - Test handleRunWorkflow calls WorkflowTriggerService.start()
    - Test panel subscribes to onProcessStateChange for state updates
    - Test panel subscribes to onProcessExit for completion handling
    - Test panel handles service validation errors
  - [x] 6.2 Update DemoViewerPanel imports
    - Add import `{ getWorkflowTriggerService, WorkflowTriggerService }` from `'../services/workflowTriggerService'`
    - Keep existing imports until migration complete
  - [x] 6.3 Replace WorkflowExecutor field with WorkflowTriggerService
    - Change `_workflowExecutor: WorkflowExecutor` to `_workflowTriggerService: WorkflowTriggerService`
    - Initialize via `getWorkflowTriggerService()` instead of `new WorkflowExecutor()`
  - [x] 6.4 Subscribe to service events in constructor/initialization
    - Subscribe to `onProcessStateChange` for UI state updates
    - Subscribe to `onProcessExit` for completion/error handling
    - Subscribe to `onStderr` if stderr display needed
    - Store disposables for cleanup
  - [x] 6.5 Rewrite handleRunWorkflow() to use new service
    - Remove promise-based `execute()` call
    - Call `await this._workflowTriggerService.start(prompt)`
    - Receive `{workflowId, traceId}` from return value
    - State updates now handled via event subscriptions
    - Handle validation errors in try/catch
  - [x] 6.6 Update dispose() to clean up subscriptions
    - Dispose event subscription disposables
    - Do NOT dispose the singleton service itself
  - [x] 6.7 Ensure integration tests pass
    - Run ONLY the 3-4 tests written in 6.1

**Acceptance Criteria:**
- DemoViewerPanel uses WorkflowTriggerService
- Event subscriptions properly wired
- handleRunWorkflow() uses event-driven approach
- Tests pass

---

### Cleanup

#### Task Group 7: Legacy Code Removal
**Dependencies:** Task Group 6
**Complexity:** Low

- [x] 7.0 Complete cleanup
  - [x] 7.1 Verify all WorkflowExecutor usages removed
    - Search codebase for `WorkflowExecutor` imports
    - Search for `workflowExecutor.ts` references
    - Confirm no remaining usages
  - [x] 7.2 Delete `src/services/workflowExecutor.ts`
    - Remove the entire file
    - This is the old callback-based implementation
  - [x] 7.3 Remove WorkflowExecutor from any barrel exports
    - Check `src/services/index.ts` if exists
    - Remove any re-exports of WorkflowExecutor
  - [x] 7.4 Clean up unused imports in DemoViewerPanel
    - Remove `WorkflowExecutor` import
    - Remove `ExecutionCallbacks` import if no longer used
    - Remove any other orphaned imports

**Acceptance Criteria:**
- WorkflowExecutor.ts file deleted
- No references to old class remain
- No unused imports in codebase

---

### Verification

#### Task Group 8: Test Review and Full Verification
**Dependencies:** Task Groups 1-7
**Complexity:** Low

- [x] 8.0 Verify complete implementation
  - [x] 8.1 Review tests from Task Groups 1-6
    - Review singleton tests (Task 1.1): 3-5 tests
    - Review event emitter tests (Task 2.1): 4-6 tests
    - Review line buffering tests (Task 3.1): 4-6 tests
    - Review subprocess tests (Task 4.1): 5-7 tests
    - Review termination tests (Task 5.1): 4-5 tests
    - Review integration tests (Task 6.1): 3-4 tests
    - Total: approximately 23-33 tests
  - [x] 8.2 Identify critical workflow gaps
    - Verify end-to-end workflow execution path tested
    - Verify error scenarios covered
    - Verify state machine transitions covered
  - [x] 8.3 Add up to 5 additional tests if critical gaps found
    - Focus on integration between components
    - Focus on edge cases in real usage scenarios
    - Do NOT exceed 5 additional tests
  - [x] 8.4 Run all feature-specific tests
    - Run all WorkflowTriggerService tests
    - Run all DemoViewerPanel integration tests
    - Verify no regressions
  - [x] 8.5 Manual verification
    - Test workflow execution in VS Code extension
    - Verify stdout streaming works in real-time
    - Verify process kill/restart behavior
    - Verify error display on validation failures

**Acceptance Criteria:**
- All feature tests pass (approximately 28-38 total)
- Manual verification confirms expected behavior
- No regressions in existing functionality

---

## Execution Order

Recommended implementation sequence:

```
Task Group 1: Singleton Service Setup
       |
       v
Task Group 2: EventEmitter Implementation
       |
       v
Task Group 3: Line-Buffered stdout Streaming
       |
       v
Task Group 4: Subprocess Spawning
       |
       v
Task Group 5: Process Termination
       |
       v
Task Group 6: DemoViewerPanel Integration
       |
       v
Task Group 7: Legacy Code Removal
       |
       v
Task Group 8: Test Review and Full Verification
```

## Files to Create/Modify/Delete

### Create
- `src/services/workflowTriggerService.ts` - New singleton service

### Modify
- `src/panels/demoViewerPanel.ts` - Update to use new service

### Delete
- `src/services/workflowExecutor.ts` - Remove legacy implementation

## Reference Files

| File | Purpose |
|------|---------|
| `src/services/dynamoDbPollingService.ts` | Singleton and EventEmitter patterns |
| `src/services/workflowExecutor.ts` | Subprocess spawning logic to migrate |
| `src/utils/idGenerator.ts` | ID generation utilities to import |
| `src/services/configService.ts` | Config access pattern |

## Risk Areas

1. **Line buffering edge cases** - Ensure partial lines across chunks handled correctly
2. **Race condition on kill/start** - Ensure synchronous wait for termination
3. **Event subscription cleanup** - Ensure no memory leaks from orphaned subscriptions
4. **State machine consistency** - Ensure state never gets stuck in intermediate state
