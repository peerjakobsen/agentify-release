# Steering Document Prompts

## Feature Description

Create system prompts for transforming wizard state into Kiro steering markdown documents.

## Prompt File Location

```
resources/prompts/steering/
├── product-steering.prompt.md
├── tech-steering.prompt.md
├── structure-steering.prompt.md
├── customer-context-steering.prompt.md
├── integration-landscape-steering.prompt.md
├── security-policies-steering.prompt.md
├── demo-strategy-steering.prompt.md
└── agentify-integration-steering.prompt.md
```

## Each Prompt Defines

- Expected markdown structure and sections for that document
- What the document is for (Kiro steering context)
- Formatting guidelines and examples
- JSON input schema it expects from wizard state

## State Mapping Per Document

| Document | Wizard State Sections Used |
|----------|---------------------------|
| `product.md` | businessObjective, industry, outcome (primaryOutcome, successMetrics, stakeholders) |
| `tech.md` | agentDesign (agents, orchestration, edges), securityGuardrails (for policy mapping) |
| `structure.md` | agentDesign.confirmedAgents (for folder names), mockData.mockDefinitions (for tools) |
| `customer-context.md` | industry, systems, aiGapFillingState.confirmedAssumptions |
| `integration-landscape.md` | systems, agentDesign (for shared tools analysis), mockData |
| `security-policies.md` | securityGuardrails (sensitivity, frameworks, approvalGates) |
| `demo-strategy.md` | demoStrategy (ahaMoments, persona, narrativeScenes) |
| `agentify-integration.md` | agentDesign.confirmedAgents (agent IDs), orchestration pattern |

## AgentCore Features Guidance (in tech-steering.prompt.md)

- Runtime: Deploy agents via AgentCore CLI (serverless, session isolation)
- Gateway: Register shared Lambda tools (auto-converts to MCP-compatible)
- Policy: Map Step 4 guardrails to Cedar policies (approval gates → boundaries)
- Observability: Agentify DynamoDB events (powers Demo Viewer panel)
- Memory/Identity/Evaluations: Optional, note when useful

## Shared Tools Analysis (in integration-landscape-steering.prompt.md)

- Identify duplicate tools across agents
- Flag shared tools for Lambda deployment + Gateway registration
- Keep per-agent tools inline with agent code
- Output as markdown tables with "Used By" column

## agentify-integration.md Content

- Event emission contract (DynamoDB schema for workflow events)
- Agent IDs for OpenTelemetry trace correlation
- CLI invocation pattern for Demo Viewer
- Required decorators/instrumentation patterns
