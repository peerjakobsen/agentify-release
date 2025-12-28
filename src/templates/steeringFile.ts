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

This project uses Agentify for AI agent workflow observability. Events from agent executions are stored in AWS DynamoDB for visualization and analysis.

## Event Storage Pattern

Agentify stores workflow events in DynamoDB with the following structure:

- **Table Name**: Configured in \`.agentify/config.json\` under \`infrastructure.dynamodb.tableName\`
- **Partition Key**: \`sessionId\` - Groups events by workflow execution session
- **Sort Key**: \`eventId\` - Unique identifier with timestamp prefix for ordering
- **TTL**: Events expire after 7 days (configurable)

## Python Observability Decorators

When writing Python agent code, use the \`agentify_observability\` decorators to automatically emit events:

\`\`\`python
from agentify_observability import track_agent, track_step

@track_agent('my-agent')
def my_agent_function(input_data):
    # Agent logic here
    return result

@track_step('preprocessing')
def preprocess_data(data):
    # Step logic here
    return processed_data
\`\`\`

### Available Decorators

- \`@track_agent(name)\` - Wraps an agent function to emit start/complete/error events
- \`@track_step(name)\` - Wraps a processing step within an agent
- \`@track_tool(name)\` - Wraps external tool invocations (API calls, file ops, etc.)
- \`@track_decision(name)\` - Captures decision points with context

## Event Types

Events follow this schema pattern:

\`\`\`json
{
  "sessionId": "session-uuid",
  "eventId": "1703721600000-uuid",
  "eventType": "agent_start|agent_complete|agent_error|step_*|tool_*|decision_*",
  "agentName": "agent-identifier",
  "timestamp": "ISO8601",
  "data": {
    "input": {},
    "output": {},
    "metadata": {}
  }
}
\`\`\`

## Configuration Reference

The \`.agentify/config.json\` file contains:

- \`infrastructure.dynamodb\` - DynamoDB table connection details
- \`workflow.orchestrationPattern\` - How agents are coordinated (graph, chain, etc.)
- \`workflow.agents\` - List of agents in the workflow
- \`workflow.edges\` - Connections between agents (for graph patterns)

## Best Practices

1. **Consistent Naming**: Use kebab-case for agent and step names
2. **Meaningful Steps**: Break complex agents into observable steps
3. **Error Context**: Include relevant context in error events
4. **Session Isolation**: Each workflow run should use a unique sessionId
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
