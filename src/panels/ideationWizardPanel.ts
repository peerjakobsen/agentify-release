/**
 * Ideation Wizard Panel Provider
 * Provides a webview panel for designing AI agent workflows
 * Implements a multi-step wizard with navigation, validation, and form handling
 */

import * as vscode from 'vscode';
import {
  WizardStep,
  WIZARD_STEPS,
  INDUSTRY_OPTIONS,
  SYSTEM_OPTIONS,
  STAKEHOLDER_OPTIONS,
  WIZARD_COMMANDS,
  FILE_UPLOAD_CONSTRAINTS,
  createDefaultWizardState,
  createDefaultAIGapFillingState,
  createDefaultOutcomeDefinitionState,
  type WizardState,
  type WizardValidationState,
  type WizardValidationError,
  type WizardStepConfig,
  type ConversationMessage,
  type SystemAssumption,
  type SuccessMetric,
} from '../types/wizardPanel';
import {
  buildContextMessage,
  parseAssumptionsFromResponse,
  generateStep1Hash,
  hasStep1Changed,
} from '../services/gapFillingService';
import { getBedrockConversationService, BedrockConversationService } from '../services/bedrockConversationService';
import {
  getOutcomeDefinitionService,
  OutcomeDefinitionService,
} from '../services/outcomeDefinitionService';

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
   * Current wizard state
   * Preserved when panel hidden/shown within same session
   * Lost on dispose (persistence added in roadmap item 22)
   */
  private _wizardState: WizardState;

  /**
   * Current validation state
   */
  private _validationState: WizardValidationState;

  /**
   * Bedrock conversation service for AI gap-filling (Step 2)
   */
  private _bedrockService?: BedrockConversationService;

  /**
   * Outcome definition service for AI suggestions (Step 3)
   */
  private _outcomeService?: OutcomeDefinitionService;

  /**
   * Accumulated streaming response for Step 3 outcome suggestions
   */
  private _outcomeStreamingResponse = '';

  /**
   * VS Code extension context for service initialization
   */
  private _extensionContext?: vscode.ExtensionContext;

  /**
   * Disposable subscriptions for cleanup
   */
  private _disposables: vscode.Disposable[] = [];

  /**
   * Accumulated streaming response for current Claude message
   */
  private _streamingResponse = '';

  /**
   * Creates a new IdeationWizardPanelProvider
   * @param extensionUri The URI of the extension for loading local resources
   * @param extensionContext Optional VS Code extension context for service initialization
   */
  constructor(
    private readonly extensionUri: vscode.Uri,
    extensionContext?: vscode.ExtensionContext
  ) {
    this._extensionContext = extensionContext;
    this._wizardState = createDefaultWizardState();
    this._validationState = this.validateStep1();
  }

  /**
   * Resolve the webview view
   * Called by VS Code when the view is first shown
   *
   * @param webviewView The webview view to resolve
   * @param _context Context for the webview
   * @param _token Cancellation token
   */
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this._view = webviewView;

    // Configure webview options
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    // Set wizard HTML content
    webviewView.webview.html = this.getWizardHtmlContent();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      (message) => {
        this.handleMessage(message);
      },
      undefined,
      []
    );

    // Sync initial state to webview
    this.syncStateToWebview();
  }

  /**
   * Get the current wizard state
   */
  public get wizardState(): WizardState {
    return this._wizardState;
  }

  /**
   * Get the current validation state
   */
  public get validationState(): WizardValidationState {
    return this._validationState;
  }

  /**
   * Validate Step 1 (Business Context) form data
   * @returns WizardValidationState with errors and warnings
   */
  private validateStep1(): WizardValidationState {
    const errors: WizardValidationError[] = [];

    // businessObjective: Required
    if (!this._wizardState.businessObjective.trim()) {
      errors.push({
        type: 'businessObjective',
        message: 'Business objective is required',
        severity: 'error',
      });
    }

    // industry: Required
    if (!this._wizardState.industry) {
      errors.push({
        type: 'industry',
        message: 'Please select an industry',
        severity: 'error',
      });
    }

    // systems: Optional with soft warning
    if (this._wizardState.systems.length === 0) {
      errors.push({
        type: 'systems',
        message: 'Consider selecting systems your workflow will integrate with',
        severity: 'warning',
      });
    }

    // File validation (if file uploaded)
    if (this._wizardState.uploadedFile) {
      if (this._wizardState.uploadedFile.size > FILE_UPLOAD_CONSTRAINTS.MAX_SIZE_BYTES) {
        errors.push({
          type: 'file',
          message: `File size exceeds ${FILE_UPLOAD_CONSTRAINTS.MAX_SIZE_DISPLAY} limit`,
          severity: 'error',
        });
      }
    }

    const blockingErrors = errors.filter((e) => e.severity === 'error');
    const hasWarnings = errors.some((e) => e.severity === 'warning');

    return {
      isValid: blockingErrors.length === 0,
      errors,
      hasWarnings,
    };
  }

  /**
   * Validate Step 2 (AI Gap-Filling) state
   * @returns WizardValidationState with errors
   */
  private validateStep2(): WizardValidationState {
    const errors: WizardValidationError[] = [];
    const state = this._wizardState.aiGapFillingState;

    // Block navigation while streaming
    if (state.isStreaming) {
      errors.push({
        type: 'businessObjective', // Using existing error type
        message: 'Please wait for Claude to finish responding',
        severity: 'error',
      });
    }

    // Require at least one confirmed assumption
    if (state.confirmedAssumptions.length === 0 && !state.isStreaming) {
      errors.push({
        type: 'businessObjective', // Using existing error type
        message: 'Please accept or refine assumptions before continuing',
        severity: 'error',
      });
    }

    return {
      isValid: errors.filter((e) => e.severity === 'error').length === 0,
      errors,
      hasWarnings: false,
    };
  }

  /**
   * Validate Step 3 (Outcome Definition) state
   * @returns WizardValidationState with errors and warnings
   */
  private validateStep3(): WizardValidationState {
    const errors: WizardValidationError[] = [];
    const state = this._wizardState.outcome;

    // Block navigation while AI is loading
    if (state.isLoading) {
      errors.push({
        type: 'primaryOutcome',
        message: 'Please wait for AI suggestions to load',
        severity: 'error',
      });
    }

    // Primary outcome is required (blocking)
    if (!state.primaryOutcome.trim()) {
      errors.push({
        type: 'primaryOutcome',
        message: 'Primary outcome is required',
        severity: 'error',
      });
    }

    // At least one success metric is recommended (warning, non-blocking)
    if (state.successMetrics.length === 0) {
      errors.push({
        type: 'successMetrics',
        message: 'Consider adding at least one success metric to measure outcomes',
        severity: 'warning',
      });
    }

    const blockingErrors = errors.filter((e) => e.severity === 'error');
    const hasWarnings = errors.some((e) => e.severity === 'warning');

    return {
      isValid: blockingErrors.length === 0,
      errors,
      hasWarnings,
    };
  }

  /**
   * Validate current step
   * @returns WizardValidationState
   */
  private validateCurrentStep(): WizardValidationState {
    switch (this._wizardState.currentStep) {
      case WizardStep.BusinessContext:
        return this.validateStep1();
      case WizardStep.AIGapFilling:
        return this.validateStep2();
      case WizardStep.OutcomeDefinition:
        return this.validateStep3();
      // Steps 4-8 have placeholder validation (always valid for now)
      default:
        return { isValid: true, errors: [], hasWarnings: false };
    }
  }

  /**
   * Check if forward navigation is allowed
   */
  private canNavigateForward(): boolean {
    if (this._wizardState.currentStep >= WizardStep.Generate) {
      return false;
    }
    return this._validationState.isValid;
  }

  /**
   * Check if backward navigation is allowed
   */
  private canNavigateBackward(): boolean {
    return this._wizardState.currentStep > WizardStep.BusinessContext;
  }

  /**
   * Check if direct navigation to a step is allowed
   */
  private canNavigateToStep(targetStep: number): boolean {
    if (targetStep === this._wizardState.currentStep) {
      return false;
    }
    if (targetStep < WizardStep.BusinessContext || targetStep > WizardStep.Generate) {
      return false;
    }
    return targetStep <= this._wizardState.highestStepReached;
  }

  /**
   * Navigate to next step
   */
  private navigateForward(): void {
    // Set validation attempted flag to show errors
    this._wizardState.validationAttempted = true;
    this._validationState = this.validateCurrentStep();

    if (!this.canNavigateForward()) {
      this.syncStateToWebview();
      return;
    }

    const previousStep = this._wizardState.currentStep;
    const nextStep = this._wizardState.currentStep + 1;
    this._wizardState.currentStep = nextStep;
    this._wizardState.highestStepReached = Math.max(this._wizardState.highestStepReached, nextStep);
    this._wizardState.validationAttempted = false;
    this._validationState = this.validateCurrentStep();

    this.updateWebviewContent();
    this.syncStateToWebview();

    // Auto-send context to Claude when entering Step 2 from Step 1
    if (previousStep === WizardStep.BusinessContext && nextStep === WizardStep.AIGapFilling) {
      this.triggerAutoSendForStep2();
    }

    // Auto-send context to Claude when entering Step 3 from Step 2
    if (previousStep === WizardStep.AIGapFilling && nextStep === WizardStep.OutcomeDefinition) {
      this.triggerAutoSendForStep3();
    }
  }

  /**
   * Navigate to previous step
   */
  private navigateBackward(): void {
    if (!this.canNavigateBackward()) {
      return;
    }

    const currentStep = this._wizardState.currentStep;

    // Store hash before going back to Step 1 from Step 2
    if (currentStep === WizardStep.AIGapFilling) {
      const hash = generateStep1Hash(
        this._wizardState.businessObjective,
        this._wizardState.industry,
        this._wizardState.systems
      );
      this._wizardState.aiGapFillingState.step1InputHash = hash;
    }

    this._wizardState.currentStep = this._wizardState.currentStep - 1;
    this._wizardState.validationAttempted = false;
    this._validationState = this.validateCurrentStep();

    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Navigate directly to a specific step
   */
  private navigateToStep(targetStep: number): void {
    if (!this.canNavigateToStep(targetStep)) {
      return;
    }

    this._wizardState.currentStep = targetStep;
    this._wizardState.validationAttempted = false;
    this._validationState = this.validateCurrentStep();

    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Get the step indicator HTML
   */
  private generateStepIndicatorHtml(): string {
    const steps = WIZARD_STEPS.map((stepConfig: WizardStepConfig) => {
      const isCompleted = stepConfig.step < this._wizardState.currentStep;
      const isCurrent = stepConfig.step === this._wizardState.currentStep;
      const isClickable = this.canNavigateToStep(stepConfig.step);
      const isPending = stepConfig.step > this._wizardState.highestStepReached;

      let stateClass = 'pending';
      if (isCompleted) stateClass = 'completed';
      else if (isCurrent) stateClass = 'current';

      const clickHandler = isClickable ? `onclick="goToStep(${stepConfig.step})"` : '';
      const clickableClass = isClickable ? 'clickable' : '';

      const icon = isCompleted
        ? '<svg class="step-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>'
        : `<span class="step-number">${stepConfig.step}</span>`;

      return `
        <div class="step-item ${stateClass} ${clickableClass}" ${clickHandler} ${isPending ? 'aria-disabled="true"' : ''}>
          <div class="step-circle">${icon}</div>
          <div class="step-label">${stepConfig.label}</div>
        </div>
      `;
    });

    return `<div class="step-indicator">${steps.join('')}</div>`;
  }

  /**
   * Get the navigation buttons HTML
   */
  private generateNavigationButtonsHtml(): string {
    const isFirstStep = this._wizardState.currentStep === WizardStep.BusinessContext;
    const isLastStep = this._wizardState.currentStep === WizardStep.Generate;

    const backButton = isFirstStep
      ? '<button class="nav-button back" disabled>Back</button>'
      : '<button class="nav-button back" onclick="previousStep()">Back</button>';

    const nextButtonText = isLastStep ? 'Generate' : 'Next';
    const nextButton = `<button class="nav-button next" onclick="nextStep()">${nextButtonText}</button>`;

    return `
      <div class="navigation-buttons">
        ${backButton}
        ${nextButton}
      </div>
    `;
  }

  /**
   * Generate Step 1 (Business Context) form HTML
   */
  private generateStep1Html(): string {
    const state = this._wizardState;
    const showErrors = state.validationAttempted;
    const validation = this._validationState;

    const businessObjectiveError = validation.errors.find(
      (e) => e.type === 'businessObjective' && e.severity === 'error'
    );
    const industryError = validation.errors.find((e) => e.type === 'industry' && e.severity === 'error');
    const systemsWarning = validation.errors.find((e) => e.type === 'systems' && e.severity === 'warning');

    // Generate industry options
    const industryOptionsHtml = INDUSTRY_OPTIONS.map((industry) => {
      const selected = state.industry === industry ? 'selected' : '';
      return `<option value="${industry}" ${selected}>${industry}</option>`;
    }).join('');

    // Generate system checkboxes by category
    const systemCategoriesHtml = SYSTEM_OPTIONS.map((category) => {
      const systemCheckboxes = category.systems
        .map((system) => {
          const checked = state.systems.includes(system) ? 'checked' : '';
          const systemId = system.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
          return `
          <label class="system-checkbox">
            <input type="checkbox" id="system-${systemId}" value="${system}" ${checked} onchange="toggleSystem('${system}')">
            <span class="checkbox-label">${system}</span>
          </label>
        `;
        })
        .join('');

      return `
        <div class="system-category">
          <div class="category-header">${category.category}</div>
          <div class="category-systems">${systemCheckboxes}</div>
        </div>
      `;
    }).join('');

    // File upload section
    const fileUploadHtml = state.uploadedFile
      ? `
        <div class="file-uploaded">
          <div class="file-info">
            <span class="file-name">${this.escapeHtml(state.uploadedFile.name)}</span>
            <span class="file-size">(${this.formatFileSize(state.uploadedFile.size)})</span>
          </div>
          <button class="file-remove" onclick="removeFile()">Remove</button>
        </div>
      `
      : `
        <div class="file-upload-zone">
          <input type="file" id="fileInput" accept="${FILE_UPLOAD_CONSTRAINTS.ACCEPTED_EXTENSIONS.join(',')}" onchange="handleFileUpload(event)" style="display: none;">
          <button class="file-upload-button" onclick="document.getElementById('fileInput').click()">
            Upload File
          </button>
          <div class="file-upload-hint">
            Accepted formats: ${FILE_UPLOAD_CONSTRAINTS.ACCEPTED_EXTENSIONS.join(', ')} (max ${FILE_UPLOAD_CONSTRAINTS.MAX_SIZE_DISPLAY})
          </div>
        </div>
      `;

    // Show custom industry field if "Other" is selected
    const customIndustryHtml =
      state.industry === 'Other'
        ? `
        <div class="form-group custom-industry-group">
          <label for="customIndustry">Specify Industry</label>
          <input
            type="text"
            id="customIndustry"
            class="text-input"
            placeholder="Enter your industry"
            value="${this.escapeHtml(state.customIndustry || '')}"
            oninput="updateCustomIndustry(this.value)"
          >
        </div>
      `
        : '';

    return `
      <div class="step-content step1-content">
        <div class="step-header">
          <h2>Business Context</h2>
          <p class="step-description">Tell us about your business objective and the systems you want to integrate.</p>
        </div>

        <div class="form-group">
          <label for="businessObjective">Business Objective <span class="required">*</span></label>
          <textarea
            id="businessObjective"
            class="textarea ${showErrors && businessObjectiveError ? 'error' : ''}"
            placeholder="Describe the business problem you want to solve or the workflow you want to automate..."
            oninput="updateBusinessObjective(this.value)"
          >${this.escapeHtml(state.businessObjective)}</textarea>
          ${showErrors && businessObjectiveError ? `<div class="field-error">${businessObjectiveError.message}</div>` : ''}
        </div>

        <div class="form-group">
          <label for="industry">Industry Vertical <span class="required">*</span></label>
          <select
            id="industry"
            class="select ${showErrors && industryError ? 'error' : ''}"
            onchange="updateIndustry(this.value)"
          >
            <option value="">Select an industry...</option>
            ${industryOptionsHtml}
          </select>
          ${showErrors && industryError ? `<div class="field-error">${industryError.message}</div>` : ''}
        </div>

        ${customIndustryHtml}

        <div class="form-group">
          <label>Systems to Integrate</label>
          ${showErrors && systemsWarning ? `<div class="field-warning">${systemsWarning.message}</div>` : ''}
          <div class="systems-grid">
            ${systemCategoriesHtml}
          </div>
        </div>

        <div class="form-group">
          <label for="customSystems">Other Systems</label>
          <input
            type="text"
            id="customSystems"
            class="text-input"
            placeholder="Enter additional systems (comma-separated)"
            value="${this.escapeHtml(state.customSystems || '')}"
            oninput="updateCustomSystems(this.value)"
          >
        </div>

        <div class="form-group">
          <label>Additional Context (Optional)</label>
          <p class="field-hint">Upload an account plan, requirements document, or other relevant materials.</p>
          ${fileUploadHtml}
        </div>
      </div>
    `;
  }

  /**
   * Generate Step 2 (AI Gap-Filling) HTML
   */
  private generateStep2Html(): string {
    const state = this._wizardState.aiGapFillingState;
    const isStreaming = state.isStreaming;
    const hasError = !!state.streamingError;
    const assumptionsAccepted = state.assumptionsAccepted;
    const conversationCount = state.conversationHistory.filter((m) => m.role === 'user').length;
    const showHint = conversationCount >= 3 && !assumptionsAccepted;

    // Render conversation messages
    const messagesHtml = state.conversationHistory
      .map((msg) => {
        if (msg.role === 'user') {
          return this.renderUserMessage(msg.content);
        } else {
          return this.renderClaudeMessage(msg.content, msg.parsedAssumptions, false);
        }
      })
      .join('');

    // Render streaming indicator or error
    let statusHtml = '';
    if (isStreaming) {
      statusHtml = this.renderStreamingIndicator();
    } else if (hasError) {
      statusHtml = this.renderErrorMessage(state.streamingError!);
    }

    // Render finalization hint
    const hintHtml = showHint
      ? '<div class="finalization-hint">Ready to finalize? Click Confirm & Continue.</div>'
      : '';

    return `
      <div class="step-content step2-content">
        <div class="step-header">
          <h2>AI Gap Filling</h2>
          <p class="step-description">Claude will analyze your context and propose assumptions about your environment.</p>
        </div>

        <div class="chat-actions">
          <button class="action-button regenerate" onclick="regenerateAssumptions()" ${isStreaming ? 'disabled' : ''}>
            Regenerate
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
          <button class="send-button" onclick="sendMessage()" ${isStreaming ? 'disabled' : ''}>
            Send
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Generate Step 3 (Outcome Definition) form HTML
   */
  private generateStep3Html(): string {
    const state = this._wizardState.outcome;
    const showErrors = this._wizardState.validationAttempted;
    const validation = this._validationState;

    const primaryOutcomeError = validation.errors.find(
      (e) => e.type === 'primaryOutcome' && e.severity === 'error'
    );
    const metricsWarning = validation.errors.find(
      (e) => e.type === 'successMetrics' && e.severity === 'warning'
    );

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
          <button class="dismiss-error-button" onclick="dismissOutcomeError()">Dismiss</button>
        </div>
      `;
    }

    // Render metrics list
    const metricsHtml = state.successMetrics
      .map((metric, index) => this.renderMetricRow(metric, index))
      .join('');

    const metricCountGuidance =
      state.successMetrics.length >= 10
        ? '<div class="metric-guidance">Consider focusing on fewer metrics for clarity</div>'
        : '';

    // Combine static stakeholders with AI-suggested custom stakeholders
    const allStakeholders = [...STAKEHOLDER_OPTIONS];
    const aiSuggestedStakeholders = state.customStakeholders.filter(
      (s) => !STAKEHOLDER_OPTIONS.includes(s)
    );

    // Render stakeholder checkboxes
    const stakeholderCheckboxesHtml = allStakeholders
      .map((stakeholder) => {
        const checked = state.stakeholders.includes(stakeholder) ? 'checked' : '';
        const stakeholderId = stakeholder.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        return `
          <label class="stakeholder-checkbox">
            <input type="checkbox" id="stakeholder-${stakeholderId}" value="${stakeholder}" ${checked} onchange="toggleStakeholder('${stakeholder}')">
            <span class="checkbox-label">${this.escapeHtml(stakeholder)}</span>
          </label>
        `;
      })
      .join('');

    // Render AI-suggested stakeholders with badge
    const aiStakeholderCheckboxesHtml = aiSuggestedStakeholders
      .map((stakeholder) => {
        const checked = state.stakeholders.includes(stakeholder) ? 'checked' : '';
        const stakeholderId = stakeholder.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        return `
          <label class="stakeholder-checkbox ai-suggested">
            <input type="checkbox" id="stakeholder-${stakeholderId}" value="${stakeholder}" ${checked} onchange="toggleStakeholder('${this.escapeHtml(stakeholder)}')">
            <span class="checkbox-label">${this.escapeHtml(stakeholder)}</span>
            <span class="ai-badge">AI suggested</span>
          </label>
        `;
      })
      .join('');

    return `
      <div class="step-content step3-content">
        <div class="step-header">
          <h2>Outcome Definition</h2>
          <p class="step-description">Define measurable business outcomes and success metrics for your workflow.</p>
        </div>

        <div class="chat-actions">
          <button class="action-button regenerate" onclick="regenerateOutcomeSuggestions()" ${state.isLoading ? 'disabled' : ''}>
            Regenerate Suggestions
          </button>
        </div>

        ${loadingHtml}

        <div class="form-group">
          <label for="primaryOutcome">Primary Outcome <span class="required">*</span></label>
          <textarea
            id="primaryOutcome"
            class="textarea ${showErrors && primaryOutcomeError ? 'error' : ''}"
            placeholder="Describe the measurable business result you want to achieve..."
            oninput="updatePrimaryOutcome(this.value)"
          >${this.escapeHtml(state.primaryOutcome)}</textarea>
          ${showErrors && primaryOutcomeError ? `<div class="field-error">${primaryOutcomeError.message}</div>` : ''}
        </div>

        <div class="form-group">
          <label>Success Metrics</label>
          ${showErrors && metricsWarning ? `<div class="field-warning">${metricsWarning.message}</div>` : ''}
          <div class="metrics-list">
            ${metricsHtml}
          </div>
          ${metricCountGuidance}
          <button class="add-metric-button" onclick="addMetric()">+ Add Metric</button>
        </div>

        <div class="form-group">
          <label>Stakeholders</label>
          <p class="field-hint">Select stakeholders who will benefit from or be impacted by this workflow.</p>
          <div class="stakeholders-grid">
            ${stakeholderCheckboxesHtml}
            ${aiStakeholderCheckboxesHtml}
          </div>
          <div class="custom-stakeholder-input">
            <input
              type="text"
              id="customStakeholderInput"
              class="text-input"
              placeholder="Add custom stakeholder..."
              onkeydown="handleCustomStakeholderKeydown(event)"
            >
            <button class="add-stakeholder-button" onclick="addCustomStakeholder()">Add</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render a metric row with name, target value, and unit inputs
   */
  private renderMetricRow(metric: SuccessMetric, index: number): string {
    return `
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
        <button class="remove-metric-button" onclick="removeMetric(${index})" title="Remove metric">
          ✕
        </button>
      </div>
    `;
  }

  /**
   * Render a Claude (assistant) message
   */
  private renderClaudeMessage(
    content: string,
    assumptions?: SystemAssumption[],
    isStreaming?: boolean
  ): string {
    // Render assumption cards if present
    let assumptionsHtml = '';
    if (assumptions && assumptions.length > 0) {
      const cardsHtml = assumptions.map((a) => this.renderAssumptionCard(a)).join('');
      const acceptDisabled =
        this._wizardState.aiGapFillingState.assumptionsAccepted || isStreaming;
      const acceptLabel = this._wizardState.aiGapFillingState.assumptionsAccepted
        ? 'Accepted'
        : 'Accept Assumptions';

      assumptionsHtml = `
        <div class="assumptions-container">
          ${cardsHtml}
          <button class="accept-button" onclick="acceptAssumptions()" ${acceptDisabled ? 'disabled' : ''}>
            ${acceptLabel}
          </button>
        </div>
      `;
    }

    return `
      <div class="chat-message claude-message">
        <div class="message-avatar">🤖</div>
        <div class="message-content">
          <div class="message-text">${this.escapeHtml(content)}</div>
          ${assumptionsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Render a user message
   */
  private renderUserMessage(content: string): string {
    return `
      <div class="chat-message user-message">
        <div class="message-content">
          <div class="message-text">${this.escapeHtml(content)}</div>
        </div>
      </div>
    `;
  }

  /**
   * Render streaming indicator (typing dots)
   */
  private renderStreamingIndicator(): string {
    return `
      <div class="chat-message claude-message streaming">
        <div class="message-avatar">🤖</div>
        <div class="message-content">
          <div class="typing-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render an assumption card
   */
  private renderAssumptionCard(assumption: SystemAssumption): string {
    const modulesHtml = assumption.modules
      .map((m) => `<span class="module-chip">${this.escapeHtml(m)}</span>`)
      .join('');

    const integrationsHtml = assumption.integrations
      .map((i) => `<li>${this.escapeHtml(i)}</li>`)
      .join('');

    const sourceClass = assumption.source === 'user-corrected' ? 'user-corrected' : '';

    return `
      <div class="assumption-card ${sourceClass}">
        <div class="assumption-header">${this.escapeHtml(assumption.system)}</div>
        ${modulesHtml ? `<div class="assumption-modules">${modulesHtml}</div>` : ''}
        ${integrationsHtml ? `<ul class="assumption-integrations">${integrationsHtml}</ul>` : ''}
      </div>
    `;
  }

  /**
   * Render an error message with retry button
   */
  private renderErrorMessage(error: string): string {
    return `
      <div class="chat-message error-message">
        <div class="error-content">
          <div class="error-text">Response interrupted: ${this.escapeHtml(error)}</div>
          <button class="retry-button" onclick="retryLastMessage()">Try Again</button>
        </div>
      </div>
    `;
  }

  /**
   * Generate step content based on current step
   */
  private generateStepContent(): string {
    switch (this._wizardState.currentStep) {
      case WizardStep.BusinessContext:
        return this.generateStep1Html();
      case WizardStep.AIGapFilling:
        return this.generateStep2Html();
      case WizardStep.OutcomeDefinition:
        return this.generateStep3Html();
      case WizardStep.Security:
        return this.generatePlaceholderStepHtml('Security & Guardrails', 'Configure security and compliance settings.');
      case WizardStep.AgentDesign:
        return this.generatePlaceholderStepHtml('Agent Design', 'Design your agent architecture and workflows here.');
      case WizardStep.MockData:
        return this.generatePlaceholderStepHtml('Mock Data', 'Generate mock data for testing your workflow.');
      case WizardStep.DemoStrategy:
        return this.generatePlaceholderStepHtml('Demo Strategy', 'Define your demo strategy and scenarios.');
      case WizardStep.Generate:
        return this.generatePlaceholderStepHtml('Generate', 'Generate your final agent workflow.');
      default:
        return '';
    }
  }

  /**
   * Generate placeholder HTML for unimplemented steps
   */
  private generatePlaceholderStepHtml(title: string, description: string): string {
    return `
      <div class="step-content placeholder-step">
        <div class="placeholder-icon">&#128679;</div>
        <h2>${title}</h2>
        <p class="placeholder-description">${description}</p>
        <p class="placeholder-note">This step will be implemented in a future update.</p>
      </div>
    `;
  }

  /**
   * Get the full wizard HTML content
   */
  private getWizardHtmlContent(): string {
    const stepIndicator = this.generateStepIndicatorHtml();
    const stepContent = this.generateStepContent();
    const navigationButtons = this.generateNavigationButtonsHtml();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>Ideation Wizard</title>
  <style>
    ${this.generateWizardCss()}
  </style>
</head>
<body>
  <div class="wizard-container">
    ${stepIndicator}
    <div class="step-content-container">
      ${stepContent}
    </div>
    ${navigationButtons}
  </div>
  <script>
    ${this.generateWizardJs()}
  </script>
</body>
</html>`;
  }

  /**
   * Generate CSS for the wizard
   */
  private generateWizardCss(): string {
    return `
    * {
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      padding: 0;
      margin: 0;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }

    .wizard-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      padding: 16px;
    }

    /* Step Indicator */
    .step-indicator {
      display: flex;
      justify-content: space-between;
      margin-bottom: 24px;
      padding: 0 8px;
      overflow-x: auto;
    }

    .step-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      min-width: 60px;
      padding: 4px;
      cursor: default;
    }

    .step-item.clickable {
      cursor: pointer;
    }

    .step-item.clickable:hover .step-circle {
      border-color: var(--vscode-focusBorder);
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
      border: 2px solid var(--vscode-panel-border, #444);
      background-color: var(--vscode-editor-background);
      transition: all 0.2s;
    }

    .step-item.completed .step-circle {
      background-color: var(--vscode-button-background);
      border-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .step-item.current .step-circle {
      border-color: var(--vscode-focusBorder);
      background-color: var(--vscode-focusBorder);
      color: var(--vscode-button-foreground);
    }

    .step-item.pending .step-circle {
      opacity: 0.5;
    }

    .step-icon {
      width: 14px;
      height: 14px;
    }

    .step-number {
      font-size: 11px;
    }

    .step-label {
      margin-top: 4px;
      font-size: 10px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 70px;
    }

    .step-item.current .step-label {
      color: var(--vscode-foreground);
      font-weight: 600;
    }

    /* Step Content */
    .step-content-container {
      flex: 1;
      overflow-y: auto;
      padding-bottom: 16px;
    }

    .step-content {
      animation: fadeIn 0.2s ease-in-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .step-header {
      margin-bottom: 20px;
    }

    .step-header h2 {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 600;
    }

    .step-description {
      margin: 0;
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
    }

    /* Placeholder Steps */
    .placeholder-step {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-height: 300px;
      padding: 40px 20px;
    }

    .placeholder-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .placeholder-step h2 {
      margin: 0 0 12px 0;
      font-size: 20px;
    }

    .placeholder-description {
      margin: 0 0 8px 0;
      color: var(--vscode-descriptionForeground);
      font-size: 14px;
    }

    .placeholder-note {
      margin: 0;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      opacity: 0.7;
    }

    /* Form Elements */
    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    .required {
      color: var(--vscode-errorForeground, #f48771);
    }

    .field-hint {
      margin: 0 0 8px 0;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .textarea {
      width: 100%;
      min-height: 100px;
      padding: 10px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
      resize: vertical;
    }

    .textarea:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }

    .textarea::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }

    .textarea.error {
      border-color: var(--vscode-inputValidation-errorBorder, #be1100);
    }

    .select {
      width: 100%;
      padding: 8px 10px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
    }

    .select:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }

    .select.error {
      border-color: var(--vscode-inputValidation-errorBorder, #be1100);
    }

    .text-input {
      width: 100%;
      padding: 8px 10px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
    }

    .text-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }

    .text-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }

    .field-error {
      margin-top: 6px;
      font-size: 11px;
      color: var(--vscode-errorForeground, #f48771);
    }

    .field-warning {
      margin-bottom: 8px;
      padding: 8px 12px;
      font-size: 11px;
      background-color: var(--vscode-inputValidation-warningBackground, #352a05);
      border: 1px solid var(--vscode-inputValidation-warningBorder, #b89500);
      border-radius: 4px;
      color: var(--vscode-inputValidation-warningForeground, #cca700);
    }

    .custom-industry-group {
      margin-top: 12px;
    }

    /* Systems Grid */
    .systems-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 16px;
    }

    @media (max-width: 300px) {
      .systems-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .system-category {
      padding: 12px;
      background-color: var(--vscode-input-background);
      border-radius: 4px;
    }

    .category-header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }

    .category-systems {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .system-checkbox {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      font-size: 12px;
    }

    .system-checkbox input[type="checkbox"] {
      margin: 0;
      cursor: pointer;
    }

    .checkbox-label {
      user-select: none;
    }

    /* File Upload */
    .file-upload-zone {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .file-upload-button {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 8px 16px;
      font-size: 12px;
      border-radius: 4px;
      cursor: pointer;
    }

    .file-upload-button:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .file-upload-hint {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .file-uploaded {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background-color: var(--vscode-input-background);
      border-radius: 4px;
    }

    .file-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
    }

    .file-name {
      font-weight: 500;
    }

    .file-size {
      color: var(--vscode-descriptionForeground);
    }

    .file-remove {
      background: transparent;
      border: none;
      color: var(--vscode-errorForeground, #f48771);
      font-size: 11px;
      cursor: pointer;
      padding: 4px 8px;
    }

    .file-remove:hover {
      text-decoration: underline;
    }

    /* Navigation Buttons */
    .navigation-buttons {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid var(--vscode-panel-border, #444);
      margin-top: auto;
    }

    .nav-button {
      flex: 1;
      padding: 10px 20px;
      font-size: 13px;
      font-weight: 500;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .nav-button.back {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .nav-button.back:hover:not(:disabled) {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .nav-button.next {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .nav-button.next:hover:not(:disabled) {
      background-color: var(--vscode-button-hoverBackground);
    }

    .nav-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .nav-button:focus {
      outline: 2px solid var(--vscode-focusBorder);
      outline-offset: 2px;
    }

    /* =====================================================================
       Step 2: AI Gap-Filling Chat Styles
       ===================================================================== */

    .step2-content {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .chat-actions {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 12px;
    }

    .action-button {
      padding: 6px 12px;
      font-size: 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .action-button.regenerate {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .action-button.regenerate:hover:not(:disabled) {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .action-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Chat Container */
    .chat-container {
      flex: 1;
      min-height: 200px;
      max-height: 400px;
      overflow-y: auto;
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border, #444);
      border-radius: 4px;
      margin-bottom: 12px;
    }

    .chat-messages {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 12px;
    }

    /* Chat Messages */
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
      background-color: var(--vscode-input-background);
      border-bottom-left-radius: 4px;
    }

    .user-message .message-text {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-bottom-right-radius: 4px;
    }

    /* Streaming Indicator */
    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 12px 14px;
      background-color: var(--vscode-input-background);
      border-radius: 12px;
      border-bottom-left-radius: 4px;
    }

    .typing-indicator .dot {
      width: 8px;
      height: 8px;
      background-color: var(--vscode-descriptionForeground);
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

    /* Assumption Cards */
    .assumptions-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .assumption-card {
      padding: 12px;
      background-color: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-editorWidget-border, #454545);
      border-radius: 6px;
    }

    .assumption-card.user-corrected {
      border-left: 3px solid var(--vscode-charts-blue, #3794ff);
    }

    .assumption-header {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--vscode-foreground);
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
      background-color: var(--vscode-badge-background);
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

    /* Accept Button */
    .accept-button {
      margin-top: 8px;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 500;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .accept-button:hover:not(:disabled) {
      background-color: var(--vscode-button-hoverBackground);
    }

    .accept-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Error Message */
    .error-message {
      max-width: 100%;
    }

    .error-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      background-color: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
      border-radius: 6px;
    }

    .error-text {
      font-size: 12px;
      color: var(--vscode-errorForeground, #f48771);
    }

    .retry-button {
      align-self: flex-start;
      padding: 6px 12px;
      font-size: 11px;
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .retry-button:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    /* Chat Input Area */
    .chat-input-area {
      display: flex;
      gap: 8px;
    }

    .chat-input {
      flex: 1;
      padding: 10px 12px;
      font-size: 13px;
      font-family: var(--vscode-font-family);
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
    }

    .chat-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }

    .chat-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }

    .chat-input:disabled {
      opacity: 0.5;
    }

    .send-button {
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 500;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .send-button:hover:not(:disabled) {
      background-color: var(--vscode-button-hoverBackground);
    }

    .send-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Finalization Hint */
    .finalization-hint {
      padding: 8px 12px;
      margin-bottom: 12px;
      font-size: 12px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
      background-color: var(--vscode-input-background);
      border-radius: 4px;
    }

    /* =====================================================================
       Step 3: Outcome Definition Styles
       ===================================================================== */

    .step3-content {
      display: flex;
      flex-direction: column;
    }

    .outcome-loading {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      margin-bottom: 16px;
      background-color: var(--vscode-input-background);
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
      background-color: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
      border-radius: 4px;
    }

    .outcome-error .error-text {
      font-size: 12px;
      color: var(--vscode-errorForeground, #f48771);
    }

    .dismiss-error-button {
      background: transparent;
      border: none;
      color: var(--vscode-errorForeground, #f48771);
      font-size: 11px;
      cursor: pointer;
      padding: 4px 8px;
    }

    .dismiss-error-button:hover {
      text-decoration: underline;
    }

    /* Metrics List */
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
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
    }

    .metric-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }

    .metric-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
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

    .remove-metric-button {
      background: transparent;
      border: none;
      color: var(--vscode-errorForeground, #f48771);
      font-size: 14px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
    }

    .remove-metric-button:hover {
      background-color: var(--vscode-input-background);
    }

    .add-metric-button {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 8px 16px;
      font-size: 12px;
      border-radius: 4px;
      cursor: pointer;
      align-self: flex-start;
    }

    .add-metric-button:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .metric-guidance {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      padding: 8px 0;
    }

    /* Stakeholders Grid */
    .stakeholders-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }

    @media (max-width: 300px) {
      .stakeholders-grid {
        grid-template-columns: 1fr;
      }
    }

    .stakeholder-checkbox {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      font-size: 12px;
      padding: 6px 8px;
      background-color: var(--vscode-input-background);
      border-radius: 4px;
    }

    .stakeholder-checkbox input[type="checkbox"] {
      margin: 0;
      cursor: pointer;
    }

    .stakeholder-checkbox.ai-suggested {
      border: 1px solid var(--vscode-button-background);
    }

    .ai-badge {
      font-size: 10px;
      padding: 2px 6px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-radius: 10px;
      margin-left: auto;
    }

    /* Custom Stakeholder Input */
    .custom-stakeholder-input {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    .custom-stakeholder-input .text-input {
      flex: 1;
    }

    .add-stakeholder-button {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 8px 16px;
      font-size: 12px;
      border-radius: 4px;
      cursor: pointer;
    }

    .add-stakeholder-button:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
    `;
  }

  /**
   * Generate JavaScript for the wizard
   */
  private generateWizardJs(): string {
    return `
    const vscode = acquireVsCodeApi();

    // Navigation functions
    function nextStep() {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.NEXT_STEP}' });
    }

    function previousStep() {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.PREVIOUS_STEP}' });
    }

    function goToStep(step) {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.GO_TO_STEP}', step: step });
    }

    // Form update functions
    function updateBusinessObjective(value) {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.UPDATE_BUSINESS_OBJECTIVE}', value: value });
    }

    function updateIndustry(value) {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.UPDATE_INDUSTRY}', value: value });
    }

    function updateCustomIndustry(value) {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.UPDATE_CUSTOM_INDUSTRY}', value: value });
    }

    function toggleSystem(system) {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.TOGGLE_SYSTEM}', system: system });
    }

    function updateCustomSystems(value) {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.UPDATE_CUSTOM_SYSTEMS}', value: value });
    }

    // File upload functions
    function handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      // Validate file size
      const maxSize = ${FILE_UPLOAD_CONSTRAINTS.MAX_SIZE_BYTES};
      if (file.size > maxSize) {
        alert('File size exceeds ${FILE_UPLOAD_CONSTRAINTS.MAX_SIZE_DISPLAY} limit');
        event.target.value = '';
        return;
      }

      // Validate file type
      const validExtensions = ${JSON.stringify(FILE_UPLOAD_CONSTRAINTS.ACCEPTED_EXTENSIONS)};
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
      if (!validExtensions.includes(fileExtension)) {
        alert('Invalid file type. Accepted formats: ' + validExtensions.join(', '));
        event.target.value = '';
        return;
      }

      // Read file as ArrayBuffer and send to extension
      const reader = new FileReader();
      reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        const uint8Array = new Uint8Array(arrayBuffer);
        vscode.postMessage({
          command: '${WIZARD_COMMANDS.UPLOAD_FILE}',
          name: file.name,
          size: file.size,
          data: Array.from(uint8Array)
        });
      };
      reader.readAsArrayBuffer(file);
    }

    function removeFile() {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.REMOVE_FILE}' });
    }

    // Step 2: AI Gap-Filling functions
    function sendMessage() {
      const input = document.getElementById('chatInput');
      if (input && input.value.trim()) {
        vscode.postMessage({ command: '${WIZARD_COMMANDS.SEND_CHAT_MESSAGE}', value: input.value.trim() });
        input.value = '';
      }
    }

    function handleChatKeydown(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    }

    function acceptAssumptions() {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.ACCEPT_ASSUMPTIONS}' });
    }

    function regenerateAssumptions() {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.REGENERATE_ASSUMPTIONS}' });
    }

    function retryLastMessage() {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.RETRY_LAST_MESSAGE}' });
    }

    // Step 3: Outcome Definition functions
    function updatePrimaryOutcome(value) {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.UPDATE_PRIMARY_OUTCOME}', value: value });
    }

    function addMetric() {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.ADD_METRIC}' });
    }

    function removeMetric(index) {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.REMOVE_METRIC}', index: index });
    }

    function updateMetric(index, field, value) {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.UPDATE_METRIC}', index: index, field: field, value: value });
    }

    function toggleStakeholder(stakeholder) {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.TOGGLE_STAKEHOLDER}', stakeholder: stakeholder });
    }

    function addCustomStakeholder() {
      const input = document.getElementById('customStakeholderInput');
      if (input && input.value.trim()) {
        vscode.postMessage({ command: '${WIZARD_COMMANDS.ADD_CUSTOM_STAKEHOLDER}', value: input.value.trim() });
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
      vscode.postMessage({ command: '${WIZARD_COMMANDS.REGENERATE_OUTCOME_SUGGESTIONS}' });
    }

    function dismissOutcomeError() {
      vscode.postMessage({ command: '${WIZARD_COMMANDS.DISMISS_OUTCOME_ERROR}' });
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'stateSync') {
        // State sync handled by full HTML re-render
        // This is for future incremental updates
      }
      if (message.type === 'streamingToken') {
        // Update the streaming message content in real-time
        const streamingMessage = document.querySelector('.streaming .message-text');
        if (streamingMessage) {
          streamingMessage.textContent = message.content;
        }
      }
    });
    `;
  }

  /**
   * Handle messages received from the webview
   * @param message The message from the webview
   */
  private handleMessage(message: unknown): void {
    const msg = message as {
      command?: string;
      value?: string;
      step?: number;
      system?: string;
      name?: string;
      size?: number;
      data?: number[];
      // Step 3: Outcome Definition fields
      index?: number;
      field?: string;
      stakeholder?: string;
    };

    switch (msg.command) {
      case WIZARD_COMMANDS.NEXT_STEP:
        this.navigateForward();
        break;

      case WIZARD_COMMANDS.PREVIOUS_STEP:
        this.navigateBackward();
        break;

      case WIZARD_COMMANDS.GO_TO_STEP:
        if (typeof msg.step === 'number') {
          this.navigateToStep(msg.step);
        }
        break;

      case WIZARD_COMMANDS.UPDATE_BUSINESS_OBJECTIVE:
        this._wizardState.businessObjective = msg.value || '';
        this._validationState = this.validateCurrentStep();
        // Don't re-render, just sync validation state
        this.syncStateToWebview();
        break;

      case WIZARD_COMMANDS.UPDATE_INDUSTRY:
        this._wizardState.industry = msg.value || '';
        // Clear custom industry if not "Other"
        if (this._wizardState.industry !== 'Other') {
          this._wizardState.customIndustry = undefined;
        }
        this._validationState = this.validateCurrentStep();
        this.updateWebviewContent();
        this.syncStateToWebview();
        break;

      case WIZARD_COMMANDS.UPDATE_CUSTOM_INDUSTRY:
        this._wizardState.customIndustry = msg.value || '';
        break;

      case WIZARD_COMMANDS.TOGGLE_SYSTEM:
        if (msg.system) {
          const index = this._wizardState.systems.indexOf(msg.system);
          if (index === -1) {
            this._wizardState.systems.push(msg.system);
          } else {
            this._wizardState.systems.splice(index, 1);
          }
          this._validationState = this.validateCurrentStep();
          this.syncStateToWebview();
        }
        break;

      case WIZARD_COMMANDS.UPDATE_CUSTOM_SYSTEMS:
        this._wizardState.customSystems = msg.value || '';
        break;

      case WIZARD_COMMANDS.UPLOAD_FILE:
        if (msg.name && msg.size !== undefined && msg.data) {
          this._wizardState.uploadedFile = {
            name: msg.name,
            size: msg.size,
            data: new Uint8Array(msg.data),
          };
          this._validationState = this.validateCurrentStep();
          this.updateWebviewContent();
          this.syncStateToWebview();
        }
        break;

      case WIZARD_COMMANDS.REMOVE_FILE:
        this._wizardState.uploadedFile = undefined;
        this._validationState = this.validateCurrentStep();
        this.updateWebviewContent();
        this.syncStateToWebview();
        break;

      // Step 2: AI Gap-Filling commands
      case WIZARD_COMMANDS.SEND_CHAT_MESSAGE:
        if (msg.value && typeof msg.value === 'string') {
          this.handleSendChatMessage(msg.value);
        }
        break;

      case WIZARD_COMMANDS.ACCEPT_ASSUMPTIONS:
        this.handleAcceptAssumptions();
        break;

      case WIZARD_COMMANDS.REGENERATE_ASSUMPTIONS:
        this.handleRegenerateAssumptions();
        break;

      case WIZARD_COMMANDS.RETRY_LAST_MESSAGE:
        this.handleRetryLastMessage();
        break;

      // Step 3: Outcome Definition commands
      case WIZARD_COMMANDS.UPDATE_PRIMARY_OUTCOME:
        this._wizardState.outcome.primaryOutcome = msg.value || '';
        this._wizardState.outcome.primaryOutcomeEdited = true;
        this._validationState = this.validateCurrentStep();
        this.syncStateToWebview();
        break;

      case WIZARD_COMMANDS.ADD_METRIC:
        this._wizardState.outcome.successMetrics.push({
          name: '',
          targetValue: '',
          unit: '',
        });
        this._wizardState.outcome.metricsEdited = true;
        this._validationState = this.validateCurrentStep();
        this.updateWebviewContent();
        this.syncStateToWebview();
        break;

      case WIZARD_COMMANDS.REMOVE_METRIC:
        if (typeof msg.index === 'number' && msg.index >= 0) {
          this._wizardState.outcome.successMetrics.splice(msg.index, 1);
          this._wizardState.outcome.metricsEdited = true;
          this._validationState = this.validateCurrentStep();
          this.updateWebviewContent();
          this.syncStateToWebview();
        }
        break;

      case WIZARD_COMMANDS.UPDATE_METRIC:
        if (typeof msg.index === 'number' && msg.index >= 0 && msg.field) {
          const metric = this._wizardState.outcome.successMetrics[msg.index];
          if (metric) {
            if (msg.field === 'name') {
              metric.name = msg.value || '';
            } else if (msg.field === 'targetValue') {
              metric.targetValue = msg.value || '';
            } else if (msg.field === 'unit') {
              metric.unit = msg.value || '';
            }
            this._wizardState.outcome.metricsEdited = true;
            this.syncStateToWebview();
          }
        }
        break;

      case WIZARD_COMMANDS.TOGGLE_STAKEHOLDER:
        if (msg.stakeholder) {
          const stakeholders = this._wizardState.outcome.stakeholders;
          const index = stakeholders.indexOf(msg.stakeholder);
          if (index === -1) {
            stakeholders.push(msg.stakeholder);
          } else {
            stakeholders.splice(index, 1);
          }
          this._wizardState.outcome.stakeholdersEdited = true;
          this.syncStateToWebview();
        }
        break;

      case WIZARD_COMMANDS.ADD_CUSTOM_STAKEHOLDER:
        if (msg.value && msg.value.trim()) {
          const trimmedValue = msg.value.trim();
          // Add to custom stakeholders if not already in static list or custom list
          if (
            !STAKEHOLDER_OPTIONS.includes(trimmedValue) &&
            !this._wizardState.outcome.customStakeholders.includes(trimmedValue)
          ) {
            this._wizardState.outcome.customStakeholders.push(trimmedValue);
          }
          // Also add to selected stakeholders
          if (!this._wizardState.outcome.stakeholders.includes(trimmedValue)) {
            this._wizardState.outcome.stakeholders.push(trimmedValue);
          }
          this._wizardState.outcome.stakeholdersEdited = true;
          this.updateWebviewContent();
          this.syncStateToWebview();
        }
        break;

      case WIZARD_COMMANDS.REGENERATE_OUTCOME_SUGGESTIONS:
        this.handleRegenerateOutcomeSuggestions();
        break;

      case WIZARD_COMMANDS.DISMISS_OUTCOME_ERROR:
        this._wizardState.outcome.loadingError = undefined;
        this.updateWebviewContent();
        this.syncStateToWebview();
        break;

      default:
        console.log('[IdeationWizard] Received unknown message:', message);
    }
  }

  /**
   * Update the webview HTML content
   */
  private updateWebviewContent(): void {
    if (this._view) {
      this._view.webview.html = this.getWizardHtmlContent();
    }
  }

  /**
   * Synchronize state to webview
   */
  private syncStateToWebview(): void {
    if (!this._view) {
      return;
    }

    this._view.webview.postMessage({
      type: 'stateSync',
      state: this._wizardState,
      validation: this._validationState,
      steps: WIZARD_STEPS,
    });
  }

  /**
   * Escape HTML special characters
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
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
   * Refresh the panel content
   * Call this after state changes externally
   */
  public async refresh(): Promise<void> {
    this._validationState = this.validateCurrentStep();
    this.updateWebviewContent();
    this.syncStateToWebview();
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
   * Reset wizard state to defaults
   */
  public reset(): void {
    this._wizardState = createDefaultWizardState();
    this._validationState = this.validateCurrentStep();
    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    // Dispose all subscriptions
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
    // State is lost on dispose per spec
    // Persistence will be added in roadmap item 22
  }

  // =========================================================================
  // Step 2: AI Gap-Filling Private Methods
  // =========================================================================

  /**
   * Initialize the Bedrock conversation service if needed
   */
  private initBedrockService(): BedrockConversationService | undefined {
    if (this._bedrockService) {
      return this._bedrockService;
    }

    if (!this._extensionContext) {
      console.warn('[IdeationWizard] Extension context not available for Bedrock service');
      return undefined;
    }

    this._bedrockService = getBedrockConversationService(this._extensionContext);

    // Subscribe to streaming events
    this._disposables.push(
      this._bedrockService.onToken((token) => {
        this.handleStreamingToken(token);
      })
    );

    this._disposables.push(
      this._bedrockService.onComplete((response) => {
        this.handleStreamingComplete(response);
      })
    );

    this._disposables.push(
      this._bedrockService.onError((error) => {
        this.handleStreamingError(error.message);
      })
    );

    return this._bedrockService;
  }

  /**
   * Initialize the OutcomeDefinitionService for Step 3 AI suggestions
   * Sets up event listeners for streaming tokens, completion, and errors
   *
   * @returns The initialized service, or undefined if context is not available
   */
  private initOutcomeService(): OutcomeDefinitionService | undefined {
    if (this._outcomeService) {
      return this._outcomeService;
    }

    if (!this._extensionContext) {
      console.warn('[IdeationWizard] Extension context not available for Outcome service');
      return undefined;
    }

    this._outcomeService = getOutcomeDefinitionService(this._extensionContext);

    // Subscribe to streaming events for Step 3
    this._disposables.push(
      this._outcomeService.onToken((token) => {
        this.handleOutcomeStreamingToken(token);
      })
    );

    this._disposables.push(
      this._outcomeService.onComplete((response) => {
        this.handleOutcomeStreamingComplete(response);
      })
    );

    this._disposables.push(
      this._outcomeService.onError((error) => {
        this.handleOutcomeStreamingError(error.message);
      })
    );

    return this._outcomeService;
  }

  /**
   * Trigger auto-send of context to Claude when entering Step 2
   * Checks for Step 1 input changes and resets conversation if needed
   */
  private triggerAutoSendForStep2(): void {
    const state = this._wizardState.aiGapFillingState;

    // Check if Step 1 inputs have changed since last visit
    if (
      hasStep1Changed(
        state.step1InputHash,
        this._wizardState.businessObjective,
        this._wizardState.industry,
        this._wizardState.systems
      )
    ) {
      // Reset conversation state due to input changes
      this._wizardState.aiGapFillingState = createDefaultAIGapFillingState();
    }

    // Only auto-send if conversation is empty (first visit or after reset)
    if (state.conversationHistory.length === 0 && !state.isStreaming) {
      this.sendContextToClaude();
    }
  }

  /**
   * Build and send context message to Claude for Step 2
   */
  private async sendContextToClaude(): Promise<void> {
    const service = this.initBedrockService();
    if (!service) {
      this._wizardState.aiGapFillingState.streamingError =
        'Claude service not available. Please check your configuration.';
      this.syncStateToWebview();
      return;
    }

    // Build context message from Step 1 inputs
    const contextMessage = buildContextMessage(
      this._wizardState.businessObjective,
      this._wizardState.industry,
      this._wizardState.systems
    );

    // Store hash for change detection
    this._wizardState.aiGapFillingState.step1InputHash = generateStep1Hash(
      this._wizardState.businessObjective,
      this._wizardState.industry,
      this._wizardState.systems
    );

    // Add user message to conversation history
    const userMessage: ConversationMessage = {
      role: 'user',
      content: contextMessage,
      timestamp: Date.now(),
    };
    this._wizardState.aiGapFillingState.conversationHistory.push(userMessage);

    // Set streaming state
    this._wizardState.aiGapFillingState.isStreaming = true;
    this._wizardState.aiGapFillingState.streamingError = undefined;
    this._streamingResponse = '';

    this._validationState = this.validateCurrentStep();
    this.updateWebviewContent();
    this.syncStateToWebview();

    // Send message to Claude (streaming will be handled by event handlers)
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
    const assistantMessage: ConversationMessage = {
      role: 'assistant',
      content: fullResponse,
      timestamp: Date.now(),
      parsedAssumptions,
    };
    this._wizardState.aiGapFillingState.conversationHistory.push(assistantMessage);

    // Update streaming state
    this._wizardState.aiGapFillingState.isStreaming = false;
    this._streamingResponse = '';

    this._validationState = this.validateCurrentStep();
    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Handle streaming error from Claude
   */
  private handleStreamingError(errorMessage: string): void {
    this._wizardState.aiGapFillingState.isStreaming = false;
    this._wizardState.aiGapFillingState.streamingError = errorMessage;
    this._streamingResponse = '';

    this._validationState = this.validateCurrentStep();
    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Handle SEND_CHAT_MESSAGE command - send user refinement message
   */
  private async handleSendChatMessage(content: string): Promise<void> {
    const service = this.initBedrockService();
    if (!service) {
      return;
    }

    // Add user message to conversation history
    const userMessage: ConversationMessage = {
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    this._wizardState.aiGapFillingState.conversationHistory.push(userMessage);

    // Set streaming state
    this._wizardState.aiGapFillingState.isStreaming = true;
    this._wizardState.aiGapFillingState.streamingError = undefined;
    this._streamingResponse = '';

    this._validationState = this.validateCurrentStep();
    this.updateWebviewContent();
    this.syncStateToWebview();

    // Send message to Claude
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _token of service.sendMessage(content)) {
        // Tokens are handled by onToken event handler
      }
    } catch (error) {
      this.handleStreamingError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Handle ACCEPT_ASSUMPTIONS command - accept all proposed assumptions
   */
  private handleAcceptAssumptions(): void {
    const history = this._wizardState.aiGapFillingState.conversationHistory;

    // Find the last assistant message with parsed assumptions
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === 'assistant' && msg.parsedAssumptions && msg.parsedAssumptions.length > 0) {
        // Copy assumptions to confirmed list
        this._wizardState.aiGapFillingState.confirmedAssumptions = [...msg.parsedAssumptions];
        this._wizardState.aiGapFillingState.assumptionsAccepted = true;
        break;
      }
    }

    this._validationState = this.validateCurrentStep();
    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Handle REGENERATE_ASSUMPTIONS command - clear and restart conversation
   */
  private handleRegenerateAssumptions(): void {
    // Reset conversation but keep the hash
    const hash = this._wizardState.aiGapFillingState.step1InputHash;
    this._wizardState.aiGapFillingState = createDefaultAIGapFillingState();
    this._wizardState.aiGapFillingState.step1InputHash = hash;

    // Reset the Bedrock service conversation
    if (this._bedrockService) {
      this._bedrockService.resetConversation();
    }

    this._validationState = this.validateCurrentStep();
    this.updateWebviewContent();
    this.syncStateToWebview();

    // Trigger new conversation
    this.sendContextToClaude();
  }

  /**
   * Handle RETRY_LAST_MESSAGE command - retry after an error
   */
  private handleRetryLastMessage(): void {
    const history = this._wizardState.aiGapFillingState.conversationHistory;

    // Clear the error
    this._wizardState.aiGapFillingState.streamingError = undefined;

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
   * Handle REGENERATE_OUTCOME_SUGGESTIONS command - reset and re-trigger AI for Step 3
   */
  private handleRegenerateOutcomeSuggestions(): void {
    const state = this._wizardState.outcome;

    // Log if user has edits (confirmation dialog could be added later)
    const hasEdits = state.primaryOutcomeEdited || state.metricsEdited || state.stakeholdersEdited;
    if (hasEdits) {
      console.log('[IdeationWizard] User has edits, regenerating will replace them');
    }

    // Reset the outcome definition state but keep custom stakeholders
    const customStakeholders = [...state.customStakeholders];
    this._wizardState.outcome = createDefaultOutcomeDefinitionState();
    this._wizardState.outcome.customStakeholders = customStakeholders;

    // Reset the outcome service conversation
    if (this._outcomeService) {
      this._outcomeService.resetConversation();
    }

    this._validationState = this.validateCurrentStep();
    this.updateWebviewContent();
    this.syncStateToWebview();

    // Trigger new AI suggestions
    this.sendOutcomeContextToClaude();
  }

  // =========================================================================
  // Step 3: Outcome Definition AI Methods
  // =========================================================================

  /**
   * Trigger auto-send of context to Claude when entering Step 3
   * Only sends if Step 3 is fresh (no prior suggestions loaded)
   */
  private triggerAutoSendForStep3(): void {
    const state = this._wizardState.outcome;

    // Only auto-send if outcome is fresh (no primaryOutcome yet) and not currently loading
    if (!state.primaryOutcome && !state.isLoading) {
      this.sendOutcomeContextToClaude();
    }
  }

  /**
   * Build and send context message to Claude for Step 3 outcome suggestions
   */
  private async sendOutcomeContextToClaude(): Promise<void> {
    const service = this.initOutcomeService();
    if (!service) {
      this._wizardState.outcome.loadingError =
        'Claude service not available. Please check your configuration.';
      this.syncStateToWebview();
      return;
    }

    // Build context message from Steps 1-2 inputs
    const contextMessage = service.buildOutcomeContextMessage(
      this._wizardState.businessObjective,
      this._wizardState.industry,
      this._wizardState.systems,
      this._wizardState.aiGapFillingState.confirmedAssumptions,
      this._wizardState.customSystems
    );

    // Set loading state
    this._wizardState.outcome.isLoading = true;
    this._wizardState.outcome.loadingError = undefined;
    this._outcomeStreamingResponse = '';

    this._validationState = this.validateCurrentStep();
    this.updateWebviewContent();
    this.syncStateToWebview();

    // Send message to Claude (streaming will be handled by event handlers)
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
   * Handle incoming streaming token from Claude for Step 3
   */
  private handleOutcomeStreamingToken(token: string): void {
    this._outcomeStreamingResponse += token;
    // Note: We don't show streaming tokens for Step 3, just wait for complete response
  }

  /**
   * Handle streaming complete from Claude for Step 3
   * Parses the response and populates form fields (if not already edited by user)
   */
  private handleOutcomeStreamingComplete(fullResponse: string): void {
    const state = this._wizardState.outcome;

    // Parse outcome suggestions from response
    const service = this._outcomeService;
    if (!service) {
      this.handleOutcomeStreamingError('Service not available');
      return;
    }

    const suggestions = service.parseOutcomeSuggestionsFromResponse(fullResponse);

    if (suggestions) {
      // Populate primary outcome (if not edited by user)
      if (!state.primaryOutcomeEdited && suggestions.primaryOutcome) {
        state.primaryOutcome = suggestions.primaryOutcome;
      }

      // Populate success metrics (if not edited by user)
      if (!state.metricsEdited && suggestions.suggestedKPIs.length > 0) {
        state.successMetrics = suggestions.suggestedKPIs;
      }

      // Populate stakeholders (if not edited by user)
      if (!state.stakeholdersEdited && suggestions.stakeholders.length > 0) {
        // Separate into static stakeholders and custom AI suggestions
        const staticOptions = STAKEHOLDER_OPTIONS;
        const selectedStakeholders: string[] = [];
        const customAiStakeholders: string[] = [];

        for (const stakeholder of suggestions.stakeholders) {
          if (staticOptions.includes(stakeholder)) {
            selectedStakeholders.push(stakeholder);
          } else {
            // AI suggested a stakeholder outside the static list
            customAiStakeholders.push(stakeholder);
            selectedStakeholders.push(stakeholder);
          }
        }

        state.stakeholders = selectedStakeholders;
        // Add AI-suggested custom stakeholders to the custom list
        state.customStakeholders = [
          ...state.customStakeholders,
          ...customAiStakeholders.filter((s) => !state.customStakeholders.includes(s)),
        ];
      }
    }

    // Clear loading state
    state.isLoading = false;
    state.loadingError = undefined;

    this._validationState = this.validateCurrentStep();
    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Handle streaming error from Claude for Step 3
   */
  private handleOutcomeStreamingError(errorMessage: string): void {
    this._wizardState.outcome.isLoading = false;
    this._wizardState.outcome.loadingError = errorMessage;

    this._validationState = this.validateCurrentStep();
    this.updateWebviewContent();
    this.syncStateToWebview();
  }
}
