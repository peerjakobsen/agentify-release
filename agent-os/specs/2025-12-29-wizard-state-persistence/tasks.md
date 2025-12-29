# Task Breakdown: Wizard State Persistence

## Overview
Total Tasks: 38

## Task List

### Types & Schema Layer

#### Task Group 1: Persisted State Types and Schema
**Dependencies:** None

- [x] 1.0 Complete persisted state type definitions
  - [x] 1.1 Write 5 focused tests for PersistedWizardState and conversion functions
    - Test PersistedWizardState includes all required fields
    - Test wizardStateToPersistedState() conversion preserves data correctly
    - Test persistedStateToWizardState() conversion handles uploadedFile metadata
    - Test WIZARD_STATE_SCHEMA_VERSION constant is defined
    - Test uploadedFileMetadata optional field exists in WizardState interface
  - [x] 1.2 Define WIZARD_STATE_SCHEMA_VERSION constant in wizardPanel.ts
    - Initial version: 1
    - Export as named constant for version checking
  - [x] 1.3 Define PersistedFileMetadata interface in wizardPanel.ts
    - Fields: fileName (string), fileSize (number), uploadedAt (number) // epoch milliseconds
    - Field: requiresReupload (literal true)
    - Follow UploadedFile interface pattern
  - [x] 1.4 Define PersistedWizardState interface in wizardPanel.ts
    - Metadata fields: schemaVersion (number), savedAt (number) // epoch milliseconds for easy comparison
    - Navigation fields: currentStep, highestStepReached, validationAttempted
    - Step 1 fields: businessObjective, industry, customIndustry, systems, customSystems, uploadedFileMetadata
    - Step 2-7 state objects: aiGapFillingState, outcome, security, agentDesign, mockData, demoStrategy
    - Note: Step 8 is generation, no persistent state needed
    - Follow WizardState interface structure
  - [x] 1.5 Create wizardStateToPersistedState() conversion function
    - Extract all persisted fields from WizardState
    - Convert uploadedFile to uploadedFileMetadata (store metadata, not binary)
    - Add schemaVersion and savedAt timestamp
    - Truncate conversation histories to max 10 messages
  - [x] 1.6 Add uploadedFileMetadata optional field to WizardState interface
    - Type: PersistedFileMetadata | undefined
    - Used by UI to show re-upload indicator when uploadedFile is undefined
  - [x] 1.7 Create persistedStateToWizardState() conversion function
    - Convert PersistedWizardState back to WizardState
    - Set uploadedFile to undefined (binary data not persisted)
    - Preserve uploadedFileMetadata for UI display
  - [x] 1.8 Ensure type definition tests pass
    - Run ONLY the 5 tests written in 1.1
    - Verify types compile without errors

**Acceptance Criteria:**
- The 5 tests written in 1.1 pass
- PersistedWizardState interface properly defined with all fields
- WizardState includes uploadedFileMetadata optional field
- Conversion functions handle uploadedFile metadata correctly
- Schema version constant exported

### Service Layer

#### Task Group 2: WizardStatePersistenceService
**Dependencies:** Task Group 1

- [x] 2.0 Complete persistence service implementation
  - [x] 2.1 Write 7 focused tests for WizardStatePersistenceService
    - Test load() returns null when no state file exists
    - Test save() writes state to correct path
    - Test saveImmediate() bypasses debounce
    - Test clear() deletes state file
    - Test exists() correctly detects state file presence
    - Test schema version validation rejects mismatched versions
    - Test load() returns correct status for version_mismatch and corrupted cases
  - [x] 2.2 Create wizardStatePersistenceService.ts following configService.ts pattern
    - Export getWizardStatePersistenceService(context) singleton getter
    - Store state at `.agentify/wizard-state.json`
    - Implement vscode.Disposable for cleanup
    - Use vscode.workspace.fs API for file operations
  - [x] 2.3 Implement load() method
    - Return LoadResult: { state: PersistedWizardState | null, status: 'loaded' | 'not_found' | 'version_mismatch' | 'corrupted' }
    - Check schemaVersion against WIZARD_STATE_SCHEMA_VERSION
    - Wrap JSON.parse in try-catch, return status: 'corrupted' on parse error
    - Return status: 'version_mismatch' when schemaVersion doesn't match
    - Log specific error details to output channel for debugging
  - [x] 2.4 Implement save() method with debouncing
    - 500ms debounce using setTimeout/clearTimeout pattern
    - Convert WizardState to PersistedWizardState
    - Call internal _writeState() after debounce
    - Implement private _writeState(state: PersistedWizardState) method
    - Handle JSON.stringify and file write errors
  - [x] 2.5 Implement saveImmediate() method
    - Clear any pending debounced save
    - Write state immediately
    - Return Promise<void> for await support
  - [x] 2.6 Implement clear() method
    - Delete .agentify/wizard-state.json
    - Handle file not found gracefully
    - Log operation to output channel
  - [x] 2.7 Implement exists() method
    - Return Promise<boolean>
    - Use vscode.workspace.fs.stat() for existence check
  - [x] 2.8 Add onSaveError event emitter
    - Use vscode.EventEmitter<Error> pattern
    - Fire event on file write failures
    - Follow mockDataService.ts event pattern
  - [x] 2.9 Ensure persistence service tests pass
    - Run ONLY the 7 tests written in 2.1
    - Verify all methods work correctly

**Acceptance Criteria:**
- The 7 tests written in 2.1 pass
- Service follows configService.ts singleton pattern
- Debounced save with 500ms delay works correctly
- LoadResult status values correctly indicate load outcome
- Schema version validation prevents incompatible loads

### Conversation Truncation & Size Limits

#### Task Group 3: State Size Management
**Dependencies:** Task Group 2

- [x] 3.0 Complete state size management
  - [x] 3.1 Write 4 focused tests for truncation and size limits
    - Test truncateConversationHistory() keeps last N messages
    - Test file size check triggers truncation at 500KB
    - Test progressive truncation (10 -> 5 -> 2 -> 0 messages)
    - Test size limit exceeded shows warning notification
  - [x] 3.2 Implement truncateConversationHistory() helper function
    - Accept messages array and limit (default 10)
    - Return last N messages using slice(-limit)
    - Preserve message order
  - [x] 3.3 Implement applyConversationTruncation() for all conversation arrays
    - Truncate aiGapFillingState.conversationHistory
    - Apply before serialization in wizardStateToPersistedState()
  - [x] 3.4 Implement file size limit checking in _writeState()
    - Maximum 500KB (check JSON.stringify().length)
    - Progressive truncation strategy:
      - First pass: limit conversations to 5 messages
      - Second pass: limit to 2 messages
      - Third pass: clear all conversation histories
    - Skip save and show warning if still over limit
  - [x] 3.5 Add size limit warning notification
    - Show vscode.window.showWarningMessage() when size exceeded
    - Message: "Wizard state too large to save. Some conversation history may be lost."
    - Log details to output channel
  - [x] 3.6 Ensure size management tests pass
    - Run ONLY the 4 tests written in 3.1
    - Verify truncation and size limits work correctly

**Acceptance Criteria:**
- The 4 tests written in 3.1 pass
- Conversation histories truncated to max 10 messages
- 500KB file size limit enforced with progressive truncation
- User notified when state cannot be saved

### Resume Banner UI

#### Task Group 4: Resume Banner HTML and Styling
**Dependencies:** Task Groups 1, 2

- [x] 4.0 Complete resume banner UI components
  - [x] 4.1 Write 6 focused tests for resume banner HTML rendering
    - Test banner renders when persisted state exists
    - Test business objective preview truncated to 80 chars
    - Test time formatting (minutes, hours, days)
    - Test 7-day expiry warning text displayed
    - Test version mismatch shows incompatibility banner
    - Test calculateExpiryStatus() returns correct isExpired and daysOld
  - [x] 4.2 Define ResumeBannerState interface in wizardPanel.ts
    - Fields: visible (boolean), businessObjectivePreview (string)
    - Fields: stepReached (number), savedAt (number)
    - Fields: isExpired (boolean), isVersionMismatch (boolean)
  - [x] 4.3 Implement formatTimeSince() helper function
    - "Just now" for < 1 minute
    - "X minutes ago" for < 60 minutes
    - "X hours ago" for < 24 hours
    - "X days ago" for >= 24 hours
  - [x] 4.4 Implement calculateExpiryStatus() helper function
    - Calculate days since savedAt timestamp
    - Return { isExpired: boolean, daysOld: number }
    - Expiry threshold: 7 days
    - Used by resume banner to show warning text
  - [x] 4.5 Implement getResumeBannerHtml() function in ideationStepHtml.ts
    - Show business objective preview (truncate to 80 chars with ellipsis)
    - Display step reached and step label (e.g., "Step 3 of 8 - Outcomes")
    - Show time since save using formatTimeSince()
    - Include [Resume] and [Start Fresh] action buttons
    - Add 7-day expiry warning text when applicable
  - [x] 4.6 Implement getVersionMismatchBannerHtml() function
    - Show incompatibility message
    - Only offer [Start Fresh] button (no Resume)
    - Style with warning/error colors
  - [x] 4.7 Add banner styles to ideationStyles.ts
    - Container with border, background, padding
    - Use VS Code theme variables
    - Button styling matching existing wizard buttons
    - Warning text styling for expiry/mismatch
  - [x] 4.8 Ensure banner UI tests pass
    - Run ONLY the 6 tests written in 4.1
    - Verify HTML rendering produces correct structure

**Acceptance Criteria:**
- The 6 tests written in 4.1 pass
- Resume banner displays with all required information
- Time formatting shows human-readable duration
- Expiry status correctly calculated
- Version mismatch banner shows appropriate message

### Resume Banner Script Handlers

#### Task Group 5: Resume Banner Webview Integration
**Dependencies:** Task Group 4

- [x] 5.0 Complete resume banner script handlers
  - [x] 5.1 Write 4 focused tests for banner script handlers
    - Test Resume button posts resumeSession command
    - Test Start Fresh button posts startFresh command
    - Test banner hidden after action taken
    - Test file re-upload indicator shown when uploadedFileMetadata exists
  - [x] 5.2 Add banner commands to WIZARD_COMMANDS in wizardPanel.ts
    - RESUME_SESSION: 'resumeSession'
    - START_FRESH: 'startFresh'
    - DISMISS_RESUME_BANNER: 'dismissResumeBanner'
  - [x] 5.3 Add banner button handlers to ideationScript.ts
    - Handle resume-session-button click
    - Handle start-fresh-button click
    - Post commands via vscode.postMessage()
    - Follow existing button handler pattern
  - [x] 5.4 Implement file re-upload indicator in Step 1 HTML
    - Check state.uploadedFileMetadata (populated from persisted state)
    - This field is set when resuming, undefined for fresh sessions
    - Check for uploadedFileMetadata when uploadedFile is undefined
    - Display "Previously uploaded: {fileName} ({fileSize} - re-upload required)"
    - Style as info/warning state
    - Keep file input functional for re-upload
  - [x] 5.5 Ensure banner script tests pass
    - Run ONLY the 4 tests written in 5.1
    - Verify button handlers work correctly

**Acceptance Criteria:**
- The 4 tests written in 5.1 pass
- Resume/Start Fresh buttons post correct commands
- File re-upload indicator displays with metadata
- Banner hidden after user action

### TabbedPanel Integration

#### Task Group 6: TabbedPanelProvider Integration
**Dependencies:** Task Groups 2, 5

- [x] 6.0 Complete TabbedPanelProvider integration
  - [x] 6.1 Write 5 focused tests for panel integration
    - Test persistence service initialized in constructor
    - Test load() called in resolveWebviewView()
    - Test debounced save called on state mutations
    - Test immediate save called before navigation
    - Test resumeSession command restores state and navigates
  - [x] 6.2 Add persistence service member to TabbedPanelProvider
    - Private member: _persistenceService: WizardStatePersistenceService
    - Private member: _resumeBannerState: ResumeBannerState
    - Initialize service in constructor with context
  - [x] 6.3 Implement state loading in resolveWebviewView()
    - Call persistenceService.load() to get LoadResult
    - If status === 'loaded': set _resumeBannerState with state preview, visible = true
    - If status === 'version_mismatch': set _resumeBannerState.isVersionMismatch = true, visible = true
    - If status === 'corrupted': show warning notification, treat as 'not_found'
    - If status === 'not_found': do nothing, no banner shown
    - Do NOT auto-restore (wait for user resume action)
  - [x] 6.4 Wire debounced save to state mutation handlers
    - Call persistenceService.save() after each state change
    - Apply to: updateBusinessObjective, updateIndustry, toggleSystem, etc.
    - Follow existing state mutation pattern in handleIdeationMessage()
  - [x] 6.5 Wire immediate save to navigation handlers
    - Call await persistenceService.saveImmediate() in ideationNavigateForward()
    - Call await persistenceService.saveImmediate() in ideationNavigateBackward()
    - Save before navigation completes
  - [x] 6.6 Implement resumeSession message handler
    - Load persisted state with persistenceService.load()
    - Convert to WizardState using persistedStateToWizardState()
    - Update _ideationState with restored values
    - Navigate to highestStepReached
    - Set _resumeBannerState.visible = false
    - Call syncStateToWebview()
  - [x] 6.7 Implement startFresh message handler
    - Call persistenceService.clear()
    - Reset to createDefaultWizardState()
    - Stay on Step 1
    - Set _resumeBannerState.visible = false
    - Call syncStateToWebview()
  - [x] 6.8 Ensure panel integration tests pass
    - Run ONLY the 5 tests written in 6.1
    - Verify state persistence and restoration work correctly

**Acceptance Criteria:**
- The 5 tests written in 6.1 pass
- State auto-saved on changes with debouncing
- State immediately saved before navigation
- Resume/Start Fresh actions work correctly

### Reset Wizard Command

#### Task Group 7: Reset Wizard VS Code Command
**Dependencies:** Task Group 6

- [x] 7.0 Complete Reset Wizard command
  - [x] 7.1 Write 3 focused tests for reset command
    - Test command registered with correct ID
    - Test command clears persisted state
    - Test command resets panel state and shows notification
  - [x] 7.2 Add command contribution to package.json
    - Command ID: agentify.resetWizard
    - Title: "Agentify: Reset Wizard"
    - Category: Agentify
  - [x] 7.3 Implement command handler in extension.ts
    - Call persistenceService.clear()
    - Get TabbedPanelProvider instance and reset state
    - Show info notification: "Wizard reset successfully"
    - Log to output channel
  - [x] 7.4 Ensure reset command tests pass
    - Run ONLY the 3 tests written in 7.1
    - Verify command functionality

**Acceptance Criteria:**
- The 3 tests written in 7.1 pass
- Command visible in Command Palette
- State cleared and wizard reset on execution
- User notified of successful reset

### Auto-Clear on Generation

#### Task Group 8: Auto-Clear on Steering File Generation
**Dependencies:** Task Group 6

- [x] 8.0 Complete auto-clear on generation success
  - [x] 8.1 Write 2 focused tests for auto-clear
    - Test state cleared after successful steering file generation
    - Test state preserved if generation fails
  - [x] 8.2 Add clear call to Step 8 generation success handler
    - After steering files successfully written
    - Call persistenceService.clear()
    - Log: "Wizard state cleared after successful generation"
  - [x] 8.3 Ensure auto-clear tests pass
    - Run ONLY the 2 tests written in 8.1
    - Verify auto-clear triggers on success only

**Acceptance Criteria:**
- The 2 tests written in 8.1 pass
- State cleared on successful generation
- State preserved if generation fails

### Gitignore Update

#### Task Group 9: Gitignore Template Update
**Dependencies:** None (can run in parallel with earlier groups)

- [x] 9.0 Complete gitignore template update
  - [x] 9.1 Write 1 focused test for gitignore inclusion
    - Test .agentify/.gitignore includes wizard-state.json
  - [x] 9.2 Update project initialization to include wizard-state.json in gitignore
    - Add wizard-state.json to .agentify/.gitignore template
    - Ensure existing projects can add manually
  - [x] 9.3 Ensure gitignore test passes
    - Run ONLY the test written in 9.1
    - Verify gitignore entry present

**Acceptance Criteria:**
- The test written in 9.1 passes
- wizard-state.json excluded from version control
- Existing projects can manually add entry

### Testing

#### Task Group 10: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-9

- [x] 10.0 Review existing tests and fill critical gaps only
  - [x] 10.1 Review tests from Task Groups 1-9
    - Review 5 tests from type definitions (Task 1.1)
    - Review 7 tests from persistence service (Task 2.1)
    - Review 4 tests from size management (Task 3.1)
    - Review 6 tests from banner UI (Task 4.1)
    - Review 4 tests from banner scripts (Task 5.1)
    - Review 5 tests from panel integration (Task 6.1)
    - Review 3 tests from reset command (Task 7.1)
    - Review 2 tests from auto-clear (Task 8.1)
    - Review 1 test from gitignore (Task 9.1)
    - Total existing tests: 37 tests
  - [x] 10.2 Analyze test coverage gaps for persistence feature only
    - Identify critical user workflows lacking coverage
    - Focus on end-to-end flows: save -> close -> reopen -> resume
    - Prioritize error handling and edge cases
  - [x] 10.3 Write up to 8 additional strategic tests maximum
    - End-to-end: Start wizard -> fill Step 1 -> close -> reopen -> resume banner appears
    - End-to-end: Resume session -> verify state restored -> navigate to correct step
    - End-to-end: Start Fresh -> verify state cleared -> wizard at Step 1
    - Integration: State mutation -> debounced save fires after 500ms
    - Integration: Navigate forward -> immediate save before navigation
    - Edge case: Corrupted JSON file -> warning shown, Start Fresh offered
    - Edge case: No workspace folder -> persistence disabled gracefully
    - Edge case: Schema version mismatch -> incompatibility banner shown
  - [x] 10.4 Run feature-specific tests only
    - Run ONLY tests related to wizard state persistence feature
    - Expected total: approximately 45 tests maximum
    - Do NOT run entire application test suite
    - Verify all critical workflows pass

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 45 tests total)
- Critical user workflows for persistence are covered
- Up to 8 additional tests added for integration and edge cases
- Testing focused exclusively on persistence feature requirements

## Execution Order

Recommended implementation sequence:

1. **Types & Schema (Task Group 1)** - Foundation for persistence
2. **Persistence Service (Task Group 2)** - Core service (depends on types)
3. **Size Management (Task Group 3)** - Truncation logic (depends on service)
4. **Gitignore Update (Task Group 9)** - Can run in parallel with 2-3
5. **Resume Banner UI (Task Group 4)** - UI components (depends on types)
6. **Banner Script Handlers (Task Group 5)** - Webview integration (depends on banner UI)
7. **TabbedPanel Integration (Task Group 6)** - Wires everything together (depends on 2, 5)
8. **Reset Command (Task Group 7)** - VS Code command (depends on 6)
9. **Auto-Clear on Generation (Task Group 8)** - Generation hook (depends on 6)
10. **Test Review (Task Group 10)** - Final verification (depends on all)

## Key Patterns to Follow

| Pattern | Source File | Usage |
|---------|-------------|-------|
| File system operations | configService.ts | vscode.workspace.fs API for read/write |
| Singleton service | mockDataService.ts | getMockDataService() getter pattern |
| State types | wizardPanel.ts | PersistedWizardState alongside WizardState |
| Debounce pattern | common JS | setTimeout/clearTimeout for 500ms delay |
| Event emitter | mockDataService.ts | vscode.EventEmitter for onSaveError |
| HTML generation | ideationStepHtml.ts | getResumeBannerHtml() function |
| Button handlers | ideationScript.ts | Event listeners posting commands |
| Command registration | extension.ts | vscode.commands.registerCommand() |

## Technical Notes

- **Storage path:** `.agentify/wizard-state.json` in workspace root
- **Schema version:** WIZARD_STATE_SCHEMA_VERSION = 1
- **Debounce delay:** 500ms (not configurable)
- **Conversation limit:** 10 messages per conversation array
- **File size limit:** 500KB maximum
- **Expiry warning:** 7 days (soft check, allows resume)
- **Preview truncation:** 80 characters for business objective
- **Multi-root workspace:** Use first workspace folder only
- **No binary persistence:** uploadedFile.data excluded, metadata only
- **LoadResult status values:** `'loaded' | 'not_found' | 'version_mismatch' | 'corrupted'`
