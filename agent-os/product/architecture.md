# Agentify Architecture

## System Overview

Agentify is a single Kiro IDE extension with two webview panels that share common services:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Agentify Extension                                   │
│                                                                              │
│  ┌──────────────────────┐          ┌──────────────────────┐                 │
│  │  Ideation Wizard     │          │    Demo Viewer       │                 │
│  │  Panel               │          │    Panel             │                 │
│  │                      │          │                      │                 │
│  │  - Account Context   │          │  - Workflow Input    │                 │
│  │  - AI Gap Filling    │          │  - Graph View        │                 │
│  │  - Agent Design      │          │  - Execution Log     │                 │
│  │  - Kiro Handoff      │          │  - Outcome Display   │                 │
│  └──────────┬───────────┘          └──────────┬───────────┘                 │
│             │                                  │                             │
│             └──────────────┬───────────────────┘                             │
│                            │                                                 │
│  ┌─────────────────────────┴─────────────────────────┐                      │
│  │              Shared Services                       │                      │
│  │                                                    │                      │
│  │  - AWS Clients (DynamoDB, Bedrock)                │                      │
│  │  - Configuration Service (.agentify/config.json)   │                      │
│  │  - Event Stream Service (stdout + DynamoDB merge)  │                      │
│  │  - Workflow Trigger Service                        │                      │
│  └────────────────────────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Extension Structure

```
agentify/
├── src/
│   ├── extension.ts              # Single activation point
│   ├── panels/
│   │   ├── ideationWizard/       # Wizard UI components
│   │   │   ├── IdeationWizardPanel.ts
│   │   │   └── webview/          # React app for wizard
│   │   └── demoViewer/           # Viewer UI components
│   │       ├── DemoViewerPanel.ts
│   │       └── webview/          # React app for viewer
│   ├── services/                 # Shared services
│   │   ├── awsClients.ts         # DynamoDB, Bedrock clients
│   │   ├── configService.ts      # .agentify/config.json reader
│   │   ├── eventStreamService.ts # Merged event stream
│   │   ├── workflowTrigger.ts    # Local/AgentCore/HTTP triggers
│   │   └── dynamoDbPoller.ts     # DynamoDB event polling
│   └── shared/                   # Common utilities
│       ├── types.ts              # TypeScript interfaces
│       └── constants.ts          # Shared constants
├── infrastructure/
│   └── dynamodb-table.yaml       # CloudFormation template
└── package.json
```

## Event Flow Architecture

### Local Mode (Development)

```
┌─────────────┐    spawn    ┌─────────────┐   stream_async   ┌─────────────┐
│Demo Viewer  │────────────►│agents/      │─────────────────►│  stdout     │
│             │             │main.py      │                  │  (JSON)     │
└──────┬──────┘             └──────┬──────┘                  └──────┬──────┘
       │                           │                                │
       │                           │  @agent_span                   │
       │                           │  @tool_call                    │
       │                           ▼                                │
       │                    ┌─────────────┐                         │
       │  poll 500ms        │  DynamoDB   │                         │
       │◄───────────────────│  (events)   │                         │
       │                    └─────────────┘                         │
       │                                                            │
       │◄───────────────────────────────────────────────────────────┘
       │                    real-time stdout events
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Merged Event Stream                               │
│                                                                      │
│  stdout events (real-time):     DynamoDB events (polled):           │
│  - graph_structure              - tool_call (start/complete)        │
│  - node_start                   - tool_result                       │
│  - node_stop                    - workflow_outcome                  │
│  - workflow_complete                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

**Local Mode Characteristics:**
- Real-time graph updates via stdout JSON streaming
- Tool call details from DynamoDB polling (500ms interval)
- Best for development and demos with visual feedback

### AgentCore Mode (Production)

```
┌─────────────┐   InvokeAgent   ┌─────────────┐
│Demo Viewer  │────────────────►│  AgentCore  │
│             │                 │  Runtime    │
└──────┬──────┘                 └──────┬──────┘
       │                               │
       │                               │  @agent_span
       │                               │  @tool_call
       │                               ▼
       │  poll 500ms            ┌─────────────┐
       │◄───────────────────────│  DynamoDB   │
       │                        │  (events)   │
       │                        └─────────────┘
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DynamoDB Event Stream                             │
│                                                                      │
│  All events via polling:                                            │
│  - agent_start / agent_end                                          │
│  - tool_call (start/complete)                                       │
│  - tool_result                                                      │
│  - workflow_outcome                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

**AgentCore Mode Characteristics:**
- All events come from DynamoDB polling
- Slightly slower graph updates (500ms polling interval)
- Production-ready deployment

## Configuration Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Project Initialization                            │
│  Command: "Agentify: Initialize Project"                            │
│                                                                      │
│  1. Check AWS credentials (default provider chain)                  │
│  2. Check/Create DynamoDB table                                     │
│  3. Create .agentify/config.json (infrastructure section)           │
│  4. Create .kiro/steering/agentify-integration.md                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Ideation Wizard                                   │
│                                                                      │
│  Reads:  .agentify/config.json                                      │
│  Writes: project.name, project.valueMap, project.industry           │
│          workflow.orchestrationPattern                               │
│          Generates Kiro specs                                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Kiro Implementation                               │
│                                                                      │
│  Reads:  .kiro/steering/agentify-integration.md                     │
│  Writes: Agent code with decorators                                  │
│          workflow.triggerType, workflow.triggerConfig               │
│          workflow.agents, workflow.edges                             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Demo Viewer                                       │
│                                                                      │
│  Reads:  .agentify/config.json (entire file)                        │
│          - infrastructure.dynamodb for event polling                │
│          - workflow.triggerType for execution mode                  │
│          - workflow.agents/edges for graph layout                   │
│  Writes: Nothing (read-only)                                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Integration Points

### 1. Extension ↔ Python (Local Mode)

```
Demo Viewer                          Python Subprocess
     │                                      │
     │  spawn with args:                    │
     │  --prompt "user input"               │
     │  --workflow-id "wf-abc123"           │
     ├─────────────────────────────────────►│
     │                                      │
     │  env vars:                           │
     │  AGENTIFY_DYNAMODB_TABLE             │
     │  AGENTIFY_AWS_REGION                 │
     │  AGENTIFY_WORKFLOW_ID                │
     │                                      │
     │  stdout: JSON events (line by line)  │
     │◄─────────────────────────────────────┤
     │                                      │
     │  exit code: 0 success, 1 failure     │
     │◄─────────────────────────────────────┤
```

### 2. Extension ↔ AgentCore (Production Mode)

```
Demo Viewer                          AgentCore Runtime
     │                                      │
     │  InvokeAgentCommand:                 │
     │  - agentId                           │
     │  - agentAliasId                      │
     │  - sessionId (workflow_id)           │
     │  - inputText (prompt)                │
     ├─────────────────────────────────────►│
     │                                      │
     │  Response: invocation metadata       │
     │◄─────────────────────────────────────┤
     │                                      │
     │  (poll DynamoDB for events)          │
```

### 3. Python ↔ DynamoDB

```
Python Agent                         DynamoDB
     │                                      │
     │  init_workflow(workflow_id, table)   │
     ├─────────────────────────────────────►│
     │                                      │
     │  @agent_span: agent_start/agent_end  │
     ├─────────────────────────────────────►│
     │                                      │
     │  @tool_call: tool_call events        │
     ├─────────────────────────────────────►│
     │                                      │
     │  workflow_outcome: final status      │
     ├─────────────────────────────────────►│
```

## DynamoDB Event Schema

| Attribute | Type | Description |
|-----------|------|-------------|
| `workflow_id` | String (PK) | Unique workflow execution ID |
| `timestamp` | Number (SK) | Epoch milliseconds |
| `event_type` | String | `agent_start`, `agent_end`, `tool_call`, `workflow_outcome` |
| `agent_name` | String | Name of the agent that emitted the event |
| `payload` | Map | Event-specific data (JSON) |
| `ttl` | Number | Unix timestamp for automatic deletion (24 hours) |

## Security Considerations

### Credential Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AWS Credential Chain                              │
│                                                                      │
│  Extension:                                                          │
│  1. Kiro AWS Explorer integration (if available)                    │
│  2. Environment variables (AWS_ACCESS_KEY_ID, etc.)                 │
│  3. AWS config files (~/.aws/credentials)                           │
│  4. IAM role (if running on AWS)                                    │
│                                                                      │
│  Python Subprocess:                                                  │
│  - Inherits credentials from extension environment                  │
│  - Uses boto3 default credential chain                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Required IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:DescribeTable",
        "dynamodb:PutItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/agentify-workflow-events"
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    }
  ]
}
```

## Performance Characteristics

| Operation | Target Latency | Notes |
|-----------|---------------|-------|
| UI Response | < 100ms | React rendering |
| stdout Event | < 10ms | Real-time streaming |
| DynamoDB Poll | < 500ms | Polling interval |
| Graph Update | < 1s | Node status changes |
| Bedrock Response | < 5s | Claude API calls |
