#!/usr/bin/env python3
"""
Agentify Orchestrator - Swarm Pattern

This orchestrator coordinates remote agents using a Swarm pattern:
- Sequential execution with autonomous agent handoffs
- Agents decide who to hand off to by using a handoff_to_agent tool
- Orchestrator extracts handoff decisions from agent responses

USAGE:
    python agents/main.py --prompt "User request" --workflow-id "wf-123" --trace-id "32-char-hex" --turn-number 1

ARCHITECTURE:
    main.py (local orchestrator)
        |
        | boto3.client('bedrock-agentcore').invoke_agent_runtime()
        v
    AgentCore Runtime (AWS)
        |
        +-- Agent 1 (remote) --> decides handoff --> Agent 2
        +-- Agent 2 (remote) --> decides handoff --> Agent 3
        +-- Agent N (remote) --> no handoff --> workflow complete

AGENT REQUIREMENTS:
    Each agent in a Swarm must have a handoff_to_agent tool:

    @tool
    def handoff_to_agent(agent_id: str, context: str) -> Dict:
        '''Hand off to another agent with context.'''
        return {"handoff_to": agent_id, "context": context}

CUSTOMIZATION:
    Kiro customizes the CUSTOMIZATION SECTION based on .kiro/steering/ files.
    The generic infrastructure imports should not be modified.
"""

import json
import re
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
    get_available_agents,
    emit_workflow_error,
    print_workflow_summary,
    print_workflow_error_summary,
    # Haiku router utilities
    load_routing_config,
    route_with_haiku,
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

    For Swarm pattern, edges typically show all possible handoffs between agents.
    The actual path taken depends on agent decisions at runtime.

    Returns:
        Dict with 'nodes' and 'edges' for Demo Viewer graph visualization.

    Example for a swarm workflow:
        return {
            "nodes": [
                {"id": "coordinator", "name": "Coordinator", "type": "coordinator"},
                {"id": "researcher", "name": "Researcher", "type": "specialist"},
                {"id": "writer", "name": "Writer", "type": "specialist"},
                {"id": "reviewer", "name": "Reviewer", "type": "specialist"},
            ],
            "edges": [
                # Show all possible handoffs (agents decide at runtime)
                {"from": "coordinator", "to": "researcher", "condition": "handoff"},
                {"from": "coordinator", "to": "writer", "condition": "handoff"},
                {"from": "researcher", "to": "writer", "condition": "handoff"},
                {"from": "writer", "to": "reviewer", "condition": "handoff"},
                {"from": "reviewer", "to": "coordinator", "condition": "handoff"},
            ]
        }
    """
    # TODO: Kiro fills this in based on agent team design from steering files
    return {
        "nodes": [
            # {"id": "agent_id", "name": "Display Name", "type": "coordinator|specialist"},
        ],
        "edges": [
            # {"from": "source_agent", "to": "target_agent", "condition": "handoff"},
        ]
    }


def get_entry_agent() -> str:
    """
    Return the ID of the first agent to invoke.

    CUSTOMIZED BY KIRO based on orchestration pattern from steering files.

    Returns:
        Agent ID string that matches a key in .bedrock_agentcore.yaml
    """
    # TODO: Kiro sets this to the entry point agent ID (usually a coordinator)
    raise NotImplementedError("Kiro must implement get_entry_agent() with the first agent ID")


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
# SWARM PATTERN UTILITIES (DO NOT MODIFY)
# ============================================================================

# Module-level variables for context (set by main() for extract_handoff_from_response)
_current_agent_context: Optional[str] = None
_workflow_context: Dict[str, str] = {}


def extract_handoff_from_response(response: Dict[str, Any]) -> Optional[str]:
    """
    Extract handoff target from agent response.

    Swarm agents indicate handoffs by:
    1. Using a handoff_to_agent tool that returns {"handoff_to": "agent_id"}
    2. Including JSON with "handoff_to" key in their response
    3. Returning response text like "Handing off to <agent_id>"

    FALLBACK: When no explicit handoff is found and useHaikuRouter is enabled,
    Haiku router is called as a safety net to determine the next agent.
    Agent's own handoff decisions always take priority (Swarm philosophy).

    Args:
        response: Response dict from the agent (contains 'response' key with text)

    Returns:
        Agent ID to hand off to, or None if no handoff (workflow complete)
    """
    response_text = response.get('response', '')
    available = get_available_agents()

    # ==========================================================================
    # PRIMARY: Agent's own handoff decision (Swarm philosophy - agent decides)
    # ==========================================================================

    # Try to parse JSON from response
    try:
        # Look for JSON object in response
        json_match = re.search(r'\{[^{}]*"handoff_to"[^{}]*\}', response_text)
        if json_match:
            parsed = json.loads(json_match.group())
            handoff_to = parsed.get('handoff_to')
            if handoff_to:
                # Validate agent exists
                if handoff_to in available:
                    return handoff_to
                print(f"Warning: Handoff target '{handoff_to}' not in available agents: {available}", file=sys.stderr)
    except json.JSONDecodeError:
        pass

    # Look for "Handing off to <agent>" pattern
    handoff_pattern = re.search(r'[Hh]and(?:ing|ed)?\s*off\s*to\s*["\']?(\w+)["\']?', response_text)
    if handoff_pattern:
        handoff_to = handoff_pattern.group(1)
        if handoff_to in available:
            return handoff_to

    # ==========================================================================
    # FALLBACK: Haiku router (safety net when agent doesn't specify handoff)
    # ==========================================================================
    # Only activate when:
    # 1. No explicit handoff found above
    # 2. useHaikuRouter is enabled in config

    try:
        config = load_routing_config()
        use_haiku = config.get('useHaikuRouter', False)

        if use_haiku:
            # Get context for Haiku routing
            current_agent = _current_agent_context or 'unknown_agent'
            workflow_id = _workflow_context.get('workflow_id', '')
            trace_id = _workflow_context.get('trace_id', '')

            # Log warning that Haiku fallback is activating
            print(f"Warning: No explicit handoff from '{current_agent}', activating Haiku router as safety net", file=sys.stderr)

            # Call Haiku router
            haiku_result = route_with_haiku(
                current_agent=current_agent,
                response_text=response_text,
                available_agents=available,
                workflow_id=workflow_id,
                trace_id=trace_id
            )

            if haiku_result:
                # Validate Haiku-selected agent exists
                if haiku_result == 'COMPLETE':
                    print(f"Haiku router determined workflow complete", file=sys.stderr)
                    return None
                elif haiku_result in available:
                    print(f"Haiku router selected agent: '{haiku_result}' (safety net)", file=sys.stderr)
                    return haiku_result
                else:
                    print(f"Warning: Haiku-selected agent '{haiku_result}' not in available agents", file=sys.stderr)

            # Haiku routing failed or returned invalid agent
            print(f"Haiku routing did not return valid agent, completing workflow", file=sys.stderr)

    except Exception as e:
        # Log error but don't block - maintain existing behavior
        print(f"Warning: Haiku fallback failed: {e}", file=sys.stderr)

    # No handoff indicated - workflow complete
    return None


# ============================================================================
# MAIN EXECUTION (DO NOT MODIFY)
# ============================================================================


def main() -> None:
    """
    Main orchestrator entry point for Swarm pattern.

    Implements an autonomous workflow that:
    1. Invokes the entry agent
    2. Extracts handoff decisions from agent responses
    3. Continues until no handoff is indicated
    4. Emits JSON events for Demo Viewer visualization
    """
    global _current_agent_context, _workflow_context

    session_id = None
    args = None
    start_time = time.time()
    agents_invoked = []

    try:
        args = parse_arguments()
        validate_arguments(args)
        env_config = setup_environment()
        session_id = generate_session_id()

        # Extract turn_number for inclusion in all events
        turn_number = args.turn_number

        # Store workflow context for extract_handoff_from_response
        _workflow_context = {
            'workflow_id': args.workflow_id,
            'trace_id': args.trace_id
        }

        print("Starting Swarm workflow execution:", file=sys.stderr)
        print(f"  Workflow ID: {args.workflow_id}", file=sys.stderr)
        print(f"  Session ID: {session_id}", file=sys.stderr)
        print(f"  Trace ID: {args.trace_id}", file=sys.stderr)
        print(f"  Turn Number: {turn_number}", file=sys.stderr)
        print(f"  Prompt: {args.prompt[:100]}{'...' if len(args.prompt) > 100 else ''}", file=sys.stderr)
        print(f"  Environment: table_name={env_config['table_name']}, region={env_config['aws_region']}", file=sys.stderr)
        print("  Pattern: Swarm (autonomous agent handoffs)", file=sys.stderr)
        if args.conversation_context:
            print(f"  Conversation Context: (provided)", file=sys.stderr)
        print("", file=sys.stderr)

        # Emit graph structure for Demo Viewer
        graph_structure = define_graph_structure()
        emit_event({
            "event_type": "graph_structure",
            "timestamp": get_timestamp(),
            "session_id": session_id,
            "workflow_id": args.workflow_id,
            "trace_id": args.trace_id,
            "turn_number": turn_number,
            "graph": graph_structure
        })

        # Start with entry agent
        current_agent = get_entry_agent()

        # Build prompt with conversation context for multi-turn sessions
        if args.conversation_context:
            import json
            context = json.loads(args.conversation_context)
            # Build conversation history string
            history_lines = []
            for turn in context.get('turns', []):
                role = turn.get('role', 'unknown')
                content = turn.get('content', '')
                if role == 'human':
                    history_lines.append(f"Human: {content}")
                elif role == 'entry_agent':
                    history_lines.append(f"Assistant: {content}")

            if history_lines:
                conversation_history = '\n'.join(history_lines)
                current_prompt = f"""Previous conversation:
{conversation_history}

Current message from human: {args.prompt}

Continue the conversation naturally, remembering the context from previous messages."""
                print(f"Built prompt with {len(context.get('turns', []))} turns of context", file=sys.stderr)
            else:
                current_prompt = args.prompt
        else:
            current_prompt = args.prompt

        last_response = None
        max_handoffs = 20  # Prevent infinite loops

        # Track previous agent for from_agent field in node_start events
        previous_agent_name = None

        while current_agent is not None and len(agents_invoked) < max_handoffs:
            agent_name = get_agent_display_name(current_agent)
            print(f"Invoking agent: {agent_name} ({current_agent})", file=sys.stderr)

            # Update current agent context for extract_handoff_from_response
            _current_agent_context = current_agent

            # Emit node_start event with from_agent and handoff_prompt for dual-pane UI
            emit_event({
                "event_type": "node_start",
                "timestamp": get_timestamp(),
                "session_id": session_id,
                "workflow_id": args.workflow_id,
                "trace_id": args.trace_id,
                "turn_number": turn_number,
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
                    "turn_number": turn_number,
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

                # Swarm pattern: Extract handoff from agent's response
                next_agent = extract_handoff_from_response(response)

                if next_agent:
                    print(f"Agent {current_agent} handing off to {next_agent}", file=sys.stderr)
                    # Include context from previous agent in handoff
                    prev_response = response.get('response', '')
                    current_prompt = f"Handoff from {agent_name}:\n{prev_response}\n\nOriginal request: {args.prompt}"
                else:
                    print(f"Agent {current_agent} completed workflow (no handoff)", file=sys.stderr)

                current_agent = next_agent

            except Exception as e:
                # Emit node_stop event (error)
                emit_event({
                    "event_type": "node_stop",
                    "timestamp": get_timestamp(),
                    "session_id": session_id,
                    "workflow_id": args.workflow_id,
                    "trace_id": args.trace_id,
                    "turn_number": turn_number,
                    "node_id": current_agent,
                    "node_name": agent_name,
                    "status": "error",
                    "error": str(e)
                })

                error_msg = f"Agent {current_agent} failed: {e}"
                print(f"Error: {error_msg}", file=sys.stderr)
                emit_workflow_error(session_id, args.workflow_id, args.trace_id, error_msg,
                                   turn_number=turn_number)
                print_workflow_error_summary(session_id, args.workflow_id, args.trace_id,
                                           start_time, error_msg, agents_invoked)
                sys.exit(1)

        # Check for max handoffs exceeded
        if len(agents_invoked) >= max_handoffs:
            error_msg = f"Maximum handoffs ({max_handoffs}) exceeded - possible infinite loop"
            print(f"Error: {error_msg}", file=sys.stderr)
            emit_workflow_error(session_id, args.workflow_id, args.trace_id, error_msg,
                               turn_number=turn_number)
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
            "turn_number": turn_number,
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
                              "Workflow interrupted by user", "interrupted",
                              turn_number=args.turn_number if args else None)
            print_workflow_error_summary(session_id, args.workflow_id, args.trace_id,
                                       start_time, "Workflow interrupted by user", agents_invoked)
        sys.exit(130)

    except SystemExit:
        raise

    except Exception as e:
        error_msg = f"Fatal error: {e}"
        print(error_msg, file=sys.stderr)
        if session_id and args:
            emit_workflow_error(session_id, args.workflow_id, args.trace_id, str(e),
                               turn_number=args.turn_number if args else None)
            print_workflow_error_summary(session_id, args.workflow_id, args.trace_id,
                                       start_time, str(e), agents_invoked)
        sys.exit(1)


if __name__ == '__main__':
    main()
