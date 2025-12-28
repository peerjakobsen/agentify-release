/**
 * Tests for StdoutEventParser Service
 *
 * These tests validate the stdout event parser service for parsing JSON events
 * from workflow subprocess stdout stream.
 * Organized by task groups:
 * - Task Group 1: EventEmitter Pattern and Singleton
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { MergedEvent, StdoutEvent, NodeStartEvent, WorkflowCompleteEvent } from '../types/events';

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
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
  },
  Uri: {
    file: (path: string) => ({ fsPath: path }),
  },
}));

// Mock WorkflowTriggerService
const mockOnStdoutLine = vi.fn();
const mockOnStdoutLineListeners: Array<(line: string) => void> = [];

vi.mock('../services/workflowTriggerService', () => ({
  getWorkflowTriggerService: vi.fn(() => ({
    onStdoutLine: (listener: (line: string) => void) => {
      mockOnStdoutLineListeners.push(listener);
      mockOnStdoutLine(listener);
      return { dispose: () => mockOnStdoutLineListeners.splice(mockOnStdoutLineListeners.indexOf(listener), 1) };
    },
    dispose: vi.fn(),
  })),
}));

// Import after mocks
import {
  getStdoutEventParser,
  resetStdoutEventParser,
} from '../services/stdoutEventParser';

// Helper to simulate stdout line from WorkflowTriggerService
function simulateStdoutLine(line: string): void {
  mockOnStdoutLineListeners.forEach((listener) => listener(line));
}

// Helper to wait for pending promises
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

// ============================================================================
// Task Group 1: EventEmitter Pattern and Singleton Tests
// ============================================================================

describe('Task Group 1: StdoutEventParser EventEmitter and Singleton', () => {
  beforeEach(() => {
    resetStdoutEventParser();
    vi.clearAllMocks();
    mockOnStdoutLineListeners.length = 0;
  });

  afterEach(() => {
    resetStdoutEventParser();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls to getStdoutEventParser()', () => {
      const first = getStdoutEventParser();
      const second = getStdoutEventParser();
      expect(first).toBe(second);
    });

    it('should return a new instance after resetStdoutEventParser()', () => {
      const first = getStdoutEventParser();
      resetStdoutEventParser();
      const second = getStdoutEventParser();
      expect(first).not.toBe(second);
    });
  });

  describe('onEvent EventEmitter', () => {
    it('should fire onEvent when valid JSON line is processed', async () => {
      const parser = getStdoutEventParser();
      const receivedEvents: MergedEvent<StdoutEvent>[] = [];

      parser.onEvent((event) => {
        receivedEvents.push(event);
      });

      const validEvent: NodeStartEvent = {
        type: 'node_start',
        workflow_id: 'wf-123',
        timestamp: Date.now(),
        node_id: 'planner-agent',
      };

      // Simulate a valid JSON line from WorkflowTriggerService
      simulateStdoutLine(JSON.stringify(validEvent));

      await flushPromises();

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].source).toBe('stdout');
      expect(receivedEvents[0].event.type).toBe('node_start');
      expect((receivedEvents[0].event as NodeStartEvent).node_id).toBe('planner-agent');
    });

    it('should wrap parsed events as MergedEvent with source stdout', async () => {
      const parser = getStdoutEventParser();
      const receivedEvents: MergedEvent<StdoutEvent>[] = [];

      parser.onEvent((event) => {
        receivedEvents.push(event);
      });

      const completeEvent: WorkflowCompleteEvent = {
        type: 'workflow_complete',
        workflow_id: 'wf-456',
        timestamp: Date.now(),
        status: 'completed',
        execution_time_ms: 5000,
        execution_order: ['planner', 'executor'],
      };

      simulateStdoutLine(JSON.stringify(completeEvent));

      await flushPromises();

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].source).toBe('stdout');
      expect(receivedEvents[0].event.type).toBe('workflow_complete');
    });
  });

  describe('onParseError EventEmitter', () => {
    it('should fire onParseError when malformed JSON is received', async () => {
      const parser = getStdoutEventParser();
      const receivedErrors: Array<{ error: Error; rawData: string }> = [];

      parser.onParseError((errorInfo) => {
        receivedErrors.push(errorInfo);
      });

      // Simulate malformed JSON line
      simulateStdoutLine('{invalid json');

      await flushPromises();

      expect(receivedErrors).toHaveLength(1);
      expect(receivedErrors[0].rawData).toBe('{invalid json');
      expect(receivedErrors[0].error).toBeInstanceOf(Error);
    });
  });

  describe('dispose() Method', () => {
    it('should properly clean up EventEmitter subscriptions on dispose()', () => {
      const parser = getStdoutEventParser();
      const receivedEvents: MergedEvent<StdoutEvent>[] = [];
      const receivedErrors: Array<{ error: Error; rawData: string }> = [];

      parser.onEvent((event) => {
        receivedEvents.push(event);
      });

      parser.onParseError((errorInfo) => {
        receivedErrors.push(errorInfo);
      });

      // Dispose should not throw
      expect(() => parser.dispose()).not.toThrow();

      // After dispose, the instance is cleaned up
      // New instance should work independently
      resetStdoutEventParser();
      const newParser = getStdoutEventParser();
      expect(newParser).not.toBe(parser);
    });
  });

  describe('WorkflowTriggerService Subscription', () => {
    it('should subscribe to WorkflowTriggerService.onStdoutLine and receive lines', async () => {
      // Getting the parser should trigger subscription
      const parser = getStdoutEventParser();
      const receivedEvents: MergedEvent<StdoutEvent>[] = [];

      parser.onEvent((event) => {
        receivedEvents.push(event);
      });

      // Verify the subscription was set up
      expect(mockOnStdoutLineListeners.length).toBeGreaterThan(0);

      // Simulate multiple lines
      const event1: NodeStartEvent = {
        type: 'node_start',
        workflow_id: 'wf-789',
        timestamp: Date.now(),
        node_id: 'agent-1',
      };

      const event2: NodeStartEvent = {
        type: 'node_start',
        workflow_id: 'wf-789',
        timestamp: Date.now() + 100,
        node_id: 'agent-2',
      };

      simulateStdoutLine(JSON.stringify(event1));
      simulateStdoutLine(JSON.stringify(event2));

      await flushPromises();

      expect(receivedEvents).toHaveLength(2);
      expect((receivedEvents[0].event as NodeStartEvent).node_id).toBe('agent-1');
      expect((receivedEvents[1].event as NodeStartEvent).node_id).toBe('agent-2');
    });

    it('should skip non-JSON lines without firing parse error', async () => {
      const parser = getStdoutEventParser();
      const receivedEvents: MergedEvent<StdoutEvent>[] = [];
      const receivedErrors: Array<{ error: Error; rawData: string }> = [];

      parser.onEvent((event) => {
        receivedEvents.push(event);
      });

      parser.onParseError((errorInfo) => {
        receivedErrors.push(errorInfo);
      });

      // Non-JSON lines (logs, warnings) should be skipped
      simulateStdoutLine('INFO: Starting workflow...');
      simulateStdoutLine('DEBUG: Processing step 1');
      simulateStdoutLine('');
      simulateStdoutLine('   ');

      await flushPromises();

      // No events or errors should be emitted for non-JSON lines
      expect(receivedEvents).toHaveLength(0);
      expect(receivedErrors).toHaveLength(0);
    });
  });
});
