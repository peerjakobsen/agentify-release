/**
 * Tests for Chat Panel Types - Dual-Pane Conversation UI
 * Validates type definitions for the dual-pane message routing feature
 */

import { describe, it, expect } from 'vitest';
import {
  type ChatMessage,
  type ChatSessionState,
  type ConversationTurn,
  type ConversationContext,
  type ConversationTurnRole,
} from '../../types/chatPanel';
import {
  type NodeStartEvent,
  isNodeStartEvent,
} from '../../types/events';
import {
  createInitialChatState,
  addUserMessage,
  addConversationTurn,
  buildConversationContext,
  clearCollaborationMessages,
  addAgentMessage,
} from '../../utils/chatStateUtils';

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
        toolCalls: [],
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
        toolCalls: [],
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
        toolCalls: [],
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
        conversationTurns: [],
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
        conversationTurns: [],
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
        conversationTurns: [],
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
        conversationTurns: [],
      };

      expect(idleState.activeMessagePane).toBeNull();
      expect(idleState.activeAgentName).toBeNull();
    });
  });
});

// ============================================================================
// Task Group 2: Multi-Turn Conversation Type Definitions Tests
// ============================================================================

describe('Multi-Turn Conversation Type Definitions', () => {
  describe('ConversationTurn type', () => {
    it('should support human role', () => {
      const humanTurn: ConversationTurn = {
        role: 'human',
        content: 'I need help with my order',
      };

      expect(humanTurn.role).toBe('human');
      expect(humanTurn.content).toBe('I need help with my order');
    });

    it('should support entry_agent role', () => {
      const agentTurn: ConversationTurn = {
        role: 'entry_agent',
        content: 'I would be happy to help. What is your order number?',
      };

      expect(agentTurn.role).toBe('entry_agent');
      expect(agentTurn.content).toBe('I would be happy to help. What is your order number?');
    });

    it('should correctly type ConversationTurnRole union', () => {
      const roles: ConversationTurnRole[] = ['human', 'entry_agent'];
      expect(roles).toContain('human');
      expect(roles).toContain('entry_agent');
    });
  });

  describe('ConversationContext type', () => {
    it('should include entry_agent and turns array', () => {
      const context: ConversationContext = {
        entry_agent: 'triage_agent',
        turns: [
          { role: 'human', content: 'Help with order' },
          { role: 'entry_agent', content: 'Sure, what is the order number?' },
        ],
      };

      expect(context.entry_agent).toBe('triage_agent');
      expect(context.turns.length).toBe(2);
      expect(context.turns[0].role).toBe('human');
      expect(context.turns[1].role).toBe('entry_agent');
    });

    it('should allow empty turns array', () => {
      const context: ConversationContext = {
        entry_agent: 'triage_agent',
        turns: [],
      };

      expect(context.entry_agent).toBe('triage_agent');
      expect(context.turns.length).toBe(0);
    });
  });

  describe('ChatSessionState conversationTurns field', () => {
    it('should include conversationTurns in initial state', () => {
      const state = createInitialChatState();
      expect(state.conversationTurns).toBeDefined();
      expect(state.conversationTurns).toEqual([]);
    });

    it('should support populated conversationTurns array', () => {
      const state: ChatSessionState = {
        workflowId: 'wf-test-123',
        sessionId: 'session-001',
        turnCount: 2,
        startTime: Date.now(),
        messages: [],
        pipelineStages: [],
        activeAgentName: null,
        streamingContent: '',
        entryAgentName: 'triage_agent',
        activeMessagePane: null,
        conversationTurns: [
          { role: 'human', content: 'First message' },
          { role: 'entry_agent', content: 'First response' },
        ],
      };

      expect(state.conversationTurns.length).toBe(2);
      expect(state.conversationTurns[0].role).toBe('human');
      expect(state.conversationTurns[1].role).toBe('entry_agent');
    });
  });
});

// ============================================================================
// Task Group 3: Multi-Turn Conversation Utility Functions Tests
// ============================================================================

describe('Multi-Turn Conversation Utility Functions', () => {
  describe('addConversationTurn()', () => {
    it('should add human turn to empty conversationTurns', () => {
      let state = createInitialChatState();
      state = addConversationTurn(state, 'human', 'Hello, I need help');

      expect(state.conversationTurns.length).toBe(1);
      expect(state.conversationTurns[0].role).toBe('human');
      expect(state.conversationTurns[0].content).toBe('Hello, I need help');
    });

    it('should add entry_agent turn to conversationTurns', () => {
      let state = createInitialChatState();
      state = addConversationTurn(state, 'human', 'Help me');
      state = addConversationTurn(state, 'entry_agent', 'Sure, what do you need?');

      expect(state.conversationTurns.length).toBe(2);
      expect(state.conversationTurns[1].role).toBe('entry_agent');
      expect(state.conversationTurns[1].content).toBe('Sure, what do you need?');
    });

    it('should trim content whitespace', () => {
      let state = createInitialChatState();
      state = addConversationTurn(state, 'human', '  Spaces around  ');

      expect(state.conversationTurns[0].content).toBe('Spaces around');
    });

    it('should preserve existing turns when adding new one', () => {
      let state = createInitialChatState();
      state = addConversationTurn(state, 'human', 'First');
      state = addConversationTurn(state, 'entry_agent', 'Second');
      state = addConversationTurn(state, 'human', 'Third');

      expect(state.conversationTurns.length).toBe(3);
      expect(state.conversationTurns[0].content).toBe('First');
      expect(state.conversationTurns[1].content).toBe('Second');
      expect(state.conversationTurns[2].content).toBe('Third');
    });
  });

  describe('buildConversationContext()', () => {
    it('should return null when conversationTurns is empty', () => {
      const state = createInitialChatState();
      const context = buildConversationContext(state);

      expect(context).toBeNull();
    });

    it('should return null when entryAgentName is null', () => {
      let state = createInitialChatState();
      state = addConversationTurn(state, 'human', 'Test message');
      // entryAgentName is still null

      const context = buildConversationContext(state);
      expect(context).toBeNull();
    });

    it('should return ConversationContext when turns exist and entryAgent is set', () => {
      let state = createInitialChatState();
      state = {
        ...state,
        entryAgentName: 'triage_agent',
      };
      state = addConversationTurn(state, 'human', 'Help with order');
      state = addConversationTurn(state, 'entry_agent', 'Sure, what is the order number?');

      const context = buildConversationContext(state);

      expect(context).not.toBeNull();
      expect(context?.entry_agent).toBe('triage_agent');
      expect(context?.turns.length).toBe(2);
      expect(context?.turns[0]).toEqual({ role: 'human', content: 'Help with order' });
      expect(context?.turns[1]).toEqual({ role: 'entry_agent', content: 'Sure, what is the order number?' });
    });

    it('should return a copy of turns array (immutable)', () => {
      let state = createInitialChatState();
      state = {
        ...state,
        entryAgentName: 'triage_agent',
      };
      state = addConversationTurn(state, 'human', 'Test');

      const context = buildConversationContext(state);

      // Modify the returned array
      context?.turns.push({ role: 'human', content: 'New item' });

      // Original state should not be modified
      expect(state.conversationTurns.length).toBe(1);
    });
  });

  describe('clearCollaborationMessages()', () => {
    it('should remove collaboration pane messages', () => {
      let state = createInitialChatState();
      // Add a conversation pane message (user)
      state = addUserMessage(state, 'User message');
      // Add an agent message to conversation pane
      state = addAgentMessage(state, 'Entry Agent', 'conversation');
      // Simulate finalization by updating content
      state = {
        ...state,
        messages: state.messages.map((m, i) =>
          i === 1 ? { ...m, content: 'Entry response', isStreaming: false } : m
        ),
        activeAgentName: null,
        streamingContent: '',
        activeMessagePane: null,
      };
      // Add a collaboration pane message
      state = addAgentMessage(state, 'Specialist', 'collaboration');
      state = {
        ...state,
        messages: state.messages.map((m, i) =>
          i === 2 ? { ...m, content: 'Specialist response', isStreaming: false } : m
        ),
        activeAgentName: null,
        streamingContent: '',
        activeMessagePane: null,
      };

      // Verify we have both panes
      expect(state.messages.filter((m) => m.pane === 'conversation').length).toBe(2);
      expect(state.messages.filter((m) => m.pane === 'collaboration').length).toBe(1);

      // Clear collaboration
      state = clearCollaborationMessages(state);

      // Conversation pane messages remain
      expect(state.messages.filter((m) => m.pane === 'conversation').length).toBe(2);
      // Collaboration pane messages removed
      expect(state.messages.filter((m) => m.pane === 'collaboration').length).toBe(0);
    });

    it('should reset pipeline stages', () => {
      let state = createInitialChatState();
      state = {
        ...state,
        pipelineStages: [
          { name: 'Triage', status: 'completed' },
          { name: 'Specialist', status: 'active' },
        ],
      };

      state = clearCollaborationMessages(state);

      expect(state.pipelineStages).toEqual([]);
    });

    it('should reset streaming state', () => {
      let state = createInitialChatState();
      state = {
        ...state,
        activeAgentName: 'Specialist',
        streamingContent: 'Partial content...',
        activeMessagePane: 'collaboration',
      };

      state = clearCollaborationMessages(state);

      expect(state.activeAgentName).toBeNull();
      expect(state.streamingContent).toBe('');
      expect(state.activeMessagePane).toBeNull();
    });

    it('should preserve conversationTurns', () => {
      let state = createInitialChatState();
      state = addConversationTurn(state, 'human', 'First message');
      state = addConversationTurn(state, 'entry_agent', 'First response');

      const turnsBeforeClear = state.conversationTurns.length;

      state = clearCollaborationMessages(state);

      expect(state.conversationTurns.length).toBe(turnsBeforeClear);
    });
  });
});
