/**
 * Tests for BedrockConversationService Core Functionality
 *
 * Task Group 3: BedrockConversationService Core
 * Tests for singleton pattern, EventEmitters, conversation history, and configuration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock vscode module
vi.mock('vscode', () => {
  const createMockEventEmitter = () => {
    const listeners: Array<(data: unknown) => void> = [];
    return {
      event: (listener: (data: unknown) => void) => {
        listeners.push(listener);
        return { dispose: () => listeners.splice(listeners.indexOf(listener), 1) };
      },
      fire: (data: unknown) => listeners.forEach((l) => l(data)),
      dispose: vi.fn(),
      _listeners: listeners,
    };
  };

  const mockReadFile = vi.fn();

  return {
    EventEmitter: vi.fn().mockImplementation(createMockEventEmitter),
    Disposable: vi.fn().mockImplementation((fn) => ({ dispose: fn })),
    workspace: {
      fs: {
        readFile: mockReadFile,
      },
      workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    },
    Uri: {
      joinPath: (...args: unknown[]) => {
        const paths = args.map((arg) => (typeof arg === 'string' ? arg : (arg as { fsPath: string }).fsPath || ''));
        return { fsPath: paths.join('/') };
      },
      file: (path: string) => ({ fsPath: path }),
    },
    _mockReadFile: mockReadFile,
  };
});

// Mock config service
const mockConfigService = {
  getConfig: vi.fn(() =>
    Promise.resolve({
      infrastructure: {
        dynamodb: {
          region: 'us-east-1',
        },
      },
      bedrock: {
        modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
      },
    })
  ),
};

vi.mock('../../services/configService', () => ({
  getConfigService: vi.fn(() => mockConfigService),
}));

// Mock Bedrock client
vi.mock('../../services/bedrockClient', () => ({
  getBedrockClientAsync: vi.fn(() => Promise.resolve({
    send: vi.fn(),
  })),
}));

import * as vscode from 'vscode';
import {
  getBedrockConversationService,
  resetBedrockConversationService,
  BedrockConversationService,
} from '../../services/bedrockConversationService';

// Access the mock functions
const getMockReadFile = () => (vscode as unknown as { _mockReadFile: ReturnType<typeof vi.fn> })._mockReadFile;

// Create mock extension context
const createMockContext = (): vscode.ExtensionContext => ({
  extensionUri: { fsPath: '/test/extension' } as vscode.Uri,
  subscriptions: [],
  workspaceState: {} as vscode.Memento,
  globalState: {} as vscode.Memento & { setKeysForSync: (keys: readonly string[]) => void },
  secrets: {} as vscode.SecretStorage,
  extensionPath: '/test/extension',
  storagePath: '/test/storage',
  globalStoragePath: '/test/global-storage',
  logPath: '/test/log',
  extensionMode: 1,
  storageUri: undefined,
  globalStorageUri: undefined,
  logUri: undefined,
  asAbsolutePath: (relativePath: string) => `/test/extension/${relativePath}`,
  environmentVariableCollection: {} as vscode.GlobalEnvironmentVariableCollection,
  extension: {} as vscode.Extension<unknown>,
  languageModelAccessInformation: {} as vscode.LanguageModelAccessInformation,
} as unknown as vscode.ExtensionContext);

describe('Task Group 3: BedrockConversationService Core', () => {
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    resetBedrockConversationService();
    mockContext = createMockContext();

    // Setup default mock for readFile
    const mockReadFile = getMockReadFile();
    mockReadFile.mockResolvedValue(
      new Uint8Array(Buffer.from('# Test System Prompt', 'utf-8'))
    );
  });

  afterEach(() => {
    resetBedrockConversationService();
  });

  describe('singleton pattern', () => {
    it('returns same instance from getBedrockConversationService(context)', () => {
      const service1 = getBedrockConversationService(mockContext);
      const service2 = getBedrockConversationService(mockContext);

      expect(service1).toBe(service2);
      expect(service1).toBeInstanceOf(BedrockConversationService);
    });

    it('resetBedrockConversationService() clears the singleton instance', () => {
      const service1 = getBedrockConversationService(mockContext);
      resetBedrockConversationService();
      const service2 = getBedrockConversationService(mockContext);

      expect(service1).not.toBe(service2);
    });
  });

  describe('dispose()', () => {
    it('cleans up EventEmitters and clears history', () => {
      const service = getBedrockConversationService(mockContext);

      // Add some conversation history using the internal method
      (service as unknown as { _appendUserMessage: (msg: string) => void })._appendUserMessage('test');

      // Dispose the service
      service.dispose();

      // Verify EventEmitters are disposed
      const tokenEmitter = (service as unknown as { _onToken: { dispose: ReturnType<typeof vi.fn> } })._onToken;
      const completeEmitter = (service as unknown as { _onComplete: { dispose: ReturnType<typeof vi.fn> } })._onComplete;
      const errorEmitter = (service as unknown as { _onError: { dispose: ReturnType<typeof vi.fn> } })._onError;

      expect(tokenEmitter.dispose).toHaveBeenCalled();
      expect(completeEmitter.dispose).toHaveBeenCalled();
      expect(errorEmitter.dispose).toHaveBeenCalled();
    });
  });

  describe('conversation history management', () => {
    it('appends user message to history', () => {
      const service = getBedrockConversationService(mockContext);

      (service as unknown as { _appendUserMessage: (msg: string) => void })._appendUserMessage('Hello, Claude!');

      const history = (service as unknown as { _conversationHistory: Array<{ role: string; content: Array<{ text: string }> }> })._conversationHistory;
      expect(history).toHaveLength(1);
      expect(history[0].role).toBe('user');
      expect(history[0].content[0].text).toBe('Hello, Claude!');
    });

    it('appends assistant response to history', () => {
      const service = getBedrockConversationService(mockContext);

      (service as unknown as { _appendAssistantMessage: (msg: string) => void })._appendAssistantMessage('Hello! How can I help?');

      const history = (service as unknown as { _conversationHistory: Array<{ role: string; content: Array<{ text: string }> }> })._conversationHistory;
      expect(history).toHaveLength(1);
      expect(history[0].role).toBe('assistant');
      expect(history[0].content[0].text).toBe('Hello! How can I help?');
    });
  });

  describe('resetConversation()', () => {
    it('clears conversation history', () => {
      const service = getBedrockConversationService(mockContext);

      // Add messages
      (service as unknown as { _appendUserMessage: (msg: string) => void })._appendUserMessage('Hello');
      (service as unknown as { _appendAssistantMessage: (msg: string) => void })._appendAssistantMessage('Hi');

      // Reset
      service.resetConversation();

      const history = (service as unknown as { _conversationHistory: Array<{ role: string; content: Array<{ text: string }> }> })._conversationHistory;
      expect(history).toHaveLength(0);
    });
  });

  describe('system prompt loading', () => {
    it('loads and caches system prompt', async () => {
      const mockReadFile = getMockReadFile();
      const expectedPrompt = '# Ideation Assistant\n\nYou are an assistant...';
      mockReadFile.mockResolvedValueOnce(
        new Uint8Array(Buffer.from(expectedPrompt, 'utf-8'))
      );

      const service = getBedrockConversationService(mockContext);

      // Load prompt first time
      const prompt1 = await (service as unknown as { _loadSystemPrompt: () => Promise<string> })._loadSystemPrompt();
      expect(prompt1).toBe(expectedPrompt);

      // Load prompt second time (should be cached)
      const prompt2 = await (service as unknown as { _loadSystemPrompt: () => Promise<string> })._loadSystemPrompt();
      expect(prompt2).toBe(expectedPrompt);

      // Should only have called readFile once due to caching
      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('model ID resolution', () => {
    it('resolves model ID from config with fallback to default', async () => {
      const service = getBedrockConversationService(mockContext);

      const modelId = await (service as unknown as { _getModelId: () => Promise<string> })._getModelId();

      expect(modelId).toBe('global.anthropic.claude-sonnet-4-5-20250929-v1:0');
    });

    it('uses default model ID when config has no bedrock section', async () => {
      mockConfigService.getConfig.mockResolvedValueOnce({
        infrastructure: {
          dynamodb: {
            region: 'us-east-1',
          },
        },
      });

      const service = getBedrockConversationService(mockContext);

      const modelId = await (service as unknown as { _getModelId: () => Promise<string> })._getModelId();

      expect(modelId).toBe('global.anthropic.claude-sonnet-4-5-20250929-v1:0');
    });
  });
});
