# Specification: Workflow Input Panel

## Goal
Build the Demo Viewer input panel that enables users to enter prompts and spawn workflow executions with proper identity tracking, validation, and execution timing for sales demo scenarios.

## User Stories
- As a sales engineer, I want to paste prepared prompts and run workflows so that I can demonstrate AI agent capabilities during live demos
- As a developer, I want to see workflow and trace IDs so that I can debug and trace execution across systems

## Specific Requirements

**Prompt Textarea**
- Fixed-height multi-line textarea (~100px, 4 visible lines) with vertical scroll for overflow
- Button-only submission (no Enter key shortcut to prevent accidental triggers during demos)
- Optimized for copy/paste of prepared demo prompts
- Persist text to `workspaceState` at key `agentify.demoViewer.promptText` across panel close/reopen
- Standard VS Code input styling using CSS variables

**Run Workflow Button**
- Three visual states managed by state machine:
  - Ready: "Run Workflow" text with play icon (`$(play)`), enabled, primary button style
  - Running: "Running..." text with hourglass icon (`$(loading~spin)`), disabled
  - Completed/Error: Button shows "Run Workflow" again, Reset button appears alongside
- Clicking spawns `workflow.entryScript` via `child_process.spawn()` with `workflow.pythonPath` interpreter
- CLI arguments: `--prompt "<text>"`, `--workflow-id "wf-xxxxxxxx"`, `--trace-id "<32-char-hex>"`
- Environment variables: `AGENTIFY_TABLE_NAME`, `AGENTIFY_TABLE_REGION` from config

**Workflow ID Generation**
- Format: `wf-` prefix + 8-character lowercase alphanumeric (e.g., `wf-a1b2c3d4`)
- Generate using `crypto.randomUUID().slice(0,8)`
- Display prominently in panel after workflow starts
- Copy button copies bare ID only (no prefix text)
- Persist last ID to `workspaceState` at key `agentify.demoViewer.lastWorkflowId`

**Trace ID Generation**
- OTEL-compatible 32-character lowercase hex string
- Generate using `crypto.randomUUID().replace(/-/g, '')`
- Only display after workflow execution starts (not before)
- Copy button copies bare hex string only
- Optional X-Ray console link when `config.observability?.xrayConsoleUrl` is set

**X-Ray Console Link**
- Conditionally visible based on `config.observability?.xrayConsoleUrl` existence
- URL template supports `{region}` and `{trace_id}` substitution placeholders
- Opens in external browser via `vscode.env.openExternal()`
- Only appears after workflow starts when trace_id exists

**Execution Timer**
- Pre-run: Hidden or displays `--:--`
- Running: `MM:SS` format (e.g., `00:04`), updates every 100ms using `setInterval`
- Completed: `MM:SS.d` format with one decimal (e.g., `00:12.3`)
- Error: Frozen at failure time with same decimal format
- Final duration persists until next run starts (presenter reference)
- Clear interval on workflow complete/error and on panel dispose

**Validation System**
- Proactive validation triggers on: panel resolve, config file changes via `configService.onConfigChanged`
- Three validation checks:
  1. Entry script exists: Check `workflow.entryScript` path via `vscode.workspace.fs.stat()`
  2. AWS credentials configured: Use existing `validateCredentialsOnActivation()` from credentialValidation service
  3. Project initialized: Check `.agentify/config.json` exists via `configService.isInitialized()`
- Inline error banner displayed above Run button (not modal)
- Run button disabled when any validation fails
- File existence check only (no syntax parsing of entry script)

**Reset Button**
- Appears after workflow completion or error (not during running state)
- Clicking resets: timer to `--:--`, clears workflow_id and trace_id display, returns to Ready state
- Does NOT clear prompt textarea (preserves for re-runs)

**State Persistence**
- Persisted via `context.workspaceState.get/update`:
  - `agentify.demoViewer.promptText`: User's prompt text
  - `agentify.demoViewer.lastWorkflowId`: Most recent workflow ID
- NOT persisted: execution state, timer value, trace_id, events/logs

## Visual Design
No visual mockups provided. Follow existing VS Code webview patterns from `demoViewerPanel.ts` with:
- VS Code CSS variable usage for theming
- Flexbox layout with appropriate spacing
- Button styling using `--vscode-button-*` variables
- Input styling using `--vscode-input-*` variables

## Existing Code to Leverage

**DemoViewerPanelProvider (`src/panels/demoViewerPanel.ts`)**
- Extend this existing class with input panel functionality
- Reuse `resolveWebviewView`, `updateWebviewContent`, `handleMessage` patterns
- Follow established webview options setup and CSP configuration
- Use existing `subscribeToConfigChanges` pattern for validation triggers

**ConfigService (`src/services/configService.ts`)**
- Use `getConfig()` to read `workflow.entryScript`, `workflow.pythonPath`, `infrastructure.dynamodb.*`
- Use `onConfigChanged()` to trigger validation when config updates
- Use `isInitialized()` for project initialization check

**CredentialValidation (`src/services/credentialValidation.ts`)**
- Use `validateCredentialsOnActivation()` for AWS credential validation check
- Returns `StatusState` that maps directly to validation result

**WorkflowConfig types (`src/types/triggers.ts`)**
- `isValidWorkflowConfig()` validates entryScript and pythonPath presence
- `getMissingConfigFields()` provides user-friendly error messages

**Extension context (`src/extension.ts`)**
- Access `context.workspaceState` for persistence via extension context
- Follow existing pattern for passing context to panel providers

## Out of Scope
- Stop/Cancel running workflow functionality (subprocess kill has edge cases requiring separate spec)
- Prompt history or template management
- Keyboard shortcuts (Cmd+Enter) for submission
- Multiple concurrent workflow execution
- Session/conversation continuity between workflow runs
- Streaming text display in the input panel
- Re-run last workflow button
- Entry script content/syntax validation (only file existence check)
- DynamoDB polling from input panel (handled by other panels)
- Auto-run on panel open
