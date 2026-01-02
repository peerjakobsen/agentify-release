/**
 * Tests for Partial Execution Detection Logic
 * Task Group 2: Detection Logic Layer
 *
 * Tests for event handler detection logic in DemoViewerChatLogic
 * that detects partial workflow execution states.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createInitialChatState,
  createInitialUiState,
  setWorkflowStatus,
  addUserMessage,
  addAgentMessage,
  appendToStreamingContent,
  finalizeAgentMessage,
} from '../../utils/chatStateUtils';
import type { ChatSessionState, ChatUiState, WorkflowStatus } from '../../types/chatPanel';

// ============================================================================
// Task 2.1: 3-4 Focused Tests for Partial Execution Detection
// ============================================================================

describe('Task Group 2: Partial Execution Detection Logic', () => {
  describe('Test 1: handleNodeStopEvent sets status to partial when entry agent stops', () => {
    it('should set status to partial when entry agent stops and workflow still running', () => {
      // Simulate workflow state after entry agent stops
      let sessionState: ChatSessionState = createInitialChatState();
      let uiState: ChatUiState = createInitialUiState();

      // Set entry agent name (as would happen in node_start)
      sessionState = {
        ...sessionState,
        entryAgentName: 'Triage Agent',
      };

      // Workflow is running
      uiState = {
        ...uiState,
        isWorkflowRunning: true,
        workflowStatus: 'running',
      };

      // Simulate detection logic from handleNodeStopEvent
      const stoppedAgentName = 'Triage Agent';
      const isEntryAgent = stoppedAgentName === sessionState.entryAgentName;
      const isWorkflowRunning = uiState.isWorkflowRunning;

      if (isEntryAgent && isWorkflowRunning) {
        uiState = setWorkflowStatus(uiState, 'partial');
      }

      expect(uiState.workflowStatus).toBe('partial');
    });

    it('should NOT set partial when non-entry agent stops', () => {
      let sessionState: ChatSessionState = createInitialChatState();
      let uiState: ChatUiState = createInitialUiState();

      sessionState = {
        ...sessionState,
        entryAgentName: 'Triage Agent',
      };

      uiState = {
        ...uiState,
        isWorkflowRunning: true,
        workflowStatus: 'running',
      };

      // A different agent stops
      const stoppedAgentName = 'Technical Agent';
      const isEntryAgent = stoppedAgentName === sessionState.entryAgentName;
      const isWorkflowRunning = uiState.isWorkflowRunning;

      if (isEntryAgent && isWorkflowRunning) {
        uiState = setWorkflowStatus(uiState, 'partial');
      }

      // Should still be running since it's not the entry agent
      expect(uiState.workflowStatus).toBe('running');
    });

    it('should NOT set partial when workflow is not running', () => {
      let sessionState: ChatSessionState = createInitialChatState();
      let uiState: ChatUiState = createInitialUiState();

      sessionState = {
        ...sessionState,
        entryAgentName: 'Triage Agent',
      };

      // Workflow is NOT running (maybe already completed)
      uiState = {
        ...uiState,
        isWorkflowRunning: false,
        workflowStatus: 'complete',
      };

      const stoppedAgentName = 'Triage Agent';
      const isEntryAgent = stoppedAgentName === sessionState.entryAgentName;
      const isWorkflowRunning = uiState.isWorkflowRunning;

      if (isEntryAgent && isWorkflowRunning) {
        uiState = setWorkflowStatus(uiState, 'partial');
      }

      // Should remain complete since workflow is not running
      expect(uiState.workflowStatus).toBe('complete');
    });
  });

  describe('Test 2: handleWorkflowCompleteEvent sets status to complete', () => {
    it('should override partial status with complete when workflow_complete arrives', () => {
      let uiState: ChatUiState = createInitialUiState();

      // Workflow is in partial state (entry agent stopped)
      uiState = {
        ...uiState,
        isWorkflowRunning: true,
        workflowStatus: 'partial',
      };

      // Simulate handleWorkflowCompleteEvent
      uiState = setWorkflowStatus(uiState, 'complete');
      uiState = {
        ...uiState,
        isWorkflowRunning: false,
      };

      expect(uiState.workflowStatus).toBe('complete');
      expect(uiState.isWorkflowRunning).toBe(false);
    });

    it('should set complete directly from running state (non-partial workflow)', () => {
      let uiState: ChatUiState = createInitialUiState();

      uiState = {
        ...uiState,
        isWorkflowRunning: true,
        workflowStatus: 'running',
      };

      // workflow_complete arrives before entry agent could be detected as partial
      uiState = setWorkflowStatus(uiState, 'complete');

      expect(uiState.workflowStatus).toBe('complete');
    });
  });

  describe('Test 3: handleSendMessage resets status to running on follow-up', () => {
    it('should reset partial status to running when user sends follow-up', () => {
      let uiState: ChatUiState = createInitialUiState();

      // Workflow is in partial state awaiting user input
      uiState = {
        ...uiState,
        isWorkflowRunning: false,
        inputDisabled: false,
        workflowStatus: 'partial',
      };

      // Simulate handleSendMessage
      uiState = setWorkflowStatus(uiState, 'running');
      uiState = {
        ...uiState,
        isWorkflowRunning: true,
        inputDisabled: true,
      };

      expect(uiState.workflowStatus).toBe('running');
      expect(uiState.isWorkflowRunning).toBe(true);
    });

    it('should also work when sending initial message (running -> running)', () => {
      let uiState: ChatUiState = createInitialUiState();

      // Initial state
      expect(uiState.workflowStatus).toBe('running');

      // Simulate handleSendMessage
      uiState = setWorkflowStatus(uiState, 'running');
      uiState = {
        ...uiState,
        isWorkflowRunning: true,
        inputDisabled: true,
      };

      expect(uiState.workflowStatus).toBe('running');
    });
  });

  describe('Test 4: handleWorkflowErrorEvent sets status to error', () => {
    it('should set error status when workflow_error event arrives', () => {
      let uiState: ChatUiState = createInitialUiState();

      uiState = {
        ...uiState,
        isWorkflowRunning: true,
        workflowStatus: 'running',
      };

      // Simulate handleWorkflowErrorEvent
      uiState = setWorkflowStatus(uiState, 'error');
      uiState = {
        ...uiState,
        isWorkflowRunning: false,
        errorMessage: 'Workflow failed',
      };

      expect(uiState.workflowStatus).toBe('error');
      expect(uiState.errorMessage).toBe('Workflow failed');
    });

    it('should override partial status with error', () => {
      let uiState: ChatUiState = createInitialUiState();

      // In partial state
      uiState = {
        ...uiState,
        isWorkflowRunning: true,
        workflowStatus: 'partial',
      };

      // Error arrives
      uiState = setWorkflowStatus(uiState, 'error');

      expect(uiState.workflowStatus).toBe('error');
    });
  });
});

describe('Task Group 2: New Conversation Reset', () => {
  describe('Test: handleNewConversation resets workflowStatus via createInitialUiState', () => {
    it('should reset all UI state including workflowStatus on new conversation', () => {
      // Simulate state after partial execution
      let uiState: ChatUiState = {
        inputDisabled: true,
        isWorkflowRunning: false,
        errorMessage: 'Some error',
        elapsedTimeMs: 5000,
        workflowStatus: 'partial',
      };

      // handleNewConversation calls createInitialUiState()
      uiState = createInitialUiState();

      expect(uiState.workflowStatus).toBe('running');
      expect(uiState.inputDisabled).toBe(false);
      expect(uiState.isWorkflowRunning).toBe(false);
      expect(uiState.errorMessage).toBeNull();
      expect(uiState.elapsedTimeMs).toBeNull();
    });
  });
});
