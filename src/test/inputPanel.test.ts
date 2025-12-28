/**
 * Tests for Input Panel Core Utilities (Task Group 1)
 *
 * Tests for:
 * - Workflow ID generation format
 * - Trace ID generation format
 * - State machine transitions
 * - Timer formatting
 */

import { describe, it, expect } from 'vitest';
import { generateWorkflowId, generateTraceId } from '../utils/idGenerator';
import { formatTime } from '../utils/timerFormatter';
import { canTransition, getNextState } from '../utils/inputPanelStateMachine';
import { InputPanelState } from '../types/inputPanel';

describe('ID Generator - Workflow ID', () => {
  it('should generate workflow ID with wf- prefix and 8 alphanumeric chars', () => {
    const id = generateWorkflowId();

    expect(id).toMatch(/^wf-[a-f0-9]{8}$/);
    expect(id.length).toBe(11); // 'wf-' (3) + 8 chars
  });

  it('should generate unique workflow IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateWorkflowId());
    }
    expect(ids.size).toBe(100);
  });
});

describe('ID Generator - Trace ID', () => {
  it('should generate 32-character lowercase hex trace ID', () => {
    const traceId = generateTraceId();

    expect(traceId).toMatch(/^[a-f0-9]{32}$/);
    expect(traceId.length).toBe(32);
  });

  it('should generate unique trace IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateTraceId());
    }
    expect(ids.size).toBe(100);
  });

  it('should not contain dashes (OTEL compatible)', () => {
    const traceId = generateTraceId();
    expect(traceId).not.toContain('-');
  });
});

describe('Timer Formatter', () => {
  it('should return --:-- for null input', () => {
    expect(formatTime(null)).toBe('--:--');
  });

  it('should return --:-- for undefined input', () => {
    expect(formatTime(undefined)).toBe('--:--');
  });

  it('should format 0ms as 00:00', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  it('should format seconds correctly (MM:SS format)', () => {
    expect(formatTime(4000)).toBe('00:04');
    expect(formatTime(45000)).toBe('00:45');
  });

  it('should format minutes correctly', () => {
    expect(formatTime(60000)).toBe('01:00');
    expect(formatTime(125000)).toBe('02:05');
  });

  it('should format with decimal when showDecimal is true', () => {
    expect(formatTime(12300, true)).toBe('00:12.3');
    expect(formatTime(65500, true)).toBe('01:05.5');
  });

  it('should handle large values', () => {
    // 59 minutes 59 seconds
    expect(formatTime(3599000)).toBe('59:59');
    // Over an hour
    expect(formatTime(3661000)).toBe('61:01');
  });
});

describe('State Machine - Transitions', () => {
  it('should allow Ready -> Running transition', () => {
    expect(canTransition(InputPanelState.Ready, InputPanelState.Running)).toBe(true);
  });

  it('should allow Running -> Completed transition', () => {
    expect(canTransition(InputPanelState.Running, InputPanelState.Completed)).toBe(true);
  });

  it('should allow Running -> Error transition', () => {
    expect(canTransition(InputPanelState.Running, InputPanelState.Error)).toBe(true);
  });

  it('should allow Completed -> Ready transition (reset)', () => {
    expect(canTransition(InputPanelState.Completed, InputPanelState.Ready)).toBe(true);
  });

  it('should allow Error -> Ready transition (reset)', () => {
    expect(canTransition(InputPanelState.Error, InputPanelState.Ready)).toBe(true);
  });

  it('should NOT allow Ready -> Completed transition', () => {
    expect(canTransition(InputPanelState.Ready, InputPanelState.Completed)).toBe(false);
  });

  it('should NOT allow Running -> Ready transition (no cancel)', () => {
    expect(canTransition(InputPanelState.Running, InputPanelState.Ready)).toBe(false);
  });
});

describe('State Machine - Events', () => {
  it('should return Running state for RUN_WORKFLOW from Ready', () => {
    const next = getNextState(InputPanelState.Ready, 'RUN_WORKFLOW');
    expect(next).toBe(InputPanelState.Running);
  });

  it('should return null for RUN_WORKFLOW from Running (already running)', () => {
    const next = getNextState(InputPanelState.Running, 'RUN_WORKFLOW');
    expect(next).toBeNull();
  });

  it('should return Completed state for WORKFLOW_COMPLETE from Running', () => {
    const next = getNextState(InputPanelState.Running, 'WORKFLOW_COMPLETE');
    expect(next).toBe(InputPanelState.Completed);
  });

  it('should return Error state for WORKFLOW_ERROR from Running', () => {
    const next = getNextState(InputPanelState.Running, 'WORKFLOW_ERROR');
    expect(next).toBe(InputPanelState.Error);
  });

  it('should return Ready state for RESET from Completed', () => {
    const next = getNextState(InputPanelState.Completed, 'RESET');
    expect(next).toBe(InputPanelState.Ready);
  });

  it('should return Ready state for RESET from Error', () => {
    const next = getNextState(InputPanelState.Error, 'RESET');
    expect(next).toBe(InputPanelState.Ready);
  });

  it('should return null for RESET from Running (cannot cancel)', () => {
    const next = getNextState(InputPanelState.Running, 'RESET');
    expect(next).toBeNull();
  });
});
