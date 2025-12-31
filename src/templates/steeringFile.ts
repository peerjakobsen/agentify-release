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

This steering file defines the **mandatory contract** for all Kiro-generated agent code. The Agentify Demo Viewer spawns \`agents/main.py\` as a subprocess and expects events in the exact formats defined below.

> **IMPORTANT**: All generated agents MUST follow these patterns exactly. The Demo Viewer will not function correctly if events don't match these schemas.

---

## 1. CLI Contract

The Demo Viewer spawns \`agents/main.py\` with specific CLI arguments and environment variables.

### Required CLI Arguments

| Argument | Format | Description |
|----------|--------|-------------|
| \`--prompt\` | String | User prompt to process |
| \`--workflow-id\` | \`wf-{8-char}\` | Short workflow ID for UI display |
| \`--trace-id\` | 32-char hex | OTEL trace ID for X-Ray correlation |

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| \`AGENTIFY_TABLE_NAME\` | DynamoDB table name for persistent events |
| \`AWS_REGION\` | AWS region for DynamoDB table |

### Example: main.py Entry Point

\`\`\`python
#!/usr/bin/env python3
"""
Agentify Workflow Orchestrator
Generated entry point for multi-agent workflow execution.
"""

import argparse
import asyncio
import os
import sys

def parse_args():
    """Parse CLI arguments passed by Agentify Demo Viewer."""
    parser = argparse.ArgumentParser(
        description='Agentify Workflow Orchestrator',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        '--prompt',
        required=True,
        help='User prompt to process'
    )
    parser.add_argument(
        '--workflow-id',
        required=True,
        help='Short workflow ID (format: wf-xxxxxxxx)'
    )
    parser.add_argument(
        '--trace-id',
        required=True,
        help='OTEL trace ID for X-Ray correlation (32-char hex)'
    )
    return parser.parse_args()


def validate_environment():
    """Validate required environment variables are set."""
    required_vars = ['AGENTIFY_TABLE_NAME', 'AWS_REGION']
    missing = [var for var in required_vars if not os.environ.get(var)]
    if missing:
        raise EnvironmentError(f"Missing required environment variables: {', '.join(missing)}")
    return {
        'table_name': os.environ['AGENTIFY_TABLE_NAME'],
        'table_region': os.environ['AWS_REGION']
    }


async def main():
    args = parse_args()
    env = validate_environment()

    # Initialize workflow with IDs from CLI
    workflow_id = args.workflow_id
    trace_id = args.trace_id

    # Your workflow logic here...
    await run_workflow(args.prompt, workflow_id, trace_id, env)


if __name__ == '__main__':
    asyncio.run(main())
\`\`\`

---

## 2. Hybrid Identity Pattern

Each workflow run has **two identifiers** that must be included in every event:

| Identifier | Format | Purpose |
|------------|--------|---------|
| \`workflow_id\` | \`wf-{8-char-uuid}\` | Short, human-readable. DynamoDB partition key. UI display. |
| \`trace_id\` | 32-char hex (OTEL) | OpenTelemetry correlation. Links to CloudWatch X-Ray traces. |

### Why Two IDs?

- **workflow_id**: Optimized for humans and DynamoDB queries. Easy to read in logs and UI.
- **trace_id**: Standard OTEL format for distributed tracing. Enables X-Ray integration.

### Example IDs

\`\`\`python
workflow_id = "wf-a1b2c3d4"  # 8 chars after 'wf-'
trace_id = "80e1afed08e019fc1110464cfa66635c"  # 32 hex chars
\`\`\`

---

## 3. stdout Event Streaming (Real-Time)

stdout events power the real-time graph visualization in the Demo Viewer. Events are **JSON Lines** format (one JSON object per line).

### Event Schema

All stdout events follow this base schema:

\`\`\`json
{
  "workflow_id": "wf-a1b2c3d4",
  "trace_id": "80e1afed08e019fc1110464cfa66635c",
  "timestamp": 1703789456789,
  "type": "<event_type>",
  ...event-specific fields
}
\`\`\`

> **CRITICAL**: Use \`timestamp\` as epoch milliseconds (not ISO8601) and \`flush=True\` on all print statements.

### Event Types and Payloads

#### graph_structure (emit first, before any node events)

\`\`\`json
{
  "workflow_id": "wf-a1b2c3d4",
  "trace_id": "80e1afed08e019fc1110464cfa66635c",
  "timestamp": 1703789456789,
  "type": "graph_structure",
  "nodes": [
    { "id": "planner", "name": "Planner Agent", "role": "planning" },
    { "id": "executor", "name": "Executor Agent", "role": "execution" }
  ],
  "edges": [
    { "from": "planner", "to": "executor" }
  ],
  "entry_points": ["planner"]
}
\`\`\`

#### node_start

\`\`\`json
{
  "workflow_id": "wf-a1b2c3d4",
  "trace_id": "80e1afed08e019fc1110464cfa66635c",
  "timestamp": 1703789456800,
  "type": "node_start",
  "node_id": "planner"
}
\`\`\`

#### node_stream (streaming tokens)

\`\`\`json
{
  "workflow_id": "wf-a1b2c3d4",
  "trace_id": "80e1afed08e019fc1110464cfa66635c",
  "timestamp": 1703789456850,
  "type": "node_stream",
  "node_id": "planner",
  "data": "Analyzing inventory levels..."
}
\`\`\`

#### node_stop

\`\`\`json
{
  "workflow_id": "wf-a1b2c3d4",
  "trace_id": "80e1afed08e019fc1110464cfa66635c",
  "timestamp": 1703789457000,
  "type": "node_stop",
  "node_id": "planner",
  "status": "completed",
  "execution_time_ms": 200
}
\`\`\`

| status | Description |
|--------|-------------|
| \`completed\` | Node finished successfully |
| \`failed\` | Node encountered an error |
| \`skipped\` | Node was skipped (conditional logic) |

#### workflow_complete

\`\`\`json
{
  "workflow_id": "wf-a1b2c3d4",
  "trace_id": "80e1afed08e019fc1110464cfa66635c",
  "timestamp": 1703789460000,
  "type": "workflow_complete",
  "status": "completed",
  "execution_time_ms": 3211,
  "execution_order": ["planner", "executor"],
  "result": "## Replenishment Plan\\n\\n- SKU-001: Order 500 units...",
  "sources": ["SAP S/4HANA", "Databricks Lakehouse"]
}
\`\`\`

| status | Description |
|--------|-------------|
| \`completed\` | Workflow finished successfully |
| \`failed\` | Workflow failed (use workflow_error instead) |
| \`cancelled\` | Workflow was cancelled by user |

#### workflow_error

\`\`\`json
{
  "workflow_id": "wf-a1b2c3d4",
  "trace_id": "80e1afed08e019fc1110464cfa66635c",
  "timestamp": 1703789458000,
  "type": "workflow_error",
  "error_message": "Failed to connect to SAP system",
  "error_code": "SAP_CONNECTION_ERROR",
  "execution_time_ms": 1211
}
\`\`\`

### Python Helper: emit_stdout_event()

\`\`\`python
import json
import sys
import time
from typing import Any, Dict, List, Optional


def emit_stdout_event(
    event_type: str,
    workflow_id: str,
    trace_id: str,
    **kwargs
) -> None:
    """
    Emit a real-time event to stdout for Demo Viewer graph visualization.

    Args:
        event_type: One of graph_structure, node_start, node_stream, node_stop,
                   workflow_complete, workflow_error
        workflow_id: Short workflow ID (wf-xxxxxxxx)
        trace_id: OTEL trace ID (32-char hex)
        **kwargs: Event-specific fields
    """
    event = {
        'workflow_id': workflow_id,
        'trace_id': trace_id,
        'timestamp': int(time.time() * 1000),  # Epoch milliseconds
        'type': event_type,
        **kwargs
    }
    print(json.dumps(event), flush=True)


# Convenience functions for each event type

def emit_graph_structure(
    workflow_id: str,
    trace_id: str,
    nodes: List[Dict[str, str]],
    edges: List[Dict[str, str]],
    entry_points: List[str]
) -> None:
    """Emit workflow graph topology. Call this FIRST before any node events."""
    emit_stdout_event(
        'graph_structure',
        workflow_id,
        trace_id,
        nodes=nodes,
        edges=edges,
        entry_points=entry_points
    )


def emit_node_start(workflow_id: str, trace_id: str, node_id: str) -> None:
    """Emit when a node begins execution."""
    emit_stdout_event('node_start', workflow_id, trace_id, node_id=node_id)


def emit_node_stream(workflow_id: str, trace_id: str, node_id: str, data: str) -> None:
    """Emit streaming token data from a node."""
    emit_stdout_event('node_stream', workflow_id, trace_id, node_id=node_id, data=data)


def emit_node_stop(
    workflow_id: str,
    trace_id: str,
    node_id: str,
    status: str,
    execution_time_ms: int
) -> None:
    """Emit when a node completes. status: 'completed', 'failed', or 'skipped'."""
    emit_stdout_event(
        'node_stop',
        workflow_id,
        trace_id,
        node_id=node_id,
        status=status,
        execution_time_ms=execution_time_ms
    )


def emit_workflow_complete(
    workflow_id: str,
    trace_id: str,
    execution_time_ms: int,
    execution_order: List[str],
    result: Optional[str] = None,
    sources: Optional[List[str]] = None
) -> None:
    """Emit when workflow completes successfully."""
    emit_stdout_event(
        'workflow_complete',
        workflow_id,
        trace_id,
        status='completed',
        execution_time_ms=execution_time_ms,
        execution_order=execution_order,
        result=result,
        sources=sources
    )


def emit_workflow_error(
    workflow_id: str,
    trace_id: str,
    error_message: str,
    error_code: Optional[str] = None,
    execution_time_ms: Optional[int] = None
) -> None:
    """Emit when workflow fails with an error."""
    emit_stdout_event(
        'workflow_error',
        workflow_id,
        trace_id,
        error_message=error_message,
        error_code=error_code,
        execution_time_ms=execution_time_ms
    )
\`\`\`

---

## 4. DynamoDB Event Persistence

DynamoDB events provide persistent storage for tool calls, agent spans, and workflow history. These are polled by the Demo Viewer for detailed observability.

### Table Schema

| Attribute | Type | Description |
|-----------|------|-------------|
| \`workflow_id\` | String (PK) | Partition key |
| \`timestamp\` | Number (SK) | Sort key, epoch milliseconds |
| \`trace_id\` | String | OTEL trace ID |
| \`event_type\` | String | Event type discriminator |
| \`agent_name\` | String | Name of the agent |
| \`ttl\` | Number | TTL in epoch seconds (auto-cleanup) |
| ...payload fields | Various | Event-specific data |

### Event Types

#### tool_call

\`\`\`json
{
  "workflow_id": "wf-a1b2c3d4",
  "timestamp": 1703789456900,
  "trace_id": "80e1afed08e019fc1110464cfa66635c",
  "event_type": "tool_call",
  "agent_name": "planner",
  "system": "SAP",
  "operation": "get_inventory_levels",
  "input": { "warehouse_id": "WH-001", "sku_list": ["SKU-001", "SKU-002"] },
  "output": { "SKU-001": 150, "SKU-002": 42 },
  "status": "completed",
  "ttl": 1704394256
}
\`\`\`

| status | Description |
|--------|-------------|
| \`started\` | Tool call initiated |
| \`completed\` | Tool call succeeded |
| \`failed\` | Tool call failed |

#### agent_start

\`\`\`json
{
  "workflow_id": "wf-a1b2c3d4",
  "timestamp": 1703789456800,
  "trace_id": "80e1afed08e019fc1110464cfa66635c",
  "event_type": "agent_start",
  "agent_name": "planner",
  "role": "planning",
  "ttl": 1704394256
}
\`\`\`

#### agent_end

\`\`\`json
{
  "workflow_id": "wf-a1b2c3d4",
  "timestamp": 1703789457000,
  "trace_id": "80e1afed08e019fc1110464cfa66635c",
  "event_type": "agent_end",
  "agent_name": "planner",
  "role": "planning",
  "duration_ms": 200,
  "output": "Generated replenishment plan for 5 SKUs",
  "ttl": 1704394256
}
\`\`\`

### Python Helper: DynamoDB Event Writer

\`\`\`python
import boto3
import os
import time
from typing import Any, Dict, Optional


class DynamoDBEventWriter:
    """
    Write persistent events to DynamoDB for Agentify observability.
    Events are polled by the Demo Viewer for tool call tracking and history.
    """

    def __init__(self):
        self.table_name = os.environ['AGENTIFY_TABLE_NAME']
        self.table_region = os.environ['AWS_REGION']
        self.dynamodb = boto3.resource('dynamodb', region_name=self.table_region)
        self.table = self.dynamodb.Table(self.table_name)
        self._workflow_id: Optional[str] = None
        self._trace_id: Optional[str] = None

    def set_workflow_context(self, workflow_id: str, trace_id: str) -> None:
        """Set workflow context for all subsequent events."""
        self._workflow_id = workflow_id
        self._trace_id = trace_id

    def _write_event(self, event_type: str, **kwargs) -> None:
        """Write an event to DynamoDB with TTL."""
        if not self._workflow_id or not self._trace_id:
            raise RuntimeError("Call set_workflow_context() before writing events")

        now_ms = int(time.time() * 1000)
        ttl_seconds = int(time.time()) + (7 * 24 * 60 * 60)  # 7 days from now

        item = {
            'workflow_id': self._workflow_id,
            'timestamp': now_ms,
            'trace_id': self._trace_id,
            'event_type': event_type,
            'ttl': ttl_seconds,
            **kwargs
        }

        # Remove None values
        item = {k: v for k, v in item.items() if v is not None}

        self.table.put_item(Item=item)

    def emit_tool_call(
        self,
        agent_name: str,
        system: str,
        operation: str,
        input_params: Dict[str, Any],
        status: str = 'started',
        output: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None
    ) -> None:
        """
        Emit a tool call event.

        Args:
            agent_name: Name of the agent making the call
            system: External system being called (e.g., 'SAP', 'Databricks')
            operation: Operation name (e.g., 'get_inventory_levels')
            input_params: Input parameters for the tool
            status: 'started', 'completed', or 'failed'
            output: Output from the tool (if completed)
            error_message: Error message (if failed)
        """
        self._write_event(
            'tool_call',
            agent_name=agent_name,
            system=system,
            operation=operation,
            input=input_params,
            output=output,
            status=status,
            error_message=error_message
        )

    def emit_agent_start(self, agent_name: str, role: str) -> None:
        """Emit when an agent begins execution."""
        self._write_event(
            'agent_start',
            agent_name=agent_name,
            role=role
        )

    def emit_agent_end(
        self,
        agent_name: str,
        role: str,
        duration_ms: int,
        output: Optional[str] = None
    ) -> None:
        """Emit when an agent completes execution."""
        self._write_event(
            'agent_end',
            agent_name=agent_name,
            role=role,
            duration_ms=duration_ms,
            output=output
        )


# Global instance for convenience
_db_writer: Optional[DynamoDBEventWriter] = None


def get_db_writer() -> DynamoDBEventWriter:
    """Get the global DynamoDB event writer instance."""
    global _db_writer
    if _db_writer is None:
        _db_writer = DynamoDBEventWriter()
    return _db_writer
\`\`\`

---

## 5. Strands SDK Integration

Use Strands SDK for multi-agent orchestration with native OpenTelemetry support.

### StrandsTelemetry Setup

\`\`\`python
from strands import Agent
from strands.telemetry import StrandsTelemetry


def create_telemetry(trace_id: str) -> StrandsTelemetry:
    """
    Initialize Strands telemetry with the trace_id from CLI.
    This enables X-Ray correlation for distributed tracing.
    """
    return StrandsTelemetry(
        service_name="agentify-workflow",
        trace_id=trace_id,
        # Optional: Configure OTLP exporter for X-Ray
        otlp_endpoint=os.environ.get('OTEL_EXPORTER_OTLP_ENDPOINT')
    )


def create_agent(name: str, role: str, telemetry: StrandsTelemetry) -> Agent:
    """Create an agent with telemetry attached."""
    return Agent(
        name=name,
        model="bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0",
        system_prompt=f"You are a {role} agent...",
        telemetry=telemetry
    )
\`\`\`

### Complete Workflow with stream_async()

\`\`\`python
import asyncio
import time
from strands.multiagent import Graph, Edge


async def run_workflow(
    prompt: str,
    workflow_id: str,
    trace_id: str,
    env: dict
) -> None:
    """
    Execute multi-agent workflow with full observability.

    Emits events to both stdout (real-time) and DynamoDB (persistent).
    """
    workflow_start = time.time()
    execution_order = []
    node_start_times = {}

    # Initialize observability
    db_writer = get_db_writer()
    db_writer.set_workflow_context(workflow_id, trace_id)

    # Initialize telemetry
    telemetry = create_telemetry(trace_id)

    # Define agents
    planner = create_agent('planner', 'planning', telemetry)
    executor = create_agent('executor', 'execution', telemetry)

    # Define graph
    graph = Graph(
        agents=[planner, executor],
        edges=[Edge(source='planner', target='executor')]
    )

    try:
        # Emit graph structure FIRST
        emit_graph_structure(
            workflow_id,
            trace_id,
            nodes=[
                {'id': 'planner', 'name': 'Planner Agent', 'role': 'planning'},
                {'id': 'executor', 'name': 'Executor Agent', 'role': 'execution'}
            ],
            edges=[{'from': 'planner', 'to': 'executor'}],
            entry_points=['planner']
        )

        result = None
        sources = []

        # Stream events from graph execution
        async for event in graph.stream_async(prompt):
            if event.type == 'multiagent_node_start':
                node_id = event.node_name
                node_start_times[node_id] = time.time()
                execution_order.append(node_id)

                # Emit to both stdout and DynamoDB
                emit_node_start(workflow_id, trace_id, node_id)
                db_writer.emit_agent_start(node_id, event.node_role)

            elif event.type == 'multiagent_node_stream':
                emit_node_stream(workflow_id, trace_id, event.node_name, event.content)

            elif event.type == 'multiagent_tool_call':
                # Tool calls only go to DynamoDB
                db_writer.emit_tool_call(
                    agent_name=event.node_name,
                    system=event.tool_system,
                    operation=event.tool_name,
                    input_params=event.tool_input,
                    status='started'
                )

            elif event.type == 'multiagent_tool_result':
                db_writer.emit_tool_call(
                    agent_name=event.node_name,
                    system=event.tool_system,
                    operation=event.tool_name,
                    input_params=event.tool_input,
                    status='completed' if event.success else 'failed',
                    output=event.tool_output if event.success else None,
                    error_message=event.error if not event.success else None
                )
                # Track data sources
                if event.tool_system not in sources:
                    sources.append(event.tool_system)

            elif event.type == 'multiagent_node_stop':
                node_id = event.node_name
                duration_ms = int((time.time() - node_start_times[node_id]) * 1000)

                # Emit to both stdout and DynamoDB
                emit_node_stop(workflow_id, trace_id, node_id, 'completed', duration_ms)
                db_writer.emit_agent_end(node_id, event.node_role, duration_ms, event.output)

            elif event.type == 'multiagent_result':
                result = event.result

        # Workflow completed successfully
        total_time_ms = int((time.time() - workflow_start) * 1000)
        emit_workflow_complete(
            workflow_id,
            trace_id,
            execution_time_ms=total_time_ms,
            execution_order=execution_order,
            result=result,
            sources=sources if sources else None
        )

    except Exception as e:
        # Emit error event
        total_time_ms = int((time.time() - workflow_start) * 1000)
        emit_workflow_error(
            workflow_id,
            trace_id,
            error_message=str(e),
            error_code=type(e).__name__,
            execution_time_ms=total_time_ms
        )
        raise
\`\`\`

---

## 6. Configuration Reference

The \`.agentify/config.json\` file (created by "Agentify: Initialize Project") contains:

\`\`\`json
{
  "version": "1.0.0",
  "project": {
    "name": "Supply Chain Optimizer",
    "valueMap": "Cost Reduction",
    "industry": "retail"
  },
  "infrastructure": {
    "dynamodb": {
      "tableName": "agentify-events-abc12345",
      "tableArn": "arn:aws:dynamodb:us-east-1:123456789:table/agentify-events-abc12345",
      "region": "us-east-1"
    },
    "stackName": "agentify-workflow-events-abc12345"
  },
  "workflow": {
    "entryScript": "agents/main.py",
    "pythonPath": ".venv/bin/python",
    "orchestrationPattern": "graph",
    "agents": [
      { "id": "planner", "name": "Planner Agent", "role": "planning" },
      { "id": "executor", "name": "Executor Agent", "role": "execution" }
    ],
    "edges": [
      { "from": "planner", "to": "executor" }
    ]
  },
  "observability": {
    "enableTracing": true,
    "xrayConsoleUrl": "https://console.aws.amazon.com/xray/home?region={region}#/traces/{trace_id}"
  }
}
\`\`\`

---

## 7. Best Practices

### Event Emission Order

1. **Always emit \`graph_structure\` first** — The Demo Viewer needs topology before any node events
2. **Emit \`node_start\` before any tool calls** — Establishes the active agent context
3. **Emit \`node_stop\` after all tool calls complete** — Signals agent is done
4. **Always emit terminal event** — Either \`workflow_complete\` or \`workflow_error\`

### Stdout Requirements

- **Use \`flush=True\`** — Always flush stdout for real-time streaming
- **One JSON per line** — JSON Lines format, no pretty-printing
- **Epoch milliseconds** — Use \`int(time.time() * 1000)\` for timestamps

### DynamoDB Requirements

- **Include TTL** — 7 days from now in epoch seconds
- **Include both IDs** — Every event needs \`workflow_id\` AND \`trace_id\`
- **Use \`started\` → \`completed\`/\`failed\`** — Tool calls have lifecycle

### Error Handling

\`\`\`python
try:
    await run_workflow(...)
except Exception as e:
    emit_workflow_error(
        workflow_id,
        trace_id,
        error_message=str(e),
        error_code=type(e).__name__
    )
    sys.exit(1)
\`\`\`

---

## 8. Debugging

### View X-Ray Traces

\`\`\`bash
aws xray get-trace-summaries \\
  --start-time $(date -u -v-1H +%s) \\
  --end-time $(date -u +%s) \\
  --filter-expression "service(id(name: \\"agentify-workflow\\"))"
\`\`\`

### Query DynamoDB Events

\`\`\`bash
aws dynamodb query \\
  --table-name $AGENTIFY_TABLE_NAME \\
  --key-condition-expression "workflow_id = :wf" \\
  --expression-attribute-values '{":wf":{"S":"wf-a1b2c3d4"}}' \\
  --region $AWS_REGION
\`\`\`

### Test stdout Events Locally

\`\`\`bash
AGENTIFY_TABLE_NAME=test-table \\
AWS_REGION=us-east-1 \\
python agents/main.py \\
  --prompt "Test prompt" \\
  --workflow-id "wf-test1234" \\
  --trace-id "00000000000000000000000000000000"
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
