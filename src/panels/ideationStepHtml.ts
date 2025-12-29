/**
 * Ideation Step HTML Generators
 * HTML rendering functions for each wizard step
 */

import {
  WIZARD_STEPS,
  INDUSTRY_OPTIONS,
  SYSTEM_OPTIONS,
  DATA_SENSITIVITY_OPTIONS,
  COMPLIANCE_FRAMEWORK_OPTIONS,
  APPROVAL_GATE_OPTIONS,
  STAKEHOLDER_OPTIONS,
} from './ideationConstants';

// ============================================================================
// Types (local to tabbedPanel - should be consolidated later)
// ============================================================================

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

export interface IdeationState {
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

export interface IdeationValidationState {
  isValid: boolean;
  errors: IdeationValidationError[];
  hasWarnings: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
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
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// Step HTML Generators
// ============================================================================

/**
 * Get step indicator HTML
 */
export function getStepIndicatorHtml(state: IdeationState): string {
  const steps = WIZARD_STEPS.map(step => {
    const isCompleted = step.step < state.currentStep;
    const isCurrent = step.step === state.currentStep;
    const isClickable = step.step <= state.highestStepReached && step.step !== state.currentStep;

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
 * Get step content HTML (dispatch to individual step renderers)
 */
export function getStepContentHtml(state: IdeationState, validation: IdeationValidationState): string {
  if (state.currentStep === 1) {
    return getStep1Html(state, validation);
  }
  if (state.currentStep === 2) {
    return getStep2Html(state);
  }
  if (state.currentStep === 3) {
    return getStep3Html(state);
  }
  if (state.currentStep === 4) {
    return getStep4Html(state);
  }
  return `
      <div class="placeholder-content">
        <p>Step ${state.currentStep} - Coming Soon</p>
        <p style="font-size: 12px; margin-top: 8px;">This step will be implemented in a future update.</p>
      </div>
    `;
}

/**
 * Get Step 1 HTML - Business Context
 */
export function getStep1Html(state: IdeationState, validation: IdeationValidationState): string {
  const showBusinessObjectiveError = state.validationAttempted &&
    validation.errors.some(e => e.type === 'businessObjective');
  const showIndustryError = state.validationAttempted &&
    validation.errors.some(e => e.type === 'industry');
  const showSystemsWarning = validation.errors.some(e => e.type === 'systems' && e.severity === 'warning');

  const industryOptions = INDUSTRY_OPTIONS.map(opt =>
    `<option value="${opt}" ${state.industry === opt ? 'selected' : ''}>${opt}</option>`
  ).join('');

  const systemsHtml = Object.entries(SYSTEM_OPTIONS).map(([category, systems]) => `
      <div class="system-category">
        <h4>${category}</h4>
        ${systems.map(sys => `
          <label class="system-option">
            <input type="checkbox" ${state.systems.includes(sys) ? 'checked' : ''} onchange="toggleSystem('${sys}')">
            ${sys}
          </label>
        `).join('')}
      </div>
    `).join('');

  const fileHtml = state.uploadedFile
    ? `<div class="file-info">
          <span>${escapeHtml(state.uploadedFile.name)} (${formatFileSize(state.uploadedFile.size)})</span>
          <button class="remove-file" onclick="removeFile()">Remove</button>
        </div>`
    : `<div class="file-upload-area" onclick="document.getElementById('file-input').click()">
          <p>Click to upload a file</p>
          <p style="font-size: 11px; color: var(--vscode-descriptionForeground);">PDF, DOCX, TXT, MD (max 5MB)</p>
          <input type="file" id="file-input" accept=".pdf,.docx,.txt,.md" style="display: none" onchange="handleFileUpload(event)">
        </div>`;

  return `
      ${showSystemsWarning ? `<div class="warning-banner">${validation.errors.find(e => e.type === 'systems')?.message}</div>` : ''}

      <div class="form-section">
        <label class="form-label required">Business Objective</label>
        <textarea
          placeholder="Describe the business problem or objective..."
          oninput="updateBusinessObjective(this.value)"
        >${escapeHtml(state.businessObjective)}</textarea>
        ${showBusinessObjectiveError ? '<div class="error-message">Business objective is required</div>' : ''}
      </div>

      <div class="form-section">
        <label class="form-label required">Industry</label>
        <select onchange="updateIndustry(this.value)">
          <option value="">Select an industry...</option>
          ${industryOptions}
        </select>
        ${showIndustryError ? '<div class="error-message">Please select an industry</div>' : ''}
        ${state.industry === 'Other' ? `
          <input type="text"
            placeholder="Specify your industry..."
            style="margin-top: 8px;"
            value="${escapeHtml(state.customIndustry || '')}"
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
          value="${escapeHtml(state.customSystems || '')}"
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
export function getStep2Html(state: IdeationState): string {
  const gapState = state.aiGapFillingState;
  const isStreaming = gapState?.isStreaming ?? false;
  const hasError = !!gapState?.streamingError;
  const assumptionsAccepted = gapState?.assumptionsAccepted ?? false;
  const conversationHistory = gapState?.conversationHistory ?? [];
  const conversationCount = conversationHistory.filter((m: { role: string }) => m.role === 'user').length;
  const showHint = conversationCount >= 3 && !assumptionsAccepted;

  // Render conversation messages
  const messagesHtml = conversationHistory
    .map((msg: { role: string; content: string; parsedAssumptions?: Array<{ system: string; modules: string[]; integrations: string[]; source: string }> }) => {
      if (msg.role === 'user') {
        return `
            <div class="chat-message user-message">
              <div class="message-content">
                <div class="message-text">${escapeHtml(msg.content)}</div>
              </div>
            </div>
          `;
      } else {
        // Claude message with optional assumption cards
        let assumptionsHtml = '';
        if (msg.parsedAssumptions && msg.parsedAssumptions.length > 0) {
          const cardsHtml = msg.parsedAssumptions.map((a: { system: string; modules: string[]; integrations: string[]; source: string }) => {
            const modulesHtml = a.modules.map((m: string) => `<span class="module-chip">${escapeHtml(m)}</span>`).join('');
            const integrationsHtml = a.integrations.map((i: string) => `<li>${escapeHtml(i)}</li>`).join('');
            const sourceClass = a.source === 'user-corrected' ? 'user-corrected' : '';
            return `
                <div class="assumption-card ${sourceClass}">
                  <div class="assumption-header">${escapeHtml(a.system)}</div>
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
                <div class="message-text">${escapeHtml(msg.content)}</div>
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
            <div class="error-text">Response interrupted: ${escapeHtml(gapState?.streamingError || '')}</div>
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
export function getStep3Html(state: IdeationState): string {
  const outcomeState = state.outcome;
  const showErrors = state.validationAttempted;
  const suggestionsAccepted = outcomeState.suggestionsAccepted ?? false;
  const isLoading = outcomeState.isLoading ?? false;
  const refinedSections = outcomeState.refinedSections ?? { outcome: false, kpis: false, stakeholders: false };

  // Render loading indicator or error
  let loadingHtml = '';
  if (isLoading) {
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
  } else if (outcomeState.loadingError) {
    loadingHtml = `
        <div class="outcome-error">
          <span class="error-text">${escapeHtml(outcomeState.loadingError)}</span>
          <button class="dismiss-error-btn" onclick="dismissOutcomeError()">Dismiss</button>
        </div>
      `;
  }

  // Refine input (visible in both phases)
  const refineInputHtml = `
      <div class="chat-input-area">
        <input
          type="text"
          id="outcomeRefineInput"
          class="chat-input"
          placeholder="Refine outcomes..."
          ${isLoading ? 'disabled' : ''}
          onkeydown="handleOutcomeRefineKeydown(event)"
        >
        <button class="send-btn" onclick="sendOutcomeRefinement()" ${isLoading ? 'disabled' : ''}>
          Send
        </button>
      </div>
      <p class="refine-hints">Try: "Add a metric for cost savings" or "Make the outcome more specific to risk"</p>
    `;

  // Phase 1: Suggestion Review (read-only card)
  if (!suggestionsAccepted) {
    // Build KPIs list for suggestion card
    const kpisListHtml = outcomeState.successMetrics.length > 0
      ? outcomeState.successMetrics.map((metric) => `
            <li>${escapeHtml(metric.name)}${metric.targetValue ? `: ${escapeHtml(metric.targetValue)}` : ''}${metric.unit ? ` ${escapeHtml(metric.unit)}` : ''}</li>
          `).join('')
      : '<li class="empty-hint">No KPIs suggested yet</li>';

    // Build stakeholders tags for suggestion card
    const stakeholdersTagsHtml = outcomeState.stakeholders.length > 0
      ? outcomeState.stakeholders.map((s) => `<span class="stakeholder-tag">${escapeHtml(s)}</span>`).join('')
      : '<span class="empty-hint">No stakeholders suggested yet</span>';

    // Refined indicators
    const outcomeRefinedBadge = refinedSections.outcome ? '<span class="refined-badge">(refined)</span>' : '';
    const kpisRefinedBadge = refinedSections.kpis ? '<span class="refined-badge">(refined)</span>' : '';
    const stakeholdersRefinedBadge = refinedSections.stakeholders ? '<span class="refined-badge">(refined)</span>' : '';

    return `
        <div class="step3-header">
          <p class="step-description">Review AI-generated outcome suggestions, refine if needed, then accept to edit.</p>
          <button class="regenerate-btn" onclick="regenerateOutcomeSuggestions()" ${isLoading ? 'disabled' : ''}>
            ↻ Regenerate
          </button>
        </div>

        ${loadingHtml}

        <div class="suggestion-card">
          <div class="suggestion-section">
            <div class="suggestion-header">Primary Outcome ${outcomeRefinedBadge}</div>
            <div class="suggestion-content">
              ${outcomeState.primaryOutcome ? escapeHtml(outcomeState.primaryOutcome) : '<span class="empty-hint">Waiting for AI suggestions...</span>'}
            </div>
          </div>

          <div class="suggestion-section">
            <div class="suggestion-header">Suggested KPIs ${kpisRefinedBadge}</div>
            <ul class="suggestion-kpis">
              ${kpisListHtml}
            </ul>
          </div>

          <div class="suggestion-section">
            <div class="suggestion-header">Suggested Stakeholders ${stakeholdersRefinedBadge}</div>
            <div class="suggestion-stakeholders">
              ${stakeholdersTagsHtml}
            </div>
          </div>

          <button class="accept-btn" onclick="acceptOutcomeSuggestions()" ${isLoading || !outcomeState.primaryOutcome ? 'disabled' : ''}>
            Accept Suggestions
          </button>
        </div>

        ${refineInputHtml}
      `;
  }

  // Phase 2: Editable Form (after acceptance)
  const primaryOutcomeError = showErrors && !outcomeState.primaryOutcome.trim();
  const metricsWarning = outcomeState.successMetrics.length === 0;

  // Render metrics list (editable)
  const metricsHtml = outcomeState.successMetrics.map((metric, index) => `
      <div class="metric-row" data-index="${index}">
        <input
          type="text"
          class="metric-input metric-name"
          placeholder="Metric name"
          value="${escapeHtml(metric.name)}"
          oninput="updateMetric(${index}, 'name', this.value)"
        >
        <input
          type="text"
          class="metric-input metric-target"
          placeholder="Target"
          value="${escapeHtml(metric.targetValue)}"
          oninput="updateMetric(${index}, 'targetValue', this.value)"
        >
        <input
          type="text"
          class="metric-input metric-unit"
          placeholder="Unit"
          value="${escapeHtml(metric.unit)}"
          oninput="updateMetric(${index}, 'unit', this.value)"
        >
        <button class="remove-metric-btn" onclick="removeMetric(${index})" title="Remove metric">✕</button>
      </div>
    `).join('');

  // Combine static stakeholders with AI-suggested custom stakeholders
  const allStakeholders = [...STAKEHOLDER_OPTIONS];
  const aiSuggestedStakeholders = outcomeState.customStakeholders.filter(
    (s) => !STAKEHOLDER_OPTIONS.includes(s)
  );

  // Render stakeholder checkboxes
  const stakeholderCheckboxesHtml = allStakeholders.map((stakeholder) => {
    const checked = outcomeState.stakeholders.includes(stakeholder) ? 'checked' : '';
    const stakeholderId = stakeholder.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    return `
        <label class="stakeholder-checkbox">
          <input type="checkbox" id="stakeholder-${stakeholderId}" value="${stakeholder}" ${checked} onchange="toggleStakeholder('${stakeholder}')">
          <span class="checkbox-label">${escapeHtml(stakeholder)}</span>
        </label>
      `;
  }).join('');

  // Render AI-suggested stakeholders with badge
  const aiStakeholderCheckboxesHtml = aiSuggestedStakeholders.map((stakeholder) => {
    const checked = outcomeState.stakeholders.includes(stakeholder) ? 'checked' : '';
    const stakeholderId = stakeholder.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    return `
        <label class="stakeholder-checkbox ai-suggested">
          <input type="checkbox" id="stakeholder-${stakeholderId}" value="${stakeholder}" ${checked} onchange="toggleStakeholder('${escapeHtml(stakeholder)}')">
          <span class="checkbox-label">${escapeHtml(stakeholder)}</span>
          <span class="ai-badge">AI suggested</span>
        </label>
      `;
  }).join('');

  return `
      <div class="step3-header">
        <p class="step-description">Define measurable business outcomes and success metrics for your workflow.</p>
        <button class="regenerate-btn" onclick="regenerateOutcomeSuggestions()" ${isLoading ? 'disabled' : ''}>
          ↻ Regenerate
        </button>
      </div>

      ${loadingHtml}

      <div class="accepted-banner">Accepted ✓</div>

      <div class="form-section">
        <label class="form-label required">Primary Outcome</label>
        <textarea
          class="${primaryOutcomeError ? 'error' : ''}"
          placeholder="Describe the measurable business result you want to achieve..."
          oninput="updatePrimaryOutcome(this.value)"
        >${escapeHtml(outcomeState.primaryOutcome)}</textarea>
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

      ${refineInputHtml}
    `;
}

/**
 * Get Step 4 HTML - Security & Guardrails
 */
export function getStep4Html(state: IdeationState): string {
  const securityState = state.securityGuardrails;
  const isLoading = securityState.isLoading;

  // Loading indicator
  let loadingHtml = '';
  if (isLoading) {
    loadingHtml = `
        <div class="guardrail-loading">
          <div class="typing-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
          <span class="loading-text">Generating guardrail suggestions...</span>
        </div>
      `;
  }

  // Data Sensitivity radio buttons
  const sensitivityOptionsHtml = DATA_SENSITIVITY_OPTIONS.map(opt => `
      <label class="sensitivity-radio-option">
        <input
          type="radio"
          name="dataSensitivity"
          value="${opt.value}"
          ${securityState.dataSensitivity === opt.value ? 'checked' : ''}
          onchange="updateDataSensitivity('${opt.value}')"
        >
        <div class="sensitivity-radio-content">
          <span class="sensitivity-label">${opt.label}</span>
          <span class="sensitivity-helper">${opt.helperText}</span>
        </div>
      </label>
    `).join('');

  // Compliance Frameworks checkboxes
  const complianceOptionsHtml = COMPLIANCE_FRAMEWORK_OPTIONS.map(framework => `
      <label class="system-option">
        <input
          type="checkbox"
          ${securityState.complianceFrameworks.includes(framework) ? 'checked' : ''}
          onchange="toggleComplianceFramework('${escapeHtml(framework)}')"
        >
        <span>${escapeHtml(framework)}</span>
      </label>
    `).join('');

  // Approval Gates checkboxes
  const approvalGatesHtml = APPROVAL_GATE_OPTIONS.map(gate => `
      <label class="system-option">
        <input
          type="checkbox"
          ${securityState.approvalGates.includes(gate) ? 'checked' : ''}
          onchange="toggleApprovalGate('${escapeHtml(gate)}')"
        >
        <span>${escapeHtml(gate)}</span>
      </label>
    `).join('');

  // AI suggested badge
  const aiSuggestedBadge = securityState.aiSuggested
    ? '<span class="ai-suggested-badge">✨ AI suggested</span>'
    : '';

  return `
      <div class="step-content">
        <h2>Security & Guardrails</h2>
        <p class="step-description">Configure security settings and compliance requirements for your demo. This step is optional.</p>

        ${loadingHtml}

        <div class="form-section">
          <label class="form-label">Data Sensitivity</label>
          <div class="sensitivity-radio-group">
            ${sensitivityOptionsHtml}
          </div>
        </div>

        <div class="form-section">
          <label class="form-label">Compliance Frameworks</label>
          <p class="field-description">Select applicable compliance frameworks based on your industry.</p>
          <div class="systems-grid">
            ${complianceOptionsHtml}
          </div>
        </div>

        <div class="form-section">
          <label class="form-label">Human Approval Gates</label>
          <p class="field-description">Select workflow stages that require human approval.</p>
          <div class="systems-grid">
            ${approvalGatesHtml}
          </div>
        </div>

        <div class="form-section">
          <label class="form-label">
            Guardrail Notes
            ${aiSuggestedBadge}
          </label>
          <p class="field-description">Additional security constraints for this demo.</p>
          <textarea
            class="guardrail-notes-input"
            rows="4"
            placeholder="Additional security constraints..."
            oninput="updateGuardrailNotes(this.value)"
            ${isLoading ? 'disabled' : ''}
          >${escapeHtml(securityState.guardrailNotes)}</textarea>
        </div>
      </div>
    `;
}

/**
 * Get navigation buttons HTML
 */
export function getNavigationButtonsHtml(state: IdeationState): string {
  const isFirstStep = state.currentStep === 1;
  const isLastStep = state.currentStep === 6;
  const isStep4 = state.currentStep === 4;

  // Skip button for Step 4 (optional step)
  const skipButton = isStep4
    ? '<button class="nav-btn skip-btn" onclick="skipSecurityStep()">Skip</button>'
    : '';

  return `
      <div class="nav-buttons">
        ${isFirstStep ? '<div></div>' : '<button class="nav-btn secondary" onclick="previousStep()">Back</button>'}
        <div class="nav-buttons-right">
          ${skipButton}
          ${isLastStep
            ? '<button class="nav-btn primary">Generate</button>'
            : '<button class="nav-btn primary" onclick="nextStep()">Next</button>'
          }
        </div>
      </div>
    `;
}

/**
 * Get Ideation content HTML (combines step indicator, content, and navigation)
 */
export function getIdeationContentHtml(state: IdeationState, validation: IdeationValidationState): string {
  return `
      ${getStepIndicatorHtml(state)}
      ${getStepContentHtml(state, validation)}
      ${getNavigationButtonsHtml(state)}
    `;
}
