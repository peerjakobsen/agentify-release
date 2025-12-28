/**
 * Initialize Project Command Handler
 * Implements the "Agentify: Initialize Project" command
 *
 * This command:
 * 1. Checks for existing config (idempotency)
 * 2. Prompts for AWS profile selection
 * 3. Prompts for AWS region selection
 * 4. Validates credentials
 * 5. Deploys CloudFormation stack
 * 6. Generates .agentify/config.json
 * 7. Creates .kiro/steering/agentify-integration.md
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getProfileDiscoveryService } from '../services/profileDiscoveryService';
import { getConfigService } from '../services/configService';
import {
  getDefaultCredentialProvider,
  validateCredentials,
} from '../services/credentialProvider';
import {
  CloudFormationService,
  sanitizeStackName,
  getCloudFormationTemplate,
} from '../services/cloudFormationService';
import { createSteeringFile, STEERING_FILE_PATH } from '../templates/steeringFile';
import type { AgentifyConfig } from '../types';

/**
 * Common AWS regions for QuickPick selection
 */
export const DEFAULT_REGIONS = [
  { label: 'us-east-1', description: 'US East (N. Virginia)' },
  { label: 'us-west-2', description: 'US West (Oregon)' },
  { label: 'eu-west-1', description: 'Europe (Ireland)' },
  { label: 'eu-central-1', description: 'Europe (Frankfurt)' },
  { label: 'ap-northeast-1', description: 'Asia Pacific (Tokyo)' },
  { label: 'ap-southeast-1', description: 'Asia Pacific (Singapore)' },
];

/**
 * Profile selection item for QuickPick
 */
interface ProfileQuickPickItem extends vscode.QuickPickItem {
  profile: string | undefined;
}

/**
 * Region selection item for QuickPick
 */
interface RegionQuickPickItem extends vscode.QuickPickItem {
  label: string;
}

/**
 * Result of idempotency check
 */
type IdempotencyResult = 'continue' | 'reinitialize' | 'skip' | 'cancelled';

/**
 * Result of initialization command
 * Contains information for post-initialization handling
 */
export interface InitializationResult {
  success: boolean;
  tableName?: string;
  region?: string;
  steeringFileCreated?: boolean;
}

/**
 * Check for existing configuration and prompt user
 * @returns 'continue' if no config exists, 'reinitialize' if user wants to reinit,
 *          'skip' if user wants to skip, 'cancelled' if user cancelled
 */
export async function checkExistingConfig(): Promise<IdempotencyResult> {
  const configService = getConfigService();
  if (!configService) {
    return 'continue';
  }

  const isInitialized = await configService.isInitialized();
  if (!isInitialized) {
    return 'continue';
  }

  // Config exists - prompt user
  const items = [
    {
      label: 'Reinitialize project',
      description: 'Deploy new infrastructure (existing stack will remain)',
    },
    {
      label: 'Skip initialization',
      description: 'Keep existing configuration',
    },
  ];

  const selection = await vscode.window.showQuickPick(items, {
    placeHolder: 'Project already initialized. What would you like to do?',
    ignoreFocusOut: true,
  });

  if (!selection) {
    return 'cancelled';
  }

  if (selection.label === 'Reinitialize project') {
    configService.clearCache();
    return 'reinitialize';
  }

  return 'skip';
}

/**
 * Show AWS profile selection UI
 * @returns Selected profile name or undefined for default credentials
 */
export async function showProfileSelection(): Promise<string | undefined | null> {
  const profileService = getProfileDiscoveryService();
  const profiles = await profileService.listAvailableProfiles();

  // Build QuickPick items with "Use default" first
  const items: ProfileQuickPickItem[] = [
    {
      label: 'Use default credentials',
      description: 'Uses AWS_PROFILE env var or default credential chain',
      profile: undefined,
    },
  ];

  // Add discovered profiles
  for (const profile of profiles) {
    items.push({
      label: profile,
      description: `Profile from ~/.aws/config or ~/.aws/credentials`,
      profile: profile,
    });
  }

  const selection = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select AWS profile for credential resolution',
    ignoreFocusOut: true,
  });

  if (!selection) {
    return null; // User cancelled
  }

  return selection.profile;
}

/**
 * Show AWS region selection UI
 * @returns Selected region or null if cancelled
 */
export async function showRegionSelection(): Promise<string | null> {
  // Get default region from VS Code settings
  const config = vscode.workspace.getConfiguration('agentify');
  const defaultRegion = config.get<string>('aws.region', 'us-east-1');

  // Sort regions with default first
  const sortedRegions = [...DEFAULT_REGIONS].sort((a, b) => {
    if (a.label === defaultRegion) return -1;
    if (b.label === defaultRegion) return 1;
    return 0;
  });

  const selection = await vscode.window.showQuickPick<RegionQuickPickItem>(sortedRegions, {
    placeHolder: 'Select AWS region for infrastructure deployment',
    ignoreFocusOut: true,
  });

  if (!selection) {
    return null; // User cancelled
  }

  return selection.label;
}

/**
 * Validate AWS credentials with selected profile
 * @param profile Profile name or undefined for default
 * @returns true if valid, false if invalid
 */
async function validateSelectedCredentials(profile: string | undefined): Promise<boolean> {
  try {
    const credentialProvider = getDefaultCredentialProvider();
    credentialProvider.setProfile(profile);
    await validateCredentials(credentialProvider);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Check for SSO token expiration
    if (message.toLowerCase().includes('sso') || message.toLowerCase().includes('token')) {
      vscode.window.showErrorMessage(
        `AWS SSO token expired. Run 'aws sso login${profile ? ` --profile ${profile}` : ''}' to refresh.`,
        'Learn More'
      ).then((selection) => {
        if (selection === 'Learn More') {
          vscode.env.openExternal(
            vscode.Uri.parse('https://docs.aws.amazon.com/cli/latest/userguide/sso-using-profile.html')
          );
        }
      });
    } else {
      vscode.window.showErrorMessage(
        `Failed to validate AWS credentials: ${message}`
      );
    }

    return false;
  }
}

/**
 * Deploy CloudFormation stack with progress notification
 * @param stackName Name for the stack
 * @param region AWS region
 * @param extensionPath Path to extension root
 * @returns Stack outputs or null on failure
 */
async function deployCloudFormationStack(
  stackName: string,
  region: string,
  extensionPath: string
): Promise<{ tableName: string; tableArn: string } | null> {
  // Create CloudFormation service
  const cfService = new CloudFormationService({ region });

  // Read template
  let template: string;
  try {
    template = getCloudFormationTemplate(extensionPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to read CloudFormation template: ${message}`);
    return null;
  }

  // Generate table name from stack name
  const tableName = stackName.replace('agentify-workflow-events-', 'agentify-events-');

  try {
    // Deploy with progress
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Agentify: Deploying infrastructure',
        cancellable: true,
      },
      async (progress, token) => {
        // Check for cancellation
        if (token.isCancellationRequested) {
          return null;
        }

        progress.report({ message: 'Creating CloudFormation stack...' });

        // Create stack
        const stackId = await cfService.deployStack(stackName, template, tableName);

        // Check for cancellation
        if (token.isCancellationRequested) {
          vscode.window.showWarningMessage(
            'Deployment cancelled. Note: Stack creation may continue in AWS. Check AWS Console to clean up if needed.'
          );
          return null;
        }

        progress.report({ message: 'Waiting for stack creation to complete...' });

        // Wait for completion with 5-second polling
        await cfService.waitForStackComplete(stackId, 5000);

        progress.report({ message: 'Retrieving stack outputs...' });

        // Get outputs
        const outputs = await cfService.getStackOutputs(stackId);

        return outputs;
      }
    );

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Provide user-friendly error messages
    if (message.includes('already exists')) {
      vscode.window.showErrorMessage(
        `Stack '${stackName}' already exists. Delete it from AWS Console or choose a different workspace name.`,
        'Open AWS Console'
      ).then((selection) => {
        if (selection === 'Open AWS Console') {
          vscode.env.openExternal(
            vscode.Uri.parse(`https://${region}.console.aws.amazon.com/cloudformation/home?region=${region}#/stacks`)
          );
        }
      });
    } else if (message.includes('Access denied') || message.includes('permissions')) {
      vscode.window.showErrorMessage(
        `Access denied when creating CloudFormation stack. Ensure your AWS credentials have cloudformation:CreateStack and dynamodb:CreateTable permissions.`
      );
    } else if (message.includes('timed out')) {
      vscode.window.showErrorMessage(
        `Stack creation timed out. Check AWS Console for status. The stack may still complete successfully.`,
        'Open AWS Console'
      ).then((selection) => {
        if (selection === 'Open AWS Console') {
          vscode.env.openExternal(
            vscode.Uri.parse(`https://${region}.console.aws.amazon.com/cloudformation/home?region=${region}#/stacks`)
          );
        }
      });
    } else {
      vscode.window.showErrorMessage(`CloudFormation deployment failed: ${message}`);
    }

    return null;
  }
}

/**
 * Generate config.json with deployment results
 * @param tableName DynamoDB table name
 * @param tableArn DynamoDB table ARN
 * @param region AWS region
 * @param profile AWS profile (undefined for default)
 * @returns true on success, false on failure
 */
async function generateConfig(
  tableName: string,
  tableArn: string,
  region: string,
  profile: string | undefined
): Promise<boolean> {
  const configService = getConfigService();
  if (!configService) {
    vscode.window.showErrorMessage('No workspace folder open. Cannot create configuration.');
    return false;
  }

  // Build config object with placeholder values for workflow configuration
  const config: AgentifyConfig = {
    version: '1.0.0',
    project: {
      name: 'My Agentify Project',
      valueMap: 'Describe the value this project provides',
      industry: 'tech',
    },
    infrastructure: {
      dynamodb: {
        tableName,
        tableArn,
        region,
      },
    },
    workflow: {
      entryScript: 'agents/main.py',
      pythonPath: '.venv/bin/python',
      orchestrationPattern: 'graph',
      agents: [],
      edges: [],
    },
  };

  // Add profile if non-default was selected
  if (profile) {
    config.aws = { profile };
  }

  try {
    await configService.createConfig(config);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to create configuration: ${message}`);
    return false;
  }
}

/**
 * Get workspace name for stack naming
 * @returns Workspace name or 'default'
 */
function getWorkspaceName(): string {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].name;
  }
  return 'default';
}

/**
 * Get workspace root path
 * @returns Workspace root path or null if no workspace is open
 */
function getWorkspaceRoot(): string | null {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }
  return null;
}

/**
 * Show success notification with initialization summary
 * Includes table name, region, and offers to open the steering file
 * @param tableName DynamoDB table name
 * @param region AWS region
 * @param steeringFileCreated Whether the steering file was created
 * @param workspaceRoot Workspace root path for opening steering file
 */
export async function showSuccessNotification(
  tableName: string,
  region: string,
  steeringFileCreated: boolean,
  workspaceRoot: string | null
): Promise<void> {
  // Build summary message with table name and region
  const summaryMessage = `Agentify: Project initialized successfully! Table: '${tableName}' in region '${region}'.`;

  // Determine available actions based on steering file status
  const actions: string[] = [];
  if (steeringFileCreated && workspaceRoot) {
    actions.push('Open Steering File');
  }

  // Show message with optional action
  const selection = await vscode.window.showInformationMessage(
    summaryMessage,
    ...actions
  );

  // Handle action selection
  if (selection === 'Open Steering File' && workspaceRoot) {
    const steeringFilePath = path.join(workspaceRoot, STEERING_FILE_PATH);
    const steeringFileUri = vscode.Uri.file(steeringFilePath);
    try {
      const doc = await vscode.workspace.openTextDocument(steeringFileUri);
      await vscode.window.showTextDocument(doc);
    } catch (error) {
      console.warn('[Agentify] Failed to open steering file:', error);
    }
  }
}

/**
 * Main command handler for "Agentify: Initialize Project"
 * @param context Extension context for accessing extension path
 * @returns InitializationResult with success status and details
 */
export async function handleInitializeProject(
  context: vscode.ExtensionContext
): Promise<InitializationResult> {
  // Step 1: Check for existing config (idempotency)
  const idempotencyResult = await checkExistingConfig();

  if (idempotencyResult === 'cancelled') {
    return { success: false };
  }

  if (idempotencyResult === 'skip') {
    vscode.window.showInformationMessage('Agentify: Initialization skipped. Using existing configuration.');
    return { success: false };
  }

  // Step 2: Select AWS profile
  const profile = await showProfileSelection();

  if (profile === null) {
    // User cancelled
    return { success: false };
  }

  // Step 3: Select AWS region
  const region = await showRegionSelection();

  if (!region) {
    // User cancelled
    return { success: false };
  }

  // Step 4: Validate credentials
  const credentialsValid = await validateSelectedCredentials(profile);

  if (!credentialsValid) {
    return { success: false };
  }

  // Step 5: Generate stack name from workspace
  const workspaceName = getWorkspaceName();
  const stackName = sanitizeStackName(workspaceName);

  // Step 6: Deploy CloudFormation stack
  const deploymentResult = await deployCloudFormationStack(
    stackName,
    region,
    context.extensionPath
  );

  if (!deploymentResult) {
    return { success: false };
  }

  // Step 7: Generate config.json
  const configCreated = await generateConfig(
    deploymentResult.tableName,
    deploymentResult.tableArn,
    region,
    profile
  );

  if (!configCreated) {
    return { success: false };
  }

  // Step 8: Create steering file (non-blocking - errors don't fail initialization)
  let steeringFileCreated = false;
  const workspaceRoot = getWorkspaceRoot();
  if (workspaceRoot) {
    try {
      const steeringResult = await createSteeringFile(workspaceRoot);
      if (steeringResult.success && !steeringResult.skipped) {
        steeringFileCreated = true;
      }
    } catch (error) {
      // Log error but don't fail initialization
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn('[Agentify] Steering file creation error:', message);
    }
  }

  // Step 9: Show success notification with summary
  await showSuccessNotification(
    deploymentResult.tableName,
    region,
    steeringFileCreated,
    workspaceRoot
  );

  // Return success result for post-initialization handling
  return {
    success: true,
    tableName: deploymentResult.tableName,
    region,
    steeringFileCreated,
  };
}
