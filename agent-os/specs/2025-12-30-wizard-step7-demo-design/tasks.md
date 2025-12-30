# Task Breakdown: Wizard Step 7 - Demo Design

## Overview
Total Tasks: 35 (across 5 task groups)

This spec implements Wizard Step 7 for capturing demo presentation strategy with three sections: Aha Moments, Demo Persona, and Narrative Flow. The step uses an immediately editable pattern (like Step 4) with manual AI generation buttons per section.

## Task List

### State Layer

#### Task Group 1: Types, Interfaces, and State Management
**Dependencies:** None

- [x] 1.0 Complete state layer
  - [x] 1.1 Write 2-5 focused tests for state types and factories
    - Test createDefaultDemoStrategyState() returns correct structure
    - Test DemoStrategyState interface conforms to persistence requirements
    - Test state conversion functions handle Step 7 state correctly
    - Skip exhaustive validation of all edge cases
  - [x] 1.2 Define DemoStrategyState interface in `src/types/wizardPanel.ts`
    - Add AhaMoment interface: id, title, triggerType ('agent' | 'tool'), triggerName, talkingPoint
    - Add DemoPersona interface: name, role, painPoint
    - Add NarrativeScene interface: id, title, description (max 500 chars), highlightedAgents (string[])
    - Add DemoStrategyState interface with arrays, loading flags, and edited flags
    ```typescript
    interface DemoStrategyState {
      ahaMoments: AhaMoment[];
      persona: DemoPersona;
      narrativeScenes: NarrativeScene[];
      isGeneratingMoments: boolean;
      isGeneratingPersona: boolean;
      isGeneratingNarrative: boolean;
      momentsEdited: boolean;
      personaEdited: boolean;
      narrativeEdited: boolean;
    }
    ```
  - [x] 1.3 Create createDefaultDemoStrategyState() factory function
    - Return empty ahaMoments array
    - Return empty persona (name: '', role: '', painPoint: '')
    - Return empty narrativeScenes array
    - All loading flags false
    - All edited flags false
  - [x] 1.4 Add demoStrategy field to WizardState interface
    - Add `demoStrategy: DemoStrategyState` field
    - Update createDefaultWizardState() to include demoStrategy
  - [x] 1.5 Add demoStrategy to PersistedWizardState interface
    - Add `demoStrategy: DemoStrategyState` field for persistence
    - Update wizardStateToPersistedState() to include demoStrategy
    - Update persistedStateToWizardState() to restore demoStrategy
  - [x] 1.6 Add STEP7_* commands to WIZARD_COMMANDS constant
    - STEP7_ADD_MOMENT, STEP7_UPDATE_MOMENT, STEP7_REMOVE_MOMENT
    - STEP7_UPDATE_PERSONA_NAME, STEP7_UPDATE_PERSONA_ROLE, STEP7_UPDATE_PERSONA_PAIN_POINT
    - STEP7_ADD_SCENE, STEP7_UPDATE_SCENE, STEP7_REMOVE_SCENE, STEP7_MOVE_SCENE_UP, STEP7_MOVE_SCENE_DOWN
    - STEP7_GENERATE_MOMENTS, STEP7_GENERATE_PERSONA, STEP7_GENERATE_NARRATIVE, STEP7_GENERATE_ALL
  - [x] 1.7 Ensure state layer tests pass
    - Run ONLY the 2-5 tests written in 1.1
    - Verify factory functions return correct defaults
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-5 tests written in 1.1 pass
- DemoStrategyState interface fully defined with all sub-interfaces
- Factory function creates valid default state
- WizardState and PersistedWizardState include demoStrategy field
- All STEP7_* commands added to WIZARD_COMMANDS

### Service Layer

#### Task Group 2: Demo Strategy AI Service
**Dependencies:** Task Group 1

- [x] 2.0 Complete service layer
  - [x] 2.1 Write 2-5 focused tests for AI service functionality
    - Test buildAhaMomentsContextMessage() generates correct prompt
    - Test buildPersonaContextMessage() generates correct prompt
    - Test buildNarrativeContextMessage() generates correct prompt
    - Test parseAhaMomentsFromResponse() extracts JSON correctly
    - Skip exhaustive testing of error handling paths
  - [x] 2.2 Create `src/services/demoStrategyService.ts` following mockDataService.ts pattern
    - Singleton DemoStrategyService class
    - EventEmitter pattern for onToken, onComplete, onError
    - Use ConverseStreamCommand from Bedrock
    - Track separate conversation histories for each section
  - [x] 2.3 Create system prompt file `resources/prompts/demo-strategy-assistant.md`
    - Define prompt for generating aha moments based on agent/tool context
    - Define prompt for generating persona based on industry/objective
    - Define prompt for generating narrative flow based on agent design
    - Include JSON output format requirements
  - [x] 2.4 Implement buildAhaMomentsContextMessage() function
    - Context: Industry, business objective, confirmed agents with tools
    - Prompt pattern: "Based on this agent workflow, suggest 2-3 key aha moments..."
    - Request JSON array output format
  - [x] 2.5 Implement buildPersonaContextMessage() function
    - Context: Industry, business objective, outcome definition
    - Prompt pattern: "Create a realistic demo persona who would benefit from..."
    - Request JSON object output format (name, role, painPoint)
  - [x] 2.6 Implement buildNarrativeContextMessage() function
    - Context: Agent design, edges/flow, aha moments if defined
    - Prompt pattern: "Create a 4-5 scene demo flow for presenting..."
    - Request JSON array output format
  - [x] 2.7 Implement parsing functions for each section
    - parseAhaMomentsFromResponse(): Extract JSON array from Claude response
    - parsePersonaFromResponse(): Extract JSON object from Claude response
    - parseNarrativeScenesFromResponse(): Extract JSON array from Claude response
    - Handle markdown code blocks in responses
  - [x] 2.8 Ensure service layer tests pass
    - Run ONLY the 2-5 tests written in 2.1
    - Verify context message builders produce correct prompts
    - Verify parsers extract JSON correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-5 tests written in 2.1 pass
- DemoStrategyService follows singleton pattern
- System prompt covers all three sections
- Context builders include appropriate context from prior steps
- Parsers handle Claude's JSON responses correctly

### UI Layer

#### Task Group 3: HTML Rendering
**Dependencies:** Task Groups 1, 2

- [x] 3.0 Complete UI layer
  - [x] 3.1 Write 2-5 focused tests for HTML rendering
    - Test getStep7Html() renders all three sections
    - Test Aha Moments section renders repeatable rows correctly
    - Test Narrative Flow section renders arrow buttons correctly
    - Skip exhaustive testing of all form states
  - [x] 3.2 Add getStep7Html() function to `src/panels/ideationStepHtml.ts`
    - Add case for step 7 in getStepContentHtml()
    - Structure: Header, Generate All button, three section containers
    - Follow existing step HTML patterns
  - [x] 3.3 Implement "Generate All" button at top
    - Button with sparkle icon
    - Disabled while any section is generating
    - Calls handleStep7Command('step7GenerateAll', {})
  - [x] 3.4 Implement Aha Moments section HTML
    - Section header with "Generate Moments" button (sparkle icon)
    - Repeatable row pattern (following Step 3 metrics pattern)
    - Fields per row: title (input), trigger dropdown (grouped), talking point (textarea)
    - Add/remove row buttons with data-index attributes
    - "Add Moment" button disabled when count >= 5
    - Tip text: "Tip: 2-3 key moments keeps your demo focused"
    - Loading indicator when isGeneratingMoments is true
    - Empty state: Show 'No aha moments yet. Add one manually or click Generate Moments' when ahaMoments.length === 0
  - [x] 3.5 Implement trigger dropdown with grouped options
    - Build from agentDesign.confirmedAgents
    - Group headers: "-- Agents --" and "-- Tools --"
    - Agents: Show agent names
    - Tools: Show "toolName (AgentName)" format
    - Dropdown value format: 'agent:{agentName}' or 'tool:{toolName}'
    - On selection, parse value to set both triggerType and triggerName fields
    - Helper function: buildTriggerDropdownOptions()
  - [x] 3.6 Implement Demo Persona section HTML
    - Section header with "Generate Persona" button (sparkle icon)
    - Three fields: Name (input), Role (input), Pain Point (textarea)
    - Plain text, no rich formatting
    - Loading indicator when isGeneratingPersona is true
    - Empty state: Show placeholder text in each field (e.g., 'e.g., Maria, Regional Inventory Manager')
  - [x] 3.7 Implement Narrative Flow section HTML
    - Section header with "Generate Narrative" button (sparkle icon)
    - Ordered list of scene cards
    - Fields per scene: title (input), description (textarea, max 500 chars), highlighted agents (multi-select)
    - Show character counter below description textarea: '{count}/500 characters'
    - Apply warning styling when count > 450
    - Arrow buttons: up/down per scene, disabled at boundaries
    - "Add Scene" button disabled when count >= 8
    - Loading indicator when isGeneratingNarrative is true
    - Empty state: Show 'No scenes defined yet. Add one manually or click Generate Narrative' when narrativeScenes.length === 0
  - [x] 3.8 Implement multi-select for highlighted agents
    - Checkbox list of confirmed agents
    - Helper function: buildAgentMultiSelect(sceneIndex, selectedAgents)
  - [x] 3.9 Add JavaScript handlers to webview script
    - handleStep7Command(command, data) function
    - Individual handlers for each STEP7_* command
    - Follow pattern from handleStep6Command()
  - [x] 3.10 Ensure UI layer tests pass
    - Run ONLY the 2-5 tests written in 3.1
    - Verify HTML renders all sections
    - Verify interactive elements have correct handlers
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-5 tests written in 3.1 pass
- All three sections render correctly
- Generate buttons show sparkle icons and loading states
- Repeatable fields work (add/remove moments, add/remove scenes)
- Arrow buttons enable/disable correctly at boundaries
- Trigger dropdown shows grouped agents and tools

### Logic Handler

#### Task Group 4: Step 7 Logic Handler
**Dependencies:** Task Groups 1, 2, 3

- [x] 4.0 Complete logic handler layer
  - [x] 4.1 Write 3-6 focused tests for logic handler
    - Test handleAddMoment() respects max 5 limit
    - Test handleMoveSceneUp/Down() swaps scenes correctly
    - Test handleGenerateMoments() sets loading state and calls service
    - Test handleGenerateAll() triggers all three sections sequentially
    - Skip exhaustive testing of all field update handlers
  - [x] 4.2 Create `src/panels/ideationStep7Logic.ts` following Step6LogicHandler pattern
    - Class-based handler with setState/getState pattern
    - Constructor accepts context, state, callbacks
    - Import DemoStrategyService
    - Define Step7ContextInputs interface
    - Define Step7Callbacks interface
  - [x] 4.3 Implement Aha Moments handlers
    - handleAddMoment(): Generate unique ID (use crypto.randomUUID() or Date.now().toString()), add empty moment with that ID, check max 5 limit
    - handleUpdateMoment(index, field, value): Update moment field (field: 'title' | 'triggerType' | 'triggerName' | 'talkingPoint'), set momentsEdited = true
    - handleRemoveMoment(index): Remove moment at index
  - [x] 4.4 Implement Demo Persona handlers
    - handleUpdatePersonaName(value): Update persona.name, set personaEdited
    - handleUpdatePersonaRole(value): Update persona.role, set personaEdited
    - handleUpdatePersonaPainPoint(value): Update persona.painPoint, set personaEdited
  - [x] 4.5 Implement Narrative Flow handlers
    - handleAddScene(): Generate unique ID (use crypto.randomUUID() or Date.now().toString()), add empty scene with that ID, check max 8 limit
    - handleUpdateScene(index, field, value): Update scene field, set narrativeEdited
    - handleRemoveScene(index): Remove scene at index
    - handleMoveSceneUp(index): Swap scene with previous (disabled at index 0)
    - handleMoveSceneDown(index): Swap scene with next (disabled at last index)
  - [x] 4.6 Implement AI generation handlers
    - handleGenerateMoments(inputs): Set isGeneratingMoments, call service, parse response
    - handleGeneratePersona(inputs): Set isGeneratingPersona, call service, parse response
    - handleGenerateNarrative(inputs): Set isGeneratingNarrative, call service, parse response
    - Generate always replaces section content (no confirmation dialog). Edited flags are for analytics/tracking only, not for blocking regeneration. Users who want to preserve edits should not click Generate.
  - [x] 4.7 Implement handleGenerateAll(inputs) method
    - Trigger all three sections sequentially (not parallel)
    - Call handleGenerateMoments(), then handleGeneratePersona(), then handleGenerateNarrative()
    - Each awaits previous completion before starting next
  - [x] 4.8 Implement streaming handlers (onToken, onComplete, onError)
    - Track which section is currently streaming
    - Route responses to correct parser
    - Update correct loading flag on complete/error
  - [x] 4.9 Implement getValidationWarnings() method
    - Warning if ahaMoments.length === 0: "No aha moments defined"
    - Warning if narrativeScenes.length === 0: "No narrative scenes defined"
    - Return warnings array (non-blocking)
  - [x] 4.10 Integrate Step7LogicHandler into tabbedPanel.ts
    - Initialize handler in panel constructor
    - Wire STEP7_* commands to handler methods
    - Update handleBackNavigation for Step 7
  - [x] 4.11 Ensure logic handler tests pass
    - Run ONLY the 3-6 tests written in 4.1
    - Verify moment/scene limits enforced
    - Verify arrow reordering works correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 3-6 tests written in 4.1 pass
- All CRUD operations work for moments, persona, and scenes
- Arrow button reordering swaps scenes correctly
- AI generation populates fields without blocking
- Generate All triggers sections sequentially
- Validation warnings show for empty sections

### Testing

#### Task Group 5: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-4

- [x] 5.0 Review existing tests and fill critical gaps only
  - [x] 5.1 Review tests from Task Groups 1-4
    - Review the 2-5 tests written by state layer (Task 1.1)
    - Review the 2-5 tests written by service layer (Task 2.1)
    - Review the 2-5 tests written by UI layer (Task 3.1)
    - Review the 3-6 tests written by logic handler (Task 4.1)
    - Total existing tests: approximately 9-21 tests
  - [x] 5.2 Analyze test coverage gaps for Step 7 feature only
    - Identify critical user workflows that lack test coverage
    - Focus ONLY on gaps related to this spec's feature requirements
    - Prioritize end-to-end workflows:
      - Full moment creation to AI generation flow
      - Scene reordering sequence
      - Generate All sequential execution
    - Do NOT assess entire application test coverage
  - [x] 5.3 Write up to 8 additional strategic tests maximum
    - Integration test: Add moment, generate AI content, verify state update
    - Integration test: Reorder scenes, verify indices update correctly
    - Integration test: Generate All triggers three services in sequence
    - Edge case: Attempt to add moment when at max 5 limit
    - Edge case: Attempt to move first scene up (should no-op)
    - Edge case: Attempt to move last scene down (should no-op)
    - Do NOT write comprehensive coverage for all scenarios
  - [x] 5.4 Run feature-specific tests only
    - Run ONLY tests related to Step 7 (tests from 1.1, 2.1, 3.1, 4.1, and 5.3)
    - Expected total: approximately 17-29 tests maximum
    - Do NOT run the entire application test suite
    - Verify critical workflows pass

**Acceptance Criteria:**
- All Step 7 feature-specific tests pass (approximately 17-29 tests total)
- Critical user workflows for demo strategy are covered
- No more than 8 additional tests added when filling in testing gaps
- Testing focused exclusively on this spec's feature requirements

## Execution Order

Recommended implementation sequence:

1. **State Layer (Task Group 1)** - Foundation for all other work
   - Types and interfaces define the data contract
   - Factory functions enable testing
   - Commands enable webview communication

2. **Service Layer (Task Group 2)** - AI integration
   - Service enables AI generation
   - Depends on state types for response parsing
   - Independent of UI rendering

3. **UI Layer (Task Group 3)** - User interface
   - HTML rendering depends on state types
   - Can be developed in parallel with service layer
   - Webview handlers depend on command constants

4. **Logic Handler (Task Group 4)** - Business logic
   - Integrates state, service, and UI
   - Depends on all previous task groups
   - Final integration into tabbedPanel.ts

5. **Test Review (Task Group 5)** - Quality assurance
   - Reviews all tests from previous groups
   - Fills critical gaps only
   - Final validation before completion

## Technical Notes

### Files to Create
- `src/services/demoStrategyService.ts` - AI service for demo strategy generation
- `src/panels/ideationStep7Logic.ts` - Logic handler for Step 7
- `resources/prompts/demo-strategy-assistant.md` - System prompt for AI

### Files to Modify
- `src/types/wizardPanel.ts` - Add DemoStrategyState and related types
- `src/panels/ideationStepHtml.ts` - Add getStep7Html() function
- `src/panels/tabbedPanel.ts` - Integrate Step7LogicHandler
- `src/webview/webviewScript.ts` - Add handleStep7Command() handlers

### Patterns to Reuse
- Repeatable field group: Step 3 metrics pattern (`data-index` attributes)
- Immediate edit pattern: Step 4 security (no two-phase flow)
- Logic handler: Step 6 handler class structure
- AI service: MockDataService singleton pattern with EventEmitter
- Streaming: onToken, onComplete, onError subscription pattern

### Key Constraints
- Maximum 5 aha moments (disable Add button at limit)
- Maximum 8 narrative scenes (disable Add button at limit)
- Scene description max 500 characters
- No drag-and-drop (use arrow buttons for reordering)
- No auto-trigger on step entry (manual Generate buttons only)
- Sequential Generate All (not parallel)

### Helper Functions
- generateItemId(): Use `Date.now().toString(36) + Math.random().toString(36).substr(2)` for simple unique IDs
