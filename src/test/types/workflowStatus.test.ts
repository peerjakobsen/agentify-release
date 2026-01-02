/**
 * Tests for Workflow Status State Transitions
 * Task Group 1: Type and State Layer
 *
 * Tests for WorkflowStatus type and setWorkflowStatus() state transitions
 * for the Partial Execution Detection feature.
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialChatState,
  createInitialUiState,
  setWorkflowStatus,
  resetChatState,
} from '../../utils/chatStateUtils';
import type { WorkflowStatus, ChatUiState } from '../../types/chatPanel';

// ============================================================================
// Task 1.1: 3-4 Focused Tests for Workflow Status State Transitions
// ============================================================================

describe('Task Group 1: Workflow Status State Transitions', () => {
  describe('Test 1: setWorkflowStatus() transitions between states', () => {
    it('should transition from running to partial', () => {
      let uiState = createInitialUiState();
      expect(uiState.workflowStatus).toBe('running');

      uiState = setWorkflowStatus(uiState, 'partial');
      expect(uiState.workflowStatus).toBe('partial');
    });

    it('should transition from partial to complete', () => {
      let uiState = createInitialUiState();
      uiState = setWorkflowStatus(uiState, 'partial');
      expect(uiState.workflowStatus).toBe('partial');

      uiState = setWorkflowStatus(uiState, 'complete');
      expect(uiState.workflowStatus).toBe('complete');
    });

    it('should transition from partial to error', () => {
      let uiState = createInitialUiState();
      uiState = setWorkflowStatus(uiState, 'partial');

      uiState = setWorkflowStatus(uiState, 'error');
      expect(uiState.workflowStatus).toBe('error');
    });

    it('should transition from partial to running on follow-up', () => {
      let uiState = createInitialUiState();
      uiState = setWorkflowStatus(uiState, 'partial');

      uiState = setWorkflowStatus(uiState, 'running');
      expect(uiState.workflowStatus).toBe('running');
    });

    it('should preserve other UI state fields during transition', () => {
      let uiState: ChatUiState = {
        ...createInitialUiState(),
        inputDisabled: true,
        isWorkflowRunning: true,
        errorMessage: 'test error',
        elapsedTimeMs: 5000,
      };

      uiState = setWorkflowStatus(uiState, 'partial');

      expect(uiState.workflowStatus).toBe('partial');
      expect(uiState.inputDisabled).toBe(true);
      expect(uiState.isWorkflowRunning).toBe(true);
      expect(uiState.errorMessage).toBe('test error');
      expect(uiState.elapsedTimeMs).toBe(5000);
    });
  });

  describe('Test 2: createInitialUiState() returns running as default', () => {
    it('should initialize workflowStatus to running', () => {
      const uiState = createInitialUiState();
      expect(uiState.workflowStatus).toBe('running');
    });

    it('should consistently return running on each call', () => {
      const uiState1 = createInitialUiState();
      const uiState2 = createInitialUiState();
      const uiState3 = createInitialUiState();

      expect(uiState1.workflowStatus).toBe('running');
      expect(uiState2.workflowStatus).toBe('running');
      expect(uiState3.workflowStatus).toBe('running');
    });
  });

  describe('Test 3: resetChatState() resets workflowStatus via createInitialUiState()', () => {
    it('should reset workflowStatus to running when UI state is recreated', () => {
      // Simulate a modified state
      let uiState = createInitialUiState();
      uiState = setWorkflowStatus(uiState, 'partial');
      expect(uiState.workflowStatus).toBe('partial');

      // Create fresh UI state (as would happen in handleNewConversation)
      const freshUiState = createInitialUiState();
      expect(freshUiState.workflowStatus).toBe('running');
    });

    it('should reset session state correctly', () => {
      const sessionState = resetChatState();
      expect(sessionState.messages).toEqual([]);
      expect(sessionState.pipelineStages).toEqual([]);
      expect(sessionState.entryAgentName).toBeNull();
    });
  });

  describe('Test 4: WorkflowStatus type union values', () => {
    it('should accept all valid status values', () => {
      const statuses: WorkflowStatus[] = ['running', 'partial', 'complete', 'error'];

      statuses.forEach((status) => {
        const uiState = setWorkflowStatus(createInitialUiState(), status);
        expect(uiState.workflowStatus).toBe(status);
      });
    });

    it('should allow direct to complete transition (for non-partial workflows)', () => {
      let uiState = createInitialUiState();
      expect(uiState.workflowStatus).toBe('running');

      uiState = setWorkflowStatus(uiState, 'complete');
      expect(uiState.workflowStatus).toBe('complete');
    });

    it('should allow direct to error transition', () => {
      let uiState = createInitialUiState();
      expect(uiState.workflowStatus).toBe('running');

      uiState = setWorkflowStatus(uiState, 'error');
      expect(uiState.workflowStatus).toBe('error');
    });
  });
});
