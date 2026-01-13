# Task Breakdown: Persistent Session Memory

## Overview
Total Tasks: 8 Task Groups with 42 sub-tasks

## Task List

### Foundation Layer

#### Task Group 1: Type Definitions and Interfaces
**Dependencies:** None

- [x] 1.0 Complete type definitions for persistent memory feature
  - [x] 1.1 Write 3-5 focused tests for type validation
    - Test MemoryPersistenceConfig interface shape validation
    - Test ProposedAgent memory fields initialization
    - Test default value factory functions
    - Skip exhaustive property combination tests
  - [x] 1.2 Add `MemoryPersistenceConfig` interface to `src/types/wizardPanel.ts`
    - Fields: `enabled`, `strategy`, `retentionDays`, `namespacePrefix`
    - Define `LtmStrategy` type: `'semantic' | 'summary' | 'user_preference'`
    - Add validation constants: `LTM_RETENTION_OPTIONS = [7, 30, 90]`
    - Add `DEFAULT_LTM_RETENTION_DAYS = 30`
  - [x] 1.3 Extend `SecurityState` interface in `src/types/wizardPanel.ts`
    - Add `longTermMemoryEnabled: boolean` field
    - Add `ltmRetentionDays: number` field (default 30)
    - Add `ltmStrategy: LtmStrategy` field (default 'semantic')
    - Follow existing `crossAgentMemoryEnabled` and `memoryExpiryDays` pattern
  - [x] 1.4 Extend `SecurityGuardrailsState` interface in `src/panels/ideationStep4Logic.ts`
    - Add `longTermMemoryEnabled: boolean` field
    - Add `ltmRetentionDays: number` field (default 30)
    - Add `ltmStrategy: LtmStrategy` field (default 'semantic')
    - **CRITICAL**: Must match `SecurityState` fields for state sync
  - [x] 1.5 Extend `ProposedAgent` interface in `src/types/wizardPanel.ts`
    - Add `usesShortTermMemory?: boolean` field
    - Add `usesLongTermMemory?: boolean` field
    - Add `ltmStrategy?: LtmStrategy` field
    - Add `memoryEdited?: boolean` flag (follows `toolsEdited` pattern)
  - [x] 1.6 Update `createDefaultSecurityGuardrailsState()` in `src/panels/ideationStep4Logic.ts`
    - Initialize `longTermMemoryEnabled: false`
    - Initialize `ltmRetentionDays: 30`
    - Initialize `ltmStrategy: 'semantic'`
    - Ensure STM defaults remain unchanged
  - [x] 1.7 Update `createDefaultWizardState()` in `src/types/wizardPanel.ts`
    - Extend `security` object with LTM fields
    - Follow existing pattern for `crossAgentMemoryEnabled`
  - [x] 1.8 Update `persistedStateToWizardState()` with backwards compatibility
    - Add fallback for missing `longTermMemoryEnabled` field
    - Add fallback for missing `ltmRetentionDays` field
    - Follow existing pattern for `crossAgentMemoryEnabled` fallback
  - [x] 1.9 Ensure type definition tests pass
    - Run ONLY the 3-5 tests written in 1.1
    - Verify interfaces compile without errors
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 3-5 tests written in 1.1 pass
- All new interfaces are properly typed with JSDoc comments
- `SecurityState` and `SecurityGuardrailsState` have matching LTM fields
- Default state factory functions return correct initial values
- TypeScript compilation succeeds with no errors

---

### Python Module Layer

#### Task Group 2: Pre-Bundled persistent_memory.py Module
**Dependencies:** None (can be developed in parallel with Task Group 1)

- [x] 2.0 Complete persistent_memory.py pre-bundled module
  - [x] 2.1 Write 4-6 focused tests for persistent memory module
    - Test `init_persistent_memory()` with user_id and fallback to session_id
    - Test `remember_preference()` fire-and-forget pattern (no exceptions)
    - Test `recall_preferences()` returns formatted results or graceful message
    - Test `log_feedback()` stores feedback correctly
    - Test `_is_persistent_memory_available()` guard function
    - Skip exhaustive edge case testing
  - [x] 2.2 Create `resources/agents/shared/persistent_memory.py` module
    - Add module docstring following `memory_client.py` pattern
    - Document namespace pattern: `/{project}/users/{user_id}/preferences`
    - Include usage examples and error handling strategy
  - [x] 2.3 Implement module-level globals and configuration
    - `_persistent_memory_client = None`
    - `_persistent_memory_id: Optional[str] = None`
    - `_effective_id: Optional[str] = None`
    - `_namespace: Optional[str] = None`
    - `AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')`
  - [x] 2.4 Implement `init_persistent_memory(user_id: Optional[str], session_id: str) -> bool`
    - Apply effective_id pattern: `effective_id = user_id or session_id or os.environ.get('WORKFLOW_ID')`
    - Read `PERSISTENT_MEMORY_ID` from environment
    - Initialize `MemoryClient` from AgentCore Memory SDK (same class as memory_client.py)
    - Set namespace: `/users/{effective_id}/preferences`
    - Return False gracefully if SDK unavailable
  - [x] 2.5 Implement `remember_preference(category: str, preference: str, value: str) -> str`
    - Use `_is_persistent_memory_available()` guard
    - Store via `create_event()` method (same as memory_client.py `store_context`)
    - Include metadata: `{category, preference, effective_id, type: 'preference'}`
    - Fire-and-forget: log warning on error, return user-friendly message
  - [x] 2.6 Implement `recall_preferences(query: str, category: Optional[str] = None) -> str`
    - Use `retrieve_memories()` method (same as memory_client.py `search_memory`)
    - Filter by namespace: `/users/{effective_id}/preferences/{category or ''}`
    - Format results for agent consumption
    - Return graceful message when unavailable
  - [x] 2.7 Implement `log_feedback(entity_type: str, entity_id: str, rating: int, notes: Optional[str] = None) -> str`
    - Store feedback via `create_event()` method
    - Include metadata: `{entity_type, entity_id, rating, effective_id, type: 'feedback'}`
    - Fire-and-forget pattern with graceful degradation
  - [x] 2.8 Implement `get_persistent_memory_status() -> dict`
    - Return initialization state, memory_id, effective_id, namespace
    - Follow `get_memory_status()` pattern from `memory_client.py`
  - [x] 2.9 Update `resources/agents/shared/__init__.py`
    - Export `init_persistent_memory`, `remember_preference`, `recall_preferences`, `log_feedback`
    - Export `get_persistent_memory_status`
  - [x] 2.10 Ensure persistent memory module tests pass
    - Run ONLY the 4-6 tests written in 2.1
    - Verify fire-and-forget behavior works correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 2.1 pass
- Module follows identical patterns to `memory_client.py`
- Uses same SDK class (`MemoryClient`) as existing memory_client.py
- All functions gracefully handle missing SDK or memory ID
- Exports are properly configured in `__init__.py`

---

### Infrastructure Layer

#### Task Group 3: Setup and Destroy Script Updates
**Dependencies:** Task Group 2 (requires persistent_memory.py for testing)

- [x] 3.0 Complete infrastructure script updates
  - [x] 3.1 Write 3-4 focused tests for script functionality
    - Test `setup-persistent-memory.sh` creates persistent memory resource when enabled
    - Test `setup.sh` calls `setup-persistent-memory.sh` when LTM enabled
    - Test `destroy.sh` cleans up persistent memory resource
    - Test `infrastructure.json` stores `PERSISTENT_MEMORY_ID`
  - [x] 3.2 Create `resources/scripts/setup-persistent-memory.sh`
    - Follow `setup-memory.sh` script pattern exactly
    - Read `memory.persistence.enabled` from `.agentify/config.json`
    - Read `memory.persistence.retentionDays` (default 30)
    - Create AgentCore Memory resource with appropriate TTL
    - Store `PERSISTENT_MEMORY_ID` in `.agentify/infrastructure.json`
    - Make script idempotent (check if already exists)
  - [x] 3.3 Update `resources/scripts/setup.sh`
    - Add call to `setup-persistent-memory.sh` after `setup-memory.sh`
    - Pass through region argument
    - Follow existing pattern for calling modular scripts
  - [x] 3.4 Update `resources/scripts/destroy.sh` with persistent memory cleanup
    - Read `PERSISTENT_MEMORY_ID` from `infrastructure.json`
    - Delete persistent memory resource before cross-agent memory
    - Remove `PERSISTENT_MEMORY_ID` from `infrastructure.json`
    - Follow existing cleanup pattern
  - [x] 3.5 Update `resources/scripts/orchestrate.sh`
    - Read `PERSISTENT_MEMORY_ID` from `infrastructure.json`
    - Pass `PERSISTENT_MEMORY_ID` as environment variable
    - Pass `--user-id` CLI argument when provided
    - Ensure both env vars available to Python subprocess
  - [x] 3.6 Ensure infrastructure script tests pass
    - Run ONLY the 3-4 tests written in 3.1
    - Verify resource creation and cleanup works
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 3-4 tests written in 3.1 pass
- `setup-persistent-memory.sh` follows same pattern as `setup-memory.sh`
- `setup.sh` conditionally calls the new script
- `destroy.sh` properly cleans up persistent memory
- `orchestrate.sh` passes correct environment variables
- `infrastructure.json` schema is properly extended

---

### Configuration Layer

#### Task Group 4: Config Schema and Service Updates
**Dependencies:** Task Group 1 (requires type definitions)

- [x] 4.0 Complete config schema updates
  - [x] 4.1 Write 2-3 focused tests for config generation
    - Test config.json includes `memory.persistence` section when LTM enabled
    - Test config.json excludes `memory.persistence` when LTM disabled
    - Test config.json includes correct retention days from wizard state
  - [x] 4.2 Update `src/services/workflowTriggerService.ts` config generation
    - Add `memory.persistence` section to config schema
    - Include `enabled`, `strategy`, `retentionDays` fields
    - Only include section when `longTermMemoryEnabled: true`
    - Follow existing `memory.crossAgent` pattern
  - [x] 4.3 Update `src/services/configService.ts` (if exists) or config types
    - Add `MemoryPersistenceConfig` to config interface
    - Add validation for retention days (7, 30, or 90 only)
  - [x] 4.4 Ensure config tests pass
    - Run ONLY the 2-3 tests written in 4.1
    - Verify config.json generation is correct
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-3 tests written in 4.1 pass
- Config.json schema includes `memory.persistence` section
- Retention days validated against allowed values [7, 30, 90]
- Config generation follows existing patterns

---

### Wizard UI Layer

#### Task Group 5: Wizard Step 4 Infrastructure Toggle
**Dependencies:** Task Groups 1, 4 (requires type definitions and config)

- [x] 5.0 Complete Step 4 Long-Term Memory toggle UI
  - [x] 5.1 Write 4-5 focused tests for Step 4 LTM toggle
    - Test LTM toggle enables STM automatically
    - Test STM toggle is disabled (grayed out) when LTM enabled
    - Test retention dropdown shows correct options (7/30/90)
    - Test state persistence when navigating between steps
    - Skip exhaustive interaction testing
  - [x] 5.2 Update `src/panels/ideationStep4Html.ts` with LTM toggle HTML
    - Add "Long-Term Memory" toggle below existing "Cross-Agent Memory" toggle
    - Add info tooltip explaining LTM vs STM
    - Add retention dropdown with 7/30/90 day options
    - Disable STM toggle when LTM enabled (visual graying)
  - [x] 5.3 Update `src/panels/ideationStep4Logic.ts` with LTM handlers
    - Add `toggleLongTermMemory(enabled: boolean)` method
    - Auto-enable STM when LTM is enabled
    - Add `updateLtmRetentionDays(days: number)` method
    - Add `updateLtmStrategy(strategy: LtmStrategy)` method
    - Follow existing `toggleCrossAgentMemory()` pattern
  - [x] 5.4 Update `src/panels/tabbedPanel.ts` message handlers
    - Add case for `toggleLongTermMemory` message
    - Add case for `updateLtmRetentionDays` message
    - Add case for `updateLtmStrategy` message
    - Wire handlers to Step4LogicHandler methods
  - [x] 5.5 Add new commands to `WIZARD_COMMANDS` in `src/types/wizardPanel.ts`
    - Add `TOGGLE_LONG_TERM_MEMORY: 'toggleLongTermMemory'`
    - Add `UPDATE_LTM_RETENTION_DAYS: 'updateLtmRetentionDays'`
    - Add `UPDATE_LTM_STRATEGY: 'updateLtmStrategy'`
  - [x] 5.6 Ensure Step 4 LTM toggle tests pass
    - Run ONLY the 4-5 tests written in 5.1
    - Verify toggle interactions work correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-5 tests written in 5.1 pass
- LTM toggle auto-enables STM toggle
- STM toggle is properly disabled when LTM is on
- Retention dropdown shows correct values (7, 30, 90)
- State syncs correctly to webview

---

#### Task Group 6: Wizard Step 5 Per-Agent Memory Configuration
**Dependencies:** Task Groups 1, 5 (requires types and Step 4 state)

- [x] 6.0 Complete Step 5 per-agent memory configuration UI
  - [x] 6.1 Write 4-6 focused tests for Step 5 memory config
    - Test memory config section renders when LTM enabled in Step 4
    - Test AI suggests memory config based on agent role
    - Test `memoryEdited` flag prevents AI overwrite
    - Test LTM strategy dropdown shows correct options
    - Test memory config hidden when both STM and LTM disabled
    - Skip exhaustive UI state testing
  - [x] 6.2 Update `src/panels/webview/ideationStep5.ts` with memory config HTML
    - Add collapsible "Memory Configuration" section to agent card
    - Add "Uses Short-Term Memory" checkbox
    - Add "Uses Long-Term Memory" checkbox (only if LTM enabled in Step 4)
    - Add LTM strategy dropdown: Semantic, Summary, User Preference
    - Follow existing collapsible section pattern from tools section
  - [x] 6.3 Update `src/panels/ideationStep5Logic.ts` with memory handlers
    - Add `handleUpdateAgentMemoryConfig(agentId, field, value)` method
    - Set `memoryEdited: true` when user changes memory settings
    - Add AI suggestion logic for memory config based on role:
      - Customer-facing agents: LTM with UserPreference
      - Data processing agents: STM only
      - Coordinator agents: Both STM + LTM with Semantic
  - [x] 6.4 Update `mergeAiProposalRespectingEditedFlags()` method
    - Include `memoryEdited` flag check
    - Skip memory field updates when `memoryEdited: true`
    - Follow existing pattern for `nameEdited`, `roleEdited`, `toolsEdited`
  - [x] 6.5 Update `src/services/agentDesignService.ts` context message
    - Include Step 4 memory settings in context
    - Request AI to suggest memory config per agent
    - Parse memory config from AI response
  - [x] 6.6 Ensure Step 5 memory config tests pass
    - Run ONLY the 4-6 tests written in 6.1
    - Verify per-agent memory configuration works
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 6.1 pass
- Memory config section is collapsible
- AI suggests appropriate memory config based on agent role
- User edits are preserved via `memoryEdited` flag
- LTM strategy dropdown only shows when LTM enabled

---

### Demo Viewer Layer

#### Task Group 7: Demo Viewer Inline Memory Icons
**Dependencies:** Task Group 2 (requires persistent_memory.py function names)

- [x] 7.0 Complete Demo Viewer memory operation icons
  - [x] 7.1 Write 2-3 focused tests for Demo Viewer icons
    - Test `remember_preference` calls display save icon (💾)
    - Test `recall_preferences` calls display search icon (🔍)
    - Test `log_feedback` calls display star icon (⭐)
  - [x] 7.2 Update execution log rendering in Demo Viewer
    - Identify function call patterns in execution log
    - Add icon mapping for persistent memory functions:
      - `remember_preference` → 💾 (disk/save icon)
      - `recall_preferences` → 🔍 (magnifying glass/search icon)
      - `log_feedback` → ⭐ (star icon)
    - Follow existing icon pattern for other function types
  - [x] 7.3 Add CSS styling for memory icons
    - Style icons consistently with existing Demo Viewer theme
    - Add hover tooltips explaining each operation type
    - Ensure icons are visible but not intrusive
  - [x] 7.4 Ensure Demo Viewer icon tests pass
    - Run ONLY the 2-3 tests written in 7.1
    - Verify icons render correctly in execution log
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-3 tests written in 7.1 pass
- Memory operations are visually distinguishable in execution log
- Icons match the spec (💾, 🔍, ⭐)
- Tooltips provide helpful context

---

### Documentation Layer

#### Task Group 8: Documentation and Hooks
**Dependencies:** Task Groups 2-7 (requires feature implementation complete)

- [x] 8.0 Complete documentation and validation hooks
  - [x] 8.1 Write 2-3 focused tests for hook validation
    - Test hook detects missing persistent_memory imports when LTM enabled
    - Test hook validates correct function names (remember_preference, recall_preferences)
    - Test hook passes when persistent_memory properly configured
  - [x] 8.2 Add Pattern 10: Persistent Memory to `resources/agentify-power/POWER.md`
    - Follow Pattern 9 (Cross-Agent Memory) documentation structure
    - Include configuration schema example for `memory.persistence`
    - Document initialization pattern in orchestrator
    - Provide tool usage examples for each function
    - Explain dual identity pattern (user_id vs session_id)
    - Explain namespace pattern (`/users/{effective_id}/preferences`)
  - [x] 8.3 Create `resources/agentify-hooks/persistent-memory-validator.kiro.hook`
    - Validate `persistent_memory` imports when LTM enabled in config
    - Check function names are from shared module (not locally defined)
    - Check `init_persistent_memory()` called in orchestrator main.py
    - Follow existing hook patterns (e.g., `tool-decorator-validator.kiro.hook`)
  - [x] 8.4 Update `resources/prompts/steering/agentify-integration-steering.prompt.md`
    - Add section on persistent memory integration
    - Document when to use STM vs LTM
    - Include code examples for preference storage
  - [x] 8.5 Update `resources/prompts/steering/structure-steering.prompt.md`
    - Add `persistent_memory.py` to shared module listing
    - Document file location and purpose
  - [x] 8.6 Update Quick Checklist in `POWER.md`
    - Add: "If using persistent memory, `init_persistent_memory(user_id, session_id)` called in orchestrator"
    - Add: "Persistent memory tools imported from `agents.shared`, not defined locally"
  - [x] 8.7 Ensure documentation and hook tests pass
    - Run ONLY the 2-3 tests written in 8.1
    - Verify POWER.md renders correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-3 tests written in 8.1 pass
- POWER.md Pattern 10 is complete and follows Pattern 9 format
- New hook validates persistent memory configuration
- Steering prompts include persistent memory guidance
- Quick Checklist updated with persistent memory items

---

### Testing

#### Task Group 9: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-8

- [x] 9.0 Review existing tests and fill critical gaps only
  - [x] 9.1 Review tests from Task Groups 1-8
    - Review the 3-5 tests written for type definitions (Task 1.1)
    - Review the 4-6 tests written for persistent_memory.py (Task 2.1)
    - Review the 3-4 tests written for infrastructure scripts (Task 3.1)
    - Review the 2-3 tests written for config schema (Task 4.1)
    - Review the 4-5 tests written for Step 4 UI (Task 5.1)
    - Review the 4-6 tests written for Step 5 UI (Task 6.1)
    - Review the 2-3 tests written for Demo Viewer (Task 7.1)
    - Review the 2-3 tests written for documentation/hooks (Task 8.1)
    - Total existing tests: approximately 25-35 tests
  - [x] 9.2 Analyze test coverage gaps for persistent memory feature only
    - Identify critical integration paths lacking coverage
    - Focus on end-to-end workflow: enable LTM -> configure agents -> run workflow -> verify persistence
    - Prioritize user journey over individual component gaps
    - Do NOT assess entire application test coverage
  - [x] 9.3 Write up to 8 additional strategic tests maximum
    - Integration test: Full wizard flow with LTM enabled
    - Integration test: Config.json generation includes persistence settings
    - Integration test: Orchestrate.sh receives correct env vars
    - End-to-end test: Agent workflow using persistent memory functions
    - Skip edge cases, performance tests unless business-critical
  - [x] 9.4 Run feature-specific tests only
    - Run ONLY tests related to persistent session memory feature
    - Expected total: approximately 35-45 tests maximum
    - Do NOT run the entire application test suite
    - Verify all critical user workflows pass

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 35-45 tests total)
- Critical end-to-end workflows for persistent memory are covered
- No more than 8 additional tests added when filling gaps
- Testing focused exclusively on persistent session memory feature

---

## Execution Order

Recommended implementation sequence:

1. **Task Group 1: Type Definitions** (Foundation - no dependencies)
2. **Task Group 2: persistent_memory.py** (Can run parallel with Task Group 1)
3. **Task Group 3: Script Updates** (Requires Task Group 2)
4. **Task Group 4: Config Schema** (Requires Task Group 1)
5. **Task Group 5: Step 4 UI** (Requires Task Groups 1, 4)
6. **Task Group 6: Step 5 UI** (Requires Task Groups 1, 5)
7. **Task Group 7: Demo Viewer** (Requires Task Group 2, can run parallel with Tasks 5-6)
8. **Task Group 8: Documentation** (Requires Task Groups 2-7)
9. **Task Group 9: Test Review** (Final - requires all previous groups)

### Parallel Execution Opportunities

The following task groups can be developed in parallel:

**Parallel Track A (Python/Scripts):**
- Task Group 2: persistent_memory.py
- Task Group 3: Script Updates (after Task Group 2)

**Parallel Track B (TypeScript/UI):**
- Task Group 1: Type Definitions
- Task Group 4: Config Schema (after Task Group 1)
- Task Group 5: Step 4 UI (after Task Groups 1, 4)
- Task Group 6: Step 5 UI (after Task Groups 1, 5)

**Parallel Track C (Demo Viewer):**
- Task Group 7: Demo Viewer (after Task Group 2)

---

## Files Summary

### New Files
| File | Task Group |
|------|------------|
| `resources/agents/shared/persistent_memory.py` | 2 |
| `resources/scripts/setup-persistent-memory.sh` | 3 |
| `resources/agentify-hooks/persistent-memory-validator.kiro.hook` | 8 |

### Modified Files
| File | Task Group(s) |
|------|---------------|
| `src/types/wizardPanel.ts` | 1 |
| `src/panels/ideationStep4Logic.ts` | 1, 5 |
| `src/panels/ideationStep4Html.ts` | 5 |
| `src/panels/ideationStep5Logic.ts` | 6 |
| `src/panels/webview/ideationStep5.ts` | 6 |
| `src/panels/tabbedPanel.ts` | 5 |
| `src/services/workflowTriggerService.ts` | 4 |
| `src/services/agentDesignService.ts` | 6 |
| `resources/agents/shared/__init__.py` | 2 |
| `resources/scripts/setup.sh` | 3 |
| `resources/scripts/destroy.sh` | 3 |
| `resources/scripts/orchestrate.sh` | 3 |
| `resources/agentify-power/POWER.md` | 8 |
| `resources/prompts/steering/agentify-integration-steering.prompt.md` | 8 |
| `resources/prompts/steering/structure-steering.prompt.md` | 8 |

---

## Key Patterns to Follow

### From memory_client.py (Task Group 2)
- Fire-and-forget error handling with `logger.warning()`
- `_is_*_available()` guard pattern
- Module-level globals for client state
- Graceful return values on failure
- Use `MemoryClient` class (not `MemorySessionManager`)
- Use `create_event()` for storing, `retrieve_memories()` for searching

### From setup-memory.sh (Task Group 3)
- Modular script pattern (called by setup.sh)
- Source `setup-common.sh` for shared functions
- Check config for feature enablement
- Idempotent resource creation (check if exists)
- Store resource ID in `infrastructure.json`

### From ideationStep4Logic.ts (Task Group 5)
- `SecurityGuardrailsState` interface extension
- Toggle handler methods with callback updates
- `validateMemoryExpiryDays()` validation pattern

### From ideationStep5Logic.ts (Task Group 6)
- `*Edited` boolean flags on ProposedAgent
- `mergeAiProposalRespectingEditedFlags()` pattern
- `handleUpdate*()` method naming convention

### Dual Interface Synchronization (Critical)
Both interfaces must have matching fields:
- `SecurityGuardrailsState` in `src/panels/ideationStep4Logic.ts`
- `SecurityState` in `src/types/wizardPanel.ts`

When adding fields to one, ALWAYS add to both with same names and types.

---

## Configuration Schema Reference

### .agentify/config.json (Updated)
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

### .agentify/infrastructure.json (Updated)
```json
{
  "MEMORY_ID": "mem-xxxxxxxx",
  "PERSISTENT_MEMORY_ID": "mem-yyyyyyyy",
  "...": "..."
}
```

### Environment Variables (orchestrate.sh)
| Variable | Source | Description |
|----------|--------|-------------|
| `MEMORY_ID` | infrastructure.json | Cross-agent memory resource ID |
| `PERSISTENT_MEMORY_ID` | infrastructure.json | Persistent memory resource ID |
| `USER_ID` | CLI argument | Optional user identity for persistent memory |
