/**
 * Tabbed Panel Provider
 * Unified panel with tabs for Ideation Wizard and Demo Viewer
 * Each tab gets full panel height for optimal UX
 */

import * as vscode from 'vscode';
import { getBedrockConversationService, BedrockConversationService } from '../services/bedrockConversationService';
import { buildContextMessage, parseAssumptionsFromResponse, generateStep1Hash, hasStep1Changed } from '../services/gapFillingService';
import { getOutcomeDefinitionService, OutcomeDefinitionService } from '../services/outcomeDefinitionService';
import { getIdeationStyles } from './ideationStyles';
import { getIdeationScript } from './ideationScript';
import {
  getIdeationContentHtml,
  escapeHtml,
  IdeationState as StepHtmlIdeationState,
  IdeationValidationState as StepHtmlValidationState,
} from './ideationStepHtml';
import {
  WIZARD_STEPS,
  DATA_SENSITIVITY_OPTIONS,
  COMPLIANCE_FRAMEWORK_OPTIONS,
  APPROVAL_GATE_OPTIONS,
  INDUSTRY_COMPLIANCE_MAPPING,
  INDUSTRY_OPTIONS,
  SYSTEM_OPTIONS,
  STAKEHOLDER_OPTIONS,
} from './ideationConstants';

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

  // Bedrock service for AI gap-filling (Step 2)
  private _bedrockService?: BedrockConversationService;
  private _bedrockDisposables: vscode.Disposable[] = [];
  private _streamingResponse = '';

  // Outcome service for AI suggestions (Step 3)
  private _outcomeService?: OutcomeDefinitionService;
  private _outcomeDisposables: vscode.Disposable[] = [];
  private _outcomeStreamingResponse = '';
  private _isOutcomeRefinement = false;
  private _step2AssumptionsHash?: string;

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
        // Reset Step 4 industry defaults so they can be reapplied for new industry
        this._ideationState.securityGuardrails.industryDefaultsApplied = false;
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
        // Reset outcome state (preserve customStakeholders) and fetch fresh AI suggestions
        const customStakeholdersToPreserve = this._ideationState.outcome.customStakeholders;
        this._ideationState.outcome = {
          primaryOutcome: '',
          successMetrics: [],
          stakeholders: [],
          customStakeholders: customStakeholdersToPreserve,
          primaryOutcomeEdited: false,
          metricsEdited: false,
          stakeholdersEdited: false,
          isLoading: false,
          loadingError: undefined,
          suggestionsAccepted: false,
          step2AssumptionsHash: this._ideationState.outcome.step2AssumptionsHash,
          refinedSections: { outcome: false, kpis: false, stakeholders: false },
        };
        // Reset outcome service conversation
        this._outcomeService?.resetConversation();
        // Fetch fresh AI suggestions
        this.sendOutcomeContextToClaude();
        break;
      case 'acceptOutcomeSuggestions':
        // Transition from Phase 1 to Phase 2
        this._ideationState.outcome.suggestionsAccepted = true;
        // Reset edited flags so AI refinements can still update fields
        this._ideationState.outcome.primaryOutcomeEdited = false;
        this._ideationState.outcome.metricsEdited = false;
        this._ideationState.outcome.stakeholdersEdited = false;
        this.updateWebviewContent();
        this.syncStateToWebview();
        break;
      case 'sendOutcomeRefinement':
        this.handleSendOutcomeRefinement(message.value as string);
        break;
      case 'dismissOutcomeError':
        this._ideationState.outcome.loadingError = undefined;
        this.updateWebviewContent();
        this.syncStateToWebview();
        break;

      // Step 4: Security & Guardrails commands
      case 'updateDataSensitivity':
        this._ideationState.securityGuardrails.dataSensitivity = message.value as string;
        this.updateWebviewContent();
        this.syncStateToWebview();
        break;
      case 'toggleComplianceFramework':
        const framework = message.value as string;
        const frameworks = this._ideationState.securityGuardrails.complianceFrameworks;
        const frameworkIdx = frameworks.indexOf(framework);
        if (frameworkIdx >= 0) {
          frameworks.splice(frameworkIdx, 1);
        } else {
          frameworks.push(framework);
        }
        this.updateWebviewContent();
        this.syncStateToWebview();
        break;
      case 'toggleApprovalGate':
        const gate = message.value as string;
        const gates = this._ideationState.securityGuardrails.approvalGates;
        const gateIdx = gates.indexOf(gate);
        if (gateIdx >= 0) {
          gates.splice(gateIdx, 1);
        } else {
          gates.push(gate);
        }
        this.updateWebviewContent();
        this.syncStateToWebview();
        break;
      case 'updateGuardrailNotes':
        this._ideationState.securityGuardrails.guardrailNotes = message.value as string;
        this._ideationState.securityGuardrails.aiSuggested = false;
        this.syncStateToWebview();
        break;
      case 'skipSecurityStep':
        // Apply sensible defaults
        this._ideationState.securityGuardrails.dataSensitivity = 'Internal';
        this._ideationState.securityGuardrails.complianceFrameworks = [];
        this._ideationState.securityGuardrails.approvalGates = [];
        this._ideationState.securityGuardrails.guardrailNotes = '';
        this._ideationState.securityGuardrails.skipped = true;
        // Navigate forward
        this._ideationState.currentStep = Math.min(this._ideationState.currentStep + 1, WIZARD_STEPS.length);
        this._ideationState.highestStepReached = Math.max(this._ideationState.highestStepReached, this._ideationState.currentStep);
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

      // Auto-send context to Claude when entering Step 3
      if (previousStep === 2 && this._ideationState.currentStep === 3) {
        this.triggerAutoSendForStep3();
      }

      // Apply industry defaults and trigger AI suggestions when entering Step 4
      if (this._ideationState.currentStep === 4) {
        this.applyIndustryDefaultsForStep4();
        this.triggerAutoSendForStep4();
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
   * Initialize OutcomeDefinitionService for Step 3 AI suggestions
   * Follows same pattern as initBedrockService()
   */
  private initOutcomeService(): OutcomeDefinitionService | undefined {
    if (this._outcomeService) {
      return this._outcomeService;
    }

    if (!this._context) {
      console.warn('[TabbedPanel] Extension context not available for Outcome service');
      return undefined;
    }

    this._outcomeService = getOutcomeDefinitionService(this._context);

    // Subscribe to streaming events
    this._outcomeDisposables.push(
      this._outcomeService.onToken((token) => {
        this.handleOutcomeStreamingToken(token);
      })
    );

    this._outcomeDisposables.push(
      this._outcomeService.onComplete((response) => {
        this.handleOutcomeStreamingComplete(response);
      })
    );

    this._outcomeDisposables.push(
      this._outcomeService.onError((error) => {
        this.handleOutcomeStreamingError(error.message);
      })
    );

    return this._outcomeService;
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

  // =========================================================================
  // Step 3: Outcome Definition AI Methods
  // =========================================================================

  /**
   * Handle incoming streaming token for outcome suggestions
   */
  private handleOutcomeStreamingToken(token: string): void {
    this._outcomeStreamingResponse += token;
    // Note: Step 3 doesn't show streaming preview, just accumulates
  }

  /**
   * Handle streaming complete for outcome suggestions
   * Parses response and populates form fields (respecting edited flags)
   */
  private handleOutcomeStreamingComplete(response: string): void {
    this._ideationState.outcome.isLoading = false;

    const service = this._outcomeService;
    if (!service) {
      this._outcomeStreamingResponse = '';
      this.updateWebviewContent();
      this.syncStateToWebview();
      return;
    }

    // Handle refinement response differently from initial suggestions
    if (this._isOutcomeRefinement) {
      // Try to parse as refinement changes first
      const changes = service.parseRefinementChangesFromResponse(response);
      if (changes) {
        // Apply changes and track which sections were refined
        if (changes.outcome !== undefined) {
          // In Phase 1 (not accepted) or Phase 2 with no manual edits: apply the change
          if (!this._ideationState.outcome.suggestionsAccepted || !this._ideationState.outcome.primaryOutcomeEdited) {
            this._ideationState.outcome.primaryOutcome = changes.outcome;
            this._ideationState.outcome.refinedSections.outcome = true;
          }
        }
        if (changes.kpis !== undefined) {
          if (!this._ideationState.outcome.suggestionsAccepted || !this._ideationState.outcome.metricsEdited) {
            this._ideationState.outcome.successMetrics = changes.kpis;
            this._ideationState.outcome.refinedSections.kpis = true;
          }
        }
        if (changes.stakeholders !== undefined) {
          if (!this._ideationState.outcome.suggestionsAccepted || !this._ideationState.outcome.stakeholdersEdited) {
            this.applyStakeholderChanges(changes.stakeholders);
            this._ideationState.outcome.refinedSections.stakeholders = true;
          }
        }
      } else {
        // Fall back to parsing as full suggestions (AI might return full response)
        this.applyOutcomeSuggestions(service.parseOutcomeSuggestionsFromResponse(response));
      }
    } else {
      // Initial suggestions request - parse and apply full suggestions
      this.applyOutcomeSuggestions(service.parseOutcomeSuggestionsFromResponse(response));
    }

    this._outcomeStreamingResponse = '';
    this._isOutcomeRefinement = false;
    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Apply full outcome suggestions to state (for initial requests)
   */
  private applyOutcomeSuggestions(suggestions: ReturnType<OutcomeDefinitionService['parseOutcomeSuggestionsFromResponse']>): void {
    if (!suggestions) return;

    // Only update fields that haven't been manually edited
    if (!this._ideationState.outcome.primaryOutcomeEdited && suggestions.primaryOutcome) {
      this._ideationState.outcome.primaryOutcome = suggestions.primaryOutcome;
    }
    if (!this._ideationState.outcome.metricsEdited && suggestions.suggestedKPIs) {
      this._ideationState.outcome.successMetrics = suggestions.suggestedKPIs;
    }
    if (!this._ideationState.outcome.stakeholdersEdited && suggestions.stakeholders) {
      this.applyStakeholderChanges(suggestions.stakeholders);
    }
  }

  /**
   * Apply stakeholder changes, separating standard and custom stakeholders
   */
  private applyStakeholderChanges(stakeholders: string[]): void {
    const standardOptions = ['Operations', 'Finance', 'IT', 'HR', 'Sales', 'Marketing', 'Customer Service', 'Executive Leadership'];
    const customFromAI = stakeholders.filter(s => !standardOptions.includes(s));
    const standardFromAI = stakeholders.filter(s => standardOptions.includes(s));

    this._ideationState.outcome.stakeholders = standardFromAI;
    // Add custom AI stakeholders to customStakeholders array (if not already there)
    customFromAI.forEach(s => {
      if (!this._ideationState.outcome.customStakeholders.includes(s)) {
        this._ideationState.outcome.customStakeholders.push(s);
      }
      if (!this._ideationState.outcome.stakeholders.includes(s)) {
        this._ideationState.outcome.stakeholders.push(s);
      }
    });
  }

  /**
   * Handle streaming error for outcome suggestions
   */
  private handleOutcomeStreamingError(errorMessage: string): void {
    this._ideationState.outcome.isLoading = false;
    this._ideationState.outcome.loadingError = errorMessage;
    this._outcomeStreamingResponse = '';
    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Generate a hash of Step 2 confirmed assumptions for change detection
   * Uses the same djb2 hash algorithm as generateStep1Hash
   */
  private generateStep2AssumptionsHash(): string {
    const assumptions = this._ideationState.aiGapFillingState.confirmedAssumptions;
    // Sort by system name for consistent hash
    const sorted = [...assumptions].sort((a, b) => a.system.localeCompare(b.system));
    const combined = JSON.stringify(sorted);

    // djb2 hash algorithm
    let hash = 5381;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash * 33) ^ combined.charCodeAt(i);
    }

    return (hash >>> 0).toString(16);
  }

  /**
   * Trigger auto-send when entering Step 3
   * Re-triggers AI if Step 2 assumptions have changed, or if fresh entry
   */
  private triggerAutoSendForStep3(): void {
    const currentHash = this.generateStep2AssumptionsHash();

    // Check if assumptions have changed since last visit
    if (this._step2AssumptionsHash !== currentHash) {
      // Reset outcome state (preserve customStakeholders)
      const customStakeholders = this._ideationState.outcome.customStakeholders;
      this._ideationState.outcome = {
        primaryOutcome: '',
        successMetrics: [],
        stakeholders: [],
        customStakeholders: customStakeholders,
        primaryOutcomeEdited: false,
        metricsEdited: false,
        stakeholdersEdited: false,
        isLoading: false,
        loadingError: undefined,
        suggestionsAccepted: false,
        step2AssumptionsHash: currentHash,
        refinedSections: { outcome: false, kpis: false, stakeholders: false },
      };

      // Update hash
      this._step2AssumptionsHash = currentHash;

      // Trigger AI
      this.sendOutcomeContextToClaude();
    } else if (!this._ideationState.outcome.primaryOutcome && !this._ideationState.outcome.isLoading) {
      // Fresh entry with no outcome yet
      this.sendOutcomeContextToClaude();
    }
  }

  /**
   * Apply industry-aware compliance defaults for Step 4
   */
  private applyIndustryDefaultsForStep4(): void {
    const state = this._ideationState.securityGuardrails;

    // Only apply defaults on first visit or if industry changed
    if (state.industryDefaultsApplied) {
      return;
    }

    // Get industry (handle "Other" case)
    const industry = this._ideationState.industry === 'Other'
      ? (this._ideationState.customIndustry || 'Other')
      : this._ideationState.industry;

    // Look up compliance defaults for this industry
    const complianceDefaults = INDUSTRY_COMPLIANCE_MAPPING[industry] || [];

    // Apply defaults
    state.complianceFrameworks = [...complianceDefaults];
    state.industryDefaultsApplied = true;

    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Trigger AI guardrail suggestions for Step 4
   */
  private triggerAutoSendForStep4(): void {
    const state = this._ideationState.securityGuardrails;

    // Only trigger if guardrailNotes is empty AND AI hasn't been called yet
    if (state.guardrailNotes === '' && !state.aiCalled) {
      this.sendGuardrailSuggestionRequest();
    }
  }

  /**
   * Send guardrail suggestion request to Claude
   */
  private async sendGuardrailSuggestionRequest(): Promise<void> {
    const state = this._ideationState.securityGuardrails;

    // Mark AI as called to prevent repeated calls
    state.aiCalled = true;
    state.isLoading = true;
    this.updateWebviewContent();
    this.syncStateToWebview();

    try {
      // Build context from Steps 1-2
      const context = this.buildGuardrailContextMessage();

      // Get service
      const service = this.initOutcomeService();
      if (!service) {
        throw new Error('Service not available');
      }

      // Send request using the conversation service and collect response
      let fullResponse = '';
      for await (const chunk of service.sendMessage(context)) {
        fullResponse += chunk;
      }

      // Parse response - it's plain text
      if (fullResponse.trim()) {
        state.guardrailNotes = fullResponse.trim();
        state.aiSuggested = true;
      } else {
        // Use fallback
        state.guardrailNotes = 'No PII in demo data, mask account numbers...';
        state.aiSuggested = false;
      }
    } catch (error) {
      // Use fallback on error
      state.guardrailNotes = 'No PII in demo data, mask account numbers...';
      state.aiSuggested = false;
      console.error('Guardrail suggestion error:', error);
    } finally {
      state.isLoading = false;
      this.updateWebviewContent();
      this.syncStateToWebview();
    }
  }

  /**
   * Build context message for guardrail suggestions
   */
  private buildGuardrailContextMessage(): string {
    const industry = this._ideationState.industry === 'Other'
      ? (this._ideationState.customIndustry || 'Other')
      : this._ideationState.industry;

    const systems = this._ideationState.systems.join(', ') || 'No specific systems';

    const assumptions = this._ideationState.aiGapFillingState.confirmedAssumptions
      .map(a => `${a.system}: ${a.modules?.join(', ') || 'N/A'}`)
      .join('; ') || 'No confirmed assumptions';

    return `Based on the following context, suggest 2-3 brief security guardrail notes for an AI demo:

Business Objective: ${this._ideationState.businessObjective}
Industry: ${industry}
Systems: ${systems}
Integration Details: ${assumptions}

Please provide practical security considerations specific to this demo scenario. Keep suggestions concise (2-3 bullet points). Focus on data handling, privacy concerns, and demo-appropriate safeguards. Do not include extensive explanations - just the key guardrail notes.`;
  }

  /**
   * Build and send context to Claude for outcome suggestions
   */
  private async sendOutcomeContextToClaude(): Promise<void> {
    const service = this.initOutcomeService();
    if (!service) {
      this._ideationState.outcome.loadingError =
        'Outcome service not available. Please check your configuration.';
      this.syncStateToWebview();
      return;
    }

    // Build context message from Steps 1-2 inputs
    const contextMessage = service.buildOutcomeContextMessage(
      this._ideationState.businessObjective,
      this._ideationState.industry === 'Other'
        ? (this._ideationState.customIndustry || this._ideationState.industry)
        : this._ideationState.industry,
      this._ideationState.systems,
      this._ideationState.aiGapFillingState.confirmedAssumptions,
      this._ideationState.customSystems
    );

    // Set loading state (initial request, not refinement)
    this._ideationState.outcome.isLoading = true;
    this._ideationState.outcome.loadingError = undefined;
    this._outcomeStreamingResponse = '';
    this._isOutcomeRefinement = false;
    this.updateWebviewContent();
    this.syncStateToWebview();

    // Send message to Claude (streaming handled by event handlers)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _token of service.sendMessage(contextMessage)) {
        // Tokens are handled by onToken event handler
      }
    } catch (error) {
      this.handleOutcomeStreamingError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Handle send outcome refinement message
   */
  private async handleSendOutcomeRefinement(content: string): Promise<void> {
    if (!content.trim()) return;

    const service = this.initOutcomeService();
    if (!service) {
      this._ideationState.outcome.loadingError =
        'Outcome service not available. Please check your configuration.';
      this.syncStateToWebview();
      return;
    }

    // Set loading state (this is a refinement request)
    this._ideationState.outcome.isLoading = true;
    this._ideationState.outcome.loadingError = undefined;
    this._outcomeStreamingResponse = '';
    this._isOutcomeRefinement = true;
    this.updateWebviewContent();
    this.syncStateToWebview();

    // Send refinement message to Claude
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _token of service.sendRefinementMessage(
        content.trim(),
        this._ideationState.outcome
      )) {
        // Tokens are handled by onToken event handler
      }
    } catch (error) {
      this.handleOutcomeStreamingError(error instanceof Error ? error.message : 'Unknown error');
    }
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
    ${this._activeTab === 'ideation' ? getIdeationStyles() : this.getDemoStyles()}
  </style>
</head>
<body>
  ${this.getTabBarHtml()}
  <div class="tab-content">
    ${this._activeTab === 'ideation' ? getIdeationContentHtml(this._ideationState as unknown as StepHtmlIdeationState, this._ideationValidation as unknown as StepHtmlValidationState) : this.getDemoContentHtml()}
  </div>
  <script>
    const vscode = acquireVsCodeApi();

    function switchTab(tabId) {
      vscode.postMessage({ command: 'switchTab', tab: tabId });
    }

    ${this._activeTab === 'ideation' ? getIdeationScript() : this.getDemoScript()}

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
          >${escapeHtml(this._demoState.promptText)}</textarea>
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
    this._outcomeDisposables.forEach(d => d.dispose());
    this._outcomeDisposables = [];
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

interface RefinedSectionsState {
  outcome: boolean;
  kpis: boolean;
  stakeholders: boolean;
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
  suggestionsAccepted: boolean;
  step2AssumptionsHash?: string;
  refinedSections: RefinedSectionsState;
}

interface SecurityGuardrailsState {
  dataSensitivity: string;
  complianceFrameworks: string[];
  approvalGates: string[];
  guardrailNotes: string;
  aiSuggested: boolean;
  aiCalled: boolean;
  skipped: boolean;
  industryDefaultsApplied: boolean;
  isLoading: boolean;
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
  securityGuardrails: SecurityGuardrailsState;
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
      suggestionsAccepted: false,
      step2AssumptionsHash: undefined,
      refinedSections: { outcome: false, kpis: false, stakeholders: false },
    },
    securityGuardrails: {
      dataSensitivity: 'Internal',
      complianceFrameworks: [],
      approvalGates: [],
      guardrailNotes: '',
      aiSuggested: false,
      aiCalled: false,
      skipped: false,
      industryDefaultsApplied: false,
      isLoading: false,
    },
  };
}

function createDefaultDemoState(): DemoState {
  return {
    isProjectInitialized: false,
    promptText: '',
  };
}

