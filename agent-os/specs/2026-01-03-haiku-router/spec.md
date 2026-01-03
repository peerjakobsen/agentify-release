# Specification: Lightweight Router Model (Haiku)

## Goal
Add an optional Haiku-based routing utility that uses Claude Haiku (~10x cheaper, ~3x faster than Sonnet) for routing decisions in Graph and Swarm orchestration patterns, reducing cost and latency for simple routing without sacrificing flexibility.

## User Stories
- As a developer, I want routing decisions made by a fast, cheap model so that my workflows execute quickly without excessive Bedrock costs
- As a developer, I want routing failures to silently fall back to existing strategies so that my demos never fail due to routing infrastructure issues

## Specific Requirements

**Haiku Router Utility Function**
- Add `route_with_haiku()` async function to orchestrator_utils.py
- Add `invoke_haiku()` low-level function for Bedrock Haiku model invocation
- Use global inference profile model ID: `global.anthropic.claude-haiku-4-5-20251001-v1:0`
- Truncate agent response to ~500 characters for minimal context and fast classification
- Return agent ID string or "COMPLETE" if workflow should end
- Include timeout handling with graceful fallback on failures

**Routing Context Loading**
- Add `get_routing_context()` function to load routing guidance from tech.md steering file
- Look for `## Routing Guidance` or `## Agent Routing Rules` section in tech-steering file
- Return empty string if section not found (graceful degradation)

**Haiku Router Prompt Structure**
- Input: current agent name, truncated response (~500 chars), available agents list, routing guidance
- Do NOT pass full conversation context to router (minimal context for speed)
- Output must be parsed as single agent ID or "COMPLETE" keyword

**Configuration Schema Extension**
- Add `routing` section to AgentifyConfig interface in src/types/config.ts
- Add `useHaikuRouter` boolean, default `false` (opt-in to avoid surprise costs)
- Add `routerModel` string, default to global Haiku model ID, allow override for SCP restrictions
- Add `fallbackToAgentDecision` boolean, default `true` for silent fallback
- Update configService.ts `updateConfig()` to handle routing section deep merge
- Update validateConfigSchema() to validate optional routing section

**Graph Pattern Integration**
- Integrate Haiku routing as "Strategy 0" in main_graph.py's `route_to_next_agent()` function
- Only activate when config `useHaikuRouter: true`
- On Haiku routing failure, fall through to existing strategies (explicit, classification, static, complete)
- Log warning to stderr on routing failures but never block execution

**Swarm Pattern Integration**
- Integrate Haiku routing as fallback in main_swarm.py's `extract_handoff_from_response()` function
- Primary: Agent's own handoff decision (preserves Swarm philosophy of autonomous agents)
- Fallback: Haiku router only when agent doesn't specify handoff (safety net behavior)
- Log warning when Haiku fallback activates

**Router Decision Event**
- Emit new `router_decision` stdout event type for Demo Viewer visibility
- Event payload: `router_model`, `from_agent`, `next_agent`, `duration_ms`
- Include standard fields: `event_type`, `timestamp`, `workflow_id`, `trace_id`
- Use existing `emit_event()` utility function for consistent emission

**Steering File Updates**
- Update tech-steering.prompt.md to document `## Routing Guidance` section pattern
- Document that routing guidance is optional and used only when Haiku router is enabled
- Update agentify-integration-steering.prompt.md with routing context pattern

## Visual Design
No visual assets provided.

## Existing Code to Leverage

**orchestrator_utils.py - Event Emission Pattern**
- Reuse `emit_event()` function for router_decision events
- Follow existing event schema with `event_type`, `timestamp`, `workflow_id`, `trace_id`
- Use `get_timestamp()` for epoch milliseconds format

**orchestrator_utils.py - Bedrock Client Pattern**
- Reuse boto3 client setup pattern from `invoke_agent_remotely()`
- Follow error handling pattern with try/except and stderr logging
- Use similar streaming response handling if needed

**main_graph.py - Routing Strategy Pattern**
- Insert Haiku routing as Strategy 0 before existing strategies
- Follow existing strategy documentation style with clear section headers
- Match function signature and return type of `route_to_next_agent()`

**main_swarm.py - Handoff Extraction Pattern**
- Add Haiku fallback after existing handoff extraction methods fail
- Follow existing validation pattern checking agent exists in available agents
- Match return type (Optional[str]) and semantics

**src/types/config.ts - Configuration Schema Pattern**
- Follow existing interface definition style with JSDoc comments
- Add new RoutingConfig interface following BedrockInfrastructureConfig pattern
- Update validateConfigSchema() following existing optional section validation

## Out of Scope
- Caching routing decisions across invocations
- Learning from routing history to improve future decisions
- A/B testing between different routing strategies
- Custom router models beyond config override (only model ID override supported)
- Routing confidence scores or multi-candidate ranking
- Multi-model routing ensemble (single Haiku model only)
- Workflow pattern integration (fixed DAG requires no runtime routing)
- UI for configuring routing (config.json manual edit only)
- Router metrics dashboard or analytics
- Batch routing decisions for multiple agents
