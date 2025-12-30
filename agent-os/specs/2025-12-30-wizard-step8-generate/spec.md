# Specification: Wizard Step 8 - Generate

## Goal

Build the final wizard step (Step 8) that displays a pre-generation checklist summarizing all wizard inputs, orchestrates steering file generation with real-time progress UI, and provides post-generation actions including file reveal and start over functionality.

## User Stories

- As a user completing the wizard, I want to review a summary of all my inputs before generating so I can verify everything is correct
- As a user during generation, I want to see real-time progress with file-level details so I know what is being created and can identify any issues

## Specific Requirements

**Pre-Generation Summary Cards**
- Display read-only card-based summary of Steps 1-7 following the agent card pattern from Step 5
- Each card shows step name, condensed key data, and validation status indicator
- Include "Edit" button per card that navigates to that step using existing step navigation state
- Summary auto-updates when user returns to Step 8 after editing a previous step
- Card data is derived directly from IdeationState (no additional API calls)

**Validation Status Indicators**
- Green checkmark icon for steps with all required fields complete
- Yellow warning icon for steps with optional fields skipped but still valid
- Red error icon for steps with validation errors that block generation
- Use icon pattern from `logPanelHtmlGenerator.ts` for consistent SVG icons
- Display validation message below card header when warning or error present

**Generation Progress UI**
- Vertical checklist with three main items: Validate inputs, Generate steering files, Ready for Kiro
- Use spinner icon while in progress, checkmark on success, X icon on failure
- Implement collapsible accordion for "Generate steering files" nested file progress
- Accordion collapsed by default; auto-expands during generation and on failure; auto-collapses on success
- Summary text shows progress count: "Generating... (3/7 files)" or "7/7 files created"

**Collapsible File Progress Accordion**
- Nested list under "Generate steering files" showing individual file status
- Each row: file name (e.g., product.md, tech.md), status icon, optional error message
- Files listed: product.md, tech.md, structure.md, customer-context.md, integration-landscape.md, security-policies.md, demo-strategy.md
- On partial failure, show "Skipped" status for files after the failure point
- Expand/collapse toggle using chevron-right/chevron-down icons following Step 6 accordion pattern

**Generate Button Behavior**
- "Generate" button triggers the generation sequence calling Phase 3 Item 28 stub service
- Generation works in any VS Code environment (not Kiro-specific)
- Button disabled during generation with loading state
- "Generate & Open in Kiro" button shown but disabled with tooltip "Coming soon - Phase 3 Item 34"

**Stub Steering File Service**
- Create stub implementation for `SteeringFileService` following Step 6 `MockDataService` pattern
- Service emits progress events for each file: starting, complete, error
- Returns list of generated file paths on completion
- Accepts full wizard state as input for file generation context
- Implementation deferred to Phase 3 Item 28; stub returns simulated success after delay

**Post-Generation Success State**
- Display list of generated files with "Open File" links
- "Open File" uses VS Code `vscode.commands.executeCommand('vscode.open', fileUri)` for file reveal
- Show message for non-Kiro IDE users: "Open this project in Kiro to activate your steering files"
- "Start Over" button prominently displayed below file list

**Start Over Confirmation Dialog**
- Clicking "Start Over" shows VS Code native confirmation dialog via `vscode.window.showWarningMessage`
- Dialog message: "This will clear all wizard data. Generated files will not be deleted."
- Two options: "Start Over" (destructive) and "Cancel"
- On confirm: reset all IdeationState to defaults, navigate to Step 1
- Generated files are NOT deleted (user must manually remove if desired)

**Error Handling**
- On generation error, display error message in progress UI with retry option
- Partial file retention: files created before error are kept, not rolled back
- Error state shows which file failed and the error message
- "Retry" button resumes generation from failed file, not from beginning

**State Management Structure**
- Add `GenerationState` interface to `wizardPanel.ts` with: isGenerating, currentFile, completedFiles, failedFile, error
- State persisted to allow resumption after webview close/reopen during generation
- Generation progress tracked via file index and status array
- Follow `Step6LogicHandler` class pattern for `Step8LogicHandler`

## Existing Code to Leverage

**Step 5 Agent Cards (`ideationStepHtml.ts`)**
- Reuse `.agent-card` class structure and styling for summary cards
- Adapt card header pattern with title and status badge
- Use `.agent-cards-grid` container for card layout

**Log Panel Icons (`logPanelHtmlGenerator.ts`)**
- Reuse `getEventIcon()` pattern for status icons (spinner, check, X)
- Adopt `.status-success`, `.status-error`, `.status-neutral` CSS classes
- Follow SVG inline icon approach for performance

**Step 6 Logic Handler (`ideationStep6Logic.ts`)**
- Follow class structure with constructor, setState, getState, dispose
- Reuse streaming event pattern with onToken, onComplete, onError handlers
- Adapt state callbacks interface for updateWebviewContent, syncStateToWebview

**Step 5 Validation Warnings (`ideationStep5Logic.ts`)**
- Reuse `getValidationWarnings()` method pattern for aggregating warnings across steps
- Follow non-blocking warning display pattern with warning icon and message list

**Button Command Pattern (`ideationScript.ts`)**
- Follow existing `vscode.postMessage({ command: 'commandName' })` pattern
- Register handler in tabbedPanel.ts switch statement
- Use `handleStep8Command(command, data)` dispatcher function pattern

## Out of Scope

- Partial regeneration (regenerate specific files only)
- Generation history or versioning of steering files
- Undo/rollback of generated files
- Auto-save wizard state into generated files
- Actual steering file generation logic (deferred to Phase 3 Item 28)
- Kiro spec trigger functionality (deferred to Phase 3 Item 34)
- Agentify Power installation prompt (handled at project init, not Step 8)
- Custom file selection (all steering files generated as a set)
- File diff view or preview before generation
- Export wizard state as JSON
