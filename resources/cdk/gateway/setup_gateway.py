#!/usr/bin/env python3
"""
AgentCore Gateway Setup Script.

This script sets up an AgentCore MCP Gateway for Agentify projects:
1. Reads Lambda ARNs from CDK outputs
2. Creates an MCP Gateway with Cognito OAuth
3. Registers each Lambda as a Gateway target
4. Saves gateway configuration for later use

Prerequisites:
- CDK deployed with `./scripts/setup.sh`
- `cdk-outputs.json` exists in project root
- Gateway schemas in `gateway/schemas/`
- AgentCore Starter Toolkit installed: `pip install bedrock-agentcore-starter-toolkit`

Usage:
    python gateway/setup_gateway.py
    python gateway/setup_gateway.py --region us-west-2
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


def get_project_root() -> Path:
    """Get the project root directory."""
    return Path(__file__).parent.parent


def load_cdk_outputs(project_root: Path) -> dict:
    """Load Lambda ARNs from CDK outputs."""
    outputs_file = project_root / "cdk-outputs.json"

    if not outputs_file.exists():
        print(f"Error: {outputs_file} not found.")
        print("Run `./scripts/setup.sh` first to deploy CDK infrastructure.")
        sys.exit(1)

    with open(outputs_file) as f:
        return json.load(f)


def extract_lambda_arns(cdk_outputs: dict) -> dict[str, str]:
    """Extract Lambda ARNs from CDK outputs.

    Returns:
        Dict mapping tool names to Lambda ARNs
    """
    lambda_arns = {}

    for stack_name, outputs in cdk_outputs.items():
        if "GatewayTools" in stack_name:
            for key, value in outputs.items():
                if key.endswith("LambdaArn"):
                    # Extract tool name from key (e.g., "GetInventoryLambdaArn" -> "get_inventory")
                    tool_name = key.replace("LambdaArn", "")
                    # Convert PascalCase to snake_case
                    snake_name = ""
                    for i, char in enumerate(tool_name):
                        if char.isupper() and i > 0:
                            snake_name += "_"
                        snake_name += char.lower()
                    lambda_arns[snake_name] = value

    return lambda_arns


def get_gateway_schemas(project_root: Path) -> dict[str, dict]:
    """Load gateway schemas from gateway/schemas/ directory.

    Returns:
        Dict mapping tool names to their schema definitions
    """
    schemas_dir = project_root / "gateway" / "schemas"
    schemas = {}

    if not schemas_dir.exists():
        print(f"Warning: {schemas_dir} not found. No schemas to register.")
        return schemas

    for schema_file in schemas_dir.glob("*.json"):
        tool_name = schema_file.stem
        with open(schema_file) as f:
            schemas[tool_name] = json.load(f)

    return schemas


def run_agentcore_command(args: list[str]) -> tuple[bool, str]:
    """Run an agentcore CLI command.

    Returns:
        Tuple of (success, output)
    """
    try:
        result = subprocess.run(
            ["agentcore"] + args,
            capture_output=True,
            text=True,
            check=True,
        )
        return True, result.stdout
    except subprocess.CalledProcessError as e:
        return False, e.stderr or e.stdout
    except FileNotFoundError:
        return False, "agentcore CLI not found. Install with: pip install bedrock-agentcore-starter-toolkit"


def create_gateway(name: str, region: str) -> dict | None:
    """Create an MCP Gateway.

    Returns:
        Gateway info dict or None on failure
    """
    print(f"Creating MCP Gateway '{name}' in {region}...")

    success, output = run_agentcore_command([
        "gateway", "create-mcp-gateway",
        "--name", name,
        "--region", region,
    ])

    if not success:
        print(f"Error creating gateway: {output}")
        return None

    # Parse the output to get gateway details
    # The CLI outputs JSON-like info, we need to extract it
    print(f"Gateway created successfully")
    print(output)

    # Get gateway details
    success, output = run_agentcore_command([
        "gateway", "get-mcp-gateway",
        "--name", name,
        "--region", region,
    ])

    if not success:
        print(f"Error getting gateway details: {output}")
        return None

    # Parse gateway info from output
    try:
        # Try to extract JSON from output
        lines = output.strip().split("\n")
        for line in lines:
            if line.strip().startswith("{"):
                return json.loads(line)
    except json.JSONDecodeError:
        pass

    # If we can't parse JSON, return basic info
    return {"name": name, "region": region}


def create_lambda_target(
    gateway_arn: str,
    gateway_url: str,
    role_arn: str,
    target_name: str,
    lambda_arn: str,
    region: str,
) -> bool:
    """Create a Lambda target for the gateway."""
    print(f"Creating Lambda target '{target_name}'...")

    # Build target payload with Lambda ARN
    target_payload = json.dumps({
        "lambdaTarget": {
            "lambdaArn": lambda_arn
        }
    })

    success, output = run_agentcore_command([
        "gateway", "create-mcp-gateway-target",
        "--gateway-arn", gateway_arn,
        "--gateway-url", gateway_url,
        "--role-arn", role_arn,
        "--name", target_name,
        "--target-type", "lambda",
        "--target-payload", target_payload,
        "--region", region,
    ])

    if not success:
        print(f"Error creating target {target_name}: {output}")
        return False

    print(f"Target '{target_name}' created successfully")
    return True


def save_gateway_config(project_root: Path, config: dict) -> None:
    """Save gateway configuration for later use."""
    config_file = project_root / "gateway_config.json"

    with open(config_file, "w") as f:
        json.dump(config, f, indent=2)

    print(f"Gateway configuration saved to {config_file}")


def main():
    parser = argparse.ArgumentParser(description="Set up AgentCore MCP Gateway")
    parser.add_argument(
        "--region",
        default=os.environ.get("AWS_REGION", "us-east-1"),
        help="AWS region (default: us-east-1 or AWS_REGION env var)",
    )
    parser.add_argument(
        "--name",
        help="Gateway name (default: {project_name}-gateway)",
    )
    args = parser.parse_args()

    project_root = get_project_root()

    # Load CDK outputs
    print("Loading CDK outputs...")
    cdk_outputs = load_cdk_outputs(project_root)

    # Extract Lambda ARNs
    lambda_arns = extract_lambda_arns(cdk_outputs)
    if not lambda_arns:
        print("No Lambda functions found in CDK outputs.")
        print("Deploy gateway tools first with `./scripts/setup.sh`")
        sys.exit(1)

    print(f"Found {len(lambda_arns)} Lambda function(s):")
    for name, arn in lambda_arns.items():
        print(f"  - {name}: {arn}")

    # Load schemas
    schemas = get_gateway_schemas(project_root)
    if not schemas:
        print("\nNo schemas found in gateway/schemas/")
        print("Create schema files (e.g., gateway/schemas/get_inventory.json) before running setup.")
        sys.exit(1)

    print(f"\nFound {len(schemas)} schema(s):")
    for name in schemas:
        print(f"  - {name}")

    # Derive gateway name from project folder
    gateway_name = args.name or f"{project_root.name}-gateway"

    # Create gateway
    print(f"\n{'='*50}")
    print("Creating MCP Gateway")
    print(f"{'='*50}")

    gateway_info = create_gateway(gateway_name, args.region)
    if not gateway_info:
        sys.exit(1)

    # Get gateway details for target creation
    gateway_arn = gateway_info.get("gatewayArn", "")
    gateway_url = gateway_info.get("gatewayUrl", "")
    role_arn = gateway_info.get("roleArn", "")

    if not all([gateway_arn, gateway_url, role_arn]):
        print("Warning: Could not extract all gateway details.")
        print("You may need to manually configure targets.")
        print(f"Gateway info: {gateway_info}")

    # Create Lambda targets
    print(f"\n{'='*50}")
    print("Creating Lambda Targets")
    print(f"{'='*50}")

    targets_created = []
    for tool_name, lambda_arn in lambda_arns.items():
        if tool_name in schemas:
            success = create_lambda_target(
                gateway_arn=gateway_arn,
                gateway_url=gateway_url,
                role_arn=role_arn,
                target_name=tool_name,
                lambda_arn=lambda_arn,
                region=args.region,
            )
            if success:
                targets_created.append(tool_name)
        else:
            print(f"Skipping {tool_name}: no schema found")

    # Save configuration
    config = {
        "gateway_name": gateway_name,
        "gateway_arn": gateway_arn,
        "gateway_url": gateway_url,
        "role_arn": role_arn,
        "region": args.region,
        "targets": targets_created,
    }
    save_gateway_config(project_root, config)

    # Summary
    print(f"\n{'='*50}")
    print("Gateway Setup Complete!")
    print(f"{'='*50}")
    print(f"Gateway Name: {gateway_name}")
    print(f"Gateway URL:  {gateway_url}")
    print(f"Region:       {args.region}")
    print(f"Targets:      {len(targets_created)}")
    print(f"\nTo use in your agent, set:")
    print(f"  GATEWAY_URL={gateway_url}")


if __name__ == "__main__":
    main()
