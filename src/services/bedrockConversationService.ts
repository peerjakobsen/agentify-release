/**
 * Bedrock Conversation Service
 *
 * Provides Claude-powered ideation assistance via Amazon Bedrock's Converse API.
 * Implements a singleton pattern with EventEmitter and AsyncIterable patterns for
 * flexible integration with the Ideation Wizard panel.
 *
 * Usage:
 *   const service = getBedrockConversationService(context);
 *   service.onToken((token) => handleToken(token));
 *   service.onComplete((response) => handleComplete(response));
 *   service.onError((error) => handleError(error));
 *
 *   // AsyncIterable pattern
 *   for await (const token of service.sendMessage('Hello')) {
 *     console.log(token);
 *   }
 */

import * as vscode from 'vscode';
import { ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { getBedrockClientAsync } from './bedrockClient';
import { getConfigService } from './configService';
import {
  AgentifyError,
  createBedrockThrottledError,
  createBedrockAccessDeniedError,
  createBedrockModelNotAvailableError,
  createBedrockNetworkError,
  createBedrockInvalidRequestError,
} from '../types/errors';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default model ID for Bedrock Claude conversations
 * Using Sonnet for cost efficiency
 */
const DEFAULT_MODEL_ID = 'global.anthropic.claude-sonnet-4-5-20250929-v1:0';

/**
 * Initial backoff interval for throttling retry (1 second)
 */
const INITIAL_BACKOFF_MS = 1000;

/**
 * Maximum backoff interval (30 seconds)
 */
const MAX_BACKOFF_MS = 30000;

/**
 * Backoff multiplier for exponential increase
 */
const BACKOFF_MULTIPLIER = 2;

/**
 * Maximum number of retry attempts before giving up
 */
const MAX_RETRY_ATTEMPTS = 3;

// ============================================================================
// Types
// ============================================================================

/**
 * Conversation message in Converse API format
 */
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: Array<{ text: string }>;
}

// ============================================================================
// BedrockConversationService Class
// ============================================================================

/**
 * Service for managing Claude conversations via Amazon Bedrock
 * Implements vscode.Disposable for proper resource cleanup
 */
export class BedrockConversationService implements vscode.Disposable {
  // -------------------------------------------------------------------------
  // Private State Fields
  // -------------------------------------------------------------------------

  /** Extension URI for resource loading */
  private readonly _extensionUri: vscode.Uri;

  /** Conversation history in Converse API format */
  private _conversationHistory: ConversationMessage[] = [];

  /** Cached system prompt (loaded once on first use) */
  private _systemPrompt: string | null = null;

  /** Whether a streaming response is currently in progress */
  private _isStreaming = false;

  /** Current retry count for backoff */
  private _retryCount = 0;

  // -------------------------------------------------------------------------
  // EventEmitters (VS Code pattern)
  // -------------------------------------------------------------------------

  /** Event emitter for individual tokens during streaming */
  private readonly _onToken = new vscode.EventEmitter<string>();

  /** Public event for subscribing to token events */
  public readonly onToken = this._onToken.event;

  /** Event emitter for complete response */
  private readonly _onComplete = new vscode.EventEmitter<string>();

  /** Public event for subscribing to completion events */
  public readonly onComplete = this._onComplete.event;

  /** Event emitter for errors */
  private readonly _onError = new vscode.EventEmitter<AgentifyError>();

  /** Public event for subscribing to error events */
  public readonly onError = this._onError.event;

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  /**
   * Creates a new BedrockConversationService
   * @param extensionUri The extension URI for loading resources
   */
  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  // -------------------------------------------------------------------------
  // Public Methods
  // -------------------------------------------------------------------------

  /**
   * Send a message and stream the response
   * Implements both AsyncIterable and EventEmitter patterns
   *
   * @param userMessage The user's message to send
   * @yields Individual tokens as they stream from Bedrock
   */
  public async *sendMessage(userMessage: string): AsyncIterable<string> {
    // Prevent concurrent messages
    if (this._isStreaming) {
      const error = createBedrockInvalidRequestError('A message is already being processed');
      this._onError.fire(error);
      throw error;
    }

    this._isStreaming = true;

    try {
      // Append user message to history before API call
      this._appendUserMessage(userMessage);

      // Load system prompt if not cached
      const systemPrompt = await this._loadSystemPrompt();

      // Get model ID from config
      const modelId = await this._getModelId();

      // Execute with retry logic
      yield* this._executeWithRetry(systemPrompt, modelId);
    } catch (error) {
      this._isStreaming = false;
      throw error;
    }
  }

  /**
   * Reset conversation history for a new ideation session
   */
  public resetConversation(): void {
    this._conversationHistory = [];
  }

  /**
   * Dispose of all resources
   * Implements vscode.Disposable
   */
  public dispose(): void {
    this._onToken.dispose();
    this._onComplete.dispose();
    this._onError.dispose();
    this._conversationHistory = [];
    this._systemPrompt = null;
  }

  // -------------------------------------------------------------------------
  // Private Methods - Conversation History
  // -------------------------------------------------------------------------

  /**
   * Append a user message to conversation history
   * @param message The user's message text
   */
  private _appendUserMessage(message: string): void {
    this._conversationHistory.push({
      role: 'user',
      content: [{ text: message }],
    });
  }

  /**
   * Append an assistant message to conversation history
   * @param message The assistant's response text
   */
  private _appendAssistantMessage(message: string): void {
    this._conversationHistory.push({
      role: 'assistant',
      content: [{ text: message }],
    });
  }

  // -------------------------------------------------------------------------
  // Private Methods - System Prompt
  // -------------------------------------------------------------------------

  /**
   * Load system prompt from bundled resource file
   * Caches the prompt after first load
   *
   * @returns The system prompt content
   */
  private async _loadSystemPrompt(): Promise<string> {
    // Return cached prompt if available
    if (this._systemPrompt !== null) {
      return this._systemPrompt;
    }

    // Build URI to prompt file
    const promptUri = vscode.Uri.joinPath(
      this._extensionUri,
      'resources',
      'prompts',
      'ideation-assistant.md'
    );

    // Read and cache the prompt
    const content = await vscode.workspace.fs.readFile(promptUri);
    this._systemPrompt = Buffer.from(content).toString('utf-8');

    return this._systemPrompt;
  }

  // -------------------------------------------------------------------------
  // Private Methods - Configuration
  // -------------------------------------------------------------------------

  /**
   * Get the model ID from configuration
   * Falls back to default Sonnet model if not configured
   *
   * @returns The Bedrock model ID to use
   */
  private async _getModelId(): Promise<string> {
    const configService = getConfigService();
    const config = await configService?.getConfig();

    return config?.bedrock?.modelId || DEFAULT_MODEL_ID;
  }

  // -------------------------------------------------------------------------
  // Private Methods - API Execution with Retry
  // -------------------------------------------------------------------------

  /**
   * Execute the Converse API call with exponential backoff retry
   *
   * @param systemPrompt The system prompt to use
   * @param modelId The model ID to use
   * @yields Individual tokens as they stream
   */
  private async *_executeWithRetry(
    systemPrompt: string,
    modelId: string
  ): AsyncIterable<string> {
    this._retryCount = 0;

    while (true) {
      try {
        yield* this._executeConverseStream(systemPrompt, modelId);
        // Success - reset backoff and return
        this._retryCount = 0;
        return;
      } catch (error) {
        const shouldRetry = await this._handleError(error);
        if (!shouldRetry) {
          throw error;
        }
      }
    }
  }

  /**
   * Execute a single Converse API stream request
   *
   * @param systemPrompt The system prompt to use
   * @param modelId The model ID to use
   * @yields Individual tokens as they stream
   */
  private async *_executeConverseStream(
    systemPrompt: string,
    modelId: string
  ): AsyncIterable<string> {
    // Get Bedrock client
    const client = await getBedrockClientAsync();

    // Build the Converse command
    const command = new ConverseStreamCommand({
      modelId,
      system: [{ text: systemPrompt }],
      messages: this._conversationHistory,
    });

    // Send the request
    const response = await client.send(command);

    // Stream and yield tokens
    let fullResponse = '';

    if (response.stream) {
      for await (const event of response.stream) {
        // Handle content block delta (streaming tokens)
        if (event.contentBlockDelta?.delta?.text) {
          const token = event.contentBlockDelta.delta.text;
          fullResponse += token;
          this._onToken.fire(token);
          yield token;
        }

        // Handle message stop (completion)
        if (event.messageStop) {
          // Append complete response to history
          this._appendAssistantMessage(fullResponse);
          this._onComplete.fire(fullResponse);
          this._isStreaming = false;
        }
      }
    }
  }

  /**
   * Handle errors from the Converse API
   * Determines if error is retryable and handles backoff
   *
   * @param error The error that occurred
   * @returns True if the request should be retried
   */
  private async _handleError(error: unknown): Promise<boolean> {
    const errorObj = error as Error & { name?: string; $metadata?: { httpStatusCode?: number } };

    // Check for throttling exception
    if (
      errorObj.name === 'ThrottlingException' ||
      errorObj.name === 'ServiceQuotaExceededException'
    ) {
      if (this._retryCount >= MAX_RETRY_ATTEMPTS) {
        // Max retries exceeded
        const agentifyError = createBedrockThrottledError();
        this._onError.fire(agentifyError);
        this._isStreaming = false;
        return false;
      }

      // Calculate backoff
      const backoffMs = Math.min(
        INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, this._retryCount),
        MAX_BACKOFF_MS
      );

      // Wait for backoff interval
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      this._retryCount++;

      return true;
    }

    // Handle access denied
    if (errorObj.name === 'AccessDeniedException') {
      const agentifyError = createBedrockAccessDeniedError(errorObj);
      this._onError.fire(agentifyError);
      this._isStreaming = false;
      return false;
    }

    // Handle validation exception
    if (errorObj.name === 'ValidationException') {
      const agentifyError = createBedrockInvalidRequestError(
        errorObj.message || 'Invalid request',
        errorObj
      );
      this._onError.fire(agentifyError);
      this._isStreaming = false;
      return false;
    }

    // Handle model not found
    if (
      errorObj.name === 'ModelNotReadyException' ||
      errorObj.name === 'ResourceNotFoundException'
    ) {
      // Get region from config for error message
      const configService = getConfigService();
      const config = await configService?.getConfig();
      const region = config?.infrastructure?.dynamodb?.region || 'unknown';
      const modelId = config?.bedrock?.modelId || DEFAULT_MODEL_ID;

      const agentifyError = createBedrockModelNotAvailableError(modelId, region, errorObj);
      this._onError.fire(agentifyError);
      this._isStreaming = false;
      return false;
    }

    // Generic network/connection error
    const agentifyError = createBedrockNetworkError(errorObj);
    this._onError.fire(agentifyError);
    this._isStreaming = false;
    return false;
  }
}

// ============================================================================
// Singleton Pattern
// ============================================================================

/**
 * Singleton instance of the conversation service
 */
let instance: BedrockConversationService | null = null;

/**
 * Get the singleton BedrockConversationService instance
 * Creates the instance on first call (lazy initialization)
 *
 * @param context The VS Code extension context (required for first call)
 * @returns The BedrockConversationService singleton
 */
export function getBedrockConversationService(
  context: vscode.ExtensionContext
): BedrockConversationService {
  if (!instance) {
    instance = new BedrockConversationService(context.extensionUri);
  }
  return instance;
}

/**
 * Reset the singleton instance
 * Useful for testing or when cleanup is needed
 */
export function resetBedrockConversationService(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
