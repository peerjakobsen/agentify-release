"""
Gateway client module for MCP Gateway integration.

This module provides OAuth token management and MCP client lifecycle handling
for AgentCore Gateway endpoints. It ensures the MCP session stays alive during
agent execution, preventing "client session is not running" errors.

## Key Functions

- `GatewayTokenManager`: Handles OAuth2 client credentials flow with Cognito
- `invoke_with_gateway()`: Execute agent with proper MCP session lifecycle

## Usage

```python
from agents.shared.gateway_client import invoke_with_gateway
from .prompts import SYSTEM_PROMPT
from .tools import my_local_tool

def invoke_my_agent(prompt: str) -> str:
    '''Invoke agent with local and Gateway tools.'''
    return invoke_with_gateway(
        prompt=prompt,
        local_tools=[my_local_tool],
        system_prompt=SYSTEM_PROMPT
    )
```

## Gateway Credentials

Gateway credentials are automatically discovered from SSM Parameter Store:
- `/agentify/{project}/gateway/url`
- `/agentify/{project}/gateway/client_id`
- `/agentify/{project}/gateway/client_secret`
- `/agentify/{project}/gateway/token_endpoint`
- `/agentify/{project}/gateway/scope`

The project name is read from `AGENTIFY_PROJECT_NAME` environment variable,
which is set automatically by setup.sh during agent deployment.

## Why This Module Exists

MCP tools returned by `list_tools_sync()` are proxy objects that maintain
a reference to the MCP client session. If the session closes before the
agent executes tools, you get "client session is not running" errors.

This module keeps the MCP session open during the entire agent execution,
ensuring Gateway tools work correctly.
"""

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import TypedDict

import boto3
import httpx
from botocore.exceptions import ClientError
from mcp.client.streamable_http import streamablehttp_client
from strands import Agent
from strands.models.bedrock import BedrockModel
from strands.tools.mcp import MCPClient

from agents.shared.instrumentation import get_instrumentation_context
from agents.shared.dynamodb_client import write_tool_event

logger = logging.getLogger(__name__)


class GatewayConfig(TypedDict, total=False):
    """Gateway configuration from SSM Parameter Store."""

    url: str
    client_id: str
    client_secret: str
    token_endpoint: str
    scope: str


@lru_cache(maxsize=1)
def _get_gateway_config_from_ssm() -> GatewayConfig | None:
    """
    Read Gateway configuration from SSM Parameter Store.

    Credentials are stored at `/agentify/{project}/gateway/*` by setup.sh.
    The project name is read from AGENTIFY_PROJECT_NAME environment variable.

    Returns:
        GatewayConfig dict if credentials found, None otherwise.
    """
    project = os.environ.get('AGENTIFY_PROJECT_NAME')
    if not project:
        logger.debug('AGENTIFY_PROJECT_NAME not set, cannot read Gateway config from SSM')
        return None

    prefix = f'/agentify/{project}/gateway'
    logger.debug('Reading Gateway config from SSM: %s/*', prefix)

    try:
        ssm = boto3.client('ssm')

        # Get all parameters under the prefix
        response = ssm.get_parameters_by_path(
            Path=prefix,
            WithDecryption=True,  # Required for SecureString (client_secret)
        )

        if not response.get('Parameters'):
            logger.debug('No Gateway parameters found in SSM at %s', prefix)
            return None

        # Parse parameters into config dict
        config: GatewayConfig = {}
        for param in response['Parameters']:
            # Extract key name from full path: /agentify/project/gateway/url -> url
            key = param['Name'].split('/')[-1]
            config[key] = param['Value']

        # Validate required fields
        required = ['url', 'client_id', 'client_secret', 'token_endpoint', 'scope']
        missing = [k for k in required if not config.get(k)]
        if missing:
            logger.warning('Gateway config incomplete, missing: %s', missing)
            return None

        logger.info('Gateway config loaded from SSM: %s', prefix)
        return config

    except ClientError as e:
        logger.warning('Failed to read Gateway config from SSM: %s', e)
        return None


class GatewayTokenManager:
    """
    Manages OAuth tokens for MCP Gateway authentication.

    This class handles the OAuth2 client credentials flow with Cognito,
    caching tokens and automatically refreshing them before expiry.

    The token manager uses a 5-minute buffer before token expiry to ensure
    tokens are refreshed proactively, avoiding authentication failures
    during tool invocations.

    Credentials are read from SSM Parameter Store automatically.
    """

    def __init__(self):
        """
        Initialize the token manager.

        Credentials are loaded from SSM Parameter Store using the project
        name from AGENTIFY_PROJECT_NAME environment variable.
        """
        config = _get_gateway_config_from_ssm()
        if config:
            self.client_id = config.get('client_id')
            self.client_secret = config.get('client_secret')
            self.token_endpoint = config.get('token_endpoint')
            self.scope = config.get('scope')
        else:
            self.client_id = None
            self.client_secret = None
            self.token_endpoint = None
            self.scope = None

        self._token: str | None = None
        self._expires_at: datetime | None = None

    def is_configured(self) -> bool:
        """
        Check if OAuth credentials are configured.

        Returns:
            True if all required credentials are present, False otherwise.
        """
        return all([self.client_id, self.client_secret, self.token_endpoint, self.scope])

    def get_token(self) -> str:
        """
        Get a valid OAuth token, refreshing if necessary.

        This method returns a cached token if still valid, or fetches a new
        token from Cognito using the client credentials grant. Tokens are
        refreshed 5 minutes before expiry to avoid authentication failures.

        Returns:
            A valid OAuth access token string.

        Raises:
            ValueError: If OAuth credentials are not configured.
            httpx.HTTPStatusError: If token request fails.
        """
        # Return cached token if still valid
        if self._token and self._expires_at and self._expires_at > datetime.now():
            return self._token

        if not self.is_configured():
            raise ValueError('Gateway OAuth credentials not configured')

        logger.info('Fetching new OAuth token from %s', self.token_endpoint)

        response = httpx.post(
            self.token_endpoint,
            data={
                'grant_type': 'client_credentials',
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'scope': self.scope,
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
        )
        response.raise_for_status()
        data = response.json()

        self._token = data['access_token']
        # Refresh 5 minutes before actual expiry to avoid edge cases
        expires_in = data.get('expires_in', 3600) - 300
        self._expires_at = datetime.now() + timedelta(seconds=expires_in)

        logger.info('OAuth token obtained, expires in %d seconds', expires_in)
        return self._token

    def clear_token(self) -> None:
        """
        Clear the cached token.

        Call this method to force a token refresh on the next get_token() call.
        Useful when a token is rejected by the Gateway.
        """
        self._token = None
        self._expires_at = None
        logger.debug('Cleared cached OAuth token')


def _create_instrumented_stream(original_stream, tool_name: str):
    """
    Create an instrumented async generator that wraps the original tool's stream method.

    Strands tools use stream() method which is an async generator. This wrapper:
    1. Emits 'started' event to DynamoDB before yielding any events
    2. Yields all events from the original stream
    3. Emits 'completed' or 'failed' event when the stream finishes

    IMPORTANT: Uses try/finally to ensure completion event is ALWAYS written,
    even if the consumer doesn't fully exhaust the generator (e.g., due to
    early break, GeneratorExit, or garbage collection).

    Args:
        original_stream: The original stream method from MCPAgentTool
        tool_name: Name of the tool for event logging

    Returns:
        Async generator function that wraps the original stream with instrumentation
    """
    async def instrumented_stream(tool_use, invocation_state=None, **kwargs):
        """Instrumented stream method for MCPAgentTool."""
        # Check if instrumentation context is set
        session_id, agent_name = get_instrumentation_context()

        if not session_id or not agent_name:
            # No context - just delegate to original stream without instrumentation
            async for event in original_stream(tool_use, invocation_state, **kwargs):
                yield event
            return

        # Generate event ID and timestamps
        event_id = str(uuid.uuid4())
        start_time = datetime.now(timezone.utc)
        start_timestamp = int(start_time.timestamp() * 1000)

        # Prepare input (truncated)
        import json
        try:
            input_data = tool_use.get('input', {}) if isinstance(tool_use, dict) else {}
            input_str = json.dumps(input_data)
            if len(input_str) > 200:
                input_str = input_str[:197] + '...'
        except Exception:
            input_str = '{}'

        # Write 'started' event
        started_event = {
            'workflow_id': session_id,
            'timestamp': start_timestamp,
            'event_type': 'tool_call',
            'event_id': event_id,
            'agent_name': agent_name,
            'system': 'gateway',
            'operation': tool_name,
            'input': input_str,
            'status': 'started',
        }
        write_tool_event(started_event)
        logger.info('Gateway tool %s started event written for session %s', tool_name, session_id)

        # Track whether we completed successfully or had an error
        error_occurred = None

        try:
            # Stream all events from the original tool
            async for event in original_stream(tool_use, invocation_state, **kwargs):
                yield event
            logger.info('Gateway tool %s stream completed normally', tool_name)

        except GeneratorExit:
            # Generator was closed by consumer - still count as success
            logger.info('Gateway tool %s generator closed by consumer', tool_name)
            raise  # Must re-raise GeneratorExit

        except Exception as e:
            # Capture error for finally block
            error_occurred = e
            logger.error('Gateway tool %s failed with error: %s', tool_name, e)
            raise

        finally:
            # ALWAYS write completion event (success or failure)
            end_time = datetime.now(timezone.utc)
            duration_ms = int((end_time - start_time).total_seconds() * 1000)

            if error_occurred is not None:
                # Truncate error message
                error_msg = str(error_occurred)
                if len(error_msg) > 500:
                    error_msg = error_msg[:497] + '...'

                # Write 'failed' event
                error_event = {
                    'workflow_id': session_id,
                    'timestamp': int(end_time.timestamp() * 1000),
                    'event_type': 'tool_call',
                    'event_id': event_id,
                    'agent_name': agent_name,
                    'system': 'gateway',
                    'operation': tool_name,
                    'status': 'failed',
                    'duration_ms': duration_ms,
                    'error_message': error_msg,
                }
                write_tool_event(error_event)
                logger.info('Gateway tool %s failed event written, duration: %dms', tool_name, duration_ms)
            else:
                # Write 'completed' event
                completed_event = {
                    'workflow_id': session_id,
                    'timestamp': int(end_time.timestamp() * 1000),
                    'event_type': 'tool_call',
                    'event_id': event_id,
                    'agent_name': agent_name,
                    'system': 'gateway',
                    'operation': tool_name,
                    'status': 'completed',
                    'duration_ms': duration_ms,
                }
                write_tool_event(completed_event)
                logger.info('Gateway tool %s completed event written, duration: %dms', tool_name, duration_ms)

    return instrumented_stream


def _instrument_gateway_tools(gateway_tools: list) -> list:
    """
    Instrument MCP Gateway tools by monkey-patching their stream method.

    Strands tools use the stream() async generator method for execution.
    This modifies the original tool objects IN PLACE by replacing their
    stream method with an instrumented version. This preserves the tool's
    type and all other attributes, avoiding Strands registry issues.

    Args:
        gateway_tools: List of MCPAgentTool proxy objects

    Returns:
        Same list (tools are modified in place)
    """
    for tool in gateway_tools:
        tool_name = getattr(tool, 'name', str(tool))
        if hasattr(tool, 'stream'):
            # Monkey-patch the stream method with instrumented version
            original_stream = tool.stream
            tool.stream = _create_instrumented_stream(original_stream, tool_name)
            logger.debug('Instrumented Gateway tool: %s', tool_name)
        else:
            logger.warning('Gateway tool %s has no stream method, skipping instrumentation', tool_name)

    return gateway_tools


def invoke_with_gateway(
    prompt: str,
    local_tools: list,
    system_prompt: str,
    model_id: str | None = None,
) -> str:
    """
    Execute agent with proper MCP Gateway session lifecycle.

    This function handles:
    - Gateway config discovery from SSM Parameter Store
    - OAuth token management for Gateway authentication
    - MCP client lifecycle (session kept alive during agent execution)
    - Tool discovery from Gateway
    - Agent creation and invocation
    - Graceful degradation when Gateway unavailable
    - Gateway tool instrumentation for observability

    CRITICAL: This function keeps the MCP client session open during the
    entire agent execution. Do NOT call MCPClient directly in agent code -
    the session must stay open while tools are being executed.

    Args:
        prompt: User prompt to send to agent
        local_tools: List of local tool functions (decorated with @tool)
        system_prompt: System prompt for agent behavior
        model_id: Bedrock model ID (defaults to AGENT_MODEL_ID env var)

    Returns:
        Agent response message as string

    Raises:
        ValueError: If prompt is empty
        RuntimeError: If agent execution fails completely

    Example:
        >>> from agents.shared.gateway_client import invoke_with_gateway
        >>> from .prompts import SYSTEM_PROMPT
        >>> from .tools import extract_user_id
        >>>
        >>> def invoke_analyzer_agent(prompt: str) -> str:
        ...     return invoke_with_gateway(
        ...         prompt=prompt,
        ...         local_tools=[extract_user_id],
        ...         system_prompt=SYSTEM_PROMPT
        ...     )
    """
    # Input validation
    if not prompt or not prompt.strip():
        raise ValueError('Prompt cannot be empty')

    # Get model ID from environment
    model_id = model_id or os.environ.get('AGENT_MODEL_ID')

    # Create model
    if model_id:
        model = BedrockModel(model_id=model_id)
        logger.debug('Created BedrockModel with ID: %s', model_id)
    else:
        model = BedrockModel()
        logger.debug('Created BedrockModel with default configuration')

    # Get Gateway URL from SSM config
    gateway_config = _get_gateway_config_from_ssm()
    gateway_url = gateway_config.get('url') if gateway_config else None

    # Case 1: No Gateway - local tools only
    if not gateway_url:
        logger.info('No Gateway URL configured, using local tools only')
        agent = Agent(model=model, system_prompt=system_prompt, tools=local_tools)
        result = agent(prompt)
        return result.message

    # Case 2: Gateway configured - manage MCP session lifecycle
    logger.info('Connecting to Gateway at %s', gateway_url)

    token_manager = GatewayTokenManager()

    if token_manager.is_configured():
        # Create authenticated transport factory
        # The lambda captures gateway_url from outer scope
        def create_authenticated_transport():
            token = token_manager.get_token()
            logger.debug('Using authenticated transport with OAuth token')
            return streamablehttp_client(
                gateway_url,
                headers={'Authorization': f'Bearer {token}'}
            )

        client = MCPClient(create_authenticated_transport)
        logger.info('Gateway OAuth credentials configured, using authenticated connection')
    else:
        # Fallback to unauthenticated (will likely get 401)
        logger.warning('Gateway OAuth credentials not configured, attempting unauthenticated connection')
        client = MCPClient(lambda: streamablehttp_client(gateway_url))

    try:
        # CRITICAL: Keep session open during entire agent execution
        # Tools are proxy objects that reference this session
        with client:
            gateway_tools = client.list_tools_sync()
            logger.info('Loaded %d tools from Gateway', len(gateway_tools))

            # Instrument Gateway tools to emit events to DynamoDB
            gateway_tools = _instrument_gateway_tools(gateway_tools)
            logger.debug('Instrumented %d Gateway tools for observability', len(gateway_tools))

            all_tools = local_tools + gateway_tools
            logger.info('Created agent with %d total tools', len(all_tools))

            agent = Agent(model=model, system_prompt=system_prompt, tools=all_tools)

            # Tool calls happen HERE with session OPEN
            result = agent(prompt)

            # Session still OPEN when we access result
            return result.message

        # Session closes AFTER agent completes and we've extracted the message

    except Exception as e:
        logger.warning('Gateway failed: %s. Falling back to local tools.', e)
        # Graceful degradation - try with local tools only
        agent = Agent(model=model, system_prompt=system_prompt, tools=local_tools)
        result = agent(prompt)
        return result.message
