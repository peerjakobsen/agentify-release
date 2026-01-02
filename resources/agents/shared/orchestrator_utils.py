#!/usr/bin/env python3
"""
Agentify Orchestrator Utilities

Common functions shared across all orchestration patterns (Graph, Swarm, Workflow).
These functions handle CLI parsing, event emission, environment setup, and remote
agent invocation via the AgentCore SDK.

This module is PRE-BUNDLED by the Agentify extension and should NOT be modified.
"""

import argparse
import json
import os
import sys
import uuid
import time
from functools import lru_cache
from pathlib import Path
from typing import Dict, Any, Optional, Callable

import boto3
import yaml


# ============================================================================
# CLI ARGUMENT PARSING
# ============================================================================


def parse_arguments() -> argparse.Namespace:
    """Parse and validate command line arguments."""
    parser = argparse.ArgumentParser(
        description='Agentify Workflow Orchestrator',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # First turn
  python agents/main.py --prompt "Process this request" --workflow-id "wf-001" --trace-id "a1b2c3d4e5f6789012345678901234ab" --turn-number 1

  # Follow-up turn with conversation context
  python agents/main.py --prompt "Follow up" --workflow-id "wf-001" --trace-id "a1b2c3d4e5f6789012345678901234ab" --turn-number 2 --conversation-context '{"entry_agent":"triage","turns":[...]}'
        """
    )

    parser.add_argument(
        '--prompt',
        required=True,
        help='User prompt describing the request to process'
    )

    parser.add_argument(
        '--workflow-id',
        required=True,
        help='Short workflow identifier for tracking (e.g., wf-abc123)'
    )

    parser.add_argument(
        '--trace-id',
        required=True,
        help='32-character hex OpenTelemetry trace ID'
    )

    parser.add_argument(
        '--turn-number',
        required=True,
        type=int,
        help='Turn number in the conversation (starts at 1)'
    )

    parser.add_argument(
        '--conversation-context',
        required=False,
        default=None,
        help='JSON string containing conversation history for multi-turn sessions'
    )

    return parser.parse_args()


def validate_arguments(args: argparse.Namespace) -> None:
    """Validate parsed command line arguments."""
    if not args.prompt.strip():
        print("Error: --prompt cannot be empty", file=sys.stderr)
        sys.exit(1)

    if not args.workflow_id.strip():
        print("Error: --workflow-id cannot be empty", file=sys.stderr)
        sys.exit(1)

    trace_id = args.trace_id.strip().lower()
    if len(trace_id) != 32:
        print("Error: --trace-id must be exactly 32 characters", file=sys.stderr)
        sys.exit(1)

    if not all(c in '0123456789abcdef' for c in trace_id):
        print("Error: --trace-id must contain only hexadecimal characters (0-9, a-f)", file=sys.stderr)
        sys.exit(1)

    # Validate turn_number is a positive integer >= 1
    if args.turn_number < 1:
        print("Error: --turn-number must be a positive integer >= 1", file=sys.stderr)
        sys.exit(1)

    # Validate conversation_context is valid JSON if provided
    if args.conversation_context is not None:
        try:
            parsed_context = json.loads(args.conversation_context)
            if not isinstance(parsed_context, dict):
                print("Error: --conversation-context must be a JSON object", file=sys.stderr)
                sys.exit(1)
            # Validate structure has required fields
            if 'entry_agent' not in parsed_context:
                print("Error: --conversation-context must contain 'entry_agent' field", file=sys.stderr)
                sys.exit(1)
            if 'turns' not in parsed_context or not isinstance(parsed_context['turns'], list):
                print("Error: --conversation-context must contain 'turns' array", file=sys.stderr)
                sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"Error: --conversation-context is not valid JSON: {e}", file=sys.stderr)
            sys.exit(1)


# ============================================================================
# EVENT EMISSION
# ============================================================================


def get_timestamp() -> int:
    """Get epoch timestamp in milliseconds."""
    return int(time.time() * 1000)


def validate_event_schema(event: Dict[str, Any]) -> bool:
    """Validate event schema for required fields."""
    required_fields = ['event_type', 'timestamp']

    for field in required_fields:
        if field not in event:
            return False

    timestamp = event.get('timestamp')
    if not isinstance(timestamp, int) or timestamp <= 0:
        return False

    if not isinstance(event.get('event_type'), str):
        return False

    return True


def emit_event(event: Dict[str, Any]) -> None:
    """
    Emit event to stdout as JSON line for Demo Viewer.

    Events are emitted as JSON Lines format. Failures are logged but don't
    block workflow execution.
    """
    try:
        if not validate_event_schema(event):
            print("Event schema validation failed: missing required fields", file=sys.stderr)
            return

        print(json.dumps(event), flush=True)

    except (TypeError, ValueError) as e:
        print(f"JSON serialization failed for event: {e}", file=sys.stderr)
    except (IOError, OSError) as e:
        print(f"Event emission I/O error: {e}", file=sys.stderr)
    except Exception as e:
        print(f"Unexpected error during event emission: {e}", file=sys.stderr)


# ============================================================================
# ENVIRONMENT AND CONFIGURATION
# ============================================================================


def generate_session_id() -> str:
    """Generate a unique session ID using UUID."""
    return str(uuid.uuid4())


def setup_environment() -> Dict[str, Optional[str]]:
    """Set up environment configuration with graceful degradation."""
    table_name = os.environ.get('AGENTIFY_TABLE_NAME')
    aws_region = os.environ.get('AWS_REGION')

    if not table_name:
        print("Warning: AGENTIFY_TABLE_NAME environment variable not set - some features may be limited", file=sys.stderr)

    if not aws_region:
        print("Warning: AWS_REGION environment variable not set - some features may be limited", file=sys.stderr)

    return {
        'table_name': table_name,
        'aws_region': aws_region,
    }


@lru_cache(maxsize=1)
def load_agent_config() -> Dict[str, Dict[str, Any]]:
    """
    Load all agent configurations from .bedrock_agentcore.yaml.

    Returns dict mapping agent_id to config including ARN and region.
    Dynamically discovers all agents - no hardcoded names.
    """
    config_path = Path(__file__).parent.parent.parent / '.bedrock_agentcore.yaml'

    if not config_path.exists():
        raise FileNotFoundError(f"Agent config not found: {config_path}")

    with open(config_path) as f:
        config = yaml.safe_load(f)

    agents = {}
    for agent_key, agent_config in config.get('agents', {}).items():
        agentcore = agent_config.get('bedrock_agentcore', {})
        aws = agent_config.get('aws', {})

        if agentcore.get('agent_arn'):
            agent_id = agent_config.get('name', agent_key)
            agents[agent_id] = {
                'arn': agentcore['agent_arn'],
                'region': aws.get('region', 'us-east-1'),
            }

    return agents


def get_available_agents() -> list:
    """Return list of available agent IDs from config."""
    return list(load_agent_config().keys())


# ============================================================================
# REMOTE AGENT INVOCATION
# ============================================================================


def invoke_agent_remotely(agent_id: str, prompt: str, session_id: str) -> Dict[str, Any]:
    """
    Invoke a remote agent deployed to AgentCore Runtime via boto3 SDK.

    Args:
        agent_id: Agent identifier (must exist in .bedrock_agentcore.yaml)
        prompt: Input prompt for the agent
        session_id: Session ID for correlation across all agents in workflow

    Returns:
        Dict with 'response' key containing agent output text

    Raises:
        ValueError: If agent_id is not recognized
        Exception: If agent invocation fails
    """
    agents = load_agent_config()

    if agent_id not in agents:
        available = ', '.join(agents.keys())
        raise ValueError(f"Unknown agent: {agent_id}. Available: {available}")

    agent = agents[agent_id]

    print(f"Invoking remote agent '{agent_id}' at {agent['arn']}", file=sys.stderr)

    try:
        client = boto3.client('bedrock-agentcore', region_name=agent['region'])

        payload = json.dumps({
            'prompt': prompt,
            'session_id': session_id
        }).encode()

        response = client.invoke_agent_runtime(
            agentRuntimeArn=agent['arn'],
            runtimeSessionId=session_id,
            payload=payload
        )

        # Handle streaming response - collect all bytes first, then decode
        content_type = response.get('contentType', '')
        raw_bytes = b''

        if 'text/event-stream' in content_type:
            for line in response['response'].iter_lines():
                if line:
                    raw_bytes += line
            decoded = raw_bytes.decode('utf-8')
            lines = decoded.split('\n')
            content = [line[6:] for line in lines if line.startswith('data: ')]
            response_text = '\n'.join(content)
        else:
            for chunk in response.get('response', []):
                raw_bytes += chunk
            response_text = raw_bytes.decode('utf-8')

        # Parse nested Bedrock message format
        try:
            parsed = json.loads(response_text)
            if isinstance(parsed, dict):
                # Handle: {'response': {'role': 'assistant', 'content': [{'text': '...'}]}}
                inner_response = parsed.get('response')
                if isinstance(inner_response, dict) and 'content' in inner_response:
                    text_parts = []
                    for item in inner_response.get('content', []):
                        if isinstance(item, dict) and 'text' in item:
                            text_parts.append(item['text'])
                    if text_parts:
                        return {'response': '\n'.join(text_parts)}

                # Handle: {'role': 'assistant', 'content': [{'text': '...'}]}
                if 'content' in parsed and isinstance(parsed['content'], list):
                    text_parts = []
                    for item in parsed['content']:
                        if isinstance(item, dict) and 'text' in item:
                            text_parts.append(item['text'])
                    if text_parts:
                        return {'response': '\n'.join(text_parts)}

                # Handle: {'response': 'text string'}
                if 'response' in parsed and isinstance(parsed['response'], str):
                    return parsed
        except json.JSONDecodeError:
            pass

        return {'response': response_text}

    except Exception as e:
        error_msg = f"Agent '{agent_id}' invocation failed: {e}"
        print(f"Invocation error: {error_msg}", file=sys.stderr)
        raise Exception(error_msg)


# ============================================================================
# ERROR HANDLING AND SUMMARIES
# ============================================================================


def emit_workflow_error(session_id: str, workflow_id: str, trace_id: str,
                        error_message: str, error_type: str = "failed",
                        turn_number: Optional[int] = None) -> None:
    """Emit a workflow_error event."""
    event = {
        "event_type": "workflow_error",
        "timestamp": get_timestamp(),
        "session_id": session_id,
        "workflow_id": workflow_id,
        "trace_id": trace_id,
        "error": error_message,
        "status": error_type
    }
    if turn_number is not None:
        event["turn_number"] = turn_number
    emit_event(event)


def print_workflow_summary(session_id: str, workflow_id: str, trace_id: str,
                          start_time: float, agents_invoked: list,
                          final_response: Dict[str, Any],
                          get_agent_display_name: Callable[[str], str]) -> None:
    """Print comprehensive workflow completion summary to stderr."""
    end_time = time.time()
    total_duration = end_time - start_time

    print("=" * 80, file=sys.stderr)
    print("WORKFLOW EXECUTION COMPLETED SUCCESSFULLY", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
    print("", file=sys.stderr)

    print("EXECUTION SUMMARY:", file=sys.stderr)
    print(f"  Workflow ID:     {workflow_id}", file=sys.stderr)
    print(f"  Session ID:      {session_id}", file=sys.stderr)
    print(f"  Trace ID:        {trace_id}", file=sys.stderr)
    print(f"  Total Duration:  {total_duration:.2f} seconds", file=sys.stderr)
    print(f"  Exit Code:       0 (SUCCESS)", file=sys.stderr)
    print("", file=sys.stderr)

    print("ROUTING SUMMARY:", file=sys.stderr)
    route_display = ' -> '.join([get_agent_display_name(a) for a in agents_invoked])
    print(f"  Path: {route_display}", file=sys.stderr)
    print(f"  Agents Invoked:  {len(agents_invoked)}", file=sys.stderr)
    print("", file=sys.stderr)

    response_text = final_response.get('response', 'No response')
    preview = response_text[:200] + '...' if len(response_text) > 200 else response_text
    print("FINAL RESPONSE:", file=sys.stderr)
    print(f"  {preview}", file=sys.stderr)
    print("", file=sys.stderr)

    print("Workflow execution completed successfully. Check stdout for JSON event stream.", file=sys.stderr)
    print("=" * 80, file=sys.stderr)


def print_workflow_error_summary(session_id: str, workflow_id: str, trace_id: str,
                                start_time: float, error_message: str,
                                agents_invoked: list) -> None:
    """Print comprehensive workflow error summary to stderr."""
    end_time = time.time()
    total_duration = end_time - start_time

    print("=" * 80, file=sys.stderr)
    print("WORKFLOW EXECUTION FAILED", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
    print("", file=sys.stderr)

    print("EXECUTION SUMMARY:", file=sys.stderr)
    print(f"  Workflow ID:     {workflow_id}", file=sys.stderr)
    print(f"  Session ID:      {session_id}", file=sys.stderr)
    print(f"  Trace ID:        {trace_id}", file=sys.stderr)
    print(f"  Total Duration:  {total_duration:.2f} seconds", file=sys.stderr)
    print(f"  Exit Code:       1 (FAILURE)", file=sys.stderr)
    print("", file=sys.stderr)

    print("ERROR DETAILS:", file=sys.stderr)
    print(f"  Agents Invoked:  {len(agents_invoked)}", file=sys.stderr)
    print(f"  Error Message:   {error_message}", file=sys.stderr)
    print("", file=sys.stderr)

    print("Workflow execution failed. Check stdout for JSON event stream and error events.", file=sys.stderr)
    print("=" * 80, file=sys.stderr)
