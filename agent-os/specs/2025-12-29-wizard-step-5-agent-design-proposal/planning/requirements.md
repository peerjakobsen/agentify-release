# Spec Requirements: Agent Design Proposal (Wizard Step 5)

## Initial Description

Agent Design Proposal - Create wizard step 5 where model proposes agent team:

**State Structure:**
Add `agentDesign: AgentDesignState` to IdeationState following existing patterns:
```typescript
interface AgentDesignState {
  // AI Proposal
  proposedAgents: ProposedAgent[];
  proposedOrchestration: OrchestrationPattern;
  proposedEdges: ProposedEdge[];
  orchestrationReasoning: string;

  // Accept/Edit State
  proposalAccepted: boolean;
  isLoading: boolean;
  error?: string;

  // Change Detection
  step4Hash?: string;
  aiCalled: boolean;
}

interface ProposedAgent {
  id: string;
  name: string;
  role: string;
  tools: string[];  // AI-generated from Step 1 systems
}

interface ProposedEdge {
  from: string;
  to: string;
  condition?: string;  // For graph pattern
}
```

**Auto-Proposal on Step Entry:**
- Trigger: `triggerAutoSendForStep5()` following Step 3 pattern
- Change detection: Hash of Steps 1-4 inputs
- Send context to Bedrock, request JSON-structured agent team
- Parse response, populate `proposed*` fields

**Display (Phase 1 - Before Accept):**
- Card grid: each agent shows name, role, tools as tags
- Orchestration badge: "Graph" / "Swarm" / "Workflow"
- "Why this pattern?" expandable with `orchestrationReasoning`
- Text-based flow summary (NOT visual diagram)

**Actions:**
- "Regenerate" - `handleRegenerateAgentProposal()`, clears and re-fetches
- "Accept & Continue" - sets `proposalAccepted: true`, proceeds to Step 6
- "Let me adjust..." - sets `proposalAccepted: true`, stays on step, shows edit UI (item 19)

**Tool Generation:**
- AI generates tool names based on systems from Step 1
- Format: `{system}_{operation}` (e.g., `sap_get_inventory`, `salesforce_query_accounts`)
- Editable in item 19

## Requirements Discussion

### First Round Questions

**Q1:** I assume the agent cards in Phase 1 should follow a consistent pattern with agent name as header, role as subtitle text, and tools as horizontal tag chips (similar to module chips in Step 2). Is this correct, or would you prefer a different visual layout?

**Answer:** Confirmed with additions:
- Agent name as card header (bold)
- Role as subtitle/description text (lighter weight)
- Tools as horizontal tag chips (match module chips styling from Step 2)
- Show subtle agent ID badge (e.g., #planner) for reference in flow summary

**Q2:** The spec mentions showing an orchestration badge with an expandable "Why this pattern?" section. Should the badge be clickable to expand reasoning, or should there be a separate "Why?" text link?

**Answer:**
- Badge shows pattern name (Graph/Swarm/Workflow) as styled chip
- Badge is NOT clickable
- Separate "Why this pattern?" text link below badge with expand chevron
- Click expands to show 2-3 sentence reasoning
- Chevron rotates on expand (triangular arrow pointing right to down)
- Rationale: Better accessibility, clearer affordance

**Q3:** The spec shows a simple flow format like `Flow: Planner -> Recommender -> Output`. Is this visual simplicity correct for MVP, or do you want any visual distinction?

**Answer:**
- Simple single line, monospace font
- Agent IDs (not full names) for brevity
- Light border box around flow summary
- Arrow notation for sequential, brackets with pipe for parallel, question mark suffix for conditional
- Examples:
  - `Flow: planner -> recommender -> output`
  - `Flow: planner -> [analyzer | fetcher] -> output`
  - `Flow: planner -> reviewer? -> output`

**Q4:** Should the change detection hash include just Step 1 inputs, Steps 1-3, or Steps 1-4?

**Answer:** Steps 1-4 (all previous steps). Hash includes: industry, systems, confirmedAssumptions, primaryOutcome, metrics, dataSensitivity, complianceFrameworks, approvalGates

**Q5:** Should Step 5 use a new dedicated `AgentDesignService`, extend the existing `OutcomeDefinitionService`, or reuse `BedrockConversationService` directly?

**Answer:** New `AgentDesignService` in `src/services/agentDesignService.ts`. Follows established pattern (GapFillingService, OutcomeDefinitionService). Responsibilities: build context, send to Bedrock, parse JSON response.

**Q6:** The spec mentions tool format `{system}_{operation}`. Should we have a predefined list of common operations per system, or let the AI generate freely?

**Answer:**
- Let AI generate freely - no predefined operation list
- Lowercase snake_case format: `{system}_{operation}`
- Examples: `sap_get_inventory`, `salesforce_query_accounts`
- AI generates 2-4 tools per agent based on role
- No validation needed

**Q7:** Based on the roadmap, Item 19 (Agent Design Refinement) is separate. Should this spec explicitly exclude editing features?

**Answer:** Yes, explicitly out of scope for Item 18 (handled by Item 19):
- Editing agents after acceptance
- Editing agent name/role/tools
- Orchestration pattern dropdown
- Edge editing table
- Add/remove agents
- "Validate Design" AI button
- Visual graph diagram (Item 25)

### Existing Code to Reference

**Similar Features Identified:**
- Feature: Step 2 AI Gap-Filling - Path: `src/panels/tabbedPanel.ts` (lines 560-1236)
- Feature: Step 3 Outcome Definition - Path: `src/panels/tabbedPanel.ts` (lines 770-1127)
- Feature: Step 4 Security & Guardrails - Path: `src/panels/tabbedPanel.ts` (lines 940-1050, 2817-2932)
- Components to potentially reuse: Assumption cards styling, module chips, regenerate button pattern, loading indicators
- Service pattern to reference: `src/services/outcomeDefinitionService.ts`
- Prompt pattern to reference: `resources/prompts/outcome-definition-assistant.md`

### Follow-up Questions

No follow-up questions needed - all requirements clearly specified.

## Visual Assets

### Files Provided:

No visual assets provided.

### Visual Insights:

N/A - No visual files to analyze.

## Requirements Summary

### Functional Requirements

**Core Functionality:**
- Auto-trigger AI proposal when entering Step 5 from Step 4
- Change detection: regenerate proposal if Steps 1-4 inputs changed since last visit
- Display AI-proposed agent team in read-only card format
- Display orchestration pattern badge with expandable reasoning
- Display text-based flow summary showing agent relationships
- Regenerate button to get fresh AI proposal
- "Accept & Continue" button to proceed to Step 6
- "Let me adjust..." button to stay on step (placeholder for Item 19)

**Agent Card Display:**
- Agent name as bold header
- Subtle agent ID badge (e.g., #planner)
- Role as lighter subtitle text
- Tools as horizontal tag chips (matching Step 2 module chip styling)

**Orchestration Display:**
- Pattern badge chip (Graph/Swarm/Workflow)
- Non-clickable badge
- Separate expandable "Why this pattern?" section
- Chevron indicator for expand/collapse state
- 2-3 sentence reasoning text

**Flow Summary:**
- Single line, monospace font
- Uses agent IDs for brevity
- Light border box container
- Notation: `->` sequential, `[a | b]` parallel, `?` conditional

**State Management:**
- Add `agentDesign: AgentDesignState` to IdeationState
- Track: proposedAgents, proposedOrchestration, proposedEdges, orchestrationReasoning
- Track: proposalAccepted, isLoading, error, step4Hash, aiCalled

**New Service:**
- Create `AgentDesignService` in `src/services/agentDesignService.ts`
- Follow established singleton pattern with EventEmitter
- Methods: buildContextMessage, sendMessage, parseAgentProposalFromResponse
- System prompt: `resources/prompts/agent-design-assistant.md`

### Reusability Opportunities

- Assumption card styling from Step 2 (`assumption-card` class)
- Module chip styling from Step 2 (`module-chip` class)
- Loading indicator pattern from Step 3 (`outcome-loading` class)
- Regenerate button styling from Steps 2/3 (`regenerate-btn` class)
- Service architecture pattern from `OutcomeDefinitionService`
- Hash generation pattern from `generateStep1Hash()` / `generateStep2AssumptionsHash()`
- Auto-send trigger pattern from `triggerAutoSendForStep3()`

### Scope Boundaries

**In Scope:**
- Read-only agent cards with name, ID badge, role, tools
- Read-only orchestration badge with expandable reasoning
- Read-only text-based flow summary
- Regenerate button functionality
- "Accept & Continue" button (navigates to Step 6)
- "Let me adjust..." button (sets proposalAccepted: true, stays on step)
- Placeholder message for "Let me adjust...": "Agent editing coming soon - click Accept to continue."
- New AgentDesignService following established patterns
- New system prompt for agent design
- Change detection hash for Steps 1-4
- Auto-proposal on step entry

**Out of Scope:**
- Editing individual agents after acceptance (Item 19)
- Editing agent name/role/tools (Item 19)
- Orchestration pattern change dropdown (Item 19)
- Edge editing table (Item 19)
- Add/remove agents (Item 19)
- "Validate Design" AI button (Item 19)
- Visual graph diagram (Item 25)
- Detailed edge condition configuration (Item 19/20)

### Technical Considerations

**Integration Points:**
- tabbedPanel.ts: Add Step 5 HTML generation, message handlers, state management
- IdeationState interface: Add agentDesign property
- Navigation: Add triggerAutoSendForStep5() call when entering from Step 4
- WIZARD_STEPS constant: Already includes Step 5 "Agent Design"

**Hash Generation:**
- Include from IdeationState: industry, systems, customSystems
- Include from aiGapFillingState: confirmedAssumptions
- Include from outcome: primaryOutcome, successMetrics
- Include from securityGuardrails: dataSensitivity, complianceFrameworks, approvalGates

**AI Response Parsing:**
- Expect JSON with: agents array, orchestrationPattern, edges array, reasoning string
- Each agent: id, name, role, tools array
- Each edge: from, to, optional condition
- Tool format: lowercase snake_case `{system}_{operation}`
- AI generates 2-4 tools per agent

**Similar Code Patterns to Follow:**
- Step 3 Phase 1/Phase 2 pattern (suggestion card -> editable form)
- OutcomeDefinitionService structure for AgentDesignService
- getStep3Html() structure for getStep5Html()
- handleOutcomeStreamingComplete() for response parsing
