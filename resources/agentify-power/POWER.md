---
name: "agentify"
displayName: "Agentify Observability"
description: "Observability patterns for Agentify multi-agent workflows with Demo Viewer integration"
keywords: ["agent", "workflow", "Strands", "orchestrator", "demo", "multi-agent", "tool", "handler", "instrumentation", "memory"]
---

# Agentify Power

Quick reference for Agentify multi-agent workflow observability patterns. These 10 critical patterns ensure your agents work correctly with the Demo Viewer.

> For complete details, see `.kiro/steering/agentify-integration.md`

---

## Pattern 1: Pre-bundled Infrastructure

**ALWAYS** import from `agents/shared/` - never recreate these modules locally.

```python
# CORRECT - Import from shared
from agents.shared.instrumentation import instrument_tool, set_instrumentation_context, clear_instrumentation_context
from agents.shared.dynamodb_client import write_tool_event
from agents.shared.gateway_client import invoke_with_gateway
from agents.shared import init_memory, search_memory, store_context

# WRONG - Never define these locally
def instrument_tool(func):  # BLOCKING ERROR
    ...
```

The `agents/shared/` directory contains pre-built infrastructure for observability, Gateway integration, and cross-agent memory.

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
- `MEMORY_ID` - AgentCore Memory ID for cross-agent data sharing (optional)

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
| Defining memory functions locally | Bypasses shared memory client | Import from `agents.shared` |

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

## Pattern 9: Cross-Agent Memory

Enable agents to share fetched data via AgentCore Memory, reducing duplicate API calls and improving response consistency.

### When to Use Cross-Agent Memory

- **Data sharing**: Multiple agents need the same external data (customer info, inventory, etc.)
- **Reducing API calls**: First agent fetches, subsequent agents retrieve from memory
- **Response consistency**: Ensure all agents work with the same data snapshot
- **Demo workflows**: Show efficient multi-agent data sharing in real-time

### Configuration

Enable in `.agentify/config.json`:

```json
{
  "memory": {
    "crossAgent": {
      "enabled": true,
      "expiryDays": 7
    }
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Enable cross-agent memory |
| `expiryDays` | `7` | Memory retention period (1, 7, or 30 days) |

### Memory Initialization (Orchestrator)

**CRITICAL**: Initialize memory once per workflow in the orchestrator, NOT in individual agents.

```python
# In main.py orchestrator - before first agent invocation
from agents.shared import init_memory

# Initialize memory with session_id for namespace isolation
if init_memory(session_id):
    print("Cross-Agent Memory: enabled", file=sys.stderr)
else:
    print("Cross-Agent Memory: disabled (MEMORY_ID not configured)", file=sys.stderr)
```

### Memory Tools (Agents)

Agents use pre-bundled `search_memory()` and `store_context()` tools.

```python
# CORRECT - Import from shared (pre-bundled)
from agents.shared import search_memory, store_context

# Include in agent's local_tools list
def invoke_my_agent(prompt: str) -> str:
    return invoke_with_gateway(
        prompt=prompt,
        local_tools=[search_memory, store_context, my_other_tool],
        system_prompt=SYSTEM_PROMPT
    )

# WRONG - Never define these locally
@tool
@instrument_tool
def search_memory(query: str) -> str:  # BLOCKING ERROR
    ...
```

### Tool Behavior

**search_memory(query: str)** - Search for previously stored data:
```python
# Returns matching context or graceful message if unavailable
result = search_memory("customer TKT-001")
# Returns: "Found: customer_info: {...}" or "Memory not initialized. Use external tools."
```

**store_context(key: str, value: str)** - Store data for other agents:
```python
# Stores data with session-scoped namespace
result = store_context("customer_info", json.dumps(customer_data))
# Returns: "Stored: customer_info" or "Failed to store: customer_info"
```

### Fire-and-Forget Pattern

Memory operations never block agent execution:

```python
# Memory errors are logged as warnings, never raised
# This ensures workflow continues even if memory unavailable

try:
    _memory_client.create_event(...)
    return f"Stored: {key}"
except Exception as e:
    logger.warning(f"Memory store error: {e}")
    return f"Failed to store: {key}"  # Don't raise - agent continues
```

### Decorator Stacking

Memory tools use the same decorator pattern as other tools:

```python
# CORRECT - @tool on top, @instrument_tool below
@tool                    # Registers with Strands
@instrument_tool         # Captures events for Demo Viewer
def search_memory(query: str) -> str:
    """Search cross-agent memory for relevant context."""
    ...

# WRONG - Reversed order
@instrument_tool
@tool                    # BLOCKING ERROR
def search_memory(query: str) -> str:
    ...
```

### Namespace Isolation

Memory is scoped to workflow session:

```
/workflow/{session_id}/context
         │
         └── Each workflow execution has isolated memory
             - Session A cannot access Session B's data
             - Data expires based on expiryDays config
```

### Environment Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `MEMORY_ID` | AgentCore Memory resource ID | `.agentify/infrastructure.json` |

The `setup-memory.sh` script creates the Memory resource and stores `MEMORY_ID` in infrastructure.json. The orchestrate.sh script exports it for the Python subprocess.

---

## Pattern 10: Persistent Memory (Long-Term)

Enable agents to remember user preferences across sessions via AgentCore Memory, providing personalized experiences.

### When to Use Persistent Memory

- **User preferences**: Remember communication style, notification preferences, etc.
- **Personalization**: Tailor agent responses based on past interactions
- **Feedback tracking**: Store user feedback for improvement
- **Cross-session continuity**: Maintain context between workflow executions

### Comparison with Cross-Agent Memory

| Aspect | Cross-Agent Memory (STM) | Persistent Memory (LTM) |
|--------|--------------------------|-------------------------|
| Scope | Single workflow session | Across all sessions |
| Namespace | `/workflow/{session_id}/context` | `/users/{effective_id}/preferences` |
| Purpose | Share data between agents | Remember user preferences long-term |
| Typical TTL | 7 days | 30-90 days |
| Use case | Pass customer profile to next agent | Remember user's preferred language |

### Configuration

Enable in `.agentify/config.json`:

```json
{
  "memory": {
    "crossAgent": {
      "enabled": true,
      "expiryDays": 7
    },
    "persistence": {
      "enabled": true,
      "strategy": "semantic",
      "retentionDays": 30
    }
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `false` | Enable persistent memory |
| `strategy` | `semantic` | Memory strategy (semantic, summary, user_preference) |
| `retentionDays` | `30` | Retention period (7, 30, or 90 days) |

### Memory Initialization (Orchestrator)

**CRITICAL**: Initialize persistent memory once per workflow in the orchestrator, NOT in individual agents.

```python
# In main.py orchestrator - before first agent invocation
from agents.shared import init_persistent_memory

# Initialize with user_id (preferred) or session_id fallback
if init_persistent_memory(user_id='user-123', session_id=session_id):
    print("Persistent Memory: enabled", file=sys.stderr)
else:
    print("Persistent Memory: disabled (PERSISTENT_MEMORY_ID not configured)", file=sys.stderr)
```

### Dual Identity Pattern

The effective_id is determined by priority:
1. Explicit `user_id` (for authenticated users)
2. `session_id` (for anonymous users)
3. `WORKFLOW_ID` environment variable (fallback)

```python
# For authenticated users - use user_id for true cross-session persistence
init_persistent_memory(user_id='user-123', session_id='session-abc')

# For anonymous users - falls back to session_id
init_persistent_memory(user_id=None, session_id='session-abc')
```

### Memory Tools (Agents)

Agents use pre-bundled persistent memory tools.

```python
# CORRECT - Import from shared (pre-bundled)
from agents.shared import remember_preference, recall_preferences, log_feedback

# Include in agent's local_tools list
def invoke_my_agent(prompt: str) -> str:
    return invoke_with_gateway(
        prompt=prompt,
        local_tools=[remember_preference, recall_preferences, log_feedback],
        system_prompt=SYSTEM_PROMPT
    )

# WRONG - Never define these locally
@tool
@instrument_tool
def remember_preference(category: str, preference: str, value: str) -> str:  # BLOCKING ERROR
    ...
```

### Tool Behavior

**remember_preference(category: str, preference: str, value: str)** - Store user preference:
```python
# Store a user preference
result = remember_preference('communication', 'style', 'formal and concise')
# Returns: "Remembered: communication/style" or "Persistent memory not initialized..."
```

**recall_preferences(query: str, category: Optional[str] = None)** - Search preferences:
```python
# Search all preferences
result = recall_preferences('communication style')
# Returns: "1. [communication/style]: formal and concise" or "No matching preferences found."

# Search within category
result = recall_preferences('frequency', category='notifications')
```

**log_feedback(entity_type: str, entity_id: str, rating: int, notes: Optional[str] = None)** - Log feedback:
```python
# Log user feedback
result = log_feedback('product', 'PRD-123', rating=5, notes='Great feature!')
# Returns: "Feedback logged: product/PRD-123"
```

### Fire-and-Forget Pattern

Like cross-agent memory, persistent memory operations never block agent execution:

```python
# Memory errors are logged as warnings, never raised
try:
    _persistent_memory_client.create_event(...)
    return f"Remembered: {category}/{preference}"
except Exception as e:
    logger.warning(f"Persistent memory store error: {e}")
    return f"Failed to remember: {category}/{preference}"  # Don't raise - agent continues
```

### Namespace Isolation

Persistent memory is scoped to user identity:

```
/users/{effective_id}/preferences
       │
       └── Each user has isolated persistent memory
           - User A cannot access User B's preferences
           - Data persists across sessions for same user
           - Data expires based on retentionDays config
```

### Environment Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `PERSISTENT_MEMORY_ID` | AgentCore Memory resource ID for LTM | `.agentify/infrastructure.json` |
| `USER_ID` | Optional user identity | CLI argument or application context |

The `setup-persistent-memory.sh` script creates the Memory resource and stores `PERSISTENT_MEMORY_ID` in infrastructure.json. The orchestrate.sh script exports it for the Python subprocess.


## Quick Checklist

Before committing agent code, verify:

- [ ] All tool functions have `@tool` on top, `@instrument_tool` below
- [ ] Handler functions use try/finally with context management
- [ ] No local definitions of `instrument_tool`, `write_tool_event`, `search_memory`, `store_context`, etc.
- [ ] Agent.py uses `invoke_with_gateway()`, not direct `MCPClient`
- [ ] Lambda handlers return `json.dumps()` strings
- [ ] `main.py` accepts `--prompt`, `--workflow-id`, `--trace-id` arguments
- [ ] Environment variables `AGENTIFY_TABLE_NAME`, `AWS_REGION` are read
- [ ] If using Haiku routing, `routing` section added to `.agentify/config.json`
- [ ] If using cross-agent memory, `init_memory(session_id)` called in orchestrator
- [ ] Memory tools imported from `agents.shared`, not defined locally
- [ ] If using persistent memory, `init_persistent_memory(user_id, session_id)` called in orchestrator
- [ ] Persistent memory tools (`remember_preference`, `recall_preferences`) imported from `agents.shared`

---

*For complete implementation details, schemas, and examples, see `.kiro/steering/agentify-integration.md`*
