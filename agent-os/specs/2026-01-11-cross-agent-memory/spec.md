# Specification: Cross-Agent Memory

## Goal
Enable agents within a workflow to share fetched data via AgentCore Memory, reducing duplicate external API calls, improving consistency, and lowering latency in multi-agent demo workflows.

## User Stories
- As a demo presenter, I want earlier agents to share their fetched data with downstream agents so that duplicate API calls are eliminated and the demo runs faster.
- As a developer configuring a demo, I want to toggle cross-agent memory sharing in the wizard so that I can control whether agents share context within workflow sessions.

## Specific Requirements

**Wizard Step 4 Memory Settings UI**
- Add toggle for `crossAgentMemoryEnabled` (default: true)
- Add dropdown for `memoryExpiryDays` with options 1, 7, 30 days (default: 7)
- Display helper text explaining memory sharing reduces duplicate API calls
- Memory settings placed in "Memory Settings" subsection below existing compliance fields
- Save settings to `.agentify/config.json` under `memory.crossAgent` namespace

**SecurityGuardrailsState Type Extensions**
- Add `crossAgentMemoryEnabled: boolean` property
- Add `memoryExpiryDays: number` property
- Update `createDefaultSecurityGuardrailsState()` to set defaults (enabled: true, days: 7)
- Ensure persisted wizard state includes memory configuration

**Setup-Memory.sh Script**
- Follow `setup-gateway.sh` patterns (source setup-common.sh, init_common, show_banner)
- Read memory config from `.agentify/config.json` via jq
- Skip creation if `crossAgentMemoryEnabled` is false
- Use `agentcore memory create` with semantic strategy configuration
- Store `MEMORY_ID` in `.agentify/infrastructure.json` under `memory.memoryId`
- Idempotent creation: check if memory exists before creating

**Memory Client Python Module**
- Follow `dynamodb_client.py` patterns for module globals and fire-and-forget error handling
- Create `init_memory(session_id: str)` function to initialize the memory client
- Create `search_memory(query: str)` tool using `retrieve_memories()` SDK method
- Create `store_context(key: str, value: str)` tool using `create_event()` SDK method
- Use namespace pattern `/workflow/{session_id}/context` for session isolation
- Graceful degradation: return user-friendly messages when memory unavailable

**Environment Variable Propagation**
- `setup.sh`: Call `setup-memory.sh` after CDK deployment, pass `MEMORY_ID` to agent deploy via `--env` flag
- `orchestrate.sh`: Load `MEMORY_ID` from infrastructure.json, export for main.py subprocess
- `workflowTriggerService.ts`: Read `MEMORY_ID` from infrastructure.json, pass as env var to subprocess

**Destroy Script Memory Cleanup**
- Add memory deletion step to `destroy.sh` before CDK cleanup
- Use `agentcore memory delete` with `MEMORY_ID` from infrastructure.json
- Handle missing memory gracefully (|| true pattern)

**Shared Module Exports**
- Update `agents/shared/__init__.py` to export `init_memory`, `search_memory`, `store_context`
- Document import pattern in module docstring
- Maintain consistent export pattern with existing observability functions

**Main Orchestrator Integration**
- Add `init_memory(session_id)` call in main_graph.py, main_swarm.py, main_workflow.py
- Place initialization in "DO NOT MODIFY" section after session setup
- Initialize memory before first agent invocation

## Visual Design
No visual assets provided.

## Existing Code to Leverage

**resources/scripts/setup-gateway.sh**
- Reuse script structure pattern (SCRIPT_DIR, source setup-common.sh, init_common, show_banner)
- Follow argument parsing pattern for optional --region flag
- Reuse config loading pattern from CONFIG_JSON via jq
- Follow infrastructure.json update pattern with jq --arg

**resources/agents/shared/dynamodb_client.py**
- Reuse module-level globals pattern (_memory_client, _memory_id, _session_id)
- Follow fire-and-forget error handling pattern (try/except with warning logs, never raise)
- Reuse graceful degradation pattern (return clean user message when unavailable)
- Follow configuration resolution pattern from environment variables

**src/panels/ideationStep4Logic.ts**
- Extend `SecurityGuardrailsState` interface with memory properties
- Follow existing pattern for applying industry defaults
- Reuse state update and webview sync patterns from existing Step 4 logic

**resources/agentify-hooks/tool-decorator-validator.kiro.hook**
- Follow hook JSON structure pattern for memory-related hooks
- Reuse "LOCAL DEFINITIONS - BLOCKING ERROR" pattern for memory functions
- Follow import validation pattern for agents.shared.memory_client

**resources/agentify-power/POWER.md**
- Follow Pattern structure (numbered patterns with code examples)
- Reuse CORRECT/WRONG code block pattern for documentation
- Follow decorator order documentation style

## Out of Scope
- Item 39.5 Persistent Session Memory (cross-session learning)
- Memory Explorer UI panel for viewing stored memories
- Multiple memory strategy configurations
- User preference tracking via `remember_preference()` tool
- Visual differentiation in Demo Viewer (special icons for memory tools)
- Custom namespace configuration (fixed pattern used)
- Memory search result ranking or filtering options
- Memory TTL configuration per-item (uses global expiry)
- Memory encryption or additional authorization beyond namespace isolation
- Automatic memory pruning or compaction strategies
