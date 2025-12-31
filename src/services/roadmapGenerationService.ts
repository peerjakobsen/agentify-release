/**
 * Roadmap Generation Service
 *
 * Service for generating roadmap.md from steering files using Amazon Bedrock.
 * Implements singleton pattern with EventEmitter for progress events.
 *
 * This service follows the same patterns as SteeringGenerationService but handles
 * a single file generation (roadmap.md) rather than parallel generation.
 *
 * @see spec.md - Implementation Roadmap Generation (Phase 2) specification
 * @see tasks.md - Task Group 1: Roadmap Generation Service
 */

import * as vscode from 'vscode';
import { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { getBedrockClientAsync } from './bedrockClient';
import { getConfigService } from './configService';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default model ID for roadmap generation
 * Using Sonnet for cost efficiency as per requirements
 */
const DEFAULT_MODEL_ID = 'global.anthropic.claude-sonnet-4-5-20250929-v1:0';

/**
 * Path to roadmap prompt file relative to extension root
 */
const ROADMAP_PROMPT_PATH = 'resources/prompts/steering/roadmap-steering.prompt.md';

/**
 * Required steering files for roadmap generation
 * These 4 files must exist before roadmap can be generated
 */
export const REQUIRED_STEERING_FILES = [
  'tech.md',
  'structure.md',
  'integration-landscape.md',
  'agentify-integration.md',
] as const;

/**
 * Output file name for the generated roadmap
 * Written to project root as human-facing documentation
 */
export const ROADMAP_OUTPUT_FILE = 'ROADMAP.md';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Steering file content with filename
 */
export interface SteeringFileContent {
  /** Filename without path (e.g., 'tech.md') */
  filename: string;
  /** File content as string */
  content: string;
}

/**
 * Event payload for generation start
 */
export interface GenerationStartEvent {
  /** Timestamp when generation started */
  startTime: number;
}

/**
 * Event payload for generation complete
 */
export interface GenerationCompleteEvent {
  /** Path to the generated roadmap.md file */
  filePath: string;
  /** Generated content */
  content: string;
}

/**
 * Event payload for generation error
 */
export interface GenerationErrorEvent {
  /** Error message */
  error: string;
  /** Missing files if the error was due to missing steering files */
  missingFiles?: string[];
}

// ============================================================================
// RoadmapGenerationService Class
// ============================================================================

/**
 * Service class for generating roadmap.md using Amazon Bedrock.
 *
 * Implements:
 * - Steering file loading from .kiro/steering/
 * - XML formatting of steering file contents
 * - Bedrock API integration for content generation
 * - EventEmitter pattern for progress events
 * - Singleton pattern via getter function
 * - vscode.Disposable for resource cleanup
 */
export class RoadmapGenerationService implements vscode.Disposable {
  // -------------------------------------------------------------------------
  // Private State Fields
  // -------------------------------------------------------------------------

  /** Extension URI for resource loading */
  private readonly _extensionUri: vscode.Uri;

  /** Cached prompt content to avoid repeated file reads */
  private _promptCache: string | null = null;

  // -------------------------------------------------------------------------
  // EventEmitters (VS Code pattern)
  // -------------------------------------------------------------------------

  /** Event emitter for generation start */
  private readonly _onGenerationStart = new vscode.EventEmitter<GenerationStartEvent>();

  /** Public event for subscribing to generation start events */
  public readonly onGenerationStart = this._onGenerationStart.event;

  /** Event emitter for generation complete */
  private readonly _onGenerationComplete = new vscode.EventEmitter<GenerationCompleteEvent>();

  /** Public event for subscribing to generation complete events */
  public readonly onGenerationComplete = this._onGenerationComplete.event;

  /** Event emitter for generation error */
  private readonly _onGenerationError = new vscode.EventEmitter<GenerationErrorEvent>();

  /** Public event for subscribing to generation error events */
  public readonly onGenerationError = this._onGenerationError.event;

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  /**
   * Creates a new RoadmapGenerationService
   * @param extensionUri The extension URI for loading resources
   */
  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  // -------------------------------------------------------------------------
  // Public Methods - Steering File Loading
  // -------------------------------------------------------------------------

  /**
   * Load all 4 required steering files from .kiro/steering/
   * Throws descriptive error listing any missing files
   *
   * @returns Array of steering file contents
   * @throws Error if any required files are missing
   */
  public async loadSteeringFiles(): Promise<SteeringFileContent[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder open');
    }

    const steeringDir = vscode.Uri.joinPath(workspaceFolder.uri, '.kiro', 'steering');
    const results: SteeringFileContent[] = [];
    const missingFiles: string[] = [];

    // Attempt to read each required file
    for (const filename of REQUIRED_STEERING_FILES) {
      const fileUri = vscode.Uri.joinPath(steeringDir, filename);
      try {
        const content = await vscode.workspace.fs.readFile(fileUri);
        results.push({
          filename,
          content: Buffer.from(content).toString('utf-8'),
        });
      } catch {
        missingFiles.push(filename);
      }
    }

    // Throw error if any files are missing
    if (missingFiles.length > 0) {
      const error = new Error(
        `Missing required steering files: ${missingFiles.join(', ')}. ` +
        'Return to Phase 1 and regenerate steering files.'
      );
      // Attach missing files to error for UI display
      (error as Error & { missingFiles: string[] }).missingFiles = missingFiles;
      throw error;
    }

    return results;
  }

  /**
   * Check if all required steering files exist
   * Used for UI to enable/disable generate button
   *
   * @returns Object with exists flag and list of missing files
   */
  public async checkSteeringFilesExist(): Promise<{
    exists: boolean;
    missingFiles: string[];
  }> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return { exists: false, missingFiles: [...REQUIRED_STEERING_FILES] };
    }

    const steeringDir = vscode.Uri.joinPath(workspaceFolder.uri, '.kiro', 'steering');
    const missingFiles: string[] = [];

    for (const filename of REQUIRED_STEERING_FILES) {
      const fileUri = vscode.Uri.joinPath(steeringDir, filename);
      try {
        await vscode.workspace.fs.stat(fileUri);
      } catch {
        missingFiles.push(filename);
      }
    }

    return {
      exists: missingFiles.length === 0,
      missingFiles,
    };
  }

  // -------------------------------------------------------------------------
  // Public Methods - XML Formatting
  // -------------------------------------------------------------------------

  /**
   * Format steering file contents as XML blocks for the Bedrock prompt
   *
   * Maps filenames to XML tags:
   * - tech.md -> <tech_md>
   * - structure.md -> <structure_md>
   * - integration-landscape.md -> <integration_landscape_md>
   * - agentify-integration.md -> <agentify_integration_md>
   *
   * @param files Array of steering file contents
   * @returns Concatenated XML blocks as a single string
   */
  public formatSteeringFilesAsXml(files: SteeringFileContent[]): string {
    return files
      .map((file) => {
        // Convert filename to XML tag: remove .md, replace - with _
        const tagName = file.filename
          .replace(/\.md$/, '')
          .replace(/-/g, '_') + '_md';

        return `<${tagName}>\n${file.content}\n</${tagName}>`;
      })
      .join('\n\n');
  }

  // -------------------------------------------------------------------------
  // Public Methods - Prompt Loading
  // -------------------------------------------------------------------------

  /**
   * Load the roadmap generation prompt
   * Caches the prompt after first load to avoid repeated file reads
   *
   * @returns The prompt content
   * @throws Error if prompt file cannot be read
   */
  public async loadPrompt(): Promise<string> {
    // Return cached prompt if available
    if (this._promptCache) {
      return this._promptCache;
    }

    // Build URI to prompt file
    const promptUri = vscode.Uri.joinPath(this._extensionUri, ROADMAP_PROMPT_PATH);

    // Read and decode the prompt file
    const content = await vscode.workspace.fs.readFile(promptUri);
    const promptText = Buffer.from(content).toString('utf-8');

    // Cache for subsequent calls
    this._promptCache = promptText;

    return promptText;
  }

  // -------------------------------------------------------------------------
  // Public Methods - Configuration
  // -------------------------------------------------------------------------

  /**
   * Get the model ID for roadmap generation
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
   * Generate roadmap.md from steering files
   *
   * Flow:
   * 1. Fire onGenerationStart event
   * 2. Load all 4 required steering files
   * 3. Format steering files as XML blocks
   * 4. Load the roadmap prompt
   * 5. Call Bedrock API with prompt and XML context
   * 6. Fire onGenerationComplete or onGenerationError event
   * 7. Return generated content
   *
   * @returns Generated roadmap markdown content
   * @throws Error if generation fails
   */
  public async generateRoadmap(): Promise<string> {
    // Fire start event
    this._onGenerationStart.fire({ startTime: Date.now() });

    try {
      // Load steering files (throws if any are missing)
      const steeringFiles = await this.loadSteeringFiles();

      // Format as XML blocks
      const xmlContext = this.formatSteeringFilesAsXml(steeringFiles);

      // Load the prompt
      const systemPrompt = await this.loadPrompt();

      // Get model ID
      const modelId = await this.getModelId();

      // Get Bedrock client
      const client = await getBedrockClientAsync();

      // Build user message with XML-formatted steering files
      const userMessage = `Generate the implementation roadmap based on the following steering files:\n\n${xmlContext}`;

      // Use non-streaming ConverseCommand
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

      // Get output file path
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('No workspace folder open');
      }
      // Write to project root (human-facing documentation)
      const outputPath = vscode.Uri.joinPath(
        workspaceFolder.uri,
        ROADMAP_OUTPUT_FILE
      ).fsPath;

      // Fire complete event
      this._onGenerationComplete.fire({
        filePath: outputPath,
        content: responseText,
      });

      return responseText;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const missingFiles = (error as Error & { missingFiles?: string[] })?.missingFiles;

      // Fire error event
      this._onGenerationError.fire({
        error: errorMessage,
        missingFiles,
      });

      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Public Methods - Dispose
  // -------------------------------------------------------------------------

  /**
   * Dispose of all resources
   * Implements vscode.Disposable for proper EventEmitter cleanup
   */
  public dispose(): void {
    this._onGenerationStart.dispose();
    this._onGenerationComplete.dispose();
    this._onGenerationError.dispose();
    this._promptCache = null;
  }
}

// ============================================================================
// Singleton Pattern
// ============================================================================

/**
 * Singleton instance of the service
 */
let instance: RoadmapGenerationService | null = null;

/**
 * Get the singleton RoadmapGenerationService instance
 * Creates the instance on first call (lazy initialization)
 *
 * @param context The VS Code extension context (required for first call)
 * @returns The RoadmapGenerationService singleton
 */
export function getRoadmapGenerationService(
  context: vscode.ExtensionContext
): RoadmapGenerationService {
  if (!instance) {
    instance = new RoadmapGenerationService(context.extensionUri);
  }
  return instance;
}

/**
 * Reset the singleton instance
 * Useful for testing or when cleanup is needed
 */
export function resetRoadmapGenerationService(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
