# Task Breakdown: Panel Architecture Consolidation

## Overview
Total Tasks: 23

This consolidation task ports AI integration for Step 3 from `ideationWizardPanel.ts` to `tabbedPanel.ts`, then removes the redundant file. The work is organized to minimize risk by building incrementally and testing at each stage.

## Task List

### Service Integration Layer

#### Task Group 1: OutcomeDefinitionService Integration Setup
**Dependencies:** None

- [x] 1.0 Complete OutcomeDefinitionService integration in tabbedPanel.ts
  - [x] 1.1 Write 4 focused tests for OutcomeDefinitionService integration
    - Test `initOutcomeService()` returns service instance when context available
    - Test `initOutcomeService()` returns undefined and logs warning when context missing
    - Test service singleton behavior (same instance returned on multiple calls)
    - Test disposables are properly tracked for cleanup
  - [x] 1.2 Add OutcomeDefinitionService imports to tabbedPanel.ts
    - Import `getOutcomeDefinitionService` from `../services/outcomeDefinitionService`
    - Import `OutcomeDefinitionService` type for type annotation
  - [x] 1.3 Add private members for outcome service state
    - `_outcomeService?: OutcomeDefinitionService` - service instance
    - `_outcomeStreamingResponse: string = ''` - accumulated streaming tokens
    - `_outcomeDisposables: vscode.Disposable[] = []` - event subscriptions
    - `_step2AssumptionsHash?: string` - for change detection
  - [x] 1.4 Implement `initOutcomeService()` method
    - Follow pattern from existing `initBedrockService()` (lines 500-531)
    - Call `getOutcomeDefinitionService(this._context)` for singleton instance
    - Subscribe to `onToken`, `onComplete`, `onError` events
    - Push subscriptions to `_outcomeDisposables` array
    - Return undefined with console warning if `this._context` unavailable
  - [x] 1.5 Update `dispose()` method for cleanup
    - Iterate and dispose all items in `_outcomeDisposables` array
    - Clear the array after disposal
  - [x] 1.6 Ensure service integration tests pass
    - Run ONLY the 4 tests written in 1.1
    - Verify service initialization works correctly

**Acceptance Criteria:**
- The 4 tests written in 1.1 pass
- Service initializes correctly with valid context
- Service returns undefined gracefully when context missing
- Disposables are tracked and cleaned up properly

### AI Triggering Logic Layer

#### Task Group 2: Step 2 Change Detection and Auto-Triggering
**Dependencies:** Task Group 1

- [x] 2.0 Complete change detection and auto-triggering logic
  - [x] 2.1 Write 5 focused tests for change detection and auto-triggering
    - Test `generateStep2AssumptionsHash()` produces consistent hash for same assumptions
    - Test `generateStep2AssumptionsHash()` produces different hash when assumptions change
    - Test `triggerAutoSendForStep3()` re-triggers AI when assumptions changed
    - Test `triggerAutoSendForStep3()` triggers AI on fresh Step 3 (no primaryOutcome)
    - Test `triggerAutoSendForStep3()` preserves customStakeholders when resetting
  - [x] 2.2 Implement `generateStep2AssumptionsHash()` method
    - Extract `confirmedAssumptions` array from ideation state
    - Use `JSON.stringify()` with sorted keys for deterministic output
    - Return hash string for comparison
    - Reference `gapFillingService.ts` `generateStep1Hash` pattern
  - [x] 2.3 Implement `triggerAutoSendForStep3()` method
    - Generate hash of current Step 2 confirmed assumptions
    - Compare with stored `_step2AssumptionsHash`
    - If changed: reset outcome state (preserve customStakeholders), update hash, call `sendOutcomeContextToClaude()`
    - If unchanged but fresh (no primaryOutcome and not loading): call `sendOutcomeContextToClaude()`
    - Key: always re-trigger on every Step 3 entry
  - [x] 2.4 Update `ideationNavigateForward()` to auto-trigger Step 3 AI
    - Add condition: when `previousStep === 2 && this._ideationState.currentStep === 3`
    - Call `triggerAutoSendForStep3()` after navigation completes
    - Match existing pattern for Step 1 to Step 2 transition (line 406-408)
  - [x] 2.5 Ensure change detection tests pass
    - Run ONLY the 5 tests written in 2.1
    - Verify hash generation and change detection work correctly

**Acceptance Criteria:**
- The 5 tests written in 2.1 pass
- Hash generation is deterministic and reliable
- Auto-triggering fires on every Step 3 navigation
- Assumptions changes are detected and trigger fresh AI call
- CustomStakeholders are preserved during reset

### Streaming Handlers Layer

#### Task Group 3: AI Response Streaming and Form Population
**Dependencies:** Task Groups 1-2

- [x] 3.0 Complete streaming handlers and form population
  - [x] 3.1 Write 5 focused tests for streaming handlers
    - Test `handleOutcomeStreamingToken()` accumulates tokens correctly
    - Test `handleOutcomeStreamingComplete()` parses and populates primaryOutcome
    - Test `handleOutcomeStreamingComplete()` respects edited flags (skips edited fields)
    - Test `handleOutcomeStreamingComplete()` separates AI stakeholders into customStakeholders
    - Test `handleOutcomeStreamingError()` sets loadingError and clears loading state
  - [x] 3.2 Implement `sendOutcomeContextToClaude()` method
    - Initialize outcome service via `initOutcomeService()`
    - Build context message via `service.buildOutcomeContextMessage()` with Step 1-2 inputs and confirmed assumptions
    - Set `_ideationState.outcome.isLoading = true`, clear `loadingError`
    - Reset `_outcomeStreamingResponse` to empty string
    - Update webview content and sync state before API call
    - Use async iterator: `for await (const _token of service.sendMessage(contextMessage))`
  - [x] 3.3 Implement `handleOutcomeStreamingToken()` method
    - Append token to `_outcomeStreamingResponse`
    - Note: No real-time UI update for Step 3 (only Step 2 shows streaming)
  - [x] 3.4 Implement `handleOutcomeStreamingComplete()` method
    - Parse response via `service.parseOutcomeSuggestionsFromResponse()`
    - Check `primaryOutcomeEdited` flag before setting `primaryOutcome`
    - Check `metricsEdited` flag before setting `successMetrics`
    - Check `stakeholdersEdited` flag before setting `stakeholders`
    - Separate AI-suggested stakeholders not in `STAKEHOLDER_OPTIONS` into `customStakeholders`
    - Clear `isLoading` state after population
  - [x] 3.5 Implement `handleOutcomeStreamingError()` method
    - Set `_ideationState.outcome.loadingError` with error message
    - Clear `_ideationState.outcome.isLoading`
    - Update webview content
  - [x] 3.6 Update `regenerateOutcomeSuggestions` message handler
    - Replace current implementation (lines 311-321) that only clears fields
    - Reset outcome state but preserve customStakeholders
    - Reset outcome service conversation via `this._outcomeService?.resetConversation()`
    - Call `sendOutcomeContextToClaude()` to fetch fresh AI suggestions
  - [x] 3.7 Ensure streaming handler tests pass
    - Run ONLY the 5 tests written in 3.1
    - Verify streaming, parsing, and form population work correctly

**Acceptance Criteria:**
- The 5 tests written in 3.1 pass
- Streaming tokens accumulate correctly
- AI response parses and populates form fields
- User edits are preserved (edited flags respected)
- Custom stakeholders handled correctly
- Regenerate button fetches fresh AI suggestions

### Cleanup Layer

#### Task Group 4: Code Cleanup and File Deletion
**Dependencies:** Task Groups 1-3

- [x] 4.0 Complete code cleanup and file deletion
  - [x] 4.1 Write 3 focused tests for cleanup verification
    - Test that tabbedPanel.ts exports are correct (no IDEATION_WIZARD_VIEW_ID)
    - Test that extension.ts has no references to ideationWizardPanel
    - Test that package.json has no old wizard commands/views
  - [x] 4.2 Delete ideationWizardPanel.ts
    - Remove file: `src/panels/ideationWizardPanel.ts`
    - Verify no compile errors after deletion
  - [x] 4.3 Clean up extension.ts references
    - Remove any imports from ideationWizardPanel
    - Remove any IDEATION_WIZARD_VIEW_ID references
    - Verify no unused imports remain
  - [x] 4.4 Clean up package.json references
    - Remove any command registrations referencing old wizard
    - Remove any view contributions referencing old wizard
    - Verify JSON is valid after changes
  - [x] 4.5 Delete old test files
    - Remove `src/test/panels/ideationWizardPanel.*.test.ts` files
    - Verify test suite still runs
  - [x] 4.6 Ensure cleanup verification tests pass
    - Run ONLY the 3 tests written in 4.1
    - Verify no dead references remain

**Acceptance Criteria:**
- The 3 tests written in 4.1 pass
- ideationWizardPanel.ts is deleted
- No compile errors in the project
- No dead references in extension.ts or package.json
- Old test files removed

### Testing Layer

#### Task Group 5: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-4

- [x] 5.0 Review existing tests and fill critical gaps
  - [x] 5.1 Review tests from Task Groups 1-4
    - Review 4 tests from service integration (Task 1.1)
    - Review 5 tests from change detection (Task 2.1)
    - Review 5 tests from streaming handlers (Task 3.1)
    - Review 3 tests from cleanup verification (Task 4.1)
    - Total existing tests: 17 tests
  - [x] 5.2 Analyze test coverage gaps for this feature only
    - Identify critical end-to-end workflows lacking coverage
    - Focus ONLY on Step 3 AI integration gaps
    - Prioritize integration points over unit test gaps
  - [x] 5.3 Write up to 8 additional strategic tests maximum
    - Add tests for edge cases in navigation flow
    - Add tests for error recovery scenarios
    - Add integration test for full Step 2 to Step 3 transition
    - Do NOT write exhaustive coverage for all scenarios
  - [x] 5.4 Run feature-specific tests only
    - Run ONLY tests related to this spec (tests from 1.1, 2.1, 3.1, 4.1, and 5.3)
    - Expected total: approximately 25 tests maximum
    - Verify critical workflows pass

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 25 tests total)
- Critical Step 3 AI integration workflows covered
- No more than 8 additional tests added
- Testing focused exclusively on this consolidation feature

## Execution Order

Recommended implementation sequence:

1. **Service Integration (Task Group 1)** - Foundation for AI functionality
   - Must complete first as all other groups depend on service availability

2. **AI Triggering Logic (Task Group 2)** - Change detection and auto-trigger
   - Requires service integration to be complete
   - Navigation updates depend on triggering logic

3. **Streaming Handlers (Task Group 3)** - Response processing and form population
   - Requires triggering logic to initiate AI calls
   - Regenerate button depends on streaming infrastructure

4. **Code Cleanup (Task Group 4)** - Remove redundant code
   - Must wait until all functionality is ported and working
   - Safe to delete old files only after verification

5. **Test Review (Task Group 5)** - Final verification and gap filling
   - Reviews all previous work
   - Fills any critical coverage gaps

## File References

**Files to Modify:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/tabbedPanel.ts` - Main target for porting AI integration
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/extension.ts` - Cleanup old references
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/package.json` - Cleanup old commands/views

**Files to Delete:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/ideationWizardPanel.ts`
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/test/panels/ideationWizardPanel.*.test.ts`

**Files to Reference (Do Not Modify):**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/outcomeDefinitionService.ts` - Service to integrate
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/gapFillingService.ts` - Hash generation pattern
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/resources/prompts/outcome-definition-assistant.md` - AI prompt (no changes)

**Test Files to Extend:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/test/panels/tabbedPanel.*.test.ts` - Add Step 3 AI tests here
