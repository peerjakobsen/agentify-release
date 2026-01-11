# Task Breakdown: Cross-Agent Memory

## Overview
Total Tasks: 7 Task Groups (41 sub-tasks)

This feature enables agents within a workflow to share fetched data via AgentCore Memory, reducing duplicate external API calls and improving consistency in multi-agent demo workflows.

## Task List

### TypeScript Foundation Layer

#### Task Group 1: Type Definitions and State Management
**Dependencies:** None

- [x] 1.0 Complete TypeScript type extensions
  - [x] 1.1 Write 3-5 focused tests for type and state management
    - Test `createDefaultSecurityGuardrailsState()` returns memory defaults
    - Test state persistence includes memory configuration
    - Test state restoration preserves memory settings
  - [x] 1.2 Extend `SecurityGuardrailsState` interface in `src/panels/ideationStep4Logic.ts`
    - Add `crossAgentMemoryEnabled: boolean` property
    - Add `memoryExpiryDays: number` property
    - Follow existing interface extension patterns
  - [x] 1.2b Add `MemoryConfig` interface to `src/types/config.ts`
    - Define `crossAgent: { enabled: boolean; expiryDays: number }` structure
    - Add optional `memory?: MemoryConfig` to `AgentifyConfig` interface
    - Add validation for memory config in `validateConfigSchema()`
  - [x] 1.3 Update `createDefaultSecurityGuardrailsState()` in `src/panels/ideationStep4Logic.ts`
    - Set `crossAgentMemoryEnabled` default to `true`
    - Set `memoryExpiryDays` default to `7`
    - Ensure defaults apply when industry template selected
  - [x] 1.4 Update state persistence logic
    - Ensure memory settings saved to `.agentify/config.json` under `memory.crossAgent` namespace
    - Follow existing config save patterns
  - [x] 1.5 Ensure TypeScript type tests pass
    - Run ONLY the 3-5 tests written in 1.1
    - Verify type compilation succeeds
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 3-5 tests written in 1.1 pass
- TypeScript compiles without errors
- Default state includes memory configuration
- State persists and restores memory settings correctly

**Files to modify:**
- `src/panels/ideationStep4Logic.ts`
- `src/types/config.ts`

---

### Wizard UI Layer

#### Task Group 2: Memory Settings UI Components
**Dependencies:** Task Group 1

- [x] 2.0 Complete Wizard Step 4 Memory Settings UI
  - [x] 2.1 Write 3-5 focused tests for Memory Settings UI
    - Test toggle renders with correct default state (enabled)
    - Test dropdown shows correct options (1, 7, 30 days) with default selection (7)
    - Test state updates propagate when controls changed
    - Test UI disabled when feature toggled off
  - [x] 2.2 Add "Memory Settings" subsection in `src/panels/ideationStep4Html.ts`
    - Place below existing compliance fields
    - Add section header "Memory Settings"
    - Follow existing subsection styling patterns
  - [x] 2.3 Implement toggle for `crossAgentMemoryEnabled`
    - Label: "Enable Cross-Agent Memory"
    - Default: checked (true)
    - Follow existing toggle component patterns
  - [x] 2.4 Implement dropdown for `memoryExpiryDays`
    - Label: "Memory Retention Period"
    - Options: 1 day, 7 days (default), 30 days
    - Follow existing dropdown component patterns
  - [x] 2.5 Add helper text explaining feature
    - Text: "Cross-agent memory allows agents to share fetched data, reducing duplicate API calls and improving response consistency."
    - Follow existing helper text styling
  - [x] 2.6 Wire up state change handlers
    - Connect toggle to `crossAgentMemoryEnabled` state
    - Connect dropdown to `memoryExpiryDays` state
    - Follow existing webview sync patterns
  - [x] 2.6b Handle feature flag bundling in `src/services/resourceExtractionService.ts`
    - Check `config.memory?.crossAgent?.enabled` before copying `memory_client.py`
    - Skip copying to `agents/shared/` when disabled
    - Follow existing conditional resource extraction patterns
  - [x] 2.7 Ensure UI component tests pass
    - Run ONLY the 3-5 tests written in 2.1
    - Verify UI renders correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 3-5 tests written in 2.1 pass
- Memory Settings section visible in Step 4
- Toggle and dropdown functional with correct defaults
- State changes sync to wizard state correctly

**Files to modify:**
- `src/panels/ideationStep4Html.ts`
- `src/panels/ideationStep4Logic.ts` (event handlers)
- `src/services/resourceExtractionService.ts`

---

### Python Module Layer

#### Task Group 3: Memory Client Module and Exports
**Dependencies:** None (can run parallel with Groups 1-2)

- [x] 3.0 Complete Python memory client module
  - [x] 3.1 Write 4-6 focused tests for memory client
    - Test `init_memory()` initializes module globals correctly
    - Test `search_memory()` returns results or graceful degradation message
    - Test `store_context()` stores data or returns graceful degradation message
    - Test namespace pattern uses session_id correctly
    - Test error handling follows fire-and-forget pattern (no exceptions raised)
  - [x] 3.2 Create `resources/agents/shared/memory_client.py`
    - Follow `dynamodb_client.py` module structure
    - Define module-level globals: `_memory_client`, `_memory_id`, `_session_id`
    - Import from `agentcore.memory` SDK
  - [x] 3.3 Implement `init_memory(session_id: str)` function
    - Read `MEMORY_ID` from environment variable
    - Initialize AgentCore Memory client
    - Set namespace pattern: `/workflow/{session_id}/context`
    - Handle missing environment variable gracefully
  - [x] 3.4 Implement `search_memory(query: str)` tool
    - Use `retrieve_memories()` SDK method
    - Add `@tool` decorator from strands (outer)
    - Add `@instrument_tool` decorator (inner) for Demo Viewer visibility
    - Return results formatted for agent consumption
    - Return "Memory not initialized. Use external tools." when unavailable
    - Log warning to stderr when memory not initialized
  - [x] 3.5 Implement `store_context(key: str, value: str)` tool
    - Use `create_event()` SDK method for storing (LTM extraction is automatic)
    - Add `@tool` decorator from strands (outer)
    - Add `@instrument_tool` decorator (inner)
    - Return confirmation message on success
    - Follow fire-and-forget pattern (log warning, don't raise)
  - [x] 3.6 Update `resources/agents/shared/__init__.py`
    - Export `init_memory`, `search_memory`, `store_context`
    - Add docstring documenting import pattern
    - Follow existing export pattern with observability functions
  - [x] 3.7 Ensure memory client tests pass
    - Run ONLY the 4-6 tests written in 3.1
    - Verify graceful degradation works
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 3.1 pass
- Memory client initializes correctly with session_id
- Tools return user-friendly messages when memory unavailable
- Exports available from `agents.shared` module

**Files to create:**
- `resources/agents/shared/memory_client.py`

**Files to modify:**
- `resources/agents/shared/__init__.py`

---

### Shell Scripts Layer

#### Task Group 4: Setup and Destroy Scripts
**Dependencies:** Task Group 1 (config schema defined)

- [x] 4.0 Complete shell script infrastructure
  - [x] 4.1 Write 3-5 focused tests for shell scripts
    - Test `setup-memory.sh` skips creation when `crossAgentMemoryEnabled` is false
    - Test `setup-memory.sh` creates memory and stores `MEMORY_ID` in infrastructure.json
    - Test `destroy.sh` handles missing memory gracefully
    - Test idempotent behavior (re-running doesn't create duplicate)
  - [x] 4.2 Create `resources/scripts/setup-memory.sh`
    - Source `setup-common.sh`, call `init_common`, `show_banner`
    - Add `--region` optional flag following `setup-gateway.sh` pattern
    - Read config from `.agentify/config.json` via jq
    - Check `memory.crossAgent.enabled` before proceeding
  - [x] 4.3 Implement memory creation logic in `setup-memory.sh`
    - Check if memory exists in infrastructure.json (idempotent)
    - Use `agentcore memory create` with semantic strategy
    - Configure expiry from `memory.crossAgent.expiryDays`
    - Store `MEMORY_ID` in `.agentify/infrastructure.json` under `memory.memoryId`
  - [x] 4.4 Update `resources/scripts/setup.sh`
    - Call `setup-memory.sh` after CDK deployment
    - Pass `MEMORY_ID` to agent deploy via `--env` flag
    - Follow existing script call patterns
  - [x] 4.5 Update `resources/scripts/orchestrate.sh`
    - Load `MEMORY_ID` from `.agentify/infrastructure.json`
    - Export `MEMORY_ID` for main.py subprocess
    - Handle missing memory gracefully (export empty string)
  - [x] 4.6 Update `resources/scripts/destroy.sh`
    - Add memory deletion step BEFORE CDK cleanup
    - Use `agentcore memory delete` with `MEMORY_ID`
    - Handle missing memory with `|| true` pattern
    - Remove memory section from infrastructure.json
  - [x] 4.7 Ensure shell script tests pass
    - Run ONLY the 3-5 tests written in 4.1
    - Verify scripts are executable
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 3-5 tests written in 4.1 pass
- `setup-memory.sh` creates memory only when enabled
- `MEMORY_ID` stored in infrastructure.json
- `destroy.sh` cleans up memory resources
- All scripts follow existing patterns

**Files to create:**
- `resources/scripts/setup-memory.sh`

**Files to modify:**
- `resources/scripts/setup.sh`
- `resources/scripts/orchestrate.sh`
- `resources/scripts/destroy.sh`

---

### Service Integration Layer

#### Task Group 5: TypeScript Service and Python Orchestrator Integration
**Dependencies:** Task Groups 3, 4

- [x] 5.0 Complete service and orchestrator integration
  - [x] 5.1 Write 3-5 focused tests for integration
    - Test `workflowTriggerService.ts` passes `MEMORY_ID` env var to subprocess
    - Test main orchestrators call `init_memory()` before agent invocation
    - Test integration handles missing `MEMORY_ID` gracefully
  - [x] 5.2 Update `src/services/workflowTriggerService.ts`
    - Read `MEMORY_ID` from `.agentify/infrastructure.json`
    - Pass `MEMORY_ID` as environment variable to subprocess
    - Follow existing env var propagation patterns
  - [x] 5.3 Update `resources/agents/main_graph.py`
    - Import `init_memory` from `agents.shared`
    - Add `init_memory(session_id)` call after session setup
    - Place in "DO NOT MODIFY" section before first agent invocation
  - [x] 5.4 Update `resources/agents/main_swarm.py`
    - Import `init_memory` from `agents.shared`
    - Add `init_memory(session_id)` call after session setup
    - Place in "DO NOT MODIFY" section before first agent invocation
  - [x] 5.5 Update `resources/agents/main_workflow.py`
    - Import `init_memory` from `agents.shared`
    - Add `init_memory(session_id)` call after session setup
    - Place in "DO NOT MODIFY" section before first agent invocation
  - [x] 5.6 Ensure integration tests pass
    - Run ONLY the 3-5 tests written in 5.1
    - Verify end-to-end env var flow
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 3-5 tests written in 5.1 pass
- `MEMORY_ID` flows from infrastructure.json to Python subprocess
- All three orchestrators initialize memory correctly
- Graceful degradation when memory not configured

**Files to modify:**
- `src/services/workflowTriggerService.ts`
- `resources/agents/main_graph.py`
- `resources/agents/main_swarm.py`
- `resources/agents/main_workflow.py`

---

### Documentation and Hooks Layer

#### Task Group 6: POWER.md, Hooks, and Steering Prompts
**Dependencies:** Task Groups 3, 5

- [x] 6.0 Complete documentation and validation hooks
  - [x] 6.1 Write 2-4 focused tests for hooks
    - Test hook validates `init_memory()` import from `agents.shared`
    - Test hook flags local memory function definitions as errors
  - [x] 6.2 Add Pattern 9 (Memory) to `resources/agentify-power/POWER.md`
    - Document `search_memory()` and `store_context()` tool usage
    - Document decorator stacking: `@tool` above `@instrument_tool`
    - Add CORRECT/WRONG code block examples
    - Follow existing pattern structure
  - [x] 6.3 Update `resources/agentify-hooks/tool-decorator-validator.kiro.hook`
    - Add memory function checks (`search_memory`, `store_context`)
    - Validate `@tool` + `@instrument_tool` decorator stacking on memory tools
    - Add memory functions to "LOCAL DEFINITIONS - BLOCKING ERROR" section
    - Follow existing hook JSON structure
  - [x] 6.4 Update `resources/agentify-hooks/orchestrator-validator.kiro.hook`
    - Add `init_memory()` import validation from `agents.shared`
    - Add memory initialization check in orchestrator setup section
    - Validate call placed before first agent invocation
  - [x] 6.5 Update `resources/prompts/steering/agentify-integration-steering.prompt.md`
    - Add memory initialization section
    - Document when and how to call `init_memory()`
  - [x] 6.6 Update `resources/prompts/steering/structure-steering.prompt.md`
    - Add `memory_client.py` to shared module listing
    - Document exports available from module
  - [x] 6.7 Ensure hook tests pass
    - Run ONLY the 2-4 tests written in 6.1
    - Verify hooks trigger on violations
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-4 tests written in 6.1 pass
- POWER.md documents memory pattern clearly
- Hooks validate memory function usage
- Steering prompts guide correct integration

**Files to modify:**
- `resources/agentify-power/POWER.md`
- `resources/agentify-hooks/tool-decorator-validator.kiro.hook`
- `resources/agentify-hooks/orchestrator-validator.kiro.hook`
- `resources/prompts/steering/agentify-integration-steering.prompt.md`
- `resources/prompts/steering/structure-steering.prompt.md`

---

### Testing

#### Task Group 7: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-6

- [x] 7.0 Review existing tests and fill critical gaps only
  - [x] 7.1 Review tests from Task Groups 1-6
    - Review the 3-5 tests written by TypeScript foundation (Task 1.1)
    - Review the 3-5 tests written by UI components (Task 2.1)
    - Review the 4-6 tests written by Python module (Task 3.1)
    - Review the 3-5 tests written by shell scripts (Task 4.1)
    - Review the 3-5 tests written by integration (Task 5.1)
    - Review the 2-4 tests written by hooks (Task 6.1)
    - Total existing tests: approximately 18-30 tests
  - [x] 7.2 Analyze test coverage gaps for Cross-Agent Memory feature only
    - Identify critical user workflows lacking coverage
    - Focus on: wizard toggle -> setup -> runtime flow
    - Prioritize end-to-end memory sharing workflow test
    - Do NOT assess entire application test coverage
  - [x] 7.3 Write up to 10 additional strategic tests maximum
    - Add end-to-end test: wizard config -> setup-memory -> orchestrator init
    - Add test: memory disabled in wizard -> memory_client not bundled
    - Add test: memory search returns cached data between agents
    - Fill only critical gaps identified in 7.2
  - [x] 7.4 Run feature-specific tests only
    - Run ONLY tests related to Cross-Agent Memory feature
    - Expected total: approximately 28-40 tests maximum
    - Do NOT run the entire application test suite
    - Verify all critical workflows pass

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 28-40 tests total)
- Critical user workflows for memory feature are covered
- End-to-end memory sharing workflow verified
- No more than 10 additional tests added when filling gaps

---

## Execution Order

Recommended implementation sequence:

```
Phase 1 (Parallel):
  - Task Group 1: TypeScript Types (foundation)
  - Task Group 3: Python Memory Client (independent)

Phase 2 (After Phase 1):
  - Task Group 2: Wizard UI (depends on Group 1)
  - Task Group 4: Shell Scripts (depends on Group 1 config schema)

Phase 3 (After Phase 2):
  - Task Group 5: Service Integration (depends on Groups 3, 4)

Phase 4 (After Phase 3):
  - Task Group 6: Documentation & Hooks (depends on Groups 3, 5)

Phase 5 (After all):
  - Task Group 7: Test Review & Gap Analysis
```

## Configuration Reference

### .agentify/config.json schema
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

### .agentify/infrastructure.json schema (after setup)
```json
{
  "memory": {
    "memoryId": "mem-xxx..."
  }
}
```

## Key Implementation Patterns

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
