/**
 * Tests for Post-Initialization Flow (Task Group 6)
 *
 * These tests validate the post-initialization behavior including:
 * - Success message shows after initialization completes with region
 * - Demo Viewer panel refreshes after initialization
 * - Status bar updates after initialization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to define mock functions before vi.mock hoists
const {
  mockShowInformationMessage,
  mockOpenTextDocument,
  mockShowTextDocument,
  mockCreateStatusBarItem,
} = vi.hoisted(() => {
  return {
    mockShowInformationMessage: vi.fn(),
    mockOpenTextDocument: vi.fn(),
    mockShowTextDocument: vi.fn(),
    mockCreateStatusBarItem: vi.fn(() => ({
      text: '',
      tooltip: '',
      backgroundColor: undefined,
      color: undefined,
      command: undefined,
      show: vi.fn(),
      dispose: vi.fn(),
    })),
  };
});

// Mock vscode module with complete mocks
vi.mock('vscode', () => ({
  window: {
    showInformationMessage: mockShowInformationMessage,
    showQuickPick: vi.fn(),
    showErrorMessage: vi.fn(),
    showTextDocument: mockShowTextDocument,
    createStatusBarItem: mockCreateStatusBarItem,
  },
  workspace: {
    openTextDocument: mockOpenTextDocument,
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' }, name: 'test-workspace' }],
    getConfiguration: vi.fn(() => ({
      get: vi.fn((_key: string, defaultValue?: string) => defaultValue),
    })),
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
  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },
  ThemeColor: vi.fn().mockImplementation((color: string) => ({ id: color })),
  commands: {
    executeCommand: vi.fn(),
  },
  env: {
    openExternal: vi.fn(),
  },
}));

// Import the module under test after mocking
import { showSuccessNotification } from '../commands/initializeProject';

describe('Post-Initialization - Success Notification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShowInformationMessage.mockResolvedValue(undefined);
  });

  // Test 6.1.1: Success message shows with region
  it('should show success message with region after initialization', async () => {
    mockShowInformationMessage.mockResolvedValue(undefined);

    await showSuccessNotification(
      'us-east-1',
      true, // cdkExtracted
      true, // scriptsExtracted
      '/test/workspace'
    );

    expect(mockShowInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('us-east-1'),
      expect.any(String)
    );
    expect(mockShowInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('extracted'),
      expect.any(String)
    );
  });

  // Test 6.1.2: Success message offers to open CDK README
  it('should offer to open CDK README after extraction', async () => {
    mockShowInformationMessage.mockResolvedValue(undefined);

    await showSuccessNotification(
      'eu-west-1',
      true,
      true,
      '/test/workspace'
    );

    // Verify the message includes the "Open CDK README" action
    expect(mockShowInformationMessage).toHaveBeenCalledWith(
      expect.any(String),
      'Open CDK README'
    );
  });

  // Test 6.1.3: Clicking "Open CDK README" opens the file
  it('should open CDK README when user clicks action button', async () => {
    // Simulate user clicking "Open CDK README"
    mockShowInformationMessage.mockResolvedValue('Open CDK README');
    mockOpenTextDocument.mockResolvedValue({ uri: { fsPath: '/test/workspace/cdk/README.md' } });
    mockShowTextDocument.mockResolvedValue(undefined);

    await showSuccessNotification(
      'us-west-2',
      true,
      true,
      '/test/workspace'
    );

    // Verify openTextDocument was called with CDK README path
    expect(mockOpenTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        fsPath: expect.stringContaining('cdk/README.md'),
      })
    );
    expect(mockShowTextDocument).toHaveBeenCalled();
  });
});

describe('Post-Initialization - Demo Viewer Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 6.1.4: Demo Viewer refresh method is callable
  it('should have refresh method on DemoViewerPanelProvider', async () => {
    // Import DemoViewerPanelProvider
    const { DemoViewerPanelProvider } = await import('../panels/demoViewerPanel');

    const mockUri = { fsPath: '/test/extension' } as any;
    const provider = new DemoViewerPanelProvider(mockUri);

    // Verify refresh method exists and is callable
    expect(typeof provider.refresh).toBe('function');

    // Call refresh - should not throw even without resolved view
    await expect(provider.refresh()).resolves.not.toThrow();
  });
});

describe('Post-Initialization - Status Bar Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 6.1.5: Status bar can update to ready state
  it('should update status bar to ready state after initialization', async () => {
    // Import StatusBarManager
    const { StatusBarManager } = await import('../statusBar');

    const manager = new StatusBarManager();

    // Update to ready state (simulating post-initialization)
    manager.updateStatus('ready');

    // Verify status is updated
    expect(manager.getStatus()).toBe('ready');

    manager.dispose();
  });

  // Test 6.1.6: Status bar transitions from not-initialized to ready
  it('should transition from not-initialized to ready after successful initialization', async () => {
    const { StatusBarManager } = await import('../statusBar');

    const manager = new StatusBarManager();

    // Initial state should be not-initialized
    expect(manager.getStatus()).toBe('not-initialized');

    // Simulate successful initialization
    manager.updateStatus('ready');

    // Final state should be ready
    expect(manager.getStatus()).toBe('ready');

    manager.dispose();
  });
});
