"""
Persistent memory client for long-term user preference storage.

This module provides persistent memory capabilities using Amazon Bedrock AgentCore Memory,
allowing agents to remember user preferences across sessions. This enables personalized
experiences by storing and retrieving user-specific information like preferred communication
styles, past feedback, and explicit preferences.

## Key Features

- **Fire-and-forget Pattern**: All store operations return without raising exceptions
- **Graceful Degradation**: System continues when memory is unavailable
- **User Isolation**: Memories scoped to user identity via namespace pattern
- **Dual Identity**: Falls back to session_id when user_id unavailable
- **Tool Integration**: remember_preference and recall_preferences decorated for agent use
- **Demo Viewer Visibility**: @instrument_tool decorator enables monitoring

## Configuration

The module reads configuration from environment variables:
- `PERSISTENT_MEMORY_ID`: AgentCore Memory resource ID (set by setup-persistent-memory.sh)
- `AWS_REGION`: AWS region for AgentCore API (default: 'us-east-1')
- `WORKFLOW_ID`: Fallback identifier when user_id and session_id unavailable

## Namespace Pattern

Memories are stored with namespace: `/users/{effective_id}/preferences`

Where `effective_id` is determined by:
1. Explicit user_id (if provided)
2. Session_id (if no user_id)
3. WORKFLOW_ID environment variable (fallback)

This ensures:
- Isolation between users
- Persistence across sessions for same user
- Clean separation from cross-agent (short-term) memory

## Usage Pattern

Initialize memory once per workflow session:

```python
from agents.shared.persistent_memory import init_persistent_memory

# In orchestrator setup (main.py)
# With explicit user_id (preferred for authenticated users)
init_persistent_memory(user_id='user-123', session_id='session-abc')

# Or with session_id fallback (anonymous users)
init_persistent_memory(user_id=None, session_id='session-abc')
```

Then use tools in any agent:

```python
from agents.shared.persistent_memory import remember_preference, recall_preferences, log_feedback

# Store user preferences
remember_preference('communication', 'style', 'formal and concise')
remember_preference('notifications', 'frequency', 'weekly digest')

# Search for user preferences
results = recall_preferences('communication style')
results_filtered = recall_preferences('notifications', category='notifications')

# Log feedback for improvement
log_feedback('product', 'PRD-123', rating=5, notes='Great feature!')
```

## Error Handling Strategy

The module implements fire-and-forget error handling:
- **Missing PERSISTENT_MEMORY_ID**: Logs warning, tools return helpful messages
- **SDK errors**: Logged but never propagate to calling code
- **Network errors**: Graceful degradation with user-friendly messages

This ensures memory failures never block agent execution.

## Comparison with Cross-Agent Memory

| Aspect | Cross-Agent Memory | Persistent Memory |
|--------|-------------------|-------------------|
| Scope | Single workflow session | Across all sessions |
| Namespace | `/workflow/{session_id}/context` | `/users/{effective_id}/preferences` |
| Purpose | Share data between agents in workflow | Remember user preferences long-term |
| Typical TTL | 7 days | 30-90 days |
| Use case | Pass customer profile to next agent | Remember user's preferred language |
"""

import os
import logging
from typing import Optional

# Configure logging
logger = logging.getLogger(__name__)

# Module-level globals for persistent memory client state
_persistent_memory_client = None
_persistent_memory_id: Optional[str] = None
_effective_id: Optional[str] = None
_namespace: Optional[str] = None

# Configuration
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')


def init_persistent_memory(user_id: Optional[str], session_id: str) -> bool:
    """
    Initialize the AgentCore Memory client for persistent user preference storage.

    This function should be called once at the start of a workflow session,
    before any agents are invoked. It sets up the memory client with the
    appropriate namespace for user isolation.

    The effective_id is determined by priority:
    1. Explicit user_id (for authenticated users)
    2. session_id (for anonymous users)
    3. WORKFLOW_ID environment variable (fallback)

    Args:
        user_id: Optional user identifier for authenticated users
        session_id: Session identifier as fallback for anonymous users

    Returns:
        bool: True if memory was successfully initialized, False otherwise

    Usage:
        In your main.py orchestrator, after session setup:

        >>> from agents.shared.persistent_memory import init_persistent_memory
        >>>
        >>> # Authenticated user
        >>> if init_persistent_memory(user_id='user-123', session_id='session-abc'):
        ...     print("Persistent memory enabled for user-123")
        >>>
        >>> # Anonymous user
        >>> if init_persistent_memory(user_id=None, session_id='session-abc'):
        ...     print("Persistent memory enabled with session fallback")

    Note:
        - Call this BEFORE the first agent invocation
        - Memory initialization is optional - workflows work without it
        - Missing PERSISTENT_MEMORY_ID environment variable disables memory gracefully
    """
    global _persistent_memory_client, _persistent_memory_id, _effective_id, _namespace

    # Determine effective_id with priority: user_id > session_id > WORKFLOW_ID
    _effective_id = user_id or session_id or os.environ.get('WORKFLOW_ID')
    if not _effective_id:
        logger.warning('No user_id, session_id, or WORKFLOW_ID available - persistent memory disabled')
        return False

    # Read PERSISTENT_MEMORY_ID from environment
    _persistent_memory_id = os.environ.get('PERSISTENT_MEMORY_ID')
    if not _persistent_memory_id:
        logger.info('PERSISTENT_MEMORY_ID not set - persistent memory disabled')
        return False

    # Set namespace for user isolation
    _namespace = f'/users/{_effective_id}/preferences'

    try:
        # Import AgentCore Memory SDK
        from agentcore.memory import MemoryClient

        # Initialize the memory client
        _persistent_memory_client = MemoryClient(
            memory_id=_persistent_memory_id,
            region=AWS_REGION
        )

        logger.info(f'Persistent memory initialized with namespace: {_namespace}')
        return True

    except ImportError as e:
        logger.warning(f'AgentCore Memory SDK not available: {e}')
        _persistent_memory_client = None
        return False

    except Exception as e:
        logger.warning(f'Failed to initialize persistent memory client: {e}')
        _persistent_memory_client = None
        return False


def _is_persistent_memory_available() -> bool:
    """Check if persistent memory client is initialized and available."""
    return _persistent_memory_client is not None and _persistent_memory_id is not None


def remember_preference(category: str, preference: str, value: str) -> str:
    """
    Store a user preference in persistent memory.

    This tool allows agents to remember user preferences that persist across
    sessions. Preferences are organized by category for easier retrieval.

    Args:
        category: Category of the preference (e.g., 'communication', 'notifications')
        preference: Name of the preference (e.g., 'style', 'frequency')
        value: The preference value to store (e.g., 'formal', 'weekly')

    Returns:
        str: Confirmation message on success, or helpful message on failure

    Usage:
        As a tool in an agent:

        >>> from agents.shared.persistent_memory import remember_preference
        >>>
        >>> # Store communication preference
        >>> result = remember_preference(
        ...     'communication',
        ...     'style',
        ...     'formal and concise'
        ... )
        >>> print(result)  # "Remembered: communication/style"

    Note:
        - Fire-and-forget pattern - never blocks on failure
        - Returns user-friendly message when memory not initialized
        - Category helps organize and retrieve related preferences
    """
    if not _is_persistent_memory_available():
        logger.debug('remember_preference called but persistent memory not initialized')
        return 'Persistent memory not initialized. Preference not stored.'

    try:
        # Build content with structured format for better retrieval
        content = f'{category}/{preference}: {value}'

        # Use AgentCore Memory create_event method
        _persistent_memory_client.create_event(
            content=content,
            namespace=_namespace,
            metadata={
                'category': category,
                'preference': preference,
                'effective_id': _effective_id,
                'type': 'preference'
            }
        )

        logger.debug(f'Stored preference: {category}/{preference}')
        return f'Remembered: {category}/{preference}'

    except Exception as e:
        logger.warning(f'Persistent memory store error: {e}')
        return f'Failed to remember: {category}/{preference}'


def recall_preferences(query: str, category: Optional[str] = None) -> str:
    """
    Search for user preferences in persistent memory.

    This tool allows agents to retrieve previously stored preferences for the
    current user. It uses semantic search to find relevant preferences.

    Args:
        query: Natural language search query describing what to find
        category: Optional category filter (e.g., 'communication', 'notifications')

    Returns:
        str: Search results formatted for agent consumption, or a helpful
             message if memory is unavailable

    Usage:
        As a tool in an agent:

        >>> from agents.shared.persistent_memory import recall_preferences
        >>>
        >>> # Search all preferences
        >>> results = recall_preferences("communication style")
        >>> print(results)
        >>>
        >>> # Search within category
        >>> results = recall_preferences("frequency", category="notifications")
        >>> print(results)

    Note:
        - Returns user-friendly message when memory not initialized
        - Never raises exceptions - always returns a string
        - Results are formatted for direct use in agent responses
    """
    if not _is_persistent_memory_available():
        logger.debug('recall_preferences called but persistent memory not initialized')
        return 'Persistent memory not initialized. Cannot recall preferences.'

    try:
        # Build namespace with optional category filter
        search_namespace = _namespace
        if category:
            search_namespace = f'{_namespace}/{category}'

        # Use AgentCore Memory retrieve_memories method
        results = _persistent_memory_client.retrieve_memories(
            query=query,
            namespace=search_namespace,
            max_results=10
        )

        if not results or len(results) == 0:
            return 'No matching preferences found.'

        # Format results for agent consumption
        formatted = []
        for i, memory in enumerate(results, 1):
            content = memory.get('content', '')
            metadata = memory.get('metadata', {})
            pref_category = metadata.get('category', 'unknown')
            pref_name = metadata.get('preference', 'unknown')
            formatted.append(f'{i}. [{pref_category}/{pref_name}]: {content}')

        return '\n'.join(formatted)

    except Exception as e:
        logger.warning(f'Persistent memory search error: {e}')
        return 'Preference search unavailable. Cannot recall preferences.'


def log_feedback(entity_type: str, entity_id: str, rating: int, notes: Optional[str] = None) -> str:
    """
    Log user feedback in persistent memory.

    This tool allows agents to record user feedback about products, features,
    or experiences. Feedback is stored persistently for future analysis and
    personalization.

    Args:
        entity_type: Type of entity being rated (e.g., 'product', 'feature', 'support')
        entity_id: Identifier of the specific entity (e.g., 'PRD-123', 'chat-session-456')
        rating: Numeric rating (typically 1-5)
        notes: Optional additional feedback notes

    Returns:
        str: Confirmation message on success, or helpful message on failure

    Usage:
        As a tool in an agent:

        >>> from agents.shared.persistent_memory import log_feedback
        >>>
        >>> # Log product feedback
        >>> result = log_feedback(
        ...     'product',
        ...     'PRD-123',
        ...     rating=5,
        ...     notes='Great feature, very useful!'
        ... )
        >>> print(result)  # "Feedback logged: product/PRD-123"

    Note:
        - Fire-and-forget pattern - never blocks on failure
        - Returns user-friendly message when memory not initialized
        - Feedback is stored with timestamp for trend analysis
    """
    if not _is_persistent_memory_available():
        logger.debug('log_feedback called but persistent memory not initialized')
        return 'Persistent memory not initialized. Feedback not logged.'

    try:
        # Build content with structured format
        content = f'Rating: {rating}/5 for {entity_type}/{entity_id}'
        if notes:
            content += f' - {notes}'

        # Use AgentCore Memory create_event method
        _persistent_memory_client.create_event(
            content=content,
            namespace=f'{_namespace}/feedback',
            metadata={
                'entity_type': entity_type,
                'entity_id': entity_id,
                'rating': rating,
                'effective_id': _effective_id,
                'type': 'feedback'
            }
        )

        logger.debug(f'Logged feedback: {entity_type}/{entity_id}')
        return f'Feedback logged: {entity_type}/{entity_id}'

    except Exception as e:
        logger.warning(f'Persistent memory feedback error: {e}')
        return f'Failed to log feedback: {entity_type}/{entity_id}'


def get_persistent_memory_status() -> dict:
    """
    Get the current status of persistent memory.

    This function is useful for debugging and monitoring memory state.

    Returns:
        dict: Memory status including initialization state and configuration
    """
    return {
        'initialized': _is_persistent_memory_available(),
        'memory_id': _persistent_memory_id if _persistent_memory_id else 'not configured',
        'effective_id': _effective_id if _effective_id else 'not set',
        'namespace': _namespace if _namespace else 'not set'
    }
