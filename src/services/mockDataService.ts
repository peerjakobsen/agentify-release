/**
 * Mock Data Service
 *
 * Provides utility functions for AI-generated mock data in Step 6 of the
 * Ideation Wizard. Handles context message building, JSON parsing from
 * Claude responses, and manages a dedicated Bedrock conversation for mock data.
 *
 * This service follows the singleton pattern established by AgentDesignService.
 */

import * as vscode from 'vscode';
import { ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { getBedrockClientAsync } from './bedrockClient';
import { getConfigService } from './configService';
import type {
  MockToolDefinition,
  ProposedAgent,
} from '../types/wizardPanel';
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
 * Path to the mock data assistant prompt relative to extension root
 * Task 2.3: System prompt for mock data generation
 */
export const MOCK_DATA_PROMPT_PATH = 'resources/prompts/mock-data-assistant.md';

/**
 * Default model ID for Bedrock Claude conversations
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
// Context Message Building
// ============================================================================

/**
 * Build a context message from Step 5 confirmed agents to send to Claude for mock data
 * Task 2.3: Extracts tools from confirmedAgents and includes industry context
 *
 * @param confirmedAgents Array of confirmed agents from Step 5 with their tools
 * @param industry The industry context from Step 1
 * @returns Formatted context message string
 */
export function buildMockDataContextMessage(
  confirmedAgents: ProposedAgent[],
  industry: string
): string {
  // Extract all unique tools from confirmed agents
  const toolsWithContext: { tool: string; system: string; agentName: string }[] = [];

  for (const agent of confirmedAgents) {
    for (const tool of agent.tools) {
      // Extract system from tool name (e.g., 'sap' from 'sap_get_inventory')
      const systemPrefix = tool.split('_')[0];
      const systemName = mapSystemPrefix(systemPrefix);

      toolsWithContext.push({
        tool,
        system: systemName,
        agentName: agent.name,
      });
    }
  }

  // Build tools list for the prompt
  const toolsList = toolsWithContext
    .map((t) => `- ${t.tool} (${t.system}) - used by ${t.agentName}`)
    .join('\n');

  return `Industry Context: ${industry}

Tools requiring mock data definitions:
${toolsList}

Please generate mock data definitions for each tool listed above. For each tool, provide:
1. A mockRequest schema defining the expected input parameters
2. A mockResponse schema defining the expected output structure
3. Up to 5 sampleData rows with realistic values appropriate for the ${industry} industry

Format your response as a JSON array of mock definitions, with each definition containing:
- tool: The tool name (exactly as shown above)
- system: The system name
- operation: The operation being performed
- mockRequest: JSON object for request schema
- mockResponse: JSON object for response schema
- sampleData: Array of sample data rows matching the response schema

Use terminology and values typical for the ${industry} industry.`;
}

/**
 * Map system prefix to full system name
 * Helper function to derive system name from tool prefix
 *
 * @param prefix Lowercase system prefix from tool name
 * @returns Human-readable system name
 */
function mapSystemPrefix(prefix: string): string {
  const systemMap: Record<string, string> = {
    sap: 'SAP S/4HANA',
    salesforce: 'Salesforce',
    databricks: 'Databricks',
    servicenow: 'ServiceNow',
    workday: 'Workday',
    hubspot: 'HubSpot',
    dynamics: 'Dynamics 365',
    oracle: 'Oracle',
    netsuite: 'NetSuite',
    snowflake: 'Snowflake',
    redshift: 'Amazon Redshift',
    zendesk: 'Zendesk',
  };

  return systemMap[prefix.toLowerCase()] || prefix.toUpperCase();
}

// ============================================================================
// JSON Response Parsing
// ============================================================================

/**
 * Parse mock definitions from a Claude response that contains embedded JSON
 * Task 2.4: Extracts the JSON array and initializes UI state flags
 *
 * @param response The full Claude response text (may include prose and JSON)
 * @returns Array of MockToolDefinition objects, or null if parsing fails
 */
export function parseMockDefinitionsFromResponse(response: string): MockToolDefinition[] | null {
  try {
    // Find JSON block in the response using regex
    const regex = /```json\s*([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(response)) !== null) {
      const jsonString = match[1].trim();

      try {
        const parsed = JSON.parse(jsonString);

        // Must be an array
        if (!Array.isArray(parsed)) {
          continue;
        }

        // Validate and transform each tool definition
        const validDefinitions: MockToolDefinition[] = [];

        for (let i = 0; i < parsed.length; i++) {
          const item = parsed[i];

          if (isValidMockToolDefinition(item)) {
            validDefinitions.push({
              tool: item.tool,
              system: item.system,
              operation: item.operation,
              description: item.description || '',
              mockRequest: item.mockRequest || {},
              mockResponse: item.mockResponse || {},
              sampleData: item.sampleData || [],
              // Task 2.4: Initialize edited flags to false
              requestEdited: false,
              responseEdited: false,
              sampleDataEdited: false,
              // Task 2.4: First tool expanded, others collapsed
              expanded: i === 0,
            });
          }
        }

        if (validDefinitions.length > 0) {
          return validDefinitions;
        }
      } catch {
        // This JSON block didn't parse, try next one
        continue;
      }
    }

    // No valid mock definitions found in any JSON block
    return null;
  } catch {
    // Any unexpected error - return null
    return null;
  }
}

/**
 * Type guard to check if an object has the required mock tool definition fields
 *
 * @param obj Unknown object to validate
 * @returns True if object has required mock tool definition structure
 */
function isValidMockToolDefinition(
  obj: unknown
): obj is {
  tool: string;
  system: string;
  operation: string;
  description?: string;
  mockRequest?: object;
  mockResponse?: object;
  sampleData?: object[];
} {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'tool' in obj &&
    typeof (obj as { tool: unknown }).tool === 'string' &&
    'system' in obj &&
    typeof (obj as { system: unknown }).system === 'string' &&
    'operation' in obj &&
    typeof (obj as { operation: unknown }).operation === 'string'
  );
}

// ============================================================================
// Hash Generation
// ============================================================================

/**
 * Generate a hash of Step 5 confirmed agents for change detection
 * Task 2.5: Uses djb2 algorithm matching generateStep4Hash() pattern
 *
 * @param confirmedAgents Array of confirmed agents from Step 5
 * @returns Hexadecimal hash string
 */
export function generateStep5Hash(confirmedAgents: ProposedAgent[]): string {
  // Create a normalized representation of the agents and their tools
  const data = confirmedAgents.map((a) => ({
    id: a.id,
    name: a.name,
    tools: [...a.tools].sort(),
  })).sort((a, b) => a.id.localeCompare(b.id));

  const combined = JSON.stringify(data);

  // djb2 hash algorithm
  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 33) ^ combined.charCodeAt(i);
  }

  return (hash >>> 0).toString(16);
}

// ============================================================================
// Terminology Refinement
// ============================================================================

/**
 * Build a message for terminology refinement based on industry
 * Task 2.6: Preserves schema structure, only updates sampleData values
 *
 * @param mockDefinitions Current mock definitions to refine
 * @param industry Industry for terminology context
 * @returns Formatted message for terminology refinement
 */
export function buildTerminologyRefinementMessage(
  mockDefinitions: MockToolDefinition[],
  industry: string
): string {
  // Serialize current definitions (excluding UI state)
  const definitionsContext = mockDefinitions.map((d) => ({
    tool: d.tool,
    system: d.system,
    operation: d.operation,
    mockRequest: d.mockRequest,
    mockResponse: d.mockResponse,
    sampleData: d.sampleData,
  }));

  return `Current mock definitions:

\`\`\`json
${JSON.stringify(definitionsContext, null, 2)}
\`\`\`

Regenerate sample data using terminology typical for ${industry}.

IMPORTANT:
- Preserve the exact schema structure (mockRequest and mockResponse fields)
- Only update the sampleData values to use industry-appropriate terminology
- Keep the same number of sample data rows
- Return the complete mock definitions array with updated sampleData

Return the updated mock definitions in the same JSON format.`;
}

// ============================================================================
// Types for Conversation Service
// ============================================================================

/**
 * Conversation message in Converse API format
 */
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: Array<{ text: string }>;
}

// ============================================================================
// MockDataService Class
// ============================================================================

/**
 * Service class for mock data generation functionality
 * Task 2.2: Follows agentDesignService.ts streaming pattern
 * Provides instance methods for loading system prompts and managing
 * a dedicated Bedrock conversation for mock data generation
 */
export class MockDataService implements vscode.Disposable {
  /** Extension URI for resource loading */
  private readonly _extensionUri: vscode.Uri;

  /** Cached system prompt */
  private _systemPrompt: string | null = null;

  /** Conversation history in Converse API format */
  private _conversationHistory: ConversationMessage[] = [];

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

  /**
   * Creates a new MockDataService
   * @param extensionUri The extension URI for loading resources
   */
  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  /**
   * Load the mock data system prompt from resources
   * Caches the prompt after first load
   *
   * @returns The system prompt content
   */
  public async loadSystemPrompt(): Promise<string> {
    if (this._systemPrompt !== null) {
      return this._systemPrompt;
    }

    const promptUri = vscode.Uri.joinPath(
      this._extensionUri,
      ...MOCK_DATA_PROMPT_PATH.split('/')
    );

    const content = await vscode.workspace.fs.readFile(promptUri);
    this._systemPrompt = Buffer.from(content).toString('utf-8');

    return this._systemPrompt;
  }

  /**
   * Build context message from Step 5 confirmed agents
   * Instance method wrapper for the utility function
   */
  public buildMockDataContextMessage(
    confirmedAgents: ProposedAgent[],
    industry: string
  ): string {
    return buildMockDataContextMessage(confirmedAgents, industry);
  }

  /**
   * Parse mock definitions from Claude response
   * Instance method wrapper for the utility function
   */
  public parseMockDefinitionsFromResponse(response: string): MockToolDefinition[] | null {
    return parseMockDefinitionsFromResponse(response);
  }

  /**
   * Build terminology refinement message
   * Instance method wrapper for the utility function
   */
  public buildTerminologyRefinementMessage(
    mockDefinitions: MockToolDefinition[],
    industry: string
  ): string {
    return buildTerminologyRefinementMessage(mockDefinitions, industry);
  }

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
      const systemPrompt = await this.loadSystemPrompt();

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
   * Reset conversation history for a new generation request
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

    return config?.infrastructure?.bedrock?.modelId || DEFAULT_MODEL_ID;
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
      // Get region and model from config for error message
      const configService = getConfigService();
      const config = await configService?.getConfig();
      const region = config?.infrastructure?.bedrock?.region || 'unknown';
      const modelId = config?.infrastructure?.bedrock?.modelId || DEFAULT_MODEL_ID;

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
 * Singleton instance of the service
 */
let instance: MockDataService | null = null;

/**
 * Get the singleton MockDataService instance
 * Task 2.2: Export singleton getter following agentDesignService pattern
 *
 * @param context The VS Code extension context (required for first call)
 * @returns The MockDataService singleton
 */
export function getMockDataService(
  context: vscode.ExtensionContext
): MockDataService {
  if (!instance) {
    instance = new MockDataService(context.extensionUri);
  }
  return instance;
}

/**
 * Reset the singleton instance
 * Useful for testing or cleanup
 */
export function resetMockDataService(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
