/**
 * Tests for Initialize Project command handler (Task Group 3)
 *
 * These tests validate the refactored initialization flow including:
 * - Profile and region selection UI
 * - Idempotency checks
 * - File extraction called during initialization
 * - README.md auto-opens after successful extraction
 * - config.json created without infrastructure.dynamodb fields
 * - Credential validation step removed (no failure on invalid creds)
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

// Mock extraction service functions
const mockExtractBundledResources = vi.fn();
const mockCheckExistingCdkFolder = vi.fn();
const mockShowOverwritePrompt = vi.fn();

// Mock document operations
const mockOpenTextDocument = vi.fn();
const mockShowTextDocument = vi.fn();

// Mock vscode module first (will be hoisted)
vi.mock('vscode', () => ({
  window: {
    showQuickPick: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    withProgress: vi.fn(),
    showTextDocument: vi.fn(),
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
      readDirectory: vi.fn(),
    },
    createFileSystemWatcher: vi.fn(() => ({
      onDidChange: vi.fn(),
      onDidDelete: vi.fn(),
      onDidCreate: vi.fn(),
      dispose: vi.fn(),
    })),
    openTextDocument: vi.fn(),
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
  FileType: {
    File: 1,
    Directory: 2,
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

// Mock resource extraction service
vi.mock('../services/resourceExtractionService', () => ({
  extractBundledResources: (...args: unknown[]) => mockExtractBundledResources(...args),
  checkExistingCdkFolder: (...args: unknown[]) => mockCheckExistingCdkFolder(...args),
  showOverwritePrompt: () => mockShowOverwritePrompt(),
  CDK_DEST_PATH: 'cdk',
}));

// Mock steeringFile template
vi.mock('../templates/steeringFile', () => ({
  createSteeringFile: vi.fn().mockResolvedValue({ success: true, skipped: false }),
  STEERING_FILE_PATH: '.kiro/steering/agentify-integration.md',
}));

// Import vscode after mocking
import * as vscode from 'vscode';

// Import the module under test
import {
  handleInitializeProject,
  showProfileSelection,
  showRegionSelection,
  checkExistingConfig,
  showSuccessNotification,
  DEFAULT_REGIONS,
} from '../commands/initializeProject';

// Helper to get mocked functions
const getMockedWindow = () => vscode.window as unknown as {
  showQuickPick: ReturnType<typeof vi.fn>;
  showInformationMessage: ReturnType<typeof vi.fn>;
  showErrorMessage: ReturnType<typeof vi.fn>;
  showWarningMessage: ReturnType<typeof vi.fn>;
  withProgress: ReturnType<typeof vi.fn>;
  showTextDocument: ReturnType<typeof vi.fn>;
};

const getMockedWorkspace = () => vscode.workspace as unknown as {
  openTextDocument: ReturnType<typeof vi.fn>;
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

describe('Initialize Project - File Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.isInitialized.mockResolvedValue(false);
    mockConfigService.createConfig.mockResolvedValue(undefined);
    mockProfileService.listAvailableProfiles.mockResolvedValue(['default']);
  });

  // Test 3.1.6: File extraction called during initialization
  it('should call file extraction during initialization', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    // Setup: No existing CDK folder
    mockCheckExistingCdkFolder.mockResolvedValue(false);

    // Setup: Extraction succeeds
    mockExtractBundledResources.mockResolvedValue({
      success: true,
      cdkExtracted: true,
      scriptsExtracted: true,
      cdkPath: '/test/workspace/cdk',
      scriptsPath: '/test/workspace/scripts',
      message: 'CDK and scripts extracted successfully',
    });

    // Setup: README opens successfully
    getMockedWorkspace().openTextDocument.mockResolvedValue({ uri: { fsPath: '/test/workspace/cdk/README.md' } });
    getMockedWindow().showTextDocument.mockResolvedValue(undefined);

    const context = {
      extensionPath: '/test/extension',
    } as vscode.ExtensionContext;

    const result = await handleInitializeProject(context);

    // Verify extraction was called with correct parameters
    expect(mockExtractBundledResources).toHaveBeenCalledWith(
      '/test/extension',
      '/test/workspace',
      true
    );
    expect(result.success).toBe(true);
    expect(result.cdkExtracted).toBe(true);
    expect(result.scriptsExtracted).toBe(true);
  });

  // Test 3.1.7: README.md auto-opens after successful extraction
  it('should auto-open README.md after successful extraction', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    // Setup: No existing CDK folder
    mockCheckExistingCdkFolder.mockResolvedValue(false);

    // Setup: Extraction succeeds
    mockExtractBundledResources.mockResolvedValue({
      success: true,
      cdkExtracted: true,
      scriptsExtracted: true,
      cdkPath: '/test/workspace/cdk',
      scriptsPath: '/test/workspace/scripts',
      message: 'CDK and scripts extracted successfully',
    });

    // Setup: README opens
    getMockedWorkspace().openTextDocument.mockResolvedValue({ uri: { fsPath: '/test/workspace/cdk/README.md' } });
    getMockedWindow().showTextDocument.mockResolvedValue(undefined);

    const context = {
      extensionPath: '/test/extension',
    } as vscode.ExtensionContext;

    await handleInitializeProject(context);

    // Verify README was opened
    expect(getMockedWorkspace().openTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        fsPath: expect.stringContaining('cdk/README.md'),
      })
    );
    expect(getMockedWindow().showTextDocument).toHaveBeenCalled();
  });
});

describe('Initialize Project - Config Generation (No DynamoDB)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.isInitialized.mockResolvedValue(false);
    mockConfigService.createConfig.mockResolvedValue(undefined);
    mockProfileService.listAvailableProfiles.mockResolvedValue(['default']);
    mockCheckExistingCdkFolder.mockResolvedValue(false);
    mockExtractBundledResources.mockResolvedValue({
      success: true,
      cdkExtracted: true,
      scriptsExtracted: true,
      cdkPath: '/test/workspace/cdk',
      scriptsPath: '/test/workspace/scripts',
      message: 'CDK and scripts extracted successfully',
    });
    getMockedWorkspace().openTextDocument.mockResolvedValue({});
    getMockedWindow().showTextDocument.mockResolvedValue(undefined);
  });

  // Test 3.1.8: config.json created without infrastructure.dynamodb fields
  it('should create config without infrastructure.dynamodb fields', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-west-2' });

    const context = {
      extensionPath: '/test/extension',
    } as vscode.ExtensionContext;

    await handleInitializeProject(context);

    // Verify config was created
    expect(mockConfigService.createConfig).toHaveBeenCalled();

    // Get the config that was passed to createConfig
    const createdConfig = mockConfigService.createConfig.mock.calls[0][0];

    // Verify infrastructure.dynamodb is not present
    expect(createdConfig.infrastructure.dynamodb).toBeUndefined();

    // Verify infrastructure.bedrock IS present with region
    expect(createdConfig.infrastructure.bedrock).toBeDefined();
    expect(createdConfig.infrastructure.bedrock.region).toBe('us-west-2');

    // Verify aws.region is stored
    expect(createdConfig.aws?.region).toBe('us-west-2');
  });

  // Test: Includes profile in config when non-default profile selected
  it('should include profile in config when non-default profile is selected', async () => {
    mockProfileService.listAvailableProfiles.mockResolvedValue(['dev-profile', 'prod-profile']);

    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'dev-profile', profile: 'dev-profile' })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    const context = {
      extensionPath: '/test/extension',
    } as vscode.ExtensionContext;

    await handleInitializeProject(context);

    expect(mockConfigService.createConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        aws: expect.objectContaining({
          profile: 'dev-profile',
        }),
      })
    );
  });
});

describe('Initialize Project - Credential Validation Removed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.isInitialized.mockResolvedValue(false);
    mockConfigService.createConfig.mockResolvedValue(undefined);
    mockProfileService.listAvailableProfiles.mockResolvedValue(['default']);
    mockCheckExistingCdkFolder.mockResolvedValue(false);
    mockExtractBundledResources.mockResolvedValue({
      success: true,
      cdkExtracted: true,
      scriptsExtracted: true,
      cdkPath: '/test/workspace/cdk',
      scriptsPath: '/test/workspace/scripts',
      message: 'CDK and scripts extracted successfully',
    });
    getMockedWorkspace().openTextDocument.mockResolvedValue({});
    getMockedWindow().showTextDocument.mockResolvedValue(undefined);
  });

  // Test 3.1.9: Credential validation step removed (no failure on invalid creds)
  it('should not fail on invalid credentials (validation removed)', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'profile-1', profile: 'profile-1' })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    const context = {
      extensionPath: '/test/extension',
    } as vscode.ExtensionContext;

    // Execute - should succeed even though we never validated credentials
    const result = await handleInitializeProject(context);

    // Verify success - no credential validation failure
    expect(result.success).toBe(true);

    // Verify no error message was shown for credentials
    expect(getMockedWindow().showErrorMessage).not.toHaveBeenCalledWith(
      expect.stringContaining('credentials')
    );
  });
});

describe('Initialize Project - Existing CDK Folder Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.isInitialized.mockResolvedValue(false);
    mockConfigService.createConfig.mockResolvedValue(undefined);
    mockProfileService.listAvailableProfiles.mockResolvedValue(['default']);
    getMockedWorkspace().openTextDocument.mockResolvedValue({});
    getMockedWindow().showTextDocument.mockResolvedValue(undefined);
  });

  // Test 3.1.10: Show overwrite prompt when CDK folder exists
  it('should show overwrite prompt when CDK folder exists', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    // Setup: CDK folder exists
    mockCheckExistingCdkFolder.mockResolvedValue(true);

    // Setup: User chooses to overwrite
    mockShowOverwritePrompt.mockResolvedValue('overwrite');

    // Setup: Extraction succeeds
    mockExtractBundledResources.mockResolvedValue({
      success: true,
      cdkExtracted: true,
      scriptsExtracted: true,
      cdkPath: '/test/workspace/cdk',
      scriptsPath: '/test/workspace/scripts',
      message: 'CDK and scripts extracted successfully',
    });

    const context = {
      extensionPath: '/test/extension',
    } as vscode.ExtensionContext;

    await handleInitializeProject(context);

    // Verify overwrite prompt was shown
    expect(mockShowOverwritePrompt).toHaveBeenCalled();

    // Verify extraction was called with overwrite=true
    expect(mockExtractBundledResources).toHaveBeenCalledWith(
      '/test/extension',
      '/test/workspace',
      true
    );
  });

  // Test 3.1.11: Skip extraction when user chooses to keep existing
  it('should skip extraction when user chooses to keep existing', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    // Setup: CDK folder exists
    mockCheckExistingCdkFolder.mockResolvedValue(true);

    // Setup: User chooses to skip
    mockShowOverwritePrompt.mockResolvedValue('skip');

    // Setup: Extraction succeeds with skip (no actual extraction)
    mockExtractBundledResources.mockResolvedValue({
      success: true,
      cdkExtracted: false,
      scriptsExtracted: false,
      cdkPath: '/test/workspace/cdk',
      scriptsPath: '/test/workspace/scripts',
      message: 'Extraction skipped - existing folders preserved',
    });

    const context = {
      extensionPath: '/test/extension',
    } as vscode.ExtensionContext;

    await handleInitializeProject(context);

    // Verify extraction was called with overwrite=false
    expect(mockExtractBundledResources).toHaveBeenCalledWith(
      '/test/extension',
      '/test/workspace',
      false
    );
  });
});

describe('Initialize Project - Success Notification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMockedWindow().showInformationMessage.mockResolvedValue(undefined);
  });

  // Test 3.1.12: Shows extraction-focused success message
  it('should show extraction-focused success message', async () => {
    await showSuccessNotification(
      'us-east-1',
      true,
      true,
      '/test/workspace'
    );

    expect(getMockedWindow().showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('extracted'),
      expect.any(String)
    );
  });

  // Test 3.1.13: Offers Open CDK README action
  it('should offer to open CDK README when extraction succeeded', async () => {
    getMockedWindow().showInformationMessage.mockResolvedValue('Open CDK README');
    getMockedWorkspace().openTextDocument.mockResolvedValue({ uri: { fsPath: '/test/workspace/cdk/README.md' } });
    getMockedWindow().showTextDocument.mockResolvedValue(undefined);

    await showSuccessNotification(
      'us-west-2',
      true,
      true,
      '/test/workspace'
    );

    // Verify the action button was offered
    expect(getMockedWindow().showInformationMessage).toHaveBeenCalledWith(
      expect.any(String),
      'Open CDK README'
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
