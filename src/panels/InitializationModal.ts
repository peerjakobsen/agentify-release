/**
 * Initialization Modal
 * Shows a multi-select QuickPick for choosing which file groups to update
 * during project re-initialization.
 */

import * as vscode from 'vscode';
import { FileGroup } from '../services/fileGroupDetectionService';

/**
 * QuickPick item for a file group with checkbox support
 */
interface FileGroupQuickPickItem extends vscode.QuickPickItem {
  groupId: string;
  files: string[];
}

/**
 * Result of showing the initialization modal
 */
export interface InitializationModalResult {
  /** Whether the user confirmed (vs cancelled) */
  confirmed: boolean;
  /** IDs of groups selected for update */
  selectedGroupIds: string[];
}

/**
 * Show the initialization modal for selecting which file groups to update
 *
 * @param existingGroups Groups that have existing files (only these are shown)
 * @returns Modal result with selected group IDs, or null if cancelled
 */
export async function showInitializationModal(
  existingGroups: FileGroup[]
): Promise<InitializationModalResult | null> {
  // Build QuickPick items from groups
  const items: FileGroupQuickPickItem[] = existingGroups.map(group => ({
    label: group.name,
    description: group.files.join(', '),
    detail: `$(warning) ${group.consequence}`,
    picked: group.defaultChecked,
    groupId: group.id,
    files: group.files,
  }));

  // Create QuickPick with multi-select
  const quickPick = vscode.window.createQuickPick<FileGroupQuickPickItem>();
  quickPick.title = 'Initialize Agentify Project';
  quickPick.placeholder = 'Select which file groups to update (existing files will be overwritten)';
  quickPick.canSelectMany = true;
  quickPick.items = items;

  // Pre-select items based on defaultChecked
  quickPick.selectedItems = items.filter(item =>
    existingGroups.find(g => g.id === item.groupId)?.defaultChecked
  );

  // Add buttons
  quickPick.buttons = [
    {
      iconPath: new vscode.ThemeIcon('check'),
      tooltip: 'Initialize with selected groups',
    },
  ];

  return new Promise<InitializationModalResult | null>(resolve => {
    let resolved = false;

    // Handle accept (Enter key or button click)
    quickPick.onDidAccept(() => {
      if (!resolved) {
        resolved = true;
        const selectedGroupIds = quickPick.selectedItems.map(item => item.groupId);
        quickPick.hide();
        resolve({
          confirmed: true,
          selectedGroupIds,
        });
      }
    });

    // Handle button click
    quickPick.onDidTriggerButton(() => {
      if (!resolved) {
        resolved = true;
        const selectedGroupIds = quickPick.selectedItems.map(item => item.groupId);
        quickPick.hide();
        resolve({
          confirmed: true,
          selectedGroupIds,
        });
      }
    });

    // Handle cancel (Escape key)
    quickPick.onDidHide(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    });

    quickPick.show();
  });
}

/**
 * Show a simple confirmation for fresh initialization (no existing files)
 * This is a simpler flow when nothing needs to be overwritten.
 *
 * @returns True if user confirms, false if cancelled
 */
export async function showFreshInitializationConfirm(): Promise<boolean> {
  const result = await vscode.window.showInformationMessage(
    'Initialize Agentify project? This will create CDK infrastructure, scripts, and agent utilities.',
    { modal: true },
    'Initialize'
  );
  return result === 'Initialize';
}
