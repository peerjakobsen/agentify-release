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
import ast
import json
import os
import re
import subprocess
import sys
from pathlib import Path

# ANSI color codes for terminal output
RED = '\033[0;31m'
NC = '\033[0m'  # No Color

# AgentCore MCP Gateway only supports a limited subset of JSON Schema
SUPPORTED_SCHEMA_PROPS = {'type', 'properties', 'required', 'items', 'description'}
UNSUPPORTED_PROPS = {
    'additionalProperties', 'enum', 'format', 'minLength', 'maxLength',
    'minimum', 'maximum', 'pattern', 'minItems', 'maxItems', 'errorSchema',
    'oneOf', 'anyOf', 'allOf', 'not', 'const', 'default', 'examples',
    'title', '$ref', '$schema', 'definitions', '$defs'
}


def find_unsupported_props(obj: any, path: str = '') -> list[tuple[str, str, any]]:
    """Recursively find unsupported JSON Schema properties.

    Returns:
        List of tuples: (path, property_name, value)
    """
    issues = []
    if isinstance(obj, dict):
        for key, value in obj.items():
            current_path = f"{path}.{key}" if path else key
            if key in UNSUPPORTED_PROPS:
                # Truncate long values for readability
                display_value = value
                if isinstance(value, (dict, list)) and len(str(value)) > 50:
                    display_value = f"<{type(value).__name__}>"
                issues.append((current_path, key, display_value))
            issues.extend(find_unsupported_props(value, current_path))
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            issues.extend(find_unsupported_props(item, f"{path}[{i}]"))
    return issues


def validate_schemas(schemas: dict[str, dict]) -> bool:
    """Validate schemas for AgentCore compatibility.

    If issues found, prints a Kiro-ready prompt for fixing them.

    Returns:
        True if all schemas are valid, False otherwise
    """
    all_issues = {}
    for tool_name, schema in schemas.items():
        issues = find_unsupported_props(schema)
        if issues:
            all_issues[tool_name] = issues

    if not all_issues:
        return True

    # Print error header
    print("\n" + "=" * 60)
    print("ERROR: Schemas contain unsupported AgentCore properties")
    print("=" * 60)
    print("\nAgentCore MCP Gateway ONLY supports these JSON Schema properties:")
    print("  type, properties, required, items, description")
    print("\nCopy this prompt to Kiro to fix the schemas:")
    print("-" * 60)

    # Print Kiro-ready prompt (in red for visibility)
    print(RED, end='')  # Start red text
    print("""Fix the following gateway schemas for AgentCore MCP Gateway compatibility.

AgentCore MCP Gateway ONLY supports these JSON Schema properties:
- type
- properties
- required
- items
- description

Remove unsupported properties and move their semantic info into descriptions:
""")

    for tool_name, issues in all_issues.items():
        print(f"\n**cdk/gateway/schemas/{tool_name.replace('-', '_')}.json:**")
        for path, prop, value in issues:
            print(f"  - `{path}`: remove `{prop}` (value: {value})")

    print("""
Example conversions:

BEFORE: "status": {"type": "string", "enum": ["active", "inactive"]}
AFTER:  "status": {"type": "string", "description": "Status. One of: active, inactive"}

BEFORE: "email": {"type": "string", "format": "email"}
AFTER:  "email": {"type": "string", "description": "Email address (email format)"}

BEFORE: "inputSchema": {"type": "object", "properties": {...}, "additionalProperties": false}
AFTER:  "inputSchema": {"type": "object", "properties": {...}}

BEFORE: Top-level "errorSchema": {...}
AFTER:  Remove errorSchema entirely (not supported by AgentCore)
""")
    print(NC, end='')  # End red text
    print("-" * 60)
    print("\nFix the schemas and re-run ./scripts/setup.sh")

    return False


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
                    # Convert PascalCase to kebab-case (Gateway API requirement)
                    kebab_name = ""
                    for i, char in enumerate(tool_name):
                        if char.isupper() and i > 0:
                            kebab_name += "-"
                        kebab_name += char.lower()
                    lambda_arns[kebab_name] = value

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
        # Convert snake_case filename to kebab-case (to match Lambda ARN keys)
        tool_name = schema_file.stem.replace("_", "-")
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


def find_existing_gateway(name: str, region: str) -> dict | None:
    """Check if a gateway with the given name already exists.

    Returns:
        Gateway info dict if found, None otherwise
    """
    try:
        from bedrock_agentcore_starter_toolkit.operations.gateway.client import GatewayClient

        client = GatewayClient(region_name=region)

        # List all gateways and find by name
        response = client.list_gateways()
        gateways = response.get("items", [])

        for gw in gateways:
            if gw.get("name") == name:
                gateway_id = gw.get("gatewayId", "")
                # Get full gateway details
                details = client.get_gateway(gateway_identifier=gateway_id)
                gateway = details.get("gateway", {})
                return {
                    "gatewayArn": gateway.get("gatewayArn", ""),
                    "gatewayId": gateway.get("gatewayId", ""),
                    "gatewayUrl": gateway.get("gatewayUrl", ""),
                    "roleArn": gateway.get("roleArn", ""),
                    "name": gateway.get("name", name),
                    "status": gateway.get("status", ""),
                }
        return None
    except Exception:
        return None


def create_gateway(name: str, region: str) -> dict | None:
    """Create an MCP Gateway using the Python SDK, or return existing one.

    Returns:
        Gateway info dict or None on failure
    """
    try:
        import os

        # Set region BEFORE importing SDK (boto3 caches region at import time)
        os.environ["AWS_REGION"] = region
        os.environ["AWS_DEFAULT_REGION"] = region

        from bedrock_agentcore_starter_toolkit.operations.gateway.client import GatewayClient

        # Check if gateway already exists
        print(f"Checking for existing gateway '{name}'...")
        existing = find_existing_gateway(name, region)
        if existing:
            print(f"Gateway '{name}' already exists, reusing it")
            print(f"  Gateway ARN: {existing['gatewayArn']}")
            print(f"  Gateway URL: {existing['gatewayUrl']}")
            print(f"  Role ARN:    {existing['roleArn']}")
            print(f"  Status:      {existing['status']}")
            return existing

        print(f"Creating MCP Gateway '{name}' in {region}...")
        client = GatewayClient(region_name=region)

        # Create the gateway
        response = client.create_mcp_gateway(name=name)
        print("Gateway created successfully")

        # Extract the relevant fields from response
        gateway_info = {
            "gatewayArn": response.get("gatewayArn", ""),
            "gatewayId": response.get("gatewayId", ""),
            "gatewayUrl": response.get("gatewayUrl", ""),
            "roleArn": response.get("roleArn", ""),
            "name": response.get("name", name),
            "status": response.get("status", ""),
        }

        print(f"  Gateway ARN: {gateway_info['gatewayArn']}")
        print(f"  Gateway URL: {gateway_info['gatewayUrl']}")
        print(f"  Role ARN:    {gateway_info['roleArn']}")
        print(f"  Status:      {gateway_info['status']}")

        return gateway_info

    except ImportError:
        print("Error: bedrock-agentcore-starter-toolkit not installed")
        return None
    except Exception as e:
        print(f"Error creating gateway: {e}")
        return None


def find_existing_target(gateway_id: str, target_name: str, region: str) -> dict | None:
    """Check if a target with the given name already exists.

    Returns:
        Target info dict if found, None otherwise
    """
    try:
        from bedrock_agentcore_starter_toolkit.operations.gateway.client import GatewayClient

        client = GatewayClient(region_name=region)
        response = client.list_gateway_targets(gateway_identifier=gateway_id)
        targets = response.get("items", [])

        for target in targets:
            if target.get("name") == target_name:
                return target
        return None
    except Exception:
        return None


def create_lambda_target(
    gateway_arn: str,
    gateway_url: str,
    gateway_id: str,
    role_arn: str,
    target_name: str,
    lambda_arn: str,
    tool_schema: dict,
    region: str,
) -> bool:
    """Create or update a Lambda target for the gateway."""
    try:
        import os
        import boto3

        # Set region BEFORE importing SDK (boto3 caches region at import time)
        os.environ["AWS_REGION"] = region
        os.environ["AWS_DEFAULT_REGION"] = region

        from bedrock_agentcore_starter_toolkit.operations.gateway.client import GatewayClient

        # Check if target already exists
        existing = find_existing_target(gateway_id, target_name, region)
        if existing:
            # UPDATE existing target (handles bug fixes and schema changes)
            print(f"Updating Lambda target '{target_name}'...")
            boto_client = boto3.client("bedrock-agentcore-control", region_name=region)
            boto_client.update_gateway_target(
                gatewayIdentifier=gateway_id,
                targetId=existing["targetId"],
                name=target_name,
                targetConfiguration={
                    "mcp": {
                        "lambda": {
                            "lambdaArn": lambda_arn,
                            "toolSchema": {"inlinePayload": [tool_schema]}
                        }
                    }
                },
                credentialProviderConfigurations=[
                    {"credentialProviderType": "GATEWAY_IAM_ROLE"}
                ]
            )
            print(f"  Target '{target_name}' updated (ID: {existing['targetId']})")
            return True

        # CREATE new target
        print(f"Creating Lambda target '{target_name}'...")
        client = GatewayClient(region_name=region)

        gateway = {
            "gatewayArn": gateway_arn,
            "gatewayUrl": gateway_url,
            "gatewayId": gateway_id,
            "roleArn": role_arn,
        }

        target_payload = {
            "lambdaArn": lambda_arn,
            "toolSchema": {
                "inlinePayload": [tool_schema]
            },
        }

        response = client.create_mcp_gateway_target(
            gateway=gateway,
            name=target_name,
            target_type="lambda",
            target_payload=target_payload,
        )

        print(f"  Target '{target_name}' created successfully")
        print(f"  Target ID: {response.get('targetId', 'N/A')}")
        return True

    except ImportError:
        print("Error: bedrock-agentcore-starter-toolkit not installed")
        return False
    except Exception as e:
        print(f"Error creating/updating target {target_name}: {e}")
        return False


def get_oauth_credentials(gateway_id: str, region: str) -> dict:
    """Extract OAuth credentials from gateway for agent authentication.

    Returns:
        Dict with client_id, client_secret, token_endpoint, scope
    """
    try:
        import boto3
        from bedrock_agentcore_starter_toolkit.operations.gateway.client import GatewayClient

        client = GatewayClient(region_name=region)
        gateway_info = client.get_gateway(gateway_identifier=gateway_id)
        gateway = gateway_info.get("gateway", {})

        auth_config = gateway.get("authorizerConfiguration", {}).get("customJWTAuthorizer", {})
        discovery_url = auth_config.get("discoveryUrl", "")
        allowed_clients = auth_config.get("allowedClients", [])

        if not discovery_url or not allowed_clients:
            print("Warning: Could not extract OAuth config from gateway")
            return {}

        # Parse user pool ID from discovery URL
        user_pool_id = discovery_url.split("/")[3]
        client_id = allowed_clients[0]

        # Get client secret from Cognito
        cognito = boto3.client("cognito-idp", region_name=region)
        client_info = cognito.describe_user_pool_client(
            UserPoolId=user_pool_id, ClientId=client_id
        )
        client_secret = client_info["UserPoolClient"].get("ClientSecret", "")

        # Get Cognito domain for token endpoint
        domain_response = cognito.describe_user_pool(UserPoolId=user_pool_id)
        domain = domain_response["UserPool"].get("Domain", "")
        token_endpoint = f"https://{domain}.auth.{region}.amazoncognito.com/oauth2/token"

        # Get scope from resource server
        rs_response = cognito.list_resource_servers(UserPoolId=user_pool_id, MaxResults=10)
        scope = ""
        for rs in rs_response.get("ResourceServers", []):
            for s in rs.get("Scopes", []):
                scope = f"{rs['Identifier']}/{s['ScopeName']}"
                break

        return {
            "client_id": client_id,
            "client_secret": client_secret,
            "token_endpoint": token_endpoint,
            "scope": scope,
        }
    except Exception as e:
        print(f"Warning: Could not extract OAuth credentials: {e}")
        return {}


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

    # Set region env vars immediately after parsing args (before any SDK imports)
    os.environ["AWS_REGION"] = args.region
    os.environ["AWS_DEFAULT_REGION"] = args.region

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

    # Validate schemas for AgentCore compatibility
    if not validate_schemas(schemas):
        sys.exit(1)

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
    gateway_id = gateway_info.get("gatewayId", "")
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
                gateway_id=gateway_id,
                role_arn=role_arn,
                target_name=tool_name,
                lambda_arn=lambda_arn,
                tool_schema=schemas[tool_name],
                region=args.region,
            )
            if success:
                targets_created.append(tool_name)
        else:
            print(f"Skipping {tool_name}: no schema found")

    # Extract OAuth credentials for agent authentication
    print("\nExtracting OAuth credentials...")
    oauth_creds = get_oauth_credentials(gateway_id, args.region)

    # Save configuration
    config = {
        "gateway_name": gateway_name,
        "gateway_arn": gateway_arn,
        "gateway_url": gateway_url,
        "gateway_id": gateway_id,
        "role_arn": role_arn,
        "region": args.region,
        "targets": targets_created,
        "oauth": oauth_creds,
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
