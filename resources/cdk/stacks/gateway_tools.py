"""
Gateway Tools stack for Agentify Infrastructure.

This module defines Lambda functions for AgentCore Gateway tools.
It dynamically discovers handlers from the cdk/gateway/handlers/ directory
and creates Lambda functions for each one.

Each Lambda function:
- Uses Python 3.11 runtime
- Is granted invoke permissions for Bedrock AgentCore
- Has its ARN exported for Gateway registration
"""

import os
from pathlib import Path
from typing import Any

from aws_cdk import CfnOutput, Duration, Stack
from aws_cdk import aws_iam as iam
from aws_cdk import aws_lambda as lambda_
import config
from constructs import Construct


def to_pascal_case(snake_str: str) -> str:
    """Convert snake_case to PascalCase."""
    return "".join(word.capitalize() for word in snake_str.split("_"))


class GatewayToolsStack(Stack):
    """
    Gateway Tools infrastructure stack for Agentify.

    Dynamically discovers Lambda handlers from cdk/gateway/handlers/ and deploys
    each as a Lambda function with AgentCore invoke permissions.

    Key features:
    - Auto-discovery of handler directories
    - Python 3.11 runtime
    - AgentCore Gateway invoke permissions
    - ARN exports for Gateway registration
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        **kwargs: Any,
    ) -> None:
        """
        Initialize the gateway tools stack.

        Args:
            scope: The CDK construct scope
            construct_id: The unique identifier for this stack
            **kwargs: Additional stack properties (env, description, etc.)
        """
        super().__init__(scope, construct_id, **kwargs)

        # Store created Lambda functions for reference
        self.lambda_functions: dict[str, lambda_.Function] = {}

        # Discover and create Lambda functions
        self._create_lambda_functions()

        # Export Lambda ARNs
        self._create_outputs()

    def _get_handlers_directory(self) -> Path:
        """Get the gateway/handlers directory path.

        The handlers directory is located at cdk/gateway/handlers/
        relative to the CDK stacks directory.
        """
        # gateway/ is inside cdk/, so go up one level from stacks/ to cdk/
        cdk_dir = Path(__file__).parent.parent
        return cdk_dir / "gateway" / "handlers"

    def _discover_handlers(self) -> list[str]:
        """Discover handler directories in gateway/handlers/.

        Returns:
            List of handler directory names (tool names)
        """
        handlers_dir = self._get_handlers_directory()

        if not handlers_dir.exists():
            print(f"[GatewayTools] Handlers directory not found: {handlers_dir}")
            return []

        handlers = [
            entry.name
            for entry in handlers_dir.iterdir()
            if entry.is_dir() and not entry.name.startswith(".")
        ]

        print(f"[GatewayTools] Discovered {len(handlers)} handlers: {handlers}")
        return handlers

    def _create_lambda_functions(self) -> None:
        """Create Lambda functions for each discovered handler."""
        handlers = self._discover_handlers()
        handlers_dir = self._get_handlers_directory()

        for tool_name in handlers:
            handler_path = handlers_dir / tool_name

            # Verify handler.py exists
            if not (handler_path / "handler.py").exists():
                print(f"[GatewayTools] Skipping {tool_name}: no handler.py found")
                continue

            pascal_name = to_pascal_case(tool_name)

            # Create Lambda function
            fn = lambda_.Function(
                self,
                f"{pascal_name}Lambda",
                function_name=f"{config.PROJECT_NAME}-gateway-{tool_name}",
                runtime=lambda_.Runtime.PYTHON_3_11,
                handler="handler.lambda_handler",
                code=lambda_.Code.from_asset(str(handler_path)),
                timeout=Duration.seconds(30),
                memory_size=256,
                description=f"AgentCore Gateway tool: {tool_name}",
            )

            # Grant AgentCore Gateway invoke permission
            fn.add_permission(
                "BedrockAgentCoreInvoke",
                principal=iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
                action="lambda:InvokeFunction",
            )

            self.lambda_functions[tool_name] = fn
            print(f"[GatewayTools] Created Lambda for {tool_name}")

    def _create_outputs(self) -> None:
        """Create CloudFormation outputs for Lambda ARNs."""
        for tool_name, fn in self.lambda_functions.items():
            pascal_name = to_pascal_case(tool_name)

            CfnOutput(
                self,
                f"{pascal_name}LambdaArn",
                value=fn.function_arn,
                export_name=f"{config.PROJECT_NAME}-Gateway-{pascal_name}LambdaArn",
                description=f"Lambda ARN for {tool_name} gateway tool",
            )

            CfnOutput(
                self,
                f"{pascal_name}LambdaName",
                value=fn.function_name,
                export_name=f"{config.PROJECT_NAME}-Gateway-{pascal_name}LambdaName",
                description=f"Lambda name for {tool_name} gateway tool",
            )
