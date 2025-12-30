#!/usr/bin/env python3
"""
AWS CDK application entry point for Agentify Infrastructure.

This module initializes the CDK app and instantiates the infrastructure stacks
for Agentify demo environments. It deploys:
  - VPC with private subnets and VPC endpoints (for AgentCore Runtime)
  - DynamoDB table for workflow event streaming (for Demo Viewer panel)

Usage:
    cdk synth -c region=us-east-1
    cdk deploy -c region=us-west-2 --all
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
from config import validate_region
from stacks.networking import NetworkingStack
from stacks.observability import ObservabilityStack

# Default region if none specified via context
DEFAULT_REGION = "us-east-1"


def main() -> None:
    """Initialize and synthesize the CDK application."""
    app = cdk.App()

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
        f"Agentify-Networking-{region}",
        env=env,
        description="VPC and networking infrastructure for Agentify demos",
    )

    # Create observability stack (DynamoDB for Demo Viewer)
    ObservabilityStack(
        app,
        f"Agentify-Observability-{region}",
        env=env,
        networking_stack=networking_stack,
        description="Observability infrastructure for Agentify Demo Viewer",
    )

    # Synthesize the CloudFormation templates
    app.synth()


if __name__ == "__main__":
    main()
