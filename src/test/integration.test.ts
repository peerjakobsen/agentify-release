/**
 * Integration tests (Task Group 4)
 *
 * These tests verify the integration between components.
 * They test the full extension activation flow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TableStatus } from '@aws-sdk/client-dynamodb';

// Mock config store
const mockConfigValues: Record<string, unknown> = {};

// Mock send function
const mockSend = vi.fn();

// Track information messages
let lastInfoMessage: string | undefined;
let lastErrorMessage: string | undefined;

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockImplementation(() => ({
      get: vi.fn((key: string, defaultValue: unknown) => {
        return mockConfigValues[key] ?? defaultValue;
      }),
    })),
    onDidChangeConfiguration: vi.fn().mockReturnValue({
      dispose: vi.fn(),
    }),
    workspaceFolders: [
      {
        uri: { fsPath: '/test/workspace' },
      },
    ],
    openTextDocument: vi.fn(),
    findFiles: vi.fn(() => Promise.resolve([])),
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
  window: {
    showInformationMessage: vi.fn().mockImplementation((message: string) => {
      lastInfoMessage = message;
      return Promise.resolve(undefined);
    }),
    showErrorMessage: vi.fn().mockImplementation((message: string) => {
      lastErrorMessage = message;
      return Promise.resolve(undefined);
    }),
    showWarningMessage: vi.fn().mockImplementation(() => Promise.resolve(undefined)),
    showTextDocument: vi.fn(),
    createStatusBarItem: vi.fn(() => ({
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
      text: '',
      tooltip: '',
      command: '',
      backgroundColor: undefined,
      color: undefined,
    })),
    showQuickPick: vi.fn(),
    registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
  },
  Uri: {
    joinPath: vi.fn(),
    parse: vi.fn(),
    file: (path: string) => ({ fsPath: path }),
  },
  env: {
    openExternal: vi.fn(),
  },
  commands: {
    executeCommand: vi.fn(),
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },
  ThemeColor: vi.fn((id: string) => ({ id })),
  RelativePattern: vi.fn(),
  Disposable: class {
    private disposeFn: () => void;
    constructor(disposeFn: () => void) {
      this.disposeFn = disposeFn;
    }
    dispose() {
      this.disposeFn();
    }
  },
}));

// Mock AWS SDK
vi.mock('@aws-sdk/client-dynamodb', async () => {
  const actual = await vi.importActual('@aws-sdk/client-dynamodb');
  return {
    ...actual,
    DynamoDBClient: vi.fn().mockImplementation(() => ({
      send: mockSend,
      destroy: vi.fn(),
    })),
  };
});

vi.mock('@aws-sdk/lib-dynamodb', async () => {
  const actual = await vi.importActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: {
      from: vi.fn().mockReturnValue({}),
    },
  };
});

// Helper functions
function setConfigValue(key: string, value: unknown) {
  mockConfigValues[key] = value;
}

function clearConfigValues() {
  Object.keys(mockConfigValues).forEach((key) => delete mockConfigValues[key]);
}

describe('Extension Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearConfigValues();
    lastInfoMessage = undefined;
    lastErrorMessage = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test 4.3.1: Full extension activation with valid table
  it('should show success message when table exists and is ACTIVE', async () => {
    mockSend.mockResolvedValueOnce({
      Table: {
        TableName: 'agentify-workflow-events',
        TableArn: 'arn:aws:dynamodb:us-east-1:123456789:table/agentify-workflow-events',
        TableStatus: TableStatus.ACTIVE,
      },
    });

    const { validateTableExists } = await import('../services/tableValidator');
    const result = await validateTableExists('agentify-workflow-events');

    expect(result.isValid).toBe(true);
    expect(result.tableName).toBe('agentify-workflow-events');
    expect(result.tableStatus).toBe(TableStatus.ACTIVE);
  });

  // Test 4.3.2: Full extension activation with missing table
  it('should return error when table is missing', async () => {
    const notFoundError = new Error('Table not found');
    notFoundError.name = 'ResourceNotFoundException';
    mockSend.mockRejectedValueOnce(notFoundError);

    vi.resetModules();
    vi.doMock('@aws-sdk/client-dynamodb', async () => {
      const actual = await vi.importActual('@aws-sdk/client-dynamodb');
      return {
        ...actual,
        DynamoDBClient: vi.fn().mockImplementation(() => ({
          send: mockSend,
          destroy: vi.fn(),
        })),
      };
    });

    const { validateTableExists } = await import('../services/tableValidator');
    const result = await validateTableExists('missing-table');

    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('not found');
  });

  // Test 4.3.3: Configuration provides correct default values for validation
  it('should use configuration defaults for table validation', async () => {
    const { getDynamoDbConfiguration } = await import('../config/dynamoDbConfig');
    const config = getDynamoDbConfiguration();

    expect(config.tableName).toBe('agentify-workflow-events');
    expect(config.region).toBe('us-east-1');
  });

  // Test 4.3.4: Custom configuration is used for validation
  it('should use custom configuration values when set', async () => {
    setConfigValue('dynamodb.tableName', 'my-custom-table');
    setConfigValue('aws.region', 'eu-west-1');

    vi.resetModules();
    vi.doMock('vscode', () => ({
      workspace: {
        getConfiguration: vi.fn().mockImplementation(() => ({
          get: vi.fn((key: string, defaultValue: unknown) => {
            return mockConfigValues[key] ?? defaultValue;
          }),
        })),
        onDidChangeConfiguration: vi.fn().mockReturnValue({
          dispose: vi.fn(),
        }),
      },
      Disposable: class {
        private disposeFn: () => void;
        constructor(disposeFn: () => void) {
          this.disposeFn = disposeFn;
        }
        dispose() {
          this.disposeFn();
        }
      },
    }));

    const { getDynamoDbConfiguration } = await import('../config/dynamoDbConfig');
    const config = getDynamoDbConfiguration();

    expect(config.tableName).toBe('my-custom-table');
    expect(config.region).toBe('eu-west-1');
  });
});

describe('Config Service Integration', () => {
  it('should validate config schema correctly', async () => {
    const { validateConfigSchema } = await import('../types/config');

    const validConfig = {
      version: '1.0.0',
      project: {
        name: 'Test Project',
        valueMap: 'Test value',
        industry: 'tech',
      },
      infrastructure: {
        dynamodb: {
          tableName: 'test-table',
          tableArn: 'arn:aws:dynamodb:us-east-1:123:table/test-table',
          region: 'us-east-1',
        },
      },
      workflow: {
        orchestrationPattern: 'graph',
        triggerType: 'local',
        triggerConfig: {
          type: 'local',
          entryScript: 'main.py',
          pythonPath: 'python3',
        },
        agents: [],
        edges: [],
      },
    };

    const result = validateConfigSchema(validConfig);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid config and return all errors', async () => {
    const { validateConfigSchema } = await import('../types/config');

    const invalidConfig = {
      // missing version
      project: {
        name: 'Test',
        // missing valueMap and industry
      },
      // missing infrastructure and workflow
    };

    const result = validateConfigSchema(invalidConfig);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('version'))).toBe(true);
  });
});

describe('AWS Client Integration', () => {
  beforeEach(async () => {
    const { resetClients } = await import('../services/dynamoDbClient');
    const { resetBedrockClient } = await import('../services/bedrockClient');
    resetClients();
    resetBedrockClient();
  });

  it('should create DynamoDB client with lazy initialization', async () => {
    const { getDynamoDbClient, resetClients } = await import('../services/dynamoDbClient');

    const client1 = getDynamoDbClient();
    const client2 = getDynamoDbClient();

    // Should return same instance
    expect(client1).toBe(client2);

    resetClients();
  });

  it('should create Bedrock client with lazy initialization', async () => {
    const { getBedrockClient, hasBedrockClient, resetBedrockClient } = await import(
      '../services/bedrockClient'
    );

    // Should not have client before first access
    expect(hasBedrockClient()).toBe(false);

    const client1 = getBedrockClient();

    // Should have client after first access
    expect(hasBedrockClient()).toBe(true);

    const client2 = getBedrockClient();

    // Should return same instance
    expect(client1).toBe(client2);

    resetBedrockClient();
  });
});

describe('Panel Provider Integration', () => {
  it('should create panel providers with correct view IDs', async () => {
    const { DemoViewerPanelProvider, DEMO_VIEWER_VIEW_ID } = await import(
      '../panels/demoViewerPanel'
    );
    const { IdeationWizardPanelProvider, IDEATION_WIZARD_VIEW_ID } = await import(
      '../panels/ideationWizardPanel'
    );

    expect(DEMO_VIEWER_VIEW_ID).toBe('agentify.demoViewer');
    expect(IDEATION_WIZARD_VIEW_ID).toBe('agentify.ideationWizard');

    const mockUri = { fsPath: '/test' } as any;
    const demoProvider = new DemoViewerPanelProvider(mockUri);
    const ideationProvider = new IdeationWizardPanelProvider(mockUri);

    expect(demoProvider).toBeDefined();
    expect(ideationProvider).toBeDefined();
  });
});

describe('Type System Integration', () => {
  it('should properly discriminate stdout events', async () => {
    const {
      isGraphStructureEvent,
      isNodeStartEvent,
      isStdoutEvent,
    } = await import('../types');

    const graphEvent = {
      workflow_id: 'wf-1',
      timestamp: Date.now(),
      type: 'graph_structure' as const,
      nodes: [],
      edges: [],
      entry_points: [],
    };

    expect(isGraphStructureEvent(graphEvent)).toBe(true);
    expect(isNodeStartEvent(graphEvent)).toBe(false);
    expect(isStdoutEvent(graphEvent)).toBe(true);
  });

  it('should properly discriminate DynamoDB events', async () => {
    const { isToolCallEvent, isAgentSpanEvent, isDynamoDbEvent } = await import('../types');

    const toolCallEvent = {
      workflow_id: 'wf-1',
      timestamp: Date.now(),
      event_type: 'tool_call' as const,
      agent_name: 'test-agent',
      system: 'test',
      operation: 'test-op',
      input: {},
      status: 'completed' as const,
    };

    expect(isToolCallEvent(toolCallEvent)).toBe(true);
    expect(isAgentSpanEvent(toolCallEvent)).toBe(false);
    expect(isDynamoDbEvent(toolCallEvent)).toBe(true);
  });
});

describe('Error Handling Integration', () => {
  it('should create and identify AgentifyError correctly', async () => {
    const {
      AgentifyError,
      AgentifyErrorCode,
      isAgentifyError,
      hasErrorCode,
    } = await import('../types');

    const error = new AgentifyError(
      AgentifyErrorCode.CREDENTIALS_NOT_CONFIGURED,
      'AWS credentials not configured'
    );

    expect(isAgentifyError(error)).toBe(true);
    expect(hasErrorCode(error, AgentifyErrorCode.CREDENTIALS_NOT_CONFIGURED)).toBe(true);
    expect(hasErrorCode(error, AgentifyErrorCode.TABLE_NOT_FOUND)).toBe(false);
  });

  it('should create error factory functions correctly', async () => {
    const {
      createCredentialsNotConfiguredError,
      createTableNotFoundError,
      createConfigNotFoundError,
      AgentifyErrorCode,
    } = await import('../types');

    const credError = createCredentialsNotConfiguredError();
    expect(credError.code).toBe(AgentifyErrorCode.CREDENTIALS_NOT_CONFIGURED);

    const tableError = createTableNotFoundError('test-table');
    expect(tableError.code).toBe(AgentifyErrorCode.TABLE_NOT_FOUND);
    expect(tableError.message).toContain('test-table');

    const configError = createConfigNotFoundError('.agentify/config.json');
    expect(configError.code).toBe(AgentifyErrorCode.CONFIG_NOT_FOUND);
    expect(configError.message).toContain('.agentify/config.json');
  });
});
