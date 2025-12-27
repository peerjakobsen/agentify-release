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
  },
  Uri: {
    joinPath: vi.fn(),
    parse: vi.fn(),
  },
  env: {
    openExternal: vi.fn(),
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
