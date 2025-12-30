# Specification: Steering Generation Service

## Goal

Implement a service that generates 8 steering document files in parallel using Amazon Bedrock, replacing the existing stub `SteeringFileService` with real AI-powered content generation that emits progress events for UI feedback.

## User Stories

- As a user completing the Ideation Wizard, I want steering files generated quickly so that I can proceed to Kiro spec-driven development without waiting 40+ seconds for sequential generation
- As a user, I want to see real-time progress feedback showing which files are being generated so that I understand the system is working

## Specific Requirements

**Parallel Document Generation**
- Generate all 8 steering documents simultaneously using `Promise.allSettled` for parallel execution
- Use non-streaming `ConverseCommand` from Bedrock SDK since complete documents are needed before returning
- Target Sonnet model: `global.anthropic.claude-sonnet-4-5-20250929-v1:0` by default
- Support optional config override via `steeringModelId` in `.agentify/config.json`
- Reduce total generation time from ~40s (sequential) to ~5-8s (parallel)

**Prompt Loading and Caching**
- Load prompt files from `resources/prompts/steering/` directory using `vscode.Uri.joinPath` pattern from `AgentDesignService`
- Cache all 8 prompts after first load to avoid repeated filesystem reads
- Map prompt filenames to output filenames: `product-steering.prompt.md` generates `product.md`
- Prompts are markdown files with system instructions and JSON schema expectations

**State Mapping via Utility Module**
- Create separate utility module `src/utils/steeringStateMapper.ts` for state transformation
- Define TypeScript interfaces for each document's context schema matching prompt input specifications
- Export per-document mapper functions: `mapToProductContext`, `mapToTechContext`, `mapToStructureContext`, `mapToCustomerContext`, `mapToIntegrationContext`, `mapToSecurityContext`, `mapToDemoContext`, `mapToAgentifyContext`
- Include `analyzeSharedTools()` utility for integration-landscape context that computes shared/per-agent tool arrays
- Handle fallback scenarios when optional state sections are missing or empty

**Progress Events with Index Metadata**
- Emit `onFileStart` event when document generation begins with `FileProgressEvent` containing fileName, index, and total
- Emit `onFileComplete` event when document generation succeeds with `FileCompleteEvent` containing fileName and content
- Emit `onFileError` event when document generation fails with `FileErrorEvent` containing fileName and error message
- Events fire in non-deterministic order as each parallel generation completes
- Include index metadata in events so UI can order the progress display correctly

**Per-Document Retry Logic**
- Implement per-document retries within single `generateSteeringFiles` call using retry wrapper function
- Configuration: `maxRetries: 2`, `backoffMs: 1000` with exponential backoff (1s, 2s)
- Continue generating remaining documents if one fails after all retries (partial success model)
- Return partial results with error details for failed documents in `GenerationResult`

**Selective Retry Method**
- Implement `retryFiles(state: WizardState, fileNames: string[]): Promise<GenerationResult>` for manual retry of specific failed files
- Accept array of file names to regenerate (e.g., `['product.md', 'tech.md']`)
- Apply same retry logic and progress events as main generation method
- Return results only for requested files

**Content-Only Return Pattern**
- Return `GeneratedFile[]` containing fileName, content, status, and optional error
- Delegate file I/O to Step8LogicHandler caller following existing `steeringFile.ts` template approach
- Include error string per file to enable UI display of failure reasons

**Singleton Service Pattern**
- Follow singleton pattern from `MockDataService` and `AgentDesignService`
- Export `getSteeringGenerationService(context: vscode.ExtensionContext)` getter requiring context for extensionUri
- Export `resetSteeringGenerationService()` for testing cleanup and resource disposal
- Implement `vscode.Disposable` interface for proper EventEmitter cleanup

**Update STEERING_FILES Constant**
- Update `STEERING_FILES` array in `src/types/wizardPanel.ts` to include all 8 files
- Add `agentify-integration.md` as the 8th entry after `demo-strategy.md`
- Maintain existing order for first 7 files for UI consistency

## Existing Code to Leverage

**BedrockConversationService patterns**
- EventEmitter pattern using `vscode.EventEmitter<T>` for progress events with `readonly` public event properties
- Bedrock client access via `getBedrockClientAsync()` from `bedrockClient.ts`
- Error categorization using factory functions from `types/errors.ts`
- Exponential backoff retry pattern with `INITIAL_BACKOFF_MS` and `BACKOFF_MULTIPLIER` constants
- Model ID retrieval from config service: `config?.infrastructure?.bedrock?.modelId`

**AgentDesignService non-streaming pattern**
- Uses `ConverseCommand` (not streaming) for `suggestEdgesForPattern` - apply same pattern for steering documents
- System prompt loading via `vscode.Uri.joinPath(extensionUri, ...path.split('/'))` and `vscode.workspace.fs.readFile`
- Prompt caching with null check: `if (this._systemPrompt !== null) return this._systemPrompt`

**MockDataService state mapping pattern**
- `buildMockDataContextMessage()` demonstrates extracting state sections and formatting into JSON for prompt context
- Type guard patterns like `isValidMockToolDefinition()` for input validation

**Existing steeringFileService.ts stub**
- Preserve `FileProgressEvent`, `FileCompleteEvent`, `FileErrorEvent` interfaces for backward compatibility
- Extend `FileCompleteEvent` to include content string in addition to fileName
- Reuse singleton pattern structure with instance variable, getter, and reset functions

**Steering prompt files**
- 8 prompts in `resources/prompts/steering/` define exact JSON input schemas per document type
- Each prompt specifies YAML frontmatter (`inclusion: always` or `manual`) and markdown output format
- Prompts include fallback instructions for generating content when state sections are missing

## Out of Scope

- Wizard state validation (already handled in Step8LogicHandler before calling service)
- `canGenerate` check (UI concern, Step8LogicHandler responsibility)
- Kiro command triggering (post-generation, separate concern in Step8LogicHandler)
- Backup of existing steering files (future enhancement, not in initial implementation)
- Progress accordion UI state management (handled by Step 8 UI component)
- File path construction and file writing (delegated to Step8LogicHandler caller)
- `isPlaceholderMode` flag (removed, no longer needed after real implementation)
- `startIndex` parameter for sequential retry (replaced by `retryFiles` method for selective retry)
- Streaming responses (documents need complete content, use non-streaming Converse API)
- Token-level progress events (only file-level progress events needed)
