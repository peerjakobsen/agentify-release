/**
 * Workflow Trigger Service
 *
 * Manages subprocess spawning and lifecycle for workflow execution using
 * vscode.EventEmitter pattern for real-time streaming of raw subprocess I/O.
 * Replaces the callback-based WorkflowExecutor with an event-driven approach.
 *
 * Usage:
 *   const service = getWorkflowTriggerService();
 *   service.onStdoutLine((line) => handleLine(line));
 *   service.onStderr((data) => handleError(data));
 *   service.onProcessStateChange((state) => handleStateChange(state));
 *   service.onProcessExit((info) => handleExit(info));
 *   const { workflowId, traceId } = await service.start(prompt);
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { getConfigService } from './configService';
import { generateWorkflowId, generateTraceId } from '../utils/idGenerator';

// ============================================================================
// Types
// ============================================================================

/**
 * Process state type for tracking subprocess lifecycle
 */
export type ProcessState = 'idle' | 'running' | 'completed' | 'failed' | 'killed';

/**
 * Process exit information
 */
export interface ProcessExitInfo {
  code: number | null;
  signal: string | null;
}

/**
 * Start result containing generated IDs
 */
export interface StartResult {
  workflowId: string;
  traceId: string;
}

// ============================================================================
// WorkflowTriggerService Class
// ============================================================================

/**
 * Service for triggering and managing workflow subprocess execution
 * Implements vscode.Disposable for proper resource cleanup
 */
export class WorkflowTriggerService implements vscode.Disposable {
  // -------------------------------------------------------------------------
  // Private State Fields
  // -------------------------------------------------------------------------

  /** Current process state */
  private _state: ProcessState = 'idle';

  /** Active subprocess reference */
  private _activeProcess: ChildProcess | null = null;

  /** Buffer for incomplete stdout lines */
  private _stdoutBuffer = '';

  /** Promise resolver for kill operation */
  private _killResolver: (() => void) | null = null;

  /** Timeout reference for SIGKILL */
  private _killTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // -------------------------------------------------------------------------
  // EventEmitters (VS Code pattern)
  // -------------------------------------------------------------------------

  /** Event emitter for complete stdout lines */
  private readonly _onStdoutLine = new vscode.EventEmitter<string>();

  /** Public event for subscribing to stdout lines */
  public readonly onStdoutLine = this._onStdoutLine.event;

  /** Event emitter for stderr output */
  private readonly _onStderr = new vscode.EventEmitter<string>();

  /** Public event for subscribing to stderr output */
  public readonly onStderr = this._onStderr.event;

  /** Event emitter for process state changes */
  private readonly _onProcessStateChange = new vscode.EventEmitter<ProcessState>();

  /** Public event for subscribing to state changes */
  public readonly onProcessStateChange = this._onProcessStateChange.event;

  /** Event emitter for process exit */
  private readonly _onProcessExit = new vscode.EventEmitter<ProcessExitInfo>();

  /** Public event for subscribing to process exit */
  public readonly onProcessExit = this._onProcessExit.event;

  // -------------------------------------------------------------------------
  // Public State Accessor Methods
  // -------------------------------------------------------------------------

  /**
   * Returns the current process state
   */
  public getState(): ProcessState {
    return this._state;
  }

  // -------------------------------------------------------------------------
  // Process Lifecycle Methods
  // -------------------------------------------------------------------------

  /**
   * Start a workflow subprocess
   *
   * @param prompt - The user prompt to pass to the workflow
   * @returns Promise resolving to { workflowId, traceId }
   * @throws Error if validation fails (entry script not configured or not found)
   */
  public async start(prompt: string): Promise<StartResult> {
    // Synchronous kill if process is already running
    if (this._activeProcess) {
      await this.kill();
    }

    // Generate IDs
    const workflowId = generateWorkflowId();
    const traceId = generateTraceId();

    // Get configuration
    const configService = getConfigService();
    const config = await configService?.getConfig();

    // Pre-flight validation: check entryScript is configured
    const entryScript = config?.workflow?.entryScript;
    if (!entryScript) {
      throw new Error('Workflow entry script is not configured. Please set workflow.entryScript in .agentify/config.json');
    }

    // Get workspace root
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open');
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // Build entry script path
    const entryScriptPath = path.join(workspaceRoot, entryScript);

    // Pre-flight validation: check entry script file exists
    if (!fs.existsSync(entryScriptPath)) {
      throw new Error(`Workflow entry script not found at: ${entryScriptPath}`);
    }

    // Get pythonPath from config (default to 'python')
    const pythonPath = config?.workflow?.pythonPath || 'python';

    // Build CLI arguments
    const args = [
      entryScriptPath,
      '--prompt',
      prompt,
      '--workflow-id',
      workflowId,
      '--trace-id',
      traceId,
    ];

    // Build environment variables
    const env: NodeJS.ProcessEnv = {
      ...process.env,
    };

    // Add DynamoDB configuration to environment
    const tableName = config?.infrastructure?.dynamodb?.tableName;
    const region = config?.infrastructure?.dynamodb?.region;
    if (tableName) {
      env.AGENTIFY_TABLE_NAME = tableName;
    }
    if (region) {
      env.AWS_REGION = region;
    }

    // Clear stdout buffer for new process
    this._stdoutBuffer = '';

    // Spawn the subprocess
    this._activeProcess = spawn(pythonPath, args, {
      cwd: workspaceRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Transition to running state
    this._setState('running');

    // Wire up stdout handler
    this._activeProcess.stdout?.on('data', (data: Buffer) => {
      this._handleStdoutData(data);
    });

    // Wire up stderr handler
    this._activeProcess.stderr?.on('data', (data: Buffer) => {
      this._onStderr.fire(data.toString());
    });

    // Handle process close
    this._activeProcess.on('close', (code: number | null, signal: string | null) => {
      this._handleProcessClose(code, signal);
    });

    // Handle spawn errors
    this._activeProcess.on('error', (error: Error) => {
      this._handleProcessError(error);
    });

    return { workflowId, traceId };
  }

  /**
   * Kill the currently running subprocess
   * Sends SIGTERM first, then SIGKILL after 1-second timeout if still running
   *
   * @returns Promise that resolves when process terminates
   */
  public async kill(): Promise<void> {
    // Guard: return immediately if no active process
    if (!this._activeProcess) {
      return;
    }

    return new Promise<void>((resolve) => {
      // Store resolver for use in close handler
      this._killResolver = resolve;

      // Send SIGTERM
      this._activeProcess?.kill('SIGTERM');

      // Set timeout for SIGKILL
      this._killTimeoutId = setTimeout(() => {
        if (this._activeProcess) {
          this._activeProcess.kill('SIGKILL');
        }
      }, 1000);
    });
  }

  /**
   * Dispose of all resources
   * Implements vscode.Disposable
   */
  public dispose(): void {
    // Kill any active process
    if (this._activeProcess) {
      this._activeProcess.kill('SIGKILL');
      this._activeProcess = null;
    }

    // Clear timeout
    if (this._killTimeoutId) {
      clearTimeout(this._killTimeoutId);
      this._killTimeoutId = null;
    }

    // Dispose all EventEmitters
    this._onStdoutLine.dispose();
    this._onStderr.dispose();
    this._onProcessStateChange.dispose();
    this._onProcessExit.dispose();

    // Reset state
    this._state = 'idle';
    this._stdoutBuffer = '';
    this._killResolver = null;
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  /**
   * Set the process state and fire state change event
   */
  private _setState(state: ProcessState): void {
    this._state = state;
    this._onProcessStateChange.fire(state);
  }

  /**
   * Handle stdout data with line buffering
   * Splits incoming data on newlines, emitting complete lines immediately
   * and holding partial lines in buffer
   *
   * @param data - Buffer containing stdout data
   */
  private _handleStdoutData(data: Buffer): void {
    // Convert to string and append to buffer
    this._stdoutBuffer += data.toString();

    // Split on newline
    const lines = this._stdoutBuffer.split('\n');

    // Emit all complete lines (all but the last segment)
    for (let i = 0; i < lines.length - 1; i++) {
      this._onStdoutLine.fire(lines[i]);
    }

    // Keep the incomplete last segment in buffer
    this._stdoutBuffer = lines[lines.length - 1];
  }

  /**
   * Flush remaining content from stdout buffer
   * Called on process exit to emit any remaining partial line
   */
  private _flushStdoutBuffer(): void {
    if (this._stdoutBuffer.length > 0) {
      this._onStdoutLine.fire(this._stdoutBuffer);
      this._stdoutBuffer = '';
    }
  }

  /**
   * Handle process close event
   */
  private _handleProcessClose(code: number | null, signal: string | null): void {
    // Clear kill timeout
    if (this._killTimeoutId) {
      clearTimeout(this._killTimeoutId);
      this._killTimeoutId = null;
    }

    // Flush stdout buffer
    this._flushStdoutBuffer();

    // Determine terminal state
    let terminalState: ProcessState;
    if (this._killResolver) {
      // Process was killed
      terminalState = 'killed';
    } else if (code === 0) {
      terminalState = 'completed';
    } else {
      terminalState = 'failed';
    }

    // Update state
    this._setState(terminalState);

    // Fire exit event
    this._onProcessExit.fire({ code, signal });

    // Clear process reference
    this._activeProcess = null;

    // Resolve kill promise if waiting
    if (this._killResolver) {
      this._killResolver();
      this._killResolver = null;
    }
  }

  /**
   * Handle spawn error event
   */
  private _handleProcessError(_error: Error): void {
    // Clear kill timeout
    if (this._killTimeoutId) {
      clearTimeout(this._killTimeoutId);
      this._killTimeoutId = null;
    }

    // Transition to failed state
    this._setState('failed');

    // Fire exit event with null code and signal
    this._onProcessExit.fire({ code: null, signal: null });

    // Clear process reference
    this._activeProcess = null;

    // Resolve kill promise if waiting
    if (this._killResolver) {
      this._killResolver();
      this._killResolver = null;
    }
  }
}

// ============================================================================
// Singleton Pattern
// ============================================================================

/**
 * Singleton instance of the workflow trigger service
 */
let instance: WorkflowTriggerService | null = null;

/**
 * Get the singleton WorkflowTriggerService instance
 * Creates the instance on first call (lazy initialization)
 *
 * @returns The WorkflowTriggerService singleton
 */
export function getWorkflowTriggerService(): WorkflowTriggerService {
  if (!instance) {
    instance = new WorkflowTriggerService();
  }
  return instance;
}

/**
 * Reset the singleton instance
 * Disposes current instance and sets to null
 * Useful for testing or when cleanup is needed
 */
export function resetWorkflowTriggerService(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
