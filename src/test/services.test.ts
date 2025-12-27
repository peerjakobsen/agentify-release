/**
 * Tests for service layer (Task Group 2)
 *
 * These tests validate credential provider, config service, and AWS client functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  // Credential provider
  ICredentialProvider,
  DefaultCredentialProvider,
  getDefaultCredentialProvider,
  resetDefaultCredentialProvider,
} from '../services/credentialProvider';
import {
  // DynamoDB client
  getDynamoDbClient,
  getDynamoDbDocumentClient,
  resetClients,
  getMaxRetries as getDynamoDbMaxRetries,
} from '../services/dynamoDbClient';
import {
  // Bedrock client
  getBedrockClient,
  resetBedrockClient,
  hasBedrockClient,
  getMaxRetries as getBedrockMaxRetries,
} from '../services/bedrockClient';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

// Mock vscode module for tests
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue: string) => {
        if (key === 'aws.region') return 'us-east-1';
        if (key === 'dynamodb.tableName') return 'test-table';
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

describe('ICredentialProvider interface', () => {
  it('should define getCredentials method', () => {
    const mockProvider: ICredentialProvider = {
      getCredentials: () => async () => ({
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      }),
    };

    expect(typeof mockProvider.getCredentials).toBe('function');
    expect(mockProvider.getCredentials()).toBeDefined();
  });
});

describe('DefaultCredentialProvider', () => {
  beforeEach(() => {
    resetDefaultCredentialProvider();
  });

  afterEach(() => {
    resetDefaultCredentialProvider();
  });

  it('should create an instance', () => {
    const provider = new DefaultCredentialProvider();
    expect(provider).toBeInstanceOf(DefaultCredentialProvider);
  });

  it('should return a credential provider function', () => {
    const provider = new DefaultCredentialProvider();
    const credentials = provider.getCredentials();
    expect(typeof credentials).toBe('function');
  });

  it('should cache the credential provider', () => {
    const provider = new DefaultCredentialProvider();
    const first = provider.getCredentials();
    const second = provider.getCredentials();
    expect(first).toBe(second);
  });

  it('should reset the cached provider', () => {
    const provider = new DefaultCredentialProvider();
    const first = provider.getCredentials();
    provider.reset();
    const second = provider.getCredentials();
    // After reset, should create a new provider
    expect(first).not.toBe(second);
  });
});

describe('getDefaultCredentialProvider singleton', () => {
  beforeEach(() => {
    resetDefaultCredentialProvider();
  });

  afterEach(() => {
    resetDefaultCredentialProvider();
  });

  it('should return a DefaultCredentialProvider', () => {
    const provider = getDefaultCredentialProvider();
    expect(provider).toBeInstanceOf(DefaultCredentialProvider);
  });

  it('should return the same instance on subsequent calls', () => {
    const first = getDefaultCredentialProvider();
    const second = getDefaultCredentialProvider();
    expect(first).toBe(second);
  });

  it('should return a new instance after reset', () => {
    const first = getDefaultCredentialProvider();
    resetDefaultCredentialProvider();
    const second = getDefaultCredentialProvider();
    expect(first).not.toBe(second);
  });
});

describe('DynamoDB client lazy initialization', () => {
  beforeEach(() => {
    resetClients();
  });

  afterEach(() => {
    resetClients();
  });

  it('should return a DynamoDBClient instance', () => {
    const client = getDynamoDbClient();
    expect(client).toBeInstanceOf(DynamoDBClient);
  });

  it('should return the same client on subsequent calls', () => {
    const first = getDynamoDbClient();
    const second = getDynamoDbClient();
    expect(first).toBe(second);
  });

  it('should return a DynamoDBDocumentClient instance', () => {
    const client = getDynamoDbDocumentClient();
    expect(client).toBeInstanceOf(DynamoDBDocumentClient);
  });

  it('should configure retry with 3 max retries', () => {
    expect(getDynamoDbMaxRetries()).toBe(3);
  });
});

describe('DynamoDB client reset functionality', () => {
  beforeEach(() => {
    resetClients();
  });

  afterEach(() => {
    resetClients();
  });

  it('should create a new client after reset', () => {
    const first = getDynamoDbClient();
    resetClients();
    const second = getDynamoDbClient();
    expect(first).not.toBe(second);
  });

  it('should create a new document client after reset', () => {
    const first = getDynamoDbDocumentClient();
    resetClients();
    const second = getDynamoDbDocumentClient();
    expect(first).not.toBe(second);
  });
});

describe('Bedrock client lazy initialization', () => {
  beforeEach(() => {
    resetBedrockClient();
  });

  afterEach(() => {
    resetBedrockClient();
  });

  it('should not create client until first access', () => {
    expect(hasBedrockClient()).toBe(false);
  });

  it('should return a BedrockRuntimeClient instance', () => {
    const client = getBedrockClient();
    expect(client).toBeInstanceOf(BedrockRuntimeClient);
  });

  it('should return the same client on subsequent calls', () => {
    const first = getBedrockClient();
    const second = getBedrockClient();
    expect(first).toBe(second);
  });

  it('should set hasBedrockClient to true after first access', () => {
    getBedrockClient();
    expect(hasBedrockClient()).toBe(true);
  });

  it('should configure retry with 3 max retries', () => {
    expect(getBedrockMaxRetries()).toBe(3);
  });
});

describe('Bedrock client reset functionality', () => {
  beforeEach(() => {
    resetBedrockClient();
  });

  afterEach(() => {
    resetBedrockClient();
  });

  it('should create a new client after reset', () => {
    const first = getBedrockClient();
    resetBedrockClient();
    const second = getBedrockClient();
    expect(first).not.toBe(second);
  });

  it('should set hasBedrockClient to false after reset', () => {
    getBedrockClient();
    expect(hasBedrockClient()).toBe(true);
    resetBedrockClient();
    expect(hasBedrockClient()).toBe(false);
  });
});

describe('Custom credential provider injection', () => {
  beforeEach(() => {
    resetClients();
    resetBedrockClient();
  });

  afterEach(() => {
    resetClients();
    resetBedrockClient();
  });

  it('should accept custom credential provider for DynamoDB', () => {
    const mockProvider: ICredentialProvider = {
      getCredentials: () => async () => ({
        accessKeyId: 'custom-key',
        secretAccessKey: 'custom-secret',
      }),
    };

    const client = getDynamoDbClient(mockProvider);
    expect(client).toBeInstanceOf(DynamoDBClient);
  });

  it('should accept custom credential provider for Bedrock', () => {
    const mockProvider: ICredentialProvider = {
      getCredentials: () => async () => ({
        accessKeyId: 'custom-key',
        secretAccessKey: 'custom-secret',
      }),
    };

    const client = getBedrockClient(mockProvider);
    expect(client).toBeInstanceOf(BedrockRuntimeClient);
  });
});
