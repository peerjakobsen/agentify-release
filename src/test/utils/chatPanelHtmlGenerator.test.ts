/**
 * Tests for Chat Panel HTML Generator
 * Task Group 3: UI Components Layer
 *
 * Tests for HTML generation functions for the Demo Viewer chat UI
 */

import { describe, it, expect } from 'vitest';
import {
  generateSessionInfoBarHtml,
  generateAgentStatusBarHtml,
  generateChatMessagesHtml,
  generateChatInputAreaHtml,
  generateTypingIndicatorHtml,
  generateMessageBubbleHtml,
  generateChatPanelHtml,
} from '../../utils/chatPanelHtmlGenerator';
import { generateChatPanelJs } from '../../utils/chatPanelJsGenerator';
import type {
  ChatMessage,
  AgentPipelineStage,
  ChatPanelState,
} from '../../types/chatPanel';
import { createInitialChatState, createInitialUiState } from '../../utils/chatStateUtils';

// ============================================================================
// Task 3.1: 5 Focused Tests for UI Components Layer
// ============================================================================

describe('Task Group 3: Chat UI HTML Components', () => {
  describe('Test 1: generateSessionInfoBarHtml produces correct structure', () => {
    it('should produce HTML with workflow_id', () => {
      const html = generateSessionInfoBarHtml('wf-a1b2c3d4', 1, '00:04');

      expect(html).toContain('wf-a1b2c3d4');
      expect(html).toContain('session-info-bar');
    });

    it('should produce HTML with turn count', () => {
      const html = generateSessionInfoBarHtml('wf-test1234', 1, '00:04');

      expect(html).toContain('Turn:');
      expect(html).toContain('1');
    });

    it('should produce HTML with elapsed time', () => {
      const html = generateSessionInfoBarHtml('wf-test1234', 1, '00:04');

      expect(html).toContain('Elapsed:');
      expect(html).toContain('00:04');
    });

    it('should include session info labels and values', () => {
      const html = generateSessionInfoBarHtml('wf-test1234', 2, '01:30');

      expect(html).toContain('session-info-label');
      expect(html).toContain('session-info-value');
      expect(html).toContain('Session:');
    });

    it('should include dividers between items', () => {
      const html = generateSessionInfoBarHtml('wf-test1234', 1, '00:00');

      expect(html).toContain('session-info-divider');
    });

    it('should include id for elapsed time element for JS updates', () => {
      const html = generateSessionInfoBarHtml('wf-test1234', 1, '00:00');

      expect(html).toContain('id="elapsed-time"');
    });
  });

  describe('Test 2: generateAgentStatusBarHtml produces pipeline display', () => {
    it('should produce empty state message when no stages', () => {
      const html = generateAgentStatusBarHtml([]);

      expect(html).toContain('agent-status-bar');
      expect(html).toContain('Waiting for workflow');
    });

    it('should produce HTML with checkmarks for completed agents', () => {
      const stages: AgentPipelineStage[] = [
        { name: 'Triage', status: 'completed' },
      ];

      const html = generateAgentStatusBarHtml(stages);

      expect(html).toContain('Triage');
      expect(html).toContain('pipeline-checkmark');
      expect(html).toContain('&#10003;'); // Checkmark character
    });

    it('should produce HTML with pending indicators for waiting agents', () => {
      const stages: AgentPipelineStage[] = [
        { name: 'Output', status: 'pending' },
      ];

      const html = generateAgentStatusBarHtml(stages);

      expect(html).toContain('Output');
      expect(html).toContain('pipeline-pending');
      expect(html).toContain('(pending)');
    });

    it('should produce HTML with spinner for active agents', () => {
      const stages: AgentPipelineStage[] = [
        { name: 'Technical', status: 'active' },
      ];

      const html = generateAgentStatusBarHtml(stages);

      expect(html).toContain('Technical');
      expect(html).toContain('pipeline-spinner');
    });

    it('should produce HTML with arrows between stages', () => {
      const stages: AgentPipelineStage[] = [
        { name: 'Triage', status: 'completed' },
        { name: 'Technical', status: 'active' },
        { name: 'Output', status: 'pending' },
      ];

      const html = generateAgentStatusBarHtml(stages);

      expect(html).toContain('pipeline-arrow');
      expect(html).toContain('-&gt;'); // Escaped arrow
    });

    it('should not have arrow after last stage', () => {
      const stages: AgentPipelineStage[] = [
        { name: 'Triage', status: 'completed' },
        { name: 'Output', status: 'pending' },
      ];

      const html = generateAgentStatusBarHtml(stages);

      // Count arrows - should be one less than number of stages
      const arrowCount = (html.match(/pipeline-arrow/g) || []).length;
      expect(arrowCount).toBe(1);
    });
  });

  describe('Test 3: generateChatMessagesHtml renders messages correctly', () => {
    it('should render empty state when no messages', () => {
      const html = generateChatMessagesHtml([], '', null);

      expect(html).toContain('chat-container');
      expect(html).toContain('chat-empty-state');
      expect(html).toContain('Enter a prompt');
    });

    it('should render user message with right alignment class', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test prompt',
          timestamp: Date.now(),
          isStreaming: false,
        },
      ];

      const html = generateChatMessagesHtml(messages, '', null);

      expect(html).toContain('user-message');
      expect(html).toContain('Test prompt');
    });

    it('should render agent message with left alignment class', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'agent',
          agentName: 'Technical Agent',
          content: 'Analysis result',
          timestamp: Date.now(),
          isStreaming: false,
        },
      ];

      const html = generateChatMessagesHtml(messages, '', null);

      expect(html).toContain('agent-message');
      expect(html).toContain('Technical Agent');
      expect(html).toContain('Analysis result');
    });

    it('should render agent name label for agent messages', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'agent',
          agentName: 'Triage Agent',
          content: 'Routing complete',
          timestamp: Date.now(),
          isStreaming: false,
        },
      ];

      const html = generateChatMessagesHtml(messages, '', null);

      expect(html).toContain('agent-name-label');
      expect(html).toContain('Triage Agent');
    });

    it('should render streaming message with typing indicator', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'agent',
          agentName: 'Technical Agent',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
        },
      ];

      const html = generateChatMessagesHtml(messages, 'partial content', 'Technical Agent');

      expect(html).toContain('streaming');
      expect(html).toContain('typing-indicator');
      expect(html).toContain('streaming-text');
    });

    it('should include chat-container and chat-messages wrapper', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test',
          timestamp: Date.now(),
          isStreaming: false,
        },
      ];

      const html = generateChatMessagesHtml(messages, '', null);

      expect(html).toContain('chat-container');
      expect(html).toContain('chat-messages');
      expect(html).toContain('id="chat-container"');
    });
  });

  describe('Test 4: generateChatInputAreaHtml includes all required elements', () => {
    it('should include textarea element', () => {
      const html = generateChatInputAreaHtml(false);

      expect(html).toContain('<textarea');
      expect(html).toContain('chat-input');
      expect(html).toContain('id="chat-input"');
    });

    it('should include Send button', () => {
      const html = generateChatInputAreaHtml(false);

      expect(html).toContain('send-btn');
      expect(html).toContain('id="send-btn"');
      expect(html).toContain('Send');
    });

    it('should include New Conversation button', () => {
      const html = generateChatInputAreaHtml(false);

      expect(html).toContain('new-conversation-btn');
      expect(html).toContain('id="new-conversation-btn"');
      expect(html).toContain('New Conversation');
    });

    it('should include placeholder text', () => {
      const html = generateChatInputAreaHtml(false);

      expect(html).toContain('placeholder="Enter your prompt..."');
    });

    it('should disable inputs when disabled flag is true', () => {
      const html = generateChatInputAreaHtml(true);

      // Both textarea and button should have disabled attribute
      expect(html).toContain('disabled');
    });

    it('should not disable inputs when disabled flag is false', () => {
      const html = generateChatInputAreaHtml(false);

      // The HTML should not contain disabled attribute (or at least not have it applied)
      // Count occurrences - should only be in the attribute check, not as actual disabled
      const htmlWithoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
      const disabledCount = (htmlWithoutComments.match(/disabled/g) || []).length;

      // When not disabled, there should be 0 disabled attributes
      expect(disabledCount).toBe(0);
    });
  });

  describe('Test 5: generateTypingIndicatorHtml produces animated dots structure', () => {
    it('should produce typing-indicator container', () => {
      const html = generateTypingIndicatorHtml();

      expect(html).toContain('typing-indicator');
    });

    it('should produce three dot elements', () => {
      const html = generateTypingIndicatorHtml();

      const dotCount = (html.match(/<span class="dot"><\/span>/g) || []).length;
      expect(dotCount).toBe(3);
    });

    it('should have correct structure for animation', () => {
      const html = generateTypingIndicatorHtml();

      expect(html).toContain('<div class="typing-indicator">');
      expect(html).toContain('<span class="dot"></span>');
    });
  });

  describe('generateChatPanelHtml - Complete Panel Assembly', () => {
    it('should assemble all components into complete panel', () => {
      const state: ChatPanelState = {
        session: createInitialChatState(),
        ui: createInitialUiState(),
      };

      const html = generateChatPanelHtml(state);

      // Should contain all main sections
      expect(html).toContain('session-info-bar');
      expect(html).toContain('agent-status-bar');
      expect(html).toContain('chat-container');
      expect(html).toContain('chat-input-area');
    });

    it('should format elapsed time correctly', () => {
      const state: ChatPanelState = {
        session: createInitialChatState(),
        ui: {
          ...createInitialUiState(),
          elapsedTimeMs: 65000, // 1:05
        },
      };

      const html = generateChatPanelHtml(state);

      expect(html).toContain('01:05');
    });

    it('should display error message when present', () => {
      const state: ChatPanelState = {
        session: createInitialChatState(),
        ui: {
          ...createInitialUiState(),
          errorMessage: 'Workflow failed',
        },
      };

      const html = generateChatPanelHtml(state);

      expect(html).toContain('chat-error-message');
      expect(html).toContain('Workflow failed');
    });
  });

  describe('generateChatPanelJs - JavaScript Generation', () => {
    it('should generate JavaScript with send button handler', () => {
      const js = generateChatPanelJs();

      expect(js).toContain('handleSendClick');
      expect(js).toContain('sendMessage');
    });

    it('should generate JavaScript with new conversation handler', () => {
      const js = generateChatPanelJs();

      expect(js).toContain('handleNewConversation');
      expect(js).toContain('newConversation');
    });

    it('should generate JavaScript with auto-scroll function', () => {
      const js = generateChatPanelJs();

      expect(js).toContain('scrollChatToBottom');
      expect(js).toContain('scrollHeight');
    });

    it('should generate JavaScript with timer update handler', () => {
      const js = generateChatPanelJs();

      expect(js).toContain('handleTimerUpdate');
      expect(js).toContain('updateTimer');
    });

    it('should NOT include Enter key handler (button-only submission)', () => {
      const js = generateChatPanelJs();

      // Should explicitly mention NO Enter key handler
      expect(js).toContain('NO Enter Key Handler');
      // Should NOT have keydown or Enter key event listener setup
      expect(js).not.toContain("key === 'Enter'");
      expect(js).not.toContain('keydown');
    });

    it('should include streaming token handler', () => {
      const js = generateChatPanelJs();

      expect(js).toContain('handleStreamingToken');
      expect(js).toContain('streamingToken');
    });
  });

  describe('Message Bubble HTML - generateMessageBubbleHtml', () => {
    it('should escape HTML in message content', () => {
      const message: ChatMessage = {
        id: 'msg-1',
        role: 'user',
        content: '<script>alert("xss")</script>',
        timestamp: Date.now(),
        isStreaming: false,
      };

      const html = generateMessageBubbleHtml(message);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should escape HTML in agent name', () => {
      const message: ChatMessage = {
        id: 'msg-1',
        role: 'agent',
        agentName: '<b>Evil</b>',
        content: 'Test',
        timestamp: Date.now(),
        isStreaming: false,
      };

      const html = generateMessageBubbleHtml(message);

      expect(html).not.toContain('<b>');
      expect(html).toContain('&lt;b&gt;');
    });
  });
});
