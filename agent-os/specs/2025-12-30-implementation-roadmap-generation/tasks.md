# Task Breakdown: Implementation Roadmap Generation (Phase 2)

## Overview
Total Tasks: 25 tasks across 5 task groups

This feature adds Phase 2 to Wizard Step 8, enabling users to generate a `roadmap.md` file after successfully completing Phase 1 steering file generation. The roadmap provides numbered implementation items with copy-paste prompts for Kiro IDE.

## Task List

### Service Layer

#### Task Group 1: Roadmap Generation Service
**Dependencies:** None

- [x] 1.0 Complete roadmap generation service
  - [x] 1.1 Write 4-6 focused tests for RoadmapGenerationService
    - Test singleton pattern returns same instance
    - Test `loadSteeringFiles()` reads all 4 required files correctly
    - Test `loadSteeringFiles()` throws error when any file is missing
    - Test `formatSteeringFilesAsXml()` produces correct XML block format
    - Test `generateRoadmap()` calls Bedrock API with correctly formatted prompt
    - Test event emissions: `onGenerationStart`, `onGenerationComplete`, `onGenerationError`
  - [x] 1.2 Create service file structure
    - Create `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/roadmapGenerationService.ts`
    - Follow singleton pattern from `steeringGenerationService.ts`
    - Export `getInstance()` function via module-level variable
  - [x] 1.3 Implement EventEmitter pattern
    - Create private `_onGenerationStart` EventEmitter
    - Create private `_onGenerationComplete` EventEmitter with `{ filePath: string }` payload
    - Create private `_onGenerationError` EventEmitter with `{ error: string }` payload
    - Expose public `onGenerationStart`, `onGenerationComplete`, `onGenerationError` event properties
  - [x] 1.4 Implement `loadSteeringFiles()` method
    - Define required files array: `['tech.md', 'structure.md', 'integration-landscape.md', 'agentify-integration.md']`
    - Use `vscode.workspace.fs.readFile()` to read each file from `.kiro/steering/`
    - Build file paths using `vscode.Uri.joinPath()` from workspace root
    - Return array of `{ filename: string, content: string }` objects
    - Throw descriptive error listing any missing files
  - [x] 1.5 Implement `formatSteeringFilesAsXml()` method
    - Accept array of `{ filename: string, content: string }` objects
    - Map filenames to XML tags: `tech.md` -> `<tech_md>`, `structure.md` -> `<structure_md>`, etc.
    - Return concatenated XML blocks as single string
  - [x] 1.6 Implement `loadPrompt()` method with caching
    - Load prompt from `resources/prompts/steering/roadmap-steering.prompt.md`
    - Cache loaded prompt content to avoid repeated file reads
    - Follow pattern from `SteeringGenerationService.loadPrompt()`
  - [x] 1.7 Implement `generateRoadmap()` method
    - Fire `onGenerationStart` event
    - Call `loadSteeringFiles()` to get input content
    - Call `formatSteeringFilesAsXml()` to format as XML blocks
    - Load prompt via `loadPrompt()`
    - Use `getBedrockClientAsync()` to get Bedrock client
    - Execute `ConverseCommand` with `DEFAULT_MODEL_ID`, system prompt, and XML user message
    - Extract text content from response
    - Fire `onGenerationComplete` event with file path
    - Return generated markdown content
    - Catch errors and fire `onGenerationError` event
  - [x] 1.8 Ensure service layer tests pass
    - Run ONLY the 4-6 tests written in 1.1
    - Verify singleton pattern works
    - Verify file loading and XML formatting work
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 1.1 pass
- Service follows singleton pattern from SteeringGenerationService
- EventEmitter pattern correctly implemented
- Steering files loaded and formatted as XML blocks
- Bedrock API called with correct parameters
- Proper error handling with descriptive messages

### State Management Layer

#### Task Group 2: State Extension and Factory Update
**Dependencies:** None (can run parallel with Task Group 1)

- [x] 2.0 Complete state management extension
  - [x] 2.1 Write 3-4 focused tests for state management
    - Test `createDefaultGenerationState()` includes new roadmap fields with correct defaults
    - Test state transitions: `roadmapGenerating` true -> false
    - Test `roadmapError` field is cleared when starting new generation
    - Test `roadmapFilePath` is set correctly on successful generation
  - [x] 2.2 Extend GenerationState interface in `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/wizardPanel.ts`
    - Add `roadmapGenerating: boolean` - true during roadmap generation
    - Add `roadmapGenerated: boolean` - true after successful generation
    - Add `roadmapFilePath: string` - path to generated roadmap.md
    - Add `roadmapError?: string` - error message if generation failed
  - [x] 2.3 Update `createDefaultGenerationState()` factory function
    - Add `roadmapGenerating: false` default
    - Add `roadmapGenerated: false` default
    - Add `roadmapFilePath: ''` default
    - Add `roadmapError: undefined` default
  - [x] 2.4 Ensure state management tests pass
    - Run ONLY the 3-4 tests written in 2.1
    - Verify defaults are correct
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 3-4 tests written in 2.1 pass
- GenerationState interface extended with all roadmap fields
- Factory function returns correct defaults
- State types properly exported

### Logic Handler Layer

#### Task Group 3: Step 8 Logic Handler Extension
**Dependencies:** Task Groups 1 and 2

- [x] 3.0 Complete logic handler extension
  - [x] 3.1 Write 4-6 focused tests for logic handler methods
    - Test `handleGenerateRoadmap()` initializes service and starts generation
    - Test `handleGenerateRoadmap()` updates state to `roadmapGenerating: true`
    - Test successful generation updates state with `roadmapGenerated: true` and file path
    - Test generation error updates state with `roadmapError` message
    - Test `handleOpenRoadmap()` opens file in editor
    - Test `handleOpenKiroFolder()` reveals folder in explorer
  - [x] 3.2 Add RoadmapGenerationService initialization in Step8LogicHandler
    - Location: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/ideationStep8Logic.ts`
    - Import `RoadmapGenerationService` from services
    - Add private `_roadmapService` property
    - Initialize service in `initService()` method following existing pattern
  - [x] 3.3 Subscribe to RoadmapGenerationService events
    - Subscribe to `onGenerationStart` - set `roadmapGenerating: true`, clear `roadmapError`
    - Subscribe to `onGenerationComplete` - set `roadmapGenerating: false`, `roadmapGenerated: true`, set `roadmapFilePath`
    - Subscribe to `onGenerationError` - set `roadmapGenerating: false`, set `roadmapError`
    - Add subscriptions to disposables array
    - Call `_callbacks.syncStateToWebview()` after each state update
  - [x] 3.4 Implement `handleGenerateRoadmap()` method
    - Follow `handleGenerate()` method structure
    - Get workspace root via `vscode.workspace.workspaceFolders[0].uri`
    - Call `_roadmapService.generateRoadmap()`
    - Write result to `.kiro/steering/roadmap.md` using `vscode.workspace.fs.writeFile()`
    - Handle errors and update state accordingly
  - [x] 3.5 Implement `handleOpenRoadmap()` method
    - Build file URI using `vscode.Uri.joinPath()` with workspace root
    - Open file using `vscode.window.showTextDocument()`
    - Handle file not found error gracefully
  - [x] 3.6 Implement `handleOpenKiroFolder()` method
    - Build folder URI to `.kiro/steering/`
    - Use `vscode.commands.executeCommand('revealInExplorer', folderUri)`
    - Handle folder not found error gracefully
  - [x] 3.7 Register message handlers for webview commands
    - Add case for `'generateRoadmap'` -> call `handleGenerateRoadmap()`
    - Add case for `'openRoadmap'` -> call `handleOpenRoadmap()`
    - Add case for `'openKiroFolder'` -> call `handleOpenKiroFolder()`
  - [x] 3.8 Ensure logic handler tests pass
    - Run ONLY the 4-6 tests written in 3.1
    - Verify state updates correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 3.1 pass
- Service properly initialized and subscribed
- State updates flow correctly through event handlers
- File operations work correctly
- Message handlers registered for webview commands

### UI Layer

#### Task Group 4: Step 8 Phase 2 UI Components
**Dependencies:** Task Groups 2 and 3

- [x] 4.0 Complete Phase 2 UI components
  - [x] 4.1 Write 4-6 focused tests for UI components
    - Test Phase 2 section hidden when Phase 1 not complete (`completedFiles.length < 8` or `failedFile` exists)
    - Test Phase 2 section visible when Phase 1 complete (`completedFiles.length === 8 && !failedFile && !isGenerating`)
    - Test "Generate Roadmap" button rendered with correct attributes
    - Test loading state shows disabled button with spinner
    - Test success state shows confirmation message and action buttons
    - Test error state shows error message with regenerate option
  - [x] 4.2 Locate Step 8 HTML generation in ideationStepHtml.ts
    - Find existing Phase 1 "Generate Steering Files" section in `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/ideationStepHtml.ts`
    - Identify insertion point for Phase 2 section (after Phase 1 section)
    - Note existing button styling patterns and CSS classes
  - [x] 4.3 Implement Phase 2 visibility logic
    - Check Phase 1 complete: `completedFiles.length === 8 && !failedFile && !isGenerating`
    - Return empty string if Phase 1 not complete
    - Render Phase 2 section only when Phase 1 succeeded
  - [x] 4.4 Implement Phase 2 section header
    - Add section container with appropriate styling
    - Add heading: "Phase 2: Generate Implementation Roadmap"
    - Add description text explaining purpose of roadmap
  - [x] 4.5 Implement "Generate Roadmap" button
    - Style consistently with Phase 1 buttons
    - Add `data-command="generateRoadmap"` attribute
    - Disable button when `roadmapGenerating: true`
    - Show loading spinner when generating
    - Hide button when `roadmapGenerated: true` (show success state instead)
  - [x] 4.6 Implement success state UI
    - Show checkmark icon with "Roadmap generated successfully" message
    - Add usage instructions explaining how to use roadmap with Kiro
    - Add "Open roadmap.md" button with `data-command="openRoadmap"` attribute
    - Add "Open Folder in Kiro" button with `data-command="openKiroFolder"` attribute
    - Keep "Start Over" button visible (existing button, no changes needed)
    - Add "Regenerate" link/button that silently overwrites existing roadmap (no confirmation dialog)
  - [x] 4.7 Implement error state UI
    - Show error icon with error message from `roadmapError`
    - Provide actionable guidance if steering files missing
    - Add "Try Again" button to retry generation
  - [x] 4.8 Add CSS styles for Phase 2 section
    - Follow existing Step 8 styling patterns
    - Add styles for success and error state containers
    - Add styles for usage instructions section
    - Ensure visual consistency with Phase 1 section
  - [x] 4.9 Ensure UI component tests pass
    - Run ONLY the 4-6 tests written in 4.1
    - Verify visibility logic works
    - Verify button states render correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 4.1 pass
- Phase 2 section only visible after Phase 1 success
- Button states (idle, loading, success, error) render correctly
- Success state shows all required action buttons
- Error state provides clear guidance
- Styling consistent with Phase 1 section

### Testing Layer

#### Task Group 5: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-4

- [x] 5.0 Review existing tests and fill critical gaps only
  - [x] 5.1 Review tests from Task Groups 1-4
    - Review the 4-6 tests written for RoadmapGenerationService (Task 1.1)
    - Review the 3-4 tests written for state management (Task 2.1)
    - Review the 4-6 tests written for logic handler (Task 3.1)
    - Review the 4-6 tests written for UI components (Task 4.1)
    - Total existing tests: approximately 15-22 tests
  - [x] 5.2 Analyze test coverage gaps for Phase 2 feature only
    - Identify critical user workflows that lack test coverage
    - Focus ONLY on gaps related to this spec's feature requirements
    - Do NOT assess entire application test coverage
    - Prioritize end-to-end workflows over unit test gaps
  - [x] 5.3 Write up to 8 additional strategic tests maximum
    - Add maximum of 8 new tests to fill identified critical gaps
    - Focus on integration points and end-to-end workflows
    - Consider: steering file loading -> Bedrock call -> file write -> UI update
    - Consider: missing steering file detection and error messaging
    - Consider: Phase 1 to Phase 2 transition flow
    - Do NOT write comprehensive coverage for all scenarios
  - [x] 5.4 Run feature-specific tests only
    - Run ONLY tests related to Phase 2 Roadmap Generation feature
    - Expected total: approximately 23-30 tests maximum
    - Do NOT run the entire application test suite
    - Verify critical workflows pass

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 23-30 tests total)
- Critical user workflows for Phase 2 are covered
- No more than 8 additional tests added when filling in testing gaps
- Testing focused exclusively on this spec's feature requirements

## Execution Order

Recommended implementation sequence:

1. **Task Groups 1 and 2** (Parallel) - Service Layer and State Management
   - These are independent and can be built simultaneously
   - Service provides generation capability
   - State provides type definitions

2. **Task Group 3** - Logic Handler Extension
   - Depends on service (Task Group 1) for RoadmapGenerationService
   - Depends on state (Task Group 2) for GenerationState interface
   - Wires service events to state updates

3. **Task Group 4** - UI Layer
   - Depends on state (Task Group 2) for rendering conditions
   - Depends on logic handler (Task Group 3) for message handling
   - Renders Phase 2 section in Step 8

4. **Task Group 5** - Test Review and Gap Analysis
   - Depends on all implementation being complete
   - Final quality gate before feature completion

## Key Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `/src/services/roadmapGenerationService.ts` | Create | Roadmap generation service with Bedrock integration |
| `/src/types/wizardPanel.ts` | Modify | Extend GenerationState interface with roadmap fields |
| `/src/panels/ideationStep8Logic.ts` | Modify | Add roadmap generation handlers and service subscription |
| `/src/panels/ideationStepHtml.ts` | Modify | Add Phase 2 UI section below Phase 1 |

## Reusability Notes

- **Service Pattern**: Follow `SteeringGenerationService` singleton/EventEmitter architecture
- **State Pattern**: Follow existing `GenerationState` field patterns (e.g., `isGenerating`, `completedFiles`, `failedFile`)
- **File Operations**: Reuse `vscode.workspace.fs.readFile()` and `writeFile()` patterns from `steeringFileService.ts`
- **Bedrock Integration**: Reuse `getBedrockClientAsync()` and `ConverseCommand` from existing service
- **UI Patterns**: Follow existing Step 8 button styling, loading states, and message patterns
- **Prompt Loading**: Reuse prompt loading pattern with caching from `SteeringGenerationService`

## Steering Files Required

The roadmap generation requires these 4 steering files from `.kiro/steering/`:

1. `tech.md` - Technical architecture and AgentCore patterns
2. `structure.md` - Project structure and file organization
3. `integration-landscape.md` - System integrations and data flows
4. `agentify-integration.md` - Event emission and tracing contracts

## XML Format for Prompt Context

Steering files are wrapped in XML blocks for the Bedrock prompt:

```xml
<tech_md>
[contents of tech.md]
</tech_md>

<structure_md>
[contents of structure.md]
</structure_md>

<integration_landscape_md>
[contents of integration-landscape.md]
</integration_landscape_md>

<agentify_integration_md>
[contents of agentify-integration.md]
</agentify_integration_md>
```

## Button State Matrix

| Phase 1 Complete* | Roadmap Status | Generate Button | Success UI | Error UI |
|-------------------|----------------|-----------------|------------|----------|
| No | - | Hidden | Hidden | Hidden |
| Yes | Not Started (`!roadmapGenerated && !roadmapGenerating`) | Visible + Enabled | Hidden | Hidden |
| Yes | Generating (`roadmapGenerating`) | Visible + Disabled + Spinner | Hidden | Hidden |
| Yes | Complete (`roadmapGenerated`) | "Regenerate" link | Visible | Hidden |
| Yes | Error (`roadmapError`) | Visible + "Try Again" | Hidden | Visible |

*Phase 1 Complete = `completedFiles.length === 8 && !failedFile && !isGenerating`
