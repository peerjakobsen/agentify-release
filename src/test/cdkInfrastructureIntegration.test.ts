/**
 * Integration Tests for CDK Infrastructure Bundling Feature (Task Group 4)
 *
 * These tests validate end-to-end workflows for the CDK infrastructure bundling
 * feature, ensuring all components work together correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track mock state for infrastructure.json
let mockInfrastructureJson: Record<string, unknown> | null = null;
let mockConfigJson: Record<string, unknown> | null = null;

// Mock vscode module
vi.mock('vscode', () => ({
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
  EventEmitter: vi.fn().mockImplementation(() => ({
    event: vi.fn(),
    fire: vi.fn(),
    dispose: vi.fn(),
  })),
}));

// Mock configService
vi.mock('../services/configService', () => ({
  getConfigService: vi.fn().mockImplementation(() => ({
    getConfig: vi.fn().mockImplementation(async () => mockConfigJson),
  })),
  CONFIG_FILE_PATH: '.agentify/config.json',
}));

describe('CDK Infrastructure Bundling - Integration Tests', () => {
  beforeEach(() => {
    vi.resetModules();
    mockInfrastructureJson = null;
    mockConfigJson = null;
  });

  // Integration Test 1: Verify infrastructure.json takes priority over config.json
  it('should prioritize infrastructure.json over config.json for table name', async () => {
    // Setup: Both files exist with different values
    mockInfrastructureJson = {
      region: 'eu-west-1',
      workflow_events_table: 'infra-table',
      deployed_at: '2025-12-30T12:00:00Z',
    };

    mockConfigJson = {
      infrastructure: {
        dynamodb: {
          tableName: 'config-table',
          region: 'us-east-1',
        },
      },
    };

    const { getTableNameAsync } = await import('../config/dynamoDbConfig');

    const tableName = await getTableNameAsync();

    // Should return the infrastructure.json value
    expect(tableName).toBe('infra-table');
  });

  // Integration Test 2: Verify backward compatibility with old config.json
  it('should fall back to config.json when infrastructure.json does not exist', async () => {
    // Setup: Only config.json exists (backward compatibility)
    mockInfrastructureJson = null;

    mockConfigJson = {
      infrastructure: {
        dynamodb: {
          tableName: 'legacy-table',
          region: 'us-west-2',
        },
      },
    };

    const { getTableNameAsync, getAwsRegion } = await import('../config/dynamoDbConfig');

    const tableName = await getTableNameAsync();
    const region = await getAwsRegion();

    // Should return the config.json values
    expect(tableName).toBe('legacy-table');
    expect(region).toBe('us-west-2');
  });

  // Integration Test 3: Verify full setup.sh output schema is readable
  it('should read complete infrastructure.json schema from setup.sh output', async () => {
    // Setup: Full infrastructure.json as setup.sh would create it
    mockInfrastructureJson = {
      region: 'us-east-1',
      vpc_subnet_ids: 'subnet-abc123,subnet-def456',
      vpc_security_group_id: 'sg-xyz789',
      workflow_events_table: 'agentify-workflow-events',
      deployed_at: '2025-12-30T12:00:00Z',
    };

    const { getTableNameAsync, getAwsRegion, INFRASTRUCTURE_FILE_PATH } = await import(
      '../config/dynamoDbConfig'
    );

    const tableName = await getTableNameAsync();
    const region = await getAwsRegion();

    // Verify all values are readable
    expect(tableName).toBe('agentify-workflow-events');
    expect(region).toBe('us-east-1');
    expect(INFRASTRUCTURE_FILE_PATH).toBe('.agentify/infrastructure.json');
  });

  // Integration Test 4: Verify empty infrastructure.json triggers fallback
  it('should fall back gracefully when infrastructure.json has empty values', async () => {
    // Setup: infrastructure.json exists but workflow_events_table is empty
    mockInfrastructureJson = {
      region: '',
      workflow_events_table: '',
      deployed_at: '2025-12-30T12:00:00Z',
    };

    mockConfigJson = {
      infrastructure: {
        dynamodb: {
          tableName: 'fallback-table',
          region: 'eu-central-1',
        },
      },
    };

    const { getTableNameAsync, getAwsRegion } = await import('../config/dynamoDbConfig');

    const tableName = await getTableNameAsync();
    const region = await getAwsRegion();

    // Should fall back to config.json when infrastructure.json values are empty
    expect(tableName).toBe('fallback-table');
    expect(region).toBe('eu-central-1');
  });

  // Integration Test 5: Verify default values when no config exists
  it('should return defaults when neither infrastructure.json nor config.json exists', async () => {
    // Setup: No files exist
    mockInfrastructureJson = null;
    mockConfigJson = null;

    const { getTableNameAsync, getAwsRegion, DEFAULT_TABLE_NAME, DEFAULT_REGION } = await import(
      '../config/dynamoDbConfig'
    );

    const tableName = await getTableNameAsync();
    const region = await getAwsRegion();

    // Should return default values
    expect(tableName).toBe(DEFAULT_TABLE_NAME);
    expect(region).toBe(DEFAULT_REGION);
  });

  // Integration Test 6: Verify error messages reference CDK setup script
  it('should show setup.sh instructions in table not found error', async () => {
    const { getTableNotFoundMessage, CDK_SETUP_SCRIPT_PATH } = await import(
      '../messages/tableErrors'
    );

    const errorMessage = getTableNotFoundMessage('missing-table');

    // Should reference the setup script and README
    expect(errorMessage).toContain('setup.sh');
    expect(errorMessage).toContain('cdk/README.md');
    expect(CDK_SETUP_SCRIPT_PATH).toBe('scripts/setup.sh');
  });
});
