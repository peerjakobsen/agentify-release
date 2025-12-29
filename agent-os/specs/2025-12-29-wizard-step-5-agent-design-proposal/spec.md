# Specification: Agent Design Proposal (Wizard Step 5)

## Goal
Implement wizard Step 5 where the AI proposes an agent team based on context from Steps 1-4, displaying agents in read-only cards with orchestration pattern and flow summary, allowing users to accept, regenerate, or signal intent to adjust.

## User Stories
- As a demo builder, I want the AI to propose an optimal agent team based on my business context so that I can quickly understand the recommended architecture without manual design work.
- As a demo builder, I want to see a clear visual representation of proposed agents and their relationships so that I can evaluate if the design meets my demo requirements.

## Specific Requirements

**AgentDesignState Structure**
- Add `agentDesign: AgentDesignState` property to the existing `IdeationState` interface
- State tracks: `proposedAgents[]`, `proposedOrchestration`, `proposedEdges[]`, `orchestrationReasoning`
- State tracks acceptance: `proposalAccepted`, `isLoading`, `error`
- Change detection fields: `step4Hash` (hash of Steps 1-4 inputs), `aiCalled` boolean
- Each `ProposedAgent` contains: `id`, `name`, `role`, `tools[]`
- Each `ProposedEdge` contains: `from`, `to`, optional `condition`

**Auto-Proposal Trigger Mechanism**
- Create `triggerAutoSendForStep5()` method following Step 3 pattern from `triggerAutoSendForStep3()`
- Generate hash from Steps 1-4 inputs: industry, systems, customSystems, confirmedAssumptions, primaryOutcome, successMetrics, dataSensitivity, complianceFrameworks, approvalGates
- If hash differs from stored `step4Hash`, reset agent design state and re-fetch proposal
- Only auto-send if `!aiCalled` and conversation is fresh
- Call trigger when navigating from Step 4 to Step 5 in `ideationNavigateForward()`

**AgentDesignService Implementation**
- Create new service at `src/services/agentDesignService.ts` following `OutcomeDefinitionService` pattern
- Singleton pattern with `getAgentDesignService()` and `resetAgentDesignService()` functions
- EventEmitter pattern: `onToken`, `onComplete`, `onError` events
- Methods: `loadSystemPrompt()`, `buildAgentDesignContextMessage()`, `sendMessage()`, `parseAgentProposalFromResponse()`
- System prompt file: `resources/prompts/agent-design-assistant.md`
- Exponential backoff retry logic for throttling (same as OutcomeDefinitionService)

**AI Response Parsing**
- Parse JSON block containing: `agents[]`, `orchestrationPattern`, `edges[]`, `reasoning`
- Each agent: `id` (lowercase, e.g., "planner"), `name` (display name), `role` (description), `tools[]`
- Tool format: lowercase snake_case `{system}_{operation}` (e.g., `sap_get_inventory`, `salesforce_query_accounts`)
- AI generates 2-4 tools per agent based on role and Step 1 systems
- Orchestration pattern: one of "Graph", "Swarm", "Workflow"

**Agent Card Display**
- Card grid layout for proposed agents using CSS grid
- Agent name as bold header text
- Subtle agent ID badge (e.g., "#planner") in muted style
- Role as lighter subtitle/description text beneath name
- Tools displayed as horizontal tag chips matching `module-chip` class from Step 2
- Card styling follows `assumption-card` pattern from Step 2

**Orchestration Display**
- Pattern badge chip showing "Graph", "Swarm", or "Workflow" - non-clickable
- Separate "Why this pattern?" text link below badge with expand chevron
- Chevron rotates on expand/collapse (triangular arrow right to down)
- Expandable section shows 2-3 sentence `orchestrationReasoning` text
- Use accordion pattern with CSS transitions for smooth expand/collapse

**Flow Summary Display**
- Single-line text in monospace font showing agent relationships
- Uses agent IDs (not full names) for brevity
- Contained in light border box
- Arrow notation: `->` for sequential, `[a | b]` for parallel, `?` suffix for conditional
- Examples: `planner -> recommender -> output`, `planner -> [analyzer | fetcher] -> output`, `planner -> reviewer? -> output`

**Action Handlers**
- "Regenerate" button (`handleRegenerateAgentProposal()`): clears state, resets service conversation, re-fetches from AI
- "Accept & Continue" button: sets `proposalAccepted: true`, navigates to Step 6
- "Let me adjust..." button: sets `proposalAccepted: true`, stays on Step 5, shows placeholder message "Agent editing coming soon - click Accept to continue."
- All buttons disabled during `isLoading` state

## Visual Design

No visual assets provided - design follows existing wizard step patterns from Steps 2, 3, and 4.

## Existing Code to Leverage

**OutcomeDefinitionService (`src/services/outcomeDefinitionService.ts`)**
- Singleton pattern with EventEmitter for streaming
- System prompt loading from resources folder
- JSON parsing from Claude responses with multiple JSON block handling
- Exponential backoff retry logic for throttling errors
- Error handling patterns for Bedrock API errors

**triggerAutoSendForStep3 pattern (`src/panels/tabbedPanel.ts` lines 906-937)**
- Hash comparison for change detection
- State reset logic when inputs change
- Conditional AI triggering based on fresh entry

**getStep2Html assumption cards (`src/panels/tabbedPanel.ts` lines 2464-2590)**
- Card grid layout pattern
- Module chip styling for tags
- Accept/regenerate button patterns
- Loading indicator with typing animation

**getStep4Html (`src/panels/tabbedPanel.ts` lines 2817-2932)**
- Form section layout patterns
- Helper text styling
- AI-suggested badge pattern

**CSS Patterns**
- `.assumption-card`, `.module-chip` classes for card and chip styling
- `.regenerate-btn` for secondary action buttons
- `.outcome-loading` with typing indicator for loading state
- `.accepted-banner` for success state display

## Out of Scope
- Editing individual agents after acceptance (Item 19)
- Editing agent name, role, or tools inline (Item 19)
- Orchestration pattern change dropdown selector (Item 19)
- Edge editing table with condition configuration (Item 19)
- Add/remove agents functionality (Item 19)
- "Validate Design" AI re-check button (Item 19)
- Visual graph diagram rendering (Item 25)
- Drag-and-drop agent reordering (Item 19)
- Tool validation against actual system APIs (future item)
- Step 6 integration beyond navigation (Item 20)
