/**
 * Tests for Chat Panel Types - Dual-Pane Conversation UI
 * Validates type definitions for the dual-pane message routing feature
 */

import { describe, it, expect } from 'vitest';
import {
  type ChatMessage,
  type ChatSessionState,
} from '../../types/chatPanel';
import {
  type NodeStartEvent,
  isNodeStartEvent,
} from '../../types/events';

// ============================================================================
// Task Group 1: Event Schema and Type Definitions Tests
// ============================================================================

describe('Dual-Pane Type Definitions', () => {
  describe('NodeStartEvent with from_agent and handoff_prompt fields', () => {
    it('should include from_agent field (null for entry agent)', () => {
      const entryAgentEvent: NodeStartEvent = {
        type: 'node_start',
        workflow_id: 'wf-test-123',
        timestamp: Date.now(),
        node_id: 'triage_agent',
        from_agent: null,
        handoff_prompt: 'User prompt: How can I help you today?',
      };

      expect(entryAgentEvent.from_agent).toBeNull();
      expect(entryAgentEvent.handoff_prompt).toBe('User prompt: How can I help you today?');
      expect(entryAgentEvent.type).toBe('node_start');
    });

    it('should include from_agent field (sender name for subsequent agents)', () => {
      const subsequentAgentEvent: NodeStartEvent = {
        type: 'node_start',
        workflow_id: 'wf-test-123',
        timestamp: Date.now(),
        node_id: 'specialist_agent',
        from_agent: 'triage_agent',
        handoff_prompt: 'Please analyze the customer order for discrepancies.',
      };

      expect(subsequentAgentEvent.from_agent).toBe('triage_agent');
      expect(subsequentAgentEvent.handoff_prompt).toBe('Please analyze the customer order for discrepancies.');
      expect(subsequentAgentEvent.type).toBe('node_start');
    });
  });

  describe('isNodeStartEvent type guard with new fields', () => {
    it('should correctly identify NodeStartEvent regardless of optional fields', () => {
      // Event with new fields
      const eventWithFields: NodeStartEvent = {
        type: 'node_start',
        workflow_id: 'wf-test-123',
        timestamp: Date.now(),
        node_id: 'test_agent',
        from_agent: 'sender_agent',
        handoff_prompt: 'Test prompt',
      };

      expect(isNodeStartEvent(eventWithFields)).toBe(true);

      // Type guard only checks event.type, not the new fields
      // This ensures backward compatibility
      const minimalEvent = {
        type: 'node_start' as const,
        workflow_id: 'wf-test-456',
        timestamp: Date.now(),
        node_id: 'minimal_agent',
      };

      expect(isNodeStartEvent(minimalEvent as NodeStartEvent)).toBe(true);
    });

    it('should return false for non-NodeStartEvent types', () => {
      const nodeStopEvent = {
        type: 'node_stop' as const,
        workflow_id: 'wf-test-123',
        timestamp: Date.now(),
        node_id: 'test_agent',
        status: 'completed' as const,
        execution_time_ms: 100,
      };

      expect(isNodeStartEvent(nodeStopEvent)).toBe(false);
    });
  });

  describe('ChatMessage pane routing field', () => {
    it('should include pane field for conversation messages', () => {
      const conversationMessage: ChatMessage = {
        id: 'msg-001',
        role: 'user',
        content: 'Hello, I need help with my order.',
        timestamp: Date.now(),
        isStreaming: false,
        pane: 'conversation',
      };

      expect(conversationMessage.pane).toBe('conversation');
      expect(conversationMessage.role).toBe('user');
    });

    it('should include pane field for collaboration messages', () => {
      const collaborationMessage: ChatMessage = {
        id: 'msg-002',
        role: 'agent',
        agentName: 'specialist_agent',
        content: 'Analyzing order details...',
        timestamp: Date.now(),
        isStreaming: false,
        pane: 'collaboration',
      };

      expect(collaborationMessage.pane).toBe('collaboration');
      expect(collaborationMessage.role).toBe('agent');
      expect(collaborationMessage.agentName).toBe('specialist_agent');
    });

    it('should support isSender flag for handoff message styling', () => {
      const handoffMessage: ChatMessage = {
        id: 'msg-003',
        role: 'agent',
        agentName: 'triage_agent',
        content: 'Routing to specialist for order analysis.',
        timestamp: Date.now(),
        isStreaming: false,
        pane: 'collaboration',
        isSender: true,
      };

      expect(handoffMessage.isSender).toBe(true);
      expect(handoffMessage.pane).toBe('collaboration');
    });
  });

  describe('ChatSessionState entry agent and active pane tracking', () => {
    it('should include entryAgentName for tracking first agent', () => {
      const state: ChatSessionState = {
        workflowId: 'wf-test-123',
        sessionId: 'session-001',
        turnCount: 1,
        startTime: Date.now(),
        messages: [],
        pipelineStages: [],
        activeAgentName: null,
        streamingContent: '',
        entryAgentName: 'triage_agent',
        activeMessagePane: null,
      };

      expect(state.entryAgentName).toBe('triage_agent');
    });

    it('should initialize entryAgentName as null before first node_start', () => {
      const initialState: ChatSessionState = {
        workflowId: 'wf-test-456',
        sessionId: 'session-002',
        turnCount: 1,
        startTime: Date.now(),
        messages: [],
        pipelineStages: [],
        activeAgentName: null,
        streamingContent: '',
        entryAgentName: null,
        activeMessagePane: null,
      };

      expect(initialState.entryAgentName).toBeNull();
    });

    it('should include activeMessagePane for streaming content routing', () => {
      const stateWithActivePane: ChatSessionState = {
        workflowId: 'wf-test-789',
        sessionId: 'session-003',
        turnCount: 1,
        startTime: Date.now(),
        messages: [],
        pipelineStages: [],
        activeAgentName: 'specialist_agent',
        streamingContent: 'Analyzing...',
        entryAgentName: 'triage_agent',
        activeMessagePane: 'collaboration',
      };

      expect(stateWithActivePane.activeMessagePane).toBe('collaboration');
      expect(stateWithActivePane.streamingContent).toBe('Analyzing...');
    });

    it('should allow activeMessagePane to be null when not streaming', () => {
      const idleState: ChatSessionState = {
        workflowId: 'wf-test-idle',
        sessionId: 'session-004',
        turnCount: 1,
        startTime: Date.now(),
        messages: [],
        pipelineStages: [],
        activeAgentName: null,
        streamingContent: '',
        entryAgentName: 'coordinator',
        activeMessagePane: null,
      };

      expect(idleState.activeMessagePane).toBeNull();
      expect(idleState.activeAgentName).toBeNull();
    });
  });
});
