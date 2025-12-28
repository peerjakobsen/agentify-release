/**
 * Workflow Executor Service
 * Manages subprocess spawning and lifecycle for workflow execution
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { ConfigService } from './configService';
import type { WorkflowExecution } from '../types/inputPanel';

/**
 * Execution callbacks for workflow lifecycle events
 */
export interface ExecutionCallbacks {
  /** Called when workflow starts executing */
  onStart?: (execution: WorkflowExecution) => void;
  /** Called when workflow completes successfully */
  onComplete?: (execution: WorkflowExecution) => void;
  /** Called when workflow encounters an error */
  onError?: (execution: WorkflowExecution, error: string) => void;
  /** Called when stdout data is received */
  onStdout?: (data: string) => void;
  /** Called when stderr data is received */
  onStderr?: (data: string) => void;
}

/**
 * Workflow configuration for execution
 */
export interface WorkflowExecutionConfig {
  entryScript: string;
  pythonPath: string;
}

/**
 * DynamoDB environment configuration
 */
export interface DynamoDbEnvConfig {
  tableName: string;
  region: string;
}

/**
 * Service for executing workflow subprocesses
 */
export class WorkflowExecutor {
  private activeProcess: ChildProcess | null = null;
  private currentExecution: WorkflowExecution | null = null;

  /**
   * Creates a new WorkflowExecutor
   * @param configService - The config service for reading workflow configuration
   * @param workspaceRoot - The root directory of the workspace
   */
  constructor(
    private readonly configService: ConfigService,
    private readonly workspaceRoot: string
  ) {}

  /**
   * Gets the workflow configuration from config service
   *
   * @returns Workflow configuration or null if not configured
   */
  async getWorkflowConfig(): Promise<WorkflowExecutionConfig | null> {
    const config = await this.configService.getConfig();
    if (!config?.workflow) {
      return null;
    }

    const entryScript = config.workflow.entryScript;
    const pythonPath = config.workflow.pythonPath || 'python3';

    if (!entryScript) {
      return null;
    }

    return {
      entryScript,
      pythonPath,
    };
  }

  /**
   * Gets DynamoDB environment configuration
   *
   * @returns DynamoDB env config or null if not configured
   */
  async getDynamoDbEnv(): Promise<DynamoDbEnvConfig | null> {
    const config = await this.configService.getConfig();
    if (!config?.infrastructure?.dynamodb) {
      return null;
    }

    const { tableName, region } = config.infrastructure.dynamodb;
    if (!tableName || !region) {
      return null;
    }

    return {
      tableName,
      region,
    };
  }

  /**
   * Checks if a workflow is currently running
   */
  isRunning(): boolean {
    return this.activeProcess !== null;
  }

  /**
   * Gets the current execution state
   */
  getCurrentExecution(): WorkflowExecution | null {
    return this.currentExecution;
  }

  /**
   * Executes a workflow subprocess
   *
   * @param prompt - The user prompt to pass to the workflow
   * @param workflowId - The unique workflow identifier
   * @param traceId - The OTEL trace identifier
   * @param callbacks - Optional lifecycle callbacks
   * @returns Promise resolving to the WorkflowExecution when complete
   */
  async execute(
    prompt: string,
    workflowId: string,
    traceId: string,
    callbacks?: ExecutionCallbacks
  ): Promise<WorkflowExecution> {
    // Prevent concurrent executions
    if (this.isRunning()) {
      throw new Error('A workflow is already running. Wait for it to complete.');
    }

    // Get configuration
    const workflowConfig = await this.getWorkflowConfig();
    if (!workflowConfig) {
      throw new Error('Workflow configuration not found. Check workflow.entryScript and workflow.pythonPath in config.');
    }

    const dynamoDbEnv = await this.getDynamoDbEnv();

    // Build the full path to the entry script
    const entryScriptPath = path.join(this.workspaceRoot, workflowConfig.entryScript);

    // Create execution record
    const execution: WorkflowExecution = {
      workflowId,
      traceId,
      startTime: Date.now(),
      endTime: null,
      status: null,
    };

    this.currentExecution = execution;

    // Build CLI arguments (using array for safe argument passing)
    const args = [
      entryScriptPath,
      '--prompt', prompt,
      '--workflow-id', workflowId,
      '--trace-id', traceId,
    ];

    // Build environment variables
    const env: NodeJS.ProcessEnv = {
      ...process.env,
    };

    if (dynamoDbEnv) {
      env.AGENTIFY_TABLE_NAME = dynamoDbEnv.tableName;
      env.AGENTIFY_TABLE_REGION = dynamoDbEnv.region;
    }

    // Notify start
    callbacks?.onStart?.(execution);

    return new Promise((resolve, reject) => {
      // Spawn the subprocess
      this.activeProcess = spawn(workflowConfig.pythonPath, args, {
        cwd: this.workspaceRoot,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdoutData = '';
      let stderrData = '';

      // Handle stdout
      this.activeProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        stdoutData += text;
        callbacks?.onStdout?.(text);
        console.log('[WorkflowExecutor] stdout:', text);
      });

      // Handle stderr
      this.activeProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        stderrData += text;
        callbacks?.onStderr?.(text);
        console.warn('[WorkflowExecutor] stderr:', text);
      });

      // Handle process exit
      this.activeProcess.on('close', (code: number | null) => {
        execution.endTime = Date.now();
        this.activeProcess = null;

        if (code === 0) {
          execution.status = 'completed';
          callbacks?.onComplete?.(execution);
          resolve(execution);
        } else {
          execution.status = 'error';
          execution.error = stderrData || `Process exited with code ${code}`;
          callbacks?.onError?.(execution, execution.error);
          resolve(execution); // Resolve, not reject - error is captured in execution
        }
      });

      // Handle spawn errors
      this.activeProcess.on('error', (error: Error) => {
        execution.endTime = Date.now();
        execution.status = 'error';
        execution.error = error.message;
        this.activeProcess = null;

        callbacks?.onError?.(execution, error.message);
        resolve(execution);
      });
    });
  }

  /**
   * Disposes of resources and kills any running subprocess
   */
  dispose(): void {
    if (this.activeProcess) {
      // Attempt graceful termination first
      this.activeProcess.kill('SIGTERM');

      // Force kill after timeout
      setTimeout(() => {
        if (this.activeProcess) {
          this.activeProcess.kill('SIGKILL');
        }
      }, 1000);

      this.activeProcess = null;
    }
    this.currentExecution = null;
  }
}
