/**
 * Tests for Workflow Trigger Service
 *
 * These tests validate the workflow trigger service for subprocess execution.
 * Organized by task groups:
 * - Task Group 1: Singleton Service Setup
 * - Task Group 2: EventEmitter Implementation
 * - Task Group 3: Line-Buffered stdout Streaming
 * - Task Group 4: Subprocess Spawning
 * - Task Group 5: Process Termination
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

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

// Mock fs module with factory function
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

// Mock child_process module with factory function
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock config service with factory function
vi.mock('../services/configService', () => ({
  getConfigService: vi.fn(() => ({
    getConfig: vi.fn(() =>
      Promise.resolve({
        workflow: {
          entryScript: 'main.py',
          pythonPath: 'python3',
        },
        infrastructure: {
          dynamodb: {
            tableName: 'test-workflow-events',
            region: 'us-east-1',
          },
        },
      })
    ),
  })),
}));

// Mock ID generator
vi.mock('../utils/idGenerator', () => ({
  generateWorkflowId: vi.fn(() => 'wf-test1234'),
  generateTraceId: vi.fn(() => '80e1afed08e019fc1110464cfa66635c'),
}));

// Import after mocks
import {
  getWorkflowTriggerService,
  resetWorkflowTriggerService,
  type ProcessState,
} from '../services/workflowTriggerService';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { getConfigService } from '../services/configService';

// Helper to create mock process
function createMockProcess(): ChildProcess & {
  _stdout: EventEmitter;
  _stderr: EventEmitter;
  simulateStdout: (data: string) => void;
  simulateStderr: (data: string) => void;
  simulateClose: (code: number | null, signal?: string | null) => void;
  simulateError: (error: Error) => void;
} {
  const proc = new EventEmitter() as ChildProcess & {
    _stdout: EventEmitter;
    _stderr: EventEmitter;
    simulateStdout: (data: string) => void;
    simulateStderr: (data: string) => void;
    simulateClose: (code: number | null, signal?: string | null) => void;
    simulateError: (error: Error) => void;
  };

  proc._stdout = new EventEmitter();
  proc._stderr = new EventEmitter();
  proc.stdout = proc._stdout as typeof proc.stdout;
  proc.stderr = proc._stderr as typeof proc.stderr;
  proc.kill = vi.fn().mockReturnValue(true);
  proc.pid = 12345;

  proc.simulateStdout = (data: string) => {
    proc._stdout.emit('data', Buffer.from(data));
  };

  proc.simulateStderr = (data: string) => {
    proc._stderr.emit('data', Buffer.from(data));
  };

  proc.simulateClose = (code: number | null, signal: string | null = null) => {
    proc.emit('close', code, signal);
  };

  proc.simulateError = (error: Error) => {
    proc.emit('error', error);
  };

  return proc;
}

// Helper to wait for pending promises
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

// ============================================================================
// Task Group 1: Singleton Service Setup Tests
// ============================================================================

describe('Task Group 1: Singleton Service Setup', () => {
  beforeEach(() => {
    resetWorkflowTriggerService();
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
  });

  afterEach(() => {
    resetWorkflowTriggerService();
  });

  describe('Singleton Pattern', () => {
    it('should return an instance on getWorkflowTriggerService()', () => {
      const instance = getWorkflowTriggerService();
      expect(instance).toBeDefined();
      expect(instance).not.toBeNull();
    });

    it('should return the same instance on repeated calls', () => {
      const first = getWorkflowTriggerService();
      const second = getWorkflowTriggerService();
      expect(first).toBe(second);
    });

    it('should dispose and null instance on resetWorkflowTriggerService()', () => {
      const first = getWorkflowTriggerService();
      resetWorkflowTriggerService();
      const second = getWorkflowTriggerService();
      expect(first).not.toBe(second);
    });

    it('should create a new instance after reset', () => {
      const first = getWorkflowTriggerService();
      const firstState = first.getState();
      resetWorkflowTriggerService();
      const second = getWorkflowTriggerService();
      expect(second).toBeDefined();
      expect(second.getState()).toBe('idle');
      expect(firstState).toBe('idle');
    });
  });

  describe('ProcessState Type and State Tracking', () => {
    it('should have initial state of idle', () => {
      const service = getWorkflowTriggerService();
      expect(service.getState()).toBe('idle');
    });

    it('should return ProcessState from getState()', () => {
      const service = getWorkflowTriggerService();
      const state: ProcessState = service.getState();
      expect(['idle', 'running', 'completed', 'failed', 'killed']).toContain(state);
    });
  });
});

// ============================================================================
// Task Group 2: EventEmitter Implementation Tests
// ============================================================================

describe('Task Group 2: EventEmitter Implementation', () => {
  beforeEach(() => {
    resetWorkflowTriggerService();
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
  });

  afterEach(() => {
    resetWorkflowTriggerService();
  });

  describe('onStdoutLine Event', () => {
    it('should allow subscribing to onStdoutLine events', () => {
      const service = getWorkflowTriggerService();
      const receivedLines: string[] = [];

      service.onStdoutLine((line) => {
        receivedLines.push(line);
      });

      // Access internal emitter to fire event for testing
      (service as unknown as { _onStdoutLine: { fire: (s: string) => void } })._onStdoutLine.fire(
        'test line'
      );

      expect(receivedLines).toHaveLength(1);
      expect(receivedLines[0]).toBe('test line');
    });
  });

  describe('onStderr Event', () => {
    it('should allow subscribing to onStderr events', () => {
      const service = getWorkflowTriggerService();
      const receivedErrors: string[] = [];

      service.onStderr((data) => {
        receivedErrors.push(data);
      });

      // Access internal emitter to fire event for testing
      (service as unknown as { _onStderr: { fire: (s: string) => void } })._onStderr.fire(
        'error message'
      );

      expect(receivedErrors).toHaveLength(1);
      expect(receivedErrors[0]).toBe('error message');
    });
  });

  describe('onProcessStateChange Event', () => {
    it('should allow subscribing to onProcessStateChange events', () => {
      const service = getWorkflowTriggerService();
      const receivedStates: ProcessState[] = [];

      service.onProcessStateChange((state) => {
        receivedStates.push(state);
      });

      // Access internal emitter to fire event for testing
      (
        service as unknown as { _onProcessStateChange: { fire: (s: ProcessState) => void } }
      )._onProcessStateChange.fire('running');

      expect(receivedStates).toHaveLength(1);
      expect(receivedStates[0]).toBe('running');
    });
  });

  describe('onProcessExit Event', () => {
    it('should allow subscribing to onProcessExit events with code and signal', () => {
      const service = getWorkflowTriggerService();
      const receivedExits: Array<{ code: number | null; signal: string | null }> = [];

      service.onProcessExit((info) => {
        receivedExits.push(info);
      });

      // Access internal emitter to fire event for testing
      (
        service as unknown as {
          _onProcessExit: { fire: (info: { code: number | null; signal: string | null }) => void };
        }
      )._onProcessExit.fire({ code: 0, signal: null });

      expect(receivedExits).toHaveLength(1);
      expect(receivedExits[0]).toEqual({ code: 0, signal: null });
    });
  });

  describe('dispose() Method', () => {
    it('should dispose all emitters in dispose() method', () => {
      const service = getWorkflowTriggerService();

      // Subscribe to events
      service.onStdoutLine(() => {});
      service.onStderr(() => {});
      service.onProcessStateChange(() => {});
      service.onProcessExit(() => {});

      // Should not throw
      service.dispose();

      // After dispose, state should be idle
      expect(service.getState()).toBe('idle');
    });
  });
});

// ============================================================================
// Task Group 3: Line-Buffered stdout Streaming Tests
// ============================================================================

describe('Task Group 3: Line-Buffered stdout Streaming', () => {
  beforeEach(() => {
    resetWorkflowTriggerService();
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
  });

  afterEach(() => {
    resetWorkflowTriggerService();
  });

  describe('Line Buffering Logic', () => {
    it('should emit complete line immediately', () => {
      const service = getWorkflowTriggerService();
      const receivedLines: string[] = [];

      service.onStdoutLine((line) => {
        receivedLines.push(line);
      });

      // Access internal method to test line buffering
      (
        service as unknown as { _handleStdoutData: (data: Buffer) => void }
      )._handleStdoutData(Buffer.from('complete line\n'));

      expect(receivedLines).toHaveLength(1);
      expect(receivedLines[0]).toBe('complete line');
    });

    it('should hold partial line in buffer', () => {
      const service = getWorkflowTriggerService();
      const receivedLines: string[] = [];

      service.onStdoutLine((line) => {
        receivedLines.push(line);
      });

      // Send partial line (no newline)
      (
        service as unknown as { _handleStdoutData: (data: Buffer) => void }
      )._handleStdoutData(Buffer.from('partial'));

      expect(receivedLines).toHaveLength(0);
    });

    it('should split multiple lines in single chunk correctly', () => {
      const service = getWorkflowTriggerService();
      const receivedLines: string[] = [];

      service.onStdoutLine((line) => {
        receivedLines.push(line);
      });

      // Send multiple lines in one chunk
      (
        service as unknown as { _handleStdoutData: (data: Buffer) => void }
      )._handleStdoutData(Buffer.from('line1\nline2\nline3\n'));

      expect(receivedLines).toHaveLength(3);
      expect(receivedLines[0]).toBe('line1');
      expect(receivedLines[1]).toBe('line2');
      expect(receivedLines[2]).toBe('line3');
    });

    it('should complete partial line with next chunk', () => {
      const service = getWorkflowTriggerService();
      const receivedLines: string[] = [];

      service.onStdoutLine((line) => {
        receivedLines.push(line);
      });

      // First chunk - partial line
      (
        service as unknown as { _handleStdoutData: (data: Buffer) => void }
      )._handleStdoutData(Buffer.from('partial '));

      expect(receivedLines).toHaveLength(0);

      // Second chunk - completes the line
      (
        service as unknown as { _handleStdoutData: (data: Buffer) => void }
      )._handleStdoutData(Buffer.from('complete\n'));

      expect(receivedLines).toHaveLength(1);
      expect(receivedLines[0]).toBe('partial complete');
    });

    it('should flush buffer on process exit (non-empty content)', () => {
      const service = getWorkflowTriggerService();
      const receivedLines: string[] = [];

      service.onStdoutLine((line) => {
        receivedLines.push(line);
      });

      // Send partial line (no newline)
      (
        service as unknown as { _handleStdoutData: (data: Buffer) => void }
      )._handleStdoutData(Buffer.from('remaining content'));

      expect(receivedLines).toHaveLength(0);

      // Flush buffer
      (service as unknown as { _flushStdoutBuffer: () => void })._flushStdoutBuffer();

      expect(receivedLines).toHaveLength(1);
      expect(receivedLines[0]).toBe('remaining content');
    });

    it('should not flush empty buffer on exit', () => {
      const service = getWorkflowTriggerService();
      const receivedLines: string[] = [];

      service.onStdoutLine((line) => {
        receivedLines.push(line);
      });

      // Flush empty buffer
      (service as unknown as { _flushStdoutBuffer: () => void })._flushStdoutBuffer();

      expect(receivedLines).toHaveLength(0);
    });
  });
});

// ============================================================================
// Task Group 4: Subprocess Spawning Tests
// ============================================================================

describe('Task Group 4: Subprocess Spawning', () => {
  let mockProcess: ReturnType<typeof createMockProcess>;

  beforeEach(() => {
    resetWorkflowTriggerService();
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
    mockProcess = createMockProcess();
    vi.mocked(spawn).mockReturnValue(mockProcess);
  });

  afterEach(() => {
    resetWorkflowTriggerService();
  });

  describe('start() Method', () => {
    it('should return workflowId and traceId', async () => {
      const service = getWorkflowTriggerService();

      const result = await service.start('test prompt');

      expect(result).toEqual({
        workflowId: 'wf-test1234',
        traceId: '80e1afed08e019fc1110464cfa66635c',
      });
    });

    it('should transition state to running on start', async () => {
      const service = getWorkflowTriggerService();
      const receivedStates: ProcessState[] = [];

      service.onProcessStateChange((state) => {
        receivedStates.push(state);
      });

      await service.start('test prompt');

      expect(service.getState()).toBe('running');
      expect(receivedStates).toContain('running');
    });

    it('should call spawn with correct pythonPath and args', async () => {
      const service = getWorkflowTriggerService();

      await service.start('test prompt');

      expect(spawn).toHaveBeenCalledWith(
        'python3',
        expect.arrayContaining([
          expect.stringContaining('main.py'),
          '--prompt',
          'test prompt',
          '--workflow-id',
          'wf-test1234',
          '--trace-id',
          '80e1afed08e019fc1110464cfa66635c',
        ]),
        expect.objectContaining({
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: '/test/workspace',
        })
      );
    });

    it('should include AGENTIFY_TABLE_NAME and AWS_REGION in env', async () => {
      const service = getWorkflowTriggerService();

      await service.start('test prompt');

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            AGENTIFY_TABLE_NAME: 'test-workflow-events',
            AWS_REGION: 'us-east-1',
          }),
        })
      );
    });

    it('should set cwd to workspace root', async () => {
      const service = getWorkflowTriggerService();

      await service.start('test prompt');

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          cwd: '/test/workspace',
        })
      );
    });

    it('should throw validation error when entryScript not configured', async () => {
      vi.mocked(getConfigService).mockReturnValueOnce({
        getConfig: vi.fn(() =>
          Promise.resolve({
            workflow: {
              entryScript: null,
              pythonPath: 'python3',
            },
            infrastructure: {
              dynamodb: {
                tableName: 'test-table',
                region: 'us-east-1',
              },
            },
          })
        ),
      } as ReturnType<typeof getConfigService>);

      const service = getWorkflowTriggerService();

      await expect(service.start('test prompt')).rejects.toThrow(
        /entry script.*not configured/i
      );
    });

    it('should throw validation error when entry script file not found', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const service = getWorkflowTriggerService();

      await expect(service.start('test prompt')).rejects.toThrow(
        /entry script.*not found/i
      );
    });

    it('should use default pythonPath (python) when not configured', async () => {
      vi.mocked(getConfigService).mockReturnValueOnce({
        getConfig: vi.fn(() =>
          Promise.resolve({
            workflow: {
              entryScript: 'main.py',
              pythonPath: null,
            },
            infrastructure: {
              dynamodb: {
                tableName: 'test-table',
                region: 'us-east-1',
              },
            },
          })
        ),
      } as ReturnType<typeof getConfigService>);

      const service = getWorkflowTriggerService();

      await service.start('test prompt');

      expect(spawn).toHaveBeenCalledWith(
        'python',
        expect.any(Array),
        expect.any(Object)
      );
    });
  });

  describe('Process Exit Handling', () => {
    it('should transition to completed state when exit code is 0', async () => {
      const service = getWorkflowTriggerService();
      const receivedStates: ProcessState[] = [];
      const receivedExits: Array<{ code: number | null; signal: string | null }> = [];

      service.onProcessStateChange((state) => {
        receivedStates.push(state);
      });

      service.onProcessExit((info) => {
        receivedExits.push(info);
      });

      await service.start('test prompt');
      mockProcess.simulateClose(0);

      await flushPromises();

      expect(service.getState()).toBe('completed');
      expect(receivedStates).toContain('completed');
      expect(receivedExits[0]).toEqual({ code: 0, signal: null });
    });

    it('should transition to failed state when exit code is non-zero', async () => {
      const service = getWorkflowTriggerService();
      const receivedStates: ProcessState[] = [];

      service.onProcessStateChange((state) => {
        receivedStates.push(state);
      });

      await service.start('test prompt');
      mockProcess.simulateClose(1);

      await flushPromises();

      expect(service.getState()).toBe('failed');
      expect(receivedStates).toContain('failed');
    });

    it('should flush stdout buffer on process exit', async () => {
      const service = getWorkflowTriggerService();
      const receivedLines: string[] = [];

      service.onStdoutLine((line) => {
        receivedLines.push(line);
      });

      await service.start('test prompt');

      // Send partial line
      mockProcess.simulateStdout('partial content');
      expect(receivedLines).toHaveLength(0);

      // Process exits
      mockProcess.simulateClose(0);

      await flushPromises();

      // Buffer should be flushed
      expect(receivedLines).toContain('partial content');
    });
  });

  describe('Spawn Error Handling', () => {
    it('should transition to failed state on spawn error', async () => {
      const service = getWorkflowTriggerService();
      const receivedStates: ProcessState[] = [];
      const receivedExits: Array<{ code: number | null; signal: string | null }> = [];

      service.onProcessStateChange((state) => {
        receivedStates.push(state);
      });

      service.onProcessExit((info) => {
        receivedExits.push(info);
      });

      await service.start('test prompt');
      mockProcess.simulateError(new Error('spawn failed'));

      await flushPromises();

      expect(service.getState()).toBe('failed');
      expect(receivedExits[0]).toEqual({ code: null, signal: null });
    });
  });
});

// ============================================================================
// Task Group 5: Process Termination Tests
// ============================================================================

describe('Task Group 5: Process Termination', () => {
  let mockProcess: ReturnType<typeof createMockProcess>;

  beforeEach(() => {
    resetWorkflowTriggerService();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(existsSync).mockReturnValue(true);
    mockProcess = createMockProcess();
    vi.mocked(spawn).mockReturnValue(mockProcess);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetWorkflowTriggerService();
  });

  describe('kill() Method', () => {
    it('should send SIGTERM to active process', async () => {
      vi.useRealTimers();
      const service = getWorkflowTriggerService();

      await service.start('test prompt');

      const killPromise = service.kill();

      // Simulate process closing after SIGTERM
      mockProcess.simulateClose(null, 'SIGTERM');

      await killPromise;

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should send SIGKILL after 1-second timeout if still running', async () => {
      const service = getWorkflowTriggerService();

      await service.start('test prompt');

      // Start kill but don't simulate close yet
      const killPromise = service.kill();

      // SIGTERM should be called
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

      // Advance timer by 1 second
      await vi.advanceTimersByTimeAsync(1000);

      // SIGKILL should be called after timeout
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');

      // Simulate process finally closing
      mockProcess.simulateClose(null, 'SIGKILL');

      await killPromise;
    });

    it('should transition state to killed', async () => {
      vi.useRealTimers();
      const service = getWorkflowTriggerService();
      const receivedStates: ProcessState[] = [];

      service.onProcessStateChange((state) => {
        receivedStates.push(state);
      });

      await service.start('test prompt');

      const killPromise = service.kill();
      mockProcess.simulateClose(null, 'SIGTERM');

      await killPromise;

      expect(service.getState()).toBe('killed');
      expect(receivedStates).toContain('killed');
    });

    it('should return immediately if no active process', async () => {
      vi.useRealTimers();
      const service = getWorkflowTriggerService();

      // Should not throw and should complete immediately
      await service.kill();

      expect(service.getState()).toBe('idle');
    });
  });

  describe('Synchronous Kill on New Start', () => {
    it('should kill previous process when start() called while running', async () => {
      vi.useRealTimers();
      const service = getWorkflowTriggerService();

      // Start first process
      await service.start('first prompt');
      const firstProcess = mockProcess;

      // Create new mock process for second start
      mockProcess = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProcess);

      // Start second process while first is running
      const startPromise = service.start('second prompt');

      // First process should receive kill signal
      expect(firstProcess.kill).toHaveBeenCalled();

      // Simulate first process closing
      firstProcess.simulateClose(null, 'SIGTERM');

      await startPromise;

      // Second process should now be running
      expect(service.getState()).toBe('running');
    });

    it('should wait for previous process termination before spawning new', async () => {
      vi.useRealTimers();
      const service = getWorkflowTriggerService();
      let spawnCallCount = 0;

      vi.mocked(spawn).mockImplementation(() => {
        spawnCallCount++;
        return createMockProcess();
      });

      // Start first process
      await service.start('first prompt');
      expect(spawnCallCount).toBe(1);

      const firstProcess = vi.mocked(spawn).mock.results[0].value;

      // Start second process while first is running
      const startPromise = service.start('second prompt');

      // Should not have spawned second process yet
      expect(spawnCallCount).toBe(1);

      // Simulate first process closing
      firstProcess.simulateClose(null, 'SIGTERM');

      await startPromise;

      // Now second process should be spawned
      expect(spawnCallCount).toBe(2);
    });
  });
});

// ============================================================================
// Task Group 6: Integration Verification Tests
// ============================================================================

describe('Task Group 6: Integration Verification', () => {
  beforeEach(() => {
    resetWorkflowTriggerService();
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
  });

  afterEach(() => {
    resetWorkflowTriggerService();
  });

  describe('Service Readiness for Integration', () => {
    it('should have all required public methods', () => {
      const service = getWorkflowTriggerService();

      expect(typeof service.start).toBe('function');
      expect(typeof service.kill).toBe('function');
      expect(typeof service.getState).toBe('function');
      expect(typeof service.dispose).toBe('function');
    });

    it('should have all required public events', () => {
      const service = getWorkflowTriggerService();

      expect(service.onStdoutLine).toBeDefined();
      expect(service.onStderr).toBeDefined();
      expect(service.onProcessStateChange).toBeDefined();
      expect(service.onProcessExit).toBeDefined();
    });
  });
});
