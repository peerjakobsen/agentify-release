# Raw Idea: Outcome Refinement Conversation

## Feature Description

Add conversational refinement UI to Step 3, matching the Step 2 pattern:

**Two-Phase Display:**
- **Phase 1 (Suggestion Review)**: On step entry, display AI suggestions as read-only card (not editable form)
  - Card shows: Primary Outcome statement, Suggested KPIs as bullet list, Suggested Stakeholders as tags
  - "Accept Suggestions" button (green, full-width) to transition to Phase 2
  - Refine input visible below card for pre-acceptance adjustments
- **Phase 2 (Editable Form)**: After acceptance, show current editable form (from item 16)
  - "Accepted ✓" banner at top (matches Step 2 pattern)
  - All fields now editable (textarea, metric rows, stakeholder checkboxes)
  - Refine input remains visible for post-acceptance adjustments

**Refine Input (Both Phases):**
- Text input with placeholder: "Refine outcomes..."
- "Send" button to submit refinement request
- Example hints below input: "Add a metric for cost savings", "Make the outcome more specific to risk"
- Sends natural language request to Claude with current outcome state as context
- AI responds with updated suggestions (Phase 1) or directly updates form fields (Phase 2)

**Refinement Handling:**
- Parse AI response for structured changes: outcome text updates, KPI additions/removals/edits, stakeholder changes
- In Phase 1: Update suggestion card with refined values
- In Phase 2: Update form fields directly, preserve user's other manual edits
- Show brief "Updating..." indicator while AI processes refinement

**State Management:**
- New field: `suggestionsAccepted: boolean` (false on step entry, true after Accept click)
- Preserve `suggestionsAccepted: true` when navigating back and returning to Step 3
- "Regenerate" button resets to Phase 1 (`suggestionsAccepted: false`) with fresh AI call

**Conversation Context:**
- Refinement requests include: business objective, industry, confirmed assumptions (Step 2), current outcome state
- AI maintains context for multi-turn refinements within the step
- Conversation resets on "Regenerate" or when leaving and re-entering step with fresh data

**UI Consistency with Step 2:**
- Suggestion card styling matches Step 2 assumption cards (bordered container, system headers)
- Accept button matches Step 2 green "Accepted ✓" style
- Refine input matches Step 2 "Refine assumptions..." input styling
- Loading and error states match Step 2 patterns
