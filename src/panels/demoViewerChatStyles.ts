/**
 * Demo Viewer Chat UI Styles
 * CSS styles for the chat-style conversation interface
 *
 * Reuses and adapts patterns from ideationStyles.ts for
 * message bubbles, streaming indicators, and chat container.
 */

/**
 * Get Demo Viewer Chat UI styles
 * Returns complete CSS string for the chat interface
 */
export function getDemoViewerChatStyles(): string {
  return `
    /* =========================================================================
     * Session Info Bar Styles
     * Top bar showing workflow_id, turn count, elapsed time, workflow status
     * ========================================================================= */

    .session-info-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-editorWidget-border);
      border-radius: 4px;
      margin-bottom: 8px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .session-info-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .session-info-label {
      color: var(--vscode-descriptionForeground);
      opacity: 0.8;
    }

    .session-info-value {
      color: var(--vscode-foreground);
      font-family: var(--vscode-editor-font-family, monospace);
      font-weight: 500;
    }

    .session-info-divider {
      width: 1px;
      height: 16px;
      background: var(--vscode-editorWidget-border);
      margin: 0 8px;
    }

    /* =========================================================================
     * Workflow Status Badge Styles
     * Status indicator in session info bar with state variants
     * ========================================================================= */

    .workflow-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 3px;
    }

    /* Running state - spinner animation */
    .workflow-status-badge.running {
      color: var(--vscode-foreground);
    }

    .workflow-status-badge.running .status-spinner {
      width: 10px;
      height: 10px;
      border: 2px solid var(--vscode-descriptionForeground);
      border-top-color: var(--vscode-button-background);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    /* Partial state - hourglass icon, amber/yellow tint */
    .workflow-status-badge.partial {
      color: var(--vscode-editorWarning-foreground, #cca700);
      background: rgba(204, 167, 0, 0.1);
    }

    .workflow-status-badge.partial .status-icon {
      font-size: 12px;
    }

    /* Complete state - checkmark icon, green */
    .workflow-status-badge.complete {
      color: var(--vscode-testing-iconPassed, #73c991);
      background: rgba(115, 201, 145, 0.1);
    }

    .workflow-status-badge.complete .status-icon {
      font-size: 12px;
    }

    /* Error state - X mark icon, red */
    .workflow-status-badge.error {
      color: var(--vscode-errorForeground, #f48771);
      background: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.1));
    }

    .workflow-status-badge.error .status-icon {
      font-size: 12px;
    }

    /* =========================================================================
     * Partial Execution Indicator Styles
     * "Awaiting your response..." indicator below entry agent message
     * ========================================================================= */

    .partial-execution-indicator {
      text-align: left;
      font-size: 11px;
      font-style: italic;
      color: var(--vscode-descriptionForeground);
      padding: 8px 4px;
      opacity: 0.9;
    }

    /* Animated ellipsis effect */
    .ellipsis-animation {
      display: inline-block;
    }

    .ellipsis-animation::after {
      content: '';
      animation: ellipsis 1.5s infinite;
    }

    @keyframes ellipsis {
      0% { content: ''; }
      25% { content: '.'; }
      50% { content: '..'; }
      75% { content: '...'; }
      100% { content: ''; }
    }

    /* =========================================================================
     * Agent Status Bar Styles
     * Pipeline progress display with arrows and checkmarks
     * ========================================================================= */

    .agent-status-bar {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      margin-bottom: 12px;
      font-size: 12px;
      flex-wrap: wrap;
      gap: 4px;
    }

    .pipeline-stage {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .pipeline-stage-name {
      color: var(--vscode-descriptionForeground);
    }

    .pipeline-stage.active .pipeline-stage-name {
      color: var(--vscode-foreground);
      font-weight: 500;
    }

    .pipeline-stage.completed .pipeline-stage-name {
      color: var(--vscode-testing-iconPassed, #73c991);
    }

    .pipeline-checkmark {
      color: var(--vscode-testing-iconPassed, #73c991);
      font-size: 12px;
    }

    .pipeline-pending {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      opacity: 0.7;
    }

    .pipeline-arrow {
      color: var(--vscode-descriptionForeground);
      margin: 0 4px;
      opacity: 0.5;
    }

    .pipeline-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid var(--vscode-descriptionForeground);
      border-top-color: var(--vscode-button-background);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    /* =========================================================================
     * Chat Container Styles
     * Scrollable chat area - reuses patterns from ideationStyles.ts (lines 363-371)
     * ========================================================================= */

    .chat-container {
      min-height: 200px;
      max-height: 400px;
      overflow-y: auto;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      margin-bottom: 12px;
    }

    /* Chat messages wrapper - reuses from ideationStyles.ts (lines 372-377) */
    .chat-messages {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 12px;
    }

    /* =========================================================================
     * Dual-Pane Container Styles
     * Side-by-side layout for Conversation and Agent Collaboration panes
     * ========================================================================= */

    .dual-pane-container {
      display: flex;
      min-height: 200px;
      max-height: 400px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      margin-bottom: 12px;
    }

    /* Left pane: User-facing conversation */
    .pane-left {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    /* Right pane: Agent collaboration */
    .pane-right {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      border-left: 1px solid var(--vscode-panel-border);
    }

    /* =========================================================================
     * Pane Header Styles
     * Label text for each pane ("Conversation", "Agent Collaboration")
     * ========================================================================= */

    .pane-header {
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-editorWidget-background);
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    /* =========================================================================
     * Pane Messages Styles
     * Independent scroll container for each pane
     * ========================================================================= */

    .pane-messages {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 12px;
      overflow-y: auto;
      max-height: 350px;
      flex: 1;
    }

    /* =========================================================================
     * Collaboration Pane Empty State Styles
     * "No agent collaboration" message when right pane is empty
     * ========================================================================= */

    .collaboration-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
      flex: 1;
    }

    .collaboration-empty-icon {
      font-size: 24px;
      margin-bottom: 8px;
      opacity: 0.5;
    }

    /* =========================================================================
     * Message Bubble Styles
     * User and agent message styling - reuses from ideationStyles.ts
     * ========================================================================= */

    .chat-message {
      display: flex;
      gap: 8px;
      max-width: 90%;
    }

    /* Agent message - left aligned, gray background (lines 412-415) */
    .chat-message.agent-message {
      align-self: flex-start;
      flex-direction: column;
    }

    /* User message - right aligned, blue background (lines 416-420) */
    .chat-message.user-message {
      align-self: flex-end;
      flex-direction: column;
      align-items: flex-end;
    }

    /* Sender message - right aligned, blue background (for handoff prompts in collaboration pane) */
    .chat-message.sender-message {
      align-self: flex-end;
      flex-direction: column;
      align-items: flex-end;
    }

    /* Agent name label above bubble */
    .agent-name-label {
      font-size: 11px;
      font-weight: 500;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
      padding-left: 4px;
    }

    /* Sender name label - right aligned */
    .sender-message .agent-name-label {
      padding-left: 0;
      padding-right: 4px;
    }

    /* Message content container */
    .message-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    /* Message text bubble - reuses from ideationStyles.ts (lines 404-410) */
    .message-text {
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    /* Agent message bubble styling */
    .agent-message .message-text {
      background: var(--vscode-input-background);
      border-bottom-left-radius: 4px;
      color: var(--vscode-foreground);
    }

    /* User message bubble styling */
    .user-message .message-text {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-bottom-right-radius: 4px;
    }

    /* Sender message bubble styling (blue like user messages) */
    .sender-message .message-text {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-bottom-right-radius: 4px;
    }

    /* =========================================================================
     * Streaming Text Styles
     * Reuses from ideationStyles.ts (lines 421-427)
     * ========================================================================= */

    .streaming-text:empty {
      display: none;
    }

    .streaming-text {
      padding: 10px 14px;
      border-radius: 12px;
      border-bottom-left-radius: 4px;
      background: var(--vscode-input-background);
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
      color: var(--vscode-foreground);
    }

    /* Streaming cursor indicator */
    .streaming-cursor {
      display: inline-block;
      width: 2px;
      height: 14px;
      background: var(--vscode-foreground);
      margin-left: 2px;
      animation: blink 1s infinite;
    }

    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }

    /* =========================================================================
     * Typing Indicator Styles
     * Reuses from ideationStyles.ts (lines 428-449)
     * ========================================================================= */

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

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* =========================================================================
     * Chat Input Area Styles
     * Input textarea + Send button + New Conversation button
     * ========================================================================= */

    .chat-input-area {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
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
      resize: none;
      min-height: 40px;
      max-height: 100px;
    }

    .chat-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }

    .chat-input:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .chat-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }

    /* Send button - inline with input */
    .send-btn {
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 500;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      white-space: nowrap;
    }

    .send-btn:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* New Conversation button - below input row */
    .new-conversation-btn {
      width: 100%;
      padding: 8px 16px;
      font-size: 12px;
      background: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 12px;
    }

    .new-conversation-btn:hover:not(:disabled) {
      background: var(--vscode-input-background);
    }

    .new-conversation-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* =========================================================================
     * Error Message Styles
     * ========================================================================= */

    .chat-error-message {
      padding: 10px 14px;
      background: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.1));
      border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
      border-radius: 4px;
      color: var(--vscode-errorForeground, #f48771);
      font-size: 12px;
      margin-bottom: 12px;
    }

    /* =========================================================================
     * Empty State Styles
     * ========================================================================= */

    .chat-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }

    .chat-empty-icon {
      font-size: 32px;
      margin-bottom: 12px;
      opacity: 0.5;
    }

    .chat-empty-text {
      font-size: 13px;
    }

    /* =========================================================================
     * Tool Chip Styles
     * Tool call visualization chips below agent messages
     * ========================================================================= */

    /* Tool chips container - wraps below message content */
    .tool-chips-container {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 8px;
    }

    /* Base tool chip styling */
    .tool-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .tool-chip:hover {
      opacity: 0.9;
    }

    /* Running state - muted background with spinner */
    .tool-chip.running {
      background: var(--vscode-input-background);
      color: var(--vscode-descriptionForeground);
    }

    /* Completed state - green tint */
    .tool-chip.completed {
      background: rgba(115, 201, 145, 0.1);
      color: var(--vscode-testing-iconPassed, #73c991);
    }

    /* Failed state - red background with border */
    .tool-chip.failed {
      background: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.1));
      border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
      color: var(--vscode-errorForeground, #f48771);
    }

    /* Tool chip spinner - CSS-based animation (not codicon) */
    .tool-chip-spinner {
      width: 10px;
      height: 10px;
      border: 2px solid var(--vscode-descriptionForeground);
      border-top-color: var(--vscode-button-background);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    /* Tool chip status icons (Unicode-based) */
    .tool-chip-icon {
      font-size: 10px;
    }

    /* =========================================================================
     * Tool Chip Expanded Details Styles
     * Inline expansion with input/output/error details
     * ========================================================================= */

    /* Expanded details container */
    .tool-chip-details {
      margin-top: 8px;
      padding: 8px;
      background: var(--vscode-input-background);
      border-radius: 4px;
      border: 1px solid var(--vscode-input-border);
    }

    /* Details section wrapper */
    .tool-chip-details-section {
      margin-bottom: 8px;
    }

    .tool-chip-details-section:last-child {
      margin-bottom: 0;
    }

    /* Section label styling */
    .tool-chip-details-label {
      font-weight: 500;
      font-size: 10px;
      text-transform: uppercase;
      margin-bottom: 4px;
      color: var(--vscode-descriptionForeground);
      letter-spacing: 0.5px;
    }

    /* JSON content formatting */
    .tool-chip-json {
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-all;
      background: var(--vscode-editor-background);
      padding: 6px;
      border-radius: 3px;
      color: var(--vscode-foreground);
    }

    /* Error text styling */
    .tool-chip-error-text {
      color: var(--vscode-errorForeground, #f48771);
      font-size: 11px;
    }

    /* Show more link for truncated output */
    .tool-chip-show-more {
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      font-size: 11px;
      margin-top: 4px;
      display: inline-block;
    }

    .tool-chip-show-more:hover {
      text-decoration: underline;
    }

    /* Duration display in details */
    .tool-chip-duration {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
  `;
}
