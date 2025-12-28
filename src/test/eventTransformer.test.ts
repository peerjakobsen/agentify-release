/**
 * Tests for eventTransformer utility (Task Group 2)
 *
 * These tests validate the transformation of MergedEvent objects to LogEntry objects
 * for display in the execution log panel.
 */

import { describe, it, expect } from 'vitest';
import { transformEventToLogEntry } from '../utils/eventTransformer';
import type {
  MergedEvent,
  NodeStartEvent,
  NodeStopEvent,
  NodeStreamEvent,
  GraphStructureEvent,
  ToolCallEvent,
  WorkflowCompleteEvent,
  WorkflowErrorEvent,
} from '../types/events';

describe('transformEventToLogEntry', () => {
  describe('node_start events', () => {
    it('should transform node_start to "node_id started" with neutral status', () => {
      const event: MergedEvent<NodeStartEvent> = {
        source: 'stdout',
        event: {
          type: 'node_start',
          workflow_id: 'wf-123',
          timestamp: 1703779200000,
          node_id: 'planner_agent',
        },
      };

      const result = transformEventToLogEntry(event);

      expect(result).not.toBeNull();
      expect(result!.summary).toContain('planner_agent');
      expect(result!.summary).toContain('started');
      expect(result!.status).toBe('neutral');
      expect(result!.eventType).toBe('node_start');
      expect(result!.agentName).toBe('planner_agent');
      expect(result!.timestamp).toBe(1703779200000);
    });
  });

  describe('node_stop events', () => {
    it('should transform completed node_stop with checkmark and success status', () => {
      const event: MergedEvent<NodeStopEvent> = {
        source: 'stdout',
        event: {
          type: 'node_stop',
          workflow_id: 'wf-123',
          timestamp: 1703779210000,
          node_id: 'planner_agent',
          status: 'completed',
          execution_time_ms: 1234,
        },
      };

      const result = transformEventToLogEntry(event);

      expect(result).not.toBeNull();
      expect(result!.summary).toContain('planner_agent');
      expect(result!.summary).toContain('completed');
      expect(result!.summary).toContain('1.2s');
      expect(result!.status).toBe('success');
      expect(result!.eventType).toBe('node_stop');
      expect(result!.durationMs).toBe(1234);
    });

    it('should transform failed node_stop with X and error status', () => {
      const event: MergedEvent<NodeStopEvent> = {
        source: 'stdout',
        event: {
          type: 'node_stop',
          workflow_id: 'wf-123',
          timestamp: 1703779210000,
          node_id: 'executor_agent',
          status: 'failed',
          execution_time_ms: 500,
        },
      };

      const result = transformEventToLogEntry(event);

      expect(result).not.toBeNull();
      expect(result!.summary).toContain('executor_agent');
      expect(result!.summary).toContain('failed');
      expect(result!.status).toBe('error');
      expect(result!.eventType).toBe('node_stop');
    });
  });

  describe('tool_call events', () => {
    it('should transform tool_call with wrench icon and include payload', () => {
      const event: MergedEvent<ToolCallEvent> = {
        source: 'dynamodb',
        event: {
          event_type: 'tool_call',
          workflow_id: 'wf-123',
          timestamp: 1703779205000,
          agent_name: 'data_agent',
          system: 'SAP S/4HANA',
          operation: 'get_inventory_levels',
          input: { warehouse_id: 'WH-001' },
          status: 'completed',
        },
      };

      const result = transformEventToLogEntry(event);

      expect(result).not.toBeNull();
      expect(result!.summary).toContain('SAP S/4HANA');
      expect(result!.summary).toContain('get_inventory_levels');
      expect(result!.status).toBe('neutral');
      expect(result!.eventType).toBe('tool_call');
      expect(result!.agentName).toBe('data_agent');
      expect(result!.payload).toBeDefined();
      expect(result!.payload!.input).toEqual({ warehouse_id: 'WH-001' });
    });
  });

  describe('workflow_complete events', () => {
    it('should transform workflow_complete with checkmark and total time', () => {
      const event: MergedEvent<WorkflowCompleteEvent> = {
        source: 'stdout',
        event: {
          type: 'workflow_complete',
          workflow_id: 'wf-123',
          timestamp: 1703779230000,
          status: 'completed',
          execution_time_ms: 4567,
          execution_order: ['planner_agent', 'executor_agent'],
          result: 'Analysis complete',
          sources: ['SAP S/4HANA'],
        },
      };

      const result = transformEventToLogEntry(event);

      expect(result).not.toBeNull();
      expect(result!.summary).toContain('Workflow completed');
      expect(result!.summary).toContain('4.6s');
      expect(result!.status).toBe('success');
      expect(result!.eventType).toBe('workflow_complete');
      expect(result!.payload).toBeDefined();
    });
  });

  describe('workflow_error events', () => {
    it('should transform workflow_error with X and error message', () => {
      const event: MergedEvent<WorkflowErrorEvent> = {
        source: 'stdout',
        event: {
          type: 'workflow_error',
          workflow_id: 'wf-123',
          timestamp: 1703779215000,
          error_message: 'Connection timeout to SAP system',
          error_code: 'ERR_TIMEOUT',
        },
      };

      const result = transformEventToLogEntry(event);

      expect(result).not.toBeNull();
      expect(result!.summary).toContain('Workflow failed');
      expect(result!.summary).toContain('Connection timeout');
      expect(result!.status).toBe('error');
      expect(result!.eventType).toBe('workflow_error');
      expect(result!.errorMessage).toBe('Connection timeout to SAP system');
    });
  });

  describe('skipped events', () => {
    it('should return null for node_stream events', () => {
      const event: MergedEvent<NodeStreamEvent> = {
        source: 'stdout',
        event: {
          type: 'node_stream',
          workflow_id: 'wf-123',
          timestamp: 1703779206000,
          node_id: 'planner_agent',
          data: 'Processing...',
        },
      };

      const result = transformEventToLogEntry(event);

      expect(result).toBeNull();
    });

    it('should return null for graph_structure events', () => {
      const event: MergedEvent<GraphStructureEvent> = {
        source: 'stdout',
        event: {
          type: 'graph_structure',
          workflow_id: 'wf-123',
          timestamp: 1703779199000,
          nodes: [{ id: 'node1', name: 'Node 1', role: 'planner' }],
          edges: [{ from: 'node1', to: 'node2' }],
          entry_points: ['node1'],
        },
      };

      const result = transformEventToLogEntry(event);

      expect(result).toBeNull();
    });
  });
});
