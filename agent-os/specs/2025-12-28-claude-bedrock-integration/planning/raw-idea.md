# Claude Bedrock Integration

14. [ ] Claude Bedrock Integration — Implement Amazon Bedrock client service for Claude API calls:

**Client Setup:**
- Use `@aws-sdk/client-bedrock-runtime` with credential chain from shared AWS services
- Model: `global.anthropic.claude-opus-4-5-20251101-v1:0` (configurable in `.agentify/config.json`)
- Region from `infrastructure.dynamodb.region` (same as DynamoDB)
- Use **Converse API** (`ConverseStreamCommand`) — the unified, model-agnostic interface

**Conversation Management:**
- `BedrockConversationService` singleton with `vscode.EventEmitter` pattern
- Maintain conversation history using Converse API message format:
```typescript
  interface Message {
    role: 'user' | 'assistant';
    content: Array<{ text: string }>;
  }
```
- System prompt loaded from bundled `prompts/ideation-assistant.md`, passed via `system` parameter
- `sendMessage(userMessage: string): AsyncIterable<string>` — streaming response
- `resetConversation(): void` — clear history for new ideation session

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
