/**
 * Ideation Wizard Panel Provider
 * Provides a webview panel for designing AI agent workflows
 * This is a stub implementation that will be extended in future specs
 */

import * as vscode from 'vscode';

/**
 * View ID for the Ideation Wizard panel
 */
export const IDEATION_WIZARD_VIEW_ID = 'agentify.ideationWizard';

/**
 * Webview panel provider for the Ideation Wizard
 * Implements VS Code's WebviewViewProvider interface
 */
export class IdeationWizardPanelProvider implements vscode.WebviewViewProvider {
  /**
   * Reference to the webview view once resolved
   */
  private _view?: vscode.WebviewView;

  /**
   * Creates a new IdeationWizardPanelProvider
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
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    this._view = webviewView;

    // Configure webview options
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    // Set placeholder HTML content
    webviewView.webview.html = this.getHtmlContent();

    // Handle messages from the webview (for future implementation)
    webviewView.webview.onDidReceiveMessage(
      (message) => {
        this.handleMessage(message);
      },
      undefined,
      []
    );
  }

  /**
   * Get the placeholder HTML content for the panel
   */
  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <title>Ideation Wizard</title>
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
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#128161;</div>
    <div class="title">Ideation Wizard</div>
    <div class="subtitle">Panel coming soon</div>
    <div class="subtitle" style="margin-top: 8px;">
      AI-assisted workflow design and ideation will be available here.
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
    // Stub implementation - will be extended in future specs
    console.log('[IdeationWizard] Received message:', message);
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
   * Refresh the panel content
   * Call this after initialization state changes externally
   */
  public async refresh(): Promise<void> {
    if (this._view) {
      this._view.webview.html = this.getHtmlContent();
    }
  }

  /**
   * Reveal the panel in the sidebar
   */
  public reveal(): void {
    if (this._view) {
      this._view.show(true);
    }
  }
}
