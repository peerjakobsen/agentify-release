"""
Shared utilities for Agentify agents.

This module provides common utilities used across all agents in the project,
including authentication helpers for the MCP Gateway.
"""

from .gateway_auth import GatewayTokenManager

__all__ = ['GatewayTokenManager']
