/**
 * Tests for Partial Execution UI Rendering
 * Task Group 3: UI Rendering Layer
 *
 * Tests for HTML generation functions for partial execution indicators
 * and workflow status badges.
 */

import { describe, it, expect } from 'vitest';
import {
  generatePartialIndicatorHtml,
  generateWorkflowStatusBadgeHtml,
  generateConversationPaneHtml,
  generateSessionInfoBarHtml,
} from '../../utils/chatPanelHtmlGenerator';
import type { ChatMessage, WorkflowStatus } from '../../types/chatPanel';

// ============================================================================
// Task 3.1: 2-3 Focused Tests for UI Rendering
// ============================================================================

describe('Task Group 3: Partial Execution UI Rendering', () => {
  describe('Test 1: generatePartialIndicatorHtml() returns correct HTML', () => {
    it('should generate partial indicator with correct class and text', () => {
      const html = generatePartialIndicatorHtml();

      expect(html).toContain('partial-execution-indicator');
      expect(html).toContain('Awaiting your response');
    });

    it('should include ellipsis animation element', () => {
      const html = generatePartialIndicatorHtml();

      expect(html).toContain('ellipsis-animation');
    });
  });

  describe('Test 2: generateWorkflowStatusBadgeHtml() returns correct icon per status', () => {
    it('should generate running badge with spinner', () => {
      const html = generateWorkflowStatusBadgeHtml('running');

      expect(html).toContain('workflow-status-badge');
      expect(html).toContain('running');
      expect(html).toContain('status-spinner');
      expect(html).toContain('Running');
    });

    it('should generate partial badge with hourglass icon', () => {
      const html = generateWorkflowStatusBadgeHtml('partial');

      expect(html).toContain('workflow-status-badge');
      expect(html).toContain('partial');
      // Hourglass Unicode character (U+231B)
      expect(html).toMatch(/[\u231B\u23F3]/);
      expect(html).toContain('Awaiting Input');
    });

    it('should generate complete badge with checkmark', () => {
      const html = generateWorkflowStatusBadgeHtml('complete');

      expect(html).toContain('workflow-status-badge');
      expect(html).toContain('complete');
      // Checkmark Unicode character
      expect(html).toMatch(/[\u2713\u2714]/);
      expect(html).toContain('Complete');
    });

    it('should generate error badge with X mark', () => {
      const html = generateWorkflowStatusBadgeHtml('error');

      expect(html).toContain('workflow-status-badge');
      expect(html).toContain('error');
      // X mark Unicode character
      expect(html).toMatch(/[\u2717\u2718]/);
      expect(html).toContain('Error');
    });
  });

  describe('Test 3: Indicator only renders when workflowStatus is partial', () => {
    const createConversationMessage = (): ChatMessage => ({
      id: 'msg-test123',
      role: 'agent',
      agentName: 'Triage Agent',
      content: 'Hello, I can help you with that.',
      timestamp: Date.now(),
      isStreaming: false,
      pane: 'conversation',
      toolCalls: [],
    });

    const userMessage: ChatMessage = {
      id: 'msg-user123',
      role: 'user',
      content: 'Help me with this issue',
      timestamp: Date.now() - 1000,
      isStreaming: false,
      pane: 'conversation',
      toolCalls: [],
    };

    it('should render partial indicator when workflowStatus is partial', () => {
      const messages = [userMessage, createConversationMessage()];
      const html = generateConversationPaneHtml(messages, '', null, 'partial');

      expect(html).toContain('partial-execution-indicator');
      expect(html).toContain('Awaiting your response');
    });

    it('should NOT render partial indicator when workflowStatus is running', () => {
      const messages = [userMessage, createConversationMessage()];
      const html = generateConversationPaneHtml(messages, '', null, 'running');

      expect(html).not.toContain('partial-execution-indicator');
    });

    it('should NOT render partial indicator when workflowStatus is complete', () => {
      const messages = [userMessage, createConversationMessage()];
      const html = generateConversationPaneHtml(messages, '', null, 'complete');

      expect(html).not.toContain('partial-execution-indicator');
    });

    it('should NOT render partial indicator when workflowStatus is error', () => {
      const messages = [userMessage, createConversationMessage()];
      const html = generateConversationPaneHtml(messages, '', null, 'error');

      expect(html).not.toContain('partial-execution-indicator');
    });
  });
});

describe('Task Group 3: Session Info Bar Status Badge', () => {
  describe('Test: generateSessionInfoBarHtml includes status badge', () => {
    it('should include status badge section in session info bar', () => {
      const html = generateSessionInfoBarHtml('wf-test123', 1, '00:05', 'running');

      expect(html).toContain('workflow-status-badge');
      expect(html).toContain('Running');
    });

    it('should show partial status in session info bar', () => {
      const html = generateSessionInfoBarHtml('wf-test123', 1, '00:10', 'partial');

      expect(html).toContain('workflow-status-badge');
      expect(html).toContain('partial');
      expect(html).toContain('Awaiting Input');
    });

    it('should show complete status in session info bar', () => {
      const html = generateSessionInfoBarHtml('wf-test123', 1, '00:15', 'complete');

      expect(html).toContain('workflow-status-badge');
      expect(html).toContain('complete');
      expect(html).toContain('Complete');
    });

    it('should show error status in session info bar', () => {
      const html = generateSessionInfoBarHtml('wf-test123', 1, '00:20', 'error');

      expect(html).toContain('workflow-status-badge');
      expect(html).toContain('error');
      expect(html).toContain('Error');
    });

    it('should include divider before status badge', () => {
      const html = generateSessionInfoBarHtml('wf-test123', 1, '00:05', 'running');

      // Should have dividers separating sections
      const dividerCount = (html.match(/session-info-divider/g) || []).length;
      expect(dividerCount).toBeGreaterThanOrEqual(3);
    });
  });
});
