# Task Breakdown: Workflow Input Panel

## Overview
Total Tasks: 4 Task Groups (approximately 28 sub-tasks)

This spec implements the Demo Viewer input panel for the Agentify VS Code extension, enabling users to enter prompts and spawn workflow executions with proper identity tracking, validation, and execution timing.

## Task List

### Core Infrastructure

#### Task Group 1: Types, State Machine, and Utilities
**Dependencies:** None

- [x] 1.0 Complete core infrastructure layer
  - [x] 1.1 Write 2-8 focused tests for core utilities
    - Test workflow ID generation format (`wf-` + 8 alphanumeric chars)
    - Test trace ID generation format (32-char lowercase hex)
    - Test state machine transitions (Ready -> Running -> Completed/Error)
    - Test timer formatting (MM:SS and MM:SS.d formats)
  - [x] 1.2 Create input panel types in `src/types/inputPanel.ts`
    - Define `InputPanelState` enum: `Ready`, `Running`, `Completed`, `Error`
    - Define `ValidationError` interface with `type` and `message` fields
    - Define `ValidationState` interface with `isValid` and `errors` array
    - Define `WorkflowExecution` interface with `workflowId`, `traceId`, `startTime`, `endTime`, `status` (completed/error), `error`
    - Export types from `src/types/index.ts`
  - [x] 1.3 Create ID generation utilities in `src/utils/idGenerator.ts`
    - `generateWorkflowId()`: Returns `wf-` + `crypto.randomUUID().slice(0,8)`
    - `generateTraceId()`: Returns `crypto.randomUUID().replace(/-/g, '')`
    - Document OTEL compatibility for trace ID
  - [x] 1.4 Create timer formatting utility in `src/utils/timerFormatter.ts`
    - `formatTime(ms: number, showDecimal: boolean)`: Returns `MM:SS` or `MM:SS.d`
    - Handle edge cases (0ms, large values)
    - Return `--:--` for null/undefined input
  - [x] 1.5 Create state machine helper in `src/utils/inputPanelStateMachine.ts`
    - Define valid state transitions
    - `canTransition(from: InputPanelState, to: InputPanelState): boolean`
    - `getNextState(current: InputPanelState, event: string): InputPanelState`
  - [x] 1.6 Ensure core infrastructure tests pass
    - Run ONLY the 2-8 tests written in 1.1
    - Verify all utility functions work correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-8 tests written in 1.1 pass
- Workflow ID format matches `wf-xxxxxxxx` pattern
- Trace ID is 32-character lowercase hex string
- Timer formats correctly for all states
- State machine prevents invalid transitions

---

### Validation Layer

#### Task Group 2: Input Panel Validation Service
**Dependencies:** Task Group 1

- [x] 2.0 Complete validation layer
  - [x] 2.1 Write 2-8 focused tests for validation service
    - Test entry script validation (file exists check via `vscode.workspace.fs.stat()`)
    - Test AWS credential validation integration with `validateCredentialsOnActivation()`
    - Test project initialization validation via `configService.isInitialized()`
    - Test combined validation result aggregation
  - [x] 2.2 Create validation service in `src/services/inputPanelValidation.ts`
    - Create `InputPanelValidationService` class
    - Inject `ConfigService` dependency via constructor
    - Add method `validateEntryScript(entryScriptPath: string): Promise<ValidationError | null>`
      - Check file exists using `vscode.workspace.fs.stat()`
      - Return error if file not found, null if valid
    - Add method `validateAwsCredentials(): Promise<ValidationError | null>`
      - Use existing `validateCredentialsOnActivation()` from credentialValidation service
      - Map `StatusState` to `ValidationError` or null
    - Add method `validateProjectInitialized(): Promise<ValidationError | null>`
      - Use `configService.isInitialized()`
      - Return error if not initialized, null if valid
  - [x] 2.3 Implement combined validation method
    - Add method `validateAll(): Promise<ValidationState>`
    - Run all three validations
    - Aggregate errors into single `ValidationState` result
    - Return `{ isValid: true, errors: [] }` when all pass
  - [x] 2.4 Add validation caching and invalidation
    - Cache validation results to avoid redundant checks
    - Expose `invalidateCache()` method for config change triggers
    - Auto-invalidate when `configService.onConfigChanged` fires
  - [x] 2.5 Export validation service from services index
    - Add `getInputPanelValidationService()` singleton getter
    - Follow existing pattern from `configService.ts`
  - [x] 2.6 Ensure validation layer tests pass
    - Run ONLY the 2-8 tests written in 2.1
    - Verify validation correctly identifies all error conditions
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-8 tests written in 2.1 pass
- Entry script validation detects missing files
- AWS credential validation integrates with existing service
- Project initialization validation works correctly
- Combined validation aggregates all errors

---

### Workflow Execution Layer

#### Task Group 3: Subprocess Spawning and Process Management
**Dependencies:** Task Groups 1, 2

- [x] 3.0 Complete workflow execution layer
  - [x] 3.1 Write 2-8 focused tests for workflow execution
    - Test subprocess spawn with correct CLI arguments (`--prompt`, `--workflow-id`, `--trace-id`)
    - Test environment variables passed to subprocess (`AGENTIFY_TABLE_NAME`, `AGENTIFY_TABLE_REGION`)
    - Test execution state management (start, complete, error transitions)
    - Test timer start/stop integration
  - [x] 3.2 Create workflow executor service in `src/services/workflowExecutor.ts`
    - Create `WorkflowExecutor` class
    - Inject `ConfigService` dependency
    - Store reference to active `ChildProcess` for cleanup
    - Add method `getWorkflowConfig()`: Read `workflow.entryScript`, `workflow.pythonPath` from config
    - Add method `getDynamoDbEnv()`: Read `infrastructure.dynamodb.tableName`, `infrastructure.dynamodb.region`
  - [x] 3.3 Implement subprocess spawning
    - Add method `execute(prompt: string, workflowId: string, traceId: string): Promise<WorkflowExecution>`
    - Use `child_process.spawn()` with `workflow.pythonPath` as interpreter
    - Pass entry script as first argument
    - Add CLI arguments: `--prompt`, `--workflow-id`, `--trace-id` with corresponding values
    - Handle proper escaping for prompt text containing quotes, newlines, or special characters
    - Use `spawn()` with args array (not string concatenation) for safe argument passing
    - Set environment variables: `AGENTIFY_TABLE_NAME`, `AGENTIFY_TABLE_REGION`
    - Handle stdout/stderr for debugging
  - [x] 3.4 Implement execution lifecycle callbacks
    - Add `onStart` callback for timer start
    - Add `onComplete` callback for successful completion
    - Add `onError` callback for subprocess failures
    - Track start time and end time for duration calculation
  - [x] 3.5 Implement cleanup and disposal
    - Add method `dispose()`: Kill any running subprocess
    - Clear interval references
    - Prevent orphan processes on panel close
  - [x] 3.6 Ensure workflow execution tests pass
    - Run ONLY the 2-8 tests written in 3.1
    - Verify subprocess spawns with correct configuration
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-8 tests written in 3.1 pass
- Subprocess spawns with correct Python interpreter
- CLI arguments are properly formatted and passed
- Environment variables are correctly set
- Execution lifecycle events fire appropriately
- Cleanup properly terminates running processes

---

### Webview UI Layer

#### Task Group 4: Input Panel Webview Implementation
**Dependencies:** Task Groups 1, 2, 3

- [x] 4.0 Complete webview UI layer
  - [x] 4.1 Write 2-8 focused tests for webview panel
    - Test message handling for `runWorkflow`, `resetPanel`, `copyToClipboard` commands
    - Test state persistence/restoration for `promptText` and `lastWorkflowId`
    - Test validation error display triggers Run button disabled state
    - Test webview content updates based on panel state
  - [x] 4.2 Extend `DemoViewerPanelProvider` with input panel state
    - Add private fields: `_currentState: InputPanelState`, `_currentExecution: WorkflowExecution | null`
    - Add private fields: `_timerInterval: NodeJS.Timeout | null`, `_elapsedMs: number`
    - Add private fields: `_validationState: ValidationState`
    - Pass `ExtensionContext` to constructor for workspaceState access
    - Initialize state from persisted `workspaceState` on resolve
  - [x] 4.3 Implement workspaceState persistence
    - Add method `persistPromptText(text: string)`: Save to `agentify.demoViewer.promptText`
    - Add method `persistLastWorkflowId(id: string)`: Save to `agentify.demoViewer.lastWorkflowId`
    - Add method `loadPersistedState()`: Restore prompt text and last workflow ID on panel open
    - Use `context.workspaceState.get()` and `context.workspaceState.update()`
  - [x] 4.4 Implement timer management
    - Add method `startTimer()`: Begin 100ms interval, update `_elapsedMs`
    - Add method `stopTimer()`: Clear interval, record final time
    - Add method `resetTimer()`: Clear interval, reset to `--:--` display
    - Send timer updates to webview via `postMessage()`
  - [x] 4.5 Implement message handlers in `handleMessage()`
    - Handle `runWorkflow`: Validate, generate IDs, call executor, start timer
      - Note: Do NOT clear prompt text on completion (user may want to tweak and re-run)
    - Handle `resetPanel`: Stop timer, clear execution state, update webview
    - Handle `copyToClipboard`: Use `vscode.env.clipboard.writeText()`
    - Handle `openXrayConsole`: Use `vscode.env.openExternal()` with URL template substitution
    - Handle `promptChanged`: Persist prompt text to workspaceState
  - [x] 4.6 Implement initialized HTML content for input panel
    - Replace placeholder content in `getInitializedHtmlContent()`
    - Add prompt textarea: fixed height (~100px), 4 lines, vertical scroll
    - Add Run Workflow button with play icon (`$(play)`)
    - Add validation error banner container (hidden by default)
    - Add workflow ID display with copy button
    - Add trace ID display with copy button and optional X-Ray link
    - Add timer display
    - Add Reset button (hidden by default, becomes visible after workflow completes or errors)
    - Use VS Code CSS variables: `--vscode-button-*`, `--vscode-input-*`
  - [x] 4.7 Implement webview JavaScript
    - Add `acquireVsCodeApi()` for messaging
    - Implement `runWorkflow()`: Send message to extension
    - Implement `resetPanel()`: Send reset message
    - Implement `copyId(type)`: Send copy message with ID type
    - Implement `openXrayConsole()`: Send open external message
    - Implement `onPromptChange()`: Debounce and send persist message
    - Implement `updateUI(state)`: Update DOM based on received state
  - [x] 4.8 Implement state synchronization
    - Add method `syncStateToWebview()`: Send full state to webview
    - Call on state changes, timer updates, validation changes
    - Include: `state`, `promptText`, `workflowId`, `traceId`, `timerDisplay`, `validationErrors`, `xrayUrl`
  - [x] 4.9 Wire up validation triggers
    - Call validation on `resolveWebviewView()`
    - Subscribe to `configService.onConfigChanged()` for re-validation
    - Update webview with validation results
    - Disable Run button when validation fails
  - [x] 4.10 Implement X-Ray console link
    - Read `config.observability?.xrayConsoleUrl` template
    - Substitute `{region}` and `{trace_id}` placeholders
    - Only show link when URL template is configured AND trace ID exists
    - Open via `vscode.env.openExternal(vscode.Uri.parse(url))`
  - [x] 4.11 Update panel disposal
    - Stop timer on dispose
    - Clear subprocess reference
    - Dispose validation subscription
    - Call parent dispose
  - [x] 4.12 Ensure webview UI tests pass
    - Run ONLY the 2-8 tests written in 4.1
    - Verify message handling works correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-8 tests written in 4.1 pass
- Prompt textarea persists across panel close/reopen
- Run button disabled during validation errors and while running
- Timer displays correctly in all states
- Copy buttons copy bare IDs without prefixes
- X-Ray link appears only when configured and trace ID exists
- Reset button appears after completion/error
- All VS Code theming variables applied correctly

---

### Testing

#### Task Group 5: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-4

- [x] 5.0 Review existing tests and fill critical gaps only
  - [x] 5.1 Review tests from Task Groups 1-4
    - Review the 2-8 tests written for core utilities (Task 1.1)
    - Review the 2-8 tests written for validation service (Task 2.1)
    - Review the 2-8 tests written for workflow executor (Task 3.1)
    - Review the 2-8 tests written for webview panel (Task 4.1)
    - Total existing tests: approximately 8-32 tests
  - [x] 5.2 Analyze test coverage gaps for THIS feature only
    - Identify critical user workflows that lack test coverage
    - Focus ONLY on gaps related to this spec's feature requirements
    - Do NOT assess entire application test coverage
    - Prioritize end-to-end workflows over unit test gaps
  - [x] 5.3 Write up to 10 additional strategic tests maximum
    - Add maximum of 10 new tests to fill identified critical gaps
    - Focus on integration points:
      - Full workflow execution flow (prompt -> subprocess -> completion)
      - Validation + Run button interaction
      - State persistence across panel lifecycle
    - Do NOT write comprehensive coverage for all scenarios
    - Skip edge cases unless business-critical for demo scenarios
  - [x] 5.4 Run feature-specific tests only
    - Run ONLY tests related to this spec's feature (tests from 1.1, 2.1, 3.1, 4.1, and 5.3)
    - Expected total: approximately 18-42 tests maximum
    - Do NOT run the entire application test suite
    - Verify critical workflows pass

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 18-42 tests total)
- Critical user workflows for this feature are covered
- No more than 10 additional tests added when filling in testing gaps
- Testing focused exclusively on this spec's feature requirements

---

## Execution Order

Recommended implementation sequence:

1. **Core Infrastructure (Task Group 1)** - Types, ID generation, state machine, timer formatting
2. **Validation Layer (Task Group 2)** - Validation service for entry script, credentials, initialization
3. **Workflow Execution (Task Group 3)** - Subprocess spawning and process management
4. **Webview UI (Task Group 4)** - Input panel HTML/CSS/JS and message handling
5. **Test Review (Task Group 5)** - Gap analysis and integration tests

## Files to Create/Modify

### New Files
- `src/types/inputPanel.ts` - Input panel types and interfaces
- `src/utils/idGenerator.ts` - Workflow ID and trace ID generation
- `src/utils/timerFormatter.ts` - Timer display formatting
- `src/utils/inputPanelStateMachine.ts` - State machine helper
- `src/services/inputPanelValidation.ts` - Validation service
- `src/services/workflowExecutor.ts` - Subprocess execution service
- `src/test/inputPanel.test.ts` - Input panel unit tests
- `src/test/workflowExecutor.test.ts` - Workflow executor tests
- `src/test/inputPanelValidation.test.ts` - Validation service tests

### Modified Files
- `src/types/index.ts` - Export new input panel types
- `src/panels/demoViewerPanel.ts` - Extend with input panel functionality
- `src/test/demoViewerPanel.test.ts` - Add input panel tests

## Technical Notes

### Existing Code to Leverage
- `DemoViewerPanelProvider` (`src/panels/demoViewerPanel.ts`) - Base webview patterns
- `ConfigService` (`src/services/configService.ts`) - Config reading and change subscription
- `validateCredentialsOnActivation` (`src/services/credentialValidation.ts`) - AWS validation
- `isValidWorkflowConfig` (`src/types/triggers.ts`) - Workflow config validation

### Key Implementation Details
- Use `crypto.randomUUID()` for ID generation (Node.js built-in)
- Use `child_process.spawn()` for subprocess (not `exec()`) for streaming output
- Timer updates via `setInterval` at 100ms intervals
- Webview communication via `postMessage` / `onDidReceiveMessage`
- State persistence via `context.workspaceState.get/update`
- X-Ray URL template supports `{region}` and `{trace_id}` placeholders
