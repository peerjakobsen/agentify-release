/**
 * Tests for table validation (Task Group 3)
 *
 * These tests validate the table existence checking logic.
 * Uses mocked AWS SDK for unit testing.
 * Updated for CDK-based deployment (CloudFormation template has been removed).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TableStatus } from '@aws-sdk/client-dynamodb';
import { TableValidationErrorType } from '../messages/tableErrors';

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
    }),
    onDidChangeConfiguration: vi.fn().mockReturnValue({
      dispose: vi.fn(),
    }),
  },
  Disposable: class {
    constructor(private disposeFn: () => void) {}
    dispose() {
      this.disposeFn();
    }
  },
}));

// Mock AWS SDK
const mockSend = vi.fn();

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

describe('Table Validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test 3.1.1: Successful validation when table exists and is ACTIVE
  it('should validate successfully when table exists and is ACTIVE', async () => {
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
    expect(result.tableArn).toContain('agentify-workflow-events');
    expect(result.tableStatus).toBe(TableStatus.ACTIVE);
    expect(result.error).toBeUndefined();
  });

  // Test 3.1.2: Error handling when table does not exist
  it('should return error when table does not exist', async () => {
    const notFoundError = new Error('Table not found');
    notFoundError.name = 'ResourceNotFoundException';
    mockSend.mockRejectedValueOnce(notFoundError);

    const { validateTableExists } = await import('../services/tableValidator');
    const result = await validateTableExists('non-existent-table');

    expect(result.isValid).toBe(false);
    expect(result.tableName).toBe('non-existent-table');
    expect(result.error).toBeDefined();
    expect(result.error?.type).toBe(TableValidationErrorType.TABLE_NOT_FOUND);
    expect(result.error?.message).toContain('non-existent-table');
    expect(result.error?.message).toContain('not found');
  });

  // Test 3.1.3: Error handling when AWS credentials are not configured
  it('should return error when AWS credentials are not configured', async () => {
    const credentialsError = new Error('No credentials');
    credentialsError.name = 'CredentialsProviderError';
    mockSend.mockRejectedValueOnce(credentialsError);

    const { validateTableExists } = await import('../services/tableValidator');
    const result = await validateTableExists('agentify-workflow-events');

    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.type).toBe(TableValidationErrorType.CREDENTIALS_NOT_CONFIGURED);
    expect(result.error?.message).toContain('credentials');
  });

  // Test 3.1.4: Error message directs user to deploy infrastructure
  it('should include setup script instructions in error message', async () => {
    const notFoundError = new Error('Table not found');
    notFoundError.name = 'ResourceNotFoundException';
    mockSend.mockRejectedValueOnce(notFoundError);

    const { validateTableExists } = await import('../services/tableValidator');
    const result = await validateTableExists('missing-table');

    expect(result.error?.message).toContain('setup.sh');
    expect(result.error?.message).toContain('cdk/README.md');
  });

  // Test 3.1.5: Handling of table in non-ACTIVE states
  it('should return error when table is in CREATING state', async () => {
    mockSend.mockResolvedValueOnce({
      Table: {
        TableName: 'agentify-workflow-events',
        TableArn: 'arn:aws:dynamodb:us-east-1:123456789:table/agentify-workflow-events',
        TableStatus: TableStatus.CREATING,
      },
    });

    const { validateTableExists } = await import('../services/tableValidator');
    const result = await validateTableExists('agentify-workflow-events');

    expect(result.isValid).toBe(false);
    expect(result.tableStatus).toBe(TableStatus.CREATING);
    expect(result.error).toBeDefined();
    expect(result.error?.type).toBe(TableValidationErrorType.TABLE_NOT_ACTIVE);
    expect(result.error?.message).toContain('CREATING');
  });
});
