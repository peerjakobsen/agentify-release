/**
 * Tests for Outcome Panel feature
 * Task Group 1: Type system and state management tests
 * Task Group 2: Content rendering tests
 * Task Group 3: UI component tests
 * Task Group 4: Integration tests
 * Task Group 5: Strategic gap-filling tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isWorkflowErrorEvent,
  isWorkflowCompleteEvent,
} from '../types/events';
import type {
  WorkflowCompleteEvent,
  WorkflowErrorEvent,
  NodeStartEvent,
} from '../types/events';
import type { OutcomePanelState } from '../types/logPanel';
import { DEFAULT_OUTCOME_PANEL_STATE } from '../types/logPanel';
import {
  renderMarkdown,
  tokenizeJson,
  truncateJsonContent,
  truncateMarkdownContent,
  renderResultContent,
  containsBinaryData,
  generateOutcomePanelHtml,
  generateOutcomePanelCss,
  generateOutcomePanelJs,
  escapeHtml,
} from '../utils/outcomePanelHtmlGenerator';

// ============================================================================
// Task Group 1: Type System and State Management Tests
// ============================================================================

describe('Task Group 1: Type Guards and State Management', () => {
  const baseEvent = {
    workflow_id: 'wf-test-123',
    timestamp: Date.now(),
  };

  describe('isWorkflowErrorEvent type guard', () => {
    it('should return true for valid error events', () => {
      const errorEvent: WorkflowErrorEvent = {
        ...baseEvent,
        type: 'workflow_error',
        error_message: 'Something went wrong',
      };

      expect(isWorkflowErrorEvent(errorEvent)).toBe(true);
    });

    it('should return true for error events with optional fields', () => {
      const errorEvent: WorkflowErrorEvent = {
        ...baseEvent,
        type: 'workflow_error',
        error_message: 'Connection timeout',
        error_code: 'ERR_TIMEOUT',
        execution_time_ms: 5000,
      };

      expect(isWorkflowErrorEvent(errorEvent)).toBe(true);
    });

    it('should return false for non-error events', () => {
      const startEvent: NodeStartEvent = {
        ...baseEvent,
        type: 'node_start',
        node_id: 'agent-1',
      };

      expect(isWorkflowErrorEvent(startEvent)).toBe(false);
    });

    it('should return false for events missing error_message', () => {
      const invalidEvent = {
        ...baseEvent,
        type: 'workflow_error',
        // missing error_message
      };

      expect(isWorkflowErrorEvent(invalidEvent as WorkflowErrorEvent)).toBe(false);
    });
  });

  describe('isWorkflowCompleteEvent with result/sources', () => {
    it('should identify workflow_complete events with string result', () => {
      const completeEvent: WorkflowCompleteEvent = {
        ...baseEvent,
        type: 'workflow_complete',
        status: 'completed',
        execution_time_ms: 12500,
        execution_order: ['agent-1', 'agent-2'],
        result: '# Analysis Complete\n\nThe forecast shows positive growth.',
        sources: ['SAP S/4HANA', 'Databricks'],
      };

      expect(isWorkflowCompleteEvent(completeEvent)).toBe(true);
      expect(completeEvent.result).toBe('# Analysis Complete\n\nThe forecast shows positive growth.');
      expect(completeEvent.sources).toEqual(['SAP S/4HANA', 'Databricks']);
    });

    it('should identify workflow_complete events with object result', () => {
      const completeEvent: WorkflowCompleteEvent = {
        ...baseEvent,
        type: 'workflow_complete',
        status: 'completed',
        execution_time_ms: 8000,
        execution_order: ['agent-1'],
        result: { forecast: 15.5, confidence: 0.92 },
        sources: ['Weather API'],
      };

      expect(isWorkflowCompleteEvent(completeEvent)).toBe(true);
      expect(completeEvent.result).toEqual({ forecast: 15.5, confidence: 0.92 });
    });

    it('should identify workflow_complete events without result/sources', () => {
      const completeEvent: WorkflowCompleteEvent = {
        ...baseEvent,
        type: 'workflow_complete',
        status: 'completed',
        execution_time_ms: 3000,
        execution_order: [],
      };

      expect(isWorkflowCompleteEvent(completeEvent)).toBe(true);
      expect(completeEvent.result).toBeUndefined();
      expect(completeEvent.sources).toBeUndefined();
    });
  });

  describe('OutcomePanelState initialization and transitions', () => {
    it('should have correct default state', () => {
      expect(DEFAULT_OUTCOME_PANEL_STATE.status).toBe('hidden');
      expect(DEFAULT_OUTCOME_PANEL_STATE.isExpanded).toBe(false);
      expect(DEFAULT_OUTCOME_PANEL_STATE.result).toBeUndefined();
      expect(DEFAULT_OUTCOME_PANEL_STATE.sources).toBeUndefined();
      expect(DEFAULT_OUTCOME_PANEL_STATE.errorMessage).toBeUndefined();
    });

    it('should support success state with result', () => {
      const successState: OutcomePanelState = {
        status: 'success',
        result: '# Result\n\nWorkflow completed successfully.',
        sources: ['SAP S/4HANA', 'Salesforce CRM'],
        isExpanded: false,
      };

      expect(successState.status).toBe('success');
      expect(successState.result).toBeDefined();
      expect(successState.sources).toHaveLength(2);
    });

    it('should support error state with message', () => {
      const errorState: OutcomePanelState = {
        status: 'error',
        errorMessage: 'Connection failed to SAP system',
        errorCode: 'ERR_CONNECTION',
        isExpanded: false,
      };

      expect(errorState.status).toBe('error');
      expect(errorState.errorMessage).toBe('Connection failed to SAP system');
      expect(errorState.errorCode).toBe('ERR_CONNECTION');
    });

    it('should support state clearing behavior', () => {
      // Start with success state
      let state: OutcomePanelState = {
        status: 'success',
        result: 'Some result',
        sources: ['Source 1'],
        isExpanded: true,
      };

      // Clear for new run (simulate clearing)
      state = { ...DEFAULT_OUTCOME_PANEL_STATE };

      expect(state.status).toBe('hidden');
      expect(state.result).toBeUndefined();
      expect(state.sources).toBeUndefined();
      expect(state.isExpanded).toBe(false);
    });
  });
});

// ============================================================================
// Task Group 2: Content Rendering Tests
// ============================================================================

describe('Task Group 2: Content Rendering', () => {
  describe('Markdown header rendering', () => {
    it('should render H1-H6 headers', () => {
      expect(renderMarkdown('# Heading 1')).toContain('outcome-h1');
      expect(renderMarkdown('## Heading 2')).toContain('outcome-h2');
      expect(renderMarkdown('### Heading 3')).toContain('outcome-h3');
      expect(renderMarkdown('#### Heading 4')).toContain('outcome-h4');
      expect(renderMarkdown('##### Heading 5')).toContain('outcome-h5');
      expect(renderMarkdown('###### Heading 6')).toContain('outcome-h6');
    });

    it('should render header content correctly', () => {
      const result = renderMarkdown('# Main Title');
      expect(result).toContain('Main Title');
      expect(result).toContain('<h1');
    });
  });

  describe('Markdown bold/italic rendering', () => {
    it('should render bold text with **', () => {
      const result = renderMarkdown('This is **bold** text');
      expect(result).toContain('<strong>bold</strong>');
    });

    it('should render italic text with *', () => {
      const result = renderMarkdown('This is *italic* text');
      expect(result).toContain('<em>italic</em>');
    });

    it('should handle mixed bold and italic', () => {
      const result = renderMarkdown('**bold** and *italic*');
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
    });
  });

  describe('Markdown list rendering', () => {
    it('should render bulleted lists', () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3';
      const result = renderMarkdown(markdown);
      expect(result).toContain('outcome-list');
      expect(result).toContain('Item 1');
      expect(result).toContain('Item 2');
    });

    it('should render numbered lists', () => {
      const markdown = '1. First\n2. Second\n3. Third';
      const result = renderMarkdown(markdown);
      expect(result).toContain('outcome-list');
      expect(result).toContain('First');
      expect(result).toContain('Second');
    });
  });

  describe('Markdown code rendering', () => {
    it('should render inline code spans', () => {
      const result = renderMarkdown('Use `const` for constants');
      expect(result).toContain('outcome-code-inline');
      expect(result).toContain('const');
    });

    it('should render code blocks', () => {
      const markdown = '```javascript\nconst x = 1;\n```';
      const result = renderMarkdown(markdown);
      expect(result).toContain('outcome-code-block');
      expect(result).toContain('const x = 1;');
    });
  });

  describe('JSON rendering with syntax highlighting', () => {
    it('should highlight JSON string values', () => {
      const json = '{"name": "test"}';
      const result = tokenizeJson(json);
      expect(result).toContain('json-key');
      expect(result).toContain('json-string');
    });

    it('should highlight JSON numbers', () => {
      const json = '{"count": 42}';
      const result = tokenizeJson(json);
      expect(result).toContain('json-number');
    });

    it('should highlight JSON booleans', () => {
      const json = '{"active": true, "disabled": false}';
      const result = tokenizeJson(json);
      expect(result).toContain('json-boolean');
    });

    it('should highlight JSON null', () => {
      const json = '{"value": null}';
      const result = tokenizeJson(json);
      expect(result).toContain('json-null');
    });
  });

  describe('Content truncation', () => {
    it('should truncate JSON at 30 lines', () => {
      // Create JSON with more than 30 lines
      const largeObj: Record<string, number> = {};
      for (let i = 0; i < 50; i++) {
        largeObj[`key${i}`] = i;
      }

      const result = truncateJsonContent(largeObj, false);
      expect(result.isTruncated).toBe(true);
      expect(result.shownLines).toBe(20); // OUTCOME_JSON_PREVIEW_LINES
      expect(result.remainingLines).toBeGreaterThan(0);
    });

    it('should not truncate when expanded', () => {
      const largeObj: Record<string, number> = {};
      for (let i = 0; i < 50; i++) {
        largeObj[`key${i}`] = i;
      }

      const result = truncateJsonContent(largeObj, true);
      expect(result.isTruncated).toBe(false);
    });

    it('should truncate markdown at 100 lines', () => {
      const lines = Array(150).fill('Line of text').join('\n');
      const result = truncateMarkdownContent(lines, false);
      expect(result.isTruncated).toBe(true);
      expect(result.shownLines).toBe(100);
    });
  });

  describe('Empty result handling', () => {
    it('should show message for empty result', () => {
      const result = renderResultContent(undefined, false);
      expect(result.html).toContain('Workflow completed with no output');
    });

    it('should show message for empty string result', () => {
      const result = renderResultContent('', false);
      expect(result.html).toContain('Workflow completed with no output');
    });
  });

  describe('Binary data detection', () => {
    it('should detect binary data', () => {
      const binaryContent = 'Some text\x00with null bytes';
      expect(containsBinaryData(binaryContent)).toBe(true);
    });

    it('should not flag normal text as binary', () => {
      const normalContent = 'Regular text with\nnewlines and\ttabs';
      expect(containsBinaryData(normalContent)).toBe(false);
    });

    it('should show message for binary content', () => {
      const binaryContent = 'Binary\x00data';
      const result = renderResultContent(binaryContent, false);
      expect(result.html).toContain('binary data');
    });
  });
});

// ============================================================================
// Task Group 3: UI Component Tests
// ============================================================================

describe('Task Group 3: UI Components', () => {
  describe('Success state panel', () => {
    it('should generate success panel HTML structure', () => {
      const state: OutcomePanelState = {
        status: 'success',
        result: '# Analysis Complete',
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(state);
      expect(html).toContain('outcome-panel-success');
      expect(html).toContain('outcome-icon-success');
      expect(html).toContain('Workflow Result');
    });

    it('should include copy button in success state', () => {
      const state: OutcomePanelState = {
        status: 'success',
        result: 'Some result content',
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(state);
      expect(html).toContain('outcome-copy-btn');
      expect(html).toContain('data-raw-content');
    });
  });

  describe('Error state panel', () => {
    it('should generate error panel HTML structure', () => {
      const state: OutcomePanelState = {
        status: 'error',
        errorMessage: 'Connection failed',
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(state);
      expect(html).toContain('outcome-panel-error');
      expect(html).toContain('outcome-icon-error');
      expect(html).toContain('Workflow Error');
      expect(html).toContain('Connection failed');
    });

    it('should escape HTML in error messages', () => {
      const state: OutcomePanelState = {
        status: 'error',
        errorMessage: '<script>alert("xss")</script>',
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(state);
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('Sources line rendering', () => {
    it('should render sources when provided', () => {
      const state: OutcomePanelState = {
        status: 'success',
        result: 'Result',
        sources: ['SAP S/4HANA', 'Databricks', 'Weather API'],
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(state);
      expect(html).toContain('outcome-sources');
      expect(html).toContain('SAP S/4HANA');
      expect(html).toContain('Databricks');
      expect(html).toContain('Weather API');
    });

    it('should not render sources when empty', () => {
      const state: OutcomePanelState = {
        status: 'success',
        result: 'Result',
        sources: [],
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(state);
      expect(html).not.toContain('outcome-sources');
    });
  });

  describe('Hidden state', () => {
    it('should return empty string when status is hidden', () => {
      const state: OutcomePanelState = {
        status: 'hidden',
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(state);
      expect(html).toBe('');
    });
  });

  describe('Panel clearing', () => {
    it('should generate no HTML after clearing to hidden state', () => {
      // Simulate success -> hidden transition
      const successState: OutcomePanelState = {
        status: 'success',
        result: 'Previous result',
        isExpanded: false,
      };
      const successHtml = generateOutcomePanelHtml(successState);
      expect(successHtml).not.toBe('');

      // Clear state
      const clearedState: OutcomePanelState = {
        ...DEFAULT_OUTCOME_PANEL_STATE,
      };
      const clearedHtml = generateOutcomePanelHtml(clearedState);
      expect(clearedHtml).toBe('');
    });
  });
});

// ============================================================================
// Task Group 4: Integration Tests
// ============================================================================

describe('Task Group 4: Demo Viewer Integration', () => {
  describe('Panel position and hierarchy', () => {
    it('should generate outcome panel HTML with correct ID for positioning', () => {
      const state: OutcomePanelState = {
        status: 'success',
        result: 'Analysis complete',
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(state);
      // Panel should have the outcomePanel id for positioning after Execution Log
      expect(html).toContain('id="outcomePanel"');
    });

    it('should generate CSS that can be embedded in Demo Viewer', () => {
      const css = generateOutcomePanelCss();
      // CSS should define outcome panel styles
      expect(css).toContain('.outcome-panel');
      expect(css).toContain('.outcome-panel-success');
      expect(css).toContain('.outcome-panel-error');
    });

    it('should generate JS handlers for outcome panel interactions', () => {
      const js = generateOutcomePanelJs();
      // JS should handle copy and expand interactions
      expect(js).toContain('outcome-copy-btn');
      expect(js).toContain('outcome-show-more');
      expect(js).toContain('outcomePanelToggleExpand');
    });
  });

  describe('workflow_complete event updates panel with success state', () => {
    it('should create success state from workflow_complete event with string result', () => {
      // Simulate the state transformation that happens when workflow_complete arrives
      const eventData: WorkflowCompleteEvent = {
        workflow_id: 'wf-123',
        timestamp: Date.now(),
        type: 'workflow_complete',
        status: 'completed',
        execution_time_ms: 5000,
        execution_order: ['agent-1'],
        result: '# Report\n\n**Success!**',
        sources: ['SAP S/4HANA', 'Databricks'],
      };

      // Transform event to panel state
      const panelState: OutcomePanelState = {
        status: 'success',
        result: eventData.result,
        sources: eventData.sources,
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(panelState);
      expect(html).toContain('outcome-panel-success');
      expect(html).toContain('Report');
      expect(html).toContain('SAP S/4HANA');
    });

    it('should create success state from workflow_complete event with object result', () => {
      const eventData: WorkflowCompleteEvent = {
        workflow_id: 'wf-123',
        timestamp: Date.now(),
        type: 'workflow_complete',
        status: 'completed',
        execution_time_ms: 3000,
        execution_order: ['agent-1'],
        result: { forecast: 15.5, confidence: 0.92 },
        sources: ['Weather API'],
      };

      const panelState: OutcomePanelState = {
        status: 'success',
        result: eventData.result,
        sources: eventData.sources,
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(panelState);
      expect(html).toContain('outcome-panel-success');
      expect(html).toContain('json-number'); // JSON rendering with syntax highlighting
    });
  });

  describe('workflow_error event updates panel with error state', () => {
    it('should create error state from workflow_error event', () => {
      const eventData: WorkflowErrorEvent = {
        workflow_id: 'wf-123',
        timestamp: Date.now(),
        type: 'workflow_error',
        error_message: 'Connection to SAP system failed: timeout after 30s',
        error_code: 'ERR_TIMEOUT',
      };

      // Transform event to panel state
      const panelState: OutcomePanelState = {
        status: 'error',
        errorMessage: eventData.error_message,
        errorCode: eventData.error_code,
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(panelState);
      expect(html).toContain('outcome-panel-error');
      expect(html).toContain('Connection to SAP system failed');
    });

    it('should handle workflow_error without optional error_code', () => {
      const eventData: WorkflowErrorEvent = {
        workflow_id: 'wf-123',
        timestamp: Date.now(),
        type: 'workflow_error',
        error_message: 'Unexpected error occurred',
      };

      const panelState: OutcomePanelState = {
        status: 'error',
        errorMessage: eventData.error_message,
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(panelState);
      expect(html).toContain('outcome-panel-error');
      expect(html).toContain('Unexpected error occurred');
    });
  });

  describe('Panel clears when handleRunWorkflow is called', () => {
    it('should reset state to hidden when new workflow starts', () => {
      // Simulate previous success state
      let panelState: OutcomePanelState = {
        status: 'success',
        result: 'Previous result from last run',
        sources: ['Source A', 'Source B'],
        isExpanded: true,
      };

      expect(generateOutcomePanelHtml(panelState)).not.toBe('');

      // Simulate clearing that happens in handleRunWorkflow
      panelState = { ...DEFAULT_OUTCOME_PANEL_STATE };

      expect(panelState.status).toBe('hidden');
      expect(panelState.result).toBeUndefined();
      expect(panelState.sources).toBeUndefined();
      expect(panelState.isExpanded).toBe(false);
      expect(generateOutcomePanelHtml(panelState)).toBe('');
    });

    it('should clear error state when new workflow starts', () => {
      let panelState: OutcomePanelState = {
        status: 'error',
        errorMessage: 'Previous error',
        errorCode: 'ERR_PREV',
        isExpanded: false,
      };

      expect(generateOutcomePanelHtml(panelState)).not.toBe('');

      // Clear on new run
      panelState = { ...DEFAULT_OUTCOME_PANEL_STATE };

      expect(panelState.status).toBe('hidden');
      expect(panelState.errorMessage).toBeUndefined();
      expect(generateOutcomePanelHtml(panelState)).toBe('');
    });
  });

  describe('Copy button copies correct content', () => {
    it('should include raw string content in data attribute for copy', () => {
      const state: OutcomePanelState = {
        status: 'success',
        result: 'Plain text result to copy',
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(state);
      expect(html).toContain('data-raw-content');
      expect(html).toContain('Plain text result to copy');
    });

    it('should include stringified JSON in data attribute for copy', () => {
      const result = { key: 'value', nested: { count: 42 } };
      const state: OutcomePanelState = {
        status: 'success',
        result,
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(state);
      expect(html).toContain('data-raw-content');
      // JSON is stored as escaped HTML in the data attribute
    });

    it('should handle special characters in copy content', () => {
      const state: OutcomePanelState = {
        status: 'success',
        result: 'Text with "quotes" and <angle brackets>',
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(state);
      // Special characters should be escaped in data attribute
      expect(html).toContain('data-raw-content');
      expect(html).toContain('&quot;');
      expect(html).toContain('&lt;');
    });
  });

  describe('Show full result link expands truncated content', () => {
    it('should show expand link for large JSON result', () => {
      const largeObj: Record<string, number> = {};
      for (let i = 0; i < 50; i++) {
        largeObj[`key${i}`] = i;
      }

      const state: OutcomePanelState = {
        status: 'success',
        result: largeObj,
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(state);
      expect(html).toContain('outcome-show-more');
      expect(html).toContain('Show full result...');
      expect(html).toContain('data-action="expand"');
    });

    it('should show collapse link when expanded', () => {
      const largeObj: Record<string, number> = {};
      for (let i = 0; i < 50; i++) {
        largeObj[`key${i}`] = i;
      }

      const state: OutcomePanelState = {
        status: 'success',
        result: largeObj,
        isExpanded: true, // Expanded state
      };

      const html = generateOutcomePanelHtml(state);
      // When expanded, no truncation occurs so no show-more link
      expect(html).not.toContain('outcome-show-more');
    });

    it('should not show expand link for small content', () => {
      const state: OutcomePanelState = {
        status: 'success',
        result: 'Short result',
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(state);
      expect(html).not.toContain('outcome-show-more');
    });
  });
});

// ============================================================================
// Task Group 5: Strategic Gap-Filling Tests
// ============================================================================

describe('Task Group 5: Strategic Gap-Filling Tests', () => {
  describe('Multi-run state transition cycles', () => {
    it('should correctly transition through multiple workflow runs (success -> hidden -> error -> hidden -> success)', () => {
      // Run 1: Success
      let panelState: OutcomePanelState = {
        status: 'success',
        result: '# First Run\n\nCompleted successfully',
        sources: ['SAP S/4HANA'],
        isExpanded: false,
      };
      let html = generateOutcomePanelHtml(panelState);
      expect(html).toContain('outcome-panel-success');
      expect(html).toContain('First Run');

      // Clear for Run 2
      panelState = { ...DEFAULT_OUTCOME_PANEL_STATE };
      html = generateOutcomePanelHtml(panelState);
      expect(html).toBe('');

      // Run 2: Error
      panelState = {
        status: 'error',
        errorMessage: 'Second run failed',
        errorCode: 'ERR_RUN2',
        isExpanded: false,
      };
      html = generateOutcomePanelHtml(panelState);
      expect(html).toContain('outcome-panel-error');
      expect(html).toContain('Second run failed');

      // Clear for Run 3
      panelState = { ...DEFAULT_OUTCOME_PANEL_STATE };
      html = generateOutcomePanelHtml(panelState);
      expect(html).toBe('');

      // Run 3: Success again
      panelState = {
        status: 'success',
        result: '# Third Run\n\nRecovered successfully',
        sources: ['Databricks', 'Weather API'],
        isExpanded: false,
      };
      html = generateOutcomePanelHtml(panelState);
      expect(html).toContain('outcome-panel-success');
      expect(html).toContain('Third Run');
      expect(html).toContain('Databricks');
    });
  });

  describe('Complex combined markdown formatting', () => {
    it('should render markdown with headers, bold, italic, lists, and code combined', () => {
      const complexMarkdown = `# Analysis Report

## Summary

This report shows **important findings** with *critical insights*.

### Key Points

- First point with \`inline code\`
- Second point is **bold** and *italic*
- Third point

### Code Example

\`\`\`python
def analyze():
    return "result"
\`\`\`

1. Step one
2. Step two
3. Step three`;

      const result = renderMarkdown(complexMarkdown);

      // Verify headers
      expect(result).toContain('outcome-h1');
      expect(result).toContain('Analysis Report');
      expect(result).toContain('outcome-h2');
      expect(result).toContain('Summary');
      expect(result).toContain('outcome-h3');

      // Verify bold and italic
      expect(result).toContain('<strong>important findings</strong>');
      expect(result).toContain('<em>critical insights</em>');

      // Verify inline code
      expect(result).toContain('outcome-code-inline');

      // Verify code block
      expect(result).toContain('outcome-code-block');
      expect(result).toContain('def analyze');

      // Verify lists
      expect(result).toContain('outcome-list');
    });
  });

  describe('Sources with special characters', () => {
    it('should properly escape HTML in source names', () => {
      const state: OutcomePanelState = {
        status: 'success',
        result: 'Result',
        sources: [
          'SAP <Enterprise>',
          'System "A" & System "B"',
          'Test\'s API',
        ],
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(state);
      expect(html).toContain('outcome-sources');
      // HTML entities should be escaped
      expect(html).toContain('SAP &lt;Enterprise&gt;');
      expect(html).toContain('System &quot;A&quot; &amp; System &quot;B&quot;');
      expect(html).toContain('Test&#39;s API');
      // Raw HTML should not be present
      expect(html).not.toContain('<Enterprise>');
    });
  });

  describe('Large markdown truncation with expand link', () => {
    it('should truncate large markdown and show expand link in rendered HTML', () => {
      // Create markdown with more than 100 lines
      const lines: string[] = [];
      for (let i = 1; i <= 150; i++) {
        lines.push(`Line ${i}: This is content for demonstration purposes.`);
      }
      const largeMarkdown = lines.join('\n');

      const state: OutcomePanelState = {
        status: 'success',
        result: largeMarkdown,
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(state);

      // Should contain first lines
      expect(html).toContain('Line 1:');
      expect(html).toContain('Line 50:');

      // Should have expand link
      expect(html).toContain('outcome-show-more');
      expect(html).toContain('Show full result...');

      // When expanded, no truncation
      const expandedState: OutcomePanelState = {
        ...state,
        isExpanded: true,
      };
      const expandedHtml = generateOutcomePanelHtml(expandedState);
      expect(expandedHtml).toContain('Line 150:');
      expect(expandedHtml).not.toContain('outcome-show-more');
    });
  });

  describe('Deep nested JSON rendering', () => {
    it('should render deeply nested JSON with correct syntax highlighting', () => {
      const nestedObj = {
        level1: {
          level2: {
            level3: {
              stringValue: 'deep string',
              numberValue: 42.5,
              boolValue: true,
              nullValue: null,
              arrayValue: [1, 2, 3],
            },
          },
        },
        metadata: {
          source: 'test',
          count: 100,
        },
      };

      const state: OutcomePanelState = {
        status: 'success',
        result: nestedObj,
        isExpanded: false,
      };

      const html = generateOutcomePanelHtml(state);

      // Check JSON rendering classes
      expect(html).toContain('json-key');
      expect(html).toContain('json-string');
      expect(html).toContain('json-number');
      expect(html).toContain('json-boolean');
      expect(html).toContain('json-null');

      // Check content
      expect(html).toContain('deep string');
      expect(html).toContain('42.5');
      expect(html).toContain('level3');
    });
  });

  describe('End-to-end error event flow', () => {
    it('should correctly handle full error event flow from event data to rendered HTML', () => {
      // Step 1: Create error event (simulating Python subprocess output)
      const errorEvent: WorkflowErrorEvent = {
        workflow_id: 'wf-e2e-error-test',
        timestamp: Date.now(),
        type: 'workflow_error',
        error_message: 'SAP connection timeout: unable to reach host sap.example.com:443 after 30s',
        error_code: 'ERR_SAP_TIMEOUT',
        execution_time_ms: 30500,
      };

      // Step 2: Verify type guard identifies it correctly
      expect(isWorkflowErrorEvent(errorEvent)).toBe(true);

      // Step 3: Transform to panel state (as Demo Viewer would)
      const panelState: OutcomePanelState = {
        status: 'error',
        errorMessage: errorEvent.error_message,
        errorCode: errorEvent.error_code,
        isExpanded: false,
      };

      // Step 4: Generate HTML
      const html = generateOutcomePanelHtml(panelState);

      // Step 5: Verify all expected elements are present
      expect(html).toContain('outcome-panel-error');
      expect(html).toContain('outcome-icon-error');
      expect(html).toContain('Workflow Error');
      expect(html).toContain('SAP connection timeout');
      expect(html).toContain('sap.example.com');

      // Step 6: Verify no copy button (error state has no copy)
      expect(html).not.toContain('outcome-copy-btn');
    });
  });

  describe('Markdown XSS prevention', () => {
    it('should prevent XSS through markdown content by escaping HTML tags', () => {
      const maliciousMarkdown = `# Title <script>alert('xss')</script>

**Bold <img src=x onerror=alert('xss')>**

- Item with <a href="javascript:alert('xss')">link</a>

\`code <script>alert('xss')</script>\``;

      const result = renderMarkdown(maliciousMarkdown);

      // Script tags should be escaped - no active <script> elements
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');

      // Img tags should be escaped - no active <img> elements
      // The < and > are escaped, making the onerror attribute harmless text
      expect(result).not.toContain('<img');
      expect(result).toContain('&lt;img');

      // Anchor tags should be escaped - no active <a> elements
      expect(result).not.toContain('<a href');
      expect(result).toContain('&lt;a href');

      // The javascript: protocol is now just text, not an active link
      expect(result).not.toContain('href="javascript:');
    });
  });

  describe('Error to success recovery', () => {
    it('should properly transition from error state to new success state', () => {
      // Initial error state from failed run
      let panelState: OutcomePanelState = {
        status: 'error',
        errorMessage: 'Integration failed: database connection lost',
        errorCode: 'ERR_DB_CONN',
        isExpanded: false,
      };

      let html = generateOutcomePanelHtml(panelState);
      expect(html).toContain('outcome-panel-error');
      expect(html).toContain('database connection lost');
      expect(html).not.toContain('outcome-panel-success');

      // Clear state (simulating handleRunWorkflow)
      panelState = { ...DEFAULT_OUTCOME_PANEL_STATE };
      expect(generateOutcomePanelHtml(panelState)).toBe('');

      // New successful run
      panelState = {
        status: 'success',
        result: {
          status: 'recovered',
          reconnection_time_ms: 250,
          data_integrity: 'verified',
        },
        sources: ['PostgreSQL', 'Redis Cache'],
        isExpanded: false,
      };

      html = generateOutcomePanelHtml(panelState);
      expect(html).toContain('outcome-panel-success');
      expect(html).not.toContain('outcome-panel-error');
      expect(html).toContain('recovered');
      expect(html).toContain('PostgreSQL');
      expect(html).toContain('json-key');

      // Verify error state is completely gone
      expect(html).not.toContain('database connection lost');
      expect(html).not.toContain('ERR_DB_CONN');
    });
  });
});
