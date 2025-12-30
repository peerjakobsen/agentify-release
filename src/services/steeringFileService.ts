/**
 * Steering File Service
 *
 * Stub service for steering file generation in Step 8 of the Ideation Wizard.
 * Provides progress events during simulated file generation.
 *
 * TODO: Phase 3 Item 28 - Implement actual steering file generation
 * Expected output location: .kiro/steering/
 * Current stub returns simulated success with placeholder content.
 *
 * This service follows the singleton pattern established by MockDataService.
 */

import * as vscode from 'vscode';
import { STEERING_FILES } from '../types/wizardPanel';

// ============================================================================
// Event Types
// Task 2.3: Define service event types
// ============================================================================

/**
 * Event emitted when file generation starts
 */
export interface FileProgressEvent {
  /** Name of the file being generated */
  fileName: string;
  /** Index of the current file (0-based) */
  index: number;
  /** Total number of files to generate */
  total: number;
}

/**
 * Event emitted when file generation completes
 */
export interface FileCompleteEvent {
  /** Name of the completed file */
  fileName: string;
  /** Full path to the generated file */
  filePath: string;
}

/**
 * Event emitted when file generation fails
 */
export interface FileErrorEvent {
  /** Name of the file that failed */
  fileName: string;
  /** Error message describing the failure */
  error: string;
}

/**
 * Result of steering file generation
 */
export interface GenerationResult {
  /** Array of generated file paths */
  files: string[];
  /** True if using placeholder/stub implementation */
  placeholder: boolean;
  /** Error details if generation failed */
  error?: {
    fileName: string;
    message: string;
  };
}

// ============================================================================
// Minimal State Interface for Generation
// Task 2.4: Accept wizard state as input parameter
// ============================================================================

/**
 * Minimal state interface needed for steering file generation
 * This allows the service to be used with partial state during testing
 */
export interface GenerationState {
  businessObjective?: string;
  industry?: string;
  systems?: string[];
  // Additional fields used for actual generation (Phase 3)
  [key: string]: unknown;
}

// ============================================================================
// SteeringFileService Class
// Task 2.2: Create service following MockDataService pattern
// ============================================================================

/**
 * Service class for steering file generation
 *
 * Provides a stub implementation that simulates file generation with
 * progress events. Actual generation logic will be implemented in Phase 3.
 */
export class SteeringFileService implements vscode.Disposable {
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
  // Public Methods
  // -------------------------------------------------------------------------

  /**
   * Generate steering files with progress events
   *
   * Task 2.4: Implement stub generateSteeringFiles() method
   *
   * @param state The wizard state used for generation context
   * @param startIndex Optional index to start from (for retry functionality)
   * @param delayMs Optional delay between files in ms (default 200ms for progress visibility)
   * @param simulateErrorAt Optional index to simulate an error (for testing)
   * @returns Promise resolving to generation result with file paths
   */
  public async generateSteeringFiles(
    _state: GenerationState,
    startIndex: number = 0,
    delayMs: number = 200,
    simulateErrorAt?: number
  ): Promise<GenerationResult> {
    // TODO: Phase 3 Item 28 - Implement actual steering file generation
    // Expected output location: .kiro/steering/
    // Note that this stub returns simulated success with placeholder content
    // Stub always returns `placeholder: true` in return object

    const generatedFiles: string[] = [];
    const total = STEERING_FILES.length;

    // Get workspace root for file paths
    const workspaceRoot = this._getWorkspaceRoot();

    // Iterate through files (from startIndex if retrying)
    for (let i = startIndex; i < total; i++) {
      const fileName = STEERING_FILES[i];

      // Emit fileStart event
      this._onFileStart.fire({
        fileName,
        index: i,
        total,
      });

      // Simulate processing delay for progress visibility
      await this._delay(delayMs);

      // Check for simulated error (testing only)
      if (simulateErrorAt !== undefined && i === simulateErrorAt) {
        const errorMessage = `Simulated error generating ${fileName}`;
        this._onFileError.fire({
          fileName,
          error: errorMessage,
        });

        return {
          files: generatedFiles,
          placeholder: true,
          error: {
            fileName,
            message: errorMessage,
          },
        };
      }

      // Generate file path
      const filePath = `${workspaceRoot}/.kiro/steering/${fileName}`;
      generatedFiles.push(filePath);

      // Emit fileComplete event
      this._onFileComplete.fire({
        fileName,
        filePath,
      });
    }

    return {
      files: generatedFiles,
      placeholder: true, // Always true until Phase 3 Item 28
    };
  }

  /**
   * Dispose of all resources
   * Implements vscode.Disposable
   */
  public dispose(): void {
    this._onFileStart.dispose();
    this._onFileComplete.dispose();
    this._onFileError.dispose();
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  /**
   * Get the workspace root path
   * @returns Workspace root path or default test path
   */
  private _getWorkspaceRoot(): string {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      return folders[0].uri.fsPath;
    }
    return '/workspace';
  }

  /**
   * Promise-based delay helper
   * @param ms Milliseconds to delay
   */
  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Pattern
// Task 2.2: Follow singleton pattern from getMockDataService()
// ============================================================================

/**
 * Singleton instance of the service
 */
let instance: SteeringFileService | null = null;

/**
 * Get the singleton SteeringFileService instance
 *
 * @returns The SteeringFileService singleton
 */
export function getSteeringFileService(): SteeringFileService {
  if (!instance) {
    instance = new SteeringFileService();
  }
  return instance;
}

/**
 * Reset the singleton instance
 * Useful for testing or cleanup
 */
export function resetSteeringFileService(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
