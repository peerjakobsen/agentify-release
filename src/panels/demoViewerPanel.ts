/**
 * Demo Viewer Panel Provider
 * Provides a webview panel for visualizing AI agent workflow executions
 * Shows "Get Started" button when project is not initialized
 * Shows input panel for workflow execution when initialized
 */

import * as vscode from 'vscode';
import { getConfigService } from '../services/configService';
import { getInputPanelValidationService } from '../services/inputPanelValidation';
import { WorkflowExecutor } from '../services/workflowExecutor';
import { generateWorkflowId, generateTraceId } from '../utils/idGenerator';
import { formatTime } from '../utils/timerFormatter';
import { getNextState } from '../utils/inputPanelStateMachine';
import type {
  InputPanelState,
  ValidationState,
  WorkflowExecution,
} from '../types/inputPanel';
import { InputPanelState as InputPanelStateEnum } from '../types/inputPanel';

/**
 * View ID for the Demo Viewer panel
 */
export const DEMO_VIEWER_VIEW_ID = 'agentify.demoViewer';

/**
 * Workspace state keys for persistence
 */
const WORKSPACE_STATE_KEYS = {
  PROMPT_TEXT: 'agentify.demoViewer.promptText',
  LAST_WORKFLOW_ID: 'agentify.demoViewer.lastWorkflowId',
};

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
   * Current input panel state
   */
  private _currentState: InputPanelState = InputPanelStateEnum.Ready;

  /**
   * Current workflow execution
   */
  private _currentExecution: WorkflowExecution | null = null;

  /**
   * Timer interval reference
   */
  private _timerInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Elapsed time in milliseconds
   */
  private _elapsedMs = 0;

  /**
   * Current validation state
   */
  private _validationState: ValidationState = { isValid: true, errors: [] };

  /**
   * Persisted prompt text
   */
  private _promptText = '';

  /**
   * Workflow executor instance
   */
  private _workflowExecutor: WorkflowExecutor | null = null;

  /**
   * Creates a new DemoViewerPanelProvider
   * @param extensionUri The URI of the extension for loading local resources
   * @param context The extension context for workspace state access
   */
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context?: vscode.ExtensionContext
  ) {}

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
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this._view = webviewView;

    // Configure webview options
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    // Load persisted state
    this.loadPersistedState();

    // Check initialization state and set HTML content
    await this.checkInitializationState();

    // Run validation if initialized
    if (this._isProjectInitialized) {
      await this.runValidation();
    }

    this.updateWebviewContent();

    // Sync initial state to webview (including validation errors)
    if (this._isProjectInitialized) {
      this.syncStateToWebview();
    }

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

    // Initialize workflow executor if configured
    this.initializeWorkflowExecutor();
  }

  /**
   * Initialize the workflow executor
   */
  private initializeWorkflowExecutor(): void {
    const configService = getConfigService();
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (configService && workspaceFolders && workspaceFolders.length > 0) {
      this._workflowExecutor = new WorkflowExecutor(
        configService,
        workspaceFolders[0].uri.fsPath
      );
    }
  }

  /**
   * Load persisted state from workspace storage
   */
  private loadPersistedState(): void {
    if (this.context) {
      this._promptText = this.context.workspaceState.get(WORKSPACE_STATE_KEYS.PROMPT_TEXT, '');
    }
  }

  /**
   * Persist prompt text to workspace storage
   */
  private persistPromptText(text: string): void {
    this._promptText = text;
    if (this.context) {
      this.context.workspaceState.update(WORKSPACE_STATE_KEYS.PROMPT_TEXT, text);
    }
  }

  /**
   * Persist last workflow ID to workspace storage
   */
  private persistLastWorkflowId(id: string): void {
    if (this.context) {
      this.context.workspaceState.update(WORKSPACE_STATE_KEYS.LAST_WORKFLOW_ID, id);
    }
  }

  /**
   * Run validation checks
   */
  private async runValidation(): Promise<void> {
    const validationService = getInputPanelValidationService();
    if (validationService) {
      validationService.invalidateCache();
      this._validationState = await validationService.validateAll();
    }
  }

  /**
   * Start the execution timer
   */
  private startTimer(): void {
    this._elapsedMs = 0;

    this._timerInterval = setInterval(() => {
      this._elapsedMs += 100;
      this.syncStateToWebview();
    }, 100);
  }

  /**
   * Stop the execution timer
   */
  private stopTimer(): void {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  /**
   * Reset the timer to initial state
   */
  private resetTimer(): void {
    this.stopTimer();
    this._elapsedMs = 0;
  }

  /**
   * Get the current timer display string
   */
  private getTimerDisplay(): string {
    if (this._currentState === InputPanelStateEnum.Ready && !this._currentExecution) {
      return '--:--';
    }

    const showDecimal = this._currentState === InputPanelStateEnum.Completed ||
                        this._currentState === InputPanelStateEnum.Error;

    return formatTime(this._elapsedMs, showDecimal);
  }

  /**
   * Get X-Ray console URL if configured
   */
  private async getXrayUrl(): Promise<string | null> {
    if (!this._currentExecution?.traceId) {
      return null;
    }

    const configService = getConfigService();
    if (!configService) {
      return null;
    }

    const config = await configService.getConfig();

    if (!config?.observability?.xrayConsoleUrl) {
      return null;
    }

    const region = config.infrastructure?.dynamodb?.region || 'us-east-1';

    return config.observability.xrayConsoleUrl
      .replace('{region}', region)
      .replace('{trace_id}', this._currentExecution.traceId);
  }

  /**
   * Synchronize state to webview
   */
  private async syncStateToWebview(): Promise<void> {
    if (!this._view) {
      return;
    }

    const xrayUrl = await this.getXrayUrl();

    this._view.webview.postMessage({
      type: 'stateSync',
      state: this._currentState,
      promptText: this._promptText,
      workflowId: this._currentExecution?.workflowId || null,
      traceId: this._currentExecution?.traceId || null,
      timerDisplay: this.getTimerDisplay(),
      validationErrors: this._validationState.errors,
      xrayUrl,
    });
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
      this._configChangeDisposable = configService.onConfigChanged(async (config) => {
        const wasInitialized = this._isProjectInitialized;
        this._isProjectInitialized = config !== null;

        // Re-run validation on config changes
        if (this._isProjectInitialized) {
          await this.runValidation();
        }

        // Refresh the view if initialization state changed
        if (wasInitialized !== this._isProjectInitialized) {
          this.updateWebviewContent();
        } else if (this._isProjectInitialized) {
          // Just sync state for validation updates
          this.syncStateToWebview();
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
   * Get HTML content for initialized project state (input panel)
   */
  private getInitializedHtmlContent(): string {
    const promptText = this._promptText.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const isRunning = this._currentState === InputPanelStateEnum.Running;
    const hasValidationErrors = !this._validationState.isValid;
    const showResetButton = this._currentState === InputPanelStateEnum.Completed ||
                            this._currentState === InputPanelStateEnum.Error;
    const workflowId = this._currentExecution?.workflowId || '';
    const traceId = this._currentExecution?.traceId || '';
    const timerDisplay = this.getTimerDisplay();

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
      padding: 16px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      margin: 0;
    }
    .input-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .section-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }
    .prompt-textarea {
      width: 100%;
      height: 100px;
      padding: 8px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
      resize: none;
      box-sizing: border-box;
    }
    .prompt-textarea:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }
    .prompt-textarea::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    .validation-banner {
      background-color: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 12px;
      display: ${hasValidationErrors ? 'block' : 'none'};
    }
    .validation-error {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      margin-bottom: 4px;
    }
    .validation-error:last-child {
      margin-bottom: 0;
    }
    .validation-icon {
      flex-shrink: 0;
    }
    .button-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .run-button {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 500;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    .run-button:hover:not(:disabled) {
      background-color: var(--vscode-button-hoverBackground);
    }
    .run-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .run-button:focus {
      outline: 2px solid var(--vscode-focusBorder);
      outline-offset: 2px;
    }
    .reset-button {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 8px 12px;
      font-size: 13px;
      border-radius: 4px;
      cursor: pointer;
      display: ${showResetButton ? 'block' : 'none'};
    }
    .reset-button:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
    .execution-info {
      display: ${workflowId ? 'block' : 'none'};
      border-top: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #444));
      padding-top: 12px;
      margin-top: 4px;
    }
    .info-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .info-row:last-child {
      margin-bottom: 0;
    }
    .info-label {
      color: var(--vscode-descriptionForeground);
    }
    .info-value {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: var(--vscode-editor-font-family, monospace);
    }
    .copy-button {
      background: transparent;
      border: none;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      padding: 2px 4px;
      font-size: 11px;
      opacity: 0.7;
    }
    .copy-button:hover {
      opacity: 1;
    }
    .xray-link {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
      font-size: 11px;
      cursor: pointer;
    }
    .xray-link:hover {
      text-decoration: underline;
    }
    .timer-display {
      font-size: 24px;
      font-weight: 600;
      font-family: var(--vscode-editor-font-family, monospace);
      text-align: center;
      padding: 8px 0;
      color: ${this._currentState === InputPanelStateEnum.Error ? 'var(--vscode-errorForeground, #f48771)' : 'var(--vscode-foreground)'};
    }
    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid var(--vscode-button-foreground);
      border-radius: 50%;
      border-top-color: transparent;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="input-panel">
    <div>
      <div class="section-label">Prompt</div>
      <textarea
        id="promptTextarea"
        class="prompt-textarea"
        placeholder="Enter your prompt for the AI agent..."
        ${isRunning ? 'disabled' : ''}
      >${promptText}</textarea>
    </div>

    <div id="validationBanner" class="validation-banner">
      ${this._validationState.errors.map(e => `
        <div class="validation-error">
          <span class="validation-icon">&#9888;</span>
          <span>${e.message}</span>
        </div>
      `).join('')}
    </div>

    <div class="button-row">
      <button
        id="runButton"
        class="run-button"
        onclick="runWorkflow()"
        ${isRunning || hasValidationErrors ? 'disabled' : ''}
      >
        ${isRunning ? '<span class="spinner"></span> Running...' : '&#9654; Run Workflow'}
      </button>
      <button
        id="resetButton"
        class="reset-button"
        onclick="resetPanel()"
      >
        Reset
      </button>
    </div>

    <div class="timer-display" id="timerDisplay">${timerDisplay}</div>

    <div class="execution-info" id="executionInfo">
      <div class="info-row">
        <span class="info-label">Workflow ID</span>
        <span class="info-value">
          <span id="workflowIdValue">${workflowId}</span>
          <button class="copy-button" onclick="copyId('workflowId')" title="Copy">&#128203;</button>
        </span>
      </div>
      <div class="info-row">
        <span class="info-label">Trace ID</span>
        <span class="info-value">
          <span id="traceIdValue">${traceId}</span>
          <button class="copy-button" onclick="copyId('traceId')" title="Copy">&#128203;</button>
          <span id="xrayLink" style="display: none;">
            <a class="xray-link" onclick="openXrayConsole()">View in X-Ray</a>
          </span>
        </span>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let debounceTimer = null;

    // Initialize textarea with persisted value
    const promptTextarea = document.getElementById('promptTextarea');
    promptTextarea.addEventListener('input', onPromptChange);

    function onPromptChange() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        vscode.postMessage({
          command: 'promptChanged',
          text: promptTextarea.value
        });
      }, 300);
    }

    function runWorkflow() {
      const prompt = promptTextarea.value.trim();
      if (!prompt) {
        return;
      }
      vscode.postMessage({
        command: 'runWorkflow',
        prompt: prompt
      });
    }

    function resetPanel() {
      vscode.postMessage({ command: 'resetPanel' });
    }

    function copyId(type) {
      vscode.postMessage({
        command: 'copyToClipboard',
        idType: type
      });
    }

    function openXrayConsole() {
      vscode.postMessage({ command: 'openXrayConsole' });
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'stateSync') {
        updateUI(message);
      }
    });

    function updateUI(state) {
      // Update timer
      document.getElementById('timerDisplay').textContent = state.timerDisplay;

      // Update button states
      const runButton = document.getElementById('runButton');
      const resetButton = document.getElementById('resetButton');
      const isRunning = state.state === 'running';
      const hasErrors = state.validationErrors && state.validationErrors.length > 0;
      const showReset = state.state === 'completed' || state.state === 'error';

      runButton.disabled = isRunning || hasErrors;
      runButton.innerHTML = isRunning
        ? '<span class="spinner"></span> Running...'
        : '&#9654; Run Workflow';
      resetButton.style.display = showReset ? 'block' : 'none';

      // Update execution info
      const executionInfo = document.getElementById('executionInfo');
      executionInfo.style.display = state.workflowId ? 'block' : 'none';
      document.getElementById('workflowIdValue').textContent = state.workflowId || '';
      document.getElementById('traceIdValue').textContent = state.traceId || '';

      // Update X-Ray link
      const xrayLink = document.getElementById('xrayLink');
      xrayLink.style.display = state.xrayUrl ? 'inline' : 'none';

      // Update validation banner
      const validationBanner = document.getElementById('validationBanner');
      if (state.validationErrors && state.validationErrors.length > 0) {
        validationBanner.style.display = 'block';
        validationBanner.innerHTML = state.validationErrors.map(e =>
          '<div class="validation-error"><span class="validation-icon">&#9888;</span><span>' + e.message + '</span></div>'
        ).join('');
      } else {
        validationBanner.style.display = 'none';
      }

      // Update timer color for error state
      const timerDisplay = document.getElementById('timerDisplay');
      timerDisplay.style.color = state.state === 'error'
        ? 'var(--vscode-errorForeground, #f48771)'
        : 'var(--vscode-foreground)';

      // Update textarea state
      promptTextarea.disabled = isRunning;
    }
  </script>
</body>
</html>`;
  }

  /**
   * Handle messages received from the webview
   * @param message The message from the webview
   */
  private async handleMessage(message: unknown): Promise<void> {
    const msg = message as { command?: string; prompt?: string; text?: string; idType?: string };

    switch (msg.command) {
      case 'initializeProject':
        vscode.commands.executeCommand('agentify.initializeProject');
        break;

      case 'runWorkflow':
        await this.handleRunWorkflow(msg.prompt || '');
        break;

      case 'resetPanel':
        this.handleResetPanel();
        break;

      case 'copyToClipboard':
        this.handleCopyToClipboard(msg.idType || '');
        break;

      case 'openXrayConsole':
        await this.handleOpenXrayConsole();
        break;

      case 'promptChanged':
        this.persistPromptText(msg.text || '');
        break;

      default:
        console.log('[DemoViewer] Received message:', message);
    }
  }

  /**
   * Handle run workflow command
   */
  private async handleRunWorkflow(prompt: string): Promise<void> {
    if (!prompt.trim() || !this._workflowExecutor) {
      return;
    }

    // Check validation
    if (!this._validationState.isValid) {
      return;
    }

    // Transition to running state
    const nextState = getNextState(this._currentState, 'RUN_WORKFLOW');
    if (!nextState) {
      return;
    }

    // Generate IDs
    const workflowId = generateWorkflowId();
    const traceId = generateTraceId();

    // Create execution record
    this._currentExecution = {
      workflowId,
      traceId,
      startTime: Date.now(),
      endTime: null,
      status: null,
    };

    this._currentState = nextState;
    this.persistLastWorkflowId(workflowId);

    // Start timer and sync
    this.startTimer();
    this.syncStateToWebview();

    try {
      // Execute workflow
      const execution = await this._workflowExecutor.execute(
        prompt,
        workflowId,
        traceId,
        {
          onComplete: (exec) => {
            this._currentExecution = exec;
            this._currentState = InputPanelStateEnum.Completed;
            this.stopTimer();
            this.syncStateToWebview();
          },
          onError: (exec) => {
            this._currentExecution = exec;
            this._currentState = InputPanelStateEnum.Error;
            this.stopTimer();
            this.syncStateToWebview();
          },
        }
      );

      // Update final state
      this._currentExecution = execution;
      this._currentState = execution.status === 'completed'
        ? InputPanelStateEnum.Completed
        : InputPanelStateEnum.Error;

      // Calculate final elapsed time
      if (execution.endTime && execution.startTime) {
        this._elapsedMs = execution.endTime - execution.startTime;
      }

      this.stopTimer();
      this.syncStateToWebview();
    } catch (error) {
      // Handle unexpected errors
      this._currentState = InputPanelStateEnum.Error;
      if (this._currentExecution) {
        this._currentExecution.status = 'error';
        this._currentExecution.error = error instanceof Error ? error.message : 'Unknown error';
        this._currentExecution.endTime = Date.now();
      }
      this.stopTimer();
      this.syncStateToWebview();
    }
  }

  /**
   * Handle reset panel command
   */
  private handleResetPanel(): void {
    const nextState = getNextState(this._currentState, 'RESET');
    if (!nextState) {
      return;
    }

    this._currentState = nextState;
    this._currentExecution = null;
    this.resetTimer();
    this.syncStateToWebview();
  }

  /**
   * Handle copy to clipboard command
   */
  private handleCopyToClipboard(idType: string): void {
    let textToCopy = '';

    if (idType === 'workflowId' && this._currentExecution?.workflowId) {
      textToCopy = this._currentExecution.workflowId;
    } else if (idType === 'traceId' && this._currentExecution?.traceId) {
      textToCopy = this._currentExecution.traceId;
    }

    if (textToCopy) {
      vscode.env.clipboard.writeText(textToCopy);
      vscode.window.showInformationMessage(`Copied ${idType} to clipboard`);
    }
  }

  /**
   * Handle open X-Ray console command
   */
  private async handleOpenXrayConsole(): Promise<void> {
    const xrayUrl = await this.getXrayUrl();
    if (xrayUrl) {
      vscode.env.openExternal(vscode.Uri.parse(xrayUrl));
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
   * Get the current panel state
   */
  public get currentState(): InputPanelState {
    return this._currentState;
  }

  /**
   * Get the current validation state
   */
  public get validationState(): ValidationState {
    return this._validationState;
  }

  /**
   * Refresh the panel content
   * Call this after initialization state changes externally
   */
  public async refresh(): Promise<void> {
    await this.checkInitializationState();
    if (this._isProjectInitialized) {
      await this.runValidation();
    }
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
    this.stopTimer();

    if (this._configChangeDisposable) {
      this._configChangeDisposable.dispose();
    }

    if (this._workflowExecutor) {
      this._workflowExecutor.dispose();
    }
  }
}
