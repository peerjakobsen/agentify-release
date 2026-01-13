/**
 * Chat Panel HTML Generator
 * HTML generation functions for the Demo Viewer chat UI
 *
 * Generates HTML for session info bar, agent status bar,
 * message bubbles, typing indicators, and input area.
 */

import { formatTime } from './timerFormatter';
import { generateToolId } from './chatStateUtils';
import type { MergedToolCallEvent } from './chatStateUtils';
import type {
  ChatMessage,
  ChatSessionState,
  AgentPipelineStage,
  ChatPanelState,
  MessagePane,
  WorkflowStatus,
} from '../types/chatPanel';
import type { ToolCallEvent } from '../types/events';

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

// ============================================================================
// Partial Execution Detection HTML Generation Functions
// ============================================================================

/**
 * Generates HTML for the partial execution indicator
 * Shows "Awaiting your response..." below entry agent message
 *
 * @returns HTML string for partial execution indicator
 */
export function generatePartialIndicatorHtml(): string {
  return `
    <div class="partial-execution-indicator">
      Awaiting your response<span class="ellipsis-animation"></span>
    </div>
  `;
}

/**
 * Generates HTML for the workflow status badge
 * Displays in session info bar with status-specific icon and color
 *
 * @param status - Current workflow status
 * @returns HTML string for workflow status badge
 */
export function generateWorkflowStatusBadgeHtml(status: WorkflowStatus): string {
  let statusIcon: string;
  let statusLabel: string;

  switch (status) {
    case 'running':
      statusIcon = '<span class="status-spinner"></span>';
      statusLabel = 'Running';
      break;
    case 'partial':
      // Hourglass not done (U+23F3)
      statusIcon = '<span class="status-icon">\u23F3</span>';
      statusLabel = 'Awaiting Input';
      break;
    case 'complete':
      // Check mark (U+2713)
      statusIcon = '<span class="status-icon">\u2713</span>';
      statusLabel = 'Complete';
      break;
    case 'error':
      // Ballot X (U+2717)
      statusIcon = '<span class="status-icon">\u2717</span>';
      statusLabel = 'Error';
      break;
    default:
      statusIcon = '<span class="status-spinner"></span>';
      statusLabel = 'Running';
  }

  return `<span class="workflow-status-badge ${status}">${statusIcon}<span class="status-label">${statusLabel}</span></span>`;
}

// ============================================================================
// Session and Status Bar HTML Generation Functions
// ============================================================================

/**
 * Generates the session info bar HTML
 * Displays workflow_id, turn count, elapsed time, and workflow status
 *
 * @param workflowId - Workflow identifier (short format)
 * @param turnCount - Number of conversation turns
 * @param elapsedTime - Elapsed time formatted string
 * @param workflowStatus - Current workflow status (optional, defaults to 'running')
 * @returns HTML string for session info bar
 */
export function generateSessionInfoBarHtml(
  workflowId: string,
  turnCount: number,
  elapsedTime: string,
  workflowStatus: WorkflowStatus = 'running'
): string {
  const statusBadge = generateWorkflowStatusBadgeHtml(workflowStatus);

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
      <div class="session-info-divider"></div>
      <div class="session-info-item">
        <span class="session-info-label">Status:</span>
        ${statusBadge}
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

// ============================================================================
// Message Bubble HTML Generation Functions
// ============================================================================

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

  // Generate tool chips if tool calls exist
  const toolChipsHtml = message.toolCalls && message.toolCalls.length > 0
    ? generateToolChipsContainerHtml(message.toolCalls)
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
          ${toolChipsHtml}
        </div>
      </div>
    `;
  }

  return `
    <div class="chat-message ${messageClass}">
      ${agentLabel}
      <div class="message-content">
        <div class="message-text">${escapeHtml(message.content)}</div>
        ${toolChipsHtml}
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

// ============================================================================
// Dual-Pane HTML Generation Functions
// ============================================================================

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
 * Shows partial execution indicator when workflowStatus is 'partial'
 *
 * @param messages - Array of all chat messages
 * @param streamingContent - Current streaming content (if any)
 * @param activeAgentName - Name of the currently active agent
 * @param workflowStatus - Current workflow status (optional)
 * @returns HTML string for conversation pane
 */
export function generateConversationPaneHtml(
  messages: ChatMessage[],
  streamingContent: string,
  activeAgentName: string | null,
  workflowStatus?: WorkflowStatus
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

  // Only show partial indicator when status is explicitly 'partial'
  const partialIndicator = workflowStatus === 'partial' ? generatePartialIndicatorHtml() : '';

  return `
    <div class="pane-left">
      ${header}
      <div class="pane-messages">
        ${messagesHtml}
        ${partialIndicator}
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
 * @param workflowStatus - Current workflow status (optional)
 * @returns HTML string for dual-pane container
 */
export function generateDualPaneContainerHtml(
  messages: ChatMessage[],
  streamingContent: string,
  activeAgentName: string | null,
  activeMessagePane: MessagePane | null,
  workflowStatus?: WorkflowStatus
): string {
  const leftPane = generateConversationPaneHtml(messages, streamingContent, activeAgentName, workflowStatus);
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

  // Generate components with workflow status
  const sessionInfoBar = generateSessionInfoBarHtml(
    session.workflowId,
    session.turnCount,
    elapsedTime,
    ui.workflowStatus
  );

  const statusBar = generateAgentStatusBarHtml(session.pipelineStages);

  // Use dual-pane container with workflow status for partial indicator
  const dualPaneContainer = generateDualPaneContainerHtml(
    session.messages,
    session.streamingContent,
    session.activeAgentName,
    session.activeMessagePane,
    ui.workflowStatus
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

// ============================================================================
// Tool Chip HTML Generation Functions
// ============================================================================

/**
 * Generates HTML for a single tool chip
 * Renders status-specific styling (running/completed/failed)
 *
 * @param toolEvent - Tool call event to render
 * @returns HTML string for tool chip
 */
/**
 * Task 7.2: Get memory operation icon based on operation name
 * Returns special icon for persistent memory functions
 */
function getMemoryOperationIcon(operation: string): string | null {
  const memoryIconMap: Record<string, string> = {
    // Persistent Session Memory operations
    'remember_preference': '💾', // Save/disk icon
    'recall_preferences': '🔍',  // Search/magnifying glass icon
    'log_feedback': '⭐',        // Star icon
    // Cross-agent memory operations (existing)
    'store_context': '📝',       // Note icon
    'search_memory': '🔎',       // Search icon
  };
  return memoryIconMap[operation] || null;
}

export function generateToolChipHtml(toolEvent: ToolCallEvent): string {
  const toolId = generateToolId(toolEvent);
  let statusClass: string;
  let statusIcon: string;

  // Determine status class and icon based on event status
  switch (toolEvent.status) {
    case 'started':
      statusClass = 'running';
      statusIcon = '<span class="tool-chip-spinner"></span>';
      break;
    case 'completed':
      statusClass = 'completed';
      statusIcon = '<span class="tool-chip-icon">&#10003;</span>'; // Checkmark
      break;
    case 'failed':
      statusClass = 'failed';
      statusIcon = '<span class="tool-chip-icon">&#10007;</span>'; // X mark
      break;
    default:
      statusClass = 'running';
      statusIcon = '<span class="tool-chip-spinner"></span>';
  }

  // Task 7.2: Check for memory operation icon
  const memoryIcon = getMemoryOperationIcon(toolEvent.operation);
  const memoryIconHtml = memoryIcon ? `<span class="tool-chip-memory-icon" title="${escapeHtml(toolEvent.operation)}">${memoryIcon}</span>` : '';

  // Generate the label: system.operation
  const label = `${escapeHtml(toolEvent.system)}.${escapeHtml(toolEvent.operation)}`;

  return `<div class="tool-chip ${statusClass}" data-tool-id="${escapeHtml(toolId)}">${statusIcon}${memoryIconHtml}<span class="tool-chip-label">${label}</span></div>`;
}

/**
 * Generates HTML for a container of tool chips
 * Returns empty string if no tool calls
 *
 * @param toolEvents - Array of tool call events
 * @returns HTML string for tool chips container, or empty string
 */
export function generateToolChipsContainerHtml(toolEvents: ToolCallEvent[]): string {
  if (!toolEvents || toolEvents.length === 0) {
    return '';
  }

  const chipsHtml = toolEvents
    .map((event) => generateToolChipHtml(event))
    .join('');

  return `<div class="tool-chips-container">${chipsHtml}</div>`;
}

/**
 * Generates HTML for expanded tool chip details
 * Shows input, output, error message, and duration
 *
 * @param toolEvent - Tool call event (with optional duration_ms)
 * @returns HTML string for tool chip details
 */
export function generateToolChipDetailsHtml(toolEvent: MergedToolCallEvent): string {
  const sections: string[] = [];

  // Input section
  if (toolEvent.input && Object.keys(toolEvent.input).length > 0) {
    const inputJson = escapeHtml(JSON.stringify(toolEvent.input, null, 2));
    sections.push(`
      <div class="tool-chip-details-section">
        <div class="tool-chip-details-label">Input</div>
        <pre class="tool-chip-json">${inputJson}</pre>
      </div>
    `);
  }

  // Output section (only for completed status)
  if (toolEvent.output && Object.keys(toolEvent.output).length > 0) {
    const outputJson = escapeHtml(JSON.stringify(toolEvent.output, null, 2));
    sections.push(`
      <div class="tool-chip-details-section">
        <div class="tool-chip-details-label">Output</div>
        <pre class="tool-chip-json">${outputJson}</pre>
      </div>
    `);
  }

  // Error section (only for failed status)
  if (toolEvent.error_message) {
    sections.push(`
      <div class="tool-chip-details-section">
        <div class="tool-chip-details-label">Error</div>
        <div class="tool-chip-error-text">${escapeHtml(toolEvent.error_message)}</div>
      </div>
    `);
  }

  // Duration section (if available)
  if (toolEvent.duration_ms !== undefined) {
    sections.push(`
      <div class="tool-chip-details-section">
        <div class="tool-chip-duration">Completed in ${toolEvent.duration_ms}ms</div>
      </div>
    `);
  }

  return `<div class="tool-chip-details">${sections.join('')}</div>`;
}
