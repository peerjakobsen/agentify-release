/**
 * Tabbed Panel Provider
 * Unified panel with tabs for Ideation Wizard and Demo Viewer
 * Each tab gets full panel height for optimal UX
 */

import * as vscode from 'vscode';

/**
 * View ID for the Tabbed Panel
 */
export const TABBED_PANEL_VIEW_ID = 'agentify.tabbedPanel';

/**
 * Tab identifiers
 */
export type TabId = 'ideation' | 'demo';

/**
 * Tab configuration
 */
interface TabConfig {
  id: TabId;
  label: string;
}

/**
 * Available tabs
 */
const TABS: TabConfig[] = [
  { id: 'ideation', label: 'Ideation' },
  { id: 'demo', label: 'Demo Viewer' },
];

/**
 * Webview panel provider for the unified tabbed interface
 */
export class TabbedPanelProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _activeTab: TabId = 'ideation';
  private _extensionUri: vscode.Uri;
  private _context?: vscode.ExtensionContext;

  // Ideation Wizard state
  private _ideationState: IdeationState;
  private _ideationValidation: IdeationValidationState;

  // Demo Viewer state
  private _demoState: DemoState;

  // Config change listener
  private _configChangeDisposable?: vscode.Disposable;

  constructor(extensionUri: vscode.Uri, context?: vscode.ExtensionContext) {
    this._extensionUri = extensionUri;
    this._context = context;

    // Initialize Ideation state
    this._ideationState = createDefaultIdeationState();
    this._ideationValidation = { isValid: false, errors: [], hasWarnings: false };

    // Initialize Demo state
    this._demoState = createDefaultDemoState();
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // Check project initialization
    this.checkProjectInitialization().then(() => {
      this.updateWebviewContent();
      this.syncStateToWebview();
    });

    webviewView.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      undefined,
      []
    );

    // Watch for config changes
    this.subscribeToConfigChanges();
  }

  /**
   * Check if project is initialized
   */
  private async checkProjectInitialization(): Promise<void> {
    try {
      const configFiles = await vscode.workspace.findFiles('.agentify/config.json', null, 1);
      this._demoState.isProjectInitialized = configFiles.length > 0;
    } catch {
      this._demoState.isProjectInitialized = false;
    }
  }

  /**
   * Subscribe to config file changes
   */
  private subscribeToConfigChanges(): void {
    const watcher = vscode.workspace.createFileSystemWatcher('**/.agentify/config.json');

    this._configChangeDisposable = vscode.Disposable.from(
      watcher,
      watcher.onDidCreate(() => {
        this._demoState.isProjectInitialized = true;
        this.updateWebviewContent();
      }),
      watcher.onDidDelete(() => {
        this._demoState.isProjectInitialized = false;
        this.updateWebviewContent();
      })
    );
  }

  /**
   * Handle messages from webview
   */
  private handleMessage(message: { command: string; [key: string]: unknown }): void {
    const { command } = message;

    // Tab switching
    if (command === 'switchTab') {
      this._activeTab = message.tab as TabId;
      this.updateWebviewContent();
      this.syncStateToWebview();
      return;
    }

    // Route to appropriate handler based on active tab
    if (this._activeTab === 'ideation') {
      this.handleIdeationMessage(message);
    } else {
      this.handleDemoMessage(message);
    }
  }

  /**
   * Handle Ideation Wizard messages
   */
  private handleIdeationMessage(message: { command: string; [key: string]: unknown }): void {
    const { command } = message;

    switch (command) {
      case 'nextStep':
        this.ideationNavigateForward();
        break;
      case 'previousStep':
        this.ideationNavigateBackward();
        break;
      case 'goToStep':
        this.ideationNavigateToStep(message.step as number);
        break;
      case 'updateBusinessObjective':
        this._ideationState.businessObjective = message.value as string;
        this.validateIdeationStep1();
        this.syncStateToWebview();
        break;
      case 'updateIndustry':
        this._ideationState.industry = message.value as string;
        if (message.value !== 'Other') {
          this._ideationState.customIndustry = undefined;
        }
        this.validateIdeationStep1();
        this.updateWebviewContent();
        this.syncStateToWebview();
        break;
      case 'updateCustomIndustry':
        this._ideationState.customIndustry = message.value as string;
        this.syncStateToWebview();
        break;
      case 'toggleSystem':
        const system = message.value as string;
        const idx = this._ideationState.systems.indexOf(system);
        if (idx >= 0) {
          this._ideationState.systems.splice(idx, 1);
        } else {
          this._ideationState.systems.push(system);
        }
        this.validateIdeationStep1();
        this.updateWebviewContent();
        this.syncStateToWebview();
        break;
      case 'updateCustomSystems':
        this._ideationState.customSystems = message.value as string;
        this.syncStateToWebview();
        break;
      case 'uploadFile':
        const fileData = message.file as { name: string; size: number; data: number[] };
        if (fileData) {
          this._ideationState.uploadedFile = {
            name: fileData.name,
            size: fileData.size,
            data: new Uint8Array(fileData.data),
          };
          this.validateIdeationStep1();
          this.updateWebviewContent();
          this.syncStateToWebview();
        }
        break;
      case 'removeFile':
        this._ideationState.uploadedFile = undefined;
        this.validateIdeationStep1();
        this.updateWebviewContent();
        this.syncStateToWebview();
        break;
    }
  }

  /**
   * Handle Demo Viewer messages
   */
  private handleDemoMessage(message: { command: string; [key: string]: unknown }): void {
    const { command } = message;

    switch (command) {
      case 'initializeProject':
        vscode.commands.executeCommand('agentify.initializeProject');
        break;
      case 'runWorkflow':
        this._demoState.promptText = message.prompt as string;
        vscode.commands.executeCommand('agentify.runWorkflow', { prompt: this._demoState.promptText });
        break;
      case 'updatePrompt':
        this._demoState.promptText = message.value as string;
        this.syncStateToWebview();
        break;
    }
  }

  /**
   * Validate Ideation Step 1
   */
  private validateIdeationStep1(): void {
    const errors: IdeationValidationError[] = [];

    if (!this._ideationState.businessObjective.trim()) {
      errors.push({ type: 'businessObjective', message: 'Business objective is required', severity: 'error' });
    }

    if (!this._ideationState.industry) {
      errors.push({ type: 'industry', message: 'Please select an industry', severity: 'error' });
    }

    if (this._ideationState.systems.length === 0) {
      errors.push({ type: 'systems', message: 'Consider selecting systems your workflow will integrate with', severity: 'warning' });
    }

    if (this._ideationState.uploadedFile && this._ideationState.uploadedFile.size > 5 * 1024 * 1024) {
      errors.push({ type: 'file', message: 'File size exceeds 5MB limit', severity: 'error' });
    }

    const blockingErrors = errors.filter(e => e.severity === 'error');
    this._ideationValidation = {
      isValid: blockingErrors.length === 0,
      errors,
      hasWarnings: errors.some(e => e.severity === 'warning'),
    };
  }

  /**
   * Navigate forward in wizard
   */
  private ideationNavigateForward(): void {
    this._ideationState.validationAttempted = true;
    this.validateIdeationStep1();

    if (!this._ideationValidation.isValid) {
      this.syncStateToWebview();
      return;
    }

    if (this._ideationState.currentStep < 6) {
      this._ideationState.currentStep++;
      this._ideationState.highestStepReached = Math.max(
        this._ideationState.highestStepReached,
        this._ideationState.currentStep
      );
      this._ideationState.validationAttempted = false;
      this.updateWebviewContent();
      this.syncStateToWebview();
    }
  }

  /**
   * Navigate backward in wizard
   */
  private ideationNavigateBackward(): void {
    if (this._ideationState.currentStep > 1) {
      this._ideationState.currentStep--;
      this._ideationState.validationAttempted = false;
      this.updateWebviewContent();
      this.syncStateToWebview();
    }
  }

  /**
   * Navigate to specific step
   */
  private ideationNavigateToStep(step: number): void {
    if (step >= 1 && step <= this._ideationState.highestStepReached && step !== this._ideationState.currentStep) {
      this._ideationState.currentStep = step;
      this._ideationState.validationAttempted = false;
      this.updateWebviewContent();
      this.syncStateToWebview();
    }
  }

  /**
   * Update webview content
   */
  private updateWebviewContent(): void {
    if (this._view) {
      this._view.webview.html = this.getHtmlContent();
    }
  }

  /**
   * Sync state to webview
   */
  private syncStateToWebview(): void {
    if (!this._view) return;

    this._view.webview.postMessage({
      type: 'stateSync',
      activeTab: this._activeTab,
      ideation: {
        state: this._ideationState,
        validation: this._ideationValidation,
      },
      demo: {
        state: this._demoState,
      },
    });
  }

  /**
   * Get full HTML content
   */
  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>Agentify</title>
  <style>
    ${this.getBaseStyles()}
    ${this.getTabStyles()}
    ${this._activeTab === 'ideation' ? this.getIdeationStyles() : this.getDemoStyles()}
  </style>
</head>
<body>
  ${this.getTabBarHtml()}
  <div class="tab-content">
    ${this._activeTab === 'ideation' ? this.getIdeationContentHtml() : this.getDemoContentHtml()}
  </div>
  <script>
    const vscode = acquireVsCodeApi();

    function switchTab(tabId) {
      vscode.postMessage({ command: 'switchTab', tab: tabId });
    }

    ${this._activeTab === 'ideation' ? this.getIdeationScript() : this.getDemoScript()}

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'stateSync') {
        handleStateSync(message);
      }
    });
  </script>
</body>
</html>`;
  }

  /**
   * Get base styles
   */
  private getBaseStyles(): string {
    return `
      * { box-sizing: border-box; }
      body {
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        background-color: var(--vscode-editor-background);
        margin: 0;
        padding: 0;
        height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .tab-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }
    `;
  }

  /**
   * Get tab bar styles
   */
  private getTabStyles(): string {
    return `
      .tab-bar {
        display: flex;
        border-bottom: 1px solid var(--vscode-panel-border);
        background: var(--vscode-editor-background);
        flex-shrink: 0;
      }
      .tab {
        padding: 10px 16px;
        cursor: pointer;
        border: none;
        background: transparent;
        color: var(--vscode-foreground);
        font-size: 13px;
        font-family: var(--vscode-font-family);
        opacity: 0.7;
        border-bottom: 2px solid transparent;
        transition: opacity 0.15s, border-color 0.15s;
      }
      .tab:hover {
        opacity: 1;
      }
      .tab.active {
        opacity: 1;
        border-bottom-color: var(--vscode-focusBorder);
        color: var(--vscode-foreground);
      }
    `;
  }

  /**
   * Get tab bar HTML
   */
  private getTabBarHtml(): string {
    const tabs = TABS.map(tab => `
      <button class="tab ${this._activeTab === tab.id ? 'active' : ''}" onclick="switchTab('${tab.id}')">
        ${tab.label}
      </button>
    `).join('');

    return `<div class="tab-bar">${tabs}</div>`;
  }

  /**
   * Get Ideation styles
   */
  private getIdeationStyles(): string {
    return `
      .step-indicator {
        display: flex;
        justify-content: space-between;
        margin-bottom: 24px;
        gap: 4px;
      }
      .step-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
        min-width: 0;
      }
      .step-circle {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 4px;
        background: var(--vscode-input-background);
        border: 2px solid var(--vscode-input-border);
        color: var(--vscode-descriptionForeground);
      }
      .step-item.current .step-circle {
        background: var(--vscode-button-background);
        border-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
      }
      .step-item.completed .step-circle {
        background: var(--vscode-testing-iconPassed);
        border-color: var(--vscode-testing-iconPassed);
        color: white;
      }
      .step-item.clickable {
        cursor: pointer;
      }
      .step-item {
        position: relative;
      }
      .step-tooltip {
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        background: var(--vscode-editorWidget-background);
        color: var(--vscode-editorWidget-foreground);
        border: 1px solid var(--vscode-editorWidget-border);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.15s;
        z-index: 100;
        margin-top: 4px;
      }
      .step-item:hover .step-tooltip {
        opacity: 1;
      }
      .step-label {
        font-size: 10px;
        text-align: center;
        color: var(--vscode-descriptionForeground);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }
      .step-item.current .step-label {
        color: var(--vscode-foreground);
        font-weight: 500;
      }
      .step-icon {
        width: 14px;
        height: 14px;
      }
      .form-section {
        margin-bottom: 20px;
      }
      .form-label {
        display: block;
        font-size: 13px;
        font-weight: 500;
        margin-bottom: 6px;
        color: var(--vscode-foreground);
      }
      .required::after {
        content: ' *';
        color: var(--vscode-errorForeground);
      }
      textarea, select, input[type="text"] {
        width: 100%;
        padding: 8px;
        font-size: 13px;
        font-family: var(--vscode-font-family);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
      }
      textarea {
        min-height: 80px;
        resize: vertical;
      }
      textarea:focus, select:focus, input:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }
      .error-message {
        color: var(--vscode-errorForeground);
        font-size: 12px;
        margin-top: 4px;
      }
      .warning-banner {
        background: var(--vscode-inputValidation-warningBackground);
        border: 1px solid var(--vscode-inputValidation-warningBorder);
        color: var(--vscode-inputValidation-warningForeground);
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        margin-bottom: 16px;
      }
      .systems-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px 16px;
      }
      .system-category {
        break-inside: avoid;
      }
      .system-category h4 {
        font-size: 11px;
        text-transform: uppercase;
        color: var(--vscode-descriptionForeground);
        margin: 0 0 6px 0;
        letter-spacing: 0.5px;
      }
      .system-option {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        margin-bottom: 2px;
      }
      .system-option input[type="checkbox"] {
        width: auto;
        margin: 0;
      }
      .other-systems-label {
        font-size: 11px;
        text-transform: uppercase;
        color: var(--vscode-descriptionForeground);
        margin: 12px 0 6px 0;
        letter-spacing: 0.5px;
      }
      .file-upload-area {
        border: 2px dashed var(--vscode-input-border);
        border-radius: 4px;
        padding: 16px;
        text-align: center;
        cursor: pointer;
        transition: border-color 0.15s;
      }
      .file-upload-area:hover {
        border-color: var(--vscode-focusBorder);
      }
      .file-info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--vscode-input-background);
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 13px;
      }
      .remove-file {
        background: transparent;
        border: none;
        color: var(--vscode-errorForeground);
        cursor: pointer;
        font-size: 12px;
      }
      .nav-buttons {
        display: flex;
        justify-content: space-between;
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid var(--vscode-panel-border);
      }
      .nav-btn {
        padding: 8px 20px;
        font-size: 13px;
        border-radius: 4px;
        cursor: pointer;
        border: none;
        font-family: var(--vscode-font-family);
      }
      .nav-btn.primary {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
      }
      .nav-btn.primary:hover {
        background: var(--vscode-button-hoverBackground);
      }
      .nav-btn.primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .nav-btn.secondary {
        background: transparent;
        color: var(--vscode-foreground);
        border: 1px solid var(--vscode-input-border);
      }
      .nav-btn.secondary:hover {
        background: var(--vscode-input-background);
      }
      .placeholder-content {
        text-align: center;
        padding: 40px 20px;
        color: var(--vscode-descriptionForeground);
      }
    `;
  }

  /**
   * Get Demo styles
   */
  private getDemoStyles(): string {
    return `
      .demo-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .prompt-section label {
        display: block;
        font-size: 13px;
        font-weight: 500;
        margin-bottom: 6px;
      }
      .prompt-textarea {
        width: 100%;
        min-height: 100px;
        padding: 8px;
        font-size: 13px;
        font-family: var(--vscode-font-family);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        resize: vertical;
      }
      .prompt-textarea:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }
      .run-btn {
        width: 100%;
        padding: 10px;
        font-size: 14px;
        font-weight: 500;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .run-btn:hover {
        background: var(--vscode-button-hoverBackground);
      }
      .placeholder-panel {
        background: var(--vscode-input-background);
        border: 1px dashed var(--vscode-input-border);
        border-radius: 4px;
        padding: 24px;
        text-align: center;
        color: var(--vscode-descriptionForeground);
        font-size: 13px;
      }
      .get-started-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        text-align: center;
      }
      .get-started-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.7;
      }
      .get-started-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .get-started-desc {
        font-size: 13px;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 24px;
        max-width: 280px;
      }
      .get-started-btn {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 10px 24px;
        font-size: 14px;
        font-weight: 500;
        border-radius: 4px;
        cursor: pointer;
      }
      .get-started-btn:hover {
        background: var(--vscode-button-hoverBackground);
      }
    `;
  }

  /**
   * Get Ideation content HTML
   */
  private getIdeationContentHtml(): string {
    return `
      ${this.getStepIndicatorHtml()}
      ${this.getStepContentHtml()}
      ${this.getNavigationButtonsHtml()}
    `;
  }

  /**
   * Get step indicator HTML
   */
  private getStepIndicatorHtml(): string {
    const steps = WIZARD_STEPS.map(step => {
      const isCompleted = step.step < this._ideationState.currentStep;
      const isCurrent = step.step === this._ideationState.currentStep;
      const isClickable = step.step <= this._ideationState.highestStepReached && step.step !== this._ideationState.currentStep;

      let stateClass = 'pending';
      if (isCompleted) stateClass = 'completed';
      else if (isCurrent) stateClass = 'current';

      const clickHandler = isClickable ? `onclick="goToStep(${step.step})"` : '';
      const clickableClass = isClickable ? 'clickable' : '';

      const icon = isCompleted
        ? '<svg class="step-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>'
        : `<span>${step.step}</span>`;

      return `
        <div class="step-item ${stateClass} ${clickableClass}" ${clickHandler}>
          <div class="step-tooltip">${step.label}</div>
          <div class="step-circle">${icon}</div>
          <div class="step-label">${step.label}</div>
        </div>
      `;
    }).join('');

    return `<div class="step-indicator">${steps}</div>`;
  }

  /**
   * Get step content HTML
   */
  private getStepContentHtml(): string {
    if (this._ideationState.currentStep === 1) {
      return this.getStep1Html();
    }
    return `
      <div class="placeholder-content">
        <p>Step ${this._ideationState.currentStep} - Coming Soon</p>
        <p style="font-size: 12px; margin-top: 8px;">This step will be implemented in a future update.</p>
      </div>
    `;
  }

  /**
   * Get Step 1 HTML
   */
  private getStep1Html(): string {
    const showBusinessObjectiveError = this._ideationState.validationAttempted &&
      this._ideationValidation.errors.some(e => e.type === 'businessObjective');
    const showIndustryError = this._ideationState.validationAttempted &&
      this._ideationValidation.errors.some(e => e.type === 'industry');
    const showSystemsWarning = this._ideationValidation.errors.some(e => e.type === 'systems' && e.severity === 'warning');

    const industryOptions = INDUSTRY_OPTIONS.map(opt =>
      `<option value="${opt}" ${this._ideationState.industry === opt ? 'selected' : ''}>${opt}</option>`
    ).join('');

    const systemsHtml = Object.entries(SYSTEM_OPTIONS).map(([category, systems]) => `
      <div class="system-category">
        <h4>${category}</h4>
        ${systems.map(sys => `
          <label class="system-option">
            <input type="checkbox" ${this._ideationState.systems.includes(sys) ? 'checked' : ''} onchange="toggleSystem('${sys}')">
            ${sys}
          </label>
        `).join('')}
      </div>
    `).join('');

    const fileHtml = this._ideationState.uploadedFile
      ? `<div class="file-info">
          <span>${this.escapeHtml(this._ideationState.uploadedFile.name)} (${this.formatFileSize(this._ideationState.uploadedFile.size)})</span>
          <button class="remove-file" onclick="removeFile()">Remove</button>
        </div>`
      : `<div class="file-upload-area" onclick="document.getElementById('file-input').click()">
          <p>Click to upload a file</p>
          <p style="font-size: 11px; color: var(--vscode-descriptionForeground);">PDF, DOCX, TXT, MD (max 5MB)</p>
          <input type="file" id="file-input" accept=".pdf,.docx,.txt,.md" style="display: none" onchange="handleFileUpload(event)">
        </div>`;

    return `
      ${showSystemsWarning ? `<div class="warning-banner">${this._ideationValidation.errors.find(e => e.type === 'systems')?.message}</div>` : ''}

      <div class="form-section">
        <label class="form-label required">Business Objective</label>
        <textarea
          placeholder="Describe the business problem or objective..."
          oninput="updateBusinessObjective(this.value)"
        >${this.escapeHtml(this._ideationState.businessObjective)}</textarea>
        ${showBusinessObjectiveError ? '<div class="error-message">Business objective is required</div>' : ''}
      </div>

      <div class="form-section">
        <label class="form-label required">Industry</label>
        <select onchange="updateIndustry(this.value)">
          <option value="">Select an industry...</option>
          ${industryOptions}
        </select>
        ${showIndustryError ? '<div class="error-message">Please select an industry</div>' : ''}
        ${this._ideationState.industry === 'Other' ? `
          <input type="text"
            placeholder="Specify your industry..."
            style="margin-top: 8px;"
            value="${this.escapeHtml(this._ideationState.customIndustry || '')}"
            oninput="updateCustomIndustry(this.value)">
        ` : ''}
      </div>

      <div class="form-section">
        <label class="form-label">Systems to Integrate</label>
        <div class="systems-grid">
          ${systemsHtml}
        </div>
        <div class="other-systems-label">Other Systems</div>
        <input type="text"
          placeholder="e.g., Mainframe, Custom API, Legacy DB..."
          value="${this.escapeHtml(this._ideationState.customSystems || '')}"
          oninput="updateCustomSystems(this.value)">
      </div>

      <div class="form-section">
        <label class="form-label">Supporting Document</label>
        ${fileHtml}
      </div>
    `;
  }

  /**
   * Get navigation buttons HTML
   */
  private getNavigationButtonsHtml(): string {
    const isFirstStep = this._ideationState.currentStep === 1;
    const isLastStep = this._ideationState.currentStep === 6;

    return `
      <div class="nav-buttons">
        ${isFirstStep ? '<div></div>' : '<button class="nav-btn secondary" onclick="previousStep()">Back</button>'}
        ${isLastStep
          ? '<button class="nav-btn primary">Generate</button>'
          : '<button class="nav-btn primary" onclick="nextStep()">Next</button>'
        }
      </div>
    `;
  }

  /**
   * Get Demo content HTML
   */
  private getDemoContentHtml(): string {
    if (!this._demoState.isProjectInitialized) {
      return `
        <div class="get-started-container">
          <div class="get-started-icon">🚀</div>
          <div class="get-started-title">Welcome to Agentify</div>
          <div class="get-started-desc">Initialize your project to start observing AI agent workflows.</div>
          <button class="get-started-btn" onclick="initializeProject()">Get Started</button>
        </div>
      `;
    }

    return `
      <div class="demo-container">
        <div class="prompt-section">
          <label>PROMPT</label>
          <textarea class="prompt-textarea"
            placeholder="Enter your prompt for the AI agent..."
            oninput="updatePrompt(this.value)"
          >${this.escapeHtml(this._demoState.promptText)}</textarea>
        </div>
        <button class="run-btn" onclick="runWorkflow()">
          ▶ Run Workflow
        </button>
        <div class="placeholder-panel">
          AGENT GRAPH (COMING SOON)
        </div>
        <div class="placeholder-panel">
          EXECUTION LOG
        </div>
      </div>
    `;
  }

  /**
   * Get Ideation script
   */
  private getIdeationScript(): string {
    return `
      function nextStep() {
        vscode.postMessage({ command: 'nextStep' });
      }
      function previousStep() {
        vscode.postMessage({ command: 'previousStep' });
      }
      function goToStep(step) {
        vscode.postMessage({ command: 'goToStep', step });
      }
      function updateBusinessObjective(value) {
        vscode.postMessage({ command: 'updateBusinessObjective', value });
      }
      function updateIndustry(value) {
        vscode.postMessage({ command: 'updateIndustry', value });
      }
      function updateCustomIndustry(value) {
        vscode.postMessage({ command: 'updateCustomIndustry', value });
      }
      function toggleSystem(system) {
        vscode.postMessage({ command: 'toggleSystem', value: system });
      }
      function updateCustomSystems(value) {
        vscode.postMessage({ command: 'updateCustomSystems', value });
      }
      function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
          const arrayBuffer = e.target.result;
          const uint8Array = new Uint8Array(arrayBuffer);
          vscode.postMessage({
            command: 'uploadFile',
            file: {
              name: file.name,
              size: file.size,
              data: Array.from(uint8Array)
            }
          });
        };
        reader.readAsArrayBuffer(file);
      }
      function removeFile() {
        vscode.postMessage({ command: 'removeFile' });
      }
      function handleStateSync(message) {
        // State sync handled by full re-render
      }
    `;
  }

  /**
   * Get Demo script
   */
  private getDemoScript(): string {
    return `
      function initializeProject() {
        vscode.postMessage({ command: 'initializeProject' });
      }
      function runWorkflow() {
        const prompt = document.querySelector('.prompt-textarea')?.value || '';
        vscode.postMessage({ command: 'runWorkflow', prompt });
      }
      function updatePrompt(value) {
        vscode.postMessage({ command: 'updatePrompt', value });
      }
      function handleStateSync(message) {
        // State sync handled by full re-render
      }
    `;
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Format file size
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Refresh the panel
   */
  public async refresh(): Promise<void> {
    await this.checkProjectInitialization();
    this.validateIdeationStep1();
    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Get active tab
   */
  public get activeTab(): TabId {
    return this._activeTab;
  }

  /**
   * Set active tab
   */
  public setActiveTab(tab: TabId): void {
    this._activeTab = tab;
    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Dispose
   */
  public dispose(): void {
    this._configChangeDisposable?.dispose();
  }
}

// ============================================
// Supporting Types and Constants
// ============================================

interface IdeationState {
  currentStep: number;
  highestStepReached: number;
  validationAttempted: boolean;
  businessObjective: string;
  industry: string;
  customIndustry?: string;
  systems: string[];
  customSystems?: string;
  uploadedFile?: {
    name: string;
    size: number;
    data: Uint8Array;
  };
}

interface IdeationValidationError {
  type: string;
  message: string;
  severity: 'error' | 'warning';
}

interface IdeationValidationState {
  isValid: boolean;
  errors: IdeationValidationError[];
  hasWarnings: boolean;
}

interface DemoState {
  isProjectInitialized: boolean;
  promptText: string;
}

function createDefaultIdeationState(): IdeationState {
  return {
    currentStep: 1,
    highestStepReached: 1,
    validationAttempted: false,
    businessObjective: '',
    industry: '',
    systems: [],
  };
}

function createDefaultDemoState(): DemoState {
  return {
    isProjectInitialized: false,
    promptText: '',
  };
}

const WIZARD_STEPS = [
  { step: 1, label: 'Business Context' },
  { step: 2, label: 'AI Gap Filling' },
  { step: 3, label: 'Agent Design' },
  { step: 4, label: 'Mock Data' },
  { step: 5, label: 'Demo Strategy' },
  { step: 6, label: 'Generate' },
];

const INDUSTRY_OPTIONS = [
  'Retail',
  'FSI',
  'Healthcare',
  'Life Sciences',
  'Manufacturing',
  'Energy',
  'Telecom',
  'Public Sector',
  'Media & Entertainment',
  'Travel & Hospitality',
  'Other',
];

const SYSTEM_OPTIONS: Record<string, string[]> = {
  CRM: ['Salesforce', 'HubSpot', 'Dynamics'],
  ERP: ['SAP S/4HANA', 'Oracle', 'NetSuite'],
  Data: ['Databricks', 'Snowflake', 'Redshift'],
  HR: ['Workday', 'SuccessFactors'],
  Service: ['ServiceNow', 'Zendesk'],
};
