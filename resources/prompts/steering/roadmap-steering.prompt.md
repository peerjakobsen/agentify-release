# Implementation Roadmap Generation Prompt

You are generating an implementation roadmap for an Agentify project. This roadmap contains **items**, each with a prompt that a user will copy into Kiro IDE chat. Kiro will then generate a `spec.md` file from that prompt, followed by requirements, design, tasks, and implementation.

## Critical Architecture Requirement

**Every prompt you generate MUST embed the AgentCore architecture context.** This is non-negotiable because Kiro processes each item independently and will not remember architecture from previous items or steering files.

The architecture is:
- Agents deploy to **Amazon Bedrock AgentCore Runtime** via AgentCore CLI — they run remotely, NOT locally
- Only `agents/main.py` runs locally — it is the orchestrator that calls remote agents
- Use **Strands SDK**: `from strands import Agent, tool`
- All integrations are **mock tools** (this is a demo system, not production)
- Emit events to DynamoDB + stdout for Demo Viewer visualization

## Input Context

You will receive the following steering files as XML blocks:

```xml
<tech_md>
{content of .kiro/steering/tech.md}
</tech_md>

<structure_md>
{content of .kiro/steering/structure.md}
</structure_md>

<integration_landscape_md>
{content of .kiro/steering/integration-landscape.md}
</integration_landscape_md>

<agentify_integration_md>
{content of .kiro/steering/agentify-integration.md}
</agentify_integration_md>
```

## Your Task

Generate a markdown file called `roadmap.md` with the following structure:

### 1. How to Use This Roadmap (Section)

Write clear instructions explaining:
- This roadmap contains numbered items, each with a prompt for Kiro
- User copies the prompt and pastes it into Kiro chat
- Kiro generates `spec.md`, then requirements, design, tasks, and implements
- User verifies the acceptance criteria on the implemented code
- Move to next item and repeat

### 2. Architecture Context (Section)

Extract and document the core architecture from `tech.md`:
- Deployment model (local main.py → remote AgentCore agents)
- SDK requirements (Strands)
- Event emission patterns (stdout for graph, DynamoDB for tools)
- Mock tool strategy

Format this as a blockquote that users can reference. This same context is embedded in every item's prompt.

### 3. Pre-existing CDK Infrastructure (Section)

**CRITICAL:** The project includes a pre-existing CDK folder structure that Kiro must NOT modify. Explain this clearly:

```
cdk/                              # PRE-EXISTING — DO NOT MODIFY
├── app.py                        # CDK entry point
├── config.py                     # Environment configuration
├── stacks/
│   ├── networking.py             # VPC, endpoints, security groups
│   ├── observability.py          # DynamoDB table
│   └── gateway_tools.py          # Auto-discovers handlers (Python)
└── gateway/
    └── handlers/                 # EMPTY — Kiro populates this
```

The `gateway_tools.py` stack automatically discovers any handlers in `cdk/gateway/handlers/*/` during deployment. Kiro's job is to CREATE handler directories inside this existing structure.

### 4. Roadmap Items (Multiple Sections)

Generate items in this order:

#### Item 1: Shared Utilities and Instrumentation
- Prompt for Kiro to create `agents/shared/` module with observability infrastructure
- Creates: `instrumentation.py` (@instrument_tool decorator), `dynamodb_client.py` (fire-and-forget writes)
- This MUST be created first as all agents depend on it for tool instrumentation
- Acceptance: Module exists, @instrument_tool decorator defined, DynamoDB client with fire-and-forget pattern

#### Item 2: Gateway Lambda Handlers (Shared Tools) — if any shared tools exist
- Prompt for Kiro to create Python Lambda handlers by **injecting them into the existing CDK structure**
- Path: `cdk/gateway/handlers/{tool_name}/handler.py` (MUST be inside `cdk/` folder)
- Each handler directory contains its own `mock_data.json` (bundled with Lambda at deploy time)
- Each handler parses tool name from context, loads its bundled mock data, returns JSON
- NOTE: The CDK stack (`cdk/stacks/gateway_tools.py`) already exists — Kiro does NOT create or modify it
- NOTE: Gateway setup scripts already exist — Kiro does NOT create them
- Acceptance: Handler files exist in correct path, `cdk deploy` succeeds (auto-discovers handlers)

#### Items 3-N: One Item Per Agent
For each agent in the design:
- Prompt for Kiro to create agent module: `agents/{agent_id}/` with agent.py, prompts.py, tools/
- Prompt for Kiro to create handler: `agents/{agent_id}_handler.py` (AgentCore entry point)
- LOCAL tools defined with BOTH decorators: `@tool` first, then `@instrument_tool` on top
- SHARED tools accessed via Gateway MCP client (not imported locally)
- MUST mention AgentCore deployment in the prompt
- MUST require importing @instrument_tool from `agents.shared.instrumentation`
- Each agent depends on Item 1 (shared utilities)

#### Final Item: Main Orchestrator
- Prompt for Kiro to create `agents/main.py` — the LOCAL entry point
- Prompt must specify CLI contract: `--prompt`, `--workflow-id`, `--trace-id`
- Prompt must specify env vars: `AGENTIFY_TABLE_NAME`, `AWS_REGION`
- Prompt must specify stdout event emission for Demo Viewer
- Acceptance: Running main.py produces stdout events

### Per-Item Format

Each roadmap item MUST follow this exact format:

```markdown
## Item N: {Name}

**Purpose:** {one-line description of what Kiro will build}

**Depends on:** {comma-separated list of item numbers, or "None"}

**Files to be created:**
- `{path/to/file.py}` — {description}

**Prompt for Kiro — Copy everything in the code block below and paste into Kiro chat:**

\`\`\`
{Full prompt text — see template below}
\`\`\`

**Acceptance Criteria (verify after Kiro implements):**
- [ ] {Specific, testable verification step}
- [ ] {Another verification step}
```

### Prompt Template

Every prompt MUST include this architecture context block at the top. **Customize sections 6-7 based on item type:**

```
Create {description of what to create}.

## CRITICAL ARCHITECTURE — READ BEFORE GENERATING CODE

This is an Agentify demo project. Follow these rules strictly:

1. **Agent Deployment**: Agents deploy to Amazon Bedrock AgentCore Runtime via `agentcore deploy`. They run REMOTELY, not locally.

2. **Local Orchestrator Only**: Only `agents/main.py` runs locally. It orchestrates by calling remote agents.

3. **Strands SDK**: Use `from strands import Agent, tool` for agent and tool definitions.

4. **Mock Tools**: All integrations are mocks returning realistic fake data. This is a demo system.

5. **Event Emission**: Emit events per .kiro/steering/agentify-integration.md:
   - DynamoDB writes for tool_call events via @instrument_tool decorator
   - Tools are instrumented with @instrument_tool for observability

6. **Decorator Order for Tools**: Always apply `@tool` first, then `@instrument_tool` on top:
   ```python
   @tool                    # FIRST (inner wrapper)
   @instrument_tool         # ON TOP (outer wrapper)
   def my_tool():
       ...
   ```

7. **Pre-existing CDK Structure**: The project has a pre-built CDK folder. Do NOT create or modify:
   - `cdk/stacks/*.py` — infrastructure stacks (already exist)
   - `cdk/app.py`, `cdk/config.py` — CDK configuration (already exist)
   - Gateway setup scripts (already exist)

8. **Where to Create Files**:
   - Shared utilities: `agents/shared/` directory (instrumentation, DynamoDB client)
   - Gateway Lambda handlers: `cdk/gateway/handlers/{tool_name}/` (inject into existing CDK structure)
   - Agent modules: `agents/{agent_id}/` (agent.py, prompts.py, tools/)
   - Agent handlers: `agents/{agent_id}_handler.py` (AgentCore entry points)
   - Local orchestrator: `agents/main.py`

Reference these steering files:
- .kiro/steering/tech.md — deployment architecture
- .kiro/steering/agentify-integration.md — event contracts
- .kiro/steering/integration-landscape.md — tool definitions and mock data

## Requirements

{Specific requirements for what Kiro should build}
```

## Parsing Instructions

From `integration-landscape.md`, extract:
- Agent names
- Tools per agent (as a list)
- Mock data schemas per tool

From `tech.md`, extract:
- Orchestration pattern (graph/swarm/workflow)
- Deployment commands
- SDK imports

From `agentify-integration.md`, extract:
- CLI argument contract
- Environment variable names
- Event schemas for stdout and DynamoDB

From `structure.md`, extract:
- File organization pattern
- Folder structure

## Example Output Structure

```markdown
# Implementation Roadmap

## How to Use This Roadmap

This roadmap guides you through building your Agentify demo project step by step using Kiro IDE.

**Workflow for each item:**

1. Read the item's **Purpose** and **Files to be created**
2. Copy the **Prompt for Kiro** (everything in the code block)
3. Paste into Kiro chat
4. Kiro creates spec.md → requirements.md → design.md → tasks.md → implementation
5. Verify the **Acceptance Criteria** on the implemented code
6. Move to the next item

**Important:** Complete items in order — later items depend on earlier ones.

---

## Architecture Context

> **Core Architecture (embedded in every prompt):**
>
> - Agents deploy to **Amazon Bedrock AgentCore Runtime** via AgentCore CLI
> - Only `agents/main.py` runs locally — it orchestrates remote agents
> - Use **Strands SDK**: `from strands import Agent, tool`
> - All integrations are **mock tools** (demo system)
> - Emit events to DynamoDB + stdout for Demo Viewer visualization
>
> If Kiro generates code that runs agents locally or skips AgentCore deployment, ask it to correct this.

---

## Pre-existing CDK Infrastructure

The project includes a pre-built CDK folder structure. **Do NOT modify these files:**

```
cdk/                              # PRE-EXISTING — DO NOT MODIFY
├── app.py                        # CDK entry point
├── config.py                     # Environment configuration
├── stacks/
│   ├── networking.py             # VPC, endpoints, security groups
│   ├── observability.py          # DynamoDB table
│   └── gateway_tools.py          # Auto-discovers handlers (Python)
└── gateway/
    └── handlers/                 # EMPTY — Kiro populates this directory
```

**How auto-discovery works:** The `gateway_tools.py` stack scans `cdk/gateway/handlers/*/` during deployment. Any directory containing a `handler.py` file becomes a Lambda function. Kiro's job is to CREATE new handler directories inside this existing structure.

---

## Item 1: Gateway Lambda Handlers (Shared Tools)

**Purpose:** Create Python Lambda handlers for shared tools by injecting them into the existing CDK structure.

**Depends on:** None

**Files to be created (inject into existing CDK structure):**
- `cdk/gateway/handlers/zendesk_get_ticket/handler.py` — Lambda handler (Python 3.11)
- `cdk/gateway/handlers/zendesk_get_ticket/requirements.txt` — Dependencies (if needed)
- `cdk/gateway/handlers/zendesk_get_ticket/mock_data.json` — Mock data bundled with Lambda
- (Repeat for each shared tool defined in integration-landscape.md)

**Pre-built files (do NOT create or modify):**
- `cdk/stacks/gateway_tools.py` — Auto-discovers and deploys handlers
- `cdk/gateway/setup_gateway.py` — Creates Gateway and registers targets
- `cdk/gateway/cleanup_gateway.py` — Tears down Gateway resources

**Prompt for Kiro — Copy everything in the code block below and paste into Kiro chat:**

\`\`\`
Create Lambda handlers for shared tools by injecting them into the existing CDK folder structure.

## CRITICAL ARCHITECTURE — READ BEFORE GENERATING CODE

This is an Agentify demo project. Follow these rules strictly:

1. **Inject Into Existing CDK Structure**: The CDK infrastructure already exists. You are ONLY creating handler directories inside `cdk/gateway/handlers/`. Do NOT create or modify any files in `cdk/stacks/`.

2. **Exact Path**: Create handlers at `cdk/gateway/handlers/{tool_name}/` — the `cdk/` prefix is required.

3. **Auto-Discovery**: The pre-existing `cdk/stacks/gateway_tools.py` automatically discovers any directory in `cdk/gateway/handlers/` that contains a `handler.py` file. It deploys each as a Lambda function.

4. **Mock Data Bundling**: Each handler directory MUST contain its own `mock_data.json` file. This file is bundled with the Lambda at deploy time. Do NOT reference external paths like `../../mocks/` — Lambda cannot access files outside its deployment package.

5. **Lambda Handler Pattern**: Gateway passes tool name with target prefix. Parse using:
   ```python
   delimiter = "___"
   tool_name = context.client_context.custom.get('bedrockAgentCoreToolName', '')
   if delimiter in tool_name:
       tool_name = tool_name[tool_name.index(delimiter) + len(delimiter):]
   ```

Reference:
- .kiro/steering/integration-landscape.md for shared tools list and mock data schemas
- .kiro/steering/tech.md for Gateway Lambda patterns

## Requirements

### 1. Lambda Handler Directories (Python 3.11)
For each shared tool in integration-landscape.md, create `cdk/gateway/handlers/{tool_name}/` containing:

**handler.py** — Lambda handler:
```python
import json
import os

def lambda_handler(event, context):
    # Parse tool name from Gateway context
    delimiter = "___"
    tool_name = context.client_context.custom.get('bedrockAgentCoreToolName', '')
    if delimiter in tool_name:
        tool_name = tool_name[tool_name.index(delimiter) + len(delimiter):]

    # Load mock data bundled with this Lambda
    mock_file = os.path.join(os.path.dirname(__file__), 'mock_data.json')
    with open(mock_file) as f:
        mock_data = json.load(f)

    # Process input from event
    input_params = event  # event contains the tool input parameters

    # Return mock response (customize based on tool logic)
    return json.dumps({"status": "success", "data": mock_data})
```

**mock_data.json** — Realistic sample data for this specific tool:
```json
{
    "records": [
        {"id": "1", "field": "value"},
        {"id": "2", "field": "value"}
    ]
}
```

**requirements.txt** — Only if dependencies beyond boto3 are needed (often empty)

### 2. Directory Structure After Implementation
```
cdk/gateway/handlers/
├── zendesk_get_ticket/
│   ├── handler.py
│   ├── mock_data.json
│   └── requirements.txt
├── zendesk_get_comments/
│   ├── handler.py
│   ├── mock_data.json
│   └── requirements.txt
└── customer_lookup/
    ├── handler.py
    ├── mock_data.json
    └── requirements.txt
```

### 3. What NOT to Create
- Do NOT create `cdk/stacks/*.py` files — they already exist
- Do NOT create `cdk/app.py` or `cdk/config.py` — they already exist
- Do NOT create gateway setup scripts — they already exist
- Do NOT create a separate `mocks/` directory — mock data goes inside each handler directory
\`\`\`

**Acceptance Criteria (verify after Kiro implements):**
- [ ] `cdk/gateway/handlers/{tool_name}/handler.py` exists for each shared tool
- [ ] `cdk/gateway/handlers/{tool_name}/mock_data.json` exists with realistic sample data
- [ ] Handler code loads mock data from same directory (not external path)
- [ ] Handler code uses the correct tool name parsing pattern
- [ ] `cd cdk && cdk deploy` succeeds (auto-discovers all handlers)
- [ ] No files in `cdk/stacks/` were created or modified

---

## Item 2: Ticket Analyzer Agent

**Purpose:** Create the Ticket Analyzer agent with local tools and Gateway connection.

**Depends on:** Item 1 (Gateway Lambda Handlers must be deployed first)

**Files to be created:**
- `agents/ticket_analyzer.py` — Agent with local and Gateway tools
- `agents/mock_data/ticket_analyzer/sentiment_responses.json` — Mock data for local tools (optional)

**Prompt for Kiro — Copy everything in the code block below and paste into Kiro chat:**

\`\`\`
Create the Ticket Analyzer agent for an Agentify demo project.

## CRITICAL ARCHITECTURE — READ BEFORE GENERATING CODE

This is an Agentify demo project. Follow these rules strictly:

1. **Agent Deployment**: Agents deploy to Amazon Bedrock AgentCore Runtime via `agentcore deploy`. They run REMOTELY, not locally.

2. **Local Orchestrator Only**: Only `agents/main.py` runs locally. It orchestrates by calling remote agents.

3. **Strands SDK**: Use `from strands import Agent, tool` for agent and tool definitions.

4. **Two Tool Types**:
   - LOCAL tools: Defined inline with @tool decorator (agent-specific, mock data embedded or in `agents/mock_data/`)
   - SHARED tools: Loaded from Gateway via MCP client (Lambda handlers in `cdk/gateway/handlers/`)

5. **Event Emission**: Emit events per .kiro/steering/agentify-integration.md

6. **Pre-existing Infrastructure**: Gateway Lambda handlers already exist in `cdk/gateway/handlers/`. Do NOT recreate them.

Reference these steering files:
- .kiro/steering/tech.md — deployment architecture and Gateway patterns
- .kiro/steering/agentify-integration.md — event contracts
- .kiro/steering/integration-landscape.md — tool definitions (local vs shared)

## Requirements

Create `agents/ticket_analyzer.py` with:

1. **Agent Definition** using Strands SDK:
   - Name: "Ticket Analyzer"
   - Role: Analyzes incoming support tickets for sentiment, urgency, and classification

2. **LOCAL Tools** (defined inline with @tool, only this agent uses them):
   - `aiml_analyze_sentiment(text: str) -> dict` — Returns mock sentiment analysis
   - `aiml_classify_text(text: str, categories: list) -> str` — Returns mock classification
   - Mock data can be embedded directly in the tool function or loaded from `agents/mock_data/`

3. **SHARED Tools** (loaded from Gateway, Lambda handlers already exist in `cdk/gateway/handlers/`):
   ```python
   from strands.tools.mcp import MCPClient
   from mcp.client.streamable_http import streamablehttp_client

   def get_gateway_tools(gateway_url: str, access_token: str) -> list:
       client = MCPClient(lambda: streamablehttp_client(
           gateway_url,
           headers={"Authorization": f"Bearer {access_token}"}
       ))
       with client:
           return client.list_tools_sync()
   ```
   - zendesk_get_ticket, zendesk_get_ticket_comments, ecommerce_get_customer_orders come from Gateway

4. Agent combines local + shared tools: `Agent(tools=local_tools + shared_tools)`

5. Agent emits events to DynamoDB for tool calls

This agent deploys to AgentCore Runtime. Include a comment with the deployment command:
# Deploy: agentcore deploy agents/ticket_analyzer.py
\`\`\`

**Acceptance Criteria (verify after Kiro implements):**
- [ ] `agents/ticket_analyzer.py` exists with Agent class
- [ ] Local tools (aiml_*) defined with @tool decorator returning mock data
- [ ] Shared tools loaded from Gateway via MCP client
- [ ] `agentcore deploy agents/ticket_analyzer.py` succeeds
- [ ] Both local and shared tools work when agent is invoked

---

... [continue pattern for remaining items] ...

## Item N: Main Orchestrator

**Purpose:** Create the local entry point that orchestrates remote agents.

**Depends on:** Items 1 through N-1

**Files to be created:**
- `agents/main.py` — Local orchestrator with CLI interface

**Prompt for Kiro — Copy everything in the code block below and paste into Kiro chat:**

\`\`\`
Create the main orchestrator for an Agentify demo project.

## CRITICAL ARCHITECTURE — READ BEFORE GENERATING CODE

This is an Agentify demo project. Follow these rules strictly:

1. **Agent Deployment**: Agents deploy to Amazon Bedrock AgentCore Runtime via `agentcore deploy`. They run REMOTELY, not locally.

2. **Local Orchestrator Only**: Only `agents/main.py` runs locally. It orchestrates by calling remote agents.

3. **Strands SDK**: Use `from strands import Agent, tool` for agent and tool definitions.

4. **Mock Tools**: All integrations are mocks returning realistic fake data. This is a demo system.

5. **Event Emission**: Emit events per .kiro/steering/agentify-integration.md

Reference these steering files:
- .kiro/steering/tech.md — deployment architecture  
- .kiro/steering/agentify-integration.md — event contracts and CLI specification

## Requirements

Create `agents/main.py` as the LOCAL entry point:

1. **CLI Interface** using argparse:
   - `--prompt` (required): The user's input prompt
   - `--workflow-id` (required): Short ID like wf-abc123
   - `--trace-id` (required): 32-char hex OTEL trace ID

2. **Environment Variables**:
   - Read `AGENTIFY_TABLE_NAME` for DynamoDB table
   - Read `AWS_REGION` for AWS region

3. **stdout Event Emission** (JSON lines format):
   - `graph_structure` on startup with agent topology
   - `node_start` when each agent begins
   - `node_stop` when each agent completes
   - `workflow_complete` or `workflow_error` at end

4. **Orchestration**:
   - Use Strands Workflow/Graph/Swarm class (per tech.md pattern)
   - Call remote agents deployed to AgentCore

This file runs LOCALLY — it is NOT deployed to AgentCore.
\`\`\`

**Acceptance Criteria (verify after Kiro implements):**
- [ ] `agents/main.py` exists with argparse CLI
- [ ] Running `python agents/main.py --help` shows all three required arguments
- [ ] Running with test args produces JSON lines on stdout
- [ ] `graph_structure` event emitted first
- [ ] `workflow_complete` or `workflow_error` event emitted last
```

## Final Checklist

Before outputting the roadmap, verify:

### Architecture & Deployment
1. [ ] Every prompt includes the full CRITICAL ARCHITECTURE block
2. [ ] Every agent item's prompt mentions "deploys to AgentCore Runtime"
3. [ ] Every agent item's acceptance criteria includes `agentcore deploy` command
4. [ ] The main.py item's prompt explicitly states it runs LOCALLY
5. [ ] The main.py item's prompt specifies CLI contract (--prompt, --workflow-id, --trace-id)

### Instrumentation & Observability
6. [ ] Item 1 creates shared utilities (`agents/shared/`) before any agents
7. [ ] Every agent item requires importing @instrument_tool from agents.shared.instrumentation
8. [ ] Every agent item shows correct decorator order: @tool first, @instrument_tool on top
9. [ ] Agent handlers (agents/{agent_id}_handler.py) set/clear instrumentation context

### CDK Structure & Injection
10. [ ] Gateway Lambda handlers use path `cdk/gateway/handlers/{tool_name}/` (with `cdk/` prefix)
11. [ ] Each Lambda handler directory contains `mock_data.json` (bundled, not external reference)
12. [ ] Lambda handler example loads mock data from same directory: `os.path.dirname(__file__)`
13. [ ] Pre-existing CDK structure is clearly documented (stacks/, app.py, config.py)
14. [ ] "What NOT to Create" section explicitly lists `cdk/stacks/*.py` as off-limits
15. [ ] No references to `gateway/handlers/` without the `cdk/` prefix
16. [ ] No references to external `mocks/` directory for Lambda handlers

### Dependencies & Order
17. [ ] Items are ordered: shared utilities → Gateway handlers → agents → orchestrator
18. [ ] No item assumes local-only execution for agents
19. [ ] All tools are mocks (demo system)
20. [ ] Event emission patterns are referenced in each prompt

### Path Consistency
21. [ ] All paths use forward slashes (not backslashes)
22. [ ] Agent modules go in `agents/{agent_id}/` directory
23. [ ] Agent handlers go in `agents/{agent_id}_handler.py`
24. [ ] Lambda handlers go in `cdk/gateway/handlers/` directory
25. [ ] No TypeScript references (CDK is Python: `cdk/stacks/gateway_tools.py`)

## Output

Generate the complete `roadmap.md` content following the structure above. The output should be ready to write directly to `.kiro/steering/roadmap.md`.
