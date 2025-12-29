# Specification: Step 5 Agent Design Refinement (Phase 2)

## Goal

Enable users to manually edit AI-proposed agent designs through a two-phase UI pattern, allowing direct modification of agents, orchestration patterns, and workflow edges while preserving AI assistance capabilities.

## User Stories

- As a solution architect, I want to accept the AI proposal and then fine-tune agent names, roles, and tools so that the design matches my specific implementation requirements
- As a user, I want to add or remove agents and modify edge connections so that the workflow matches my organization's processes

## Specific Requirements

**Phase Transition from Proposal Review to Manual Editing**
- In Phase 1, display two action buttons: "Accept Suggestions" and "Accept & Continue"
- "Accept Suggestions" sets `proposalAccepted: true` and transitions UI to Phase 2 (stays on Step 5)
- "Accept & Continue" proceeds directly to Step 6 without manual editing
- Show "Accepted" banner at top when in Phase 2, following Step 3 styling
- Refine input remains visible in both phases for AI-assisted changes

**Editable Agent Cards in Phase 2**
- Transform each agent card from read-only display to inline editable form
- Name field: text input with current agent name
- Role field: textarea with current role description
- Tools field: tag input component (Enter/comma to add, x to remove each tag)
- Track per-agent edited flags: `nameEdited`, `roleEdited`, `toolsEdited`
- Edited flags prevent AI overwrite when user navigates back and triggers re-generation

**Add and Remove Agent Functionality**
- "+ Add Agent" button creates new empty agent card at bottom of list
- New agents get auto-generated unique ID (e.g., `agent_1`, `agent_2`)
- "Remove Agent" button on each card
- Show confirmation dialog if agent has edges: "This agent has X connections that will be removed. Continue?"
- Auto-remove associated edges when agent is deleted

**Orchestration Pattern Selection**
- Dropdown with options: graph, swarm, workflow
- Show AI recommendation badge on the originally suggested pattern
- On pattern change: display inline suggestion card below dropdown with proposed edge updates
- Suggestion card contains "Apply" and "Dismiss" buttons (non-blocking)
- Preserve orchestration reasoning display with expand/collapse

**Edge Editing Table**
- Simple two-column table: "From" dropdown and "To" dropdown per row
- Dropdowns populated with current agent list (by name, keyed by id)
- "+ Add Edge" button creates new row with empty dropdowns
- "x" button per row removes that edge
- Update dropdowns dynamically when agents are added/removed

**Validation Warnings (Non-blocking)**
- Detect orphan agents (agents with no incoming or outgoing edges)
- Detect missing entry point (no agent without incoming edges)
- Display warnings as informational messages, do not block confirmation
- Warnings appear below the edge table

**Confirm Design and State Persistence**
- "Confirm Design" button saves current state and proceeds to Step 6
- Copy edited values to confirmed fields in state for downstream consumption
- Maintain `step4Hash` for change detection on back-navigation
- If Steps 1-4 inputs change on revisit, optionally re-trigger AI while preserving edited fields

## Existing Code to Leverage

**Step 3 Phase 1/Phase 2 Pattern (`ideationStep3Logic.ts`, `ideationStepHtml.ts`)**
- Use `suggestionsAccepted` flag pattern for `proposalAccepted` phase tracking
- Follow edited flags pattern: `primaryOutcomeEdited`, `metricsEdited`, `stakeholdersEdited`
- Replicate "Accepted" banner HTML and CSS styling
- Mirror Phase 1 read-only card vs Phase 2 editable form conditional rendering

**Step 5 Existing Implementation (`ideationStep5Logic.ts`)**
- Extend existing `handleSendAdjustment` for refinement in Phase 2
- Reuse `step4Hash` change detection mechanism
- Build on existing `AgentDesignState` interface structure
- Leverage `handleRegenerateProposal` and `handleAcceptProposal` methods

**Type Definitions (`wizardPanel.ts`)**
- Extend `AgentDesignState` interface with Phase 2 editing fields
- Extend `ProposedAgent` interface with per-agent edited flags
- Add new WIZARD_COMMANDS for Phase 2 actions (update agent, add/remove agent, add/remove edge)
- Reuse `OrchestrationPattern` type for dropdown options

**UI Component Patterns**
- Use existing `module-chip` styling for tool tags
- Follow `add-metric-btn` / `remove-metric-btn` patterns from Step 3 metrics
- Replicate `remove-file` button pattern for remove actions

## Out of Scope

- Edge condition labels (Graph-specific complexity deferred)
- "Suggest tools" per-agent AI button (marked Optional in requirements)
- "Validate Design" AI review button (marked Optional in requirements)
- Handoff limits configuration (Swarm-specific, deferred)
- Parallel group configuration (Workflow-specific, deferred)
- Visual graph/diagram preview of edges (future Phase 4 enhancement)
- Drag-and-drop reordering of agents
- Undo/redo functionality for edits
- Bulk operations (select multiple agents/edges)
- Import/export agent designs
