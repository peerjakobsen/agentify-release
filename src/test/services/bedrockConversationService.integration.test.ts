/**
 * Tests for BedrockConversationService Integration
 *
 * Task Group 6: Service Exports and Extension Integration
 * Tests for service exports, lifecycle, and re-initialization
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
vi.mock('../../services/configService', () => ({
  getConfigService: vi.fn(() => ({
    getConfig: vi.fn(() =>
      Promise.resolve({
        infrastructure: {
          dynamodb: {
            region: 'us-east-1',
          },
        },
      })
    ),
  })),
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
} as unknown as vscode.ExtensionContext);

describe('Task Group 6: Service Integration', () => {
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

  describe('service accessibility via exported factory functions', () => {
    it('getBedrockConversationService returns service instance', () => {
      const service = getBedrockConversationService(mockContext);

      expect(service).toBeInstanceOf(BedrockConversationService);
      expect(service).toBeDefined();
    });

    it('exported class type is available for typing', () => {
      const service: BedrockConversationService = getBedrockConversationService(mockContext);

      // Verify it has the expected public interface
      expect(typeof service.onToken).toBe('function');
      expect(typeof service.onComplete).toBe('function');
      expect(typeof service.onError).toBe('function');
      expect(typeof service.sendMessage).toBe('function');
      expect(typeof service.resetConversation).toBe('function');
      expect(typeof service.dispose).toBe('function');
    });
  });

  describe('service cleanup in extension deactivation', () => {
    it('resetBedrockConversationService() disposes service', () => {
      const service = getBedrockConversationService(mockContext);

      // Get reference to emitters before reset
      const tokenEmitter = (service as unknown as { _onToken: { dispose: ReturnType<typeof vi.fn> } })._onToken;

      // Simulate deactivation
      resetBedrockConversationService();

      // Verify dispose was called
      expect(tokenEmitter.dispose).toHaveBeenCalled();
    });

    it('service is no longer available after reset', () => {
      const service1 = getBedrockConversationService(mockContext);

      // Reset (simulating deactivation)
      resetBedrockConversationService();

      // Getting service again creates a new instance
      const service2 = getBedrockConversationService(mockContext);

      expect(service1).not.toBe(service2);
    });
  });

  describe('re-initialization after reset', () => {
    it('works correctly after reset', () => {
      // First initialization
      const service1 = getBedrockConversationService(mockContext);
      expect(service1).toBeInstanceOf(BedrockConversationService);

      // Reset
      resetBedrockConversationService();

      // Re-initialize with new context
      const newContext = createMockContext();
      const service2 = getBedrockConversationService(newContext);

      // Should be a fresh instance
      expect(service2).toBeInstanceOf(BedrockConversationService);
      expect(service2).not.toBe(service1);

      // Should have clean state
      const history = (service2 as unknown as { _conversationHistory: unknown[] })._conversationHistory;
      expect(history).toHaveLength(0);
    });
  });
});
