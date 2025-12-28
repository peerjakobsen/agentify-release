/**
 * Steering File Template
 * Contains the template content for .kiro/steering/agentify-integration.md
 *
 * This file provides integration instructions for Kiro AI to understand
 * how to work with Agentify's workflow observability system.
 */

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Directory path for steering files (relative to workspace root)
 */
export const STEERING_DIR_PATH = '.kiro/steering';

/**
 * File name for Agentify integration steering file
 */
export const STEERING_FILE_NAME = 'agentify-integration.md';

/**
 * Full relative path to the steering file
 */
export const STEERING_FILE_PATH = `${STEERING_DIR_PATH}/${STEERING_FILE_NAME}`;

/**
 * Template content for the Agentify integration steering file
 * Provides guidance for Kiro AI on working with Agentify observability
 */
export const STEERING_FILE_CONTENT = `# Agentify Integration

This project uses Agentify for AI agent workflow observability. The orchestration runs locally via \`agents/main.py\`, which calls agents deployed to Bedrock AgentCore via Strands SDK.

## Architecture Overview

\`\`\`
┌─────────────────┐     spawns      ┌─────────────────┐    Bedrock APIs    ┌─────────────────┐
│   Demo Viewer   │────────────────►│  agents/main.py │───────────────────►│   AgentCore     │
│   (VS Code)     │                 │  (local Python) │                    │   (AWS Cloud)   │
└─────────────────┘                 └─────────────────┘                    └─────────────────┘
        │                                   │
        │◄──────────────────────────────────┤ stdout events (real-time)
        │                                   │
        └───────────────────────────────────┴──► DynamoDB (persistent events)
\`\`\`

## Execution Identity (Hybrid Approach)

Each workflow run has TWO identifiers:

| Identifier | Format | Purpose |
|------------|--------|---------|
| \`workflow_id\` | \`wf-{8-char-uuid}\` | Short, human-readable. DynamoDB PK, UI display |
| \`trace_id\` | 32-char hex (OTEL) | OpenTelemetry correlation. Links to CloudWatch X-Ray |

## CLI Interface

The Demo Viewer spawns \`main.py\` with these arguments:

\`\`\`bash
python agents/main.py \\
  --prompt "Generate Q3 replenishment plan" \\
  --workflow-id "wf-abc12345" \\
  --trace-id "80e1afed08e019fc1110464cfa66635c"
\`\`\`

### Argument Parsing

\`\`\`python
import argparse

def parse_args():
    parser = argparse.ArgumentParser(description='Agentify Workflow Orchestrator')
    parser.add_argument('--prompt', required=True, help='User prompt to process')
    parser.add_argument('--workflow-id', required=True, help='Short workflow ID (wf-xxx)')
    parser.add_argument('--trace-id', required=True, help='OTEL trace ID (32-char hex)')
    return parser.parse_args()
\`\`\`

### Environment Variables

The extension also passes these environment variables:

| Variable | Description |
|----------|-------------|
| \`AGENTIFY_TABLE_NAME\` | DynamoDB table name for events |
| \`AGENTIFY_TABLE_REGION\` | AWS region for DynamoDB |

## OpenTelemetry Integration

Use Strands SDK's native \`StrandsTelemetry\` for tracing:

\`\`\`python
from strands import Agent
from strands.telemetry import StrandsTelemetry

# Initialize telemetry with trace_id from CLI
telemetry = StrandsTelemetry(
    service_name="agentify-workflow",
    trace_id=args.trace_id  # From --trace-id CLI arg
)

# Create agent with telemetry
agent = Agent(
    model="bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0",
    telemetry=telemetry
)
\`\`\`

## Event Streaming (Dual-Mode)

Events are emitted to TWO destinations:

### 1. stdout (Real-Time for Demo Viewer)

Print JSON lines to stdout for real-time graph visualization:

\`\`\`python
import json
import sys
from datetime import datetime

def emit_event(event_type: str, payload: dict, workflow_id: str, trace_id: str):
    event = {
        "workflow_id": workflow_id,
        "trace_id": trace_id,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "event_type": event_type,
        "payload": payload
    }
    print(json.dumps(event), flush=True)
\`\`\`

### 2. DynamoDB (Persistent Storage)

Write events to DynamoDB for historical replay:

\`\`\`python
import boto3
import os
import time

dynamodb = boto3.resource('dynamodb', region_name=os.environ['AGENTIFY_TABLE_REGION'])
table = dynamodb.Table(os.environ['AGENTIFY_TABLE_NAME'])

def write_event(event_type: str, payload: dict, workflow_id: str, trace_id: str, agent_name: str = None):
    table.put_item(Item={
        'workflow_id': workflow_id,
        'timestamp': int(time.time() * 1000),  # Epoch milliseconds
        'trace_id': trace_id,
        'event_type': event_type,
        'agent_name': agent_name or 'orchestrator',
        'payload': payload,
        'ttl': int(time.time()) + (7 * 24 * 60 * 60)  # 7 days
    })
\`\`\`

## Event Types

| Event Type | Description | Source |
|------------|-------------|--------|
| \`graph_structure\` | Workflow topology at start | stdout only |
| \`node_start\` | Agent/node beginning execution | Both |
| \`node_stream\` | Streaming content from node | stdout only |
| \`node_stop\` | Agent/node completed | Both |
| \`tool_call\` | Tool invocation started | DynamoDB |
| \`tool_result\` | Tool invocation completed | DynamoDB |
| \`workflow_complete\` | Workflow finished successfully | Both |
| \`workflow_error\` | Workflow failed with error | Both |

## Strands stream_async Integration

When using Strands multi-agent patterns with \`stream_async()\`:

\`\`\`python
from strands.multiagent import Graph

async def run_workflow(prompt: str, workflow_id: str, trace_id: str):
    graph = Graph(agents=[...], edges=[...])

    # Emit graph structure first
    emit_event("graph_structure", {
        "nodes": [{"id": a.name, "role": a.role} for a in graph.agents],
        "edges": [{"from": e.source, "to": e.target} for e in graph.edges]
    }, workflow_id, trace_id)

    # Stream events
    async for event in graph.stream_async(prompt):
        if event.type == "multiagent_node_start":
            emit_event("node_start", {"node": event.node_name}, workflow_id, trace_id)
        elif event.type == "multiagent_node_stream":
            emit_event("node_stream", {"node": event.node_name, "chunk": event.content}, workflow_id, trace_id)
        elif event.type == "multiagent_node_stop":
            emit_event("node_stop", {"node": event.node_name, "output": event.output}, workflow_id, trace_id)
        elif event.type == "multiagent_result":
            emit_event("workflow_complete", {"result": event.result}, workflow_id, trace_id)
\`\`\`

## Configuration Reference

The \`.agentify/config.json\` file contains:

\`\`\`json
{
  "version": "1.0.0",
  "project": {
    "name": "My Project",
    "valueMap": "Cost Reduction",
    "industry": "retail"
  },
  "infrastructure": {
    "dynamodb": {
      "tableName": "agentify-events-xxx",
      "tableArn": "arn:aws:dynamodb:...",
      "region": "us-east-1"
    },
    "stackName": "agentify-workflow-events-xxx"
  },
  "workflow": {
    "entryScript": "agents/main.py",
    "pythonPath": ".venv/bin/python",
    "orchestrationPattern": "graph",
    "agents": [
      { "id": "planner", "name": "Planner Agent", "role": "planning" }
    ],
    "edges": [
      { "from": "planner", "to": "executor" }
    ]
  },
  "observability": {
    "enableTracing": true,
    "xrayConsoleUrl": "https://console.aws.amazon.com/xray/home?region={region}#/traces/{trace_id}"
  },
  "aws": {
    "profile": "your-aws-profile"
  }
}
\`\`\`

## Best Practices

1. **Emit graph_structure first**: Always emit the workflow topology before any node events
2. **Use consistent IDs**: Pass workflow_id and trace_id to all event emissions
3. **Flush stdout**: Always use \`flush=True\` when printing events for real-time streaming
4. **Handle errors gracefully**: Emit \`workflow_error\` event before exiting on failure
5. **Include timestamps**: Use ISO8601 format for stdout, epoch milliseconds for DynamoDB

## Debugging

View X-Ray traces:
\`\`\`bash
aws xray get-trace-summaries --start-time $(date -u -v-1H +%s) --end-time $(date -u +%s)
\`\`\`

Query DynamoDB events:
\`\`\`bash
aws dynamodb query \\
  --table-name $AGENTIFY_TABLE_NAME \\
  --key-condition-expression "workflow_id = :wf" \\
  --expression-attribute-values '{":wf":{"S":"wf-abc12345"}}'
\`\`\`
`;

/**
 * Result of steering file creation
 */
export interface SteeringFileResult {
  success: boolean;
  skipped: boolean;
  message: string;
}

/**
 * Create the steering file in the workspace
 * Creates the .kiro/steering/ directory if it doesn't exist
 * Prompts user before overwriting an existing file
 *
 * @param workspaceRoot Absolute path to workspace root
 * @returns Result indicating success, skip, or error
 */
export async function createSteeringFile(workspaceRoot: string): Promise<SteeringFileResult> {
  const steeringDirPath = path.join(workspaceRoot, STEERING_DIR_PATH);
  const steeringFilePath = path.join(workspaceRoot, STEERING_FILE_PATH);

  const dirUri = vscode.Uri.file(steeringDirPath);
  const fileUri = vscode.Uri.file(steeringFilePath);

  // Check if file already exists
  let fileExists = false;
  try {
    await vscode.workspace.fs.stat(fileUri);
    fileExists = true;
  } catch {
    // File doesn't exist, which is fine
  }

  // Prompt before overwriting
  if (fileExists) {
    const choice = await vscode.window.showQuickPick(
      [
        { label: 'Overwrite', description: 'Replace existing steering file' },
        { label: 'Skip', description: 'Keep existing steering file' },
      ],
      {
        placeHolder: `${STEERING_FILE_NAME} already exists. What would you like to do?`,
        ignoreFocusOut: true,
      }
    );

    if (!choice || choice.label === 'Skip') {
      return {
        success: true,
        skipped: true,
        message: 'Steering file creation skipped (file already exists)',
      };
    }
  }

  // Create directory structure if needed
  try {
    await vscode.workspace.fs.createDirectory(dirUri);
  } catch {
    // Directory might already exist, that's fine
  }

  // Write the steering file
  try {
    const content = Buffer.from(STEERING_FILE_CONTENT, 'utf-8');
    await vscode.workspace.fs.writeFile(fileUri, content);

    return {
      success: true,
      skipped: false,
      message: fileExists ? 'Steering file overwritten' : 'Steering file created',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      skipped: false,
      message: `Failed to create steering file: ${message}`,
    };
  }
}
