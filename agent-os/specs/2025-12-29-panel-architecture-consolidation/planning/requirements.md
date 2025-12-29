# Spec Requirements: Panel Architecture Consolidation

## Initial Description
16.2. Panel Architecture Consolidation - Consolidate duplicate ideation wizard implementations into single `tabbedPanel.ts`:

**Current State:**
- `src/panels/ideationWizardPanel.ts` (~3000 lines): Original standalone wizard with complete AI integration for Steps 1-3, including `OutcomeDefinitionService` integration, streaming handlers, and conversation management
- `src/panels/tabbedPanel.ts` (~2100 lines): Newer unified tabbed panel (Ideation + Demo Viewer) currently used by the app, with manual Step 3 implementation (no AI)

**Problem:**
- Two parallel implementations cause confusion during development
- AI integration code in `ideationWizardPanel.ts` is not being used
- Step 3 in `tabbedPanel.ts` lacks AI-driven suggestions that exist in `ideationWizardPanel.ts`

## Requirements Discussion

### First Round Questions

**Q1:** I assume we should preserve all existing behavior in `tabbedPanel.ts` for Steps 1-2 (which already have AI integration via BedrockConversationService) and only add the missing Step 3 AI features. Is that correct, or do you also want to review/refactor the existing Step 2 code?
**Answer:** Preserve all existing behavior in tabbedPanel.ts for Steps 1-2 (which already have AI integration) and only add the missing Step 3 AI features

**Q2:** I'm thinking the AI suggestions for Step 3 should auto-trigger when navigating FROM Step 2 TO Step 3 (just like Step 2 auto-triggers when coming from Step 1). Should the auto-trigger only fire on first entry to Step 3, or every time the user navigates back to Step 3?
**Answer:** Every time the user navigates back to Step 3 (not just first entry)

**Q3:** Looking at the ideationWizardPanel.ts implementation, it checks `!state.primaryOutcome && !state.isLoading` before auto-triggering AI suggestions. Should we follow the same logic (only auto-send if outcome is empty), or should we add logic to detect if Step 2 assumptions changed and re-trigger AI if so?
**Answer:** Detect if Step 2 assumptions changed and re-trigger AI accordingly

**Q4:** The `regenerateOutcomeSuggestions` command in tabbedPanel.ts currently just clears the form fields. I assume we should update this to call the OutcomeDefinitionService to get fresh AI suggestions (matching ideationWizardPanel.ts behavior). Is that correct?
**Answer:** Update this to call OutcomeDefinitionService for fresh AI suggestions (matching ideationWizardPanel.ts)

**Q5:** For test migration - the roadmap mentions moving relevant tests from `ideationWizardPanel.*.test.ts` to tabbedPanel tests. Should we create new test files specifically for Step 3 AI integration, or add to existing tabbedPanel test files?
**Answer:** Add tests to existing tabbedPanel test files

**Q6:** After deleting `ideationWizardPanel.ts`, should we also clean up any command registrations or view contributions in `package.json` that reference the old standalone wizard (if any exist)?
**Answer:** Clean up any command registrations or view contributions in package.json referencing the old wizard

**Q7:** Is there anything we should explicitly exclude from this consolidation - for example, any features in ideationWizardPanel.ts that we intentionally don't want to port to tabbedPanel.ts?
**Answer:** No exclusions - port everything from ideationWizardPanel.ts to tabbedPanel.ts

### Existing Code to Reference

**Similar Features Identified:**
- Feature: Step 2 AI Gap-Filling Integration - Path: `src/panels/tabbedPanel.ts` (lines 464-742)
  - Components to potentially reuse: `initBedrockService()` pattern, streaming token handlers, conversation history management
- Feature: OutcomeDefinitionService - Path: `src/services/outcomeDefinitionService.ts`
  - Backend logic to reference: `buildOutcomeContextMessage()`, `parseOutcomeSuggestionsFromResponse()`, singleton pattern with `getOutcomeDefinitionService()`
- Feature: ideationWizardPanel.ts Step 3 Implementation - Path: `src/panels/ideationWizardPanel.ts` (lines 2846-2985)
  - Components to port: `initOutcomeService()`, `triggerAutoSendForStep3()`, `sendOutcomeContextToClaude()`, streaming handlers

### Follow-up Questions
None required - all clarifications were addressed in the first round.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A - This is a code consolidation task with no UI changes required.

## Requirements Summary

### Functional Requirements
- Port AI integration for Step 3 from ideationWizardPanel.ts to tabbedPanel.ts
- Auto-trigger AI suggestions every time user navigates to Step 3 (not just first entry)
- Detect changes in Step 2 assumptions and re-trigger AI suggestions accordingly
- Update `regenerateOutcomeSuggestions` to call OutcomeDefinitionService for fresh AI suggestions
- Parse AI response using `parseOutcomeSuggestionsFromResponse()` and populate form fields
- Preserve user edits when AI suggestions arrive (check `primaryOutcomeEdited`, `metricsEdited`, `stakeholdersEdited` flags)
- Delete redundant `ideationWizardPanel.ts` after migration is complete

### Technical Implementation Details

**New Private Members to Add to TabbedPanelProvider:**
- `_outcomeService?: OutcomeDefinitionService`
- `_outcomeStreamingResponse: string`
- `_outcomeDisposables: vscode.Disposable[]`
- `_step2AssumptionsHash?: string` (for change detection)

**New Methods to Implement:**
- `initOutcomeService(): OutcomeDefinitionService | undefined`
- `triggerAutoSendForStep3(): void`
- `sendOutcomeContextToClaude(): Promise<void>`
- `handleOutcomeStreamingToken(token: string): void`
- `handleOutcomeStreamingComplete(fullResponse: string): void`
- `handleOutcomeStreamingError(errorMessage: string): void`
- `generateStep2AssumptionsHash(): string` (for change detection)

**Navigation Changes:**
- Update `ideationNavigateForward()` to call `triggerAutoSendForStep3()` when entering Step 3 from Step 2

**Message Handler Updates:**
- Update `regenerateOutcomeSuggestions` case to call OutcomeDefinitionService instead of just clearing fields

**Cleanup Tasks:**
- Delete `src/panels/ideationWizardPanel.ts`
- Remove `IDEATION_WIZARD_VIEW_ID` export
- Clean up package.json references to old wizard
- Clean up unused imports in extension.ts
- Move relevant tests to existing tabbedPanel test files
- Delete `src/test/panels/ideationWizardPanel.*.test.ts` files

### Reusability Opportunities
- Follow the same service initialization pattern used for BedrockConversationService in Step 2
- Reuse the streaming token/complete/error handler pattern from Step 2 implementation
- Use the existing `OutcomeDefinitionService` singleton pattern via `getOutcomeDefinitionService()`

### Scope Boundaries
**In Scope:**
- Port all AI integration code for Step 3 from ideationWizardPanel.ts to tabbedPanel.ts
- Add Step 2 assumptions change detection logic
- Update regenerate button to use AI
- Delete redundant ideationWizardPanel.ts and related code
- Add tests to existing tabbedPanel test files
- Clean up package.json references

**Out of Scope:**
- Refactoring existing Step 1-2 code in tabbedPanel.ts
- UI/styling changes
- New features beyond what exists in ideationWizardPanel.ts
- Creating new test files (add to existing files instead)

### Technical Considerations
- Use existing `OutcomeDefinitionService` from `src/services/outcomeDefinitionService.ts`
- Follow the existing streaming pattern established in Step 2 for consistency
- Prompt template at `resources/prompts/outcome-definition-assistant.md` is already loaded by the service
- Maintain the singleton pattern for OutcomeDefinitionService via `getOutcomeDefinitionService(context)`
- The service already handles exponential backoff for throttling errors
- Need to track Step 2 assumptions hash to detect changes (similar to `step1InputHash` pattern in Step 2)
