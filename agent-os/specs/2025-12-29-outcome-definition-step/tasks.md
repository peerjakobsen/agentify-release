# Task Breakdown: Outcome Definition Step (Step 3)

## Overview
Total Tasks: 27 (across 5 task groups)
Estimated Complexity: Medium-High
Dependencies: Existing Step 2 AI patterns, Bedrock service, wizard infrastructure

## Task List

### Types and Constants Layer

#### Task Group 1: Type Definitions and Constants
**Dependencies:** None
**Complexity:** Low
**Estimated Time:** 1-2 hours

- [x] 1.0 Complete types and constants for Step 3
  - [x] 1.1 Write 4-6 focused tests for new types and constants
    - Test `OutcomeSuggestions` interface structure validation
    - Test expanded `STAKEHOLDER_OPTIONS` contains required values
    - Test `OutcomeDefinitionState` default factory function
    - Test new `WIZARD_COMMANDS` entries exist
    - Test user edit tracking flags type safety
  - [x] 1.2 Expand `STAKEHOLDER_OPTIONS` constant in `src/types/wizardPanel.ts`
    - Add: IT, Sales, Marketing, HR, Legal (currently has: Operations, Finance, Supply Chain, Customer Service, Executive)
    - Follow existing constant pattern (line 232-238)
  - [x] 1.3 Create `OutcomeSuggestions` interface in `src/types/wizardPanel.ts`
    - Interface: `{ primaryOutcome: string; suggestedKPIs: Array<{ name: string; targetValue: string; unit: string }>; stakeholders: string[] }`
    - Place near `OutcomeDefinitionState` interface (around line 243)
  - [x] 1.4 Add Step 3 state tracking fields to `OutcomeDefinitionState`
    - Add: `isLoading: boolean` for AI loading state
    - Add: `loadingError?: string` for AI error state
    - Add: `primaryOutcomeEdited: boolean` for user edit tracking
    - Add: `metricsEdited: boolean` for user edit tracking
    - Add: `stakeholdersEdited: boolean` for user edit tracking
    - Add: `customStakeholders: string[]` for AI-suggested stakeholders outside static list
  - [x] 1.5 Add new WIZARD_COMMANDS for Step 3 in `src/types/wizardPanel.ts`
    - Add: `UPDATE_PRIMARY_OUTCOME: 'updatePrimaryOutcome'`
    - Add: `ADD_METRIC: 'addMetric'`
    - Add: `REMOVE_METRIC: 'removeMetric'`
    - Add: `UPDATE_METRIC: 'updateMetric'`
    - Add: `TOGGLE_STAKEHOLDER: 'toggleStakeholder'`
    - Add: `ADD_CUSTOM_STAKEHOLDER: 'addCustomStakeholder'`
    - Add: `REGENERATE_OUTCOME_SUGGESTIONS: 'regenerateOutcomeSuggestions'`
    - Add: `DISMISS_OUTCOME_ERROR: 'dismissOutcomeError'`
    - Follow pattern at lines 477-509
  - [x] 1.6 Update `createDefaultWizardState()` factory function
    - Initialize new `OutcomeDefinitionState` fields with defaults
    - Set `isLoading: false`, `loadingError: undefined`, all edit flags `false`
    - Update existing function around line 553
  - [x] 1.7 Add `WizardValidationErrorType` entries for Step 3
    - Add `'primaryOutcome'` and `'successMetrics'` (already present at line 425)
    - Verify types are properly exported
  - [x] 1.8 Ensure types layer tests pass
    - Run ONLY the 4-6 tests written in 1.1
    - Verify all new types compile without errors
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 1.1 pass
- All new types and interfaces compile without TypeScript errors
- `STAKEHOLDER_OPTIONS` has 10 entries: Operations, Finance, Supply Chain, Customer Service, Executive, IT, Sales, Marketing, HR, Legal
- `WIZARD_COMMANDS` includes all 8 new Step 3 commands
- Default wizard state initializes Step 3 fields correctly

**Files to Modify:**
- `src/types/wizardPanel.ts`
- `src/test/types/wizardPanel.test.ts` (add tests)

**Files to Create:**
- `src/test/types/wizardPanel.step3.test.ts`

---

### AI Service Layer

#### Task Group 2: Outcome Definition AI Service
**Dependencies:** Task Group 1
**Complexity:** Medium
**Estimated Time:** 2-3 hours

- [x] 2.0 Complete AI service layer for outcome suggestions
  - [x] 2.1 Write 4-6 focused tests for outcome service
    - Test `buildOutcomeContextMessage()` formats context correctly
    - Test `parseOutcomeSuggestionsFromResponse()` extracts JSON from markdown
    - Test parsing handles malformed JSON gracefully (returns null)
    - Test parsing handles missing fields gracefully
    - Test `OutcomeSuggestions` validation logic
  - [x] 2.2 Create AI prompt file `resources/prompts/outcome-definition-assistant.md`
    - Define system prompt for outcome suggestion generation
    - Specify JSON output format within markdown code fences
    - Include examples of good KPIs and stakeholder suggestions
    - Reference industry and business context for relevant suggestions
    - Follow pattern from `resources/prompts/gap-filling-assistant.md`
  - [x] 2.3 Create `src/services/outcomeDefinitionService.ts`
    - Implement singleton pattern following `gapFillingService.ts`
    - Implement `loadSystemPrompt()` method to load from `resources/prompts/outcome-definition-assistant.md`
    - Add `buildOutcomeContextMessage()` function
      - Accept: businessObjective, industry, systems, confirmedAssumptions
      - Return formatted prompt string for Claude
    - Add `parseOutcomeSuggestionsFromResponse()` function
      - Parse JSON from markdown code fences (follow `parseAssumptionsFromResponse` pattern at lines 81-148)
      - Return `OutcomeSuggestions | null`
      - Validate 3-5 KPIs in suggestedKPIs array
  - [x] 2.4 Create dedicated Bedrock conversation for outcome suggestions
    - OutcomeDefinitionService internally creates its own BedrockConversationService instance
    - Load outcome-definition-assistant.md as system prompt (separate from Step 2's prompt)
    - Maintain separate conversation history from Step 2 gap-filling
    - Reuse shared BedrockRuntimeClient from bedrockClient.ts for actual API calls
    - This follows the principle: each wizard step that uses AI has its own conversation context
  - [x] 2.5 Add service export and singleton getter function
    - `getOutcomeDefinitionService(context: vscode.ExtensionContext)`
    - `resetOutcomeDefinitionService()` for testing
  - [x] 2.6 Ensure AI service layer tests pass
    - Run ONLY the 4-6 tests written in 2.1
    - Verify prompt file loads correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 2.1 pass
- Prompt file exists at `resources/prompts/outcome-definition-assistant.md`
- Service correctly parses JSON from Claude responses
- Context message includes all Step 1-2 data
- Service handles errors gracefully without crashing

**Files to Create:**
- `resources/prompts/outcome-definition-assistant.md`
- `src/services/outcomeDefinitionService.ts`
- `src/test/services/outcomeDefinitionService.test.ts`

**Existing Code to Reference:**
- `src/services/gapFillingService.ts` (lines 81-148 for JSON parsing)
- `resources/prompts/gap-filling-assistant.md`

---

### Panel UI Layer

#### Task Group 3: Step 3 Form UI Implementation
**Dependencies:** Task Groups 1 and 2
**Complexity:** High
**Estimated Time:** 4-6 hours

- [x] 3.0 Complete Step 3 UI in ideationWizardPanel.ts
  - [x] 3.1 Write 6-8 focused tests for Step 3 UI behavior
    - Test `validateStep3()` returns error when primaryOutcome is empty
    - Test `validateStep3()` returns warning (non-blocking) when metrics count is 0
    - Test `validateStep3()` is valid with empty stakeholders
    - Test AI suggestions populate form fields correctly
    - Test user edits set corresponding edit flags
    - Test regeneration confirmation logic based on edit flags
    - Test add/remove metric operations
    - Test stakeholder toggle operations
  - [x] 3.2 Implement `generateStep3Html()` method in IdeationWizardPanelProvider
    - Follow pattern from `generateStep1Html()` (lines 408-549)
    - Include step header with h2 title and description
    - Add regenerate button in header area (follow Step 2 `.chat-actions` pattern)
    - Render primary outcome textarea
      - Placeholder: "Describe the measurable business result..."
      - Bind to `UPDATE_PRIMARY_OUTCOME` command
      - Show error state when validation fails
    - Render success metrics list
      - Horizontal rows with name, targetValue, unit inputs
      - Remove button (trash icon) per row
      - "Add Metric" button below list
      - Soft cap guidance at 10 metrics
    - Render stakeholders checkbox grid
      - Follow `.systems-grid` pattern from Step 1 (2-column responsive)
      - Static options from `STAKEHOLDER_OPTIONS`
      - AI-suggested items with "(AI suggested)" badge
      - Custom stakeholder text input with "Add" button
    - Display loading indicator while AI suggestions load
    - Display dismissable error message if AI fails
  - [x] 3.3 Add CSS styles for Step 3 components
    - Add to `generateWizardCss()` method
    - Style `.metrics-list` container for horizontal metric rows
    - Style metric row with three inputs and remove button
    - Style "(AI suggested)" badge for custom stakeholders
    - Style loading indicator (reuse `.typing-indicator` from Step 2)
    - Style dismissable error message with close button
    - Ensure responsive behavior for metric rows
  - [x] 3.4 Add JavaScript handlers for Step 3 in `generateWizardJs()`
    - Add `updatePrimaryOutcome(value)` function
    - Add `addMetric()` function
    - Add `removeMetric(index)` function
    - Add `updateMetric(index, field, value)` function
    - Add `toggleStakeholder(stakeholder)` function
    - Add `addCustomStakeholder()` function
    - Add `regenerateOutcomeSuggestions()` function
    - Add `dismissOutcomeError()` function
    - Follow existing message posting pattern (lines 1563-1685)
  - [x] 3.5 Implement `validateStep3()` validation method
    - Follow `validateStep1()` pattern (lines 148-197)
    - Primary outcome: Required (blocking error if empty)
    - Success metrics: Warning if 0 metrics (non-blocking)
    - Stakeholders: Optional (no validation)
    - Return `WizardValidationState` with appropriate errors/warnings
  - [x] 3.6 Add Step 3 case to `validateCurrentStep()` switch
    - Update method around line 237
    - Return `validateStep3()` for `WizardStep.OutcomeDefinition`
  - [x] 3.7 Add Step 3 case to `generateStepContent()` switch
    - Update method around line 735
    - Return `generateStep3Html()` for `WizardStep.OutcomeDefinition`
  - [x] 3.8 Implement message handlers for Step 3 commands
    - Add cases to `handleMessage()` switch (around line 1702)
    - Handle `UPDATE_PRIMARY_OUTCOME`: update state, set edit flag, validate
    - Handle `ADD_METRIC`: add empty metric to array, set edit flag
    - Handle `REMOVE_METRIC`: remove metric at index, set edit flag
    - Handle `UPDATE_METRIC`: update metric field, set edit flag
    - Handle `TOGGLE_STAKEHOLDER`: toggle in stakeholders array, set edit flag
    - Handle `ADD_CUSTOM_STAKEHOLDER`: add to customStakeholders, set edit flag
    - Handle `REGENERATE_OUTCOME_SUGGESTIONS`: show confirmation if edited, reset and re-trigger AI
    - Handle `DISMISS_OUTCOME_ERROR`: clear loadingError
  - [x] 3.9 Ensure Step 3 UI tests pass
    - Run ONLY the 6-8 tests written in 3.1
    - Verify form renders correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 6-8 tests written in 3.1 pass
- Step 3 form renders with all three field groups
- Validation correctly blocks on empty primary outcome
- Validation shows warning (non-blocking) for 0 metrics
- Add/remove metric operations work correctly
- Stakeholder toggles work correctly
- Custom stakeholder input works
- Regenerate button shows confirmation when fields have been edited

**Files to Modify:**
- `src/panels/ideationWizardPanel.ts`

**Files to Create:**
- `src/test/panels/ideationWizardPanel.step3.test.ts`

**Existing Code Patterns to Follow:**
- `generateStep1Html()` at lines 408-549
- `generateStep2Html()` at lines 554-622
- `validateStep1()` at lines 148-197
- `handleMessage()` switch at lines 1702-1797

---

### AI Integration Layer

#### Task Group 4: AI Auto-Trigger and Regeneration Integration
**Dependencies:** Task Groups 1, 2, and 3
**Complexity:** Medium-High
**Estimated Time:** 3-4 hours

- [x] 4.0 Complete AI integration for Step 3
  - [x] 4.1 Write 4-6 focused tests for AI integration
    - Test auto-trigger fires when entering Step 3 from Step 2
    - Test AI suggestions populate form without overwriting user edits
    - Test loading state shows while AI is working
    - Test error state displays and is dismissable
    - Test regeneration resets conversation and re-triggers AI
    - Test regeneration confirmation dialog appears when edits exist
  - [x] 4.2 Implement `triggerAutoSendForStep3()` method
    - Follow `triggerAutoSendForStep2()` pattern (lines 1952-2026)
    - Check if Step 2 confirmed assumptions exist
    - Only auto-send if Step 3 is fresh (no prior suggestions loaded)
    - Set `isLoading: true` before API call
    - Use outcomeDefinitionService to build context message
  - [x] 4.3 Implement `sendOutcomeContextToClaude()` method
    - Initialize Bedrock service for outcome prompt
    - Build context from Steps 1-2: businessObjective, industry, systems, confirmedAssumptions
    - Send message and handle streaming (or wait for complete JSON)
    - Parse response using `parseOutcomeSuggestionsFromResponse()`
    - Populate form fields with suggestions (if not edited)
  - [x] 4.4 Implement outcome-specific streaming/completion handlers
    - `handleOutcomeStreamingComplete(fullResponse: string)` method
    - Parse suggestions from response
    - Populate `primaryOutcome` if not `primaryOutcomeEdited`
    - Populate `successMetrics` if not `metricsEdited`
    - Populate `stakeholders` if not `stakeholdersEdited`
    - Handle AI-suggested stakeholders outside static list
    - Set `isLoading: false` on completion
  - [x] 4.5 Implement outcome-specific error handler
    - `handleOutcomeStreamingError(errorMessage: string)` method
    - Set `loadingError` with user-friendly message
    - Set `isLoading: false`
    - Keep form fields functional for manual entry
  - [x] 4.6 Update `navigateForward()` to trigger Step 3 AI on entry
    - Add condition: entering Step 3 from Step 2 triggers `triggerAutoSendForStep3()`
    - Follow pattern at lines 301-304 for Step 2 trigger
  - [x] 4.7 Implement regeneration with confirmation dialog
    - Check if any edit flag is true: `primaryOutcomeEdited || metricsEdited || stakeholdersEdited`
    - If edited: show confirmation message in UI
    - On confirmation: reset edit flags, clear current values, reset Bedrock conversation, re-trigger AI
    - If not edited: directly regenerate without confirmation
  - [x] 4.8 Ensure AI integration tests pass
    - Run ONLY the 4-6 tests written in 4.1
    - Verify auto-trigger works on step entry
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 4.1 pass
- AI suggestions auto-load when entering Step 3
- Form remains interactive while AI loads
- User edits are not overwritten by async AI suggestions
- Error messages display and are dismissable
- Regeneration shows confirmation when user has edited fields
- Regeneration works correctly after confirmation

**Files to Modify:**
- `src/panels/ideationWizardPanel.ts`

**Test Files:**
- Tests added to `src/test/panels/ideationWizardPanel.step3.test.ts` (same file as Task Group 3)

**Existing Code Patterns to Follow:**
- `triggerAutoSendForStep2()` at lines 1952-2026
- `sendContextToClaude()` at lines 1977-2026
- `handleStreamingComplete()` at lines 2046-2066
- `handleRegenerateAssumptions()` at lines 2143-2160

---

### Test Review and Gap Analysis

#### Task Group 5: Test Review & Gap Analysis
**Dependencies:** Task Groups 1-4
**Complexity:** Low-Medium
**Estimated Time:** 1-2 hours

- [x] 5.0 Review existing tests and fill critical gaps only
  - [x] 5.1 Review tests from Task Groups 1-4
    - Review the 4-6 tests written for types/constants (Task 1.1)
    - Review the 4-6 tests written for AI service (Task 2.1)
    - Review the 6-8 tests written for UI (Task 3.1)
    - Review the 4-6 tests written for AI integration (Task 4.1)
    - Total existing tests: approximately 18-26 tests
  - [x] 5.2 Analyze test coverage gaps for Step 3 feature only
    - Identify critical user workflows that lack test coverage
    - Focus ONLY on gaps related to Step 3 feature requirements
    - Prioritize end-to-end workflows over unit test gaps
    - Do NOT assess entire application test coverage
  - [x] 5.3 Write up to 6 additional strategic tests maximum (deferred)
    - Add maximum of 6 new tests to fill identified critical gaps
    - Focus on integration points and end-to-end workflows
    - Potential areas:
      - Full wizard navigation through Step 3
      - AI failure fallback to manual entry
      - State preservation when navigating back and forth
      - Custom stakeholder flow (add, display, persist)
    - Do NOT write comprehensive coverage for all scenarios
  - [x] 5.4 Run Step 3 feature-specific tests only
    - Run ONLY tests related to Step 3 feature
    - Expected total: approximately 24-32 tests maximum
    - Verify critical workflows pass
    - Do NOT run the entire application test suite

**Acceptance Criteria:**
- All Step 3 feature-specific tests pass (approximately 24-32 tests total)
- Critical user workflows for Step 3 are covered
- No more than 6 additional tests added when filling gaps
- Testing focused exclusively on Step 3 feature requirements

**Test Files:**
- `src/test/types/wizardPanel.test.ts`
- `src/test/services/outcomeDefinitionService.test.ts`
- `src/test/panels/ideationWizardPanel.step3.test.ts`

---

## Execution Order

Recommended implementation sequence:

```
Task Group 1: Types and Constants (Foundation)
     |
     v
Task Group 2: AI Service Layer (Backend logic)
     |
     v
Task Group 3: Step 3 Form UI (Frontend rendering)
     |
     v
Task Group 4: AI Integration (Connect service to UI)
     |
     v
Task Group 5: Test Review & Gap Analysis (Quality assurance)
```

**Rationale:**
1. **Types first** - Establishes the data structures all other layers depend on
2. **Service second** - Implements business logic for AI suggestions without UI coupling
3. **UI third** - Builds the form using the types, can mock service for development
4. **Integration fourth** - Connects service to UI, requires both to be complete
5. **Tests last** - Reviews all components and fills gaps before completion

---

## Key Implementation Notes

### Patterns to Follow

| Pattern | Location | Purpose |
|---------|----------|---------|
| AI auto-trigger | `triggerAutoSendForStep2()` lines 1952-2026 | Auto-send context on step entry |
| JSON parsing | `parseAssumptionsFromResponse()` lines 81-148 | Extract JSON from markdown |
| Form validation | `validateStep1()` lines 148-197 | Field-level validation with errors/warnings |
| Step HTML generation | `generateStep1Html()` lines 408-549 | Form rendering with state binding |
| Message handling | `handleMessage()` lines 1702-1797 | Webview command processing |
| CSS system grid | `.systems-grid` pattern | 2-column responsive checkbox grid |

### New Files to Create

1. `resources/prompts/outcome-definition-assistant.md`
2. `src/services/outcomeDefinitionService.ts`
3. `src/test/services/outcomeDefinitionService.test.ts`
4. `src/test/panels/ideationWizardPanel.step3.test.ts`
5. `src/test/types/wizardPanel.step3.test.ts`

### Files to Modify

1. `src/types/wizardPanel.ts`
2. `src/panels/ideationWizardPanel.ts`
3. `src/test/types/wizardPanel.test.ts`

### Testing Strategy

- Each task group starts with writing 4-8 focused tests
- Tests verify only critical behaviors, not exhaustive coverage
- Tests run incrementally per task group, not full suite
- Final task group reviews all tests and fills maximum 6 gaps

### Out of Scope Reminders

From the spec, these are explicitly excluded:
- Calculated or derived metrics
- Tracking metrics over time or historical trend display
- External integrations or data sources for real metric values
- Metric dependencies or relationships between metrics
- Weighting or priority scoring for metrics
- Historical baselines or benchmark comparisons
- Per-field regeneration buttons (only single "regenerate all" button)
- Hard limits on metric count (only soft guidance at 10)
- Streaming display of AI response (wait for complete JSON response)
- Metric templates or presets per industry
