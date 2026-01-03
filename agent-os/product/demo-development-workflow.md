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

**Configuration (`.agentify/config.json`):**

The config file supports optional routing configuration for Haiku-based routing:

```json
{
  "routing": {
    "useHaikuRouter": false,
    "routerModel": "global.anthropic.claude-haiku-4-5-20251001-v1:0",
    "fallbackToAgentDecision": true
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `useHaikuRouter` | `false` | Enable Haiku routing (opt-in to avoid surprise costs) |
| `routerModel` | `global.anthropic.claude-haiku-4-5-20251001-v1:0` | Bedrock model ID (override for SCP restrictions) |
| `fallbackToAgentDecision` | `true` | Fall back to other strategies on Haiku failure |

When enabled, the router reads `## Routing Guidance` from `.kiro/steering/tech.md` to inform routing decisions.

---

## Stage 2: Code Generation (Kiro IDE)

Kiro reads the steering files and generates all code following the defined contracts.

### What Kiro Generates

#### 1. Agent Orchestrator (Base Template + Kiro Customization)

```
agents/
└── main.py                     # Entry point following CLI contract
```

The orchestrator uses a **base template + customization** pattern:

**Base Template** (`resources/agents/main.py` in Agentify extension):
- Generic infrastructure: CLI parsing, event emission, agent config loading
- `invoke_agent_remotely()` function for boto3 SDK calls
- Error handling, workflow summaries, response parsing
- Marked as **DO NOT MODIFY** section

**Customization Section** (Kiro fills in based on steering files):

The CUSTOMIZATION SECTION functions vary by orchestration pattern:

**Graph Pattern:**
```python
def define_graph_structure() -> Dict[str, Any]:
    """Return nodes and edges for Demo Viewer visualization."""
    return {"nodes": [...], "edges": [...]}

def get_entry_agent() -> str:
    """Return first agent to invoke."""
    return "triage"

def route_to_next_agent(current_agent: str, response: Dict[str, Any]) -> Optional[str]:
    """Routing logic using hybrid strategy (NO keyword matching)."""
    # Strategy 0: Haiku routing (optional, fast LLM-based routing)
    # When useHaikuRouter: true in config, uses Claude Haiku (~10x cheaper, ~3x faster)
    # to decide next agent based on response content and routing guidance from tech.md
    routing_config = load_routing_config()
    if routing_config.get('useHaikuRouter', False):
        haiku_result = route_with_haiku(current_agent, response, get_available_agents())
        if haiku_result:
            return None if haiku_result == 'COMPLETE' else haiku_result
        # Falls through to other strategies on failure

    # Strategy 1: Explicit routing (agent returns route_to field)
    if response.get('route_to'):
        return response['route_to']

    # Strategy 2: Classification routing (agent returns classification field)
    CLASSIFICATION_ROUTES = {"technical": "technical_handler", "billing": "billing_handler"}
    if response.get('classification'):
        return CLASSIFICATION_ROUTES.get(response['classification'].lower())

    # Strategy 3: Static routing (predetermined sequence)
    STATIC_ROUTES = {"extract": "validate", "validate": None}
    if current_agent in STATIC_ROUTES:
        return STATIC_ROUTES[current_agent]

    return None  # Workflow complete

def get_agent_display_name(agent_id: str) -> str:
    """Map agent IDs to human-readable names."""
    return {"triage": "Triage Agent", ...}.get(agent_id, agent_id)
```

**Swarm Pattern:**
```python
def define_graph_structure() -> Dict[str, Any]:
    """Return nodes and all possible handoff edges."""
    return {"nodes": [...], "edges": [...]}  # Show all possible handoffs

def get_entry_agent() -> str:
    """Return first agent (usually coordinator)."""
    return "coordinator"

def get_agent_display_name(agent_id: str) -> str:
    """Map agent IDs to human-readable names."""
    return {...}.get(agent_id, agent_id)

# NOTE: No route_to_next_agent - agents decide handoffs autonomously
# Handoffs extracted by extract_handoff_from_response() in template
#
# Optional Haiku Fallback (Safety Net):
# When useHaikuRouter: true in config, if agent doesn't specify a handoff,
# the Haiku router acts as a safety net to determine the next agent.
# Agent's own handoff decisions ALWAYS take priority (Swarm philosophy preserved).
```

**Workflow Pattern:**
```python
def define_graph_structure() -> Dict[str, Any]:
    """Return nodes and dependency edges."""
    return {"nodes": [...], "edges": [...]}

def define_task_dag() -> Dict[str, List[str]]:
    """Return task dependencies as DAG."""
    return {
        "fetch": [],           # No deps - runs first
        "analyze": ["fetch"],  # Waits for fetch
        "enrich": ["fetch"],   # Runs parallel with analyze
        "aggregate": ["analyze", "enrich"]  # Waits for both
    }

def get_agent_display_name(agent_id: str) -> str:
    """Map task IDs to human-readable names."""
    return {...}.get(agent_id, agent_id)

def build_task_prompt(task_id: str, original_prompt: str,
                     dependency_results: Dict[str, Dict[str, Any]]) -> str:
    """Build prompt with dependency results for dependent tasks."""
    # Customize how dependency outputs are passed to tasks

# NOTE: No get_entry_agent or route_to_next_agent - DAG determines order
```

The orchestrator:
- Parses CLI arguments (`--prompt`, `--workflow-id`, `--trace-id`)
- Emits `graph_structure` event first
- **Invokes remote agents via boto3 SDK** (NOT local imports)
- Emits events to stdout and DynamoDB
- Returns `workflow_complete` or `workflow_error`

**Critical Architecture:** The orchestrator runs **locally** and calls agents deployed to **AgentCore Runtime** using the `InvokeAgentRuntime` API. It does NOT import or run agent code locally.

```
main.py (local)
    │
    │ boto3.client('bedrock-agentcore').invoke_agent_runtime()
    ▼
AgentCore Runtime (AWS)
    │
    ├── Agent 1 (remote) ──► MCP Gateway ──► Lambda tools
    ├── Agent 2 (remote) ──► MCP Gateway ──► Lambda tools
    └── Agent 3 (remote) ──► MCP Gateway ──► Lambda tools
```

**Remote Agent Invocation Pattern:**

```python
import boto3
import yaml
from functools import lru_cache
from pathlib import Path

@lru_cache(maxsize=1)
def load_agent_config() -> dict:
    """Load all agent configs from .bedrock_agentcore.yaml dynamically."""
    config_path = Path(__file__).parent.parent / '.bedrock_agentcore.yaml'
    with open(config_path) as f:
        config = yaml.safe_load(f)

    agents = {}
    for agent_key, agent_config in config.get('agents', {}).items():
        agentcore = agent_config.get('bedrock_agentcore', {})
        aws = agent_config.get('aws', {})
        if agentcore.get('agent_arn'):
            agent_id = agent_config.get('name', agent_key)
            agents[agent_id] = {
                'arn': agentcore['agent_arn'],
                'region': aws.get('region', 'us-east-1'),
            }
    return agents


def invoke_agent_remotely(agent_id: str, prompt: str, session_id: str) -> dict:
    """Invoke remote agent via AgentCore SDK."""
    agents = load_agent_config()
    agent = agents[agent_id]

    client = boto3.client('bedrock-agentcore', region_name=agent['region'])
    payload = json.dumps({'prompt': prompt, 'session_id': session_id}).encode()

    response = client.invoke_agent_runtime(
        agentRuntimeArn=agent['arn'],
        runtimeSessionId=session_id,
        payload=payload
    )

    # Collect all bytes first to handle multi-byte UTF-8 chars at chunk boundaries
    raw_bytes = b''
    for chunk in response.get('response', []):
        raw_bytes += chunk
    response_text = raw_bytes.decode('utf-8')

    # Parse nested Bedrock message format
    try:
        parsed = json.loads(response_text)
        if isinstance(parsed, dict):
            # Handle: {'response': {'role': 'assistant', 'content': [{'text': '...'}]}}
            inner = parsed.get('response')
            if isinstance(inner, dict) and 'content' in inner:
                texts = [item['text'] for item in inner.get('content', [])
                         if isinstance(item, dict) and 'text' in item]
                if texts:
                    return {'response': '\n'.join(texts)}
    except json.JSONDecodeError:
        pass

    return {'response': response_text}
```

**Key Points:**
- Agent ARNs are read from `.bedrock_agentcore.yaml` (created by `agentcore deploy`)
- No hardcoded agent names - dynamically discovers all deployed agents
- Uses `runtimeSessionId` for session correlation across agents
- Requires `bedrock-agentcore:InvokeAgentRuntime` IAM permission

**Response Format Handling:**

AgentCore returns responses in a nested JSON format that requires careful parsing:

```json
{
  "response": {
    "role": "assistant",
    "content": [{"text": "Agent response here..."}]
  },
  "agent": "agent-name",
  "session_id": "uuid"
}
```

**Critical:** The streaming response arrives in chunks that may split multi-byte UTF-8 characters (like emojis). Always collect all bytes first, then decode:

```python
# ❌ Wrong: decoding each chunk individually breaks multi-byte chars
for chunk in response.get('response', []):
    content.append(chunk.decode('utf-8'))  # May fail on emoji boundaries

# ✅ Correct: collect all bytes first, then decode together
raw_bytes = b''
for chunk in response.get('response', []):
    raw_bytes += chunk
response_text = raw_bytes.decode('utf-8')
```

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
- VPC with private subnets and NAT Gateway (required for Cognito M2M OAuth)
- VPC endpoints for AWS services (S3, DynamoDB, Lambda, Bedrock, ECR, X-Ray, etc.)
- Security groups for agent connectivity

**Note**: NAT Gateway is required because M2M OAuth (client credentials flow) is not supported via VPC endpoints. The Cognito OAuth token endpoint at `{domain}.auth.{region}.amazoncognito.com` requires internet access.

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

### Running Workflows

After deployment, use `orchestrate.sh` to run the complete workflow:

```bash
# Run workflow with a prompt
./scripts/orchestrate.sh -p "Customer TKT-001 has API errors"

# With custom workflow ID and output file
./scripts/orchestrate.sh --prompt "Billing issue" --workflow-id "wf-test-123" --json events.json

# Skip DynamoDB event query (faster)
./scripts/orchestrate.sh -p "VIP complaint" --skip-events
```

The orchestrate script:
- Auto-discovers AWS profile from `.agentify/config.json`
- Auto-generates workflow-id and trace-id if not provided
- Separates stdout (JSON events) from stderr (human-readable progress)
- Queries DynamoDB for tool events after completion
- Shows formatted table of tool invocations per agent

### IAM Role & Policy Creation

When deploying an agent with `./scripts/setup.sh --agent <name>`:

1. **AgentCore SDK creates execution role** (during `agentcore deploy`):
   - Role name: `AmazonBedrockAgentCoreSDKRuntime-{region}-{hash}`
   - Trust policy: Allows `bedrock-agentcore.amazonaws.com` to assume it
   - Managed policies: `AmazonBedrockAgentCoreRuntimePolicy`, CloudWatch Logs

2. **setup.sh adds Agentify-specific inline policy** (after deploy completes):
   - Policy name: `AgentifyAccess-{agent_name}`
   - Grants `dynamodb:PutItem`, `dynamodb:Query` on project-specific workflow-events table
   - Grants `ssm:GetParameter` on both `/agentify/*` (gateway) and `/{project}/*` (DynamoDB) parameters

```bash
# setup.sh extracts role from .bedrock_agentcore.yaml and adds:
# Note: Uses ${PROJECT_NAME} derived from workspace folder
aws iam put-role-policy \
    --role-name "AmazonBedrockAgentCoreSDKRuntime-us-east-1-xyz123" \
    --policy-name "AgentifyAccess-analyzer" \
    --policy-document '{
        "Statement": [
            {"Action": ["dynamodb:PutItem", "dynamodb:Query"], "Resource": ["arn:aws:dynamodb:...:table/${PROJECT_NAME}-workflow-events"]},
            {"Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"], "Resource": [
                "arn:aws:ssm:...:parameter/agentify/*",
                "arn:aws:ssm:...:parameter/${PROJECT_NAME}/*"
            ]}
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

### Schema Validation & Fixing

AgentCore MCP Gateway only supports a limited subset of JSON Schema properties:
- `type`, `properties`, `required`, `items`, `description`

Kiro may generate schemas with unsupported properties like `enum`, `format`, `minLength`, `additionalProperties`, or `errorSchema`. While there's a Kiro hook (`gateway-schema-validator.kiro.hook`) that attempts to catch these during development, it doesn't always fix everything.

**The Iterative Fix Workflow:**

When `setup.sh` runs, it validates all schemas in `cdk/gateway/schemas/`. If issues are found, it outputs a **red-highlighted prompt** that you can copy directly into Kiro:

```
============================================================
ERROR: Schemas contain unsupported AgentCore properties
============================================================

Copy this prompt to Kiro to fix the schemas:
------------------------------------------------------------
[RED TEXT - Copy everything between the dashed lines]

Fix the following gateway schemas for AgentCore MCP Gateway compatibility.
...
------------------------------------------------------------

Fix the schemas and re-run ./scripts/setup.sh
```

**Why Multiple Iterations May Be Needed:**

Sometimes Kiro doesn't fully fix all issues on the first pass:

| Iteration | Common Issue |
|-----------|--------------|
| 1st pass | Removes `enum` but forgets `additionalProperties` |
| 2nd pass | Fixes most issues but confuses property *named* "title" with JSON Schema `title` keyword |
| 3rd pass | Finally gets it right |

**Best Practice:**

1. Run `./scripts/setup.sh`
2. If schema errors appear, copy the red prompt text to Kiro
3. Let Kiro fix the schemas
4. Re-run `./scripts/setup.sh`
5. Repeat until no schema errors (usually 1-3 iterations)

**Example Schema Transformations:**

```
BEFORE: "status": {"type": "string", "enum": ["active", "inactive"]}
AFTER:  "status": {"type": "string", "description": "Status. One of: active, inactive"}

BEFORE: "email": {"type": "string", "format": "email"}
AFTER:  "email": {"type": "string", "description": "Email address (email format)"}

BEFORE: "inputSchema": {..., "additionalProperties": false}
AFTER:  "inputSchema": {...}  (remove additionalProperties entirely)

BEFORE: Top-level "errorSchema": {...}
AFTER:  (remove errorSchema entirely - not supported)
```

### Gateway OAuth Authentication

The MCP Gateway uses Cognito OAuth2 with client credentials grant for authentication. Credentials are stored in SSM Parameter Store during `setup.sh` and discovered at runtime:

**SSM Parameters** (stored at `/agentify/{project}/gateway/*`):

| Parameter | Description |
|-----------|-------------|
| `/agentify/{project}/gateway/url` | MCP Gateway endpoint URL |
| `/agentify/{project}/gateway/client_id` | Cognito OAuth client ID |
| `/agentify/{project}/gateway/client_secret` | Cognito OAuth client secret (SecureString) |
| `/agentify/{project}/gateway/token_endpoint` | Cognito token endpoint URL |
| `/agentify/{project}/gateway/scope` | OAuth scope for Gateway access |

**Runtime Discovery**: Agents read `AGENTIFY_PROJECT_NAME` env var to construct the SSM path, then fetch credentials at startup. This eliminates hardcoded credentials and enables multi-project isolation.

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

Agents run in isolated VPC subnets. VPC endpoints provide efficient access to most AWS services, while NAT Gateway handles Cognito OAuth:

| Service | Access Method | Purpose |
|---------|---------------|---------|
| `bedrock-agentcore.gateway` | VPC Endpoint | MCP Gateway tool invocations |
| `cognito-idp` | VPC Endpoint | Cognito API calls (user pools, etc.) |
| Cognito OAuth tokens | NAT Gateway | M2M OAuth at `{domain}.auth.{region}.amazoncognito.com` |
| DynamoDB, Bedrock, SSM, etc. | VPC Endpoints | See networking.py for full list |

**Note**: The `cognito-idp` VPC endpoint handles Cognito User Pool API operations, NOT OAuth token requests. M2M OAuth (client credentials flow) requires the NAT Gateway to reach the Cognito OAuth token endpoint, which is not supported via VPC endpoints per AWS documentation.

All agents within a project share the same gateway, enabling tool reuse across the workflow.

### Multi-Project Isolation

Multiple Agentify projects can coexist in the same AWS account without conflicts. Each project has its own:
- MCP Gateway with unique tools
- DynamoDB table for events
- SSM parameter namespace

#### How Agents Discover Their Gateway

The `AGENTIFY_PROJECT_NAME` environment variable is the key to multi-project isolation:

**1. Deploy Time** (`setup.sh`):
```bash
# Project name derived from workspace folder, passed to agent
DEPLOY_ENV_ARGS="--env AGENTIFY_PROJECT_NAME=${PROJECT_NAME}"
uv run agentcore deploy -a "${AGENT_NAME}" ${DEPLOY_ENV_ARGS}
```

**2. Runtime** (`gateway_client.py`):
```python
def _get_gateway_ssm_prefix() -> str | None:
    project = os.environ.get('AGENTIFY_PROJECT_NAME')
    if not project:
        return None
    return f'/agentify/{project}/gateway'
```

#### SSM Parameter Namespacing

Each project gets isolated SSM parameters:

| Project | SSM Path | Resources |
|---------|----------|-----------|
| support-triage | `/agentify/support-triage/gateway/*` | Gateway URL, OAuth credentials |
| inventory-demo | `/agentify/inventory-demo/gateway/*` | Gateway URL, OAuth credentials |
| sales-assistant | `/agentify/sales-assistant/gateway/*` | Gateway URL, OAuth credentials |

DynamoDB tables are also project-specific:
- `support-triage-workflow-events`
- `inventory-demo-workflow-events`
- `sales-assistant-workflow-events`

#### Complete Isolation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Project: support-triage                                          │
│                                                                  │
│ setup.sh deploys:                                                │
│   - Gateway: support-triage-gateway-xxx                          │
│   - SSM: /agentify/support-triage/gateway/*                     │
│   - DynamoDB: support-triage-workflow-events                     │
│   - Agent env: AGENTIFY_PROJECT_NAME=support-triage             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Project: inventory-demo                                          │
│                                                                  │
│ setup.sh deploys:                                                │
│   - Gateway: inventory-demo-gateway-yyy                          │
│   - SSM: /agentify/inventory-demo/gateway/*                     │
│   - DynamoDB: inventory-demo-workflow-events                     │
│   - Agent env: AGENTIFY_PROJECT_NAME=inventory-demo             │
└─────────────────────────────────────────────────────────────────┘

At runtime:
  support-triage agent → reads AGENTIFY_PROJECT_NAME=support-triage
                       → looks up /agentify/support-triage/gateway/*
                       → connects to support-triage-gateway-xxx
                       → writes events to support-triage-workflow-events
                       → sees only support-triage tools

  inventory-demo agent → reads AGENTIFY_PROJECT_NAME=inventory-demo
                       → looks up /agentify/inventory-demo/gateway/*
                       → connects to inventory-demo-gateway-yyy
                       → writes events to inventory-demo-workflow-events
                       → sees only inventory-demo tools
```

Each agent automatically discovers **only its own project's gateway, tools, and DynamoDB table** based on the environment variable set during deployment.

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

## Testing the Full Orchestrated Workflow

After deploying individual agents with `./scripts/setup.sh --agent <name>`, test the complete workflow using the local orchestrator.

### Test Command

```bash
cd /path/to/your/project

# With AWS profile
AWS_PROFILE=YourProfile uv run python agents/main.py \
  --prompt "Your test prompt here" \
  --workflow-id "wf-test-$(date +%s)" \
  --trace-id "$(python3 -c 'import uuid; print(uuid.uuid4().hex)')"
```

### Expected Output

**stdout** (JSON Lines for Demo Viewer):
```json
{"event_type": "graph_structure", "timestamp": ..., "graph": {...}}
{"event_type": "node_start", "node_id": "triage", ...}
{"event_type": "node_stop", "node_id": "triage", "status": "completed", ...}
{"event_type": "router_decision", "router_model": "haiku", "from_agent": "triage", "next_agent": "specialist_agent", "duration_ms": 12}
{"event_type": "node_start", "node_id": "specialist_agent", ...}
{"event_type": "node_stop", "node_id": "specialist_agent", "status": "completed", ...}
{"event_type": "workflow_complete", "status": "success", ...}
```

**Note:** The `router_decision` event only appears when `useHaikuRouter: true` is configured. It shows which agent the Haiku router selected and how long the routing decision took.

**stderr** (Human-readable progress):
```
Starting workflow execution:
  Workflow ID: wf-test-1234567890
  Session ID: abc123...
Stage 1: Invoking Triage Agent for ticket classification
Invoking remote agent 'triage' at arn:aws:bedrock-agentcore:...
Triage completed: ...
Stage 2: Routing to technical agent for resolution
...
WORKFLOW EXECUTION COMPLETED SUCCESSFULLY
```

### IAM Permissions for Local Invocation

The AWS credentials used to run main.py need:

```json
{
    "Effect": "Allow",
    "Action": "bedrock-agentcore:InvokeAgentRuntime",
    "Resource": "arn:aws:bedrock-agentcore:*:*:runtime/*"
}
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `AccessDeniedException` | Missing IAM permission | Add `bedrock-agentcore:InvokeAgentRuntime` to your user/role |
| `Security token expired` | AWS credentials expired | Refresh credentials or re-authenticate with SSO |
| `ResourceNotFoundException` | Agent not deployed | Run `./scripts/setup.sh --agent <name>` first |
| Agent name mismatch | Routing returns wrong name | Ensure `route_ticket()` returns names matching `.bedrock_agentcore.yaml` |
| UTF-8 decode error | Multi-byte char split across chunks | Collect all bytes before decoding (see Response Format Handling above) |
| `'dict' object has no attribute 'lower'` | Response not parsed correctly | Handle nested Bedrock format: `response.content[].text` |

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
│   ├── orchestrate.sh          # Run workflow with DynamoDB event display
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
