/**
 * Tests for Initialize Project command handler (Task Group 3)
 *
 * These tests validate the complete initialization flow including:
 * - Profile and region selection UI
 * - Idempotency checks
 * - Credential validation
 * - CloudFormation deployment
 * - Config generation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { QuickPickItem } from 'vscode';

// Create shared mock instances
const mockConfigService = {
  isInitialized: vi.fn().mockResolvedValue(false),
  createConfig: vi.fn().mockResolvedValue(undefined),
  clearCache: vi.fn(),
};

const mockProfileService = {
  listAvailableProfiles: vi.fn().mockResolvedValue([]),
};

const mockCredentialProvider = {
  setProfile: vi.fn(),
  getCredentials: vi.fn(() => async () => ({
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
  })),
};

const mockCloudFormationServiceInstance = {
  deployStack: vi.fn().mockResolvedValue('stack-id'),
  waitForStackComplete: vi.fn().mockResolvedValue(undefined),
  getStackOutputs: vi.fn().mockResolvedValue({
    tableName: 'test-table',
    tableArn: 'arn:aws:dynamodb:us-east-1:123:table/test-table',
  }),
};

// Mock vscode module first (will be hoisted)
vi.mock('vscode', () => ({
  window: {
    showQuickPick: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    withProgress: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_key: string, defaultValue?: string) => defaultValue),
    })),
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' }, name: 'test-workspace' }],
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
    parse: (uri: string) => ({ fsPath: uri }),
  },
  RelativePattern: vi.fn(),
  Disposable: vi.fn().mockImplementation((fn) => ({ dispose: fn })),
  ProgressLocation: {
    Notification: 15,
  },
  env: {
    openExternal: vi.fn(),
  },
}));

// Mock services - using factory functions that return shared instances
vi.mock('../services/profileDiscoveryService', () => ({
  getProfileDiscoveryService: () => mockProfileService,
}));

vi.mock('../services/configService', () => ({
  getConfigService: () => mockConfigService,
  CONFIG_FILE_PATH: '.agentify/config.json',
}));

vi.mock('../services/credentialProvider', () => ({
  getDefaultCredentialProvider: () => mockCredentialProvider,
  validateCredentials: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/cloudFormationService', () => ({
  CloudFormationService: vi.fn().mockImplementation(() => mockCloudFormationServiceInstance),
  sanitizeStackName: (name: string) => `agentify-workflow-events-${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`,
  getCloudFormationTemplate: () => 'mock-template-body',
}));

// Import vscode after mocking
import * as vscode from 'vscode';

// Import services after mocking
import { validateCredentials } from '../services/credentialProvider';
import { CloudFormationService } from '../services/cloudFormationService';

// Import the module under test
import {
  handleInitializeProject,
  showProfileSelection,
  showRegionSelection,
  checkExistingConfig,
  DEFAULT_REGIONS,
} from '../commands/initializeProject';

// Helper to get mocked functions
const getMockedWindow = () => vscode.window as unknown as {
  showQuickPick: ReturnType<typeof vi.fn>;
  showInformationMessage: ReturnType<typeof vi.fn>;
  showErrorMessage: ReturnType<typeof vi.fn>;
  showWarningMessage: ReturnType<typeof vi.fn>;
  withProgress: ReturnType<typeof vi.fn>;
};

describe('Initialize Project - Profile Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileService.listAvailableProfiles.mockResolvedValue([]);
  });

  // Test 3.1.1: Shows profile QuickPick with "Use default" option first
  it('should show profile QuickPick with "Use default credentials" as first option', async () => {
    mockProfileService.listAvailableProfiles.mockResolvedValue(['dev-profile', 'prod-profile']);
    getMockedWindow().showQuickPick.mockResolvedValue({ label: 'Use default credentials', profile: undefined });

    await showProfileSelection();

    expect(getMockedWindow().showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Use default credentials',
          description: 'Uses AWS_PROFILE env var or default credential chain',
        }),
      ]),
      expect.objectContaining({
        placeHolder: expect.stringContaining('AWS profile'),
      })
    );

    // Verify "Use default" is first
    const quickPickItems = getMockedWindow().showQuickPick.mock.calls[0][0] as QuickPickItem[];
    expect(quickPickItems[0].label).toBe('Use default credentials');
  });

  // Test 3.1.2: Shows region QuickPick with common regions
  it('should show region QuickPick with common AWS regions', async () => {
    getMockedWindow().showQuickPick.mockResolvedValue({ label: 'us-east-1', description: 'US East (N. Virginia)' });

    await showRegionSelection();

    expect(getMockedWindow().showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'us-east-1' }),
        expect.objectContaining({ label: 'us-west-2' }),
        expect.objectContaining({ label: 'eu-west-1' }),
        expect.objectContaining({ label: 'eu-central-1' }),
        expect.objectContaining({ label: 'ap-northeast-1' }),
        expect.objectContaining({ label: 'ap-southeast-1' }),
      ]),
      expect.objectContaining({
        placeHolder: expect.stringContaining('region'),
      })
    );
  });
});

describe('Initialize Project - Idempotency Check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.isInitialized.mockResolvedValue(false);
  });

  // Test 3.1.3: Detects existing config and prompts for reinitialize/skip
  it('should detect existing config and prompt user for action', async () => {
    mockConfigService.isInitialized.mockResolvedValue(true);
    getMockedWindow().showQuickPick.mockResolvedValue({ label: 'Skip initialization' });

    const result = await checkExistingConfig();

    expect(getMockedWindow().showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Reinitialize project' }),
        expect.objectContaining({ label: 'Skip initialization' }),
      ]),
      expect.any(Object)
    );
    expect(result).toBe('skip');
  });

  // Test 3.1.4: Skips initialization when user chooses skip
  it('should return skip when user selects skip option', async () => {
    mockConfigService.isInitialized.mockResolvedValue(true);
    getMockedWindow().showQuickPick.mockResolvedValue({ label: 'Skip initialization' });

    const result = await checkExistingConfig();

    expect(result).toBe('skip');
  });

  // Test 3.1.5: Proceeds with reinitialization when user confirms
  it('should return reinitialize when user confirms reinitialization', async () => {
    mockConfigService.isInitialized.mockResolvedValue(true);
    getMockedWindow().showQuickPick.mockResolvedValue({ label: 'Reinitialize project' });

    const result = await checkExistingConfig();

    expect(result).toBe('reinitialize');
    expect(mockConfigService.clearCache).toHaveBeenCalled();
  });

  // Test: Returns continue when no existing config
  it('should return continue when no existing config', async () => {
    mockConfigService.isInitialized.mockResolvedValue(false);

    const result = await checkExistingConfig();

    expect(result).toBe('continue');
    expect(getMockedWindow().showQuickPick).not.toHaveBeenCalled();
  });
});

describe('Initialize Project - Credential Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.isInitialized.mockResolvedValue(false);
    mockProfileService.listAvailableProfiles.mockResolvedValue(['default']);
    getMockedWindow().withProgress.mockImplementation(async (_options: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => {
      return task({ report: vi.fn() }, { isCancellationRequested: false });
    });
    vi.mocked(validateCredentials).mockResolvedValue(true);
  });

  // Test 3.1.6: Validates credentials before proceeding
  it('should validate credentials before deployment', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined }) // profile
      .mockResolvedValueOnce({ label: 'us-east-1' }); // region

    await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    expect(validateCredentials).toHaveBeenCalled();
  });

  // Test: Shows error when credentials are invalid
  it('should show error message when credentials are invalid', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    vi.mocked(validateCredentials).mockRejectedValue(new Error('Invalid credentials'));

    await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    expect(getMockedWindow().showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('credential')
    );
  });
});

describe('Initialize Project - CloudFormation Deployment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.isInitialized.mockResolvedValue(false);
    mockProfileService.listAvailableProfiles.mockResolvedValue(['default']);
    getMockedWindow().withProgress.mockImplementation(async (_options: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => {
      return task({ report: vi.fn() }, { isCancellationRequested: false });
    });
    vi.mocked(validateCredentials).mockResolvedValue(true);
    mockCloudFormationServiceInstance.deployStack.mockResolvedValue('stack-id');
    mockCloudFormationServiceInstance.waitForStackComplete.mockResolvedValue(undefined);
    mockCloudFormationServiceInstance.getStackOutputs.mockResolvedValue({
      tableName: 'test-table',
      tableArn: 'arn:aws:dynamodb:us-east-1:123:table/test-table',
    });
  });

  // Test 3.1.7: Deploys CloudFormation when table doesn't exist
  it('should deploy CloudFormation stack during initialization', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    // Verify CloudFormationService was instantiated and used
    expect(CloudFormationService).toHaveBeenCalled();
  });
});

describe('Initialize Project - Config Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.isInitialized.mockResolvedValue(false);
    mockConfigService.createConfig.mockResolvedValue(undefined);
    mockProfileService.listAvailableProfiles.mockResolvedValue(['default']);
    getMockedWindow().withProgress.mockImplementation(async (_options: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => {
      return task({ report: vi.fn() }, { isCancellationRequested: false });
    });
    vi.mocked(validateCredentials).mockResolvedValue(true);
    mockCloudFormationServiceInstance.deployStack.mockResolvedValue('stack-id');
    mockCloudFormationServiceInstance.waitForStackComplete.mockResolvedValue(undefined);
    mockCloudFormationServiceInstance.getStackOutputs.mockResolvedValue({
      tableName: 'test-table',
      tableArn: 'arn:aws:dynamodb:us-east-1:123:table/test-table',
    });
  });

  // Test 3.1.8: Generates config.json with correct values after successful deployment
  it('should generate config.json with correct values after deployment', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    expect(mockConfigService.createConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '1.0.0',
        infrastructure: expect.objectContaining({
          dynamodb: expect.objectContaining({
            tableName: 'test-table',
            tableArn: 'arn:aws:dynamodb:us-east-1:123:table/test-table',
            region: 'us-east-1',
          }),
        }),
      })
    );
  });

  // Test: Includes profile in config when non-default profile selected
  it('should include profile in config when non-default profile is selected', async () => {
    mockProfileService.listAvailableProfiles.mockResolvedValue(['dev-profile', 'prod-profile']);

    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'dev-profile', profile: 'dev-profile' })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    expect(mockConfigService.createConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        aws: expect.objectContaining({
          profile: 'dev-profile',
        }),
      })
    );
  });
});

describe('Initialize Project - DEFAULT_REGIONS', () => {
  it('should contain expected common regions', () => {
    expect(DEFAULT_REGIONS).toContainEqual(
      expect.objectContaining({ label: 'us-east-1' })
    );
    expect(DEFAULT_REGIONS).toContainEqual(
      expect.objectContaining({ label: 'us-west-2' })
    );
    expect(DEFAULT_REGIONS).toContainEqual(
      expect.objectContaining({ label: 'eu-west-1' })
    );
    expect(DEFAULT_REGIONS).toContainEqual(
      expect.objectContaining({ label: 'eu-central-1' })
    );
    expect(DEFAULT_REGIONS).toContainEqual(
      expect.objectContaining({ label: 'ap-northeast-1' })
    );
    expect(DEFAULT_REGIONS).toContainEqual(
      expect.objectContaining({ label: 'ap-southeast-1' })
    );
  });
});
