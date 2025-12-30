# Raw Idea: Wizard Step 8 - Generate

Generate Step (Wizard Step 8) — Build the final wizard step that orchestrates steering file generation and Kiro handoff:

**Pre-Generation Checklist Display:**
- Show read-only summary of all wizard inputs across steps 1-7
- Validation status for each step (green check if complete, warning if optional fields skipped)
- "Edit" button next to each section to jump back to that step

**Generation Progress UI:**
- Checklist with real-time status updates:
  - [ ] Validate wizard inputs
  - [ ] Generate steering files (→ Phase 4, Item 28)
  - [ ] Ready for Kiro
- Each item shows spinner while in progress, checkmark on success, X on failure
- Error details expandable if any step fails
- Note: Agentify Power is installed during project initialization, not here

**Actions:**
- "Generate" button — triggers the generation sequence
- "Generate & Open in Kiro" button — generates then triggers Kiro spec flow (→ Phase 4, Item 34)
- Progress is non-blocking — user can see what's happening

**Post-Generation:**
- Success state shows generated file list with "Open File" links
- "Start Over" button to begin new ideation session (clears wizard state)
- If not in Kiro IDE, show message directing user to open project in Kiro

**Dependencies:**
- Requires Phase 3 Item 28 (steering generation) and Item 34 (Kiro trigger) for full functionality
- Agentify Power (Items 29-33) is installed at project init, not here
- Can show placeholder/disabled state until Phase 3 is complete
