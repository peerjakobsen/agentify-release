# Spec Requirements: Persistent Session Memory

## Initial Description

Extend the Agentify extension to support persistent session memory, enabling agents to learn from past workflow sessions using AgentCore Memory's semantic and event strategies. This builds on Item #39 (cross-agent memory) to add cross-session learning capabilities.

**Use Cases:**
1. User Preference Learning - Remember preferences across sessions (e.g., meal preferences, communication styles)
2. Historical Context - Access past interactions when relevant
3. Progressive Personalization - Improve responses based on accumulated feedback
4. Session Continuity - Resume interrupted workflows with full context

## Requirements Discussion

### First Round Questions

**Q1:** Memory Scope and User Identity - How should the system identify users across sessions?
**Answer:** Support BOTH `user_id` (passed via `--user-id` CLI arg) AND anonymous session-based persistence. Primary use case is `user_id` for demos with persistent user personas (e.g., "Maria, Regional Manager"). Fallback: If no user_id provided, use `session_id` as identity. Implementation pattern: `effective_id = user_id or session_id or os.environ.get('WORKFLOW_ID')`

**Q2:** Memory Strategy Selection in Step 5 - How should memory configuration work per agent?
**Answer:** Follow AI suggestion pattern with user override capability:
- Customer-facing agents: LTM with `UserPreferenceStrategy`
- Data processing agents: STM only
- Coordinator/orchestrator agents: Both STM + LTM with `SemanticStrategy`
Add `memoryEdited?: boolean` flag to prevent AI overwriting user choices when they navigate back to the step.

**Q3:** Demo Viewer Memory Visualization - How should memory operations appear in the UI?
**Answer:** MVP approach - inline execution log with distinctive icons (no separate panel). Icons:
- `remember_preference` = save icon
- `recall_preferences` = search icon
- `log_feedback` = star icon
Memory Explorer panel deferred to Phase 6.

**Q4:** Session vs. User Memory Namespaces - How should memory be organized?
**Answer:** Two namespace patterns managed by separate modules:
- `memory_client.py` (Item 39): `/{project}/sessions/{session_id}/context` - for cross-agent sharing within workflow
- `persistent_memory.py` (Item 39.5): `/{project}/users/{user_id}/preferences` - for cross-session learning

**Q5:** Memory Retention Defaults - What should the retention policy options be?
**Answer:** Default: 30 days. Options: 7 / 30 / 90 days. NO "permanent" option to avoid unbounded storage costs and compliance concerns.

**Q6:** Backwards Compatibility with Item 39 - Should we unify the memory APIs?
**Answer:** Keep DISTINCT function names (no unified API):
- `memory_client.py`: `search_memory()`, `store_context()`
- `persistent_memory.py`: `remember_preference()`, `recall_preferences()`, `log_feedback()`
This maintains clear semantic separation between within-workflow sharing and cross-session learning.

**Q7:** Infrastructure Toggle in Step 4 - How should memory toggles interact?
**Answer:** LTM should AUTO-ENABLE cross-agent memory (STM) as prerequisite. When LTM toggle enabled, STM toggle auto-checks and becomes grayed out. LTM depends on STM being available.

**Q8:** Out of Scope - What should NOT be included?
**Answer:**
**Excluded from this spec:**
- Memory import/export functionality
- Cross-project memory sharing
- Analytics dashboard for memory usage
- Memory deletion UI
- Custom memory strategies beyond the 3 pre-built options
- Memory versioning
- Real-time sync between sessions
- Memory search from Demo Viewer (inline log only)

**In Scope:**
- Wizard UI updates (Step 4 infrastructure toggle, Step 5 per-agent config)
- Pre-bundled `persistent_memory.py` module with 3 tools
- Setup/destroy script updates for persistent memory resource
- POWER.md updates with Pattern 10
- Hook validation for persistent memory imports
- Inline execution log with memory operation icons

### Existing Code to Reference

**Similar Features Identified:**
- Feature: Cross-Agent Memory (Item 39) - Path: `resources/agents/shared/memory_client.py`
- Components to potentially reuse: Memory initialization pattern, tool decorator order, instrumentation wrapper
- Backend logic to reference: `setup-memory.sh`, `orchestrate.sh` memory ID handling

### Follow-up Questions

No follow-up questions needed - the user provided comprehensive answers covering all aspects of the feature.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A

## Requirements Summary

### Functional Requirements

**Wizard Step 4 (Infrastructure):**
- Add "Long-Term Memory" toggle that auto-enables STM when selected
- Add retention policy dropdown (7 / 30 / 90 days, default 30)
- STM toggle grayed out when LTM is enabled (shows dependency)

**Wizard Step 5 (Per-Agent Memory):**
- Collapsible "Memory Configuration" section per agent card
- Checkboxes: "Uses Short-Term Memory" and "Uses Long-Term Memory"
- LTM strategy dropdown: Semantic, Summary, User Preference
- AI suggests configuration based on agent role (customer-facing vs data processing vs coordinator)
- `memoryEdited?: boolean` flag to preserve user overrides

**Pre-Bundled Module (`persistent_memory.py`):**
- `init_persistent_memory(user_id, memory_id)` - Initialize with effective_id pattern
- `remember_preference(category, preference, value)` - Store user preference via `add_turns()`
- `recall_preferences(query, category)` - Search LTM via `search_long_term_memories()`
- `log_feedback(entity_type, entity_id, rating, notes)` - Log feedback for learning

**Setup/Destroy Scripts:**
- `setup.sh` Step 2c: Create persistent memory resource if enabled
- `destroy.sh`: Add persistent memory cleanup
- Pass `PERSISTENT_MEMORY_ID` env var to orchestrator

**Demo Viewer:**
- Inline execution log with distinctive icons for memory operations
- No separate Memory Explorer panel (deferred to Phase 6)

### Reusability Opportunities

- Copy memory initialization pattern from `memory_client.py`
- Extend existing `setup-memory.sh` or create `setup-persistent-memory.sh`
- Reuse Step 4 toggle UI patterns from existing guardrails section
- Follow Step 5 agent card expansion pattern for memory config section
- Apply existing `memoryEdited` flag pattern from `toolsEdited` implementation

### Scope Boundaries

**In Scope:**
- Wizard UI updates (Step 4 toggle + retention, Step 5 per-agent config)
- Pre-bundled `persistent_memory.py` with 3 tools
- Setup/destroy script updates
- POWER.md Pattern 10: Persistent Memory
- Hook updates for import validation
- Inline execution log icons

**Out of Scope:**
- Memory import/export
- Cross-project memory sharing
- Analytics dashboard
- Memory deletion UI
- Custom memory strategies
- Memory versioning
- Real-time sync
- Memory search from Demo Viewer
- Memory Explorer panel (Phase 6)

### Technical Considerations

**Identity Pattern:**
```python
effective_id = user_id or session_id or os.environ.get('WORKFLOW_ID')
```
- CLI arg: `--user-id` (optional)
- Fallback to session_id for anonymous persistence

**Namespace Architecture:**
- STM (Item 39): `/{project}/sessions/{session_id}/context`
- LTM (Item 39.5): `/{project}/users/{user_id}/preferences`

**AgentCore Memory SDK:**
- Uses `MemorySessionManager` for session-based access
- `add_turns()` triggers automatic LTM extraction via strategies
- `search_long_term_memories()` searches extracted LTM records
- Cannot write directly to LTM - extraction is automatic

**Configuration Schema (`.agentify/config.json`):**
```json
{
  "memory": {
    "crossAgent": {
      "enabled": true,
      "memoryId": "..."
    },
    "persistence": {
      "enabled": true,
      "strategy": "semantic",
      "retentionDays": 30,
      "namespacePrefix": "/myproject",
      "persistentMemoryId": "..."
    }
  }
}
```

**Environment Variables:**
- `MEMORY_ID` - Cross-agent memory (Item 39)
- `PERSISTENT_MEMORY_ID` - Cross-session learning (Item 39.5)

**Decorator Order (Critical):**
```python
@tool                    # FIRST (inner wrapper - Strands SDK)
@instrument_tool         # ON TOP (outer wrapper - observability)
def remember_preference():
```

**Files to Create/Modify:**
- `resources/agents/shared/persistent_memory.py` - New pre-bundled module
- `resources/agents/shared/__init__.py` - Export persistent memory functions
- `resources/scripts/setup.sh` - Add Step 2c for persistent memory
- `resources/scripts/destroy.sh` - Add cleanup
- `src/panels/tabbedPanel.ts` - Step 4 memory persistence UI
- `src/panels/ideationStep5Logic.ts` - Per-agent memory config
- `src/panels/webview/ideationStep5.ts` - Per-agent memory UI
- `src/types/wizardPanel.ts` - Add memory fields
- `resources/agentify-power/POWER.md` - Pattern 10
- `resources/prompts/steering/agentify-integration-steering.prompt.md` - Add section
- `resources/prompts/steering/structure-steering.prompt.md` - Include in listing
