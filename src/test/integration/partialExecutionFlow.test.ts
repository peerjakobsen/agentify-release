/**
 * Integration Tests for Partial Execution Detection Flow
 * Task Group 4: Test Review and Gap Analysis
 *
 * End-to-end integration tests that verify the complete flow of
 * partial execution detection through state, detection, and UI layers.
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialChatState,
  createInitialUiState,
  setWorkflowStatus,
  addUserMessage,
  addAgentMessage,
  finalizeAgentMessage,
  appendToStreamingContent,
  resetChatState,
} from '../../utils/chatStateUtils';
import {
  generateChatPanelHtml,
  generateConversationPaneHtml,
  generateSessionInfoBarHtml,
  generateWorkflowStatusBadgeHtml,
  generatePartialIndicatorHtml,
} from '../../utils/chatPanelHtmlGenerator';
import type { ChatSessionState, ChatUiState, ChatPanelState, WorkflowStatus } from '../../types/chatPanel';

// ============================================================================
// Task 4.2-4.3: Integration Tests for Complete Partial Execution Flow
// ============================================================================

describe('Task Group 4: Integration Tests - Complete Partial Execution Flow', () => {
  describe('Integration Test 1: Full workflow state machine flow', () => {
    it('should transition through all states in typical partial execution scenario', () => {
      // Start: Initial state
      let sessionState = createInitialChatState();
      let uiState = createInitialUiState();
      expect(uiState.workflowStatus).toBe('running');

      // Step 1: User sends message
      sessionState = addUserMessage(sessionState, 'Help me with my account');
      uiState = { ...uiState, inputDisabled: true, isWorkflowRunning: true };
      uiState = setWorkflowStatus(uiState, 'running');
      expect(uiState.workflowStatus).toBe('running');

      // Step 2: Entry agent starts
      sessionState = {
        ...sessionState,
        entryAgentName: 'Triage Agent',
      };
      sessionState = addAgentMessage(sessionState, 'Triage Agent', 'conversation');
      expect(sessionState.entryAgentName).toBe('Triage Agent');

      // Step 3: Entry agent streams and stops (partial execution detected)
      sessionState = appendToStreamingContent(sessionState, 'I need more information from you.');
      sessionState = finalizeAgentMessage(sessionState);

      // Simulate partial detection in handleNodeStopEvent
      const stoppedAgentName = 'Triage Agent';
      const isEntryAgent = stoppedAgentName === sessionState.entryAgentName;
      const isWorkflowRunning = uiState.isWorkflowRunning;

      if (isEntryAgent && isWorkflowRunning) {
        uiState = setWorkflowStatus(uiState, 'partial');
      }
      expect(uiState.workflowStatus).toBe('partial');

      // Step 4: User sends follow-up message (resets to running)
      sessionState = addUserMessage(sessionState, 'My account ID is 12345');
      uiState = setWorkflowStatus(uiState, 'running');
      expect(uiState.workflowStatus).toBe('running');

      // Step 5: Workflow completes successfully
      uiState = setWorkflowStatus(uiState, 'complete');
      uiState = { ...uiState, isWorkflowRunning: false, inputDisabled: false };
      expect(uiState.workflowStatus).toBe('complete');
    });

    it('should handle workflow_complete overriding partial status', () => {
      let uiState = createInitialUiState();
      uiState = { ...uiState, isWorkflowRunning: true };

      // Entry agent stops, partial detected
      uiState = setWorkflowStatus(uiState, 'partial');
      expect(uiState.workflowStatus).toBe('partial');

      // workflow_complete arrives immediately (no partial UI shown)
      uiState = setWorkflowStatus(uiState, 'complete');
      expect(uiState.workflowStatus).toBe('complete');
    });

    it('should handle workflow_error overriding partial status', () => {
      let uiState = createInitialUiState();
      uiState = { ...uiState, isWorkflowRunning: true };

      // Entry agent stops, partial detected
      uiState = setWorkflowStatus(uiState, 'partial');
      expect(uiState.workflowStatus).toBe('partial');

      // Error occurs
      uiState = setWorkflowStatus(uiState, 'error');
      expect(uiState.workflowStatus).toBe('error');
    });
  });

  describe('Integration Test 2: State to UI rendering integration', () => {
    it('should generate correct HTML for partial status in session info bar', () => {
      const uiState = setWorkflowStatus(createInitialUiState(), 'partial');

      const html = generateSessionInfoBarHtml('wf-test123', 1, '00:15', uiState.workflowStatus);

      expect(html).toContain('workflow-status-badge');
      expect(html).toContain('partial');
      expect(html).toContain('Awaiting Input');
      expect(html).toContain('session-info-divider');
    });

    it('should generate partial indicator in conversation pane when status is partial', () => {
      const userMessage = {
        id: 'msg-user',
        role: 'user' as const,
        content: 'Help me',
        timestamp: Date.now(),
        isStreaming: false,
        pane: 'conversation' as const,
        toolCalls: [],
      };

      const agentMessage = {
        id: 'msg-agent',
        role: 'agent' as const,
        agentName: 'Triage Agent',
        content: 'I need more info',
        timestamp: Date.now(),
        isStreaming: false,
        pane: 'conversation' as const,
        toolCalls: [],
      };

      const html = generateConversationPaneHtml([userMessage, agentMessage], '', null, 'partial');

      expect(html).toContain('partial-execution-indicator');
      expect(html).toContain('Awaiting your response');
      expect(html).toContain('Triage Agent');
    });

    it('should NOT generate partial indicator for other statuses', () => {
      const messages = [{
        id: 'msg-agent',
        role: 'agent' as const,
        agentName: 'Triage Agent',
        content: 'Done',
        timestamp: Date.now(),
        isStreaming: false,
        pane: 'conversation' as const,
        toolCalls: [],
      }];

      const runningHtml = generateConversationPaneHtml(messages, '', null, 'running');
      const completeHtml = generateConversationPaneHtml(messages, '', null, 'complete');
      const errorHtml = generateConversationPaneHtml(messages, '', null, 'error');

      expect(runningHtml).not.toContain('partial-execution-indicator');
      expect(completeHtml).not.toContain('partial-execution-indicator');
      expect(errorHtml).not.toContain('partial-execution-indicator');
    });
  });

  describe('Integration Test 3: Full ChatPanelState to HTML generation', () => {
    it('should generate complete chat panel with partial status UI elements', () => {
      const sessionState: ChatSessionState = {
        ...createInitialChatState(),
        workflowId: 'wf-partial123',
        turnCount: 1,
        startTime: Date.now() - 15000,
        entryAgentName: 'Triage Agent',
        messages: [
          {
            id: 'msg-user',
            role: 'user',
            content: 'Help me with my issue',
            timestamp: Date.now() - 10000,
            isStreaming: false,
            pane: 'conversation',
            toolCalls: [],
          },
          {
            id: 'msg-agent',
            role: 'agent',
            agentName: 'Triage Agent',
            content: 'Could you provide more details about your issue?',
            timestamp: Date.now() - 5000,
            isStreaming: false,
            pane: 'conversation',
            toolCalls: [],
          },
        ],
      };

      const uiState: ChatUiState = {
        ...createInitialUiState(),
        workflowStatus: 'partial',
        isWorkflowRunning: true,
        inputDisabled: false,
        elapsedTimeMs: 15000,
      };

      const state: ChatPanelState = {
        session: sessionState,
        ui: uiState,
      };

      const html = generateChatPanelHtml(state);

      // Should contain session info bar with partial status
      expect(html).toContain('workflow-status-badge');
      expect(html).toContain('partial');
      expect(html).toContain('Awaiting Input');

      // Should contain partial indicator in conversation pane
      expect(html).toContain('partial-execution-indicator');
      expect(html).toContain('Awaiting your response');

      // Should contain the messages
      expect(html).toContain('Help me with my issue');
      expect(html).toContain('Could you provide more details');
      expect(html).toContain('Triage Agent');
    });

    it('should generate complete chat panel with complete status (no partial indicator)', () => {
      const sessionState: ChatSessionState = {
        ...createInitialChatState(),
        workflowId: 'wf-complete123',
        turnCount: 1,
        messages: [
          {
            id: 'msg-user',
            role: 'user',
            content: 'Simple query',
            timestamp: Date.now(),
            isStreaming: false,
            pane: 'conversation',
            toolCalls: [],
          },
          {
            id: 'msg-agent',
            role: 'agent',
            agentName: 'Triage Agent',
            content: 'Here is your answer.',
            timestamp: Date.now(),
            isStreaming: false,
            pane: 'conversation',
            toolCalls: [],
          },
        ],
      };

      const uiState: ChatUiState = {
        ...createInitialUiState(),
        workflowStatus: 'complete',
        isWorkflowRunning: false,
        inputDisabled: false,
      };

      const state: ChatPanelState = {
        session: sessionState,
        ui: uiState,
      };

      const html = generateChatPanelHtml(state);

      // Should contain complete status badge
      expect(html).toContain('workflow-status-badge');
      expect(html).toContain('complete');
      expect(html).toContain('Complete');

      // Should NOT contain partial indicator
      expect(html).not.toContain('partial-execution-indicator');
    });
  });

  describe('Integration Test 4: New conversation resets all state correctly', () => {
    it('should reset workflow status when creating fresh state', () => {
      // Simulate state after a partial execution
      let uiState: ChatUiState = {
        inputDisabled: false,
        isWorkflowRunning: true,
        errorMessage: null,
        elapsedTimeMs: 15000,
        workflowStatus: 'partial',
      };

      // Simulate new conversation (calls createInitialUiState)
      uiState = createInitialUiState();

      // All UI state should be reset
      expect(uiState.workflowStatus).toBe('running');
      expect(uiState.inputDisabled).toBe(false);
      expect(uiState.isWorkflowRunning).toBe(false);
      expect(uiState.errorMessage).toBeNull();
      expect(uiState.elapsedTimeMs).toBeNull();
    });

    it('should reset session state with fresh IDs on new conversation', () => {
      const sessionState = resetChatState();

      expect(sessionState.workflowId).toMatch(/^wf-[a-f0-9]{8}$/);
      expect(sessionState.messages).toEqual([]);
      expect(sessionState.pipelineStages).toEqual([]);
      expect(sessionState.entryAgentName).toBeNull();
    });
  });

  describe('Integration Test 5: All status badge variants render correctly', () => {
    it('should render each status badge with appropriate styling', () => {
      const statuses: WorkflowStatus[] = ['running', 'partial', 'complete', 'error'];
      const expectedLabels = ['Running', 'Awaiting Input', 'Complete', 'Error'];

      statuses.forEach((status, index) => {
        const html = generateWorkflowStatusBadgeHtml(status);

        expect(html).toContain('workflow-status-badge');
        expect(html).toContain(status);
        expect(html).toContain(expectedLabels[index]);
      });
    });

    it('should include spinner for running status', () => {
      const html = generateWorkflowStatusBadgeHtml('running');
      expect(html).toContain('status-spinner');
    });

    it('should include icons for non-running statuses', () => {
      const partialHtml = generateWorkflowStatusBadgeHtml('partial');
      const completeHtml = generateWorkflowStatusBadgeHtml('complete');
      const errorHtml = generateWorkflowStatusBadgeHtml('error');

      // Each should have status-icon class
      expect(partialHtml).toContain('status-icon');
      expect(completeHtml).toContain('status-icon');
      expect(errorHtml).toContain('status-icon');

      // Running should NOT have status-icon
      const runningHtml = generateWorkflowStatusBadgeHtml('running');
      expect(runningHtml).not.toContain('status-icon');
    });
  });
});
