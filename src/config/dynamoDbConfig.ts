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
 * Infrastructure deployment configuration interface
 * Matches the schema written by setup.sh to .agentify/infrastructure.json
 */
export interface InfrastructureDeploymentConfig {
  region: string;
  vpc_subnet_ids: string;
  vpc_security_group_id: string;
  workflow_events_table: string;
  deployed_at: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_TABLE_NAME = 'agentify-workflow-events';
export const DEFAULT_REGION = 'us-east-1';

/**
 * Infrastructure file path relative to workspace root
 * This file is created by setup.sh after CDK deployment
 */
export const INFRASTRUCTURE_FILE_PATH = '.agentify/infrastructure.json';

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
 * Read and parse infrastructure.json from the workspace
 * @returns The parsed infrastructure config or null if file doesn't exist
 */
async function readInfrastructureConfig(): Promise<InfrastructureDeploymentConfig | null> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }

  const infrastructureUri = vscode.Uri.joinPath(
    workspaceFolders[0].uri,
    INFRASTRUCTURE_FILE_PATH
  );

  try {
    const content = await vscode.workspace.fs.readFile(infrastructureUri);
    if (!content) {
      return null;
    }
    const json = JSON.parse(Buffer.from(content).toString('utf-8'));
    return json as InfrastructureDeploymentConfig;
  } catch (error) {
    // File doesn't exist or is invalid - return null to trigger fallback
    if (
      error instanceof Error &&
      (error.name === 'FileNotFound' ||
        error.message.includes('ENOENT') ||
        (error as NodeJS.ErrnoException).code === 'FileNotFound')
    ) {
      return null;
    }
    // For parse errors, also return null and fall back
    return null;
  }
}

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
 * 1. .agentify/infrastructure.json (workflow_events_table)
 * 2. .agentify/config.json (infrastructure.dynamodb.tableName)
 * 3. VS Code settings (agentify.dynamodb.tableName)
 * 4. Default table name constant
 *
 * @returns Promise resolving to the table name
 */
export async function getTableNameAsync(): Promise<string> {
  // First, check infrastructure.json (created by setup.sh)
  const infrastructureConfig = await readInfrastructureConfig();
  if (infrastructureConfig?.workflow_events_table && infrastructureConfig.workflow_events_table.trim() !== '') {
    return infrastructureConfig.workflow_events_table;
  }

  // Second, check config.json via ConfigService (backward compatibility)
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
 * 1. .agentify/infrastructure.json (region)
 * 2. .agentify/config.json (infrastructure.dynamodb.region)
 * 3. VS Code settings (agentify.aws.region)
 * 4. Default region constant
 *
 * @returns Promise resolving to the AWS region
 */
export async function getAwsRegion(): Promise<string> {
  // First, check infrastructure.json (created by setup.sh)
  const infrastructureConfig = await readInfrastructureConfig();
  if (infrastructureConfig?.region && infrastructureConfig.region.trim() !== '') {
    return infrastructureConfig.region;
  }

  // Second, check config.json via ConfigService (backward compatibility)
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
    tableName: await getTableNameAsync(),
    region: await getAwsRegion(),
  };
}

/**
 * Get the complete DynamoDB configuration synchronously
 * Uses VS Code settings only (does not check config.json or infrastructure.json)
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
