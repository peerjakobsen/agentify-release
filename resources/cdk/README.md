# Agentify CDK Infrastructure

AWS CDK infrastructure for Agentify - VPC networking and observability.

## Overview

This CDK project deploys the shared infrastructure required for Agentify demos:

1. **Networking Stack** - VPC with private subnets for AgentCore Runtime
2. **Observability Stack** - DynamoDB table for Demo Viewer event streaming

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              VPC (10.0.0.0/16)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────┐           ┌─────────────────────┐             │
│  │   Public Subnet     │           │   Public Subnet     │             │
│  │   (10.0.0.0/24)     │           │   (10.0.1.0/24)     │             │
│  │                     │           │                     │             │
│  │   [NAT Gateway]     │           │                     │             │
│  └──────────┬──────────┘           └─────────────────────┘             │
│             │                                                           │
│  ┌──────────┴──────────┐           ┌─────────────────────┐             │
│  │   Private Subnet    │           │   Private Subnet    │             │
│  │   (10.0.2.0/24)     │           │   (10.0.3.0/24)     │             │
│  │                     │           │                     │             │
│  │   [AgentCore]       │           │   [AgentCore]       │             │
│  │   [Runtime]         │           │   [Runtime]         │             │
│  └─────────────────────┘           └─────────────────────┘             │
│                                                                         │
│  VPC Endpoints:                                                         │
│  ├── S3 (Gateway)                                                       │
│  ├── DynamoDB (Gateway)                                                 │
│  ├── CloudWatch Logs (Interface)                                        │
│  ├── Secrets Manager (Interface)                                        │
│  ├── STS (Interface)                                                    │
│  ├── SSM (Interface)                                                    │
│  └── Bedrock Runtime (Interface)                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         DynamoDB Table                                   │
│                    (agentify-workflow-events)                            │
├─────────────────────────────────────────────────────────────────────────┤
│  PK: workflow_id (String)                                               │
│  SK: timestamp (Number)                                                  │
│                                                                         │
│  Attributes:                                                            │
│  ├── event_type: agent_start | agent_end | tool_call | handoff | outcome│
│  ├── agent_name: Name of the agent                                      │
│  ├── payload: Event-specific data (Map)                                 │
│  └── ttl: Expiration timestamp (24 hours)                               │
│                                                                         │
│  Billing: On-demand (pay per request)                                   │
│  Encryption: AWS managed keys                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Stacks

### Agentify-Networking-{region}

Creates the VPC infrastructure required for AgentCore Runtime:

- **VPC**: 10.0.0.0/16 CIDR with DNS support
- **Subnets**: 2 public + 2 private subnets in AgentCore-supported AZs
- **NAT Gateway**: Single NAT for outbound internet access
- **VPC Endpoints**: Reduce NAT costs and improve security
- **Security Groups**: Agent security group with outbound access

**Outputs:**
- `agentify-VpcId` - VPC ID
- `agentify-PrivateSubnetIds` - Comma-separated private subnet IDs
- `agentify-AgentSecurityGroupId` - Security group for agents

### Agentify-Observability-{region}

Creates the DynamoDB table for Demo Viewer event streaming:

- **Table**: `agentify-workflow-events` with on-demand billing
- **TTL**: Events expire after 24 hours
- **SSM Parameters**: Service discovery for agents

**Outputs:**
- `agentify-WorkflowEventsTableName` - DynamoDB table name
- `agentify-WorkflowEventsTableArn` - DynamoDB table ARN

## Deployment

### Prerequisites

```bash
# Install uv (Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install AWS CLI
# See: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

# Configure AWS credentials
aws configure
```

### Deploy

```bash
# Navigate to CDK directory
cd resources/cdk

# Install dependencies
uv sync

# Bootstrap CDK (first time only)
uv run cdk bootstrap aws://ACCOUNT_ID/REGION

# Synthesize templates
uv run cdk synth -c region=us-east-1

# Deploy all stacks
uv run cdk deploy -c region=us-east-1 --all
```

### Destroy

```bash
uv run cdk destroy -c region=us-east-1 --all --force
```

## AgentCore AZ Support

AgentCore Runtime only supports specific Availability Zone IDs in each region. The CDK dynamically looks up which AZ names map to supported AZ IDs for your account.

| Region | Supported AZ IDs |
|--------|------------------|
| us-east-1 | use1-az1, use1-az2, use1-az4 |
| us-west-2 | usw2-az1, usw2-az2, usw2-az3 |
| eu-west-1 | euw1-az1, euw1-az2, euw1-az3 |

## Cost Breakdown

| Resource | Monthly Cost (Idle) |
|----------|-------------------|
| NAT Gateway | ~$32 |
| VPC Endpoints (Interface) | ~$7 per endpoint |
| DynamoDB | $0 (on-demand, pay per request) |
| **Total** | ~$60/month |

**Cost optimization tips:**
- Deploy in a single AZ for dev/test
- Remove unused VPC endpoints
- Destroy when not in use

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012
```

### CDK Context

Pass configuration via CDK context:

```bash
# Deploy to specific region
uv run cdk deploy -c region=eu-west-1 --all
```

## Files

```
resources/cdk/
├── app.py              # CDK app entry point
├── config.py           # Environment configuration
├── cdk.json            # CDK configuration
├── pyproject.toml      # Python dependencies
└── stacks/
    ├── __init__.py
    ├── networking.py   # VPC, subnets, endpoints
    └── observability.py # DynamoDB table
```

## Troubleshooting

**CDK bootstrap fails**: Ensure you have admin permissions in the AWS account.

**AZ not supported**: Check that your region is in `SUPPORTED_REGIONS` in `config.py`.

**VPC endpoint creation fails**: Some endpoints may not be available in all AZs.

**Stack deletion fails**: Check for resources with `RemovalPolicy.RETAIN` that need manual deletion.
