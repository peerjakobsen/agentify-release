/**
 * File Group Detection Service
 * Detects which file groups exist in the workspace for initialization modal.
 */

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Represents a logical group of files that can be initialized together
 */
export interface FileGroup {
  /** Unique identifier for the group */
  id: string;
  /** Display name for the group */
  name: string;
  /** Short description of what's in this group */
  description: string;
  /** Files/folders included (for display) */
  files: string[];
  /** Explanation of what happens if user overwrites */
  consequence: string;
  /** Whether this should be checked by default */
  defaultChecked: boolean;
  /** Whether any files in this group already exist */
  exists: boolean;
}

/**
 * File group definitions with metadata
 */
export const FILE_GROUPS: Omit<FileGroup, 'exists'>[] = [
  {
    id: 'infrastructure',
    name: 'Infrastructure',
    description: 'VPC, DynamoDB, Lambda stacks, and deployment scripts',
    files: ['cdk/', 'scripts/'],
    consequence: 'Updates CDK stacks and scripts. Gateway handlers and schemas are preserved.',
    defaultChecked: false,
  },
  {
    id: 'agent-utilities',
    name: 'Agent Utilities',
    description: 'Observability, DynamoDB client, and OAuth utilities for agents',
    files: ['agents/shared/'],
    consequence: 'Resets to bundled versions (instrumentation, dynamodb_client, gateway_auth). Custom code in this folder will be lost.',
    defaultChecked: true,
  },
  {
    id: 'kiro-patterns',
    name: 'Kiro Patterns',
    description: 'Observability patterns and code validation hooks',
    files: ['.kiro/powers/agentify/', '.kiro/hooks/'],
    consequence: 'Updates validation rules and patterns. Custom hook tweaks will be reset.',
    defaultChecked: true,
  },
  {
    id: 'dependencies',
    name: 'Dependencies',
    description: 'Python package requirements for agents',
    files: ['pyproject.toml'],
    consequence: 'Resets to default packages. Added dependencies will be lost (you\'ll need to re-add them).',
    defaultChecked: false,
  },
];

/**
 * Check if a file or folder exists in the workspace
 */
async function checkPathExists(workspaceRoot: string, relativePath: string): Promise<boolean> {
  const fullPath = path.join(workspaceRoot, relativePath);
  const uri = vscode.Uri.file(fullPath);

  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if any file in a group exists
 */
async function checkGroupExists(workspaceRoot: string, files: string[]): Promise<boolean> {
  for (const file of files) {
    if (await checkPathExists(workspaceRoot, file)) {
      return true;
    }
  }
  return false;
}

/**
 * Detect which file groups have existing files in the workspace
 *
 * @param workspaceRoot Absolute path to workspace root
 * @returns Array of FileGroups with exists property populated
 */
export async function detectExistingGroups(workspaceRoot: string): Promise<FileGroup[]> {
  const results: FileGroup[] = [];

  for (const group of FILE_GROUPS) {
    const exists = await checkGroupExists(workspaceRoot, group.files);
    results.push({
      ...group,
      exists,
    });
    console.log(`[FileGroupDetection] Group '${group.id}' exists: ${exists}`);
  }

  return results;
}

/**
 * Check if any groups have existing files
 *
 * @param groups Array of FileGroups to check
 * @returns True if at least one group has existing files
 */
export function hasExistingFiles(groups: FileGroup[]): boolean {
  return groups.some(group => group.exists);
}

/**
 * Get groups that should be shown in the modal (only those with existing files)
 *
 * @param groups Array of FileGroups
 * @returns Groups that have existing files
 */
export function getGroupsWithExistingFiles(groups: FileGroup[]): FileGroup[] {
  return groups.filter(group => group.exists);
}
