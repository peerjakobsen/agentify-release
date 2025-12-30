# Agentify Scripts

Scripts for deploying and managing Agentify infrastructure and agents.

## Quick Start

```bash
# Deploy infrastructure (one-time setup)
./scripts/setup.sh

# Deploy an agent
./scripts/setup.sh --skip-cdk --agent my_agent

# Tear down everything
./scripts/destroy.sh
```

## Prerequisites

| Tool | Check | Install |
|------|-------|---------|
| uv | `uv --version` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| AWS CLI | `aws --version` | [Install Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| jq | `jq --version` | `brew install jq` (optional, for parsing JSON) |

## What Gets Deployed

### Infrastructure (CDK)

| Component | Service | Purpose | Cost (idle) |
|-----------|---------|---------|-------------|
| Networking | VPC, Subnets, NAT, VPC Endpoints | AgentCore Runtime network | ~$32/mo |
| Observability | DynamoDB Table | Demo Viewer event streaming | ~$0 (on-demand) |

### Agents (AgentCore Starter Toolkit)

Agents are deployed using the [AgentCore Starter Toolkit](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-toolkit.html), which builds ARM64 containers in the cloud via CodeBuild.

| Agent | Status | Cost |
|-------|--------|------|
| Custom agents | Deployed per project | Pay-per-use |

## Scripts

### setup.sh

Deploys infrastructure and optionally an agent.

```bash
# Deploy infrastructure only
./scripts/setup.sh

# Deploy infrastructure + specific agent
./scripts/setup.sh --agent inventory_agent

# Deploy agent only (infrastructure already exists)
./scripts/setup.sh --skip-cdk --agent inventory_agent

# Deploy to specific region
./scripts/setup.sh --region eu-west-1
```

Options:
- `--skip-cdk` - Skip CDK infrastructure deployment
- `--agent, -a NAME` - Deploy a specific agent
- `--region, -r REGION` - AWS region (default: us-east-1)

### destroy.sh

Tears down infrastructure and agents.

```bash
# Destroy everything (with confirmation)
./scripts/destroy.sh

# Destroy without confirmation
./scripts/destroy.sh --force

# Destroy infrastructure only, keep agents
./scripts/destroy.sh --skip-agents
```

Options:
- `--force, -f` - Skip confirmation prompt
- `--skip-agents` - Skip agent deletion
- `--region, -r REGION` - AWS region (default: us-east-1)

## Agent Deployment

### Handler File Location

The setup script looks for handler files in these locations:

```
agents/<agent_name>.py
agents/<agent_name>_handler.py
agents/<agent_name>/handler.py
```

### Agent Configuration

Agent configuration is stored in `.bedrock_agentcore.yaml` at the project root:

```yaml
agents:
  my_agent:
    agent_id: "..."
    entrypoint: "agents/my_agent.py"
    network_configuration:
      network_mode: VPC
      network_mode_config:
        security_groups: [sg-xxx]
        subnets: [subnet-xxx, subnet-yyy]
```

### Agent Management

```bash
# Check agent status
uv run agentcore status

# Invoke agent
uv run agentcore invoke '{"prompt": "Hello!"}' -a my_agent

# View agent logs
aws logs tail /aws/bedrock-agentcore/runtimes/my_agent-* --follow

# Delete agent
uv run agentcore delete -a my_agent --force
```

## Infrastructure Configuration

After deployment, infrastructure config is saved to `.agentify/infrastructure.json`:

```json
{
  "region": "us-east-1",
  "vpc_subnet_ids": "subnet-xxx,subnet-yyy",
  "vpc_security_group_id": "sg-zzz",
  "workflow_events_table": "agentify-workflow-events",
  "deployed_at": "2025-01-15T10:30:00Z"
}
```

This config is used by:
- `setup.sh` when deploying agents (to get VPC config)
- Agentify extension (to configure Demo Viewer polling)

## Troubleshooting

**CDK deploy fails**: Check AWS credentials with `aws sts get-caller-identity`

**Agent deploy fails**: Check `.bedrock_agentcore.yaml` exists and run `uv run agentcore configure`

**Agent not responding**: Check CloudWatch logs for import errors

**VPC endpoints not working**: Ensure security group allows HTTPS (443) from VPC CIDR

**DynamoDB writes failing**: Check agent IAM role has `dynamodb:PutItem` permission

## Cost Optimization

For demo/development use:
- Use a single NAT Gateway (default)
- DynamoDB is on-demand (pay per request)
- Agents are pay-per-use (no idle cost)
- Consider destroying when not in use: `./scripts/destroy.sh`

Estimated monthly cost for idle infrastructure: ~$32/month (mostly NAT Gateway)
