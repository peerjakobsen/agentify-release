# Spec Initialization

## Roadmap Item
Item 40: Lightweight Router Model (Haiku)

## Initial Description
Add optional Haiku-based routing for Graph and Swarm patterns. A dedicated lightweight routing agent that uses Claude Haiku (~10x cheaper, ~3x faster than Sonnet) specifically for routing decisions.

## Problem Statement
Current routing approaches have trade-offs:
- **Hardcoded routes**: Fast but brittle, can't handle semantic nuance
- **Agent-decided routes**: Flexible but uses full Sonnet model for simple routing decisions (slow, expensive)
- **Classification mapping**: Requires structured output from agents, adds complexity to agent prompts

## Proposed Solution
A dedicated Haiku Router that:
1. Uses Claude Haiku for fast, cheap routing decisions
2. Integrates as "Strategy 0" in both Graph and Swarm patterns
3. Analyzes agent responses to determine next agent
4. Shows routing decisions in Demo Viewer execution log

## Key Implementation Details from Roadmap

### New Functions in orchestrator_utils.py
- `route_with_haiku()` - Main routing function
- `invoke_haiku()` - Low-level Haiku invocation
- `get_routing_context()` - Load routing guidance from steering files

### Updates to main_graph.py
- Add Haiku routing as Strategy 0 (if enabled)
- Fallback to existing strategies when disabled

### Updates to main_swarm.py
- Add optional Haiku routing override
- Agent handoff extraction enhanced with Haiku analysis

### Configuration
New section in `.agentify/config.json`:
```json
{
  "routing": {
    "useHaikuRouter": true,
    "routerModel": "global.anthropic.claude-haiku-4-5-20251001-v1:0",
    "fallbackToAgentDecision": true
  }
}
```

### Files to be Modified/Created
- `resources/agents/shared/orchestrator_utils.py` - Add Haiku routing functions
- `resources/agents/main_graph.py` - Add Strategy 0 Haiku routing
- `resources/agents/main_swarm.py` - Add optional Haiku routing override
- `src/services/configService.ts` - Add routing configuration schema
- `resources/prompts/steering/tech-steering.prompt.md` - Add routing config section
- `resources/prompts/steering/agentify-integration-steering.prompt.md` - Add routing context pattern
- `resources/agentify-power/POWER.md` - Add Pattern 9: Haiku Routing

## Demo Viewer Visibility
Router decisions should appear in execution log:
```
14:32:02  [compass] Haiku Router: "technical_agent" (12ms)
14:32:02  [play] Technical Agent activated
```
