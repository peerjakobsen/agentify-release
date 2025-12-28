/**
 * Tests for Workflow Executor Service (Task Group 3)
 *
 * Tests for:
 * - Subprocess spawn with correct CLI arguments
 * - Environment variables passed to subprocess
 * - Execution state management
 * - Lifecycle callbacks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Track mock state
let mockConfig: {
  workflow?: { entryScript?: string; pythonPath?: string };
  infrastructure?: { dynamodb?: { tableName?: string; region?: string } };
} | null = null;

let mockSpawnedProcess: {
  stdout: { on: ReturnType<typeof vi.fn> };
  stderr: { on: ReturnType<typeof vi.fn> };
  on: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
} | null = null;
let mockSpawnArgs: unknown[] = [];
let mockSpawnOptions: Record<string, unknown> = {};

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn().mockImplementation((cmd: string, args: unknown[], options: Record<string, unknown>) => {
    mockSpawnArgs = [cmd, args, options];
    mockSpawnOptions = options;

    const handlers: Record<string, ((...args: unknown[]) => void)[]> = {
      close: [],
      error: [],
    };
    const stdoutHandlers: ((...args: unknown[]) => void)[] = [];
    const stderrHandlers: ((...args: unknown[]) => void)[] = [];

    mockSpawnedProcess = {
      stdout: {
        on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'data') {
            stdoutHandlers.push(handler);
          }
        }),
      },
      stderr: {
        on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'data') {
            stderrHandlers.push(handler);
          }
        }),
      },
      on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (handlers[event]) {
          handlers[event].push(handler);
        }
      }),
      kill: vi.fn(),
    };

    // Simulate immediate successful completion
    setTimeout(() => {
      handlers.close.forEach(h => h(0));
    }, 10);

    return mockSpawnedProcess;
  }),
}));

// Mock vscode
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' }, name: 'test-workspace' }],
    fs: {
      stat: vi.fn().mockResolvedValue({ type: 1 }),
    },
  },
  Uri: {
    file: (path: string) => ({ fsPath: path }),
  },
  Disposable: vi.fn().mockImplementation((fn) => ({ dispose: fn })),
}));

// Mock config service
vi.mock('../services/configService', () => ({
  ConfigService: vi.fn().mockImplementation(() => ({
    getConfig: vi.fn().mockImplementation(() => Promise.resolve(mockConfig)),
    isInitialized: vi.fn().mockResolvedValue(true),
    onConfigChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  })),
}));

// Import module under test after mocks
import { WorkflowExecutor } from '../services/workflowExecutor';
import { ConfigService } from '../services/configService';

describe('Workflow Executor - Configuration', () => {
  let executor: WorkflowExecutor;
  let mockConfigService: ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = {
      workflow: {
        entryScript: 'agents/main.py',
        pythonPath: '.venv/bin/python',
      },
      infrastructure: {
        dynamodb: {
          tableName: 'test-table',
          region: 'us-east-1',
        },
      },
    };
    mockSpawnedProcess = null;
    mockSpawnArgs = [];
    mockSpawnOptions = {};

    mockConfigService = new ConfigService('/test/workspace');
    executor = new WorkflowExecutor(mockConfigService, '/test/workspace');
  });

  it('should return workflow config from getWorkflowConfig()', async () => {
    const config = await executor.getWorkflowConfig();

    expect(config).not.toBeNull();
    expect(config?.entryScript).toBe('agents/main.py');
    expect(config?.pythonPath).toBe('.venv/bin/python');
  });

  it('should return null when workflow config is missing', async () => {
    mockConfig = { workflow: {} };

    const config = await executor.getWorkflowConfig();

    expect(config).toBeNull();
  });

  it('should return DynamoDB env config from getDynamoDbEnv()', async () => {
    const env = await executor.getDynamoDbEnv();

    expect(env).not.toBeNull();
    expect(env?.tableName).toBe('test-table');
    expect(env?.region).toBe('us-east-1');
  });

  it('should default pythonPath to python3 when not specified', async () => {
    mockConfig = {
      workflow: {
        entryScript: 'agents/main.py',
        // pythonPath not specified
      },
    };

    const config = await executor.getWorkflowConfig();

    expect(config?.pythonPath).toBe('python3');
  });
});

describe('Workflow Executor - Subprocess Spawning', () => {
  let executor: WorkflowExecutor;
  let mockConfigService: ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = {
      workflow: {
        entryScript: 'agents/main.py',
        pythonPath: '.venv/bin/python',
      },
      infrastructure: {
        dynamodb: {
          tableName: 'test-table',
          region: 'us-east-1',
        },
      },
    };
    mockSpawnedProcess = null;
    mockSpawnArgs = [];
    mockSpawnOptions = {};

    mockConfigService = new ConfigService('/test/workspace');
    executor = new WorkflowExecutor(mockConfigService, '/test/workspace');
  });

  it('should spawn process with correct Python interpreter', async () => {
    await executor.execute('test prompt', 'wf-12345678', 'abcd1234abcd1234abcd1234abcd1234');

    expect(mockSpawnArgs[0]).toBe('.venv/bin/python');
  });

  it('should pass CLI arguments in correct format', async () => {
    await executor.execute('test prompt', 'wf-12345678', 'abcd1234abcd1234abcd1234abcd1234');

    const args = mockSpawnArgs[1] as string[];
    expect(args).toContain('--prompt');
    expect(args).toContain('test prompt');
    expect(args).toContain('--workflow-id');
    expect(args).toContain('wf-12345678');
    expect(args).toContain('--trace-id');
    expect(args).toContain('abcd1234abcd1234abcd1234abcd1234');
  });

  it('should set environment variables for DynamoDB', async () => {
    await executor.execute('test prompt', 'wf-12345678', 'abcd1234abcd1234abcd1234abcd1234');

    const options = mockSpawnArgs[2] as { env: NodeJS.ProcessEnv };
    expect(options.env.AGENTIFY_TABLE_NAME).toBe('test-table');
    expect(options.env.AGENTIFY_TABLE_REGION).toBe('us-east-1');
  });

  it('should include entry script path in arguments', async () => {
    await executor.execute('test prompt', 'wf-12345678', 'abcd1234abcd1234abcd1234abcd1234');

    const args = mockSpawnArgs[1] as string[];
    expect(args[0]).toContain('agents/main.py');
  });
});

describe('Workflow Executor - Execution State', () => {
  let executor: WorkflowExecutor;
  let mockConfigService: ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = {
      workflow: {
        entryScript: 'agents/main.py',
        pythonPath: '.venv/bin/python',
      },
      infrastructure: {
        dynamodb: {
          tableName: 'test-table',
          region: 'us-east-1',
        },
      },
    };
    mockSpawnedProcess = null;
    mockSpawnArgs = [];
    mockSpawnOptions = {};

    mockConfigService = new ConfigService('/test/workspace');
    executor = new WorkflowExecutor(mockConfigService, '/test/workspace');
  });

  it('should return execution with status completed on success', async () => {
    const execution = await executor.execute('test prompt', 'wf-12345678', 'abcd1234');

    expect(execution.status).toBe('completed');
    expect(execution.workflowId).toBe('wf-12345678');
    expect(execution.traceId).toBe('abcd1234');
    expect(execution.startTime).toBeDefined();
    expect(execution.endTime).toBeDefined();
  });

  it('should call onStart callback when execution begins', async () => {
    const onStart = vi.fn();

    await executor.execute('test prompt', 'wf-12345678', 'abcd1234', { onStart });

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({
      workflowId: 'wf-12345678',
    }));
  });

  it('should call onComplete callback when execution succeeds', async () => {
    const onComplete = vi.fn();

    await executor.execute('test prompt', 'wf-12345678', 'abcd1234', { onComplete });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
    }));
  });

  it('should track start and end times', async () => {
    const execution = await executor.execute('test prompt', 'wf-12345678', 'abcd1234');

    expect(execution.startTime).toBeGreaterThan(0);
    expect(execution.endTime).toBeGreaterThan(0);
    expect(execution.endTime).toBeGreaterThanOrEqual(execution.startTime);
  });
});

describe('Workflow Executor - Cleanup', () => {
  let executor: WorkflowExecutor;
  let mockConfigService: ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = {
      workflow: {
        entryScript: 'agents/main.py',
        pythonPath: '.venv/bin/python',
      },
    };

    mockConfigService = new ConfigService('/test/workspace');
    executor = new WorkflowExecutor(mockConfigService, '/test/workspace');
  });

  it('should dispose without error when no process running', () => {
    expect(() => executor.dispose()).not.toThrow();
  });

  it('should return false for isRunning when no process active', () => {
    expect(executor.isRunning()).toBe(false);
  });
});
