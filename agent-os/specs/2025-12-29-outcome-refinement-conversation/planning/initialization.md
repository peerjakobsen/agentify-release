# Spec Initialization

## Spec Name
Outcome Refinement Conversation

## Initial Description
Add conversational refinement UI to Step 3 of the Ideation Wizard, matching the Step 2 pattern. This transforms Step 3 from an immediately-editable form to a two-phase flow:

**Phase 1 (Suggestion Review)**: On step entry, display AI suggestions as a read-only card (not editable form). Card shows Primary Outcome statement, Suggested KPIs as bullet list, and Suggested Stakeholders as tags. "Accept Suggestions" button to transition to Phase 2.

**Phase 2 (Editable Form)**: After acceptance, show current editable form with "Accepted" banner at top (matching Step 2 pattern). All fields become editable.

**Refine Input**: Text input visible in both phases allowing users to send natural language refinement requests to Claude (e.g., "Add a metric for cost savings", "Make the outcome more specific to risk").

## Reference
Roadmap Item 16.5 from agent-os/product/roadmap.md
