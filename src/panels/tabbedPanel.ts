/**
 * Tabbed Panel Provider
 * Unified panel with tabs for Ideation Wizard and Demo Viewer
 * Each tab gets full panel height for optimal UX
 */

import * as vscode from 'vscode';
import { getBedrockConversationService, BedrockConversationService } from '../services/bedrockConversationService';
import { buildContextMessage, parseAssumptionsFromResponse, generateStep1Hash, hasStep1Changed } from '../services/gapFillingService';

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

  // Bedrock service for AI gap-filling
  private _bedrockService?: BedrockConversationService;
  private _bedrockDisposables: vscode.Disposable[] = [];
  private _streamingResponse = '';

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

      // Step 2: AI Gap-Filling commands
      case 'sendChatMessage':
        this.handleSendChatMessage(message.value as string);
        break;
      case 'acceptAssumptions':
        this.handleAcceptAssumptions();
        break;
      case 'regenerateAssumptions':
        this.handleRegenerateAssumptions();
        break;
      case 'retryLastMessage':
        this.handleRetryLastMessage();
        break;

      // Step 3: Outcome Definition commands
      case 'updatePrimaryOutcome':
        this._ideationState.outcome.primaryOutcome = message.value as string;
        this._ideationState.outcome.primaryOutcomeEdited = true;
        this.syncStateToWebview();
        break;
      case 'addMetric':
        this._ideationState.outcome.successMetrics.push({
          name: '',
          targetValue: '',
          unit: '',
        });
        this._ideationState.outcome.metricsEdited = true;
        this.updateWebviewContent();
        this.syncStateToWebview();
        break;
      case 'removeMetric':
        const metricIndex = message.index as number;
        if (metricIndex >= 0 && metricIndex < this._ideationState.outcome.successMetrics.length) {
          this._ideationState.outcome.successMetrics.splice(metricIndex, 1);
          this._ideationState.outcome.metricsEdited = true;
          this.updateWebviewContent();
          this.syncStateToWebview();
        }
        break;
      case 'updateMetric':
        const updateIndex = message.index as number;
        const field = message.field as string;
        const metric = this._ideationState.outcome.successMetrics[updateIndex];
        if (metric) {
          if (field === 'name') {
            metric.name = message.value as string;
          } else if (field === 'targetValue') {
            metric.targetValue = message.value as string;
          } else if (field === 'unit') {
            metric.unit = message.value as string;
          }
          this._ideationState.outcome.metricsEdited = true;
          this.syncStateToWebview();
        }
        break;
      case 'toggleStakeholder':
        const stakeholder = message.value as string;
        const stakeholders = this._ideationState.outcome.stakeholders;
        const stakeholderIdx = stakeholders.indexOf(stakeholder);
        if (stakeholderIdx >= 0) {
          stakeholders.splice(stakeholderIdx, 1);
        } else {
          stakeholders.push(stakeholder);
        }
        this._ideationState.outcome.stakeholdersEdited = true;
        this.syncStateToWebview();
        break;
      case 'addCustomStakeholder':
        const customStakeholder = message.value as string;
        if (customStakeholder && customStakeholder.trim()) {
          const trimmedValue = customStakeholder.trim();
          // Add to custom stakeholders if not already in static list or custom list
          if (
            !STAKEHOLDER_OPTIONS.includes(trimmedValue) &&
            !this._ideationState.outcome.customStakeholders.includes(trimmedValue)
          ) {
            this._ideationState.outcome.customStakeholders.push(trimmedValue);
          }
          // Also add to selected stakeholders
          if (!this._ideationState.outcome.stakeholders.includes(trimmedValue)) {
            this._ideationState.outcome.stakeholders.push(trimmedValue);
          }
          this._ideationState.outcome.stakeholdersEdited = true;
          this.updateWebviewContent();
          this.syncStateToWebview();
        }
        break;
      case 'regenerateOutcomeSuggestions':
        // For now, just clear the form (AI integration can be added later)
        this._ideationState.outcome.primaryOutcome = '';
        this._ideationState.outcome.successMetrics = [];
        this._ideationState.outcome.stakeholders = [];
        this._ideationState.outcome.primaryOutcomeEdited = false;
        this._ideationState.outcome.metricsEdited = false;
        this._ideationState.outcome.stakeholdersEdited = false;
        this.updateWebviewContent();
        this.syncStateToWebview();
        break;
      case 'dismissOutcomeError':
        this._ideationState.outcome.loadingError = undefined;
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

    const previousStep = this._ideationState.currentStep;

    if (this._ideationState.currentStep < 6) {
      this._ideationState.currentStep++;
      this._ideationState.highestStepReached = Math.max(
        this._ideationState.highestStepReached,
        this._ideationState.currentStep
      );
      this._ideationState.validationAttempted = false;
      this.updateWebviewContent();
      this.syncStateToWebview();

      // Auto-send context to Claude when entering Step 2
      if (previousStep === 1 && this._ideationState.currentStep === 2) {
        this.triggerAutoSendForStep2();
      }
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

  // =========================================================================
  // Step 2: AI Gap-Filling Methods
  // =========================================================================

  /**
   * Trigger auto-send when entering Step 2
   */
  private triggerAutoSendForStep2(): void {
    const state = this._ideationState.aiGapFillingState;

    // Check if Step 1 inputs have changed since last visit
    if (hasStep1Changed(
      state.step1InputHash,
      this._ideationState.businessObjective,
      this._ideationState.industry,
      this._ideationState.systems,
      this._ideationState.customSystems
    )) {
      // Reset conversation state due to input changes
      this._ideationState.aiGapFillingState = {
        conversationHistory: [],
        confirmedAssumptions: [],
        assumptionsAccepted: false,
        isStreaming: false,
      };
    }

    // Only auto-send if conversation is empty
    if (this._ideationState.aiGapFillingState.conversationHistory.length === 0 && !this._ideationState.aiGapFillingState.isStreaming) {
      this.sendContextToClaude();
    }
  }

  /**
   * Initialize Bedrock service if needed
   */
  private initBedrockService(): BedrockConversationService | undefined {
    if (this._bedrockService) {
      return this._bedrockService;
    }

    if (!this._context) {
      console.warn('[TabbedPanel] Extension context not available for Bedrock service');
      return undefined;
    }

    this._bedrockService = getBedrockConversationService(this._context);

    // Subscribe to streaming events
    this._bedrockDisposables.push(
      this._bedrockService.onToken((token) => {
        this.handleStreamingToken(token);
      })
    );

    this._bedrockDisposables.push(
      this._bedrockService.onComplete((response) => {
        this.handleStreamingComplete(response);
      })
    );

    this._bedrockDisposables.push(
      this._bedrockService.onError((error) => {
        this.handleStreamingError(error.message);
      })
    );

    return this._bedrockService;
  }

  /**
   * Build and send context to Claude via Bedrock
   */
  private async sendContextToClaude(): Promise<void> {
    const service = this.initBedrockService();
    if (!service) {
      this._ideationState.aiGapFillingState.streamingError =
        'Claude service not available. Please check your configuration.';
      this.syncStateToWebview();
      return;
    }

    // Build context message from Step 1 inputs (including custom systems)
    const contextMessage = buildContextMessage(
      this._ideationState.businessObjective,
      this._ideationState.industry,
      this._ideationState.systems,
      this._ideationState.customSystems
    );

    // Store hash for change detection (include custom systems)
    this._ideationState.aiGapFillingState.step1InputHash = generateStep1Hash(
      this._ideationState.businessObjective,
      this._ideationState.industry,
      this._ideationState.systems,
      this._ideationState.customSystems
    );

    // Add user message to conversation history
    this._ideationState.aiGapFillingState.conversationHistory.push({
      role: 'user',
      content: contextMessage,
      timestamp: Date.now(),
    });

    // Set streaming state
    this._ideationState.aiGapFillingState.isStreaming = true;
    this._ideationState.aiGapFillingState.streamingError = undefined;
    this._streamingResponse = '';
    this.updateWebviewContent();
    this.syncStateToWebview();

    // Send message to Claude (streaming handled by event handlers)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _token of service.sendMessage(contextMessage)) {
        // Tokens are handled by onToken event handler
      }
    } catch (error) {
      this.handleStreamingError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Handle incoming streaming token from Claude
   */
  private handleStreamingToken(token: string): void {
    this._streamingResponse += token;

    // Send incremental update to webview
    if (this._view) {
      this._view.webview.postMessage({
        type: 'streamingToken',
        content: this._streamingResponse,
      });
    }
  }

  /**
   * Handle streaming completion from Claude
   */
  private handleStreamingComplete(fullResponse: string): void {
    // Parse assumptions from response
    const parsedAssumptions = parseAssumptionsFromResponse(fullResponse);

    // Add assistant message to conversation history
    this._ideationState.aiGapFillingState.conversationHistory.push({
      role: 'assistant',
      content: fullResponse,
      timestamp: Date.now(),
      parsedAssumptions,
    });

    // Update streaming state
    this._ideationState.aiGapFillingState.isStreaming = false;
    this._streamingResponse = '';
    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Handle streaming error from Claude
   */
  private handleStreamingError(errorMessage: string): void {
    this._ideationState.aiGapFillingState.isStreaming = false;
    this._ideationState.aiGapFillingState.streamingError = errorMessage;
    this._streamingResponse = '';
    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Handle send chat message command
   */
  private async handleSendChatMessage(content: string): Promise<void> {
    if (!content.trim()) return;

    const service = this.initBedrockService();
    if (!service) {
      return;
    }

    // Add user message to conversation history
    this._ideationState.aiGapFillingState.conversationHistory.push({
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    });

    // Set streaming state
    this._ideationState.aiGapFillingState.isStreaming = true;
    this._ideationState.aiGapFillingState.streamingError = undefined;
    this._streamingResponse = '';
    this.updateWebviewContent();
    this.syncStateToWebview();

    // Send message to Claude
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _token of service.sendMessage(content.trim())) {
        // Tokens are handled by onToken event handler
      }
    } catch (error) {
      this.handleStreamingError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Handle accept assumptions command
   */
  private handleAcceptAssumptions(): void {
    const history = this._ideationState.aiGapFillingState.conversationHistory;

    // Find last assistant message with assumptions
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === 'assistant' && msg.parsedAssumptions && msg.parsedAssumptions.length > 0) {
        this._ideationState.aiGapFillingState.confirmedAssumptions = [...msg.parsedAssumptions];
        this._ideationState.aiGapFillingState.assumptionsAccepted = true;
        break;
      }
    }

    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Handle regenerate assumptions command
   */
  private handleRegenerateAssumptions(): void {
    // Reset conversation but keep the hash
    const hash = this._ideationState.aiGapFillingState.step1InputHash;
    this._ideationState.aiGapFillingState = {
      conversationHistory: [],
      confirmedAssumptions: [],
      assumptionsAccepted: false,
      isStreaming: false,
    };
    this._ideationState.aiGapFillingState.step1InputHash = hash;

    // Reset the Bedrock service conversation history
    if (this._bedrockService) {
      this._bedrockService.resetConversation();
    }

    this.updateWebviewContent();
    this.syncStateToWebview();

    // Trigger new conversation
    this.sendContextToClaude();
  }

  /**
   * Handle retry last message command
   */
  private handleRetryLastMessage(): void {
    const history = this._ideationState.aiGapFillingState.conversationHistory;

    // Clear the error
    this._ideationState.aiGapFillingState.streamingError = undefined;

    // If there's no history or only one message, resend context
    if (history.length <= 1) {
      this.sendContextToClaude();
      return;
    }

    // Find the last user message and resend it
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === 'user') {
        // Remove this message from history (it will be re-added by handleSendChatMessage)
        history.splice(i, 1);
        this.handleSendChatMessage(msg.content);
        break;
      }
    }
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
      if (message.type === 'streamingToken') {
        // Update the streaming message content in real-time
        const streamingText = document.querySelector('.streaming .streaming-text');
        const typingIndicator = document.querySelector('.streaming .typing-indicator');
        const chatContainer = document.querySelector('.chat-container');
        if (streamingText) {
          streamingText.textContent = message.content;
          // Hide typing indicator once we have content
          if (typingIndicator && message.content) {
            typingIndicator.style.display = 'none';
          }
          // Auto-scroll to bottom
          if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
          }
        }
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

      /* Step 2: AI Gap-Filling Chat Styles */
      .step2-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
        gap: 12px;
      }
      .step-description {
        font-size: 13px;
        color: var(--vscode-descriptionForeground);
        margin: 0;
        flex: 1;
      }
      .regenerate-btn {
        padding: 6px 12px;
        font-size: 12px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        white-space: nowrap;
      }
      .regenerate-btn:hover:not(:disabled) {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      .regenerate-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .chat-container {
        min-height: 200px;
        max-height: 350px;
        overflow-y: auto;
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
        margin-bottom: 12px;
      }
      .chat-messages {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
      }
      .chat-message {
        display: flex;
        gap: 8px;
        max-width: 90%;
      }
      .chat-message.claude-message {
        align-self: flex-start;
      }
      .chat-message.user-message {
        align-self: flex-end;
        flex-direction: row-reverse;
      }
      .message-avatar {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }
      .message-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .message-text {
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 13px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      .claude-message .message-text {
        background: var(--vscode-input-background);
        border-bottom-left-radius: 4px;
      }
      .user-message .message-text {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-bottom-right-radius: 4px;
      }
      .streaming-text:empty {
        display: none;
      }
      .streaming-text {
        background: var(--vscode-input-background);
        border-bottom-left-radius: 4px;
      }
      .typing-indicator {
        display: flex;
        gap: 4px;
        padding: 12px 14px;
        background: var(--vscode-input-background);
        border-radius: 12px;
        border-bottom-left-radius: 4px;
      }
      .typing-indicator .dot {
        width: 8px;
        height: 8px;
        background: var(--vscode-descriptionForeground);
        border-radius: 50%;
        animation: typing 1.4s infinite ease-in-out both;
      }
      .typing-indicator .dot:nth-child(1) { animation-delay: 0s; }
      .typing-indicator .dot:nth-child(2) { animation-delay: 0.2s; }
      .typing-indicator .dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes typing {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
        40% { transform: scale(1); opacity: 1; }
      }
      .assumptions-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .assumption-card {
        padding: 12px;
        background: var(--vscode-editorWidget-background);
        border: 1px solid var(--vscode-editorWidget-border);
        border-radius: 6px;
      }
      .assumption-card.user-corrected {
        border-left: 3px solid var(--vscode-charts-blue, #3794ff);
      }
      .assumption-header {
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .assumption-modules {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 8px;
      }
      .module-chip {
        display: inline-block;
        padding: 2px 8px;
        font-size: 11px;
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        border-radius: 12px;
      }
      .assumption-integrations {
        margin: 0;
        padding-left: 16px;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }
      .assumption-integrations li {
        margin-bottom: 2px;
      }
      .accept-btn {
        margin-top: 8px;
        padding: 8px 16px;
        font-size: 12px;
        font-weight: 500;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .accept-btn:hover:not(:disabled) {
        background: var(--vscode-button-hoverBackground);
      }
      .accept-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .error-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
        border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
        border-radius: 6px;
      }
      .error-text {
        font-size: 12px;
        color: var(--vscode-errorForeground, #f48771);
      }
      .retry-btn {
        align-self: flex-start;
        padding: 6px 12px;
        font-size: 11px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .retry-btn:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      .chat-input-area {
        display: flex;
        gap: 8px;
      }
      .chat-input {
        flex: 1;
        padding: 10px 12px;
        font-size: 13px;
        font-family: var(--vscode-font-family);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
      }
      .chat-input:focus {
        outline: 1px solid var(--vscode-focusBorder);
        border-color: var(--vscode-focusBorder);
      }
      .chat-input:disabled {
        opacity: 0.5;
      }
      .send-btn {
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 500;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .send-btn:hover:not(:disabled) {
        background: var(--vscode-button-hoverBackground);
      }
      .send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .finalization-hint {
        padding: 8px 12px;
        margin-bottom: 12px;
        font-size: 12px;
        text-align: center;
        color: var(--vscode-descriptionForeground);
        background: var(--vscode-input-background);
        border-radius: 4px;
      }

      /* Step 3: Outcome Definition Styles */
      .step3-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
        gap: 12px;
      }
      .outcome-loading {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        margin-bottom: 16px;
        background: var(--vscode-input-background);
        border-radius: 4px;
      }
      .outcome-loading .loading-text {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }
      .outcome-error {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        margin-bottom: 16px;
        background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
        border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
        border-radius: 4px;
      }
      .dismiss-error-btn {
        background: transparent;
        border: none;
        color: var(--vscode-errorForeground, #f48771);
        font-size: 11px;
        cursor: pointer;
        padding: 4px 8px;
      }
      .dismiss-error-btn:hover {
        text-decoration: underline;
      }
      .field-hint {
        margin: 0 0 8px 0;
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
      }
      .metrics-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 12px;
      }
      .metric-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .metric-input {
        padding: 8px 10px;
        font-family: var(--vscode-font-family);
        font-size: 13px;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
      }
      .metric-input:focus {
        outline: 1px solid var(--vscode-focusBorder);
        border-color: var(--vscode-focusBorder);
      }
      .metric-name {
        flex: 2;
      }
      .metric-target {
        flex: 1;
      }
      .metric-unit {
        flex: 1;
      }
      .remove-metric-btn {
        background: transparent;
        border: none;
        color: var(--vscode-errorForeground, #f48771);
        font-size: 14px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
      }
      .remove-metric-btn:hover {
        background: var(--vscode-input-background);
      }
      .add-metric-btn {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: none;
        padding: 8px 16px;
        font-size: 12px;
        border-radius: 4px;
        cursor: pointer;
        align-self: flex-start;
      }
      .add-metric-btn:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      .stakeholders-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin-bottom: 12px;
      }
      .stakeholder-checkbox {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        font-size: 12px;
        padding: 6px 8px;
        background: var(--vscode-input-background);
        border-radius: 4px;
      }
      .stakeholder-checkbox input[type="checkbox"] {
        margin: 0;
        cursor: pointer;
        width: auto;
      }
      .stakeholder-checkbox.ai-suggested {
        border: 1px solid var(--vscode-button-background);
      }
      .ai-badge {
        font-size: 10px;
        padding: 2px 6px;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-radius: 10px;
        margin-left: auto;
      }
      .custom-stakeholder-input {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }
      .custom-stakeholder-input input {
        flex: 1;
      }
      .add-stakeholder-btn {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: none;
        padding: 8px 16px;
        font-size: 12px;
        border-radius: 4px;
        cursor: pointer;
      }
      .add-stakeholder-btn:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      textarea.error {
        border-color: var(--vscode-inputValidation-errorBorder, #be1100);
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
    if (this._ideationState.currentStep === 2) {
      return this.getStep2Html();
    }
    if (this._ideationState.currentStep === 3) {
      return this.getStep3Html();
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
   * Get Step 2 (AI Gap-Filling) HTML
   */
  private getStep2Html(): string {
    const state = this._ideationState.aiGapFillingState;
    const isStreaming = state?.isStreaming ?? false;
    const hasError = !!state?.streamingError;
    const assumptionsAccepted = state?.assumptionsAccepted ?? false;
    const conversationHistory = state?.conversationHistory ?? [];
    const conversationCount = conversationHistory.filter((m: { role: string }) => m.role === 'user').length;
    const showHint = conversationCount >= 3 && !assumptionsAccepted;

    // Render conversation messages
    const messagesHtml = conversationHistory
      .map((msg: { role: string; content: string; parsedAssumptions?: Array<{ system: string; modules: string[]; integrations: string[]; source: string }> }) => {
        if (msg.role === 'user') {
          return `
            <div class="chat-message user-message">
              <div class="message-content">
                <div class="message-text">${this.escapeHtml(msg.content)}</div>
              </div>
            </div>
          `;
        } else {
          // Claude message with optional assumption cards
          let assumptionsHtml = '';
          if (msg.parsedAssumptions && msg.parsedAssumptions.length > 0) {
            const cardsHtml = msg.parsedAssumptions.map((a: { system: string; modules: string[]; integrations: string[]; source: string }) => {
              const modulesHtml = a.modules.map((m: string) => `<span class="module-chip">${this.escapeHtml(m)}</span>`).join('');
              const integrationsHtml = a.integrations.map((i: string) => `<li>${this.escapeHtml(i)}</li>`).join('');
              const sourceClass = a.source === 'user-corrected' ? 'user-corrected' : '';
              return `
                <div class="assumption-card ${sourceClass}">
                  <div class="assumption-header">${this.escapeHtml(a.system)}</div>
                  ${modulesHtml ? `<div class="assumption-modules">${modulesHtml}</div>` : ''}
                  ${integrationsHtml ? `<ul class="assumption-integrations">${integrationsHtml}</ul>` : ''}
                </div>
              `;
            }).join('');

            const acceptDisabled = assumptionsAccepted || isStreaming;
            const acceptLabel = assumptionsAccepted ? 'Accepted ✓' : 'Accept Assumptions';

            assumptionsHtml = `
              <div class="assumptions-container">
                ${cardsHtml}
                <button class="accept-btn" onclick="acceptAssumptions()" ${acceptDisabled ? 'disabled' : ''}>
                  ${acceptLabel}
                </button>
              </div>
            `;
          }

          return `
            <div class="chat-message claude-message">
              <div class="message-avatar">🤖</div>
              <div class="message-content">
                <div class="message-text">${this.escapeHtml(msg.content)}</div>
                ${assumptionsHtml}
              </div>
            </div>
          `;
        }
      })
      .join('');

    // Render streaming indicator or error
    let statusHtml = '';
    if (isStreaming) {
      statusHtml = `
        <div class="chat-message claude-message streaming">
          <div class="message-avatar">🤖</div>
          <div class="message-content">
            <div class="message-text streaming-text"></div>
            <div class="typing-indicator">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
        </div>
      `;
    } else if (hasError) {
      statusHtml = `
        <div class="chat-message error-message">
          <div class="error-content">
            <div class="error-text">Response interrupted: ${this.escapeHtml(state?.streamingError || '')}</div>
            <button class="retry-btn" onclick="retryLastMessage()">Try Again</button>
          </div>
        </div>
      `;
    }

    // Render finalization hint
    const hintHtml = showHint
      ? '<div class="finalization-hint">Ready to finalize? Click Confirm & Continue.</div>'
      : '';

    return `
      <div class="step2-header">
        <p class="step-description">Claude will analyze your context and propose assumptions about your environment.</p>
        <button class="regenerate-btn" onclick="regenerateAssumptions()" ${isStreaming ? 'disabled' : ''}>
          ↻ Regenerate
        </button>
      </div>

      <div class="chat-container">
        <div class="chat-messages" id="chatMessages">
          ${messagesHtml}
          ${statusHtml}
        </div>
      </div>

      ${hintHtml}

      <div class="chat-input-area">
        <input
          type="text"
          id="chatInput"
          class="chat-input"
          placeholder="Refine assumptions..."
          ${isStreaming ? 'disabled' : ''}
          onkeydown="handleChatKeydown(event)"
        >
        <button class="send-btn" onclick="sendChatMessage()" ${isStreaming ? 'disabled' : ''}>
          Send
        </button>
      </div>
    `;
  }

  /**
   * Get Step 3 (Outcome Definition) HTML
   */
  private getStep3Html(): string {
    const state = this._ideationState.outcome;
    const showErrors = this._ideationState.validationAttempted;

    // Check for validation errors
    const primaryOutcomeError = showErrors && !state.primaryOutcome.trim();
    const metricsWarning = state.successMetrics.length === 0;

    // Render loading indicator or error
    let loadingHtml = '';
    if (state.isLoading) {
      loadingHtml = `
        <div class="outcome-loading">
          <div class="typing-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
          <span class="loading-text">Generating suggestions...</span>
        </div>
      `;
    } else if (state.loadingError) {
      loadingHtml = `
        <div class="outcome-error">
          <span class="error-text">${this.escapeHtml(state.loadingError)}</span>
          <button class="dismiss-error-btn" onclick="dismissOutcomeError()">Dismiss</button>
        </div>
      `;
    }

    // Render metrics list
    const metricsHtml = state.successMetrics.map((metric, index) => `
      <div class="metric-row" data-index="${index}">
        <input
          type="text"
          class="metric-input metric-name"
          placeholder="Metric name"
          value="${this.escapeHtml(metric.name)}"
          oninput="updateMetric(${index}, 'name', this.value)"
        >
        <input
          type="text"
          class="metric-input metric-target"
          placeholder="Target"
          value="${this.escapeHtml(metric.targetValue)}"
          oninput="updateMetric(${index}, 'targetValue', this.value)"
        >
        <input
          type="text"
          class="metric-input metric-unit"
          placeholder="Unit"
          value="${this.escapeHtml(metric.unit)}"
          oninput="updateMetric(${index}, 'unit', this.value)"
        >
        <button class="remove-metric-btn" onclick="removeMetric(${index})" title="Remove metric">✕</button>
      </div>
    `).join('');

    // Combine static stakeholders with AI-suggested custom stakeholders
    const allStakeholders = [...STAKEHOLDER_OPTIONS];
    const aiSuggestedStakeholders = state.customStakeholders.filter(
      (s) => !STAKEHOLDER_OPTIONS.includes(s)
    );

    // Render stakeholder checkboxes
    const stakeholderCheckboxesHtml = allStakeholders.map((stakeholder) => {
      const checked = state.stakeholders.includes(stakeholder) ? 'checked' : '';
      const stakeholderId = stakeholder.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      return `
        <label class="stakeholder-checkbox">
          <input type="checkbox" id="stakeholder-${stakeholderId}" value="${stakeholder}" ${checked} onchange="toggleStakeholder('${stakeholder}')">
          <span class="checkbox-label">${this.escapeHtml(stakeholder)}</span>
        </label>
      `;
    }).join('');

    // Render AI-suggested stakeholders with badge
    const aiStakeholderCheckboxesHtml = aiSuggestedStakeholders.map((stakeholder) => {
      const checked = state.stakeholders.includes(stakeholder) ? 'checked' : '';
      const stakeholderId = stakeholder.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      return `
        <label class="stakeholder-checkbox ai-suggested">
          <input type="checkbox" id="stakeholder-${stakeholderId}" value="${stakeholder}" ${checked} onchange="toggleStakeholder('${this.escapeHtml(stakeholder)}')">
          <span class="checkbox-label">${this.escapeHtml(stakeholder)}</span>
          <span class="ai-badge">AI suggested</span>
        </label>
      `;
    }).join('');

    return `
      <div class="step3-header">
        <p class="step-description">Define measurable business outcomes and success metrics for your workflow.</p>
        <button class="regenerate-btn" onclick="regenerateOutcomeSuggestions()" ${state.isLoading ? 'disabled' : ''}>
          ↻ Regenerate
        </button>
      </div>

      ${loadingHtml}

      <div class="form-section">
        <label class="form-label required">Primary Outcome</label>
        <textarea
          class="${primaryOutcomeError ? 'error' : ''}"
          placeholder="Describe the measurable business result you want to achieve..."
          oninput="updatePrimaryOutcome(this.value)"
        >${this.escapeHtml(state.primaryOutcome)}</textarea>
        ${primaryOutcomeError ? '<div class="error-message">Primary outcome is required</div>' : ''}
      </div>

      <div class="form-section">
        <label class="form-label">Success Metrics</label>
        ${metricsWarning && showErrors ? '<div class="warning-banner">Consider adding at least one success metric to measure outcomes</div>' : ''}
        <div class="metrics-list">
          ${metricsHtml}
        </div>
        <button class="add-metric-btn" onclick="addMetric()">+ Add Metric</button>
      </div>

      <div class="form-section">
        <label class="form-label">Stakeholders</label>
        <p class="field-hint">Select stakeholders who will benefit from or be impacted by this workflow.</p>
        <div class="stakeholders-grid">
          ${stakeholderCheckboxesHtml}
          ${aiStakeholderCheckboxesHtml}
        </div>
        <div class="custom-stakeholder-input">
          <input
            type="text"
            id="customStakeholderInput"
            placeholder="Add custom stakeholder..."
            onkeydown="handleCustomStakeholderKeydown(event)"
          >
          <button class="add-stakeholder-btn" onclick="addCustomStakeholder()">Add</button>
        </div>
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
        // Auto-scroll chat to bottom after sync
        scrollChatToBottom();
      }
      function scrollChatToBottom() {
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }
      // Auto-scroll on initial load
      setTimeout(scrollChatToBottom, 100);
      // Step 2: AI Gap-Filling functions
      function sendChatMessage() {
        const input = document.getElementById('chatInput');
        if (input && input.value.trim()) {
          vscode.postMessage({ command: 'sendChatMessage', value: input.value.trim() });
          input.value = '';
        }
      }
      function handleChatKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendChatMessage();
        }
      }
      function acceptAssumptions() {
        vscode.postMessage({ command: 'acceptAssumptions' });
      }
      function regenerateAssumptions() {
        vscode.postMessage({ command: 'regenerateAssumptions' });
      }
      function retryLastMessage() {
        vscode.postMessage({ command: 'retryLastMessage' });
      }
      // Step 3: Outcome Definition functions
      function updatePrimaryOutcome(value) {
        vscode.postMessage({ command: 'updatePrimaryOutcome', value });
      }
      function addMetric() {
        vscode.postMessage({ command: 'addMetric' });
      }
      function removeMetric(index) {
        vscode.postMessage({ command: 'removeMetric', index });
      }
      function updateMetric(index, field, value) {
        vscode.postMessage({ command: 'updateMetric', index, field, value });
      }
      function toggleStakeholder(stakeholder) {
        vscode.postMessage({ command: 'toggleStakeholder', value: stakeholder });
      }
      function addCustomStakeholder() {
        const input = document.getElementById('customStakeholderInput');
        if (input && input.value.trim()) {
          vscode.postMessage({ command: 'addCustomStakeholder', value: input.value.trim() });
          input.value = '';
        }
      }
      function handleCustomStakeholderKeydown(event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          addCustomStakeholder();
        }
      }
      function regenerateOutcomeSuggestions() {
        vscode.postMessage({ command: 'regenerateOutcomeSuggestions' });
      }
      function dismissOutcomeError() {
        vscode.postMessage({ command: 'dismissOutcomeError' });
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
    this._bedrockDisposables.forEach(d => d.dispose());
    this._bedrockDisposables = [];
  }
}

// ============================================
// Supporting Types and Constants
// ============================================

interface SystemAssumption {
  system: string;
  modules: string[];
  integrations: string[];
  source: 'ai-proposed' | 'user-corrected';
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  parsedAssumptions?: SystemAssumption[];
}

interface AIGapFillingState {
  conversationHistory: ConversationMessage[];
  confirmedAssumptions: SystemAssumption[];
  assumptionsAccepted: boolean;
  isStreaming: boolean;
  step1InputHash?: string;
  streamingError?: string;
}

interface SuccessMetric {
  name: string;
  targetValue: string;
  unit: string;
}

interface OutcomeDefinitionState {
  primaryOutcome: string;
  successMetrics: SuccessMetric[];
  stakeholders: string[];
  isLoading: boolean;
  loadingError?: string;
  primaryOutcomeEdited: boolean;
  metricsEdited: boolean;
  stakeholdersEdited: boolean;
  customStakeholders: string[];
}

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
  aiGapFillingState: AIGapFillingState;
  outcome: OutcomeDefinitionState;
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
    aiGapFillingState: {
      conversationHistory: [],
      confirmedAssumptions: [],
      assumptionsAccepted: false,
      isStreaming: false,
    },
    outcome: {
      primaryOutcome: '',
      successMetrics: [],
      stakeholders: [],
      isLoading: false,
      primaryOutcomeEdited: false,
      metricsEdited: false,
      stakeholdersEdited: false,
      customStakeholders: [],
    },
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
  { step: 3, label: 'Outcomes' },
  { step: 4, label: 'Security' },
  { step: 5, label: 'Agent Design' },
  { step: 6, label: 'Mock Data' },
  { step: 7, label: 'Demo Strategy' },
  { step: 8, label: 'Generate' },
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

const STAKEHOLDER_OPTIONS = [
  'Operations',
  'Finance',
  'Supply Chain',
  'Customer Service',
  'Executive',
  'IT',
  'Sales',
  'Marketing',
  'HR',
  'Legal',
];
