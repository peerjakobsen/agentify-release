/**
 * Tests for Demo Viewer Panel Integration (Task Groups 4 and 5)
 *
 * These tests validate the Demo Viewer panel integration including:
 * - "Get Started" button visibility when project not initialized
 * - Button click triggers agentify.initializeProject command
 * - Button hidden when project is initialized
 * - Input panel message handling
 * - State persistence
 * - Validation error display
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Track mock state
let mockIsInitialized = false;
let mockWebviewHtml = '';
let mockReceivedMessages: unknown[] = [];
let mockCommandExecuted = '';
let mockClipboardText = '';
let mockWorkspaceState: Map<string, unknown> = new Map();
let mockValidationState = { isValid: true, errors: [] as { type: string; message: string }[] };

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
    parse: (url: string) => ({ toString: () => url }),
  },
  RelativePattern: vi.fn(),
  Disposable: vi.fn().mockImplementation((fn) => ({ dispose: fn })),
  commands: {
    executeCommand: vi.fn().mockImplementation((command: string) => {
      mockCommandExecuted = command;
      return Promise.resolve();
    }),
  },
  env: {
    clipboard: {
      writeText: vi.fn().mockImplementation((text: string) => {
        mockClipboardText = text;
        return Promise.resolve();
      }),
    },
    openExternal: vi.fn().mockResolvedValue(true),
  },
}));

// Mock config service
vi.mock('../services/configService', () => ({
  getConfigService: () => ({
    isInitialized: vi.fn().mockImplementation(() => Promise.resolve(mockIsInitialized)),
    onConfigChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    getConfig: vi.fn().mockResolvedValue({
      workflow: { entryScript: 'agents/main.py', pythonPath: 'python3' },
      infrastructure: { dynamodb: { tableName: 'test-table', region: 'us-east-1' } },
    }),
  }),
  ConfigService: vi.fn().mockImplementation(() => ({
    isInitialized: vi.fn().mockImplementation(() => Promise.resolve(mockIsInitialized)),
    onConfigChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    getConfig: vi.fn().mockResolvedValue({
      workflow: { entryScript: 'agents/main.py', pythonPath: 'python3' },
      infrastructure: { dynamodb: { tableName: 'test-table', region: 'us-east-1' } },
    }),
  })),
  CONFIG_FILE_PATH: '.agentify/config.json',
}));

// Mock input panel validation service
vi.mock('../services/inputPanelValidation', () => ({
  getInputPanelValidationService: () => ({
    validateAll: vi.fn().mockImplementation(() => Promise.resolve(mockValidationState)),
    invalidateCache: vi.fn(),
    dispose: vi.fn(),
  }),
}));

// Mock WorkflowTriggerService
const mockOnStdoutLine = vi.fn().mockReturnValue({ dispose: vi.fn() });
const mockOnStderr = vi.fn().mockReturnValue({ dispose: vi.fn() });
const mockOnProcessStateChange = vi.fn().mockReturnValue({ dispose: vi.fn() });
const mockOnProcessExit = vi.fn().mockReturnValue({ dispose: vi.fn() });

vi.mock('../services/workflowTriggerService', () => ({
  getWorkflowTriggerService: () => ({
    start: vi.fn().mockResolvedValue({
      workflowId: 'wf-12345678',
      traceId: 'abcd1234abcd1234abcd1234abcd1234',
    }),
    kill: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockReturnValue('idle'),
    onStdoutLine: mockOnStdoutLine,
    onStderr: mockOnStderr,
    onProcessStateChange: mockOnProcessStateChange,
    onProcessExit: mockOnProcessExit,
    dispose: vi.fn(),
  }),
  resetWorkflowTriggerService: vi.fn(),
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

// Helper to create mock extension context
function createMockExtensionContext() {
  return {
    workspaceState: {
      get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
        return mockWorkspaceState.get(key) ?? defaultValue;
      }),
      update: vi.fn().mockImplementation((key: string, value: unknown) => {
        mockWorkspaceState.set(key, value);
        return Promise.resolve();
      }),
    },
  } as unknown as vscode.ExtensionContext;
}

describe('Demo Viewer Panel - Get Started Button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsInitialized = false;
    mockWebviewHtml = '';
    mockReceivedMessages = [];
    mockCommandExecuted = '';
    mockClipboardText = '';
    mockWorkspaceState = new Map();
    mockValidationState = { isValid: true, errors: [] };
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
    // It should show the input panel content instead
    expect(mockWebviewHtml).not.toContain('class="get-started-section"');
  });
});

describe('Demo Viewer Panel - View ID', () => {
  it('should have correct view ID constant', () => {
    expect(DEMO_VIEWER_VIEW_ID).toBe('agentify.demoViewer');
  });
});

describe('Demo Viewer Panel - Input Panel Content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsInitialized = true;
    mockWebviewHtml = '';
    mockReceivedMessages = [];
    mockCommandExecuted = '';
    mockClipboardText = '';
    mockWorkspaceState = new Map();
    mockValidationState = { isValid: true, errors: [] };
  });

  it('should show input panel when project is initialized', async () => {
    const extensionUri = vscode.Uri.file('/test/extension');
    const provider = new DemoViewerPanelProvider(extensionUri);
    const mockView = createMockWebviewView();

    await provider.resolveWebviewView(
      mockView,
      {} as vscode.WebviewViewResolveContext,
      { isCancellationRequested: false } as vscode.CancellationToken
    );

    // Verify HTML contains input panel elements
    expect(mockWebviewHtml).toContain('promptTextarea');
    expect(mockWebviewHtml).toContain('runWorkflow');
    expect(mockWebviewHtml).toContain('Run Workflow');
  });

  it('should show timer display in initial state', async () => {
    const extensionUri = vscode.Uri.file('/test/extension');
    const provider = new DemoViewerPanelProvider(extensionUri);
    const mockView = createMockWebviewView();

    await provider.resolveWebviewView(
      mockView,
      {} as vscode.WebviewViewResolveContext,
      { isCancellationRequested: false } as vscode.CancellationToken
    );

    // Verify timer display shows initial state
    expect(mockWebviewHtml).toContain('timerDisplay');
    expect(mockWebviewHtml).toContain('--:--');
  });
});

describe('Demo Viewer Panel - State Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsInitialized = true;
    mockWebviewHtml = '';
    mockReceivedMessages = [];
    mockWorkspaceState = new Map();
    mockValidationState = { isValid: true, errors: [] };
  });

  it('should persist prompt text when promptChanged message received', async () => {
    const extensionUri = vscode.Uri.file('/test/extension');
    const mockContext = createMockExtensionContext();
    const provider = new DemoViewerPanelProvider(extensionUri, mockContext);
    const mockView = createMockWebviewView();

    await provider.resolveWebviewView(
      mockView,
      {} as vscode.WebviewViewResolveContext,
      { isCancellationRequested: false } as vscode.CancellationToken
    );

    // Simulate prompt change message
    const messageHandler = mockReceivedMessages[0] as (message: unknown) => void;
    if (messageHandler) {
      await messageHandler({ command: 'promptChanged', text: 'Test prompt' });
    }

    // Verify workspace state was updated
    expect(mockContext.workspaceState.update).toHaveBeenCalledWith(
      'agentify.demoViewer.promptText',
      'Test prompt'
    );
  });

  it('should load persisted prompt text on panel resolve', async () => {
    mockWorkspaceState.set('agentify.demoViewer.promptText', 'Persisted prompt');

    const extensionUri = vscode.Uri.file('/test/extension');
    const mockContext = createMockExtensionContext();
    const provider = new DemoViewerPanelProvider(extensionUri, mockContext);
    const mockView = createMockWebviewView();

    await provider.resolveWebviewView(
      mockView,
      {} as vscode.WebviewViewResolveContext,
      { isCancellationRequested: false } as vscode.CancellationToken
    );

    // Verify persisted prompt was loaded
    expect(mockContext.workspaceState.get).toHaveBeenCalledWith(
      'agentify.demoViewer.promptText',
      ''
    );
  });
});

describe('Demo Viewer Panel - Validation Error Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsInitialized = true;
    mockWebviewHtml = '';
    mockReceivedMessages = [];
    mockValidationState = { isValid: true, errors: [] };
  });

  it('should disable run button when validation errors exist', async () => {
    mockValidationState = {
      isValid: false,
      errors: [{ type: 'entryScript', message: 'Entry script not found' }],
    };

    const extensionUri = vscode.Uri.file('/test/extension');
    const provider = new DemoViewerPanelProvider(extensionUri);
    const mockView = createMockWebviewView();

    await provider.resolveWebviewView(
      mockView,
      {} as vscode.WebviewViewResolveContext,
      { isCancellationRequested: false } as vscode.CancellationToken
    );

    // Check that validation state reflects errors
    expect(provider.validationState.isValid).toBe(false);
    expect(provider.validationState.errors).toHaveLength(1);
  });

  it('should show validation banner with error messages', async () => {
    mockValidationState = {
      isValid: false,
      errors: [{ type: 'awsCredentials', message: 'AWS credentials not configured' }],
    };

    const extensionUri = vscode.Uri.file('/test/extension');
    const provider = new DemoViewerPanelProvider(extensionUri);
    const mockView = createMockWebviewView();

    await provider.resolveWebviewView(
      mockView,
      {} as vscode.WebviewViewResolveContext,
      { isCancellationRequested: false } as vscode.CancellationToken
    );

    // Verify HTML contains validation error message
    expect(mockWebviewHtml).toContain('AWS credentials not configured');
    expect(mockWebviewHtml).toContain('validation-banner');
  });
});

describe('Demo Viewer Panel - Message Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsInitialized = true;
    mockWebviewHtml = '';
    mockReceivedMessages = [];
    mockClipboardText = '';
    mockValidationState = { isValid: true, errors: [] };
  });

  it('should handle resetPanel message', async () => {
    const extensionUri = vscode.Uri.file('/test/extension');
    const provider = new DemoViewerPanelProvider(extensionUri);
    const mockView = createMockWebviewView();

    await provider.resolveWebviewView(
      mockView,
      {} as vscode.WebviewViewResolveContext,
      { isCancellationRequested: false } as vscode.CancellationToken
    );

    // Simulate reset message
    const messageHandler = mockReceivedMessages[0] as (message: unknown) => void;
    if (messageHandler) {
      await messageHandler({ command: 'resetPanel' });
    }

    // Verify state was reset
    expect(provider.currentState).toBe('ready');
  });
});
