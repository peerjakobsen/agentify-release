/**
 * Graph visualization types for Agentify workflows
 * Used by the Demo Viewer panel for real-time graph rendering
 */

/**
 * Status of a graph node during workflow execution
 * - 'pending': Node has not started execution
 * - 'running': Node is currently executing
 * - 'completed': Node finished successfully
 * - 'failed': Node execution failed
 */
export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Represents a node in the workflow graph visualization
 */
export interface GraphNode {
  /**
   * Unique identifier matching the agent ID from config
   */
  id: string;

  /**
   * Human-readable display name for the node
   */
  name: string;

  /**
   * Description of the node's role in the workflow
   */
  role: string;

  /**
   * Current execution status of the node
   */
  status: NodeStatus;

  /**
   * Execution time in milliseconds (populated after completion)
   */
  executionTimeMs?: number;
}

/**
 * Represents an edge connecting two nodes in the workflow graph
 */
export interface GraphEdge {
  /**
   * Unique identifier for the edge
   * Typically generated from source and target: `${from}-${to}`
   */
  id: string;

  /**
   * ID of the source node
   */
  from: string;

  /**
   * ID of the target node
   */
  to: string;

  /**
   * Whether to animate the edge (true when data is flowing)
   */
  animated?: boolean;
}

/**
 * Complete graph data structure for rendering
 */
export interface GraphData {
  /**
   * Array of nodes in the graph
   */
  nodes: GraphNode[];

  /**
   * Array of edges connecting nodes
   */
  edges: GraphEdge[];

  /**
   * IDs of entry point nodes that receive initial input
   */
  entryPoints: string[];
}

/**
 * Creates a GraphNode with default pending status
 * @param id Node identifier
 * @param name Display name
 * @param role Node role description
 * @returns GraphNode with pending status
 */
export function createPendingNode(id: string, name: string, role: string): GraphNode {
  return {
    id,
    name,
    role,
    status: 'pending',
  };
}

/**
 * Creates a GraphEdge with unique ID
 * @param from Source node ID
 * @param to Target node ID
 * @param animated Whether to animate the edge
 * @returns GraphEdge with generated ID
 */
export function createEdge(from: string, to: string, animated?: boolean): GraphEdge {
  return {
    id: `${from}-${to}`,
    from,
    to,
    animated,
  };
}

/**
 * Updates a node's status in the graph data
 * Returns a new GraphData object (immutable update)
 * @param graphData Current graph data
 * @param nodeId ID of the node to update
 * @param status New status for the node
 * @param executionTimeMs Optional execution time
 * @returns New GraphData with updated node
 */
export function updateNodeStatus(
  graphData: GraphData,
  nodeId: string,
  status: NodeStatus,
  executionTimeMs?: number
): GraphData {
  return {
    ...graphData,
    nodes: graphData.nodes.map((node) =>
      node.id === nodeId
        ? { ...node, status, executionTimeMs: executionTimeMs ?? node.executionTimeMs }
        : node
    ),
  };
}

/**
 * Sets an edge's animated state
 * Returns a new GraphData object (immutable update)
 * @param graphData Current graph data
 * @param edgeId ID of the edge to update
 * @param animated Whether to animate the edge
 * @returns New GraphData with updated edge
 */
export function setEdgeAnimated(
  graphData: GraphData,
  edgeId: string,
  animated: boolean
): GraphData {
  return {
    ...graphData,
    edges: graphData.edges.map((edge) =>
      edge.id === edgeId ? { ...edge, animated } : edge
    ),
  };
}

/**
 * Creates an empty graph data structure
 * @returns Empty GraphData
 */
export function createEmptyGraph(): GraphData {
  return {
    nodes: [],
    edges: [],
    entryPoints: [],
  };
}
