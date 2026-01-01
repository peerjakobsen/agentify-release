/**
 * Wizard State Persistence Service
 * Manages persistence of Ideation Wizard state to .agentify/wizard-state.json
 *
 * Task Group 2: WizardStatePersistenceService implementation
 * Following configService.ts pattern for singleton and file operations
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  PersistedWizardState,
  WizardState,
  WIZARD_STATE_SCHEMA_VERSION,
  wizardStateToPersistedState,
  applyConversationTruncation,
} from '../types/wizardPanel';

/**
 * Storage path for wizard state relative to workspace root
 * Task 2.2: Store state at .agentify/wizard-state.json
 */
export const WIZARD_STATE_FILE_PATH = '.agentify/wizard-state.json';

/**
 * Relative path for wizard state (used in gitignore)
 */
export const WIZARD_STATE_GITIGNORE_ENTRY = '.agentify/wizard-state.json';

/**
 * Debounce delay in milliseconds for save operations
 * Task 2.4: 500ms debounce delay
 */
export const SAVE_DEBOUNCE_MS = 500;

/**
 * Maximum file size in bytes (500KB)
 * Task 3.4: File size limit for state persistence
 */
export const MAX_STATE_FILE_SIZE = 500 * 1024;

/**
 * Load result status values
 * Task 2.3: Return status to indicate load outcome
 */
export type LoadResultStatus = 'loaded' | 'not_found' | 'version_mismatch' | 'corrupted';

/**
 * Result of loading persisted state
 * Task 2.3: LoadResult interface with status
 */
export interface LoadResult {
  /** The loaded state, or null if not found/invalid */
  state: PersistedWizardState | null;
  /** Status indicating the load outcome */
  status: LoadResultStatus;
  /** Error message for debugging (only for corrupted/version_mismatch) */
  errorMessage?: string;
}

/**
 * Service for persisting and restoring Ideation Wizard state
 * Task 2.2: Singleton service following configService.ts pattern
 */
export class WizardStatePersistenceService implements vscode.Disposable {
  private readonly _workspaceRoot: string;
  private _debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  private _onSaveErrorEmitter = new vscode.EventEmitter<Error>();
  private _gitignoreUpdated = false;

  /**
   * Event fired when save operation fails
   * Task 2.8: Error event emitter following mockDataService pattern
   */
  public readonly onSaveError = this._onSaveErrorEmitter.event;

  /**
   * Creates a new WizardStatePersistenceService instance
   * @param workspaceRoot The root directory of the workspace
   */
  constructor(workspaceRoot: string) {
    this._workspaceRoot = workspaceRoot;
  }

  /**
   * Get the full path to the state file
   */
  private getStatePath(): string {
    return path.join(this._workspaceRoot, WIZARD_STATE_FILE_PATH);
  }

  /**
   * Get the URI for the state file
   */
  private getStateUri(): vscode.Uri {
    return vscode.Uri.file(this.getStatePath());
  }

  /**
   * Get the URI for the .gitignore file
   */
  private getGitignoreUri(): vscode.Uri {
    return vscode.Uri.file(path.join(this._workspaceRoot, '.gitignore'));
  }

  /**
   * Check if persisted state exists
   * Task 2.7: Return Promise<boolean> using vscode.workspace.fs.stat()
   * @returns true if state file exists, false otherwise
   */
  async exists(): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(this.getStateUri());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load persisted wizard state from disk
   * Task 2.3: Return LoadResult with status
   * @returns LoadResult with state and status
   */
  async load(): Promise<LoadResult> {
    const stateUri = this.getStateUri();

    try {
      const content = await vscode.workspace.fs.readFile(stateUri);

      // Handle empty content
      if (!content || content.length === 0) {
        return { state: null, status: 'not_found' };
      }

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(Buffer.from(content).toString('utf-8'));
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        console.error('[WizardStatePersistence] JSON parse error:', errorMessage);
        return {
          state: null,
          status: 'corrupted',
          errorMessage: `Failed to parse wizard state: ${errorMessage}`,
        };
      }

      // Validate structure - must be a plain object, not null, not an array
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        console.error('[WizardStatePersistence] Invalid state structure: not a plain object');
        return {
          state: null,
          status: 'corrupted',
          errorMessage: 'Invalid state structure: not an object',
        };
      }

      const persisted = parsed as PersistedWizardState;

      // Check schema version
      if (persisted.schemaVersion !== WIZARD_STATE_SCHEMA_VERSION) {
        console.warn(
          '[WizardStatePersistence] Schema version mismatch:',
          persisted.schemaVersion,
          'vs expected',
          WIZARD_STATE_SCHEMA_VERSION
        );
        return {
          state: null,
          status: 'version_mismatch',
          errorMessage: `Schema version ${persisted.schemaVersion} does not match current version ${WIZARD_STATE_SCHEMA_VERSION}`,
        };
      }

      return { state: persisted, status: 'loaded' };
    } catch (error) {
      // File not found - check various error types from vscode.workspace.fs
      if (error instanceof vscode.FileSystemError) {
        // VS Code FileSystemError for file not found
        return { state: null, status: 'not_found' };
      }

      if (
        error instanceof Error &&
        (error.name === 'FileNotFound' ||
          error.message.includes('ENOENT') ||
          error.message.includes('FileNotFound') ||
          error.message.includes('does not exist') ||
          (error as NodeJS.ErrnoException).code === 'ENOENT' ||
          (error as NodeJS.ErrnoException).code === 'FileNotFound')
      ) {
        return { state: null, status: 'not_found' };
      }

      // Other errors - treat as corrupted
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[WizardStatePersistence] Load error:', errorMessage);
      return {
        state: null,
        status: 'corrupted',
        errorMessage: `Failed to load wizard state: ${errorMessage}`,
      };
    }
  }

  /**
   * Save wizard state with debouncing
   * Task 2.4: 500ms debounce using setTimeout/clearTimeout pattern
   * @param state Current wizard state to save
   */
  save(state: WizardState): void {
    // Clear any pending debounced save
    if (this._debounceTimeout) {
      clearTimeout(this._debounceTimeout);
    }

    // Schedule debounced save
    this._debounceTimeout = setTimeout(() => {
      this._debounceTimeout = null;
      this._writeState(state).catch((error) => {
        console.error('[WizardStatePersistence] Debounced save error:', error);
        this._onSaveErrorEmitter.fire(error instanceof Error ? error : new Error(String(error)));
      });
    }, SAVE_DEBOUNCE_MS);
  }

  /**
   * Save wizard state immediately, bypassing debounce
   * Task 2.5: Clear pending debounce and write immediately
   * @param state Current wizard state to save
   * @returns Promise that resolves when save completes
   */
  async saveImmediate(state: WizardState): Promise<void> {
    // Clear any pending debounced save
    if (this._debounceTimeout) {
      clearTimeout(this._debounceTimeout);
      this._debounceTimeout = null;
    }

    await this._writeState(state);
  }

  /**
   * Clear persisted wizard state
   * Task 2.6: Delete .agentify/wizard-state.json
   */
  async clear(): Promise<void> {
    const stateUri = this.getStateUri();

    try {
      await vscode.workspace.fs.delete(stateUri);
      console.log('[WizardStatePersistence] Wizard state cleared');
    } catch (error) {
      // File might not exist - that's fine
      if (
        error instanceof Error &&
        (error.name === 'FileNotFound' ||
          error.message.includes('ENOENT') ||
          (error as NodeJS.ErrnoException).code === 'FileNotFound')
      ) {
        console.log('[WizardStatePersistence] No state file to clear');
        return;
      }

      console.error('[WizardStatePersistence] Clear error:', error);
      throw error;
    }
  }

  /**
   * Ensure wizard-state.json is in .gitignore
   * Task 9.2: Add wizard-state.json entry to .gitignore
   */
  private async _ensureGitignoreEntry(): Promise<void> {
    // Only try once per service instance
    if (this._gitignoreUpdated) {
      return;
    }
    this._gitignoreUpdated = true;

    const gitignoreUri = this.getGitignoreUri();

    try {
      // Read existing .gitignore
      let content = '';
      try {
        const fileContent = await vscode.workspace.fs.readFile(gitignoreUri);
        content = Buffer.from(fileContent).toString('utf-8');
      } catch {
        // File doesn't exist - create new one
        console.log('[WizardStatePersistence] No .gitignore found, creating one');
      }

      // Check if entry already exists
      const lines = content.split('\n');
      const entryExists = lines.some(line => {
        const trimmed = line.trim();
        return trimmed === WIZARD_STATE_GITIGNORE_ENTRY ||
               trimmed === '.agentify/wizard-state.json';
      });

      if (entryExists) {
        console.log('[WizardStatePersistence] wizard-state.json already in .gitignore');
        return;
      }

      // Add the entry
      // Try to add after .agentify/config.json if it exists
      const configIndex = lines.findIndex(line =>
        line.trim() === '.agentify/config.json' ||
        line.trim() === '.agentify/'
      );

      if (configIndex >= 0) {
        // Insert after the config.json entry
        lines.splice(configIndex + 1, 0, WIZARD_STATE_GITIGNORE_ENTRY);
      } else {
        // Add to end with a section comment
        if (content.length > 0 && !content.endsWith('\n')) {
          content += '\n';
        }
        if (content.length > 0) {
          lines.push('');
        }
        lines.push('# Agentify wizard state (local only)');
        lines.push(WIZARD_STATE_GITIGNORE_ENTRY);
      }

      // Write back
      const newContent = lines.join('\n');
      await vscode.workspace.fs.writeFile(gitignoreUri, Buffer.from(newContent, 'utf-8'));
      console.log('[WizardStatePersistence] Added wizard-state.json to .gitignore');
    } catch (error) {
      // Non-critical - just log the error
      console.warn('[WizardStatePersistence] Failed to update .gitignore:', error);
    }
  }

  /**
   * Internal method to write state to disk
   * Task 2.4: Handles JSON stringify and file write
   * Task 3.4: Implements file size limit with progressive truncation
   * @param state Wizard state to write
   */
  private async _writeState(state: WizardState): Promise<void> {
    const stateUri = this.getStateUri();
    const dirUri = vscode.Uri.file(path.dirname(this.getStatePath()));

    // Ensure .agentify directory exists
    try {
      await vscode.workspace.fs.createDirectory(dirUri);
    } catch {
      // Directory might already exist
    }

    // Task 9.2: Ensure wizard-state.json is in .gitignore
    await this._ensureGitignoreEntry();

    // Convert to persisted state (includes default truncation to 10 messages)
    let persistedState = wizardStateToPersistedState(state);
    let json = JSON.stringify(persistedState, null, 2);

    // Task 3.4: Check file size and apply progressive truncation
    if (json.length > MAX_STATE_FILE_SIZE) {
      console.warn('[WizardStatePersistence] State size exceeds limit, applying truncation');

      // First pass: limit conversations to 5 messages
      let truncatedState = applyConversationTruncation(state, 5);
      persistedState = wizardStateToPersistedState(truncatedState);
      json = JSON.stringify(persistedState, null, 2);

      if (json.length > MAX_STATE_FILE_SIZE) {
        // Second pass: limit to 2 messages
        truncatedState = applyConversationTruncation(state, 2);
        persistedState = wizardStateToPersistedState(truncatedState);
        json = JSON.stringify(persistedState, null, 2);

        if (json.length > MAX_STATE_FILE_SIZE) {
          // Third pass: clear all conversation histories
          truncatedState = applyConversationTruncation(state, 0);
          persistedState = wizardStateToPersistedState(truncatedState);
          json = JSON.stringify(persistedState, null, 2);

          if (json.length > MAX_STATE_FILE_SIZE) {
            // Task 3.5: Size still exceeded - show warning and skip save
            console.error('[WizardStatePersistence] State still too large after truncation:', json.length);
            vscode.window.showWarningMessage(
              'Wizard state too large to save. Some conversation history may be lost.'
            );
            return;
          }
        }
      }
    }

    // Write the state file
    const content = Buffer.from(json, 'utf-8');
    await vscode.workspace.fs.writeFile(stateUri, content);
    console.log('[WizardStatePersistence] State saved, size:', json.length);
  }

  /**
   * Dispose of resources
   * Task 2.2: Implement vscode.Disposable for cleanup
   */
  dispose(): void {
    // Clear any pending debounced save
    if (this._debounceTimeout) {
      clearTimeout(this._debounceTimeout);
      this._debounceTimeout = null;
    }

    // Dispose event emitter
    this._onSaveErrorEmitter.dispose();
  }
}

/**
 * Singleton service instance
 */
let serviceInstance: WizardStatePersistenceService | null = null;

/**
 * Get or create the WizardStatePersistenceService for the current workspace
 * Task 2.2: Singleton getter following configService.ts pattern
 * @returns The service instance or null if no workspace is open
 */
export function getWizardStatePersistenceService(): WizardStatePersistenceService | null {
  if (serviceInstance) {
    return serviceInstance;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }

  // Use first workspace folder only (multi-root workspace support)
  serviceInstance = new WizardStatePersistenceService(workspaceFolders[0].uri.fsPath);
  return serviceInstance;
}

/**
 * Reset the service singleton
 * Useful for testing or when workspace changes
 */
export function resetWizardStatePersistenceService(): void {
  if (serviceInstance) {
    serviceInstance.dispose();
    serviceInstance = null;
  }
}
