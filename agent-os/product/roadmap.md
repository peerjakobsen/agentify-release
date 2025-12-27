# Product Roadmap

## Phase 1: Foundation (MVP)

1. [ ] DynamoDB Observability Table — Create `demo-workflow-events` DynamoDB table with workflow_id partition key, timestamp sort key, event_type, agent_name, payload, and TTL configuration `S`

2. [ ] AWS Connection Integration — Integrate with Kiro's built-in AWS Explorer for credentials (IAM Identity Center, profiles, roles) and region selection; read active connection context for DynamoDB and Bedrock API calls `S`

3. [ ] Python Decorator Package — Build `demo-observability` package with @agent_span, @tool_call, @handoff, and @workflow_outcome decorators that write events to DynamoDB `M`

4. [ ] Demo Viewer Extension Shell — Create Kiro IDE extension scaffolding with React webview panel registration and basic extension activation `S`

5. [ ] Workflow Input Panel — Build input panel UI with prompt text input, Run Workflow button, workflow ID display, and AgentCore Runtime endpoint configuration `S`

6. [ ] Execution Log Panel — Create chronological log panel displaying events from DynamoDB with timestamps, event types, agent names, and expandable payload details `M`

7. [ ] Outcome Panel — Build outcome display showing final workflow result, success/failure status, and execution metrics summary `S`

8. [ ] DynamoDB Polling Engine — Implement 500ms polling interval for DynamoDB events with graceful error handling, connection retry, and cleanup on panel close `S`

9. [ ] Strands Multi-Agent Runtime Client — Build API client supporting Strands SDK multi-agent patterns (Graph, Swarm, Workflow) with pattern selection, workflow triggering, and response handling `M`

## Phase 2: AI-Assisted Ideation

10. [ ] Ideation Wizard Extension Shell — Create second Kiro IDE extension for the Ideation Wizard with multi-step wizard webview panel `S`

11. [ ] Account Context Ingestion UI — Build first wizard step with account plan file upload, value map selection dropdown, industry vertical picker, and system checkboxes (SAP, Salesforce, etc.) `M`

12. [ ] Claude Bedrock Integration — Implement Amazon Bedrock client for Claude API calls with conversation context management and streaming response handling `M`

13. [ ] AI Gap-Filling Conversation — Create conversational UI where Claude proposes industry-typical configurations based on selected systems and industry, with user refinement capability `L`

14. [ ] Outcome Definition Step — Build wizard step for defining measurable business outcomes, success criteria, and KPIs that map to selected value map `S`

15. [ ] Security & Guardrails Step — Build wizard step for compliance considerations, human approval gate placement, and data sensitivity classification `S`

16. [ ] Agent Design Phase — Create wizard step where Claude proposes agent team composition with roles, responsibilities, and recommends optimal Strands orchestration pattern (Graph for conditional routing, Swarm for autonomous collaboration, Workflow for deterministic pipelines) based on the value map complexity and coordination requirements `L`

17. [ ] Agent Design Refinement — Add UI for user to accept, modify, or reject proposed agents and adjust orchestration flow `M`

18. [ ] Orchestration Pattern Selection — Interactive UI for selecting between Strands Graph, Swarm, or Workflow patterns with AI-assisted recommendation explaining tradeoffs for the specific value map scenario, visual preview of how agents will coordinate under each pattern, and pattern-specific configuration (Graph: edge conditions, Swarm: handoff rules, Workflow: task dependencies) `M`

19. [ ] Mock Data Strategy — Implement AI-generated mock data shapes based on industry context and selected systems for realistic demo scenarios `M`

## Phase 3: Visual Polish

20. [ ] Agent Graph Visualization — Add D3.js or React Flow visualization to Demo Viewer that adapts to the selected Strands orchestration pattern: Graph pattern shows DAG with conditional edges and decision nodes highlighted, Swarm pattern shows peer-to-peer connections with dynamic handoff animations, Workflow pattern shows task dependency DAG with parallel execution lanes. Live status coloring for active/complete/waiting states `L`

21. [ ] Graph Animation — Implement real-time graph updates with smooth transitions as agents activate, complete, and hand off work `M`

22. [ ] Enhanced Log Formatting — Add collapsible sections, syntax highlighting for payloads, and filtering by agent name or event type `M`

23. [ ] Demo Design Phase — Create wizard step for capturing key "aha moments", demo persona definition, and narrative flow sequencing `M`

24. [ ] Wizard State Persistence — Implement workspace storage for wizard progress so users can resume incomplete ideation sessions `S`

## Phase 4: Kiro Integration

25. [ ] Core Steering Files Generation — Generate `product.md` (value map context), `tech.md` (Strands SDK, Python, selected orchestration pattern), `structure.md` (standard agentic project layout) from wizard context `M`

26. [ ] Context Steering Files Generation — Generate `customer-context.md` (industry, strategic priorities), `integration-landscape.md` (systems, data sources, mock definitions), `security-policies.md` (compliance, approval gates), `demo-strategy.md` (key moments, narrative, mock data approach) from ideation outputs `M`

27. [ ] MCP Configuration Output — Create MCP server configuration JSON from agent design and system integrations defined in wizard `M`

28. [ ] Hooks Generation — Generate Kiro hooks configuration for automatic decorator injection into generated agent code `M`

29. [ ] Kiro Spec Trigger — Implement seamless handoff that opens Kiro spec mode with generated artifacts pre-loaded `S`

30. [ ] Decorator Auto-Injection — Create Kiro hook that automatically adds observability decorators to all generated agent functions `M`

## Phase 5: Templates and Patterns

31. [ ] Industry Template Framework — Build template system for storing and loading pre-built agent patterns with metadata `M`

32. [ ] Retail Industry Template — Create agent patterns for common retail scenarios: inventory optimization, customer service, demand forecasting `M`

33. [ ] FSI Industry Template — Create agent patterns for financial services: fraud detection, customer onboarding, risk assessment `M`

34. [ ] Healthcare Industry Template — Create agent patterns for healthcare: patient scheduling, claims processing, clinical decision support `M`

35. [ ] Manufacturing Industry Template — Create agent patterns for manufacturing: predictive maintenance, quality control, supply chain optimization `M`

36. [ ] Value Map Template Framework — Build storage and loading system for value map templates with metadata schema including recommended orchestration pattern `M`

37. [ ] Common Value Map Templates — Create templates for common value maps, each with suggested agent teams and recommended Strands pattern: Cost Reduction (typically Workflow for deterministic optimization pipeline), Revenue Growth (typically Graph for conditional customer journey routing), Operational Efficiency (typically Workflow for parallel automation tasks), Customer Experience (typically Swarm for collaborative issue resolution), Risk Mitigation (typically Graph for decision trees with approval gates) `L`

38. [ ] Demo Script Generator — Create AI-powered talking points generator that produces demo narrative aligned with value map and agent design `M`

## Phase 6: Enterprise Features

39. [ ] Demo Library Storage — Implement cloud storage for saving completed demos with metadata, tags, and search capability `L`

40. [ ] Demo Sharing — Add team sharing functionality with permissions and version tracking for collaborative demo development `M`

41. [ ] Demo Analytics — Build tracking for demo usage metrics: runs, customer reactions, conversion correlation `L`

42. [ ] Multi-Region Deployment — Add region selector and deployment automation for AgentCore Runtime in us-east-1, us-west-2, eu-west-1 `M`

43. [ ] Demo Export — Create export functionality for packaging demos as standalone artifacts for offline or customer-site execution `M`

---

## Notes

- Order items by technical dependencies and product architecture
- Each item should represent an end-to-end functional and testable feature
- Phase 1 establishes core infrastructure before building features that depend on it
- Phase 2 AI features require Bedrock integration from earlier items
- Phase 4 Kiro integration depends on wizard outputs from Phase 2-3
- Phase 5-6 are enhancement phases that can be prioritized based on customer feedback

## Technical References

- Strands Agents SDK: https://strandsagents.com/latest/
- Multi-agent patterns documentation: https://strandsagents.com/latest/documentation/docs/user-guide/concepts/multi-agent/multi-agent-patterns/
- Three orchestration patterns supported:
  - **Graph**: Deterministic structure with LLM-driven path selection, supports cycles, conditional edges
  - **Swarm**: Autonomous agent collaboration with emergent handoffs, supports cycles, shared context
  - **Workflow**: Fixed DAG execution with automatic parallelization, no cycles, task dependencies
