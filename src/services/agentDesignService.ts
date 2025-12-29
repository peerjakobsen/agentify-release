/**
 * Agent Design Service
 *
 * Provides utility functions for the AI agent design proposal in Step 5 of the
 * Ideation Wizard. Handles context message building, JSON proposal parsing from
 * Claude responses, and manages a dedicated Bedrock conversation for agent proposals.
 *
 * This service follows the singleton pattern established by OutcomeDefinitionService.
 */

import * as vscode from 'vscode';
import { ConverseStreamCommand, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { getBedrockClientAsync } from './bedrockClient';
import { getConfigService } from './configService';
import type {
  AgentProposalResponse,
  OrchestrationPattern,
  ProposedAgent,
  ProposedEdge,
  SystemAssumption,
  SuccessMetric,
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
 * Path to the agent design assistant prompt relative to extension root
 */
const AGENT_DESIGN_PROMPT_PATH = 'resources/prompts/agent-design-assistant.md';

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

/**
 * System prompt for edge suggestion based on orchestration pattern
 * Task 3.4: Explains pattern characteristics and asks for appropriate edge suggestions
 */
const EDGE_SUGGESTION_SYSTEM_PROMPT = `You are an AI agent workflow architect. Your task is to suggest appropriate edges (connections) between agents based on the selected orchestration pattern.

Orchestration Pattern Characteristics:

**Graph Pattern:**
- Complex, conditional workflows with decision points
- Edges can have conditions that determine when they are followed
- Multiple paths possible based on runtime conditions
- Best for workflows with branching logic and multiple outcomes
- Typical edges: conditional transitions, approval gates, fallback paths

**Swarm Pattern:**
- Parallel, autonomous agents with emergent coordination
- Agents can communicate with multiple other agents
- No strict hierarchy - peer-to-peer communication
- Best for collaborative tasks where agents share information
- Typical edges: bidirectional communication, broadcast connections

**Workflow Pattern:**
- Sequential, linear pipelines with defined steps
- Each agent hands off to the next in a chain
- Clear start and end points
- Best for straightforward processes with predictable steps
- Typical edges: single direction, sequential flow

When suggesting edges, provide them in JSON format:
\`\`\`json
{
  "edges": [
    { "from": "agent_id_1", "to": "agent_id_2" },
    { "from": "agent_id_2", "to": "agent_id_3" }
  ]
}
\`\`\`

Use the exact agent IDs provided in the input.`;

// ============================================================================
// Context Message Building
// ============================================================================

/**
 * Build a context message from Steps 1-4 inputs to send to Claude for agent design
 * Formats the business objective, industry, systems, assumptions, outcomes, and security
 * into a structured prompt
 *
 * @param businessObjective The user's business objective/problem statement
 * @param industry The selected industry vertical
 * @param systems Array of selected system names
 * @param customSystems Optional comma-separated string of additional systems
 * @param confirmedAssumptions Array of confirmed assumptions from Step 2
 * @param primaryOutcome The primary outcome statement from Step 3
 * @param successMetrics Array of success metrics from Step 3
 * @param dataSensitivity Data sensitivity classification from Step 4
 * @param complianceFrameworks Array of compliance frameworks from Step 4
 * @param approvalGates Array of approval gates from Step 4
 * @returns Formatted context message string
 */
export function buildAgentDesignContextMessage(
  businessObjective: string,
  industry: string,
  systems: string[],
  customSystems: string | undefined,
  confirmedAssumptions: SystemAssumption[],
  primaryOutcome: string,
  successMetrics: SuccessMetric[],
  dataSensitivity: string,
  complianceFrameworks: string[],
  approvalGates: string[]
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

  // Format success metrics
  let metricsText = 'No specific metrics defined.';
  if (successMetrics.length > 0) {
    const metricLines = successMetrics.map((m) =>
      `- ${m.name}: ${m.targetValue} ${m.unit}`
    );
    metricsText = metricLines.join('\n');
  }

  // Format compliance frameworks
  const complianceText = complianceFrameworks.length > 0
    ? complianceFrameworks.join(', ')
    : 'None specified';

  // Format approval gates
  const approvalText = approvalGates.length > 0
    ? approvalGates.join(', ')
    : 'None specified';

  return `Business Objective: ${businessObjective}

Industry: ${industry}

Systems: ${systemsList}

Confirmed System Assumptions:
${assumptionsText}

Primary Outcome: ${primaryOutcome}

Success Metrics:
${metricsText}

Security Configuration:
- Data Sensitivity: ${dataSensitivity}
- Compliance Frameworks: ${complianceText}
- Approval Gates: ${approvalText}

Based on this complete business context, please design an optimal agent team to achieve the stated outcome. Consider:
1. Which specialized agents are needed based on the systems and integrations
2. What tools each agent should have (use the format: {system}_{operation} in lowercase snake_case)
3. The best orchestration pattern (graph, swarm, or workflow) for this use case
4. How agents should interact and pass information

Please provide your agent design proposal in the required JSON format.`;
}

// ============================================================================
// JSON Proposal Parsing
// ============================================================================

/**
 * Parse agent proposal from a Claude response that contains embedded JSON
 * Extracts the JSON block between markdown code fences and parses the AgentProposalResponse
 *
 * @param response The full Claude response text (may include prose and JSON)
 * @returns AgentProposalResponse object, or null if parsing fails
 */
export function parseAgentProposalFromResponse(response: string): AgentProposalResponse | null {
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

    // Try each JSON block until we find one with valid agent proposal
    for (const m of matches) {
      const jsonString = m[1].trim();

      try {
        const parsed = JSON.parse(jsonString);

        // Check if this JSON has the required agent proposal fields
        if (isValidAgentProposal(parsed)) {
          return validateAndTransformAgentProposal(parsed);
        }
      } catch {
        // This JSON block didn't parse or doesn't have proposal fields, try next one
        continue;
      }
    }

    // No valid agent proposal found in any JSON block
    return null;
  } catch {
    // Any unexpected error - return null
    return null;
  }
}

/**
 * Parse edge suggestion from a Claude response
 * Task 3.4: Extracts edges array from JSON response
 *
 * @param response The full Claude response text
 * @returns Array of ProposedEdge, or null if parsing fails
 */
export function parseEdgeSuggestionFromResponse(response: string): ProposedEdge[] | null {
  try {
    // Find JSON block in the response
    const regex = /```json\s*([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(response)) !== null) {
      const jsonString = match[1].trim();

      try {
        const parsed = JSON.parse(jsonString);

        // Check if this JSON has edges array
        if (parsed && Array.isArray(parsed.edges)) {
          const validEdges: ProposedEdge[] = [];

          for (const edge of parsed.edges) {
            if (isValidEdge(edge)) {
              validEdges.push({
                from: edge.from.toLowerCase(),
                to: edge.to.toLowerCase(),
              });
            }
          }

          if (validEdges.length > 0) {
            return validEdges;
          }
        }
      } catch {
        // This JSON block didn't parse, try next one
        continue;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Type guard to check if a parsed object has the required agent proposal fields
 *
 * @param obj Unknown object to validate
 * @returns True if object has required agent proposal structure
 */
function isValidAgentProposal(
  obj: unknown
): obj is { agents: unknown[]; orchestrationPattern: string; edges: unknown[]; reasoning: string } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'agents' in obj &&
    Array.isArray((obj as { agents: unknown }).agents) &&
    'orchestrationPattern' in obj &&
    typeof (obj as { orchestrationPattern: unknown }).orchestrationPattern === 'string' &&
    'edges' in obj &&
    Array.isArray((obj as { edges: unknown }).edges) &&
    'reasoning' in obj &&
    typeof (obj as { reasoning: unknown }).reasoning === 'string'
  );
}

/**
 * Validate and transform raw agent proposal into typed AgentProposalResponse
 * Ensures all required fields exist and are properly typed
 * Initializes edited flags to false for AI-generated agents
 *
 * @param raw Raw agent proposal object from JSON
 * @returns Validated and transformed AgentProposalResponse object
 */
function validateAndTransformAgentProposal(
  raw: { agents: unknown[]; orchestrationPattern: string; edges: unknown[]; reasoning: string }
): AgentProposalResponse {
  // Transform agents, filtering out invalid ones
  // Initialize edited flags to false since these are AI-generated agents
  const validAgents: ProposedAgent[] = [];
  for (const agent of raw.agents) {
    if (isValidAgent(agent)) {
      validAgents.push({
        id: agent.id.toLowerCase(),
        name: agent.name,
        role: agent.role,
        tools: agent.tools.map((t) => t.toLowerCase()),
        // Phase 2: Initialize edited flags to false for AI-generated agents
        nameEdited: false,
        roleEdited: false,
        toolsEdited: false,
      });
    }
  }

  // Validate orchestration pattern
  const orchestrationPattern: OrchestrationPattern =
    isValidOrchestrationPattern(raw.orchestrationPattern)
      ? raw.orchestrationPattern
      : 'workflow';

  // Transform edges, filtering out invalid ones
  const validEdges: ProposedEdge[] = [];
  for (const edge of raw.edges) {
    if (isValidEdge(edge)) {
      const transformedEdge: ProposedEdge = {
        from: edge.from.toLowerCase(),
        to: edge.to.toLowerCase(),
      };
      if (edge.condition) {
        transformedEdge.condition = edge.condition;
      }
      validEdges.push(transformedEdge);
    }
  }

  return {
    agents: validAgents,
    orchestrationPattern,
    edges: validEdges,
    reasoning: raw.reasoning.trim(),
  };
}

/**
 * Type guard to check if an object is a valid ProposedAgent structure
 *
 * @param obj Unknown object to validate
 * @returns True if object has required agent structure
 */
function isValidAgent(
  obj: unknown
): obj is { id: string; name: string; role: string; tools: string[] } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    typeof (obj as { id: unknown }).id === 'string' &&
    'name' in obj &&
    typeof (obj as { name: unknown }).name === 'string' &&
    'role' in obj &&
    typeof (obj as { role: unknown }).role === 'string' &&
    'tools' in obj &&
    Array.isArray((obj as { tools: unknown }).tools)
  );
}

/**
 * Type guard to check if an object is a valid ProposedEdge structure
 *
 * @param obj Unknown object to validate
 * @returns True if object has required edge structure
 */
function isValidEdge(
  obj: unknown
): obj is { from: string; to: string; condition?: string } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'from' in obj &&
    typeof (obj as { from: unknown }).from === 'string' &&
    'to' in obj &&
    typeof (obj as { to: unknown }).to === 'string'
  );
}

/**
 * Type guard to check if a string is a valid orchestration pattern
 *
 * @param pattern String to validate
 * @returns True if pattern is a valid OrchestrationPattern
 */
function isValidOrchestrationPattern(pattern: string): pattern is OrchestrationPattern {
  return pattern === 'graph' || pattern === 'swarm' || pattern === 'workflow';
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
// AgentDesignService Class
// ============================================================================

/**
 * Service class for agent design proposal functionality
 * Provides instance methods for loading system prompts and managing
 * a dedicated Bedrock conversation for agent design proposals
 */
export class AgentDesignService implements vscode.Disposable {
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
   * Creates a new AgentDesignService
   * @param extensionUri The extension URI for loading resources
   */
  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  /**
   * Load the agent design system prompt from resources
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
      ...AGENT_DESIGN_PROMPT_PATH.split('/')
    );

    const content = await vscode.workspace.fs.readFile(promptUri);
    this._systemPrompt = Buffer.from(content).toString('utf-8');

    return this._systemPrompt;
  }

  /**
   * Build context message from Steps 1-4 inputs
   * Instance method wrapper for the utility function
   */
  public buildAgentDesignContextMessage(
    businessObjective: string,
    industry: string,
    systems: string[],
    customSystems: string | undefined,
    confirmedAssumptions: SystemAssumption[],
    primaryOutcome: string,
    successMetrics: SuccessMetric[],
    dataSensitivity: string,
    complianceFrameworks: string[],
    approvalGates: string[]
  ): string {
    return buildAgentDesignContextMessage(
      businessObjective,
      industry,
      systems,
      customSystems,
      confirmedAssumptions,
      primaryOutcome,
      successMetrics,
      dataSensitivity,
      complianceFrameworks,
      approvalGates
    );
  }

  /**
   * Parse agent proposal from Claude response
   * Instance method wrapper for the utility function
   */
  public parseAgentProposalFromResponse(response: string): AgentProposalResponse | null {
    return parseAgentProposalFromResponse(response);
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

  // =========================================================================
  // Task 3.4: Suggest Edges for Pattern Method
  // =========================================================================

  /**
   * Suggest appropriate edges for a given orchestration pattern
   * Task 3.4: Uses AI to suggest edges based on pattern characteristics
   *
   * @param agents Current list of proposed agents
   * @param pattern The selected orchestration pattern
   * @returns Array of suggested edges, or null if suggestion fails
   */
  public async suggestEdgesForPattern(
    agents: ProposedAgent[],
    pattern: OrchestrationPattern
  ): Promise<ProposedEdge[] | null> {
    // Build the prompt with agent information and selected pattern
    const agentsList = agents
      .map(a => `- ${a.id}: ${a.name} (${a.role})`)
      .join('\n');

    const userMessage = `Given the following agents:

${agentsList}

The user has selected the "${pattern}" orchestration pattern.

Please suggest appropriate edges (connections) between these agents that would be suitable for a ${pattern} pattern. Consider the pattern characteristics and the agents' roles when determining the connections.

Provide your suggested edges in JSON format.`;

    try {
      // Get model ID from config
      const modelId = await this._getModelId();

      // Get Bedrock client
      const client = await getBedrockClientAsync();

      // Use non-streaming Converse API for this quick request
      const command = new ConverseCommand({
        modelId,
        system: [{ text: EDGE_SUGGESTION_SYSTEM_PROMPT }],
        messages: [
          {
            role: 'user',
            content: [{ text: userMessage }],
          },
        ],
      });

      const response = await client.send(command);

      // Extract text from response
      const responseText = response.output?.message?.content?.[0]?.text;

      if (responseText) {
        // Parse the edge suggestion from the response
        return parseEdgeSuggestionFromResponse(responseText);
      }

      return null;
    } catch (error) {
      // Edge suggestion is non-blocking - log and return null
      console.warn('[AgentDesignService] Edge suggestion failed:', error);
      return null;
    }
  }

  /**
   * Reset conversation history for a new proposal request
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
let instance: AgentDesignService | null = null;

/**
 * Get the singleton AgentDesignService instance
 *
 * @param context The VS Code extension context (required for first call)
 * @returns The AgentDesignService singleton
 */
export function getAgentDesignService(
  context: vscode.ExtensionContext
): AgentDesignService {
  if (!instance) {
    instance = new AgentDesignService(context.extensionUri);
  }
  return instance;
}

/**
 * Reset the singleton instance
 * Useful for testing or cleanup
 */
export function resetAgentDesignService(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
