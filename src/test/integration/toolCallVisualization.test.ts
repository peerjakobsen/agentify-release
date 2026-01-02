/**
 * Integration Tests for Tool Call Visualization
 * Task Group 4: End-to-End Integration Tests
 *
 * Tests the complete flow from tool events through to HTML output
 * for the Tool Call Visualization feature.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ToolCallEvent } from '../../types/events';
import type { ChatMessage } from '../../types/chatPanel';
import {
  createInitialChatState,
  addAgentMessage,
  appendToStreamingContent,
  finalizeAgentMessage,
  matchToolEventsToMessages,
} from '../../utils/chatStateUtils';
import {
  generateMessageBubbleHtml,
  generateToolChipsContainerHtml,
} from '../../utils/chatPanelHtmlGenerator';

// ============================================================================
// Task 4.1: 4-6 Focused Integration Tests
// ============================================================================

describe('Task Group 4: Tool Call Visualization Integration Tests', () => {
  describe('Test 1: Complete flow from tool events to rendered HTML', () => {
    it('should render tool chips in message bubble after matching', () => {
      // Step 1: Create messages
      const messages: ChatMessage[] = [
        {
          id: 'msg-001',
          role: 'agent',
          agentName: 'Triage Agent',
          content: 'Processing your request...',
          timestamp: 1704067200000,
          endTimestamp: 1704067210000,
          isStreaming: false,
          pane: 'conversation',
          toolCalls: [],
        },
      ];

      // Step 2: Create tool events
      const toolEvents: ToolCallEvent[] = [
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201000,
          event_type: 'tool_call',
          agent_name: 'Triage Agent',
          system: 'SAP S/4HANA',
          operation: 'get_customer',
          input: { customer_id: '12345' },
          status: 'started',
        },
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201142,
          event_type: 'tool_call',
          agent_name: 'Triage Agent',
          system: 'SAP S/4HANA',
          operation: 'get_customer',
          input: { customer_id: '12345' },
          output: { name: 'Acme Corp' },
          status: 'completed',
        },
      ];

      // Step 3: Match events to messages
      const messagesWithTools = matchToolEventsToMessages(messages, toolEvents);

      // Step 4: Generate HTML
      const html = generateMessageBubbleHtml(messagesWithTools[0]);

      // Verify
      expect(messagesWithTools[0].toolCalls).toHaveLength(1);
      expect(html).toContain('tool-chips-container');
      expect(html).toContain('tool-chip completed');
      expect(html).toContain('SAP S/4HANA');
      expect(html).toContain('get_customer');
    });
  });

  describe('Test 2: Running tool shows spinner and updates to checkmark', () => {
    it('should render spinner for running tool, checkmark for completed', () => {
      // Running tool
      const runningTool: ToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Agent',
        system: 'SAP',
        operation: 'get',
        input: {},
        status: 'started',
      };

      // Completed tool
      const completedTool: ToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Agent',
        system: 'SAP',
        operation: 'get',
        input: {},
        output: {},
        status: 'completed',
      };

      // Render both
      const runningHtml = generateToolChipsContainerHtml([runningTool]);
      const completedHtml = generateToolChipsContainerHtml([completedTool]);

      // Verify running state
      expect(runningHtml).toContain('tool-chip running');
      expect(runningHtml).toContain('tool-chip-spinner');
      expect(runningHtml).not.toContain('&#10003;'); // No checkmark

      // Verify completed state
      expect(completedHtml).toContain('tool-chip completed');
      expect(completedHtml).toContain('&#10003;'); // Checkmark
      expect(completedHtml).not.toContain('tool-chip-spinner');
    });
  });

  describe('Test 3: Multiple parallel tool calls render in correct messages', () => {
    it('should correctly match multiple tools to their respective messages', () => {
      // Agent 1 message
      const agent1Message: ChatMessage = {
        id: 'msg-001',
        role: 'agent',
        agentName: 'Triage Agent',
        content: 'Looking up customer...',
        timestamp: 1704067200000,
        endTimestamp: 1704067205000,
        isStreaming: false,
        pane: 'conversation',
        toolCalls: [],
      };

      // Agent 2 message
      const agent2Message: ChatMessage = {
        id: 'msg-002',
        role: 'agent',
        agentName: 'Technical Agent',
        content: 'Checking inventory...',
        timestamp: 1704067206000,
        endTimestamp: 1704067215000,
        isStreaming: false,
        pane: 'collaboration',
        toolCalls: [],
      };

      const messages = [agent1Message, agent2Message];

      // Tool events for both agents
      const toolEvents: ToolCallEvent[] = [
        // Triage Agent's tool
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067201000,
          event_type: 'tool_call',
          agent_name: 'Triage Agent',
          system: 'CRM',
          operation: 'lookup_customer',
          input: {},
          output: {},
          status: 'completed',
        },
        // Technical Agent's tool 1
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067207000,
          event_type: 'tool_call',
          agent_name: 'Technical Agent',
          system: 'SAP',
          operation: 'check_inventory',
          input: {},
          output: {},
          status: 'completed',
        },
        // Technical Agent's tool 2 (parallel)
        {
          workflow_id: 'wf-test-123',
          timestamp: 1704067207050,
          event_type: 'tool_call',
          agent_name: 'Technical Agent',
          system: 'WMS',
          operation: 'get_stock_level',
          input: {},
          output: {},
          status: 'completed',
        },
      ];

      // Match events to messages
      const messagesWithTools = matchToolEventsToMessages(messages, toolEvents);

      // Verify Triage Agent has 1 tool call
      expect(messagesWithTools[0].toolCalls).toHaveLength(1);
      expect(messagesWithTools[0].toolCalls[0].system).toBe('CRM');

      // Verify Technical Agent has 2 tool calls
      expect(messagesWithTools[1].toolCalls).toHaveLength(2);
      expect(messagesWithTools[1].toolCalls.some(t => t.system === 'SAP')).toBe(true);
      expect(messagesWithTools[1].toolCalls.some(t => t.system === 'WMS')).toBe(true);
    });
  });

  describe('Test 4: Failed tool shows error styling', () => {
    it('should render failed tool with error class and X icon', () => {
      const failedTool: ToolCallEvent = {
        workflow_id: 'wf-test-123',
        timestamp: 1704067201000,
        event_type: 'tool_call',
        agent_name: 'Agent',
        system: 'SAP',
        operation: 'create_order',
        input: { order_data: {} },
        status: 'failed',
        error_message: 'Connection timeout',
      };

      const html = generateToolChipsContainerHtml([failedTool]);

      expect(html).toContain('tool-chip failed');
      expect(html).toContain('&#10007;'); // X mark
      expect(html).not.toContain('tool-chip-spinner');
      expect(html).not.toContain('&#10003;'); // No checkmark
    });
  });

  describe('Test 5: addAgentMessage initializes empty toolCalls array', () => {
    it('should create message with empty toolCalls array', () => {
      const state = createInitialChatState();
      const updatedState = addAgentMessage(state, 'Test Agent', 'conversation');

      expect(updatedState.messages[0].toolCalls).toEqual([]);
      expect(updatedState.messages[0].toolCalls).toHaveLength(0);
    });
  });

  describe('Test 6: finalizeAgentMessage sets endTimestamp', () => {
    let mockDateNow: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      mockDateNow = vi.spyOn(Date, 'now').mockReturnValue(1704067210000);
    });

    afterEach(() => {
      mockDateNow.mockRestore();
    });

    it('should set endTimestamp when finalizing message', () => {
      let state = createInitialChatState();

      // Mock Date.now for addAgentMessage
      mockDateNow.mockReturnValue(1704067200000);
      state = addAgentMessage(state, 'Test Agent', 'conversation');

      // Add some content
      state = appendToStreamingContent(state, 'Response content');

      // Mock Date.now for finalizeAgentMessage
      mockDateNow.mockReturnValue(1704067210000);
      state = finalizeAgentMessage(state);

      expect(state.messages[0].endTimestamp).toBe(1704067210000);
      expect(state.messages[0].isStreaming).toBe(false);
    });
  });
});

describe('Tool Chip HTML Integration', () => {
  describe('Tool chips appear in both panes', () => {
    it('should render tool chips in conversation pane messages', () => {
      const message: ChatMessage = {
        id: 'msg-001',
        role: 'agent',
        agentName: 'Entry Agent',
        content: 'Processing...',
        timestamp: 1704067200000,
        isStreaming: false,
        pane: 'conversation',
        toolCalls: [
          {
            workflow_id: 'wf-test-123',
            timestamp: 1704067201000,
            event_type: 'tool_call',
            agent_name: 'Entry Agent',
            system: 'SAP',
            operation: 'get_data',
            input: {},
            status: 'completed',
          },
        ],
      };

      const html = generateMessageBubbleHtml(message);

      expect(html).toContain('tool-chips-container');
      expect(html).toContain('SAP');
    });

    it('should render tool chips in collaboration pane messages', () => {
      const message: ChatMessage = {
        id: 'msg-001',
        role: 'agent',
        agentName: 'Technical Agent',
        content: 'Analyzing...',
        timestamp: 1704067200000,
        isStreaming: false,
        pane: 'collaboration',
        toolCalls: [
          {
            workflow_id: 'wf-test-123',
            timestamp: 1704067201000,
            event_type: 'tool_call',
            agent_name: 'Technical Agent',
            system: 'Analytics',
            operation: 'analyze_data',
            input: {},
            status: 'completed',
          },
        ],
      };

      const html = generateMessageBubbleHtml(message);

      expect(html).toContain('tool-chips-container');
      expect(html).toContain('Analytics');
    });
  });

  describe('Empty tool calls do not render container', () => {
    it('should not render tool-chips-container when toolCalls is empty', () => {
      const message: ChatMessage = {
        id: 'msg-001',
        role: 'agent',
        agentName: 'Agent',
        content: 'No tools used',
        timestamp: 1704067200000,
        isStreaming: false,
        pane: 'conversation',
        toolCalls: [],
      };

      const html = generateMessageBubbleHtml(message);

      expect(html).not.toContain('tool-chips-container');
    });
  });
});
