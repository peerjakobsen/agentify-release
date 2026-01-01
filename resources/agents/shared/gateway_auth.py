"""
OAuth token manager for MCP Gateway authentication.

This module provides the GatewayTokenManager class for handling OAuth2 client
credentials flow with Amazon Cognito. It manages token acquisition and refresh
for authenticating with AgentCore MCP Gateway endpoints.

The token manager reads credentials from environment variables set during
agent deployment (GATEWAY_CLIENT_ID, GATEWAY_CLIENT_SECRET, etc.) and
handles automatic token refresh with a 5-minute buffer before expiry.

## Usage

```python
from agents.shared.gateway_auth import GatewayTokenManager
from mcp.client.streamable_http import streamablehttp_client
from strands.tools.mcp import MCPClient

# Initialize token manager (reads credentials from env vars)
token_manager = GatewayTokenManager()

if token_manager.is_configured():
    def create_authenticated_transport():
        token = token_manager.get_token()
        return streamablehttp_client(
            gateway_url,
            headers={"Authorization": f"Bearer {token}"}
        )
    gateway_client = MCPClient(create_authenticated_transport)
```

## Environment Variables

- `GATEWAY_CLIENT_ID`: Cognito OAuth client ID
- `GATEWAY_CLIENT_SECRET`: Cognito OAuth client secret
- `GATEWAY_TOKEN_ENDPOINT`: Cognito token endpoint URL
- `GATEWAY_SCOPE`: OAuth scope for Gateway access

These are automatically set by setup.sh when deploying agents if a
Gateway has been configured for the project.
"""

import logging
import os
from datetime import datetime, timedelta

import httpx

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
