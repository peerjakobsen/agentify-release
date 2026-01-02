/**
 * Tests for Demo Viewer Chat UI Styles
 * Task Group 2: CSS Styling Layer
 *
 * Tests for chat UI CSS styling including session info bar,
 * message bubbles, and chat container styles.
 */

import { describe, it, expect } from 'vitest';
import { getDemoViewerChatStyles } from '../../panels/demoViewerChatStyles';

// ============================================================================
// Task 2.1: 3 Focused Tests for CSS Styling Layer
// ============================================================================

describe('Task Group 2: Chat UI Styles', () => {
  describe('Test 1: getDemoViewerChatStyles returns string containing required class names', () => {
    it('should return a non-empty CSS string', () => {
      const styles = getDemoViewerChatStyles();
      expect(typeof styles).toBe('string');
      expect(styles.length).toBeGreaterThan(0);
    });

    it('should contain chat container class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.chat-container');
    });

    it('should contain chat messages wrapper class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.chat-messages');
    });

    it('should contain chat message base class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.chat-message');
    });

    it('should contain chat input area class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.chat-input-area');
    });

    it('should contain send button class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.send-btn');
    });

    it('should contain new conversation button class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.new-conversation-btn');
    });

    it('should contain typing indicator class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.typing-indicator');
    });

    it('should contain streaming text class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.streaming-text');
    });
  });

  describe('Test 2: Session info bar styles include flex layout classes', () => {
    it('should contain session-info-bar class with flex display', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.session-info-bar');
      expect(styles).toContain('display: flex');
    });

    it('should contain session-info-item class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.session-info-item');
    });

    it('should contain session-info-label class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.session-info-label');
    });

    it('should contain session-info-value class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.session-info-value');
    });

    it('should contain session-info-divider class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.session-info-divider');
    });

    it('should use VS Code theme variables for session info bar', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('--vscode-editorWidget-background');
      expect(styles).toContain('--vscode-editorWidget-border');
    });
  });

  describe('Test 3: Message bubble styles include user-message and agent-message classes', () => {
    it('should contain user-message class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.user-message');
    });

    it('should contain agent-message class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.agent-message');
    });

    it('should contain message-text class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.message-text');
    });

    it('should contain agent-name-label class for agent bubble headers', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.agent-name-label');
    });

    it('should style user messages with flex-end alignment (right-aligned)', () => {
      const styles = getDemoViewerChatStyles();
      // Check that user-message contains align-self: flex-end
      expect(styles).toContain('.user-message');
      expect(styles).toContain('align-self: flex-end');
    });

    it('should style agent messages with flex-start alignment (left-aligned)', () => {
      const styles = getDemoViewerChatStyles();
      // Check that agent-message contains align-self: flex-start
      expect(styles).toContain('.agent-message');
      expect(styles).toContain('align-self: flex-start');
    });

    it('should use VS Code button background for user message bubbles (blue)', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('--vscode-button-background');
      expect(styles).toContain('--vscode-button-foreground');
    });

    it('should use VS Code input background for agent message bubbles (gray)', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('--vscode-input-background');
    });

    it('should include border-radius for message bubbles', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('border-radius: 12px');
    });
  });

  describe('Agent status bar styles', () => {
    it('should contain agent-status-bar class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.agent-status-bar');
    });

    it('should contain pipeline stage classes', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.pipeline-stage');
      expect(styles).toContain('.pipeline-stage-name');
    });

    it('should contain pipeline checkmark class for completed agents', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.pipeline-checkmark');
    });

    it('should contain pipeline pending class for waiting agents', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.pipeline-pending');
    });

    it('should contain pipeline arrow class for separators', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.pipeline-arrow');
    });

    it('should use VS Code success color for checkmarks', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('--vscode-testing-iconPassed');
    });
  });

  describe('Animations', () => {
    it('should include typing animation keyframes', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('@keyframes typing');
    });

    it('should include spin animation for loading spinner', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('@keyframes spin');
    });

    it('should include blink animation for streaming cursor', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('@keyframes blink');
    });
  });
});
