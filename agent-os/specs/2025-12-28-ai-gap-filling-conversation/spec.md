# Specification: AI Gap-Filling Conversation

## Goal
Implement wizard Step 2 as a conversational UI where Claude analyzes the business objective and system selections from Step 1, then proposes industry-typical assumptions that users can accept or refine through natural conversation before proceeding.

## User Stories
- As a solution architect, I want Claude to propose reasonable assumptions about my enterprise systems so that I can quickly validate or correct them instead of manually entering every detail
- As a demo builder, I want to refine Claude's assumptions through conversation so that the downstream wizard steps have accurate context

## Specific Requirements

**Auto-send Context on Step Entry**
- When user navigates to Step 2, automatically trigger Claude analysis without manual button click
- Context message includes: business objective, industry, and selected systems from Step 1
- Format context as: "User's objective: {objective}. Industry: {industry}. Known systems: {systems}."
- Show loading/streaming indicator while awaiting Claude's initial response
- Disable "Confirm & Continue" button while Claude is streaming

**Claude Response with Structured Assumptions**
- Claude responds with hybrid format: conversational prose intro/outro with structured assumption cards
- Assumption cards must be parsed from JSON embedded in Claude's response
- Each assumption card displays: system name, modules array, integrations array
- Claude response streams token-by-token in real-time using existing `onToken` event pattern
- Include "Accept Assumptions" button embedded after Claude's proposal message

**Accept Assumptions Quick Action**
- Single "Accept Assumptions" button accepts all proposed assumptions at once
- Button parses structured JSON from Claude's response to populate `confirmedAssumptions`
- Each assumption tracked with `source: 'ai-proposed'` when accepted via button
- Button disabled while Claude is still streaming

**User Refinement via Conversation**
- Text input field for user refinements (e.g., "Actually we use SAP IBP, not APO")
- User messages display right-aligned in chat interface
- Claude acknowledges corrections and updates assumptions in subsequent response
- Updated assumptions marked with `source: 'user-corrected'`
- Allow unlimited conversation rounds for refinement

**Confirm and Continue Validation**
- "Confirm & Continue" button disabled while `isStreaming: true`
- "Confirm & Continue" button disabled if `confirmedAssumptions` array is empty
- Show subtle hint after 3-4 exchanges: "Ready to finalize? Click Confirm & Continue."
- Require at least one confirmed assumption set to enable navigation

**State Clearing on Step 1 Changes**
- Track Step 1 inputs (businessObjective, industry, systems) for change detection
- If user navigates back to Step 1 and modifies any tracked field, set flag to clear conversation
- On returning to Step 2 after changes: clear conversation history, reset `confirmedAssumptions`, re-trigger Claude analysis
- Preserve conversation if user navigates away and back without Step 1 changes

**Error Handling and Recovery**
- On stream failure: preserve conversation history, lose only the incomplete Claude response
- Show inline error message: "Response interrupted. Try again?"
- Display retry button that resends the last user message or initial context
- Do not force user back to Step 1 on errors
- Use existing `AgentifyError` pattern with `BEDROCK_NETWORK_ERROR` code for connectivity issues

**Regenerate Capability**
- "Regenerate" button to get fresh proposal from Claude
- Clears current Claude response and resends context to get new assumptions
- Useful if user wants alternative suggestions

## Visual Design
No visual assets provided. UI follows VS Code webview theming conventions with chat-style layout:
- Claude messages left-aligned with avatar/icon indicator
- User messages right-aligned with different background
- Assumption cards styled as scannable structured blocks within Claude messages
- Streaming indicator (typing dots or similar) during Claude response

## Existing Code to Leverage

**BedrockConversationService (`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/bedrockConversationService.ts`)**
- Provides `sendMessage()` async generator for streaming token delivery
- Exposes `onToken`, `onComplete`, `onError` EventEmitter events for UI updates
- Maintains `_conversationHistory` in Converse API format
- Implements exponential backoff retry for throttling scenarios
- Use `resetConversation()` method when clearing state after Step 1 changes

**IdeationWizardPanel (`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/ideationWizardPanel.ts`)**
- Existing wizard step navigation framework with `navigateForward()`, `navigateBackward()` methods
- Message handling pattern via `handleMessage()` for webview-extension communication
- State synchronization via `syncStateToWebview()` with `stateSync` message type
- CSS theming using VS Code CSS variables already established
- Extend `generateStepContent()` switch case for `WizardStep.AIGapFilling`

**WizardState Types (`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/wizardPanel.ts`)**
- `WizardStep.AIGapFilling = 2` already defined in enum
- Extend `WizardState` interface with `AIGapFillingState` fields
- Add new `WIZARD_COMMANDS` constants for chat actions (send message, accept assumptions, regenerate)
- Follow existing `WizardValidationState` pattern for Step 2 validation

**Error Types (`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/errors.ts`)**
- Use `AgentifyErrorCode.BEDROCK_NETWORK_ERROR` for recoverable connection errors
- Leverage `createBedrockNetworkError()` factory for consistent error messaging
- Display errors inline in chat using existing error severity styling

**System Prompt (`/Users/peerjakobsen/projects/KiroPlugins/agentify/resources/prompts/ideation-assistant.md`)**
- Extend or create separate prompt for gap-filling conversation mode
- Prompt must instruct Claude to include structured JSON for assumptions in responses
- Define expected JSON schema in prompt for consistent parsing

## Out of Scope
- File upload within Step 2 (already handled in Step 1)
- Direct editing of individual assumption fields via form inputs (refinement via conversation only)
- Saving conversation history to disk or persistent storage (handled by wizard state persistence in Roadmap Item 22)
- Industry-specific templates or pre-filled assumptions (Phase 5 feature)
- Voice input or speech-to-text for user messages
- Multi-language support for Claude responses
- Markdown rendering within Claude messages (plain text with structured cards only)
- Inline code syntax highlighting in responses
- Export or share conversation history
- Undo/redo for conversation actions
