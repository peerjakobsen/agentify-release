/**
 * Demo Project Service
 * Discovers and manages sample demo projects from resources/demos/
 *
 * Demo projects are pre-configured wizard-state.json files that users can
 * select during initialization to get started quickly with a working example.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Metadata for a demo project
 */
export interface DemoProjectMetadata {
  id: string;
  name: string;
  description: string;
  tags: string[];
  version: string;
}

/**
 * A discovered demo project
 */
export interface DemoProject {
  metadata: DemoProjectMetadata;
  /** Relative path within extension resources */
  resourcePath: string;
}

/**
 * Path to demos folder within extension resources
 */
const DEMOS_SOURCE_PATH = 'resources/demos';

/**
 * Discover all demo projects in the resources/demos/ folder
 *
 * Each demo must have:
 * - metadata.json with DemoProjectMetadata fields
 * - wizard-state.json with the pre-configured wizard state
 *
 * @param extensionPath Extension root path
 * @returns Array of discovered demo projects
 */
export async function discoverDemoProjects(
  extensionPath: string
): Promise<DemoProject[]> {
  const demosPath = path.join(extensionPath, DEMOS_SOURCE_PATH);
  const demos: DemoProject[] = [];

  try {
    // Check if demos folder exists
    if (!fs.existsSync(demosPath)) {
      console.log('[Agentify] No demos folder found at:', demosPath);
      return demos;
    }

    // Read all subdirectories
    const entries = await fs.promises.readdir(demosPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const demoFolder = path.join(demosPath, entry.name);
        const metadataPath = path.join(demoFolder, 'metadata.json');
        const wizardStatePath = path.join(demoFolder, 'wizard-state.json');

        // Only include if both required files exist
        if (fs.existsSync(metadataPath) && fs.existsSync(wizardStatePath)) {
          try {
            const metadataContent = await fs.promises.readFile(metadataPath, 'utf-8');
            const metadata: DemoProjectMetadata = JSON.parse(metadataContent);

            demos.push({
              metadata,
              resourcePath: `${DEMOS_SOURCE_PATH}/${entry.name}`,
            });

            console.log(`[Agentify] Discovered demo: ${metadata.name} (${metadata.id})`);
          } catch (error) {
            // Skip malformed demos
            console.warn(`[Agentify] Skipping malformed demo at ${entry.name}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Agentify] Error discovering demos:', error);
  }

  return demos;
}

/**
 * Extract a demo project's wizard-state.json to the workspace
 *
 * @param extensionPath Extension root path
 * @param workspaceRoot Workspace root path
 * @param demoId Demo identifier (folder name)
 * @returns true on success, false on failure
 */
export async function extractDemoProject(
  extensionPath: string,
  workspaceRoot: string,
  demoId: string
): Promise<boolean> {
  const sourcePath = path.join(
    extensionPath,
    DEMOS_SOURCE_PATH,
    demoId,
    'wizard-state.json'
  );
  const destDir = path.join(workspaceRoot, '.agentify');
  const destPath = path.join(destDir, 'wizard-state.json');

  try {
    // Ensure .agentify directory exists
    if (!fs.existsSync(destDir)) {
      await fs.promises.mkdir(destDir, { recursive: true });
    }

    // Read source wizard-state.json
    const content = await fs.promises.readFile(sourcePath, 'utf-8');

    // Update savedAt timestamp to current time
    const wizardState = JSON.parse(content);
    wizardState.savedAt = Date.now();

    // Write to destination
    await fs.promises.writeFile(destPath, JSON.stringify(wizardState, null, 2), 'utf-8');

    console.log(`[Agentify] Extracted demo '${demoId}' to ${destPath}`);
    return true;
  } catch (error) {
    console.error(`[Agentify] Failed to extract demo '${demoId}':`, error);
    vscode.window.showWarningMessage(
      `Failed to install demo project: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return false;
  }
}
