# Raw Idea: Agent Design Refinement

## Description

Agent Design Refinement — Enable editing when "Let me adjust..." selected:

**Transition:**
- Same page, different UI mode (like Step 3's Phase 1 → Phase 2)
- Show "Accepted ✓" banner (following Step 3 pattern)

**Agent Card Editing:**
- Each agent as editable card with edited flags:
  - `nameEdited`, `roleEdited`, `toolsEdited` per agent
- Fields: Name (text), Role (textarea), Tools (tag input with × remove)
- "× Remove Agent" with confirmation if agent has edges
- "+ Add Agent" opens card with empty fields

**Orchestration Adjustment:**
- Dropdown: graph / swarm / workflow
- Shows AI recommendation badge on original suggestion
- On change: AI suggests updated edges (non-blocking suggestion)

**Edge Editing:**
- Simple table: "From" dropdown → "To" dropdown
- Add/remove edge buttons
- Validation warnings (non-blocking):
  - Orphan agents (no connections)
  - No entry point

**AI Assistance (Optional):**
- "✨ Suggest tools" button per agent → quick AI call
- "Validate Design" button → AI reviews, shows suggestions in toast

**Confirm:**
- "Confirm Design" copies to `confirmed*` fields, proceeds to Step 6
- Edited flags prevent AI overwrite on back-navigation

Create the spec folder and save this raw idea.

---

**Date Initiated:** 2025-12-29
