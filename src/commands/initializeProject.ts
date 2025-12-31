/**
 * Initialize Project Command Handler
 * Implements the "Agentify: Initialize Project" command
 *
 * This command:
 * 1. Checks for existing config (idempotency)
 * 2. Prompts for AWS profile selection
 * 3. Prompts for AWS region selection
 * 4. Checks for existing CDK folder
 * 5. Extracts bundled CDK and scripts resources
 * 5b. Ensures .gitignore has entries for sensitive files
 * 6. Generates .agentify/config.json
 * 7. Creates .kiro/steering/agentify-integration.md
 * 8. Installs Agentify Power to .kiro/powers/agentify/
 * 9. Auto-opens cdk/README.md for deployment instructions
 * 10. Shows success notification with summary
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getProfileDiscoveryService } from '../services/profileDiscoveryService';
import { getConfigService } from '../services/configService';
import {
  extractBundledResources,
  extractPowerResources,
  checkExistingCdkFolder,
  showOverwritePrompt,
  CDK_DEST_PATH,
} from '../services/resourceExtractionService';
import { createSteeringFile } from '../templates/steeringFile';
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
  region?: string;
  cdkExtracted?: boolean;
  scriptsExtracted?: boolean;
  steeringFileCreated?: boolean;
  powerInstalled?: boolean;
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
      description: 'Re-extract CDK files and update config (existing stack will remain)',
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
 * Generate config.json with extension settings (without infrastructure.dynamodb)
 * @param region AWS region selected by user
 * @param profile AWS profile (undefined for default)
 * @returns true on success, false on failure
 */
async function generateConfig(
  region: string,
  profile: string | undefined
): Promise<boolean> {
  const configService = getConfigService();
  if (!configService) {
    vscode.window.showErrorMessage('No workspace folder open. Cannot create configuration.');
    return false;
  }

  // Build config object with placeholder values for workflow configuration
  // Note: infrastructure.dynamodb is NOT included - it will be populated from
  // infrastructure.json after user runs setup.sh manually
  const config: AgentifyConfig = {
    version: '1.0.0',
    project: {
      name: 'My Agentify Project',
      valueMap: 'Describe the value this project provides',
      industry: 'tech',
    },
    infrastructure: {
      // Note: dynamodb is intentionally omitted - will be read from infrastructure.json
      // after user deploys via setup.sh
      bedrock: {
        modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
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
    // Store AWS settings for reference
    aws: {
      region,
      ...(profile && { profile }),
    },
  };

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
 * Entries to add to .gitignore for sensitive files
 */
const GITIGNORE_ENTRIES = [
  '# Agentify - sensitive files (do not commit)',
  'gateway_config.json',
  'cdk-outputs.json',
  '.env',
  '.env.*',
  '',
  '# Python',
  '__pycache__/',
  '*.pyc',
  '.venv/',
  'venv/',
  '',
  '# CDK',
  'cdk.out/',
  '.cdk.staging/',
];

/**
 * Ensure .gitignore contains entries for sensitive files
 * Creates .gitignore if it doesn't exist, or appends missing entries
 * @param workspacePath Workspace root path
 */
async function ensureGitignoreEntries(workspacePath: string): Promise<void> {
  const gitignorePath = path.join(workspacePath, '.gitignore');

  let existing = '';
  try {
    existing = await fs.promises.readFile(gitignorePath, 'utf8');
  } catch {
    // File doesn't exist, will create new
  }

  // Filter to entries not already present
  const newEntries = GITIGNORE_ENTRIES.filter(entry => {
    const trimmed = entry.trim();
    return trimmed && !existing.includes(trimmed);
  });

  if (newEntries.length > 0) {
    const content = (existing ? '\n' : '') + newEntries.join('\n') + '\n';
    await fs.promises.appendFile(gitignorePath, content);
    console.log('[Agentify] Updated .gitignore with sensitive file entries');
  }
}

/**
 * Open the CDK README file in the editor
 * @param workspaceRoot Workspace root path
 */
async function openReadme(workspaceRoot: string): Promise<void> {
  const readmePath = path.join(workspaceRoot, CDK_DEST_PATH, 'README.md');
  const readmeUri = vscode.Uri.file(readmePath);

  try {
    const doc = await vscode.workspace.openTextDocument(readmeUri);
    await vscode.window.showTextDocument(doc);
    console.log('[Agentify] Opened CDK README.md');
  } catch (error) {
    console.warn('[Agentify] Failed to open README.md:', error);
  }
}

/**
 * Show success notification with initialization summary
 * Includes region and offers to open the CDK README
 * @param region AWS region
 * @param cdkExtracted Whether CDK files were extracted
 * @param scriptsExtracted Whether script files were extracted
 * @param workspaceRoot Workspace root path for opening README
 */
export async function showSuccessNotification(
  region: string,
  cdkExtracted: boolean,
  scriptsExtracted: boolean,
  workspaceRoot: string | null
): Promise<void> {
  // Build summary message based on extraction results
  let summaryMessage: string;
  if (cdkExtracted && scriptsExtracted) {
    summaryMessage = `Agentify: Infrastructure files extracted successfully! Region: '${region}'. Run ./scripts/setup.sh to deploy.`;
  } else if (cdkExtracted || scriptsExtracted) {
    summaryMessage = `Agentify: Partial extraction complete. Region: '${region}'. Check cdk/ and scripts/ folders.`;
  } else {
    summaryMessage = `Agentify: Project initialized. Region: '${region}'. Existing CDK files preserved.`;
  }

  // Always offer to open CDK README
  const actions: string[] = ['Open CDK README'];

  // Show message with action
  const selection = await vscode.window.showInformationMessage(
    summaryMessage,
    ...actions
  );

  // Handle action selection
  if (selection === 'Open CDK README' && workspaceRoot) {
    await openReadme(workspaceRoot);
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

  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('No workspace folder open. Please open a folder first.');
    return { success: false };
  }

  // Step 4: Check for existing CDK folder and prompt if exists
  const cdkFolderExists = await checkExistingCdkFolder(workspaceRoot);
  let shouldOverwrite = true;

  if (cdkFolderExists) {
    const overwriteChoice = await showOverwritePrompt();
    if (overwriteChoice === null) {
      // User cancelled
      return { success: false };
    }
    shouldOverwrite = overwriteChoice === 'overwrite';
  }

  // Step 5: Extract bundled CDK and scripts resources
  let extractionResult;
  try {
    extractionResult = await extractBundledResources(
      context.extensionPath,
      workspaceRoot,
      shouldOverwrite
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Extraction error: ${message}`);
    return { success: false };
  }

  if (!extractionResult.success) {
    vscode.window.showErrorMessage(`Failed to extract infrastructure files: ${extractionResult.message}`);
    return { success: false };
  }

  // Step 5b: Ensure .gitignore has entries for sensitive files
  try {
    await ensureGitignoreEntries(workspaceRoot);
  } catch (error) {
    // Non-blocking - log but continue
    console.warn('[Agentify] Failed to update .gitignore:', error);
  }

  // Step 6: Generate config.json (without infrastructure.dynamodb)
  const configCreated = await generateConfig(region, profile);

  if (!configCreated) {
    return { success: false };
  }

  // Step 7: Create steering file (non-blocking - errors don't fail initialization)
  let steeringFileCreated = false;
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

  // Step 8: Install Agentify Power (non-blocking - errors don't fail initialization)
  let powerInstalled = false;
  try {
    const powerResult = await extractPowerResources(context.extensionPath, workspaceRoot);
    if (powerResult.success) {
      powerInstalled = true;
      console.log('[Agentify] Power installed:', powerResult.message);
    } else {
      console.warn('[Agentify] Power installation failed:', powerResult.message);
    }
  } catch (error) {
    // Log error but don't fail initialization
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[Agentify] Power installation error:', message);
  }

  // Step 9: Auto-open README.md if CDK was extracted
  if (extractionResult.cdkExtracted) {
    await openReadme(workspaceRoot);
  }

  // Step 10: Show success notification with summary
  await showSuccessNotification(
    region,
    extractionResult.cdkExtracted,
    extractionResult.scriptsExtracted,
    workspaceRoot
  );

  // Return success result for post-initialization handling
  return {
    success: true,
    region,
    cdkExtracted: extractionResult.cdkExtracted,
    scriptsExtracted: extractionResult.scriptsExtracted,
    steeringFileCreated,
    powerInstalled,
  };
}
