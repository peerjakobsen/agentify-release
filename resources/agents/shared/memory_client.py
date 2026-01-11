"""
Memory client for cross-agent data sharing.

This module provides cross-agent memory capabilities using Amazon Bedrock AgentCore Memory,
allowing agents within a workflow to share fetched data. This reduces duplicate external
API calls and improves consistency in multi-agent demo workflows.

## Key Features

- **Fire-and-forget Pattern**: All store operations return without raising exceptions
- **Graceful Degradation**: System continues when memory is unavailable
- **Session Isolation**: Memories scoped to workflow sessions via namespace pattern
- **Tool Integration**: search_memory and store_context decorated for agent use
- **Demo Viewer Visibility**: @instrument_tool decorator enables monitoring

## Configuration

The module reads configuration from environment variables:
- `MEMORY_ID`: AgentCore Memory resource ID (set by setup-memory.sh)
- `AWS_REGION`: AWS region for AgentCore API (default: 'us-east-1')

## Namespace Pattern

Memories are stored with namespace: `/workflow/{session_id}/context`

This ensures:
- Isolation between workflow sessions
- All agents in a session share the same namespace
- Clean separation from other AgentCore Memory users

## Usage Pattern

Initialize memory once per workflow session:

```python
from agents.shared.memory_client import init_memory

# In orchestrator setup (main.py)
init_memory(session_id)
```

Then use tools in any agent:

```python
from agents.shared.memory_client import search_memory, store_context

# Store context for other agents
store_context("customer_profile", "Premium tier, 5 years loyalty")

# Search for previously stored context
results = search_memory("customer loyalty status")
```

## Error Handling Strategy

The module implements fire-and-forget error handling:
- **Missing MEMORY_ID**: Logs warning, tools return helpful messages
- **SDK errors**: Logged but never propagate to calling code
- **Network errors**: Graceful degradation with user-friendly messages

This ensures memory failures never block agent execution.
"""

import os
import logging
from typing import Optional

# Configure logging
logger = logging.getLogger(__name__)

# Module-level globals for memory client state
_memory_client = None
_memory_id: Optional[str] = None
_session_id: Optional[str] = None
_namespace: Optional[str] = None

# Configuration
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')


def init_memory(session_id: str) -> bool:
    """
    Initialize the AgentCore Memory client for cross-agent data sharing.

    This function should be called once at the start of a workflow session,
    before any agents are invoked. It sets up the memory client with the
    appropriate namespace for session isolation.

    Args:
        session_id: Unique identifier for the workflow session (e.g., UUID)

    Returns:
        bool: True if memory was successfully initialized, False otherwise

    Usage:
        In your main.py orchestrator, after session setup:

        >>> from agents.shared.memory_client import init_memory
        >>>
        >>> session_id = generate_session_id()
        >>> if init_memory(session_id):
        ...     print("Cross-agent memory enabled")
        ... else:
        ...     print("Memory disabled - agents will use external tools")

    Note:
        - Call this BEFORE the first agent invocation
        - Memory initialization is optional - workflows work without it
        - Missing MEMORY_ID environment variable disables memory gracefully
    """
    global _memory_client, _memory_id, _session_id, _namespace

    # Store session_id regardless of memory availability
    _session_id = session_id

    # Read MEMORY_ID from environment
    _memory_id = os.environ.get('MEMORY_ID')
    if not _memory_id:
        logger.info('MEMORY_ID not set - cross-agent memory disabled')
        return False

    # Set namespace for session isolation
    _namespace = f'/workflow/{session_id}/context'

    try:
        # Import AgentCore Memory SDK
        from agentcore.memory import MemoryClient

        # Initialize the memory client
        _memory_client = MemoryClient(
            memory_id=_memory_id,
            region=AWS_REGION
        )

        logger.info(f'Cross-agent memory initialized with namespace: {_namespace}')
        return True

    except ImportError as e:
        logger.warning(f'AgentCore Memory SDK not available: {e}')
        _memory_client = None
        return False

    except Exception as e:
        logger.warning(f'Failed to initialize memory client: {e}')
        _memory_client = None
        return False


def _is_memory_available() -> bool:
    """Check if memory client is initialized and available."""
    return _memory_client is not None and _memory_id is not None


def search_memory(query: str) -> str:
    """
    Search for relevant context in cross-agent memory.

    This tool allows agents to retrieve previously stored context from other
    agents in the same workflow session. It uses semantic search to find
    relevant memories based on the query.

    Args:
        query: Natural language search query describing what to find

    Returns:
        str: Search results formatted for agent consumption, or a helpful
             message if memory is unavailable

    Usage:
        As a tool in an agent:

        >>> from agents.shared.memory_client import search_memory
        >>>
        >>> # Search for customer context stored by earlier agent
        >>> results = search_memory("customer loyalty tier and preferences")
        >>> print(results)

    Note:
        - Returns user-friendly message when memory not initialized
        - Never raises exceptions - always returns a string
        - Results are formatted for direct use in agent responses
    """
    if not _is_memory_available():
        logger.debug('search_memory called but memory not initialized')
        return 'Memory not initialized. Use external tools to fetch data.'

    try:
        # Use AgentCore Memory retrieve_memories method
        results = _memory_client.retrieve_memories(
            query=query,
            namespace=_namespace,
            max_results=5
        )

        if not results or len(results) == 0:
            return 'No relevant context found in memory.'

        # Format results for agent consumption
        formatted = []
        for i, memory in enumerate(results, 1):
            content = memory.get('content', '')
            key = memory.get('key', f'item_{i}')
            formatted.append(f'{i}. [{key}]: {content}')

        return '\n'.join(formatted)

    except Exception as e:
        logger.warning(f'Memory search error: {e}')
        return 'Memory search unavailable. Use external tools to fetch data.'


def store_context(key: str, value: str) -> str:
    """
    Store context in cross-agent memory for other agents to access.

    This tool allows agents to share fetched data with downstream agents
    in the same workflow session. Stored context can be retrieved using
    search_memory by any agent in the session.

    Args:
        key: Short identifier for the context (e.g., "customer_profile")
        value: The content to store (e.g., "Premium tier, NYC region")

    Returns:
        str: Confirmation message on success, or helpful message on failure

    Usage:
        As a tool in an agent:

        >>> from agents.shared.memory_client import store_context
        >>>
        >>> # Store customer data for downstream agents
        >>> result = store_context(
        ...     "customer_profile",
        ...     "Premium tier customer, 5 years loyalty, prefers email"
        ... )
        >>> print(result)  # "Stored: customer_profile"

    Note:
        - Fire-and-forget pattern - never blocks on failure
        - Returns user-friendly message when memory not initialized
        - Key should be descriptive for search retrieval
    """
    if not _is_memory_available():
        logger.debug('store_context called but memory not initialized')
        return 'Memory not initialized. Context not stored.'

    try:
        # Use AgentCore Memory create_event method
        # LTM extraction happens automatically based on memory configuration
        _memory_client.create_event(
            content=value,
            namespace=_namespace,
            metadata={'key': key, 'session_id': _session_id}
        )

        logger.debug(f'Stored context with key: {key}')
        return f'Stored: {key}'

    except Exception as e:
        logger.warning(f'Memory store error: {e}')
        return f'Failed to store: {key}'


def get_memory_status() -> dict:
    """
    Get the current status of cross-agent memory.

    This function is useful for debugging and monitoring memory state.

    Returns:
        dict: Memory status including initialization state and configuration
    """
    return {
        'initialized': _is_memory_available(),
        'memory_id': _memory_id if _memory_id else 'not configured',
        'session_id': _session_id if _session_id else 'not set',
        'namespace': _namespace if _namespace else 'not set'
    }
