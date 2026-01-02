/**
 * Chat Panel JavaScript Generator
 * Generates webview JavaScript for the Demo Viewer chat UI
 *
 * Handles:
 * - Send button click handler
 * - New Conversation button click handler
 * - Auto-scroll on new messages
 * - Timer update handler
 * - Tool chip expansion toggle
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
    // Scrolls chat pane containers to bottom when new messages arrive
    // Handles both dual-pane layout (.pane-messages) and legacy (#chat-container)
    // =========================================================================

    function scrollChatToBottom() {
      // Dual-pane layout: scroll both pane message containers
      const paneContainers = document.querySelectorAll('.pane-messages');
      if (paneContainers.length > 0) {
        paneContainers.forEach(container => {
          container.scrollTop = container.scrollHeight;
        });
        return;
      }

      // Legacy fallback: single chat container
      const chatContainer = document.getElementById('chat-container');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }

    // Scroll specific pane to bottom (for streaming to correct pane)
    function scrollPaneToBottom(pane) {
      const selector = pane === 'conversation' ? '.pane-left .pane-messages' : '.pane-right .pane-messages';
      const container = document.querySelector(selector);
      if (container) {
        container.scrollTop = container.scrollHeight;
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

    function handleStreamingToken(content, pane) {
      const streamingText = document.querySelector('.streaming .streaming-text');
      const typingIndicator = document.querySelector('.streaming .typing-indicator');

      if (streamingText) {
        // Update content with cursor
        streamingText.innerHTML = escapeHtmlForDisplay(content) + '<span class="streaming-cursor"></span>';

        // Hide typing indicator once we have content
        if (typingIndicator && content) {
          typingIndicator.style.display = 'none';
        }

        // Auto-scroll the pane containing the streaming message
        if (pane) {
          scrollPaneToBottom(pane);
        } else {
          scrollChatToBottom();
        }
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
    // Tool Chip Expansion Toggle Handler
    // Toggles inline expansion of tool chip details (input/output/error)
    // =========================================================================

    // Store expanded tool IDs for toggle state
    const expandedToolChips = new Set();

    function handleToolChipClick(event) {
      const chip = event.target.closest('.tool-chip');
      if (!chip) return;

      const toolId = chip.getAttribute('data-tool-id');
      if (!toolId) return;

      // Find the message content container that contains this chip
      const messageContent = chip.closest('.message-content');
      if (!messageContent) return;

      // Check if details already exist
      let existingDetails = messageContent.querySelector('.tool-chip-details[data-tool-id="' + toolId + '"]');

      if (existingDetails) {
        // Collapse: remove the details element
        existingDetails.remove();
        chip.classList.remove('expanded');
        expandedToolChips.delete(toolId);
      } else {
        // Expand: request details from extension
        vscode.postMessage({
          command: 'expandToolChip',
          toolId: toolId
        });
        chip.classList.add('expanded');
        expandedToolChips.add(toolId);
      }
    }

    // Handle tool chip details response from extension
    function handleToolChipDetails(toolId, detailsHtml) {
      // Find the chip with this tool ID
      const chip = document.querySelector('.tool-chip[data-tool-id="' + toolId + '"]');
      if (!chip) return;

      // Find the message content container
      const messageContent = chip.closest('.message-content');
      if (!messageContent) return;

      // Check if details already exist (prevent duplicates)
      if (messageContent.querySelector('.tool-chip-details[data-tool-id="' + toolId + '"]')) {
        return;
      }

      // Create and insert details element
      const detailsContainer = document.createElement('div');
      detailsContainer.innerHTML = detailsHtml;
      const details = detailsContainer.firstElementChild;
      if (details) {
        details.setAttribute('data-tool-id', toolId);
        // Insert after the tool chips container
        const chipsContainer = messageContent.querySelector('.tool-chips-container');
        if (chipsContainer && chipsContainer.nextSibling) {
          messageContent.insertBefore(details, chipsContainer.nextSibling);
        } else {
          messageContent.appendChild(details);
        }
      }
    }

    // Attach click handler to tool chips using event delegation
    document.addEventListener('click', function(event) {
      if (event.target.closest('.tool-chip')) {
        handleToolChipClick(event);
      }
    });

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
          handleStreamingToken(message.content, message.pane);
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

        case 'toolChipDetails':
          // Handle tool chip expansion details
          if (message.toolId && message.detailsHtml) {
            handleToolChipDetails(message.toolId, message.detailsHtml);
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
      scrollPaneToBottom,
      handleTimerUpdate,
      handleStreamingToken,
      handleChatMessage,
      focusChatInput,
      handleToolChipClick,
      handleToolChipDetails
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

    // Auto-scroll chat containers (dual-pane or legacy)
    function scrollChatToBottom() {
      const paneContainers = document.querySelectorAll('.pane-messages');
      if (paneContainers.length > 0) {
        paneContainers.forEach(c => c.scrollTop = c.scrollHeight);
        return;
      }
      const container = document.getElementById('chat-container');
      if (container) container.scrollTop = container.scrollHeight;
    }
    scrollChatToBottom();

    // Tool chip click handler
    document.addEventListener('click', function(e) {
      const chip = e.target.closest('.tool-chip');
      if (!chip) return;
      const toolId = chip.getAttribute('data-tool-id');
      if (toolId) {
        vscode.postMessage({ command: 'expandToolChip', toolId: toolId });
      }
    });
  `;
}
