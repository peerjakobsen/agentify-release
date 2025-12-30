# Task Breakdown: Wizard Step 8 - Generate

## Overview
Total Tasks: 31
Estimated Complexity: Medium-High

This spec implements the final wizard step (Step 8) that displays a pre-generation summary of all wizard inputs, orchestrates steering file generation with real-time progress UI, and provides post-generation actions including file reveal and start over functionality.

## Key Reference Files

| Pattern | Source File | What to Reuse |
|---------|-------------|---------------|
| Logic handler class | `/src/panels/ideationStep6Logic.ts` | Class structure, setState, getState, dispose |
| Logic handler streaming | `/src/panels/ideationStep7Logic.ts` | Sequential async operations, streaming handlers |
| Wizard state types | `/src/types/wizardPanel.ts` | State interfaces, commands, factory functions |
| Agent card layout | `/src/panels/ideationStepHtml.ts` | `.agent-card` class, status badges, grid layout |
| Status icons | `/src/utils/logPanelHtmlGenerator.ts` | `getEventIcon()`, spinner/check/X SVG icons |
| Button handlers | `/src/panels/ideationScript.ts` | `vscode.postMessage({ command })` pattern |
| Service pattern | `/src/services/mockDataService.ts` | Event-based service with progress callbacks |

## Task List

### Task Group 1: State Interfaces and Types

#### Task 1.0: Define GenerationState and Step 8 Types
**Dependencies:** None

- [x] 1.1 Write 4 focused tests for Step 8 type definitions
  - Test GenerationState interface initialization via factory function
  - Test STEERING_FILES constant contains expected 7 files
  - Test StepSummary interface structure with validation status
  - Test WIZARD_COMMANDS includes Step 8 commands

- [x] 1.2 Add GenerationState interface to `/src/types/wizardPanel.ts`
  - Fields: `isGenerating: boolean`
  - Fields: `currentFileIndex: number`
  - Fields: `completedFiles: string[]`
  - Fields: `failedFile?: { name: string; error: string }`
  - Fields: `generatedFilePaths: string[]`
  - Fields: `accordionExpanded: boolean`
  - Fields: `canGenerate: boolean` (true if no step has 'error' validation status)
  - Fields: `isPlaceholderMode: boolean` (true until Phase 3 Item 28 implements real generation)
  - Follow pattern from MockDataState interface

- [x] 1.3 Add StepSummary interface for pre-generation cards
  - Fields: `stepNumber: number`
  - Fields: `stepName: string`
  - Fields: `summaryData: Record<string, string>`
  - Fields: `validationStatus: 'complete' | 'warning' | 'error'`
  - Fields: `validationMessage?: string`

- [x] 1.4 Add STEERING_FILES constant array
  - Files: `['product.md', 'tech.md', 'structure.md', 'customer-context.md', 'integration-landscape.md', 'security-policies.md', 'demo-strategy.md']`
  - Export from wizardPanel.ts for use by service and UI

- [x] 1.5 Add Step 8 commands to WIZARD_COMMANDS
  - `STEP8_GENERATE: 'step8Generate'`
  - `STEP8_GENERATE_AND_OPEN_KIRO: 'step8GenerateAndOpenKiro'`
  - `STEP8_START_OVER: 'step8StartOver'`
  - `STEP8_OPEN_FILE: 'step8OpenFile'`
  - `STEP8_RETRY: 'step8Retry'`
  - `STEP8_TOGGLE_ACCORDION: 'step8ToggleAccordion'`
  - `STEP8_EDIT_STEP: 'step8EditStep'`

- [x] 1.6 Add createDefaultGenerationState() factory function
  - Return default GenerationState with isGenerating: false
  - Follow pattern from createDefaultMockDataState()

- [x] 1.7 Extend WizardState interface with generation field
  - Add `generation: GenerationState` to WizardState
  - Update createDefaultWizardState() to include generation

- [x] 1.8 Ensure type definition tests pass
  - Run ONLY the 4 tests written in 1.1
  - Verify TypeScript compilation succeeds

**Acceptance Criteria:**
- The 4 tests written in 1.1 pass
- GenerationState interface is properly typed
- All new commands are added to WIZARD_COMMANDS
- Factory function creates correct default state

---

### Task Group 2: Stub Steering File Service

#### Task 2.0: Create SteeringFileService Stub
**Dependencies:** Task Group 1

- [x] 2.1 Write 5 focused tests for SteeringFileService stub
  - Test service emits 'fileStart' event for each file
  - Test service emits 'fileComplete' event with file path
  - Test service emits 'fileError' event on simulated failure
  - Test service returns generated file paths on completion
  - Test service accepts wizard state as input parameter

- [x] 2.2 Create `/src/services/steeringFileService.ts` following MockDataService pattern
  - Create SteeringFileService class with EventEmitter pattern
  - Implement onFileStart, onFileComplete, onFileError event methods
  - Follow singleton pattern from getMockDataService()

- [x] 2.3 Define service event types
  - `FileProgressEvent: { fileName: string; index: number; total: number }`
  - `FileCompleteEvent: { fileName: string; filePath: string }`
  - `FileErrorEvent: { fileName: string; error: string }`

- [x] 2.4 Implement stub generateSteeringFiles() method
  - Method signature: `generateSteeringFiles(state: IdeationState, startIndex?: number)`
  - If startIndex provided, skip files before that index (for retry functionality)
  - Return type: `Promise<{ files: string[], placeholder: boolean }>`
  - Return object includes `placeholder: true` flag for UI to show preview mode indicator
  - Iterate through STEERING_FILES array (from startIndex if provided)
  - Emit fileStart before each file
  - Add simulated delay (200ms per file) for progress visibility
  - Emit fileComplete after each file
  - Return array of file paths on success

- [x] 2.5 Add TODO comment for Phase 3 Item 28
  - Comment: `// TODO: Phase 3 Item 28 - Implement actual steering file generation`
  - Document expected output location: `.kiro/steering/`
  - Note that stub returns simulated success
  - Stub always returns `placeholder: true` in return object

- [x] 2.6 Ensure service stub tests pass
  - Run ONLY the 5 tests written in 2.1
  - Verify event emission sequence is correct

**Acceptance Criteria:**
- The 5 tests written in 2.1 pass
- Service follows established MockDataService patterns
- Events emit in correct sequence during generation
- Stub returns simulated success after delay

---

### Task Group 3: Step 8 Logic Handler

#### Task 3.0: Implement Step8LogicHandler Class
**Dependencies:** Task Groups 1, 2

- [x] 3.1 Write 6 focused tests for Step8LogicHandler
  - Test constructor initializes with state and callbacks
  - Test handleGenerate() sets isGenerating to true
  - Test handleRetry() resumes from failed file index
  - Test handleStartOver() calls confirmation callback
  - Test aggregateValidationStatus() returns correct status per step
  - Test getStepSummaries() returns summaries for Steps 1-7

- [x] 3.2 Create `/src/panels/ideationStep8Logic.ts` following Step6LogicHandler pattern
  - Constructor accepts: context, state (GenerationState), callbacks
  - Implement setState() and getState() methods
  - Implement dispose() for cleanup

- [x] 3.3 Define Step8ContextInputs interface
  - Reference to full IdeationState for file generation context
  - Used by generateSteeringFiles() call

- [x] 3.4 Define Step8Callbacks interface
  - `updateWebviewContent: () => void`
  - `syncStateToWebview: () => void`
  - `showConfirmDialog: (message: string, options: string[]) => Promise<string | undefined>`
  - `openFile: (filePath: string) => Promise<void>`

- [x] 3.5 Implement handleGenerate() method
  - Before generation, verify canGenerate is true (no 'error' validation status)
  - Set isGenerating = true, reset state
  - Call SteeringFileService.generateSteeringFiles()
  - Handle fileStart events - update currentFileIndex, auto-expand accordion
  - Handle fileComplete events - add to completedFiles array
  - Handle fileError events - set failedFile, stop generation
  - On success: set generatedFilePaths, auto-collapse accordion, set isGenerating = false
  - Set isPlaceholderMode from service response `placeholder` field

- [x] 3.6 Implement handleRetry() method
  - Resume generation from failedFile index (not from beginning)
  - Clear failedFile state
  - Call SteeringFileService.generateSteeringFiles(state, failedFileIndex) to resume from failed file

- [x] 3.7 Implement handleStartOver() method
  - Call showConfirmDialog with warning message
  - Message: "This will clear all wizard data. Generated files will not be deleted."
  - Options: ["Start Over", "Cancel"]
  - On "Start Over": reset all IdeationState to defaults, navigate to Step 1
  - On "Cancel": no action

- [x] 3.8 Implement handleOpenFile() method
  - Call callbacks.openFile(filePath)
  - Use VS Code vscode.commands.executeCommand('vscode.open', fileUri)

- [x] 3.9 Implement handleToggleAccordion() method
  - Toggle state.accordionExpanded
  - Call updateWebviewContent()

- [x] 3.10 Implement getStepSummaries() method
  - Return StepSummary[] for Steps 1-7
  - Extract key data from IdeationState for each step
  - Call aggregateValidationStatus() for each step

- [x] 3.11 Implement aggregateValidationStatus() for each step
  - Step 1: Check businessObjective, industry required fields
  - Step 2: Check assumptionsAccepted flag
  - Step 3: Check primaryOutcome, successMetrics length
  - Step 4: Return 'warning' if skipped, otherwise 'complete'
  - Step 5: Check confirmedAgents length
  - Step 6: Check mockDefinitions length, warn if empty sampleData
  - Step 7: Check ahaMoments length, warn if empty

- [x] 3.12 Ensure logic handler tests pass
  - Run ONLY the 6 tests written in 3.1
  - Verify state transitions work correctly

**Acceptance Criteria:**
- The 6 tests written in 3.1 pass
- Logic handler follows Step6LogicHandler patterns
- Generation flow handles success, error, and retry cases
- Validation aggregation correctly identifies step status

---

### Task Group 4: Pre-Generation Summary UI

#### Task 4.0: Implement Summary Cards HTML
**Dependencies:** Task Groups 1, 3

- [x] 4.1 Write 4 focused tests for summary card HTML generation
  - Test renderStepSummaryCard() outputs correct HTML structure
  - Test card shows green checkmark icon for valid status
  - Test card shows yellow warning icon with message for warning status
  - Test card shows "Edit" button with correct step navigation data

- [x] 4.2 Add generateStep8Html() function to ideationStepHtml.ts
  - Accept IdeationState and GenerationState as parameters
  - Conditionally render pre-generation vs generation progress vs post-generation UI
  - Follow pattern from generateStep6Html() structure

- [x] 4.3 Implement renderPreGenerationSummary() helper
  - Call getStepSummaries() from logic handler
  - Render summary cards grid container (.summary-cards-grid)
  - Iterate through StepSummary[] and render each card

- [x] 4.4 Implement renderStepSummaryCard() helper
  - Use .agent-card class structure from Step 5
  - Card header: step name + validation status icon
  - Card body: condensed key data (2-3 lines max per step)
  - Card footer: "Edit" button with data-step attribute

- [x] 4.5 Define status icon SVGs following logPanelHtmlGenerator pattern
  - Green checkmark: `<svg class="status-icon status-complete">...</svg>`
  - Yellow warning: `<svg class="status-icon status-warning">...</svg>`
  - Red error: `<svg class="status-icon status-error">...</svg>`
  - Use inline SVG approach for performance

- [x] 4.6 Add summary card CSS styles to ideationStyles.ts
  - .summary-cards-grid with CSS Grid layout (2 columns)
  - .summary-card with border, padding, rounded corners
  - .summary-card-header with flex layout for title + icon
  - .summary-card-body with condensed text styling
  - .summary-card-footer with Edit button styling

- [x] 4.7 Implement getSummaryDataForStep() helper for each step
  - Step 1: industry, systems count, objective preview (truncated)
  - Step 2: assumptions count, "Accepted" badge if accepted
  - Step 3: outcome preview, KPI count, stakeholder count
  - Step 4: sensitivity level, frameworks list, "Skipped" if skipped
  - Step 5: agent count, orchestration pattern
  - Step 6: mock definitions count, tools list
  - Step 7: aha moments count, scenes count

- [x] 4.8 Ensure summary card tests pass
  - Run ONLY the 4 tests written in 4.1
  - Verify HTML structure matches design

**Acceptance Criteria:**
- The 4 tests written in 4.1 pass
- Summary cards display condensed data for each step
- Validation status icons render correctly
- Edit buttons navigate to correct step

---

### Task Group 5: Generation Progress UI

#### Task 5.0: Implement Progress Checklist and Accordion
**Dependencies:** Task Groups 1, 3, 4

- [x] 5.1 Write 5 focused tests for generation progress UI
  - Test renderGenerationProgress() shows 3-item checklist
  - Test progress shows spinner icon while generating
  - Test accordion auto-expands during generation
  - Test accordion shows file-level progress with status icons
  - Test summary text shows progress count ("3/7 files")

- [x] 5.2 Implement renderGenerationProgress() helper
  - Vertical checklist with 3 items:
    1. "Validate wizard inputs" - check icon on start
    2. "Generate steering files" - accordion with nested file progress
    3. "Ready for Kiro" - check icon on complete
  - Use state.isGenerating to determine current item
  - If state.isPlaceholderMode is true, show subtle indicator below progress: "Preview mode — actual file generation coming in Phase 3"
  - Style preview mode indicator with muted/italic text

- [x] 5.3 Implement renderProgressItem() helper
  - Accept: label, status ('pending' | 'active' | 'complete' | 'error')
  - Render status icon: spinner (active), check (complete), X (error), circle (pending)
  - Add .progress-item class with flex layout

- [x] 5.4 Implement renderFileProgressAccordion() helper
  - Accordion header: "Generate steering files" + summary text + chevron icon
  - Summary text: "Generating... (3/7 files)" or "7/7 files created"
  - Chevron: chevron-right (collapsed) / chevron-down (expanded)
  - data-accordion attribute for toggle handler

- [x] 5.5 Implement renderFileProgressList() helper
  - Nested list of STEERING_FILES
  - Each row: file name, status icon, optional error message
  - Status states: pending, active (spinner), complete (check), error (X), skipped
  - Files after error show "Skipped" status

- [x] 5.6 Add accordion auto-expand/collapse logic
  - Auto-expand when isGenerating = true
  - Auto-expand when failedFile is set
  - Auto-collapse when all files complete successfully
  - Respect manual toggle via state.accordionExpanded

- [x] 5.7 Define spinner SVG icon
  - Animated CSS spinner using SVG circle
  - Class: .spinner-icon with CSS animation
  - Follow VS Code loading spinner pattern

- [x] 5.8 Add generation progress CSS styles to ideationStyles.ts
  - .progress-checklist with vertical layout
  - .progress-item with icon + label
  - .progress-accordion with expand/collapse
  - .file-progress-list with indented nested items
  - .spinner-icon with rotation animation

- [x] 5.9 Ensure progress UI tests pass
  - Run ONLY the 5 tests written in 5.1
  - Verify accordion expand/collapse works

**Acceptance Criteria:**
- The 5 tests written in 5.1 pass
- Progress checklist shows 3 main items
- File accordion expands/collapses correctly
- Progress count updates in real-time

---

### Task Group 6: Button Handlers and Post-Generation UI

#### Task 6.0: Implement Buttons and Post-Generation State
**Dependencies:** Task Groups 1-5

- [x] 6.1 Write 5 focused tests for button handlers
  - Test "Generate" button triggers handleGenerate()
  - Test "Generate" button disabled during generation
  - Test "Generate & Open in Kiro" button calls handleGenerateAndOpenKiro()
  - Test "Start Over" button triggers confirmation dialog
  - Test "Generate" button disabled when canGenerate is false

- [x] 6.2 Implement renderActionButtons() helper with environment-aware Kiro button
  - "Generate" button: primary style, disabled when isGenerating or !canGenerate
  - "Generate" button shows tooltip "Fix validation errors to generate" when disabled due to !canGenerate
  - "Generate" button shows tooltip "Generation in progress" when disabled due to isGenerating
  - "Generate & Open in Kiro" button: ENABLED in both environments
  - Import isKiroEnvironment() from environment utils
  - In Kiro: After generation, show toast "Steering files generated! Kiro spec integration coming in Phase 3", then reveal .kiro/steering/ folder
  - In VS Code: After generation, show message "Steering files generated! Open this project in Kiro IDE for spec-driven development" with "Learn More" link to https://kiro.dev
  - Buttons container with flex layout

- [x] 6.3 Implement handleGenerateAndOpenKiro() in Step8LogicHandler
  - Call handleGenerate() and await completion
  - Check isKiroEnvironment() from utils/environment.ts
  - If Kiro: Execute vscode.commands.executeCommand('revealInExplorer', steeringFolderUri), show info toast
  - If VS Code: Show info message with "Learn More" button linking to kiro.dev
  - Add TODO comment: "Phase 3 Item 34 will replace toast with: vscode.commands.executeCommand('kiro.startSpecFlow', ...)"

- [x] 6.4 Implement renderPostGenerationSuccess() helper
  - Success message: "Steering files generated successfully!"
  - List of generated files with "Open File" links
  - Each link has data-file-path attribute
  - Message for non-Kiro users: "Open this project in Kiro to activate your steering files"
  - "Start Over" button prominently displayed

- [x] 6.5 Implement renderGenerationError() helper
  - Error message: "Generation failed at {fileName}"
  - Display error details from state.failedFile.error
  - "Retry" button to resume from failed file
  - "Start Over" button as secondary action

- [x] 6.6 Add button click handlers to ideationScript.ts
  - Register handler for step8Generate command
  - Register handler for step8GenerateAndOpenKiro command (calls handleGenerateAndOpenKiro())
  - Register handler for step8StartOver command
  - Register handler for step8OpenFile command with filePath data
  - Register handler for step8Retry command
  - Register handler for step8ToggleAccordion command
  - Register handler for step8EditStep command with step number

- [x] 6.7 Implement command dispatcher in tabbedPanel.ts
  - Add case handlers for all STEP8_* commands
  - Handle step8GenerateAndOpenKiro by calling handleGenerateAndOpenKiro()
  - Route to Step8LogicHandler methods
  - Handle step8EditStep by setting currentStep and updating UI

- [x] 6.8 Add post-generation CSS styles
  - .success-message with success color
  - .file-list with file name + link styling
  - .open-file-link with hover effect
  - .start-over-button with prominent styling
  - .error-message with error color
  - .preview-mode-indicator with muted/italic styling

- [x] 6.9 Ensure button handler tests pass
  - Run ONLY the 5 tests written in 6.1
  - Verify all button actions work correctly

**Acceptance Criteria:**
- The 5 tests written in 6.1 pass
- Generate button triggers generation flow
- Generate & Open in Kiro button works in both environments
- Post-generation shows file list with open links
- Start Over shows confirmation dialog

---

### Task Group 7: Integration and Wizard Navigation

#### Task 7.0: Integrate Step 8 with Wizard Flow
**Dependencies:** Task Groups 1-6

- [x] 7.1 Write 4 focused tests for wizard integration
  - Test Step 7 "Next" navigates to Step 8
  - Test Step 8 "Edit" buttons navigate to correct step
  - Test returning to Step 8 after edit updates summary
  - Test Start Over resets state and navigates to Step 1

- [x] 7.2 Update tabbedPanel.ts to render Step 8
  - Add case for WizardStep.Generate in renderStepContent()
  - Call generateStep8Html() with current state
  - Initialize Step8LogicHandler when entering Step 8

- [x] 7.3 Implement navigation from Step 7 to Step 8
  - Update Step 7 "Next" button to navigate to Step 8
  - No auto-generation on entry (user must click Generate)

- [x] 7.4 Implement Edit button navigation
  - step8EditStep command sets currentStep to target step
  - Store Step 8 as returnStep for back navigation
  - Update highest step reached if navigating forward

- [x] 7.5 Handle back navigation to Step 8
  - When returning from edited step, recalculate summaries
  - Refresh validation status for all steps
  - Preserve generation state if generation was in progress

- [x] 7.6 Update PersistedWizardState for Step 8
  - Add generation field to PersistedWizardState
  - Update wizardStateToPersistedState() conversion
  - Update persistedStateToWizardState() conversion
  - When restoring from persistence, always set isGenerating = false (cannot resume mid-generation)
  - Preserve completedFiles and generatedFilePaths if generation had partially completed

- [x] 7.7 Implement Start Over state reset
  - Reset all IdeationState fields to defaults
  - Navigate to Step 1
  - Clear persisted state file
  - Do NOT delete generated steering files

- [x] 7.8 Ensure integration tests pass
  - Run ONLY the 4 tests written in 7.1
  - Verify navigation flow works correctly

**Acceptance Criteria:**
- The 4 tests written in 7.1 pass
- Step 8 integrates seamlessly with wizard flow
- Edit navigation preserves context
- Start Over properly resets state

---

### Task Group 8: Test Review and Gap Analysis

#### Task 8.0: Review and Fill Testing Gaps
**Dependencies:** Task Groups 1-7

- [x] 8.1 Review tests from Task Groups 1-7
  - Review the 4 tests written in Task 1.1 (types)
  - Review the 5 tests written in Task 2.1 (service)
  - Review the 6 tests written in Task 3.1 (logic handler)
  - Review the 4 tests written in Task 4.1 (summary UI)
  - Review the 5 tests written in Task 5.1 (progress UI)
  - Review the 5 tests written in Task 6.1 (buttons)
  - Review the 4 tests written in Task 7.1 (integration)
  - Total existing tests: 33 tests

- [x] 8.2 Identify critical gaps for Step 8 feature
  - Focus on end-to-end generation workflow
  - Focus on error recovery and retry scenarios
  - Focus on state persistence during generation
  - Do NOT assess entire application coverage

- [x] 8.3 Write up to 8 additional strategic tests
  - Test full generation workflow from Generate click to success
  - Test generation error with retry resume from correct file
  - Test accordion state persists across webview refresh
  - Test validation aggregation with mixed step states
  - Test file open command executes correct VS Code command
  - Test Start Over confirmation dialog flow
  - Test summary card data extraction for all 7 steps
  - Test CSS classes applied correctly for all status states

- [x] 8.4 Run all Step 8 feature tests
  - Run ONLY tests from Tasks 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, and 8.3
  - Expected total: approximately 41 tests
  - Do NOT run entire application test suite
  - Verify all critical workflows pass

**Acceptance Criteria:**
- All Step 8 feature tests pass (approximately 41 tests total)
- Critical generation workflow is fully tested
- Error handling and retry scenarios are covered
- No more than 8 additional tests added

---

## Execution Order

Recommended implementation sequence:

1. **Task Group 1: State Interfaces and Types** (Foundation)
   - Must complete first - all other groups depend on types

2. **Task Group 2: Stub Steering File Service** (Service layer)
   - Provides generation events for logic handler

3. **Task Group 3: Step 8 Logic Handler** (Business logic)
   - Core orchestration logic depends on types and service

4. **Task Group 4: Pre-Generation Summary UI** (UI - Part 1)
   - Can start after logic handler for getStepSummaries()

5. **Task Group 5: Generation Progress UI** (UI - Part 2)
   - Can run in parallel with Task Group 4

6. **Task Group 6: Button Handlers and Post-Generation** (UI - Part 3)
   - Depends on progress UI components

7. **Task Group 7: Integration and Navigation** (Integration)
   - Final UI integration with wizard flow

8. **Task Group 8: Test Review and Gap Analysis** (Testing)
   - After all implementation complete

---

## Files to Create

| File | Purpose |
|------|---------|
| `/src/services/steeringFileService.ts` | Stub service for steering file generation |
| `/src/panels/ideationStep8Logic.ts` | Logic handler for Step 8 |
| `/src/test/types/step8Generation.test.ts` | Type definition tests |
| `/src/test/services/steeringFileService.test.ts` | Service stub tests |
| `/src/test/panels/ideationStep8Logic.test.ts` | Logic handler tests |
| `/src/test/panels/step8HtmlRendering.test.ts` | HTML rendering tests |
| `/src/test/panels/step8Integration.test.ts` | Integration tests |

## Files to Modify

| File | Changes |
|------|---------|
| `/src/types/wizardPanel.ts` | Add GenerationState, StepSummary, STEERING_FILES, Step 8 commands |
| `/src/panels/ideationStepHtml.ts` | Add generateStep8Html() and helper functions |
| `/src/panels/ideationStyles.ts` | Add Step 8 CSS styles |
| `/src/panels/ideationScript.ts` | Add Step 8 button handlers |
| `/src/panels/tabbedPanel.ts` | Add Step 8 command handlers and rendering |
| `/src/panels/ideationStep8Logic.ts` | Import `isKiroEnvironment()` from `/src/utils/environment.ts` |

---

## Scope Boundaries

**In Scope:**
- Pre-generation summary display with edit navigation
- Validation status aggregation across all steps (1-7)
- Generation progress UI with collapsible nested file progress
- Stub service for file generation (actual logic deferred)
- Post-generation success/failure states
- "Open File" links using VS Code reveal
- "Start Over" with confirmation dialog
- Environment-aware "Generate & Open in Kiro" button (works in both VS Code and Kiro)
- Preview mode indicator for stub service

**Out of Scope:**
- Actual steering file generation logic (Phase 3 Item 28)
- Kiro spec trigger functionality (Phase 3 Item 34)
- Partial regeneration (regenerate specific files only)
- Generation history or versioning
- Undo/rollback of generation
- File diff view or preview before generation
