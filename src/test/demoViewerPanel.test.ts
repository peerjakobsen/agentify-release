/**
 * Tests for Demo Viewer Panel Integration (Task Groups 3, 4 and 5)
 *
 * These tests validate the Demo Viewer panel integration including:
 * - "Get Started" button visibility when project not initialized
 * - Button click triggers agentify.initializeProject command
 * - Button hidden when project is initialized
 * - Input panel message handling
 * - State persistence
 * - Validation error display
 * - Task Group 3: Event integration with StdoutEventParser and DynamoDbPollingService
 * - Parse error logging to Output channel (Task Group 4)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Track mock state
let mockIsInitialized = false;
let mockWebviewHtml = '';
let mockReceivedMessages: unknown[] = [];
let mockCommandExecuted = '';
let mockClipboardText = '';
let mockWorkspaceState: Map<string, unknown> = new Map();
let mockValidationState = { isValid: true, errors: [] as { type: string; message: string }[] };

// Track Output channel logs
let mockOutputChannelLines: string[] = [];
const mockOutputChannel = {
  appendLine: vi.fn().mockImplementation((line: string) => {
    mockOutputChannelLines.push(line);
  }),
  append: vi.fn(),
  clear: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  dispose: vi.fn(),
  name: 'Agentify',
  replace: vi.fn(),
};

// Track StdoutEventParser listeners
const mockParseErrorListeners: Array<(errorInfo: { error: Error; rawData: string }) => void> = [];
const mockStdoutEventListeners: Array<(event: unknown) => void> = [];

// Track DynamoDB listeners
const mockDynamoDbEventListeners: Array<(event: unknown) => void> = [];

// Mock vscode module
vi.mock('vscode', () => ({
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    createOutputChannel: vi.fn().mockImplementation(() => mockOutputChannel),
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

// Mock StdoutEventParser
vi.mock('../services/stdoutEventParser', () => ({
  getStdoutEventParser: () => ({
    onEvent: vi.fn().mockImplementation((listener: (event: unknown) => void) => {
      mockStdoutEventListeners.push(listener);
      return { dispose: () => mockStdoutEventListeners.splice(mockStdoutEventListeners.indexOf(listener), 1) };
    }),
    onParseError: vi.fn().mockImplementation((listener: (errorInfo: { error: Error; rawData: string }) => void) => {
      mockParseErrorListeners.push(listener);
      return { dispose: () => mockParseErrorListeners.splice(mockParseErrorListeners.indexOf(listener), 1) };
    }),
    dispose: vi.fn(),
  }),
  resetStdoutEventParser: vi.fn(),
}));

// Mock DynamoDbPollingService
vi.mock('../services/dynamoDbPollingService', () => ({
  getDynamoDbPollingService: vi.fn(() => ({
    onEvent: (listener: (event: unknown) => void) => {
      mockDynamoDbEventListeners.push(listener);
      return { dispose: () => mockDynamoDbEventListeners.splice(mockDynamoDbEventListeners.indexOf(listener), 1) };
    },
    onError: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
    isPolling: vi.fn().mockReturnValue(false),
    dispose: vi.fn(),
  })),
  resetDynamoDbPollingService: vi.fn(),
}));

// Import vscode after mocking
import * as vscode from 'vscode';

// Import module under test
import { DemoViewerPanelProvider, DEMO_VIEWER_VIEW_ID } from '../panels/demoViewerPanel';
import type {
  MergedEvent,
  NodeStartEvent,
  WorkflowCompleteEvent,
  WorkflowErrorEvent,
  GraphStructureEvent,
  NodeStreamEvent,
  ToolCallEvent,
} from '../types/events';

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

// Helper to simulate parse error from StdoutEventParser
function simulateParseError(error: Error, rawData: string): void {
  mockParseErrorListeners.forEach((listener) => listener({ error, rawData }));
}

// Helper to simulate stdout event
function simulateStdoutEvent(event: MergedEvent): void {
  mockStdoutEventListeners.forEach((listener) => listener(event));
}

// Helper to simulate DynamoDB event
function simulateDynamoDbEvent(event: unknown): void {
  mockDynamoDbEventListeners.forEach((listener) => listener(event));
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
    mockOutputChannelLines = [];
    mockParseErrorListeners.length = 0;
    mockStdoutEventListeners.length = 0;
    mockDynamoDbEventListeners.length = 0;
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
    mockOutputChannelLines = [];
    mockParseErrorListeners.length = 0;
    mockStdoutEventListeners.length = 0;
    mockDynamoDbEventListeners.length = 0;
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
    mockOutputChannelLines = [];
    mockParseErrorListeners.length = 0;
    mockStdoutEventListeners.length = 0;
    mockDynamoDbEventListeners.length = 0;
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
    mockOutputChannelLines = [];
    mockParseErrorListeners.length = 0;
    mockStdoutEventListeners.length = 0;
    mockDynamoDbEventListeners.length = 0;
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
    mockOutputChannelLines = [];
    mockParseErrorListeners.length = 0;
    mockStdoutEventListeners.length = 0;
    mockDynamoDbEventListeners.length = 0;
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

// ============================================================================
// Task Group 3: DemoViewerPanel Event Integration Tests
// ============================================================================

describe('Task Group 3: DemoViewerPanel Event Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockIsInitialized = true;
    mockWebviewHtml = '';
    mockReceivedMessages = [];
    mockValidationState = { isValid: true, errors: [] };
    mockOutputChannelLines = [];
    mockParseErrorListeners.length = 0;
    mockStdoutEventListeners.length = 0;
    mockDynamoDbEventListeners.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Test 3.1.1: Subscription to StdoutEventParser.onEvent adds entries to log
  describe('Event Subscription', () => {
    it('should subscribe to StdoutEventParser.onEvent and add entries to log', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const provider = new DemoViewerPanelProvider(extensionUri);
      const mockView = createMockWebviewView();

      await provider.resolveWebviewView(
        mockView,
        {} as vscode.WebviewViewResolveContext,
        { isCancellationRequested: false } as vscode.CancellationToken
      );

      // Verify subscription was set up
      expect(mockStdoutEventListeners.length).toBeGreaterThan(0);

      // Simulate a node_start event from stdout
      const nodeStartEvent: MergedEvent<NodeStartEvent> = {
        source: 'stdout',
        event: {
          type: 'node_start',
          workflow_id: 'wf-123',
          timestamp: Date.now(),
          node_id: 'planner-agent',
        },
      };

      simulateStdoutEvent(nodeStartEvent);

      // Wait for debounce
      vi.advanceTimersByTime(60);

      // Check that entry was added to log
      expect(provider.logPanelState.entries.length).toBeGreaterThan(0);
      expect(provider.logPanelState.entries[0].eventType).toBe('node_start');
    });

    // Test 3.1.2: Subscription to DynamoDbPollingService.onEvent adds entries to log
    it('should subscribe to DynamoDbPollingService.onEvent and add entries to log', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const provider = new DemoViewerPanelProvider(extensionUri);
      const mockView = createMockWebviewView();

      await provider.resolveWebviewView(
        mockView,
        {} as vscode.WebviewViewResolveContext,
        { isCancellationRequested: false } as vscode.CancellationToken
      );

      // Verify DynamoDB subscription was set up
      expect(mockDynamoDbEventListeners.length).toBeGreaterThan(0);

      // Simulate a tool_call event from DynamoDB
      const toolCallEvent: ToolCallEvent = {
        event_type: 'tool_call',
        workflow_id: 'wf-123',
        timestamp: Date.now(),
        agent_name: 'planner',
        system: 'SAP S/4HANA',
        operation: 'get_inventory',
        input: { product_id: 'ABC123' },
        status: 'completed',
      };

      simulateDynamoDbEvent(toolCallEvent);

      // Wait for debounce
      vi.advanceTimersByTime(60);

      // Check that entry was added to log
      expect(provider.logPanelState.entries.length).toBeGreaterThan(0);
      expect(provider.logPanelState.entries[0].eventType).toBe('tool_call');
    });
  });

  // Test 3.1.3: 50ms debounce batches rapid events correctly
  describe('Debounce Batching', () => {
    it('should batch rapid events with 50ms debounce correctly', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const provider = new DemoViewerPanelProvider(extensionUri);
      const mockView = createMockWebviewView();

      await provider.resolveWebviewView(
        mockView,
        {} as vscode.WebviewViewResolveContext,
        { isCancellationRequested: false } as vscode.CancellationToken
      );

      const baseTimestamp = Date.now();

      // Simulate rapid burst of events
      for (let i = 0; i < 5; i++) {
        const event: MergedEvent<NodeStartEvent> = {
          source: 'stdout',
          event: {
            type: 'node_start',
            workflow_id: 'wf-123',
            timestamp: baseTimestamp + i * 10,
            node_id: `agent-${i}`,
          },
        };
        simulateStdoutEvent(event);
        vi.advanceTimersByTime(10); // 10ms between events
      }

      // Events should not be flushed yet (debounce timer resets each time)
      expect(provider.logPanelState.entries.length).toBe(0);

      // Advance past debounce threshold
      vi.advanceTimersByTime(60);

      // Now all events should be flushed in a single batch
      expect(provider.logPanelState.entries.length).toBe(5);
    });
  });

  // Test 3.1.4: Events sorted by timestamp after merge
  describe('Event Sorting', () => {
    it('should sort events by timestamp after merge', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const provider = new DemoViewerPanelProvider(extensionUri);
      const mockView = createMockWebviewView();

      await provider.resolveWebviewView(
        mockView,
        {} as vscode.WebviewViewResolveContext,
        { isCancellationRequested: false } as vscode.CancellationToken
      );

      const baseTimestamp = 1000000;

      // Send events in non-chronological order
      const event3: MergedEvent<NodeStartEvent> = {
        source: 'stdout',
        event: {
          type: 'node_start',
          workflow_id: 'wf-123',
          timestamp: baseTimestamp + 300,
          node_id: 'agent-3',
        },
      };

      const event1: MergedEvent<NodeStartEvent> = {
        source: 'stdout',
        event: {
          type: 'node_start',
          workflow_id: 'wf-123',
          timestamp: baseTimestamp + 100,
          node_id: 'agent-1',
        },
      };

      const event2: MergedEvent<NodeStartEvent> = {
        source: 'stdout',
        event: {
          type: 'node_start',
          workflow_id: 'wf-123',
          timestamp: baseTimestamp + 200,
          node_id: 'agent-2',
        },
      };

      // Send in non-sorted order
      simulateStdoutEvent(event3);
      simulateStdoutEvent(event1);
      simulateStdoutEvent(event2);

      // Wait for debounce
      vi.advanceTimersByTime(60);

      // Entries should be sorted by timestamp ascending
      expect(provider.logPanelState.entries.length).toBe(3);
      expect(provider.logPanelState.entries[0].agentName).toBe('agent-1');
      expect(provider.logPanelState.entries[1].agentName).toBe('agent-2');
      expect(provider.logPanelState.entries[2].agentName).toBe('agent-3');
    });
  });

  // Test 3.1.5: workflow_complete from stdout triggers setOutcomeSuccess()
  describe('Outcome Panel Triggers', () => {
    it('should trigger setOutcomeSuccess on workflow_complete from stdout', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const provider = new DemoViewerPanelProvider(extensionUri);
      const mockView = createMockWebviewView();

      await provider.resolveWebviewView(
        mockView,
        {} as vscode.WebviewViewResolveContext,
        { isCancellationRequested: false } as vscode.CancellationToken
      );

      // Simulate workflow_complete event from stdout
      const completeEvent: MergedEvent<WorkflowCompleteEvent> = {
        source: 'stdout',
        event: {
          type: 'workflow_complete',
          workflow_id: 'wf-123',
          timestamp: Date.now(),
          status: 'completed',
          execution_time_ms: 5000,
          execution_order: ['agent-1', 'agent-2'],
          result: 'Test result markdown',
          sources: ['SAP', 'Databricks'],
        },
      };

      simulateStdoutEvent(completeEvent);

      // Wait for debounce
      vi.advanceTimersByTime(60);

      // Check outcome panel state
      expect(provider.outcomePanelState.status).toBe('success');
      expect(provider.outcomePanelState.result).toBe('Test result markdown');
      expect(provider.outcomePanelState.sources).toEqual(['SAP', 'Databricks']);
    });

    // Test 3.1.6: workflow_error from stdout triggers setOutcomeError()
    it('should trigger setOutcomeError on workflow_error from stdout', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const provider = new DemoViewerPanelProvider(extensionUri);
      const mockView = createMockWebviewView();

      await provider.resolveWebviewView(
        mockView,
        {} as vscode.WebviewViewResolveContext,
        { isCancellationRequested: false } as vscode.CancellationToken
      );

      // Simulate workflow_error event from stdout
      const errorEvent: MergedEvent<WorkflowErrorEvent> = {
        source: 'stdout',
        event: {
          type: 'workflow_error',
          workflow_id: 'wf-123',
          timestamp: Date.now(),
          error_message: 'Something went wrong',
          error_code: 'ERR_001',
        },
      };

      simulateStdoutEvent(errorEvent);

      // Wait for debounce
      vi.advanceTimersByTime(60);

      // Check outcome panel state
      expect(provider.outcomePanelState.status).toBe('error');
      expect(provider.outcomePanelState.errorMessage).toBe('Something went wrong');
      expect(provider.outcomePanelState.errorCode).toBe('ERR_001');
    });
  });

  // Test 3.1.7: graph_structure stored but not added to log
  describe('Phase 3 Event Storage', () => {
    it('should store graph_structure but not add to log', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const provider = new DemoViewerPanelProvider(extensionUri);
      const mockView = createMockWebviewView();

      await provider.resolveWebviewView(
        mockView,
        {} as vscode.WebviewViewResolveContext,
        { isCancellationRequested: false } as vscode.CancellationToken
      );

      // Simulate graph_structure event
      const graphEvent: MergedEvent<GraphStructureEvent> = {
        source: 'stdout',
        event: {
          type: 'graph_structure',
          workflow_id: 'wf-123',
          timestamp: Date.now(),
          nodes: [
            { id: 'node-1', name: 'Planner', role: 'planning' },
            { id: 'node-2', name: 'Executor', role: 'execution' },
          ],
          edges: [{ from: 'node-1', to: 'node-2' }],
          entry_points: ['node-1'],
        },
      };

      simulateStdoutEvent(graphEvent);

      // Wait for debounce
      vi.advanceTimersByTime(60);

      // Log should be empty (graph_structure is not displayed)
      expect(provider.logPanelState.entries.length).toBe(0);

      // But graph structure should be stored for Phase 3
      expect(provider.graphStructure).not.toBeNull();
      expect(provider.graphStructure?.nodes).toHaveLength(2);
    });

    // Test 3.1.8: node_stream stored but not added to log
    it('should store node_stream but not add to log', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const provider = new DemoViewerPanelProvider(extensionUri);
      const mockView = createMockWebviewView();

      await provider.resolveWebviewView(
        mockView,
        {} as vscode.WebviewViewResolveContext,
        { isCancellationRequested: false } as vscode.CancellationToken
      );

      // Simulate node_stream events
      const streamEvent1: MergedEvent<NodeStreamEvent> = {
        source: 'stdout',
        event: {
          type: 'node_stream',
          workflow_id: 'wf-123',
          timestamp: Date.now(),
          node_id: 'agent-1',
          data: 'Hello ',
        },
      };

      const streamEvent2: MergedEvent<NodeStreamEvent> = {
        source: 'stdout',
        event: {
          type: 'node_stream',
          workflow_id: 'wf-123',
          timestamp: Date.now() + 10,
          node_id: 'agent-1',
          data: 'World!',
        },
      };

      simulateStdoutEvent(streamEvent1);
      simulateStdoutEvent(streamEvent2);

      // Wait for debounce
      vi.advanceTimersByTime(60);

      // Log should be empty (node_stream is not displayed)
      expect(provider.logPanelState.entries.length).toBe(0);

      // But stream buffer should have accumulated data
      expect(provider.nodeStreamBuffer.get('agent-1')).toBe('Hello World!');
    });
  });

  describe('Subscription Disposal', () => {
    it('should properly dispose subscriptions on panel close', async () => {
      const extensionUri = vscode.Uri.file('/test/extension');
      const provider = new DemoViewerPanelProvider(extensionUri);
      const mockView = createMockWebviewView();

      await provider.resolveWebviewView(
        mockView,
        {} as vscode.WebviewViewResolveContext,
        { isCancellationRequested: false } as vscode.CancellationToken
      );

      // Verify subscriptions exist
      const initialStdoutListeners = mockStdoutEventListeners.length;
      const initialDynamoDbListeners = mockDynamoDbEventListeners.length;
      expect(initialStdoutListeners).toBeGreaterThan(0);
      expect(initialDynamoDbListeners).toBeGreaterThan(0);

      // Dispose the provider
      provider.dispose();

      // Subscriptions should be cleaned up
      expect(mockStdoutEventListeners.length).toBeLessThan(initialStdoutListeners);
      expect(mockDynamoDbEventListeners.length).toBeLessThan(initialDynamoDbListeners);
    });
  });
});

// ============================================================================
// Task Group 4: Parse Error Logging Tests
// ============================================================================

describe('Demo Viewer Panel - Parse Error Logging (Task Group 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsInitialized = true;
    mockWebviewHtml = '';
    mockReceivedMessages = [];
    mockClipboardText = '';
    mockValidationState = { isValid: true, errors: [] };
    mockOutputChannelLines = [];
    mockParseErrorListeners.length = 0;
    mockStdoutEventListeners.length = 0;
    mockDynamoDbEventListeners.length = 0;
  });

  // Test 4.1.1: Parse errors are logged to Output channel
  it('should log parse errors to Output channel', async () => {
    const extensionUri = vscode.Uri.file('/test/extension');
    const provider = new DemoViewerPanelProvider(extensionUri);
    const mockView = createMockWebviewView();

    await provider.resolveWebviewView(
      mockView,
      {} as vscode.WebviewViewResolveContext,
      { isCancellationRequested: false } as vscode.CancellationToken
    );

    // Verify Output channel was created with correct name
    expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('Agentify');

    // Simulate a parse error from StdoutEventParser
    const testError = new Error('Unexpected token');
    const rawData = '{invalid json data';
    simulateParseError(testError, rawData);

    // Verify error was logged to Output channel
    expect(mockOutputChannel.appendLine).toHaveBeenCalled();
    expect(mockOutputChannelLines.length).toBeGreaterThan(0);
    expect(mockOutputChannelLines[0]).toContain('[StdoutEventParser]');
    expect(mockOutputChannelLines[0]).toContain('Malformed JSON');
  });

  // Test 4.1.2: Log format includes truncated rawData
  it('should log parse errors with correct format: [StdoutEventParser] Malformed JSON: {truncated rawData}...', async () => {
    const extensionUri = vscode.Uri.file('/test/extension');
    const provider = new DemoViewerPanelProvider(extensionUri);
    const mockView = createMockWebviewView();

    await provider.resolveWebviewView(
      mockView,
      {} as vscode.WebviewViewResolveContext,
      { isCancellationRequested: false } as vscode.CancellationToken
    );

    // Simulate parse error with long raw data (over 100 chars)
    const longRawData = '{' + 'a'.repeat(150) + '}';
    simulateParseError(new Error('Parse error'), longRawData);

    // Verify log format and truncation
    const logLine = mockOutputChannelLines[0];
    expect(logLine).toMatch(/^\[StdoutEventParser\] Malformed JSON: /);
    expect(logLine).toContain('...');
    // Raw data should be truncated to 100 characters
    expect(logLine.length).toBeLessThanOrEqual('[StdoutEventParser] Malformed JSON: '.length + 100 + 3);
  });

  // Test 4.1.3: Parse errors do NOT appear in UI log panel
  it('should NOT add parse errors to UI log panel (keep demo experience clean)', async () => {
    const extensionUri = vscode.Uri.file('/test/extension');
    const provider = new DemoViewerPanelProvider(extensionUri);
    const mockView = createMockWebviewView();

    await provider.resolveWebviewView(
      mockView,
      {} as vscode.WebviewViewResolveContext,
      { isCancellationRequested: false } as vscode.CancellationToken
    );

    // Get initial log panel state
    const initialEntryCount = provider.logPanelState.entries.length;

    // Simulate multiple parse errors
    simulateParseError(new Error('Error 1'), '{bad json 1');
    simulateParseError(new Error('Error 2'), '{bad json 2');
    simulateParseError(new Error('Error 3'), '{bad json 3');

    // Verify no entries were added to log panel
    expect(provider.logPanelState.entries.length).toBe(initialEntryCount);

    // But verify errors were logged to Output channel
    expect(mockOutputChannelLines.length).toBe(3);
  });
});
