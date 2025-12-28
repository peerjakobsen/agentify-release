/**
 * Tests for Demo Viewer Panel Integration (Task Group 5)
 *
 * These tests validate the Demo Viewer panel integration including:
 * - "Get Started" button visibility when project not initialized
 * - Button click triggers agentify.initializeProject command
 * - Button hidden when project is initialized
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Track mock state
let mockIsInitialized = false;
let mockWebviewHtml = '';
let mockReceivedMessages: unknown[] = [];
let mockCommandExecuted = '';

// Mock vscode module
vi.mock('vscode', () => ({
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' }, name: 'test-workspace' }],
    fs: {
      stat: vi.fn().mockImplementation(async () => {
        if (mockIsInitialized) {
          return { type: 1 }; // File exists
        }
        const error = new Error('File not found');
        (error as NodeJS.ErrnoException).code = 'FileNotFound';
        throw error;
      }),
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
    joinPath: (uri: { fsPath: string }, ...segments: string[]) => ({
      fsPath: [uri.fsPath, ...segments].join('/'),
    }),
  },
  RelativePattern: vi.fn(),
  Disposable: vi.fn().mockImplementation((fn) => ({ dispose: fn })),
  commands: {
    executeCommand: vi.fn().mockImplementation((command: string) => {
      mockCommandExecuted = command;
      return Promise.resolve();
    }),
  },
}));

// Mock config service
vi.mock('../services/configService', () => ({
  getConfigService: () => ({
    isInitialized: vi.fn().mockImplementation(() => Promise.resolve(mockIsInitialized)),
    onConfigChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  }),
  ConfigService: vi.fn().mockImplementation(() => ({
    isInitialized: vi.fn().mockImplementation(() => Promise.resolve(mockIsInitialized)),
    onConfigChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  })),
  CONFIG_FILE_PATH: '.agentify/config.json',
}));

// Import vscode after mocking
import * as vscode from 'vscode';

// Import module under test
import { DemoViewerPanelProvider, DEMO_VIEWER_VIEW_ID } from '../panels/demoViewerPanel';

// Helper to create mock WebviewView
function createMockWebviewView() {
  const webview = {
    options: {} as Record<string, unknown>,
    html: '',
    onDidReceiveMessage: vi.fn().mockImplementation((callback: (message: unknown) => void) => {
      // Store callback for later invocation
      mockReceivedMessages.push(callback);
      return { dispose: vi.fn() };
    }),
    postMessage: vi.fn(),
  };

  // Track HTML assignment
  Object.defineProperty(webview, 'html', {
    get: () => mockWebviewHtml,
    set: (value: string) => {
      mockWebviewHtml = value;
    },
  });

  const webviewView: Partial<vscode.WebviewView> = {
    webview: webview as unknown as vscode.Webview,
    visible: true,
    show: vi.fn(),
  };

  return webviewView as vscode.WebviewView;
}

describe('Demo Viewer Panel - Get Started Button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsInitialized = false;
    mockWebviewHtml = '';
    mockReceivedMessages = [];
    mockCommandExecuted = '';
  });

  // Test 5.1.1: "Get Started" button appears when project not initialized
  it('should show "Get Started" button when project is not initialized', async () => {
    mockIsInitialized = false;

    const extensionUri = vscode.Uri.file('/test/extension');
    const provider = new DemoViewerPanelProvider(extensionUri);
    const mockView = createMockWebviewView();

    await provider.resolveWebviewView(
      mockView,
      {} as vscode.WebviewViewResolveContext,
      { isCancellationRequested: false } as vscode.CancellationToken
    );

    // Verify HTML contains "Get Started" button
    expect(mockWebviewHtml).toContain('Get Started');
    expect(mockWebviewHtml).toContain('initializeProject');
  });

  // Test 5.1.2: "Get Started" button triggers initializeProject command
  it('should trigger agentify.initializeProject command when button clicked', async () => {
    mockIsInitialized = false;

    const extensionUri = vscode.Uri.file('/test/extension');
    const provider = new DemoViewerPanelProvider(extensionUri);
    const mockView = createMockWebviewView();

    await provider.resolveWebviewView(
      mockView,
      {} as vscode.WebviewViewResolveContext,
      { isCancellationRequested: false } as vscode.CancellationToken
    );

    // Simulate clicking the Get Started button (sending message from webview)
    const messageHandler = mockReceivedMessages[0] as (message: unknown) => void;
    if (messageHandler) {
      await messageHandler({ command: 'initializeProject' });
    }

    // Verify command was executed
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('agentify.initializeProject');
  });

  // Test 5.1.3: "Get Started" button hidden when project is initialized
  it('should hide "Get Started" button when project is initialized', async () => {
    mockIsInitialized = true;

    const extensionUri = vscode.Uri.file('/test/extension');
    const provider = new DemoViewerPanelProvider(extensionUri);
    const mockView = createMockWebviewView();

    await provider.resolveWebviewView(
      mockView,
      {} as vscode.WebviewViewResolveContext,
      { isCancellationRequested: false } as vscode.CancellationToken
    );

    // Verify HTML does NOT contain "Get Started" button in uninitialized container
    // It should show the ready state content instead
    expect(mockWebviewHtml).toContain('ready');
    expect(mockWebviewHtml).not.toContain('class="get-started-section"');
  });
});

describe('Demo Viewer Panel - View ID', () => {
  it('should have correct view ID constant', () => {
    expect(DEMO_VIEWER_VIEW_ID).toBe('agentify.demoViewer');
  });
});
