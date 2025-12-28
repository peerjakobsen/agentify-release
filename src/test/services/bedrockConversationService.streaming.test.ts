/**
 * Tests for BedrockConversationService Converse API Streaming
 *
 * Task Group 4: Converse API Integration
 * Tests for streaming response handling, events, and error handling
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

describe('Task Group 4: Converse API Streaming', () => {
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

  describe('sendMessage() yields tokens', () => {
    it('yields tokens from mock ConverseStreamCommand response', async () => {
      const tokens = ['Hello', ', ', 'how', ' ', 'can', ' ', 'I', ' ', 'help', '?'];

      mockSend.mockResolvedValueOnce({
        stream: createMockStream(tokens),
      });

      const service = getBedrockConversationService(mockContext);
      const receivedTokens: string[] = [];

      for await (const token of service.sendMessage('Test message')) {
        receivedTokens.push(token);
      }

      expect(receivedTokens).toEqual(tokens);
    });
  });

  describe('onToken event', () => {
    it('fires for each streamed token', async () => {
      const tokens = ['Token1', 'Token2', 'Token3'];

      mockSend.mockResolvedValueOnce({
        stream: createMockStream(tokens),
      });

      const service = getBedrockConversationService(mockContext);
      const receivedTokens: string[] = [];

      service.onToken((token) => {
        receivedTokens.push(token);
      });

      // Consume the generator
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of service.sendMessage('Test message')) {
        // Just consume
      }

      expect(receivedTokens).toEqual(tokens);
    });
  });

  describe('onComplete event', () => {
    it('fires with full response on messageStop', async () => {
      const tokens = ['Hello', ' ', 'world'];
      const expectedFullResponse = 'Hello world';

      mockSend.mockResolvedValueOnce({
        stream: createMockStream(tokens),
      });

      const service = getBedrockConversationService(mockContext);
      let completeResponse: string | null = null;

      service.onComplete((response) => {
        completeResponse = response;
      });

      // Consume the generator
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of service.sendMessage('Test message')) {
        // Just consume
      }

      expect(completeResponse).toBe(expectedFullResponse);
    });
  });

  describe('conversation history update', () => {
    it('updates history after successful response', async () => {
      const tokens = ['Response', ' ', 'text'];

      mockSend.mockResolvedValueOnce({
        stream: createMockStream(tokens),
      });

      const service = getBedrockConversationService(mockContext);

      // Consume the generator
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of service.sendMessage('User message')) {
        // Just consume
      }

      const history = (service as unknown as { _conversationHistory: Array<{ role: string; content: Array<{ text: string }> }> })._conversationHistory;

      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[0].content[0].text).toBe('User message');
      expect(history[1].role).toBe('assistant');
      expect(history[1].content[0].text).toBe('Response text');
    });
  });

  describe('onError event', () => {
    it('fires on API error', async () => {
      const accessError = new Error('Access denied');
      (accessError as Error & { name: string }).name = 'AccessDeniedException';

      mockSend.mockRejectedValueOnce(accessError);

      const service = getBedrockConversationService(mockContext);
      let receivedError: unknown = null;

      service.onError((error) => {
        receivedError = error;
      });

      try {
        // Consume the generator - this should throw
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of service.sendMessage('Test message')) {
          // Just consume
        }
      } catch {
        // Expected to throw
      }

      expect(receivedError).not.toBeNull();
      expect((receivedError as { code: string }).code).toBe('BEDROCK_ACCESS_DENIED');
    });
  });
});
