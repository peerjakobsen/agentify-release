/**
 * End-to-End Tests for BedrockConversationService
 *
 * Task Group 7: Test Review and Gap Analysis
 * Additional strategic tests for end-to-end workflows and edge cases
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
const mockSend = vi.fn();
vi.mock('../../services/bedrockClient', () => ({
  getBedrockClientAsync: vi.fn(() => Promise.resolve({
    send: mockSend,
  })),
}));

import * as vscode from 'vscode';
import {
  getBedrockConversationService,
  resetBedrockConversationService,
} from '../../services/bedrockConversationService';

// Access the mock functions
const getMockReadFile = () => (vscode as unknown as { _mockReadFile: ReturnType<typeof vi.fn> })._mockReadFile;

// Create mock extension context
const createMockContext = (): vscode.ExtensionContext => ({
  extensionUri: { fsPath: '/test/extension' } as vscode.Uri,
  subscriptions: [],
} as unknown as vscode.ExtensionContext);

// Helper to create mock stream events
function* createMockStream(tokens: string[]) {
  for (const token of tokens) {
    yield {
      contentBlockDelta: {
        delta: {
          text: token,
        },
      },
    };
  }
  yield {
    messageStop: {
      stopReason: 'end_turn',
    },
  };
}

describe('Task Group 7: End-to-End and Gap Tests', () => {
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

  describe('end-to-end multi-turn conversation', () => {
    it('maintains conversation context across multiple messages', async () => {
      // First response
      mockSend.mockResolvedValueOnce({
        stream: createMockStream(['Hello!', ' ', 'How', ' ', 'can', ' ', 'I', ' ', 'help?']),
      });

      // Second response
      mockSend.mockResolvedValueOnce({
        stream: createMockStream(['Based', ' ', 'on', ' ', 'our', ' ', 'conversation...']),
      });

      const service = getBedrockConversationService(mockContext);

      // First message
      const tokens1: string[] = [];
      for await (const token of service.sendMessage('Hello, Claude!')) {
        tokens1.push(token);
      }
      expect(tokens1.join('')).toBe('Hello! How can I help?');

      // Second message
      const tokens2: string[] = [];
      for await (const token of service.sendMessage('What about X?')) {
        tokens2.push(token);
      }
      expect(tokens2.join('')).toBe('Based on our conversation...');

      // Check conversation history has all 4 messages
      const history = (service as unknown as { _conversationHistory: Array<{ role: string; content: Array<{ text: string }> }> })._conversationHistory;
      expect(history).toHaveLength(4);
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
      expect(history[2].role).toBe('user');
      expect(history[3].role).toBe('assistant');
    });
  });

  describe('concurrent message handling', () => {
    it('rejects concurrent sendMessage calls while streaming', async () => {
      // Slow response that never finishes during test
      const slowGenerator = async function* () {
        yield { contentBlockDelta: { delta: { text: 'Starting...' } } };
        // This will hang during the test
        await new Promise(() => {});
      };

      mockSend.mockResolvedValueOnce({
        stream: slowGenerator(),
      });

      const service = getBedrockConversationService(mockContext);
      let errorReceived: unknown = null;

      service.onError((error) => {
        errorReceived = error;
      });

      // Start first message (won't complete)
      const firstMessage = service.sendMessage('First message');

      // Get first token to ensure streaming started
      const firstIterator = firstMessage[Symbol.asyncIterator]();
      await firstIterator.next();

      // Try to send second message while first is still streaming
      try {
        const secondMessage = service.sendMessage('Second message');
        await secondMessage[Symbol.asyncIterator]().next();
      } catch {
        // Expected to throw
      }

      expect(errorReceived).not.toBeNull();
      expect((errorReceived as { code: string }).code).toBe('BEDROCK_INVALID_REQUEST');
    });
  });

  describe('event subscription lifecycle', () => {
    it('allows unsubscription from events', async () => {
      mockSend.mockResolvedValueOnce({
        stream: createMockStream(['Token1', 'Token2', 'Token3']),
      });

      const service = getBedrockConversationService(mockContext);
      const receivedTokens: string[] = [];

      // Subscribe to token events
      const subscription = service.onToken((token) => {
        receivedTokens.push(token);
      });

      // Unsubscribe immediately
      subscription.dispose();

      // Send message
      for await (const _token of service.sendMessage('Test')) {
        // consume
      }

      // Should not have received any tokens since we unsubscribed
      expect(receivedTokens).toHaveLength(0);
    });
  });

  describe('conversation reset during session', () => {
    it('clears history and allows fresh start', async () => {
      // First message response
      mockSend.mockResolvedValueOnce({
        stream: createMockStream(['Response 1']),
      });

      // Second message response (after reset)
      mockSend.mockResolvedValueOnce({
        stream: createMockStream(['Response 2']),
      });

      const service = getBedrockConversationService(mockContext);

      // Send first message
      for await (const _token of service.sendMessage('Message 1')) {
        // consume
      }

      // Verify history has messages
      let history = (service as unknown as { _conversationHistory: Array<unknown> })._conversationHistory;
      expect(history.length).toBeGreaterThan(0);

      // Reset conversation
      service.resetConversation();

      // Verify history is cleared
      history = (service as unknown as { _conversationHistory: Array<unknown> })._conversationHistory;
      expect(history).toHaveLength(0);

      // Send new message
      for await (const _token of service.sendMessage('Message 2')) {
        // consume
      }

      // Should only have the new conversation
      history = (service as unknown as { _conversationHistory: Array<unknown> })._conversationHistory;
      expect(history).toHaveLength(2); // user + assistant
    });
  });

  describe('model not available error handling', () => {
    it('handles ModelNotReadyException with informative error', async () => {
      const modelError = new Error('Model not ready');
      (modelError as Error & { name: string }).name = 'ModelNotReadyException';

      mockSend.mockRejectedValueOnce(modelError);

      const service = getBedrockConversationService(mockContext);
      let receivedError: unknown = null;

      service.onError((error) => {
        receivedError = error;
      });

      try {
        for await (const _token of service.sendMessage('Test')) {
          // consume
        }
      } catch {
        // Expected
      }

      expect(receivedError).not.toBeNull();
      expect((receivedError as { code: string }).code).toBe('BEDROCK_MODEL_NOT_AVAILABLE');
      expect((receivedError as { message: string }).message).toContain('global.anthropic.claude-sonnet-4-5-20250929-v1:0');
    });
  });

  describe('empty response handling', () => {
    it('handles empty stream gracefully', async () => {
      // Stream with no content blocks, just messageStop
      mockSend.mockResolvedValueOnce({
        stream: (function* () {
          yield { messageStop: { stopReason: 'end_turn' } };
        })(),
      });

      const service = getBedrockConversationService(mockContext);
      const tokens: string[] = [];
      let completeResponse = '';

      service.onComplete((response) => {
        completeResponse = response;
      });

      for await (const token of service.sendMessage('Test')) {
        tokens.push(token);
      }

      // Should handle empty response without errors
      expect(tokens).toHaveLength(0);
      expect(completeResponse).toBe('');
    });
  });
});
