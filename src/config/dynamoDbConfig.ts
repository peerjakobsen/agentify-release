import * as vscode from 'vscode';
import { getConfigService } from '../services/configService';

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
 * Get the configured DynamoDB table name (sync - VS Code settings only)
 * @returns The table name from settings or the default value
 */
export function getTableName(): string {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return config.get<string>('dynamodb.tableName', DEFAULT_TABLE_NAME);
}

/**
 * Get the configured DynamoDB table name with hierarchy:
 * 1. .agentify/config.json (infrastructure.dynamodb.tableName)
 * 2. VS Code settings (agentify.dynamodb.tableName)
 * 3. Default table name constant
 *
 * @returns Promise resolving to the table name
 */
export async function getTableNameAsync(): Promise<string> {
  // First, check config.json via ConfigService
  const configService = getConfigService();
  if (configService) {
    const config = await configService.getConfig();
    const configTableName = config?.infrastructure?.dynamodb?.tableName;
    if (configTableName && configTableName.trim() !== '') {
      return configTableName;
    }
  }

  // Fall back to VS Code settings
  const vsCodeConfig = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return vsCodeConfig.get<string>('dynamodb.tableName', DEFAULT_TABLE_NAME);
}

/**
 * Get the configured AWS region with hierarchy:
 * 1. .agentify/config.json (infrastructure.dynamodb.region)
 * 2. VS Code settings (agentify.aws.region)
 * 3. Default region constant
 *
 * @returns Promise resolving to the AWS region
 */
export async function getAwsRegion(): Promise<string> {
  // First, check config.json via ConfigService
  const configService = getConfigService();
  if (configService) {
    const config = await configService.getConfig();
    const configRegion = config?.infrastructure?.dynamodb?.region;
    if (configRegion && configRegion.trim() !== '') {
      return configRegion;
    }
  }

  // Fall back to VS Code settings
  const vsCodeConfig = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return vsCodeConfig.get<string>('aws.region', DEFAULT_REGION);
}

/**
 * Get the configured AWS region synchronously from VS Code settings
 * Used internally and for backward compatibility where async is not available
 * @returns The AWS region from VS Code settings or the default value
 */
export function getAwsRegionSync(): string {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return config.get<string>('aws.region', DEFAULT_REGION);
}

/**
 * Get the configured AWS profile from .agentify/config.json
 * Returns undefined if not configured, allowing AWS SDK to use default behavior
 *
 * @returns Promise resolving to the AWS profile name or undefined
 */
export async function getAwsProfile(): Promise<string | undefined> {
  const configService = getConfigService();
  if (configService) {
    const config = await configService.getConfig();
    return config?.aws?.profile;
  }
  return undefined;
}

/**
 * Get the complete DynamoDB configuration
 * @returns Promise resolving to configuration object with all DynamoDB settings
 */
export async function getDynamoDbConfiguration(): Promise<DynamoDbConfiguration> {
  return {
    tableName: getTableName(),
    region: await getAwsRegion(),
  };
}

/**
 * Get the complete DynamoDB configuration synchronously
 * Uses VS Code settings only (does not check config.json)
 * @returns Configuration object with all DynamoDB settings
 */
export function getDynamoDbConfigurationSync(): DynamoDbConfiguration {
  return {
    tableName: getTableName(),
    region: getAwsRegionSync(),
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
      const newConfig = getDynamoDbConfigurationSync();
      listeners.forEach((listener) => listener(newConfig));
    }
  });
}
