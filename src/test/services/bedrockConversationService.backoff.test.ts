/**
 * Tests for BedrockConversationService Exponential Backoff
 *
 * Task Group 5: Exponential Backoff for Throttling
 * Tests for retry logic, backoff timing, and error handling
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

// Create throttling error
function createThrottlingError(): Error {
  const error = new Error('Rate exceeded');
  (error as Error & { name: string }).name = 'ThrottlingException';
  return error;
}

describe('Task Group 5: Exponential Backoff', () => {
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

  describe('ThrottlingException triggers retry', () => {
    it('automatically retries on ThrottlingException', async () => {
      const throttleError = createThrottlingError();

      // First call throws, second succeeds
      mockSend
        .mockRejectedValueOnce(throttleError)
        .mockResolvedValueOnce({
          stream: createMockStream(['Success']),
        });

      const service = getBedrockConversationService(mockContext);
      const tokens: string[] = [];

      for await (const token of service.sendMessage('Test message')) {
        tokens.push(token);
      }

      expect(tokens).toContain('Success');
      expect(mockSend).toHaveBeenCalledTimes(2);
    }, 15000);
  });

  describe('backoff sequence', () => {
    it('follows exponential pattern by calling multiple retries', async () => {
      const throttleError = createThrottlingError();

      // Fail twice, then succeed
      mockSend
        .mockRejectedValueOnce(throttleError)
        .mockRejectedValueOnce(throttleError)
        .mockResolvedValueOnce({
          stream: createMockStream(['Success']),
        });

      const service = getBedrockConversationService(mockContext);
      const tokens: string[] = [];

      for await (const token of service.sendMessage('Test message')) {
        tokens.push(token);
      }

      expect(tokens).toContain('Success');
      // Initial call + 2 retries = 3 total calls
      expect(mockSend).toHaveBeenCalledTimes(3);
    }, 30000);
  });

  describe('max retries exceeded', () => {
    it('emits error event after max retries', async () => {
      const throttleError = createThrottlingError();

      // Always fail with throttling
      mockSend.mockRejectedValue(throttleError);

      const service = getBedrockConversationService(mockContext);
      let receivedError: unknown = null;

      service.onError((error) => {
        receivedError = error;
      });

      try {
        for await (const _token of service.sendMessage('Test message')) {
          // consume
        }
      } catch {
        // Expected to throw after max retries
      }

      expect(receivedError).not.toBeNull();
      expect((receivedError as { code: string }).code).toBe('BEDROCK_THROTTLED');
      // Should have tried initial + MAX_RETRY_ATTEMPTS (3) = 4 times
      expect(mockSend).toHaveBeenCalledTimes(4);
    }, 60000);
  });

  describe('backoff reset on success', () => {
    it('resets backoff state after successful response', async () => {
      const throttleError = createThrottlingError();

      // First message: fail once then succeed
      mockSend
        .mockRejectedValueOnce(throttleError)
        .mockResolvedValueOnce({
          stream: createMockStream(['Response1']),
        })
        // Second message: fail once then succeed (backoff should be reset)
        .mockRejectedValueOnce(throttleError)
        .mockResolvedValueOnce({
          stream: createMockStream(['Response2']),
        });

      const service = getBedrockConversationService(mockContext);

      // First message
      const tokens1: string[] = [];
      for await (const token of service.sendMessage('Message 1')) {
        tokens1.push(token);
      }
      expect(tokens1).toContain('Response1');

      // Second message - should retry from scratch since backoff was reset
      const tokens2: string[] = [];
      for await (const token of service.sendMessage('Message 2')) {
        tokens2.push(token);
      }
      expect(tokens2).toContain('Response2');

      // Total: 4 calls (2 for each message)
      expect(mockSend).toHaveBeenCalledTimes(4);
    }, 30000);
  });
});
