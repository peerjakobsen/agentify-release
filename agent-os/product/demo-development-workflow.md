# Demo Development Workflow

## Overview

This document describes the end-to-end workflow for developing AI agent demos using Agentify, Kiro IDE, and Amazon Bedrock AgentCore. It covers how agents and shared tools are designed, generated, deployed, and executed.

## Workflow Stages

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   IDEATION   │ -> │  GENERATION  │ -> │  DEPLOYMENT  │ -> │   RUNTIME    │
│  (Agentify)  │    │    (Kiro)    │    │  (CDK + AC)  │    │ (AgentCore)  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

---

## Stage 1: Ideation (Agentify Extension)

The Agentify VS Code extension guides users through an 8-step wizard to design their agent workflow.

### Wizard Steps

| Step | Purpose | Output |
|------|---------|--------|
| 1 | Business objective & systems | Problem statement, integrations |
| 2 | AI gap-filling assumptions | Clarified requirements |
| 3 | Outcome definition | Success metrics, KPIs |
| 4 | Security & guardrails | Compliance rules, PII handling |
| 5 | Agent design proposal | Agent team, orchestration pattern |
| 6 | Mock data strategy | Tool definitions with sample I/O |
| 7 | Demo design | Personas, narrative, aha moments |
| 8 | Generate steering files | `.kiro/steering/*.md` |

### Steering Files Generated

```
.kiro/steering/
├── product.md                  # Business objective & outcomes
├── tech.md                     # Architecture & orchestration pattern
├── structure.md                # Code organization
├── customer-context.md         # Industry context
├── integration-landscape.md    # External systems & APIs
├── security-policies.md        # Compliance & guardrails
├── demo-strategy.md            # Demo narrative & personas
├── agentify-integration.md     # CLI contract & event schemas (critical)
└── roadmap.md                  # Implementation roadmap with Kiro prompts
```

### The Critical Contract: agentify-integration.md

This file defines the mandatory contract that all generated code must follow:

**CLI Contract:**
```bash
python agents/main.py \
  --prompt "user request" \
  --workflow-id "wf-a1b2c3d4" \
  --trace-id "80e1afed..."
```

**Environment Variables:**
- `AGENTIFY_TABLE_NAME` - DynamoDB table for event persistence
- `AGENTIFY_TABLE_REGION` - AWS region for DynamoDB

---

## Stage 2: Code Generation (Kiro IDE)

Kiro reads the steering files and generates all code following the defined contracts.

### What Kiro Generates

#### 1. Agent Orchestrator

```
agents/
└── main.py                     # Entry point following CLI contract
```

The orchestrator:
- Parses CLI arguments (`--prompt`, `--workflow-id`, `--trace-id`)
- Emits `graph_structure` event first
- Executes agents according to orchestration pattern
- Emits events to stdout and DynamoDB
- Returns `workflow_complete` or `workflow_error`

#### 2. Individual Agent Handlers

```
agents/
├── main.py                     # Orchestrator
├── analyzer.py                 # Agent 1 handler
├── responder.py                # Agent 2 handler
└── enricher.py                 # Agent 3 handler
```

Each agent handler:
- Uses Strands SDK (`from strands import Agent, tool`)
- Invokes shared tools via AgentCore MCP Gateway
- Emits `node_start`, `node_stream`, `node_stop` events
- Writes tool calls to DynamoDB for observability

#### 3. Shared Tools (Lambda Functions)

Kiro injects Lambda handlers into the **existing** CDK folder structure. Each handler directory contains its own mock data file, bundled with the Lambda at deploy time:

```
cdk/gateway/handlers/
├── zendesk_get_ticket/
│   ├── handler.py              # Lambda handler
│   ├── mock_data.json          # Mock data bundled with Lambda
│   └── requirements.txt        # Dependencies (if needed)
├── customer_lookup/
│   ├── handler.py
│   ├── mock_data.json
│   └── requirements.txt
├── sentiment_analysis/
│   ├── handler.py
│   ├── mock_data.json
│   └── requirements.txt
└── kb_search/
    ├── handler.py
    ├── mock_data.json
    └── requirements.txt
```

**Handler Pattern:**
```python
import json
import os

def lambda_handler(event, context):
    # Load mock data bundled with this Lambda
    mock_file = os.path.join(os.path.dirname(__file__), 'mock_data.json')
    with open(mock_file) as f:
        mock_data = json.load(f)

    # Parse input from event
    input_params = event

    # Return mock response
    return json.dumps({"status": "success", "data": mock_data})
```

**Important:** Mock data is bundled inside each handler directory, NOT in a shared `mocks/` folder. Lambda functions cannot access files outside their deployment package.

---

## Stage 3: Infrastructure Deployment

### CDK Stacks

The CDK infrastructure deploys three stacks:

#### NetworkingStack
- VPC with private subnets (no NAT Gateway for cost savings)
- VPC endpoints for AWS services (S3, DynamoDB, Lambda, Bedrock, etc.)
- Security groups for agent connectivity

#### ObservabilityStack
- DynamoDB table: `{project}-workflow-events`
- Schema: `workflow_id` (PK), `timestamp` (SK, milliseconds)
- TTL: 7 days automatic cleanup
- SSM parameters for service discovery

#### GatewayToolsStack
- Auto-discovers handlers in `cdk/gateway/handlers/*/`
- Creates Lambda function per tool: `{project}-gateway-{tool_name}`
- Grants Bedrock AgentCore invoke permissions
- Exports Lambda ARNs for gateway registration

### Auto-Discovery Pattern

The GatewayToolsStack scans for tool handlers:

```python
# cdk/stacks/gateway_tools.py
handlers_dir = Path('gateway/handlers')
for tool_dir in handlers_dir.iterdir():
    if tool_dir.is_dir() and (tool_dir / 'handler.py').exists():
        # Create Lambda function
        # Export ARN
```

This allows Kiro to simply add new handlers to the directory structure without modifying CDK code.

### Deployment Commands

```bash
# Deploy all infrastructure
./scripts/setup.sh

# Deploy specific agent
./scripts/setup.sh --agent analyzer

# Teardown everything
./scripts/destroy.sh
```

---

## Stage 4: AgentCore MCP Gateway

### Gateway Registration

After CDK deployment, the setup script registers tools with the AgentCore MCP Gateway:

```python
# resources/gateway/setup_gateway.py
1. Read Lambda ARNs from CDK CloudFormation outputs
2. Create/update MCP Gateway via AgentCore Starter Toolkit
3. Register each Lambda as a gateway target
4. Save gateway configuration
```

### Tool Invocation Flow

```
Agent (running in AgentCore Runtime)
    │
    ▼
AgentCore MCP Gateway
    │
    ▼
Lambda Function (shared tool)
    │
    ▼
Response back to Agent
```

All agents share the same gateway, enabling tool reuse across the workflow.

---

## Stage 5: Runtime Execution

### Local Development

```bash
python agents/main.py \
  --prompt "Customer complaint about delayed order" \
  --workflow-id "wf-a1b2c3d4" \
  --trace-id "80e1afed12345678901234567890abcd"
```

### Event Streaming (stdout)

Real-time JSON lines for Demo Viewer graph visualization:

```json
{"event_type": "graph_structure", "workflow_id": "wf-a1b2c3d4", "nodes": [...], "edges": [...]}
{"event_type": "node_start", "workflow_id": "wf-a1b2c3d4", "node_id": "analyzer", "timestamp": 1704067200000}
{"event_type": "node_stream", "workflow_id": "wf-a1b2c3d4", "node_id": "analyzer", "token": "Analyzing..."}
{"event_type": "node_stop", "workflow_id": "wf-a1b2c3d4", "node_id": "analyzer", "status": "completed"}
{"event_type": "workflow_complete", "workflow_id": "wf-a1b2c3d4", "result": {...}}
```

### DynamoDB Persistence

Detailed events for tool calls and historical replay:

| workflow_id | timestamp | event_type | data |
|-------------|-----------|------------|------|
| wf-a1b2c3d4 | 1704067200001 | agent_start | {agent: "analyzer"} |
| wf-a1b2c3d4 | 1704067200050 | tool_call | {tool: "zendesk_get_ticket", status: "started"} |
| wf-a1b2c3d4 | 1704067200150 | tool_call | {tool: "zendesk_get_ticket", status: "completed"} |
| wf-a1b2c3d4 | 1704067200500 | agent_end | {agent: "analyzer"} |

### Demo Viewer Integration

The Agentify Demo Viewer panel:
- Watches stdout for real-time graph animation
- Polls DynamoDB for tool call details
- Displays execution timeline and outcomes
- Shows success/failure status per node

---

## Orchestration Patterns

Agentify supports three orchestration patterns:

### Graph (LLM-driven)
- Dynamic path selection based on LLM decisions
- Conditional edges between agents
- Best for: approval gates, decision trees

### Workflow (Fixed DAG)
- Predetermined execution order
- Automatic parallelization where possible
- Best for: predictable pipelines

### Swarm (Autonomous)
- Agents hand off to each other dynamically
- Emergent behavior based on context
- Best for: complex problem-solving

---

## Project Structure (End State)

```
project/
├── .agentify/
│   ├── config.json             # Project configuration
│   └── wizard-state.json       # Ideation wizard state
├── .kiro/
│   └── steering/               # Steering files for Kiro
│       ├── product.md
│       ├── tech.md
│       ├── structure.md
│       ├── customer-context.md
│       ├── integration-landscape.md
│       ├── security-policies.md
│       ├── demo-strategy.md
│       ├── agentify-integration.md
│       └── roadmap.md
├── agents/                     # Kiro generated
│   ├── main.py                 # Local orchestrator
│   ├── analyzer.py             # Agent handlers (deploy to AgentCore)
│   ├── responder.py
│   ├── enricher.py
│   └── mock_data/              # Optional: mock data for agent-local tools
│       └── analyzer/
│           └── sentiment.json
├── cdk/
│   ├── app.py                  # CDK entry point (pre-existing)
│   ├── config.py               # Environment config (pre-existing)
│   ├── stacks/                 # Infrastructure stacks (pre-existing, DO NOT MODIFY)
│   │   ├── networking.py       # VPC, endpoints, SGs
│   │   ├── observability.py    # DynamoDB table
│   │   └── gateway_tools.py    # Lambda auto-discovery
│   └── gateway/
│       └── handlers/           # Shared tools (Kiro generated, injected here)
│           ├── zendesk_get_ticket/
│           │   ├── handler.py
│           │   ├── mock_data.json    # Bundled with Lambda
│           │   └── requirements.txt
│           ├── customer_lookup/
│           │   ├── handler.py
│           │   ├── mock_data.json
│           │   └── requirements.txt
│           └── sentiment_analysis/
│               ├── handler.py
│               ├── mock_data.json
│               └── requirements.txt
├── scripts/
│   ├── setup.sh                # Deploy infrastructure + agents
│   └── destroy.sh              # Teardown everything
└── .env                        # Environment variables
```

**Key distinction:**
- `cdk/stacks/` = Pre-existing infrastructure (DO NOT MODIFY)
- `cdk/gateway/handlers/` = Kiro injects Lambda handlers here (auto-discovered by CDK)

---

## Summary

| Component | Created By | Purpose |
|-----------|------------|---------|
| Steering files | Agentify | Define contracts and requirements |
| Agent orchestrator | Kiro | Entry point following CLI contract |
| Agent handlers | Kiro | Individual agent logic with Strands SDK |
| Shared tools | Kiro | Lambda handlers injected into CDK structure |
| CDK infrastructure | Bundled | VPC, DynamoDB, Lambda deployment |
| MCP Gateway | Setup script | Tool registration for agent access |
| Demo Viewer | Agentify | Real-time visualization and observability |

The workflow enables a seamless path from ideation to running demo, with Kiro generating all application code while the infrastructure remains stable and auto-discovers new components.
