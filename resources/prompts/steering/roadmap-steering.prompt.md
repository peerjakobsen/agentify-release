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
- NO agent code yet — just data and utilities
- Acceptance: JSON files load correctly, mock_utils imports work

#### Items 2-N: One Item Per Agent
For each agent in the design:
- Prompt for Kiro to create `agents/{agent_name}.py` with Agent class and inline tools
- Tools defined inline (not imported) unless shared
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

## Item 2: Ticket Analyzer Agent

**Purpose:** Create the Ticket Analyzer agent with its 5 inline tools.

**Depends on:** Item 1

**Files to be created:**
- `agents/ticket_analyzer.py` — Agent with zendesk and AI/ML tools

**Prompt for Kiro — Copy everything in the code block below and paste into Kiro chat:**

\`\`\`
Create the Ticket Analyzer agent for an Agentify demo project.

## CRITICAL ARCHITECTURE — READ BEFORE GENERATING CODE

This is an Agentify demo project. Follow these rules strictly:

1. **Agent Deployment**: Agents deploy to Amazon Bedrock AgentCore Runtime via `agentcore deploy`. They run REMOTELY, not locally.

2. **Local Orchestrator Only**: Only `agents/main.py` runs locally. It orchestrates by calling remote agents.

3. **Strands SDK**: Use `from strands import Agent, tool` for agent and tool definitions.

4. **Mock Tools**: All integrations are mocks returning realistic fake data. This is a demo system.

5. **Event Emission**: Emit events per .kiro/steering/agentify-integration.md

Reference these steering files:
- .kiro/steering/tech.md — deployment architecture
- .kiro/steering/agentify-integration.md — event contracts
- .kiro/steering/integration-landscape.md — tool definitions and mock data

## Requirements

Create `agents/ticket_analyzer.py` with:

1. **Agent Definition** using Strands SDK:
   - Name: "Ticket Analyzer"
   - Role: Analyzes incoming support tickets for sentiment, urgency, and classification

2. **Inline Tools** (define within this file, not imported):
   - `zendesk_get_ticket(ticket_id: str) -> dict` — Fetches ticket details
   - `zendesk_get_ticket_comments(ticket_id: str) -> list` — Gets ticket conversation
   - `ecommerce_get_customer_orders(customer_id: str) -> list` — Gets order history
   - `aiml_analyze_sentiment(text: str) -> dict` — Returns sentiment analysis
   - `aiml_classify_text(text: str, categories: list) -> str` — Classifies text

3. Each tool uses `load_mock_data()` from `tools/mock_utils.py`

4. Agent emits events to DynamoDB for tool calls

This agent deploys to AgentCore Runtime. Include a comment with the deployment command.
\`\`\`

**Acceptance Criteria (verify after Kiro implements):**
- [ ] `agents/ticket_analyzer.py` exists with Agent class
- [ ] All 5 tools defined with @tool decorator
- [ ] `agentcore deploy agents/ticket_analyzer.py` succeeds
- [ ] Tools return mock data correctly when tested

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
