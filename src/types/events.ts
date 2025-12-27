/**
 * Event types for Agentify workflow observability
 * Supports dual-mode architecture:
 * - Local mode: Real-time graph events via stdout + tool events via DynamoDB
 * - AgentCore mode: All events via DynamoDB polling
 */

/**
 * Base interface for all events
 * Contains common fields shared by all event types
 */
export interface BaseEvent {
  /**
   * Unique identifier for the workflow execution
   */
  workflow_id: string;

  /**
   * Timestamp in epoch milliseconds
   */
  timestamp: number;
}

/**
 * Source of the event
 * - 'stdout': Event from local Python process stdout streaming
 * - 'dynamodb': Event from DynamoDB polling
 */
export type EventSource = 'stdout' | 'dynamodb';

// ============================================================================
// Stdout Events (Local Mode Real-Time Streaming)
// ============================================================================

/**
 * Graph node definition from stdout
 */
export interface StdoutGraphNode {
  /** Node identifier */
  id: string;
  /** Display name */
  name: string;
  /** Node role description */
  role: string;
}

/**
 * Graph edge definition from stdout
 */
export interface StdoutGraphEdge {
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
}

/**
 * Event containing the workflow graph structure
 * Emitted at the start of workflow execution
 */
export interface GraphStructureEvent extends BaseEvent {
  /** Event type discriminator */
  type: 'graph_structure';
  /** Array of nodes in the graph */
  nodes: StdoutGraphNode[];
  /** Array of edges connecting nodes */
  edges: StdoutGraphEdge[];
  /** IDs of nodes that receive initial input */
  entry_points: string[];
}

/**
 * Event indicating a node has started execution
 */
export interface NodeStartEvent extends BaseEvent {
  /** Event type discriminator */
  type: 'node_start';
  /** ID of the node that started */
  node_id: string;
}

/**
 * Status of a completed node
 */
export type NodeCompletionStatus = 'completed' | 'failed' | 'skipped';

/**
 * Event indicating a node has finished execution
 */
export interface NodeStopEvent extends BaseEvent {
  /** Event type discriminator */
  type: 'node_stop';
  /** ID of the node that stopped */
  node_id: string;
  /** Completion status of the node */
  status: NodeCompletionStatus;
  /** Execution time in milliseconds */
  execution_time_ms: number;
}

/**
 * Event containing streaming token output from a node
 */
export interface NodeStreamEvent extends BaseEvent {
  /** Event type discriminator */
  type: 'node_stream';
  /** ID of the node emitting the stream */
  node_id: string;
  /** Token text data */
  data: string;
}

/**
 * Status of the completed workflow
 */
export type WorkflowCompletionStatus = 'completed' | 'failed' | 'cancelled';

/**
 * Event indicating the entire workflow has completed
 */
export interface WorkflowCompleteEvent extends BaseEvent {
  /** Event type discriminator */
  type: 'workflow_complete';
  /** Final status of the workflow */
  status: WorkflowCompletionStatus;
  /** Total execution time in milliseconds */
  execution_time_ms: number;
  /** Array of node IDs in execution order */
  execution_order: string[];
}

/**
 * Union of all stdout event types
 */
export type StdoutEvent =
  | GraphStructureEvent
  | NodeStartEvent
  | NodeStopEvent
  | NodeStreamEvent
  | WorkflowCompleteEvent;

// ============================================================================
// DynamoDB Events (Tool Call Tracking)
// ============================================================================

/**
 * Status of a tool call
 */
export type ToolCallStatus = 'started' | 'completed' | 'failed';

/**
 * Event tracking a tool invocation
 * Stored in DynamoDB for observability
 */
export interface ToolCallEvent extends BaseEvent {
  /** Event type discriminator */
  event_type: 'tool_call';
  /** Name of the agent making the tool call */
  agent_name: string;
  /** System or service the tool belongs to */
  system: string;
  /** Operation being performed */
  operation: string;
  /** Input parameters for the tool call */
  input: Record<string, unknown>;
  /** Output result from the tool call (if completed) */
  output?: Record<string, unknown>;
  /** Status of the tool call */
  status: ToolCallStatus;
  /** Error message if status is 'failed' */
  error_message?: string;
}

/**
 * Type of agent span event
 */
export type AgentSpanEventType = 'agent_start' | 'agent_end';

/**
 * Event tracking agent execution span
 * Used for timing and observability
 */
export interface AgentSpanEvent extends BaseEvent {
  /** Event type discriminator */
  event_type: AgentSpanEventType;
  /** Name of the agent */
  agent_name: string;
  /** Role of the agent in the workflow */
  role: string;
  /** Duration in milliseconds (only on agent_end) */
  duration_ms?: number;
  /** Agent output (only on agent_end) */
  output?: string;
}

/**
 * Union of all DynamoDB event types
 */
export type DynamoDbEvent = ToolCallEvent | AgentSpanEvent;

// ============================================================================
// Merged Event Wrapper
// ============================================================================

/**
 * Merged event wrapper with source discriminator
 * Allows the Demo Viewer to handle events from both sources uniformly
 */
export interface MergedEvent<T extends StdoutEvent | DynamoDbEvent = StdoutEvent | DynamoDbEvent> {
  /** Source of the event */
  source: EventSource;
  /** The wrapped event */
  event: T;
}

/**
 * Union of all Agentify event types
 */
export type AgentifyEvent = StdoutEvent | DynamoDbEvent;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for GraphStructureEvent
 */
export function isGraphStructureEvent(event: AgentifyEvent): event is GraphStructureEvent {
  return 'type' in event && event.type === 'graph_structure';
}

/**
 * Type guard for NodeStartEvent
 */
export function isNodeStartEvent(event: AgentifyEvent): event is NodeStartEvent {
  return 'type' in event && event.type === 'node_start';
}

/**
 * Type guard for NodeStopEvent
 */
export function isNodeStopEvent(event: AgentifyEvent): event is NodeStopEvent {
  return 'type' in event && event.type === 'node_stop';
}

/**
 * Type guard for NodeStreamEvent
 */
export function isNodeStreamEvent(event: AgentifyEvent): event is NodeStreamEvent {
  return 'type' in event && event.type === 'node_stream';
}

/**
 * Type guard for WorkflowCompleteEvent
 */
export function isWorkflowCompleteEvent(event: AgentifyEvent): event is WorkflowCompleteEvent {
  return 'type' in event && event.type === 'workflow_complete';
}

/**
 * Type guard for ToolCallEvent
 */
export function isToolCallEvent(event: AgentifyEvent): event is ToolCallEvent {
  return 'event_type' in event && event.event_type === 'tool_call';
}

/**
 * Type guard for AgentSpanEvent
 */
export function isAgentSpanEvent(event: AgentifyEvent): event is AgentSpanEvent {
  return 'event_type' in event && (event.event_type === 'agent_start' || event.event_type === 'agent_end');
}

/**
 * Type guard for stdout events
 */
export function isStdoutEvent(event: AgentifyEvent): event is StdoutEvent {
  return 'type' in event;
}

/**
 * Type guard for DynamoDB events
 */
export function isDynamoDbEvent(event: AgentifyEvent): event is DynamoDbEvent {
  return 'event_type' in event;
}
