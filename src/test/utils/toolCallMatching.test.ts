/**
 * Tests for Tool Call Matching and State Management
 * Task Group 1: Data Types and State Management
 *
 * Tests for tool event matching, pairing, and ChatMessage extensions
 * for the Tool Call Visualization feature.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ToolCallEvent } from '../../types/events';
import type { ChatMessage } from '../../types/chatPanel';
import {
  generateToolId,
  mergeToolCallPairs,
  matchToolEventsToMessages,
} from '../../utils/chatStateUtils';

// ============================================================================
// Task 1.1: 6-8 Focused Tests for Type Extensions and State Matching
// ============================================================================

describe('Task Group 1: Tool Call Types and State Matching', () => {
  describe('Test 1: ChatMessage interface accepts endTimestamp and toolCalls fields', () => {
    it('should accept endTimestamp as optional number field', () => {
      const message: ChatMessage = {
        id: 'msg-001',
        role: 'agent',
        agentName: 'Triage Agent',
        content: 'Processing your request...',
        timestamp: 1704067200000,
        isStreaming: false,
        pane: 'conversation',
        endTimestamp: 1704067205000,
        toolCalls: [],
      };

      expect(message.endTimestamp).toBe(1704067205000);
    });

    it('should accept toolCalls as ToolCallEvent array', () => {
      const toolCall: ToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Triage Agent',
        system: 'SAP S/4HANA',
        operation: 'get_customer',
        input: { customer_id: '12345' },
        output: { name: 'Acme Corp' },
        status: 'completed',
      };

      const message: ChatMessage = {
        id: 'msg-002',
        role: 'agent',
        agentName: 'Triage Agent',
        content: 'Found customer data.',
        timestamp: 1704067200000,
        isStreaming: false,
        pane: 'conversation',
        endTimestamp: 1704067205000,
        toolCalls: [toolCall],
      };

      expect(message.toolCalls).toHaveLength(1);
      expect(message.toolCalls[0].system).toBe('SAP S/4HANA');
    });

    it('should allow endTimestamp to be undefined while streaming', () => {
      const message: ChatMessage = {
        id: 'msg-003',
        role: 'agent',
        agentName: 'Entry Agent',
        content: '',
        timestamp: 1704067200000,
        isStreaming: true,
        pane: 'conversation',
        toolCalls: [],
      };

      expect(message.endTimestamp).toBeUndefined();
      expect(message.isStreaming).toBe(true);
    });
  });

  describe('Test 2: generateToolId creates composite key', () => {
    it('should generate ID from agent_name, system, operation, and timestamp', () => {
      const event: ToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Triage',
        system: 'SAP',
        operation: 'get_customer',
        input: {},
        status: 'started',
      };

      const id = generateToolId(event);

      expect(id).toBe('Triage-SAP-get_customer-1704067201000');
    });

    it('should handle special characters in component values', () => {
      const event: ToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Technical Agent',
        system: 'SAP S/4HANA',
        operation: 'get_inventory_level',
        input: {},
        status: 'started',
      };

      const id = generateToolId(event);

      expect(id).toBe('Technical Agent-SAP S/4HANA-get_inventory_level-1704067201000');
    });
  });

  describe('Test 3: mergeToolCallPairs correctly pairs started/completed events', () => {
    it('should pair started and completed events by composite key', () => {
      const events: ToolCallEvent[] = [
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201000,
          event_type: 'tool_call',
          agent_name: 'Triage',
          system: 'SAP',
          operation: 'get_customer',
          input: { id: '123' },
          status: 'started',
        },
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201142,
          event_type: 'tool_call',
          agent_name: 'Triage',
          system: 'SAP',
          operation: 'get_customer',
          input: { id: '123' },
          output: { name: 'Acme' },
          status: 'completed',
        },
      ];

      const merged = mergeToolCallPairs(events);

      expect(merged).toHaveLength(1);
      expect(merged[0].status).toBe('completed');
      expect(merged[0].output).toEqual({ name: 'Acme' });
    });

    it('should calculate duration from timestamp difference', () => {
      const events: ToolCallEvent[] = [
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201000,
          event_type: 'tool_call',
          agent_name: 'Triage',
          system: 'SAP',
          operation: 'get_customer',
          input: {},
          status: 'started',
        },
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201142,
          event_type: 'tool_call',
          agent_name: 'Triage',
          system: 'SAP',
          operation: 'get_customer',
          input: {},
          output: {},
          status: 'completed',
        },
      ];

      const merged = mergeToolCallPairs(events);

      expect(merged).toHaveLength(1);
      expect((merged[0] as ToolCallEvent & { duration_ms?: number }).duration_ms).toBe(142);
    });

    it('should keep unpaired started events as running tools', () => {
      const events: ToolCallEvent[] = [
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201000,
          event_type: 'tool_call',
          agent_name: 'Triage',
          system: 'SAP',
          operation: 'get_customer',
          input: {},
          status: 'started',
        },
      ];

      const merged = mergeToolCallPairs(events);

      expect(merged).toHaveLength(1);
      expect(merged[0].status).toBe('started');
    });

    it('should handle failed status pairing', () => {
      const events: ToolCallEvent[] = [
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201000,
          event_type: 'tool_call',
          agent_name: 'Triage',
          system: 'SAP',
          operation: 'get_customer',
          input: {},
          status: 'started',
        },
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201500,
          event_type: 'tool_call',
          agent_name: 'Triage',
          system: 'SAP',
          operation: 'get_customer',
          input: {},
          status: 'failed',
          error_message: 'Connection timeout',
        },
      ];

      const merged = mergeToolCallPairs(events);

      expect(merged).toHaveLength(1);
      expect(merged[0].status).toBe('failed');
      expect(merged[0].error_message).toBe('Connection timeout');
    });
  });

  describe('Test 4: matchToolEventsToMessages matches by agent_name AND timestamp range', () => {
    it('should match tool events within message timestamp range', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-001',
          role: 'agent',
          agentName: 'Triage Agent',
          content: 'Processing...',
          timestamp: 1704067200000,
          endTimestamp: 1704067210000,
          isStreaming: false,
          pane: 'conversation',
          toolCalls: [],
        },
      ];

      const events: ToolCallEvent[] = [
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201000,
          event_type: 'tool_call',
          agent_name: 'Triage Agent',
          system: 'SAP',
          operation: 'get_customer',
          input: {},
          status: 'started',
        },
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201142,
          event_type: 'tool_call',
          agent_name: 'Triage Agent',
          system: 'SAP',
          operation: 'get_customer',
          input: {},
          output: {},
          status: 'completed',
        },
      ];

      const result = matchToolEventsToMessages(messages, events);

      expect(result[0].toolCalls).toHaveLength(1);
      expect(result[0].toolCalls[0].status).toBe('completed');
    });

    it('should not match tool events from different agents', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-001',
          role: 'agent',
          agentName: 'Triage Agent',
          content: 'Processing...',
          timestamp: 1704067200000,
          endTimestamp: 1704067210000,
          isStreaming: false,
          pane: 'conversation',
          toolCalls: [],
        },
      ];

      const events: ToolCallEvent[] = [
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201000,
          event_type: 'tool_call',
          agent_name: 'Technical Agent',
          system: 'SAP',
          operation: 'get_inventory',
          input: {},
          output: {},
          status: 'completed',
        },
      ];

      const result = matchToolEventsToMessages(messages, events);

      expect(result[0].toolCalls).toHaveLength(0);
    });

    it('should not match tool events outside timestamp range', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-001',
          role: 'agent',
          agentName: 'Triage Agent',
          content: 'Processing...',
          timestamp: 1704067200000,
          endTimestamp: 1704067205000,
          isStreaming: false,
          pane: 'conversation',
          toolCalls: [],
        },
      ];

      const events: ToolCallEvent[] = [
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067210000, // After endTimestamp
          event_type: 'tool_call',
          agent_name: 'Triage Agent',
          system: 'SAP',
          operation: 'get_customer',
          input: {},
          output: {},
          status: 'completed',
        },
      ];

      const result = matchToolEventsToMessages(messages, events);

      expect(result[0].toolCalls).toHaveLength(0);
    });
  });

  describe('Test 5: Streaming messages use Date.now() as upper bound', () => {
    let mockDateNow: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mockDateNow = vi.spyOn(Date, 'now').mockReturnValue(1704067215000);
    });

    afterEach(() => {
      mockDateNow.mockRestore();
    });

    it('should use Date.now() when endTimestamp is undefined', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-001',
          role: 'agent',
          agentName: 'Triage Agent',
          content: '',
          timestamp: 1704067200000,
          // endTimestamp is undefined (streaming)
          isStreaming: true,
          pane: 'conversation',
          toolCalls: [],
        },
      ];

      const events: ToolCallEvent[] = [
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067210000, // Within streaming range (200000 to 215000)
          event_type: 'tool_call',
          agent_name: 'Triage Agent',
          system: 'SAP',
          operation: 'get_customer',
          input: {},
          output: {},
          status: 'completed',
        },
      ];

      const result = matchToolEventsToMessages(messages, events);

      expect(result[0].toolCalls).toHaveLength(1);
    });
  });

  describe('Test 6: Parallel tool calls from same agent are grouped correctly', () => {
    it('should group multiple tool calls to the same message', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-001',
          role: 'agent',
          agentName: 'Triage Agent',
          content: 'Fetching data...',
          timestamp: 1704067200000,
          endTimestamp: 1704067210000,
          isStreaming: false,
          pane: 'conversation',
          toolCalls: [],
        },
      ];

      const events: ToolCallEvent[] = [
        // Tool 1 started/completed
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201000,
          event_type: 'tool_call',
          agent_name: 'Triage Agent',
          system: 'SAP',
          operation: 'get_customer',
          input: {},
          status: 'started',
        },
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201100,
          event_type: 'tool_call',
          agent_name: 'Triage Agent',
          system: 'SAP',
          operation: 'get_customer',
          input: {},
          output: {},
          status: 'completed',
        },
        // Tool 2 started/completed (parallel)
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201050,
          event_type: 'tool_call',
          agent_name: 'Triage Agent',
          system: 'CRM',
          operation: 'get_orders',
          input: {},
          status: 'started',
        },
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201200,
          event_type: 'tool_call',
          agent_name: 'Triage Agent',
          system: 'CRM',
          operation: 'get_orders',
          input: {},
          output: {},
          status: 'completed',
        },
      ];

      const result = matchToolEventsToMessages(messages, events);

      expect(result[0].toolCalls).toHaveLength(2);
      expect(result[0].toolCalls.some(t => t.system === 'SAP')).toBe(true);
      expect(result[0].toolCalls.some(t => t.system === 'CRM')).toBe(true);
    });
  });

  describe('Test 7: Unpaired started events are included as running tools', () => {
    it('should include started events that have not completed yet', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-001',
          role: 'agent',
          agentName: 'Triage Agent',
          content: '',
          timestamp: 1704067200000,
          isStreaming: true,
          pane: 'conversation',
          toolCalls: [],
        },
      ];

      const events: ToolCallEvent[] = [
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201000,
          event_type: 'tool_call',
          agent_name: 'Triage Agent',
          system: 'SAP',
          operation: 'get_customer',
          input: {},
          status: 'started',
        },
        // No completed event yet
      ];

      // Mock Date.now to be after the started event
      vi.spyOn(Date, 'now').mockReturnValue(1704067205000);

      const result = matchToolEventsToMessages(messages, events);

      expect(result[0].toolCalls).toHaveLength(1);
      expect(result[0].toolCalls[0].status).toBe('started');

      vi.restoreAllMocks();
    });
  });

  describe('Test 8: mergeToolCallPairs handles multiple parallel tool calls', () => {
    it('should correctly pair multiple parallel tool calls', () => {
      const events: ToolCallEvent[] = [
        // Tool A started
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201000,
          event_type: 'tool_call',
          agent_name: 'Triage',
          system: 'SAP',
          operation: 'get_customer',
          input: {},
          status: 'started',
        },
        // Tool B started (parallel)
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201010,
          event_type: 'tool_call',
          agent_name: 'Triage',
          system: 'CRM',
          operation: 'get_orders',
          input: {},
          status: 'started',
        },
        // Tool B completed first
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201100,
          event_type: 'tool_call',
          agent_name: 'Triage',
          system: 'CRM',
          operation: 'get_orders',
          input: {},
          output: { orders: [] },
          status: 'completed',
        },
        // Tool A completed
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201200,
          event_type: 'tool_call',
          agent_name: 'Triage',
          system: 'SAP',
          operation: 'get_customer',
          input: {},
          output: { name: 'Acme' },
          status: 'completed',
        },
      ];

      const merged = mergeToolCallPairs(events);

      expect(merged).toHaveLength(2);

      const sapTool = merged.find(t => t.system === 'SAP');
      const crmTool = merged.find(t => t.system === 'CRM');

      expect(sapTool?.status).toBe('completed');
      expect(crmTool?.status).toBe('completed');
      expect((sapTool as ToolCallEvent & { duration_ms?: number })?.duration_ms).toBe(200);
      expect((crmTool as ToolCallEvent & { duration_ms?: number })?.duration_ms).toBe(90);
    });
  });
});
