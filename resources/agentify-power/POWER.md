---
name: "agentify"
displayName: "Agentify Observability"
description: "Observability patterns for Agentify multi-agent workflows with Demo Viewer integration"
keywords: ["agent", "workflow", "Strands", "orchestrator", "demo", "multi-agent", "tool", "handler", "instrumentation"]
---

# Agentify Power

Quick reference for Agentify multi-agent workflow observability patterns. These 9 critical patterns ensure your agents work correctly with the Demo Viewer.

> For complete details, see `.kiro/steering/agentify-integration.md`

---

## Pattern 1: Pre-bundled Infrastructure

**ALWAYS** import from `agents/shared/` - never recreate these modules locally.

```python
# CORRECT - Import from shared
from agents.shared.instrumentation import instrument_tool, set_instrumentation_context, clear_instrumentation_context
from agents.shared.dynamodb_client import write_tool_event
from agents.shared.gateway_client import invoke_with_gateway

# WRONG - Never define these locally
def instrument_tool(func):  # BLOCKING ERROR
    ...
```

The `agents/shared/` directory contains pre-built infrastructure for observability and Gateway integration.

---

## Pattern 2: Decorator Order

`@tool` ON TOP, `@instrument_tool` BELOW (closer to function). Python applies decorators bottom-up.

```python
# CORRECT - @tool on top, @instrument_tool below
@tool                    # Applied second (registers with Strands)
@instrument_tool         # Applied first (wraps function for observability)
def my_tool(param: str) -> dict:
    """Tool description."""
    return {'result': param}

# WRONG - Reversed order breaks instrumentation
@instrument_tool
@tool                    # BLOCKING ERROR - won't register correctly
def my_tool(param: str) -> dict:
    ...
```

---

## Pattern 3: Agent Handler Pattern

Set context in `try`, clear in `finally`. This correlates all tool events for a request.

```python
@app.entrypoint
def invoke(event: dict[str, Any]) -> dict[str, Any]:
    session_id = ctx.get_session_id() or event.get('session_id', '')

    try:
        # Set context FIRST - before any tools execute
        if session_id:
            set_instrumentation_context(session_id, 'my_agent')

        # Agent logic here...
        response = agent.invoke(event.get('prompt', ''))
        return {'response': response}

    finally:
        # ALWAYS clear context - even on exceptions
        if session_id:
            clear_instrumentation_context()
```

---

## Pattern 3.5: Agent Definition Pattern

Use `invoke_with_gateway()` for agent.py - never use MCPClient directly.

```python
# CORRECT - invoke_with_gateway handles session lifecycle
from agents.shared.gateway_client import invoke_with_gateway
from .prompts import SYSTEM_PROMPT
from .tools import my_tool

def invoke_my_agent(prompt: str) -> str:
    return invoke_with_gateway(
        prompt=prompt,
        local_tools=[my_tool],
        system_prompt=SYSTEM_PROMPT
    )

# WRONG - Direct MCPClient causes "session not running" errors
from strands.tools.mcp import MCPClient
with MCPClient(...) as client:
    tools = client.list_tools_sync()  # BLOCKING ERROR - session closes!
```

---

## Pattern 4: Gateway Lambda Handler

Mock data co-located, return JSON string via `json.dumps()`.

```python
import json
import os

def handler(event, context):
    # Support local development with co-located mock data
    mock_path = os.path.join(os.path.dirname(__file__), 'mock_data.json')
    if os.path.exists(mock_path):
        with open(mock_path, 'r') as f:
            return json.dumps(json.load(f))

    # Production logic...
    result = {'status': 'ok', 'data': process(event)}

    # ALWAYS return JSON string - API Gateway requires it
    return json.dumps(result)  # NOT: return result
```

---

## Pattern 5: Event Emission

**stdout events** for real-time graph visualization, **DynamoDB tool events** for persistent observability.

```python
# Real-time: stdout JSON Lines (flush=True required)
import json
import time

def emit_stdout_event(event_type, workflow_id, trace_id, **kwargs):
    event = {
        'workflow_id': workflow_id,
        'trace_id': trace_id,
        'timestamp': int(time.time() * 1000),  # Epoch milliseconds
        'type': event_type,
        **kwargs
    }
    print(json.dumps(event), flush=True)  # flush=True is CRITICAL

# Persistent: DynamoDB via @instrument_tool decorator
# Tool events are automatically written by the decorator
@instrument_tool
@tool
def my_tool(param: str) -> dict:
    return {'result': param}  # Started/completed events auto-written
```

---

## Pattern 6: AgentCore CLI Deployment

Deploy with `agentcore deploy`. Only `main.py` runs locally via Demo Viewer.

```bash
# Deploy all agents to AgentCore Runtime
agentcore deploy

# Local development - Demo Viewer spawns main.py directly
# main.py must accept these CLI arguments:
python agents/main.py \
  --prompt "User query" \
  --workflow-id "wf-abc12345" \
  --trace-id "80e1afed08e019fc1110464cfa66635c"
```

Environment variables required for local runs:
- `AGENTIFY_TABLE_NAME` - DynamoDB table for tool events
- `AWS_REGION` - AWS region for DynamoDB

---

## Pattern 7: Common Pitfalls

| Pitfall | Why It Breaks | Fix |
|---------|--------------|-----|
| Recreating `agents/shared/` modules | Demo Viewer won't see events | Import from `agents.shared.instrumentation` |
| `@instrument_tool` above `@tool` | Strands doesn't register tool correctly | Put `@tool` on top, `@instrument_tool` below |
| Missing `finally` block | Context leaks between requests | Always `clear_instrumentation_context()` in finally |
| Using `MCPClient` directly | MCP session closes before tools execute | Use `invoke_with_gateway()` from `agents.shared.gateway_client` |
| Returning dict from Lambda | API Gateway expects string | Use `json.dumps(result)` |
| Missing `flush=True` | stdout buffering delays events | Always `print(json.dumps(event), flush=True)` |
| Using ISO timestamps | Demo Viewer expects epoch ms | Use `int(time.time() * 1000)` |
| Forgetting mock_data.json | Can't test Lambda locally | Co-locate mock_data.json with handler.py |

---

## Pattern 8: Haiku Routing (Optional)

Use Claude Haiku for fast, cheap routing decisions (~10x cheaper, ~3x faster than Sonnet).

### When to Use Haiku Routing

- **Graph pattern**: Complex multi-agent workflows with dynamic routing
- **Swarm pattern**: Safety net when agents don't specify explicit handoffs
- **Cost optimization**: High-volume workflows where routing costs matter
- **Latency reduction**: Time-sensitive routing decisions

### Configuration

Enable in `.agentify/config.json`:

```json
{
  "routing": {
    "useHaikuRouter": true,
    "routerModel": "global.anthropic.claude-haiku-4-5-20251001-v1:0",
    "fallbackToAgentDecision": true
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `useHaikuRouter` | `false` | Enable Haiku routing (opt-in to avoid surprise costs) |
| `routerModel` | Global Haiku ID | Override for SCP-restricted accounts |
| `fallbackToAgentDecision` | `true` | Fall back silently to existing strategies on failure |

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                     Haiku Router Flow                            │
│                                                                  │
│  Agent Response                    Routing Decision              │
│  (truncated ~500 chars)                                          │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────┐    ┌─────────────────────────────────────┐│
│  │  route_with_     │───►│  Claude Haiku (~10x cheaper)        ││
│  │  haiku()         │    │  - Agent name                       ││
│  │                  │    │  - Truncated response               ││
│  │                  │    │  - Available agents list            ││
│  │                  │    │  - Routing guidance (from tech.md)  ││
│  └──────────────────┘    └─────────────────────────────────────┘│
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────┐                                            │
│  │ Returns:         │                                            │
│  │ - "agent_id"     │──► Route to specified agent                │
│  │ - "COMPLETE"     │──► End workflow                            │
│  │ - None           │──► Fall back to existing strategies       │
│  └──────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Routing Guidance (Optional)

Add a `## Routing Guidance` section to `.kiro/steering/tech.md`:

```markdown
## Routing Guidance

### Agent Responsibilities
- **triage_agent**: Initial classification. Always starts here.
- **technical_agent**: Handles bugs, errors, and feature requests.
- **billing_agent**: Handles payments and subscriptions.

### Routing Rules
1. Route to `technical_agent` for technical issues
2. Route to `billing_agent` for payment questions
3. Return COMPLETE when request is resolved

### Edge Cases
- Default to `technical_agent` if unclear
```

### Pattern Integration

**Graph Pattern (Strategy 0)**:
```
┌───────────────────────────────────────────────────────────────┐
│  route_to_next_agent() Strategies                              │
│                                                                │
│  Strategy 0: Haiku Router (if useHaikuRouter: true)           │
│       │                                                        │
│       ▼ (on None/failure, fall through)                       │
│  Strategy 1: Explicit routing (route_to field)                │
│       │                                                        │
│       ▼ (on None, fall through)                               │
│  Strategy 2: Classification routing                           │
│       │                                                        │
│       ▼ (on None, fall through)                               │
│  Strategy 3: Static routing                                   │
│       │                                                        │
│       ▼ (on None, fall through)                               │
│  Strategy 4: Complete workflow                                │
└───────────────────────────────────────────────────────────────┘
```

**Swarm Pattern (Safety Net)**:
```
┌───────────────────────────────────────────────────────────────┐
│  extract_handoff_from_response() Flow                          │
│                                                                │
│  1. Check agent's own handoff decision (primary)              │
│       │                                                        │
│       ▼ (if no explicit handoff)                              │
│  2. Haiku fallback (if useHaikuRouter: true)                  │
│       │                                                        │
│       ▼ (if Haiku fails or disabled)                          │
│  3. No handoff (workflow may complete)                        │
└───────────────────────────────────────────────────────────────┘
```

### Router Decision Events

Successful Haiku routing emits a `router_decision` event:

```json
{
  "event_type": "router_decision",
  "timestamp": 1234567890,
  "workflow_id": "wf-xxx",
  "trace_id": "32-char-hex",
  "router_model": "haiku",
  "from_agent": "triage_agent",
  "next_agent": "technical_agent",
  "duration_ms": 12
}
```

### Cost/Speed Benefits

| Model | Relative Cost | Typical Latency | Use Case |
|-------|--------------|-----------------|----------|
| Sonnet | 1x | ~1.5-3s | Full agent reasoning |
| Haiku | ~0.1x (10x cheaper) | ~0.3-0.5s (3x faster) | Quick routing decisions |

For a workflow with 5 routing decisions:
- **Without Haiku**: 5 x Sonnet inference = 5x cost
- **With Haiku**: 5 x Haiku inference = ~0.5x cost (90% savings)

### Fallback Behavior

The Haiku router is designed to fail gracefully:

```python
# Automatic fallback on any failure:
# - Haiku model timeout (5s default)
# - Invalid response format
# - Network errors
# - Rate limiting

# Warning logged to stderr, workflow continues:
# WARNING: Haiku routing failed for agent 'triage_agent': timeout
# Falling back to existing routing strategies...
```

**Never blocks workflow execution** - routing failures are warnings, not errors.

---

## Quick Checklist

Before committing agent code, verify:

- [ ] All tool functions have `@tool` on top, `@instrument_tool` below
- [ ] Handler functions use try/finally with context management
- [ ] No local definitions of `instrument_tool`, `write_tool_event`, etc.
- [ ] Agent.py uses `invoke_with_gateway()`, not direct `MCPClient`
- [ ] Lambda handlers return `json.dumps()` strings
- [ ] `main.py` accepts `--prompt`, `--workflow-id`, `--trace-id` arguments
- [ ] Environment variables `AGENTIFY_TABLE_NAME`, `AWS_REGION` are read
- [ ] If using Haiku routing, `routing` section added to `.agentify/config.json`

---

*For complete implementation details, schemas, and examples, see `.kiro/steering/agentify-integration.md`*
