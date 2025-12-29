# Specification: Panel Architecture Consolidation

## Goal
Port the AI integration for Step 3 (Outcome Definition) from `ideationWizardPanel.ts` to `tabbedPanel.ts`, then delete the redundant `ideationWizardPanel.ts` file to consolidate the codebase to a single panel implementation.

## User Stories
- As a developer, I want a single panel implementation so that I can maintain and extend the Ideation Wizard without confusion about which file to modify
- As a user, I want AI-powered outcome suggestions in Step 3 so that I receive intelligent recommendations based on my business context and confirmed assumptions from Steps 1-2

## Specific Requirements

**Add OutcomeDefinitionService Integration to TabbedPanelProvider**
- Import `getOutcomeDefinitionService` and `OutcomeDefinitionService` from `../services/outcomeDefinitionService`
- Add private member `_outcomeService?: OutcomeDefinitionService` for service instance
- Add private member `_outcomeStreamingResponse: string = ''` for accumulating streaming tokens
- Add private member `_outcomeDisposables: vscode.Disposable[] = []` for event subscriptions
- Add private member `_step2AssumptionsHash?: string` for detecting Step 2 changes

**Implement initOutcomeService Method**
- Follow same pattern as existing `initBedrockService()` method (lines 500-531)
- Call `getOutcomeDefinitionService(this._context)` to get singleton instance
- Subscribe to `onToken`, `onComplete`, and `onError` events and push to `_outcomeDisposables`
- Return undefined with console warning if `this._context` is not available

**Implement triggerAutoSendForStep3 Method**
- Generate hash of current Step 2 confirmed assumptions using a helper method
- Compare with stored `_step2AssumptionsHash` to detect changes
- If assumptions changed: reset outcome state (preserve customStakeholders), update hash, call `sendOutcomeContextToClaude()`
- If assumptions unchanged but Step 3 is fresh (no primaryOutcome and not loading): call `sendOutcomeContextToClaude()`
- Key difference from old wizard: always re-trigger on every Step 3 entry, not just first entry

**Implement generateStep2AssumptionsHash Method**
- Create deterministic hash from `confirmedAssumptions` array
- Use JSON.stringify with sorted keys for consistency
- Return hash string for comparison

**Implement sendOutcomeContextToClaude Method**
- Initialize outcome service via `initOutcomeService()`
- Call `service.buildOutcomeContextMessage()` with Step 1-2 inputs and confirmed assumptions
- Set `_ideationState.outcome.isLoading = true` and clear `loadingError`
- Reset `_outcomeStreamingResponse` to empty string
- Update webview content and sync state before API call
- Use async iterator pattern: `for await (const _token of service.sendMessage(contextMessage))`

**Implement Outcome Streaming Handlers**
- `handleOutcomeStreamingToken(token: string)`: Append token to `_outcomeStreamingResponse` (no real-time UI update for Step 3)
- `handleOutcomeStreamingComplete(fullResponse: string)`: Parse response via `service.parseOutcomeSuggestionsFromResponse()`, populate form fields respecting edited flags
- `handleOutcomeStreamingError(errorMessage: string)`: Set `loadingError`, clear loading state, update webview

**Update ideationNavigateForward to Auto-Trigger Step 3 AI**
- Add condition: when `previousStep === 2 && this._ideationState.currentStep === 3`, call `triggerAutoSendForStep3()`
- Matches existing pattern for Step 1 to Step 2 transition (line 406-408)

**Update regenerateOutcomeSuggestions Handler**
- Replace current implementation (lines 311-321) that only clears fields
- Reset outcome state but preserve customStakeholders
- Reset outcome service conversation via `this._outcomeService?.resetConversation()`
- Call `sendOutcomeContextToClaude()` to fetch fresh AI suggestions

**Preserve User Edits When Populating AI Suggestions**
- Check `primaryOutcomeEdited` flag before setting `primaryOutcome`
- Check `metricsEdited` flag before setting `successMetrics`
- Check `stakeholdersEdited` flag before setting `stakeholders`
- Separate AI-suggested stakeholders into `customStakeholders` if not in static `STAKEHOLDER_OPTIONS`

**Update dispose Method for Cleanup**
- Dispose all items in `_outcomeDisposables` array
- Clear the array after disposal

## Existing Code to Leverage

**ideationWizardPanel.ts Step 3 Implementation (lines 2541-2984)**
- Port `initOutcomeService()`, `triggerAutoSendForStep3()`, `sendOutcomeContextToClaude()`
- Port streaming handlers: `handleOutcomeStreamingToken()`, `handleOutcomeStreamingComplete()`, `handleOutcomeStreamingError()`
- Use as reference for `handleRegenerateOutcomeSuggestions()` implementation

**tabbedPanel.ts Step 2 AI Pattern (lines 464-742)**
- Follow same `initBedrockService()` pattern for service initialization
- Replicate streaming event subscription pattern in constructor
- Match error handling approach and state management

**OutcomeDefinitionService (src/services/outcomeDefinitionService.ts)**
- Use `getOutcomeDefinitionService(context)` singleton pattern
- Call `buildOutcomeContextMessage()` for context construction
- Call `parseOutcomeSuggestionsFromResponse()` for JSON extraction
- Subscribe to `onToken`, `onComplete`, `onError` events

**gapFillingService.ts generateStep1Hash Pattern**
- Adapt hash generation approach for Step 2 assumptions change detection
- Use similar deterministic string construction

**Existing IdeationState.outcome Structure (lines 2331-2341)**
- Already has `isLoading`, `loadingError`, `primaryOutcomeEdited`, `metricsEdited`, `stakeholdersEdited` flags
- Structure is ready for AI integration, no type changes needed

## Out of Scope
- Refactoring existing Step 1 or Step 2 code in tabbedPanel.ts
- UI/styling changes to Step 3 form
- Adding new features beyond what exists in ideationWizardPanel.ts
- Creating new test files (tests should be added to existing tabbedPanel test files)
- Modifying the OutcomeDefinitionService itself
- Changing the outcome-definition-assistant.md prompt
- Adding real-time streaming display to Step 3 (only Step 2 shows streaming)
- Persistence of wizard state (roadmap item 22)
- Changes to package.json views/commands beyond cleanup of old wizard references
