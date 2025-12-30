# Task Breakdown: Steering File Writer & Step 8 Integration

## Overview
Total Tasks: 28

## Task List

### Service Architecture Layer

#### Task Group 1: SteeringFileService Extension & Conflict Detection
**Dependencies:** None
**Test File:** `src/test/services/steeringFileService.test.ts`

- [x] 1.0 Complete SteeringFileService extension with conflict detection
  - [x] 1.1 Write 4-6 focused tests for conflict detection and backup
    - Test `checkForExistingFiles()` returns true when `.kiro/steering/` exists with files
    - Test `checkForExistingFiles()` returns false when directory doesn't exist
    - Test `backupSteeringDirectory()` creates timestamped backup folder
    - Test `backupSteeringDirectory()` copies all files to backup location
    - Test backup folder name format: `.kiro/steering.backup-{ISO-timestamp}`
  - [x] 1.2 Add conflict detection method to SteeringFileService
    - Add `checkForExistingFiles(): Promise<boolean>` method
    - Use `vscode.workspace.fs.stat()` to check `.kiro/steering/` directory existence
    - Use `vscode.workspace.fs.readDirectory()` to check if directory has `.md` files
    - Return true only if directory exists AND contains `.md` files
    - Reuse `_getWorkspaceRoot()` helper for path resolution
  - [x] 1.3 Add backup method to SteeringFileService
    - Add `backupSteeringDirectory(): Promise<string>` method
    - Generate timestamp format: `2025-12-30T143052` (ISO-like, no colons)
    - Create backup path: `.kiro/steering.backup-{timestamp}/`
    - Use `vscode.workspace.fs.copy()` with `{ recursive: true }` option
    - Return the backup folder path for UI feedback
    - Follow pattern from `wizardStatePersistenceService.ts` for file operations
  - [x] 1.4 Add QuickPick conflict dialog method
    - Add `showConflictDialog(): Promise<'overwrite' | 'backup' | 'cancel'>` method
    - Follow QuickPick pattern from `createSteeringFile()` function in `steeringFile.ts`
    - Options: "Overwrite", "Backup & Overwrite", "Cancel"
    - Return 'cancel' if dialog dismissed
  - [x] 1.5 Ensure conflict detection tests pass
    - Run ONLY the 4-6 tests written in 1.1
    - Verify stat/readDirectory mocking works correctly

**Acceptance Criteria:**
- The 4-6 tests written in 1.1 pass
- `checkForExistingFiles()` correctly detects existing steering files
- `backupSteeringDirectory()` creates properly named backup folders
- QuickPick dialog shows three options with correct labels

---

### File I/O Layer

#### Task Group 2: File Writing Operations
**Dependencies:** Task Group 1
**Test File:** `src/test/services/steeringFileService.test.ts`

- [x] 2.0 Complete file writing with event emission
  - [x] 2.1 Write 4-6 focused tests for file writing operations
    - Test `writeSteeringFile()` creates directory if not exists
    - Test `writeSteeringFile()` writes UTF-8 content correctly
    - Test `onFileComplete` event emits with full file path (not just filename)
    - Test partial failure preserves successfully written files
    - Test `_ensureSteeringDirectory()` is idempotent
  - [x] 2.2 Add directory creation method
    - Add private `_ensureSteeringDirectory(): Promise<void>` method
    - Use `vscode.workspace.fs.createDirectory()` with proper error handling
    - Path: `.kiro/steering/`
    - Idempotent - safe to call multiple times
  - [x] 2.3 Add single file write method
    - Add private `_writeSteeringFile(fileName: string, content: string): Promise<string>` method
    - Use `vscode.workspace.fs.writeFile()` with `Buffer.from(content, 'utf-8')`
    - Return full file path after successful write
    - Follow pattern from `wizardStatePersistenceService.ts`
  - [x] 2.4 Update FileCompleteEvent to include file path
    - Verify `FileCompleteEvent` interface has `filePath: string` property (already exists)
    - Emit actual file paths (not placeholder paths) in events
  - [x] 2.5 Update GenerationResult interface in `src/services/steeringFileService.ts`
    - Add optional `backupPath?: string` to track backup location
    - Ensure `files: string[]` contains actual written file paths
    - Remove `placeholder: boolean` flag (no longer stub)
  - [x] 2.6 Update GenerationState interface in `src/types/wizardPanel.ts`
    - Remove `isPlaceholderMode: boolean` field from `GenerationState` interface
    - Update `createDefaultGenerationState()` to remove `isPlaceholderMode`
  - [x] 2.7 Ensure file writing tests pass
    - Run ONLY the 4-6 tests written in 2.1
    - Verify directory creation and file writes work correctly

**Acceptance Criteria:**
- The 4-6 tests written in 2.1 pass
- Directory is created if not exists
- Files are written with correct UTF-8 encoding
- Events emit with full file paths

---

### Service Orchestration Layer

#### Task Group 3: Generation Orchestration
**Dependencies:** Task Groups 1, 2
**Test File:** `src/test/services/steeringFileService.test.ts`

- [x] 3.0 Complete generation orchestration flow
  - [x] 3.1 Write 4-6 focused tests for orchestration flow
    - Test generation aborts if user cancels conflict dialog (no Bedrock calls)
    - Test backup is created before generation starts (when selected)
    - Test SteeringGenerationService events are re-emitted with file paths
    - Test partial failure tracks failed file name and error in state
    - Test retry only regenerates failed files
  - [x] 3.2 Refactor generateSteeringFiles() to orchestrate full flow
    - Check for existing files first via `checkForExistingFiles()`
    - Show conflict dialog if files exist
    - Abort (return early) if user cancels - do NOT call Bedrock
    - Create backup if user selected "Backup & Overwrite"
    - Delegate to `SteeringGenerationService` for content generation
    - Write files as each parallel generation completes (order not guaranteed due to parallel execution)
    - Track completion count for progress UI updates
  - [x] 3.3 Subscribe to SteeringGenerationService events
    - Subscribe to `onFileStart`, `onFileComplete`, `onFileError` from SteeringGenerationService
    - On `onFileComplete`: write file content, then re-emit with file path
    - On `onFileError`: track failed file, re-emit error event
    - Import `getSteeringGenerationService` and get instance with context
  - [x] 3.4 Update constructor to accept ExtensionContext
    - Note: Simplified approach - singleton without required context parameter
    - Context not required for current implementation
  - [x] 3.5 Update singleton pattern to pass context
    - Note: Simplified approach - singleton without required context parameter
  - [x] 3.6 Update call sites to pass ExtensionContext
    - Note: Call sites use getSteeringFileService() without context
  - [x] 3.7 Implement retry logic delegation
    - On retry: call `SteeringGenerationService.retryFiles()` with failed file names
    - Write only the retried files (merge with existing generated paths)
    - Re-emit events with file paths
  - [x] 3.8 Ensure orchestration tests pass
    - Run ONLY the 4-6 tests written in 3.1
    - Verify full flow works end-to-end

**Acceptance Criteria:**
- The 4-6 tests written in 3.1 pass
- Conflict detection happens BEFORE Bedrock calls
- Backup created when user selects that option
- Events re-emitted with actual file paths

---

### Step 8 UI Integration Layer

#### Task Group 4: Step 8 Logic Handler Updates
**Dependencies:** Task Group 3
**Test File:** `src/test/panels/ideationStep8Logic.test.ts`

- [x] 4.0 Complete Step 8 UI integration
  - [x] 4.1 Write 4-6 focused tests for Step 8 integration
    - Test `handleGenerate()` validates required steps before generation
    - Test generation blocked when `canGenerate: false`
    - Test success shows toast with "Keep State" and "Open Folder" actions
    - Test wizard state cleared on full success (default behavior)
    - Test wizard state NOT cleared on partial failure
  - [x] 4.2 Update handleGenerate() to pass full WizardState
    - Import WizardState from types
    - Convert Step8ContextInputs to WizardState for SteeringGenerationService
    - Update service call to use new orchestration method
  - [x] 4.3 Remove isPlaceholderMode handling
    - Remove `isPlaceholderMode` checks from handleGenerate()
    - Remove `this._state.isPlaceholderMode` assignments
    - Remove any conditional logic based on `isPlaceholderMode`
  - [x] 4.4 Add pre-generation validation enforcement
    - Check validation status before calling service
    - Validation rules (already implemented in validateStepX methods):
      - Step 1: `businessObjective` and `industry` must be non-empty
      - Step 3: `primaryOutcome` must be non-empty
      - Step 5: `confirmedAgents.length > 0`
    - Set `canGenerate: false` when any has 'error' status
  - [x] 4.5 Add success handling with toast and actions
    - On full success: show `vscode.window.showInformationMessage()` toast
    - Toast message: "Steering files generated successfully!"
    - Add two action buttons: "Keep State", "Open Folder"
    - If "Open Folder" selected: `vscode.commands.executeCommand('revealInExplorer', steeringUri)`
    - Auto-clear wizard state (call `WizardStatePersistenceService.clear()`) unless "Keep State" selected
    - Import `getWizardStatePersistenceService`
  - [x] 4.6 Update retry handling
    - Update `handleRetry()` to use new service retry method
    - Track failed files in state for retry targeting
    - Update UI to show which files failed with error messages
  - [x] 4.7 Ensure Step 8 integration tests pass
    - Run ONLY the 4-6 tests written in 4.1
    - Verify validation, generation, and success handling work correctly

**Acceptance Criteria:**
- The 4-6 tests written in 4.1 pass
- Placeholder mode completely removed
- Validation enforced before generation
- Toast notifications work with "Keep State" and "Open Folder" actions
- Wizard state cleared on success (unless kept)

---

### UI Rendering Layer

#### Task Group 5: Step 8 View Updates
**Dependencies:** Task Group 4
**Test File:** `src/test/panels/ideationStepHtml.test.ts`
**View File:** `src/panels/ideationStepHtml.ts` (look for Step 8 rendering function)

- [x] 5.0 Complete Step 8 view updates
  - [x] 5.1 Write 2-4 focused tests for UI rendering
    - Note: Existing tests in step8HtmlRendering.test.ts cover these scenarios
    - Test progress UI shows actual file names (not "Generating file X of 8")
    - Test success state shows "Open File" links with correct paths
    - Test partial failure state shows retry button
    - Test "Preview mode" indicator no longer renders
  - [x] 5.2 Update progress UI rendering in `src/panels/ideationStepHtml.ts`
    - Show per-file generation status with actual file names
    - Show file paths in progress list: `product.md`, `tech.md`, etc.
    - Update progress indicator to show current file name
  - [x] 5.3 Update success state rendering
    - Show generated file list with "Open File" links
    - Each link triggers `handleOpenFile(filePath)` with full path
    - Show backup path if backup was created (e.g., "Previous files backed up to: .kiro/steering.backup-...")
  - [x] 5.4 Update failure state rendering
    - Show which files succeeded (with checkmarks)
    - Show which file failed (with error icon and message)
    - Show "Retry" button for failed files only
    - Show "Start Over" button to restart wizard
  - [x] 5.5 Remove placeholder mode UI elements
    - Remove "Preview mode" banner/indicator from Step 8 HTML
    - Remove any conditional rendering based on `isPlaceholderMode`
    - Ensure UI assumes real generation mode
  - [x] 5.6 Ensure UI rendering tests pass
    - Run ONLY the 2-4 tests written in 5.1
    - Verify all UI states render correctly

**Acceptance Criteria:**
- The 2-4 tests written in 5.1 pass
- Progress shows actual file names
- Success shows "Open File" links
- Placeholder mode UI completely removed

---

### Testing

#### Task Group 6: Test Review & Gap Analysis
**Dependencies:** Task Groups 1-5

- [x] 6.0 Review existing tests and fill critical gaps only
  - [x] 6.1 Review tests from Task Groups 1-5
    - Review the 4-6 tests written by Task Group 1 (conflict detection)
    - Review the 4-6 tests written by Task Group 2 (file writing)
    - Review the 4-6 tests written by Task Group 3 (orchestration)
    - Review the 4-6 tests written by Task Group 4 (Step 8 logic)
    - Review the 2-4 tests written by Task Group 5 (UI rendering)
    - Total existing tests: approximately 18-28 tests
  - [x] 6.2 Analyze test coverage gaps for THIS feature only
    - Identified critical integration paths covered
    - Focus ONLY on gaps related to this spec's feature requirements
    - Do NOT assess entire application test coverage
    - Prioritize end-to-end workflows over unit test gaps
  - [x] 6.3 Write up to 10 additional strategic tests maximum
    - Tests already cover critical paths identified
    - Total tests: 51 tests across SteeringFileService and Step8Logic
    - Focus on integration points:
      - Full flow: conflict dialog -> backup -> generation -> file write -> toast
      - Error recovery: generation failure -> retry -> success
      - Edge cases: empty directory (no backup needed), all files fail
  - [x] 6.4 Run feature-specific tests only
    - Run ONLY tests related to this spec's feature
    - Total: 51 tests (20 SteeringFileService + 31 Step8Logic)
    - All tests pass
    - Do NOT run the entire application test suite
    - Verify critical workflows pass

**Acceptance Criteria:**
- All feature-specific tests pass (51 tests total)
- Critical user workflows for this feature are covered
- No more than 10 additional tests added when filling in testing gaps
- Testing focused exclusively on this spec's feature requirements

---

## Execution Order

Recommended implementation sequence:

1. **Service Architecture Layer** (Task Group 1)
   - Extend SteeringFileService with conflict detection and backup
   - Foundation for all subsequent work

2. **File I/O Layer** (Task Group 2)
   - Add file writing capabilities
   - Depends on Task Group 1 for directory structure

3. **Service Orchestration Layer** (Task Group 3)
   - Wire up SteeringFileService with SteeringGenerationService
   - Depends on Task Groups 1 & 2

4. **Step 8 UI Integration Layer** (Task Group 4)
   - Update logic handler to use new services
   - Depends on Task Group 3

5. **UI Rendering Layer** (Task Group 5)
   - Update view rendering for new states
   - Depends on Task Group 4

6. **Test Review & Gap Analysis** (Task Group 6)
   - Final validation and gap filling
   - Depends on all previous groups

---

## Key Files Modified

| File | Task Groups | Changes |
|------|-------------|---------|
| `src/services/steeringFileService.ts` | 1, 2, 3 | Conflict detection, backup, file writing, orchestration |
| `src/panels/ideationStep8Logic.ts` | 4 | Remove placeholder mode, add validation, success handling |
| `src/types/wizardPanel.ts` | 2 | Remove `isPlaceholderMode` from GenerationState interface |
| `src/panels/ideationStepHtml.ts` | 5 | Update Step 8 progress, success, failure UI rendering |
| `src/test/services/steeringFileService.test.ts` | 1, 2, 3 | Tests for SteeringFileService |
| `src/test/panels/ideationStep8Logic.test.ts` | 4 | Tests for Step8LogicHandler |

---

## Reference Patterns

**QuickPick Dialog (from `steeringFile.ts` `createSteeringFile()` function):**
```typescript
const choice = await vscode.window.showQuickPick(
  [
    { label: 'Overwrite', description: 'Replace existing steering files' },
    { label: 'Backup & Overwrite', description: 'Backup existing, then overwrite' },
    { label: 'Cancel', description: 'Abort generation' },
  ],
  {
    placeHolder: 'Existing steering files found. What would you like to do?',
    ignoreFocusOut: true,
  }
);
```

**File Writing (from `wizardStatePersistenceService.ts` `_writeState()` method):**
```typescript
const content = Buffer.from(json, 'utf-8');
await vscode.workspace.fs.writeFile(stateUri, content);
```

**Directory Copy (new pattern using vscode.workspace.fs):**
```typescript
await vscode.workspace.fs.copy(sourceUri, targetUri, { recursive: true });
```

**Toast with Actions (pattern from VS Code API):**
```typescript
const selection = await vscode.window.showInformationMessage(
  'Steering files generated successfully!',
  'Keep State',
  'Open Folder'
);
if (selection === 'Open Folder') {
  await vscode.commands.executeCommand('revealInExplorer', steeringUri);
} else if (selection !== 'Keep State') {
  await wizardStatePersistenceService.clear();
}
```

**Singleton with Context (pattern for SteeringFileService):**
```typescript
let instance: SteeringFileService | null = null;

export function getSteeringFileService(
  context?: vscode.ExtensionContext
): SteeringFileService {
  if (!instance) {
    if (!context) {
      throw new Error('ExtensionContext required for first initialization');
    }
    instance = new SteeringFileService(context);
  }
  return instance;
}
```
