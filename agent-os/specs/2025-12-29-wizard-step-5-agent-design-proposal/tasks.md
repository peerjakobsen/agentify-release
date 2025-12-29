# Task Breakdown: Agent Design Proposal (Wizard Step 5)

## Overview
Total Sub-tasks: 49 (across 6 task groups)

## Files to Create
- `src/services/agentDesignService.ts` — Agent design AI service
- `resources/prompts/agent-design-assistant.md` — System prompt for agent team proposals

## Files to Modify
- `src/types/wizardPanel.ts` — Add AgentDesignState, ProposedAgent, ProposedEdge interfaces
- `src/panels/tabbedPanel.ts` — Add Step 5 handlers, navigation trigger, service initialization
- `src/panels/ideationStepHtml.ts` — Add getStep5Html() function
- `src/panels/ideationStyles.ts` — Add Step 5 CSS styles
- `src/panels/ideationScript.ts` — Add Step 5 JavaScript handlers
- `src/test/suite/step5AgentDesign.test.ts` — Step 5 tests

## Task List

### State & Types Layer

#### Task Group 1: State Structure Additions
**Dependencies:** None

- [x] 1.0 Complete state structure additions
  - [x] 1.1 Write 4 focused tests in `src/test/suite/step5AgentDesign.test.ts`
    - Test createDefaultAgentDesignState() returns correct defaults
    - Test ProposedAgent interface validation (id, name, role, tools)
    - Test ProposedEdge interface validation (from, to, condition)
    - Test OrchestrationPattern type union ('graph' | 'swarm' | 'workflow')
  - [x] 1.2 Add AgentDesignState interface to `src/types/wizardPanel.ts`
    - Fields: proposedAgents[], proposedOrchestration, proposedEdges[], orchestrationReasoning
    - Fields: proposalAccepted, isLoading, error
    - Fields: step4Hash (string for change detection), aiCalled (boolean)
    - Follow OutcomeDefinitionState pattern in wizardPanel.ts
  - [x] 1.3 Add ProposedAgent interface
    - Fields: id (string, lowercase), name (string), role (string), tools (string[])
    - Add JSDoc comments following existing SystemAssumption pattern
  - [x] 1.4 Add ProposedEdge interface
    - Fields: from (string), to (string), condition (optional string)
    - Add JSDoc comments following existing patterns
  - [x] 1.5 Add OrchestrationPattern type
    - Type union: 'graph' | 'swarm' | 'workflow' (matches existing type in config.ts)
  - [x] 1.6 Add createDefaultAgentDesignState() factory function
    - Return default state with empty arrays and false flags
    - Follow createDefaultOutcomeDefinitionState() pattern
  - [x] 1.7 Update IdeationState interface in tabbedPanel.ts
    - Add agentDesign: AgentDesignState property
    - Update createDefaultIdeationState() to include default agentDesign state
  - [x] 1.8 Ensure state layer tests pass
    - Run ONLY the 4 tests written in 1.1
    - Verify TypeScript compilation succeeds

**Acceptance Criteria:**
- The 4 tests written in 1.1 pass
- TypeScript compiles without errors
- State interfaces are properly typed with JSDoc comments
- Default factory function returns valid state

### Service Layer

#### Task Group 2: AgentDesignService Implementation
**Dependencies:** Task Group 1

- [x] 2.0 Complete AgentDesignService
  - [x] 2.1 Write 5 focused tests in `src/test/suite/step5AgentDesign.test.ts`
    - Test loadSystemPrompt() loads and caches prompt correctly
    - Test buildAgentDesignContextMessage() formats Steps 1-4 data properly
    - Test parseAgentProposalFromResponse() extracts agents array from JSON
    - Test parseAgentProposalFromResponse() extracts orchestration pattern and edges
    - Test singleton pattern (getAgentDesignService/resetAgentDesignService)
  - [x] 2.2 Create `src/services/agentDesignService.ts` with service class
    - Singleton pattern with getAgentDesignService() and resetAgentDesignService()
    - Follow OutcomeDefinitionService class structure in outcomeDefinitionService.ts
    - Implement vscode.Disposable interface
  - [x] 2.3 Implement EventEmitter pattern for streaming
    - Add _onToken, _onComplete, _onError EventEmitters
    - Add public onToken, onComplete, onError event properties
    - Follow EventEmitter pattern from OutcomeDefinitionService
  - [x] 2.4 Implement loadSystemPrompt() method
    - Load from AGENT_DESIGN_PROMPT_PATH = 'resources/prompts/agent-design-assistant.md'
    - Cache after first load
    - Follow loadSystemPrompt() method pattern
  - [x] 2.5 Implement buildAgentDesignContextMessage() method
    - Accept parameters: businessObjective, industry, systems, customSystems, confirmedAssumptions, primaryOutcome, successMetrics, dataSensitivity, complianceFrameworks, approvalGates
    - Format as structured prompt for agent team proposal
    - Include all Step 1-4 context
  - [x] 2.6 Implement sendMessage() async generator method
    - Follow _executeWithRetry pattern from OutcomeDefinitionService
    - Implement exponential backoff retry logic (same constants: INITIAL_BACKOFF_MS=1000, MAX_BACKOFF_MS=30000, MAX_RETRY_ATTEMPTS=3)
    - Yield tokens as they stream from Bedrock
  - [x] 2.7 Implement parseAgentProposalFromResponse() method
    - Extract JSON block from response using regex pattern from parseOutcomeSuggestionsFromResponse()
    - Validate agents array with id, name, role, tools
    - Validate orchestrationPattern is one of 'graph' | 'swarm' | 'workflow'
    - Validate edges array with from, to, optional condition
    - Extract reasoning string
    - Return null if parsing fails
  - [x] 2.8 Implement resetConversation() method
    - Clear conversation history array
    - Follow resetConversation() pattern from OutcomeDefinitionService
  - [x] 2.9 Ensure service layer tests pass
    - Run ONLY the 5 tests written in 2.1
    - Verify service instantiation works correctly

**Acceptance Criteria:**
- The 5 tests written in 2.1 pass
- Service follows singleton pattern correctly
- EventEmitter events fire properly during streaming
- JSON parsing handles valid and invalid responses gracefully

### Prompt Layer

#### Task Group 3: System Prompt Creation
**Dependencies:** Task Group 2

- [x] 3.0 Complete system prompt
  - [x] 3.1 Write 3 focused tests in `src/test/suite/step5AgentDesign.test.ts`
    - Test prompt includes JSON schema for agents, orchestration, edges, reasoning
    - Test prompt specifies tool format as lowercase snake_case {system}_{operation}
    - Test prompt describes three orchestration patterns (graph, swarm, workflow)
  - [x] 3.2 Create `resources/prompts/agent-design-assistant.md`
    - Follow structure of outcome-definition-assistant.md
    - Include clear role definition for agent team design
    - Specify JSON response format requirements
  - [x] 3.3 Define JSON schema for agent proposals
    - agents[]: id (lowercase), name, role, tools[]
    - orchestrationPattern: 'graph' | 'swarm' | 'workflow'
    - edges[]: from, to, optional condition
    - reasoning: string (2-3 sentences)
  - [x] 3.4 Document tool naming conventions
    - Format: lowercase snake_case {system}_{operation}
    - Examples: sap_get_inventory, salesforce_query_accounts, databricks_run_query
    - Specify 2-4 tools per agent based on role
  - [x] 3.5 Document orchestration pattern selection criteria
    - Graph: For complex, conditional workflows with decision points
    - Swarm: For parallel, autonomous agents with emergent coordination
    - Workflow: For sequential, linear pipelines with defined steps
  - [x] 3.6 Include example responses
    - Include complete example JSON for each orchestration type
    - Show edge notation for sequential, parallel, and conditional flows
  - [x] 3.7 Ensure prompt tests pass
    - Run ONLY the 3 tests written in 3.1
    - Verify prompt file loads correctly through service

**Acceptance Criteria:**
- The 3 tests written in 3.1 pass
- Prompt follows established format from outcome-definition-assistant.md
- JSON schema is clearly defined and parseable
- Tool naming convention is clearly documented

### UI Components Layer

#### Task Group 4: Step 5 UI Components
**Dependencies:** Task Groups 1, 2, 3

- [x] 4.0 Complete Step 5 UI components
  - [x] 4.1 Write 6 focused tests in `src/test/suite/step5AgentDesign.test.ts`
    - Test getStep5Html() renders loading indicator when isLoading=true
    - Test agent cards render name, ID badge, role, and tools
    - Test orchestration badge renders pattern name
    - Test "Why this pattern?" expandable section toggles correctly
    - Test flow summary renders with arrow notation
    - Test action buttons (Regenerate, Accept, Adjust) are present and disabled during loading
  - [x] 4.2 Add getStep5Html() function to ideationStepHtml.ts
    - Follow getStep4Html() structure in ideationStepHtml.ts
    - Include header with step description
    - Include loading indicator with typing animation (follow getStep3Html pattern)
  - [x] 4.3 Implement agent card grid rendering
    - Use CSS grid layout (follow assumption-card pattern from getStep2Html)
    - Card structure:
      - Agent name as bold header text
      - Subtle ID badge (e.g., "#planner") with muted style
      - Role as lighter subtitle text
      - Tools as horizontal chips (use module-chip class)
  - [x] 4.4 Implement orchestration display section
    - Pattern badge chip showing "Graph", "Swarm", or "Workflow" (display capitalized, store lowercase)
    - Badge is non-clickable (static display)
    - Separate "Why this pattern?" text link below badge
    - Add expand chevron that rotates on toggle
  - [x] 4.5 Implement expandable reasoning section
    - Use accordion pattern with CSS transitions
    - Show orchestrationReasoning text (2-3 sentences)
    - Chevron rotates from right-pointing to down-pointing
  - [x] 4.6 Implement flow summary display
    - Single-line text in monospace font
    - Light border box container
    - Use agent IDs (not full names) for brevity
    - Arrow notation: -> for sequential, [a | b] for parallel, ? suffix for conditional
  - [x] 4.7 Add action buttons section
    - "Regenerate" button with regenerate-btn class
    - "Accept & Continue" button with accept-btn class
    - "Let me adjust..." button with secondary styling
    - All buttons disabled during isLoading state
  - [x] 4.8 Add CSS styles for Step 5 components in ideationStyles.ts
    - Agent card styles (extend assumption-card pattern)
    - Agent ID badge styles (muted, smaller font)
    - Orchestration badge styles (non-clickable chip)
    - Flow summary box styles (monospace, light border)
    - Chevron rotation animation (.expanded class toggles rotation)
    - Accordion expand/collapse transitions
  - [x] 4.9 Ensure UI component tests pass
    - Run ONLY the 6 tests written in 4.1
    - Verify HTML renders correctly in all states

**Acceptance Criteria:**
- The 6 tests written in 4.1 pass
- Agent cards match assumption-card styling pattern
- Orchestration badge displays correctly
- Flow summary uses correct arrow notation
- Expand/collapse animation is smooth

### Integration Layer

#### Task Group 5: Auto-Proposal Trigger and Navigation
**Dependencies:** Task Groups 1-4

- [x] 5.0 Complete auto-proposal trigger mechanism
  - [x] 5.1 Write 4 focused tests in `src/test/types/step5AgentDesign.test.ts`
    - Test generateStep4Hash() produces consistent hash from Steps 1-4 inputs
    - Test triggerAutoSendForStep5() calls service when hash differs
    - Test triggerAutoSendForStep5() skips call when aiCalled=true and hash unchanged
    - Test ideationNavigateForward() calls trigger when moving from Step 4 to Step 5
  - [x] 5.2 Implement generateStep4Hash() function
    - Include: industry, systems, customSystems
    - Include: confirmedAssumptions from aiGapFillingState
    - Include: primaryOutcome, successMetrics from outcome state
    - Include: dataSensitivity, complianceFrameworks, approvalGates from securityGuardrails
    - Follow generateStep1Hash() pattern using djb2 algorithm
  - [x] 5.3 Implement triggerAutoSend() method in Step5LogicHandler
    - Follow triggerAutoSendForStep3() pattern exactly
    - Compare current hash with stored step4Hash
    - If hash differs, reset agentDesign state and re-fetch proposal
    - Only auto-send if !aiCalled and conversation is fresh
  - [x] 5.4 Implement sendAgentDesignContextToClaude() method
    - Build context using service.buildAgentDesignContextMessage()
    - Set isLoading=true, clear error
    - Stream response using service.sendMessage()
    - Handle tokens via event handlers
    - Follow sendOutcomeContextToClaude() pattern
  - [x] 5.5 Add event handlers for streaming
    - handleAgentDesignStreamingToken(): append to streaming response
    - handleAgentDesignStreamingComplete(): parse response, update state
    - handleAgentDesignStreamingError(): set error state, handle retry
    - Follow outcome streaming handlers pattern
  - [x] 5.6 Update ideationNavigateForward() to trigger Step 5
    - Add condition: if (previousStep === 4 && this._ideationState.currentStep === 5)
    - Call this._step5Handler.triggerAutoSend()
    - Follow existing navigation trigger pattern in ideationNavigateForward()
  - [x] 5.7 Initialize Step5LogicHandler in tabbedPanel.ts
    - Add _step5Handler property
    - Initialize in initStepHandlers() method
    - Add cleanup in panel's dispose() method
  - [x] 5.8 Ensure integration tests pass
    - Run ONLY the 4 tests written in 5.1
    - Verify navigation triggers AI correctly

**Acceptance Criteria:**
- The 4 tests written in 5.1 pass
- Hash correctly detects changes in Steps 1-4
- Auto-trigger fires only when appropriate
- Streaming response updates UI progressively

### Action Handlers Layer

#### Task Group 6: Action Handlers and Message Routing
**Dependencies:** Task Group 5

- [x] 6.0 Complete action handlers
  - [x] 6.1 Write 4 focused tests in `src/test/types/step5AgentDesign.test.ts`
    - Test handleRegenerateAgentProposal() clears state and re-fetches
    - Test Accept & Continue sets proposalAccepted=true and navigates to Step 6
    - Test "Let me adjust..." sets proposalAccepted=true and shows placeholder message
    - Test all buttons are disabled during isLoading state
  - [x] 6.2 Implement handleRegenerateProposal() method in Step5LogicHandler
    - Clear agentDesign state (preserve step4Hash)
    - Reset service conversation via service.resetConversation()
    - Re-fetch proposal via sendAgentDesignContextToClaude()
    - Follow handleRegenerateOutcomeSuggestions pattern
  - [x] 6.3 Implement handleAcceptProposal() method in Step5LogicHandler
    - Set proposalAccepted=true in agentDesign state
    - Navigation handled by tabbedPanel.ts message handler
    - Update webview content and sync state
  - [x] 6.4 Implement handleAdjustProposal() method in Step5LogicHandler
    - Set proposalAccepted=true in agentDesign state
    - Stay on Step 5 (do not navigate)
    - Show placeholder message: "Agent editing coming soon - click Accept to continue."
    - This is placeholder for Roadmap Item 19
  - [x] 6.5 Add message handlers in handleIdeationMessage() switch
    - Case 'regenerateAgentProposal': call handleRegenerateAgentProposal()
    - Case 'acceptAgentProposal': call handleAcceptAgentProposal()
    - Case 'adjustAgentProposal': call handleAdjustAgentProposal()
    - Case 'toggleOrchestrationReasoning': toggle expand/collapse state
  - [x] 6.6 Add getStep5Html() call in getStepContentHtml() in ideationStepHtml.ts
    - Add case for step 5 in the step content switch
    - Ensure navigation buttons render correctly for Step 5
  - [x] 6.7 Add JavaScript handlers in ideationScript.ts
    - Add regenerateAgentProposal() function
    - Add acceptAgentProposal() function
    - Add adjustAgentProposal() function
    - Add toggleOrchestrationReasoning() function
    - Follow existing handler patterns in getIdeationScript()
  - [x] 6.8 Ensure action handler tests pass
    - Run ONLY the 4 tests written in 6.1
    - Verify button states and navigation work correctly

**Acceptance Criteria:**
- The 4 tests written in 6.1 pass
- Regenerate clears state and triggers fresh AI request
- Accept navigates correctly to Step 6
- Adjust shows placeholder and stays on Step 5
- Buttons disable properly during loading

## Execution Order

Recommended implementation sequence:
1. State & Types Layer (Task Group 1) - Foundation for all other work
2. Service Layer (Task Group 2) - AI communication backbone
3. Prompt Layer (Task Group 3) - AI instructions for agent design
4. UI Components Layer (Task Group 4) - Visual display of proposals
5. Integration Layer (Task Group 5) - Connect navigation to AI trigger
6. Action Handlers Layer (Task Group 6) - User interactions

## Code Patterns Reference

**State Pattern:**
- Follow `OutcomeDefinitionState` in wizardPanel.ts
- Follow `createDefaultOutcomeDefinitionState()` pattern

**Service Pattern:**
- Follow `OutcomeDefinitionService` class in outcomeDefinitionService.ts
- Follow singleton pattern with getService/resetService functions

**HTML Pattern:**
- Follow `getStep4Html()` structure in ideationStepHtml.ts
- Follow assumption-card pattern for card layouts
- Follow module-chip styling for tag chips

**CSS Pattern:**
- Add styles to `getIdeationStyles()` in ideationStyles.ts
- Follow existing class naming conventions

**Script Pattern:**
- Add handlers to `getIdeationScript()` in ideationScript.ts
- Follow existing postMessage patterns

**Trigger Pattern:**
- Follow `triggerAutoSendForStep3()` pattern in tabbedPanel.ts
- Follow `sendOutcomeContextToClaude()` pattern

**Hash Pattern:**
- Follow `generateStep1Hash()` using djb2 algorithm in gapFillingService.ts
