/**
 * Message protocols for webview communication
 * Defines the contract between extension and webview panels
 */

import type { EventSource, MergedEvent, AgentifyEvent } from './events';
import type { GraphData } from './graph';
import type { AgentifyConfig } from './config';

// ============================================================================
// Extension-to-Webview Messages
// ============================================================================

/**
 * Base interface for extension-to-webview messages
 */
interface BaseWebviewMessage {
  /** Message type discriminator */
  type: string;
}

/**
 * Delivers merged events to the panel
 */
export interface EventMessage extends BaseWebviewMessage {
  /** Message type discriminator */
  type: 'event';
  /** Source of the event (stdout or dynamodb) */
  source: EventSource;
  /** The workflow event */
  event: AgentifyEvent;
}

/**
 * Full graph state update
 */
export interface GraphUpdateMessage extends BaseWebviewMessage {
  /** Message type discriminator */
  type: 'graphUpdate';
  /** Complete graph data */
  data: GraphData;
}

/**
 * Workflow status of the current execution
 */
export type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Workflow status change notification
 */
export interface StatusMessage extends BaseWebviewMessage {
  /** Message type discriminator */
  type: 'status';
  /** Current workflow status */
  status: WorkflowStatus;
  /** Optional status message */
  message?: string;
  /** Workflow ID if running */
  workflowId?: string;
}

/**
 * Configuration data for panel initialization
 */
export interface ConfigMessage extends BaseWebviewMessage {
  /** Message type discriminator */
  type: 'config';
  /** The Agentify configuration */
  config: AgentifyConfig;
}

/**
 * Error message for displaying in the panel
 */
export interface ErrorMessage extends BaseWebviewMessage {
  /** Message type discriminator */
  type: 'error';
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
}

/**
 * Clear panel state message
 */
export interface ClearMessage extends BaseWebviewMessage {
  /** Message type discriminator */
  type: 'clear';
}

/**
 * Discriminated union of all extension-to-webview messages
 */
export type WebviewMessage =
  | EventMessage
  | GraphUpdateMessage
  | StatusMessage
  | ConfigMessage
  | ErrorMessage
  | ClearMessage;

// ============================================================================
// Webview-to-Extension Messages (Panel Messages)
// ============================================================================

/**
 * Base interface for webview-to-extension messages
 */
interface BasePanelMessage {
  /** Message type discriminator */
  type: string;
}

/**
 * Request to trigger workflow execution
 */
export interface RunWorkflowMessage extends BasePanelMessage {
  /** Message type discriminator */
  type: 'runWorkflow';
  /** User prompt to start the workflow */
  prompt: string;
  /** Optional session ID for conversation continuity */
  sessionId?: string;
}

/**
 * Request to stop the running workflow
 */
export interface StopWorkflowMessage extends BasePanelMessage {
  /** Message type discriminator */
  type: 'stopWorkflow';
  /** ID of the workflow to stop */
  workflowId: string;
}

/**
 * Request to execute a VS Code command
 */
export interface CommandMessage extends BasePanelMessage {
  /** Message type discriminator */
  type: 'command';
  /** Command identifier to execute */
  command: string;
  /** Optional arguments for the command */
  args?: unknown[];
}

/**
 * Request to reload configuration
 */
export interface ReloadConfigMessage extends BasePanelMessage {
  /** Message type discriminator */
  type: 'reloadConfig';
}

/**
 * Panel ready notification (sent when webview is loaded)
 */
export interface ReadyMessage extends BasePanelMessage {
  /** Message type discriminator */
  type: 'ready';
}

/**
 * Discriminated union of all webview-to-extension messages
 */
export type PanelMessage =
  | RunWorkflowMessage
  | StopWorkflowMessage
  | CommandMessage
  | ReloadConfigMessage
  | ReadyMessage;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for EventMessage
 */
export function isEventMessage(msg: WebviewMessage): msg is EventMessage {
  return msg.type === 'event';
}

/**
 * Type guard for GraphUpdateMessage
 */
export function isGraphUpdateMessage(msg: WebviewMessage): msg is GraphUpdateMessage {
  return msg.type === 'graphUpdate';
}

/**
 * Type guard for StatusMessage
 */
export function isStatusMessage(msg: WebviewMessage): msg is StatusMessage {
  return msg.type === 'status';
}

/**
 * Type guard for ConfigMessage
 */
export function isConfigMessage(msg: WebviewMessage): msg is ConfigMessage {
  return msg.type === 'config';
}

/**
 * Type guard for RunWorkflowMessage
 */
export function isRunWorkflowMessage(msg: PanelMessage): msg is RunWorkflowMessage {
  return msg.type === 'runWorkflow';
}

/**
 * Type guard for StopWorkflowMessage
 */
export function isStopWorkflowMessage(msg: PanelMessage): msg is StopWorkflowMessage {
  return msg.type === 'stopWorkflow';
}

/**
 * Type guard for CommandMessage
 */
export function isCommandMessage(msg: PanelMessage): msg is CommandMessage {
  return msg.type === 'command';
}

/**
 * Type guard for ReadyMessage
 */
export function isReadyMessage(msg: PanelMessage): msg is ReadyMessage {
  return msg.type === 'ready';
}

// ============================================================================
// Message Factories
// ============================================================================

/**
 * Creates an EventMessage
 */
export function createEventMessage(source: EventSource, event: AgentifyEvent): EventMessage {
  return { type: 'event', source, event };
}

/**
 * Creates a GraphUpdateMessage
 */
export function createGraphUpdateMessage(data: GraphData): GraphUpdateMessage {
  return { type: 'graphUpdate', data };
}

/**
 * Creates a StatusMessage
 */
export function createStatusMessage(
  status: WorkflowStatus,
  message?: string,
  workflowId?: string
): StatusMessage {
  return { type: 'status', status, message, workflowId };
}

/**
 * Creates a ConfigMessage
 */
export function createConfigMessage(config: AgentifyConfig): ConfigMessage {
  return { type: 'config', config };
}

/**
 * Creates an ErrorMessage
 */
export function createErrorMessage(code: string, message: string): ErrorMessage {
  return { type: 'error', code, message };
}

/**
 * Creates a ClearMessage
 */
export function createClearMessage(): ClearMessage {
  return { type: 'clear' };
}
