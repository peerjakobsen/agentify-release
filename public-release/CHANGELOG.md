# Changelog

All notable changes to Agentify will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-01-11

### Added
- **Parallel execution support** for Swarm orchestration pattern
  - Agents can now trigger parallel handoffs: `{"handoff_to": ["agent1", "agent2"], "converge_at": "agent3"}`
  - New `invoke_agents_parallel()` function using ThreadPoolExecutor
  - New `build_convergence_prompt()` for synthesizing parallel agent results
  - New Demo Viewer events: `parallel_node_start`, `parallel_node_stop`, `convergence_ready`
- Improved Bedrock response parsing with `_extract_text_from_response()` helper
- Better handling of nested message formats from AgentCore Runtime

### Changed
- `extract_handoff_from_response()` now returns structured dict with handoff type
- Demo Viewer updated to visualize parallel execution branches
- Event transformer handles new parallel execution event schemas

### Fixed
- Multi-byte UTF-8 character handling in streaming responses
- Gateway tool instrumentation for observability

## [0.2.0] - 2025-01-04

### Added
- Initial public release
- Demo Viewer for real-time workflow execution monitoring
- Ideation Wizard (8-step workflow design)
- Three orchestration patterns: Graph, Swarm, Workflow
- AWS SSO integration
- DynamoDB event storage for observability
- MCP Gateway integration with OAuth
- Haiku-based routing option
- Modular setup scripts

## [Unreleased]

<!-- Add unreleased changes here -->
