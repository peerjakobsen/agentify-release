/**
 * Resource Extraction Service
 * Handles extraction of bundled CDK, scripts, and power resources from the extension
 * to the user's workspace during project initialization.
 *
 * Uses VS Code's workspace.fs API for cross-platform file operations.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Source paths for bundled resources (relative to extension root)
 */
export const CDK_SOURCE_PATH = 'resources/cdk';
export const SCRIPTS_SOURCE_PATH = 'resources/scripts';
export const AGENTS_SHARED_SOURCE_PATH = 'resources/agents/shared';
export const POWER_SOURCE_PATH = 'resources/agentify-power';
export const HOOKS_SOURCE_PATH = 'resources/agentify-hooks';

/**
 * Destination paths in the workspace
 * Note: Gateway is inside CDK, not a separate resource
 */
export const CDK_DEST_PATH = 'cdk';
export const SCRIPTS_DEST_PATH = 'scripts';
export const GATEWAY_DEST_PATH = 'cdk/gateway';
export const AGENTS_SHARED_DEST_PATH = 'agents/shared';
export const POWER_DEST_PATH = '.kiro/powers/agentify';
export const POWERS_DIR_PATH = '.kiro/powers';
export const HOOKS_DEST_PATH = '.kiro/hooks';

/**
 * QuickPick options for overwrite prompt
 */
export const OVERWRITE_OPTIONS = {
  SKIP: 'Skip (keep existing)',
  OVERWRITE: 'Overwrite',
} as const;

/**
 * Result of resource extraction operation
 */
export interface ExtractionResult {
  success: boolean;
  cdkExtracted: boolean;
  scriptsExtracted: boolean;
  gatewayExtracted: boolean;
  cdkPath: string | null;
  scriptsPath: string | null;
  gatewayPath: string | null;
  message: string;
}

/**
 * Result of power installation operation
 */
export interface PowerInstallResult {
  success: boolean;
  powerPath: string | null;
  hooksPath: string | null;
  message: string;
}

/**
 * User's choice when existing folder is detected
 */
export type OverwriteChoice = 'skip' | 'overwrite' | null;

/**
 * Check if a folder exists in the workspace
 *
 * @param workspaceRoot Absolute path to workspace root
 * @param folderPath Relative path to the folder to check
 * @returns True if folder exists, false otherwise
 */
export async function checkFolderExists(
  workspaceRoot: string,
  folderPath: string
): Promise<boolean> {
  const fullPath = path.join(workspaceRoot, folderPath);
  const folderUri = vscode.Uri.file(fullPath);

  try {
    const stat = await vscode.workspace.fs.stat(folderUri);
    const exists = stat.type === vscode.FileType.Directory;
    console.log(`[ResourceExtraction] Folder check: ${folderPath} exists=${exists}`);
    return exists;
  } catch {
    console.log(`[ResourceExtraction] Folder check: ${folderPath} does not exist`);
    return false;
  }
}

/**
 * Check if the CDK folder already exists in the workspace
 *
 * @param workspaceRoot Absolute path to workspace root
 * @returns True if cdk/ folder exists
 */
export async function checkExistingCdkFolder(workspaceRoot: string): Promise<boolean> {
  return checkFolderExists(workspaceRoot, CDK_DEST_PATH);
}

/**
 * Show QuickPick dialog for overwrite confirmation
 * Default selection protects user customizations
 *
 * @returns User's choice: 'skip', 'overwrite', or null if cancelled
 */
export async function showOverwritePrompt(): Promise<OverwriteChoice> {
  const choice = await vscode.window.showQuickPick(
    [
      { label: OVERWRITE_OPTIONS.SKIP, description: 'Keep your existing CDK configuration' },
      { label: OVERWRITE_OPTIONS.OVERWRITE, description: 'Replace with latest version' },
    ],
    {
      placeHolder: 'CDK folder already exists. What would you like to do?',
      ignoreFocusOut: true,
    }
  );

  if (!choice) {
    console.log('[ResourceExtraction] Overwrite prompt cancelled by user');
    return null;
  }

  const result = choice.label === OVERWRITE_OPTIONS.SKIP ? 'skip' : 'overwrite';
  console.log(`[ResourceExtraction] User chose: ${result}`);
  return result;
}

/**
 * Recursively copy a directory from source to destination
 * Preserves directory structure and all nested files
 *
 * @param sourceUri Source directory URI
 * @param destUri Destination directory URI
 */
async function copyDirectoryRecursive(
  sourceUri: vscode.Uri,
  destUri: vscode.Uri
): Promise<void> {
  // Create destination directory
  try {
    await vscode.workspace.fs.createDirectory(destUri);
  } catch {
    // Directory might already exist, that's fine
  }

  // Read source directory contents
  const entries = await vscode.workspace.fs.readDirectory(sourceUri);

  for (const [name, type] of entries) {
    const sourceEntryUri = vscode.Uri.file(path.join(sourceUri.fsPath, name));
    const destEntryUri = vscode.Uri.file(path.join(destUri.fsPath, name));

    if (type === vscode.FileType.Directory) {
      // Recurse into subdirectory
      await copyDirectoryRecursive(sourceEntryUri, destEntryUri);
    } else if (type === vscode.FileType.File) {
      // Copy file
      const content = await vscode.workspace.fs.readFile(sourceEntryUri);
      await vscode.workspace.fs.writeFile(destEntryUri, content);
    }
    // Symlinks and unknown types are skipped
  }
}

/**
 * Extract a single resource directory from extension to workspace
 *
 * @param extensionPath Absolute path to extension root
 * @param workspaceRoot Absolute path to workspace root
 * @param sourcePath Relative path within extension
 * @param destPath Relative path within workspace
 * @returns Full destination path on success, null on failure
 */
export async function extractResourceDirectory(
  extensionPath: string,
  workspaceRoot: string,
  sourcePath: string,
  destPath: string
): Promise<string | null> {
  const sourceFullPath = path.join(extensionPath, sourcePath);
  const destFullPath = path.join(workspaceRoot, destPath);

  const sourceUri = vscode.Uri.file(sourceFullPath);
  const destUri = vscode.Uri.file(destFullPath);

  try {
    // Verify source exists
    await vscode.workspace.fs.stat(sourceUri);

    // Copy directory recursively
    await copyDirectoryRecursive(sourceUri, destUri);

    console.log(`[ResourceExtraction] Extracted ${sourcePath} to ${destPath}`);
    return destFullPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ResourceExtraction] Failed to extract ${sourcePath}: ${message}`);
    return null;
  }
}

/**
 * Delete a directory and all its contents
 *
 * @param folderUri URI of folder to delete
 */
async function deleteDirectory(folderUri: vscode.Uri): Promise<void> {
  try {
    await vscode.workspace.fs.delete(folderUri, { recursive: true, useTrash: false });
    console.log(`[ResourceExtraction] Deleted ${folderUri.fsPath}`);
  } catch {
    // Folder might not exist, that's fine
  }
}

/**
 * Make shell scripts executable (Unix/macOS only)
 * VS Code's workspace.fs API doesn't preserve file permissions, so we use Node's fs.chmod
 *
 * @param scriptsPath Absolute path to scripts directory
 */
async function makeScriptsExecutable(scriptsPath: string): Promise<void> {
  // Skip on Windows - no executable permission concept
  if (process.platform === 'win32') {
    console.log('[ResourceExtraction] Skipping chmod on Windows');
    return;
  }

  try {
    const entries = await fs.promises.readdir(scriptsPath);
    for (const entry of entries) {
      if (entry.endsWith('.sh')) {
        const scriptPath = path.join(scriptsPath, entry);
        await fs.promises.chmod(scriptPath, 0o755);
        console.log(`[ResourceExtraction] Made executable: ${entry}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ResourceExtraction] Failed to set executable permissions: ${message}`);
  }
}

/**
 * Make Python scripts executable (Unix/macOS only)
 * VS Code's workspace.fs API doesn't preserve file permissions, so we use Node's fs.chmod
 *
 * @param gatewayPath Absolute path to gateway directory
 */
async function makePythonScriptsExecutable(gatewayPath: string): Promise<void> {
  // Skip on Windows - no executable permission concept
  if (process.platform === 'win32') {
    console.log('[ResourceExtraction] Skipping chmod on Windows');
    return;
  }

  try {
    const entries = await fs.promises.readdir(gatewayPath);
    for (const entry of entries) {
      if (entry.endsWith('.py')) {
        const scriptPath = path.join(gatewayPath, entry);
        await fs.promises.chmod(scriptPath, 0o755);
        console.log(`[ResourceExtraction] Made executable: ${entry}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ResourceExtraction] Failed to set executable permissions: ${message}`);
  }
}

/**
 * Extract bundled CDK and scripts resources to the workspace
 *
 * @param extensionPath Absolute path to extension root (context.extensionPath)
 * @param workspaceRoot Absolute path to workspace root
 * @param overwrite If true, overwrites existing folders. If false, skips extraction
 * @returns Extraction result with success status and paths
 */
export async function extractBundledResources(
  extensionPath: string,
  workspaceRoot: string,
  overwrite: boolean = true
): Promise<ExtractionResult> {
  console.log(`[ResourceExtraction] Starting extraction from ${extensionPath} to ${workspaceRoot}`);
  console.log(`[ResourceExtraction] Overwrite mode: ${overwrite}`);

  // Check if CDK folder exists
  const cdkExists = await checkExistingCdkFolder(workspaceRoot);

  // If folder exists and we're not overwriting, skip extraction
  if (cdkExists && !overwrite) {
    console.log('[ResourceExtraction] CDK folder exists, skipping extraction (overwrite=false)');
    return {
      success: true,
      cdkExtracted: false,
      scriptsExtracted: false,
      gatewayExtracted: false,
      cdkPath: path.join(workspaceRoot, CDK_DEST_PATH),
      scriptsPath: path.join(workspaceRoot, SCRIPTS_DEST_PATH),
      gatewayPath: path.join(workspaceRoot, GATEWAY_DEST_PATH),
      message: 'Extraction skipped - existing folders preserved',
    };
  }

  // If overwriting, delete existing folders first
  // Note: Gateway is inside CDK, so deleting CDK also deletes gateway
  if (cdkExists && overwrite) {
    console.log('[ResourceExtraction] Deleting existing CDK folder for overwrite');
    await deleteDirectory(vscode.Uri.file(path.join(workspaceRoot, CDK_DEST_PATH)));

    const scriptsExists = await checkFolderExists(workspaceRoot, SCRIPTS_DEST_PATH);
    if (scriptsExists) {
      console.log('[ResourceExtraction] Deleting existing scripts folder for overwrite');
      await deleteDirectory(vscode.Uri.file(path.join(workspaceRoot, SCRIPTS_DEST_PATH)));
    }
  }

  // Extract CDK resources
  const cdkPath = await extractResourceDirectory(
    extensionPath,
    workspaceRoot,
    CDK_SOURCE_PATH,
    CDK_DEST_PATH
  );

  // Extract scripts resources
  const scriptsPath = await extractResourceDirectory(
    extensionPath,
    workspaceRoot,
    SCRIPTS_SOURCE_PATH,
    SCRIPTS_DEST_PATH
  );

  // Make shell scripts executable (Unix/macOS)
  if (scriptsPath) {
    await makeScriptsExecutable(scriptsPath);
  }

  // Gateway is inside CDK, derive its path from cdkPath
  const gatewayPath = cdkPath ? path.join(cdkPath, 'gateway') : null;

  // Make gateway Python scripts executable (Unix/macOS)
  if (gatewayPath) {
    await makePythonScriptsExecutable(gatewayPath);
  }

  const cdkExtracted = cdkPath !== null;
  const scriptsExtracted = scriptsPath !== null;
  const gatewayExtracted = gatewayPath !== null;
  const success = cdkExtracted && scriptsExtracted;

  let message: string;
  if (success) {
    message = 'CDK, scripts, and gateway extracted successfully';
  } else if (cdkExtracted && scriptsExtracted) {
    message = 'CDK and scripts extracted but gateway failed';
  } else if (cdkExtracted) {
    message = 'CDK extracted but scripts and gateway failed';
  } else {
    message = 'Failed to extract resources';
  }

  console.log(`[ResourceExtraction] Extraction complete: ${message}`);

  return {
    success,
    cdkExtracted,
    scriptsExtracted,
    gatewayExtracted,
    cdkPath,
    scriptsPath,
    gatewayPath,
    message,
  };
}

/**
 * Extract the Agentify power and hooks to the workspace
 * - Power: .kiro/powers/agentify/ (POWER.md with YAML frontmatter)
 * - Hooks: .kiro/hooks/ (enforcement hook files)
 *
 * Kiro discovers powers automatically via YAML frontmatter in POWER.md.
 * No manifest.json needed - Kiro powers only allow: POWER.md, mcp.json, steering/*.md
 *
 * @param extensionPath Absolute path to extension root (context.extensionPath)
 * @param workspaceRoot Absolute path to workspace root
 * @returns Power installation result
 */
export async function extractPowerResources(
  extensionPath: string,
  workspaceRoot: string
): Promise<PowerInstallResult> {
  console.log(`[ResourceExtraction] Installing Agentify power and hooks to ${workspaceRoot}`);

  // Create .kiro/powers directory if needed
  const powersDirPath = path.join(workspaceRoot, POWERS_DIR_PATH);
  const powersDirUri = vscode.Uri.file(powersDirPath);

  try {
    await vscode.workspace.fs.createDirectory(powersDirUri);
  } catch {
    // Directory might already exist, that's fine
  }

  // Create .kiro/hooks directory if needed
  const hooksDirPath = path.join(workspaceRoot, HOOKS_DEST_PATH);
  const hooksDirUri = vscode.Uri.file(hooksDirPath);

  try {
    await vscode.workspace.fs.createDirectory(hooksDirUri);
  } catch {
    // Directory might already exist, that's fine
  }

  // Check if power already exists - delete for fresh install (always overwrite)
  const powerExists = await checkFolderExists(workspaceRoot, POWER_DEST_PATH);
  if (powerExists) {
    console.log('[ResourceExtraction] Removing existing power for refresh');
    await deleteDirectory(vscode.Uri.file(path.join(workspaceRoot, POWER_DEST_PATH)));
  }

  // Extract power resources (POWER.md only)
  const powerPath = await extractResourceDirectory(
    extensionPath,
    workspaceRoot,
    POWER_SOURCE_PATH,
    POWER_DEST_PATH
  );

  if (!powerPath) {
    return {
      success: false,
      powerPath: null,
      hooksPath: null,
      message: 'Failed to extract power resources',
    };
  }

  // Extract hooks to .kiro/hooks/ (separate from power)
  // Copy individual hook files, not the directory structure
  let hooksPath: string | null = null;
  try {
    const hooksSourcePath = path.join(extensionPath, HOOKS_SOURCE_PATH);

    // Check if hooks source exists
    if (fs.existsSync(hooksSourcePath)) {
      const hookFiles = fs.readdirSync(hooksSourcePath);

      for (const hookFile of hookFiles) {
        if (hookFile.endsWith('.kiro.hook')) {
          const sourcePath = path.join(hooksSourcePath, hookFile);
          const destPath = path.join(workspaceRoot, HOOKS_DEST_PATH, hookFile);

          const sourceUri = vscode.Uri.file(sourcePath);
          const destUri = vscode.Uri.file(destPath);

          await vscode.workspace.fs.copy(sourceUri, destUri, { overwrite: true });
          console.log(`[ResourceExtraction] Copied hook: ${hookFile}`);
        }
      }

      hooksPath = hooksDirPath;
      console.log('[ResourceExtraction] Hooks installed successfully');
    } else {
      console.warn('[ResourceExtraction] Hooks source not found, skipping hooks installation');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[ResourceExtraction] Failed to install hooks: ${message}`);
    // Non-blocking - power still works without hooks
  }

  const message = hooksPath
    ? 'Agentify power and hooks installed successfully'
    : 'Agentify power installed (hooks skipped)';

  console.log(`[ResourceExtraction] ${message}`);

  return {
    success: true,
    powerPath,
    hooksPath,
    message,
  };
}

/**
 * Result of group-based extraction
 */
export interface GroupExtractionResult {
  success: boolean;
  groupId: string;
  message: string;
}

/**
 * Extract a specific file group to the workspace
 *
 * @param extensionPath Absolute path to extension root
 * @param workspaceRoot Absolute path to workspace root
 * @param groupId ID of the group to extract ('infrastructure', 'agent-utilities', 'kiro-patterns', 'dependencies')
 * @returns Extraction result
 */
export async function extractGroup(
  extensionPath: string,
  workspaceRoot: string,
  groupId: string
): Promise<GroupExtractionResult> {
  console.log(`[ResourceExtraction] Extracting group: ${groupId}`);

  try {
    switch (groupId) {
      case 'infrastructure': {
        // Preserve Kiro-generated gateway content (handlers + schemas) before deleting CDK
        const gatewayHandlersPath = path.join(workspaceRoot, 'cdk/gateway/handlers');
        const gatewaySchemasPath = path.join(workspaceRoot, 'cdk/gateway/schemas');
        const tempHandlersPath = path.join(workspaceRoot, '.agentify-temp-handlers');
        const tempSchemasPath = path.join(workspaceRoot, '.agentify-temp-schemas');
        let hadHandlers = false;
        let hadSchemas = false;

        // Back up handlers
        try {
          const handlersUri = vscode.Uri.file(gatewayHandlersPath);
          await vscode.workspace.fs.stat(handlersUri);
          hadHandlers = true;
          await copyDirectoryRecursive(handlersUri, vscode.Uri.file(tempHandlersPath));
          console.log('[ResourceExtraction] Backed up gateway handlers');
        } catch {
          // No handlers to preserve
        }

        // Back up schemas
        try {
          const schemasUri = vscode.Uri.file(gatewaySchemasPath);
          await vscode.workspace.fs.stat(schemasUri);
          hadSchemas = true;
          await copyDirectoryRecursive(schemasUri, vscode.Uri.file(tempSchemasPath));
          console.log('[ResourceExtraction] Backed up gateway schemas');
        } catch {
          // No schemas to preserve
        }

        // Delete existing folders
        const cdkExists = await checkFolderExists(workspaceRoot, CDK_DEST_PATH);
        if (cdkExists) {
          await deleteDirectory(vscode.Uri.file(path.join(workspaceRoot, CDK_DEST_PATH)));
        }
        const scriptsExists = await checkFolderExists(workspaceRoot, SCRIPTS_DEST_PATH);
        if (scriptsExists) {
          await deleteDirectory(vscode.Uri.file(path.join(workspaceRoot, SCRIPTS_DEST_PATH)));
        }

        // Extract CDK
        const cdkPath = await extractResourceDirectory(
          extensionPath,
          workspaceRoot,
          CDK_SOURCE_PATH,
          CDK_DEST_PATH
        );

        // Restore Kiro-generated gateway handlers
        if (hadHandlers && cdkPath) {
          try {
            const restoredHandlersPath = path.join(cdkPath, 'gateway/handlers');
            await copyDirectoryRecursive(
              vscode.Uri.file(tempHandlersPath),
              vscode.Uri.file(restoredHandlersPath)
            );
            await deleteDirectory(vscode.Uri.file(tempHandlersPath));
            console.log('[ResourceExtraction] Restored gateway handlers');
          } catch (error) {
            console.warn('[ResourceExtraction] Failed to restore handlers:', error);
          }
        }

        // Restore Kiro-generated gateway schemas
        if (hadSchemas && cdkPath) {
          try {
            const restoredSchemasPath = path.join(cdkPath, 'gateway/schemas');
            await copyDirectoryRecursive(
              vscode.Uri.file(tempSchemasPath),
              vscode.Uri.file(restoredSchemasPath)
            );
            await deleteDirectory(vscode.Uri.file(tempSchemasPath));
            console.log('[ResourceExtraction] Restored gateway schemas');
          } catch (error) {
            console.warn('[ResourceExtraction] Failed to restore schemas:', error);
          }
        }

        // Extract scripts
        const scriptsPath = await extractResourceDirectory(
          extensionPath,
          workspaceRoot,
          SCRIPTS_SOURCE_PATH,
          SCRIPTS_DEST_PATH
        );

        // Make shell scripts executable
        if (scriptsPath) {
          await makeScriptsExecutable(scriptsPath);
        }

        // Make gateway Python scripts executable
        if (cdkPath) {
          await makePythonScriptsExecutable(path.join(cdkPath, 'gateway'));
        }

        return {
          success: cdkPath !== null && scriptsPath !== null,
          groupId,
          message: cdkPath && scriptsPath ? 'Infrastructure extracted' : 'Failed to extract infrastructure',
        };
      }

      case 'agent-utilities': {
        // Create agents/ directory if needed
        const agentsDirPath = path.join(workspaceRoot, 'agents');
        try {
          await vscode.workspace.fs.createDirectory(vscode.Uri.file(agentsDirPath));
        } catch {
          // Directory might already exist
        }

        // Delete existing agents/shared if exists
        const sharedExists = await checkFolderExists(workspaceRoot, AGENTS_SHARED_DEST_PATH);
        if (sharedExists) {
          await deleteDirectory(vscode.Uri.file(path.join(workspaceRoot, AGENTS_SHARED_DEST_PATH)));
        }

        // Extract agents/shared
        const sharedPath = await extractResourceDirectory(
          extensionPath,
          workspaceRoot,
          AGENTS_SHARED_SOURCE_PATH,
          AGENTS_SHARED_DEST_PATH
        );

        return {
          success: sharedPath !== null,
          groupId,
          message: sharedPath ? 'Agent utilities extracted' : 'Failed to extract agent utilities',
        };
      }

      case 'kiro-patterns': {
        // Use existing power extraction function
        const result = await extractPowerResources(extensionPath, workspaceRoot);
        return {
          success: result.success,
          groupId,
          message: result.message,
        };
      }

      case 'dependencies': {
        // This is handled separately in initializeProject.ts via pyprojectTemplate
        // Just return success - the caller will handle pyproject.toml
        return {
          success: true,
          groupId,
          message: 'Dependencies group marked for update',
        };
      }

      default:
        return {
          success: false,
          groupId,
          message: `Unknown group: ${groupId}`,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ResourceExtraction] Failed to extract group ${groupId}: ${message}`);
    return {
      success: false,
      groupId,
      message: `Failed to extract ${groupId}: ${message}`,
    };
  }
}

/**
 * Extract multiple file groups
 *
 * @param extensionPath Absolute path to extension root
 * @param workspaceRoot Absolute path to workspace root
 * @param groupIds Array of group IDs to extract
 * @returns Array of extraction results
 */
export async function extractGroups(
  extensionPath: string,
  workspaceRoot: string,
  groupIds: string[]
): Promise<GroupExtractionResult[]> {
  const results: GroupExtractionResult[] = [];

  for (const groupId of groupIds) {
    const result = await extractGroup(extensionPath, workspaceRoot, groupId);
    results.push(result);
  }

  return results;
}

/**
 * Extract all file groups (for fresh initialization)
 *
 * @param extensionPath Absolute path to extension root
 * @param workspaceRoot Absolute path to workspace root
 * @returns Array of extraction results
 */
export async function extractAllGroups(
  extensionPath: string,
  workspaceRoot: string
): Promise<GroupExtractionResult[]> {
  return extractGroups(extensionPath, workspaceRoot, [
    'infrastructure',
    'agent-utilities',
    'kiro-patterns',
    'dependencies',
  ]);
}
