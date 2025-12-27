/**
 * Status Bar Manager for Agentify extension
 * Provides visual feedback about extension state in the VS Code status bar
 */

import * as vscode from 'vscode';

/**
 * Status states for the extension
 * - 'not-initialized': Project has not been initialized with .agentify/config.json
 * - 'ready': Extension is ready and AWS credentials are valid
 * - 'aws-error': Generic AWS connection or credential error
 * - 'sso-expired': SSO token has expired and needs refresh
 */
export type StatusState = 'not-initialized' | 'ready' | 'aws-error' | 'sso-expired';

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
  private profileName: string | undefined;

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
   * Set the AWS profile name for display in tooltips
   * @param profile The AWS profile name, or undefined to clear
   */
  setProfile(profile: string | undefined): void {
    this.profileName = profile;
    // Re-apply current state to update tooltip with new profile
    this.updateStatus(this.currentState);
  }

  /**
   * Get the current AWS profile name
   */
  getProfile(): string | undefined {
    return this.profileName;
  }

  /**
   * Update the status bar state
   * @param state The new status state
   */
  updateStatus(state: StatusState): void {
    this.currentState = state;
    const profileSuffix = this.profileName ? ` (profile: ${this.profileName})` : '';

    switch (state) {
      case 'not-initialized':
        this.statusBarItem.text = 'Agentify';
        this.statusBarItem.tooltip = `Agentify: Not Initialized - Click to initialize${profileSuffix}`;
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.color = undefined;
        break;

      case 'ready':
        this.statusBarItem.text = '$(check) Agentify';
        this.statusBarItem.tooltip = `Agentify: Ready - Click for options${profileSuffix}`;
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
        break;

      case 'aws-error':
        this.statusBarItem.text = '$(warning) Agentify';
        this.statusBarItem.tooltip = `Agentify: AWS Connection Error - Click for details${profileSuffix}`;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.warningBackground'
        );
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        break;

      case 'sso-expired':
        this.statusBarItem.text = '$(key) Agentify';
        this.statusBarItem.tooltip = `Agentify: SSO Token Expired - Click to refresh${profileSuffix}`;
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

    // Show SSO login option when in SSO expired state
    if (this.currentState === 'sso-expired') {
      items.push({
        label: '$(terminal) Run AWS SSO Login',
        description: 'Opens terminal with aws sso login command',
        detail: this.profileName ? `Profile: ${this.profileName}` : 'Uses default profile',
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
      case 'sso-expired':
        return 'SSO token expired';
    }
  }

  /**
   * Handle quick pick selection
   * @param label The selected item label
   */
  private handleQuickPickSelection(label: string): void {
    if (label.includes('Initialize Project')) {
      vscode.commands.executeCommand('agentify.initializeProject');
    } else if (label.includes('Run AWS SSO Login')) {
      this.openSsoLoginTerminal();
    } else if (label.includes('Demo Viewer')) {
      vscode.commands.executeCommand('agentify.openDemoViewer');
    } else if (label.includes('Ideation Wizard')) {
      vscode.commands.executeCommand('agentify.openIdeationWizard');
    } else if (label.includes('AWS Connection Status')) {
      this.showStatusDetails();
    }
  }

  /**
   * Open a terminal and run the aws sso login command
   */
  private openSsoLoginTerminal(): void {
    const terminal = vscode.window.createTerminal({
      name: 'AWS SSO Login',
    });

    // Build the command with or without profile flag
    const command = this.profileName
      ? `aws sso login --profile ${this.profileName}`
      : 'aws sso login';

    terminal.sendText(command);
    terminal.show();
  }

  /**
   * Show detailed status information
   */
  private showStatusDetails(): void {
    let message: string;
    const profileInfo = this.profileName ? ` Profile: ${this.profileName}.` : '';

    switch (this.currentState) {
      case 'not-initialized':
        message = 'Agentify project not initialized. Run "Initialize Project" to get started.';
        break;
      case 'ready':
        message = `Agentify is connected to AWS and ready to use.${profileInfo}`;
        break;
      case 'aws-error':
        message = `There was an error connecting to AWS. Please check your credentials and try again.${profileInfo}`;
        break;
      case 'sso-expired':
        message = this.profileName
          ? `Your AWS SSO token has expired. Run "aws sso login --profile ${this.profileName}" in your terminal to refresh.`
          : 'Your AWS SSO token has expired. Run "aws sso login" in your terminal to refresh.';
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
