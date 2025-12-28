/**
 * Input Panel Types
 * Types and interfaces for the Demo Viewer input panel functionality
 */

/**
 * States for the input panel state machine
 * Manages the UI state transitions for workflow execution
 */
export enum InputPanelState {
  /** Panel is ready to accept input and run workflows */
  Ready = 'ready',
  /** Workflow is currently executing */
  Running = 'running',
  /** Workflow completed successfully */
  Completed = 'completed',
  /** Workflow ended with an error */
  Error = 'error',
}

/**
 * Validation error for input panel requirements
 */
export interface ValidationError {
  /**
   * Type of validation that failed
   * @example 'entryScript', 'awsCredentials', 'projectInitialized'
   */
  type: 'entryScript' | 'awsCredentials' | 'projectInitialized';

  /**
   * Human-readable error message
   * @example 'Entry script not found: agents/main.py'
   */
  message: string;
}

/**
 * Combined validation state for the input panel
 */
export interface ValidationState {
  /**
   * Whether all validations passed
   */
  isValid: boolean;

  /**
   * Array of validation errors (empty if isValid is true)
   */
  errors: ValidationError[];
}

/**
 * Workflow execution status
 */
export type WorkflowExecutionStatus = 'completed' | 'error';

/**
 * Workflow execution record
 * Tracks the lifecycle of a single workflow execution
 */
export interface WorkflowExecution {
  /**
   * Unique workflow identifier
   * Format: wf-{8-char-alphanumeric}
   * @example 'wf-a1b2c3d4'
   */
  workflowId: string;

  /**
   * OTEL-compatible trace identifier
   * Format: 32-character lowercase hex string
   * @example '80e1afed08e019fc1110464cfa66635c'
   */
  traceId: string;

  /**
   * Unix timestamp when execution started
   */
  startTime: number;

  /**
   * Unix timestamp when execution ended (null while running)
   */
  endTime: number | null;

  /**
   * Execution outcome status
   */
  status: WorkflowExecutionStatus | null;

  /**
   * Error details if status is 'error'
   */
  error?: string;
}

/**
 * Messages from webview to extension
 */
export interface InputPanelMessage {
  command: string;
  [key: string]: unknown;
}

/**
 * State synchronization message sent to webview
 */
export interface InputPanelStateMessage {
  type: 'stateSync';
  state: InputPanelState;
  promptText: string;
  workflowId: string | null;
  traceId: string | null;
  timerDisplay: string;
  validationErrors: ValidationError[];
  xrayUrl: string | null;
}
