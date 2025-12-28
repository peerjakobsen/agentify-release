/**
 * Additional Tests for Initialization Edge Cases (Task Group 7)
 *
 * These tests fill critical coverage gaps identified during test review:
 * - User cancellation scenarios at various stages
 * - Timeout scenarios during CloudFormation polling
 * - Error handling for rollback states
 * - Network and credential errors
 * - Edge cases for workspace and template handling
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

// Mock vscode module - NOTE: showErrorMessage returns a thenable for button click handling
vi.mock('vscode', () => ({
  window: {
    showQuickPick: vi.fn(),
    showInformationMessage: vi.fn().mockResolvedValue(undefined),
    showErrorMessage: vi.fn().mockResolvedValue(undefined),
    showWarningMessage: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../services/credentialProvider', () => ({
  getDefaultCredentialProvider: () => mockCredentialProvider,
  validateCredentials: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/cloudFormationService', () => ({
  CloudFormationService: vi.fn().mockImplementation(() => mockCloudFormationServiceInstance),
  sanitizeStackName: (name: string) => `agentify-workflow-events-${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`,
  getCloudFormationTemplate: vi.fn().mockReturnValue('mock-template-body'),
}));

vi.mock('../templates/steeringFile', () => ({
  createSteeringFile: vi.fn().mockResolvedValue({ success: true, skipped: false }),
  STEERING_FILE_PATH: '.kiro/steering/agentify-integration.md',
}));

// Import vscode after mocking
import * as vscode from 'vscode';

// Import services and modules after mocking
import { validateCredentials } from '../services/credentialProvider';
import { getCloudFormationTemplate } from '../services/cloudFormationService';
import { handleInitializeProject, checkExistingConfig } from '../commands/initializeProject';

// Helper to get mocked window
const getMockedWindow = () => vscode.window as unknown as {
  showQuickPick: ReturnType<typeof vi.fn>;
  showInformationMessage: ReturnType<typeof vi.fn>;
  showErrorMessage: ReturnType<typeof vi.fn>;
  showWarningMessage: ReturnType<typeof vi.fn>;
  withProgress: ReturnType<typeof vi.fn>;
};

describe('User Cancellation Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.isInitialized.mockResolvedValue(false);
    mockProfileService.listAvailableProfiles.mockResolvedValue(['default']);
    vi.mocked(validateCredentials).mockResolvedValue(true);
    vi.mocked(getCloudFormationTemplate).mockReturnValue('mock-template-body');
    mockCloudFormationServiceInstance.deployStack.mockResolvedValue('stack-id');
    mockCloudFormationServiceInstance.waitForStackComplete.mockResolvedValue(undefined);
    mockCloudFormationServiceInstance.getStackOutputs.mockResolvedValue({
      tableName: 'test-table',
      tableArn: 'arn:aws:dynamodb:us-east-1:123:table/test-table',
    });
    getMockedWindow().showErrorMessage.mockResolvedValue(undefined);
    getMockedWindow().showWarningMessage.mockResolvedValue(undefined);
    getMockedWindow().withProgress.mockImplementation(async (_options: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => {
      return task({ report: vi.fn() }, { isCancellationRequested: false });
    });
  });

  // Test 7.3.1: User cancels profile selection
  it('should return unsuccessful result when user cancels profile selection', async () => {
    getMockedWindow().showQuickPick.mockResolvedValueOnce(null); // User cancels profile

    const result = await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    expect(result.success).toBe(false);
    expect(result.tableName).toBeUndefined();
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

  // Test 7.3.4: Cancellation during CloudFormation deployment shows warning
  it('should show warning and return unsuccessful when cancelled during deployment', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    // Simulate cancellation after stack creation starts
    let cancellationRequested = false;
    getMockedWindow().withProgress.mockImplementation(async (_options: unknown, task: (progress: unknown, token: { isCancellationRequested: boolean }) => Promise<unknown>) => {
      const token = {
        get isCancellationRequested() {
          return cancellationRequested;
        }
      };
      // Set cancellation after deployStack is called but before waitForStackComplete
      mockCloudFormationServiceInstance.deployStack.mockImplementation(async () => {
        cancellationRequested = true;
        return 'stack-id';
      });
      return task({ report: vi.fn() }, token);
    });

    const result = await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    expect(result.success).toBe(false);
    expect(getMockedWindow().showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('cancelled')
    );
  });
});

describe('CloudFormation Timeout and Rollback Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.isInitialized.mockResolvedValue(false);
    mockProfileService.listAvailableProfiles.mockResolvedValue(['default']);
    vi.mocked(validateCredentials).mockResolvedValue(true);
    vi.mocked(getCloudFormationTemplate).mockReturnValue('mock-template-body');
    getMockedWindow().showErrorMessage.mockResolvedValue(undefined);
    getMockedWindow().withProgress.mockImplementation(async (_options: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => {
      return task({ report: vi.fn() }, { isCancellationRequested: false });
    });
    mockCloudFormationServiceInstance.deployStack.mockResolvedValue('stack-id');
  });

  // Test 7.3.5: Stack creation timeout error handling
  it('should show appropriate error message when stack creation times out', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    mockCloudFormationServiceInstance.waitForStackComplete.mockRejectedValue(
      new Error('Stack creation timed out after 10 minutes')
    );

    const result = await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    expect(result.success).toBe(false);
    expect(getMockedWindow().showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('timed out'),
      'Open AWS Console'
    );
  });

  // Test 7.3.6: Stack rollback error handling
  it('should show appropriate error message when stack rolls back', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    mockCloudFormationServiceInstance.waitForStackComplete.mockRejectedValue(
      new Error("Stack creation failed with status 'ROLLBACK_COMPLETE': Insufficient permissions")
    );

    const result = await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    expect(result.success).toBe(false);
    expect(getMockedWindow().showErrorMessage).toHaveBeenCalled();
  });
});

describe('Credential Error Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.isInitialized.mockResolvedValue(false);
    mockProfileService.listAvailableProfiles.mockResolvedValue(['default']);
    getMockedWindow().showErrorMessage.mockResolvedValue(undefined);
  });

  // Test 7.3.7: SSO token expired error shows specific guidance
  it('should show SSO login guidance when SSO token is expired', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'dev-profile', profile: 'dev-profile' })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    vi.mocked(validateCredentials).mockRejectedValue(new Error('SSO token has expired'));

    const result = await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    expect(result.success).toBe(false);
    expect(getMockedWindow().showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('SSO'),
      'Learn More'
    );
  });

  // Test 7.3.8: Access denied error shows permissions guidance
  it('should show permissions guidance when access is denied during deployment', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    vi.mocked(validateCredentials).mockResolvedValue(true);
    vi.mocked(getCloudFormationTemplate).mockReturnValue('mock-template-body');
    getMockedWindow().withProgress.mockImplementation(async (_options: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => {
      return task({ report: vi.fn() }, { isCancellationRequested: false });
    });

    mockCloudFormationServiceInstance.deployStack.mockRejectedValue(
      new Error('Access denied when creating CloudFormation stack')
    );

    const result = await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    expect(result.success).toBe(false);
    expect(getMockedWindow().showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Access denied')
    );
  });
});

describe('Edge Cases - Template and Stack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigService.isInitialized.mockResolvedValue(false);
    mockProfileService.listAvailableProfiles.mockResolvedValue(['default']);
    vi.mocked(validateCredentials).mockResolvedValue(true);
    getMockedWindow().showErrorMessage.mockResolvedValue(undefined);
    getMockedWindow().withProgress.mockImplementation(async (_options: unknown, task: (progress: unknown, token: unknown) => Promise<unknown>) => {
      return task({ report: vi.fn() }, { isCancellationRequested: false });
    });
  });

  // Test 7.3.9: Stack already exists shows appropriate guidance
  it('should show guidance when stack already exists', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    vi.mocked(getCloudFormationTemplate).mockReturnValue('mock-template-body');
    mockCloudFormationServiceInstance.deployStack.mockRejectedValue(
      new Error("CloudFormation stack 'agentify-workflow-events-test' already exists")
    );

    const result = await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    expect(result.success).toBe(false);
    expect(getMockedWindow().showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('already exists'),
      'Open AWS Console'
    );
  });

  // Test 7.3.10: Missing CloudFormation template file
  it('should handle missing CloudFormation template file gracefully', async () => {
    getMockedWindow().showQuickPick
      .mockResolvedValueOnce({ label: 'Use default credentials', profile: undefined })
      .mockResolvedValueOnce({ label: 'us-east-1' });

    // Mock template reader to throw error
    vi.mocked(getCloudFormationTemplate).mockImplementation(() => {
      throw new Error("Failed to read CloudFormation template at '/test/extension/infrastructure/dynamodb-table.yaml': ENOENT");
    });

    const result = await handleInitializeProject({ extensionPath: '/test/extension' } as vscode.ExtensionContext);

    expect(result.success).toBe(false);
    expect(getMockedWindow().showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('CloudFormation template')
    );
  });
});
