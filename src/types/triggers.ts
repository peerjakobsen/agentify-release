/**
 * Trigger types for Agentify workflows
 * Defines how workflows can be triggered: locally, via Bedrock AgentCore, or via HTTP
 */

/**
 * Types of workflow triggers
 * - 'local': Execute Python script directly from the IDE
 * - 'agentcore': Invoke Bedrock Agent via AWS APIs
 * - 'http': Send HTTP request to external endpoint
 */
export type TriggerType = 'local' | 'agentcore' | 'http';

/**
 * Configuration for local trigger mode
 * Executes a Python script directly from the IDE with real-time stdout streaming
 */
export interface LocalTriggerConfig {
  /** Type discriminator for local trigger */
  type: 'local';

  /**
   * Path to the entry script relative to workspace root
   * @example "agents/main.py"
   */
  entryScript: string;

  /**
   * Path to the Python interpreter
   * @example ".venv/bin/python" or "python3"
   */
  pythonPath: string;
}

/**
 * Configuration for Bedrock AgentCore trigger mode
 * Invokes a Bedrock Agent via AWS APIs
 */
export interface AgentCoreTriggerConfig {
  /** Type discriminator for AgentCore trigger */
  type: 'agentcore';

  /**
   * ARN of the Bedrock Agent
   * @example "arn:aws:bedrock:us-east-1:123456789012:agent/ABC123DEF"
   */
  agentId: string;

  /**
   * Alias ID for the agent version to invoke
   * @example "TSTALIASID"
   */
  aliasId: string;
}

/**
 * Configuration for HTTP trigger mode
 * Sends HTTP request to external webhook endpoint
 */
export interface HttpTriggerConfig {
  /** Type discriminator for HTTP trigger */
  type: 'http';

  /**
   * Webhook endpoint URL
   * @example "https://api.example.com/workflow/trigger"
   */
  endpoint: string;

  /**
   * HTTP method for the request
   * @default "POST"
   */
  method: 'GET' | 'POST' | 'PUT';
}

/**
 * Discriminated union of all trigger configuration types
 * Use the 'type' field to discriminate between trigger types
 */
export type TriggerConfig = LocalTriggerConfig | AgentCoreTriggerConfig | HttpTriggerConfig;

/**
 * Type guard for LocalTriggerConfig
 * @param config The config to check
 * @returns True if the config is a LocalTriggerConfig
 */
export function isLocalTriggerConfig(config: TriggerConfig): config is LocalTriggerConfig {
  return config.type === 'local';
}

/**
 * Type guard for AgentCoreTriggerConfig
 * @param config The config to check
 * @returns True if the config is an AgentCoreTriggerConfig
 */
export function isAgentCoreTriggerConfig(config: TriggerConfig): config is AgentCoreTriggerConfig {
  return config.type === 'agentcore';
}

/**
 * Type guard for HttpTriggerConfig
 * @param config The config to check
 * @returns True if the config is an HttpTriggerConfig
 */
export function isHttpTriggerConfig(config: TriggerConfig): config is HttpTriggerConfig {
  return config.type === 'http';
}
