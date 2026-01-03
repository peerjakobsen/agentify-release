# Raw Idea: Lightweight Router Model (Haiku)

**Source:** Product Roadmap Item 40

## Description

Add optional Haiku-based routing for Graph and Swarm patterns. The problem is that current routing approaches have trade-offs:
- Hardcoded routes: Fast but brittle, can't handle semantic nuance
- Agent-decided routes: Flexible but uses full Sonnet model for simple routing decisions (slow, expensive)
- Classification mapping: Requires structured output from agents, adds complexity to agent prompts

The solution is a dedicated Haiku Router - a lightweight routing agent that uses Claude Haiku (~10x cheaper, ~3x faster than Sonnet) specifically for routing decisions.

## Date Initiated

2026-01-03
