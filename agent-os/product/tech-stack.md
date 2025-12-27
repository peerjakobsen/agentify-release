# Tech Stack

## IDE Extension Platform

- Extension Platform: Kiro IDE (VS Code Extension API compatible)
- Extension Language: TypeScript 5.0+
- Extension Bundler: esbuild
- Extension Package Manager: npm
- Node Version: 22 LTS

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

## Python Components (Decorator Package)

- Python Version: 3.12+
- Package Manager: uv (https://docs.astral.sh/uv/)
- Agent Framework: strands-agents
- Agent Tools: strands-agents-tools (community tools package)
- Observability: OpenTelemetry
- Package Distribution: PyPI (demo-observability)
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

### pyproject.toml (demo-observability package)

```toml
[project]
name = "demo-observability"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "boto3>=1.35.0",
    "strands-agents>=0.1.0",
    "opentelemetry-api>=1.20.0",
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

## Generated Agent Code

- Language: Python 3.12+
- Agent Framework: strands-agents
- Agent Tools: strands-agents-tools

### Strands Multi-Agent Patterns

Generated demos will use one of three orchestration patterns based on value map requirements:

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

- Decorator Package: demo-observability
- Runtime Target: Amazon Bedrock AgentCore

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

## Kiro Integration

- Steering Files: Markdown (.kiro/steering/)
- Configuration: JSON (MCP config)
- Hooks: Kiro hooks configuration format

## Data Storage

- Event Table: DynamoDB (demo-workflow-events)
- Partition Key: workflow_id
- Sort Key: timestamp
- TTL: Configured for automatic cleanup
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
