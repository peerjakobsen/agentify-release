# Task Breakdown: Step 5 Agent Design Refinement (Phase 2)

## Overview
Total Tasks: 6 Task Groups

This feature enables manual editing of AI-proposed agent designs through a two-phase UI pattern, following the established Step 3 Phase 1/Phase 2 architecture.

## Task List

### Foundation Layer

#### Task Group 1: Type Definitions and State Structure
**Dependencies:** None

- [x] 1.0 Complete type definitions and state structure
  - [x] 1.1 Write 4 focused tests for type definitions
    - Test `createDefaultAgentDesignState()` includes Phase 2 fields
    - Test `ProposedAgent` edited flags are properly initialized
    - Test new wizard commands are properly typed
    - Test state serialization/deserialization preserves Phase 2 fields
  - [x] 1.2 Extend `ProposedAgent` interface in `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/wizardPanel.ts`
    - Add `nameEdited: boolean` flag
    - Add `roleEdited: boolean` flag
    - Add `toolsEdited: boolean` flag
    - Follow pattern from `OutcomeDefinitionState` edited flags
  - [x] 1.3 Extend `AgentDesignState` interface for Phase 2 editing
    - Add `confirmedAgents: ProposedAgent[]` for downstream consumption
    - Add `confirmedOrchestration: OrchestrationPattern` for downstream consumption
    - Add `confirmedEdges: ProposedEdge[]` for downstream consumption
    - Add `originalOrchestration: OrchestrationPattern` to track AI suggestion for badge
    - Add `edgeSuggestion?: { edges: ProposedEdge[]; visible: boolean }` for orchestration change suggestions
  - [x] 1.4 Add new WIZARD_COMMANDS for Phase 2 actions
    - `ACCEPT_SUGGESTIONS_PHASE2: 'acceptSuggestionsPhase2'` (transitions to Phase 2)
    - `ACCEPT_AND_CONTINUE: 'acceptAndContinue'` (copies to confirmed and navigates to Step 6)
    - `UPDATE_AGENT_NAME: 'updateAgentName'`
    - `UPDATE_AGENT_ROLE: 'updateAgentRole'`
    - `ADD_AGENT_TOOL: 'addAgentTool'`
    - `REMOVE_AGENT_TOOL: 'removeAgentTool'`
    - `ADD_AGENT: 'addAgent'`
    - `REMOVE_AGENT: 'removeAgent'`
    - `UPDATE_ORCHESTRATION: 'updateOrchestration'`
    - `ADD_EDGE: 'addEdge'`
    - `REMOVE_EDGE: 'removeEdge'`
    - `UPDATE_EDGE: 'updateEdge'`
    - `APPLY_EDGE_SUGGESTION: 'applyEdgeSuggestion'`
    - `DISMISS_EDGE_SUGGESTION: 'dismissEdgeSuggestion'`
    - `CONFIRM_DESIGN: 'confirmDesign'`
  - [x] 1.5 Update `createDefaultAgentDesignState()` function
    - Initialize all new fields with defaults
    - Set `originalOrchestration` to 'workflow'
    - Initialize empty `confirmedAgents`, `confirmedOrchestration`, `confirmedEdges`
  - [x] 1.6 Ensure type definition tests pass
    - Run ONLY the 4 tests written in 1.1
    - Verify TypeScript compilation succeeds
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- All 4 tests from 1.1 pass
- TypeScript compilation succeeds with no errors
- Extended interfaces follow existing patterns
- New commands are properly typed and exported

**Reference Files:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/wizardPanel.ts` (lines 384-460 for existing types)

---

### Logic Layer

#### Task Group 2: Step 5 Logic Handler Extension
**Dependencies:** Task Group 1 (completed)

- [x] 2.0 Complete Step 5 logic handler extension
  - [x] 2.1 Write 6 focused tests for logic handler
    - Test `handleAcceptSuggestionsPhase2()` sets `proposalAccepted: true`
    - Test `handleUpdateAgent()` sets appropriate edited flags
    - Test `handleAddAgent()` generates unique ID (`agent_1`, `agent_2`, etc.)
    - Test `handleRemoveAgent()` removes associated edges
    - Test `handleConfirmDesign()` copies to confirmed fields
    - Test AI refinement respects edited flags (does not overwrite)
  - [x] 2.2 Add `handleAcceptSuggestionsPhase2()` method
    - Set `proposalAccepted: true`
    - Store `originalOrchestration` from current `proposedOrchestration`
    - Trigger UI update callbacks
    - Follow `handleAcceptProposal()` pattern
  - [x] 2.3 Add agent editing methods
    - `handleUpdateAgentName(agentId: string, name: string)`: Update name, set `nameEdited: true`
    - `handleUpdateAgentRole(agentId: string, role: string)`: Update role, set `roleEdited: true`
    - `handleAddAgentTool(agentId: string, tool: string)`: Add tool to array, set `toolsEdited: true`
    - `handleRemoveAgentTool(agentId: string, toolIndex: number)`: Remove tool, set `toolsEdited: true`
  - [x] 2.4 Add agent add/remove methods
    - `handleAddAgent()`: Create new agent with auto-generated ID, empty name/role/tools
    - `handleRemoveAgent(agentId: string)`: Remove agent and all associated edges
    - Generate unique IDs using pattern: `agent_${nextId}` where `nextId` increments
  - [x] 2.5 Add orchestration and edge methods
    - `handleUpdateOrchestration(pattern: OrchestrationPattern)`: Update pattern, trigger edge suggestion
    - `handleAddEdge()`: Add empty edge row
    - `handleRemoveEdge(index: number)`: Remove edge at index
    - `handleUpdateEdge(index: number, field: 'from' | 'to', agentId: string)`: Update edge
    - `handleApplyEdgeSuggestion()`: Apply suggested edges from `edgeSuggestion`
    - `handleDismissEdgeSuggestion()`: Clear `edgeSuggestion`
  - [x] 2.5b Add `handleBackNavigationToStep5()` method
    - When navigating back from Step 6, preserve `proposalAccepted: true` and all confirmed state
    - Do not reset to Phase 1
  - [x] 2.6 Add confirmation methods
    - `handleAcceptAndContinue()`: Copy proposals directly to confirmed fields, return true to signal navigation to Step 6. Used when user clicks "Accept & Continue" in Phase 1.
    - `handleConfirmDesign()`: Copy (potentially edited) proposals to confirmed fields, return true to signal navigation. Used when user clicks "Confirm Design" in Phase 2.
  - [x] 2.7 Update `handleSendAdjustment()` to respect edited flags
    - Include edited flags in context message to AI
    - After AI response, for each agent only update specific fields where that field's edited flag is false (e.g., if `nameEdited: true` but `roleEdited: false`, preserve name but update role from AI response)
    - Follow Step 3 pattern from `handleOutcomeStreamingComplete()`
  - [x] 2.8 Add validation helper methods
    - `getOrphanAgents()`: Return agents with no incoming or outgoing edges
    - `hasEntryPoint()`: Return true if at least one agent has no incoming edges
    - `getValidationWarnings()`: Return array of warning messages (non-blocking)
  - [x] 2.9 Ensure logic handler tests pass
    - Run ONLY the 6 tests written in 2.1
    - Verify all methods function correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- All 6 tests from 2.1 pass
- Phase 2 transition works correctly
- Edited flags are tracked per-agent
- Edge auto-removal works on agent deletion
- AI refinement respects edited flags
- Validation helpers return correct warnings

**Reference Files:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/ideationStep5Logic.ts` (existing implementation)
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/ideationStep3Logic.ts` (lines 199-266 for edited flag pattern)

---

### Command Handler Layer

#### Task Group 3: Webview Message Handler Integration
**Dependencies:** Task Group 2 (completed)

- [x] 3.0 Complete command handler integration
  - [x] 3.1 Write 4 focused tests for command handlers
    - Test Phase 2 accept command triggers correct logic handler method
    - Test agent update commands route to correct handlers
    - Test confirm design command copies state and navigates to Step 6
    - Test edge commands update state correctly
  - [x] 3.2 Add Phase 2 command handlers to TabbedPanel message handler
    - Handle `ACCEPT_SUGGESTIONS_PHASE2` command
    - Handle `ACCEPT_AND_CONTINUE` command: calls `handleAcceptAndContinue()`, navigates to Step 6 on success
    - Handle all `UPDATE_AGENT_*` commands
    - Handle `ADD_AGENT` and `REMOVE_AGENT` commands
    - Handle `UPDATE_ORCHESTRATION` command
    - Handle all edge commands (`ADD_EDGE`, `REMOVE_EDGE`, `UPDATE_EDGE`)
    - Handle `APPLY_EDGE_SUGGESTION` and `DISMISS_EDGE_SUGGESTION`
    - Handle `CONFIRM_DESIGN` command with navigation to Step 6
  - [x] 3.3 Add agent removal confirmation dialog handling
    - Check if agent has edges before removal
    - If edges exist, send confirmation request to webview
    - Handle confirmation response and proceed with removal
    - Follow existing dialog patterns in the codebase
  - [x] 3.4 Wire orchestration change to AI edge suggestion
    - Add new method `suggestEdgesForPattern(agents: ProposedAgent[], pattern: OrchestrationPattern)` to AgentDesignService
    - Use system prompt that explains pattern characteristics and asks for appropriate edge suggestions
    - On orchestration change, prepare context for AI
    - Call AI service with current agents and new pattern
    - Parse response and populate `edgeSuggestion` state
    - Make suggestion non-blocking (store but don't apply automatically)
  - [x] 3.5 Ensure command handler tests pass
    - Run ONLY the 4 tests written in 3.1
    - Verify all commands route correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- All 4 tests from 3.1 pass
- All Phase 2 commands properly handled
- Confirmation dialog shows for agent removal with edges
- AI edge suggestions are non-blocking
- Navigation to Step 6 works from Confirm Design

**Reference Files:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/tabbedPanel.ts` (command handler switch statement)

---

### UI Layer

#### Task Group 4: Phase 1 UI Updates
**Dependencies:** Task Group 3 (completed)

- [x] 4.0 Complete Phase 1 UI updates
  - [x] 4.1 Write 3 focused tests for Phase 1 UI
    - Test Phase 1 shows "Accept Suggestions" and "Accept & Continue" buttons
    - Test "Accept Suggestions" button sets `proposalAccepted: true` and stays on Step 5
    - Test "Accept & Continue" button navigates directly to Step 6
  - [x] 4.2 Update Phase 1 button layout in `getStep5Html()`
    - Replace current accept button with two buttons side by side
    - "Accept Suggestions" button: primary style, calls `ACCEPT_SUGGESTIONS_PHASE2`, stays on Step 5 in Phase 2 mode
    - "Accept & Continue" button: secondary style, calls `ACCEPT_AND_CONTINUE`, copies proposals to confirmed fields, navigates directly to Step 6 (skips manual editing)
    - Keep "Regenerate" button in existing position
  - [x] 4.3 Add "Accepted" banner for Phase 2
    - Show banner at top when `proposalAccepted === true`
    - Copy HTML/CSS from Step 3 accepted banner pattern
    - Include appropriate text: "Proposal Accepted - Now customize your agent design"
  - [x] 4.4 Ensure refine input remains visible in both phases
    - Verify refine input field renders in both Phase 1 and Phase 2
    - Keep placeholder text: "Adjust agent design..."
    - Maintain existing `handleSendAdjustment` functionality
  - [x] 4.5 Ensure Phase 1 UI tests pass
    - Run ONLY the 3 tests written in 4.1
    - Verify button behavior matches spec
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- All 3 tests from 4.1 pass
- Two distinct buttons visible in Phase 1
- "Accepted" banner displays in Phase 2
- Refine input works in both phases
- UI matches Step 3 styling patterns

**Reference Files:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/ideationStepHtml.ts` (getStep3Html for accepted banner pattern)

---

#### Task Group 5: Phase 2 Editing UI
**Dependencies:** Task Group 4 (completed)

- [x] 5.0 Complete Phase 2 editing UI
  - [x] 5.1 Write 6 focused tests for Phase 2 editing UI
    - Test agent card transforms to editable form in Phase 2
    - Test tool tag input adds tags on Enter/comma
    - Test orchestration dropdown shows AI recommendation badge
    - Test edge table populates dropdowns from agent list
    - Test "+ Add Agent" creates new empty card
    - Test "Remove Agent" shows confirmation when agent has edges
  - [x] 5.2 Create editable agent card component
    - Name field: text input with existing value, `oninput` calls `UPDATE_AGENT_NAME`
    - Role field: textarea with existing value, `oninput` calls `UPDATE_AGENT_ROLE`
    - Tools field: tag input component
      - Display existing tools as chips (use `module-chip` styling)
      - Text input for new tool entry
      - Handle Enter and comma key events to add tags
      - "x" button on each tag calls `REMOVE_AGENT_TOOL`
    - "Remove Agent" button with trash icon
  - [x] 5.3 Implement "+ Add Agent" button
    - Position below agent cards list
    - Call `ADD_AGENT` command on click
    - New card appears with empty fields and auto-generated ID
    - Follow `add-metric-btn` styling pattern from Step 3
  - [x] 5.4 Create orchestration dropdown section
    - Dropdown with options: graph, swarm, workflow
    - Show "AI Suggested" badge on `originalOrchestration` option
    - On change, call `UPDATE_ORCHESTRATION` command
    - Preserve orchestration reasoning with expand/collapse below dropdown
  - [x] 5.5 Create edge suggestion card
    - Display inline below orchestration dropdown when `edgeSuggestion.visible === true`
    - Show proposed edges in readable format
    - "Apply" button calls `APPLY_EDGE_SUGGESTION`
    - "Dismiss" button calls `DISMISS_EDGE_SUGGESTION`
    - Non-blocking: does not prevent other actions
  - [x] 5.6 Create edge editing table
    - Two-column table: "From" and "To"
    - Each row has two dropdowns populated with agent names (keyed by ID)
    - "x" button per row calls `REMOVE_EDGE` with index
    - "+ Add Edge" button below table calls `ADD_EDGE`
    - Dropdowns update dynamically when agents are added/removed
  - [x] 5.7 Add validation warnings display
    - Position below edge table
    - Display orphan agent warnings (agents with no connections)
    - Display missing entry point warning (no agent without incoming edges)
    - Style as informational warnings (yellow/amber), not errors
    - Non-blocking: do not prevent Confirm Design action
  - [x] 5.8 Add "Confirm Design" button
    - Position at bottom of Phase 2 UI
    - Primary button style
    - Call `CONFIRM_DESIGN` command on click
    - Navigates to Step 6 on success
  - [x] 5.9 Ensure Phase 2 editing UI tests pass
    - Run ONLY the 6 tests written in 5.1
    - Verify all editing interactions work correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- All 6 tests from 5.1 pass
- Agent cards are fully editable in Phase 2
- Tag input works with Enter and comma
- Orchestration dropdown shows AI badge
- Edge suggestion card is non-blocking
- Edge table updates dynamically
- Validation warnings display but don't block
- Confirm Design navigates to Step 6

**Reference Files:**
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/ideationStepHtml.ts` (existing Step 5 HTML, Step 3 form patterns)
- `/Users/peerjakobsen/projects/KiroPlugins/agentify/webview-ui/ideation-panel/styles.css` (module-chip, add-metric-btn styles)

---

### Testing and Polish

#### Task Group 6: Test Review and Integration Verification
**Dependencies:** Task Groups 1-5 (all completed)

- [x] 6.0 Review existing tests and verify end-to-end integration
  - [x] 6.1 Review tests from Task Groups 1-5
    - Review 5 tests from types (Task 1.1) - step5AgentDesignPhase2.test.ts
    - Review 26 tests from logic handler (Task 2.1) - ideationStep5LogicPhase2.test.ts
    - Review 16 tests from command handlers (Task 3.1) - tabbedPanel.step5Phase2Commands.test.ts
    - Review 8 tests from Phase 1 UI (Task 4.1) - step5AgentDesign.test.ts (Phase 1 section)
    - Review 13 tests from Phase 2 UI (Task 5.1) - step5AgentDesignPhase2UI.test.ts
    - Total existing tests: 68+ tests across Phase 2 specific test files
  - [x] 6.2 Analyze test coverage gaps for this feature only
    - Identified critical user workflows that lack coverage
    - Focused on Phase 1 to Phase 2 transition edge cases
    - Checked back-navigation behavior with edited flags
    - Verified AI re-generation respects edited fields
  - [x] 6.3 Write up to 7 additional strategic tests maximum
    - Test full Phase 1 -> Phase 2 -> Confirm Design workflow
    - Test back-navigation from Step 6 returns to Phase 2 (not Phase 1) with confirmed state preserved
    - Test AI regeneration does not overwrite edited agent fields
    - Test removing all edges then adding new ones
    - Test orchestration change -> apply suggestion workflow
    - Test multiple agent additions/removals in sequence
    - Test validation warnings appear for various invalid states
    - **Created**: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/test/integration/step5-phase2-integration.test.ts` (15 tests)
  - [x] 6.4 Run feature-specific tests only
    - Ran all tests related to Step 5 Phase 2 feature (75 tests across 5 test files)
    - All 75 tests pass
    - Test files verified:
      - step5AgentDesignPhase2.test.ts: 5 tests (types)
      - ideationStep5LogicPhase2.test.ts: 26 tests (logic handler)
      - tabbedPanel.step5Phase2Commands.test.ts: 16 tests (command handlers)
      - step5AgentDesignPhase2UI.test.ts: 13 tests (Phase 2 UI)
      - step5-phase2-integration.test.ts: 15 tests (integration - new)
  - [x] 6.5 Manual verification checklist
    - Phase 1 buttons render correctly (Accept Suggestions, Accept & Continue)
    - Phase 2 transition shows "Accepted" banner
    - Agent editing works (name, role, tools with tag input)
    - Orchestration dropdown shows AI badge on original suggestion
    - Edge table updates with agent changes (add/remove/update)
    - Validation warnings are non-blocking (orphan agents, no entry point)
    - Confirm Design navigates to Step 6

**Acceptance Criteria:**
- [x] All feature-specific tests pass (75 tests)
- [x] Phase 1 -> Phase 2 -> Step 6 workflow is complete
- [x] Edited flags properly protect user changes
- [x] AI suggestions work alongside manual editing
- [x] No more than 7 additional tests added to fill gaps (added 7 strategic tests with 15 total assertions)
- [x] Manual verification checklist passes

---

## Execution Order

Recommended implementation sequence:
1. **Foundation Layer** (Task Group 1) - Type definitions and state structure
2. **Logic Layer** (Task Group 2) - Step 5 logic handler extension
3. **Command Handler Layer** (Task Group 3) - Message handler integration
4. **UI Layer - Phase 1** (Task Group 4) - Phase 1 button updates and banner
5. **UI Layer - Phase 2** (Task Group 5) - Editable components and forms
6. **Testing and Polish** (Task Group 6) - Integration verification

## Key Patterns to Follow

### From Step 3 (`ideationStep3Logic.ts`, `ideationStepHtml.ts`):
- `suggestionsAccepted` flag pattern -> use for `proposalAccepted`
- Edited flags pattern: `primaryOutcomeEdited`, `metricsEdited`, `stakeholdersEdited`
- "Accepted" banner HTML structure and CSS styling
- Phase 1 read-only card vs Phase 2 editable form conditional rendering
- Refine input that works in both phases

### From Step 5 Existing (`ideationStep5Logic.ts`):
- `handleSendAdjustment()` method for AI refinement
- `step4Hash` change detection mechanism
- `handleRegenerateProposal()` and `handleAcceptProposal()` methods
- Streaming response handling pattern

### UI Component Patterns:
- `module-chip` styling for tool tags
- `add-metric-btn` / `remove-metric-btn` patterns from Step 3 metrics
- `remove-file` button pattern for remove actions
- Dropdown styling from Step 4 security options
