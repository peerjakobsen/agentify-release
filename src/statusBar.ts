/**
 * Status Bar Manager for Agentify extension
 * Provides visual feedback about extension state in the VS Code status bar
 */

import * as vscode from 'vscode';

/**
 * Status states for the extension
 */
export type StatusState = 'not-initialized' | 'ready' | 'aws-error';

/**
 * Status bar item ID
 */
const STATUS_BAR_ID = 'agentify.status';

/**
 * Status bar priority (higher = more left)
 */
const STATUS_BAR_PRIORITY = 100;

/**
 * Manages the status bar item for the Agentify extension
 */
export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private currentState: StatusState = 'not-initialized';

  /**
   * Creates a new StatusBarManager
   */
  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      STATUS_BAR_ID,
      vscode.StatusBarAlignment.Right,
      STATUS_BAR_PRIORITY
    );

    // Set click handler to open quick-pick menu
    this.statusBarItem.command = 'agentify.showStatus';

    // Set initial state
    this.updateStatus('not-initialized');

    // Show the status bar item
    this.statusBarItem.show();
  }

  /**
   * Update the status bar state
   * @param state The new status state
   */
  updateStatus(state: StatusState): void {
    this.currentState = state;

    switch (state) {
      case 'not-initialized':
        this.statusBarItem.text = 'Agentify';
        this.statusBarItem.tooltip = 'Agentify: Not Initialized - Click to initialize';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.color = undefined;
        break;

      case 'ready':
        this.statusBarItem.text = '$(check) Agentify';
        this.statusBarItem.tooltip = 'Agentify: Ready - Click for options';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
        break;

      case 'aws-error':
        this.statusBarItem.text = '$(warning) Agentify';
        this.statusBarItem.tooltip = 'Agentify: AWS Connection Error - Click for details';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.warningBackground'
        );
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        break;
    }
  }

  /**
   * Get the current status state
   */
  getStatus(): StatusState {
    return this.currentState;
  }

  /**
   * Show the quick-pick menu with available commands
   */
  async showQuickPick(): Promise<void> {
    const items: vscode.QuickPickItem[] = [];

    // Always show Initialize Project if not initialized
    if (this.currentState === 'not-initialized') {
      items.push({
        label: '$(new-folder) Initialize Project',
        description: 'Set up Agentify in this workspace',
        detail: 'Creates .agentify/config.json and initializes the project',
      });
    }

    // Show panel options when ready
    if (this.currentState === 'ready' || this.currentState === 'not-initialized') {
      items.push({
        label: '$(play) Open Demo Viewer',
        description: 'View and run workflow demos',
      });
      items.push({
        label: '$(lightbulb) Open Ideation Wizard',
        description: 'Design new agent workflows',
      });
    }

    // Always show status option
    items.push({
      label: '$(info) View AWS Connection Status',
      description: this.getStatusDescription(),
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select an Agentify action',
    });

    if (selected) {
      this.handleQuickPickSelection(selected.label);
    }
  }

  /**
   * Get status description for the quick pick
   */
  private getStatusDescription(): string {
    switch (this.currentState) {
      case 'not-initialized':
        return 'Project not initialized';
      case 'ready':
        return 'Connected and ready';
      case 'aws-error':
        return 'AWS connection issue';
    }
  }

  /**
   * Handle quick pick selection
   * @param label The selected item label
   */
  private handleQuickPickSelection(label: string): void {
    if (label.includes('Initialize Project')) {
      vscode.commands.executeCommand('agentify.initializeProject');
    } else if (label.includes('Demo Viewer')) {
      vscode.commands.executeCommand('agentify.openDemoViewer');
    } else if (label.includes('Ideation Wizard')) {
      vscode.commands.executeCommand('agentify.openIdeationWizard');
    } else if (label.includes('AWS Connection Status')) {
      this.showStatusDetails();
    }
  }

  /**
   * Show detailed status information
   */
  private showStatusDetails(): void {
    let message: string;

    switch (this.currentState) {
      case 'not-initialized':
        message = 'Agentify project not initialized. Run "Initialize Project" to get started.';
        break;
      case 'ready':
        message = 'Agentify is connected to AWS and ready to use.';
        break;
      case 'aws-error':
        message =
          'There was an error connecting to AWS. Please check your credentials and try again.';
        break;
    }

    vscode.window.showInformationMessage(message);
  }

  /**
   * Dispose of the status bar item
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}
