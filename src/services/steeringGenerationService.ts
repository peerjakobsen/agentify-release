/**
 * Steering Generation Service
 *
 * Service for generating 8 steering document files using Amazon Bedrock.
 * Implements parallel generation with progress events for UI feedback.
 *
 * This service follows the singleton pattern established by MockDataService
 * and uses EventEmitter pattern from BedrockConversationService for progress events.
 *
 * @see spec.md - Steering Generation Service specification
 * @see tasks.md - Task Groups 2 & 3: Service Core and Generation Methods
 */

import * as vscode from 'vscode';
import { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { getBedrockClientAsync } from './bedrockClient';
import { getConfigService } from './configService';
import type { WizardState } from '../types/wizardPanel';
import {
  mapToProductContext,
  mapToTechContext,
  mapToStructureContext,
  mapToCustomerContext,
  mapToIntegrationContext,
  mapToSecurityContext,
  mapToDemoContext,
  mapToAgentifyContext,
} from '../utils/steeringStateMapper';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default model ID for steering document generation
 * Using Sonnet for cost efficiency as per requirements
 */
const DEFAULT_MODEL_ID = 'global.anthropic.claude-sonnet-4-5-20250929-v1:0';

/**
 * Maximum number of retry attempts per document
 */
const MAX_RETRIES = 2;

/**
 * Initial backoff interval for retry (1 second)
 */
const INITIAL_BACKOFF_MS = 1000;

/**
 * Backoff multiplier for exponential increase
 */
const BACKOFF_MULTIPLIER = 2;

/**
 * Path to steering prompts directory relative to extension root
 */
const STEERING_PROMPTS_PATH = 'resources/prompts/steering';

/**
 * Mapping of output file names to prompt file names
 * Maps: output file key (without .md) -> prompt file name
 *
 * Example: 'product' -> 'product-steering.prompt.md' generates 'product.md'
 */
export const STEERING_PROMPT_FILES: Record<string, string> = {
  'product': 'product-steering.prompt.md',
  'tech': 'tech-steering.prompt.md',
  'structure': 'structure-steering.prompt.md',
  'customer-context': 'customer-context-steering.prompt.md',
  'integration-landscape': 'integration-landscape-steering.prompt.md',
  'security-policies': 'security-policies-steering.prompt.md',
  'demo-strategy': 'demo-strategy-steering.prompt.md',
  'agentify-integration': 'agentify-integration-steering.prompt.md',
};

/**
 * Ordered list of steering file keys for generation
 */
export const STEERING_FILE_KEYS = [
  'product',
  'tech',
  'structure',
  'customer-context',
  'integration-landscape',
  'security-policies',
  'demo-strategy',
  'agentify-integration',
];

/**
 * Error names that are retryable (transient errors)
 */
const RETRYABLE_ERROR_NAMES = [
  'ThrottlingException',
  'ServiceQuotaExceededException',
  'InternalServerException',
  'ServiceUnavailableException',
];

// ============================================================================
// Event Interfaces
// ============================================================================

/**
 * Event emitted when file generation starts
 * Includes index metadata for UI progress display ordering
 */
export interface FileProgressEvent {
  /** Name of the file being generated (e.g., 'product.md') */
  fileName: string;
  /** Index of the current file (0-based) */
  index: number;
  /** Total number of files to generate */
  total: number;
}

/**
 * Event emitted when file generation completes successfully
 * Extends FileProgressEvent with generated content
 */
export interface FileCompleteEvent extends FileProgressEvent {
  /** Generated document content */
  content: string;
}

/**
 * Event emitted when file generation fails
 * Extends FileProgressEvent with error information
 */
export interface FileErrorEvent extends FileProgressEvent {
  /** Error message describing the failure */
  error: string;
}

// ============================================================================
// Result Interfaces
// ============================================================================

/**
 * Generated file result containing content and status
 */
export interface GeneratedFile {
  /** File name (e.g., 'product.md') */
  fileName: string;
  /** Generated content (empty string if failed) */
  content: string;
  /** Generation status */
  status: 'created' | 'failed';
  /** Error message if status is 'failed' */
  error?: string;
}

/**
 * Result of steering file generation
 */
export interface GenerationResult {
  /** Whether all files were generated successfully */
  success: boolean;
  /** Array of generated files with content and status */
  files: GeneratedFile[];
  /** Array of errors for failed files (if any) */
  errors?: Array<{ file: string; error: string }>;
}

// ============================================================================
// Context Mapper Type
// ============================================================================

/**
 * Type for state mapper functions
 */
type StateMapper = (state: WizardState) => object;

/**
 * Mapping of file keys to their state mapper functions
 */
const STATE_MAPPERS: Record<string, StateMapper> = {
  'product': mapToProductContext,
  'tech': mapToTechContext,
  'structure': mapToStructureContext,
  'customer-context': mapToCustomerContext,
  'integration-landscape': mapToIntegrationContext,
  'security-policies': mapToSecurityContext,
  'demo-strategy': mapToDemoContext,
  'agentify-integration': mapToAgentifyContext,
};

// ============================================================================
// SteeringGenerationService Class
// ============================================================================

/**
 * Service class for generating steering documents using Amazon Bedrock.
 *
 * Implements:
 * - Prompt loading and caching
 * - EventEmitter pattern for progress events
 * - Singleton pattern via getter function
 * - vscode.Disposable for resource cleanup
 */
export class SteeringGenerationService implements vscode.Disposable {
  // -------------------------------------------------------------------------
  // Private State Fields
  // -------------------------------------------------------------------------

  /** Extension URI for resource loading */
  private readonly _extensionUri: vscode.Uri;

  /** Cached prompts: Map<outputFileKey, promptContent> */
  private readonly _promptCache: Map<string, string> = new Map();

  // -------------------------------------------------------------------------
  // EventEmitters (VS Code pattern)
  // -------------------------------------------------------------------------

  /** Event emitter for file generation start */
  private readonly _onFileStart = new vscode.EventEmitter<FileProgressEvent>();

  /** Public event for subscribing to file start events */
  public readonly onFileStart = this._onFileStart.event;

  /** Event emitter for file generation complete */
  private readonly _onFileComplete = new vscode.EventEmitter<FileCompleteEvent>();

  /** Public event for subscribing to file complete events */
  public readonly onFileComplete = this._onFileComplete.event;

  /** Event emitter for file generation error */
  private readonly _onFileError = new vscode.EventEmitter<FileErrorEvent>();

  /** Public event for subscribing to file error events */
  public readonly onFileError = this._onFileError.event;

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  /**
   * Creates a new SteeringGenerationService
   * @param extensionUri The extension URI for loading resources
   */
  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  // -------------------------------------------------------------------------
  // Public Methods - Prompt Loading
  // -------------------------------------------------------------------------

  /**
   * Load a prompt file by output file key
   * Caches the prompt after first load to avoid repeated filesystem reads
   *
   * @param fileKey Output file key (e.g., 'product' for 'product.md')
   * @returns The prompt content
   * @throws Error if prompt file cannot be read
   */
  public async loadPrompt(fileKey: string): Promise<string> {
    // Return cached prompt if available
    if (this._promptCache.has(fileKey)) {
      return this._promptCache.get(fileKey)!;
    }

    // Get prompt filename from mapping
    const promptFileName = STEERING_PROMPT_FILES[fileKey];
    if (!promptFileName) {
      throw new Error(`Unknown steering file key: ${fileKey}`);
    }

    // Build URI to prompt file using vscode.Uri.joinPath pattern
    const promptUri = vscode.Uri.joinPath(
      this._extensionUri,
      STEERING_PROMPTS_PATH,
      promptFileName
    );

    // Read and decode the prompt file
    const content = await vscode.workspace.fs.readFile(promptUri);
    const promptText = Buffer.from(content).toString('utf-8');

    // Cache for subsequent calls
    this._promptCache.set(fileKey, promptText);

    return promptText;
  }

  /**
   * Preload all prompts into cache
   * Called before generation to avoid filesystem reads during parallel execution
   */
  public async preloadAllPrompts(): Promise<void> {
    const loadPromises = STEERING_FILE_KEYS.map((key) => this.loadPrompt(key));
    await Promise.all(loadPromises);
  }

  // -------------------------------------------------------------------------
  // Public Methods - Configuration
  // -------------------------------------------------------------------------

  /**
   * Get the model ID for steering document generation
   *
   * Priority:
   * 1. config.infrastructure.bedrock.modelId (Bedrock model override)
   * 2. DEFAULT_MODEL_ID (Sonnet)
   *
   * @returns The Bedrock model ID to use
   */
  public async getModelId(): Promise<string> {
    const configService = getConfigService();
    const config = await configService?.getConfig();

    // Check for Bedrock model ID override in config
    const bedrockModelId = config?.infrastructure?.bedrock?.modelId;
    if (bedrockModelId) {
      return bedrockModelId;
    }

    // Default to Sonnet
    return DEFAULT_MODEL_ID;
  }

  // -------------------------------------------------------------------------
  // Public Methods - Generation
  // -------------------------------------------------------------------------

  /**
   * Generate a single steering document
   * Task 3.2: Calls Bedrock ConverseCommand with system prompt and context
   *
   * @param promptKey The prompt key (e.g., 'product')
   * @param context The context object for the prompt
   * @returns Generated document content
   */
  public async generateDocument(
    promptKey: string,
    context: object
  ): Promise<string> {
    // Load the prompt
    const systemPrompt = await this.loadPrompt(promptKey);

    // Get model ID
    const modelId = await this.getModelId();

    // Get Bedrock client
    const client = await getBedrockClientAsync();

    // Build user message with JSON-serialized context
    const userMessage = `Generate the steering document based on the following context:\n\n${JSON.stringify(context, null, 2)}`;

    // Use non-streaming ConverseCommand (following AgentDesignService.suggestEdgesForPattern)
    const command = new ConverseCommand({
      modelId,
      system: [{ text: systemPrompt }],
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

    if (!responseText) {
      throw new Error('Empty response from Bedrock');
    }

    return responseText;
  }

  /**
   * Generate all steering files in parallel
   * Task 3.4: Uses Promise.allSettled for parallel execution
   *
   * @param state The wizard state
   * @returns Generation result with files and status
   */
  public async generateSteeringFiles(
    state: WizardState
  ): Promise<GenerationResult> {
    // Preload all prompts before parallel generation
    await this.preloadAllPrompts();

    const total = STEERING_FILE_KEYS.length;
    const files: GeneratedFile[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    // Create generation tasks for all files
    const generationTasks = STEERING_FILE_KEYS.map(async (fileKey, index) => {
      const fileName = `${fileKey}.md`;

      // Emit start event
      this._onFileStart.fire({ fileName, index, total });

      try {
        // Get context mapper for this file
        const mapper = STATE_MAPPERS[fileKey];
        if (!mapper) {
          throw new Error(`No mapper found for file key: ${fileKey}`);
        }

        // Map state to context
        const context = mapper(state);

        // Generate with retry
        const content = await this._generateWithRetry(fileKey, context);

        // Emit complete event
        this._onFileComplete.fire({ fileName, index, total, content });

        return {
          fileName,
          content,
          status: 'created' as const,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Emit error event
        this._onFileError.fire({ fileName, index, total, error: errorMessage });

        return {
          fileName,
          content: '',
          status: 'failed' as const,
          error: errorMessage,
        };
      }
    });

    // Execute all tasks in parallel using Promise.allSettled
    const results = await Promise.allSettled(generationTasks);

    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        files.push(result.value);
        if (result.value.status === 'failed' && result.value.error) {
          errors.push({ file: result.value.fileName, error: result.value.error });
        }
      } else {
        // This should not happen since we catch errors inside the task
        // But handle it just in case
        files.push({
          fileName: 'unknown.md',
          content: '',
          status: 'failed',
          error: result.reason?.message || 'Unknown error',
        });
        errors.push({
          file: 'unknown.md',
          error: result.reason?.message || 'Unknown error',
        });
      }
    }

    // Determine overall success
    const success = errors.length === 0;

    return {
      success,
      files,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Retry generation for specific failed files
   * Task 3.5: Selective retry for manual recovery
   *
   * @param state The wizard state
   * @param fileNames Array of file names to regenerate (e.g., ['product.md', 'tech.md'])
   * @returns Generation result with only the retried files
   */
  public async retryFiles(
    state: WizardState,
    fileNames: string[]
  ): Promise<GenerationResult> {
    // Convert file names to keys (remove .md extension)
    const fileKeys = fileNames.map((name) => name.replace(/\.md$/, ''));

    // Filter to valid keys only
    const validKeys = fileKeys.filter((key) => STEERING_FILE_KEYS.includes(key));

    if (validKeys.length === 0) {
      return {
        success: true,
        files: [],
      };
    }

    // Preload prompts for the files we need to retry
    await Promise.all(validKeys.map((key) => this.loadPrompt(key)));

    const total = validKeys.length;
    const files: GeneratedFile[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    // Create generation tasks for requested files only
    const generationTasks = validKeys.map(async (fileKey, index) => {
      const fileName = `${fileKey}.md`;

      // Emit start event
      this._onFileStart.fire({ fileName, index, total });

      try {
        // Get context mapper for this file
        const mapper = STATE_MAPPERS[fileKey];
        if (!mapper) {
          throw new Error(`No mapper found for file key: ${fileKey}`);
        }

        // Map state to context
        const context = mapper(state);

        // Generate with retry
        const content = await this._generateWithRetry(fileKey, context);

        // Emit complete event
        this._onFileComplete.fire({ fileName, index, total, content });

        return {
          fileName,
          content,
          status: 'created' as const,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Emit error event
        this._onFileError.fire({ fileName, index, total, error: errorMessage });

        return {
          fileName,
          content: '',
          status: 'failed' as const,
          error: errorMessage,
        };
      }
    });

    // Execute all tasks in parallel using Promise.allSettled
    const results = await Promise.allSettled(generationTasks);

    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        files.push(result.value);
        if (result.value.status === 'failed' && result.value.error) {
          errors.push({ file: result.value.fileName, error: result.value.error });
        }
      } else {
        files.push({
          fileName: 'unknown.md',
          content: '',
          status: 'failed',
          error: result.reason?.message || 'Unknown error',
        });
        errors.push({
          file: 'unknown.md',
          error: result.reason?.message || 'Unknown error',
        });
      }
    }

    // Determine overall success
    const success = errors.length === 0;

    return {
      success,
      files,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Private Methods - Retry Logic
  // -------------------------------------------------------------------------

  /**
   * Generate document with retry logic
   * Task 3.3: Implements exponential backoff for transient failures
   *
   * @param fileKey The file key (e.g., 'product')
   * @param context The context object for the prompt
   * @returns Generated content string
   * @throws Error after max retries exhausted
   */
  private async _generateWithRetry(
    fileKey: string,
    context: object
  ): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.generateDocument(fileKey, context);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        const errorName = (error as { name?: string })?.name || '';
        const isRetryable = RETRYABLE_ERROR_NAMES.includes(errorName);

        if (!isRetryable || attempt >= MAX_RETRIES) {
          // Non-retryable error or max retries exhausted
          throw lastError;
        }

        // Calculate backoff delay: 1s, 2s (exponential)
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attempt);

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    // Should not reach here, but throw last error just in case
    throw lastError || new Error('Generation failed after retries');
  }

  // -------------------------------------------------------------------------
  // Public Methods - Dispose
  // -------------------------------------------------------------------------

  /**
   * Dispose of all resources
   * Implements vscode.Disposable for proper EventEmitter cleanup
   */
  public dispose(): void {
    this._onFileStart.dispose();
    this._onFileComplete.dispose();
    this._onFileError.dispose();
    this._promptCache.clear();
  }
}

// ============================================================================
// Singleton Pattern
// ============================================================================

/**
 * Singleton instance of the service
 */
let instance: SteeringGenerationService | null = null;

/**
 * Get the singleton SteeringGenerationService instance
 * Creates the instance on first call (lazy initialization)
 *
 * @param context The VS Code extension context (required for first call)
 * @returns The SteeringGenerationService singleton
 */
export function getSteeringGenerationService(
  context: vscode.ExtensionContext
): SteeringGenerationService {
  if (!instance) {
    instance = new SteeringGenerationService(context.extensionUri);
  }
  return instance;
}

/**
 * Reset the singleton instance
 * Useful for testing or when cleanup is needed
 */
export function resetSteeringGenerationService(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
