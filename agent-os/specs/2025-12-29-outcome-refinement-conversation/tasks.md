# Task Breakdown: Outcome Refinement Conversation

## Overview
Total Tasks: 4 Task Groups, 25 Sub-tasks

This feature transforms Step 3 of the Ideation Wizard from an immediately-editable form to a two-phase suggestion-review-then-edit flow with natural language refinement capabilities, matching the established Step 2 pattern.

## Task List

### Types and State Layer

#### Task Group 1: Type Definitions and State Management
**Dependencies:** None

- [x] 1.0 Complete types and state management layer
  - [x] 1.1 Write 3-5 focused tests for state management functionality
    - Test `suggestionsAccepted` state transitions (false -> true on Accept)
    - Test edited flags reset to `false` on Accept click
    - Test hash comparison logic for Step 2 assumptions change detection
    - Test refined sections tracking for "(refined)" indicator
  - [x] 1.2 Extend `OutcomeDefinitionState` interface in `src/types/wizardPanel.ts`
    - Add `suggestionsAccepted: boolean` field (false on entry, true after Accept)
    - Add `step2AssumptionsHash?: string` field for change detection
    - Add `refinedSections: { outcome: boolean; kpis: boolean; stakeholders: boolean }` for tracking refined sections
  - [x] 1.3 Add new WIZARD_COMMANDS for refinement operations
    - Add `SEND_OUTCOME_REFINEMENT` command for refine input submissions
    - Add `ACCEPT_OUTCOME_SUGGESTIONS` command for Accept button clicks
    - Add `RESET_OUTCOME_SUGGESTIONS` command for regenerate flow
  - [x] 1.4 Create hash generation function for Step 2 assumptions
    - Create `generateAssumptionsHash()` function in appropriate location
    - Replicate djb2 hash algorithm pattern from `src/services/gapFillingService.ts`
    - Operate on `confirmedAssumptions` array from Step 2 state
  - [x] 1.5 Ensure types and state tests pass
    - Run ONLY the 3-5 tests written in 1.1
    - Verify type definitions compile without errors
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 3-5 tests written in 1.1 pass
- `OutcomeDefinitionState` interface includes all new fields
- New WIZARD_COMMANDS are defined and typed
- Hash generation function produces consistent hashes for same input

**Test Files:**
- `src/test/types/wizardPanel.step3-refinement.test.ts`

### Service Layer

#### Task Group 2: OutcomeDefinitionService Extensions
**Dependencies:** Task Group 1

- [x] 2.0 Complete service layer extensions
  - [x] 2.1 Write 4-6 focused tests for service refinement functionality
    - Test `sendRefinementMessage()` includes current outcome state as context
    - Test response parsing extracts structured changes for outcome, KPIs, stakeholders
    - Test edited flag checking logic (AI skips fields where edited flag is true)
    - Test `resetConversation()` clears refinement history correctly
  - [x] 2.2 Extend OutcomeDefinitionService with refinement message support
    - File: `src/services/outcomeDefinitionService.ts`
    - Add `sendRefinementMessage(userMessage: string, currentState: OutcomeDefinitionState)` method
    - Include current outcome, KPIs, and stakeholders in refinement context
    - Follow existing `sendMessage()` pattern for conversation handling
  - [x] 2.3 Implement refinement response parsing
    - Parse AI responses for structured changes to outcome, KPIs, stakeholders
    - Return structured object with `changes: { outcome?: string; kpis?: KPI[]; stakeholders?: string[] }`
    - Handle partial updates (AI may only change one section)
  - [x] 2.4 Add edited flag checking logic for Phase 2 refinements
    - Before applying changes, check corresponding edited flag
    - Skip outcome update if `primaryOutcomeEdited` is true
    - Skip metrics update if `metricsEdited` is true
    - Skip stakeholders update if `stakeholdersEdited` is true
  - [x] 2.5 Ensure service layer tests pass
    - Run ONLY the 4-6 tests written in 2.1
    - Verify refinement flow works correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 2.1 pass
- Refinement messages include proper context
- Response parsing extracts structured changes correctly
- Edited flags are respected when applying AI refinements

**Test Files:**
- `src/test/services/outcomeDefinitionService.refinement.test.ts`

### UI Components Layer

#### Task Group 3: HTML Generation and UI Implementation
**Dependencies:** Task Group 2

- [x] 3.0 Complete UI components for two-phase flow
  - [x] 3.1 Write 5-8 focused tests for UI components
    - Test Phase 1 suggestion card renders with Primary Outcome, KPIs list, Stakeholders tags
    - Test Accept button transitions to Phase 2 display
    - Test Phase 2 shows "Accepted" banner and editable form
    - Test refine input appears in both phases
    - Test "(refined)" indicator appears on changed sections
    - Test regenerate confirmation dialog appears when edited flags are true
  - [x] 3.2 Create Phase 1 suggestion card HTML generation
    - File: `src/panels/tabbedPanel.ts` (in `getStep3Html()` function)
    - Generate read-only card with `editorWidget-background`, borders, rounded corners
    - Section headers: "Primary Outcome", "Suggested KPIs", "Stakeholders"
    - Primary Outcome as text block
    - KPIs as bullet list (name, target, unit)
    - Stakeholders as inline tags
    - Reference Step 2 assumption card structure in `getStep2Html()` method
  - [x] 3.3 Implement Accept button and transition to Phase 2
    - Full-width green "Accept Suggestions" button below suggestion card
    - Use `accept-btn` class matching Step 2 styling
    - On click: Set `suggestionsAccepted: true`, set all edited flags to `false`
    - Transition display from suggestion card to editable form
  - [x] 3.4 Create Phase 2 "Accepted" banner
    - Display "Accepted" banner at top of form area
    - Match Step 2 "Accepted" banner styling exactly
    - No timestamp, just "Accepted" text
    - Show when `suggestionsAccepted === true`
  - [x] 3.5 Implement refine input component
    - Text input with placeholder "Refine outcomes..."
    - "Send" button to submit refinement request
    - Example hints below: "Add a metric for cost savings", "Make the outcome more specific to risk"
    - Visible in both Phase 1 and Phase 2
    - Use `chat-input-area`, `chat-input`, `send-btn` classes from Step 2
  - [x] 3.6 Add "(refined)" indicator for changed sections
    - Track which sections have been refined via `refinedSections` state
    - Display "(refined)" text on section headers that changed
    - Reset indicators on regenerate
  - [x] 3.7 Implement streaming and loading states
    - Disable Accept button and refine input during AI streaming
    - Show typing indicator (three animated dots) matching Step 2 pattern
    - Display "Updating..." indicator during Phase 2 refinements
    - Show error messages with "Dismiss" button following Step 2 pattern
  - [x] 3.8 Implement regenerate confirmation logic
    - If Phase 1 OR (Phase 2 with no manual edits): direct regenerate
    - If Phase 2 AND any edited flag is true: show confirmation dialog
    - Regenerate resets to Phase 1 (`suggestionsAccepted: false`)
    - Call `resetConversation()` on regenerate
  - [x] 3.9 Add message handlers for new commands
    - Handle `SEND_OUTCOME_REFINEMENT` command from webview
    - Handle `ACCEPT_OUTCOME_SUGGESTIONS` command from webview
    - Handle `RESET_OUTCOME_SUGGESTIONS` command from webview
    - Wire up to OutcomeDefinitionService methods
  - [x] 3.10 Implement Step 2 assumptions hash comparison on Step 3 entry
    - On Step 3 entry: Generate hash of `confirmedAssumptions` from Step 2
    - Compare with stored `step2AssumptionsHash`
    - If unchanged: Preserve Step 3 state including `suggestionsAccepted`
    - If changed: Reset Step 3 state and re-trigger AI
    - Store new hash for future comparisons
  - [x] 3.11 Ensure UI component tests pass
    - Run ONLY the 5-8 tests written in 3.1
    - Verify Phase 1 and Phase 2 render correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 5-8 tests written in 3.1 pass
- Phase 1 displays read-only suggestion card correctly
- Phase 2 displays editable form with "Accepted" banner
- Refine input works in both phases
- Regenerate behavior follows specified confirmation logic
- State preservation works based on Step 2 assumptions hash

**Test Files:**
- `src/test/panels/tabbedPanel.step3-phases.test.ts`

### Testing Layer

#### Task Group 4: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-3

- [x] 4.0 Review existing tests and fill critical gaps only
  - [x] 4.1 Review tests from Task Groups 1-3
    - Review the 3-5 tests written by types/state layer (Task 1.1)
    - Review the 4-6 tests written by service layer (Task 2.1)
    - Review the 5-8 tests written by UI layer (Task 3.1)
    - Total existing tests: approximately 12-19 tests
  - [x] 4.2 Analyze test coverage gaps for THIS feature only
    - Identify critical user workflows that lack test coverage
    - Focus on end-to-end flows: Step 3 entry -> Phase 1 -> Accept -> Phase 2 -> Refine
    - Check navigation preservation scenarios (back to Step 2 and return)
    - Verify regenerate confirmation edge cases covered
  - [x] 4.3 Write up to 10 additional strategic tests maximum
    - Integration test: Full two-phase flow from entry to completion
    - Integration test: Refine in Phase 1 updates suggestion card correctly
    - Integration test: Refine in Phase 2 respects edited flags
    - Integration test: Regenerate without confirmation (no edits)
    - Integration test: Regenerate with confirmation (has edits)
    - Integration test: Navigation preservation when Step 2 unchanged
    - Integration test: State reset when Step 2 assumptions changed
    - Edge case: Multiple refinements in Phase 1 accumulate "(refined)" indicators
  - [x] 4.4 Run feature-specific tests only
    - Run ONLY tests related to this spec's feature (tests from 1.1, 2.1, 3.1, and 4.3)
    - Expected total: approximately 22-29 tests maximum
    - Do NOT run the entire application test suite
    - Verify critical workflows pass

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 22-29 tests total)
- Critical user workflows for this feature are covered
- No more than 10 additional tests added when filling in testing gaps
- Testing focused exclusively on this spec's feature requirements

## Execution Order

Recommended implementation sequence:

1. **Types and State Layer (Task Group 1)**
   - Establish type definitions and state structure first
   - Creates foundation for service and UI layers

2. **Service Layer (Task Group 2)**
   - Extend OutcomeDefinitionService with refinement capabilities
   - Depends on types from Task Group 1

3. **UI Components Layer (Task Group 3)**
   - Implement Phase 1 and Phase 2 HTML generation
   - Wire up message handlers and state management
   - Depends on types (Task Group 1) and service methods (Task Group 2)

4. **Test Review and Gap Analysis (Task Group 4)**
   - Review all tests written during implementation
   - Fill critical gaps in test coverage
   - Final verification of feature functionality

## Files to Create

| File | Purpose |
|------|---------|
| `src/test/types/wizardPanel.step3-refinement.test.ts` | State management and hash tests |
| `src/test/services/outcomeDefinitionService.refinement.test.ts` | Refinement service tests |
| `src/test/panels/tabbedPanel.step3-phases.test.ts` | Phase 1/Phase 2 UI tests |
| `src/test/integration/step3-refinement-integration.test.ts` | Integration tests for full workflows |

## Files to Modify

| File | Purpose |
|------|---------|
| `src/types/wizardPanel.ts` | Type definitions and WIZARD_COMMANDS |
| `src/services/outcomeDefinitionService.ts` | Refinement message handling and response parsing |
| `src/services/gapFillingService.ts` | Hash generation for Step 2 assumptions |
| `src/panels/tabbedPanel.ts` | HTML generation for Phase 1/Phase 2, message handlers |

## Implementation Notes

1. **Match Step 2 Patterns**: Reference `getStep2Html()` and Step 2 AI methods in `tabbedPanel.ts` for consistent implementation.

2. **State Preservation Logic**: The hash comparison for Step 2 assumptions is critical for good UX - users should not lose their work when navigating back and forth.

3. **Edited Flags Respect**: In Phase 2, AI refinements must check edited flags before overwriting - this is the key difference from Phase 1 where AI can freely update the suggestion card.

4. **No Visual Mockups**: All UI styling should reference existing Step 2 implementation for consistency (editorWidget-background, borders, rounded corners, button styles).

## Implementation Summary

All 4 task groups have been completed with a total of 32 passing tests:

- **Task Group 1**: 6 tests for types and state management
- **Task Group 2**: 8 tests for service layer refinement functionality
- **Task Group 3**: 8 tests for UI component state logic
- **Task Group 4**: 10 integration tests for critical workflows

Key implementations:
- Extended `OutcomeDefinitionState` with `suggestionsAccepted`, `step2AssumptionsHash`, and `refinedSections`
- Added 3 new WIZARD_COMMANDS: `SEND_OUTCOME_REFINEMENT`, `ACCEPT_OUTCOME_SUGGESTIONS`, `RESET_OUTCOME_SUGGESTIONS`
- Created `generateAssumptionsHash()` and `hasAssumptionsChanged()` functions
- Added `buildRefinementContextMessage()`, `parseRefinementChangesFromResponse()`, and `applyRefinementChangesWithEditedFlags()` to OutcomeDefinitionService
- Added `sendRefinementMessage()` method to OutcomeDefinitionService
