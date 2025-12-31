#!/usr/bin/env python3
"""
AgentCore Gateway Cleanup Script.

This script removes an AgentCore MCP Gateway and all its resources:
1. Loads gateway configuration from gateway_config.json
2. Deletes all Gateway targets
3. Deletes the Gateway itself
4. Cleans up Cognito resources (User Pool, domain, client)
5. Removes gateway_config.json

Usage:
    python gateway/cleanup_gateway.py
    python gateway/cleanup_gateway.py --force  # Skip confirmation
"""

import argparse
import json
import os
import sys
from pathlib import Path


def get_project_root() -> Path:
    """Get the project root directory."""
    return Path(__file__).parent.parent


def load_gateway_config(project_root: Path) -> dict | None:
    """Load gateway configuration."""
    config_file = project_root / "gateway_config.json"

    if not config_file.exists():
        print(f"Error: {config_file} not found.")
        print("No gateway to clean up, or it was already removed.")
        return None

    with open(config_file) as f:
        return json.load(f)


def cleanup_gateway(gateway_id: str, region: str, oauth_config: dict | None = None) -> bool:
    """Delete Gateway and all associated resources including Cognito.

    Uses the SDK's cleanup_gateway method which handles:
    - Deleting all targets
    - Deleting the gateway
    - Cleaning up Cognito resources (User Pool, domain, client, resource server)
    """
    try:
        # Set region before importing
        os.environ["AWS_REGION"] = region
        os.environ["AWS_DEFAULT_REGION"] = region

        from bedrock_agentcore_starter_toolkit.operations.gateway.client import GatewayClient

        client = GatewayClient(region_name=region)

        # Build client_info for Cognito cleanup if we have OAuth config
        client_info = None
        if oauth_config and oauth_config.get("client_id"):
            client_info = {
                "client_id": oauth_config.get("client_id"),
                "client_secret": oauth_config.get("client_secret"),
            }

        print(f"Cleaning up gateway '{gateway_id}' and associated resources...")
        print("  This includes: targets, gateway, and Cognito resources")

        # Use SDK's cleanup_gateway which handles everything
        client.cleanup_gateway(gateway_id=gateway_id, client_info=client_info)

        print("Gateway and all resources cleaned up successfully")
        return True

    except ImportError:
        print("Error: bedrock-agentcore-starter-toolkit not installed")
        return False
    except Exception as e:
        print(f"Error cleaning up gateway: {e}")
        return False


def remove_config_file(project_root: Path) -> None:
    """Remove the gateway configuration file."""
    config_file = project_root / "gateway_config.json"

    if config_file.exists():
        config_file.unlink()
        print(f"Removed {config_file}")


def main():
    parser = argparse.ArgumentParser(description="Clean up AgentCore MCP Gateway")
    parser.add_argument(
        "--force", "-f",
        action="store_true",
        help="Skip confirmation prompt",
    )
    parser.add_argument(
        "--region",
        help="AWS region (default: from config or us-east-1)",
    )
    args = parser.parse_args()

    project_root = get_project_root()

    # Load gateway config
    config = load_gateway_config(project_root)
    if not config:
        sys.exit(1)

    gateway_id = config.get("gateway_id", "")
    gateway_name = config.get("gateway_name", "")
    region = args.region or config.get("region", "us-east-1")
    targets = config.get("targets", [])
    oauth_config = config.get("oauth", {})

    # Set region env vars
    os.environ["AWS_REGION"] = region
    os.environ["AWS_DEFAULT_REGION"] = region

    print(f"{'='*50}")
    print("AgentCore Gateway Cleanup")
    print(f"{'='*50}")
    print(f"Gateway: {gateway_name} ({gateway_id})")
    print(f"Region:  {region}")
    print(f"Targets: {len(targets)}")
    if oauth_config.get("client_id"):
        print(f"Cognito: Will be cleaned up")

    if targets:
        print("\nTargets to delete:")
        for target in targets:
            print(f"  - {target}")

    # Confirmation prompt
    if not args.force:
        print(f"\nThis will delete the gateway, all targets, and Cognito resources.")
        response = input("Are you sure you want to continue? [y/N] ")
        if response.lower() != "y":
            print("Aborted.")
            sys.exit(0)

    print()

    # Use SDK cleanup which handles everything
    success = cleanup_gateway(gateway_id, region, oauth_config)

    if success:
        # Remove config file
        remove_config_file(project_root)

        print(f"\n{'='*50}")
        print("Gateway Cleanup Complete!")
        print(f"{'='*50}")
    else:
        print(f"\n{'='*50}")
        print("Gateway Cleanup Failed")
        print(f"{'='*50}")
        print("You may need to manually delete resources in the AWS Console:")
        print("  - Bedrock AgentCore Gateway")
        print("  - Cognito User Pool")
        sys.exit(1)


if __name__ == "__main__":
    main()
