import * as vscode from 'vscode';

/**
 * Configuration interface for DynamoDB settings
 */
export interface DynamoDbConfiguration {
  tableName: string;
  region: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_TABLE_NAME = 'agentify-workflow-events';
export const DEFAULT_REGION = 'us-east-1';

/**
 * Configuration section identifier in VS Code settings
 */
const CONFIG_SECTION = 'agentify';

/**
 * Configuration change listeners
 */
type ConfigChangeListener = (config: DynamoDbConfiguration) => void;
const listeners: ConfigChangeListener[] = [];

/**
 * Get the configured DynamoDB table name
 * @returns The table name from settings or the default value
 */
export function getTableName(): string {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return config.get<string>('dynamodb.tableName', DEFAULT_TABLE_NAME);
}

/**
 * Get the configured AWS region
 * @returns The AWS region from settings or the default value
 */
export function getAwsRegion(): string {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return config.get<string>('aws.region', DEFAULT_REGION);
}

/**
 * Get the complete DynamoDB configuration
 * @returns Configuration object with all DynamoDB settings
 */
export function getDynamoDbConfiguration(): DynamoDbConfiguration {
  return {
    tableName: getTableName(),
    region: getAwsRegion(),
  };
}

/**
 * Subscribe to configuration change events
 * @param listener Function to call when configuration changes
 * @returns Disposable to unsubscribe from changes
 */
export function onConfigurationChange(listener: ConfigChangeListener): vscode.Disposable {
  listeners.push(listener);

  return new vscode.Disposable(() => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  });
}

/**
 * Initialize configuration change monitoring
 * Call this during extension activation
 * @returns Disposable for cleanup
 */
export function initializeConfigurationWatcher(): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration(CONFIG_SECTION)) {
      const newConfig = getDynamoDbConfiguration();
      listeners.forEach((listener) => listener(newConfig));
    }
  });
}
