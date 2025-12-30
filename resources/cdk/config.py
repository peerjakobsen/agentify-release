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
AGENTCORE_SUPPORTED_AZ_IDS: dict[str, set[str]] = {
    "us-east-1": {"use1-az1", "use1-az2", "use1-az4"},
    "us-west-2": {"usw2-az1", "usw2-az2", "usw2-az3"},
    "eu-west-1": {"euw1-az1", "euw1-az2", "euw1-az3"},
}

# Fallback AZ names for when AWS credentials are unavailable during synthesis
# These are typical mappings but may differ per account - actual deployment
# will validate against the account's real AZ mappings
FALLBACK_AZ_NAMES: dict[str, list[str]] = {
    "us-east-1": ["us-east-1a", "us-east-1b", "us-east-1c"],
    "us-west-2": ["us-west-2a", "us-west-2b", "us-west-2c"],
    "eu-west-1": ["eu-west-1a", "eu-west-1b", "eu-west-1c"],
}

# Project name used in resource naming
PROJECT_NAME: str = "agentify"

# Default environment for demo deployments
DEFAULT_ENVIRONMENT: str = "demo"


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
