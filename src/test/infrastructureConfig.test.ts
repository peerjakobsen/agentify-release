/**
 * Tests for infrastructure configuration reading (Task Group 1)
 *
 * These tests validate the infrastructure config reader that checks
 * infrastructure.json first, then falls back to config.json for
 * backward compatibility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config values for both infrastructure.json and config.json
let mockInfrastructureJson: Record<string, unknown> | null = null;
let mockConfigJson: Record<string, unknown> | null = null;
let mockConfigService: { getConfig: () => Promise<Record<string, unknown> | null> } | null = null;

// Mock vscode module
vi.mock('vscode', () => {
  return {
    workspace: {
      getConfiguration: vi.fn().mockImplementation(() => ({
        get: vi.fn((key: string, defaultValue: unknown) => {
          return defaultValue;
        }),
      })),
      onDidChangeConfiguration: vi.fn().mockReturnValue({
        dispose: vi.fn(),
      }),
      workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
      fs: {
        stat: vi.fn(),
        readFile: vi.fn().mockImplementation((uri: { fsPath: string }) => {
          if (uri.fsPath.includes('infrastructure.json')) {
            if (mockInfrastructureJson === null) {
              const error = new Error('FileNotFound') as NodeJS.ErrnoException;
              error.code = 'FileNotFound';
              throw error;
            }
            return Buffer.from(JSON.stringify(mockInfrastructureJson), 'utf-8');
          }
          if (uri.fsPath.includes('config.json')) {
            if (mockConfigJson === null) {
              const error = new Error('FileNotFound') as NodeJS.ErrnoException;
              error.code = 'FileNotFound';
              throw error;
            }
            return Buffer.from(JSON.stringify(mockConfigJson), 'utf-8');
          }
          const error = new Error('FileNotFound') as NodeJS.ErrnoException;
          error.code = 'FileNotFound';
          throw error;
        }),
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
      joinPath: (base: { fsPath: string }, ...segments: string[]) => ({
        fsPath: [base.fsPath, ...segments].join('/'),
      }),
    },
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
  };
});

// Mock configService to return our test config
vi.mock('../services/configService', () => ({
  getConfigService: vi.fn().mockImplementation(() => mockConfigService),
  CONFIG_FILE_PATH: '.agentify/config.json',
}));

describe('Infrastructure Config Reader', () => {
  beforeEach(() => {
    vi.resetModules();
    mockInfrastructureJson = null;
    mockConfigJson = null;
    mockConfigService = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test 1.1.1: getTableNameAsync() returns workflow_events_table from infrastructure.json when present
  it('should return workflow_events_table from infrastructure.json when present', async () => {
    mockInfrastructureJson = {
      region: 'us-west-2',
      vpc_subnet_ids: 'subnet-xxx,subnet-yyy',
      vpc_security_group_id: 'sg-xxx',
      workflow_events_table: 'my-custom-table-from-infra',
      deployed_at: '2025-12-30T12:00:00Z',
    };

    mockConfigService = {
      getConfig: vi.fn().mockResolvedValue({
        infrastructure: {
          dynamodb: {
            tableName: 'old-table-from-config',
            region: 'us-east-1',
          },
        },
      }),
    };

    const { getTableNameAsync } = await import('../config/dynamoDbConfig');

    const tableName = await getTableNameAsync();

    expect(tableName).toBe('my-custom-table-from-infra');
  });

  // Test 1.1.2: getTableNameAsync() falls back to config.json when infrastructure.json missing
  it('should fall back to config.json infrastructure.dynamodb.tableName when infrastructure.json missing', async () => {
    mockInfrastructureJson = null; // File does not exist

    mockConfigService = {
      getConfig: vi.fn().mockResolvedValue({
        infrastructure: {
          dynamodb: {
            tableName: 'fallback-table-from-config',
            region: 'us-east-1',
          },
        },
      }),
    };

    const { getTableNameAsync } = await import('../config/dynamoDbConfig');

    const tableName = await getTableNameAsync();

    expect(tableName).toBe('fallback-table-from-config');
  });

  // Test 1.1.3: getAwsRegion() returns region from infrastructure.json when present
  it('should return region from infrastructure.json when present', async () => {
    mockInfrastructureJson = {
      region: 'eu-west-1',
      vpc_subnet_ids: 'subnet-xxx,subnet-yyy',
      vpc_security_group_id: 'sg-xxx',
      workflow_events_table: 'some-table',
      deployed_at: '2025-12-30T12:00:00Z',
    };

    mockConfigService = {
      getConfig: vi.fn().mockResolvedValue({
        infrastructure: {
          dynamodb: {
            tableName: 'some-table',
            region: 'us-east-1',
          },
        },
      }),
    };

    const { getAwsRegion } = await import('../config/dynamoDbConfig');

    const region = await getAwsRegion();

    expect(region).toBe('eu-west-1');
  });

  // Test 1.1.4: getAwsRegion() falls back to config.json when infrastructure.json missing
  it('should fall back to config.json region when infrastructure.json missing', async () => {
    mockInfrastructureJson = null; // File does not exist

    mockConfigService = {
      getConfig: vi.fn().mockResolvedValue({
        infrastructure: {
          dynamodb: {
            tableName: 'some-table',
            region: 'ap-northeast-1',
          },
        },
      }),
    };

    const { getAwsRegion } = await import('../config/dynamoDbConfig');

    const region = await getAwsRegion();

    expect(region).toBe('ap-northeast-1');
  });

  // Test 1.1.5: Returns default values gracefully when neither file has data
  it('should return default values when neither infrastructure.json nor config.json has data', async () => {
    mockInfrastructureJson = null; // File does not exist

    mockConfigService = {
      getConfig: vi.fn().mockResolvedValue(null), // No config
    };

    const { getTableNameAsync, getAwsRegion, DEFAULT_TABLE_NAME, DEFAULT_REGION } = await import(
      '../config/dynamoDbConfig'
    );

    const tableName = await getTableNameAsync();
    const region = await getAwsRegion();

    expect(tableName).toBe(DEFAULT_TABLE_NAME);
    expect(region).toBe(DEFAULT_REGION);
  });

  // Test 1.1.6: InfrastructureDeploymentConfig interface and path constant exist
  it('should export infrastructure.json file path constant', async () => {
    const { INFRASTRUCTURE_FILE_PATH } = await import('../config/dynamoDbConfig');

    expect(INFRASTRUCTURE_FILE_PATH).toBe('.agentify/infrastructure.json');
  });
});
