/**
 * Steering File Service
 * Orchestrates steering file generation with conflict detection, backup, and file writing
 *
 * Task Group 1: Conflict detection and backup
 * Task Group 2: File writing operations
 * Task Group 3: Generation orchestration
 *
 * This service coordinates between:
 * - SteeringGenerationService: AI-powered content generation via Bedrock
 * - File system operations: Directory creation, file writing, backup
 * - UI feedback: Progress events for Step 8 visualization
 */

import * as vscode from 'vscode';
import type { WizardState } from '../types/wizardPanel';
import { STEERING_FILES } from '../types/wizardPanel';
import { getSteeringGenerationService } from './steeringGenerationService';

// ============================================================================
// Event Types
// ============================================================================

/**
 * Event emitted when a file generation starts
 */
export interface FileProgressEvent {
  /** Name of the file being generated (e.g., 'product.md') */
  fileName: string;
  /** Zero-based index of the file in the generation sequence */
  index: number;
  /** Total number of files to generate */
  total: number;
}

/**
 * Event emitted when a file is successfully generated and written
 */
export interface FileCompleteEvent {
  /** Name of the file that was generated */
  fileName: string;
  /** Full absolute path to the written file */
  filePath: string;
}

/**
 * Event emitted when a file generation fails
 */
export interface FileErrorEvent {
  /** Name of the file that failed */
  fileName: string;
  /** Error message describing the failure */
  error: string;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * User choice from the conflict dialog
 */
export type ConflictDialogChoice = 'overwrite' | 'backup' | 'cancel';

/**
 * Result of the generateSteeringFiles operation
 */
export interface GenerationResult {
  /** Whether generation completed successfully */
  success: boolean;
  /** Whether user cancelled the operation */
  cancelled?: boolean;
  /** Array of full paths to generated files */
  files: string[];
  /** Path to backup directory (if backup was created) */
  backupPath?: string;
  /** Error information if generation failed */
  error?: {
    /** Name of the file that failed */
    fileName: string;
    /** Error message */
    message: string;
  };
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * SteeringFileService orchestrates the full steering file generation flow:
 * 1. Check for existing files and show conflict dialog if needed
 * 2. Create backup if user selects that option
 * 3. Call SteeringGenerationService for AI content generation
 * 4. Write generated content to .kiro/steering/ directory
 * 5. Emit progress events for UI visualization
 */
export class SteeringFileService {
  // Extension context for service initialization
  private _context: vscode.ExtensionContext;

  // Event emitters for progress tracking
  private _onFileStart = new vscode.EventEmitter<FileProgressEvent>();
  private _onFileComplete = new vscode.EventEmitter<FileCompleteEvent>();
  private _onFileError = new vscode.EventEmitter<FileErrorEvent>();

  /** Event fired when file generation starts */
  public readonly onFileStart = this._onFileStart.event;
  /** Event fired when file is successfully written */
  public readonly onFileComplete = this._onFileComplete.event;
  /** Event fired when file generation fails */
  public readonly onFileError = this._onFileError.event;

  // Directory paths
  private get _workspaceRoot(): vscode.Uri {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      throw new Error('No workspace folder open');
    }
    return folders[0].uri;
  }

  private get _steeringDir(): vscode.Uri {
    return vscode.Uri.joinPath(this._workspaceRoot, '.kiro', 'steering');
  }

  private get _kiroDir(): vscode.Uri {
    return vscode.Uri.joinPath(this._workspaceRoot, '.kiro');
  }

  /**
   * Constructor - requires ExtensionContext for SteeringGenerationService
   */
  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  // ============================================================================
  // Task Group 1: Conflict Detection & Backup Methods
  // ============================================================================

  /**
   * Check if existing steering files are present in .kiro/steering/
   * @returns true if directory exists with .md files, false otherwise
   */
  async checkForExistingFiles(): Promise<boolean> {
    try {
      // Check if directory exists
      await vscode.workspace.fs.stat(this._steeringDir);

      // Read directory contents
      const entries = await vscode.workspace.fs.readDirectory(this._steeringDir);

      // Check for any .md files
      const hasMdFiles = entries.some(([name, _type]) => name.endsWith('.md'));

      return hasMdFiles;
    } catch {
      // Directory doesn't exist or error reading it
      return false;
    }
  }

  /**
   * Create a timestamped backup of the steering directory
   * @returns Path to the backup directory
   */
  async backupSteeringDirectory(): Promise<string> {
    // Generate timestamp in format: YYYY-MM-DDTHHMMSS
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/:/g, '')
      .replace(/\.\d{3}Z$/, '')
      .replace(/-/g, '-');

    const backupDirName = `steering.backup-${timestamp}`;
    const backupDir = vscode.Uri.joinPath(this._kiroDir, backupDirName);

    // Copy entire steering directory to backup location
    await vscode.workspace.fs.copy(this._steeringDir, backupDir, { overwrite: true });

    return backupDir.fsPath;
  }

  /**
   * Show QuickPick dialog for handling existing file conflict
   * @returns User's choice: 'overwrite', 'backup', or 'cancel'
   */
  async showConflictDialog(): Promise<ConflictDialogChoice> {
    const options: vscode.QuickPickItem[] = [
      {
        label: 'Overwrite',
        description: 'Replace existing steering files',
        detail: 'Existing files will be permanently deleted',
      },
      {
        label: 'Backup & Overwrite',
        description: 'Create backup before overwriting',
        detail: 'Existing files will be moved to .kiro/steering.backup-<timestamp>/',
      },
      {
        label: 'Cancel',
        description: 'Keep existing files',
        detail: 'Abort generation and return to wizard',
      },
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: 'Existing steering files found. How would you like to proceed?',
      ignoreFocusOut: true,
    });

    if (!selected) {
      return 'cancel';
    }

    switch (selected.label) {
      case 'Overwrite':
        return 'overwrite';
      case 'Backup & Overwrite':
        return 'backup';
      default:
        return 'cancel';
    }
  }

  // ============================================================================
  // Task Group 2: File Writing Operations
  // ============================================================================

  /**
   * Ensure the .kiro/steering/ directory exists
   * Creates parent directories if needed
   */
  private async _ensureSteeringDirectory(): Promise<void> {
    try {
      await vscode.workspace.fs.createDirectory(this._steeringDir);
    } catch {
      // Directory already exists or parent creation handled by createDirectory
    }
  }

  /**
   * Write a single steering file to the file system
   * @param fileName Name of the file (e.g., 'product.md')
   * @param content UTF-8 content to write
   * @returns Full path to the written file
   */
  private async _writeSteeringFile(fileName: string, content: string): Promise<string> {
    await this._ensureSteeringDirectory();

    const fileUri = vscode.Uri.joinPath(this._steeringDir, fileName);
    const contentBytes = new TextEncoder().encode(content);

    await vscode.workspace.fs.writeFile(fileUri, contentBytes);

    return fileUri.fsPath;
  }

  // ============================================================================
  // Task Group 3: Generation Orchestration
  // ============================================================================

  /**
   * Generate all steering files with conflict detection and file writing
   *
   * Flow:
   * 1. Check for existing files
   * 2. If exists, show conflict dialog
   * 3. If backup selected, create backup
   * 4. If cancelled, abort
   * 5. Call SteeringGenerationService for AI content
   * 6. Write each file as content is generated
   * 7. Emit progress events
   *
   * @param wizardState Full wizard state for generating content
   * @returns Generation result with file paths and status
   */
  async generateSteeringFiles(wizardState: WizardState): Promise<GenerationResult> {
    // Check for existing files
    const hasExisting = await this.checkForExistingFiles();

    let backupPath: string | undefined;

    if (hasExisting) {
      // Show conflict dialog
      const choice = await this.showConflictDialog();

      if (choice === 'cancel') {
        return {
          success: false,
          cancelled: true,
          files: [],
        };
      }

      if (choice === 'backup') {
        backupPath = await this.backupSteeringDirectory();
      }
    }

    // Ensure directory exists before writing
    await this._ensureSteeringDirectory();

    // Get the generation service
    const generationService = getSteeringGenerationService(this._context);

    // Call AI service to generate content
    const generationResult = await generationService.generateSteeringFiles(wizardState);

    // Process results and write files
    const writtenFiles: string[] = [];
    let error: GenerationResult['error'];

    for (let i = 0; i < generationResult.files.length; i++) {
      const fileResult = generationResult.files[i];

      // Emit start event
      this._onFileStart.fire({
        fileName: fileResult.fileName,
        index: i,
        total: STEERING_FILES.length,
      });

      if (fileResult.status === 'created' && fileResult.content) {
        try {
          // Write the file
          const filePath = await this._writeSteeringFile(fileResult.fileName, fileResult.content);
          writtenFiles.push(filePath);

          // Emit complete event
          this._onFileComplete.fire({
            fileName: fileResult.fileName,
            filePath,
          });
        } catch (writeError) {
          // File write failed
          const errorMessage = writeError instanceof Error ? writeError.message : 'Unknown write error';
          error = {
            fileName: fileResult.fileName,
            message: errorMessage,
          };

          this._onFileError.fire({
            fileName: fileResult.fileName,
            error: errorMessage,
          });

          // Stop processing on first error
          break;
        }
      } else if (fileResult.status === 'failed') {
        // AI generation failed for this file
        error = {
          fileName: fileResult.fileName,
          message: fileResult.error || 'Generation failed',
        };

        this._onFileError.fire({
          fileName: fileResult.fileName,
          error: fileResult.error || 'Generation failed',
        });

        // Stop processing on first error
        break;
      }
    }

    return {
      success: !error && writtenFiles.length === STEERING_FILES.length,
      files: writtenFiles,
      backupPath,
      error,
    };
  }

  /**
   * Retry generation for specific failed files
   * Does not check for conflicts since we're completing a partial generation
   *
   * @param wizardState Full wizard state for generating content
   * @param failedFileNames Array of file names to retry
   * @returns Generation result for retried files
   */
  async retryFailedFiles(wizardState: WizardState, failedFileNames: string[]): Promise<GenerationResult> {
    // Get the generation service
    const generationService = getSteeringGenerationService(this._context);

    // Call AI service to retry specific files
    const generationResult = await generationService.retryFiles(wizardState, failedFileNames);

    // Process results and write files
    const writtenFiles: string[] = [];
    let error: GenerationResult['error'];

    for (let i = 0; i < generationResult.files.length; i++) {
      const fileResult = generationResult.files[i];

      // Emit start event
      this._onFileStart.fire({
        fileName: fileResult.fileName,
        index: i,
        total: failedFileNames.length,
      });

      if (fileResult.status === 'created' && fileResult.content) {
        try {
          // Write the file
          const filePath = await this._writeSteeringFile(fileResult.fileName, fileResult.content);
          writtenFiles.push(filePath);

          // Emit complete event
          this._onFileComplete.fire({
            fileName: fileResult.fileName,
            filePath,
          });
        } catch (writeError) {
          // File write failed
          const errorMessage = writeError instanceof Error ? writeError.message : 'Unknown write error';
          error = {
            fileName: fileResult.fileName,
            message: errorMessage,
          };

          this._onFileError.fire({
            fileName: fileResult.fileName,
            error: errorMessage,
          });

          break;
        }
      } else if (fileResult.status === 'failed') {
        error = {
          fileName: fileResult.fileName,
          message: fileResult.error || 'Retry failed',
        };

        this._onFileError.fire({
          fileName: fileResult.fileName,
          error: fileResult.error || 'Retry failed',
        });

        break;
      }
    }

    return {
      success: !error && writtenFiles.length === failedFileNames.length,
      files: writtenFiles,
      error,
    };
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this._onFileStart.dispose();
    this._onFileComplete.dispose();
    this._onFileError.dispose();
  }
}

// ============================================================================
// Singleton Instance Management
// ============================================================================

let _instance: SteeringFileService | undefined;

/**
 * Get the singleton instance of SteeringFileService
 * @param context ExtensionContext - required on first call to initialize
 */
export function getSteeringFileService(context?: vscode.ExtensionContext): SteeringFileService {
  if (!_instance) {
    if (!context) {
      throw new Error('ExtensionContext required for first initialization of SteeringFileService');
    }
    _instance = new SteeringFileService(context);
  }
  return _instance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetSteeringFileService(): void {
  if (_instance) {
    _instance.dispose();
    _instance = undefined;
  }
}
