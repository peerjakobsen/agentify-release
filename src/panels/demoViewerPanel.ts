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
import {
  generateLogSectionHtml,
  generateLogSectionCss,
  generateLogSectionJs,
} from '../utils/logPanelHtmlGenerator';
import { applyFilters } from '../utils/logFilterUtils';
import type {
  InputPanelState,
  ValidationState,
  WorkflowExecution,
} from '../types/inputPanel';
import { InputPanelState as InputPanelStateEnum } from '../types/inputPanel';
import type {
  LogEntry,
  LogFilterState,
  LogPanelState,
  OutcomePanelState,
} from '../types/logPanel';
import {
  DEFAULT_LOG_PANEL_STATE,
  DEFAULT_FILTER_STATE,
  DEFAULT_OUTCOME_PANEL_STATE,
  MAX_LOG_ENTRIES,
} from '../types/logPanel';
import {
  generateOutcomePanelHtml,
  generateOutcomePanelCss,
  generateOutcomePanelJs,
} from '../utils/outcomePanelHtmlGenerator';

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
   * Log panel state (stored in instance, not workspace state)
   * Per spec: Store events array in DemoViewerPanelProvider instance state
   * Log state is NOT persisted across IDE restart (stored in instance, not workspaceState)
   */
  private _logPanelState: LogPanelState = { ...DEFAULT_LOG_PANEL_STATE };

  /**
   * Outcome panel state for displaying workflow results
   * Shows success/failure status, rendered content, and data sources
   */
  private _outcomePanelState: OutcomePanelState = { ...DEFAULT_OUTCOME_PANEL_STATE };

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
   * Extract unique agent names from log entries
   */
  private extractUniqueAgentNames(): string[] {
    const names = new Set<string>();
    for (const entry of this._logPanelState.entries) {
      if (entry.agentName && entry.agentName !== 'Workflow') {
        names.add(entry.agentName);
      }
    }
    return Array.from(names).sort();
  }

  /**
   * Get filtered log entries based on current filter state
   */
  private getFilteredLogEntries(): LogEntry[] {
    return applyFilters(this._logPanelState.entries, this._logPanelState.filters);
  }

  /**
   * Check if workflow is currently running
   */
  private isWorkflowRunning(): boolean {
    return this._currentState === InputPanelStateEnum.Running;
  }

  /**
   * Add a log entry to the panel
   * Enforces the maximum 500 entries limit by dropping oldest events when exceeded
   * Auto-expands the log section when the first event arrives
   *
   * @param entry The log entry to add
   * @param syncToWebview Whether to sync state to webview after adding (default: true)
   */
  public addLogEntry(entry: LogEntry, syncToWebview = true): void {
    // Auto-expand on first event if section is collapsed
    if (this._logPanelState.isCollapsed && this._logPanelState.entries.length === 0) {
      this._logPanelState.isCollapsed = false;
    }

    // Add entry to the entries array
    this._logPanelState.entries.push(entry);

    // Enforce maximum 500 events limit - drop oldest when exceeded
    while (this._logPanelState.entries.length > MAX_LOG_ENTRIES) {
      this._logPanelState.entries.shift();
    }

    // Sync state to webview if requested
    if (syncToWebview) {
      this.syncStateToWebview();
    }
  }

  /**
   * Add multiple log entries at once (more efficient for batch operations)
   * Enforces the maximum 500 entries limit by dropping oldest events when exceeded
   * Auto-expands the log section when the first event arrives
   *
   * @param entries Array of log entries to add
   * @param syncToWebview Whether to sync state to webview after adding (default: true)
   */
  public addLogEntries(entries: LogEntry[], syncToWebview = true): void {
    if (entries.length === 0) {
      return;
    }

    // Auto-expand on first event if section is collapsed
    if (this._logPanelState.isCollapsed && this._logPanelState.entries.length === 0) {
      this._logPanelState.isCollapsed = false;
    }

    // Add all entries
    this._logPanelState.entries.push(...entries);

    // Enforce maximum 500 events limit - drop oldest when exceeded
    if (this._logPanelState.entries.length > MAX_LOG_ENTRIES) {
      const overflow = this._logPanelState.entries.length - MAX_LOG_ENTRIES;
      this._logPanelState.entries.splice(0, overflow);
    }

    // Sync state to webview if requested
    if (syncToWebview) {
      this.syncStateToWebview();
    }
  }

  /**
   * Clear all log entries
   * Called when a new workflow run starts
   *
   * @param syncToWebview Whether to sync state to webview after clearing (default: true)
   */
  public clearLogEntries(syncToWebview = true): void {
    this._logPanelState.entries = [];
    this._logPanelState.filters = { ...DEFAULT_FILTER_STATE };
    this._logPanelState.autoScrollEnabled = true;
    this._logPanelState.isAtBottom = true;
    // Note: isCollapsed is NOT reset here - section stays collapsed until first event arrives

    if (syncToWebview) {
      this.syncStateToWebview();
    }
  }

  /**
   * Set outcome panel to success state with result and sources
   * Called when workflow_complete event is received
   *
   * @param result The workflow result (string or object)
   * @param sources Optional array of data sources used
   * @param syncToWebview Whether to sync state to webview (default: true)
   */
  public setOutcomeSuccess(
    result: string | Record<string, unknown> | undefined,
    sources?: string[],
    syncToWebview = true
  ): void {
    this._outcomePanelState = {
      status: 'success',
      result,
      sources,
      isExpanded: false,
    };

    if (syncToWebview) {
      this.syncStateToWebview();
    }
  }

  /**
   * Set outcome panel to error state with error message
   * Called when workflow_error event is received
   *
   * @param errorMessage The error message to display
   * @param errorCode Optional error code
   * @param syncToWebview Whether to sync state to webview (default: true)
   */
  public setOutcomeError(
    errorMessage: string,
    errorCode?: string,
    syncToWebview = true
  ): void {
    this._outcomePanelState = {
      status: 'error',
      errorMessage,
      errorCode,
      isExpanded: false,
    };

    if (syncToWebview) {
      this.syncStateToWebview();
    }
  }

  /**
   * Clear outcome panel (hide it)
   * Called when starting a new workflow run
   *
   * @param syncToWebview Whether to sync state to webview (default: true)
   */
  public clearOutcomePanel(syncToWebview = true): void {
    this._outcomePanelState = { ...DEFAULT_OUTCOME_PANEL_STATE };

    if (syncToWebview) {
      this.syncStateToWebview();
    }
  }

  /**
   * Toggle the expanded state of the outcome panel result
   * Used for showing/hiding truncated content
   *
   * @param syncToWebview Whether to sync state to webview (default: true)
   */
  public toggleOutcomeExpanded(syncToWebview = true): void {
    this._outcomePanelState.isExpanded = !this._outcomePanelState.isExpanded;

    if (syncToWebview) {
      this.syncStateToWebview();
    }
  }

  /**
   * Get the current outcome panel state
   */
  public get outcomePanelState(): OutcomePanelState {
    return this._outcomePanelState;
  }

  /**
   * Synchronize state to webview
   */
  private async syncStateToWebview(): Promise<void> {
    if (!this._view) {
      return;
    }

    const xrayUrl = await this.getXrayUrl();

    // Apply filters to entries before sending to webview
    const filteredEntries = this.getFilteredLogEntries();

    this._view.webview.postMessage({
      type: 'stateSync',
      state: this._currentState,
      promptText: this._promptText,
      workflowId: this._currentExecution?.workflowId || null,
      traceId: this._currentExecution?.traceId || null,
      timerDisplay: this.getTimerDisplay(),
      validationErrors: this._validationState.errors,
      xrayUrl,
      // Log panel state - send filtered entries
      logEntries: filteredEntries,
      logFilters: this._logPanelState.filters,
      logIsCollapsed: this._logPanelState.isCollapsed,
      logAutoScrollEnabled: this._logPanelState.autoScrollEnabled,
      uniqueAgentNames: this.extractUniqueAgentNames(),
      // Include total entry count for reference
      totalLogEntries: this._logPanelState.entries.length,
      // Workflow running state for auto-scroll behavior
      isWorkflowRunning: this.isWorkflowRunning(),
      // Outcome panel state
      outcomePanelState: this._outcomePanelState,
      // Pre-rendered outcome panel HTML for dynamic updates
      outcomePanelHtml: generateOutcomePanelHtml(this._outcomePanelState),
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

    // Apply filters before generating HTML
    const filteredEntries = this.getFilteredLogEntries();

    // Generate log section HTML with filtered entries
    const logSectionHtml = generateLogSectionHtml({
      entries: filteredEntries,
      isCollapsed: this._logPanelState.isCollapsed,
      uniqueAgentNames: this.extractUniqueAgentNames(),
      filters: this._logPanelState.filters,
    });

    // Generate log section CSS
    const logSectionCss = generateLogSectionCss();

    // Generate log section JS
    const logSectionJs = generateLogSectionJs();

    // Generate outcome panel HTML, CSS, and JS
    const outcomePanelHtml = generateOutcomePanelHtml(this._outcomePanelState);
    const outcomePanelCss = generateOutcomePanelCss();
    const outcomePanelJs = generateOutcomePanelJs();

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

    /* Log Section CSS */
    ${logSectionCss}

    /* Outcome Panel CSS */
    ${outcomePanelCss}
  </style>
</head>
<body>
  <!-- Input Panel Section -->
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

  <!-- Agent Graph Placeholder Section -->
  <div class="placeholder-section" id="agentGraphPlaceholder">
    Agent Graph (Coming Soon)
  </div>

  <!-- Execution Log Section -->
  ${logSectionHtml}

  <!-- Outcome Panel Section -->
  <div id="outcomePanelContainer">${outcomePanelHtml}</div>

  <script>
    const vscode = acquireVsCodeApi();
    let debounceTimer = null;

    // Constants for payload truncation
    const PAYLOAD_TRUNCATION_THRESHOLD = 20;
    const PAYLOAD_TRUNCATION_PREVIEW_LINES = 10;

    // Track previous entry count for auto-scroll trigger
    let previousEntryCount = 0;

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

      // Update log section if entries changed
      if (state.logEntries !== undefined) {
        updateLogSection(state);
      }

      // Update outcome panel if HTML provided
      if (state.outcomePanelHtml !== undefined) {
        const outcomePanelContainer = document.getElementById('outcomePanelContainer');
        if (outcomePanelContainer) {
          outcomePanelContainer.innerHTML = state.outcomePanelHtml;
        }
      }
    }

    function updateLogSection(state) {
      const logSection = document.getElementById('executionLogSection');
      if (!logSection) return;

      // Check if this is a new workflow run (entry count reset to 0 or decreased)
      const currentEntryCount = state.logEntries ? state.logEntries.length : 0;
      const isNewRun = currentEntryCount === 0 || currentEntryCount < previousEntryCount;
      const hasNewEntries = currentEntryCount > previousEntryCount;

      // Reset auto-scroll state on new run
      if (isNewRun && window.logAutoScroll) {
        window.logAutoScroll.resetAutoScrollState();
      }

      // Update collapsed state
      if (state.logIsCollapsed) {
        logSection.classList.add('collapsed');
      } else {
        logSection.classList.remove('collapsed');
      }

      // Update collapse indicator
      const indicator = logSection.querySelector('.collapse-indicator');
      if (indicator) {
        indicator.innerHTML = state.logIsCollapsed ? '&#9658;' : '&#9660;';
      }

      // Update event type filter selection
      const eventTypeFilter = document.getElementById('eventTypeFilter');
      if (eventTypeFilter && state.logFilters) {
        eventTypeFilter.value = state.logFilters.eventTypeFilter || 'all';
      }

      // Update agent name filter options and selection
      const agentFilter = document.getElementById('agentNameFilter');
      if (agentFilter && state.uniqueAgentNames) {
        const currentValue = state.logFilters?.agentNameFilter || 'all';
        agentFilter.innerHTML = '<option value="all">All Agents</option>' +
          state.uniqueAgentNames.map(name =>
            '<option value="' + escapeHtml(name) + '"' + (currentValue === name ? ' selected' : '') + '>' + escapeHtml(name) + '</option>'
          ).join('');
        // Ensure the current filter value is selected
        agentFilter.value = currentValue;
      }

      // Update log entries container - entries are already filtered by extension
      const entriesContainer = document.getElementById('logEntriesContainer');
      if (entriesContainer && state.logEntries) {
        if (state.logEntries.length === 0) {
          // Check if there are total entries but no filtered entries
          const hasEntriesButFiltered = state.totalLogEntries > 0;
          entriesContainer.innerHTML = hasEntriesButFiltered
            ? '<div class="log-entries-empty">No matching events</div>'
            : '<div class="log-entries-empty">No events to display</div>';
        } else {
          entriesContainer.innerHTML = state.logEntries.map(entry => generateLogEntryHtml(entry)).join('');
        }

        // Auto-scroll to bottom if workflow is running and has new entries
        if (hasNewEntries && window.logAutoScroll) {
          window.logAutoScroll.autoScrollIfNeeded(
            state.logAutoScrollEnabled,
            state.isWorkflowRunning
          );
        }
      }

      // Update previous entry count for next comparison
      previousEntryCount = currentEntryCount;
    }

    function generateLogEntryHtml(entry) {
      const timestamp = formatLogTimestamp(entry.timestamp);
      const icon = getEventIcon(entry.eventType, entry.status);
      const statusClass = 'status-' + entry.status;
      const hasPayload = entry.payload && Object.keys(entry.payload).length > 0;
      const expandBtn = hasPayload
        ? '<button class="log-entry-expand-btn" data-entry-id="' + escapeHtml(entry.id) + '">' + (entry.isExpanded ? '[-]' : '[+]') + '</button>'
        : '';

      // Generate payload expansion container if expanded
      let payloadHtml = '';
      if (hasPayload && entry.isExpanded) {
        payloadHtml = '<div class="log-entry-payload" data-entry-id="' + escapeHtml(entry.id) + '">' +
          generatePayloadHtml(entry.payload, entry.isTruncationExpanded, entry.id) +
          '</div>';
      }

      return '<div class="log-entry-wrapper" data-entry-id="' + escapeHtml(entry.id) + '">' +
        '<div class="log-entry ' + statusClass + '" data-entry-id="' + escapeHtml(entry.id) + '">' +
        '<span class="log-entry-timestamp">' + timestamp + '</span>' +
        '<span class="log-entry-icon ' + statusClass + '">' + icon + '</span>' +
        '<span class="log-entry-agent">' + escapeHtml(entry.agentName) + '</span>' +
        '<span class="log-entry-summary">' + escapeHtml(entry.summary) + '</span>' +
        expandBtn +
        '</div>' +
        payloadHtml +
        '</div>';
    }

    function generatePayloadHtml(payload, isTruncationExpanded, entryId) {
      const jsonString = JSON.stringify(payload, null, 2);
      const lines = jsonString.split('\\n');
      const needsTruncation = lines.length > PAYLOAD_TRUNCATION_THRESHOLD;

      if (!needsTruncation || isTruncationExpanded) {
        // Show full payload with syntax highlighting
        const highlighted = tokenizeJson(jsonString);
        return '<pre class="payload-content">' + highlighted + '</pre>';
      }

      // Show truncated payload with "Show more" link
      const truncatedLines = lines.slice(0, PAYLOAD_TRUNCATION_PREVIEW_LINES);
      const remainingLines = lines.length - PAYLOAD_TRUNCATION_PREVIEW_LINES;
      const truncated = truncatedLines.join('\\n');
      const highlighted = tokenizeJson(truncated);

      return '<pre class="payload-content payload-truncated">' + highlighted + '</pre>' +
        '<button class="payload-show-more" data-entry-id="' + escapeHtml(entryId) + '">' +
        'Show more... (' + remainingLines + ' more lines)' +
        '</button>';
    }

    function tokenizeJson(jsonString) {
      // Patterns to match JSON tokens (order matters: keys before strings)
      const patterns = [
        { type: 'key', regex: /"([^"\\\\]|\\\\.)*"\\s*(?=:)/g },
        { type: 'string', regex: /"([^"\\\\]|\\\\.)*"/g },
        { type: 'number', regex: /-?\\d+\\.?\\d*(?:[eE][+-]?\\d+)?/g },
        { type: 'boolean', regex: /\\b(true|false)\\b/g },
        { type: 'null', regex: /\\bnull\\b/g },
      ];

      // Create a map of positions to tokens
      const tokens = [];

      for (const { type, regex } of patterns) {
        let match;
        const regexClone = new RegExp(regex.source, regex.flags);
        while ((match = regexClone.exec(jsonString)) !== null) {
          // Check if this position is already covered by another token
          const isOverlapping = tokens.some(
            t => match.index < t.end && match.index + match[0].length > t.start
          );
          if (!isOverlapping) {
            tokens.push({
              start: match.index,
              end: match.index + match[0].length,
              type: type,
              text: match[0],
            });
          }
        }
      }

      // Sort tokens by position
      tokens.sort((a, b) => a.start - b.start);

      // Build highlighted HTML
      let result = '';
      let lastIndex = 0;

      for (const token of tokens) {
        // Add any non-token text before this token
        if (token.start > lastIndex) {
          result += escapeHtml(jsonString.slice(lastIndex, token.start));
        }
        // Add the highlighted token
        result += '<span class="json-' + token.type + '">' + escapeHtml(token.text) + '</span>';
        lastIndex = token.end;
      }

      // Add any remaining text after the last token
      if (lastIndex < jsonString.length) {
        result += escapeHtml(jsonString.slice(lastIndex));
      }

      return result;
    }

    function formatLogTimestamp(timestamp) {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '--:--:--.---';
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      const s = String(date.getSeconds()).padStart(2, '0');
      const ms = String(date.getMilliseconds()).padStart(3, '0');
      return h + ':' + m + ':' + s + '.' + ms;
    }

    function getEventIcon(eventType, status) {
      switch (eventType) {
        case 'node_start':
          return '<svg class="log-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2v12l10-6L4 2z"/></svg>';
        case 'node_stop':
          if (status === 'error') {
            return '<svg class="log-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>';
          }
          return '<svg class="log-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>';
        case 'tool_call':
          return '<svg class="log-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M11.92 5.28a.75.75 0 01.04 1.06l-.04.04-1.5 1.5 2.28 2.28a.75.75 0 01-1.06 1.06l-2.28-2.28-4.5 4.5a.75.75 0 01-1.06-1.06l4.5-4.5-1.5-1.5a.75.75 0 01.04-1.1l.02-.01.04-.03 2.5-2.5a3.25 3.25 0 014.52 4.52l-.02.02z"/></svg>';
        case 'tool_result':
          return '<svg class="log-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8.22 2.97a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06l2.97-2.97H3.75a.75.75 0 010-1.5h7.44L8.22 4.03a.75.75 0 010-1.06z"/></svg>';
        case 'workflow_complete':
          return '<svg class="log-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2.5a.5.5 0 01.5-.5h9a.5.5 0 01.4.8L10.5 6l2.4 3.2a.5.5 0 01-.4.8H4v4a.5.5 0 01-1 0v-11z"/></svg>';
        case 'workflow_error':
          return '<svg class="log-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM7 4.75a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0v-3.5zm.75 6.5a1 1 0 100-2 1 1 0 000 2z"/></svg>';
        default:
          return '';
      }
    }

    function escapeHtml(text) {
      if (!text) return '';
      return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Log section JavaScript handlers
    ${logSectionJs}

    // Outcome panel JavaScript handlers
    ${outcomePanelJs}
  </script>
</body>
</html>`;
  }

  /**
   * Handle messages received from the webview
   * @param message The message from the webview
   */
  private async handleMessage(message: unknown): Promise<void> {
    const msg = message as {
      command?: string;
      prompt?: string;
      text?: string;
      idType?: string;
      isCollapsed?: boolean;
      filterType?: string;
      value?: string;
      entryId?: string;
      isAtBottom?: boolean;
      userScrolledUp?: boolean;
    };

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

      // Log section message handlers
      case 'logSectionToggle':
        this._logPanelState.isCollapsed = msg.isCollapsed ?? this._logPanelState.isCollapsed;
        break;

      case 'logFilterChange':
        this.handleLogFilterChange(msg.filterType || '', msg.value || '');
        break;

      case 'logEntryToggle':
        this.handleLogEntryToggle(msg.entryId || '');
        break;

      case 'logPayloadShowMore':
        this.handleLogPayloadShowMore(msg.entryId || '');
        break;

      case 'logScrollPosition':
        this._logPanelState.isAtBottom = msg.isAtBottom ?? true;
        // Disable auto-scroll when user scrolls up manually
        if (msg.userScrolledUp) {
          this._logPanelState.autoScrollEnabled = false;
        }
        break;

      case 'logScrollToBottom':
        // User clicked scroll to bottom button - re-enable auto-scroll
        this._logPanelState.isAtBottom = true;
        this._logPanelState.autoScrollEnabled = true;
        break;

      // Outcome panel message handlers
      case 'outcomePanelToggleExpand':
        this.toggleOutcomeExpanded();
        break;

      default:
        console.log('[DemoViewer] Received message:', message);
    }
  }

  /**
   * Handle log filter change
   */
  private handleLogFilterChange(filterType: string, value: string): void {
    if (filterType === 'eventType') {
      this._logPanelState.filters.eventTypeFilter = value as LogFilterState['eventTypeFilter'];
    } else if (filterType === 'agentName') {
      this._logPanelState.filters.agentNameFilter = value === 'all' ? null : value;
    }
    this.syncStateToWebview();
  }

  /**
   * Handle log entry expand/collapse toggle
   */
  private handleLogEntryToggle(entryId: string): void {
    const entry = this._logPanelState.entries.find(e => e.id === entryId);
    if (entry) {
      entry.isExpanded = !entry.isExpanded;
      this.syncStateToWebview();
    }
  }

  /**
   * Handle payload "Show more" click to expand truncated payload
   */
  private handleLogPayloadShowMore(entryId: string): void {
    const entry = this._logPanelState.entries.find(e => e.id === entryId);
    if (entry) {
      entry.isTruncationExpanded = true;
      this.syncStateToWebview();
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

    // Clear log entries for new run and reset filters to defaults
    // Also reset log section to collapsed state (will auto-expand on first event)
    this._logPanelState.entries = [];
    this._logPanelState.filters = { ...DEFAULT_FILTER_STATE };
    this._logPanelState.autoScrollEnabled = true;
    this._logPanelState.isAtBottom = true;
    this._logPanelState.isCollapsed = true; // Reset to collapsed, will auto-expand on first event

    // Clear outcome panel for new run (hide immediately)
    this._outcomePanelState = { ...DEFAULT_OUTCOME_PANEL_STATE };

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
   * Get the current log panel state
   */
  public get logPanelState(): LogPanelState {
    return this._logPanelState;
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
