/**
 * Demo Project Picker
 * Shows a QuickPick for selecting sample demo projects during initialization
 */

import * as vscode from 'vscode';
import type { DemoProject } from '../services/demoProjectService';

/**
 * QuickPick item for demo selection
 */
interface DemoQuickPickItem extends vscode.QuickPickItem {
  type: 'fresh' | 'demo';
  demoId?: string;
}

/**
 * Result of showing the demo project picker
 */
export interface DemoPickerResult {
  /** 'demo' if user selected a demo, 'fresh' if starting fresh */
  choice: 'demo' | 'fresh';
  /** Selected demo ID (only if choice === 'demo') */
  demoId?: string;
}

/**
 * Show the demo project picker QuickPick
 *
 * @param demoProjects Available demo projects discovered from resources/demos/
 * @returns DemoPickerResult with user selection, or null if cancelled
 */
export async function showDemoProjectPicker(
  demoProjects: DemoProject[]
): Promise<DemoPickerResult | null> {
  // Build QuickPick items
  const items: DemoQuickPickItem[] = [];

  // "Start Fresh" option always first
  items.push({
    label: '$(new-file) Start Fresh',
    description: 'Design your own agentic solution from scratch',
    type: 'fresh',
  });

  // Add separator if we have demos
  if (demoProjects.length > 0) {
    items.push({
      label: 'Sample Projects',
      kind: vscode.QuickPickItemKind.Separator,
      type: 'fresh', // Required but unused for separator
    });

    // Add demo projects
    for (const demo of demoProjects) {
      const tagString = demo.metadata.tags
        .map(tag => `$(tag) ${tag}`)
        .join('  ');

      items.push({
        label: `$(beaker) ${demo.metadata.name}`,
        description: demo.metadata.description,
        detail: tagString || undefined,
        type: 'demo',
        demoId: demo.metadata.id,
      });
    }
  }

  // Create QuickPick
  const quickPick = vscode.window.createQuickPick<DemoQuickPickItem>();
  quickPick.title = 'Select a Starting Point';
  quickPick.placeholder = 'Choose a sample project or start fresh';
  quickPick.items = items;
  quickPick.ignoreFocusOut = true;

  return new Promise<DemoPickerResult | null>(resolve => {
    let resolved = false;

    // Handle accept (Enter key)
    quickPick.onDidAccept(() => {
      if (!resolved && quickPick.selectedItems.length > 0) {
        resolved = true;
        const selected = quickPick.selectedItems[0];
        quickPick.hide();

        if (selected.type === 'fresh') {
          resolve({ choice: 'fresh' });
        } else {
          resolve({
            choice: 'demo',
            demoId: selected.demoId,
          });
        }
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
