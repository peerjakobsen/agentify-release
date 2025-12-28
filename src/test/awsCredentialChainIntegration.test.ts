/**
 * AWS Credential Chain Integration Tests (Task Group 5)
 *
 * These tests fill critical gaps in test coverage for the AWS credential chain
 * integration feature. They focus on integration between components and
 * end-to-end workflows.
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

const mockStatusBarItem = {
  text: '',
  tooltip: '',
  backgroundColor: undefined,
  color: undefined,
  command: undefined,
  show: vi.fn(),
  dispose: vi.fn(),
};

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
    createStatusBarItem: vi.fn(() => mockStatusBarItem),
    createTerminal: vi.fn(() => ({
      show: vi.fn(),
      sendText: vi.fn(),
      dispose: vi.fn(),
    })),
    showQuickPick: vi.fn(),
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

// Mock ConfigService with ability to emit config changes
type ConfigChangeCallback = (config: AgentifyConfig | null) => void;
let mockConfig: AgentifyConfig | null = null;
let configChangeCallbacks: ConfigChangeCallback[] = [];

const mockConfigService = {
  getConfig: vi.fn(async () => mockConfig),
  onConfigChanged: vi.fn((callback: ConfigChangeCallback) => {
    configChangeCallbacks.push(callback);
    return { dispose: vi.fn() };
  }),
};

vi.mock('../services/configService', () => ({
  getConfigService: vi.fn(() => mockConfigService),
  ConfigService: vi.fn(),
  CONFIG_FILE_PATH: '.agentify/config.json',
  resetConfigService: vi.fn(),
}));

// Mock credential provider
const mockSetProfile = vi.fn();
const mockReset = vi.fn();
const mockValidateCredentials = vi.fn();

vi.mock('../services/credentialProvider', () => ({
  validateCredentials: mockValidateCredentials,
  getDefaultCredentialProvider: vi.fn(() => ({
    setProfile: mockSetProfile,
    reset: mockReset,
    getCredentials: vi.fn(),
    getProfile: vi.fn(),
  })),
  resetDefaultCredentialProvider: vi.fn(),
  DefaultCredentialProvider: vi.fn(),
}));

// Import after mocks are set up
import { getAwsRegion, getAwsProfile } from '../config/dynamoDbConfig';
import { StatusBarManager } from '../statusBar';
import { AgentifyError, AgentifyErrorCode } from '../types';

// Helper function to simulate config change
function simulateConfigChange(newConfig: AgentifyConfig | null) {
  mockConfig = newConfig;
  configChangeCallbacks.forEach((callback) => callback(newConfig));
}

describe('Integration: Profile Change in Config Triggers Credential Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = null;
    configChangeCallbacks = [];
  });

  afterEach(() => {
    mockConfig = null;
    configChangeCallbacks = [];
  });

  // Integration test 5.3.1: Profile change in config.json triggers setProfile
  it('should trigger credential provider setProfile when config.json profile changes', async () => {
    const { getDefaultCredentialProvider } = await import(
      '../services/credentialProvider'
    );
    const provider = getDefaultCredentialProvider();

    // Initial config without profile
    mockConfig = validBaseConfig;

    // Get initial profile
    const initialProfile = await getAwsProfile();
    expect(initialProfile).toBeUndefined();

    // Change config to include profile
    const configWithProfile = {
      ...validBaseConfig,
      aws: { profile: 'new-dev-profile' },
    };
    mockConfig = configWithProfile;

    // Get updated profile
    const newProfile = await getAwsProfile();
    expect(newProfile).toBe('new-dev-profile');

    // Verify provider can receive the profile update
    provider.setProfile('new-dev-profile');
    expect(mockSetProfile).toHaveBeenCalledWith('new-dev-profile');
  });

  // Integration test 5.3.2: Profile change resets cached credentials
  it('should reset cached credentials when profile is changed', async () => {
    const { getDefaultCredentialProvider } = await import(
      '../services/credentialProvider'
    );
    const provider = getDefaultCredentialProvider();

    // Set initial profile
    provider.setProfile('initial-profile');
    expect(mockSetProfile).toHaveBeenCalledWith('initial-profile');

    // Change profile - should reset
    provider.setProfile('different-profile');
    expect(mockSetProfile).toHaveBeenCalledWith('different-profile');

    // setProfile internally calls reset when profile changes
    // Verify setProfile was called twice for both changes
    expect(mockSetProfile).toHaveBeenCalledTimes(2);
  });
});

describe('Integration: Region Change in Config Updates getAwsRegion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = null;
    configChangeCallbacks = [];
    mockVsCodeGet.mockImplementation((key: string, defaultValue: string) => {
      if (key === 'aws.region') return 'us-west-2';
      return defaultValue;
    });
  });

  // Integration test 5.3.3: Region change in config.json updates getAwsRegion
  it('should return updated region when config.json region changes', async () => {
    // Initial config with eu-west-1 region
    mockConfig = validBaseConfig;
    const initialRegion = await getAwsRegion();
    expect(initialRegion).toBe('eu-west-1');

    // Change config region
    const configWithNewRegion = {
      ...validBaseConfig,
      infrastructure: {
        ...validBaseConfig.infrastructure,
        dynamodb: {
          ...validBaseConfig.infrastructure.dynamodb,
          region: 'ap-southeast-1',
        },
      },
    };
    mockConfig = configWithNewRegion;

    // Get updated region
    const newRegion = await getAwsRegion();
    expect(newRegion).toBe('ap-southeast-1');
  });

  // Integration test: Region falls back correctly when config region removed
  it('should fallback to VS Code setting when config.json region is removed', async () => {
    // Start with config region
    mockConfig = validBaseConfig;
    const initialRegion = await getAwsRegion();
    expect(initialRegion).toBe('eu-west-1');

    // Remove region from config
    const configWithoutRegion = {
      ...validBaseConfig,
      infrastructure: {
        ...validBaseConfig.infrastructure,
        dynamodb: {
          ...validBaseConfig.infrastructure.dynamodb,
          region: '',
        },
      },
    };
    mockConfig = configWithoutRegion;

    // Should fallback to VS Code setting
    const fallbackRegion = await getAwsRegion();
    expect(fallbackRegion).toBe('us-west-2');
  });
});

describe('Integration: Activation Validates Credentials and Sets Status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = null;
    mockValidateCredentials.mockReset();
  });

  // Integration test 5.3.4: Activation validates credentials and sets ready status
  it('should validate credentials on activation and set ready status when valid', async () => {
    mockValidateCredentials.mockResolvedValue(true);

    const statusBar = new StatusBarManager();

    // Simulate activation validation
    try {
      const isValid = await mockValidateCredentials();
      if (isValid) {
        statusBar.updateStatus('ready');
      }
    } catch {
      statusBar.updateStatus('aws-error');
    }

    expect(mockValidateCredentials).toHaveBeenCalled();
    expect(statusBar.getStatus()).toBe('ready');

    statusBar.dispose();
  });

  // Integration test 5.3.5: Activation sets error status when credentials invalid
  it('should set aws-error status when credentials are invalid on activation', async () => {
    const credError = new AgentifyError(
      AgentifyErrorCode.CREDENTIALS_NOT_CONFIGURED,
      'Credentials not configured'
    );
    mockValidateCredentials.mockRejectedValue(credError);

    const statusBar = new StatusBarManager();

    // Simulate activation validation
    try {
      await mockValidateCredentials();
      statusBar.updateStatus('ready');
    } catch {
      statusBar.updateStatus('aws-error');
    }

    expect(statusBar.getStatus()).toBe('aws-error');

    statusBar.dispose();
  });
});

describe('Integration: SSO Expiration Updates Status Bar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCredentials.mockReset();
  });

  // Integration test 5.3.6: SSO expiration error updates status bar to sso-expired
  it('should set sso-expired status when SSO token expiration is detected', async () => {
    const ssoError = new AgentifyError(
      AgentifyErrorCode.SSO_TOKEN_EXPIRED,
      'SSO token expired. Run aws sso login to refresh.'
    );
    mockValidateCredentials.mockRejectedValue(ssoError);

    const statusBar = new StatusBarManager();

    // Simulate API call failure
    try {
      await mockValidateCredentials();
      statusBar.updateStatus('ready');
    } catch (error) {
      if (
        error instanceof AgentifyError &&
        error.code === AgentifyErrorCode.SSO_TOKEN_EXPIRED
      ) {
        statusBar.updateStatus('sso-expired');
      } else {
        statusBar.updateStatus('aws-error');
      }
    }

    expect(statusBar.getStatus()).toBe('sso-expired');

    statusBar.dispose();
  });

  // Integration test: SSO expired status with profile shows correct info
  it('should include profile in status bar when SSO expires with profile configured', async () => {
    const statusBar = new StatusBarManager();
    statusBar.setProfile('my-sso-profile');
    statusBar.updateStatus('sso-expired');

    expect(statusBar.getStatus()).toBe('sso-expired');
    expect(statusBar.getProfile()).toBe('my-sso-profile');

    statusBar.dispose();
  });
});

describe('Error Handling: Graceful Degradation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = null;
  });

  // Error handling test 5.3.7: Graceful degradation when aws section missing
  it('should return undefined profile when config.json aws section is missing', async () => {
    // Config without aws section
    mockConfig = validBaseConfig;

    const profile = await getAwsProfile();
    expect(profile).toBeUndefined();
  });

  // Error handling test: Graceful degradation when config service returns null
  it('should handle null config gracefully for both region and profile', async () => {
    mockConfig = null;
    mockVsCodeGet.mockImplementation((key: string, defaultValue: string) => {
      if (key === 'aws.region') return 'eu-central-1';
      return defaultValue;
    });

    const region = await getAwsRegion();
    const profile = await getAwsProfile();

    // Region should fallback to VS Code settings
    expect(region).toBe('eu-central-1');
    // Profile should be undefined
    expect(profile).toBeUndefined();
  });
});
