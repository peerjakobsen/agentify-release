#!/usr/bin/env python3
"""
AgentCore Gateway Cleanup Script.

This script removes an AgentCore MCP Gateway and all its resources:
1. Loads gateway configuration from gateway_config.json
2. Deletes all Gateway targets
3. Deletes the Gateway itself
4. Removes gateway_config.json

Usage:
    python gateway/cleanup_gateway.py
    python gateway/cleanup_gateway.py --force  # Skip confirmation
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


def load_gateway_config(project_root: Path) -> dict | None:
    """Load gateway configuration."""
    config_file = project_root / "gateway_config.json"

    if not config_file.exists():
        print(f"Error: {config_file} not found.")
        print("No gateway to clean up, or it was already removed.")
        return None

    with open(config_file) as f:
        return json.load(f)


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


def delete_gateway_target(gateway_name: str, target_name: str, region: str) -> bool:
    """Delete a Gateway target."""
    print(f"Deleting target '{target_name}'...")

    success, output = run_agentcore_command([
        "gateway", "delete-mcp-gateway-target",
        "--name", gateway_name,
        "--target-name", target_name,
        "--region", region,
    ])

    if not success:
        print(f"Warning: Could not delete target {target_name}: {output}")
        return False

    print(f"Target '{target_name}' deleted")
    return True


def delete_gateway(gateway_name: str, region: str, force: bool = False) -> bool:
    """Delete the Gateway."""
    print(f"Deleting gateway '{gateway_name}'...")

    args = [
        "gateway", "delete-mcp-gateway",
        "--name", gateway_name,
        "--region", region,
    ]

    if force:
        args.append("--force")

    success, output = run_agentcore_command(args)

    if not success:
        print(f"Error deleting gateway: {output}")
        return False

    print(f"Gateway '{gateway_name}' deleted")
    return True


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
        help="Skip confirmation prompt and force delete all targets",
    )
    args = parser.parse_args()

    project_root = get_project_root()

    # Load gateway config
    config = load_gateway_config(project_root)
    if not config:
        sys.exit(1)

    gateway_name = config.get("gateway_name", "")
    region = config.get("region", "us-east-1")
    targets = config.get("targets", [])

    print(f"{'='*50}")
    print("AgentCore Gateway Cleanup")
    print(f"{'='*50}")
    print(f"Gateway: {gateway_name}")
    print(f"Region:  {region}")
    print(f"Targets: {len(targets)}")

    if targets:
        print("\nTargets to delete:")
        for target in targets:
            print(f"  - {target}")

    # Confirmation prompt
    if not args.force:
        print(f"\nThis will delete the gateway and all its targets.")
        response = input("Are you sure you want to continue? [y/N] ")
        if response.lower() != "y":
            print("Aborted.")
            sys.exit(0)

    print()

    # Delete targets first (unless using --force which handles it)
    if not args.force:
        for target_name in targets:
            delete_gateway_target(gateway_name, target_name, region)

    # Delete gateway
    success = delete_gateway(gateway_name, region, force=args.force)

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
        print("You may need to manually delete resources in the AWS Console.")
        sys.exit(1)


if __name__ == "__main__":
    main()
