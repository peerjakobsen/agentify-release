"""
Observability stack for Agentify Infrastructure.

This module defines the DynamoDB table for workflow event streaming,
which powers the Demo Viewer panel in the Agentify extension.

Events are written by the agentify_observability Python decorators
and polled by the extension for real-time visualization.
"""

from typing import Any

from aws_cdk import CfnOutput, RemovalPolicy, Stack
from aws_cdk import aws_dynamodb as dynamodb
from aws_cdk import aws_ssm as ssm
import config
from config import DEFAULT_ENVIRONMENT
from constructs import Construct
from stacks.networking import NetworkingStack


class ObservabilityStack(Stack):
    """
    Observability infrastructure stack for Agentify.

    Creates:
    - DynamoDB table for workflow events (powers Demo Viewer)
    - SSM parameters for service discovery
    
    The DynamoDB table stores events emitted by the agentify_observability
    Python decorators. Events include:
    - agent_start / agent_end
    - tool_call (with input/output)
    - handoff between agents
    - workflow outcome
    
    Events are automatically expired via TTL (24 hours by default).
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        networking_stack: NetworkingStack,
        **kwargs: Any,
    ) -> None:
        """
        Initialize the observability stack.

        Args:
            scope: The CDK construct scope
            construct_id: The unique identifier for this stack
            networking_stack: The networking stack dependency
            **kwargs: Additional stack properties (env, description, etc.)
        """
        super().__init__(scope, construct_id, **kwargs)

        # Store environment configuration
        self.environment_name = DEFAULT_ENVIRONMENT
        self.stack_region = self.region

        # Add dependency on networking stack
        self.add_dependency(networking_stack)

        # Create DynamoDB table for workflow events
        self._create_workflow_events_table()

        # Create SSM parameters for service discovery
        self._create_ssm_parameters()

        # Export stack outputs
        self._create_outputs()

    def _create_workflow_events_table(self) -> None:
        """Create DynamoDB table for workflow event streaming.
        
        Schema:
        - workflow_id (PK): Groups all events for a single workflow execution
        - timestamp (SK): Epoch milliseconds for efficient range queries
        
        Additional attributes (schemaless):
        - event_type: agent_start, agent_end, tool_call, handoff, outcome
        - agent_name: Name of the agent
        - payload: Event-specific data (Map)
        - ttl: Expiration timestamp (24 hours after creation)
        
        Payload size constraint: 350KB maximum (DynamoDB limit is 400KB,
        with 50KB headroom for other attributes).
        """
        self.workflow_events_table = dynamodb.Table(
            self,
            "WorkflowEventsTable",
            table_name=f"{config.PROJECT_NAME}-workflow-events",
            partition_key=dynamodb.Attribute(
                name="workflow_id",
                type=dynamodb.AttributeType.STRING,
            ),
            sort_key=dynamodb.Attribute(
                name="timestamp",
                type=dynamodb.AttributeType.NUMBER,
            ),
            # On-demand capacity for unpredictable demo workloads
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            # Server-side encryption using AWS managed keys
            encryption=dynamodb.TableEncryption.AWS_MANAGED,
            # TTL for automatic event expiration (24 hours)
            time_to_live_attribute="ttl",
            # Delete table when stack is destroyed (demo data is ephemeral)
            removal_policy=RemovalPolicy.DESTROY,
        )

    def _create_ssm_parameters(self) -> None:
        """Create SSM parameters for service discovery.
        
        Agents and the extension can look up infrastructure details
        without hardcoding values.
        """
        # Workflow events table name
        ssm.StringParameter(
            self,
            "WorkflowEventsTableNameParam",
            parameter_name=f"/{config.PROJECT_NAME}/services/dynamodb/workflow-events-table",
            string_value=self.workflow_events_table.table_name,
            description="DynamoDB table name for workflow events",
            tier=ssm.ParameterTier.STANDARD,
        )

        # Workflow events table ARN (for IAM policies)
        ssm.StringParameter(
            self,
            "WorkflowEventsTableArnParam",
            parameter_name=f"/{config.PROJECT_NAME}/services/dynamodb/workflow-events-table-arn",
            string_value=self.workflow_events_table.table_arn,
            description="DynamoDB table ARN for workflow events",
            tier=ssm.ParameterTier.STANDARD,
        )

    def _create_outputs(self) -> None:
        """Create CloudFormation outputs for cross-stack references."""
        # Export table name
        CfnOutput(
            self,
            "WorkflowEventsTableName",
            value=self.workflow_events_table.table_name,
            export_name=f"{config.PROJECT_NAME}-WorkflowEventsTableName",
            description="DynamoDB table name for Agentify workflow events",
        )

        # Export table ARN
        CfnOutput(
            self,
            "WorkflowEventsTableArn",
            value=self.workflow_events_table.table_arn,
            export_name=f"{config.PROJECT_NAME}-WorkflowEventsTableArn",
            description="DynamoDB table ARN for Agentify workflow events",
        )
