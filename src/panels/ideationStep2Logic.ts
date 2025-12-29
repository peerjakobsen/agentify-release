/**
 * Step 2: AI Gap-Filling Logic
 * Extracted from tabbedPanel.ts for maintainability
 */

import * as vscode from 'vscode';
import { getBedrockConversationService, BedrockConversationService } from '../services/bedrockConversationService';
import { buildContextMessage, parseAssumptionsFromResponse, generateStep1Hash, hasStep1Changed } from '../services/gapFillingService';

/**
 * System assumption structure
 */
export interface SystemAssumption {
  system: string;
  modules: string[];
  integrations: string[];
  source: 'ai-proposed' | 'user-corrected';
}

/**
 * Conversation message structure
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  parsedAssumptions?: SystemAssumption[];
}

/**
 * AI Gap-Filling state
 */
export interface AIGapFillingState {
  conversationHistory: ConversationMessage[];
  confirmedAssumptions: SystemAssumption[];
  assumptionsAccepted: boolean;
  isStreaming: boolean;
  step1InputHash?: string;
  streamingError?: string;
}

/**
 * Step 1 inputs needed for Step 2 context
 */
export interface Step1Inputs {
  businessObjective: string;
  industry: string;
  systems: string[];
  customSystems?: string;
}

/**
 * Callbacks for UI updates
 */
export interface Step2Callbacks {
  updateWebviewContent: () => void;
  syncStateToWebview: () => void;
  postStreamingToken: (content: string) => void;
}

/**
 * Create default AI Gap-Filling state
 */
export function createDefaultAIGapFillingState(): AIGapFillingState {
  return {
    conversationHistory: [],
    confirmedAssumptions: [],
    assumptionsAccepted: false,
    isStreaming: false,
  };
}

/**
 * Step 2 Logic Handler
 * Manages AI gap-filling conversation and assumptions
 */
export class Step2LogicHandler {
  private _bedrockService?: BedrockConversationService;
  private _bedrockDisposables: vscode.Disposable[] = [];
  private _streamingResponse = '';
  private _context?: vscode.ExtensionContext;
  private _state: AIGapFillingState;
  private _callbacks: Step2Callbacks;

  constructor(context: vscode.ExtensionContext | undefined, state: AIGapFillingState, callbacks: Step2Callbacks) {
    this._context = context;
    this._state = state;
    this._callbacks = callbacks;
  }

  /**
   * Update state reference (for when parent state changes)
   */
  public setState(state: AIGapFillingState): void {
    this._state = state;
  }

  /**
   * Get current state
   */
  public getState(): AIGapFillingState {
    return this._state;
  }

  /**
   * Trigger auto-send when entering Step 2
   */
  public triggerAutoSend(step1Inputs: Step1Inputs): void {
    // Check if Step 1 inputs have changed since last visit
    if (hasStep1Changed(
      this._state.step1InputHash,
      step1Inputs.businessObjective,
      step1Inputs.industry,
      step1Inputs.systems,
      step1Inputs.customSystems
    )) {
      // Reset conversation state due to input changes
      this._state.conversationHistory = [];
      this._state.confirmedAssumptions = [];
      this._state.assumptionsAccepted = false;
      this._state.isStreaming = false;
      this._state.step1InputHash = undefined;
      this._state.streamingError = undefined;
    }

    // Only auto-send if conversation is empty
    if (this._state.conversationHistory.length === 0 && !this._state.isStreaming) {
      this.sendContextToClaude(step1Inputs);
    }
  }

  /**
   * Initialize Bedrock service if needed
   */
  private initBedrockService(): BedrockConversationService | undefined {
    if (this._bedrockService) {
      return this._bedrockService;
    }

    if (!this._context) {
      console.warn('[Step2Logic] Extension context not available for Bedrock service');
      return undefined;
    }

    this._bedrockService = getBedrockConversationService(this._context);

    // Subscribe to streaming events
    this._bedrockDisposables.push(
      this._bedrockService.onToken((token) => {
        this.handleStreamingToken(token);
      })
    );

    this._bedrockDisposables.push(
      this._bedrockService.onComplete((response) => {
        this.handleStreamingComplete(response);
      })
    );

    this._bedrockDisposables.push(
      this._bedrockService.onError((error) => {
        this.handleStreamingError(error.message);
      })
    );

    return this._bedrockService;
  }

  /**
   * Build and send context to Claude via Bedrock
   */
  public async sendContextToClaude(step1Inputs: Step1Inputs): Promise<void> {
    const service = this.initBedrockService();
    if (!service) {
      this._state.streamingError = 'Claude service not available. Please check your configuration.';
      this._callbacks.syncStateToWebview();
      return;
    }

    // Build context message from Step 1 inputs
    const contextMessage = buildContextMessage(
      step1Inputs.businessObjective,
      step1Inputs.industry,
      step1Inputs.systems,
      step1Inputs.customSystems
    );

    // Store hash for change detection
    this._state.step1InputHash = generateStep1Hash(
      step1Inputs.businessObjective,
      step1Inputs.industry,
      step1Inputs.systems,
      step1Inputs.customSystems
    );

    // Add user message to conversation history
    this._state.conversationHistory.push({
      role: 'user',
      content: contextMessage,
      timestamp: Date.now(),
    });

    // Set streaming state
    this._state.isStreaming = true;
    this._state.streamingError = undefined;
    this._streamingResponse = '';
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    // Send message to Claude
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _token of service.sendMessage(contextMessage)) {
        // Tokens are handled by onToken event handler
      }
    } catch (error) {
      this.handleStreamingError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Handle incoming streaming token from Claude
   */
  private handleStreamingToken(token: string): void {
    this._streamingResponse += token;
    this._callbacks.postStreamingToken(this._streamingResponse);
  }

  /**
   * Handle streaming completion from Claude
   */
  private handleStreamingComplete(fullResponse: string): void {
    // Parse assumptions from response
    const parsedAssumptions = parseAssumptionsFromResponse(fullResponse);

    // Add assistant message to conversation history
    this._state.conversationHistory.push({
      role: 'assistant',
      content: fullResponse,
      timestamp: Date.now(),
      parsedAssumptions,
    });

    // Update streaming state
    this._state.isStreaming = false;
    this._streamingResponse = '';
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Handle streaming error from Claude
   */
  private handleStreamingError(errorMessage: string): void {
    this._state.isStreaming = false;
    this._state.streamingError = errorMessage;
    this._streamingResponse = '';
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Handle send chat message command
   */
  public async handleSendChatMessage(content: string): Promise<void> {
    if (!content.trim()) return;

    const service = this.initBedrockService();
    if (!service) {
      return;
    }

    // Add user message to conversation history
    this._state.conversationHistory.push({
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    });

    // Set streaming state
    this._state.isStreaming = true;
    this._state.streamingError = undefined;
    this._streamingResponse = '';
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    // Send message to Claude
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _token of service.sendMessage(content.trim())) {
        // Tokens are handled by onToken event handler
      }
    } catch (error) {
      this.handleStreamingError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Handle accept assumptions command
   */
  public handleAcceptAssumptions(): void {
    const history = this._state.conversationHistory;

    // Find last assistant message with assumptions
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === 'assistant' && msg.parsedAssumptions && msg.parsedAssumptions.length > 0) {
        this._state.confirmedAssumptions = [...msg.parsedAssumptions];
        this._state.assumptionsAccepted = true;
        break;
      }
    }

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Handle regenerate assumptions command
   */
  public handleRegenerateAssumptions(step1Inputs: Step1Inputs): void {
    // Reset conversation but keep the hash
    const hash = this._state.step1InputHash;
    this._state.conversationHistory = [];
    this._state.confirmedAssumptions = [];
    this._state.assumptionsAccepted = false;
    this._state.isStreaming = false;
    this._state.streamingError = undefined;
    this._state.step1InputHash = hash;

    // Reset the Bedrock service conversation history
    if (this._bedrockService) {
      this._bedrockService.resetConversation();
    }

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    // Trigger new conversation
    this.sendContextToClaude(step1Inputs);
  }

  /**
   * Handle retry last message command
   */
  public handleRetryLastMessage(step1Inputs: Step1Inputs): void {
    const history = this._state.conversationHistory;

    // Clear the error
    this._state.streamingError = undefined;

    // If there's no history or only one message, resend context
    if (history.length <= 1) {
      this.sendContextToClaude(step1Inputs);
      return;
    }

    // Find the last user message and resend it
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === 'user') {
        // Remove this message from history (it will be re-added by handleSendChatMessage)
        history.splice(i, 1);
        this.handleSendChatMessage(msg.content);
        break;
      }
    }
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this._bedrockDisposables.forEach(d => d.dispose());
    this._bedrockDisposables = [];
  }
}
