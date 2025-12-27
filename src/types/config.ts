/**
 * Configuration types for Agentify projects
 * Defines the schema for .agentify/config.json
 */

import type { TriggerType, TriggerConfig } from './triggers';

/**
 * Project configuration
 * Defines the business context for the Agentify project
 */
export interface ProjectConfig {
  /**
   * Human-readable project name
   * @example "Customer Service Agent"
   */
  name: string;

  /**
   * Customer value map describing the project's purpose
   * @example "Reduce customer wait times and improve satisfaction"
   */
  valueMap: string;

  /**
   * Industry vertical for domain-specific templates and prompts
   * @example "retail", "fsi", "healthcare", "tech"
   */
  industry: string;
}

/**
 * DynamoDB infrastructure configuration
 * Specifies the table used for workflow event storage
 */
export interface DynamoDbInfrastructureConfig {
  /**
   * Name of the DynamoDB table
   * @example "agentify-workflow-events"
   */
  tableName: string;

  /**
   * ARN of the DynamoDB table
   * @example "arn:aws:dynamodb:us-east-1:123456789012:table/agentify-workflow-events"
   */
  tableArn: string;

  /**
   * AWS region where the table is deployed
   * @example "us-east-1"
   */
  region: string;
}

/**
 * Infrastructure configuration
 * Contains all infrastructure-related settings
 */
export interface InfrastructureConfig {
  /**
   * DynamoDB configuration for workflow events
   */
  dynamodb: DynamoDbInfrastructureConfig;
}

/**
 * Agent definition within a workflow
 * Represents a single agent node in the workflow graph
 */
export interface AgentDefinition {
  /**
   * Unique identifier for the agent within the workflow
   * @example "research-agent"
   */
  id: string;

  /**
   * Human-readable display name
   * @example "Research Agent"
   */
  name: string;

  /**
   * Description of the agent's role in the workflow
   * @example "Gathers and analyzes relevant information"
   */
  role: string;
}

/**
 * Edge definition connecting agents in the workflow
 * Represents data flow between agent nodes
 */
export interface EdgeDefinition {
  /**
   * ID of the source agent node
   */
  from: string;

  /**
   * ID of the target agent node
   */
  to: string;
}

/**
 * Orchestration pattern for workflow execution
 * - 'graph': Directed acyclic graph with explicit edges
 * - 'swarm': Dynamic agent coordination
 * - 'workflow': Sequential step-by-step execution
 */
export type OrchestrationPattern = 'graph' | 'swarm' | 'workflow';

/**
 * Workflow configuration
 * Defines the workflow structure, trigger, and agent composition
 */
export interface WorkflowConfig {
  /**
   * Orchestration pattern for the workflow
   */
  orchestrationPattern: OrchestrationPattern;

  /**
   * Type of trigger for invoking the workflow
   */
  triggerType: TriggerType;

  /**
   * Configuration specific to the selected trigger type
   */
  triggerConfig: TriggerConfig;

  /**
   * List of agents that compose the workflow
   */
  agents: AgentDefinition[];

  /**
   * Edges defining data flow between agents
   */
  edges: EdgeDefinition[];
}

/**
 * Root configuration for an Agentify project
 * Stored in .agentify/config.json
 */
export interface AgentifyConfig {
  /**
   * Configuration schema version for forward compatibility
   * @example "1.0.0"
   */
  version: string;

  /**
   * Project metadata and business context
   */
  project: ProjectConfig;

  /**
   * Infrastructure settings (DynamoDB, etc.)
   */
  infrastructure: InfrastructureConfig;

  /**
   * Workflow definition and trigger configuration
   */
  workflow: WorkflowConfig;
}

/**
 * Result of configuration validation
 */
export interface ConfigValidationResult {
  /**
   * Whether the configuration is valid
   */
  isValid: boolean;

  /**
   * Array of validation error messages (empty if valid)
   */
  errors: string[];
}

/**
 * Validates that a config object has all required fields
 * @param config The config object to validate
 * @returns Validation result with isValid flag and any errors
 */
export function validateConfigSchema(config: unknown): ConfigValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { isValid: false, errors: ['Configuration must be an object'] };
  }

  const cfg = config as Record<string, unknown>;

  // Validate version
  if (typeof cfg.version !== 'string') {
    errors.push('Missing or invalid "version" field');
  }

  // Validate project
  if (!cfg.project || typeof cfg.project !== 'object') {
    errors.push('Missing or invalid "project" field');
  } else {
    const project = cfg.project as Record<string, unknown>;
    if (typeof project.name !== 'string') {
      errors.push('Missing or invalid "project.name" field');
    }
    if (typeof project.valueMap !== 'string') {
      errors.push('Missing or invalid "project.valueMap" field');
    }
    if (typeof project.industry !== 'string') {
      errors.push('Missing or invalid "project.industry" field');
    }
  }

  // Validate infrastructure
  if (!cfg.infrastructure || typeof cfg.infrastructure !== 'object') {
    errors.push('Missing or invalid "infrastructure" field');
  } else {
    const infra = cfg.infrastructure as Record<string, unknown>;
    if (!infra.dynamodb || typeof infra.dynamodb !== 'object') {
      errors.push('Missing or invalid "infrastructure.dynamodb" field');
    } else {
      const dynamodb = infra.dynamodb as Record<string, unknown>;
      if (typeof dynamodb.tableName !== 'string') {
        errors.push('Missing or invalid "infrastructure.dynamodb.tableName" field');
      }
      if (typeof dynamodb.tableArn !== 'string') {
        errors.push('Missing or invalid "infrastructure.dynamodb.tableArn" field');
      }
      if (typeof dynamodb.region !== 'string') {
        errors.push('Missing or invalid "infrastructure.dynamodb.region" field');
      }
    }
  }

  // Validate workflow
  if (!cfg.workflow || typeof cfg.workflow !== 'object') {
    errors.push('Missing or invalid "workflow" field');
  } else {
    const workflow = cfg.workflow as Record<string, unknown>;
    const validPatterns = ['graph', 'swarm', 'workflow'];
    if (!validPatterns.includes(workflow.orchestrationPattern as string)) {
      errors.push('Invalid "workflow.orchestrationPattern" - must be "graph", "swarm", or "workflow"');
    }
    const validTriggerTypes = ['local', 'agentcore', 'http'];
    if (!validTriggerTypes.includes(workflow.triggerType as string)) {
      errors.push('Invalid "workflow.triggerType" - must be "local", "agentcore", or "http"');
    }
    if (!workflow.triggerConfig || typeof workflow.triggerConfig !== 'object') {
      errors.push('Missing or invalid "workflow.triggerConfig" field');
    }
    if (!Array.isArray(workflow.agents)) {
      errors.push('Missing or invalid "workflow.agents" array');
    }
    if (!Array.isArray(workflow.edges)) {
      errors.push('Missing or invalid "workflow.edges" array');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
