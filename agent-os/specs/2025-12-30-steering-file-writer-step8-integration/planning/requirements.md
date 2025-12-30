# Spec Requirements: Steering File Writer & Step 8 Integration

## Initial Description

28.3. [ ] Steering File Writer & Step 8 Integration - Write generated steering files to workspace and integrate with Step 8 UI:

**File Writing:**
- Create `.kiro/steering/` directory if not exists
- Write each generated document from Item 28.2 to corresponding file
- Emit progress events for Step 8 UI updates

**Conflict Handling:**
- Check if `.kiro/steering/` directory exists with files
- If exists, prompt: "Overwrite existing steering files?"
- Options: "Overwrite", "Backup & Overwrite", "Cancel"
- "Backup & Overwrite" copies existing to `.kiro/steering.backup-{timestamp}/`

**Step 8 Integration:**
- Replace stub service calls with real `SteeringGenerationService`
- Update progress UI to show per-file generation status
- Remove `isPlaceholderMode` flag and "Preview mode" indicator
- On success: show generated file list with "Open File" links
- On partial failure: show which files succeeded/failed with retry option

**Post-Generation Actions:**
- Clear wizard state (per Item 22) on full success only
- Keep wizard state on partial failure (allow retry)
- "Open in Kiro" button reveals `.kiro/steering/` folder
- If in Kiro IDE: TODO placeholder for `kiro.startSpecFlow` command (Item 34)

**Validation Before Generation:**
- Verify required wizard steps have content (Steps 1, 3, 5 minimum)
- Show validation errors in Step 8 summary cards
- Block generation if critical steps incomplete

**Files Written:**
```
.kiro/steering/
  product.md
  tech.md
  structure.md
  customer-context.md
  integration-landscape.md
  security-policies.md
  demo-strategy.md
  agentify-integration.md
```

## Requirements Discussion

### First Round Questions

**Q1:** Service Architecture - The codebase has two services - `SteeringGenerationService` (generates content via Bedrock) and `SteeringFileService` (stub for progress events). Should we merge file writing into `SteeringFileService` and have it delegate to `SteeringGenerationService` for content generation, or consolidate into a single service?
**Answer:** Extend `SteeringFileService` to handle file I/O, delegate to `SteeringGenerationService` for content. Clean separation: Generation (Bedrock calls) vs. Persistence (file I/O). SteeringFileService becomes the orchestrator.

**Q2:** Conflict Detection Timing - Should we check for existing files BEFORE starting generation (not after), since Bedrock API calls are expensive?
**Answer:** Check BEFORE generation, prompt user first, then generate. Better UX and avoids expensive Bedrock calls if user cancels.

**Q3:** Backup Granularity - For "Backup & Overwrite", should we backup the entire `.kiro/steering/` folder as a unit, or track per-file backups?
**Answer:** Folder-level backup to `.kiro/steering.backup-{timestamp}/`. Simpler implementation, all 8 files are a unit.

**Q4:** Partial Failure Retry - When retry is triggered after a partial failure, should we only regenerate failed files or always regenerate all files?
**Answer:** Only regenerate failed files using existing `retryFiles()` method. Avoid re-running expensive Bedrock calls.

**Q5:** Wizard State Clearing - The spec says "clear wizard state on full success only." Should we show a toast confirming this, or clear silently? Should we give users an option to keep state on success?
**Answer:** Show brief toast on success, auto-clear by default, but allow "Keep State" option via toast actions. On partial failure: do NOT clear state.

**Q6:** Generation Button State - Should the "Generate" button be disabled when validation fails, or allow click and show error modal?
**Answer:** Disable button when validation fails (use existing `canGenerate: false`). Cleaner UX than click + error modal.

**Q7:** What should happen if a file write succeeds but a subsequent file fails? Keep partial files or roll back?
**Answer:** Keep successfully written files (partial generation). Retry will regenerate only failed files.

### Existing Code to Reference

**Similar Features Identified:**
- Feature: File conflict handling - Path: `src/templates/steeringFile.ts createSteeringFile()` - QuickPick pattern for Overwrite/Skip options
- Feature: File I/O patterns - Path: `src/services/wizardStatePersistenceService.ts` - Directory creation, error handling, vscode.workspace.fs API usage
- Feature: Progress events - Path: `src/services/steeringGenerationService.ts` - EventEmitter pattern (onFileStart, onFileComplete, onFileError)
- Feature: Selective retry - Path: `src/services/steeringGenerationService.ts retryFiles()` - Regenerates only specified files
- Feature: Confirmation dialogs - Path: `src/panels/ideationStep8Logic.ts handleStartOver()` - Modal dialog pattern
- Feature: Toast notifications - Path: `src/services/wizardStatePersistenceService.ts` - vscode.window.showInformationMessage pattern

### Follow-up Questions

No follow-up questions needed - all key decisions have been made.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A

## Requirements Summary

### Functional Requirements

**Service Architecture:**
- Extend `SteeringFileService` to orchestrate the full generation + write flow
- Delegate content generation to existing `SteeringGenerationService`
- Maintain clean separation: Generation (Bedrock) vs. Persistence (file I/O)
- Replace stub implementation with real file writing

**Conflict Handling Flow:**
1. Before generation, check if `.kiro/steering/` exists with files
2. If exists, show QuickPick dialog with options:
   - "Overwrite" - proceed with generation, overwrite files
   - "Backup & Overwrite" - copy folder to `.kiro/steering.backup-{timestamp}/`, then proceed
   - "Cancel" - abort generation
3. Only proceed with Bedrock API calls after user confirms

**File Writing:**
- Create `.kiro/steering/` directory if not exists
- Write 8 steering files: product.md, tech.md, structure.md, customer-context.md, integration-landscape.md, security-policies.md, demo-strategy.md, agentify-integration.md
- Emit progress events for each file (onFileStart, onFileComplete, onFileError)

**Partial Failure Handling:**
- Keep successfully written files on partial failure
- Track which files failed in state
- Retry only regenerates and writes failed files (using `retryFiles()`)
- Do NOT clear wizard state on partial failure

**Success Handling:**
- Show toast notification on full success
- Auto-clear wizard state by default
- Provide "Keep State" action in toast for users who want to regenerate
- Update UI to show generated file list with "Open File" links

**Validation:**
- Validate Steps 1, 3, 5 have required content before generation
- Disable Generate button when validation fails (`canGenerate: false`)
- Show validation errors in Step 8 summary cards

**Step 8 UI Integration:**
- Remove `isPlaceholderMode` flag usage
- Remove "Preview mode" indicator
- Update progress UI to show per-file generation status
- Show success state with file links on completion
- Show partial failure state with retry option

### Reusability Opportunities

- **QuickPick dialog pattern** from `createSteeringFile()` for conflict handling
- **Directory creation pattern** from `wizardStatePersistenceService.ts`
- **EventEmitter pattern** already in `SteeringGenerationService`
- **retryFiles() method** for selective regeneration
- **Toast notification pattern** from persistence service
- **Confirmation dialog pattern** from `handleStartOver()`

### Scope Boundaries

**In Scope:**
- Extend SteeringFileService with file I/O capabilities
- Implement conflict detection and backup mechanism
- Integrate with existing SteeringGenerationService
- Update Step8LogicHandler to use real generation
- Remove placeholder mode from UI
- Implement wizard state clearing on success
- Progress event emission for UI updates

**Out of Scope:**
- Item 34: `kiro.startSpecFlow` command integration (future phase)
- Changes to SteeringGenerationService Bedrock logic
- Changes to steering document prompts
- Demo Script Export (Item 23.5 - separate feature)
- Agentify Power installation (Item 33 - separate feature)

### Technical Considerations

**Integration Points:**
- `SteeringFileService` -> `SteeringGenerationService` delegation
- `Step8LogicHandler` -> `SteeringFileService` orchestration
- `WizardStatePersistenceService` for state clearing
- `vscode.workspace.fs` API for file operations

**Existing Constraints:**
- Must use vscode.workspace.fs API (not Node.js fs) for extension compatibility
- Must maintain EventEmitter pattern for progress events
- Must preserve retry functionality for partial failures
- Wizard state schema version handling (WIZARD_STATE_SCHEMA_VERSION)

**File Paths:**
- Steering files: `.kiro/steering/*.md`
- Backup folder: `.kiro/steering.backup-{timestamp}/`
- Wizard state: `.agentify/wizard-state.json`

**Error Handling:**
- Directory creation failures
- File write failures
- Backup copy failures
- Bedrock API failures (handled by SteeringGenerationService)
