/**
 * Tests for extension configuration (Task Group 2)
 *
 * These tests validate configuration defaults and reading behavior.
 * VS Code workspace mocking is required for full integration testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock config store
const mockConfigValues: Record<string, unknown> = {};

// Mock vscode module before any imports
vi.mock('vscode', () => {
  return {
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
  };
});

// Helper functions for tests
function setConfigValue(key: string, value: unknown) {
  mockConfigValues[key] = value;
}

function clearConfigValues() {
  Object.keys(mockConfigValues).forEach((key) => delete mockConfigValues[key]);
}

describe('DynamoDB Configuration', () => {
  beforeEach(() => {
    clearConfigValues();
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearConfigValues();
  });

  // Test 2.1.1: Default table name is correct
  it('should have default table name of "agentify-workflow-events"', async () => {
    const { getTableName, DEFAULT_TABLE_NAME } = await import('../config/dynamoDbConfig');

    expect(DEFAULT_TABLE_NAME).toBe('agentify-workflow-events');
    expect(getTableName()).toBe('agentify-workflow-events');
  });

  // Test 2.1.2: Default region is correct
  it('should have default region of "us-east-1"', async () => {
    const { getAwsRegion, DEFAULT_REGION } = await import('../config/dynamoDbConfig');

    expect(DEFAULT_REGION).toBe('us-east-1');
    expect(getAwsRegion()).toBe('us-east-1');
  });

  // Test 2.1.3: Configuration can be read from settings
  it('should read configuration from VS Code settings', async () => {
    setConfigValue('dynamodb.tableName', 'custom-table-name');
    setConfigValue('aws.region', 'us-west-2');

    // Need to re-import to get fresh module with new mock values
    vi.resetModules();

    // Re-setup mock after reset
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

    const { getTableName, getAwsRegion } = await import('../config/dynamoDbConfig');

    expect(getTableName()).toBe('custom-table-name');
    expect(getAwsRegion()).toBe('us-west-2');
  });

  // Test 2.1.4: Configuration defaults are exported correctly
  it('should export configuration defaults as constants', async () => {
    const { DEFAULT_TABLE_NAME, DEFAULT_REGION } = await import('../config/dynamoDbConfig');

    expect(DEFAULT_TABLE_NAME).toBe('agentify-workflow-events');
    expect(DEFAULT_REGION).toBe('us-east-1');
  });
});
