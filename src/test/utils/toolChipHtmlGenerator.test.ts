/**
 * Tests for Tool Chip HTML Generation
 * Task Group 3: HTML Generation Layer
 *
 * Tests for tool chip HTML rendering functions
 * for the Tool Call Visualization feature.
 */

import { describe, it, expect } from 'vitest';
import {
  generateToolChipHtml,
  generateToolChipsContainerHtml,
  generateToolChipDetailsHtml,
} from '../../utils/chatPanelHtmlGenerator';
import type { ToolCallEvent } from '../../types/events';
import type { MergedToolCallEvent } from '../../utils/chatStateUtils';

// ============================================================================
// Task 3.1: 5-7 Focused Tests for Tool Chip HTML Generation
// ============================================================================

describe('Task Group 3: Tool Chip HTML Generation', () => {
  describe('Test 1: generateToolChipHtml renders correct class for running state', () => {
    it('should render with running class for status=started', () => {
      const toolEvent: ToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Triage Agent',
        system: 'SAP',
        operation: 'get_customer',
        input: { id: '123' },
        status: 'started',
      };

      const html = generateToolChipHtml(toolEvent);

      expect(html).toContain('tool-chip running');
    });

    it('should include spinner element for running state', () => {
      const toolEvent: ToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Triage Agent',
        system: 'SAP',
        operation: 'get_customer',
        input: {},
        status: 'started',
      };

      const html = generateToolChipHtml(toolEvent);

      expect(html).toContain('tool-chip-spinner');
    });
  });

  describe('Test 2: generateToolChipHtml renders correct class for completed state', () => {
    it('should render with completed class for status=completed', () => {
      const toolEvent: ToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Triage Agent',
        system: 'SAP',
        operation: 'get_customer',
        input: {},
        output: { name: 'Acme' },
        status: 'completed',
      };

      const html = generateToolChipHtml(toolEvent);

      expect(html).toContain('tool-chip completed');
    });

    it('should include checkmark Unicode icon for completed state', () => {
      const toolEvent: ToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Triage Agent',
        system: 'SAP',
        operation: 'get_customer',
        input: {},
        output: {},
        status: 'completed',
      };

      const html = generateToolChipHtml(toolEvent);

      // Should contain checkmark Unicode character
      expect(html).toMatch(/&#10003;|&#x2713;|\u2713/);
    });
  });

  describe('Test 3: generateToolChipHtml renders correct class for failed state', () => {
    it('should render with failed class for status=failed', () => {
      const toolEvent: ToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Triage Agent',
        system: 'SAP',
        operation: 'get_customer',
        input: {},
        status: 'failed',
        error_message: 'Connection failed',
      };

      const html = generateToolChipHtml(toolEvent);

      expect(html).toContain('tool-chip failed');
    });

    it('should include X Unicode icon for failed state', () => {
      const toolEvent: ToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Triage Agent',
        system: 'SAP',
        operation: 'get_customer',
        input: {},
        status: 'failed',
      };

      const html = generateToolChipHtml(toolEvent);

      // Should contain X Unicode character
      expect(html).toMatch(/&#10007;|&#x2717;|\u2717/);
    });
  });

  describe('Test 4: generateToolChipHtml renders system.operation label', () => {
    it('should render system and operation in chip label', () => {
      const toolEvent: ToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Triage Agent',
        system: 'SAP S/4HANA',
        operation: 'get_customer_order',
        input: {},
        status: 'completed',
      };

      const html = generateToolChipHtml(toolEvent);

      expect(html).toContain('SAP S/4HANA');
      expect(html).toContain('get_customer_order');
    });

    it('should escape HTML in system name', () => {
      const toolEvent: ToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Agent',
        system: '<script>evil</script>',
        operation: 'get',
        input: {},
        status: 'completed',
      };

      const html = generateToolChipHtml(toolEvent);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('Test 5: generateToolChipHtml includes data-tool-id attribute', () => {
    it('should include data-tool-id with composite key', () => {
      const toolEvent: ToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Triage Agent',
        system: 'SAP',
        operation: 'get_customer',
        input: {},
        status: 'completed',
      };

      const html = generateToolChipHtml(toolEvent);

      expect(html).toContain('data-tool-id="Triage Agent-SAP-get_customer-1704067201000"');
    });
  });

  describe('Test 6: generateToolChipsContainerHtml wraps chips correctly', () => {
    it('should render tool-chips-container wrapper', () => {
      const toolEvents: ToolCallEvent[] = [
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201000,
          event_type: 'tool_call',
          agent_name: 'Agent',
          system: 'SAP',
          operation: 'get',
          input: {},
          status: 'completed',
        },
      ];

      const html = generateToolChipsContainerHtml(toolEvents);

      expect(html).toContain('class="tool-chips-container"');
    });

    it('should render all tool chips inside container', () => {
      const toolEvents: ToolCallEvent[] = [
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201000,
          event_type: 'tool_call',
          agent_name: 'Agent',
          system: 'SAP',
          operation: 'get_customer',
          input: {},
          status: 'completed',
        },
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201010,
          event_type: 'tool_call',
          agent_name: 'Agent',
          system: 'CRM',
          operation: 'get_orders',
          input: {},
          status: 'started',
        },
      ];

      const html = generateToolChipsContainerHtml(toolEvents);

      expect(html).toContain('get_customer');
      expect(html).toContain('get_orders');
      expect(html).toContain('SAP');
      expect(html).toContain('CRM');
    });

    it('should return empty string when no tool calls', () => {
      const html = generateToolChipsContainerHtml([]);

      expect(html).toBe('');
    });
  });

  describe('Test 7: generateToolChipDetailsHtml renders input/output/error', () => {
    it('should render input section when input is present', () => {
      const toolEvent: MergedToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Agent',
        system: 'SAP',
        operation: 'get',
        input: { customer_id: '12345' },
        status: 'completed',
      };

      const html = generateToolChipDetailsHtml(toolEvent);

      expect(html).toContain('Input');
      expect(html).toContain('customer_id');
      expect(html).toContain('12345');
    });

    it('should render output section when output is present', () => {
      const toolEvent: MergedToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Agent',
        system: 'SAP',
        operation: 'get',
        input: {},
        output: { name: 'Acme Corp' },
        status: 'completed',
      };

      const html = generateToolChipDetailsHtml(toolEvent);

      expect(html).toContain('Output');
      expect(html).toContain('name');
      expect(html).toContain('Acme Corp');
    });

    it('should render error section when error_message is present', () => {
      const toolEvent: MergedToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Agent',
        system: 'SAP',
        operation: 'get',
        input: {},
        status: 'failed',
        error_message: 'Connection timeout',
      };

      const html = generateToolChipDetailsHtml(toolEvent);

      expect(html).toContain('Error');
      expect(html).toContain('Connection timeout');
      expect(html).toContain('tool-chip-error-text');
    });

    it('should render duration when duration_ms is present', () => {
      const toolEvent: MergedToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Agent',
        system: 'SAP',
        operation: 'get',
        input: {},
        output: {},
        status: 'completed',
        duration_ms: 142,
      };

      const html = generateToolChipDetailsHtml(toolEvent);

      expect(html).toContain('142ms');
    });

    it('should format JSON with proper indentation', () => {
      const toolEvent: MergedToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Agent',
        system: 'SAP',
        operation: 'get',
        input: { id: '123', type: 'customer' },
        status: 'completed',
      };

      const html = generateToolChipDetailsHtml(toolEvent);

      // JSON should be formatted (pretty-printed)
      expect(html).toContain('tool-chip-json');
    });

    it('should escape HTML in input/output values', () => {
      const toolEvent: MergedToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Agent',
        system: 'SAP',
        operation: 'get',
        input: { query: '<script>alert("xss")</script>' },
        status: 'completed',
      };

      const html = generateToolChipDetailsHtml(toolEvent);

      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;');
    });
  });
});
