# Cross-Agent Memory (Item 39)

Enable agents to share context via AgentCore Memory, reducing duplicate external calls.

## Problem

In multi-agent workflows, earlier agents often fetch data that later agents also need:
- Triage Agent: `get_ticket()` → `get_customer()` → classify → route
- Technical Agent: `get_ticket()` → `get_customer()` → search KB → respond
- Same data fetched twice (latency, cost, inconsistency risk)

## Solution: Memory as a Tool

Provide `search_memory()` and `store_context()` tools that agents can use. Agent prompts include generic guidance to check memory before calling external tools. LLM decides when to apply the pattern based on context.

## Key Components

1. Wizard Step 4 UI updates - Add memory configuration toggle and settings
2. Infrastructure setup via AgentCore CLI (setup-memory.sh script)
3. Pre-bundled memory_client.py module with search_memory/store_context tools
4. Script updates (setup.sh, orchestrate.sh, destroy.sh)
5. WorkflowTriggerService updates to pass MEMORY_ID env var
6. Kiro guidance updates (POWER.md, hooks, steering prompts)
