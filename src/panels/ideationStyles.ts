/**
 * Ideation Wizard Styles
 * CSS styles for the ideation wizard panel
 */

import { getResumeBannerStyles } from './resumeBannerHtml';

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

      /* Task 5.2: Editable Agent Card Styles */
      .agent-card-editable {
        position: relative;
      }
      .agent-name-input {
        flex: 1;
        padding: 6px 8px;
        font-size: 13px;
        font-weight: 600;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
      }
      .agent-name-input:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }
      .agent-role-input {
        width: 100%;
        min-height: 60px;
        padding: 8px;
        font-size: 12px;
        font-family: var(--vscode-font-family);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        resize: vertical;
        margin-bottom: 8px;
      }
      .agent-role-input:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }
      .agent-tools-section {
        margin-bottom: 12px;
      }
      .agent-tools-section .form-label {
        font-size: 11px;
        margin-bottom: 4px;
      }
      .agent-tools-editable {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 6px;
      }
      .tool-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        font-size: 11px;
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        border-radius: 12px;
      }
      .remove-tool-btn {
        background: transparent;
        border: none;
        color: var(--vscode-badge-foreground);
        font-size: 10px;
        cursor: pointer;
        padding: 0 2px;
        opacity: 0.7;
      }
      .remove-tool-btn:hover {
        opacity: 1;
      }
      .tool-input-group {
        display: flex;
        gap: 4px;
      }
      .tool-input {
        flex: 1;
        padding: 4px 8px;
        font-size: 11px;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
      }
      .tool-input:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }
      .remove-agent-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        width: 100%;
        padding: 6px 8px;
        font-size: 11px;
        background: transparent;
        color: var(--vscode-errorForeground, #f48771);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .remove-agent-btn:hover {
        background: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.1));
        border-color: var(--vscode-errorForeground, #f48771);
      }
      .trash-icon {
        font-size: 12px;
      }

      /* Task 5.3: Add Agent Button */
      .add-agent-btn {
        display: block;
        width: 100%;
        padding: 10px 16px;
        font-size: 12px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: 1px dashed var(--vscode-input-border);
        border-radius: 4px;
        cursor: pointer;
        margin-top: 8px;
      }
      .add-agent-btn:hover {
        background: var(--vscode-button-secondaryHoverBackground);
        border-style: solid;
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
        flex-wrap: wrap;
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

      /* Task 5.4: Orchestration Dropdown */
      .orchestration-select {
        width: 100%;
        padding: 8px 12px;
        font-size: 13px;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        margin-bottom: 8px;
      }
      .orchestration-select:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
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

      /* Task 5.5: Edge Suggestion Card */
      .edge-suggestion-card {
        margin-bottom: 16px;
        padding: 12px;
        background: var(--vscode-inputValidation-infoBackground, rgba(0, 122, 204, 0.1));
        border: 1px solid var(--vscode-inputValidation-infoBorder, #007acc);
        border-radius: 6px;
      }
      .edge-suggestion-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        font-weight: 500;
        color: var(--vscode-foreground);
        margin-bottom: 8px;
      }
      .suggestion-icon {
        font-size: 14px;
      }
      .edge-suggestion-list {
        margin: 0 0 12px 0;
        padding-left: 20px;
        font-size: 12px;
        color: var(--vscode-foreground);
      }
      .edge-suggestion-list li {
        margin-bottom: 4px;
      }
      .edge-suggestion-actions {
        display: flex;
        gap: 8px;
      }
      .apply-suggestion-btn {
        padding: 6px 12px;
        font-size: 11px;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .apply-suggestion-btn:hover {
        background: var(--vscode-button-hoverBackground);
      }
      .dismiss-suggestion-btn {
        padding: 6px 12px;
        font-size: 11px;
        background: transparent;
        color: var(--vscode-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        cursor: pointer;
      }
      .dismiss-suggestion-btn:hover {
        background: var(--vscode-input-background);
      }

      /* Task 5.6: Edge Editing Table */
      .edge-editing-section {
        margin-bottom: 16px;
      }
      .edge-description {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        margin: 4px 0 12px 0;
        line-height: 1.4;
      }
      .header-hint {
        font-weight: 400;
        color: var(--vscode-descriptionForeground);
        opacity: 0.8;
      }
      .edge-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        margin-bottom: 8px;
      }
      .edge-table th {
        text-align: left;
        padding: 8px;
        font-weight: 500;
        color: var(--vscode-descriptionForeground);
        border-bottom: 1px solid var(--vscode-input-border);
      }
      .edge-row td {
        padding: 6px 8px;
        vertical-align: middle;
      }
      .edge-arrow {
        text-align: center;
        color: var(--vscode-descriptionForeground);
        font-size: 14px;
        padding: 0 4px !important;
        cursor: help;
      }
      .edge-select {
        width: 100%;
        padding: 6px 8px;
        font-size: 12px;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
      }
      .edge-select:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }
      .remove-edge-btn {
        background: transparent;
        border: none;
        color: var(--vscode-errorForeground, #f48771);
        font-size: 14px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
      }
      .remove-edge-btn:hover {
        background: var(--vscode-input-background);
      }
      .add-edge-btn {
        display: block;
        width: 100%;
        padding: 8px 16px;
        font-size: 12px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: 1px dashed var(--vscode-input-border);
        border-radius: 4px;
        cursor: pointer;
      }
      .add-edge-btn:hover {
        background: var(--vscode-button-secondaryHoverBackground);
        border-style: solid;
      }

      /* Task 5.7: Validation Warnings */
      .validation-warnings {
        margin-bottom: 16px;
        padding: 12px;
        background: var(--vscode-inputValidation-warningBackground, rgba(205, 145, 0, 0.1));
        border: 1px solid var(--vscode-inputValidation-warningBorder, #cca700);
        border-radius: 6px;
      }
      .validation-warnings-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        font-weight: 500;
        color: var(--vscode-inputValidation-warningForeground, #cca700);
        margin-bottom: 8px;
      }
      .warning-icon {
        font-size: 14px;
      }
      .validation-warnings-list {
        margin: 0;
        padding-left: 20px;
        font-size: 12px;
        color: var(--vscode-foreground);
      }
      .validation-warnings-list li {
        margin-bottom: 4px;
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

      /* Task 5.8: Secondary and Confirm Design Buttons */
      .secondary-btn {
        padding: 8px 16px;
        font-size: 12px;
        background: transparent;
        color: var(--vscode-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        cursor: pointer;
      }
      .secondary-btn:hover:not(:disabled) {
        background: var(--vscode-input-background);
      }
      .secondary-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .confirm-design-btn {
        padding: 8px 16px;
        font-size: 12px;
        font-weight: 500;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .confirm-design-btn:hover:not(:disabled) {
        background: var(--vscode-button-hoverBackground);
      }
      .confirm-design-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .primary-btn {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
      }
      .primary-btn:hover:not(:disabled) {
        background: var(--vscode-button-hoverBackground);
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

      /* Step 5: Adjustment Input Section */
      .adjustment-section {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--vscode-input-border);
      }
      .adjustment-input-group {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .adjustment-input {
        flex: 1;
        padding: 8px 12px;
        font-size: 13px;
        font-family: var(--vscode-font-family);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
      }
      .adjustment-input:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }
      .adjustment-input:disabled {
        opacity: 0.5;
      }
      .send-adjustment-btn {
        padding: 8px 16px;
        font-size: 13px;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        white-space: nowrap;
      }
      .send-adjustment-btn:hover:not(:disabled) {
        background: var(--vscode-button-hoverBackground);
      }
      .send-adjustment-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .adjustment-hints {
        margin-top: 6px;
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
      }

      /* Task Group 4: Resume Banner Styles */
      ${getResumeBannerStyles()}

      /* =========================================================================
       * Step 6: Mock Data Strategy Styles
       * ========================================================================= */

      .step6-header {
        margin-bottom: 20px;
      }
      .step6-header h2 {
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--vscode-foreground);
      }

      /* Mock Data Loading/Error States */
      .mock-data-loading {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        margin-bottom: 16px;
        background: var(--vscode-input-background);
        border-radius: 6px;
      }
      .mock-data-loading .loading-text {
        font-size: 13px;
        color: var(--vscode-descriptionForeground);
      }
      .mock-data-error {
        padding: 12px 16px;
        margin-bottom: 16px;
        background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
        border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
        border-radius: 6px;
      }
      .mock-data-error .error-text {
        font-size: 13px;
        color: var(--vscode-errorForeground, #f48771);
      }

      /* Mock Definitions Container */
      .mock-definitions-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 16px;
      }

      /* Mock Accordion Cards */
      .mock-accordion-card {
        background: var(--vscode-editorWidget-background);
        border: 1px solid var(--vscode-editorWidget-border);
        border-radius: 6px;
        overflow: hidden;
      }
      .mock-accordion-header {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 12px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .mock-accordion-header:hover {
        background: var(--vscode-list-hoverBackground);
      }
      .mock-accordion-header .codicon {
        flex-shrink: 0;
        font-size: 14px;
        color: var(--vscode-foreground);
        margin-top: 2px;
        transition: transform 0.2s ease;
      }
      .mock-accordion-card.expanded .mock-accordion-header .codicon {
        transform: rotate(90deg);
      }
      .accordion-header-content {
        flex: 1;
        min-width: 0;
      }
      .accordion-header-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }
      .mock-accordion-card .tool-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--vscode-foreground);
        font-family: var(--vscode-editor-font-family, monospace);
      }
      .mock-accordion-card .system-badge {
        font-size: 10px;
        padding: 2px 8px;
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        border-radius: 10px;
        white-space: nowrap;
      }
      .mock-accordion-card .tool-description {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        line-height: 1.4;
      }

      /* Mock Accordion Content */
      .mock-accordion-content {
        padding: 0 16px 16px 16px;
        border-top: 1px solid var(--vscode-editorWidget-border);
      }
      .mock-accordion-card:not(.expanded) .mock-accordion-content {
        display: none;
      }

      /* JSON Editor Sections */
      .json-section {
        margin-top: 16px;
      }
      .json-section .form-label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: var(--vscode-foreground);
        margin-bottom: 8px;
      }
      .json-editor {
        position: relative;
      }
      .json-textarea {
        width: 100%;
        min-height: 100px;
        padding: 12px;
        font-size: 12px;
        font-family: var(--vscode-editor-font-family, monospace);
        line-height: 1.5;
        background: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        resize: vertical;
      }
      .json-textarea:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }

      /* Sample Data Section */
      .sample-data-section {
        margin-top: 16px;
      }
      .sample-data-section .form-label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: var(--vscode-foreground);
        margin-bottom: 8px;
      }
      .no-schema-message {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        font-style: italic;
        padding: 12px;
        background: var(--vscode-input-background);
        border-radius: 4px;
      }

      /* Sample Data Table */
      .sample-data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        margin-bottom: 8px;
      }
      .sample-data-table th {
        text-align: left;
        padding: 8px 12px;
        font-weight: 500;
        color: var(--vscode-foreground);
        background: var(--vscode-editor-background);
        border-bottom: 1px solid var(--vscode-input-border);
      }
      .sample-data-table td {
        padding: 4px 8px;
        vertical-align: middle;
      }
      .sample-data-table tr:not(:last-child) td {
        border-bottom: 1px solid var(--vscode-input-border);
      }
      .sample-data-input {
        width: 100%;
        padding: 6px 8px;
        font-size: 12px;
        font-family: var(--vscode-font-family);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
      }
      .sample-data-input:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }
      .row-actions {
        text-align: center;
        width: 40px;
      }
      .delete-row-btn {
        background: transparent;
        border: none;
        color: var(--vscode-errorForeground, #f48771);
        font-size: 14px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        opacity: 0.7;
      }
      .delete-row-btn:hover {
        opacity: 1;
        background: var(--vscode-input-background);
      }
      .actions-col {
        width: 40px;
      }

      /* Sample Data Actions */
      .sample-data-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 8px;
      }
      .add-row-btn {
        padding: 6px 12px;
        font-size: 12px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .add-row-btn:hover:not(:disabled) {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      .add-row-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .max-rows-hint {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
      }

      /* Tool Import Section */
      .tool-import-section {
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px solid var(--vscode-input-border);
      }
      .import-btn {
        padding: 6px 12px;
        font-size: 12px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .import-btn:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      .import-summary {
        margin-top: 8px;
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        font-style: italic;
      }

      /* Mock Data Action Buttons */
      .mock-data-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 16px;
      }
      .mock-data-actions .regenerate-btn {
        padding: 8px 16px;
        font-size: 12px;
      }
      .terminology-toggle {
        padding: 8px 16px;
        font-size: 12px;
        background: transparent;
        color: var(--vscode-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        cursor: pointer;
      }
      .terminology-toggle:hover:not(:disabled) {
        background: var(--vscode-input-background);
      }
      .terminology-toggle.active {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-color: var(--vscode-button-background);
      }
      .terminology-toggle:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Step 6 Non-blocking Validation Warnings */
      .validation-warnings.non-blocking {
        margin-top: 16px;
        background: var(--vscode-inputValidation-warningBackground, rgba(205, 145, 0, 0.1));
        border: 1px solid var(--vscode-inputValidation-warningBorder, #cca700);
      }

      /* =========================================================================
       * Step 7: Demo Strategy Styles
       * ========================================================================= */

      .step7-header {
        margin-bottom: 20px;
      }
      .step7-header h2 {
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--vscode-foreground);
      }

      /* Generate All Button */
      .generate-all-section {
        margin-bottom: 24px;
      }
      .generate-all-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        font-size: 12px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        cursor: pointer;
      }
      .generate-all-btn:hover:not(:disabled) {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      .generate-all-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .sparkle-icon {
        font-size: 14px;
      }

      /* Demo Strategy Sections */
      .demo-strategy-section {
        margin-bottom: 24px;
        padding: 16px;
        background: var(--vscode-editorWidget-background);
        border: 1px solid var(--vscode-editorWidget-border);
        border-radius: 6px;
      }
      .demo-strategy-section h3 {
        margin: 0 0 4px 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--vscode-foreground);
      }
      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .section-header-left h3 {
        margin: 0;
      }
      .section-tip {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        margin-top: 4px;
      }
      .generate-section-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        font-size: 11px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        cursor: pointer;
      }
      .generate-section-btn:hover:not(:disabled) {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      .generate-section-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Empty State */
      .empty-state {
        padding: 16px;
        text-align: center;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        background: var(--vscode-input-background);
        border-radius: 4px;
        font-style: italic;
      }

      /* Aha Moments */
      .aha-moments-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .aha-moment-row {
        display: flex;
        gap: 12px;
        padding: 12px;
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-input-border);
        border-radius: 6px;
      }
      .moment-fields {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .moment-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .moment-field-wide {
        flex: 1;
      }
      .field-label {
        font-size: 11px;
        font-weight: 500;
        color: var(--vscode-descriptionForeground);
      }
      .moment-title-input,
      .moment-trigger-select {
        padding: 8px 10px;
        font-size: 13px;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
      }
      .moment-title-input:focus,
      .moment-trigger-select:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }
      .moment-talking-point {
        min-height: 60px;
        padding: 8px 10px;
        font-size: 13px;
        font-family: var(--vscode-font-family);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        resize: vertical;
      }
      .moment-talking-point:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }
      .remove-moment-btn {
        align-self: flex-start;
        padding: 6px 10px;
        background: transparent;
        border: 1px solid transparent;
        color: var(--vscode-errorForeground, #f48771);
        font-size: 14px;
        cursor: pointer;
        border-radius: 4px;
        transition: background 0.15s, border-color 0.15s;
      }
      .remove-moment-btn:hover {
        background: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.1));
        border-color: var(--vscode-errorForeground, #f48771);
      }
      .add-moment-btn {
        display: block;
        width: 100%;
        padding: 10px 16px;
        font-size: 12px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: 1px dashed var(--vscode-input-border);
        border-radius: 4px;
        cursor: pointer;
        margin-top: 8px;
      }
      .add-moment-btn:hover:not(:disabled) {
        background: var(--vscode-button-secondaryHoverBackground);
        border-style: solid;
      }
      .add-moment-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Demo Persona */
      .persona-fields {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .persona-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .persona-input {
        padding: 8px 10px;
        font-size: 13px;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
      }
      .persona-input:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }
      .persona-textarea {
        min-height: 60px;
        padding: 8px 10px;
        font-size: 13px;
        font-family: var(--vscode-font-family);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        resize: vertical;
      }
      .persona-textarea:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }

      /* Narrative Flow */
      .narrative-scenes-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .narrative-scene-card {
        padding: 12px;
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-input-border);
        border-radius: 6px;
      }
      .scene-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--vscode-input-border);
      }
      .scene-number {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border-radius: 50%;
        font-size: 12px;
        font-weight: 600;
      }
      .scene-actions {
        display: flex;
        gap: 4px;
      }
      .scene-arrow-btn {
        padding: 4px 8px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      .scene-arrow-btn:hover:not(:disabled) {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      .scene-arrow-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
      .remove-scene-btn {
        padding: 4px 10px;
        background: transparent;
        border: 1px solid transparent;
        color: var(--vscode-errorForeground, #f48771);
        font-size: 14px;
        cursor: pointer;
        border-radius: 4px;
        transition: background 0.15s, border-color 0.15s;
      }
      .remove-scene-btn:hover {
        background: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.1));
        border-color: var(--vscode-errorForeground, #f48771);
      }
      .scene-fields {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .scene-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .scene-title-input {
        padding: 8px 10px;
        font-size: 13px;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
      }
      .scene-title-input:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }
      .scene-description-input {
        min-height: 60px;
        padding: 8px 10px;
        font-size: 13px;
        font-family: var(--vscode-font-family);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        resize: vertical;
      }
      .scene-description-input:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }
      .char-counter {
        font-size: 10px;
        color: var(--vscode-descriptionForeground);
        text-align: right;
      }
      .char-counter.warning {
        color: var(--vscode-inputValidation-warningForeground, #cca700);
      }
      .agent-multi-select {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .agent-checkbox-label {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
      }
      .agent-checkbox-label:hover {
        border-color: var(--vscode-focusBorder);
      }
      .agent-checkbox-label input[type="checkbox"] {
        margin: 0;
        cursor: pointer;
      }
      .add-scene-btn {
        display: block;
        width: 100%;
        padding: 10px 16px;
        font-size: 12px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: 1px dashed var(--vscode-input-border);
        border-radius: 4px;
        cursor: pointer;
        margin-top: 8px;
      }
      .add-scene-btn:hover:not(:disabled) {
        background: var(--vscode-button-secondaryHoverBackground);
        border-style: solid;
      }
      .add-scene-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Loading States */
      .section-loading {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--vscode-input-background);
        border-radius: 4px;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }

      /* Demo Strategy Error */
      .demo-strategy-error {
        padding: 12px 16px;
        background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
        border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
        border-radius: 6px;
      }

      /* =========================================================================
       * Step 8: Generate - Pre-Generation Summary UI
       * Task Group 4: Summary Cards CSS Styles
       * ========================================================================= */

      .step8-header {
        margin-bottom: 20px;
      }
      .step8-header h2 {
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--vscode-foreground);
      }

      /* Summary Cards Grid */
      .summary-cards-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-bottom: 20px;
      }
      @media (max-width: 500px) {
        .summary-cards-grid {
          grid-template-columns: 1fr;
        }
      }

      /* Summary Card */
      .summary-card {
        padding: 12px;
        background: var(--vscode-editorWidget-background);
        border: 1px solid var(--vscode-editorWidget-border);
        border-radius: 6px;
        display: flex;
        flex-direction: column;
      }
      .summary-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--vscode-input-border);
      }
      .summary-card-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--vscode-foreground);
      }
      .summary-card-body {
        flex: 1;
        margin-bottom: 8px;
      }
      .summary-card-data-row {
        display: flex;
        gap: 8px;
        font-size: 12px;
        margin-bottom: 4px;
        line-height: 1.4;
      }
      .summary-card-data-key {
        color: var(--vscode-descriptionForeground);
        flex-shrink: 0;
      }
      .summary-card-data-value {
        color: var(--vscode-foreground);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .summary-card-footer {
        display: flex;
        justify-content: flex-end;
        padding-top: 8px;
        border-top: 1px solid var(--vscode-input-border);
      }
      .summary-card-edit-btn {
        padding: 4px 12px;
        font-size: 11px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .summary-card-edit-btn:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }

      /* Status Icons */
      .status-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }
      .status-icon.status-complete {
        color: var(--vscode-testing-iconPassed, #73c991);
      }
      .status-icon.status-warning {
        color: var(--vscode-inputValidation-warningForeground, #cca700);
      }
      .status-icon.status-error {
        color: var(--vscode-errorForeground, #f48771);
      }

      /* Validation Message */
      .validation-message {
        font-size: 11px;
        padding: 4px 8px;
        margin-bottom: 8px;
        border-radius: 4px;
        line-height: 1.4;
      }
      .validation-message.warning {
        background: var(--vscode-inputValidation-warningBackground, rgba(205, 145, 0, 0.1));
        color: var(--vscode-inputValidation-warningForeground, #cca700);
      }
      .validation-message.error {
        background: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.1));
        color: var(--vscode-errorForeground, #f48771);
      }

      /* =========================================================================
       * Step 8: Generate - Generation Progress UI
       * Task Group 5: Progress Checklist and Accordion CSS Styles
       * ========================================================================= */

      /* Progress Checklist */
      .progress-checklist {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 20px;
      }
      .progress-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-size: 13px;
        color: var(--vscode-foreground);
      }
      .progress-item.pending {
        color: var(--vscode-descriptionForeground);
      }
      .progress-item.active {
        color: var(--vscode-foreground);
      }
      .progress-item.complete {
        color: var(--vscode-testing-iconPassed, #73c991);
      }
      .progress-item.error {
        color: var(--vscode-errorForeground, #f48771);
      }
      .progress-icon {
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-top: 2px;
      }
      .progress-pending {
        font-size: 14px;
        color: var(--vscode-descriptionForeground);
      }
      .progress-label {
        flex: 1;
      }

      /* Progress Accordion */
      .progress-accordion {
        flex: 1;
      }
      .progress-accordion-header {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        padding: 4px 0;
      }
      .progress-accordion-header:hover {
        background: var(--vscode-list-hoverBackground);
        margin: -4px -8px;
        padding: 4px 8px;
        border-radius: 4px;
      }
      .progress-summary {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        margin-left: auto;
      }
      .accordion-chevron {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        transition: transform 0.2s ease;
      }
      .accordion-chevron.chevron-right::before {
        content: '>';
      }
      .accordion-chevron.chevron-down::before {
        content: 'v';
      }
      .progress-accordion.expanded .accordion-chevron.chevron-right {
        transform: rotate(90deg);
      }
      .progress-accordion-content {
        display: none;
        padding-left: 26px;
        margin-top: 8px;
      }
      .progress-accordion.expanded .progress-accordion-content {
        display: block;
      }

      /* File Progress List */
      .file-progress-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .file-progress-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        padding: 4px 8px;
        background: var(--vscode-input-background);
        border-radius: 4px;
      }
      .file-progress-item.pending {
        color: var(--vscode-descriptionForeground);
      }
      .file-progress-item.active {
        color: var(--vscode-foreground);
        background: var(--vscode-list-activeSelectionBackground, rgba(0, 122, 204, 0.1));
      }
      .file-progress-item.complete {
        color: var(--vscode-testing-iconPassed, #73c991);
      }
      .file-progress-item.error {
        color: var(--vscode-errorForeground, #f48771);
        background: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.1));
      }
      .file-progress-item.skipped {
        color: var(--vscode-descriptionForeground);
        opacity: 0.6;
      }
      .file-progress-icon {
        width: 14px;
        height: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .file-progress-name {
        flex: 1;
        font-family: var(--vscode-editor-font-family, monospace);
      }
      .file-status-pending {
        color: var(--vscode-descriptionForeground);
      }
      .file-status-skipped {
        color: var(--vscode-descriptionForeground);
      }
      .file-error-message {
        font-size: 11px;
        color: var(--vscode-errorForeground, #f48771);
        margin-left: auto;
      }

      /* Spinner Icon */
      .spinner-icon {
        width: 14px;
        height: 14px;
        border: 2px solid var(--vscode-descriptionForeground);
        border-top-color: var(--vscode-button-background);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      /* Preview Mode Indicator */
      .preview-mode-indicator {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        font-style: italic;
        text-align: center;
        margin-top: 8px;
        padding: 8px;
        background: var(--vscode-input-background);
        border-radius: 4px;
      }

      /* =========================================================================
       * Step 8: Generate - Post-Generation UI
       * Task Group 6: Button Handlers and Post-Generation CSS Styles
       * ========================================================================= */

      /* Step 8 Action Buttons */
      .step8-action-buttons {
        display: flex;
        gap: 12px;
        margin-top: 20px;
      }
      .generate-btn {
        padding: 10px 24px;
        font-size: 13px;
        font-weight: 500;
      }
      .generate-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .generate-kiro-btn {
        padding: 10px 20px;
        font-size: 13px;
      }

      /* Post-Generation Success */
      .post-generation-success {
        padding: 20px;
        background: var(--vscode-editorWidget-background);
        border: 1px solid var(--vscode-testing-iconPassed, #73c991);
        border-radius: 6px;
        text-align: center;
      }
      .success-message {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 500;
        color: var(--vscode-testing-iconPassed, #73c991);
        margin-bottom: 16px;
      }
      .file-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
        text-align: left;
      }
      .generated-file-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: var(--vscode-input-background);
        border-radius: 4px;
      }
      .generated-file-name {
        font-size: 12px;
        font-family: var(--vscode-editor-font-family, monospace);
        color: var(--vscode-foreground);
      }
      .open-file-link {
        font-size: 11px;
        color: var(--vscode-textLink-foreground, #3794ff);
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 4px 8px;
      }
      .open-file-link:hover {
        text-decoration: underline;
      }
      .kiro-hint {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 16px;
      }
      .start-over-button {
        padding: 10px 24px;
        font-size: 13px;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        cursor: pointer;
      }
      .start-over-button:hover {
        background: var(--vscode-button-secondaryHoverBackground);
      }
      .start-over-button.secondary {
        background: transparent;
      }

      /* Generation Error */
      .generation-error {
        padding: 16px;
        background: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.1));
        border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
        border-radius: 6px;
        margin-top: 16px;
      }
      .generation-error .error-message {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 500;
        color: var(--vscode-errorForeground, #f48771);
        margin-bottom: 8px;
      }
      .error-details {
        font-size: 12px;
        color: var(--vscode-foreground);
        margin-bottom: 12px;
        padding: 8px;
        background: var(--vscode-input-background);
        border-radius: 4px;
      }
      .error-actions {
        display: flex;
        gap: 8px;
      }
    `;
}
