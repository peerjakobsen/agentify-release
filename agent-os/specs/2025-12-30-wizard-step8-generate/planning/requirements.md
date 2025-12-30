# Spec Requirements: Wizard Step 8 - Generate

## Initial Description

Build the final wizard step (Step 8) that orchestrates steering file generation and Kiro handoff. This is the capstone step of the Ideation Wizard, transforming all the gathered business context, AI-refined assumptions, outcome definitions, security policies, agent designs, mock data strategies, and demo narratives into actionable Kiro steering files.

Key features from roadmap item 24:
- Pre-Generation Checklist Display showing read-only summary of all wizard inputs
- Generation Progress UI with real-time status updates
- Actions: "Generate" and "Generate & Open in Kiro" buttons
- Post-Generation state with file list and "Start Over" option

## Requirements Discussion

### First Round Questions

**Q1:** For the pre-generation summary, I assume we want a condensed card-based view similar to Step 5's agent summary cards, showing key data from each step without overwhelming the user. Is that correct, or should we show a more detailed expandable list?
**Answer:** Card-based summary following Step 5's agent card pattern is preferred.

**Q2:** I'm assuming the "Edit" buttons next to each section should use the existing step navigation (just set wizard step state) rather than opening a modal. Should we disable the Generate button while editing, or just let the summary update when they return?
**Answer:** Use existing step navigation; summary updates when user returns to Step 8.

**Q3:** For the generation progress, I assume we want a vertical checklist similar to the Demo Viewer's execution log panel. Should individual file generation within "Generate steering files" be visible as nested items, or just show overall progress?
**Answer:** Show nested items for individual file generation progress within the "Generate steering files" step.

**Q4:** The roadmap mentions "Generate & Open in Kiro" depends on Phase 3 Item 34. I assume we should show this button but disable it with a tooltip explaining it's coming soon. Correct, or hide it entirely?
**Answer:** Show the button disabled with tooltip explaining it's coming soon until Phase 3 Item 34 is complete.

**Q5:** For post-generation success, I assume "Open File" links should use VS Code's built-in file reveal command. Should we also auto-open the `.kiro/steering/` folder in the explorer?
**Answer:** Use VS Code file reveal command; do not auto-open the folder (let user click individual files).

**Q6:** The "Start Over" button clears wizard state. I assume this should show a confirmation dialog since it's destructive. Should it also delete any generated files, or just clear the wizard state?
**Answer:** Show confirmation dialog; only clear wizard state, do not delete generated files.

**Q7:** If not in Kiro IDE, what should happen when they click "Generate"? I assume generation should still work (files are created), just the Kiro handoff is unavailable. Correct?
**Answer:** Correct, generation works in any VS Code environment; only Kiro-specific handoff is unavailable.

**Q8:** What edge cases should we explicitly exclude from this step?
**Answer:** Exclude: partial regeneration (regenerate only specific files), generation history/versioning, undo/rollback of generation, and auto-save of wizard state to generated files.

### Existing Code to Reference

**Similar Features Identified:**

| Pattern | Source File | What to Reuse |
|---------|-------------|---------------|
| Card layout with status | `ideationStepHtml.ts` (Step 5 agent cards) | Card structure, status icons |
| Progress indicators | `logPanelHtmlGenerator.ts` | Spinner, checkmark, X icons |
| Logic handler | `ideationStep6Logic.ts` | Class structure, state management |
| Validation aggregation | `ideationStep5Logic.ts` | `getValidationWarnings()` pattern |
| Button handlers | `ideationScript.ts` | Command posting pattern |

**Key Reference Files:**
- Step 5 (Agent Design) - Agent cards with status indicators for card-based summary
- Demo Viewer Execution Log Panel - `logPanelHtmlGenerator.ts` for icon/status pattern
- Step 6 (Mock Data) - `ideationStep6Logic.ts` for state management pattern
- Step 5 Logic Handler - `getValidationWarnings()` for validation pattern

### Follow-up Questions

**Follow-up 1:** The nested progress for "Generate steering files" could be shown as: (a) always-visible inline list, (b) collapsible accordion (expanded by default), or (c) collapsible accordion (collapsed by default, expands on click or failure). Which approach fits the wizard's design language?

**Answer:** Collapsible accordion, collapsed by default.

Behavior:
- Auto-expand if any file fails
- Auto-expand while generation is in progress (shows real-time status)
- Auto-collapse on full success (user can manually expand)

Summary text in collapsed state:
- In progress: "Generating... (3/7 files)"
- Success: "7/7 files created"
- Partial failure: "4/7 files created - click to see details"

Visual examples:
```
Success (collapsed):
  [check] Validate wizard inputs
  [arrow-right] Generate steering files (7/7 files)
  [check] Ready for Kiro

Failure (auto-expanded):
  [check] Validate wizard inputs
  [arrow-down] Generate steering files (4/7 files)
      [check] product.md
      [check] tech.md
      [check] structure.md
      [check] customer-context.md
      [x] integration-landscape.md
      [pending] security-policies.md - Skipped
      [pending] demo-strategy.md - Skipped
  [pending] Ready for Kiro
```

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A - No visuals to analyze.

## Requirements Summary

### Functional Requirements

**Pre-Generation Summary:**
- Card-based read-only summary of all wizard inputs (Steps 1-7)
- Validation status per step (green check if complete, warning if optional fields skipped)
- "Edit" button next to each section using existing step navigation
- Summary auto-updates when user returns from editing

**Generation Progress UI:**
- Vertical checklist with three main items:
  1. Validate wizard inputs
  2. Generate steering files (collapsible accordion with nested file progress)
  3. Ready for Kiro
- Real-time status: spinner while in progress, checkmark on success, X on failure
- Collapsible nested progress for file generation:
  - Collapsed by default
  - Auto-expands during generation (real-time)
  - Auto-expands on failure
  - Auto-collapses on success
  - Summary text shows progress count

**Actions:**
- "Generate" button triggers the generation sequence
- "Generate & Open in Kiro" button disabled with tooltip until Phase 3 Item 34
- Generation works in any VS Code environment; only Kiro handoff unavailable outside Kiro IDE

**Post-Generation:**
- Success state shows generated file list with "Open File" links (VS Code file reveal)
- "Start Over" button with confirmation dialog (clears wizard state only, not files)
- Message for non-Kiro IDE users directing them to open project in Kiro

### Reusability Opportunities

- Card structure and status icons from `ideationStepHtml.ts` (Step 5)
- Progress indicators (spinner, check, X) from `logPanelHtmlGenerator.ts`
- Logic handler class structure from `ideationStep6Logic.ts`
- Validation aggregation pattern (`getValidationWarnings()`) from `ideationStep5Logic.ts`
- Command posting pattern from `ideationScript.ts`

### Scope Boundaries

**In Scope:**
- Pre-generation summary display with edit navigation
- Validation status aggregation across all steps
- Generation progress UI with collapsible nested file progress
- File generation orchestration (calls Phase 3 Item 28)
- Post-generation success/failure states
- "Open File" links using VS Code reveal
- "Start Over" with confirmation (wizard state only)
- Disabled "Generate & Open in Kiro" button with placeholder tooltip

**Out of Scope:**
- Partial regeneration (regenerate specific files only)
- Generation history or versioning
- Undo/rollback of generation
- Auto-save wizard state to generated files
- Actual steering file generation logic (Phase 3 Item 28)
- Kiro spec trigger functionality (Phase 3 Item 34)
- Agentify Power installation (handled at project init)

### Technical Considerations

- Depends on Phase 3 Item 28 (steering generation) for actual file creation
- Depends on Phase 3 Item 34 (Kiro trigger) for "Generate & Open in Kiro" functionality
- Must handle placeholder/disabled state for Phase 3 dependencies
- Files created in `.kiro/steering/` directory
- Generation should be non-blocking with real-time progress updates
- Follow existing wizard step patterns for HTML generation and logic handlers
- Use established icon patterns from Demo Viewer for consistency
