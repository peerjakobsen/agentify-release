"""
Networking stack for Agentify Infrastructure.

This module defines VPC, subnets, security groups, and network
connectivity resources for Agentify demo environments.

The VPC is configured specifically for AgentCore Runtime deployment,
with private subnets in AZs that AgentCore supports.
"""

from typing import Any

from aws_cdk import CfnOutput, Stack
from aws_cdk import aws_ec2 as ec2
from config import DEFAULT_ENVIRONMENT, PROJECT_NAME, get_agentcore_supported_azs
from constructs import Construct


class NetworkingStack(Stack):
    """
    Networking infrastructure stack for Agentify.

    Creates a 2-tier VPC with public and private subnets, VPC endpoints
    for AWS service connectivity, and security groups for agents.
    
    Key features:
    - Private subnets in AgentCore-supported AZs
    - NAT Gateway for outbound internet access
    - VPC endpoints for AWS services (reduces NAT costs, improves security)
    - Security group for AgentCore agents
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
        """Create VPC with 2-tier architecture (public and private subnets).

        Note: AgentCore Runtime only supports specific AZ IDs in each region.
        We dynamically look up which AZ names map to supported AZ IDs for
        this account using get_agentcore_supported_azs().
        """
        # Get AZs supported by AgentCore Runtime (dynamically per account)
        supported_azs = get_agentcore_supported_azs(self.region)
        # Use first 2 supported AZs for cost efficiency
        selected_azs = supported_azs[:2]

        self.vpc = ec2.Vpc(
            self,
            "Vpc",
            vpc_name=f"{PROJECT_NAME}-vpc-{self.environment_name}",
            ip_addresses=ec2.IpAddresses.cidr("10.0.0.0/16"),
            # Dynamically select AZs supported by AgentCore Runtime
            availability_zones=selected_azs,
            nat_gateways=1,  # Single NAT for cost efficiency in demo
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="Public",
                    subnet_type=ec2.SubnetType.PUBLIC,
                    cidr_mask=24,
                ),
                ec2.SubnetConfiguration(
                    name="Private",
                    subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidr_mask=24,
                ),
            ],
            enable_dns_hostnames=True,
            enable_dns_support=True,
        )

    def _create_vpc_endpoints(self) -> None:
        """Create VPC endpoints for AWS service connectivity.
        
        These endpoints allow agents in private subnets to access AWS services
        without going through the NAT Gateway, reducing costs and latency.
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

        # Gateway VPC Endpoints (free tier)
        # S3 Gateway endpoint - for agent artifacts
        self.vpc.add_gateway_endpoint(
            "S3Endpoint",
            service=ec2.GatewayVpcEndpointAwsService.S3,
            subnets=[
                ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS)
            ],
        )

        # DynamoDB Gateway endpoint - for workflow events
        self.vpc.add_gateway_endpoint(
            "DynamoDbEndpoint",
            service=ec2.GatewayVpcEndpointAwsService.DYNAMODB,
            subnets=[
                ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS)
            ],
        )

        # Interface VPC Endpoints (paid, but essential for agents)
        
        # CloudWatch Logs endpoint - for agent logging
        self.vpc.add_interface_endpoint(
            "CloudWatchLogsEndpoint",
            service=ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[self.endpoint_security_group],
        )

        # Secrets Manager endpoint - for credential retrieval
        self.vpc.add_interface_endpoint(
            "SecretsManagerEndpoint",
            service=ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[self.endpoint_security_group],
        )

        # STS endpoint - for IAM role assumption
        self.vpc.add_interface_endpoint(
            "StsEndpoint",
            service=ec2.InterfaceVpcEndpointAwsService.STS,
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[self.endpoint_security_group],
        )

        # SSM Parameter Store endpoint - for configuration
        self.vpc.add_interface_endpoint(
            "SsmEndpoint",
            service=ec2.InterfaceVpcEndpointAwsService.SSM,
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[self.endpoint_security_group],
        )

        # Bedrock Runtime endpoint - for LLM calls from agents
        self.vpc.add_interface_endpoint(
            "BedrockRuntimeEndpoint",
            service=ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
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
            export_name=f"{PROJECT_NAME}-VpcId",
            description="VPC ID for Agentify",
        )

        # Export private subnet IDs (comma-separated for agentcore configure)
        private_subnet_ids = ",".join(
            [subnet.subnet_id for subnet in self.vpc.private_subnets]
        )
        CfnOutput(
            self,
            "PrivateSubnetIds",
            value=private_subnet_ids,
            export_name=f"{PROJECT_NAME}-PrivateSubnetIds",
            description="Private subnet IDs for AgentCore agents (comma-separated)",
        )

        # Export public subnet IDs
        public_subnet_ids = ",".join(
            [subnet.subnet_id for subnet in self.vpc.public_subnets]
        )
        CfnOutput(
            self,
            "PublicSubnetIds",
            value=public_subnet_ids,
            export_name=f"{PROJECT_NAME}-PublicSubnetIds",
            description="Public subnet IDs for Agentify",
        )

        # Export Agent security group ID
        CfnOutput(
            self,
            "AgentSecurityGroupId",
            value=self.agent_security_group.security_group_id,
            export_name=f"{PROJECT_NAME}-AgentSecurityGroupId",
            description="Security group ID for AgentCore agents",
        )
