# Specification: DynamoDB Observability Table

## Goal

Provision a DynamoDB table via CloudFormation that stores workflow events emitted by Python observability decorators, enabling the Agentify extension's Demo Viewer panel to display real-time execution logs for AI agent workflows.

**Extension Context:** Single `agentify` extension with two webview panels (Demo Viewer for runtime, Ideation Wizard for design-time). This spec provides infrastructure for the Demo Viewer panel.

## User Stories

- As a demo developer, I want a persistent event store for workflow telemetry so that I can observe agent execution in the Kiro IDE extension
- As a developer, I want a simple one-click CloudFormation deployment so that I can provision the required infrastructure without complex setup

## Specific Requirements

**CloudFormation Template**
- Create `infrastructure/dynamodb-table.yaml` CloudFormation template
- Template must be deployable via AWS CLI (`aws cloudformation deploy`) or AWS Console
- Use YAML format for readability
- Include descriptive template metadata and parameter descriptions
- Template should be self-contained with no external dependencies

**Table Schema Design**
- Table name parameter with default value `agentify-workflow-events`
- Partition key: `workflow_id` (String type) for grouping events by workflow execution
- Sort key: `timestamp` (Number type) storing epoch milliseconds for efficient range queries
- Additional attributes: `event_type` (String), `agent_name` (String), `payload` (Map type)
- Attributes beyond keys are schemaless per DynamoDB design

**Capacity Configuration**
- Use PAY_PER_REQUEST (on-demand) billing mode
- No provisioned capacity or auto-scaling configuration needed
- On-demand mode eliminates capacity planning for unpredictable demo workloads

**TTL Configuration**
- Enable TTL on attribute named `ttl`
- TTL value should be set to 24 hours from event creation (calculated by event producers)
- Events automatically expire and delete after TTL, keeping storage minimal

**Payload Size Handling**
- Document 350KB maximum payload size limit in template comments
- Leave 50KB headroom for workflow_id, timestamp, event_type, agent_name, and DynamoDB overhead
- Truncation logic is responsibility of event producers (Python decorators), not the table itself

**Extension Configuration**
- Table name must be configurable in extension settings
- Default value: `agentify-workflow-events`
- Setting allows multi-user and multi-environment scenarios without table conflicts

**Table Validation on Startup**
- Extension must validate table exists before attempting DynamoDB operations
- Use DynamoDB DescribeTable API to verify table presence and status
- Display clear error message if table not found, directing user to deploy CloudFormation template

**Deployment Documentation**
- Include deployment instructions in CloudFormation template comments
- Document AWS CLI deployment command with region parameter
- Document Console deployment steps as alternative

## Visual Design

No visual assets provided.

## Existing Code to Leverage

**Greenfield Project**
- No existing codebase to reference
- This is the first feature in the Agentify extension roadmap
- Patterns established here will inform subsequent features

**Tech Stack References**
- AWS SDK: @aws-sdk/lib-dynamodb (DocumentClient) for extension operations
- Python SDK: boto3 for decorator event writes
- Credential handling via Kiro's AWS Explorer integration (separate feature)

## Out of Scope

- Global Secondary Indexes (GSIs) - not needed for V1 query patterns
- Custom encryption configuration - use AWS default encryption at rest
- Backup policies - use AWS default settings, demo data is ephemeral
- Cross-region replication - single region deployment for V1
- Automatic table creation from extension - manual CloudFormation deployment only
- Provisioned capacity mode - on-demand only for simplicity
- Point-in-time recovery - not needed for ephemeral demo data
- Stream configuration - no DynamoDB Streams for V1
- IAM role/policy creation - users manage their own AWS permissions
- Table deletion or cleanup automation - manual management only
