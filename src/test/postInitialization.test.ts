/**
 * Tests for Post-Initialization Flow (Task Group 6)
 *
 * These tests validate the post-initialization behavior including:
 * - Success message shows after initialization completes with table name and region
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

  // Test 6.1.1: Success message shows with table name and region
  it('should show success message with table name and region after initialization', async () => {
    mockShowInformationMessage.mockResolvedValue(undefined);

    await showSuccessNotification(
      'test-table',
      'us-east-1',
      false,
      '/test/workspace'
    );

    expect(mockShowInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('test-table')
    );
    expect(mockShowInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('us-east-1')
    );
    expect(mockShowInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('initialized successfully')
    );
  });

  // Test 6.1.2: Success message offers to open steering file when created
  it('should offer to open steering file when it was created', async () => {
    mockShowInformationMessage.mockResolvedValue(undefined);

    await showSuccessNotification(
      'test-table',
      'eu-west-1',
      true,
      '/test/workspace'
    );

    // Verify the message includes the "Open Steering File" action
    expect(mockShowInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('test-table'),
      'Open Steering File'
    );
  });

  // Test 6.1.3: Clicking "Open Steering File" opens the file
  it('should open steering file when user clicks action button', async () => {
    // Simulate user clicking "Open Steering File"
    mockShowInformationMessage.mockResolvedValue('Open Steering File');
    mockOpenTextDocument.mockResolvedValue({ uri: { fsPath: '/test/workspace/.kiro/steering/agentify-integration.md' } });
    mockShowTextDocument.mockResolvedValue(undefined);

    await showSuccessNotification(
      'test-table',
      'us-west-2',
      true,
      '/test/workspace'
    );

    // Verify openTextDocument was called with steering file path
    expect(mockOpenTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        fsPath: expect.stringContaining('agentify-integration.md'),
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
