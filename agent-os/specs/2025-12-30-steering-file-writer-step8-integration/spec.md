# Specification: Steering File Writer & Step 8 Integration

## Goal

Extend the SteeringFileService to write generated steering documents to `.kiro/steering/` directory, integrate with Step 8 UI for real-time progress feedback, and implement conflict handling with backup support.

## User Stories

- As a user, I want to generate steering files from my wizard inputs so that Kiro can use them for spec-driven development
- As a user, I want to be warned before overwriting existing steering files so that I can backup my previous work if needed

## Specific Requirements

**Service Architecture Refactoring**
- Extend `SteeringFileService` to orchestrate the full generation + file write flow
- Delegate content generation to existing `SteeringGenerationService` (Bedrock calls)
- `SteeringFileService` subscribes to `SteeringGenerationService` events and re-emits them with file paths
- Replace stub `generateSteeringFiles()` implementation with real file writing
- Maintain clean separation: `SteeringGenerationService` handles Bedrock API, `SteeringFileService` handles file I/O

**Conflict Detection Flow**
- Check if `.kiro/steering/` directory exists with files BEFORE generation (not after)
- Use `vscode.workspace.fs.stat()` to check directory existence
- Show QuickPick dialog with three options: "Overwrite", "Backup & Overwrite", "Cancel"
- Abort generation if user selects "Cancel" (do not call Bedrock API)
- Follow QuickPick pattern from `createSteeringFile()` in `src/templates/steeringFile.ts`

**Backup Strategy**
- Copy entire `.kiro/steering/` folder to `.kiro/steering.backup-{timestamp}/`
- Timestamp format: ISO-like string e.g., `2025-12-30T143052`
- Use `vscode.workspace.fs.copy()` with recursive option for folder copy
- Backup occurs after user confirms but before generation starts

**File Writing Operations**
- Create `.kiro/steering/` directory if not exists using `vscode.workspace.fs.createDirectory()`
- Write 8 files: product.md, tech.md, structure.md, customer-context.md, integration-landscape.md, security-policies.md, demo-strategy.md, agentify-integration.md
- Use `vscode.workspace.fs.writeFile()` with UTF-8 encoded content
- Emit `onFileComplete` event with full file path after each successful write

**Partial Failure Handling**
- Keep successfully written files if later file fails (no rollback)
- Track failed file name and error message in state
- Retry only regenerates and writes failed files using existing `retryFiles()` method
- Do NOT clear wizard state on partial failure to allow retry

**Success Handling**
- Show toast notification via `vscode.window.showInformationMessage()` on full success
- Auto-clear wizard state by default using `WizardStatePersistenceService.clear()`
- Provide "Keep State" action in toast for users who want to regenerate
- Update `GenerationState.generatedFilePaths` with actual file paths

**Validation Before Generation**
- Validate Steps 1, 3, 5 have required content before allowing generation
- Step 1: `businessObjective` and `industry` must be non-empty
- Step 3: `primaryOutcome` must be non-empty
- Step 5: `confirmedAgents.length > 0` required
- Set `canGenerate: false` when any validation fails (existing pattern)

**Step 8 UI Integration**
- Remove `isPlaceholderMode` flag usage from `ideationStep8Logic.ts`
- Remove "Preview mode" indicator from Step 8 UI
- Update progress UI to show per-file generation status with actual file names
- Show success state with "Open File" links for each generated file
- Show partial failure state with retry button for failed files only

## Visual Design

No visual mockups provided - follow existing Step 8 UI patterns.

## Existing Code to Leverage

**`src/templates/steeringFile.ts` - QuickPick Conflict Handling**
- `createSteeringFile()` function demonstrates QuickPick dialog pattern
- Shows how to check file existence with `vscode.workspace.fs.stat()`
- Returns `SteeringFileResult` interface with success/skipped/message properties
- Reuse this pattern for conflict detection with extended options (Overwrite, Backup & Overwrite, Cancel)

**`src/services/wizardStatePersistenceService.ts` - File I/O Patterns**
- Uses `vscode.workspace.fs.createDirectory()` for directory creation
- Uses `vscode.workspace.fs.writeFile()` with `Buffer.from(content, 'utf-8')`
- Has `clear()` method for deleting state file (reuse for wizard state clearing)
- Shows toast notification pattern with `vscode.window.showWarningMessage()`

**`src/services/steeringGenerationService.ts` - EventEmitter Pattern**
- EventEmitter pattern with `onFileStart`, `onFileComplete`, `onFileError` events
- `retryFiles()` method accepts array of file names to regenerate
- Uses `Promise.allSettled()` for parallel generation
- `GeneratedFile` interface with fileName, content, status, error properties

**`src/panels/ideationStep8Logic.ts` - Dialog Patterns**
- `handleStartOver()` uses `showConfirmDialog` callback for confirmation
- `Step8Callbacks` interface defines `showConfirmDialog` signature
- Current stub integration shows how service events update UI state
- Validation methods for each step can be extended for generation blocking

**`src/services/steeringFileService.ts` - Current Stub Service**
- Singleton pattern with `getSteeringFileService()` getter
- EventEmitter structure already in place
- `GenerationResult` interface to extend with file paths and error tracking
- `_getWorkspaceRoot()` helper for workspace path resolution

## Out of Scope

- Item 34: `kiro.startSpecFlow` command integration (future phase placeholder only)
- Changes to `SteeringGenerationService` Bedrock API logic or prompts
- Changes to steering document prompt templates
- Demo Script Export (Item 23.5 - separate feature)
- Agentify Power installation (Item 33 - separate feature)
- Multi-root workspace support (use first workspace folder only)
- Custom backup location configuration
- Incremental/diff-based file updates (always full regeneration)
- Git integration for backup (use filesystem backup only)
