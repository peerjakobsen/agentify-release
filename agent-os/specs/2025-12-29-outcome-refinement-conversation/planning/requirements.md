# Spec Requirements: Outcome Refinement Conversation

## Initial Description
Add conversational refinement UI to Step 3 of the Ideation Wizard, matching the Step 2 pattern. This transforms Step 3 from an immediately-editable form to a two-phase flow:

**Phase 1 (Suggestion Review)**: On step entry, display AI suggestions as a read-only card (not editable form). Card shows Primary Outcome statement, Suggested KPIs as bullet list, and Suggested Stakeholders as tags. "Accept Suggestions" button to transition to Phase 2.

**Phase 2 (Editable Form)**: After acceptance, show current editable form with "Accepted" banner at top (matching Step 2 pattern). All fields become editable.

**Refine Input**: Text input visible in both phases allowing users to send natural language refinement requests to Claude (e.g., "Add a metric for cost savings", "Make the outcome more specific to risk").

Reference: Roadmap Item 16.5 from agent-os/product/roadmap.md

## Requirements Discussion

### First Round Questions

**Q1:** I'm assuming the Phase 1 suggestion card should follow the same visual styling as Step 2's assumption cards (bordered container with `editorWidget-background`, rounded corners). Is that correct, or should the outcome card have a distinct visual treatment?
**Answer:** Match Step 2 assumption cards exactly (editorWidget-background, borders, rounded corners, section headers)

**Q2:** For the refine input in Phase 1, I'm assuming refinements should update the suggestion card in-place (replacing the displayed values) rather than adding a new card. Should there be any visual indication that values have been refined from the original, or should they simply replace?
**Answer:** Replace in-place, add subtle "(refined)" indicator on changed sections

**Q3:** The "Accept Suggestions" button in Phase 1 should be green and full-width, matching Step 2's accept button. After clicking, it transforms to an "Accepted" banner at the top of the form. Should this banner include a timestamp or just "Accepted" like Step 2?
**Answer:** "Accepted" only, no timestamp, match Step 2 styling exactly

**Q4:** For Phase 2 refinement handling, when the user sends a refinement request (e.g., "Add a metric for cost savings"), I'm assuming the AI should directly update the form fields while preserving the user's other manual edits. Is that correct, or should refinements show a confirmation before applying changes?
**Answer:** Direct update, no confirmation dialog, preserve user's manual edits in unmentioned fields

**Q5:** Currently Step 3 tracks `primaryOutcomeEdited`, `metricsEdited`, and `stakeholdersEdited` flags. When transitioning from Phase 1 to Phase 2 via Accept, should these edited flags be set to `false` (since user hasn't manually edited yet), or `true` (to prevent AI overwriting accepted values)?
**Answer:** Set ALL to `false` on Accept. Important nuance: AI refinement in Phase 2 should check edited flags before updating - if flag is true (user manually edited), AI should NOT overwrite that field.

**Q6:** What should happen when the user clicks "Regenerate" while in Phase 2 (after acceptance)? I'm assuming it should reset to Phase 1 (`suggestionsAccepted: false`) with fresh AI suggestions, discarding any manual edits. Is that correct, or should there be a confirmation dialog?
**Answer:** Only show confirmation if Phase 2 AND user has manual edits (any edited flag is true), otherwise direct regenerate without confirmation.

**Q7:** The roadmap mentions "conversation resets on Regenerate or when leaving and re-entering step with fresh data." Should navigating back to Step 2 and returning to Step 3 preserve the acceptance state if Step 2 assumptions haven't changed?
**Answer:** Preserve Step 3 state if Step 2 `confirmedAssumptions` unchanged. Reset Step 3 and re-trigger AI if assumptions changed. Implementation hint: Store hash/snapshot of confirmedAssumptions on Step 3 entry, compare on re-entry.

### Existing Code to Reference

**Similar Features Identified:**
- Feature: Step 2 AI Gap-Filling - Path: `src/panels/tabbedPanel.ts` (lines ~1990-2120 for getStep2Html, lines ~485-690 for AI methods)
- Components to potentially reuse: assumption card styling, accept button pattern, chat input area styling, streaming indicator
- Backend logic to reference: `src/services/outcomeDefinitionService.ts` (already handles Step 3 AI, needs extension for refinement)
- Backend logic to reference: `src/services/bedrockConversationService.ts` (conversation management pattern)
- Backend logic to reference: `src/services/gapFillingService.ts` (hash generation for change detection)

### Follow-up Questions

No follow-up questions needed - user provided comprehensive answers with implementation hints.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A - Reference Step 2 UI patterns in existing codebase for visual consistency.

## Requirements Summary

### Functional Requirements
- Transform Step 3 from immediate-edit form to two-phase flow
- Phase 1: Display AI suggestions as read-only card with Primary Outcome, KPIs (bullet list), Stakeholders (tags)
- Phase 1: "Accept Suggestions" button (green, full-width) transitions to Phase 2
- Phase 2: Editable form with "Accepted" banner at top
- Refine input visible in both phases for natural language adjustments
- Refinements update card/form in-place with "(refined)" indicator on changed sections
- AI respects edited flags in Phase 2 - never overwrites user's manual edits

### State Management Requirements
- New field: `suggestionsAccepted: boolean` (false on step entry, true after Accept click)
- On Accept: Set all edited flags (`primaryOutcomeEdited`, `metricsEdited`, `stakeholdersEdited`) to `false`
- Phase 2 AI refinement: Check edited flags before updating each field section
- Navigation preservation: Store hash of `confirmedAssumptions` on Step 3 entry, compare on re-entry
- If hash unchanged: Preserve Step 3 state including `suggestionsAccepted`
- If hash changed: Reset Step 3 state and re-trigger AI

### Regenerate Behavior
- If Phase 1 OR (Phase 2 with no manual edits): Direct regenerate without confirmation
- If Phase 2 AND any edited flag is true: Show confirmation dialog before regenerating
- Regenerate resets to Phase 1 (`suggestionsAccepted: false`) with fresh AI suggestions

### UI Consistency with Step 2
- Suggestion card styling matches Step 2 assumption cards exactly (editorWidget-background, borders, rounded corners, section headers)
- Accept button matches Step 2 green "Accepted" style
- Refine input matches Step 2 "Refine assumptions..." input styling
- Loading and error states match Step 2 patterns

### Scope Boundaries
**In Scope:**
- Two-phase display (suggestion card -> editable form)
- Refine input for both phases
- "(refined)" indicator for changed sections
- Confirmation dialog for regenerate with manual edits
- State preservation based on Step 2 assumptions hash
- Integration with existing OutcomeDefinitionService

**Out of Scope:**
- Changes to Step 2 behavior
- Changes to AI prompt or response parsing
- New backend services (extend existing OutcomeDefinitionService)
- Persist wizard state to disk (covered by separate roadmap item 22)

### Technical Considerations
- Extend `OutcomeDefinitionState` interface with `suggestionsAccepted: boolean`
- Add hash storage field for Step 2 assumptions comparison (similar to existing `_step2AssumptionsHash`)
- Refinement messages should include current outcome state as context for Claude
- Parse AI refinement responses for structured changes (outcome text, KPI changes, stakeholder changes)
- Reuse existing CSS classes from Step 2 where possible
