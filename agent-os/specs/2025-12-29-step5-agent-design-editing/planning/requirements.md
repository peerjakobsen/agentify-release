# Spec Requirements: Agent Design Refinement (Step 5 Phase 2)

## Initial Description

Agent Design Refinement - Enable editing when "Let me adjust..." selected:

**Transition:**
- Same page, different UI mode (like Step 3's Phase 1 -> Phase 2)
- Show "Accepted" banner (following Step 3 pattern)

**Agent Card Editing:**
- Each agent as editable card with edited flags:
  - `nameEdited`, `roleEdited`, `toolsEdited` per agent
- Fields: Name (text), Role (textarea), Tools (tag input with x remove)
- "x Remove Agent" with confirmation if agent has edges
- "+ Add Agent" opens card with empty fields

**Orchestration Adjustment:**
- Dropdown: graph / swarm / workflow
- Shows AI recommendation badge on original suggestion
- On change: AI suggests updated edges (non-blocking suggestion)

**Edge Editing:**
- Simple table: "From" dropdown -> "To" dropdown
- Add/remove edge buttons
- Validation warnings (non-blocking):
  - Orphan agents (no connections)
  - No entry point

**AI Assistance (Optional):**
- "Suggest tools" button per agent -> quick AI call
- "Validate Design" button -> AI reviews, shows suggestions in toast

**Confirm:**
- "Confirm Design" copies to `confirmed*` fields, proceeds to Step 6
- Edited flags prevent AI overwrite on back-navigation

## Requirements Discussion

### First Round Questions

**Q1:** I assume the "Let me adjust..." button will stay on Step 5 and transform the agent cards from read-only to editable (like Step 3's Phase 1 to Phase 2 transition), while "Accept & Continue" proceeds directly to Step 6. Is that correct, or should "Let me adjust..." open a separate edit modal/panel?
**Answer:** Yes, same page with Phase 1->2 transition. NOT a modal. Two buttons in Phase 1:
- "Accept Suggestions" -> Phase 2 (editable, stays on step)
- "Accept & Continue" -> Step 6 (skip manual editing entirely)

**Q2:** For agent card editing, I'm thinking inline editing where each card expands to show editable fields (Name text input, Role textarea, Tools tag input) when in edit mode. Should we use inline expansion, or would you prefer a side panel or modal for editing individual agents?
**Answer:** Inline expansion. Card transforms in-place to show editable fields. Keeps visual context, matches Step 3 pattern.

**Q3:** For the Tools tag input, I assume a standard tag/chip input pattern: type to add, click "x" on each tag to remove, perhaps with autocomplete suggestions from the AI-generated tool names. Should entering a new tool require pressing Enter/comma, or clicking an "Add" button?
**Answer:** Enter and comma both work, standard tag input UX. No separate Add button needed. Type -> Enter (or comma) -> tag appears.

**Q4:** For edge editing, the spec mentions a "simple table" with From/To dropdowns. I'm assuming a compact table UI with one row per edge, dropdowns populated from the agent list, and +/- buttons. Should we also show edge conditions (for Graph pattern) as an optional third column, or defer that complexity?
**Answer:** Defer. Item 20 explicitly lists "Edge condition labels (Graph-specific)" under "Deferred". Keep the table simple: From -> To only.

**Q5:** When a user changes the orchestration pattern dropdown, should the AI edge suggestions appear as a toast notification, an inline suggestion card below the dropdown, or should they directly update the edges with an "Undo" option?
**Answer:** Inline suggestion card below the dropdown. Shows proposed edges with "Apply" and "Dismiss" buttons. Non-blocking, visible, actionable.

**Q6:** For the "Remove Agent" confirmation (when agent has edges), I'm assuming a simple confirmation dialog: "This agent has X connections. Remove anyway?" Is that sufficient, or should we show which edges will be removed?
**Answer:** Simple count. "This agent has 3 connections that will be removed. Continue?" The edge table is visible on the same page.

**Q7:** Is there anything specific you want to exclude from this implementation, or any features we should explicitly defer to a later iteration?
**Answer:** Defer the following:
- Edge conditions (explicitly deferred in Item 20)
- "Suggest tools" per-agent button (marked Optional)
- "Validate Design" button (marked Optional)
- Handoff limits (Swarm-specific) - deferred in Item 20
- Parallel group config (Workflow-specific) - deferred in Item 20

### Existing Code to Reference

**Similar Features Identified:**
- Feature: Step 3 Outcome Definition - Path: `src/panels/ideationStep3Logic.ts`
  - Phase 1 -> Phase 2 transition pattern with `suggestionsAccepted` flag
  - Edited flags (`primaryOutcomeEdited`, `metricsEdited`, `stakeholdersEdited`)
  - Refine input that works in both phases
- Feature: Step 3 HTML rendering - Path: `src/panels/ideationStepHtml.ts` (getStep3Html function)
  - Suggestion card in Phase 1 vs editable form in Phase 2
  - "Accepted" banner pattern
  - Refine input component
- Feature: Current Step 5 Implementation - Path: `src/panels/ideationStep5Logic.ts`
  - Existing AI proposal generation
  - Adjustment input handling (`handleSendAdjustment`)
  - Agent design state management
- Feature: Wizard Panel Types - Path: `src/types/wizardPanel.ts`
  - `AgentDesignState`, `ProposedAgent`, `ProposedEdge` interfaces
  - Orchestration pattern types

### Follow-up Questions

No follow-up questions needed. The user provided comprehensive clarification including:
- Pattern clarification aligning with Step 3's Phase 1/Phase 2 approach
- Clear button behavior for both phases
- Explicit list of deferred features

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A

## Requirements Summary

### Functional Requirements

**Phase 1 (Proposal Review):**
- Display AI-proposed agents as read-only cards (existing functionality)
- Show orchestration pattern badge with "Why this pattern?" expandable
- Display flow summary text (existing functionality)
- Refine input field: "Adjust agent design..." with Send button for AI adjustments
- "Accept Suggestions" button: transitions to Phase 2 (editable mode, stays on Step 5)
- "Accept & Continue" button: accepts proposal and proceeds directly to Step 6
- "Regenerate" button: fetches fresh AI proposal (existing functionality)

**Phase 2 (Manual Editing):**
- "Accepted" banner at top (matches Step 3 pattern)
- Agent cards transform to editable mode:
  - Name: text input field
  - Role: textarea field
  - Tools: tag input (Enter/comma to add, x to remove)
  - "x Remove Agent" button with confirmation dialog if agent has edges
- "+ Add Agent" button: adds new empty agent card
- Orchestration dropdown: graph / swarm / workflow
  - Shows AI recommendation badge on original suggestion
  - On change: displays inline suggestion card with proposed edges
  - Suggestion card has "Apply" and "Dismiss" buttons
- Edge editing table:
  - Simple two-column table: "From" dropdown -> "To" dropdown
  - Add edge (+) button
  - Remove edge (x) button per row
  - Dropdowns populated from current agent list
- Refine input still visible for AI-assisted changes
- Validation warnings (non-blocking, informational):
  - Orphan agents (no connections)
  - No entry point detected
- "Confirm Design" button: saves to confirmed state and proceeds to Step 6

**State Management:**
- Per-agent edited flags: `nameEdited`, `roleEdited`, `toolsEdited`
- Edited flags prevent AI overwrite on back-navigation
- `proposalAccepted` flag distinguishes Phase 1 vs Phase 2
- Change detection via `step4Hash` for re-triggering AI on input changes

### Reusability Opportunities
- Step 3 Phase 1/Phase 2 transition pattern (suggestionsAccepted, edited flags)
- Step 3 "Accepted" banner styling
- Step 3 refine input component styling
- Existing module-chip/tag styling from agent cards
- Existing dropdown and form field patterns from Steps 1-4

### Scope Boundaries

**In Scope:**
- Phase 1 -> Phase 2 transition UI
- Editable agent cards (name, role, tools)
- Add/remove agent functionality
- Orchestration pattern dropdown with AI edge suggestions
- Edge editing table (From/To only)
- Non-blocking validation warnings
- State management with edited flags
- "Confirm Design" navigation to Step 6

**Out of Scope (Explicitly Deferred):**
- Edge condition labels (Graph-specific) - Item 20
- "Suggest tools" per-agent AI button - marked Optional
- "Validate Design" AI review button - marked Optional
- Handoff limits (Swarm-specific) - Item 20
- Parallel group config (Workflow-specific) - Item 20
- Visual graph preview of edges (Phase 4, Item 25)

### Technical Considerations
- Follow existing Step 3 pattern for Phase 1/Phase 2 state management
- Extend `AgentDesignState` interface with Phase 2 fields if needed
- Tag input should support both Enter and comma as delimiters
- Edge suggestion card is non-blocking (does not auto-apply)
- Confirmation dialog for agent removal only when agent has edges
- Maintain conversation context in AgentDesignService for refinements
