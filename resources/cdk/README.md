# Agentify CDK Infrastructure

AWS CDK infrastructure for Agentify - VPC networking, observability, and Lambda tools.

## Overview

This CDK project deploys the shared infrastructure required for Agentify demos:

1. **Networking Stack** - VPC with private subnets and NAT Gateway for AgentCore Runtime
2. **Observability Stack** - DynamoDB table for Demo Viewer event streaming
3. **Gateway Tools Stack** - Lambda functions for MCP Gateway tools (auto-discovered)

## Post-Initialization: Reload Kiro

After the Agentify extension extracts files, you **MUST reload Kiro** to detect the hooks in `.kiro/hooks/`. Without reloading, Kiro will not pick up the extracted hook configurations.

```
Command Palette → Developer: Reload Window
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              VPC (10.0.0.0/16)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────┐                                                │
│  │   Public Subnet     │                                                │
│  │   (10.0.0.0/24)     │                                                │
│  │                     │                                                │
│  │   [NAT Gateway]*    │  * Required for Cognito M2M OAuth              │
│  └──────────┬──────────┘    (not supported via VPC endpoints)           │
│             │                                                           │
│  ┌──────────┴──────────┐                                                │
│  │   Private Subnet    │                                                │
│  │   (10.0.2.0/24)     │                                                │
│  │                     │                                                │
│  │   [AgentCore]       │                                                │
│  │   [Runtime]         │                                                │
│  └─────────────────────┘                                                │
│                                                                         │
│  VPC Endpoints:                                                         │
│  ├── S3 (Gateway) - agent artifacts                                     │
│  ├── DynamoDB (Gateway) - workflow events                               │
│  ├── CloudWatch Logs - agent logging                                    │
│  ├── Secrets Manager - credentials                                      │
│  ├── STS - IAM role assumption                                          │
│  ├── SSM - configuration parameters                                     │
│  ├── Bedrock Runtime - LLM calls                                        │
│  ├── ECR (API + Docker) - container images                              │
│  ├── Lambda - tool invocations                                          │
│  ├── X-Ray - OpenTelemetry traces                                       │
│  ├── AgentCore Gateway - MCP Gateway tool calls                         │
│  └── Cognito IDP - user pool operations (NOT OAuth tokens)              │
│                                                                         │
│  Note: NAT Gateway handles Cognito OAuth token endpoint                 │
│  ({domain}.auth.{region}.amazoncognito.com) - M2M OAuth                 │
│  client credentials flow is not supported via VPC endpoints.            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         DynamoDB Table                                   │
│                    ({project}-workflow-events)                           │
├─────────────────────────────────────────────────────────────────────────┤
│  PK: workflow_id (String)                                               │
│  SK: timestamp (String, ISO format with microseconds)                   │
│                                                                         │
│  Attributes:                                                            │
│  ├── event_type: agent_start | agent_end | tool_call | handoff | outcome│
│  ├── agent_name: Name of the agent                                      │
│  ├── payload: Event-specific data (Map)                                 │
│  └── ttl: Expiration timestamp (7 days)                                 │
│                                                                         │
│  Billing: On-demand (pay per request)                                   │
│  Encryption: AWS managed keys                                           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    Lambda Functions (Gateway Tools)                      │
│                 Auto-discovered from cdk/gateway/handlers/               │
├─────────────────────────────────────────────────────────────────────────┤
│  Each subdirectory with handler.py becomes a Lambda function:           │
│                                                                         │
│  cdk/gateway/handlers/                                                  │
│  ├── zendesk_get_ticket/                                                │
│  │   ├── handler.py         → Lambda: {project}-gateway-zendesk_get... │
│  │   └── mock_data.json                                                 │
│  ├── customer_lookup/                                                   │
│  │   ├── handler.py         → Lambda: {project}-gateway-customer_lo... │
│  │   └── mock_data.json                                                 │
│  └── ...                                                                │
│                                                                         │
│  Lambda ARNs are exported for MCP Gateway registration.                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## Stacks

### Agentify-{project}-Networking-{region}

Creates the VPC infrastructure required for AgentCore Runtime:

- **VPC**: 10.0.0.0/16 CIDR with DNS support
- **Subnets**: 1 public + 1 private subnet in AgentCore-supported AZ
- **NAT Gateway**: Required for Cognito M2M OAuth (client credentials flow)
- **VPC Endpoints**: 12 endpoints for AWS service connectivity
- **Security Groups**: Agent security group with outbound access

**Outputs:**
- `{project}-VpcId` - VPC ID
- `{project}-PrivateSubnetIds` - Private subnet IDs (comma-separated)
- `{project}-AgentSecurityGroupId` - Security group for agents

### Agentify-{project}-Observability-{region}

Creates the DynamoDB table for Demo Viewer event streaming:

- **Table**: `{project}-workflow-events` with on-demand billing
- **TTL**: Events expire after 7 days
- **SSM Parameters**: Service discovery for agents

**Outputs:**
- `{project}-WorkflowEventsTableName` - DynamoDB table name
- `{project}-WorkflowEventsTableArn` - DynamoDB table ARN

### Agentify-{project}-GatewayTools-{region}

Creates Lambda functions for MCP Gateway tools:

- **Auto-discovery**: Scans `cdk/gateway/handlers/*/handler.py`
- **Lambda Functions**: One function per tool handler
- **Permissions**: Grants Bedrock AgentCore invoke permissions
- **Exports**: Lambda ARNs for gateway registration

## Deployment

### Prerequisites

```bash
# Install uv (Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install AWS CLI
# See: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

# Install jq (for script JSON parsing)
brew install jq  # macOS

# Configure AWS credentials
aws configure
# Or set AWS_PROFILE in .agentify/config.json
```

### Deploy Infrastructure

Use the bundled setup script for deployment:

```bash
# Deploy infrastructure + MCP Gateway
./scripts/setup.sh

# Deploy infrastructure + Gateway + specific agent
./scripts/setup.sh --agent my_agent

# Skip CDK (already deployed), deploy agent only
./scripts/setup.sh --skip-cdk --agent my_agent

# Deploy to specific region
./scripts/setup.sh --region eu-west-1
```

The setup script automatically:
1. Deploys CDK stacks (Networking, Observability, GatewayTools)
2. Registers Lambda tools with MCP Gateway
3. Stores Gateway OAuth credentials in SSM Parameter Store
4. Configures and deploys agents with proper IAM permissions

### Destroy Infrastructure

Use the destroy script for teardown:

```bash
# Destroy everything (2-phase: agents/gateway first, then CDK)
./scripts/destroy.sh

# Check ENI status before destroying
./scripts/destroy.sh --check-only

# Skip confirmation prompt
./scripts/destroy.sh --force
```

**Important**: AgentCore ENIs can take up to 8 hours to release after agent deletion. If CDK destroy fails due to ENIs attached to subnets, wait and re-run the script.

## Running Workflows

### Orchestrated Workflow

Run the full multi-agent workflow:

```bash
# Run workflow with a prompt
./scripts/orchestrate.sh -p "Customer TKT-001 has API errors"

# Save JSON events to file
./scripts/orchestrate.sh --prompt "Billing issue" --json events.json

# Skip DynamoDB event query (faster)
./scripts/orchestrate.sh -p "VIP complaint" --skip-events
```

### Test Individual Agent

Invoke a single agent for testing:

```bash
# Test an agent
./scripts/invoke.sh -a triage -p "Customer has login issues"

# Skip DynamoDB verification
./scripts/invoke.sh --agent technical --prompt "Check ticket TKT-001" --skip-check
```

## MCP Gateway

The MCP Gateway provides tools to agents via the Model Context Protocol.

### Gateway Configuration

After `setup.sh` completes, Gateway credentials are stored in SSM Parameter Store:

| Parameter | Description |
|-----------|-------------|
| `/agentify/{project}/gateway/url` | MCP Gateway endpoint URL |
| `/agentify/{project}/gateway/client_id` | Cognito OAuth client ID |
| `/agentify/{project}/gateway/client_secret` | Cognito OAuth client secret (SecureString) |
| `/agentify/{project}/gateway/token_endpoint` | Cognito token endpoint URL |
| `/agentify/{project}/gateway/scope` | OAuth scope for Gateway access |

### Multi-Project Isolation

Each project gets its own isolated resources:
- Unique MCP Gateway with project-specific tools
- Project-scoped SSM parameter namespace
- Separate DynamoDB table for workflow events

Agents discover their Gateway via the `AGENTIFY_PROJECT_NAME` environment variable set during deployment.

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
| NAT Gateway | ~$32 + data transfer |
| VPC Endpoints (10 interface) | ~$70 |
| DynamoDB | Pay per request |
| Lambda | Pay per invocation |
| **Total** | ~$100/month |

**Cost optimization tips:**
- Use single AZ (default) for dev/test
- Destroy when not in use: `./scripts/destroy.sh`
- Consider removing unused VPC endpoints

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# AWS Configuration (optional - can use config.json instead)
AWS_REGION=us-east-1
AWS_PROFILE=your-profile
```

### Config File

AWS settings are stored in `.agentify/config.json`:

```json
{
  "aws": {
    "region": "us-east-1",
    "profile": "your-profile"
  }
}
```

## Files

```
project/
├── scripts/
│   ├── setup.sh              # Deploy infrastructure + agents
│   ├── destroy.sh            # Teardown (2-phase)
│   ├── orchestrate.sh        # Run workflow
│   └── invoke.sh             # Test single agent
├── cdk/
│   ├── app.py                # CDK app entry point
│   ├── config.py             # Environment configuration
│   ├── cdk.json              # CDK configuration
│   ├── pyproject.toml        # Python dependencies
│   ├── stacks/
│   │   ├── networking.py     # VPC, subnets, endpoints, NAT
│   │   ├── observability.py  # DynamoDB table
│   │   └── gateway_tools.py  # Lambda auto-discovery
│   └── gateway/
│       ├── handlers/         # Lambda tool handlers (auto-discovered)
│       ├── schemas/          # MCP Gateway tool schemas
│       ├── setup_gateway.py  # Gateway registration script
│       └── cleanup_gateway.py # Gateway cleanup script
├── agents/
│   ├── main.py               # Local orchestrator
│   └── shared/               # Shared utilities
└── .agentify/
    ├── config.json           # Project configuration
    └── infrastructure.json   # Deployed infrastructure outputs
```

## Troubleshooting

**ENI release delay**: AgentCore ENIs can take up to 8 hours to release after agent deletion. Use `./scripts/destroy.sh --check-only` to monitor status before retrying CDK destroy.

**Gateway OAuth errors**: Check SSM parameters at `/agentify/{project}/gateway/*`. Ensure NAT Gateway is deployed (required for Cognito M2M OAuth).

**Agent IAM permissions missing**: Ensure you deployed via `./scripts/setup.sh --agent <name>` which adds the inline policy `AgentifyAccess-{agent}`.

**Kiro hooks not working**: Reload Kiro after initialization (`Developer: Reload Window`) to detect `.kiro/hooks/`.

**CDK bootstrap fails**: Ensure you have admin permissions in the AWS account.

**AZ not supported**: Check that your region is in `SUPPORTED_REGIONS` in `config.py`.

**VPC endpoint creation fails**: Some endpoints may not be available in all AZs.

**Stack deletion fails**: Check for resources with `RemovalPolicy.RETAIN` that need manual deletion, or ENIs still attached.
