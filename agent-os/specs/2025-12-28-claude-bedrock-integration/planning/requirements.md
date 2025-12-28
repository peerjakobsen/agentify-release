# Spec Requirements: Claude Bedrock Integration

## Initial Description

Implement Amazon Bedrock client service for Claude API calls:

**Client Setup:**
- Use `@aws-sdk/client-bedrock-runtime` with credential chain from shared AWS services
- Model: `global.anthropic.claude-opus-4-5-20251101-v1:0` (configurable in `.agentify/config.json`)
- Region from `infrastructure.dynamodb.region` (same as DynamoDB)
- Use **Converse API** (`ConverseStreamCommand`) - the unified, model-agnostic interface

**Conversation Management:**
- `BedrockConversationService` singleton with `vscode.EventEmitter` pattern
- Maintain conversation history using Converse API message format
- System prompt loaded from bundled `prompts/ideation-assistant.md`, passed via `system` parameter
- `sendMessage(userMessage: string): AsyncIterable<string>` - streaming response
- `resetConversation(): void` - clear history for new ideation session

**Streaming to Webview:**
- Use `ConverseStreamCommand` from Converse API
- Async iterate `response.stream`, extract `contentBlockDelta.delta.text` tokens
- Emit tokens via `onToken: Event<string>`
- Emit `onComplete: Event<string>` with full response on `messageStop` event
- Handle `ThrottlingException` with exponential backoff (1s, 2s, 4s, max 30s)

**Error Handling:**
- `onError: Event<BedrockError>` for UI display
- Graceful handling of model access errors (user may not have Bedrock enabled)
- Handle `AccessDeniedException` for cross-region inference SCP issues

## Requirements Discussion

### First Round Questions

**Q1:** I assume the `BedrockConversationService` should follow the same singleton pattern used by `DynamoDbPollingService` and `StdoutEventParser` (with `getBedrockConversationService()` and `resetBedrockConversationService()` factory functions). Is that correct, or should we use a different instantiation pattern?

**Answer:** Yes, follow the same singleton pattern with `getBedrockConversationService()` / `resetBedrockConversationService()` - consistent with DynamoDbPollingService, StdoutEventParser, ConfigService.

**Q2:** I'm thinking the service should use the existing `getBedrockClient()` from `bedrockClient.ts` as the underlying client, but we'll need to add methods for the Converse API commands. Should we keep the existing `BedrockRuntimeClient` setup and add Converse API support to the same service, or create the conversation service as a separate layer that wraps the existing client?

**Answer:** Separate layer that wraps the existing client.
- BedrockConversationService (NEW) handles: conversation history, system prompt management, streaming token emission, retry/backoff logic
- BedrockRuntimeClient (EXISTING in bedrockClient.ts) handles: credential chain, region configuration, low-level API calls
- Rationale: separation of concerns, future extensibility for other purposes like embeddings

**Q3:** For the system prompt in `prompts/ideation-assistant.md`, I assume this should be bundled in the `resources/` directory alongside the existing icon, and loaded at runtime using `vscode.Uri.joinPath(extensionUri, 'resources', 'prompts', 'ideation-assistant.md')`. Is that the correct location, or do you prefer a different directory structure?

**Answer:** Use `resources/prompts/ideation-assistant.md`, loaded via `vscode.workspace.fs.readFile()`. Add to package.json files array for bundling.

**Q4:** I assume the conversation history should be stored in-memory only (cleared on extension deactivation or explicit reset), similar to how the Ideation Wizard's `_wizardState` works. Should conversation history persist to workspace storage between sessions, or is in-memory sufficient for this phase?

**Answer:** In-memory only for this phase. Item 22 adds session persistence to workspace storage later.

**Q5:** For streaming tokens to the webview, I'm planning to emit tokens via `onToken: Event<string>` to subscribers (like `IdeationWizardPanel`), which will then use `postMessage` to forward tokens to the webview. Should we also provide a combined stream method like `sendMessage(userMessage: string): AsyncIterable<string>` for simpler consumption, or is the EventEmitter pattern sufficient?

**Answer:** Provide BOTH patterns:
- EventEmitter pattern: `onToken`, `onComplete`, `onError` for webview integration
- AsyncIterable pattern: `sendMessage()` returns `AsyncIterable<string>` for simpler consumption/testing
- Both coexist - the generator internally fires the events

**Q6:** Regarding error handling, I assume we should follow the existing `AgentifyError` pattern in `types/errors.ts` and create specific error codes like `BEDROCK_ACCESS_DENIED`, `BEDROCK_THROTTLED`, and `BEDROCK_MODEL_NOT_AVAILABLE`. Should these errors be recoverable (with retry UI shown to user), or should some be treated as fatal requiring reconfiguration?

**Answer:** Follow AgentifyError pattern with recovery classification:
- BEDROCK_THROTTLED: Recoverable, auto-retry with backoff
- BEDROCK_ACCESS_DENIED: Not recoverable, show "Enable Bedrock access in AWS console"
- BEDROCK_MODEL_NOT_AVAILABLE: Not recoverable, show "Model not available in region"
- BEDROCK_NETWORK_ERROR: Recoverable, show retry button
- BEDROCK_INVALID_REQUEST: Not recoverable, log for debugging

**Q7:** The spec mentions configurable model ID in `.agentify/config.json`. I assume this should be added under a new `bedrock` section like `bedrock.modelId` with the default `global.anthropic.claude-opus-4-5-20251101-v1:0`. Should we also support fallback to the Sonnet model (`global.anthropic.claude-sonnet-4-5-20250929-v1:0`) automatically on certain errors, or leave fallback handling for a future iteration?

**Answer:** Defer automatic fallback to future iteration. Read model ID from `.agentify/config.json` with default to Sonnet (not Opus) for cost efficiency.

**Q8:** Is there anything specific that should be explicitly OUT of scope for this initial implementation? For example, should we defer tool use (function calling), image input, or multi-turn conversation branching to later phases?

**Answer:**
OUT of scope:
- Tool use / function calling
- Image input
- Multi-turn branching
- Conversation export
- Token counting / cost display
- Multiple simultaneous conversations
- Prompt caching

IN scope:
- Single conversation thread
- Text-only messages
- Streaming responses
- System prompt from file
- Retry with backoff for throttling
- Error events for UI

### Existing Code to Reference

**Similar Features Identified:**
- Feature: DynamoDbPollingService - Path: `src/services/dynamoDbPollingService.ts`
  - Singleton pattern with EventEmitter
  - Exponential backoff on errors
  - State management and lifecycle methods
- Feature: StdoutEventParser - Path: `src/services/stdoutEventParser.ts`
  - Singleton pattern with EventEmitter
  - Event deduplication
  - Disposable pattern
- Feature: BedrockRuntimeClient - Path: `src/services/bedrockClient.ts`
  - Lazy singleton with credential provider
  - Region configuration
  - Client lifecycle management
- Feature: CredentialProvider - Path: `src/services/credentialProvider.ts`
  - AWS credential chain handling
  - Error transformation to AgentifyError
- Feature: ConfigService - Path: `src/services/configService.ts`
  - Config file reading
  - EventEmitter for config changes
- Feature: AgentifyError types - Path: `src/types/errors.ts`
  - Error code pattern
  - Error factory functions
- Feature: DynamoDB config - Path: `src/config/dynamoDbConfig.ts`
  - Region hierarchy (config.json > VS Code settings > defaults)

### Follow-up Questions

No follow-up questions needed - all requirements are clear.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
Not applicable.

## Requirements Summary

### Functional Requirements
- Create `BedrockConversationService` as a singleton service wrapping existing `BedrockRuntimeClient`
- Use Converse API (`ConverseStreamCommand`) for streaming responses
- Maintain in-memory conversation history with Converse API message format
- Load system prompt from `resources/prompts/ideation-assistant.md` at runtime
- Provide dual API patterns: EventEmitter (`onToken`, `onComplete`, `onError`) and AsyncIterable (`sendMessage()`)
- Implement exponential backoff for throttling (1s, 2s, 4s, max 30s)
- Support configurable model ID from `.agentify/config.json` with Sonnet as default
- Implement `resetConversation()` to clear history for new sessions

### Reusability Opportunities
- Follow singleton pattern from `DynamoDbPollingService` and `StdoutEventParser`
- Wrap existing `BedrockRuntimeClient` from `bedrockClient.ts`
- Use existing `credentialProvider.ts` for AWS credential handling
- Extend `AgentifyError` pattern from `types/errors.ts` with new error codes
- Follow region configuration hierarchy from `dynamoDbConfig.ts`

### Scope Boundaries

**In Scope:**
- Single conversation thread management
- Text-only message handling
- Streaming token responses via Converse API
- System prompt loading from bundled file
- Auto-retry with exponential backoff for throttling
- Error events emission for UI display
- EventEmitter pattern for webview integration
- AsyncIterable pattern for simpler consumption/testing

**Out of Scope:**
- Tool use / function calling
- Image input support
- Multi-turn conversation branching
- Conversation export functionality
- Token counting / cost display
- Multiple simultaneous conversations
- Prompt caching
- Automatic model fallback
- Conversation persistence (deferred to roadmap item 22)

### Technical Considerations

**Architecture:**
- BedrockConversationService (NEW): conversation history, system prompt, streaming, retry logic
- BedrockRuntimeClient (EXISTING): credential chain, region config, low-level API calls
- Separation enables future extensibility (embeddings, other Bedrock features)

**Configuration:**
- Model ID in `.agentify/config.json` under `bedrock.modelId`
- Default model: `global.anthropic.claude-sonnet-4-5-20250929-v1:0` (Sonnet for cost efficiency)
- Region from `infrastructure.dynamodb.region` (same as DynamoDB)

**Error Codes to Implement:**
- `BEDROCK_THROTTLED` - Recoverable, auto-retry with backoff
- `BEDROCK_ACCESS_DENIED` - Not recoverable, user guidance to enable Bedrock
- `BEDROCK_MODEL_NOT_AVAILABLE` - Not recoverable, region-specific message
- `BEDROCK_NETWORK_ERROR` - Recoverable, retry button in UI
- `BEDROCK_INVALID_REQUEST` - Not recoverable, log for debugging

**File Locations:**
- New service: `src/services/bedrockConversationService.ts`
- System prompt: `resources/prompts/ideation-assistant.md`
- New error codes: extend `src/types/errors.ts`
- Config types: extend `src/types/config.ts`

**Bundling:**
- Add `resources/prompts/**` to `package.json` files array for extension bundling
