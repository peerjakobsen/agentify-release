"""
Networking stack for Agentify Infrastructure.

This module defines VPC, subnets, security groups, and network
connectivity resources for Agentify demo environments.

The VPC is configured specifically for AgentCore Runtime deployment,
with isolated private subnets in AZs that AgentCore supports.
All AWS service access is via VPC endpoints (no NAT Gateway needed).
"""

from typing import Any

from aws_cdk import CfnOutput, Stack
from aws_cdk import aws_ec2 as ec2
import config
from config import DEFAULT_ENVIRONMENT, get_agentcore_supported_azs
from constructs import Construct


class NetworkingStack(Stack):
    """
    Networking infrastructure stack for Agentify.

    Creates a minimal VPC with a single isolated private subnet and VPC
    endpoints for AWS service connectivity. Optimized for demo costs.

    Key features:
    - Single isolated private subnet in one AgentCore-supported AZ
    - VPC endpoints for all required AWS services
    - No public subnets, no NAT Gateway, no internet egress
    - Security group for AgentCore agents

    Cost optimization: ~$82/month saved vs traditional 2-AZ NAT setup.
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        **kwargs: Any,
    ) -> None:
        """
        Initialize the networking stack.

        Args:
            scope: The CDK construct scope
            construct_id: The unique identifier for this stack
            **kwargs: Additional stack properties (env, description, etc.)
        """
        super().__init__(scope, construct_id, **kwargs)

        # Store environment configuration
        self.environment_name = DEFAULT_ENVIRONMENT
        self.stack_region = self.region

        # Create VPC with 2-tier architecture
        self._create_vpc()

        # Create VPC endpoints for AWS service connectivity
        self._create_vpc_endpoints()

        # Create security groups
        self._create_security_groups()

        # Export stack outputs
        self._create_outputs()

    def _create_vpc(self) -> None:
        """Create VPC with a single isolated private subnet.

        No public subnets, no NAT Gateway, single AZ - minimal cost for demos.
        All connectivity via VPC endpoints.

        Note: AgentCore Runtime only supports specific AZ IDs in each region.
        We dynamically look up which AZ names map to supported AZ IDs for
        this account using get_agentcore_supported_azs().
        """
        # Get AZs supported by AgentCore Runtime (dynamically per account)
        supported_azs = get_agentcore_supported_azs(self.region)
        # Use single AZ for cost efficiency in demo environments
        selected_az = [supported_azs[0]]

        self.vpc = ec2.Vpc(
            self,
            "Vpc",
            vpc_name=f"{config.PROJECT_NAME}-vpc-{self.environment_name}",
            ip_addresses=ec2.IpAddresses.cidr("10.0.0.0/16"),
            # Single AZ supported by AgentCore Runtime
            availability_zones=selected_az,
            nat_gateways=0,  # No NAT - all access via VPC endpoints
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="Private",
                    subnet_type=ec2.SubnetType.PRIVATE_ISOLATED,
                    cidr_mask=24,
                ),
            ],
            enable_dns_hostnames=True,
            enable_dns_support=True,
        )

    def _create_vpc_endpoints(self) -> None:
        """Create VPC endpoints for AWS service connectivity.

        These endpoints are the ONLY way agents can access AWS services
        since there is no NAT Gateway or internet access.
        """
        # Create security group for VPC Interface endpoints
        self.endpoint_security_group = ec2.SecurityGroup(
            self,
            "EndpointSecurityGroup",
            vpc=self.vpc,
            description="Security group for VPC Interface Endpoints",
            allow_all_outbound=False,
        )

        # Allow inbound HTTPS from VPC CIDR
        self.endpoint_security_group.add_ingress_rule(
            peer=ec2.Peer.ipv4(self.vpc.vpc_cidr_block),
            connection=ec2.Port.tcp(443),
            description="Allow HTTPS from VPC",
        )

        # Gateway VPC Endpoints (free)
        # S3 Gateway endpoint - for agent artifacts
        self.vpc.add_gateway_endpoint(
            "S3Endpoint",
            service=ec2.GatewayVpcEndpointAwsService.S3,
            subnets=[
                ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED)
            ],
        )

        # DynamoDB Gateway endpoint - for workflow events
        self.vpc.add_gateway_endpoint(
            "DynamoDbEndpoint",
            service=ec2.GatewayVpcEndpointAwsService.DYNAMODB,
            subnets=[
                ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED)
            ],
        )

        # Interface VPC Endpoints (paid, but required for isolated subnets)

        # Lambda endpoint - for invoking Lambda-based AgentCore tools
        self.vpc.add_interface_endpoint(
            "LambdaEndpoint",
            service=ec2.InterfaceVpcEndpointAwsService.LAMBDA_,
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            security_groups=[self.endpoint_security_group],
        )

        # CloudWatch Logs endpoint - for agent logging
        self.vpc.add_interface_endpoint(
            "CloudWatchLogsEndpoint",
            service=ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            security_groups=[self.endpoint_security_group],
        )

        # Secrets Manager endpoint - for credential retrieval
        self.vpc.add_interface_endpoint(
            "SecretsManagerEndpoint",
            service=ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            security_groups=[self.endpoint_security_group],
        )

        # STS endpoint - for IAM role assumption
        self.vpc.add_interface_endpoint(
            "StsEndpoint",
            service=ec2.InterfaceVpcEndpointAwsService.STS,
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            security_groups=[self.endpoint_security_group],
        )

        # SSM Parameter Store endpoint - for configuration
        self.vpc.add_interface_endpoint(
            "SsmEndpoint",
            service=ec2.InterfaceVpcEndpointAwsService.SSM,
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            security_groups=[self.endpoint_security_group],
        )

        # Bedrock Runtime endpoint - for LLM calls from agents
        self.vpc.add_interface_endpoint(
            "BedrockRuntimeEndpoint",
            service=ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            security_groups=[self.endpoint_security_group],
        )

        # ECR endpoints - REQUIRED for AgentCore to pull container images
        # Without these, AgentCore cannot pull the agent container from ECR
        # ECR Docker endpoint - for docker pull operations
        self.vpc.add_interface_endpoint(
            "EcrDkrEndpoint",
            service=ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            security_groups=[self.endpoint_security_group],
        )

        # ECR API endpoint - for ECR API calls (auth, describe, etc.)
        self.vpc.add_interface_endpoint(
            "EcrApiEndpoint",
            service=ec2.InterfaceVpcEndpointAwsService.ECR,
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            security_groups=[self.endpoint_security_group],
        )

        # AgentCore Gateway endpoint - for MCP Gateway tool invocations
        # Without this, agents in VPC cannot reach the MCP Gateway endpoint
        # Service name: com.amazonaws.{region}.bedrock-agentcore.gateway
        self.vpc.add_interface_endpoint(
            "AgentCoreGatewayEndpoint",
            service=ec2.InterfaceVpcEndpointService(
                f"com.amazonaws.{self.region}.bedrock-agentcore.gateway",
                port=443,
            ),
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            security_groups=[self.endpoint_security_group],
            private_dns_enabled=True,
        )

        # Cognito Identity Provider endpoint - for Gateway OAuth token fetching
        # Without this, agents cannot fetch OAuth tokens from Cognito
        # Required for MCP Gateway authentication
        self.vpc.add_interface_endpoint(
            "CognitoIdpEndpoint",
            service=ec2.InterfaceVpcEndpointService(
                f"com.amazonaws.{self.region}.cognito-idp",
                port=443,
            ),
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            security_groups=[self.endpoint_security_group],
        )

    def _create_security_groups(self) -> None:
        """Create security groups for AgentCore agents."""
        # Agent security group - outbound only
        # Agents initiate connections to tools and AWS services
        self.agent_security_group = ec2.SecurityGroup(
            self,
            "AgentSecurityGroup",
            vpc=self.vpc,
            description="Security group for AgentCore agents",
            allow_all_outbound=True,
        )

    def _create_outputs(self) -> None:
        """Create CloudFormation outputs for cross-stack references and scripts."""
        # Export VPC ID
        CfnOutput(
            self,
            "VpcId",
            value=self.vpc.vpc_id,
            export_name=f"{config.PROJECT_NAME}-VpcId",
            description="VPC ID for Agentify",
        )

        # Export isolated subnet IDs (comma-separated for agentcore configure)
        # Note: PRIVATE_ISOLATED subnets are accessed via isolated_subnets
        private_subnet_ids = ",".join(
            [subnet.subnet_id for subnet in self.vpc.isolated_subnets]
        )
        CfnOutput(
            self,
            "PrivateSubnetIds",
            value=private_subnet_ids,
            export_name=f"{config.PROJECT_NAME}-PrivateSubnetIds",
            description="Private subnet IDs for AgentCore agents (comma-separated)",
        )

        # Export Agent security group ID
        CfnOutput(
            self,
            "AgentSecurityGroupId",
            value=self.agent_security_group.security_group_id,
            export_name=f"{config.PROJECT_NAME}-AgentSecurityGroupId",
            description="Security group ID for AgentCore agents",
        )
