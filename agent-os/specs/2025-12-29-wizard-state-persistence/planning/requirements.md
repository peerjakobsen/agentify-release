# Spec Requirements: Wizard State Persistence

## Initial Description

Implement workspace storage for wizard progress so users can resume incomplete ideation sessions.

**From raw-idea.md:**
- Save wizard state to `.agentify/wizard-state.json` on each step completion
- State includes: current step, all field values, conversation history, agent design, mock data config
- Exclude uploaded files (too large) - store file metadata only with "re-upload required" flag
- On Ideation Wizard open, check for existing `wizard-state.json`
- If found and less than 7 days old: prompt "Resume previous session?" with preview of business objective
- "Resume" -> restore state, navigate to last completed step
- "Start Fresh" -> delete state file, begin at step 1
- Debounced save (500ms after last change) within each step
- Explicit save on "Next" button click
- "Reset Wizard" command clears state file and restarts
- State automatically cleared when steering files successfully generated (Phase 4)

## Requirements Discussion

### First Round Questions

**Q1:** Storage Location - Should `.agentify/wizard-state.json` be in workspace root, or should we use VS Code's built-in workspace storage API?
**Answer:** Use `.agentify/wizard-state.json` in workspace root. Reasoning: visible/debuggable, consistent with config.json pattern, version-controllable. Add to .gitignore template.

**Q2:** State Versioning - How should we handle schema changes between extension versions? (a) attempt migration, (b) prompt "Start Fresh" with warning, or (c) other?
**Answer:** (b) Prompt "Start Fresh" with incompatibility warning. Store `schemaVersion: number`, compare to `WIZARD_STATE_SCHEMA_VERSION` constant. No migration attempt.

**Q3:** Resume Prompt UI - Should this be (a) VS Code modal dialog, (b) inline banner at top of wizard panel, or (c) VS Code notification?
**Answer:** (b) Inline banner at top of wizard panel with:
- Business objective preview (truncated)
- Last step reached + time since save
- [Resume] [Start Fresh] buttons

**Q4:** File Upload Handling - Store only metadata, or also store base64 thumbnail/preview or text content?
**Answer:** Metadata only with `requiresReupload: true` flag. Store fileName, fileSize, uploadedAt. Show "Previously uploaded: X (re-upload required)" on resume.

**Q5:** Multi-Root Workspaces - How to handle multi-root VS Code workspaces?
**Answer:** (a) First workspace folder only using `vscode.workspace.workspaceFolders?.[0]?.uri`.

**Q6:** Error Handling - What if `wizard-state.json` is corrupted or contains invalid JSON?
**Answer:** (b) Show warning and start fresh. Log actual error to output channel.

**Q7:** Privacy Considerations - Are there fields that should be excluded from persistence?
**Answer:** Exclude nothing, but truncate conversation history to max 10 messages per step. State file max 500KB (warn/truncate if exceeded).

**Q8:** Is there anything specific to EXCLUDE from this feature?
**Answer:** No cloud sync, no multiple sessions, no export/import, no undo/redo, no conflict resolution. 7-day expiry is soft check (warn but allow resume). Debounce is 500ms (not configurable).

### Existing Code to Reference

**Similar Features Identified:**
- Feature: Config Service - Path: `src/services/configService.ts` (existing `.agentify/config.json` handling pattern)
- Feature: WizardState Interface - Path: `src/types/wizardPanel.ts` (complete state interface to persist)
- Feature: TabbedPanel - Path: `src/panels/tabbedPanel.ts` (wizard panel implementation to integrate with)
- Components to potentially reuse: File system operations pattern from config service
- Backend logic to reference: State initialization via `createDefaultWizardState()` factory

### Follow-up Questions

No follow-up questions were needed.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A

## Requirements Summary

### Functional Requirements

**Storage:**
- Save wizard state to `.agentify/wizard-state.json` in workspace root
- Include `schemaVersion` field for version compatibility checks
- Persist: current step, all field values, conversation history (max 10 messages per step), agent design, mock data config
- For uploaded files: store metadata only (fileName, fileSize, uploadedAt) with `requiresReupload: true` flag
- Maximum state file size: 500KB (warn and truncate conversation history if exceeded)

**Resume Flow:**
- On Ideation Wizard panel open, check for existing `wizard-state.json`
- If found: display inline banner at top of wizard with:
  - Business objective preview (truncated to reasonable length)
  - Last step reached indicator
  - Time since last save
  - [Resume] and [Start Fresh] action buttons
- 7-day expiry is soft check (show warning but allow resume)
- "Resume" action: restore state, navigate to last completed step
- "Start Fresh" action: delete state file, begin at step 1

**Auto-Save:**
- Debounced save: 500ms after last change (not configurable)
- Explicit save on "Next" button click
- Explicit save on step completion

**Clear State:**
- "Reset Wizard" command clears state file and restarts wizard
- State automatically cleared when steering files successfully generated (Phase 4 completion)

**Version Handling:**
- Store `schemaVersion: number` in persisted state
- Compare against `WIZARD_STATE_SCHEMA_VERSION` constant on load
- On mismatch: prompt "Start Fresh" with incompatibility warning (no migration attempt)

**Error Handling:**
- Corrupted/invalid JSON: show warning notification and start fresh
- Log actual error details to VS Code output channel
- Multi-root workspace: use first workspace folder only (`vscode.workspace.workspaceFolders?.[0]?.uri`)

### PersistedWizardState Interface Structure

```typescript
interface PersistedWizardState {
  schemaVersion: number;
  savedAt: number; // Unix timestamp
  currentStep: number;
  highestStepReached: number;

  // Step 1
  businessObjective: string;
  industry: string;
  customIndustry?: string;
  systems: string[];
  customSystems?: string;
  uploadedFileMetadata?: {
    fileName: string;
    fileSize: number;
    uploadedAt: number;
    requiresReupload: true;
  };

  // Step 2-6 state objects (matching WizardState interface)
  aiGapFillingState: AIGapFillingState; // conversation history truncated to 10 messages
  outcome: OutcomeDefinitionState;
  security: SecurityState;
  agentDesign: AgentDesignState;
  mockData: MockDataState;
}
```

### Reusability Opportunities
- Existing `.agentify/config.json` file handling pattern in configService.ts
- WizardState interface and factory functions in wizardPanel.ts
- TabbedPanel integration point for banner display

### Scope Boundaries

**In Scope:**
- Local workspace file persistence (`.agentify/wizard-state.json`)
- Inline resume banner UI in wizard panel
- Debounced auto-save (500ms)
- Schema versioning with "Start Fresh" on mismatch
- File upload metadata persistence with re-upload flag
- Conversation history truncation (max 10 messages per step)
- State file size limit (500KB)
- 7-day soft expiry warning
- Error handling with warning notification
- Reset Wizard command
- Auto-clear on steering generation success

**Out of Scope:**
- Cloud sync
- Multiple simultaneous sessions
- Export/import functionality
- Undo/redo operations
- Conflict resolution
- Schema migration (just prompt to start fresh)
- Configurable debounce timing
- Hard expiry enforcement (soft warning only)

### Technical Considerations
- Integration with existing TabbedPanelProvider class
- Use vscode.workspace.fs API for file operations
- Add `.agentify/wizard-state.json` to .gitignore template
- Create WizardStatePersistenceService as singleton
- Use vscode.EventEmitter pattern for state change notifications
- Output channel logging for errors: use existing Agentify output channel or create new one
