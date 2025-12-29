/**
 * Outcome Definition Service
 *
 * Provides utility functions for the AI outcome definition in Step 3 of the
 * Ideation Wizard. Handles context message building, JSON outcome parsing from
 * Claude responses, and manages a dedicated Bedrock conversation for outcome suggestions.
 *
 * This service provides stateless utility functions and a class that can be used
 * alongside the BedrockConversationService for actual Claude communication.
 */

import * as vscode from 'vscode';
import { ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { getBedrockClientAsync } from './bedrockClient';
import { getConfigService } from './configService';
import type {
  OutcomeSuggestions,
  SuccessMetric,
  SystemAssumption,
  OutcomeDefinitionState,
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
 * Path to the outcome definition assistant prompt relative to extension root
 */
const OUTCOME_DEFINITION_PROMPT_PATH = 'resources/prompts/outcome-definition-assistant.md';

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
 * Build a context message from Steps 1-2 inputs to send to Claude for outcome suggestions
 * Formats the business objective, industry, systems, and confirmed assumptions into a structured prompt
 *
 * @param businessObjective The user's business objective/problem statement
 * @param industry The selected industry vertical
 * @param systems Array of selected system names
 * @param confirmedAssumptions Array of confirmed assumptions from Step 2
 * @param customSystems Optional comma-separated string of additional systems
 * @returns Formatted context message string
 */
export function buildOutcomeContextMessage(
  businessObjective: string,
  industry: string,
  systems: string[],
  confirmedAssumptions: SystemAssumption[],
  customSystems?: string
): string {
  // Combine selected systems with custom systems
  const allSystems = [...systems];

  // Parse custom systems (comma-separated) and add to the list
  if (customSystems && customSystems.trim()) {
    const customList = customSystems
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    allSystems.push(...customList);
  }

  const systemsList =
    allSystems.length > 0
      ? allSystems.join(', ')
      : 'No specific systems specified';

  // Format confirmed assumptions for context
  let assumptionsText = 'No confirmed assumptions yet.';
  if (confirmedAssumptions.length > 0) {
    const assumptionLines = confirmedAssumptions.map((a) => {
      const modules = a.modules.length > 0 ? `Modules: ${a.modules.join(', ')}` : 'No specific modules';
      const integrations = a.integrations.length > 0 ? `Integrations: ${a.integrations.join('; ')}` : 'No specific integrations';
      return `- ${a.system}: ${modules}. ${integrations}`;
    });
    assumptionsText = assumptionLines.join('\n');
  }

  return `Business Objective: ${businessObjective}

Industry: ${industry}

Systems: ${systemsList}

Confirmed System Assumptions:
${assumptionsText}

Based on this business context and confirmed system architecture, please suggest:
1. A measurable primary outcome statement that addresses the business objective
2. 3-5 specific KPIs with target values that can measure success
3. Relevant stakeholders who would benefit from or be impacted by achieving this outcome

Please provide your suggestions in the required JSON format.`;
}

// ============================================================================
// Refinement Context Message Building
// ============================================================================

/**
 * Build a context message for refinement requests
 * Includes current outcome state so Claude can make informed updates
 *
 * @param userMessage The user's refinement request (e.g., "Add a metric for cost savings")
 * @param currentState The current outcome definition state
 * @returns Formatted refinement context message string
 */
export function buildRefinementContextMessage(
  userMessage: string,
  currentState: OutcomeDefinitionState
): string {
  // Format current KPIs
  const kpisText = currentState.successMetrics.length > 0
    ? currentState.successMetrics.map((m) => `- ${m.name}: ${m.targetValue} ${m.unit}`).join('\n')
    : 'No KPIs defined yet.';

  // Format current stakeholders
  const stakeholdersText = currentState.stakeholders.length > 0
    ? currentState.stakeholders.join(', ')
    : 'No stakeholders selected yet.';

  return `Current Outcome State:

Primary Outcome: ${currentState.primaryOutcome || 'Not defined yet.'}

Current KPIs:
${kpisText}

Current Stakeholders: ${stakeholdersText}

User's Refinement Request: ${userMessage}

Please update the outcome suggestions based on this refinement request. Respond with a JSON block containing only the changes:

\`\`\`json
{
  "changes": {
    "outcome": "updated outcome text (only if changing)",
    "kpis": [{ "name": "...", "targetValue": "...", "unit": "..." }] (only if changing),
    "stakeholders": ["..."] (only if changing)
  }
}
\`\`\`

Only include fields that are being changed. Do not include fields that should remain the same.`;
}

// ============================================================================
// Refinement Changes Type
// ============================================================================

/**
 * Structure for refinement changes parsed from Claude response
 */
export interface RefinementChanges {
  /** Updated primary outcome (if changed) */
  outcome?: string;
  /** Updated KPIs array (if changed) */
  kpis?: SuccessMetric[];
  /** Updated stakeholders array (if changed) */
  stakeholders?: string[];
}

// ============================================================================
// JSON Outcome Parsing
// ============================================================================

/**
 * Parse outcome suggestions from a Claude response that contains embedded JSON
 * Extracts the JSON block between markdown code fences and parses the OutcomeSuggestions
 *
 * @param response The full Claude response text (may include prose and JSON)
 * @returns OutcomeSuggestions object, or null if parsing fails
 */
export function parseOutcomeSuggestionsFromResponse(response: string): OutcomeSuggestions | null {
  try {
    // Find all JSON blocks in the response using exec loop
    const matches: RegExpExecArray[] = [];
    let match: RegExpExecArray | null;

    // Reset regex lastIndex and use exec loop for compatibility
    const regex = /```json\s*([\s\S]*?)```/g;
    while ((match = regex.exec(response)) !== null) {
      matches.push(match);
    }

    if (matches.length === 0) {
      return null;
    }

    // Try each JSON block until we find one with valid outcome suggestions
    for (const m of matches) {
      const jsonString = m[1].trim();

      try {
        const parsed = JSON.parse(jsonString);

        // Check if this JSON has the required outcome fields
        if (isValidOutcomeSuggestions(parsed)) {
          return validateAndTransformOutcomeSuggestions(parsed);
        }
      } catch {
        // This JSON block didn't parse or doesn't have outcome fields, try next one
        continue;
      }
    }

    // No valid outcome suggestions found in any JSON block
    return null;
  } catch {
    // Any unexpected error - return null
    return null;
  }
}

/**
 * Parse refinement changes from a Claude response
 * Extracts the JSON block containing changes for outcome, KPIs, and/or stakeholders
 *
 * @param response The full Claude response text (may include prose and JSON)
 * @returns RefinementChanges object, or null if parsing fails
 */
export function parseRefinementChangesFromResponse(response: string): RefinementChanges | null {
  try {
    // Find all JSON blocks in the response using exec loop
    const matches: RegExpExecArray[] = [];
    let match: RegExpExecArray | null;

    const regex = /```json\s*([\s\S]*?)```/g;
    while ((match = regex.exec(response)) !== null) {
      matches.push(match);
    }

    if (matches.length === 0) {
      return null;
    }

    // Try each JSON block until we find one with valid changes
    for (const m of matches) {
      const jsonString = m[1].trim();

      try {
        const parsed = JSON.parse(jsonString);

        // Check if this JSON has a changes object
        if (parsed && typeof parsed.changes === 'object' && parsed.changes !== null) {
          return validateAndTransformRefinementChanges(parsed.changes);
        }
      } catch {
        // This JSON block didn't parse or doesn't have changes, try next one
        continue;
      }
    }

    // No valid changes found in any JSON block
    return null;
  } catch {
    // Any unexpected error - return null
    return null;
  }
}

/**
 * Validate and transform raw refinement changes into typed RefinementChanges
 *
 * @param raw Raw changes object from JSON
 * @returns Validated and transformed RefinementChanges object
 */
function validateAndTransformRefinementChanges(
  raw: Record<string, unknown>
): RefinementChanges {
  const changes: RefinementChanges = {};

  // Extract outcome if present and is a string
  if (typeof raw.outcome === 'string') {
    changes.outcome = raw.outcome.trim();
  }

  // Extract KPIs if present and is an array
  if (Array.isArray(raw.kpis)) {
    const validKPIs: SuccessMetric[] = [];
    for (const kpi of raw.kpis) {
      if (isValidKPI(kpi)) {
        validKPIs.push({
          name: kpi.name,
          targetValue: String(kpi.targetValue),
          unit: kpi.unit,
        });
      }
    }
    if (validKPIs.length > 0) {
      changes.kpis = validKPIs;
    }
  }

  // Extract stakeholders if present and is an array
  if (Array.isArray(raw.stakeholders)) {
    const validStakeholders: string[] = raw.stakeholders
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (validStakeholders.length > 0) {
      changes.stakeholders = validStakeholders;
    }
  }

  return changes;
}

// ============================================================================
// Apply Refinement Changes with Edited Flags
// ============================================================================

/**
 * Apply refinement changes to outcome state while respecting edited flags
 * If a field has been manually edited by the user, AI changes are not applied to it
 *
 * @param currentState The current outcome definition state
 * @param changes The refinement changes to apply
 * @returns New state with changes applied (respecting edited flags)
 */
export function applyRefinementChangesWithEditedFlags(
  currentState: OutcomeDefinitionState,
  changes: RefinementChanges
): OutcomeDefinitionState {
  // Create a copy of the current state
  const newState: OutcomeDefinitionState = {
    ...currentState,
    refinedSections: { ...currentState.refinedSections },
  };

  // Apply outcome change if not manually edited
  if (changes.outcome !== undefined && !currentState.primaryOutcomeEdited) {
    newState.primaryOutcome = changes.outcome;
    newState.refinedSections.outcome = true;
  }

  // Apply KPIs change if not manually edited
  if (changes.kpis !== undefined && !currentState.metricsEdited) {
    newState.successMetrics = [...changes.kpis];
    newState.refinedSections.kpis = true;
  }

  // Apply stakeholders change if not manually edited
  if (changes.stakeholders !== undefined && !currentState.stakeholdersEdited) {
    newState.stakeholders = [...changes.stakeholders];
    newState.refinedSections.stakeholders = true;
  }

  return newState;
}

/**
 * Type guard to check if a parsed object has the required outcome suggestion fields
 *
 * @param obj Unknown object to validate
 * @returns True if object has required outcome suggestion structure
 */
function isValidOutcomeSuggestions(
  obj: unknown
): obj is { primaryOutcome: string; suggestedKPIs: unknown[]; stakeholders: unknown[] } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'primaryOutcome' in obj &&
    typeof (obj as { primaryOutcome: unknown }).primaryOutcome === 'string' &&
    'suggestedKPIs' in obj &&
    Array.isArray((obj as { suggestedKPIs: unknown }).suggestedKPIs) &&
    'stakeholders' in obj &&
    Array.isArray((obj as { stakeholders: unknown }).stakeholders)
  );
}

/**
 * Validate and transform raw outcome suggestions into typed OutcomeSuggestions
 * Ensures all required fields exist and are properly typed
 *
 * @param raw Raw outcome suggestions object from JSON
 * @returns Validated and transformed OutcomeSuggestions object
 */
function validateAndTransformOutcomeSuggestions(
  raw: { primaryOutcome: string; suggestedKPIs: unknown[]; stakeholders: unknown[] }
): OutcomeSuggestions {
  // Transform KPIs, filtering out invalid ones
  const validKPIs: SuccessMetric[] = [];
  for (const kpi of raw.suggestedKPIs) {
    if (isValidKPI(kpi)) {
      validKPIs.push({
        name: kpi.name,
        targetValue: String(kpi.targetValue),
        unit: kpi.unit,
      });
    }
  }

  // Transform stakeholders, filtering out non-strings
  const validStakeholders: string[] = raw.stakeholders
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return {
    primaryOutcome: raw.primaryOutcome.trim(),
    suggestedKPIs: validKPIs,
    stakeholders: validStakeholders,
  };
}

/**
 * Type guard to check if an object is a valid KPI structure
 *
 * @param obj Unknown object to validate
 * @returns True if object has required KPI structure
 */
function isValidKPI(
  obj: unknown
): obj is { name: string; targetValue: string | number; unit: string } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'name' in obj &&
    typeof (obj as { name: unknown }).name === 'string' &&
    'targetValue' in obj &&
    (typeof (obj as { targetValue: unknown }).targetValue === 'string' ||
      typeof (obj as { targetValue: unknown }).targetValue === 'number') &&
    'unit' in obj &&
    typeof (obj as { unit: unknown }).unit === 'string'
  );
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
// OutcomeDefinitionService Class
// ============================================================================

/**
 * Service class for outcome definition conversation functionality
 * Provides instance methods for loading system prompts and managing
 * a dedicated Bedrock conversation for outcome suggestions
 */
export class OutcomeDefinitionService implements vscode.Disposable {
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
   * Creates a new OutcomeDefinitionService
   * @param extensionUri The extension URI for loading resources
   */
  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  /**
   * Load the outcome definition system prompt from resources
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
      ...OUTCOME_DEFINITION_PROMPT_PATH.split('/')
    );

    const content = await vscode.workspace.fs.readFile(promptUri);
    this._systemPrompt = Buffer.from(content).toString('utf-8');

    return this._systemPrompt;
  }

  /**
   * Build context message from Steps 1-2 inputs
   * Instance method wrapper for the utility function
   */
  public buildOutcomeContextMessage(
    businessObjective: string,
    industry: string,
    systems: string[],
    confirmedAssumptions: SystemAssumption[],
    customSystems?: string
  ): string {
    return buildOutcomeContextMessage(
      businessObjective,
      industry,
      systems,
      confirmedAssumptions,
      customSystems
    );
  }

  /**
   * Build refinement context message
   * Instance method wrapper for the utility function
   */
  public buildRefinementContextMessage(
    userMessage: string,
    currentState: OutcomeDefinitionState
  ): string {
    return buildRefinementContextMessage(userMessage, currentState);
  }

  /**
   * Parse outcome suggestions from Claude response
   * Instance method wrapper for the utility function
   */
  public parseOutcomeSuggestionsFromResponse(response: string): OutcomeSuggestions | null {
    return parseOutcomeSuggestionsFromResponse(response);
  }

  /**
   * Parse refinement changes from Claude response
   * Instance method wrapper for the utility function
   */
  public parseRefinementChangesFromResponse(response: string): RefinementChanges | null {
    return parseRefinementChangesFromResponse(response);
  }

  /**
   * Apply refinement changes respecting edited flags
   * Instance method wrapper for the utility function
   */
  public applyRefinementChangesWithEditedFlags(
    currentState: OutcomeDefinitionState,
    changes: RefinementChanges
  ): OutcomeDefinitionState {
    return applyRefinementChangesWithEditedFlags(currentState, changes);
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
   * Send a refinement message with current state context
   * Builds context from current state and sends to Claude
   *
   * @param userMessage The user's refinement request
   * @param currentState The current outcome definition state
   * @yields Individual tokens as they stream from Bedrock
   */
  public async *sendRefinementMessage(
    userMessage: string,
    currentState: OutcomeDefinitionState
  ): AsyncIterable<string> {
    // Build refinement context message
    const contextMessage = this.buildRefinementContextMessage(userMessage, currentState);

    // Use the existing sendMessage flow
    yield* this.sendMessage(contextMessage);
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
let instance: OutcomeDefinitionService | null = null;

/**
 * Get the singleton OutcomeDefinitionService instance
 *
 * @param context The VS Code extension context (required for first call)
 * @returns The OutcomeDefinitionService singleton
 */
export function getOutcomeDefinitionService(
  context: vscode.ExtensionContext
): OutcomeDefinitionService {
  if (!instance) {
    instance = new OutcomeDefinitionService(context.extensionUri);
  }
  return instance;
}

/**
 * Reset the singleton instance
 * Useful for testing or cleanup
 */
export function resetOutcomeDefinitionService(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
