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

### 3. Roadmap Items (Multiple Sections)

Generate items in this order:

#### Item 1: Mock Data Infrastructure
- Prompt for Kiro to create shared mock data files (JSON) and utilities
- These are used by both local agent tools AND Gateway Lambda handlers
- Acceptance: JSON files load correctly, mock_utils imports work

#### Item 2: Gateway Lambda Stack (CDK)
- Prompt for Kiro to extend `cdk/lib/` with `gateway-tools-stack.ts`
- Creates Lambda functions for each shared tool (reads handlers from `gateway/handlers/`)
- Outputs Lambda ARNs for Gateway registration
- Acceptance: `cdk deploy` creates Lambda functions in AWS

#### Item 3: Gateway Setup & Target Registration
- Prompt for Kiro to create `gateway/setup_gateway.py` using `bedrock-agentcore-starter-toolkit`
- Creates Gateway with OAuth authorizer (Cognito)
- Reads Lambda ARNs from CDK outputs or `cdk-outputs.json`
- Registers each Lambda as a Gateway target with tool schemas from `gateway/schemas/`
- Saves `gateway_config.json` with Gateway URL, ID, and credentials
- Acceptance: Gateway URL accessible, tools discoverable via MCP

#### Items 4-N: One Item Per Agent
For each agent in the design:
- Prompt for Kiro to create `agents/{agent_name}.py` with Agent class and inline tools
- LOCAL tools defined inline using @tool decorator
- SHARED tools accessed via Gateway MCP client (not imported locally)
- MUST mention AgentCore deployment in the prompt
- Reference mock data from Item 1

#### Final Item: Main Orchestrator
- Prompt for Kiro to create `agents/main.py` — the LOCAL entry point
- Prompt must specify CLI contract: `--prompt`, `--workflow-id`, `--trace-id`
- Prompt must specify env vars: `AGENTIFY_TABLE_NAME`, `AGENTIFY_TABLE_REGION`
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

Every prompt MUST include this architecture context block at the top:

```
Create {description of what to create}.

## CRITICAL ARCHITECTURE — READ BEFORE GENERATING CODE

This is an Agentify demo project. Follow these rules strictly:

1. **Agent Deployment**: Agents deploy to Amazon Bedrock AgentCore Runtime via `agentcore deploy`. They run REMOTELY, not locally.

2. **Local Orchestrator Only**: Only `agents/main.py` runs locally. It orchestrates by calling remote agents.

3. **Strands SDK**: Use `from strands import Agent, tool` for agent and tool definitions.

4. **Mock Tools**: All integrations are mocks returning realistic fake data. This is a demo system.

5. **Event Emission**: Emit events per .kiro/steering/agentify-integration.md:
   - stdout JSON lines for graph visualization (node_start, node_stop, etc.)
   - DynamoDB writes for tool_call events

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

## Item 1: Mock Data Infrastructure

**Purpose:** Create shared mock data files and utilities for all agent tools.

**Depends on:** None

**Files to be created:**
- `mocks/zendesk/tickets.json` — Sample ticket data
- `mocks/zendesk/customers.json` — Sample customer data
- `tools/mock_utils.py` — Helper functions for loading mock data

**Prompt for Kiro — Copy everything in the code block below and paste into Kiro chat:**

\`\`\`
Create the mock data infrastructure for an Agentify demo project.

## CRITICAL ARCHITECTURE — READ BEFORE GENERATING CODE

This is an Agentify demo project. Follow these rules strictly:

1. **Agent Deployment**: Agents deploy to Amazon Bedrock AgentCore Runtime via `agentcore deploy`. They run REMOTELY, not locally.

2. **Local Orchestrator Only**: Only `agents/main.py` runs locally. It orchestrates by calling remote agents.

3. **Strands SDK**: Use `from strands import Agent, tool` for agent and tool definitions.

4. **Mock Tools**: All integrations are mocks returning realistic fake data. This is a demo system.

5. **Event Emission**: Emit events per .kiro/steering/agentify-integration.md

Reference: .kiro/steering/integration-landscape.md for mock data schemas

## Requirements

Create mock data infrastructure:

1. Create `mocks/` directory with subdirectories per system (zendesk/, ecommerce/, etc.)

2. Create JSON files with realistic sample data matching schemas in integration-landscape.md

3. Create `tools/mock_utils.py` with:
   - `load_mock_data(system: str, filename: str) -> dict` — loads JSON from mocks/{system}/{filename}.json
   - `MockToolDecorator` class that wraps tool calls to emit DynamoDB events

4. Include 3-5 realistic records per mock data file using industry-appropriate terminology

Do NOT create any agent code yet — this item is only for mock data infrastructure.
\`\`\`

**Acceptance Criteria (verify after Kiro implements):**
- [ ] `mocks/` directory exists with JSON files
- [ ] `from tools.mock_utils import load_mock_data` works in Python
- [ ] JSON files contain realistic sample data

---

## Item 2: Gateway Lambda Stack (CDK)

**Purpose:** Extend CDK to deploy Lambda functions for shared tools behind AgentCore Gateway.

**Depends on:** Item 1

**Files to be created:**
- `cdk/lib/gateway-tools-stack.ts` — CDK stack for Lambda functions
- `cdk/bin/app.ts` — Update to include new stack
- `gateway/handlers/zendesk_get_ticket/handler.py` — Lambda handler code
- `gateway/handlers/zendesk_get_ticket/requirements.txt` — Lambda dependencies
- `gateway/schemas/zendesk_get_ticket.json` — Tool schema for Gateway registration

**Prompt for Kiro — Copy everything in the code block below and paste into Kiro chat:**

\`\`\`
Extend the CDK infrastructure to deploy Lambda functions for AgentCore Gateway shared tools.

## CRITICAL ARCHITECTURE — READ BEFORE GENERATING CODE

This is an Agentify demo project. Follow these rules strictly:

1. **Shared Tools**: Tools used by multiple agents are deployed as Lambda functions behind Gateway.

2. **CDK Structure**: The `cdk/` folder already exists with DynamoDB stack. Add a new stack for Gateway tools.

3. **Lambda Handler Pattern**: Gateway passes tool name with target prefix. Parse using:
   ```python
   delimiter = "___"
   tool_name = context.client_context.custom.get('bedrockAgentCoreToolName', '')
   if delimiter in tool_name:
       tool_name = tool_name[tool_name.index(delimiter) + len(delimiter):]
   ```

4. **Mock Data**: Lambda handlers load mock data from `mocks/` (bundled in deployment package).

Reference: 
- .kiro/steering/integration-landscape.md for shared tools list
- .kiro/steering/tech.md for Gateway Lambda patterns
- .kiro/steering/structure.md for CDK folder location

## Requirements

### 1. Lambda Handlers
For each shared tool in integration-landscape.md, create `gateway/handlers/{tool_name}/`:
- `handler.py` — Lambda handler that parses tool name from context, loads mock data, returns JSON
- `requirements.txt` — Minimal dependencies

### 2. Tool Schemas
Create `gateway/schemas/{tool_name}.json` with MCP tool schema:
- name, description, inputSchema with properties and required fields

### 3. CDK Stack
Create `cdk/lib/gateway-tools-stack.ts` that:
- Imports Lambda handlers from `gateway/handlers/`
- Creates a Lambda function for each shared tool using `lambda.Function` with Python runtime
- Bundles mock data from `mocks/` into Lambda deployment package
- Exports Lambda ARNs as CloudFormation outputs
- Uses `CfnOutput` to write ARNs for later Gateway registration

### 4. Update CDK App
Update `cdk/bin/app.ts` to:
- Import and instantiate `GatewayToolsStack`
- Pass outputs to JSON file using `--outputs-file cdk-outputs.json`

Include comment: "After `cdk deploy`, run `python gateway/setup_gateway.py` to register Lambdas with Gateway."
\`\`\`

**Acceptance Criteria (verify after Kiro implements):**
- [ ] `cdk/lib/gateway-tools-stack.ts` exists with Lambda definitions
- [ ] `gateway/handlers/` contains handler code for each shared tool
- [ ] `gateway/schemas/` contains tool schemas
- [ ] `cdk deploy GatewayToolsStack` creates Lambda functions in AWS
- [ ] Lambda ARNs appear in `cdk-outputs.json`

---

## Item 3: Gateway Setup & Target Registration

**Purpose:** Create AgentCore Gateway and register deployed Lambda functions as targets.

**Depends on:** Items 1, 2

**Files to be created:**
- `gateway/setup_gateway.py` — Script to create Gateway and register Lambda targets
- `gateway/cleanup_gateway.py` — Script to tear down Gateway resources
- `gateway_config.json` — Gateway URL, ID, and OAuth credentials (generated at runtime)

**Prompt for Kiro — Copy everything in the code block below and paste into Kiro chat:**

\`\`\`
Create the AgentCore Gateway setup and Lambda target registration scripts.

## CRITICAL ARCHITECTURE — READ BEFORE GENERATING CODE

This is an Agentify demo project. Follow these rules strictly:

1. **Gateway Purpose**: AgentCore Gateway exposes shared tools as MCP-compatible endpoints. Multiple agents connect to one Gateway.

2. **Prerequisites**: Lambda functions must already be deployed via CDK (`cdk deploy GatewayToolsStack`).

3. **OAuth Security**: Gateway uses Cognito OAuth for authentication. Agents obtain tokens to call Gateway.

4. **Toolkit**: Use `bedrock-agentcore-starter-toolkit` Python SDK (GatewayClient) for Gateway operations.

Reference:
- .kiro/steering/tech.md for Gateway architecture
- .kiro/steering/integration-landscape.md for shared tools list

## Requirements

### 1. Create `gateway/setup_gateway.py` that:

a) **Reads CDK outputs** from `cdk-outputs.json` to get Lambda ARNs:
   ```python
   with open('cdk-outputs.json') as f:
       outputs = json.load(f)
   lambda_arns = outputs['GatewayToolsStack']
   ```

b) **Creates Gateway** with OAuth:
   ```python
   from bedrock_agentcore_starter_toolkit.operations.gateway.client import GatewayClient
   client = GatewayClient(region_name="us-east-1")
   cognito = client.create_oauth_authorizer_with_cognito("ProjectGateway")
   gateway = client.create_mcp_gateway(
       name="ProjectGateway",
       authorizer_config=cognito["authorizer_config"],
       enable_semantic_search=True
   )
   client.fix_iam_permissions(gateway)
   time.sleep(30)  # IAM propagation
   ```

c) **Registers each Lambda as a target** by reading schemas from `gateway/schemas/`:
   ```python
   for tool_name, lambda_arn in lambda_arns.items():
       schema = load_schema(f"gateway/schemas/{tool_name}.json")
       client.create_mcp_gateway_target(
           gateway=gateway,
           name=tool_name,
           target_type="lambda",
           target_payload={"lambdaArn": lambda_arn},
           tool_schema=schema
       )
   ```

d) **Saves config** to `gateway_config.json` with gateway_url, gateway_id, region, client_info

### 2. Create `gateway/cleanup_gateway.py` that:
- Loads `gateway_config.json`
- Calls `client.cleanup_gateway()` to remove all resources

### 3. Add to `requirements.txt`:
- `bedrock-agentcore-starter-toolkit`
\`\`\`

**Acceptance Criteria (verify after Kiro implements):**
- [ ] Running `python gateway/setup_gateway.py` creates Gateway and registers targets
- [ ] `gateway_config.json` contains gateway_url and client_info
- [ ] Gateway tools/list endpoint returns all shared tools
- [ ] Running `python gateway/cleanup_gateway.py` removes resources

---

## Item 4: Ticket Analyzer Agent

**Purpose:** Create the Ticket Analyzer agent with local tools and Gateway connection.

**Depends on:** Items 1, 2, 3

**Files to be created:**
- `agents/ticket_analyzer.py` — Agent with local and Gateway tools

**Prompt for Kiro — Copy everything in the code block below and paste into Kiro chat:**

\`\`\`
Create the Ticket Analyzer agent for an Agentify demo project.

## CRITICAL ARCHITECTURE — READ BEFORE GENERATING CODE

This is an Agentify demo project. Follow these rules strictly:

1. **Agent Deployment**: Agents deploy to Amazon Bedrock AgentCore Runtime via `agentcore deploy`. They run REMOTELY, not locally.

2. **Local Orchestrator Only**: Only `agents/main.py` runs locally. It orchestrates by calling remote agents.

3. **Strands SDK**: Use `from strands import Agent, tool` for agent and tool definitions.

4. **Two Tool Types**:
   - LOCAL tools: Defined inline with @tool decorator (agent-specific)
   - SHARED tools: Loaded from Gateway via MCP client (used by multiple agents)

5. **Event Emission**: Emit events per .kiro/steering/agentify-integration.md

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
   - `aiml_analyze_sentiment(text: str) -> dict` — Returns sentiment analysis
   - `aiml_classify_text(text: str, categories: list) -> str` — Classifies text

3. **SHARED Tools** (loaded from Gateway, used by multiple agents):
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

This agent deploys to AgentCore Runtime. Include a comment with the deployment command.
\`\`\`

**Acceptance Criteria (verify after Kiro implements):**
- [ ] `agents/ticket_analyzer.py` exists with Agent class
- [ ] Local tools (aiml_*) defined with @tool decorator
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
   - Read `AGENTIFY_TABLE_REGION` for AWS region

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

1. [ ] Every prompt includes the full CRITICAL ARCHITECTURE block
2. [ ] Every agent item's prompt mentions "deploys to AgentCore Runtime"
3. [ ] Every agent item's acceptance criteria includes `agentcore deploy` command
4. [ ] The main.py item's prompt explicitly states it runs LOCALLY
5. [ ] The main.py item's prompt specifies CLI contract (--prompt, --workflow-id, --trace-id)
6. [ ] Items are ordered by dependencies
7. [ ] No item assumes local-only execution for agents
8. [ ] All tools are mocks (demo system)
9. [ ] Event emission patterns are referenced in each prompt

## Output

Generate the complete `roadmap.md` content following the structure above. The output should be ready to write directly to `.kiro/steering/roadmap.md`.
