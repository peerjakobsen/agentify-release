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

// ============================================================================
// Task Group 2: Dual-Pane CSS Styles Tests (Task 2.1)
// Visual regression tests for the dual-pane conversation UI layout
// ============================================================================

describe('Task Group 2: Dual-Pane CSS Styles', () => {
  describe('Test 1: Dual-pane container renders with 50/50 split', () => {
    it('should contain dual-pane-container class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.dual-pane-container');
    });

    it('should use flexbox for dual-pane-container', () => {
      const styles = getDemoViewerChatStyles();
      // Extract the dual-pane-container rule
      expect(styles).toMatch(/\.dual-pane-container\s*\{[^}]*display:\s*flex/);
    });

    it('should contain pane-left and pane-right classes', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.pane-left');
      expect(styles).toContain('.pane-right');
    });

    it('should use flex: 1 for equal width panes', () => {
      const styles = getDemoViewerChatStyles();
      // Both pane-left and pane-right should have flex: 1
      expect(styles).toMatch(/\.pane-left\s*\{[^}]*flex:\s*1/);
      expect(styles).toMatch(/\.pane-right\s*\{[^}]*flex:\s*1/);
    });

    it('should have border separator between panes', () => {
      const styles = getDemoViewerChatStyles();
      // The right pane should have a left border for separation
      expect(styles).toMatch(/\.pane-right\s*\{[^}]*border-left/);
    });
  });

  describe('Test 2: Pane headers display correctly', () => {
    it('should contain pane-header class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.pane-header');
    });

    it('should style pane-header with 11px font size', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toMatch(/\.pane-header\s*\{[^}]*font-size:\s*11px/);
    });

    it('should style pane-header with uppercase text', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toMatch(/\.pane-header\s*\{[^}]*text-transform:\s*uppercase/);
    });

    it('should use VS Code theme variables for header colors', () => {
      const styles = getDemoViewerChatStyles();
      // Header should use VS Code description foreground for subtle appearance
      expect(styles).toContain('--vscode-descriptionForeground');
    });

    it('should have subtle visual separation for headers', () => {
      const styles = getDemoViewerChatStyles();
      // Header should have padding or border for visual separation
      expect(styles).toMatch(/\.pane-header\s*\{[^}]*padding/);
    });
  });

  describe('Test 3: Independent scroll containers work for each pane', () => {
    it('should contain pane-messages class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.pane-messages');
    });

    it('should have overflow-y auto for pane-messages', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toMatch(/\.pane-messages\s*\{[^}]*overflow-y:\s*auto/);
    });

    it('should have max-height for pane-messages scroll container', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toMatch(/\.pane-messages\s*\{[^}]*max-height:\s*350px/);
    });

    it('should reuse chat-messages padding pattern for pane-messages', () => {
      const styles = getDemoViewerChatStyles();
      // pane-messages should have padding like chat-messages (12px)
      expect(styles).toMatch(/\.pane-messages\s*\{[^}]*padding:\s*12px/);
    });

    it('should have gap between messages in pane-messages', () => {
      const styles = getDemoViewerChatStyles();
      // pane-messages should have gap between messages like chat-messages
      expect(styles).toMatch(/\.pane-messages\s*\{[^}]*gap:\s*12px/);
    });
  });

  describe('Test 4: Empty state styling in collaboration pane', () => {
    it('should contain collaboration-empty-state class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.collaboration-empty-state');
    });

    it('should center-align the empty state text', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toMatch(/\.collaboration-empty-state\s*\{[^}]*text-align:\s*center/);
    });

    it('should use muted text color for empty state', () => {
      const styles = getDemoViewerChatStyles();
      // Should use VS Code description foreground for muted appearance
      expect(styles).toMatch(/\.collaboration-empty-state\s*\{[^}]*color:\s*var\(--vscode-descriptionForeground\)/);
    });

    it('should have padding for empty state content', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toMatch(/\.collaboration-empty-state\s*\{[^}]*padding/);
    });

    it('should be consistent with existing chat-empty-state styling', () => {
      const styles = getDemoViewerChatStyles();
      // Both empty states should use similar font-size (13px from chat-empty-text)
      expect(styles).toContain('.chat-empty-state');
      expect(styles).toContain('.collaboration-empty-state');
    });
  });

  describe('Test 5: Sender message styling in collaboration pane', () => {
    it('should contain sender-message class for right-aligned handoff messages', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.sender-message');
    });

    it('should style sender-message with flex-end alignment (right-aligned)', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toMatch(/\.sender-message\s*\{[^}]*align-self:\s*flex-end/);
    });

    it('should style sender-message with user message colors (blue)', () => {
      const styles = getDemoViewerChatStyles();
      // Sender message bubble should use button background like user messages
      expect(styles).toMatch(/\.sender-message\s+\.message-text\s*\{[^}]*--vscode-button-background/);
    });
  });
});
