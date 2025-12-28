# Tech Stack

## IDE Extension Platform

- Extension Name: Agentify (single extension with two webview panels)
- Extension Platform: Kiro IDE (VS Code Extension API compatible)
- Extension Language: TypeScript 5.0+
- Extension Bundler: esbuild
- Extension Package Manager: npm
- Node Version: 22 LTS

## Extension Architecture

Single `agentify` extension with:
- **Demo Viewer Panel** — Runtime visualization (execution logs, agent graph, outcomes)
- **Ideation Wizard Panel** — Design-time workflow (multi-step wizard for demo planning)
- **Shared Services** — AWS clients, configuration, types shared across both panels

## Frontend (Webview Panels)

- UI Framework: React latest stable
- Build Tool: Vite
- CSS Framework: TailwindCSS 4.0+
- Graph Visualization: React Flow (preferred) or D3.js
- Icons: Lucide React components
- Import Strategy: Node.js modules

## AWS Services

- AI/LLM: Amazon Bedrock (Claude Opus 4.5 — model ID: global.anthropic.claude-opus-4-5-20251101-v1:0)
- AI/LLM Fallback: Claude Sonnet 4.5 (model ID: global.anthropic.claude-sonnet-4-5-20250929-v1:0)
- Model Selection: Configurable in plugin settings
- Database: Amazon DynamoDB
- Agent Runtime: Amazon Bedrock AgentCore (deployment target)
- Local Development: Strands agents run locally during development, deploy to AgentCore for demos
- Identity: AWS IAM (standard credential chain)
- Supported Regions: us-east-1, us-west-2, eu-west-1

## AWS SDK

- AWS SDK: AWS SDK for JavaScript v3
- Bedrock Client: @aws-sdk/client-bedrock-runtime
- Bedrock Streaming: @aws-sdk/client-bedrock-runtime (InvokeModelWithResponseStreamCommand)
- DynamoDB Client: @aws-sdk/lib-dynamodb (DocumentClient)
- Credential Provider: @aws-sdk/credential-providers

## Python Components (Observability Package)

- Python Version: 3.12+
- Package Manager: uv (https://docs.astral.sh/uv/)
- Agent Framework: strands-agents
- Agent Tools: strands-agents-tools (community tools package)
- Observability Package: agentify_observability (writes events to DynamoDB)
- DynamoDB Client: boto3

### Python Project Setup

```bash
# Create virtual environment with uv
uv venv --python 3.12

# Activate virtual environment
source .venv/bin/activate  # macOS/Linux
.venv\Scripts\activate     # Windows

# Install dependencies
uv pip install -e ".[dev]"
```

### pyproject.toml (agentify_observability package)

```toml
[project]
name = "agentify-observability"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "boto3>=1.35.0",
    "strands-agents>=0.1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "ruff>=0.4.0",
    "mypy>=1.10.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

### Observability Decorators

```python
from agentify_observability import init_workflow, agent_span, tool_call, workflow_outcome

# Initialize at workflow start
init_workflow(
    workflow_id=workflow_id,
    table_name=os.environ.get("AGENTIFY_DYNAMODB_TABLE"),
    region=os.environ.get("AGENTIFY_AWS_REGION", "us-east-1")
)

# Decorator usage
@agent_span(name="inventory_agent", role="data_retrieval")
def create_inventory_agent():
    ...

@tool_call(system="SAP", operation="get_inventory")
def fetch_inventory(sku: str):
    ...
```

## Generated Agent Code

- Language: Python 3.12+
- Agent Framework: strands-agents
- Agent Tools: strands-agents-tools

### Strands Multi-Agent Patterns

Generated demos will use one of three orchestration patterns based on business objective requirements:

**Graph Pattern** (strands.multiagent.GraphBuilder)
- Deterministic structure with LLM-driven path selection
- Supports cycles and conditional edges
- Use for: Customer routing, approval workflows, decision trees

**Swarm Pattern** (strands.multiagent.Swarm)
- Autonomous agent collaboration with emergent handoffs
- Agents decide when to hand off via handoff_to_agent tool
- Use for: Research synthesis, incident response, collaborative analysis

**Workflow Pattern** (strands.multiagent.Workflow)
- Fixed DAG execution with automatic parallelization
- Tasks define explicit dependencies
- Use for: Data pipelines, batch processing, repeatable business processes

### Core Imports

```python
from strands import Agent, tool
from strands.multiagent import GraphBuilder, Swarm, Workflow
from strands_tools import memory, http_request
```

### Observability Integration

- Decorator Package: agentify_observability
- Runtime Target: Amazon Bedrock AgentCore (production), Local Python (development)

## Strands SDK Configuration

### Model Provider

- Provider: Amazon Bedrock (default)
- Default Model: Claude Opus 4.5
- Fallback Model: Claude Sonnet 4.5
- Region: Inherited from AWS credential chain
- Configuration: Model selection available in plugin settings

### Agent Configuration

```python
from strands import Agent
from strands.models.bedrock import BedrockModel

model = BedrockModel(
    model_id='global.anthropic.claude-opus-4-5-20251101-v1:0',
    region_name='us-east-1'
)

agent = Agent(
    model=model,
    system_prompt='...',
    tools=[...]
)
```

### Multi-Agent State Sharing

- Graph/Swarm: Use `invocation_state` parameter for shared context
- Workflow: Automatic output→input passing between dependent tasks
- All patterns: Access state in tools via `ToolContext.invocation_state`

### Deployment Targets

- Development: Local Python execution
- Demo: Amazon Bedrock AgentCore Runtime
- Alternative: AWS Lambda, AWS Fargate, Amazon EKS

## Local Trigger Flow

Demo Viewer triggers Python workflows via subprocess, then polls DynamoDB for events:

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Demo Viewer   │         │   Python Script  │         │  DynamoDB   │
│   (TypeScript)  │         │   (Strands SDK)  │         │             │
└────────┬────────┘         └────────┬─────────┘         └──────┬──────┘
         │                           │                          │
         │  spawn subprocess         │                          │
         │  python main.py           │                          │
         │  --prompt "..."           │                          │
         │  --workflow-id "wf-123"   │                          │
         ├──────────────────────────►│                          │
         │                           │                          │
         │                           │  @agent_span decorator   │
         │                           │  writes events           │
         │                           ├─────────────────────────►│
         │                           │                          │
         │  poll for workflow_id     │                          │
         ├──────────────────────────────────────────────────────►│
         │◄─────────────────────────────────────────────────────┤
         │  events                   │                          │
```

**Key Design:** Demo Viewer doesn't need to understand Python — it just:
1. Spawns subprocess with args/env
2. Gets back a workflow_id
3. Polls DynamoDB for events with that workflow_id

## Dual-Mode Event Architecture

Events come from two sources depending on deployment mode:

### Event Sources by Mode

| Event Type | stdout (local only) | DynamoDB (always) |
|------------|---------------------|-------------------|
| Graph structure | ✅ Initial layout | — |
| Node start/stop | ✅ Real-time | ✅ Backup |
| Agent token stream | ✅ Live text | — |
| Tool calls (start/complete) | ❌ | ✅ Primary source |
| Tool results | ❌ | ✅ Primary source |
| Workflow outcome | ✅ Final status | ✅ Persistent |

### Local Mode (triggerType: "local")

- Demo Viewer spawns Python subprocess
- Real-time events via stdout JSON streaming (using `graph.stream_async()`)
- Tool call events written to DynamoDB by agent decorators
- Graph visualization updates instantly from stdout
- Tool log populated from DynamoDB polling

### AgentCore Mode (triggerType: "agentcore")

- Demo Viewer calls InvokeAgent API
- All events come from DynamoDB polling (no stdout access)
- Slightly slower graph updates (500ms polling interval)

**Rationale:** Tool calls happen inside Strands agents, not the orchestration layer. The graph's `stream_async()` gives orchestration events but not tool-level detail. DynamoDB captures tool calls regardless of deployment mode.

## stdout Event Types

In local mode, the Python subprocess emits JSON events to stdout:

| Event Type | Description | Payload |
|------------|-------------|---------|
| `graph_structure` | Initial graph layout | `nodes`, `edges`, `entry_points` |
| `node_start` | Agent node began execution | `node_id`, `agent_name`, `triggered_by` |
| `node_stream` | Agent token output (optional) | `node_id`, `token`, `accumulated_text` |
| `node_stop` | Agent node completed/failed | `node_id`, `status`, `duration_ms` |
| `workflow_complete` | Final status | `workflow_id`, `status`, `execution_time_ms` |

### Example stdout Event

```json
{"type": "graph_structure", "workflow_id": "wf-123", "nodes": [...], "edges": [...]}
{"type": "node_start", "node_id": "inventory_agent", "agent_name": "Inventory Agent"}
{"type": "node_stop", "node_id": "inventory_agent", "status": "completed", "duration_ms": 1234}
{"type": "workflow_complete", "workflow_id": "wf-123", "status": "COMPLETED"}
```

## Strands SDK Streaming Integration

Use Strands' native `graph.stream_async()` for real-time visualization in local mode:

```python
async def run_workflow_streaming(prompt: str, workflow_id: str):
    graph = build_graph()

    # Emit graph structure for visualization
    emit_event({
        "type": "graph_structure",
        "workflow_id": workflow_id,
        "nodes": [{"id": n.name, "name": n.name} for n in graph.nodes],
        "edges": [{"from": e.source, "to": e.target} for e in graph.edges],
        "entry_points": graph.entry_points
    })

    # Stream events as graph executes
    async for event in graph.stream_async(prompt):
        if event.get("type") == "multiagent_node_start":
            emit_event({"type": "node_start", "node_id": event["node_id"]})
        elif event.get("type") == "multiagent_node_stop":
            emit_event({"type": "node_stop", "node_id": event["node_id"], "status": "completed"})
        elif event.get("type") == "multiagent_result":
            emit_event({"type": "workflow_complete", "status": event["status"]})

def emit_event(event: dict):
    print(json.dumps(event), flush=True)  # Flush for real-time
```

## React Flow Graph Visualization

Graph visualization uses React Flow with custom components:

### Features

- **Custom node component** with status indicator (pending/running/completed/failed)
- **Animated edges** when data flowing between nodes
- **Color-coded status:** gray (pending) → blue (running) → green (completed) / red (failed)
- **Auto-layout** using dagre or elkjs for automatic node positioning
- **Pattern-specific layouts:**
  - Graph: DAG with conditional edges and decision nodes
  - Swarm: Peer-to-peer connections with dynamic handoff animations
  - Workflow: Linear lanes with parallel execution visualization

### React Flow Dependencies

```json
{
  "dependencies": {
    "reactflow": "^11.0.0",
    "dagre": "^0.8.5"
  }
}
```

### Workflow Entry Point

Kiro generates `agents/main.py` as the workflow entry point:
- Accepts `--prompt` and `--workflow-id` via argparse
- Initializes agentify_observability with env vars
- Builds Strands Graph and runs workflow
- Outputs JSON result to stdout

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AGENTIFY_DYNAMODB_TABLE` | DynamoDB table name | `agentify-workflow-events` |
| `AGENTIFY_AWS_REGION` | AWS region | `us-east-1` |
| `AGENTIFY_WORKFLOW_ID` | Unique workflow ID | `wf-abc123` |

## Project Configuration

`.agentify/config.json` stores project-level configuration and serves as the bridge between all phases.

### Full Schema

```json
{
  "version": "1.0",
  "project": {
    "name": "string",
    "businessObjective": "string",
    "industry": "string",
    "systems": ["string"]
  },
  "infrastructure": {
    "dynamodb": {
      "tableName": "string (default: agentify-workflow-events)",
      "tableArn": "string",
      "region": "string (default: us-east-1)"
    }
  },
  "workflow": {
    "orchestrationPattern": "graph | swarm | workflow",
    "triggerType": "local | agentcore | http",
    "triggerConfig": {
      "entryScript": "string (e.g., agents/main.py)",
      "pythonPath": "string (e.g., .venv/bin/python)",
      "agentId": "string (for agentcore)",
      "aliasId": "string (for agentcore)",
      "endpoint": "string (for http)"
    },
    "agents": [
      {"id": "string", "name": "string", "role": "string"}
    ],
    "edges": [
      {"from": "string", "to": "string"}
    ]
  }
}
```

### Example (Local Development)

```json
{
  "version": "1.0",
  "project": {
    "name": "retail-inventory-demo",
    "businessObjective": "Reduce stockouts in fresh produce by implementing predictive replenishment",
    "industry": "retail",
    "systems": ["SAP", "Salesforce"]
  },
  "infrastructure": {
    "dynamodb": {
      "tableName": "agentify-workflow-events",
      "tableArn": "arn:aws:dynamodb:us-east-1:123456789:table/agentify-workflow-events",
      "region": "us-east-1"
    }
  },
  "workflow": {
    "orchestrationPattern": "graph",
    "triggerType": "local",
    "triggerConfig": {
      "entryScript": "agents/main.py",
      "pythonPath": ".venv/bin/python"
    },
    "agents": [
      {"id": "inventory_agent", "name": "Inventory Agent", "role": "data_retrieval"},
      {"id": "demand_agent", "name": "Demand Agent", "role": "analysis"},
      {"id": "recommendation_agent", "name": "Recommendation Agent", "role": "decision"}
    ],
    "edges": [
      {"from": "inventory_agent", "to": "recommendation_agent"},
      {"from": "demand_agent", "to": "recommendation_agent"}
    ]
  }
}
```

### Trigger Types

| Type | Description | Use Case | triggerConfig fields |
|------|-------------|----------|---------------------|
| `local` | Spawn Python subprocess | Development, demos | `entryScript`, `pythonPath` |
| `agentcore` | Amazon Bedrock AgentCore API | Production | `agentId`, `aliasId` |
| `http` | HTTP endpoint | Custom deployments | `endpoint` |

### Config Lifecycle

| Phase | Reads | Writes |
|-------|-------|--------|
| Initialize Project | — | `infrastructure.*`, creates file |
| Ideation Wizard | config.json | `project.*`, `workflow.orchestrationPattern` |
| Kiro Implementation | steering files | `workflow.triggerType`, `workflow.triggerConfig`, `workflow.agents`, `workflow.edges` |
| Demo Viewer | entire config | — |

## Kiro Integration

- Steering Files: `.kiro/steering/agentify-integration.md`
- Configuration: `.agentify/config.json`
- Hooks: Kiro hooks configuration format

### Steering File Content

`.kiro/steering/agentify-integration.md` instructs Kiro to:

1. **Create entry point** — `agents/main.py` with argparse (--prompt, --workflow-id)
2. **Import observability** — Use `agentify_observability` decorators on all agents
3. **Use streaming** — Implement `graph.stream_async()` for real-time events
4. **Emit JSON events** — Write stdout events for Demo Viewer consumption
5. **Read config from env** — Use AGENTIFY_* environment variables for DynamoDB
6. **Update config** — After implementation, update `.agentify/config.json` with workflow metadata

### Generated Steering File Template

```markdown
# Agentify Integration

## Workflow Entry Point

Create `agents/main.py` that:
1. Uses argparse to accept --prompt and --workflow-id
2. Imports and initializes agentify_observability
3. Builds the Strands Graph from your agents
4. Uses graph.stream_async() for real-time events
5. Emits JSON events to stdout for Demo Viewer

## After Implementation

Update `.agentify/config.json` with:
- workflow.triggerConfig.entryScript: path to main.py
- workflow.agents: list of agent IDs and names
- workflow.edges: list of edges in the graph
```

## Data Storage

- Event Table: DynamoDB (agentify-workflow-events)
- Partition Key: workflow_id
- Sort Key: timestamp (epoch milliseconds)
- TTL: 24 hours from event creation
- Workspace State: VS Code workspace storage API

## Development Standards

- Code Style: See agent-os/standards/code-style.md
- Best Practices: See agent-os/standards/best-practices.md
- Indentation: 2 spaces
- Strings: Single quotes (double for interpolation)
- Naming: camelCase (JS/TS), snake_case (Python)

## Performance Requirements

- Plugin UI Response: < 100ms
- Claude API Response: < 5 seconds
- DynamoDB Polling Latency: < 500ms
- Graph Update Latency: < 1 second

## Platform Compatibility

- Operating Systems: macOS, Windows, Linux
- IDE: Kiro IDE (VS Code Extension API)

## Local Development Workflow

### Extension Development (Symlink Method)

The fastest approach for iterative development — build once, symlink, then just rebuild on changes:

```bash
# 1. Build the extension
cd agentify
npm run compile

# 2. Symlink to Kiro's extensions directory
# macOS/Linux:
ln -s "$(pwd)" ~/.kiro/extensions/agentify

# Windows (run as Administrator):
mklink /D "%USERPROFILE%\.kiro\extensions\agentify" "C:\path\to\agentify"

# 3. Restart Kiro to load the extension

# 4. On code changes, rebuild and reload:
npm run compile
# Then use Kiro's "Developer: Reload Window" command
```

### Kiro Extensions Directory

| Platform | Path |
|----------|------|
| macOS | `~/.kiro/extensions/` |
| Linux | `~/.kiro/extensions/` |
| Windows | `%USERPROFILE%\.kiro\extensions\` |

### Development Commands

```bash
# Watch mode (auto-rebuild on changes)
npm run watch

# Build for production
npm run package

# Run extension tests
npm run test
```

## Technical References

- Strands Agents SDK: https://strandsagents.com/latest/
- Multi-Agent Patterns: https://strandsagents.com/latest/documentation/docs/user-guide/concepts/multi-agent/multi-agent-patterns/
- Amazon Bedrock Models: https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html
- Kiro IDE: https://kiro.dev/docs/
