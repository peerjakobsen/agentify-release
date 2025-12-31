/**
 * Resource Extraction Service
 * Handles extraction of bundled CDK and script resources from the extension
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

/**
 * Destination paths in the workspace
 * Note: Gateway is inside CDK, not a separate resource
 */
export const CDK_DEST_PATH = 'cdk';
export const SCRIPTS_DEST_PATH = 'scripts';
export const GATEWAY_DEST_PATH = 'cdk/gateway';

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
async function extractResourceDirectory(
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
