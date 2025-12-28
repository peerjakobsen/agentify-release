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
  WIZARD_COMMANDS,
  FILE_UPLOAD_CONSTRAINTS,
  createDefaultWizardState,
  type WizardState,
  type WizardValidationState,
  type WizardValidationError,
  type WizardStepConfig,
} from '../types/wizardPanel';

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
   * Creates a new IdeationWizardPanelProvider
   * @param extensionUri The URI of the extension for loading local resources
   */
  constructor(private readonly extensionUri: vscode.Uri) {
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
   * Validate current step
   * @returns WizardValidationState
   */
  private validateCurrentStep(): WizardValidationState {
    switch (this._wizardState.currentStep) {
      case WizardStep.BusinessContext:
        return this.validateStep1();
      // Steps 2-6 have placeholder validation (always valid for now)
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

    const nextStep = this._wizardState.currentStep + 1;
    this._wizardState.currentStep = nextStep;
    this._wizardState.highestStepReached = Math.max(this._wizardState.highestStepReached, nextStep);
    this._wizardState.validationAttempted = false;
    this._validationState = this.validateCurrentStep();

    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Navigate to previous step
   */
  private navigateBackward(): void {
    if (!this.canNavigateBackward()) {
      return;
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
   * Generate step content based on current step
   */
  private generateStepContent(): string {
    switch (this._wizardState.currentStep) {
      case WizardStep.BusinessContext:
        return this.generateStep1Html();
      case WizardStep.AIGapFilling:
        return this.generatePlaceholderStepHtml('AI Gap Filling', 'AI-assisted clarification and gap filling will be available here.');
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

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'stateSync') {
        // State sync handled by full HTML re-render
        // This is for future incremental updates
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
    // State is lost on dispose per spec
    // Persistence will be added in roadmap item 22
  }
}
