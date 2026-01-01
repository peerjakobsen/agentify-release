"""
Shared utilities for Agentify agents.

This module provides comprehensive observability infrastructure for tool instrumentation
and event persistence to DynamoDB. It enables real-time monitoring of tool execution
through instrumentation decorators and fire-and-forget event persistence for
visualization in the Demo Viewer.

The module implements a transparent monitoring system that never blocks tool execution,
using a fire-and-forget pattern for all DynamoDB operations. Events are correlated
using session_id and agent_name context, allowing the Demo Viewer to display
chronological tool execution timelines across multi-agent workflows.

## Core Components

### Context Management
- `set_instrumentation_context()`: Establish session and agent correlation context
- `get_instrumentation_context()`: Retrieve current context (internal use)
- `clear_instrumentation_context()`: Clean up context after request completion

### Tool Instrumentation
- `@instrument_tool`: Decorator for automatic tool monitoring with event emission

### Event Persistence
- `write_tool_event()`: Fire-and-forget event writing to DynamoDB
- `query_tool_events()`: Retrieve events for a workflow session
- `get_tool_events_table_name()`: Resolve DynamoDB table name from configuration

### Authentication
- `GatewayTokenManager`: OAuth token management for MCP Gateway authentication

## Integration Patterns for Agent Developers

### AgentCore Handler Pattern

For agents deployed to Amazon Bedrock AgentCore Runtime:

```python
from bedrock_agentcore.runtime import BedrockAgentCoreApp, BedrockAgentCoreContext
from agents.shared.instrumentation import (
    set_instrumentation_context,
    clear_instrumentation_context
)

app = BedrockAgentCoreApp()

@app.entrypoint
def invoke(event: dict) -> dict:
    # Get session_id from AgentCore context
    ctx = BedrockAgentCoreContext()
    session_id = ctx.get_session_id() or event.get('session_id', '')

    try:
        # Set context BEFORE any tools execute
        if session_id:
            set_instrumentation_context(session_id, 'analyzer')

        # Import and invoke agent (lazy import for cold start optimization)
        from agents.analyzer.agent import invoke_analyzer_agent
        response = invoke_analyzer_agent(event['prompt'])

        return {'response': response, 'session_id': session_id}

    finally:
        # Always clear context to prevent leakage
        if session_id:
            clear_instrumentation_context()
```

### Tool Definition Pattern

For local tools (agent-specific):

```python
from strands import tool
from agents.shared.instrumentation import instrument_tool

@tool                    # Strands decorator FIRST
@instrument_tool         # Observability decorator ON TOP
def extract_user_id(request: str) -> dict:
    '''Extract user ID from greeting request text.'''
    import re
    match = re.search(r'user[_\\s]?id[:\\s]+(\\w+)', request.lower())
    return {
        "userId": match.group(1) if match else "unknown",
        "found": bool(match)
    }
```

## Configuration

### Environment Variables

- `AWS_REGION`: AWS region for DynamoDB and SSM (default: 'us-east-1')
- `AGENTIFY_TABLE_NAME`: DynamoDB table name (fallback configuration)

### SSM Parameter Store

- `/agentify/services/dynamodb/tool-events-table`: DynamoDB table name (preferred)

## Best Practices

1. **Always set context first**: Call set_instrumentation_context() before any tools
2. **Use finally blocks**: Always clear context in finally blocks
3. **Correct decorator order**: @tool first, then @instrument_tool on top
4. **Same session_id**: Use consistent session_id across workflow agents
5. **Lazy imports**: Import agent modules inside handlers for faster cold starts
"""

from .instrumentation import (
    instrument_tool,
    set_instrumentation_context,
    get_instrumentation_context,
    clear_instrumentation_context
)

from .dynamodb_client import (
    write_tool_event,
    query_tool_events,
    get_tool_events_table_name
)

from .gateway_auth import GatewayTokenManager

__all__ = [
    'instrument_tool',
    'set_instrumentation_context',
    'get_instrumentation_context',
    'clear_instrumentation_context',
    'write_tool_event',
    'query_tool_events',
    'get_tool_events_table_name',
    'GatewayTokenManager'
]
