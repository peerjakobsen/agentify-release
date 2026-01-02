#!/usr/bin/env python3
"""
Agentify Orchestrator - Graph Pattern

This orchestrator coordinates remote agents using a Graph pattern:
- Sequential execution with conditional routing
- Orchestrator analyzes each agent's response to determine next agent
- Routes based on classification keywords, LLM decisions, or response fields

USAGE:
    python agents/main.py --prompt "User request" --workflow-id "wf-123" --trace-id "32-char-hex"

ARCHITECTURE:
    main.py (local orchestrator)
        |
        | boto3.client('bedrock-agentcore').invoke_agent_runtime()
        v
    AgentCore Runtime (AWS)
        |
        +-- Agent 1 (remote) --> MCP Gateway --> Lambda tools
        +-- Agent 2 (remote) --> MCP Gateway --> Lambda tools
        +-- Agent N (remote) --> MCP Gateway --> Lambda tools

CUSTOMIZATION:
    Kiro customizes the CUSTOMIZATION SECTION based on .kiro/steering/ files.
    The generic infrastructure imports should not be modified.
"""

import sys
import time
from typing import Dict, Any, Optional

# Import common orchestrator utilities (DO NOT MODIFY)
from agents.shared.orchestrator_utils import (
    parse_arguments,
    validate_arguments,
    setup_environment,
    generate_session_id,
    get_timestamp,
    emit_event,
    invoke_agent_remotely,
    emit_workflow_error,
    print_workflow_summary,
    print_workflow_error_summary,
)


# ============================================================================
# CUSTOMIZATION SECTION (Kiro fills this in based on steering files)
# ============================================================================
# This section contains project-specific logic that Kiro customizes based on
# the steering files in .kiro/steering/. The function signatures should not
# change, but the implementations will vary per project.


def define_graph_structure() -> Dict[str, Any]:
    """
    Define the graph structure for the workflow visualization.

    CUSTOMIZED BY KIRO based on .kiro/steering/tech.md agent design.

    Returns:
        Dict with 'nodes' and 'edges' for Demo Viewer graph visualization.

    Example for a triage-based workflow:
        return {
            "nodes": [
                {"id": "triage", "name": "Triage Agent", "type": "classification"},
                {"id": "specialist_a", "name": "Specialist A", "type": "specialist"},
                {"id": "specialist_b", "name": "Specialist B", "type": "specialist"},
            ],
            "edges": [
                {"from": "triage", "to": "specialist_a", "condition": "route == 'a'"},
                {"from": "triage", "to": "specialist_b", "condition": "route == 'b'"},
            ]
        }
    """
    # TODO: Kiro fills this in based on agent team design from steering files
    return {
        "nodes": [
            # {"id": "agent_id", "name": "Display Name", "type": "classification|specialist|handler"},
        ],
        "edges": [
            # {"from": "source_agent", "to": "target_agent", "condition": "routing_condition"},
        ]
    }


def get_entry_agent() -> str:
    """
    Return the ID of the first agent to invoke.

    CUSTOMIZED BY KIRO based on orchestration pattern from steering files.

    Returns:
        Agent ID string that matches a key in .bedrock_agentcore.yaml
    """
    # TODO: Kiro sets this to the entry point agent ID
    raise NotImplementedError("Kiro must implement get_entry_agent() with the first agent ID")


def route_to_next_agent(current_agent: str, response: Dict[str, Any]) -> Optional[str]:
    """
    Determine which agent to invoke next based on current agent's response.

    CUSTOMIZED BY KIRO based on routing logic from steering files.

    Args:
        current_agent: ID of the agent that just completed
        response: Response dict from the agent (contains 'response' key with text)

    Returns:
        Next agent ID to invoke, or None if workflow is complete.

    ROUTING STRATEGIES (in priority order):

    1. EXPLICIT ROUTING - Agent returns route_to field (agent decides):
       If response contains {"route_to": "agent_id"}, use that directly.
       Best for: Complex decisions where agent intelligence is needed.

    2. STRUCTURED CLASSIFICATION - Agent returns classification field:
       If response contains {"classification": "category"}, map to agent.
       Best for: Multi-way routing based on categorization.

    3. STATIC ROUTING - Predetermined next agent:
       Use STATIC_ROUTES dict for fixed sequences.
       Best for: Linear pipelines, success/failure branches.

    4. WORKFLOW COMPLETE - No next agent:
       Return None when workflow should end.

    Kiro chooses the appropriate strategy based on use case complexity.
    """
    # ==========================================================================
    # STRATEGY 1: Explicit routing (agent decided via route_to field)
    # ==========================================================================
    # If agent returns {"route_to": "next_agent_id"}, use it directly.
    # To enable: Add to agent's system prompt: "Include route_to field with next agent ID"
    if isinstance(response, dict) and response.get('route_to'):
        return response['route_to']

    # ==========================================================================
    # STRATEGY 2: Structured classification routing
    # ==========================================================================
    # If agent returns {"classification": "category"}, map to agent ID.
    # To enable: Add to agent's system prompt: "Include classification field"
    # TODO: Kiro fills in CLASSIFICATION_ROUTES based on agent design
    CLASSIFICATION_ROUTES: Dict[str, str] = {
        # "technical": "technical_handler",
        # "billing": "billing_handler",
        # "escalation": "escalation_handler",
    }
    if isinstance(response, dict) and response.get('classification'):
        classification = response['classification'].lower()
        if classification in CLASSIFICATION_ROUTES:
            return CLASSIFICATION_ROUTES[classification]

    # ==========================================================================
    # STRATEGY 3: Static routing (predetermined next agent)
    # ==========================================================================
    # For linear pipelines or fixed sequences where no agent decision is needed.
    # TODO: Kiro fills in STATIC_ROUTES based on orchestration pattern
    STATIC_ROUTES: Dict[str, Optional[str]] = {
        # Linear pipeline example:
        # "extract": "validate",
        # "validate": "store",
        # "store": None,  # Terminal
    }
    if current_agent in STATIC_ROUTES:
        return STATIC_ROUTES[current_agent]

    # ==========================================================================
    # STRATEGY 4: Workflow complete (default)
    # ==========================================================================
    return None


def get_agent_display_name(agent_id: str) -> str:
    """
    Return human-readable display name for an agent.

    CUSTOMIZED BY KIRO based on agent team design.

    Args:
        agent_id: Agent identifier from config

    Returns:
        Human-readable name for display in summaries
    """
    # TODO: Kiro adds agent_id -> display_name mapping
    names = {
        # "agent_id": "Human-Readable Name",
    }
    return names.get(agent_id, agent_id)


# ============================================================================
# MAIN EXECUTION (DO NOT MODIFY)
# ============================================================================


def main() -> None:
    """
    Main orchestrator entry point for Graph pattern.

    Implements a dynamic workflow that:
    1. Invokes the entry agent
    2. Routes to subsequent agents based on responses (route_to_next_agent)
    3. Continues until route_to_next_agent returns None
    4. Emits JSON events for Demo Viewer visualization
    """
    session_id = None
    args = None
    start_time = time.time()
    agents_invoked = []

    try:
        args = parse_arguments()
        validate_arguments(args)
        env_config = setup_environment()
        session_id = generate_session_id()

        print("Starting workflow execution:", file=sys.stderr)
        print(f"  Workflow ID: {args.workflow_id}", file=sys.stderr)
        print(f"  Session ID: {session_id}", file=sys.stderr)
        print(f"  Trace ID: {args.trace_id}", file=sys.stderr)
        print(f"  Prompt: {args.prompt[:100]}{'...' if len(args.prompt) > 100 else ''}", file=sys.stderr)
        print(f"  Environment: table_name={env_config['table_name']}, region={env_config['aws_region']}", file=sys.stderr)
        print("", file=sys.stderr)

        # Emit graph structure for Demo Viewer
        graph_structure = define_graph_structure()
        emit_event({
            "event_type": "graph_structure",
            "timestamp": get_timestamp(),
            "session_id": session_id,
            "workflow_id": args.workflow_id,
            "trace_id": args.trace_id,
            "graph": graph_structure
        })

        # Start with entry agent
        current_agent = get_entry_agent()
        current_prompt = args.prompt
        last_response = None

        # Track previous agent for from_agent field in node_start events
        previous_agent_name = None

        while current_agent is not None:
            agent_name = get_agent_display_name(current_agent)
            print(f"Invoking agent: {agent_name} ({current_agent})", file=sys.stderr)

            # Emit node_start event with from_agent and handoff_prompt for dual-pane UI
            emit_event({
                "event_type": "node_start",
                "timestamp": get_timestamp(),
                "session_id": session_id,
                "workflow_id": args.workflow_id,
                "trace_id": args.trace_id,
                "node_id": current_agent,
                "node_name": agent_name,
                "from_agent": previous_agent_name,
                "handoff_prompt": current_prompt
            })

            try:
                response = invoke_agent_remotely(current_agent, current_prompt, session_id)
                agents_invoked.append(current_agent)

                # Emit node_stop event (success) with response content
                emit_event({
                    "event_type": "node_stop",
                    "timestamp": get_timestamp(),
                    "session_id": session_id,
                    "workflow_id": args.workflow_id,
                    "trace_id": args.trace_id,
                    "node_id": current_agent,
                    "node_name": agent_name,
                    "status": "completed",
                    "response": response.get('response', '')
                })

                response_preview = str(response.get('response', ''))[:100]
                print(f"Agent {current_agent} completed: {response_preview}...", file=sys.stderr)

                last_response = response

                # Update previous_agent_name for the next agent's from_agent field
                previous_agent_name = agent_name

                # Determine next agent (Graph pattern: orchestrator decides)
                next_agent = route_to_next_agent(current_agent, response)

                if next_agent:
                    # Enhance prompt with context from previous agent
                    prev_response = response.get('response', '')
                    current_prompt = f"Previous agent ({agent_name}) response:\n{prev_response}\n\nOriginal request: {args.prompt}"

                current_agent = next_agent

            except Exception as e:
                # Emit node_stop event (error)
                emit_event({
                    "event_type": "node_stop",
                    "timestamp": get_timestamp(),
                    "session_id": session_id,
                    "workflow_id": args.workflow_id,
                    "trace_id": args.trace_id,
                    "node_id": current_agent,
                    "node_name": agent_name,
                    "status": "error",
                    "error": str(e)
                })

                error_msg = f"Agent {current_agent} failed: {e}"
                print(f"Error: {error_msg}", file=sys.stderr)
                emit_workflow_error(session_id, args.workflow_id, args.trace_id, error_msg)
                print_workflow_error_summary(session_id, args.workflow_id, args.trace_id,
                                           start_time, error_msg, agents_invoked)
                sys.exit(1)

        # Workflow complete
        emit_event({
            "event_type": "workflow_complete",
            "timestamp": get_timestamp(),
            "session_id": session_id,
            "workflow_id": args.workflow_id,
            "trace_id": args.trace_id,
            "final_agent": agents_invoked[-1] if agents_invoked else None,
            "status": "success"
        })

        print_workflow_summary(session_id, args.workflow_id, args.trace_id,
                              start_time, agents_invoked, last_response or {},
                              get_agent_display_name)
        sys.exit(0)

    except KeyboardInterrupt:
        print("\nWorkflow interrupted by user", file=sys.stderr)
        if session_id and args:
            emit_workflow_error(session_id, args.workflow_id, args.trace_id,
                              "Workflow interrupted by user", "interrupted")
            print_workflow_error_summary(session_id, args.workflow_id, args.trace_id,
                                       start_time, "Workflow interrupted by user", agents_invoked)
        sys.exit(130)

    except SystemExit:
        raise

    except Exception as e:
        error_msg = f"Fatal error: {e}"
        print(error_msg, file=sys.stderr)
        if session_id and args:
            emit_workflow_error(session_id, args.workflow_id, args.trace_id, str(e))
            print_workflow_error_summary(session_id, args.workflow_id, args.trace_id,
                                       start_time, str(e), agents_invoked)
        sys.exit(1)


if __name__ == '__main__':
    main()
