"""
Instrumentation module for tool monitoring and context management.

This module provides the core instrumentation infrastructure for the Agentify
observability system. It implements context management for correlating tool events
across a workflow execution and the @instrument_tool decorator for automatic
tool monitoring with fire-and-forget event emission to DynamoDB.

## Key Features

- **Context Management**: Session and agent correlation for event attribution
- **Transparent Monitoring**: Tools behave identically with or without instrumentation
- **Fire-and-forget Events**: Monitoring never blocks tool execution
- **Exception Transparency**: All tool exceptions are preserved and re-raised
- **Graceful Degradation**: System works normally when monitoring is unavailable

## Context Lifecycle

The instrumentation context consists of two pieces of data:
- session_id: UUID identifying the workflow execution
- agent_name: Logical agent identifier for event attribution

Context must be managed explicitly in agent handlers:

```python
try:
    set_instrumentation_context(session_id, 'analyzer')
    # Execute agent logic - tools will emit events
    result = invoke_agent(prompt)
finally:
    clear_instrumentation_context()  # Prevent context leakage
```

## Event Emission

The @instrument_tool decorator emits three types of events:

1. **started**: Written before tool execution begins
2. **completed**: Written after successful execution with duration
3. **error**: Written after failure with duration and error message

Events are only emitted when valid context is available. If no context is set,
tools execute normally without any monitoring overhead.

## Thread Safety

This module uses module-level globals for context storage, which is safe in
AgentCore containers that handle one request at a time. The context isolation
prevents interference between concurrent requests in multi-threaded environments.

## Integration with DynamoDB Client

The instrumentation system integrates with the DynamoDB client module for
event persistence. All write operations use the fire-and-forget pattern
implemented in agents.shared.dynamodb_client.write_tool_event().
"""

from typing import Callable, TypeVar, ParamSpec
from functools import wraps
import uuid
from datetime import datetime, timezone

P = ParamSpec('P')
R = TypeVar('R')

# Module-level globals for context storage
# These are safe in AgentCore containers which handle one request at a time
_session_id: str | None = None
_agent_name: str | None = None


def instrument_tool(func: Callable[P, R]) -> Callable[P, R]:
    """
    Decorator to instrument tool functions for real-time monitoring.

    This decorator wraps tool functions to emit observability events to DynamoDB
    for visualization in the Demo Viewer. It implements a fire-and-forget pattern
    to ensure monitoring never blocks tool execution.

    The decorator emits three types of events:
    - 'started': Written before tool execution begins
    - 'completed': Written after successful tool execution with duration
    - 'error': Written after tool failure with duration and error message

    Events are only emitted when instrumentation context is set via
    set_instrumentation_context(). If no context is available, the tool
    executes normally without any monitoring overhead.

    Args:
        func: The tool function to instrument. Must be a callable that can
              accept any arguments and return any value.

    Returns:
        Callable[P, R]: The wrapped function with identical signature and
                       behavior, but with added observability events.

    Usage:
        Basic usage with Strands @tool decorator:

        >>> from strands import tool
        >>> from agents.shared.instrumentation import instrument_tool
        >>>
        >>> @tool                    # Strands decorator FIRST
        >>> @instrument_tool         # Observability decorator ON TOP
        >>> def lookup_user(user_id: str) -> dict:
        ...     '''Retrieve user information from database.'''
        ...     return {"user_id": user_id, "name": "Alice"}
        >>>
        >>> # Set context before using instrumented tools
        >>> set_instrumentation_context("session-123", "analyzer")
        >>> result = lookup_user("user-456")  # Emits started/completed events
        >>> clear_instrumentation_context()

        Error handling example:

        >>> @tool
        >>> @instrument_tool
        >>> def failing_tool() -> str:
        ...     raise ValueError("Something went wrong")
        >>>
        >>> set_instrumentation_context("session-456", "greeter")
        >>> try:
        ...     failing_tool()  # Emits started/error events
        ... except ValueError:
        ...     pass  # Exception is re-raised after logging
        >>> clear_instrumentation_context()

    Important:
        - Always apply @tool first, then @instrument_tool on top
        - Python applies decorators bottom-up: @tool registers first
        - Reversing this order breaks instrumentation
    """
    tool_name = func.__name__

    @wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        # Check if we should emit events
        if not _should_emit_events():
            # No context = no events, just execute tool
            return func(*args, **kwargs)

        # Get context for event attribution
        session_id, agent_name = get_instrumentation_context()

        # Generate unique event ID
        event_id = str(uuid.uuid4())

        # Record start time
        start_time = datetime.now(timezone.utc)
        start_timestamp = start_time.isoformat(timespec='microseconds')

        # Prepare parameters (truncated for storage)
        params = {}
        if args:
            params['args'] = [str(a)[:100] for a in args]
        if kwargs:
            params['kwargs'] = {k: str(v)[:100] for k, v in kwargs.items()}

        # Import here to avoid circular dependency
        from agents.shared.dynamodb_client import write_tool_event

        # Write 'started' event (fire-and-forget)
        started_event = {
            'session_id': session_id,
            'timestamp': start_timestamp,
            'event_id': event_id,
            'agent': agent_name,
            'tool_name': tool_name,
            'parameters': _truncate_json(params),
            'status': 'started',
        }
        write_tool_event(started_event)

        try:
            # Execute the actual tool function
            result = func(*args, **kwargs)

            # Calculate duration
            end_time = datetime.now(timezone.utc)
            duration_ms = int((end_time - start_time).total_seconds() * 1000)

            # Write 'completed' event (fire-and-forget)
            completed_event = {
                'session_id': session_id,
                'timestamp': end_time.isoformat(timespec='microseconds'),
                'event_id': event_id,
                'agent': agent_name,
                'tool_name': tool_name,
                'status': 'completed',
                'duration_ms': duration_ms,
            }
            write_tool_event(completed_event)

            return result

        except Exception as e:
            # Calculate duration even on error
            end_time = datetime.now(timezone.utc)
            duration_ms = int((end_time - start_time).total_seconds() * 1000)

            # Write 'error' event (fire-and-forget)
            error_event = {
                'session_id': session_id,
                'timestamp': end_time.isoformat(timespec='microseconds'),
                'event_id': event_id,
                'agent': agent_name,
                'tool_name': tool_name,
                'status': 'error',
                'duration_ms': duration_ms,
                'error_message': _truncate_error(str(e)),
            }
            write_tool_event(error_event)

            # Re-raise the exception (don't swallow errors)
            raise

    return wrapper


def set_instrumentation_context(session_id: str, agent_name: str) -> None:
    """
    Set the instrumentation context for the current request.

    This function establishes the session and agent context used for correlating
    tool events in the Demo Viewer. It must be called at the start of each agent
    handler invocation, before any tools are executed.

    Args:
        session_id: UUID identifying the workflow execution. This value is used
                   as the partition key in DynamoDB for event correlation.
        agent_name: Logical agent identifier (e.g., 'analyzer', 'greeter').
                   Used for event attribution in the Demo Viewer timeline.

    Returns:
        None

    Usage:
        In AgentCore handlers:

        >>> @app.entrypoint
        >>> def invoke(event: dict) -> dict:
        ...     session_id = get_session_id_from_context()
        ...     try:
        ...         set_instrumentation_context(session_id, 'analyzer')
        ...         # Execute agent logic here
        ...         result = invoke_analyzer_agent(event['prompt'])
        ...         return {'response': result}
        ...     finally:
        ...         clear_instrumentation_context()

    Important:
        - Always pair with clear_instrumentation_context() in a finally block
        - Call before any tools are invoked
        - Use consistent session_id across all agents in a workflow
    """
    global _session_id, _agent_name
    _session_id = session_id
    _agent_name = agent_name


def get_instrumentation_context() -> tuple[str | None, str | None]:
    """
    Get the current instrumentation context.

    This function retrieves the session_id and agent_name that were previously
    set via set_instrumentation_context(). It's primarily used internally by
    the @instrument_tool decorator to determine if events should be emitted.

    Returns:
        tuple[str | None, str | None]: A tuple containing (session_id, agent_name).
                                      Returns (None, None) if no context has been set
                                      or if clear_instrumentation_context() was called.

    Usage:
        Check if context is available:

        >>> session_id, agent_name = get_instrumentation_context()
        >>> if session_id and agent_name:
        ...     print("Context is available - events will be emitted")

    Note:
        This function is primarily for internal use by the instrumentation system.
        Agent developers typically don't need to call this directly.
    """
    return _session_id, _agent_name


def clear_instrumentation_context() -> None:
    """
    Clear the instrumentation context after request completes.

    This function resets the session_id and agent_name to None, preventing
    context leakage between requests. It should always be called in a finally
    block to guarantee cleanup even if exceptions occur.

    Returns:
        None

    Usage:
        Proper context lifecycle management:

        >>> try:
        ...     set_instrumentation_context("session-123", "analyzer")
        ...     # Execute agent logic here
        ...     result = invoke_analyzer_agent(prompt)
        ... finally:
        ...     # Always clear context, even if exceptions occur
        ...     clear_instrumentation_context()

    Important:
        - Always call this in a finally block for guaranteed cleanup
        - Prevents context leakage between different workflow executions
        - Safe to call multiple times or when no context is set
    """
    global _session_id, _agent_name
    _session_id = None
    _agent_name = None


def _should_emit_events() -> bool:
    """
    Check if events should be emitted based on current context.

    This function implements the context-dependent event emission logic.
    Events are only emitted when both session_id and agent_name are set
    and are non-empty strings after stripping whitespace.

    Returns:
        True if events should be emitted, False otherwise
    """
    session_id, agent_name = get_instrumentation_context()

    # Check session_id is valid
    if not session_id or not isinstance(session_id, str):
        return False
    session_id_clean = session_id.strip()
    if not session_id_clean:
        return False

    # Check agent_name is valid
    if not agent_name or not isinstance(agent_name, str):
        return False
    agent_name_clean = agent_name.strip()
    if not agent_name_clean:
        return False

    return True


def _truncate_json(params: dict, max_length: int = 200) -> str:
    """Truncate parameters JSON to max length for storage."""
    import json
    try:
        params_str = json.dumps(params)
        if len(params_str) > max_length:
            return params_str[:max_length - 3] + '...'
        return params_str
    except Exception:
        return '{}'


def _truncate_error(error: str, max_length: int = 500) -> str:
    """Truncate error message to max length."""
    if len(error) > max_length:
        return error[:max_length - 3] + '...'
    return error
