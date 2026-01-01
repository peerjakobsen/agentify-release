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

### IAM Role & Policy Creation

When deploying an agent with `./scripts/setup.sh --agent <name>`:

1. **AgentCore SDK creates execution role** (during `agentcore deploy`):
   - Role name: `AmazonBedrockAgentCoreSDKRuntime-{region}-{hash}`
   - Trust policy: Allows `bedrock-agentcore.amazonaws.com` to assume it
   - Managed policies: `AmazonBedrockAgentCoreRuntimePolicy`, CloudWatch Logs

2. **setup.sh adds Agentify-specific inline policy** (after deploy completes):
   - Policy name: `AgentifyAccess-{agent_name}`
   - Grants `dynamodb:PutItem`, `dynamodb:Query` on workflow-events table
   - Grants `ssm:GetParameter` on `/agentify/*` parameters

```bash
# setup.sh extracts role from .bedrock_agentcore.yaml and adds:
aws iam put-role-policy \
    --role-name "AmazonBedrockAgentCoreSDKRuntime-us-east-1-xyz123" \
    --policy-name "AgentifyAccess-analyzer" \
    --policy-document '{
        "Statement": [
            {"Action": ["dynamodb:PutItem", "dynamodb:Query"], "Resource": ["arn:aws:dynamodb:...:table/agentify-workflow-events"]},
            {"Action": ["ssm:GetParameter"], "Resource": ["arn:aws:ssm:...:parameter/agentify/*"]}
        ]
    }'
```

**Important:** Always deploy agents via `./scripts/setup.sh --agent <name>` to ensure IAM permissions are applied. Manual deployment via `uv run agentcore deploy` will skip the Agentify policy.

---

## Stage 4: AgentCore MCP Gateway

### Gateway Registration

After CDK deployment, the setup script registers tools with the AgentCore MCP Gateway:

```python
# resources/gateway/setup_gateway.py
1. Read Lambda ARNs from CDK CloudFormation outputs
2. Create/update MCP Gateway via AgentCore Starter Toolkit
3. Create Cognito User Pool for OAuth authentication
4. Register each Lambda as a gateway target
5. Save gateway configuration (including OAuth credentials) to cdk/gateway_config.json
```

### Gateway OAuth Authentication

The MCP Gateway uses Cognito OAuth2 with client credentials grant for authentication. When agents are deployed, setup.sh reads credentials from `cdk/gateway_config.json` and passes them as environment variables:

| Environment Variable | Description |
|---------------------|-------------|
| `GATEWAY_URL` | MCP Gateway endpoint URL |
| `GATEWAY_CLIENT_ID` | Cognito OAuth client ID |
| `GATEWAY_CLIENT_SECRET` | Cognito OAuth client secret |
| `GATEWAY_TOKEN_ENDPOINT` | Cognito token endpoint URL |
| `GATEWAY_SCOPE` | OAuth scope for Gateway access |

### Gateway Client Module

Agents use `agents/shared/gateway_client.py` for MCP Gateway integration. This module provides two key components:

1. **GatewayTokenManager** - OAuth token management with Cognito
2. **invoke_with_gateway()** - Agent execution with proper MCP session lifecycle

#### MCP Session Lifecycle (Critical)

MCP tools returned by `list_tools_sync()` are **proxy objects** that maintain a reference to the MCP client session. If the session closes before the agent executes tools, you get "client session is not running" errors.

**Wrong pattern (causes errors):**
```python
def get_gateway_tools(gateway_url):
    client = MCPClient(lambda: streamablehttp_client(gateway_url))
    with client:
        tools = client.list_tools_sync()  # Tools reference this session
        return tools
    # Session CLOSES here - tools become "dead" proxies!

# Later: agent tries to call tool → ERROR: client session is not running
```

**Correct pattern (invoke_with_gateway handles this):**
```python
from agents.shared.gateway_client import invoke_with_gateway
from .prompts import SYSTEM_PROMPT
from .tools import my_local_tool

def invoke_my_agent(prompt: str) -> str:
    return invoke_with_gateway(
        prompt=prompt,
        local_tools=[my_local_tool],
        system_prompt=SYSTEM_PROMPT
    )
```

The `invoke_with_gateway()` function keeps the MCP session open during the entire agent execution:
```python
with client:
    gateway_tools = client.list_tools_sync()
    agent = Agent(tools=local_tools + gateway_tools)
    result = agent(prompt)  # Tool calls happen with session OPEN
    return result.message   # Session still OPEN here
# Session closes AFTER agent completes
```

#### GatewayTokenManager

The token manager handles OAuth2 client credentials flow:
- Reads credentials from environment variables
- Fetches tokens from Cognito via VPC endpoint
- Caches tokens and refreshes 5 minutes before expiry
- Never blocks tool execution on token errors

### Tool Invocation Flow

```
Agent (running in AgentCore Runtime)
    │
    │ 1. Get OAuth token from Cognito (via VPC endpoint)
    ▼
GatewayTokenManager
    │
    │ 2. Pass Bearer token in Authorization header
    ▼
AgentCore MCP Gateway (validates token)
    │
    │ 3. Invoke Lambda target
    ▼
Lambda Function (shared tool)
    │
    ▼
Response back to Agent
```

### VPC Endpoint Requirements

Agents run in isolated VPC subnets with no NAT Gateway. To reach services:

| Service | VPC Endpoint | Purpose |
|---------|--------------|---------|
| `bedrock-agentcore.gateway` | Interface | MCP Gateway tool invocations |
| `cognito-idp` | Interface | OAuth token fetching |
| Other services | See networking.py | DynamoDB, Bedrock, SSM, etc. |

All agents share the same gateway, enabling tool reuse across the workflow.

---

## Stage 5: Runtime Execution

### Observability Architecture

The Demo Viewer polls DynamoDB for tool call events written by the `@instrument_tool` decorator:

```
┌─────────────────┐                    ┌─────────────────────────────────────────┐
│   Demo Viewer   │  poll every 500ms  │           DynamoDB Event Table          │
│   (Extension)   │◄──────────────────►│  PK: session_id  |  SK: timestamp       │
└─────────────────┘                    │  event_id, agent, tool_name, status     │
                                       └─────────────────────────────────────────┘
                                                          ▲
                                                          │ write events
                                                          │
┌─────────────────────────────────────────────────────────┴───────────────────────┐
│                              AgentCore Runtime                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                          │
│  │   Agent 1   │    │   Agent 2   │    │   Agent 3   │                          │
│  │ @instrument │    │ @instrument │    │ @instrument │                          │
│  │   _tool     │    │   _tool     │    │   _tool     │                          │
│  └─────────────┘    └─────────────┘    └─────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### DynamoDB Tool Events

Each tool invocation emits 2 events via the `@instrument_tool` decorator:

| session_id | timestamp | status | agent | tool_name | duration_ms |
|------------|-----------|--------|-------|-----------|-------------|
| abc-12345 | 2024-01-15T10:30:00.123456 | started | analyzer | get_ticket | - |
| abc-12345 | 2024-01-15T10:30:00.456789 | completed | analyzer | get_ticket | 333 |
| abc-12345 | 2024-01-15T10:30:01.000000 | started | analyzer | lookup_customer | - |
| abc-12345 | 2024-01-15T10:30:01.250000 | completed | analyzer | lookup_customer | 250 |

**Key principle**: Tool execution is never blocked by monitoring. All DynamoDB writes are fire-and-forget.

### Demo Viewer Integration

The Agentify Demo Viewer panel:
- Polls DynamoDB every 500ms for new tool events
- Displays chronological timeline of tool calls
- Shows status indicators: started (yellow), completed (green), error (red)
- Attributes each tool call to the invoking agent
- Auto-refreshes as new events arrive

---

## Best Practices: Debugging with Kiro

After deployment, **let Kiro invoke agents and debug issues itself**. Kiro can:

1. Run `agentcore invoke` commands to test agents
2. Check CloudWatch logs for runtime errors
3. Identify and fix issues like port mismatches, import errors, or configuration problems
4. Redeploy with corrections

### Why This Works

Kiro may occasionally generate code that deviates from steering file examples (e.g., using port 8081 instead of 8080). Rather than manually debugging:

1. Ask Kiro to invoke the agent
2. Let it observe the failure (timeout, health check failure, etc.)
3. Have it check CloudWatch logs: `aws logs tail /aws/bedrock-agentcore/runtimes/{agent-id}-DEFAULT`
4. Let Kiro identify the root cause and fix it

### Example Debug Session

```
User: "The greeter agent invoke is stuck"

Kiro:
1. Checks CloudWatch logs → sees repeated "Starting agent on port 8081"
2. Checks Dockerfile → sees EXPOSE 8080
3. Identifies port mismatch
4. Fixes handler to use port 8080
5. Redeploys agent
```

This self-healing loop is faster than manual debugging and helps Kiro learn from its own mistakes.

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
├── agents/
│   ├── shared/                 # Bundled utilities (from extension)
│   │   ├── __init__.py
│   │   └── gateway_client.py   # MCP Gateway integration (OAuth + session lifecycle)
│   ├── main.py                 # Local orchestrator (Kiro generated)
│   ├── analyzer.py             # Agent handlers (Kiro generated, deploy to AgentCore)
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
