# Specification: Claude Bedrock Integration

## Goal
Implement a conversation service that enables Claude-powered ideation assistance via Amazon Bedrock's Converse API, providing streaming responses with both EventEmitter and AsyncIterable patterns for flexible integration with the Ideation Wizard panel.

## User Stories
- As a user, I want to have a streaming conversation with Claude through the Ideation Wizard so that I can get real-time assistance with ideation tasks.
- As a developer, I want to consume Claude responses via either EventEmitter events or AsyncIterable iteration so that I can choose the most appropriate integration pattern for my use case.

## Specific Requirements

**BedrockConversationService Singleton**
- Implement as a singleton class with `getBedrockConversationService()` and `resetBedrockConversationService()` factory functions
- Follow the pattern established in `DynamoDbPollingService` and `StdoutEventParser`
- Implement `vscode.Disposable` interface for proper resource cleanup
- Wrap the existing `BedrockRuntimeClient` from `bedrockClient.ts` rather than creating a new client
- Store conversation history in-memory only (cleared on reset or extension deactivation)

**Converse API Integration**
- Use `ConverseStreamCommand` from `@aws-sdk/client-bedrock-runtime` for streaming responses
- Structure messages using Converse API format: `{ role: 'user' | 'assistant', content: [{ text: string }] }`
- Pass system prompt via the `system` parameter of the Converse API
- Async iterate over `response.stream` to extract `contentBlockDelta.delta.text` tokens
- Detect `messageStop` event to signal response completion

**Dual API Pattern (EventEmitter + AsyncIterable)**
- `onToken: Event<string>` - emits individual tokens as they stream from Bedrock
- `onComplete: Event<string>` - emits the full assembled response when `messageStop` event received
- `onError: Event<BedrockError>` - emits error events for UI display with error code and message
- `sendMessage(userMessage: string): AsyncIterable<string>` - generator that yields tokens and internally fires events
- Both patterns coexist - the AsyncIterable generator internally fires the EventEmitter events

**System Prompt Loading**
- Load system prompt from `resources/prompts/ideation-assistant.md` using `vscode.workspace.fs.readFile()`
- Use `vscode.Uri.joinPath(extensionUri, 'resources', 'prompts', 'ideation-assistant.md')` for path construction
- Load prompt once on first use and cache it in-memory
- Add `resources/prompts/**` to `package.json` files array for extension bundling

**Exponential Backoff for Throttling**
- Handle `ThrottlingException` with automatic retry using exponential backoff
- Backoff sequence: 1s, 2s, 4s, max 30s (capped, not continuing to 8s, 16s)
- Follow the backoff pattern from `DynamoDbPollingService._handlePollError()`
- Emit error event if max retries exceeded without success
- Reset backoff timing on successful response

**Configuration via config.json**
- Read model ID from `.agentify/config.json` at path `bedrock.modelId`
- Default model: `global.anthropic.claude-sonnet-4-5-20250929-v1:0` (Sonnet for cost efficiency)
- Use region from `infrastructure.dynamodb.region` (same region as DynamoDB)
- Access config via existing `ConfigService.getConfig()` pattern

**Conversation Lifecycle**
- `resetConversation(): void` - clears conversation history for new ideation sessions
- Append user messages to history before sending
- Append assistant responses to history after completion
- History is in-memory only; session persistence deferred to roadmap item 22

## Visual Design
No visual assets provided.

## Existing Code to Leverage

**DynamoDbPollingService (`src/services/dynamoDbPollingService.ts`)**
- Singleton pattern with `getInstance()` / `resetInstance()` factory functions
- EventEmitter pattern with private `_onEvent` and public `onEvent` properties
- Exponential backoff implementation in `_handlePollError()` method
- `vscode.Disposable` implementation for cleanup

**BedrockRuntimeClient (`src/services/bedrockClient.ts`)**
- Lazy singleton with credential provider chain support
- `getBedrockClientAsync()` for async region resolution from config hierarchy
- `resetBedrockClient()` for cleanup and testing
- Already configured with adaptive retry mode

**StdoutEventParser (`src/services/stdoutEventParser.ts`)**
- EventEmitter pattern with `onEvent` and `onParseError` events
- Disposable array pattern for managing subscriptions
- `reset()` method for clearing state between sessions

**AgentifyError (`src/types/errors.ts`)**
- Error code enum pattern with `AgentifyErrorCode`
- Factory functions like `createSsoTokenExpiredError()` for consistent error creation
- `isAgentifyError()` type guard for error handling

**ConfigService (`src/services/configService.ts`)**
- Singleton pattern with `getConfigService()` / `resetConfigService()`
- Async config loading with caching
- Config schema validation pattern in `types/config.ts`

## Out of Scope
- Tool use / function calling support
- Image input support (multi-modal messages)
- Multi-turn conversation branching (maintaining alternate conversation paths)
- Conversation export functionality
- Token counting / cost display
- Multiple simultaneous conversations
- Prompt caching (Bedrock prompt caching feature)
- Automatic model fallback on errors
- Conversation persistence to workspace storage (deferred to roadmap item 22)
- UI changes to Ideation Wizard panel (handled in separate integration task)
