# Cross-Agent Memory Requirements

## Feature Overview
Enable agents to share context via AgentCore Memory within a workflow session, reducing duplicate external calls.

## Key Decisions

### 1. AgentCore Memory SDK API
- Use latest SDK, validate API methods exist
- Correct methods:
  - `retrieve_memories()` for semantic search on LTM records
  - `create_event()` for storing (LTM extraction is automatic via strategies)
- Add version pin in pyproject.toml once validated
- Critical: LTM extraction is AUTOMATIC - cannot write directly to LTM

### 2. Session Isolation Strategy
- Use namespace patterns only: `namespace=f"/workflow/{_session_id}/context"`
- No additional authorization checks needed for demo scope
- Namespace isolation is sufficient for preventing accidental cross-session reads

### 3. Memory Retention Default
- Default: 7 days (good for demo week cycles)
- Dropdown options: 1, 7, 30 days for flexibility

### 4. Graceful Degradation
- Log warning to stderr following dynamodb_client.py pattern
- User-facing message stays clean: "Memory not initialized. Use external tools."
- Don't break workflow when memory unavailable

### 5. Session Integration
- Use existing `_currentWorkflowId` as session_id for memory scoping
- No separate "memory session" concept needed
- Integrates with Item 38 (Session Continuation) seamlessly

### 6. Demo Viewer Visibility
- Standard tool chip display is sufficient for MVP
- `@instrument_tool` decorator handles this automatically
- Future enhancement (not in scope): consider 🧠 icon for memory tools

### 7. Feature Flag Behavior
- Exclude memory tools from bundling entirely when disabled
- Don't copy memory_client.py to agents/shared/ if disabled
- Cleaner than having tools return "disabled" messages

## Scope

### In Scope
- Wizard Step 4 toggle (`crossAgentMemoryEnabled`) + expiry dropdown (`memoryExpiryDays`)
- `setup-memory.sh` script for AgentCore Memory creation
- Pre-bundled `memory_client.py` with `search_memory()` + `store_context()` tools
- Environment variable propagation (`MEMORY_ID`) through scripts and services
- Hook updates (observability-enforcer, cli-contract-validator)
- Steering prompt updates (4 files per roadmap)
- `destroy.sh` cleanup for memory resource deletion

### Explicitly Out of Scope
- Item 39.5 (Persistent Session Memory for cross-session learning)
- Memory Explorer UI panel
- Multiple memory strategies
- User preference tracking (`remember_preference()`)
- Visual differentiation in Demo Viewer (special icons)

## Implementation Patterns

### Fire-and-forget (from dynamodb_client.py)
```python
try:
    _memory_client.create_event(...)
    return f"Stored: {key}"
except Exception as e:
    logger.warning(f"Memory store error: {e}")
    return f"Failed to store: {key}"  # Don't raise
```

### Module globals (from instrumentation.py)
```python
_memory_client = None
_memory_id = None
_session_id = None

def init_memory(session_id: str):
    global _memory_client, _memory_id, _session_id
    ...
```

### Script structure (from setup-gateway.sh)
```bash
source "${SCRIPT_DIR}/setup-common.sh"
init_common "$CUSTOM_REGION"
show_banner "Cross-Agent Memory Setup"
```

## Files to Create/Modify

### New Files
- `resources/scripts/setup-memory.sh` - AgentCore Memory creation
- `resources/agents/shared/memory_client.py` - Pre-bundled memory tools

### Modified Files
- `src/panels/ideationStep4Logic.ts` - Add memory toggle state
- `src/panels/ideationStep4Html.ts` - Add memory UI section
- `src/types/wizardPanel.ts` - Add `SecurityGuardrailsState.crossAgentMemoryEnabled`, `memoryExpiryDays`
- `resources/scripts/setup.sh` - Call setup-memory.sh, pass MEMORY_ID to agent deploy
- `resources/scripts/orchestrate.sh` - Export MEMORY_ID for main.py
- `resources/scripts/destroy.sh` - Add memory cleanup
- `resources/agents/shared/__init__.py` - Export memory functions
- `resources/agents/main_graph.py`, `main_swarm.py`, `main_workflow.py` - Add init_memory() call
- `src/services/workflowTriggerService.ts` - Pass MEMORY_ID env var
- `resources/agentify-power/POWER.md` - Add Pattern 8 (memory)
- `resources/agentify-hooks/observability-enforcer.kiro.hook` - Add memory function checks
- `resources/agentify-hooks/cli-contract-validator.kiro.hook` - Add init_memory() validation
- `resources/prompts/steering/agentify-integration-steering.prompt.md` - Add memory section
- `resources/prompts/steering/structure-steering.prompt.md` - Add memory_client.py to listing

## Configuration Schema

### .agentify/config.json
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

### .agentify/infrastructure.json (after setup)
```json
{
  "memory": {
    "memoryId": "mem-xxx..."
  }
}
```

## Implementation Checklist
- [ ] Use `retrieve_memories()` + `create_event()` from AgentCore Memory SDK
- [ ] Namespace isolation via `/workflow/{session_id}/context`
- [ ] Default 7-day retention
- [ ] Log warnings to stderr on graceful degradation
- [ ] Reuse `_currentWorkflowId` as session_id
- [ ] Standard tool chip display (no special icon for MVP)
- [ ] Exclude `memory_client.py` from bundling when disabled
- [ ] Follow dynamodb_client.py patterns for error handling
- [ ] Follow setup-gateway.sh patterns for setup-memory.sh
