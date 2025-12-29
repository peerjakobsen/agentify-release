/**
 * Ideation Wizard Styles
 * CSS styles for the ideation wizard panel
 */

/**
 * Get Ideation styles
 */
export function getIdeationStyles(): string {
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
      .nav-buttons-right {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .nav-btn.skip-btn {
        background: transparent;
        color: var(--vscode-descriptionForeground);
        border: 1px dashed var(--vscode-input-border);
      }
      .nav-btn.skip-btn:hover {
        background: var(--vscode-input-background);
        color: var(--vscode-foreground);
      }

      /* Step 4: Security & Guardrails Styles */
      .sensitivity-radio-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .sensitivity-radio-option {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid var(--vscode-input-border);
        border-radius: 6px;
        cursor: pointer;
        transition: border-color 0.15s ease;
      }
      .sensitivity-radio-option:hover {
        border-color: var(--vscode-focusBorder);
      }
      .sensitivity-radio-option input[type="radio"] {
        margin-top: 2px;
        accent-color: var(--vscode-button-background);
      }
      .sensitivity-radio-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .sensitivity-label {
        font-weight: 500;
        color: var(--vscode-foreground);
      }
      .sensitivity-helper {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }
      .ai-suggested-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        background: var(--vscode-badge-background);
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: 8px;
        font-weight: normal;
      }
      .guardrail-notes-input {
        width: 100%;
        padding: 10px 12px;
        font-size: 13px;
        font-family: var(--vscode-font-family);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        resize: vertical;
        min-height: 80px;
      }
      .guardrail-notes-input:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }
      .guardrail-notes-input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .guardrail-loading {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--vscode-input-background);
        border-radius: 6px;
        margin-bottom: 16px;
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

      /* Phase 1: Suggestion Card Styles */
      .suggestion-card {
        background: var(--vscode-editorWidget-background);
        border: 1px solid var(--vscode-widget-border, var(--vscode-editorWidget-border, #454545));
        border-radius: 4px;
        padding: 16px;
        margin-bottom: 16px;
      }
      .suggestion-section {
        margin-bottom: 16px;
      }
      .suggestion-section:last-of-type {
        margin-bottom: 12px;
      }
      .suggestion-header {
        font-size: 12px;
        font-weight: 600;
        color: var(--vscode-foreground);
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .suggestion-content {
        font-size: 13px;
        color: var(--vscode-foreground);
        line-height: 1.5;
      }
      .suggestion-kpis {
        margin: 0;
        padding-left: 20px;
        font-size: 12px;
        color: var(--vscode-foreground);
      }
      .suggestion-kpis li {
        margin-bottom: 4px;
      }
      .suggestion-stakeholders {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .stakeholder-tag {
        display: inline-block;
        padding: 4px 10px;
        font-size: 11px;
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        border-radius: 12px;
      }
      .refined-badge {
        font-size: 10px;
        font-weight: 400;
        color: var(--vscode-descriptionForeground);
        font-style: italic;
      }
      .empty-hint {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        font-style: italic;
      }
      .suggestion-card .accept-btn {
        width: 100%;
        margin-top: 4px;
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 500;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .suggestion-card .accept-btn:hover:not(:disabled) {
        background: var(--vscode-button-hoverBackground);
      }
      .suggestion-card .accept-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Phase 2: Accepted Banner */
      .accepted-banner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 10px 16px;
        margin-bottom: 16px;
        font-size: 13px;
        font-weight: 500;
        color: var(--vscode-testing-iconPassed, #73c991);
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-testing-iconPassed, #73c991);
        border-radius: 4px;
      }

      /* Refine Input Hints */
      .refine-hints {
        margin: 8px 0 0 0;
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
      }

      /* Step 5: Agent Design Styles */
      .step5-header {
        margin-bottom: 16px;
      }
      .step5-header h2 {
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--vscode-foreground);
      }
      .agent-design-loading {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        margin-bottom: 16px;
        background: var(--vscode-input-background);
        border-radius: 4px;
      }
      .agent-design-loading .loading-text {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }
      .agent-design-error {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        margin-bottom: 16px;
        background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
        border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
        border-radius: 4px;
      }

      /* Agent Card Grid */
      .agent-cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }
      .agent-card {
        padding: 12px;
        background: var(--vscode-editorWidget-background);
        border: 1px solid var(--vscode-editorWidget-border);
        border-radius: 6px;
      }
      .agent-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .agent-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--vscode-foreground);
      }
      .agent-id-badge {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
        background: var(--vscode-input-background);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: var(--vscode-editor-font-family, monospace);
      }
      .agent-role {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        margin: 0 0 8px 0;
        line-height: 1.4;
      }
      .agent-tools {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      /* Orchestration Section */
      .orchestration-section {
        margin-bottom: 16px;
        padding: 12px;
        background: var(--vscode-editorWidget-background);
        border: 1px solid var(--vscode-editorWidget-border);
        border-radius: 6px;
      }
      .orchestration-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .orchestration-label {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }
      .orchestration-badge {
        display: inline-block;
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 500;
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        border-radius: 12px;
      }
      .orchestration-reasoning {
        position: relative;
      }
      .expand-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        background: transparent;
        border: none;
        color: var(--vscode-textLink-foreground, #3794ff);
        font-size: 12px;
        cursor: pointer;
        padding: 0;
      }
      .expand-toggle:hover {
        text-decoration: underline;
      }
      .expand-toggle .chevron {
        font-size: 10px;
        transition: transform 0.2s ease;
      }
      .orchestration-reasoning.expanded .chevron {
        transform: rotate(90deg);
      }
      .reasoning-content {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.2s ease-out;
      }
      .orchestration-reasoning.expanded .reasoning-content {
        max-height: 200px;
      }
      .reasoning-content p {
        margin: 8px 0 0 0;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        line-height: 1.5;
        padding-left: 16px;
      }

      /* Flow Summary */
      .flow-summary-section {
        margin-bottom: 16px;
      }
      .flow-summary {
        padding: 10px 12px;
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
      }
      .flow-summary code {
        font-family: var(--vscode-editor-font-family, monospace);
        font-size: 12px;
        color: var(--vscode-foreground);
        white-space: nowrap;
        overflow-x: auto;
        display: block;
      }

      /* Agent Design Action Buttons */
      .agent-design-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 16px;
      }
      .agent-design-actions .regenerate-btn {
        padding: 8px 16px;
        font-size: 12px;
      }
      .agent-design-actions .accept-btn {
        padding: 8px 16px;
        font-size: 12px;
        margin-top: 0;
      }
      .adjust-btn {
        padding: 8px 16px;
        font-size: 12px;
        background: transparent;
        color: var(--vscode-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        cursor: pointer;
      }
      .adjust-btn:hover:not(:disabled) {
        background: var(--vscode-input-background);
      }
      .adjust-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
}
