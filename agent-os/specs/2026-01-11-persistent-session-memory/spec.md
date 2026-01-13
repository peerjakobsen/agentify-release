# Specification: Persistent Session Memory

## Goal
Enable agents to learn from past workflow sessions by implementing long-term memory (LTM) using AgentCore Memory's semantic and event strategies, building on the existing cross-agent memory infrastructure from Item 39.

## User Stories
- As a demo presenter, I want agents to remember user preferences across sessions so that I can demonstrate progressive personalization with persistent user personas like "Maria, Regional Manager"
- As a developer, I want a clear separation between within-session sharing (STM) and cross-session learning (LTM) so that I can choose the appropriate memory pattern for each use case

## Specific Requirements

**Dual Identity Pattern**
- Support `user_id` passed via `--user-id` CLI argument for persistent user personas
- Fall back to `session_id` for anonymous persistence when no user_id provided
- Implement identity resolution: `effective_id = user_id or session_id or os.environ.get('WORKFLOW_ID')`
- Pass `user_id` through orchestrate.sh to the Python subprocess

**Two-Module Memory Architecture**
- Keep `memory_client.py` (Item 39) unchanged for STM with namespace `/{project}/sessions/{session_id}/context`
- Create new `persistent_memory.py` for LTM with namespace `/{project}/users/{user_id}/preferences`
- LTM module uses `MemorySessionManager` from AgentCore Memory SDK
- Storage via `add_turns()` triggers automatic LTM extraction via configured strategies
- Retrieval via `search_long_term_memories()` for searching extracted LTM records

**Wizard Step 4 Infrastructure Toggle**
- Add "Long-Term Memory" toggle below existing "Cross-Agent Memory" toggle
- LTM toggle auto-enables STM toggle as prerequisite (grays out STM when LTM enabled)
- Add retention dropdown with options: 7 / 30 / 90 days (default 30)
- Follow existing toggle pattern from `crossAgentMemoryEnabled` in `SecurityGuardrailsState`

**Wizard Step 5 Per-Agent Memory Configuration**
- Add collapsible "Memory Configuration" section to each agent card
- Include checkboxes: "Uses Short-Term Memory" and "Uses Long-Term Memory"
- Add LTM strategy dropdown: Semantic, Summary, User Preference
- AI suggests configuration based on agent role classification
- Add `memoryEdited?: boolean` flag to `ProposedAgent` interface to preserve user overrides

**Pre-Bundled persistent_memory.py Module**
- `init_persistent_memory(user_id, memory_id)` - Initialize with effective_id pattern
- `remember_preference(category, preference, value)` - Store preference via `add_turns()`
- `recall_preferences(query, category)` - Search LTM via `search_long_term_memories()`
- `log_feedback(entity_type, entity_id, rating, notes)` - Log feedback for learning
- Follow same fire-and-forget error handling pattern as `memory_client.py`

**Setup and Destroy Script Updates**
- Add Step 2c to `setup.sh` for persistent memory resource creation
- Read LTM config from `.agentify/config.json` memory.persistence section
- Store `PERSISTENT_MEMORY_ID` in `.agentify/infrastructure.json`
- Add persistent memory cleanup to `destroy.sh` Phase 1

**Demo Viewer Inline Memory Icons**
- Display distinctive icons in execution log for memory operations
- `remember_preference` = save icon (floppy disk)
- `recall_preferences` = search icon (magnifying glass)
- `log_feedback` = star icon

## Visual Design
No visual mockups provided.

## Existing Code to Leverage

**`resources/agents/shared/memory_client.py`**
- Copy initialization pattern with `MemoryClient` and namespace handling
- Reuse fire-and-forget error handling with `logger.warning()` and graceful return values
- Follow same `_is_memory_available()` guard pattern
- Apply identical decorator order: `@tool` on top, `@instrument_tool` below

**`src/panels/ideationStep4Logic.ts`**
- Copy toggle state management pattern from `crossAgentMemoryEnabled` and `memoryExpiryDays`
- Reuse `validateMemoryExpiryDays()` pattern for retention validation
- Follow `SecurityGuardrailsState` interface extension pattern

**`src/panels/ideationStep5Logic.ts`**
- Copy `ProposedAgent` interface extension pattern for adding `memoryEdited` flag
- Reuse `handleUpdate*()` method patterns for memory config changes
- Follow AI suggestion merge pattern that respects edited flags

**`resources/scripts/setup-memory.sh`**
- Extend or duplicate for persistent memory resource creation
- Follow SSM parameter storage pattern for `PERSISTENT_MEMORY_ID`

**`resources/agentify-power/POWER.md` Pattern 9**
- Follow same documentation structure for Pattern 10: Persistent Memory
- Include configuration schema, initialization pattern, and tool usage examples

## Out of Scope
- Memory import/export functionality
- Cross-project memory sharing
- Analytics dashboard for memory usage
- Memory deletion UI from Demo Viewer
- Custom memory strategies beyond Semantic, Summary, User Preference
- Memory versioning or history tracking
- Real-time sync indicators between sessions
- Memory search/browse from Demo Viewer panel (inline log only)
- Memory Explorer panel (deferred to Phase 6)
