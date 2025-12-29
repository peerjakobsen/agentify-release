# Raw Idea: Agent Design Proposal - Wizard Step 5

Agent Design Proposal — Create wizard step 5 where model proposes agent team:

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

**Display (Phase 1 — Before Accept):**
- Card grid: each agent shows name, role, tools as tags
- Orchestration badge: "Graph" / "Swarm" / "Workflow"
- "Why this pattern?" expandable with `orchestrationReasoning`
- Text-based flow summary (NOT visual diagram):
```
  Flow: Planner → Recommender → Output
```

**Actions:**
- "↻ Regenerate" — `handleRegenerateAgentProposal()`, clears and re-fetches
- "Accept & Continue" — sets `proposalAccepted: true`, proceeds to Step 6
- "Let me adjust..." — sets `proposalAccepted: true`, stays on step, shows edit UI (item 19)

**Tool Generation:**
- AI generates tool names based on systems from Step 1
- Format: `{system}_{operation}` (e.g., `sap_get_inventory`, `salesforce_query_accounts`)
- Editable in item 19 `M`
