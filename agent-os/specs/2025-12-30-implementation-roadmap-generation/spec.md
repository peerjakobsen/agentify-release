# Specification: Implementation Roadmap Generation (Phase 2)

## Goal
Generate `roadmap.md` from steering files with Kiro usage guidance, adding Phase 2 to the Step 8 UI after Phase 1 steering files are successfully generated.

## User Stories
- As a user who completed Phase 1 steering file generation, I want to generate a roadmap.md file so that I have numbered implementation items with copy-paste prompts for Kiro IDE
- As a user, I want clear error feedback when steering files are missing so that I understand why roadmap generation cannot proceed

## Specific Requirements

**Phase 2 UI Section in Step 8**
- Display Phase 2 section below Phase 1 "Generate Steering Files" section
- Section only becomes visible after Phase 1 completes successfully (all 8 steering files written)
- No collapsible sections or tabs - simple vertical layout
- Show "Generate Roadmap" button with descriptive text explaining purpose

**State Management Extension**
- Extend existing `GenerationState` interface in `src/types/wizardPanel.ts`
- Add fields: `roadmapGenerated: boolean`, `roadmapFilePath: string`, `roadmapGenerating: boolean`, `roadmapError?: string`
- Update `createDefaultGenerationState()` factory function with new field defaults
- Both Phase 1 and Phase 2 share the same Step 8 flow context

**RoadmapGenerationService Architecture**
- Create new `src/services/roadmapGenerationService.ts` following `SteeringGenerationService` singleton/EventEmitter pattern
- Use vscode.EventEmitter for events: `onGenerationStart`, `onGenerationComplete`, `onGenerationError`
- Implement `generateRoadmap()` method that loads steering files, calls Bedrock, returns content
- Use existing `getBedrockClientAsync()` and `ConverseCommand` from AWS SDK
- Single Bedrock API call (not parallel) since roadmap is one file

**Steering File Loading**
- Load 4 steering files from `.kiro/steering/`: `tech.md`, `structure.md`, `integration-landscape.md`, `agentify-integration.md`
- Read files using `vscode.workspace.fs.readFile()`
- Format file contents as XML blocks per prompt specification: `<tech_md>`, `<structure_md>`, `<integration_landscape_md>`, `<agentify_integration_md>`
- Pass formatted XML to roadmap-steering.prompt.md as user message context

**Error Handling for Missing Steering Files**
- Check all 4 required steering files exist before generation
- If any file missing, show error and prevent generation
- Display specific error message listing which files are missing
- Provide actionable guidance: "Return to Phase 1 and regenerate steering files"

**Integration with Step 8 Logic Handler**
- Extend `Step8LogicHandler` class in `src/panels/ideationStep8Logic.ts` with new methods
- Add `handleGenerateRoadmap()` method for button click handler
- Add `handleOpenRoadmap()` method to open generated file
- Subscribe to RoadmapGenerationService events and update state accordingly
- No retry mechanism needed for single-file generation - regenerate button instead

**Button States and Visibility Rules**
- "Generate Roadmap" button: visible when Phase 1 success AND not generating roadmap
- Button disabled during roadmap generation (show loading indicator)
- After generation completes, show success state and hide generate button
- "Regenerate Roadmap" option overwrites existing roadmap.md silently (no confirmation)

**Success State UI**
- Show confirmation message: "Roadmap generated successfully"
- Display usage instructions explaining how to use roadmap with Kiro
- "Open roadmap.md" button that opens file in editor via `vscode.window.showTextDocument`
- "Open Folder in Kiro" button that reveals .kiro/steering folder in explorer
- "Start Over" button remains visible (resets entire wizard)

## Existing Code to Leverage

**SteeringGenerationService Pattern (`src/services/steeringGenerationService.ts`)**
- Follow singleton pattern with `getInstance()` via module-level variable
- Use vscode.EventEmitter pattern for events (`_onFileStart`, `_onFileComplete`, `_onFileError`)
- Use `ConverseCommand` from `@aws-sdk/client-bedrock-runtime` for non-streaming API calls
- Implement prompt loading via `vscode.workspace.fs.readFile()` with caching
- Use `DEFAULT_MODEL_ID` constant for Bedrock model selection

**Step8LogicHandler Pattern (`src/panels/ideationStep8Logic.ts`)**
- Extend with new `handleGenerateRoadmap()` method following `handleGenerate()` structure
- Use `_callbacks.updateWebviewContent()` and `_callbacks.syncStateToWebview()` for UI updates
- Service initialization via `initService()` pattern with disposable subscriptions
- State updates through `this._state` property following existing mutation pattern

**GenerationState Interface (`src/types/wizardPanel.ts`)**
- Add roadmap fields alongside existing Phase 1 fields
- Keep `isGenerating` for Phase 1 and add `roadmapGenerating` for Phase 2
- Follow pattern of `generatedFilePaths` for `roadmapFilePath`
- Use `failedFile` pattern for `roadmapError` field

**SteeringFileService File Operations (`src/services/steeringFileService.ts`)**
- Use `vscode.workspace.fs.writeFile()` for writing roadmap.md
- Use `vscode.Uri.joinPath()` for building file paths
- Get workspace root via `vscode.workspace.workspaceFolders[0].uri`
- No conflict detection needed for roadmap (silent overwrite per requirements)

**Existing Prompt File (`resources/prompts/steering/roadmap-steering.prompt.md`)**
- Prompt file already exists and defines expected input format
- Load prompt using same pattern as steering prompts
- Pass steering file contents as XML-wrapped user message

## Out of Scope
- Progress streaming during generation (single file, not needed)
- Preview before writing roadmap file
- Inline editing of roadmap content in UI
- Backup of existing roadmap.md (overwrite silently)
- Confirmation dialog before regeneration
- Partial generation with missing steering files
- Multiple retry attempts with exponential backoff (simple regenerate instead)
- Phase 2 content validation beyond file existence checks
- Roadmap parsing or validation of generated content structure
- Integration with Kiro spec flow (Phase 3 item)
