#!/usr/bin/env python3
"""
AWS CDK application entry point for Agentify Infrastructure.

This module initializes the CDK app and instantiates the infrastructure stacks
for Agentify demo environments. It deploys:
  - VPC with private subnets and VPC endpoints (for AgentCore Runtime)
  - DynamoDB table for workflow event streaming (for Demo Viewer panel)
  - Lambda functions for AgentCore Gateway tools (auto-discovered)

Usage:
    cdk synth -c project=my-demo -c region=us-east-1
    cdk deploy -c project=my-demo -c region=us-west-2 --all

Context parameters:
    project: Project identifier derived from workspace folder name (required)
    region: AWS region for deployment (default: us-east-1)

Resource naming:
    Stack names: Agentify-{project}-Networking-{region}
                 Agentify-{project}-Observability-{region}
                 Agentify-{project}-GatewayTools-{region}
    Export names: {project}-VpcId, {project}-PrivateSubnetIds, etc.
    DynamoDB table: {project}-workflow-events
    Lambda functions: {project}-gateway-{tool_name}
"""

import os
from pathlib import Path

import aws_cdk as cdk
from dotenv import load_dotenv

# Load environment variables from .env file (project root)
# override=True ensures .env values take precedence over shell env vars
_project_root = Path(__file__).parent.parent.parent  # Up to project root
if (_project_root / ".env").exists():
    load_dotenv(_project_root / ".env", override=True)

# Map AWS_ACCOUNT_ID to CDK_DEFAULT_ACCOUNT if not already set
if "AWS_ACCOUNT_ID" in os.environ and "CDK_DEFAULT_ACCOUNT" not in os.environ:
    os.environ["CDK_DEFAULT_ACCOUNT"] = os.environ["AWS_ACCOUNT_ID"]

# ruff: noqa: E402 - Imports must be after env var setup
from config import sanitize_project_name, set_project_name, validate_region
from stacks.gateway_tools import GatewayToolsStack
from stacks.networking import NetworkingStack
from stacks.observability import ObservabilityStack

# Default region if none specified via context
DEFAULT_REGION = "us-east-1"

# Default project name if none specified
DEFAULT_PROJECT = "agentify"


def main() -> None:
    """Initialize and synthesize the CDK application."""
    app = cdk.App()

    # Get project name from CDK context (workspace folder name, sanitized)
    project_raw = app.node.try_get_context("project") or DEFAULT_PROJECT
    project = sanitize_project_name(project_raw)
    set_project_name(project)

    # Get region from CDK context, defaulting to us-east-1
    region = app.node.try_get_context("region") or DEFAULT_REGION

    # Validate the region is supported by AgentCore Runtime
    validate_region(region)

    # Create environment configuration
    env = cdk.Environment(
        account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
        region=region,
    )

    # Create networking stack first (foundation for agents)
    networking_stack = NetworkingStack(
        app,
        f"Agentify-{project}-Networking-{region}",
        env=env,
        description=f"VPC and networking infrastructure for {project}",
    )

    # Create observability stack (DynamoDB for Demo Viewer)
    ObservabilityStack(
        app,
        f"Agentify-{project}-Observability-{region}",
        env=env,
        networking_stack=networking_stack,
        description=f"Observability infrastructure for {project}",
    )

    # Create gateway tools stack (Lambda functions for AgentCore Gateway)
    GatewayToolsStack(
        app,
        f"Agentify-{project}-GatewayTools-{region}",
        env=env,
        description=f"Gateway tool Lambda functions for {project}",
    )

    # Synthesize the CloudFormation templates
    app.synth()


if __name__ == "__main__":
    main()
