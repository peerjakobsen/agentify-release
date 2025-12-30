/**
 * Additional Tests for Initialization Edge Cases (Task Group 7)
 *
 * These tests validate edge cases in the new initialization flow:
 * - User cancellation scenarios at various stages
 * - Error handling for extraction failures
 * - Edge cases for workspace and extraction handling
 *
 * Note: CloudFormation-related tests have been removed as part of
 * the CDK infrastructure bundling migration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create shared mock instances for initializeProject tests
const mockConfigService = {
  isInitialized: vi.fn().mockResolvedValue(false),
  createConfig: vi.fn().mockResolvedValue(undefined),
  clearCache: vi.fn(),
};

const mockProfileService = {
  listAvailableProfiles: vi.fn().mockResolvedValue([]),
};

const mockExtractBundledResources = vi.fn();
const mockCheckExistingCdkFolder = vi.fn();
const mockShowOverwritePrompt = vi.fn();

// Mock vscode module - NOTE: showErrorMessage returns a thenable for button click handling
vi.mock('vscode', () => ({
  window: {
    showQuickPick: vi.fn(),
    showInformationMessage: vi.fn().mockResolvedValue(undefined),
    showErrorMessage: vi.fn().mockResolvedValue(undefined),
    showWarningMessage: vi.fn().mockResolvedValue(undefined),
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
  env: {
    openExternal: vi.fn().mockResolvedValue(true),
  },
  commands: {
    executeCommand: vi.fn(),
  },
}));

// Mock services
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

vi.mock('../templates/steeringFile', () => ({
  createSteeringFile: vi.fn().mockResolvedValue({ success: true, skipped: false }),
  STEERING_FILE_PATH: '.kiro/steering/agentify-integration.md',
}));

// Import vscode after mocking
import * as vscode from 'vscode';

// Import services and modules after mocking
import { handleInitializeProject, checkExistingConfig } from '../commands/initializeProject';

// Helper to get mocked window
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

describe('User Cancellation Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.isInitialized.mockResolvedValue(false);
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
    getMockedWindow().showErrorMessage.mockResolvedValue(undefined);
    getMockedWindow().showWarningMessage.mockResolvedValue(undefined);
    getMockedWorkspace().openTextDocument.mockResolvedValue({});
    getMockedWindow().showTextDocument.mockResolvedValue(undefined);
  });

  // Test 7.3.1: User cancels profile selection
  it('should return unsuccessful result when user cancels profile selection', async () => {
    getMockedWindow().showQuickPick.mockResolvedValueOnce(null); // User cancels profile

    const result = await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    expect(result.success).toBe(false);
  });

  // Test 7.3.2: User cancels region selection
  it('should return unsuccessful result when user cancels region selection', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined }) // Profile
      .mockResolvedValueOnce(null); // User cancels region

    const result = await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    expect(result.success).toBe(false);
    expect(result.region).toBeUndefined();
  });

  // Test 7.3.3: User cancels idempotency prompt (existing config)
  it('should return cancelled when user cancels idempotency prompt', async () => {
    mockConfigService.isInitialized.mockResolvedValue(true);
    getMockedWindow().showQuickPick.mockResolvedValueOnce(null); // User cancels prompt

    const result = await checkExistingConfig();

    expect(result).toBe('cancelled');
  });

  // Test 7.3.4: User cancels CDK overwrite prompt
  it('should return unsuccessful when user cancels CDK overwrite prompt', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    // CDK folder exists
    mockCheckExistingCdkFolder.mockResolvedValue(true);

    // User cancels overwrite prompt
    mockShowOverwritePrompt.mockResolvedValue(null);

    const result = await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    expect(result.success).toBe(false);
  });
});

describe('Extraction Error Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.isInitialized.mockResolvedValue(false);
    mockProfileService.listAvailableProfiles.mockResolvedValue(['default']);
    mockCheckExistingCdkFolder.mockResolvedValue(false);
    getMockedWindow().showErrorMessage.mockResolvedValue(undefined);
    getMockedWorkspace().openTextDocument.mockResolvedValue({});
    getMockedWindow().showTextDocument.mockResolvedValue(undefined);
  });

  // Test 7.3.5: Extraction failure shows error message
  it('should show error message when extraction fails', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    // Extraction fails
    mockExtractBundledResources.mockResolvedValue({
      success: false,
      cdkExtracted: false,
      scriptsExtracted: false,
      cdkPath: '/test/workspace/cdk',
      scriptsPath: '/test/workspace/scripts',
      message: 'Failed to extract resources',
    });

    const result = await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    expect(result.success).toBe(false);
    expect(getMockedWindow().showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Failed')
    );
  });

  // Test 7.3.6: Extraction throws error
  it('should handle extraction error gracefully', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    // Extraction throws error
    mockExtractBundledResources.mockRejectedValue(new Error('File system error'));

    const result = await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    expect(result.success).toBe(false);
    expect(getMockedWindow().showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('error')
    );
  });
});

describe('Edge Cases - Workspace Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.isInitialized.mockResolvedValue(false);
    mockProfileService.listAvailableProfiles.mockResolvedValue(['default']);
    mockCheckExistingCdkFolder.mockResolvedValue(false);
    getMockedWindow().showErrorMessage.mockResolvedValue(undefined);
    getMockedWorkspace().openTextDocument.mockResolvedValue({});
    getMockedWindow().showTextDocument.mockResolvedValue(undefined);
    mockExtractBundledResources.mockResolvedValue({
      success: true,
      cdkExtracted: true,
      scriptsExtracted: true,
      cdkPath: '/test/workspace/cdk',
      scriptsPath: '/test/workspace/scripts',
      message: 'CDK and scripts extracted successfully',
    });
  });

  // Test 7.3.7: Handles workspace with special characters in name
  it('should handle workspace with special characters', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    const result = await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    // Should succeed
    expect(result.success).toBe(true);
    expect(mockExtractBundledResources).toHaveBeenCalled();
  });
});
