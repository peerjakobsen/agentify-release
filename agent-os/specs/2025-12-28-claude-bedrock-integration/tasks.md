# Task Breakdown: Claude Bedrock Integration

## Overview
Total Tasks: 20

## Task List

### Foundation Layer

#### Task Group 1: Error Types and Configuration Schema
**Dependencies:** None

- [x] 1.0 Complete error types and configuration schema
  - [x] 1.1 Write 4 focused tests for new error codes and config schema in `src/test/types/errors.bedrock.test.ts`
    - Test `BEDROCK_THROTTLED` error creation and type guard
    - Test `BEDROCK_ACCESS_DENIED` error creation with guidance message
    - Test `BEDROCK_MODEL_NOT_AVAILABLE` error creation
    - Test `bedrock.modelId` config schema validation
  - [x] 1.2 Add Bedrock error codes to `AgentifyErrorCode` enum in `src/types/errors.ts`
    - Add `BEDROCK_THROTTLED = 'BEDROCK_THROTTLED'`
    - Add `BEDROCK_ACCESS_DENIED = 'BEDROCK_ACCESS_DENIED'`
    - Add `BEDROCK_MODEL_NOT_AVAILABLE = 'BEDROCK_MODEL_NOT_AVAILABLE'`
    - Add `BEDROCK_NETWORK_ERROR = 'BEDROCK_NETWORK_ERROR'`
    - Add `BEDROCK_INVALID_REQUEST = 'BEDROCK_INVALID_REQUEST'`
    - Follow existing pattern from `SSO_TOKEN_EXPIRED` and `ACCESS_DENIED`
  - [x] 1.3 Create factory functions for Bedrock errors
    - `createBedrockThrottledError(retryAfterMs?: number, cause?: Error): AgentifyError`
    - `createBedrockAccessDeniedError(cause?: Error): AgentifyError` with message "Enable Bedrock access in AWS console"
    - `createBedrockModelNotAvailableError(modelId: string, region: string, cause?: Error): AgentifyError`
    - `createBedrockNetworkError(cause?: Error): AgentifyError`
    - `createBedrockInvalidRequestError(details: string, cause?: Error): AgentifyError`
    - Follow pattern from `createSsoTokenExpiredError()` in `src/types/errors.ts`
  - [x] 1.4 Add `BedrockConfig` interface and extend `AgentifyConfig` in `src/types/config.ts`
    - Create `BedrockConfig` interface with `modelId?: string` field
    - Add optional `bedrock?: BedrockConfig` property to `AgentifyConfig` interface
    - Document default model: `global.anthropic.claude-sonnet-4-5-20250929-v1:0`
  - [x] 1.5 Update `validateConfigSchema()` to validate optional `bedrock` section
    - Add validation for `bedrock.modelId` when present (must be non-empty string)
    - Follow pattern from `aws` section validation in same file
  - [x] 1.6 Ensure foundation tests pass
    - Run ONLY the 4 tests written in 1.1
    - Verify error factories create correct error codes
    - Verify config validation accepts/rejects bedrock section correctly

**Acceptance Criteria:**
- The 4 tests written in 1.1 pass
- All 5 Bedrock error codes added to `AgentifyErrorCode` enum
- Factory functions create errors with actionable messages
- Config schema accepts optional `bedrock.modelId` field
- Validation rejects invalid `bedrock` configurations

---

### Resource Layer

#### Task Group 2: System Prompt Resource
**Dependencies:** Task Group 1

- [x] 2.0 Complete system prompt resource setup
  - [x] 2.1 Write 2 focused tests for system prompt loading in `src/test/resources/prompts.test.ts`
    - Test successful prompt file loading via `vscode.workspace.fs.readFile()`
    - Test error handling when prompt file is missing
  - [x] 2.2 Create `resources/prompts/` directory structure
    - Create directory at `resources/prompts/`
    - This will hold the ideation assistant system prompt
  - [x] 2.3 Create `resources/prompts/ideation-assistant.md` system prompt file
    - Write initial system prompt for ideation assistance
    - Include instructions for helping with brainstorming, idea development, and refinement
    - Keep prompt focused on ideation wizard use case
  - [x] 2.4 Update `package.json` files array for bundling
    - Add `"resources/prompts/**"` to the `files` array
    - Ensure prompt files are included in extension VSIX package
    - Follow pattern from existing `resources/agentify-icon.png` entry
  - [x] 2.5 Ensure resource tests pass
    - Run ONLY the 2 tests written in 2.1
    - Verify prompt file exists and is readable

**Acceptance Criteria:**
- The 2 tests written in 2.1 pass
- `resources/prompts/ideation-assistant.md` exists with meaningful content
- `package.json` includes prompt files in bundle
- Prompt can be loaded at runtime using `vscode.workspace.fs.readFile()`

---

### Service Layer

#### Task Group 3: BedrockConversationService Core
**Dependencies:** Task Groups 1, 2

- [x] 3.0 Complete BedrockConversationService core implementation
  - [x] 3.1 Write 6 focused tests for service core functionality in `src/test/services/bedrockConversationService.core.test.ts`
    - Test singleton pattern with `getBedrockConversationService(context)` / `resetBedrockConversationService()`
    - Test `dispose()` cleans up EventEmitters and clears history
    - Test conversation history management (append user message, append assistant response)
    - Test `resetConversation()` clears history
    - Test system prompt loading and caching
    - Test model ID resolution from config with fallback to default
  - [x] 3.2 Create `src/services/bedrockConversationService.ts` with class skeleton
    - Implement `BedrockConversationService` class
    - Implement `vscode.Disposable` interface
    - Follow singleton pattern from `src/services/dynamoDbPollingService.ts`
    - Add private state fields: `_conversationHistory`, `_systemPrompt`, `_isStreaming`, `_extensionUri: vscode.Uri`
    - Store `context.extensionUri` in constructor for prompt loading
  - [x] 3.3 Implement singleton factory functions
    - `getBedrockConversationService(context: vscode.ExtensionContext): BedrockConversationService`
    - `resetBedrockConversationService(): void`
    - Follow pattern from services that need extension context
    - Store `context.extensionUri` in constructor for prompt loading
  - [x] 3.4 Implement EventEmitter pattern for token streaming
    - Private `_onToken = new vscode.EventEmitter<string>()`
    - Public `readonly onToken = this._onToken.event`
    - Private `_onComplete = new vscode.EventEmitter<string>()`
    - Public `readonly onComplete = this._onComplete.event`
    - Private `_onError = new vscode.EventEmitter<AgentifyError>()`
    - Public `readonly onError = this._onError.event`
    - Follow pattern from `DynamoDbPollingService._onEvent`
  - [x] 3.5 Implement system prompt loading with caching
    - Private `_loadSystemPrompt(): Promise<string>`
    - Use `vscode.Uri.joinPath(this._extensionUri, 'resources', 'prompts', 'ideation-assistant.md')`
    - Use `vscode.workspace.fs.readFile()` for reading
    - Cache loaded prompt in `_systemPrompt` field
    - Return cached value on subsequent calls
  - [x] 3.6 Implement conversation history management
    - Private `_conversationHistory: Array<{ role: 'user' | 'assistant', content: Array<{ text: string }> }>`
    - Private `_appendUserMessage(message: string): void`
    - Private `_appendAssistantMessage(message: string): void`
    - Public `resetConversation(): void` - clears `_conversationHistory` array
  - [x] 3.7 Implement configuration resolution
    - Private `_getModelId(): Promise<string>` - reads `bedrock.modelId` from config
    - Default to `global.anthropic.claude-sonnet-4-5-20250929-v1:0` if not configured
    - Use `getConfigService().getConfig()` pattern from `src/services/configService.ts`
  - [x] 3.8 Implement `dispose()` method
    - Dispose all EventEmitters (`_onToken`, `_onComplete`, `_onError`)
    - Clear `_conversationHistory`
    - Clear `_systemPrompt` cache
    - Follow pattern from `DynamoDbPollingService.dispose()`
  - [x] 3.9 Ensure service core tests pass
    - Run ONLY the 6 tests written in 3.1
    - Verify singleton behavior
    - Verify EventEmitter cleanup on dispose

**Acceptance Criteria:**
- The 6 tests written in 3.1 pass
- Singleton pattern works correctly (same instance returned)
- EventEmitters properly initialized and disposed
- Conversation history correctly managed
- System prompt loads and caches
- Model ID resolves from config with fallback

---

#### Task Group 4: Converse API Integration
**Dependencies:** Task Group 3

- [x] 4.0 Complete Converse API integration
  - [x] 4.1 Write 5 focused tests for Converse API streaming in `src/test/services/bedrockConversationService.streaming.test.ts`
    - Test `sendMessage()` yields tokens from mock `ConverseStreamCommand` response
    - Test `onToken` event fires for each streamed token
    - Test `onComplete` event fires with full response on `messageStop`
    - Test conversation history updated after successful response
    - Test `onError` event fires on API error
  - [x] 4.2 Implement `sendMessage()` as AsyncIterable generator
    - `public async *sendMessage(userMessage: string): AsyncIterable<string>`
    - Use `this._extensionUri` cached from constructor instead of parameter
    - Append user message to history before API call
    - Load system prompt if not cached
    - Get model ID from config
    - Build `ConverseStreamCommand` with system prompt, messages, and model ID
  - [x] 4.3 Implement streaming response handling
    - Get client via `getBedrockClientAsync()` from `src/services/bedrockClient.ts`
    - Send `ConverseStreamCommand` and async iterate `response.stream`
    - Extract `contentBlockDelta.delta.text` tokens from stream events
    - Yield each token and fire `_onToken.fire(token)`
    - Accumulate tokens into full response string
  - [x] 4.4 Implement response completion handling
    - Detect `messageStop` event in stream to signal completion
    - Append full assembled response to conversation history
    - Fire `_onComplete.fire(fullResponse)` with complete message
    - Set `_isStreaming = false` on completion
  - [x] 4.5 Implement basic error handling (non-retry errors)
    - Catch `AccessDeniedException` and emit `BEDROCK_ACCESS_DENIED` error
    - Catch `ValidationException` and emit `BEDROCK_INVALID_REQUEST` error
    - Catch generic errors and emit `BEDROCK_NETWORK_ERROR`
    - Fire `_onError.fire(agentifyError)` for all error cases
    - Use factory functions from Task Group 1
  - [x] 4.6 Ensure Converse API tests pass
    - Run ONLY the 5 tests written in 4.1
    - Verify streaming works end-to-end with mocked responses

**Acceptance Criteria:**
- The 5 tests written in 4.1 pass
- `sendMessage()` correctly yields tokens
- EventEmitter events fire at appropriate times
- Conversation history updated on completion
- Errors correctly transformed to AgentifyError

---

#### Task Group 5: Exponential Backoff for Throttling
**Dependencies:** Task Group 4

- [x] 5.0 Complete exponential backoff implementation
  - [x] 5.1 Write 4 focused tests for throttling and retry logic in `src/test/services/bedrockConversationService.backoff.test.ts`
    - Test `ThrottlingException` triggers automatic retry
    - Test backoff sequence follows exponential pattern (1s, 2s, 4s, max 30s)
    - Test max retries exceeded emits error event
    - Test backoff resets on successful response
  - [x] 5.2 Add backoff state fields and constants
    - Private constant `INITIAL_BACKOFF_MS = 1000`
    - Private constant `MAX_BACKOFF_MS = 30000`
    - Private constant `BACKOFF_MULTIPLIER = 2`
    - Private constant `MAX_RETRY_ATTEMPTS = 3`
    - Private field `_retryCount = 0`
    - Calculate backoff as `Math.min(INITIAL_BACKOFF_MS * (BACKOFF_MULTIPLIER ** retryCount), MAX_BACKOFF_MS)`
  - [x] 5.3 Implement retry logic with exponential backoff
    - Create private `_executeWithRetry()` method wrapping API call
    - Detect `ThrottlingException` from AWS SDK
    - Calculate backoff: `Math.min(INITIAL_BACKOFF_MS * (BACKOFF_MULTIPLIER ** _retryCount), MAX_BACKOFF_MS)`
    - Wait for calculated backoff interval using `setTimeout` Promise wrapper
    - Increment `_retryCount` on each retry
    - Follow pattern from `DynamoDbPollingService._handlePollError()`
  - [x] 5.4 Implement max retries exceeded handling
    - After `MAX_RETRY_ATTEMPTS` exceeded, emit `BEDROCK_THROTTLED` error
    - Include retry information in error message
    - Do not retry further - let caller decide recovery strategy
  - [x] 5.5 Implement backoff reset on success
    - Reset `_retryCount = 0` after successful API response
    - Ensure clean state for next message
  - [x] 5.6 Ensure backoff tests pass
    - Run ONLY the 4 tests written in 5.1
    - Verify backoff timing follows sequence
    - Verify error emitted after max retries

**Acceptance Criteria:**
- The 4 tests written in 5.1 pass
- Throttling errors automatically retry with backoff
- Backoff sequence is 1s, 2s, 4s, 30s (capped)
- Error emitted after max retries exceeded
- Backoff state resets on successful response

---

### Integration Layer

#### Task Group 6: Service Exports and Extension Integration
**Dependencies:** Task Groups 3, 4, 5

- [x] 6.0 Complete service integration
  - [x] 6.1 Write 3 focused tests for service integration in `src/test/services/bedrockConversationService.integration.test.ts`
    - Test service accessible via exported factory functions
    - Test service cleanup in extension deactivation
    - Test re-initialization after reset works correctly
  - [x] 6.2 Add exports to service barrel file (if exists) or extension entry
    - Export `getBedrockConversationService` from service module
    - Export `resetBedrockConversationService` from service module
    - Export `BedrockConversationService` class type for typing
  - [x] 6.3 Integrate with extension lifecycle
    - In `activate()`: Call `getBedrockConversationService(context)` to initialize with context
    - In `deactivate()`: Call `resetBedrockConversationService()` (no context needed for cleanup)
    - Follow pattern from other services in `src/extension.ts`
  - [x] 6.4 Ensure integration tests pass
    - Run ONLY the 3 tests written in 6.1
    - Verify service accessible from extension context

**Acceptance Criteria:**
- The 3 tests written in 6.1 pass
- Service factory functions properly exported
- Service cleaned up on extension deactivation
- Service can be re-initialized after reset

---

### Testing

#### Task Group 7: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-6

- [x] 7.0 Review existing tests and fill critical gaps only
  - [x] 7.1 Review tests from Task Groups 1-6
    - Review the 4 tests from Task Group 1 (error types and config)
    - Review the 2 tests from Task Group 2 (system prompt)
    - Review the 6 tests from Task Group 3 (service core)
    - Review the 5 tests from Task Group 4 (Converse API)
    - Review the 4 tests from Task Group 5 (backoff)
    - Review the 3 tests from Task Group 6 (integration)
    - Total existing tests: 24 tests
  - [x] 7.2 Analyze test coverage gaps for THIS feature only
    - Identify end-to-end conversation flow gaps
    - Check error recovery scenarios coverage
    - Verify EventEmitter subscription/unsubscription tested
    - Focus ONLY on Claude Bedrock integration feature
  - [x] 7.3 Write up to 6 additional strategic tests if needed in `src/test/services/bedrockConversationService.e2e.test.ts`
    - Add tests for any critical end-to-end workflows not covered
    - Add tests for edge cases in conversation history management
    - Add tests for concurrent message handling (should queue/reject)
    - Maximum 6 new tests to fill gaps
  - [x] 7.4 Run feature-specific tests only
    - Run ONLY tests related to Claude Bedrock integration
    - Expected total: approximately 24-30 tests
    - Do NOT run entire application test suite
    - Verify all critical workflows pass

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 24-30 tests total)
- Critical conversation workflows covered
- No more than 6 additional tests added
- Testing focused exclusively on this spec's requirements

---

## Execution Order

Recommended implementation sequence:

1. **Task Group 1: Error Types and Configuration Schema** - Foundation layer establishing error handling and config types
2. **Task Group 2: System Prompt Resource** - Resource layer creating prompt file and bundling
3. **Task Group 3: BedrockConversationService Core** - Service skeleton with singleton pattern, EventEmitters, and history management
4. **Task Group 4: Converse API Integration** - Core streaming functionality with `ConverseStreamCommand`
5. **Task Group 5: Exponential Backoff for Throttling** - Retry logic and resilience
6. **Task Group 6: Service Exports and Extension Integration** - Wire service into extension lifecycle
7. **Task Group 7: Test Review and Gap Analysis** - Final validation and gap filling

---

## Key Files Referenced

| File | Purpose |
|------|---------|
| `src/types/errors.ts` | Add Bedrock error codes and factory functions |
| `src/types/config.ts` | Add `BedrockConfig` interface and validation |
| `resources/prompts/ideation-assistant.md` | System prompt for ideation assistant |
| `package.json` | Add prompt files to bundle |
| `src/services/bedrockConversationService.ts` | New service implementation |
| `src/services/bedrockClient.ts` | Existing client to wrap |
| `src/services/dynamoDbPollingService.ts` | Pattern reference for singleton and backoff |
| `src/services/configService.ts` | Pattern reference for config access |
| `src/extension.ts` | Extension lifecycle integration |

### Test Files

| File | Purpose |
|------|---------|
| `src/test/types/errors.bedrock.test.ts` | Tests for Bedrock error codes and factories |
| `src/test/resources/prompts.test.ts` | Tests for system prompt loading |
| `src/test/services/bedrockConversationService.core.test.ts` | Tests for service core functionality |
| `src/test/services/bedrockConversationService.streaming.test.ts` | Tests for Converse API streaming |
| `src/test/services/bedrockConversationService.backoff.test.ts` | Tests for throttling and retry logic |
| `src/test/services/bedrockConversationService.integration.test.ts` | Tests for service integration |
| `src/test/services/bedrockConversationService.e2e.test.ts` | End-to-end workflow tests |

---

## Technical Notes

### Converse API Message Format
```typescript
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: Array<{ text: string }>;
}
```

### Default Model Configuration
```json
{
  "bedrock": {
    "modelId": "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
  }
}
```

### Backoff Constants and Calculation
```typescript
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const BACKOFF_MULTIPLIER = 2;
const MAX_RETRY_ATTEMPTS = 3;

// Calculate: Math.min(INITIAL_BACKOFF_MS * (BACKOFF_MULTIPLIER ** retryCount), MAX_BACKOFF_MS)
// Retry 0: 1000ms (1 second)
// Retry 1: 2000ms (2 seconds)
// Retry 2: 4000ms (4 seconds)
// Retry 3+: 30000ms (30 seconds, capped)
```

### Error Recovery Classification
| Error Code | Recoverable | Action |
|------------|-------------|--------|
| `BEDROCK_THROTTLED` | Yes (auto) | Automatic retry with backoff |
| `BEDROCK_ACCESS_DENIED` | No | Show "Enable Bedrock access in AWS console" |
| `BEDROCK_MODEL_NOT_AVAILABLE` | No | Show "Model not available in region" |
| `BEDROCK_NETWORK_ERROR` | Yes (manual) | Show retry button in UI |
| `BEDROCK_INVALID_REQUEST` | No | Log for debugging |
