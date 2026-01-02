/**
 * Chat Panel JavaScript Generator
 * Generates webview JavaScript for the Demo Viewer chat UI
 *
 * Handles:
 * - Send button click handler
 * - New Conversation button click handler
 * - Auto-scroll on new messages
 * - Timer update handler
 * - NO Enter key handler (button-only submission for demo safety)
 */

/**
 * Generates the webview JavaScript for the chat panel
 * Includes event handlers and state sync logic
 *
 * @returns JavaScript code string for webview
 */
export function generateChatPanelJs(): string {
  return `
    // =========================================================================
    // Chat Panel JavaScript
    // Demo Viewer chat UI event handlers and state management
    // =========================================================================

    // Store reference to VS Code API (already acquired in parent scope)
    // const vscode = acquireVsCodeApi(); // Acquired in parent scope

    // =========================================================================
    // Send Button Click Handler
    // Posts sendMessage command with input content
    // =========================================================================

    function handleSendClick() {
      const inputElement = document.getElementById('chat-input');
      if (!inputElement) return;

      const content = inputElement.value.trim();
      if (!content) return;

      // Post message to extension
      vscode.postMessage({
        command: 'sendMessage',
        content: content
      });

      // Clear input after sending
      inputElement.value = '';
    }

    // Attach send button handler
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
      sendBtn.addEventListener('click', handleSendClick);
    }

    // =========================================================================
    // New Conversation Button Click Handler
    // Posts newConversation command to reset state
    // =========================================================================

    function handleNewConversation() {
      vscode.postMessage({
        command: 'newConversation'
      });
    }

    // Attach new conversation button handler
    const newConversationBtn = document.getElementById('new-conversation-btn');
    if (newConversationBtn) {
      newConversationBtn.addEventListener('click', handleNewConversation);
    }

    // =========================================================================
    // Auto-scroll to Bottom
    // Scrolls chat container to bottom when new messages arrive
    // =========================================================================

    function scrollChatToBottom() {
      const chatContainer = document.getElementById('chat-container');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }

    // Initial scroll to bottom
    scrollChatToBottom();

    // =========================================================================
    // Timer Update Handler
    // Updates elapsed time display when receiving updateTimer command
    // =========================================================================

    function handleTimerUpdate(elapsed) {
      const elapsedElement = document.getElementById('elapsed-time');
      if (elapsedElement) {
        elapsedElement.textContent = elapsed;
      }
    }

    // =========================================================================
    // Streaming Token Handler
    // Updates streaming message content in real-time
    // =========================================================================

    function handleStreamingToken(content) {
      const streamingText = document.querySelector('.streaming .streaming-text');
      const typingIndicator = document.querySelector('.streaming .typing-indicator');

      if (streamingText) {
        // Update content with cursor
        streamingText.innerHTML = escapeHtmlForDisplay(content) + '<span class="streaming-cursor"></span>';

        // Hide typing indicator once we have content
        if (typingIndicator && content) {
          typingIndicator.style.display = 'none';
        }

        // Auto-scroll to bottom
        scrollChatToBottom();
      }
    }

    // =========================================================================
    // HTML Escape for Display
    // Escapes HTML to prevent XSS when displaying streaming content
    // =========================================================================

    function escapeHtmlForDisplay(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // =========================================================================
    // Message Handler
    // Handles messages from extension
    // =========================================================================

    function handleChatMessage(event) {
      const message = event.data;

      switch (message.type) {
        case 'updateTimer':
          handleTimerUpdate(message.elapsed);
          break;

        case 'streamingToken':
          handleStreamingToken(message.content);
          break;

        case 'scrollToBottom':
          scrollChatToBottom();
          break;

        case 'chatStateSync':
          // Full state sync - will trigger re-render from extension
          // Handle any UI-only updates here
          if (message.scrollToBottom) {
            scrollChatToBottom();
          }
          break;
      }
    }

    // Note: Main message listener is in parent scope, this adds chat-specific handling
    // Add to the existing message event listener if not already present

    // =========================================================================
    // NO Enter Key Handler
    // Button-only submission for demo safety - prevents accidental triggers
    // This is intentionally different from Step 2 which allows Enter to submit
    // =========================================================================

    // The chat input explicitly does NOT have an Enter key handler
    // Users must click the Send button to submit prompts
    // This is a safety feature for demo presentations

    // =========================================================================
    // Input Focus Management
    // =========================================================================

    function focusChatInput() {
      const inputElement = document.getElementById('chat-input');
      if (inputElement) {
        inputElement.focus();
      }
    }

    // =========================================================================
    // Expose functions to global scope for webview access
    // =========================================================================

    window.chatPanelHandlers = {
      handleSendClick,
      handleNewConversation,
      scrollChatToBottom,
      handleTimerUpdate,
      handleStreamingToken,
      handleChatMessage,
      focusChatInput
    };
  `;
}

/**
 * Generates minimal inline JavaScript for button handlers
 * Used when full JS generator is not needed
 *
 * @returns Minimal inline JavaScript string
 */
export function generateChatPanelInlineJs(): string {
  return `
    function sendChatMessage() {
      const input = document.getElementById('chat-input');
      if (input && input.value.trim()) {
        vscode.postMessage({ command: 'sendMessage', content: input.value.trim() });
        input.value = '';
      }
    }

    function newConversation() {
      vscode.postMessage({ command: 'newConversation' });
    }

    // Auto-scroll chat container
    function scrollChatToBottom() {
      const container = document.getElementById('chat-container');
      if (container) container.scrollTop = container.scrollHeight;
    }
    scrollChatToBottom();
  `;
}
