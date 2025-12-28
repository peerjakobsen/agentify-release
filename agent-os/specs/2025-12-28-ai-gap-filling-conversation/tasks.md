# Task Breakdown: AI Gap-Filling Conversation

## Overview
Total Tasks: 34
Feature: Wizard Step 2 conversational UI where Claude analyzes Step 1 inputs, proposes industry-typical assumptions, and users can accept or refine through natural conversation.

## Task List

### Types & Data Models

#### Task Group 1: Type Definitions and Interfaces
**Dependencies:** None

- [x] 1.0 Complete type definitions for AI gap-filling conversation
  - [x] 1.1 Write 4 focused tests for type validation
    - Test `SystemAssumption` interface structure validation
    - Test `AIGapFillingState` required fields
    - Test `source` field enum values ('ai-proposed' | 'user-corrected')
    - Test `ConversationMessage` structure for chat history
  - [x] 1.2 Define `SystemAssumption` interface in `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/wizardPanel.ts`
    - Fields: `system: string`, `modules: string[]`, `integrations: string[]`, `source: 'ai-proposed' | 'user-corrected'`
    - Follow existing type patterns in file
  - [x] 1.3 Define `AIGapFillingState` interface
    - Fields: `conversationHistory: ConversationMessage[]`, `confirmedAssumptions: SystemAssumption[]`, `assumptionsAccepted: boolean`, `isStreaming: boolean`
    - Add `step1InputHash?: string` for change detection
    - Add `streamingError?: string` for error state and retry UI
  - [x] 1.4 Define `ConversationMessage` interface for chat display
    - Fields: `role: 'user' | 'assistant'`, `content: string`, `timestamp: number`, `parsedAssumptions?: SystemAssumption[]`
  - [x] 1.5 Add new `WIZARD_COMMANDS` constants for Step 2 actions
    - `SEND_CHAT_MESSAGE`, `ACCEPT_ASSUMPTIONS`, `REGENERATE_ASSUMPTIONS`, `RETRY_LAST_MESSAGE`
    - Follow existing command naming pattern
  - [x] 1.6 Extend `WizardState` interface to include `aiGapFillingState: AIGapFillingState`
  - [x] 1.7 Ensure type definition tests pass
    - Run ONLY the 4 tests written in 1.1
    - Verify TypeScript compilation succeeds

**Acceptance Criteria:**
- The 4 tests written in 1.1 pass
- All new types compile without errors
- Types integrate with existing `WizardState` structure
- Command constants follow existing naming conventions

---

### Service & Prompt Layer

#### Task Group 2: System Prompt and Claude Integration
**Dependencies:** Task Group 1

- [x] 2.0 Complete service layer for gap-filling conversation
  - [x] 2.1 Write 5 focused tests for Claude integration
    - Test context message formatting from Step 1 inputs
    - Test JSON assumption parsing from Claude response
    - Test conversation history reset on Step 1 changes
    - Test streaming state management during response
    - Test error recovery preserving conversation history
  - [x] 2.2 Create gap-filling system prompt at `/Users/peerjakobsen/projects/KiroPlugins/agentify/resources/prompts/gap-filling-assistant.md`
    - Instruct Claude to respond with conversational prose intro/outro
    - Define JSON schema for structured assumptions within response
    - Include instruction to wrap assumptions in parseable JSON block: ````json\n{"assumptions": [...]}\n```
    - Provide example format for system/modules/integrations structure
  - [x] 2.3 Create `GapFillingService` class in `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/gapFillingService.ts`
    - Method: `buildContextMessage(businessObjective: string, industry: string, systems: string[]): string`
    - Method: `parseAssumptionsFromResponse(response: string): SystemAssumption[]`
    - Method: `generateStep1Hash(businessObjective: string, industry: string, systems: string[]): string`
    - Reuse `BedrockConversationService` for actual Claude communication
  - [x] 2.4 Implement JSON extraction from hybrid Claude responses
    - Extract JSON block between markdown code fences
    - Handle missing or malformed JSON gracefully (return empty array)
    - Parse `assumptions` array into `SystemAssumption[]` objects
    - Set `source: 'ai-proposed'` for initial assumptions
    - For refinement responses: compare with previous assumptions, set `source: 'user-corrected'` for modified items
  - [x] 2.5 Implement Step 1 change detection logic
    - Hash businessObjective + industry + systems for comparison
    - Return boolean indicating whether reset is needed
  - [x] 2.6 Ensure service layer tests pass
    - Run ONLY the 5 tests written in 2.1
    - Verify prompt loads correctly
    - Verify JSON parsing handles edge cases

**Acceptance Criteria:**
- The 5 tests written in 2.1 pass
- System prompt produces consistent parseable Claude responses
- JSON extraction handles both valid and malformed responses
- Change detection correctly identifies Step 1 modifications

---

### Panel Logic (Extension Side)

#### Task Group 3: IdeationWizardPanel Step 2 Integration
**Dependencies:** Task Group 2

- [x] 3.0 Complete panel logic for AI gap-filling step
  - [x] 3.1 Write 6 focused tests for panel message handling
    - Test auto-send context triggers on Step 2 entry
    - Test `SEND_CHAT_MESSAGE` command handling
    - Test `ACCEPT_ASSUMPTIONS` populates confirmedAssumptions
    - Test `REGENERATE_ASSUMPTIONS` clears and restarts
    - Test navigation blocked while streaming
    - Test conversation preserved on Step 1 return without changes
  - [x] 3.2 Extend `handleMessage()` in `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/ideationWizardPanel.ts`
    - Add case for `SEND_CHAT_MESSAGE`: append user message, call BedrockConversationService
    - Add case for `ACCEPT_ASSUMPTIONS`: parse and confirm all assumptions from last Claude response
    - Add case for `REGENERATE_ASSUMPTIONS`: clear conversation, resend context
    - Add case for `RETRY_LAST_MESSAGE`: resend last user message or initial context
  - [x] 3.3 Implement auto-send on Step 2 navigation
    - In `navigateForward()` or dedicated method, detect entry to `WizardStep.AIGapFilling`
    - Build context message using `GapFillingService.buildContextMessage()`
    - Set `isStreaming: true` before sending
    - Call `BedrockConversationService.sendMessage()` with gap-filling prompt
  - [x] 3.4 Implement streaming token handling for webview updates
    - Subscribe to `BedrockConversationService.onToken` event
    - Send incremental updates to webview via `postMessage`
    - On `onComplete`: set `isStreaming: false`, parse assumptions, sync state
    - On `onError`: preserve history, show error in conversation
  - [x] 3.5 Implement `ACCEPT_ASSUMPTIONS` handler
    - Parse `parsedAssumptions` from last assistant message
    - Copy to `confirmedAssumptions` array
    - Set `assumptionsAccepted: true`
    - Sync state to webview
  - [x] 3.6 Implement Step 1 change detection on backward navigation
    - Before navigating to Step 1, store current hash of inputs
    - On return to Step 2, compare hash with stored value
    - If changed: reset `aiGapFillingState`, re-trigger Claude analysis
    - If unchanged: preserve existing conversation
  - [x] 3.7 Implement navigation validation for Step 2
    - Override or extend `canNavigateForward()` for Step 2
    - Return false if `isStreaming: true`
    - Return false if `confirmedAssumptions.length === 0`
    - Show hint message after exchange count >= 3
    - Sync `canNavigateForward` state to webview to disable "Confirm & Continue" button visually
  - [x] 3.8 Ensure panel logic tests pass
    - Run ONLY the 6 tests written in 3.1
    - Verify state synchronization works correctly
    - Verify navigation guards function properly

**Acceptance Criteria:**
- The 6 tests written in 3.1 pass
- Auto-send triggers on Step 2 entry
- All chat commands handled correctly
- Navigation properly blocked during streaming and without assumptions
- Conversation state persists correctly across navigation

---

### UI Components (Webview Side)

#### Task Group 4: Chat Interface Components
**Dependencies:** Task Group 3

- [x] 4.0 Complete chat UI components for gap-filling conversation
  - [x] 4.1 Write 6 focused tests for UI components
    - Test chat message container renders conversation history
    - Test Claude messages render left-aligned with streaming indicator
    - Test user messages render right-aligned
    - Test assumption cards render structured data correctly
    - Test Accept Assumptions button disabled during streaming
    - Test input field submits on Enter key
  - [x] 4.2 Extend `generateStepContent()` in IdeationWizardPanel for `WizardStep.AIGapFilling`
    - Return HTML for chat container layout
    - Include message list area with scroll container
    - Include input area with text field and send button
    - Include action buttons: Regenerate, Accept Assumptions
  - [x] 4.3 Create chat message rendering functions
    - `renderClaudeMessage(content: string, assumptions?: SystemAssumption[], isStreaming?: boolean): string`
    - `renderUserMessage(content: string): string`
    - `renderStreamingIndicator(): string` - typing dots animation
    - Claude messages: left-aligned, avatar icon, assistant background color
    - User messages: right-aligned, user background color
  - [x] 4.4 Create assumption card component
    - `renderAssumptionCard(assumption: SystemAssumption): string`
    - Display system name as card header
    - List modules as chips/tags
    - List integrations as bullet points
    - Style using VS Code CSS variables for theming
  - [x] 4.5 Implement Accept Assumptions button in Claude messages
    - Render button after assumption cards in Claude response
    - Disable button while `isStreaming: true`
    - On click: send `ACCEPT_ASSUMPTIONS` command to extension
    - Disable button (with "Accepted" label) after assumptions accepted to preserve context
  - [x] 4.6 Implement chat input area
    - Text input field with placeholder: "Refine assumptions..."
    - Send button (icon or text)
    - Handle Enter key to submit (Shift+Enter for newline)
    - Disable input while streaming
    - On submit: send `SEND_CHAT_MESSAGE` command with content
  - [x] 4.7 Implement Regenerate button
    - Position in chat header or action bar
    - On click: send `REGENERATE_ASSUMPTIONS` command
    - Disable while streaming
    - Visual indication of action (optional loading state)
  - [x] 4.8 Implement error state rendering
    - `renderErrorMessage(error: string): string`
    - Display inline error: "Response interrupted. Try again?"
    - Include Retry button that sends `RETRY_LAST_MESSAGE` command
    - Style using error severity colors
  - [x] 4.9 Implement finalization hint
    - Show after 3-4 conversation exchanges
    - Subtle text: "Ready to finalize? Click Confirm & Continue."
    - Position below chat or as banner
  - [x] 4.10 Ensure UI component tests pass
    - Run ONLY the 6 tests written in 4.1
    - Verify components render correctly
    - Verify interactive elements function properly

**Acceptance Criteria:**
- The 6 tests written in 4.1 pass
- Chat messages display correctly with proper alignment
- Assumption cards are scannable and well-formatted
- All buttons function correctly with proper disabled states
- Error states display with retry option
- Input handles submission correctly

---

### Styling & Theming

#### Task Group 5: CSS Styling for Chat Interface
**Dependencies:** Task Group 4

- [x] 5.0 Complete styling for gap-filling chat interface
  - [x] 5.1 Write 3 focused tests for styling
    - Test chat container scrolls correctly with overflow
    - Test responsive layout adapts to panel width
    - Test VS Code theme variables apply correctly (light/dark)
  - [x] 5.2 Add chat container styles
    - Flex column layout with scrollable message area
    - Fixed input area at bottom
    - Proper padding and spacing
    - Use CSS variables: `--vscode-editor-background`, `--vscode-panel-background`
  - [x] 5.3 Add message styles
    - Claude messages: left margin, subtle background, border-radius
    - User messages: right margin, distinct background, border-radius
    - Proper spacing between messages
    - Avatar/icon styling for Claude messages
  - [x] 5.4 Add assumption card styles
    - Card background using `--vscode-editorWidget-background`
    - Border using `--vscode-editorWidget-border`
    - Module chips with pill styling
    - Integration list with subtle bullets
    - Proper internal spacing
  - [x] 5.5 Add streaming indicator animation
    - CSS keyframes for typing dots
    - Subtle animation timing
    - Proper positioning within Claude message area
  - [x] 5.6 Add button styles
    - Accept button: primary action styling
    - Regenerate button: secondary action styling
    - Retry button: warning/error context styling
    - Disabled states with reduced opacity
  - [x] 5.7 Ensure styling tests pass
    - Run ONLY the 3 tests written in 5.1
    - Verify visual consistency across themes

**Acceptance Criteria:**
- The 3 tests written in 5.1 pass
- Chat interface matches VS Code theming conventions
- Layout is clean and messages are easily distinguishable
- Assumption cards are visually distinct and scannable
- Animations are smooth and non-distracting

---

### Testing

#### Task Group 6: Test Review & Gap Analysis
**Dependencies:** Task Groups 1-5

- [x] 6.0 Review existing tests and fill critical gaps only
  - [x] 6.1 Review tests from Task Groups 1-5
    - Review the 4 type tests from Task Group 1
    - Review the 5 service tests from Task Group 2
    - Review the 6 panel tests from Task Group 3
    - Review the 6 UI component tests from Task Group 4
    - Review the 3 styling tests from Task Group 5
    - Total existing tests: 24 tests
  - [x] 6.2 Analyze test coverage gaps for this feature only
    - Identify critical end-to-end workflows lacking coverage
    - Focus on conversation flow from Step 1 to confirmed assumptions
    - Prioritize integration between service, panel, and UI layers
    - Do NOT assess entire application test coverage
  - [x] 6.3 Write up to 8 additional strategic tests maximum
    - E2E: Full conversation flow from auto-send to Accept Assumptions
    - E2E: User refinement updates assumptions with 'user-corrected' source
    - E2E: Step 1 change triggers conversation reset
    - E2E: Error recovery preserves conversation and allows retry
    - Integration: Panel state syncs correctly to webview during streaming
    - Integration: Navigation blocked during streaming, enabled after assumptions accepted
    - Edge case: Malformed JSON in Claude response handled gracefully
    - Edge case: Empty assumptions array blocks navigation
  - [x] 6.4 Run feature-specific tests only
    - Run ONLY tests related to AI gap-filling conversation feature
    - Expected total: approximately 32 tests (24 original + 8 gap tests)
    - Do NOT run the entire application test suite
    - Verify all critical workflows pass

**Acceptance Criteria:**
- All 32 feature-specific tests pass
- Critical end-to-end workflows covered
- No more than 8 additional tests added
- All edge cases for this feature properly handled

---

## Execution Order

Recommended implementation sequence:

1. **Types & Data Models (Task Group 1)** - Foundation for all other groups
2. **Service & Prompt Layer (Task Group 2)** - Claude integration and JSON parsing
3. **Panel Logic (Task Group 3)** - Extension-side message handling and state management
4. **UI Components (Task Group 4)** - Webview chat interface components
5. **Styling & Theming (Task Group 5)** - Visual polish and VS Code theme integration
6. **Test Review & Gap Analysis (Task Group 6)** - Final validation and integration tests

## Key Files to Create/Modify

**New Files:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/resources/prompts/gap-filling-assistant.md` - System prompt
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/gapFillingService.ts` - Service class

**Modified Files:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/wizardPanel.ts` - Type definitions
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/ideationWizardPanel.ts` - Panel logic and UI generation

## Technical Notes

- Leverage existing `BedrockConversationService` for streaming - do not duplicate
- Use existing `AgentifyError` patterns for error handling
- Follow established webview message passing pattern in `IdeationWizardPanel`
- VS Code CSS variables ensure automatic light/dark theme support
- JSON extraction must handle Claude responses that may vary in format
