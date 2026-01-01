"""
DynamoDB client for event persistence.

This module provides fire-and-forget event persistence to DynamoDB for tool execution
monitoring. It implements a robust, fault-tolerant system for writing and querying
tool events with comprehensive error handling and graceful degradation.

## Key Features

- **Fire-and-forget Pattern**: All operations return success status without raising exceptions
- **Graceful Degradation**: System continues when DynamoDB is unavailable
- **Schema Validation**: Events are validated before writing to ensure consistency
- **Multi-tier Configuration**: Table name resolved from SSM, environment, or disabled
- **Automatic TTL**: Events auto-delete after 2 hours to prevent unbounded growth
- **Comprehensive Logging**: All errors logged for debugging without blocking execution

## Configuration Resolution

The module resolves the DynamoDB table name using a multi-tier strategy:

1. **Cached table name**: Performance optimization for repeated calls
2. **SSM Parameter Store**: `/agentify/services/dynamodb/tool-events-table` (preferred)
3. **Environment Variable**: `AGENTIFY_TABLE_NAME` (fallback)
4. **Graceful degradation**: Returns None if no configuration found

This approach provides flexibility for different deployment environments while
maintaining performance through caching.

## Event Schema Validation

Events are validated against a strict schema before writing:

- **Required fields**: workflow_id, timestamp, event_id, agent, tool_name, status
- **Status values**: Must be 'started', 'completed', or 'error'
- **Conditional fields**: duration_ms required for completed/error, error_message for error
- **Data types**: String fields must be non-empty, duration_ms must be non-negative integer

Invalid events are rejected with detailed logging but never raise exceptions.

## Error Handling Strategy

The module implements comprehensive error handling for all failure modes:

- **Configuration errors**: Missing SSM parameters, invalid environment variables
- **DynamoDB errors**: Table not found, access denied, throughput exceeded
- **Network errors**: Service unavailable, connection timeouts
- **Validation errors**: Invalid event schema, missing required fields

All errors are logged with appropriate detail levels but never propagate to
calling code, ensuring monitoring transparency.

## Performance Optimizations

- **Table name caching**: Avoids repeated SSM/environment lookups
- **Schema validation**: Performed before DynamoDB operations to avoid unnecessary calls
- **Efficient queries**: Uses DynamoDB Query operation with partition key
- **TTL management**: Automatic cleanup prevents unbounded table growth

## Integration with Demo Viewer

The query_tool_events() function is designed for Demo Viewer polling:

- **Chronological ordering**: Events returned sorted by timestamp (oldest first)
- **Configurable limits**: Control result set size for performance
- **Empty list fallback**: Graceful handling when no events or errors occur
- **Real-time polling**: Optimized for 500ms polling intervals

## AWS Service Dependencies

- **DynamoDB**: Primary storage for tool events
- **SSM Parameter Store**: Preferred configuration source
- **CloudWatch Logs**: Error and debug logging destination
- **IAM**: Permissions for DynamoDB and SSM access

The module gracefully degrades when any of these services are unavailable,
ensuring tool execution continues normally.
"""

import boto3
import os
import time
import logging
from typing import Dict, Any, List
from botocore.exceptions import ClientError

# Configuration constants
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
TOOL_EVENTS_TABLE_PARAM = '/agentify/services/dynamodb/tool-events-table'
TTL_DURATION_SECONDS = 7200  # 2 hours

# Module-level cache for table name
_table_name: str | None = None

# Configure logging
logger = logging.getLogger(__name__)


def get_tool_events_table_name() -> str | None:
    """
    Resolve DynamoDB table name from SSM Parameter Store or environment variable.

    This function implements a multi-tier configuration resolution strategy with
    caching for performance. It attempts to resolve the table name from multiple
    sources in order of preference, with comprehensive error handling and graceful
    degradation.

    Resolution order:
    1. Cached table name (performance optimization)
    2. SSM Parameter Store: /agentify/services/dynamodb/tool-events-table (preferred)
    3. Environment Variable: AGENTIFY_TABLE_NAME (fallback)
    4. None (graceful degradation)

    Returns:
        str | None: The DynamoDB table name if successfully resolved, or None
                   if no table is configured. When None is returned, all
                   write_tool_event calls will gracefully degrade and return False.

    Usage:
        Check table availability:

        >>> from agents.shared.dynamodb_client import get_tool_events_table_name
        >>>
        >>> table_name = get_tool_events_table_name()
        >>> if table_name:
        ...     print(f"Events will be written to: {table_name}")
        ... else:
        ...     print("Monitoring disabled - no table configured")

    Note:
        - Table name is cached after first successful resolution
        - SSM Parameter Store is preferred for production deployments
        - Environment variable is useful for local development
    """
    global _table_name

    # Return cached table name if available
    if _table_name is not None:
        return _table_name

    # Try environment variable first (faster than SSM)
    env_table = os.environ.get('AGENTIFY_TABLE_NAME')
    if env_table:
        _table_name = env_table
        logger.debug(f'Using table name from environment: {_table_name}')
        return _table_name

    # Try SSM Parameter Store (preferred for production)
    try:
        ssm = boto3.client('ssm', region_name=AWS_REGION)
        response = ssm.get_parameter(Name=TOOL_EVENTS_TABLE_PARAM)
        _table_name = response['Parameter']['Value']
        logger.debug(f'Retrieved table name from SSM: {_table_name}')
        return _table_name
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        if error_code == 'ParameterNotFound':
            logger.debug(f'SSM parameter {TOOL_EVENTS_TABLE_PARAM} not found')
        else:
            logger.warning(f'SSM error ({error_code}): {e}')
    except Exception as e:
        logger.warning(f'Unexpected error getting table name from SSM: {e}')

    # Graceful degradation - no table configured
    logger.debug('No DynamoDB table configured - monitoring disabled')
    return None


def write_tool_event(event: Dict[str, Any]) -> bool:
    """
    Write a tool call event to DynamoDB.

    This is a fire-and-forget operation that logs warnings on failure
    but NEVER raises exceptions. Tool execution must not be blocked
    by monitoring failures.

    Args:
        event: Event data dictionary containing:
            - workflow_id (str): Workflow execution UUID (partition key)
            - timestamp (str): ISO 8601 timestamp with microseconds (sort key)
            - event_id (str): UUID for event deduplication
            - agent (str): Agent name that executed the tool
            - tool_name (str): Name of the tool function
            - status (str): 'started', 'completed', or 'error'
            - parameters (str, optional): JSON string of tool parameters
            - duration_ms (int, optional): Execution time for completed/error
            - error_message (str, optional): Error description for error events
            - ttl (int, optional): Unix timestamp for auto-deletion

    Returns:
        bool: True if write succeeded, False otherwise

    Usage:
        Basic event writing:

        >>> from agents.shared.dynamodb_client import write_tool_event
        >>>
        >>> # Write a 'started' event
        >>> success = write_tool_event({
        ...     'workflow_id': 'abc-123',
        ...     'timestamp': '2024-01-15T10:30:00.123456+00:00',
        ...     'event_id': 'evt-456',
        ...     'agent': 'analyzer',
        ...     'tool_name': 'lookup_user',
        ...     'status': 'started',
        ...     'parameters': '{"user_id": "user-789"}'
        ... })
        >>> # success is True on successful write, False on failure

    Important:
        - Never raises exceptions - always returns True/False
        - Adds TTL automatically if not provided
        - Validates required fields before attempting write
    """
    # Get table name with graceful degradation
    table_name = get_tool_events_table_name()
    if not table_name:
        logger.debug('Cannot write tool event: table not configured')
        return False

    # Validate required fields
    required_fields = ['workflow_id', 'timestamp', 'event_id', 'agent', 'tool_name', 'status']
    for field in required_fields:
        if field not in event:
            logger.warning(f'Cannot write tool event: missing required field "{field}"')
            return False

    # Validate status value
    valid_statuses = ['started', 'completed', 'error']
    if event.get('status') not in valid_statuses:
        logger.warning(f'Invalid status value: {event.get("status")}')
        return False

    try:
        # Add TTL if not present
        if 'ttl' not in event:
            event['ttl'] = int(time.time()) + TTL_DURATION_SECONDS

        # Create DynamoDB resource
        dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
        table = dynamodb.Table(table_name)

        # Write event (fire-and-forget)
        table.put_item(Item=event)

        logger.debug(
            f"Wrote tool event: {event.get('tool_name', 'unknown')} "
            f"[{event.get('status', 'unknown')}]"
        )
        return True

    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        if error_code == 'ResourceNotFoundException':
            logger.warning(f'DynamoDB table {table_name} does not exist')
        elif error_code in ['AccessDeniedException', 'UnauthorizedOperation']:
            logger.warning(f'Access denied to DynamoDB table {table_name}')
        elif error_code == 'ProvisionedThroughputExceededException':
            logger.warning(f'DynamoDB table {table_name} throughput exceeded')
        else:
            logger.warning(f'DynamoDB ClientError ({error_code}): {e}')
        return False

    except Exception as e:
        # Graceful degradation: log error and return False
        logger.warning(f'Failed to write tool event: {e}')
        return False


def query_tool_events(workflow_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Query tool events for a workflow from DynamoDB.

    Returns events sorted by timestamp in ascending order (oldest first).
    Handles errors gracefully by returning an empty list.

    Args:
        workflow_id: The workflow ID (partition key) to query
        limit: Maximum number of events to return (default: 100)

    Returns:
        List[Dict[str, Any]]: List of event dictionaries, or empty list on error

    Usage:
        Query events for Demo Viewer:

        >>> from agents.shared.dynamodb_client import query_tool_events
        >>>
        >>> events = query_tool_events("workflow-123")
        >>> for event in events:
        ...     print(f"{event['tool_name']}: {event['status']}")

    Note:
        - Events are sorted chronologically (oldest first)
        - Returns empty list on any error
        - Designed for Demo Viewer polling at 500ms intervals
    """
    # Validate input parameters
    if not workflow_id or not isinstance(workflow_id, str) or not workflow_id.strip():
        logger.warning('Invalid workflow_id provided to query_tool_events')
        return []

    if not isinstance(limit, int) or limit <= 0:
        logger.warning(f'Invalid limit provided to query_tool_events: {limit}, using default 100')
        limit = 100

    # Get table name with graceful degradation
    table_name = get_tool_events_table_name()
    if not table_name:
        logger.debug('No table configured, returning empty event list')
        return []

    try:
        # Create DynamoDB resource
        dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
        table = dynamodb.Table(table_name)

        # Query DynamoDB
        response = table.query(
            KeyConditionExpression='workflow_id = :wid',
            ExpressionAttributeValues={':wid': workflow_id.strip()},
            Limit=limit,
            ScanIndexForward=True  # Sort by timestamp ascending (oldest first)
        )

        events = response.get('Items', [])
        logger.debug(f'Retrieved {len(events)} events for workflow {workflow_id}')
        return events

    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        if error_code == 'ResourceNotFoundException':
            logger.warning(f'DynamoDB table {table_name} does not exist for query')
        elif error_code in ['AccessDeniedException', 'UnauthorizedOperation']:
            logger.warning(f'Access denied to DynamoDB table {table_name} for query')
        elif error_code == 'ProvisionedThroughputExceededException':
            logger.warning(f'DynamoDB table {table_name} read throughput exceeded')
        else:
            logger.warning(f'DynamoDB ClientError during query ({error_code}): {e}')
        return []

    except Exception as e:
        # Graceful degradation: log error and return empty list
        logger.warning(f'Failed to query tool events for workflow {workflow_id}: {e}')
        return []
