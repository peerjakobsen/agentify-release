# Specification: Outcome Refinement Conversation

## Goal
Add a two-phase conversational refinement UI to Step 3 of the Ideation Wizard, transforming it from an immediately-editable form to a suggestion-review-then-edit flow with natural language refinement capabilities, matching the established Step 2 pattern.

## User Stories
- As a user, I want to review AI-generated outcome suggestions before editing them so that I can understand the AI's recommendations holistically before committing
- As a user, I want to refine outcome suggestions using natural language so that I can quickly adjust KPIs or stakeholders without manual form editing

## Specific Requirements

**Phase 1: Suggestion Review Display**
- On Step 3 entry, display AI suggestions as a read-only card (not editable form fields)
- Card shows Primary Outcome as a text block, KPIs as a bullet list (name, target, unit), Stakeholders as inline tags
- Use `editorWidget-background`, borders, and rounded corners matching Step 2 assumption cards
- Add section headers for "Primary Outcome", "Suggested KPIs", and "Stakeholders" within the card
- Full-width green "Accept Suggestions" button below the card to transition to Phase 2

**Phase 2: Editable Form Display**
- After acceptance, show current editable form (textarea, metric rows, stakeholder checkboxes)
- Display "Accepted" banner at top of form matching Step 2 styling (no timestamp)
- All fields become editable; existing form implementation remains unchanged
- Regenerate button remains visible and functional in Phase 2

**Refine Input Component**
- Text input with placeholder "Refine outcomes..." visible in both Phase 1 and Phase 2
- "Send" button to submit refinement request (disabled during streaming)
- Example hints below input: "Add a metric for cost savings", "Make the outcome more specific to risk"
- Input and button disabled during AI streaming with loading indicator

**Refinement Handling in Phase 1**
- Parse AI response for structured changes to outcome, KPIs, and stakeholders
- Update suggestion card in-place with refined values (replace, not append)
- Add "(refined)" text indicator on section headers that changed from original AI response
- Track which sections have been refined for display purposes

**Refinement Handling in Phase 2**
- AI refinement checks edited flags before updating each field section
- If `primaryOutcomeEdited` is true, AI does NOT overwrite primary outcome
- If `metricsEdited` is true, AI does NOT overwrite success metrics
- If `stakeholdersEdited` is true, AI does NOT overwrite stakeholder selections
- Show brief "Updating..." indicator while AI processes refinement

**State Management for Two-Phase Flow**
- Add `suggestionsAccepted: boolean` field to `OutcomeDefinitionState` (false on entry, true after Accept)
- On Accept click: transition to Phase 2, set ALL edited flags to `false`
- Store hash of `confirmedAssumptions` from Step 2 on Step 3 entry for change detection
- Compare hash on re-entry: if unchanged, preserve Step 3 state; if changed, reset and re-trigger AI

**Regenerate Behavior**
- If Phase 1 OR (Phase 2 with no manual edits): direct regenerate without confirmation
- If Phase 2 AND any edited flag is true: show confirmation dialog before regenerating
- Regenerate resets to Phase 1 (`suggestionsAccepted: false`) with fresh AI suggestions
- Reset conversation history in OutcomeDefinitionService on regenerate

**Loading and Error States**
- Match Step 2 typing indicator pattern (three animated dots)
- Display error messages with "Dismiss" button following Step 2 pattern
- Disable Accept button and refine input during streaming

## Visual Design
No visual mockups provided. Reference Step 2 UI patterns in existing codebase for visual consistency:
- Assumption card styling in `getStep2Html()` for card structure
- Accept button and "Accepted" banner styling
- Chat input area styling for refine input
- Streaming indicator and error states

## Existing Code to Leverage

**Step 2 HTML Generation (`src/panels/tabbedPanel.ts` lines 1990-2120)**
- Reuse assumption card HTML structure with `editorWidget-background`, borders, rounded corners
- Replicate accept button pattern (`accept-btn` class, green styling, full-width)
- Copy chat input area structure (`chat-input-area`, `chat-input`, `send-btn` classes)
- Adapt streaming indicator and error message patterns

**Step 2 AI Methods (`src/panels/tabbedPanel.ts` lines 485-690)**
- Follow `triggerAutoSendForStep2()` pattern for Step 3 auto-trigger with hash comparison
- Replicate streaming token handling pattern from `handleStreamingToken()`
- Use same error handling approach from `handleStreamingError()`

**OutcomeDefinitionService (`src/services/outcomeDefinitionService.ts`)**
- Already handles Step 3 AI communication with `sendMessage()` and event emitters
- `parseOutcomeSuggestionsFromResponse()` extracts JSON for outcome, KPIs, stakeholders
- Extend service to support refinement messages with current outcome state as context
- Reuse `resetConversation()` for regenerate functionality

**Hash Generation Pattern (`src/services/gapFillingService.ts`)**
- Replicate `generateStep1Hash()` pattern for generating Step 2 assumptions hash
- Use same djb2 hash algorithm for consistency
- Create `generateAssumptionsHash()` function operating on `confirmedAssumptions` array

**Wizard Types (`src/types/wizardPanel.ts`)**
- Extend `OutcomeDefinitionState` interface with `suggestionsAccepted: boolean`
- Add `step2AssumptionsHash?: string` field for change detection
- Add new WIZARD_COMMANDS for refinement: `SEND_OUTCOME_REFINEMENT`, `ACCEPT_OUTCOME_SUGGESTIONS`

## Out of Scope
- Changes to Step 2 behavior or UI
- Changes to AI prompt content or response JSON format
- Creating new backend services (extend existing OutcomeDefinitionService only)
- Persisting wizard state to disk (covered by roadmap item 22)
- Multi-turn conversation history display (no chat message list like Step 2)
- Undo/revert functionality for refinements
- Comparison view between original and refined suggestions
- Keyboard shortcuts for accept or send actions
- Animation transitions between Phase 1 and Phase 2
- Mobile or responsive layout adjustments
