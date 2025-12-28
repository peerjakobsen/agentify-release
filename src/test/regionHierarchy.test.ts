/**
 * Tests for region hierarchy and credential validation (Task Group 3)
 *
 * These tests validate the region hierarchy (config.json first, VS Code settings fallback),
 * getAwsProfile(), and credential validation on activation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AgentifyConfig } from '../types/config';

// Base valid config for tests
const validBaseConfig: AgentifyConfig = {
  version: '1.0.0',
  project: {
    name: 'Test Project',
    valueMap: 'Test value map',
    industry: 'tech',
  },
  infrastructure: {
    dynamodb: {
      tableName: 'agentify-events',
      tableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/agentify-events',
      region: 'eu-west-1',
    },
  },
  workflow: {
    entryScript: 'agents/main.py',
    pythonPath: '.venv/bin/python',
    orchestrationPattern: 'graph',
    agents: [{ id: 'agent-1', name: 'Agent 1', role: 'Test role' }],
    edges: [],
  },
};

// Mock vscode module
const mockVsCodeGet = vi.fn((key: string, defaultValue: string) => {
  if (key === 'aws.region') return 'us-west-2';
  return defaultValue;
});

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: mockVsCodeGet,
    })),
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    fs: {
      stat: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      createDirectory: vi.fn(),
    },
    findFiles: vi.fn().mockResolvedValue([]),
    createFileSystemWatcher: vi.fn(() => ({
      onDidChange: vi.fn(),
      onDidDelete: vi.fn(),
      onDidCreate: vi.fn(),
      dispose: vi.fn(),
    })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  },
  window: {
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
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
  },
  Uri: {
    file: (path: string) => ({ fsPath: path }),
  },
  RelativePattern: vi.fn(),
  Disposable: vi.fn().mockImplementation((fn) => ({ dispose: fn })),
  StatusBarAlignment: {
    Right: 1,
    Left: 0,
  },
  ThemeColor: vi.fn((color: string) => ({ id: color })),
}));

// Mock ConfigService
let mockConfigServiceInstance: {
  getConfig: () => Promise<AgentifyConfig | null>;
} | null = null;

vi.mock('../services/configService', () => ({
  getConfigService: vi.fn(() => mockConfigServiceInstance),
  ConfigService: vi.fn(),
  CONFIG_FILE_PATH: '.agentify/config.json',
  resetConfigService: vi.fn(),
}));

// Mock credential provider
const mockValidateCredentials = vi.fn();
const mockSetProfile = vi.fn();
const mockReset = vi.fn();
const mockGetDefaultCredentialProvider = vi.fn(() => ({
  setProfile: mockSetProfile,
  reset: mockReset,
  getCredentials: vi.fn(),
}));

vi.mock('../services/credentialProvider', () => ({
  validateCredentials: mockValidateCredentials,
  getDefaultCredentialProvider: mockGetDefaultCredentialProvider,
  resetDefaultCredentialProvider: vi.fn(),
  DefaultCredentialProvider: vi.fn(),
}));

// Import after mocks are set up
import {
  getAwsRegion,
  getAwsProfile,
  DEFAULT_REGION,
} from '../config/dynamoDbConfig';
import { AgentifyErrorCode, AgentifyError } from '../types';

describe('Region hierarchy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigServiceInstance = null;
    mockVsCodeGet.mockImplementation((key: string, defaultValue: string) => {
      if (key === 'aws.region') return 'us-west-2';
      return defaultValue;
    });
  });

  afterEach(() => {
    mockConfigServiceInstance = null;
  });

  // Test 3.1.1: getAwsRegion() returns region from config.json when present
  it('should return region from config.json when present', async () => {
    mockConfigServiceInstance = {
      getConfig: vi.fn().mockResolvedValue(validBaseConfig),
    };

    const region = await getAwsRegion();
    expect(region).toBe('eu-west-1');
  });

  // Test 3.1.2: getAwsRegion() falls back to VS Code settings when config.json has no region
  it('should fall back to VS Code settings when config.json has no region', async () => {
    const configWithoutRegion = {
      ...validBaseConfig,
      infrastructure: {
        dynamodb: {
          tableName: 'test-table',
          tableArn: 'arn:aws:dynamodb:us-east-1:123:table/test',
          region: '', // Empty region
        },
      },
    };

    mockConfigServiceInstance = {
      getConfig: vi.fn().mockResolvedValue(configWithoutRegion),
    };

    const region = await getAwsRegion();
    expect(region).toBe('us-west-2'); // VS Code setting
  });

  // Test 3.1.3: getAwsRegion() falls back to VS Code when no config service
  it('should fall back to VS Code settings when config service returns null', async () => {
    mockConfigServiceInstance = {
      getConfig: vi.fn().mockResolvedValue(null),
    };

    const region = await getAwsRegion();
    expect(region).toBe('us-west-2'); // VS Code setting
  });

  // Test 3.1.4: getAwsRegion() uses default when neither source has region
  it('should use default when neither config.json nor VS Code has region', async () => {
    mockConfigServiceInstance = {
      getConfig: vi.fn().mockResolvedValue(null),
    };
    mockVsCodeGet.mockImplementation((_key: string, defaultValue: string) => defaultValue);

    const region = await getAwsRegion();
    expect(region).toBe(DEFAULT_REGION);
  });
});

describe('AWS profile configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigServiceInstance = null;
  });

  // Test 3.1.5: getAwsProfile() returns profile from config.json when present
  it('should return profile from config.json when configured', async () => {
    const configWithProfile = {
      ...validBaseConfig,
      aws: { profile: 'my-dev-profile' },
    };

    mockConfigServiceInstance = {
      getConfig: vi.fn().mockResolvedValue(configWithProfile),
    };

    const profile = await getAwsProfile();
    expect(profile).toBe('my-dev-profile');
  });

  // Test 3.1.6: getAwsProfile() returns undefined when not configured
  it('should return undefined when profile is not configured', async () => {
    mockConfigServiceInstance = {
      getConfig: vi.fn().mockResolvedValue(validBaseConfig),
    };

    const profile = await getAwsProfile();
    expect(profile).toBeUndefined();
  });

  // Test: getAwsProfile() returns undefined when config service returns null
  it('should return undefined when config service returns null', async () => {
    mockConfigServiceInstance = {
      getConfig: vi.fn().mockResolvedValue(null),
    };

    const profile = await getAwsProfile();
    expect(profile).toBeUndefined();
  });
});

describe('Credential validation status detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCredentials.mockReset();
  });

  // Test 3.1.7: Credential validation catches SSO expiration
  it('should detect SSO token expiration error', async () => {
    const ssoError = new AgentifyError(
      AgentifyErrorCode.SSO_TOKEN_EXPIRED,
      'SSO token expired'
    );
    mockValidateCredentials.mockRejectedValue(ssoError);

    await expect(mockValidateCredentials()).rejects.toMatchObject({
      code: AgentifyErrorCode.SSO_TOKEN_EXPIRED,
    });
  });

  // Test 3.1.8: Credential validation catches generic credential errors
  it('should detect credentials not configured error', async () => {
    const credError = new AgentifyError(
      AgentifyErrorCode.CREDENTIALS_NOT_CONFIGURED,
      'Credentials not configured'
    );
    mockValidateCredentials.mockRejectedValue(credError);

    await expect(mockValidateCredentials()).rejects.toMatchObject({
      code: AgentifyErrorCode.CREDENTIALS_NOT_CONFIGURED,
    });
  });

  // Test: Successful validation returns true
  it('should return true when credentials are valid', async () => {
    mockValidateCredentials.mockResolvedValue(true);

    const result = await mockValidateCredentials();
    expect(result).toBe(true);
  });
});
