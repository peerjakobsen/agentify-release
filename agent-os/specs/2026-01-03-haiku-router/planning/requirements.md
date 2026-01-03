# Spec Requirements: Lightweight Router Model (Haiku)

## Initial Description
Add optional Haiku-based routing for Graph and Swarm patterns. A dedicated lightweight routing agent that uses Claude Haiku (~10x cheaper, ~3x faster than Sonnet) specifically for routing decisions.

**Problem Statement:**
Current routing approaches have trade-offs:
- Hardcoded routes: Fast but brittle, can't handle semantic nuance
- Agent-decided routes: Flexible but uses full Sonnet model for simple routing decisions (slow, expensive)
- Classification mapping: Requires structured output from agents, adds complexity to agent prompts

**Proposed Solution:**
A dedicated Haiku Router that uses Claude Haiku for fast, cheap routing decisions, integrates as "Strategy 0" in both Graph and Swarm patterns, and shows routing decisions in Demo Viewer execution log.

## Requirements Discussion

### First Round Questions

**Q1:** Haiku Model Selection - Should we use `global.anthropic.claude-haiku-4-5-20251001-v1:0` as the router model ID (matching the cross-region inference pattern), or a different model ID?
**Answer:** Global inference profile is correct (`global.anthropic.claude-haiku-4-5-20251001-v1:0`), but allow override for users with SCP restrictions. Don't complicate the default.

**Q2:** Default Configuration - Should the Haiku router be disabled by default (opt-in) or enabled by default?
**Answer:** Disabled by default (opt-in). `"useHaikuRouter": false` as default. Avoids surprise Bedrock costs.

**Q3:** Fallback Behavior - When `fallbackToAgentDecision: true` and Haiku routing fails, should we silently fall back to existing routing strategies?
**Answer:** Yes, silent fallback to existing strategies. Log a warning for debugging, but proceed. Demo must never fail due to routing infrastructure issues.

**Q4:** Routing Context Source - Where should the `get_routing_context()` function load routing guidance from?
**Answer:** Dedicated section in `tech.md` (not a new file). Section name: `## Routing Guidance` or `## Agent Routing Rules`. Avoids proliferation of steering files.

**Q5:** Haiku Prompt Structure - What context should Haiku receive for routing decisions?
**Answer:** Agent name + response (truncated to ~500 chars) + available agents + routing guidance. NOT the full conversation. Minimal context for fast classification.

**Q6:** Demo Viewer Event Type - Should router decisions be a new event type or embedded in existing events?
**Answer:** New `router_decision` event type with payload: `{router_model, from_agent, next_agent, duration_ms}`. Clear visibility for demos, doesn't pollute node_stop semantics.

**Q7:** Swarm Pattern Integration - Should Haiku routing replace or supplement agent handoff decisions?
**Answer:** Haiku only kicks in when agent doesn't explicitly specify handoff. Acts as "safety net" while preserving Swarm philosophy of autonomous agent decisions.

**Q8:** What should we explicitly exclude from this iteration?
**Answer:** Defer the following:
- Caching routing decisions
- Learning from routing history
- A/B testing routers
- Custom router models (beyond config override)
- Routing confidence scores
- Multi-model routing ensemble

Scope: Haiku router is a single, optional, fast routing utility.

### Existing Code to Reference

**Similar Features Identified:**
- Feature: Bedrock API invocation - Path: `resources/agents/shared/orchestrator_utils.py` (invoke_agent_remotely pattern)
- Feature: Configuration schema - Path: `src/services/configService.ts` and `src/types/index.ts` (AgentifyConfig interface)
- Feature: Steering prompt patterns - Path: `resources/prompts/steering/tech-steering.prompt.md`
- Feature: Event emission patterns - Path: `resources/agents/shared/orchestrator_utils.py` (emit_event function)
- Feature: Graph routing strategies - Path: `resources/agents/main_graph.py` (route_to_next_agent function)
- Feature: Swarm handoff extraction - Path: `resources/agents/main_swarm.py` (extract_handoff_from_response function)

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A - No visual assets to analyze.

## Requirements Summary

### Functional Requirements
- Add `route_with_haiku()` function to orchestrator_utils.py that invokes Claude Haiku for routing decisions
- Add `invoke_haiku()` low-level function for Haiku model invocation via Bedrock
- Add `get_routing_context()` function to load routing guidance from tech.md steering file
- Integrate Haiku routing as "Strategy 0" in main_graph.py's `route_to_next_agent()` function
- Integrate Haiku routing as fallback in main_swarm.py's `extract_handoff_from_response()` function
- Add `routing` configuration section to `.agentify/config.json` schema
- Emit new `router_decision` stdout event for Demo Viewer visibility
- Update tech-steering.prompt.md to include routing configuration section
- Update agentify-integration-steering.prompt.md with routing context pattern
- Add Pattern 9: Haiku Routing to POWER.md

### Configuration Schema
```json
{
  "routing": {
    "useHaikuRouter": false,
    "routerModel": "global.anthropic.claude-haiku-4-5-20251001-v1:0",
    "fallbackToAgentDecision": true
  }
}
```

- `useHaikuRouter`: Boolean, default `false` (opt-in)
- `routerModel`: String, default to global Haiku model, allow override for SCP restrictions
- `fallbackToAgentDecision`: Boolean, default `true`, enables silent fallback on routing failures

### Haiku Router Prompt Structure
Inputs to the router prompt:
1. Current agent name (who just completed)
2. Agent response text (truncated to ~500 characters)
3. List of available agents
4. Routing guidance from tech.md steering file

Output: Agent ID string or "COMPLETE" if workflow should end

### Event Schema
New stdout event type: `router_decision`
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

### Pattern Integration

**Graph Pattern (main_graph.py):**
- Strategy 0: Haiku router (if `useHaikuRouter: true`)
- Existing strategies as fallback (explicit, classification, static, complete)

**Swarm Pattern (main_swarm.py):**
- Primary: Agent's own handoff decision (preserves Swarm philosophy)
- Fallback: Haiku router when agent doesn't specify handoff (safety net)

### Reusability Opportunities
- Reuse `emit_event()` pattern for router_decision events
- Reuse Bedrock client setup from existing agent invocation code
- Reuse configuration schema patterns from existing config types
- Follow existing decorator/utility patterns in orchestrator_utils.py

### Scope Boundaries

**In Scope:**
- Single Haiku router utility function
- Configuration to enable/disable router
- Configuration to override router model ID
- Silent fallback to existing routing strategies
- Warning logs on routing failures
- New router_decision event for Demo Viewer
- Routing guidance section in tech.md steering
- Pattern 9 documentation in POWER.md
- Graph pattern integration (Strategy 0)
- Swarm pattern integration (fallback only)

**Out of Scope:**
- Caching routing decisions
- Learning from routing history
- A/B testing between routing strategies
- Custom router models beyond config override
- Routing confidence scores
- Multi-model routing ensemble
- Workflow pattern integration (fixed DAG, no runtime routing needed)
- UI for configuring routing (config.json only)

### Technical Considerations
- Use global inference profile model ID for cross-region compatibility
- Truncate agent response to ~500 chars for fast routing
- Log warnings on failures but never block workflow execution
- Async function signature to match existing orchestrator patterns
- Timeout handling with graceful fallback
- No conversation context passed to router (minimal context for speed)

### Files to be Modified/Created
| File | Action | Description |
|------|--------|-------------|
| `resources/agents/shared/orchestrator_utils.py` | Modify | Add `route_with_haiku()`, `invoke_haiku()`, `get_routing_context()` |
| `resources/agents/main_graph.py` | Modify | Add Haiku routing as Strategy 0 in `route_to_next_agent()` |
| `resources/agents/main_swarm.py` | Modify | Add Haiku fallback in `extract_handoff_from_response()` |
| `src/services/configService.ts` | Modify | Add routing configuration schema |
| `src/types/index.ts` | Modify | Add routing types to AgentifyConfig interface |
| `resources/prompts/steering/tech-steering.prompt.md` | Modify | Add routing configuration section |
| `resources/prompts/steering/agentify-integration-steering.prompt.md` | Modify | Add routing context pattern |
| `resources/agentify-power/POWER.md` | Modify | Add Pattern 9: Haiku Routing |
