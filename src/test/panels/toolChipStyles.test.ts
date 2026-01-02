/**
 * Tests for Tool Chip CSS Styles
 * Task Group 2: CSS Styling Layer
 *
 * Tests for tool chip CSS classes and styling patterns
 * for the Tool Call Visualization feature.
 */

import { describe, it, expect } from 'vitest';
import { getDemoViewerChatStyles } from '../../panels/demoViewerChatStyles';

// ============================================================================
// Task 2.1: 3-4 Focused Tests for CSS Class Presence and Structure
// ============================================================================

describe('Task Group 2: Tool Chip CSS Styles', () => {
  describe('Test 1: Tool chips container class exists', () => {
    it('should include .tool-chips-container class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.tool-chips-container');
    });

    it('should style tool-chips-container with flex display and wrap', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toMatch(/\.tool-chips-container\s*\{[^}]*display:\s*flex/);
      expect(styles).toMatch(/\.tool-chips-container\s*\{[^}]*flex-wrap:\s*wrap/);
    });

    it('should include gap for spacing between chips', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toMatch(/\.tool-chips-container\s*\{[^}]*gap:\s*4px/);
    });

    it('should include margin-top for spacing from message content', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toMatch(/\.tool-chips-container\s*\{[^}]*margin-top:\s*8px/);
    });
  });

  describe('Test 2: Tool chip state classes exist', () => {
    it('should include .tool-chip.running class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.tool-chip.running');
    });

    it('should include .tool-chip.completed class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.tool-chip.completed');
    });

    it('should include .tool-chip.failed class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.tool-chip.failed');
    });

    it('should include base .tool-chip class', () => {
      const styles = getDemoViewerChatStyles();
      // Check for .tool-chip followed by { but not immediately preceded by a modifier class
      expect(styles).toMatch(/\.tool-chip\s*\{/);
    });
  });

  describe('Test 3: Tool chip details class for expanded view exists', () => {
    it('should include .tool-chip-details class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.tool-chip-details');
    });

    it('should include .tool-chip-details-section class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.tool-chip-details-section');
    });

    it('should include .tool-chip-details-label class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.tool-chip-details-label');
    });

    it('should include .tool-chip-json class for JSON formatting', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.tool-chip-json');
    });

    it('should include .tool-chip-error-text class for error messages', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.tool-chip-error-text');
    });

    it('should include .tool-chip-show-more class for truncated output', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.tool-chip-show-more');
    });
  });

  describe('Test 4: Tool chip spinner class for running state animation', () => {
    it('should include .tool-chip-spinner class', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toContain('.tool-chip-spinner');
    });

    it('should use CSS spinner animation (not codicon)', () => {
      const styles = getDemoViewerChatStyles();
      // CSS spinner pattern: border-based spinner with animation
      expect(styles).toMatch(/\.tool-chip-spinner\s*\{[^}]*border/);
      expect(styles).toMatch(/\.tool-chip-spinner\s*\{[^}]*animation:\s*spin/);
    });

    it('should not use codicon classes for spinner', () => {
      const styles = getDemoViewerChatStyles();
      // Should NOT contain codicon-loading reference
      expect(styles).not.toContain('.codicon-loading');
    });
  });

  describe('Tool chip visual styling', () => {
    it('should use VS Code theme variables for running state', () => {
      const styles = getDemoViewerChatStyles();
      // Running state should use muted background
      expect(styles).toContain('--vscode-input-background');
    });

    it('should use green styling for completed state', () => {
      const styles = getDemoViewerChatStyles();
      // Completed state should use green tint
      expect(styles).toMatch(/\.tool-chip\.completed\s*\{[^}]*rgba\(115,\s*201,\s*145/);
    });

    it('should use error styling for failed state', () => {
      const styles = getDemoViewerChatStyles();
      // Failed state should use error background
      expect(styles).toMatch(/\.tool-chip\.failed\s*\{[^}]*--vscode-inputValidation-errorBackground/);
    });

    it('should use error border for failed state', () => {
      const styles = getDemoViewerChatStyles();
      // Failed state should have error border
      expect(styles).toMatch(/\.tool-chip\.failed\s*\{[^}]*--vscode-inputValidation-errorBorder/);
    });

    it('should style chip with cursor pointer for click interaction', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toMatch(/\.tool-chip\s*\{[^}]*cursor:\s*pointer/);
    });

    it('should include inline-flex display for chip alignment', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toMatch(/\.tool-chip\s*\{[^}]*display:\s*inline-flex/);
    });
  });

  describe('Tool chip details styling', () => {
    it('should style details with background color', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toMatch(/\.tool-chip-details\s*\{[^}]*background/);
    });

    it('should style JSON with monospace font', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toMatch(/\.tool-chip-json\s*\{[^}]*font-family:\s*var\(--vscode-editor-font-family\)/);
    });

    it('should style error text with error foreground color', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toMatch(/\.tool-chip-error-text\s*\{[^}]*--vscode-errorForeground/);
    });

    it('should style show-more link with link color', () => {
      const styles = getDemoViewerChatStyles();
      expect(styles).toMatch(/\.tool-chip-show-more\s*\{[^}]*--vscode-textLink-foreground/);
    });
  });
});
