# Spec Requirements: Implementation Roadmap Generation (Phase 2)

## Initial Description
**Item 28.4: Implementation Roadmap Generation (Phase 2)**

Generate `roadmap.md` from steering files with Kiro usage guidance. This adds Phase 2 to the Step 8 UI - after Phase 1 steering files are generated, a "Generate Roadmap" button appears that creates a roadmap.md file containing numbered implementation items with copy-paste prompts for Kiro IDE.

Key aspects:
- Trigger: "Generate Roadmap" button appears after Phase 1 steering files are written
- Input: Loads 4 steering files (tech.md, structure.md, integration-landscape.md, agentify-integration.md)
- Output: `.kiro/steering/roadmap.md`
- Prompt file already exists: `resources/prompts/steering/roadmap-steering.prompt.md`
- Phase 2 UI section in Step 8 with generation progress, success state, usage instructions
- Error handling for missing steering files or generation failures

## Requirements Discussion

### First Round Questions

**Q1:** Phase 2 UI Placement - I assume Phase 2 appears as a separate section below the Phase 1 "Generate Steering Files" section in Step 8, becoming visible only after Phase 1 succeeds. Is that correct, or should it be displayed differently (e.g., as a collapsible section or separate tab)?
**Answer:** Separate section below Phase 1, visible only after Phase 1 succeeds. Natural workflow progression. Keep it simple - no tabs or collapsible sections.

**Q2:** State Management - I assume Phase 2 will extend the existing `GenerationState` interface with additional fields for roadmap generation (e.g., `roadmapGenerated`, `roadmapFilePath`, `roadmapGenerating`, `roadmapError`). Is that correct, or should it use a completely separate state object?
**Answer:** Extend the existing GenerationState interface with additional fields (roadmapGenerated, roadmapFilePath, roadmapGenerating, roadmapError). Both phases part of same Step 8 flow.

**Q3:** Service Architecture - I'm thinking of creating a new `RoadmapGenerationService` that follows the same singleton/EventEmitter pattern as `SteeringGenerationService`, keeping them as separate services since their concerns are different (8 files vs 1 file, different input sources). Should we instead extend the existing `SteeringGenerationService` to handle roadmap generation as well?
**Answer:** Create a new RoadmapGenerationService following the same singleton/EventEmitter pattern. Better separation of concerns.

**Q4:** Button Visibility Timing - I assume the "Generate Roadmap" button appears immediately when Phase 1 completes successfully (all 8 steering files written). Is there any delay or user confirmation needed before Phase 2 becomes available?
**Answer:** Appear immediately when Phase 1 completes. No delay needed.

**Q5:** Roadmap Regeneration - If the user clicks "Generate Roadmap" a second time (after already generating once), should we overwrite the existing roadmap.md silently, prompt for confirmation like steering files do, or disable the button after first generation?
**Answer:** Overwrite silently. This is a development tool - users expect to iterate. Keep it fast.

**Q6:** File Loading Error Handling - The roadmap generation needs to load 4 steering files (tech.md, structure.md, integration-landscape.md, agentify-integration.md). If one or more files are missing or corrupted, should we show an error and prevent generation, or attempt partial generation with whatever files are available?
**Answer:** Show error and prevent generation. Roadmap needs all steering files for coherent plan. Partial generation would be misleading.

**Q7:** Is there anything you explicitly do NOT want included in this implementation?
**Answer:**
- No progress streaming (overkill for single-file generation)
- No preview before writing (just write it)
- No inline editing (user can edit file directly in IDE)
- Keep it simple: button click -> generate -> write file -> show success with link

### Existing Code to Reference

**Similar Features Identified:**
- Service: `src/services/steeringGenerationService.ts` - Singleton/EventEmitter pattern for document generation
- Service: `src/services/steeringFileService.ts` - File writing with progress events
- Logic Handler: `src/panels/ideationStep8Logic.ts` - Step 8 generation orchestration
- Types: `src/types/wizardPanel.ts` - GenerationState interface to extend
- Prompt: `resources/prompts/steering/roadmap-steering.prompt.md` - Already exists, defines roadmap format

### Follow-up Questions

No follow-up questions needed. User provided comprehensive answers.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
ASCII mockups are provided in the roadmap.md Item 28.4 specification showing:
- Phase 2 section with "Generate Roadmap" button
- Loading state with status indicator
- Success state with usage instructions and action buttons

## Requirements Summary

### Functional Requirements
- Phase 2 UI section appears in Step 8 immediately after Phase 1 steering files are successfully generated
- "Generate Roadmap" button triggers roadmap generation
- Load 4 steering files as input context:
  - `.kiro/steering/tech.md`
  - `.kiro/steering/structure.md`
  - `.kiro/steering/integration-landscape.md`
  - `.kiro/steering/agentify-integration.md`
- Pass file contents as XML blocks to roadmap-steering.prompt.md
- Generate roadmap via Bedrock API call
- Write output to `.kiro/steering/roadmap.md`
- Show loading state during generation
- Show success state with:
  - Confirmation message
  - Usage instructions (how to use with Kiro)
  - "Open roadmap.md" button
  - "Open Folder in Kiro" button
  - "Start Over" button
- Show error state if generation fails with retry option
- Show error if any required steering files are missing

### Reusability Opportunities
- Follow `SteeringGenerationService` singleton/EventEmitter pattern for new `RoadmapGenerationService`
- Follow `SteeringFileService` pattern for file writing
- Extend existing `GenerationState` interface in `wizardPanel.ts`
- Extend `Step8LogicHandler` with roadmap generation methods
- Reuse existing Step 8 UI patterns for button styling and status display

### Scope Boundaries
**In Scope:**
- New `RoadmapGenerationService` for roadmap generation
- Extend `GenerationState` with roadmap-specific fields
- Phase 2 UI section in Step 8
- Loading/success/error states for Phase 2
- File loading from `.kiro/steering/` directory
- Single Bedrock API call for roadmap generation
- File writing to `.kiro/steering/roadmap.md`
- "Open roadmap.md" and "Open Folder" actions
- Error handling for missing steering files

**Out of Scope:**
- Progress streaming during generation (single file, not needed)
- Preview before writing
- Inline editing of roadmap in UI
- Backup of existing roadmap.md (overwrite silently)
- Confirmation dialog before regeneration
- Partial generation with missing files

### Technical Considerations
- New service: `src/services/roadmapGenerationService.ts`
- Existing prompt: `resources/prompts/steering/roadmap-steering.prompt.md`
- State extension in: `src/types/wizardPanel.ts` (GenerationState interface)
- Logic handler extension in: `src/panels/ideationStep8Logic.ts`
- UI rendering in: `src/panels/ideationStepHtml.ts` (Step 8 HTML)
- File reading via `vscode.workspace.fs.readFile`
- File writing via `vscode.workspace.fs.writeFile`
- Bedrock API via existing `BedrockConversationService` or similar pattern
- All steering files must exist before roadmap generation can proceed
- Roadmap generation is simpler than Phase 1 (single file, no parallel generation needed)
