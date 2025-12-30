# Spec Requirements: Steering Generation Service

## Initial Description

**Feature: Steering Generation Service**

Implement service that generates steering files using prompts from Item 28.1:

**Service Interface:**
```typescript
// src/services/steeringGenerationService.ts
interface GenerationResult {
  success: boolean;
  files: GeneratedFile[];
  errors?: { file: string; error: string }[];
}

interface GeneratedFile {
  fileName: string;
  filePath: string;
  content: string;
  status: 'created' | 'failed';
}

class SteeringGenerationService {
  async generateSteeringFiles(state: IdeationState): Promise<GenerationResult>;
  async generateDocument(promptName: string, context: object): Promise<string>;
}
```

**Generation Flow:**
1. Load all prompt files from `resources/prompts/steering/`
2. Extract relevant state sections for each document (per mapping in 28.1)
3. Generate all 8 documents in parallel using Bedrock
4. Return results with content and status per file

**Why Parallel Generation:**
- 8 independent documents with no cross-dependencies
- Reduces total generation time from ~40s (sequential) to ~5-8s (parallel)
- Individual failures don't block other documents

**Error Handling:**
- Catch per-document generation errors
- Continue generating remaining documents on failure
- Return partial results with error details for failed documents
- Step 8 UI handles display of partial success

**Relationship to Step 8:**
This service replaces the stub service from Item 24. Step 8 calls this service and handles UI/progress display. Service is responsible only for content generation, not file I/O.

## Requirements Discussion

### First Round Questions

**Q1:** I notice the `STEERING_FILES` constant in `wizardPanel.ts` lists 7 files (product.md, tech.md, structure.md, customer-context.md, integration-landscape.md, security-policies.md, demo-strategy.md), but the prompts folder has 8 files including `agentify-integration-steering.prompt.md`. I'm assuming we should generate all 8 documents including `agentify-integration.md`. Is that correct, or should we stick with the current 7-file list?
**Answer:** Generate all 8 files including agentify-integration.md. Update `STEERING_FILES` constant in `wizardPanel.ts` to include all 8 files.

**Q2:** The existing `BedrockConversationService` uses streaming via `ConverseStreamCommand` with the Sonnet model by default. For document generation, I'm assuming we should use a non-streaming approach (single `ConverseCommand`) since we need complete documents before writing. Should we use Opus 4.5 for higher quality steering documents, or stick with Sonnet for cost efficiency?
**Answer:** Use Sonnet for cost efficiency. Well-defined templates don't need Opus. Optional enhancement: add a config option `steeringModelId` for override if needed.

**Q3:** For state mapping, each prompt file expects a specific JSON schema (e.g., product.md needs `businessObjective`, `industry`, `outcomes`). I'm thinking we should create a dedicated state mapper module that extracts and transforms `WizardState` (the complete `IdeationState`) into the per-document context objects. Should this mapper be part of the service or a separate utility module?
**Answer:** Create a separate utility module at `src/utils/steeringStateMapper.ts`. Implement per-document mappers for testability. Define clear TypeScript interfaces for the context objects.

**Q4:** The existing `SteeringFileService` stub emits progress events via `onFileStart`, `onFileComplete`, and `onFileError`. Since we're generating 8 documents in parallel, should we emit progress events as each document completes (non-deterministic order), or should we batch all completions and emit in a deterministic order (product.md first, then tech.md, etc.)?
**Answer:** Emit progress events as each document completes (non-deterministic order). Include index metadata in events for UI ordering purposes. This provides immediate progress feedback to the user.

**Q5:** For error handling, I'm assuming we should implement retry logic at the individual document level (not abort all 8 if one fails). The current stub supports `startIndex` for resuming from a failed file. Should we preserve this retry-from-index pattern, or implement per-document retries within a single generation call?
**Answer:** Implement per-document retries within a single generation call. Use `Promise.allSettled` for parallel execution. Retry configuration: `maxRetries: 2`, `backoffMs: 1000`. Keep the `startIndex` pattern only for manual retry of failed files via a separate method.

**Q6:** Should the service write files directly to disk (`.kiro/steering/`), or should it only return content and delegate file I/O to a separate `SteeringFileWriter` (as Item 28.3 suggests)? This affects whether we implement one service or two.
**Answer:** Return content only, delegate file I/O to the caller. The service returns `GeneratedFile[]` with content. `Step8LogicHandler` handles file writing. This is consistent with the existing `steeringFile.ts` template approach.

**Q7:** Is there anything this service should explicitly NOT do that I should keep out of scope (e.g., validation of wizard state completeness, Kiro command triggering, handling backup of existing files)?
**Answer:** See detailed scope boundaries below.

### Existing Code to Reference

**Similar Features Identified:**
- Service: `BedrockConversationService` - Path: `src/services/bedrockConversationService.ts` - Bedrock API integration patterns, EventEmitter usage, error handling
- Service: `MockDataService` - Path: `src/services/mockDataService.ts` - Singleton pattern, service structure
- Service: `AgentDesignService` - Path: `src/services/agentDesignService.ts` - AI generation patterns
- Client: `bedrockClient.ts` - Path: `src/services/bedrockClient.ts` - Bedrock client initialization
- Stub: `steeringFileService.ts` - Path: `src/services/steeringFileService.ts` - Current stub to replace
- Prompts: Steering prompts - Path: `resources/prompts/steering/` - 8 prompt files defining document structure

### Follow-up Questions

No follow-up questions needed - answers were comprehensive.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A - No visual assets to analyze.

## Requirements Summary

### Functional Requirements

**Core Generation:**
- Load prompt files from `resources/prompts/steering/`
- Map `WizardState` to per-document context objects using separate mapper utility
- Generate all 8 steering documents in parallel using Bedrock Converse API
- Use Sonnet model by default (with optional config override via `steeringModelId`)
- Implement per-document retry logic (maxRetries: 2, backoffMs: 1000)
- Return content with status per file (not file paths)

**Progress Events:**
- Emit `onFileStart` when document generation begins
- Emit `onFileComplete` when document generation succeeds (non-deterministic order)
- Emit `onFileError` when document generation fails
- Include index metadata in events for UI ordering

**Error Handling:**
- Use `Promise.allSettled` for parallel execution
- Per-document retries within single generation call
- Continue generating remaining documents on individual failures
- Return partial results with error details

**Files to Generate (8 total):**
1. `product.md`
2. `tech.md`
3. `structure.md`
4. `customer-context.md`
5. `integration-landscape.md`
6. `security-policies.md`
7. `demo-strategy.md`
8. `agentify-integration.md`

### Service Interface

```typescript
export interface GeneratedFile {
  fileName: string;
  content: string;
  status: 'created' | 'failed';
  error?: string;
}

export interface GenerationResult {
  success: boolean;
  files: GeneratedFile[];
  errors?: { file: string; error: string }[];
}

export class SteeringGenerationService implements vscode.Disposable {
  readonly onFileStart: vscode.Event<FileProgressEvent>;
  readonly onFileComplete: vscode.Event<FileCompleteEvent>;
  readonly onFileError: vscode.Event<FileErrorEvent>;

  async generateSteeringFiles(state: WizardState): Promise<GenerationResult>;
  async retryFiles(state: WizardState, fileNames: string[]): Promise<GenerationResult>;
}
```

### Reusability Opportunities

**Patterns to Follow:**
- `BedrockConversationService` - EventEmitter pattern, Bedrock API usage, error categorization
- `MockDataService` - Singleton pattern, service lifecycle
- `AgentDesignService` - AI generation flow
- `steeringFileService.ts` (stub) - Event types to preserve compatibility

**New Modules to Create:**
- `src/services/steeringGenerationService.ts` - Main service (replaces stub)
- `src/utils/steeringStateMapper.ts` - State transformation utilities

**Existing Code to Update:**
- `src/types/wizardPanel.ts` - Update `STEERING_FILES` constant to include 8 files

### Scope Boundaries

**In Scope:**
- Load prompts from `resources/prompts/steering/`
- Map `WizardState` to per-document contexts via utility module
- Call Bedrock Converse API (non-streaming, parallel)
- Per-document retries (maxRetries: 2, backoffMs: 1000)
- Emit progress events (onFileStart, onFileComplete, onFileError)
- Return content with status (GenerationResult interface)
- `retryFiles` method for manual retry of specific failed files
- Singleton pattern with `getSteeringGenerationService()`

**Out of Scope:**
- Wizard state validation (already handled in Step8LogicHandler)
- `canGenerate` check (UI concern, not service responsibility)
- Kiro command triggering (post-generation, separate concern)
- Backup of existing files (future enhancement, Item 28.3)
- Progress accordion state (UI concern)
- File path construction (caller's decision)
- `isPlaceholderMode` flag (removed, no longer needed)
- File I/O / writing to disk (delegated to Step8LogicHandler)

### Technical Considerations

**Bedrock Configuration:**
- Use Sonnet model: `global.anthropic.claude-sonnet-4-5-20250929-v1:0`
- Optional config override: `steeringModelId` in `.agentify/config.json`
- Use `ConverseCommand` (non-streaming) for complete document responses
- Region from existing config hierarchy

**Parallel Execution:**
- Use `Promise.allSettled` for all 8 documents
- Non-deterministic completion order
- Events include index metadata for UI ordering

**Retry Logic:**
- Per-document retries: maxRetries: 2
- Exponential backoff: starting at 1000ms
- Separate `retryFiles(state, fileNames)` method for manual retry

**State Mapping:**
- Create `src/utils/steeringStateMapper.ts`
- Export per-document mapper functions
- Define TypeScript interfaces for each document's context schema
- Mappings per Item 28.1:
  | Document | Wizard State Sections |
  |----------|----------------------|
  | product.md | businessObjective, industry, outcome |
  | tech.md | agentDesign, securityGuardrails |
  | structure.md | agentDesign.confirmedAgents, mockData.mockDefinitions |
  | customer-context.md | industry, systems, aiGapFillingState.confirmedAssumptions |
  | integration-landscape.md | systems, agentDesign, mockData |
  | security-policies.md | securityGuardrails |
  | demo-strategy.md | demoStrategy |
  | agentify-integration.md | agentDesign.confirmedAgents, orchestration pattern |

**Integration Points:**
- Replace stub in `src/services/steeringFileService.ts`
- Step8LogicHandler calls `generateSteeringFiles(state)`
- Step8LogicHandler handles file writing after receiving content
- Events consumed by Step 8 UI for progress display
