# Spec: Wizard State Persistence

## Overview

Implement workspace storage for wizard progress so users can resume incomplete ideation sessions. State is persisted to `.agentify/wizard-state.json` with auto-save, resume prompt, and version handling.

## Background

The Ideation Wizard is an 8-step process that collects business context, AI gap-filling, outcomes, security configuration, agent design, and mock data strategy. Users may need to close the IDE mid-session and resume later. Without persistence, all progress is lost on panel close or IDE restart.

### Current State
- `WizardState` interface exists in `src/types/wizardPanel.ts` with full state structure
- `TabbedPanelProvider` in `src/panels/tabbedPanel.ts` manages wizard state in memory
- `.agentify/config.json` pattern exists for workspace configuration
- No persistence mechanism currently exists for wizard state

### Goals
1. Enable users to resume incomplete wizard sessions
2. Preserve all wizard inputs across IDE restarts
3. Handle uploaded file references gracefully
4. Maintain backward compatibility with version checking

## Requirements

### 1. State Persistence Service

Create `WizardStatePersistenceService` singleton to handle all persistence operations.

**File Location:** `src/services/wizardStatePersistenceService.ts`

**Responsibilities:**
- Load state from `.agentify/wizard-state.json`
- Save state with debouncing (500ms)
- Validate schema version compatibility
- Truncate conversation history to size limits
- Handle file system errors gracefully

**Interface:**
```typescript
interface WizardStatePersistenceService {
  // Load persisted state, returns null if none exists or invalid
  load(): Promise<PersistedWizardState | null>;

  // Save state (debounced internally)
  save(state: WizardState): void;

  // Force immediate save (for "Next" button)
  saveImmediate(state: WizardState): Promise<void>;

  // Delete state file
  clear(): Promise<void>;

  // Check if persisted state exists
  exists(): Promise<boolean>;

  // Event emitter for save errors
  onSaveError: vscode.Event<Error>;
}
```

### 2. Persisted State Schema

**Schema Version Constant:**
```typescript
export const WIZARD_STATE_SCHEMA_VERSION = 1;
```

**PersistedWizardState Interface:**
```typescript
interface PersistedWizardState {
  // Metadata
  schemaVersion: number;
  savedAt: number; // Unix timestamp (milliseconds)

  // Navigation
  currentStep: number;
  highestStepReached: number;
  validationAttempted: boolean;

  // Step 1: Business Context
  businessObjective: string;
  industry: string;
  customIndustry?: string;
  systems: string[];
  customSystems?: string;
  uploadedFileMetadata?: PersistedFileMetadata;

  // Step 2: AI Gap-Filling
  aiGapFillingState: AIGapFillingState;

  // Step 3: Outcome Definition
  outcome: OutcomeDefinitionState;

  // Step 4: Security & Guardrails
  security: SecurityState;

  // Step 5: Agent Design
  agentDesign: AgentDesignState;

  // Step 6: Mock Data Strategy
  mockData: MockDataState;
}

interface PersistedFileMetadata {
  fileName: string;
  fileSize: number;
  uploadedAt: number; // Unix timestamp
  requiresReupload: true; // Always true for persisted files
}
```

### 3. Storage Location

**Path:** `.agentify/wizard-state.json` in workspace root

**Workspace Resolution:**
- Use `vscode.workspace.workspaceFolders?.[0]?.uri` for multi-root workspaces
- If no workspace open, persistence is disabled (memory only)

**Directory Creation:**
- Create `.agentify/` directory if it doesn't exist (matches config.json pattern)

**Gitignore:**
- Add `wizard-state.json` to `.agentify/.gitignore` template during project initialization

### 4. Auto-Save Behavior

**Debounced Save (500ms):**
- Trigger on any state change within a step
- Cancel pending save if new change occurs within 500ms
- Use `setTimeout`/`clearTimeout` pattern

**Immediate Save:**
- On "Next" button click (before navigation)
- On "Back" button click (before navigation)
- On step handler completion (e.g., after AI response)

**Save Triggers in TabbedPanelProvider:**
```typescript
// After state mutation
this._persistenceService.save(this._ideationState);

// Before navigation
await this._persistenceService.saveImmediate(this._ideationState);
this.ideationNavigateForward();
```

### 5. Resume Flow UI

**Banner Component:** Inline banner at top of wizard panel (Step 1 view)

**Banner Content:**
```
+----------------------------------------------------------+
|  Resume Previous Session?                                 |
|                                                          |
|  "Reduce stockouts in fresh produce by implementing..."  |
|  Step 3 of 8 - Outcomes | Last saved 2 hours ago         |
|                                                          |
|  [Resume]  [Start Fresh]                                 |
+----------------------------------------------------------+
```

**Display Conditions:**
- Show only when persisted state exists AND user is on Step 1
- Hide after user clicks Resume or Start Fresh
- Hide if schema version mismatch (show warning instead)

**Business Objective Preview:**
- Truncate to 80 characters with ellipsis
- Show placeholder if empty: "(No business objective entered)"

**Time Since Save:**
- "Just now" (< 1 minute)
- "X minutes ago" (< 60 minutes)
- "X hours ago" (< 24 hours)
- "X days ago" (>= 24 hours)

**7-Day Expiry Warning:**
- If saved > 7 days ago, show warning text: "This session is over 7 days old"
- Still allow resume (soft check only)

### 6. Resume and Start Fresh Actions

**Resume Action:**
1. Load persisted state
2. Convert `PersistedWizardState` to `WizardState`:
   - Copy all fields directly
   - For `uploadedFileMetadata`: set `uploadedFile = undefined` but store metadata for display
3. Navigate to `highestStepReached`
4. Hide resume banner
5. Sync state to webview

**Start Fresh Action:**
1. Delete `.agentify/wizard-state.json`
2. Reset to default wizard state via `createDefaultWizardState()`
3. Stay on Step 1
4. Hide resume banner
5. Sync state to webview

### 7. Version Handling

**On Load:**
1. Parse JSON from file
2. Check `schemaVersion` against `WIZARD_STATE_SCHEMA_VERSION`
3. If mismatch:
   - Show warning banner: "Previous session uses incompatible format"
   - Only offer "Start Fresh" button (no Resume)
   - Log version mismatch to output channel

**Version Mismatch Banner:**
```
+----------------------------------------------------------+
|  Previous Session Incompatible                    [!]    |
|                                                          |
|  The saved session uses an older format that cannot be   |
|  loaded. Please start a new session.                     |
|                                                          |
|  [Start Fresh]                                           |
+----------------------------------------------------------+
```

### 8. File Upload Handling

**On Save:**
- If `uploadedFile` exists in state:
  - Extract metadata: `{ fileName, fileSize: uploadedFile.size, uploadedAt: Date.now(), requiresReupload: true }`
  - Do NOT persist `uploadedFile.data` (binary content)

**On Resume:**
- Set `uploadedFile = undefined` (no binary data)
- Store `uploadedFileMetadata` in component state for display

**UI Indicator (Step 1):**
- If `uploadedFileMetadata` exists and `uploadedFile` is undefined:
  - Show: "Previously uploaded: {fileName} ({fileSize} - re-upload required)"
  - Style as warning/info state
  - File input remains functional for re-upload

### 9. Conversation History Truncation

**Limit:** Maximum 10 messages per conversation

**Truncation Points:**
- `aiGapFillingState.conversationHistory`: Keep last 10 messages
- Step 3 refinement conversation (if stored): Keep last 10 messages

**Truncation Logic:**
```typescript
function truncateConversationHistory(messages: ConversationMessage[], limit = 10): ConversationMessage[] {
  if (messages.length <= limit) return messages;
  return messages.slice(-limit);
}
```

**Apply Before Save:**
- Truncate conversation arrays before serialization
- Preserve most recent messages (slice from end)

### 10. State File Size Limit

**Limit:** 500KB maximum

**On Save:**
1. Serialize state to JSON
2. Check `JSON.stringify(state).length`
3. If > 500KB:
   - Log warning to output channel
   - Progressively truncate conversation histories:
     - First pass: limit to 5 messages each
     - Second pass: limit to 2 messages each
     - Third pass: clear all conversation histories
   - Retry serialization after each truncation
4. If still > 500KB after clearing conversations:
   - Log error
   - Skip save (don't corrupt existing file)
   - Show warning notification to user

### 11. Error Handling

**File Read Errors:**
- Log to output channel with full error details
- Return `null` from `load()` (treat as no persisted state)
- Do NOT show error to user (silent fallback)

**JSON Parse Errors:**
- Log to output channel: "Wizard state file corrupted: {error.message}"
- Show warning notification: "Previous wizard session could not be loaded"
- Delete corrupted file
- Return `null` from `load()`

**File Write Errors:**
- Log to output channel with full error details
- Emit error via `onSaveError` event
- Show warning notification: "Failed to save wizard progress"
- Do NOT block user workflow

**No Workspace:**
- If `vscode.workspace.workspaceFolders` is empty/undefined
- Disable persistence entirely (memory-only mode)
- Log info message: "Wizard persistence disabled: no workspace folder"

### 12. Clear State Triggers

**Manual Clear:**
- "Reset Wizard" command: `agentify.resetWizard`
- Calls `persistenceService.clear()` then resets state

**Automatic Clear:**
- On successful steering file generation (Step 8 completion)
- After "Start Fresh" action from resume banner

### 13. Integration Points

**TabbedPanelProvider Changes:**
1. Add `_persistenceService: WizardStatePersistenceService` member
2. Initialize service in constructor
3. Call `load()` in `resolveWebviewView()` after panel creation
4. Add `_resumeBannerState` to track banner visibility
5. Wire save calls to state mutation handlers
6. Add resume/startFresh message handlers

**New Message Commands:**
```typescript
// In WIZARD_COMMANDS constant
RESUME_SESSION: 'resumeSession',
START_FRESH: 'startFresh',
DISMISS_RESUME_BANNER: 'dismissResumeBanner',
```

**ideationStepHtml.ts Changes:**
- Add `getResumeBannerHtml()` function
- Include banner in Step 1 content (top of wizard)
- Style banner with VS Code theme variables

## Implementation Tasks

### Task 1: Create WizardStatePersistenceService
- Create `src/services/wizardStatePersistenceService.ts`
- Implement singleton pattern with `getWizardStatePersistenceService(context)`
- Implement `load()`, `save()`, `saveImmediate()`, `clear()`, `exists()` methods
- Add debounce logic for `save()` with 500ms delay
- Add schema version validation
- Add conversation history truncation
- Add file size limit checking
- Add error handling with output channel logging

### Task 2: Define PersistedWizardState Type
- Add `PersistedWizardState` interface to `src/types/wizardPanel.ts`
- Add `PersistedFileMetadata` interface
- Add `WIZARD_STATE_SCHEMA_VERSION` constant
- Add conversion functions:
  - `wizardStateToPersistedState(state: WizardState): PersistedWizardState`
  - `persistedStateToWizardState(persisted: PersistedWizardState): WizardState`

### Task 3: Implement Resume Banner UI
- Add `getResumeBannerHtml()` to `src/panels/ideationStepHtml.ts`
- Add banner styles to `src/panels/ideationStyles.ts`
- Add `ResumeBannerState` interface with fields:
  - `visible: boolean`
  - `businessObjectivePreview: string`
  - `stepReached: number`
  - `savedAt: number`
  - `isExpired: boolean`
  - `isVersionMismatch: boolean`
- Add time formatting helper: `formatTimeSince(timestamp: number): string`

### Task 4: Integrate Persistence into TabbedPanelProvider
- Initialize `WizardStatePersistenceService` in constructor
- Load persisted state in `resolveWebviewView()`:
  - Check for existing state
  - Set resume banner state if found
  - Do NOT auto-restore (wait for user action)
- Add debounced save calls after state mutations
- Add immediate save before navigation
- Handle `resumeSession` command:
  - Load and restore state
  - Navigate to `highestStepReached`
  - Hide banner
- Handle `startFresh` command:
  - Clear persisted state
  - Reset to defaults
  - Hide banner

### Task 5: Add Reset Wizard Command
- Register `agentify.resetWizard` command in `extension.ts`
- Command implementation:
  - Call `persistenceService.clear()`
  - Reset panel state to defaults
  - Show info notification: "Wizard reset successfully"

### Task 6: Add Auto-Clear on Generation Success
- In Step 8 generation success handler:
  - Call `persistenceService.clear()`
  - Log: "Wizard state cleared after successful generation"

### Task 7: Update Gitignore Template
- In project initialization (Item 4):
  - Ensure `.agentify/.gitignore` includes `wizard-state.json`
  - Pattern: `wizard-state.json` (relative to .agentify directory)

### Task 8: Add File Upload Metadata Display
- In Step 1 HTML generation:
  - Check for `uploadedFileMetadata` when `uploadedFile` is undefined
  - Show "Previously uploaded: X (re-upload required)" indicator
  - Style as info/warning state with re-upload prompt

## Non-Goals

- Cloud synchronization of wizard state
- Multiple simultaneous sessions
- Export/import wizard state
- Undo/redo functionality
- Conflict resolution between sessions
- Schema migration (prompt to start fresh instead)
- Configurable debounce timing
- Hard expiry enforcement (7-day is soft warning only)

## Testing Considerations

**Unit Tests:**
- `WizardStatePersistenceService` load/save/clear operations
- Schema version validation
- Conversation history truncation
- File size limit enforcement
- State conversion functions

**Integration Tests:**
- Resume flow end-to-end
- Start fresh flow
- Auto-save on state changes
- Clear on generation success

**Manual Test Scenarios:**
1. Start wizard, fill Step 1, close IDE, reopen, verify resume banner
2. Resume session, verify state restored correctly
3. Start fresh, verify state cleared
4. Upload file, close, reopen, verify re-upload prompt
5. Corrupt state file manually, verify error handling
6. Create state with old schema version, verify incompatibility banner

## Success Metrics

- Users can resume wizard sessions after IDE restart
- Resume banner appears within 100ms of panel open
- Auto-save completes within 600ms of last change
- No data loss for in-progress wizard sessions
- Clear error messaging for edge cases
