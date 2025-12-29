# Raw Idea: Panel Architecture Consolidation

16.2. Panel Architecture Consolidation — Consolidate duplicate ideation wizard implementations into single `tabbedPanel.ts`:

**Current State:**
- `src/panels/ideationWizardPanel.ts` (~3000 lines): Original standalone wizard with complete AI integration for Steps 1-3, including `OutcomeDefinitionService` integration, streaming handlers, and conversation management
- `src/panels/tabbedPanel.ts` (~2100 lines): Newer unified tabbed panel (Ideation + Demo Viewer) currently used by the app, with manual Step 3 implementation (no AI)

**Problem:**
- Two parallel implementations cause confusion during development
- AI integration code in `ideationWizardPanel.ts` is not being used
- Step 3 in `tabbedPanel.ts` lacks AI-driven suggestions that exist in `ideationWizardPanel.ts`

**Migration Tasks:**

1. **Port AI Integration for Step 3:**
   - Import and initialize `OutcomeDefinitionService` in `tabbedPanel.ts`
   - Add `_outcomeService` and `_outcomeStreamingResponse` private members
   - Implement `initOutcomeService()` method with event subscriptions
   - Implement `triggerAutoSendForStep3()` to auto-send context on step entry
   - Implement `sendOutcomeContextToClaude()` for AI suggestions
   - Add streaming handlers: `handleOutcomeStreamingToken()`, `handleOutcomeStreamingComplete()`, `handleOutcomeStreamingError()`

2. **Port Type Definitions:**
   - Verify `OutcomeSuggestions` interface from `wizardPanel.ts` is used
   - Ensure `parseOutcomeSuggestionsFromResponse()` from service is called

3. **Update Step Navigation:**
   - Add `triggerAutoSendForStep3()` call in `ideationNavigateForward()` when entering Step 3 from Step 2

4. **Port Prompt Template:**
   - Ensure `resources/prompts/outcome-definition-assistant.md` is loaded by service

5. **Delete Redundant Code:**
   - Remove `src/panels/ideationWizardPanel.ts` entirely
   - Remove `IDEATION_WIZARD_VIEW_ID` export and any package.json references
   - Clean up any unused imports in extension.ts

6. **Update Tests:**
   - Move relevant tests from `ideationWizardPanel.*.test.ts` to tabbedPanel tests
   - Delete `src/test/panels/ideationWizardPanel.*.test.ts` files
