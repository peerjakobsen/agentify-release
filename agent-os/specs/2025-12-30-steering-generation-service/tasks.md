# Task Breakdown: Steering Generation Service

## Overview
Total Tasks: 25 sub-tasks across 4 task groups

**Feature Summary:** Implement a service that generates 8 steering document files in parallel using Amazon Bedrock, replacing the existing stub `SteeringFileService` with real AI-powered content generation.

## Task List

### Utility Layer

#### Task Group 1: State Mapper Utility Module
**Dependencies:** None

- [x] 1.0 Complete state mapper utility module
  - [x] 1.1 Write 4-6 focused tests for state mapper functionality
    - Test `mapToProductContext` extracts businessObjective, industry, and renames outcome to outcomes
    - Test `mapToCustomerContext` extracts industry, systems, and renames aiGapFillingState to gapFilling
    - Test `mapToIntegrationContext` produces sharedTools and perAgentTools arrays
    - Test `analyzeSharedTools` correctly identifies tools used by multiple agents
    - Test mapper handles missing/empty optional state sections gracefully
    - Test each mapper returns correctly structured context object
  - [x] 1.2 Create `src/utils/steeringStateMapper.ts` module structure
    - Define TypeScript interfaces for each document's context schema
    - Export `ProductContext`, `TechContext`, `StructureContext`, `CustomerContext`
    - Export `IntegrationContext`, `SecurityContext`, `DemoContext`, `AgentifyContext`
    - Follow pattern from `mockDataService.ts` for interface definitions
  - [x] 1.3 Implement per-document mapper functions
    - `mapToProductContext(state: WizardState)` - extracts businessObjective, industry; renames `state.outcome` to `outcomes`
    - `mapToTechContext(state: WizardState)` - extracts agentDesign, security
    - `mapToStructureContext(state: WizardState)` - extracts agentDesign.confirmedAgents, mockData.mockDefinitions
    - `mapToCustomerContext(state: WizardState)` - extracts industry, systems; renames `state.aiGapFillingState` to `gapFilling`
    - `mapToIntegrationContext(state: WizardState)` - systems, agentDesign, mockData
    - `mapToSecurityContext(state: WizardState)` - extracts security (dataSensitivity, complianceFrameworks, approvalGates, guardrailNotes)
    - `mapToDemoContext(state: WizardState)` - demoStrategy (persona, ahaMoments, narrativeScenes)
    - `mapToAgentifyContext(state: WizardState)` - confirmedAgents, orchestration pattern
  - [x] 1.4 Implement `analyzeSharedTools` utility function
    - Accept `confirmedAgents: ProposedAgent[]` parameter
    - Compute `sharedTools: string[]` for tools used by 2+ agents
    - Compute `perAgentTools: { agentId: string; tools: string[] }[]` for unique tools
    - Return object with both arrays for integration-landscape context
  - [x] 1.5 Add fallback handling for optional state sections
    - Return safe defaults when state sections are missing or empty
    - Handle `undefined` gracefully in all mappers
    - Ensure all mappers produce valid JSON-serializable output
  - [x] 1.6 Ensure state mapper tests pass
    - Run ONLY the 4-6 tests written in 1.1
    - Verify all mappers produce expected output shapes
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 1.1 pass
- All 8 mapper functions correctly extract and transform state
- `analyzeSharedTools` correctly identifies shared vs unique tools
- Fallbacks return valid defaults for missing state sections
- All context interfaces match prompt input specifications

### Service Layer

#### Task Group 2: Steering Generation Service Core
**Dependencies:** Task Group 1

- [x] 2.0 Complete steering generation service core
  - [x] 2.1 Write 4-6 focused tests for service functionality
    - Test prompt loading and caching (single load, subsequent calls return cached)
    - Test `generateDocument` calls Bedrock with correct system prompt and context
    - Test parallel generation with `Promise.allSettled` for all 8 documents
    - Test progress events fire in correct sequence (onFileStart, onFileComplete/onFileError)
    - Test per-document retry logic with exponential backoff
    - Test `retryFiles` method only regenerates specified files
  - [x] 2.2 Create `src/services/steeringGenerationService.ts` skeleton
    - Define `GeneratedFile` interface (fileName, content, status, error?)
    - Define `GenerationResult` interface (success, files, errors?)
    - Extend `FileCompleteEvent` to include `content: string`
    - Create `SteeringGenerationService` class implementing `vscode.Disposable`
    - Follow singleton pattern from `MockDataService`
  - [x] 2.3 Implement prompt loading and caching
    - Use `vscode.Uri.joinPath(extensionUri, 'resources', 'prompts', 'steering', filename)`
    - Use `vscode.workspace.fs.readFile` following AgentDesignService pattern
    - Cache all 8 prompts in private `Map<string, string>` after first load
    - Map prompt filenames: `product-steering.prompt.md` -> `product.md`
  - [x] 2.4 Implement EventEmitter pattern
    - Create private `_onFileStart`, `_onFileComplete`, `_onFileError` EventEmitters
    - Expose public readonly `onFileStart`, `onFileComplete`, `onFileError` events
    - Include index metadata in `FileProgressEvent` (fileName, index, total)
  - [x] 2.5 Implement model ID retrieval
    - Check `config?.infrastructure?.steering?.modelId` for override
    - Fall back to `config?.infrastructure?.bedrock?.modelId`
    - Default to `global.anthropic.claude-sonnet-4-5-20250929-v1:0`
  - [x] 2.6 Ensure service core tests pass
    - Run ONLY the 4-6 tests written in 2.1
    - Verify prompt loading and caching works correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 2.1 pass
- Prompts are loaded once and cached for subsequent calls
- EventEmitters follow VS Code pattern from BedrockConversationService
- Model ID retrieval supports config override

#### Task Group 3: Generation Methods and Retry Logic
**Dependencies:** Task Group 2

- [x] 3.0 Complete generation methods and retry logic
  - [x] 3.1 Write 4-6 focused tests for generation methods
    - Test `generateSteeringFiles` returns all 8 files on success
    - Test partial success model (failed files have error, others succeed)
    - Test retry logic retries up to 2 times with exponential backoff
    - Test events fire for each document as it completes (non-deterministic order)
    - Test `retryFiles` only regenerates specified files
  - [x] 3.2 Implement `generateDocument` private method
    - Accept `promptName: string` and `context: object` parameters
    - Load prompt via cache mechanism from 2.3
    - Build user message with JSON-serialized context
    - Use non-streaming `ConverseCommand` (following AgentDesignService.suggestEdgesForPattern)
    - Return generated content string
  - [x] 3.3 Implement retry wrapper function
    - Accept generation function, maxRetries (2), backoffMs (1000)
    - Implement exponential backoff: 1s, 2s
    - Return result on success, throw after max retries
    - Follow pattern from BedrockConversationService._handleError
  - [x] 3.4 Implement `generateSteeringFiles` public method
    - Accept `state: WizardState` parameter
    - Map state to context for each document using Task Group 1 mappers
    - Generate all 8 documents in parallel using `Promise.allSettled`
    - Emit `onFileStart` before each generation (with index and total)
    - Emit `onFileComplete` or `onFileError` for each result
    - Return `GenerationResult` with files array and errors for failures
  - [x] 3.5 Implement `retryFiles` public method
    - Accept `state: WizardState` and `fileNames: string[]` parameters
    - Filter to only requested files
    - Apply same retry logic and progress events as main method
    - Return `GenerationResult` with only requested files
  - [x] 3.6 Implement singleton getter and reset functions
    - Export `getSteeringGenerationService(context: vscode.ExtensionContext)`
    - Export `resetSteeringGenerationService()` for testing cleanup
    - Implement `dispose()` method for EventEmitter cleanup
  - [x] 3.7 Ensure generation method tests pass
    - Run ONLY the 4-6 tests written in 3.1
    - Verify parallel generation and retry logic work correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 3.1 pass
- Parallel generation completes within expected timeframe (~5-8s vs ~40s sequential)
- Per-document retry logic correctly backs off and retries
- Partial success model returns successful files even when some fail
- `retryFiles` method works for selective retry

### Type Updates

#### Task Group 4: Type Updates and Integration
**Dependencies:** Task Group 3

- [x] 4.0 Complete type updates and integration testing
  - [x] 4.1 Write 2-4 focused integration tests
    - Test STEERING_FILES constant has 8 entries in correct order
    - Test service exports match expected interface
    - Test end-to-end generation with mock Bedrock client
    - Test service disposes resources correctly
  - [x] 4.2 Update `STEERING_FILES` constant in `src/types/wizardPanel.ts`
    - Add `'agentify-integration.md'` as 8th entry after `'demo-strategy.md'`
    - Maintain existing order for first 7 files for UI consistency
    - Verify constant is exported and accessible
  - [x] 4.3 Verify service exports and backward compatibility
    - Ensure `FileProgressEvent`, `FileCompleteEvent`, `FileErrorEvent` interfaces preserved
    - Verify singleton getter signature matches specification
    - Ensure `GeneratedFile` includes all required fields
  - [x] 4.4 Run integration tests
    - Run ONLY the 2-4 tests written in 4.1
    - Verify STEERING_FILES constant update
    - Verify service integration points work correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-4 tests written in 4.1 pass
- STEERING_FILES constant has all 8 files in correct order
- Service exports match specification
- Backward compatibility maintained for event interfaces

## Execution Order

Recommended implementation sequence:
1. **State Mapper Utility (Task Group 1)** - Foundation for context preparation
2. **Service Core (Task Group 2)** - Prompt loading, caching, EventEmitters
3. **Generation Methods (Task Group 3)** - Core generation and retry logic
4. **Type Updates (Task Group 4)** - Constants and integration

## Technical Reference

### File Mappings (Prompt -> Output)
| Prompt File | Output File | WizardState Source | Context Property (rename if different) |
|-------------|-------------|-------------------|----------------------------------------|
| product-steering.prompt.md | product.md | businessObjective, industry, outcome | businessObjective, industry, **outcomes** |
| tech-steering.prompt.md | tech.md | agentDesign, security | agentDesign, security |
| structure-steering.prompt.md | structure.md | agentDesign.confirmedAgents, mockData.mockDefinitions | confirmedAgents, mockDefinitions |
| customer-context-steering.prompt.md | customer-context.md | industry, systems, aiGapFillingState.confirmedAssumptions | industry, systems, **gapFilling**.confirmedAssumptions |
| integration-landscape-steering.prompt.md | integration-landscape.md | systems, agentDesign, mockData | systems, agents, sharedTools[], perAgentTools[] |
| security-policies-steering.prompt.md | security-policies.md | security | security |
| demo-strategy-steering.prompt.md | demo-strategy.md | demoStrategy | demoStrategy |
| agentify-integration-steering.prompt.md | agentify-integration.md | agentDesign.confirmedAgents, agentDesign.confirmedOrchestration | agentDesign |

### Existing Code References
| Pattern | File | Usage |
|---------|------|-------|
| EventEmitter | `bedrockConversationService.ts` | Progress events |
| Non-streaming Converse | `agentDesignService.ts:suggestEdgesForPattern` | Document generation |
| Prompt loading | `agentDesignService.ts:loadSystemPrompt` | URI building and caching |
| State mapping | `mockDataService.ts:buildMockDataContextMessage` | Context extraction |
| Singleton pattern | `mockDataService.ts` | Service lifecycle |
| Retry logic | `bedrockConversationService.ts:_handleError` | Exponential backoff |

### Constants
```typescript
// Default model
const DEFAULT_MODEL_ID = 'global.anthropic.claude-sonnet-4-5-20250929-v1:0';

// Retry configuration
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;
const BACKOFF_MULTIPLIER = 2;

// Prompt directory
const STEERING_PROMPTS_PATH = 'resources/prompts/steering';
```

## Notes

- **Content-only return**: Service returns `GeneratedFile[]` with content; file I/O delegated to Step8LogicHandler
- **Parallel execution**: Use `Promise.allSettled` to ensure all documents attempt generation regardless of individual failures
- **Non-deterministic events**: Progress events fire as each document completes, not in file order
- **Index metadata**: Include `index` and `total` in events for UI progress display ordering
- **Prompt caching**: Load all 8 prompts on first generation call, cache for subsequent calls
