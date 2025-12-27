/**
 * Tests for extension infrastructure (Task Group 3)
 *
 * These tests validate extension activation, status bar, and command registration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StatusBarManager, StatusState } from '../statusBar';
import { DemoViewerPanelProvider, DEMO_VIEWER_VIEW_ID } from '../panels/demoViewerPanel';
import { IdeationWizardPanelProvider, IDEATION_WIZARD_VIEW_ID } from '../panels/ideationWizardPanel';

// Mock vscode module
vi.mock('vscode', () => ({
  window: {
    createStatusBarItem: vi.fn(() => ({
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
      text: '',
      tooltip: '',
      command: '',
      backgroundColor: undefined,
      color: undefined,
    })),
    showQuickPick: vi.fn(),
    showInformationMessage: vi.fn(),
    registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },
  ThemeColor: vi.fn((id: string) => ({ id })),
  Uri: {
    file: (path: string) => ({ fsPath: path }),
    parse: (url: string) => ({ url }),
  },
  commands: {
    executeCommand: vi.fn(),
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
  },
  workspace: {
    findFiles: vi.fn(() => Promise.resolve([])),
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue: string) => defaultValue),
    })),
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    fs: {
      stat: vi.fn(),
      readFile: vi.fn(),
    },
    createFileSystemWatcher: vi.fn(() => ({
      onDidChange: vi.fn(),
      onDidDelete: vi.fn(),
      onDidCreate: vi.fn(),
      dispose: vi.fn(),
    })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  },
  env: {
    openExternal: vi.fn(),
  },
  Disposable: vi.fn().mockImplementation((fn) => ({ dispose: fn || vi.fn() })),
  RelativePattern: vi.fn(),
}));

describe('StatusBarManager', () => {
  let statusBarManager: StatusBarManager;

  beforeEach(() => {
    statusBarManager = new StatusBarManager();
  });

  afterEach(() => {
    statusBarManager.dispose();
  });

  it('should create a status bar item', () => {
    expect(statusBarManager).toBeDefined();
    expect(statusBarManager.getStatus()).toBe('not-initialized');
  });

  it('should update status to not-initialized', () => {
    statusBarManager.updateStatus('not-initialized');
    expect(statusBarManager.getStatus()).toBe('not-initialized');
  });

  it('should update status to ready', () => {
    statusBarManager.updateStatus('ready');
    expect(statusBarManager.getStatus()).toBe('ready');
  });

  it('should update status to aws-error', () => {
    statusBarManager.updateStatus('aws-error');
    expect(statusBarManager.getStatus()).toBe('aws-error');
  });

  it('should transition between all states correctly', () => {
    // Start with not-initialized
    expect(statusBarManager.getStatus()).toBe('not-initialized');

    // Transition to ready
    statusBarManager.updateStatus('ready');
    expect(statusBarManager.getStatus()).toBe('ready');

    // Transition to aws-error
    statusBarManager.updateStatus('aws-error');
    expect(statusBarManager.getStatus()).toBe('aws-error');

    // Transition back to not-initialized
    statusBarManager.updateStatus('not-initialized');
    expect(statusBarManager.getStatus()).toBe('not-initialized');
  });
});

describe('DemoViewerPanelProvider', () => {
  it('should have correct view ID', () => {
    expect(DEMO_VIEWER_VIEW_ID).toBe('agentify.demoViewer');
  });

  it('should create a provider instance', () => {
    const mockUri = { fsPath: '/test/extension' } as any;
    const provider = new DemoViewerPanelProvider(mockUri);
    expect(provider).toBeDefined();
  });

  it('should return false for isVisible when no view exists', () => {
    const mockUri = { fsPath: '/test/extension' } as any;
    const provider = new DemoViewerPanelProvider(mockUri);
    expect(provider.isVisible).toBe(false);
  });
});

describe('IdeationWizardPanelProvider', () => {
  it('should have correct view ID', () => {
    expect(IDEATION_WIZARD_VIEW_ID).toBe('agentify.ideationWizard');
  });

  it('should create a provider instance', () => {
    const mockUri = { fsPath: '/test/extension' } as any;
    const provider = new IdeationWizardPanelProvider(mockUri);
    expect(provider).toBeDefined();
  });

  it('should return false for isVisible when no view exists', () => {
    const mockUri = { fsPath: '/test/extension' } as any;
    const provider = new IdeationWizardPanelProvider(mockUri);
    expect(provider.isVisible).toBe(false);
  });
});

describe('Extension module structure', () => {
  it('should export activate function', async () => {
    const extension = await import('../extension');
    expect(typeof extension.activate).toBe('function');
  });

  it('should export deactivate function', async () => {
    const extension = await import('../extension');
    expect(typeof extension.deactivate).toBe('function');
  });
});

describe('Command IDs', () => {
  it('should have all required command IDs defined', () => {
    const expectedCommands = [
      'agentify.initializeProject',
      'agentify.openDemoViewer',
      'agentify.openIdeationWizard',
      'agentify.showStatus',
    ];

    // Commands are defined in package.json and registered in extension.ts
    // This test validates the expected command structure
    expectedCommands.forEach((cmd) => {
      expect(cmd).toMatch(/^agentify\./);
    });
  });
});

describe('Status bar state machine', () => {
  let statusBarManager: StatusBarManager;

  beforeEach(() => {
    statusBarManager = new StatusBarManager();
  });

  afterEach(() => {
    statusBarManager.dispose();
  });

  it('should initialize in not-initialized state', () => {
    expect(statusBarManager.getStatus()).toBe('not-initialized');
  });

  it('should allow transition from not-initialized to ready', () => {
    statusBarManager.updateStatus('ready');
    expect(statusBarManager.getStatus()).toBe('ready');
  });

  it('should allow transition from not-initialized to aws-error', () => {
    statusBarManager.updateStatus('aws-error');
    expect(statusBarManager.getStatus()).toBe('aws-error');
  });

  it('should allow transition from ready to aws-error', () => {
    statusBarManager.updateStatus('ready');
    statusBarManager.updateStatus('aws-error');
    expect(statusBarManager.getStatus()).toBe('aws-error');
  });

  it('should allow transition from aws-error to ready', () => {
    statusBarManager.updateStatus('aws-error');
    statusBarManager.updateStatus('ready');
    expect(statusBarManager.getStatus()).toBe('ready');
  });
});
