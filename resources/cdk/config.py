"""
Environment configuration module for Agentify Infrastructure.

This module centralizes environment settings including supported regions,
AgentCore AZ mappings, and helper functions for resource naming.
"""

import logging
from functools import lru_cache

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

logger = logging.getLogger(__name__)

# Supported AWS regions for Agentify deployment
# These are regions where AgentCore Runtime is available
SUPPORTED_REGIONS: list[str] = ["us-east-1", "us-west-2", "eu-west-1"]

# AgentCore Runtime supported Availability Zone IDs by region
# These are AZ IDs (not names) which are consistent across all AWS accounts
# See: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-vpc.html
AGENTCORE_RUNTIME_SUPPORTED_AZ_IDS: dict[str, set[str]] = {
    "us-east-1": {"use1-az1", "use1-az2", "use1-az4"},
    "us-west-2": {"usw2-az1", "usw2-az2", "usw2-az3"},
    "eu-west-1": {"euw1-az1", "euw1-az2", "euw1-az3"},
}

# AgentCore Gateway supported Availability Zone IDs by region
# Gateway VPC endpoint has different AZ support than Runtime
# We need AZs that BOTH Runtime AND Gateway support for full functionality
# Note: use1-az1 is NOT supported by Gateway in us-east-1
AGENTCORE_GATEWAY_SUPPORTED_AZ_IDS: dict[str, set[str]] = {
    "us-east-1": {"use1-az2", "use1-az4", "use1-az6"},  # Gateway doesn't support use1-az1
    "us-west-2": {"usw2-az1", "usw2-az2", "usw2-az3"},
    "eu-west-1": {"euw1-az1", "euw1-az2", "euw1-az3"},
}

# Combined: AZ IDs supported by BOTH Runtime AND Gateway
# This is the intersection - required for agents to use MCP Gateway tools
AGENTCORE_SUPPORTED_AZ_IDS: dict[str, set[str]] = {
    region: AGENTCORE_RUNTIME_SUPPORTED_AZ_IDS[region] & AGENTCORE_GATEWAY_SUPPORTED_AZ_IDS[region]
    for region in AGENTCORE_RUNTIME_SUPPORTED_AZ_IDS
}

# Fallback AZ names for when AWS credentials are unavailable during synthesis
# These prioritize AZ names that commonly map to the intersection AZ IDs
# Note: AZ name-to-ID mapping varies per account, prefer fresh credentials
FALLBACK_AZ_NAMES: dict[str, list[str]] = {
    "us-east-1": ["us-east-1c", "us-east-1d"],  # commonly use1-az2, use1-az4
    "us-west-2": ["us-west-2a", "us-west-2b", "us-west-2c"],
    "eu-west-1": ["eu-west-1a", "eu-west-1b", "eu-west-1c"],
}

# Project name used in resource naming (set via set_project_name() from app.py)
PROJECT_NAME: str = "agentify"

# Default environment for demo deployments
DEFAULT_ENVIRONMENT: str = "demo"


def set_project_name(name: str) -> None:
    """
    Set the project name for resource naming.

    Called from app.py with the sanitized workspace folder name.
    This allows multiple Agentify projects per AWS account.

    Args:
        name: The project identifier (lowercase, alphanumeric with hyphens)
    """
    global PROJECT_NAME
    PROJECT_NAME = name


def sanitize_project_name(name: str) -> str:
    """
    Sanitize a folder name into a valid project identifier.

    Converts to lowercase and replaces invalid characters with hyphens.
    CloudFormation stack names allow alphanumeric and hyphens only.

    Args:
        name: The raw folder name (e.g., "My-Demo_Project")

    Returns:
        Sanitized name suitable for resource naming (e.g., "my-demo-project")
    """
    import re

    # Convert to lowercase
    sanitized = name.lower()
    # Replace underscores and spaces with hyphens
    sanitized = re.sub(r"[_\s]+", "-", sanitized)
    # Remove any character that isn't alphanumeric or hyphen
    sanitized = re.sub(r"[^a-z0-9-]", "", sanitized)
    # Collapse multiple hyphens
    sanitized = re.sub(r"-+", "-", sanitized)
    # Remove leading/trailing hyphens
    sanitized = sanitized.strip("-")
    # Ensure it's not empty
    return sanitized or "agentify"


@lru_cache(maxsize=8)
def get_agentcore_supported_azs(region: str) -> list[str]:
    """
    Get the availability zone names supported by AgentCore Runtime.

    AgentCore Runtime only supports specific AZ IDs in each region.
    AZ IDs (like use1-az1) are consistent across accounts, but AZ names
    (like us-east-1a) differ per account. This function looks up the
    AZ names that map to supported AZ IDs for the current account.

    When AWS credentials are unavailable (e.g., during CI/CD synthesis),
    fallback AZ names are returned to allow synthesis to complete.

    Args:
        region: The AWS region to look up AZs for

    Returns:
        List of AZ names (e.g., ['us-east-1b', 'us-east-1c']) that are
        supported by AgentCore Runtime in this account

    Raises:
        ValueError: If the region is not supported or no supported AZs found
    """
    if region not in AGENTCORE_SUPPORTED_AZ_IDS:
        raise ValueError(
            f"Region {region} is not configured for AgentCore Runtime. "
            f"Supported regions: {list(AGENTCORE_SUPPORTED_AZ_IDS.keys())}"
        )

    supported_az_ids = AGENTCORE_SUPPORTED_AZ_IDS[region]

    try:
        # Query EC2 to get AZ ID to name mapping for this account
        ec2 = boto3.client("ec2", region_name=region)
        response = ec2.describe_availability_zones(
            Filters=[
                {"Name": "region-name", "Values": [region]},
                {"Name": "state", "Values": ["available"]},
            ]
        )

        # Find AZ names that match supported AZ IDs
        supported_az_names = []
        for az in response["AvailabilityZones"]:
            if az["ZoneId"] in supported_az_ids:
                supported_az_names.append(az["ZoneName"])

        if not supported_az_names:
            raise ValueError(
                f"No supported AgentCore Runtime AZs found in {region}. "
                f"Expected AZ IDs: {supported_az_ids}"
            )

        # Return sorted for consistency
        return sorted(supported_az_names)

    except (ClientError, NoCredentialsError) as e:
        # When credentials are unavailable (e.g., during CI/CD synth),
        # use fallback AZ names to allow synthesis to complete
        logger.warning(
            "AWS credentials unavailable for AZ lookup in %s: %s. "
            "Using fallback AZ names for synthesis.",
            region,
            str(e),
        )
        return FALLBACK_AZ_NAMES.get(region, [f"{region}a", f"{region}b"])


def get_resource_name(purpose: str, env: str, region: str) -> str:
    """
    Generate a resource name following the naming convention.

    Args:
        purpose: The purpose/type of the resource (e.g., 'events', 'vpc')
        env: The environment name (e.g., 'demo', 'staging')
        region: The AWS region (e.g., 'us-east-1')

    Returns:
        A formatted resource name following {project}-{purpose}-{env}-{region}
    """
    return f"{PROJECT_NAME}-{purpose}-{env}-{region}"


def validate_region(region: str) -> None:
    """
    Validate that the specified region is supported by AgentCore Runtime.

    Args:
        region: The AWS region to validate

    Raises:
        ValueError: If the region is not in SUPPORTED_REGIONS
    """
    if region not in SUPPORTED_REGIONS:
        raise ValueError(
            f"Unsupported region: {region}. "
            f"AgentCore Runtime is available in: {', '.join(SUPPORTED_REGIONS)}"
        )
