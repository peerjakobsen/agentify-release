# Product Roadmap

## Phase 1: Foundation (MVP)

1. [x] DynamoDB Observability Table — Create `agentify-workflow-events` DynamoDB table with workflow_id partition key, timestamp sort key, event_type, agent_name, payload, and TTL configuration `S`

2. [x] Agentify Extension Shell — Create single Kiro IDE extension with shared services (AWS clients, config, types) and registration for two webview panels: Demo Viewer (runtime) and Ideation Wizard (design-time) `S`

3. [x] AWS Credential Chain Integration — Use AWS SDK's default credential provider chain to automatically consume credentials from shared AWS config files (~/.aws/credentials, ~/.aws/config), supporting IAM credentials, IAM Identity Center (SSO), and assumed roles configured via AWS CLI or AWS Toolkit; add project-level region configuration in .agentify/config.json for DynamoDB and Bedrock API calls `S`

4. [ ] Project Initialization Command — Add "Agentify: Initialize Project" command that: (1) checks AWS credentials via default credential chain, (2) validates DynamoDB table exists using tableValidator service, (3) if table missing, prompts user to deploy using bundled `infrastructure/dynamodb-table.yaml` template via CloudFormation SDK, (4) waits for stack CREATE_COMPLETE, (5) generates `.agentify/config.json` with table name, region, and stack name, (6) creates `.kiro/steering/agentify-integration.md` steering file. The CloudFormation template from spec #1 is packaged with the extension for automated deployment. `M`

5. [ ] Workflow Input Panel — Build input panel UI with prompt text input, Run Workflow button, workflow ID display, and trigger configuration (local subprocess for dev, AgentCore for production) `S`

6. [ ] Execution Log Panel — Create chronological log panel displaying events from DynamoDB with timestamps, event types, agent names, and expandable payload details `M`

7. [ ] Outcome Panel — Build outcome display showing final workflow result, success/failure status, and execution metrics summary `S`

8. [ ] DynamoDB Polling Engine — Implement 500ms polling interval for DynamoDB events with graceful error handling, connection retry, and cleanup on panel close `S`

9. [ ] Python Observability Package — Build `agentify_observability` package with init_workflow, @agent_span, @tool_call, @handoff, and @workflow_outcome decorators that write events to DynamoDB via environment variables `M`

10. [ ] Workflow Trigger Service — Build trigger service for local subprocess mode: spawn `agents/main.py` with --prompt and --workflow-id args, pass AGENTIFY_* env vars, read trigger config from `.agentify/config.json` `S`

11. [ ] stdout Event Streaming (Local Mode) — Parse real-time JSON events from subprocess stdout including graph_structure, node_start, node_stream, node_stop, and workflow_complete; merge with DynamoDB polling for tool call events `M`

12. [ ] Merged Event Stream Service — Combine stdout events (real-time graph updates in local mode) with DynamoDB events (tool calls, persistent history) into unified event stream for Demo Viewer panels `S`

## Phase 2: AI-Assisted Ideation

13. [ ] Ideation Wizard Panel — Add Ideation Wizard webview panel to the Agentify extension with multi-step wizard UI, leveraging shared AWS services and configuration `S`

14. [ ] Account Context Ingestion UI — Build first wizard step with account plan file upload, value map selection dropdown, industry vertical picker, and system checkboxes (SAP, Salesforce, etc.) `M`

15. [ ] Claude Bedrock Integration — Implement Amazon Bedrock client for Claude API calls with conversation context management and streaming response handling `M`

16. [ ] AI Gap-Filling Conversation — Create conversational UI where Claude proposes industry-typical configurations based on selected systems and industry, with user refinement capability `L`

17. [ ] Outcome Definition Step — Build wizard step for defining measurable business outcomes, success criteria, and KPIs that map to selected value map `S`

18. [ ] Security & Guardrails Step — Build wizard step for compliance considerations, human approval gate placement, and data sensitivity classification `S`

19. [ ] Agent Design Phase — Create wizard step where Claude proposes agent team composition with roles, responsibilities, and recommends optimal Strands orchestration pattern (Graph for conditional routing, Swarm for autonomous collaboration, Workflow for deterministic pipelines) based on the value map complexity and coordination requirements `L`

20. [ ] Agent Design Refinement — Add UI for user to accept, modify, or reject proposed agents and adjust orchestration flow `M`

21. [ ] Orchestration Pattern Selection — Interactive UI for selecting between Strands Graph, Swarm, or Workflow patterns with AI-assisted recommendation explaining tradeoffs for the specific value map scenario, visual preview of how agents will coordinate under each pattern, and pattern-specific configuration (Graph: edge conditions, Swarm: handoff rules, Workflow: task dependencies) `M`

22. [ ] Mock Data Strategy — Implement AI-generated mock data shapes based on industry context and selected systems for realistic demo scenarios `M`

## Phase 3: Visual Polish

23. [ ] Agent Graph Visualization — Add React Flow visualization to Demo Viewer with custom node components showing agent status (pending/running/completed/failed), animated edges during data flow, auto-layout via dagre/elkjs, and pattern-specific layouts: Graph (DAG with conditional edges), Swarm (peer-to-peer), Workflow (parallel execution lanes) `L`

24. [ ] Graph Animation — Implement real-time graph updates from stdout events in local mode with smooth transitions as agents activate, complete, and hand off work; fall back to DynamoDB polling in AgentCore mode `M`

25. [ ] Enhanced Log Formatting — Add collapsible sections, syntax highlighting for payloads, and filtering by agent name or event type `M`

26. [ ] Demo Design Phase — Create wizard step for capturing key "aha moments", demo persona definition, and narrative flow sequencing `M`

27. [ ] Wizard State Persistence — Implement workspace storage for wizard progress so users can resume incomplete ideation sessions `S`

## Phase 4: Kiro Integration

28. [ ] Core Steering Files Generation — Generate `product.md` (value map context), `tech.md` (Strands SDK, Python, selected orchestration pattern), `structure.md` (standard agentic project layout) from wizard context `M`

29. [ ] Context Steering Files Generation — Generate `customer-context.md` (industry, strategic priorities), `integration-landscape.md` (systems, data sources, mock definitions), `security-policies.md` (compliance, approval gates), `demo-strategy.md` (key moments, narrative, mock data approach) from ideation outputs `M`

30. [ ] MCP Configuration Output — Create MCP server configuration JSON from agent design and system integrations defined in wizard `M`

31. [ ] Hooks Generation — Generate Kiro hooks configuration for automatic decorator injection into generated agent code `M`

32. [ ] Kiro Spec Trigger — Implement seamless handoff that opens Kiro spec mode with generated artifacts pre-loaded `S`

33. [ ] Decorator Auto-Injection — Create Kiro hook that automatically adds observability decorators to all generated agent functions `M`

## Phase 5: Templates and Patterns

34. [ ] Industry Template Framework — Build template system for storing and loading pre-built agent patterns with metadata `M`

35. [ ] Retail Industry Template — Create agent patterns for common retail scenarios: inventory optimization, customer service, demand forecasting `M`

36. [ ] FSI Industry Template — Create agent patterns for financial services: fraud detection, customer onboarding, risk assessment `M`

37. [ ] Healthcare Industry Template — Create agent patterns for healthcare: patient scheduling, claims processing, clinical decision support `M`

38. [ ] Manufacturing Industry Template — Create agent patterns for manufacturing: predictive maintenance, quality control, supply chain optimization `M`

39. [ ] Value Map Template Framework — Build storage and loading system for value map templates with metadata schema including recommended orchestration pattern `M`

40. [ ] Common Value Map Templates — Create templates for common value maps, each with suggested agent teams and recommended Strands pattern: Cost Reduction (typically Workflow for deterministic optimization pipeline), Revenue Growth (typically Graph for conditional customer journey routing), Operational Efficiency (typically Workflow for parallel automation tasks), Customer Experience (typically Swarm for collaborative issue resolution), Risk Mitigation (typically Graph for decision trees with approval gates) `L`

41. [ ] Demo Script Generator — Create AI-powered talking points generator that produces demo narrative aligned with value map and agent design `M`

## Phase 6: Enterprise Features

42. [ ] Demo Library Storage — Implement cloud storage for saving completed demos with metadata, tags, and search capability `L`

43. [ ] Demo Sharing — Add team sharing functionality with permissions and version tracking for collaborative demo development `M`

44. [ ] Demo Analytics — Build tracking for demo usage metrics: runs, customer reactions, conversion correlation `L`

45. [ ] Multi-Region Deployment — Add region selector and deployment automation for AgentCore Runtime in us-east-1, us-west-2, eu-west-1 `M`

46. [ ] Demo Export — Create export functionality for packaging demos as standalone artifacts for offline or customer-site execution `M`

---

## Notes

- Order items by technical dependencies and product architecture
- Each item should represent an end-to-end functional and testable feature
- Single Agentify extension with two webview panels: Demo Viewer (runtime visualization) and Ideation Wizard (design-time workflow)
- Dual-mode event architecture:
  - **Local mode:** Real-time stdout streaming (graph events) + DynamoDB polling (tool calls)
  - **AgentCore mode:** DynamoDB polling only (all events)
- Project config stored in `.agentify/config.json`, Kiro steering in `.kiro/steering/agentify-integration.md`
- "Agentify: Initialize Project" command must run before using the extension
- CloudFormation templates in `infrastructure/` are bundled with the extension for automated deployment
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
