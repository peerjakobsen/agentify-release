/**
 * Chat Panel HTML Generator
 * HTML generation functions for the Demo Viewer chat UI
 *
 * Generates HTML for session info bar, agent status bar,
 * message bubbles, typing indicators, and input area.
 */

import { formatTime } from './timerFormatter';
import type {
  ChatMessage,
  ChatSessionState,
  AgentPipelineStage,
  ChatPanelState,
  MessagePane,
} from '../types/chatPanel';

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => escapeMap[char] || char);
}

/**
 * Generates the session info bar HTML
 * Displays workflow_id, turn count, and elapsed time
 *
 * @param workflowId - Workflow identifier (short format)
 * @param turnCount - Number of conversation turns
 * @param elapsedTime - Elapsed time formatted string
 * @returns HTML string for session info bar
 */
export function generateSessionInfoBarHtml(
  workflowId: string,
  turnCount: number,
  elapsedTime: string
): string {
  return `
    <div class="session-info-bar">
      <div class="session-info-item">
        <span class="session-info-label">Session:</span>
        <span class="session-info-value">${escapeHtml(workflowId)}</span>
      </div>
      <div class="session-info-divider"></div>
      <div class="session-info-item">
        <span class="session-info-label">Turn:</span>
        <span class="session-info-value">${turnCount}</span>
      </div>
      <div class="session-info-divider"></div>
      <div class="session-info-item">
        <span class="session-info-label">Elapsed:</span>
        <span class="session-info-value" id="elapsed-time">${escapeHtml(elapsedTime)}</span>
      </div>
    </div>
  `;
}

/**
 * Generates the agent status bar HTML
 * Displays pipeline progress with checkmarks and pending indicators
 *
 * @param pipelineStages - Array of agent pipeline stages
 * @returns HTML string for agent status bar
 */
export function generateAgentStatusBarHtml(pipelineStages: AgentPipelineStage[]): string {
  if (pipelineStages.length === 0) {
    return `
      <div class="agent-status-bar">
        <span class="pipeline-stage-name" style="opacity: 0.5;">Waiting for workflow...</span>
      </div>
    `;
  }

  const stagesHtml = pipelineStages
    .map((stage, index) => {
      let statusIndicator = '';
      let stageClass = 'pipeline-stage';

      switch (stage.status) {
        case 'completed':
          statusIndicator = '<span class="pipeline-checkmark">&#10003;</span>';
          stageClass += ' completed';
          break;
        case 'active':
          statusIndicator = '<span class="pipeline-spinner"></span>';
          stageClass += ' active';
          break;
        case 'pending':
          statusIndicator = '<span class="pipeline-pending">(pending)</span>';
          break;
      }

      const arrow = index < pipelineStages.length - 1 ? '<span class="pipeline-arrow">-&gt;</span>' : '';

      return `
        <div class="${stageClass}">
          <span class="pipeline-stage-name">${escapeHtml(stage.name)}</span>
          ${statusIndicator}
        </div>
        ${arrow}
      `;
    })
    .join('');

  return `<div class="agent-status-bar">${stagesHtml}</div>`;
}

/**
 * Generates HTML for a single message bubble
 *
 * @param message - Chat message to render
 * @returns HTML string for message bubble
 */
export function generateMessageBubbleHtml(message: ChatMessage): string {
  if (message.role === 'user') {
    return `
      <div class="chat-message user-message">
        <div class="message-content">
          <div class="message-text">${escapeHtml(message.content)}</div>
        </div>
      </div>
    `;
  }

  // Agent message - check if it's a sender message (handoff prompt)
  const isSender = message.isSender === true;
  const messageClass = isSender ? 'sender-message' : 'agent-message';

  const agentLabel = message.agentName
    ? `<div class="agent-name-label">${escapeHtml(message.agentName)}</div>`
    : '';

  if (message.isStreaming) {
    // Streaming message - will be updated via JS
    return `
      <div class="chat-message ${messageClass} streaming" data-agent="${escapeHtml(message.agentName || '')}">
        ${agentLabel}
        <div class="message-content">
          <div class="typing-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
          <div class="streaming-text message-text"></div>
        </div>
      </div>
    `;
  }

  return `
    <div class="chat-message ${messageClass}">
      ${agentLabel}
      <div class="message-content">
        <div class="message-text">${escapeHtml(message.content)}</div>
      </div>
    </div>
  `;
}

/**
 * Generates HTML for the typing indicator
 *
 * @returns HTML string for typing indicator
 */
export function generateTypingIndicatorHtml(): string {
  return `
    <div class="typing-indicator">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>
  `;
}

/**
 * Generates HTML for all chat messages (legacy single-pane)
 * Kept for backward compatibility with existing tests
 *
 * @param messages - Array of chat messages
 * @param streamingContent - Current streaming content (if any)
 * @param activeAgentName - Name of the currently active agent
 * @returns HTML string for chat messages area
 */
export function generateChatMessagesHtml(
  messages: ChatMessage[],
  streamingContent: string,
  activeAgentName: string | null
): string {
  if (messages.length === 0) {
    return `
      <div class="chat-container">
        <div class="chat-messages">
          <div class="chat-empty-state">
            <div class="chat-empty-icon">💬</div>
            <div class="chat-empty-text">Enter a prompt to start the conversation</div>
          </div>
        </div>
      </div>
    `;
  }

  const messagesHtml = messages
    .map((message) => generateMessageBubbleHtml(message))
    .join('');

  return `
    <div class="chat-container" id="chat-container">
      <div class="chat-messages" id="chat-messages">
        ${messagesHtml}
      </div>
    </div>
  `;
}

/**
 * Generates HTML for the chat input area
 * Includes textarea, Send button, and New Conversation button
 *
 * @param disabled - Whether the input should be disabled
 * @returns HTML string for input area
 */
export function generateChatInputAreaHtml(disabled: boolean): string {
  const disabledAttr = disabled ? 'disabled' : '';

  return `
    <div class="chat-input-area">
      <textarea
        class="chat-input"
        id="chat-input"
        placeholder="Enter your prompt..."
        ${disabledAttr}
      ></textarea>
      <button class="send-btn" id="send-btn" ${disabledAttr}>Send</button>
    </div>
    <button class="new-conversation-btn" id="new-conversation-btn">New Conversation</button>
  `;
}

/**
 * Generates HTML for a pane header
 * Simple reusable function for both pane headers
 *
 * @param label - Header label text ("Conversation" or "Agent Collaboration")
 * @returns HTML string for pane header
 */
export function generatePaneHeaderHtml(label: string): string {
  return `<div class="pane-header">${escapeHtml(label)}</div>`;
}

/**
 * Generates HTML for the conversation pane (left pane)
 * Filters messages where pane === 'conversation'
 *
 * @param messages - Array of all chat messages
 * @param streamingContent - Current streaming content (if any)
 * @param activeAgentName - Name of the currently active agent
 * @returns HTML string for conversation pane
 */
export function generateConversationPaneHtml(
  messages: ChatMessage[],
  streamingContent: string,
  activeAgentName: string | null
): string {
  const header = generatePaneHeaderHtml('Conversation');

  // Filter messages for conversation pane
  const conversationMessages = messages.filter((msg) => msg.pane === 'conversation');

  if (conversationMessages.length === 0) {
    return `
      <div class="pane-left">
        ${header}
        <div class="pane-messages">
          <div class="chat-empty-state">
            <div class="chat-empty-icon">💬</div>
            <div class="chat-empty-text">Enter a prompt to start the conversation</div>
          </div>
        </div>
      </div>
    `;
  }

  const messagesHtml = conversationMessages
    .map((message) => generateMessageBubbleHtml(message))
    .join('');

  return `
    <div class="pane-left">
      ${header}
      <div class="pane-messages">
        ${messagesHtml}
      </div>
    </div>
  `;
}

/**
 * Generates HTML for the collaboration pane (right pane)
 * Filters messages where pane === 'collaboration'
 * Shows empty state when no collaboration messages exist
 *
 * @param messages - Array of all chat messages
 * @param streamingContent - Current streaming content (if any)
 * @param activeAgentName - Name of the currently active agent
 * @param activeMessagePane - Which pane the streaming message belongs to
 * @returns HTML string for collaboration pane
 */
export function generateCollaborationPaneHtml(
  messages: ChatMessage[],
  streamingContent: string,
  activeAgentName: string | null,
  activeMessagePane: MessagePane | null
): string {
  const header = generatePaneHeaderHtml('Agent Collaboration');

  // Filter messages for collaboration pane
  const collaborationMessages = messages.filter((msg) => msg.pane === 'collaboration');

  if (collaborationMessages.length === 0) {
    return `
      <div class="pane-right">
        ${header}
        <div class="pane-messages">
          <div class="collaboration-empty-state">
            <div class="collaboration-empty-icon">🤝</div>
            <div>No agent collaboration in this workflow</div>
          </div>
        </div>
      </div>
    `;
  }

  const messagesHtml = collaborationMessages
    .map((message) => generateMessageBubbleHtml(message))
    .join('');

  return `
    <div class="pane-right">
      ${header}
      <div class="pane-messages">
        ${messagesHtml}
      </div>
    </div>
  `;
}

/**
 * Generates HTML for the dual-pane container
 * Wraps both conversation and collaboration panes
 *
 * @param messages - Array of all chat messages
 * @param streamingContent - Current streaming content (if any)
 * @param activeAgentName - Name of the currently active agent
 * @param activeMessagePane - Which pane the streaming message belongs to
 * @returns HTML string for dual-pane container
 */
export function generateDualPaneContainerHtml(
  messages: ChatMessage[],
  streamingContent: string,
  activeAgentName: string | null,
  activeMessagePane: MessagePane | null
): string {
  const leftPane = generateConversationPaneHtml(messages, streamingContent, activeAgentName);
  const rightPane = generateCollaborationPaneHtml(messages, streamingContent, activeAgentName, activeMessagePane);

  return `
    <div class="dual-pane-container">
      ${leftPane}
      ${rightPane}
    </div>
  `;
}

/**
 * Generates the complete chat panel HTML
 * Assembles all components into a full chat interface
 * Uses dual-pane layout for conversation and collaboration panes
 *
 * @param state - Chat panel state
 * @returns Complete HTML string for chat panel
 */
export function generateChatPanelHtml(state: ChatPanelState): string {
  const { session, ui } = state;

  // Format elapsed time
  const elapsedTime = ui.elapsedTimeMs !== null
    ? formatTime(ui.elapsedTimeMs)
    : formatTime(null);

  // Generate components
  const sessionInfoBar = generateSessionInfoBarHtml(
    session.workflowId,
    session.turnCount,
    elapsedTime
  );

  const statusBar = generateAgentStatusBarHtml(session.pipelineStages);

  // Use dual-pane container instead of single chat messages
  const dualPaneContainer = generateDualPaneContainerHtml(
    session.messages,
    session.streamingContent,
    session.activeAgentName,
    session.activeMessagePane
  );

  const errorHtml = ui.errorMessage
    ? `<div class="chat-error-message">${escapeHtml(ui.errorMessage)}</div>`
    : '';

  const inputArea = generateChatInputAreaHtml(ui.inputDisabled);

  return `
    <div class="chat-panel">
      ${sessionInfoBar}
      ${statusBar}
      ${dualPaneContainer}
      ${errorHtml}
      ${inputArea}
    </div>
  `;
}

/**
 * Generates HTML for updating the streaming message content
 * Called during real-time token streaming
 *
 * @param content - Current accumulated streaming content
 * @returns HTML string for streaming text element
 */
export function generateStreamingContentHtml(content: string): string {
  if (!content) {
    return '';
  }
  return `${escapeHtml(content)}<span class="streaming-cursor"></span>`;
}
