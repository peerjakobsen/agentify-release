/**
 * Demo Viewer Panel Provider
 * Provides a webview panel for visualizing AI agent workflow executions
 * Shows "Get Started" button when project is not initialized
 */

import * as vscode from 'vscode';
import { getConfigService } from '../services/configService';

/**
 * View ID for the Demo Viewer panel
 */
export const DEMO_VIEWER_VIEW_ID = 'agentify.demoViewer';

/**
 * Webview panel provider for the Demo Viewer
 * Implements VS Code's WebviewViewProvider interface
 */
export class DemoViewerPanelProvider implements vscode.WebviewViewProvider {
  /**
   * Reference to the webview view once resolved
   */
  private _view?: vscode.WebviewView;

  /**
   * Whether the project is currently initialized
   */
  private _isProjectInitialized = false;

  /**
   * Disposable for config change listener
   */
  private _configChangeDisposable?: vscode.Disposable;

  /**
   * Creates a new DemoViewerPanelProvider
   * @param extensionUri The URI of the extension for loading local resources
   */
  constructor(private readonly extensionUri: vscode.Uri) {}

  /**
   * Resolve the webview view
   * Called by VS Code when the view is first shown
   *
   * @param webviewView The webview view to resolve
   * @param context Context for the webview
   * @param token Cancellation token
   */
  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): Promise<void> {
    this._view = webviewView;

    // Configure webview options
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    // Check initialization state and set HTML content
    await this.checkInitializationState();
    this.updateWebviewContent();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      (message) => {
        this.handleMessage(message);
      },
      undefined,
      []
    );

    // Listen for config changes to update the view
    this.subscribeToConfigChanges();
  }

  /**
   * Check if the project is initialized by looking for .agentify/config.json
   */
  private async checkInitializationState(): Promise<void> {
    const configService = getConfigService();
    if (configService) {
      this._isProjectInitialized = await configService.isInitialized();
    } else {
      this._isProjectInitialized = false;
    }
  }

  /**
   * Subscribe to config changes to update initialization state
   */
  private subscribeToConfigChanges(): void {
    const configService = getConfigService();
    if (configService) {
      this._configChangeDisposable = configService.onConfigChanged((config) => {
        const wasInitialized = this._isProjectInitialized;
        this._isProjectInitialized = config !== null;

        // Refresh the view if initialization state changed
        if (wasInitialized !== this._isProjectInitialized) {
          this.updateWebviewContent();
        }
      });
    }
  }

  /**
   * Update the webview HTML content based on initialization state
   */
  private updateWebviewContent(): void {
    if (this._view) {
      this._view.webview.html = this._isProjectInitialized
        ? this.getInitializedHtmlContent()
        : this.getUninitializedHtmlContent();
    }
  }

  /**
   * Get HTML content for uninitialized project state (shows Get Started button)
   */
  private getUninitializedHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>Demo Viewer</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      margin: 0;
    }
    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 300px;
      text-align: center;
    }
    .icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.7;
    }
    .title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--vscode-foreground);
    }
    .description {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 24px;
      line-height: 1.5;
      max-width: 280px;
    }
    .get-started-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .get-started-button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 10px 24px;
      font-size: 14px;
      font-weight: 500;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    .get-started-button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    .get-started-button:focus {
      outline: 2px solid var(--vscode-focusBorder);
      outline-offset: 2px;
    }
    .hint {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#128640;</div>
    <div class="title">Welcome to Agentify</div>
    <div class="description">
      Initialize your project to start observing AI agent workflows and visualizing execution traces.
    </div>
    <div class="get-started-section">
      <button class="get-started-button" onclick="initializeProject()">
        Get Started
      </button>
      <div class="hint">Sets up AWS infrastructure and configuration</div>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();

    function initializeProject() {
      vscode.postMessage({ command: 'initializeProject' });
    }
  </script>
</body>
</html>`;
  }

  /**
   * Get HTML content for initialized project state (ready state)
   */
  private getInitializedHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <title>Demo Viewer</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      text-align: center;
    }
    .status-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #4caf50;
    }
    .status-text {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 10px;
    }
    .subtitle {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }
    .ready {
      color: var(--vscode-testing-iconPassed, #4caf50);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="status-indicator">
      <div class="status-dot"></div>
      <span class="status-text ready">Project ready</span>
    </div>
    <div class="icon">&#9881;</div>
    <div class="title">Demo Viewer</div>
    <div class="subtitle">Panel coming soon</div>
    <div class="subtitle" style="margin-top: 8px;">
      Workflow visualization and execution monitoring will be available here.
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Handle messages received from the webview
   * @param message The message from the webview
   */
  private handleMessage(message: unknown): void {
    const msg = message as { command?: string };

    if (msg.command === 'initializeProject') {
      // Execute the initialize project command
      vscode.commands.executeCommand('agentify.initializeProject');
    } else {
      console.log('[DemoViewer] Received message:', message);
    }
  }

  /**
   * Post a message to the webview
   * @param message The message to send
   */
  public postMessage(message: unknown): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  /**
   * Check if the view is currently visible
   */
  public get isVisible(): boolean {
    return this._view?.visible ?? false;
  }

  /**
   * Get the current project initialization state
   */
  public get isProjectInitialized(): boolean {
    return this._isProjectInitialized;
  }

  /**
   * Refresh the panel content
   * Call this after initialization state changes externally
   */
  public async refresh(): Promise<void> {
    await this.checkInitializationState();
    this.updateWebviewContent();
  }

  /**
   * Reveal the panel in the sidebar
   */
  public reveal(): void {
    if (this._view) {
      this._view.show(true);
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this._configChangeDisposable) {
      this._configChangeDisposable.dispose();
    }
  }
}
