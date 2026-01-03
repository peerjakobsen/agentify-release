# Task Breakdown: Lightweight Router Model (Haiku)

## Overview
Total Tasks: 6 Task Groups, 34 Sub-tasks

## Task List

### Configuration Layer

#### Task Group 1: TypeScript Configuration Schema
**Dependencies:** None

- [x] 1.0 Complete configuration layer
  - [x] 1.1 Write 2-4 focused tests for routing configuration
    - Test RoutingConfig interface type validation
    - Test deep merge of routing section in updateConfig()
    - Test default values when routing section is omitted
    - Test config validation with optional routing section
  - [x] 1.2 Add RoutingConfig interface to src/types/config.ts
    - Add `useHaikuRouter: boolean` (default false, opt-in)
    - Add `routerModel: string` (default `global.anthropic.claude-haiku-4-5-20251001-v1:0`)
    - Add `fallbackToAgentDecision: boolean` (default true)
    - Add JSDoc comments following BedrockInfrastructureConfig pattern
  - [x] 1.3 Update AgentifyConfig interface
    - Add optional `routing?: RoutingConfig` property
    - Follow existing optional section pattern
  - [x] 1.4 Update configService.ts updateConfig() function
    - Handle routing section deep merge
    - Preserve existing routing values when partial updates provided
  - [x] 1.5 Update validateConfigSchema() function
    - Add validation for optional routing section
    - Validate boolean types for useHaikuRouter and fallbackToAgentDecision
    - Validate string type for routerModel
  - [x] 1.6 Ensure configuration layer tests pass
    - Run ONLY the 2-4 tests written in 1.1
    - Verify type definitions compile correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-4 tests written in 1.1 pass
- RoutingConfig interface properly typed with defaults
- Config deep merge preserves existing routing values
- Validation accepts valid routing config and rejects invalid

### Router Utility Layer

#### Task Group 2: Python Router Utility Functions
**Dependencies:** Task Group 1

- [x] 2.0 Complete router utility layer
  - [x] 2.1 Write 5-7 focused tests for router utilities
    - Test invoke_haiku() returns valid response from Bedrock
    - Test invoke_haiku() handles timeout gracefully
    - Test get_routing_context() extracts section from project's `.kiro/steering/tech.md`
    - Test get_routing_context() returns empty string when section not found
    - Test load_routing_config() loads from project's `.agentify/config.json` with defaults
    - Test route_with_haiku() returns valid agent ID or COMPLETE
    - Test route_with_haiku() falls back gracefully on error
  - [x] 2.2 Add invoke_haiku() function to orchestrator_utils.py
    - Create boto3 client following invoke_agent_remotely() pattern
    - Default model ID: `global.anthropic.claude-haiku-4-5-20251001-v1:0`
    - Accept optional model_id parameter to allow config override
    - Add timeout handling (5 second default) with graceful failure
    - Log errors to stderr but never raise to caller
  - [x] 2.3 Add get_routing_context() function to orchestrator_utils.py
    - Load `.kiro/steering/tech.md` from the PROJECT workspace (not extension resources)
    - Look for `## Routing Guidance` or `## Agent Routing Rules` section
    - Extract section content between header and next `##` header (or EOF)
    - Return section content or empty string if not found
    - Handle file not found gracefully (project may not have routing guidance)
  - [x] 2.4 Add load_routing_config() function to orchestrator_utils.py
    - Load `.agentify/config.json` from project workspace
    - Extract `routing` section with defaults: `{useHaikuRouter: false, routerModel: "global.anthropic.claude-haiku-4-5-20251001-v1:0", fallbackToAgentDecision: true}`
    - Cache result using @lru_cache for performance
    - Return config dict with routing settings
  - [x] 2.5 Add route_with_haiku() function to orchestrator_utils.py
    - Accept current_agent, response_text, available_agents parameters
    - Load config via load_routing_config() to get routerModel
    - Truncate response to ~500 characters for minimal context
    - Build prompt with agent name, truncated response, available agents list, routing guidance
    - Parse output as agent ID string or "COMPLETE"
    - Return None on any failure (enables fallback to existing strategies)
  - [x] 2.6 Add router_decision event emission
    - Create emit_router_decision() helper using existing emit_event() pattern
    - Event payload: router_model, from_agent, next_agent, duration_ms
    - Include standard fields: event_type, timestamp, workflow_id, trace_id
    - Call from route_with_haiku() on successful routing
  - [x] 2.7 Ensure router utility tests pass
    - Run ONLY the 5-7 tests written in 2.1
    - Verify Haiku invocation works with mock/test endpoint
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 5-7 tests written in 2.1 pass
- invoke_haiku() successfully calls Bedrock Haiku model
- get_routing_context() extracts routing guidance from project's `.kiro/steering/tech.md`
- load_routing_config() loads routing settings from project's `.agentify/config.json`
- route_with_haiku() returns valid routing decision or None on failure
- router_decision events emit with correct payload format

### Graph Pattern Integration

#### Task Group 3: Graph Pattern Haiku Routing
**Dependencies:** Task Group 2

- [x] 3.0 Complete Graph pattern integration
  - [x] 3.1 Write 2-4 focused tests for Graph Haiku routing
    - Test Haiku routing activates when useHaikuRouter: true
    - Test Haiku routing skipped when useHaikuRouter: false
    - Test fallback to existing strategies on Haiku failure
    - Test route_to_next_agent() returns valid agent with Haiku
  - [x] 3.2 Add Haiku routing as Strategy 0 in main_graph.py
    - Insert before existing strategies in route_to_next_agent()
    - Check config `useHaikuRouter: true` before activating
    - Add clear section header following existing strategy documentation style
  - [x] 3.3 Implement Haiku routing logic in route_to_next_agent()
    - Call route_with_haiku() with current agent and response
    - On valid result, return immediately (skip other strategies)
    - On None result, fall through to existing strategies (explicit, classification, static, complete)
  - [x] 3.4 Add warning logging for Haiku failures
    - Log to stderr when Haiku routing fails
    - Include agent name and failure reason
    - Never block execution or raise exceptions
  - [x] 3.5 Ensure Graph integration tests pass
    - Run ONLY the 2-4 tests written in 3.1
    - Verify Strategy 0 executes before existing strategies
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-4 tests written in 3.1 pass
- Haiku routing executes as Strategy 0 when enabled
- Fallback to existing strategies works seamlessly
- Warning logs appear on routing failures without blocking

### Swarm Pattern Integration

#### Task Group 4: Swarm Pattern Haiku Fallback
**Dependencies:** Task Group 2

- [x] 4.0 Complete Swarm pattern integration
  - [x] 4.1 Write 2-4 focused tests for Swarm Haiku fallback
    - Test agent's own handoff decision takes priority (Swarm philosophy)
    - Test Haiku fallback activates when agent doesn't specify handoff
    - Test Haiku fallback skipped when useHaikuRouter: false
    - Test extract_handoff_from_response() with Haiku returns valid agent
  - [x] 4.2 Add Haiku fallback in extract_handoff_from_response()
    - Preserve existing handoff extraction as primary method
    - Add Haiku routing as fallback after existing methods fail
    - Check config `useHaikuRouter: true` before activating fallback
  - [x] 4.3 Implement safety net behavior
    - Only call route_with_haiku() when no explicit handoff found
    - Validate returned agent exists in available agents list
    - Return None if Haiku routing fails (maintains existing behavior)
  - [x] 4.4 Add warning logging when Haiku fallback activates
    - Log to stderr when using Haiku as safety net
    - Include original agent and Haiku-selected agent
    - Help developers debug unexpected routing paths
  - [x] 4.5 Ensure Swarm integration tests pass
    - Run ONLY the 2-4 tests written in 4.1
    - Verify agent decisions take priority over Haiku
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-4 tests written in 4.1 pass
- Agent's own handoff decisions always take priority
- Haiku fallback only activates when needed
- Warning logs indicate when safety net is used

### Documentation Layer

#### Task Group 5: Steering Files and Documentation
**Dependencies:** Task Groups 2, 3, 4

- [x] 5.0 Complete documentation updates
  - [x] 5.1 Update tech-steering.prompt.md
    - Add `## Routing Guidance` section pattern documentation
    - Document that section is optional and only used when Haiku router enabled
    - Provide example routing guidance content
  - [x] 5.2 Update agentify-integration-steering.prompt.md
    - Add routing context pattern for agent integration
    - Document how routing guidance flows to Haiku router
    - Include example configuration snippet
  - [x] 5.3 Add Pattern 9: Haiku Routing to POWER.md
    - Document the Haiku routing pattern and use cases
    - Explain cost/speed benefits (~10x cheaper, ~3x faster)
    - Include configuration examples
    - Document fallback behavior and safety net concept

**Acceptance Criteria:**
- tech-steering.prompt.md includes Routing Guidance section pattern
- agentify-integration-steering.prompt.md includes routing context pattern
- POWER.md includes Pattern 9 with clear examples

### Testing

#### Task Group 6: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-5

- [x] 6.0 Review existing tests and fill critical gaps only
  - [x] 6.1 Review tests from Task Groups 1-5
    - Review the 2-4 tests written for configuration (Task 1.1)
    - Review the 5-7 tests written for router utilities (Task 2.1)
    - Review the 2-4 tests written for Graph integration (Task 3.1)
    - Review the 2-4 tests written for Swarm integration (Task 4.1)
    - Total existing tests: approximately 12-20 tests
  - [x] 6.2 Analyze test coverage gaps for Haiku Router feature only
    - Identify critical workflows that lack test coverage
    - Focus ONLY on gaps related to this spec's feature requirements
    - Prioritize end-to-end routing workflows
    - Do NOT assess entire application test coverage
  - [x] 6.3 Write up to 8 additional strategic tests maximum
    - Add maximum of 8 new tests to fill identified critical gaps
    - Focus on integration points between config, router, and patterns
    - Test end-to-end routing flow with config enabled/disabled
    - Test router_decision event emission in real routing scenario
    - Skip edge cases and performance tests unless business-critical
  - [x] 6.4 Run feature-specific tests only
    - Run ONLY tests related to Haiku Router feature
    - Expected total: approximately 18-26 tests maximum
    - Verify critical routing workflows pass
    - Do NOT run the entire application test suite

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 18-26 tests total)
- Critical routing workflows for both Graph and Swarm patterns covered
- No more than 8 additional tests added when filling in testing gaps
- Testing focused exclusively on this spec's feature requirements

## Execution Order

Recommended implementation sequence:

1. **Configuration Layer (Task Group 1)** - TypeScript config schema
   - Establishes the configuration foundation for all other components
   - No dependencies, can start immediately

2. **Router Utility Layer (Task Group 2)** - Python router functions
   - Depends on config schema being defined
   - Creates core routing functionality used by patterns

3. **Graph Pattern Integration (Task Group 3)** - main_graph.py
   - Depends on router utilities
   - Can run in parallel with Task Group 4

4. **Swarm Pattern Integration (Task Group 4)** - main_swarm.py
   - Depends on router utilities
   - Can run in parallel with Task Group 3

5. **Documentation Layer (Task Group 5)** - Steering files and POWER.md
   - Depends on implementation being complete
   - Documents the patterns and configuration

6. **Test Review and Gap Analysis (Task Group 6)** - Final verification
   - Depends on all implementation complete
   - Ensures comprehensive test coverage for the feature

## Files to be Modified/Created

| File | Action | Task Group |
|------|--------|------------|
| `src/types/config.ts` | Modify | 1 |
| `src/services/configService.ts` | Modify | 1 |
| `resources/agents/shared/orchestrator_utils.py` | Modify | 2 |
| `resources/agents/main_graph.py` | Modify | 3 |
| `resources/agents/main_swarm.py` | Modify | 4 |
| `resources/prompts/steering/tech-steering.prompt.md` | Modify | 5 |
| `resources/prompts/steering/agentify-integration-steering.prompt.md` | Modify | 5 |
| `resources/agentify-power/POWER.md` | Modify | 5 |
