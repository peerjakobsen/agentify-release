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

## Environment Variables

- `GATEWAY_URL`: MCP Gateway endpoint URL
- `GATEWAY_CLIENT_ID`: Cognito OAuth client ID
- `GATEWAY_CLIENT_SECRET`: Cognito OAuth client secret
- `GATEWAY_TOKEN_ENDPOINT`: Cognito token endpoint URL
- `GATEWAY_SCOPE`: OAuth scope for Gateway access
- `AGENT_MODEL_ID`: Bedrock model ID (optional)

These are automatically set by setup.sh when deploying agents if a
Gateway has been configured for the project.

## Why This Module Exists

MCP tools returned by `list_tools_sync()` are proxy objects that maintain
a reference to the MCP client session. If the session closes before the
agent executes tools, you get "client session is not running" errors.

This module keeps the MCP session open during the entire agent execution,
ensuring Gateway tools work correctly.
"""

import logging
import os
from datetime import datetime, timedelta

import httpx
from mcp.client.streamable_http import streamablehttp_client
from strands import Agent
from strands.models.bedrock import BedrockModel
from strands.tools.mcp import MCPClient

logger = logging.getLogger(__name__)


class GatewayTokenManager:
    """
    Manages OAuth tokens for MCP Gateway authentication.

    This class handles the OAuth2 client credentials flow with Cognito,
    caching tokens and automatically refreshing them before expiry.

    The token manager uses a 5-minute buffer before token expiry to ensure
    tokens are refreshed proactively, avoiding authentication failures
    during tool invocations.

    Attributes:
        client_id: Cognito OAuth client ID
        client_secret: Cognito OAuth client secret
        token_endpoint: Cognito token endpoint URL
        scope: OAuth scope for Gateway access
    """

    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        token_endpoint: str | None = None,
        scope: str | None = None,
    ):
        """
        Initialize the token manager.

        Credentials can be passed directly or read from environment variables.
        Environment variables are used as fallbacks when parameters are None.

        Args:
            client_id: Cognito OAuth client ID (or GATEWAY_CLIENT_ID env var)
            client_secret: Cognito OAuth client secret (or GATEWAY_CLIENT_SECRET env var)
            token_endpoint: Cognito token endpoint URL (or GATEWAY_TOKEN_ENDPOINT env var)
            scope: OAuth scope for Gateway access (or GATEWAY_SCOPE env var)
        """
        self.client_id = client_id or os.environ.get('GATEWAY_CLIENT_ID')
        self.client_secret = client_secret or os.environ.get('GATEWAY_CLIENT_SECRET')
        self.token_endpoint = token_endpoint or os.environ.get('GATEWAY_TOKEN_ENDPOINT')
        self.scope = scope or os.environ.get('GATEWAY_SCOPE')
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


def invoke_with_gateway(
    prompt: str,
    local_tools: list,
    system_prompt: str,
    model_id: str | None = None,
    gateway_url: str | None = None,
) -> str:
    """
    Execute agent with proper MCP Gateway session lifecycle.

    This function handles:
    - OAuth token management for Gateway authentication
    - MCP client lifecycle (session kept alive during agent execution)
    - Tool discovery from Gateway
    - Agent creation and invocation
    - Graceful degradation when Gateway unavailable

    CRITICAL: This function keeps the MCP client session open during the
    entire agent execution. Do NOT call MCPClient directly in agent code -
    the session must stay open while tools are being executed.

    Args:
        prompt: User prompt to send to agent
        local_tools: List of local tool functions (decorated with @tool)
        system_prompt: System prompt for agent behavior
        model_id: Bedrock model ID (defaults to AGENT_MODEL_ID env var)
        gateway_url: Gateway URL (defaults to GATEWAY_URL env var)

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

    # Environment fallbacks
    gateway_url = gateway_url or os.environ.get('GATEWAY_URL')
    model_id = model_id or os.environ.get('AGENT_MODEL_ID')

    # Create model
    if model_id:
        model = BedrockModel(model_id=model_id)
        logger.debug('Created BedrockModel with ID: %s', model_id)
    else:
        model = BedrockModel()
        logger.debug('Created BedrockModel with default configuration')

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
