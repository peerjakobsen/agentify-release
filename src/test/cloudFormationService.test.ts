/**
 * Tests for CloudFormation service (Task Group 1)
 *
 * These tests validate stack deployment, status polling, and output retrieval.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CloudFormationService,
  sanitizeStackName,
  type CloudFormationServiceConfig,
} from '../services/cloudFormationService';
import { AgentifyErrorCode } from '../types';

// Mock vscode module for tests
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue: string) => {
        if (key === 'aws.region') return 'us-east-1';
        return defaultValue;
      }),
    })),
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
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
  Uri: {
    file: (path: string) => ({ fsPath: path }),
  },
  RelativePattern: vi.fn(),
  Disposable: vi.fn().mockImplementation((fn) => ({ dispose: fn })),
}));

// Mock the CloudFormation client
vi.mock('@aws-sdk/client-cloudformation', () => ({
  CloudFormationClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  CreateStackCommand: vi.fn().mockImplementation((params) => ({ ...params })),
  DescribeStacksCommand: vi.fn().mockImplementation((params) => ({ ...params })),
  DescribeStackEventsCommand: vi.fn().mockImplementation((params) => ({ ...params })),
  StackStatus: {
    CREATE_COMPLETE: 'CREATE_COMPLETE',
    CREATE_IN_PROGRESS: 'CREATE_IN_PROGRESS',
    CREATE_FAILED: 'CREATE_FAILED',
    ROLLBACK_COMPLETE: 'ROLLBACK_COMPLETE',
    ROLLBACK_FAILED: 'ROLLBACK_FAILED',
    ROLLBACK_IN_PROGRESS: 'ROLLBACK_IN_PROGRESS',
  },
}));

// Mock credential provider
vi.mock('../services/credentialProvider', () => ({
  getDefaultCredentialProvider: vi.fn(() => ({
    getCredentials: vi.fn(() => async () => ({
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    })),
  })),
}));

import { CloudFormationClient } from '@aws-sdk/client-cloudformation';

const mockCloudFormationClient = vi.mocked(CloudFormationClient);

describe('sanitizeStackName', () => {
  it('should convert workspace name to lowercase and replace special characters', () => {
    expect(sanitizeStackName('My Project')).toBe('agentify-workflow-events-my-project');
    expect(sanitizeStackName('My_Project_2024')).toBe('agentify-workflow-events-my-project-2024');
    expect(sanitizeStackName('Test@Project#123')).toBe('agentify-workflow-events-test-project-123');
  });

  it('should handle empty or whitespace-only names with default', () => {
    expect(sanitizeStackName('')).toBe('agentify-workflow-events-default');
    expect(sanitizeStackName('   ')).toBe('agentify-workflow-events-default');
  });

  it('should remove consecutive hyphens', () => {
    expect(sanitizeStackName('my--project')).toBe('agentify-workflow-events-my-project');
    expect(sanitizeStackName('test   project')).toBe('agentify-workflow-events-test-project');
  });

  it('should truncate long names to fit 128 character limit', () => {
    const longName = 'a'.repeat(150);
    const result = sanitizeStackName(longName);
    expect(result.length).toBeLessThanOrEqual(128);
    expect(result.startsWith('agentify-workflow-events-')).toBe(true);
  });

  it('should handle names with only special characters', () => {
    expect(sanitizeStackName('!@#$%^&*()')).toBe('agentify-workflow-events-default');
  });
});

describe('CloudFormationService.deployStack', () => {
  let service: CloudFormationService;
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend = vi.fn();
    mockCloudFormationClient.mockImplementation(() => ({
      send: mockSend,
    }) as unknown as CloudFormationClient);

    const config: CloudFormationServiceConfig = {
      region: 'us-east-1',
    };
    service = new CloudFormationService(config);
  });

  it('should create a stack and return stack ID', async () => {
    const expectedStackId = 'arn:aws:cloudformation:us-east-1:123456789012:stack/test-stack/guid';
    mockSend.mockResolvedValueOnce({ StackId: expectedStackId });

    const stackId = await service.deployStack(
      'test-stack',
      'template-body',
      'test-table'
    );

    expect(stackId).toBe(expectedStackId);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should handle CreateStack API errors', async () => {
    const error = new Error('Access denied');
    error.name = 'AccessDeniedException';
    mockSend.mockRejectedValueOnce(error);

    await expect(
      service.deployStack('test-stack', 'template-body', 'test-table')
    ).rejects.toMatchObject({
      code: AgentifyErrorCode.ACCESS_DENIED,
    });
  });

  it('should handle AlreadyExistsException', async () => {
    const error = new Error('Stack already exists');
    error.name = 'AlreadyExistsException';
    mockSend.mockRejectedValueOnce(error);

    await expect(
      service.deployStack('test-stack', 'template-body', 'test-table')
    ).rejects.toMatchObject({
      code: AgentifyErrorCode.UNKNOWN_ERROR,
      message: expect.stringContaining('already exists'),
    });
  });
});

describe('CloudFormationService.waitForStackComplete', () => {
  let service: CloudFormationService;
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSend = vi.fn();
    mockCloudFormationClient.mockImplementation(() => ({
      send: mockSend,
    }) as unknown as CloudFormationClient);

    const config: CloudFormationServiceConfig = {
      region: 'us-east-1',
    };
    service = new CloudFormationService(config);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should poll until CREATE_COMPLETE', async () => {
    // First call returns IN_PROGRESS, second returns COMPLETE
    mockSend
      .mockResolvedValueOnce({
        Stacks: [{ StackStatus: 'CREATE_IN_PROGRESS' }],
      })
      .mockResolvedValueOnce({
        Stacks: [{ StackStatus: 'CREATE_COMPLETE' }],
      });

    const waitPromise = service.waitForStackComplete('stack-id', 100);

    // Advance timer for first poll
    await vi.advanceTimersByTimeAsync(100);

    await waitPromise;

    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('should detect CREATE_FAILED and throw with reason', async () => {
    mockSend
      .mockResolvedValueOnce({
        Stacks: [{ StackStatus: 'CREATE_FAILED' }],
      })
      .mockResolvedValueOnce({
        StackEvents: [
          {
            ResourceStatus: 'CREATE_FAILED',
            ResourceStatusReason: 'Insufficient permissions to create table',
          },
        ],
      });

    await expect(
      service.waitForStackComplete('stack-id', 100)
    ).rejects.toMatchObject({
      code: AgentifyErrorCode.UNKNOWN_ERROR,
      message: expect.stringContaining('Insufficient permissions'),
    });
  });

  it('should respect polling interval', async () => {
    // Always return IN_PROGRESS to test polling timing
    mockSend.mockResolvedValue({
      Stacks: [{ StackStatus: 'CREATE_IN_PROGRESS' }],
    });

    const pollingInterval = 200;
    const waitPromise = service.waitForStackComplete('stack-id', pollingInterval);

    // First call is immediate
    expect(mockSend).toHaveBeenCalledTimes(1);

    // Advance by less than polling interval - no new call
    await vi.advanceTimersByTimeAsync(100);
    expect(mockSend).toHaveBeenCalledTimes(1);

    // Advance to complete the polling interval
    await vi.advanceTimersByTimeAsync(100);
    expect(mockSend).toHaveBeenCalledTimes(2);

    // Change response to COMPLETE to exit the loop
    mockSend.mockResolvedValueOnce({
      Stacks: [{ StackStatus: 'CREATE_COMPLETE' }],
    });
    await vi.advanceTimersByTimeAsync(pollingInterval);

    await waitPromise;
  });
});

describe('CloudFormationService.getStackOutputs', () => {
  let service: CloudFormationService;
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend = vi.fn();
    mockCloudFormationClient.mockImplementation(() => ({
      send: mockSend,
    }) as unknown as CloudFormationClient);

    const config: CloudFormationServiceConfig = {
      region: 'us-east-1',
    };
    service = new CloudFormationService(config);
  });

  it('should retrieve outputs after successful creation', async () => {
    mockSend.mockResolvedValueOnce({
      Stacks: [
        {
          StackStatus: 'CREATE_COMPLETE',
          Outputs: [
            { OutputKey: 'TableName', OutputValue: 'my-table' },
            { OutputKey: 'TableArn', OutputValue: 'arn:aws:dynamodb:us-east-1:123:table/my-table' },
          ],
        },
      ],
    });

    const outputs = await service.getStackOutputs('stack-id');

    expect(outputs.tableName).toBe('my-table');
    expect(outputs.tableArn).toBe('arn:aws:dynamodb:us-east-1:123:table/my-table');
  });

  it('should throw when outputs are missing', async () => {
    mockSend.mockResolvedValueOnce({
      Stacks: [
        {
          StackStatus: 'CREATE_COMPLETE',
          Outputs: [],
        },
      ],
    });

    await expect(service.getStackOutputs('stack-id')).rejects.toMatchObject({
      code: AgentifyErrorCode.UNKNOWN_ERROR,
      message: expect.stringContaining('missing TableName or TableArn'),
    });
  });
});
