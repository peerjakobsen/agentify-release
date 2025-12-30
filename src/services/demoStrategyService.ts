/**
 * Demo Strategy Service
 *
 * Provides utility functions for AI-generated demo strategy content in Step 7 of the
 * Ideation Wizard. Handles context message building, JSON parsing from
 * Claude responses, and manages a dedicated Bedrock conversation for demo strategy.
 *
 * This service follows the singleton pattern established by MockDataService.
 */

import * as vscode from 'vscode';
import { ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { getBedrockClientAsync } from './bedrockClient';
import { getConfigService } from './configService';
import type {
  ProposedAgent,
  ProposedEdge,
  AhaMoment,
  DemoPersona,
  NarrativeScene,
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
 * Path to the demo strategy assistant prompt relative to extension root
 * Task 2.3: System prompt for demo strategy generation
 */
export const DEMO_STRATEGY_PROMPT_PATH = 'resources/prompts/demo-strategy-assistant.md';

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
 * Build a context message for generating aha moments
 * Task 2.4: Context includes industry, business objective, and confirmed agents with tools
 *
 * @param industry The industry context from Step 1
 * @param businessObjective The business objective from Step 1
 * @param confirmedAgents Array of confirmed agents from Step 5
 * @returns Formatted context message string
 */
export function buildAhaMomentsContextMessage(
  industry: string,
  businessObjective: string,
  confirmedAgents: ProposedAgent[]
): string {
  // Build agents list with their tools
  const agentsList = confirmedAgents
    .map((agent) => {
      const toolsList = agent.tools.map((tool) => `    - ${tool}`).join('\n');
      return `- ${agent.name} (${agent.id})\n  Role: ${agent.role}\n  Tools:\n${toolsList}`;
    })
    .join('\n\n');

  return `Industry: ${industry}
Business Objective: ${businessObjective}

Agent Workflow:
${agentsList}

Based on this agent workflow for the ${industry} industry, suggest 2-3 key "aha moments" that would impress an audience during a demo. Each aha moment should highlight a specific capability of an agent or tool.

For each aha moment, provide:
1. A compelling title describing what impresses the audience
2. The trigger (either an agent name or tool name that triggers this moment)
3. A suggested talking point for the presenter

Return your response as a JSON array with this format:

\`\`\`json
[
  {
    "title": "string - the impressive capability",
    "triggerType": "agent" or "tool",
    "triggerName": "string - exact name of the agent or tool",
    "talkingPoint": "string - what the presenter should say"
  }
]
\`\`\`

Focus on moments that demonstrate automation, real-time capabilities, or intelligent decision-making.`;
}

/**
 * Build a context message for generating demo persona
 * Task 2.5: Context includes industry, business objective, and outcome definition
 *
 * @param industry The industry context from Step 1
 * @param businessObjective The business objective from Step 1
 * @param outcomeDefinition The primary outcome from Step 3
 * @returns Formatted context message string
 */
export function buildPersonaContextMessage(
  industry: string,
  businessObjective: string,
  outcomeDefinition: string
): string {
  return `Industry: ${industry}
Business Objective: ${businessObjective}
Expected Outcome: ${outcomeDefinition}

Create a realistic demo persona who would benefit from this workflow. The persona should:
- Have a realistic name and job role typical for the ${industry} industry
- Have a specific pain point that this agent workflow addresses
- Be relatable to the target audience

Return your response as a JSON object with this exact format:

\`\`\`json
{
  "name": "string - first and last name with optional title",
  "role": "string - job title and brief description of responsibilities",
  "painPoint": "string - specific pain point this workflow solves (be specific with time/effort wasted)"
}
\`\`\`

Make the persona feel authentic and the pain point measurable (e.g., "spends 2 hours daily", "loses 15% of orders").`;
}

/**
 * Build a context message for generating narrative flow
 * Task 2.6: Context includes agent design, edges/flow, and aha moments if defined
 *
 * @param confirmedAgents Array of confirmed agents from Step 5
 * @param confirmedEdges Array of edges defining workflow
 * @param ahaMoments Array of aha moments (if defined)
 * @returns Formatted context message string
 */
export function buildNarrativeContextMessage(
  confirmedAgents: ProposedAgent[],
  confirmedEdges: ProposedEdge[],
  ahaMoments: AhaMoment[]
): string {
  // Build agents summary
  const agentsSummary = confirmedAgents
    .map((agent) => `- ${agent.name} (${agent.id}): ${agent.role}`)
    .join('\n');

  // Build workflow flow description
  const flowDescription = confirmedEdges
    .map((edge) => {
      const condition = edge.condition ? ` (when: ${edge.condition})` : '';
      return `- ${edge.from} -> ${edge.to}${condition}`;
    })
    .join('\n');

  // Build aha moments context if available
  let ahaMomentsContext = '';
  if (ahaMoments.length > 0) {
    const momentsList = ahaMoments
      .map((moment) => `- "${moment.title}" (${moment.triggerType}: ${moment.triggerName})`)
      .join('\n');
    ahaMomentsContext = `\n\nKey Aha Moments to Highlight:
${momentsList}`;
  }

  return `Agent Design:
${agentsSummary}

Workflow Flow:
${flowDescription}${ahaMomentsContext}

Create a 4-5 scene demo flow for presenting this agent workflow. Each scene should:
- Have a clear title describing what happens in that scene
- Have a description (max 500 characters) explaining what to show/discuss
- Identify which agents are highlighted/active in that scene

Return your response as a JSON array with this format:

\`\`\`json
[
  {
    "title": "string - scene title",
    "description": "string - what happens in this scene (max 500 chars)",
    "highlightedAgents": ["agent_id_1", "agent_id_2"]
  }
]
\`\`\`

Structure the demo as a compelling story: setup the problem, show the solution in action, highlight key moments, and end with the outcome.`;
}

// ============================================================================
// JSON Response Parsing
// ============================================================================

/**
 * Generate a unique ID for items
 * Helper function following tasks.md pattern
 *
 * @returns Unique ID string
 */
function generateItemId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Parse aha moments from a Claude response that contains embedded JSON
 * Task 2.7: Extracts the JSON array and adds unique IDs
 *
 * @param response The full Claude response text
 * @returns Array of AhaMoment objects, or null if parsing fails
 */
export function parseAhaMomentsFromResponse(response: string): AhaMoment[] | null {
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

        // Validate and transform each aha moment
        const validMoments: AhaMoment[] = [];

        for (const item of parsed) {
          if (isValidAhaMoment(item)) {
            validMoments.push({
              id: generateItemId(),
              title: item.title,
              triggerType: item.triggerType,
              triggerName: item.triggerName,
              talkingPoint: item.talkingPoint,
            });
          }
        }

        if (validMoments.length > 0) {
          return validMoments;
        }
      } catch {
        // This JSON block didn't parse, try next one
        continue;
      }
    }

    // No valid aha moments found in any JSON block
    return null;
  } catch {
    // Any unexpected error - return null
    return null;
  }
}

/**
 * Type guard to check if an object has required aha moment fields
 */
function isValidAhaMoment(
  obj: unknown
): obj is {
  title: string;
  triggerType: 'agent' | 'tool';
  triggerName: string;
  talkingPoint: string;
} {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'title' in obj &&
    typeof (obj as { title: unknown }).title === 'string' &&
    'triggerType' in obj &&
    ((obj as { triggerType: unknown }).triggerType === 'agent' ||
      (obj as { triggerType: unknown }).triggerType === 'tool') &&
    'triggerName' in obj &&
    typeof (obj as { triggerName: unknown }).triggerName === 'string' &&
    'talkingPoint' in obj &&
    typeof (obj as { talkingPoint: unknown }).talkingPoint === 'string'
  );
}

/**
 * Parse demo persona from a Claude response that contains embedded JSON
 * Task 2.7: Extracts the JSON object
 *
 * @param response The full Claude response text
 * @returns DemoPersona object, or null if parsing fails
 */
export function parsePersonaFromResponse(response: string): DemoPersona | null {
  try {
    // Find JSON block in the response using regex
    const regex = /```json\s*([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(response)) !== null) {
      const jsonString = match[1].trim();

      try {
        const parsed = JSON.parse(jsonString);

        // Must be an object (not array)
        if (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null) {
          continue;
        }

        // Validate required fields
        if (isValidDemoPersona(parsed)) {
          return {
            name: parsed.name,
            role: parsed.role,
            painPoint: parsed.painPoint,
          };
        }
      } catch {
        // This JSON block didn't parse, try next one
        continue;
      }
    }

    // No valid persona found in any JSON block
    return null;
  } catch {
    // Any unexpected error - return null
    return null;
  }
}

/**
 * Type guard to check if an object has required demo persona fields
 */
function isValidDemoPersona(
  obj: unknown
): obj is {
  name: string;
  role: string;
  painPoint: string;
} {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'name' in obj &&
    typeof (obj as { name: unknown }).name === 'string' &&
    'role' in obj &&
    typeof (obj as { role: unknown }).role === 'string' &&
    'painPoint' in obj &&
    typeof (obj as { painPoint: unknown }).painPoint === 'string'
  );
}

/**
 * Parse narrative scenes from a Claude response that contains embedded JSON
 * Task 2.7: Extracts the JSON array and adds unique IDs
 *
 * @param response The full Claude response text
 * @returns Array of NarrativeScene objects, or null if parsing fails
 */
export function parseNarrativeScenesFromResponse(response: string): NarrativeScene[] | null {
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

        // Validate and transform each scene
        const validScenes: NarrativeScene[] = [];

        for (const item of parsed) {
          if (isValidNarrativeScene(item)) {
            validScenes.push({
              id: generateItemId(),
              title: item.title,
              description: item.description.substring(0, 500), // Enforce max 500 chars
              highlightedAgents: item.highlightedAgents || [],
            });
          }
        }

        if (validScenes.length > 0) {
          return validScenes;
        }
      } catch {
        // This JSON block didn't parse, try next one
        continue;
      }
    }

    // No valid scenes found in any JSON block
    return null;
  } catch {
    // Any unexpected error - return null
    return null;
  }
}

/**
 * Type guard to check if an object has required narrative scene fields
 */
function isValidNarrativeScene(
  obj: unknown
): obj is {
  title: string;
  description: string;
  highlightedAgents?: string[];
} {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'title' in obj &&
    typeof (obj as { title: unknown }).title === 'string' &&
    'description' in obj &&
    typeof (obj as { description: unknown }).description === 'string'
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

/**
 * Section type for tracking which section is being generated
 */
export type DemoStrategySection = 'moments' | 'persona' | 'narrative';

// ============================================================================
// DemoStrategyService Class
// ============================================================================

/**
 * Service class for demo strategy generation functionality
 * Task 2.2: Follows mockDataService.ts singleton pattern with EventEmitter
 * Tracks separate conversation histories for each section
 */
export class DemoStrategyService implements vscode.Disposable {
  /** Extension URI for resource loading */
  private readonly _extensionUri: vscode.Uri;

  /** Cached system prompt */
  private _systemPrompt: string | null = null;

  /** Conversation histories for each section */
  private _conversationHistories: Record<DemoStrategySection, ConversationMessage[]> = {
    moments: [],
    persona: [],
    narrative: [],
  };

  /** Current section being generated */
  private _currentSection: DemoStrategySection | null = null;

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
   * Creates a new DemoStrategyService
   * @param extensionUri The extension URI for loading resources
   */
  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  /**
   * Load the demo strategy system prompt from resources
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
      ...DEMO_STRATEGY_PROMPT_PATH.split('/')
    );

    const content = await vscode.workspace.fs.readFile(promptUri);
    this._systemPrompt = Buffer.from(content).toString('utf-8');

    return this._systemPrompt;
  }

  /**
   * Build context message for aha moments
   * Instance method wrapper for the utility function
   */
  public buildAhaMomentsContextMessage(
    industry: string,
    businessObjective: string,
    confirmedAgents: ProposedAgent[]
  ): string {
    return buildAhaMomentsContextMessage(industry, businessObjective, confirmedAgents);
  }

  /**
   * Build context message for persona
   * Instance method wrapper for the utility function
   */
  public buildPersonaContextMessage(
    industry: string,
    businessObjective: string,
    outcomeDefinition: string
  ): string {
    return buildPersonaContextMessage(industry, businessObjective, outcomeDefinition);
  }

  /**
   * Build context message for narrative
   * Instance method wrapper for the utility function
   */
  public buildNarrativeContextMessage(
    confirmedAgents: ProposedAgent[],
    confirmedEdges: ProposedEdge[],
    ahaMoments: AhaMoment[]
  ): string {
    return buildNarrativeContextMessage(confirmedAgents, confirmedEdges, ahaMoments);
  }

  /**
   * Parse aha moments from Claude response
   * Instance method wrapper for the utility function
   */
  public parseAhaMomentsFromResponse(response: string): AhaMoment[] | null {
    return parseAhaMomentsFromResponse(response);
  }

  /**
   * Parse persona from Claude response
   * Instance method wrapper for the utility function
   */
  public parsePersonaFromResponse(response: string): DemoPersona | null {
    return parsePersonaFromResponse(response);
  }

  /**
   * Parse narrative scenes from Claude response
   * Instance method wrapper for the utility function
   */
  public parseNarrativeScenesFromResponse(response: string): NarrativeScene[] | null {
    return parseNarrativeScenesFromResponse(response);
  }

  /**
   * Send a message and stream the response for a specific section
   * Implements both AsyncIterable and EventEmitter patterns
   *
   * @param userMessage The user's message to send
   * @param section The section being generated (moments, persona, narrative)
   * @yields Individual tokens as they stream from Bedrock
   */
  public async *sendMessage(
    userMessage: string,
    section: DemoStrategySection
  ): AsyncIterable<string> {
    // Prevent concurrent messages
    if (this._isStreaming) {
      const error = createBedrockInvalidRequestError('A message is already being processed');
      this._onError.fire(error);
      throw error;
    }

    this._isStreaming = true;
    this._currentSection = section;

    try {
      // Append user message to section-specific history
      this._appendUserMessage(userMessage, section);

      // Load system prompt if not cached
      const systemPrompt = await this.loadSystemPrompt();

      // Get model ID from config
      const modelId = await this._getModelId();

      // Execute with retry logic
      yield* this._executeWithRetry(systemPrompt, modelId, section);
    } catch (error) {
      this._isStreaming = false;
      this._currentSection = null;
      throw error;
    }
  }

  /**
   * Reset conversation history for a specific section
   *
   * @param section The section to reset (moments, persona, narrative)
   */
  public resetConversation(section: DemoStrategySection): void {
    this._conversationHistories[section] = [];
  }

  /**
   * Reset all conversation histories
   */
  public resetAllConversations(): void {
    this._conversationHistories = {
      moments: [],
      persona: [],
      narrative: [],
    };
  }

  /**
   * Get the current section being generated
   */
  public getCurrentSection(): DemoStrategySection | null {
    return this._currentSection;
  }

  /**
   * Dispose of all resources
   * Implements vscode.Disposable
   */
  public dispose(): void {
    this._onToken.dispose();
    this._onComplete.dispose();
    this._onError.dispose();
    this.resetAllConversations();
    this._systemPrompt = null;
  }

  // -------------------------------------------------------------------------
  // Private Methods - Conversation History
  // -------------------------------------------------------------------------

  /**
   * Append a user message to section-specific conversation history
   */
  private _appendUserMessage(message: string, section: DemoStrategySection): void {
    this._conversationHistories[section].push({
      role: 'user',
      content: [{ text: message }],
    });
  }

  /**
   * Append an assistant message to section-specific conversation history
   */
  private _appendAssistantMessage(message: string, section: DemoStrategySection): void {
    this._conversationHistories[section].push({
      role: 'assistant',
      content: [{ text: message }],
    });
  }

  // -------------------------------------------------------------------------
  // Private Methods - Configuration
  // -------------------------------------------------------------------------

  /**
   * Get the model ID from configuration
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
   */
  private async *_executeWithRetry(
    systemPrompt: string,
    modelId: string,
    section: DemoStrategySection
  ): AsyncIterable<string> {
    this._retryCount = 0;

    while (true) {
      try {
        yield* this._executeConverseStream(systemPrompt, modelId, section);
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
   */
  private async *_executeConverseStream(
    systemPrompt: string,
    modelId: string,
    section: DemoStrategySection
  ): AsyncIterable<string> {
    // Get Bedrock client
    const client = await getBedrockClientAsync();

    // Build the Converse command with section-specific history
    const command = new ConverseStreamCommand({
      modelId,
      system: [{ text: systemPrompt }],
      messages: this._conversationHistories[section],
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
          // Append complete response to section-specific history
          this._appendAssistantMessage(fullResponse, section);
          this._onComplete.fire(fullResponse);
          this._isStreaming = false;
          this._currentSection = null;
        }
      }
    }
  }

  /**
   * Handle errors from the Converse API
   */
  private async _handleError(error: unknown): Promise<boolean> {
    const errorObj = error as Error & { name?: string; $metadata?: { httpStatusCode?: number } };

    // Check for throttling exception
    if (
      errorObj.name === 'ThrottlingException' ||
      errorObj.name === 'ServiceQuotaExceededException'
    ) {
      if (this._retryCount >= MAX_RETRY_ATTEMPTS) {
        const agentifyError = createBedrockThrottledError();
        this._onError.fire(agentifyError);
        this._isStreaming = false;
        this._currentSection = null;
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
      this._currentSection = null;
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
      this._currentSection = null;
      return false;
    }

    // Handle model not found
    if (
      errorObj.name === 'ModelNotReadyException' ||
      errorObj.name === 'ResourceNotFoundException'
    ) {
      const configService = getConfigService();
      const config = await configService?.getConfig();
      const region = config?.infrastructure?.bedrock?.region || 'unknown';
      const modelIdConfig = config?.infrastructure?.bedrock?.modelId || DEFAULT_MODEL_ID;

      const agentifyError = createBedrockModelNotAvailableError(modelIdConfig, region, errorObj);
      this._onError.fire(agentifyError);
      this._isStreaming = false;
      this._currentSection = null;
      return false;
    }

    // Generic network/connection error
    const agentifyError = createBedrockNetworkError(errorObj);
    this._onError.fire(agentifyError);
    this._isStreaming = false;
    this._currentSection = null;
    return false;
  }
}

// ============================================================================
// Singleton Pattern
// ============================================================================

/**
 * Singleton instance of the service
 */
let instance: DemoStrategyService | null = null;

/**
 * Get the singleton DemoStrategyService instance
 * Task 2.2: Export singleton getter following mockDataService pattern
 *
 * @param context The VS Code extension context (required for first call)
 * @returns The DemoStrategyService singleton
 */
export function getDemoStrategyService(
  context: vscode.ExtensionContext
): DemoStrategyService {
  if (!instance) {
    instance = new DemoStrategyService(context.extensionUri);
  }
  return instance;
}

/**
 * Reset the singleton instance
 * Useful for testing or cleanup
 */
export function resetDemoStrategyService(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
