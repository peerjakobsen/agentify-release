/**
 * Tests for DynamoDB Polling Service
 *
 * These tests validate the polling service for fetching workflow events from DynamoDB.
 * Organized by task groups:
 * - Task Group 1: Core Service Structure (singleton, EventEmitters, state)
 * - Task Group 2: Query Implementation (DynamoDB query, deduplication)
 * - Task Group 3: Lifecycle Management (start/stop, terminal events, backoff)
 * - Task Group 4: Integration and Gap Analysis
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DynamoDbEvent, ToolCallEvent, AgentSpanEvent } from '../types/events';

// Mock vscode module
vi.mock('vscode', () => ({
  EventEmitter: vi.fn().mockImplementation(() => {
    const listeners: Array<(data: unknown) => void> = [];
    return {
      event: (listener: (data: unknown) => void) => {
        listeners.push(listener);
        return { dispose: () => listeners.splice(listeners.indexOf(listener), 1) };
      },
      fire: (data: unknown) => listeners.forEach((l) => l(data)),
      dispose: vi.fn(),
      _listeners: listeners,
    };
  }),
  Disposable: vi.fn().mockImplementation((fn) => ({ dispose: fn })),
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue: string) => {
        if (key === 'aws.region') return 'us-east-1';
        if (key === 'dynamodb.tableName') return 'test-table';
        return defaultValue;
      }),
    })),
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    fs: {
      stat: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      createDirectory: vi.fn(),
    },
    createFileSystemWatcher: vi.fn(() => ({
      onDidChange: vi.fn(),
      onDidDelete: vi.fn(),
      onDidCreate: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  Uri: {
    file: (path: string) => ({ fsPath: path }),
  },
  RelativePattern: vi.fn(),
}));

// Mock DynamoDB client
const mockQueryCommand = vi.fn();
vi.mock('../services/dynamoDbClient', () => ({
  getDynamoDbDocumentClientAsync: vi.fn(() =>
    Promise.resolve({
      send: mockQueryCommand,
    })
  ),
}));

// Mock config service
const mockConfigService = {
  getConfig: vi.fn(() =>
    Promise.resolve({
      infrastructure: {
        dynamodb: {
          tableName: 'test-workflow-events',
          region: 'us-east-1',
        },
      },
    })
  ),
};

vi.mock('../services/configService', () => ({
  getConfigService: vi.fn(() => mockConfigService),
}));

// Import after mocks
import {
  getDynamoDbPollingService,
  resetDynamoDbPollingService,
} from '../services/dynamoDbPollingService';

// Helper to wait for pending promises
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

// ============================================================================
// Task Group 1: Core Service Structure Tests
// ============================================================================

describe('Task Group 1: Core Service Structure', () => {
  beforeEach(() => {
    resetDynamoDbPollingService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetDynamoDbPollingService();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const first = getDynamoDbPollingService();
      const second = getDynamoDbPollingService();
      expect(first).toBe(second);
    });

    it('should return a new instance after reset', () => {
      const first = getDynamoDbPollingService();
      resetDynamoDbPollingService();
      const second = getDynamoDbPollingService();
      expect(first).not.toBe(second);
    });
  });

  describe('EventEmitter Subscription', () => {
    it('should allow subscribing to onEvent and receive fired events', () => {
      const service = getDynamoDbPollingService();
      const receivedEvents: DynamoDbEvent[] = [];

      service.onEvent((event) => {
        receivedEvents.push(event);
      });

      const testEvent: ToolCallEvent = {
        workflow_id: 'wf-123',
        timestamp: Date.now(),
        event_type: 'tool_call',
        agent_name: 'test-agent',
        system: 'test-system',
        operation: 'test-op',
        input: {},
        status: 'completed',
      };

      // Access internal emitter to fire event for testing
      (service as unknown as { _onEvent: { fire: (e: DynamoDbEvent) => void } })._onEvent.fire(
        testEvent
      );

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toEqual(testEvent);
    });

    it('should allow subscribing to onError and receive fired errors', () => {
      const service = getDynamoDbPollingService();
      const receivedErrors: Error[] = [];

      service.onError((error) => {
        receivedErrors.push(error);
      });

      const testError = new Error('Test error');

      // Access internal emitter to fire error for testing
      (service as unknown as { _onError: { fire: (e: Error) => void } })._onError.fire(testError);

      expect(receivedErrors).toHaveLength(1);
      expect(receivedErrors[0]).toEqual(testError);
    });
  });

  describe('Initial State', () => {
    it('should return false for isPolling() initially', () => {
      const service = getDynamoDbPollingService();
      expect(service.isPolling()).toBe(false);
    });

    it('should return null for getCurrentWorkflowId() initially', () => {
      const service = getDynamoDbPollingService();
      expect(service.getCurrentWorkflowId()).toBeNull();
    });
  });

  describe('Dispose Method', () => {
    it('should clean up and set isPolling to false on dispose', () => {
      const service = getDynamoDbPollingService();

      // Subscribe to events
      service.onEvent(() => {});
      service.onError(() => {});

      service.dispose();

      // After dispose, isPolling should be false
      expect(service.isPolling()).toBe(false);
    });

    it('should stop polling if active when disposed', async () => {
      const service = getDynamoDbPollingService();

      // Setup mock to return empty results
      mockQueryCommand.mockResolvedValue({ Items: [] });

      service.startPolling('wf-123');
      await flushPromises();

      expect(service.isPolling()).toBe(true);

      service.dispose();

      expect(service.isPolling()).toBe(false);
    });
  });
});

// ============================================================================
// Task Group 2: Query Implementation Tests
// ============================================================================

describe('Task Group 2: Query Implementation', () => {
  beforeEach(() => {
    resetDynamoDbPollingService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetDynamoDbPollingService();
  });

  describe('Query Filtering', () => {
    it('should query with correct workflow_id and timestamp filter', async () => {
      const service = getDynamoDbPollingService();
      const workflowId = 'wf-test-123';

      mockQueryCommand.mockResolvedValue({ Items: [] });

      service.startPolling(workflowId);
      await flushPromises();

      expect(mockQueryCommand).toHaveBeenCalled();

      const callArg = mockQueryCommand.mock.calls[0][0];
      expect(callArg.input.TableName).toBe('test-workflow-events');
      expect(callArg.input.KeyConditionExpression).toContain('workflow_id = :wfId');
      expect(callArg.input.KeyConditionExpression).toContain('#ts > :lastTimestamp');
      expect(callArg.input.ExpressionAttributeNames['#ts']).toBe('timestamp');
      expect(callArg.input.ExpressionAttributeValues[':wfId']).toBe(workflowId);
      expect(callArg.input.ExpressionAttributeValues[':lastTimestamp']).toBe(0);

      service.stopPolling();
    });
  });

  describe('Result Processing', () => {
    it('should sort events ascending by timestamp', async () => {
      const service = getDynamoDbPollingService();
      const receivedEvents: DynamoDbEvent[] = [];

      service.onEvent((event) => receivedEvents.push(event));

      const events: ToolCallEvent[] = [
        {
          workflow_id: 'wf-123',
          timestamp: 3000,
          event_type: 'tool_call',
          agent_name: 'agent-3',
          system: 'sys',
          operation: 'op',
          input: {},
          status: 'completed',
        },
        {
          workflow_id: 'wf-123',
          timestamp: 1000,
          event_type: 'tool_call',
          agent_name: 'agent-1',
          system: 'sys',
          operation: 'op',
          input: {},
          status: 'completed',
        },
        {
          workflow_id: 'wf-123',
          timestamp: 2000,
          event_type: 'tool_call',
          agent_name: 'agent-2',
          system: 'sys',
          operation: 'op',
          input: {},
          status: 'completed',
        },
      ];

      mockQueryCommand.mockResolvedValue({ Items: events });

      service.startPolling('wf-123');
      await flushPromises();

      expect(receivedEvents).toHaveLength(3);
      expect(receivedEvents[0].timestamp).toBe(1000);
      expect(receivedEvents[1].timestamp).toBe(2000);
      expect(receivedEvents[2].timestamp).toBe(3000);

      service.stopPolling();
    });

    it('should update lastTimestamp to highest timestamp from results', async () => {
      const service = getDynamoDbPollingService();

      const events: ToolCallEvent[] = [
        {
          workflow_id: 'wf-123',
          timestamp: 5000,
          event_type: 'tool_call',
          agent_name: 'agent',
          system: 'sys',
          operation: 'op',
          input: {},
          status: 'completed',
        },
      ];

      // First poll returns events, subsequent polls return empty
      let pollCount = 0;
      mockQueryCommand.mockImplementation(() => {
        pollCount++;
        if (pollCount === 1) {
          return Promise.resolve({ Items: events });
        }
        return Promise.resolve({ Items: [] });
      });

      service.startPolling('wf-123');
      await flushPromises();

      // Wait a bit for the second scheduled poll
      await new Promise((r) => setTimeout(r, 600));

      // Check the second call used updated timestamp
      expect(mockQueryCommand.mock.calls.length).toBeGreaterThanOrEqual(2);
      const secondCallArg = mockQueryCommand.mock.calls[1][0];
      expect(secondCallArg.input.ExpressionAttributeValues[':lastTimestamp']).toBe(5000);

      service.stopPolling();
    });
  });

  describe('Deduplication', () => {
    it('should skip events that have already been seen', async () => {
      const service = getDynamoDbPollingService();
      const receivedEvents: DynamoDbEvent[] = [];

      service.onEvent((event) => receivedEvents.push(event));

      const event: ToolCallEvent = {
        workflow_id: 'wf-123',
        timestamp: 1000,
        event_type: 'tool_call',
        agent_name: 'agent',
        system: 'sys',
        operation: 'op',
        input: {},
        status: 'completed',
      };

      // Return same event on both polls
      mockQueryCommand.mockResolvedValue({ Items: [event] });

      service.startPolling('wf-123');
      await flushPromises();

      expect(receivedEvents).toHaveLength(1);

      // Wait for second poll
      await new Promise((r) => setTimeout(r, 600));

      // Should still only have 1 event (deduplicated)
      expect(receivedEvents).toHaveLength(1);

      service.stopPolling();
    });

    it('should emit events with different timestamps', async () => {
      const service = getDynamoDbPollingService();
      const receivedEvents: DynamoDbEvent[] = [];

      service.onEvent((event) => receivedEvents.push(event));

      // Two events with different timestamps should both be emitted
      const event1: ToolCallEvent = {
        workflow_id: 'wf-123',
        timestamp: 1000,
        event_type: 'tool_call',
        agent_name: 'agent',
        system: 'sys',
        operation: 'op',
        input: {},
        status: 'completed',
      };

      const event2: ToolCallEvent = {
        workflow_id: 'wf-123',
        timestamp: 1001,
        event_type: 'tool_call',
        agent_name: 'agent',
        system: 'sys',
        operation: 'op',
        input: {},
        status: 'completed',
      };

      mockQueryCommand.mockResolvedValue({ Items: [event1, event2] });

      service.startPolling('wf-123');
      await flushPromises();

      expect(receivedEvents).toHaveLength(2);

      service.stopPolling();
    });
  });
});

// ============================================================================
// Task Group 3: Lifecycle Management Tests
// ============================================================================

describe('Task Group 3: Lifecycle Management', () => {
  beforeEach(() => {
    resetDynamoDbPollingService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetDynamoDbPollingService();
  });

  describe('startPolling()', () => {
    it('should set isPolling to true and begin polling', async () => {
      const service = getDynamoDbPollingService();

      mockQueryCommand.mockResolvedValue({ Items: [] });

      expect(service.isPolling()).toBe(false);

      service.startPolling('wf-123');
      await flushPromises();

      expect(service.isPolling()).toBe(true);
      expect(service.getCurrentWorkflowId()).toBe('wf-123');

      service.stopPolling();
    });

    it('should be a no-op if same workflow is already polling', async () => {
      const service = getDynamoDbPollingService();

      mockQueryCommand.mockResolvedValue({ Items: [] });

      service.startPolling('wf-123');
      await flushPromises();

      const initialCallCount = mockQueryCommand.mock.calls.length;

      // Call startPolling again with same workflow
      service.startPolling('wf-123');
      await flushPromises();

      // Should not trigger additional immediate poll (only scheduled)
      expect(mockQueryCommand.mock.calls.length).toBe(initialCallCount);

      service.stopPolling();
    });
  });

  describe('Auto-stop on Terminal Events', () => {
    it('should auto-stop on workflow_complete event', async () => {
      const service = getDynamoDbPollingService();
      const receivedEvents: DynamoDbEvent[] = [];

      service.onEvent((event) => receivedEvents.push(event));

      const workflowComplete = {
        workflow_id: 'wf-123',
        timestamp: 2000,
        event_type: 'workflow_complete',
        status: 'completed',
        execution_time_ms: 5000,
      };

      mockQueryCommand.mockResolvedValue({ Items: [workflowComplete] });

      service.startPolling('wf-123');
      await flushPromises();

      // Event should be emitted
      expect(receivedEvents).toHaveLength(1);

      // Polling should have stopped
      expect(service.isPolling()).toBe(false);
    });

    it('should auto-stop on workflow_error event', async () => {
      const service = getDynamoDbPollingService();
      const receivedEvents: DynamoDbEvent[] = [];

      service.onEvent((event) => receivedEvents.push(event));

      const errorEvent = {
        workflow_id: 'wf-123',
        timestamp: 1000,
        event_type: 'workflow_error',
        error_message: 'Something went wrong',
      };

      mockQueryCommand.mockResolvedValue({ Items: [errorEvent] });

      service.startPolling('wf-123');
      await flushPromises();

      // Event should be emitted
      expect(receivedEvents).toHaveLength(1);

      // Polling should have stopped
      expect(service.isPolling()).toBe(false);
    });
  });

  describe('New Workflow Handling', () => {
    it('should stop previous polling and start new workflow', async () => {
      const service = getDynamoDbPollingService();
      const receivedEvents: DynamoDbEvent[] = [];

      service.onEvent((event) => receivedEvents.push(event));

      const event1: ToolCallEvent = {
        workflow_id: 'wf-old',
        timestamp: 1000,
        event_type: 'tool_call',
        agent_name: 'agent',
        system: 'sys',
        operation: 'op',
        input: {},
        status: 'completed',
      };

      mockQueryCommand.mockResolvedValueOnce({ Items: [event1] }).mockResolvedValue({ Items: [] });

      service.startPolling('wf-old');
      await flushPromises();

      expect(service.getCurrentWorkflowId()).toBe('wf-old');
      expect(receivedEvents).toHaveLength(1);

      // Start new workflow
      service.startPolling('wf-new');
      await flushPromises();

      expect(service.getCurrentWorkflowId()).toBe('wf-new');

      // Verify query is now using new workflow ID
      const lastCall = mockQueryCommand.mock.calls[mockQueryCommand.mock.calls.length - 1][0];
      expect(lastCall.input.ExpressionAttributeValues[':wfId']).toBe('wf-new');

      service.stopPolling();
    });
  });

  describe('Exponential Backoff', () => {
    it('should emit error and continue polling on query error', async () => {
      const service = getDynamoDbPollingService();
      const receivedErrors: Error[] = [];

      service.onError((error) => receivedErrors.push(error));

      // Mock first call to error
      mockQueryCommand.mockRejectedValueOnce(new Error('DynamoDB error'));
      mockQueryCommand.mockResolvedValue({ Items: [] });

      service.startPolling('wf-123');

      // Wait for first poll (error)
      await flushPromises();
      expect(receivedErrors).toHaveLength(1);
      expect(service.isPolling()).toBe(true);

      service.stopPolling();
    });

    it('should recover after error with success', async () => {
      const service = getDynamoDbPollingService();
      const receivedErrors: Error[] = [];
      const receivedEvents: DynamoDbEvent[] = [];

      service.onError((error) => receivedErrors.push(error));
      service.onEvent((event) => receivedEvents.push(event));

      const successEvent: ToolCallEvent = {
        workflow_id: 'wf-123',
        timestamp: 1000,
        event_type: 'tool_call',
        agent_name: 'agent',
        system: 'sys',
        operation: 'op',
        input: {},
        status: 'completed',
      };

      // First poll errors, second succeeds
      mockQueryCommand
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValue({ Items: [successEvent] });

      service.startPolling('wf-123');

      // First poll fails
      await flushPromises();
      expect(receivedErrors).toHaveLength(1);

      // Wait for backoff (1000ms) and second poll
      await new Promise((r) => setTimeout(r, 1100));

      expect(receivedEvents.length).toBeGreaterThanOrEqual(1);

      service.stopPolling();
    });
  });

  describe('stopPolling()', () => {
    it('should set isPolling to false', async () => {
      const service = getDynamoDbPollingService();

      mockQueryCommand.mockResolvedValue({ Items: [] });

      service.startPolling('wf-123');
      await flushPromises();

      expect(service.isPolling()).toBe(true);

      service.stopPolling();

      expect(service.isPolling()).toBe(false);
    });

    it('should keep workflowId for reference after stopping', async () => {
      const service = getDynamoDbPollingService();

      mockQueryCommand.mockResolvedValue({ Items: [] });

      service.startPolling('wf-123');
      await flushPromises();

      service.stopPolling();

      // workflowId should be preserved for reference
      expect(service.getCurrentWorkflowId()).toBe('wf-123');
    });
  });
});

// ============================================================================
// Task Group 4: Integration and Gap Analysis Tests
// ============================================================================

describe('Task Group 4: Integration and Gap Analysis', () => {
  beforeEach(() => {
    resetDynamoDbPollingService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetDynamoDbPollingService();
  });

  describe('Full Polling Cycle Integration', () => {
    it('should complete cycle: start -> receive events -> terminal -> stop', async () => {
      const service = getDynamoDbPollingService();
      const receivedEvents: DynamoDbEvent[] = [];

      service.onEvent((event) => receivedEvents.push(event));

      const event1: ToolCallEvent = {
        workflow_id: 'wf-123',
        timestamp: 1000,
        event_type: 'tool_call',
        agent_name: 'agent1',
        system: 'sys',
        operation: 'op',
        input: {},
        status: 'completed',
      };

      const terminalEvent = {
        workflow_id: 'wf-123',
        timestamp: 3000,
        event_type: 'workflow_complete',
        status: 'completed',
      };

      let callCount = 0;
      mockQueryCommand.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ Items: [event1] });
        }
        return Promise.resolve({ Items: [terminalEvent] });
      });

      service.startPolling('wf-123');

      // First poll
      await flushPromises();
      expect(receivedEvents).toHaveLength(1);
      expect(service.isPolling()).toBe(true);

      // Wait for second poll
      await new Promise((r) => setTimeout(r, 600));

      expect(receivedEvents).toHaveLength(2);
      expect(service.isPolling()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query results gracefully', async () => {
      const service = getDynamoDbPollingService();
      const receivedEvents: DynamoDbEvent[] = [];

      service.onEvent((event) => receivedEvents.push(event));

      mockQueryCommand.mockResolvedValue({ Items: [] });

      service.startPolling('wf-123');
      await flushPromises();

      expect(receivedEvents).toHaveLength(0);
      expect(service.isPolling()).toBe(true);

      service.stopPolling();
    });

    it('should handle undefined Items in response', async () => {
      const service = getDynamoDbPollingService();
      const receivedEvents: DynamoDbEvent[] = [];

      service.onEvent((event) => receivedEvents.push(event));

      mockQueryCommand.mockResolvedValue({});

      service.startPolling('wf-123');
      await flushPromises();

      expect(receivedEvents).toHaveLength(0);
      expect(service.isPolling()).toBe(true);

      service.stopPolling();
    });

    it('should handle rapid start/stop cycles', async () => {
      const service = getDynamoDbPollingService();

      mockQueryCommand.mockResolvedValue({ Items: [] });

      // Rapid start/stop
      service.startPolling('wf-1');
      service.stopPolling();
      service.startPolling('wf-2');
      service.stopPolling();
      service.startPolling('wf-3');

      await flushPromises();

      expect(service.isPolling()).toBe(true);
      expect(service.getCurrentWorkflowId()).toBe('wf-3');

      service.stopPolling();
    });

    it('should clear seen events when starting new workflow', async () => {
      const service = getDynamoDbPollingService();
      const receivedEvents: DynamoDbEvent[] = [];

      service.onEvent((event) => receivedEvents.push(event));

      const event: ToolCallEvent = {
        workflow_id: 'wf-123',
        timestamp: 1000,
        event_type: 'tool_call',
        agent_name: 'agent',
        system: 'sys',
        operation: 'op',
        input: {},
        status: 'completed',
      };

      mockQueryCommand.mockResolvedValue({ Items: [event] });

      // First workflow
      service.startPolling('wf-123');
      await flushPromises();
      expect(receivedEvents).toHaveLength(1);

      // Start new workflow - seen events should be cleared
      service.startPolling('wf-456');
      await flushPromises();

      // Same event content from new workflow should be received again
      // because seen set was cleared
      expect(receivedEvents.length).toBeGreaterThan(1);

      service.stopPolling();
    });

    it('should emit terminal event before stopping', async () => {
      const service = getDynamoDbPollingService();
      const receivedEvents: DynamoDbEvent[] = [];

      service.onEvent((event) => {
        receivedEvents.push(event);
      });

      const terminalEvent = {
        workflow_id: 'wf-123',
        timestamp: 1000,
        event_type: 'workflow_complete',
        status: 'completed',
      };

      mockQueryCommand.mockResolvedValue({ Items: [terminalEvent] });

      service.startPolling('wf-123');
      await flushPromises();

      // Terminal event should be received
      expect(receivedEvents).toHaveLength(1);
      // Polling should be stopped after event
      expect(service.isPolling()).toBe(false);
    });

    it('should emit non-terminal events before terminal in same batch', async () => {
      const service = getDynamoDbPollingService();
      const receivedEvents: DynamoDbEvent[] = [];

      service.onEvent((event) => {
        receivedEvents.push(event);
      });

      const regularEvent: AgentSpanEvent = {
        workflow_id: 'wf-123',
        timestamp: 1000,
        event_type: 'agent_end',
        agent_name: 'agent',
        role: 'worker',
      };

      const terminalEvent = {
        workflow_id: 'wf-123',
        timestamp: 2000,
        event_type: 'workflow_complete',
        status: 'completed',
      };

      mockQueryCommand.mockResolvedValue({ Items: [regularEvent, terminalEvent] });

      service.startPolling('wf-123');
      await flushPromises();

      // Both events should be received in order
      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[0].timestamp).toBe(1000);
      expect(receivedEvents[1].timestamp).toBe(2000);
      expect(service.isPolling()).toBe(false);
    });
  });
});
