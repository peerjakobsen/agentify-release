/**
 * Configuration service for Agentify projects
 * Manages the .agentify/config.json file with full CRUD operations
 * and file change monitoring.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import type {
  AgentifyConfig,
  ConfigValidationResult,
} from '../types';
import {
  validateConfigSchema,
  createConfigNotFoundError,
  createConfigInvalidError,
} from '../types';

/**
 * Configuration file path relative to workspace root
 */
export const CONFIG_FILE_PATH = '.agentify/config.json';

/**
 * Event fired when configuration changes
 */
type ConfigChangeListener = (config: AgentifyConfig | null) => void;

/**
 * Service for managing Agentify project configuration
 * Handles reading, writing, validation, and change monitoring of .agentify/config.json
 */
export class ConfigService {
  private cachedConfig: AgentifyConfig | null = null;
  private configLoaded = false;
  private fileWatcher: vscode.FileSystemWatcher | null = null;
  private listeners: ConfigChangeListener[] = [];

  /**
   * Creates a new ConfigService instance
   * @param workspaceRoot The root directory of the workspace
   */
  constructor(private readonly workspaceRoot: string) {}

  /**
   * Get the full path to the config file
   */
  private getConfigPath(): string {
    return path.join(this.workspaceRoot, CONFIG_FILE_PATH);
  }

  /**
   * Check if the project has been initialized with an Agentify config
   * @returns True if .agentify/config.json exists
   */
  async isInitialized(): Promise<boolean> {
    const configUri = vscode.Uri.file(this.getConfigPath());
    try {
      await vscode.workspace.fs.stat(configUri);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current configuration
   * Returns cached config if available, otherwise reads from disk
   *
   * @returns The configuration or null if not initialized
   */
  async getConfig(): Promise<AgentifyConfig | null> {
    if (this.configLoaded) {
      return this.cachedConfig;
    }

    return this.loadConfig();
  }

  /**
   * Load configuration from disk
   * @returns The loaded configuration or null if file doesn't exist
   */
  private async loadConfig(): Promise<AgentifyConfig | null> {
    const configUri = vscode.Uri.file(this.getConfigPath());

    try {
      const content = await vscode.workspace.fs.readFile(configUri);
      // Handle case where content is undefined/null (mock environments)
      if (!content) {
        this.cachedConfig = null;
        this.configLoaded = true;
        return null;
      }
      const json = JSON.parse(Buffer.from(content).toString('utf-8'));
      this.cachedConfig = json as AgentifyConfig;
      this.configLoaded = true;
      return this.cachedConfig;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'FileNotFound' ||
          error.message.includes('ENOENT') ||
          (error as NodeJS.ErrnoException).code === 'FileNotFound')
      ) {
        this.cachedConfig = null;
        this.configLoaded = true;
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new configuration file
   * Creates the .agentify directory if it doesn't exist
   *
   * @param config The configuration to write
   */
  async createConfig(config: AgentifyConfig): Promise<void> {
    // Validate the config before writing
    const validation = validateConfigSchema(config);
    if (!validation.isValid) {
      throw createConfigInvalidError(validation.errors);
    }

    const configUri = vscode.Uri.file(this.getConfigPath());
    const dirUri = vscode.Uri.file(path.dirname(this.getConfigPath()));

    // Create the .agentify directory if needed
    try {
      await vscode.workspace.fs.createDirectory(dirUri);
    } catch {
      // Directory might already exist, that's fine
    }

    // Write the config file
    const content = Buffer.from(JSON.stringify(config, null, 2), 'utf-8');
    await vscode.workspace.fs.writeFile(configUri, content);

    // Update cache
    this.cachedConfig = config;
    this.configLoaded = true;

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Update an existing configuration
   * Merges the partial update with the existing config
   *
   * @param partial Partial configuration to merge
   */
  async updateConfig(partial: Partial<AgentifyConfig>): Promise<void> {
    const current = await this.getConfig();
    if (!current) {
      throw createConfigNotFoundError(this.getConfigPath());
    }

    // Deep merge the configs
    const updated: AgentifyConfig = {
      ...current,
      ...partial,
      project: partial.project
        ? { ...current.project, ...partial.project }
        : current.project,
      infrastructure: partial.infrastructure
        ? {
            ...current.infrastructure,
            ...partial.infrastructure,
            dynamodb: partial.infrastructure.dynamodb
              ? { ...current.infrastructure.dynamodb, ...partial.infrastructure.dynamodb }
              : current.infrastructure.dynamodb,
          }
        : current.infrastructure,
      workflow: partial.workflow
        ? { ...current.workflow, ...partial.workflow }
        : current.workflow,
    };

    // Handle optional aws section deep merge
    if (partial.aws !== undefined) {
      updated.aws = current.aws
        ? { ...current.aws, ...partial.aws }
        : partial.aws;
    }

    // Handle optional observability section deep merge
    if (partial.observability !== undefined) {
      updated.observability = current.observability
        ? { ...current.observability, ...partial.observability }
        : partial.observability;
    }

    // Handle optional routing section deep merge
    if (partial.routing !== undefined) {
      updated.routing = current.routing
        ? { ...current.routing, ...partial.routing }
        : partial.routing;
    }

    // Validate before writing
    const validation = validateConfigSchema(updated);
    if (!validation.isValid) {
      throw createConfigInvalidError(validation.errors);
    }

    const configUri = vscode.Uri.file(this.getConfigPath());
    const content = Buffer.from(JSON.stringify(updated, null, 2), 'utf-8');
    await vscode.workspace.fs.writeFile(configUri, content);

    // Update cache
    this.cachedConfig = updated;

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Validate the current configuration
   * @returns Validation result with isValid flag and any errors
   */
  async validateConfig(): Promise<ConfigValidationResult> {
    const config = await this.getConfig();
    if (!config) {
      return {
        isValid: false,
        errors: ['Configuration file not found'],
      };
    }

    return validateConfigSchema(config);
  }

  /**
   * Subscribe to configuration change events
   * @param listener Function to call when config changes
   * @returns Disposable to unsubscribe
   */
  onConfigChanged(listener: ConfigChangeListener): vscode.Disposable {
    this.listeners.push(listener);

    return new vscode.Disposable(() => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    });
  }

  /**
   * Start watching the config file for changes
   * @returns Disposable to stop watching
   */
  startWatching(): vscode.Disposable {
    if (this.fileWatcher) {
      return new vscode.Disposable(() => {});
    }

    const pattern = new vscode.RelativePattern(
      this.workspaceRoot,
      CONFIG_FILE_PATH
    );

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    // Handle file changes
    const changeHandler = async () => {
      this.configLoaded = false;
      await this.loadConfig();
      this.notifyListeners();
    };

    // Handle file deletion
    const deleteHandler = () => {
      this.cachedConfig = null;
      this.configLoaded = true;
      this.notifyListeners();
    };

    // Handle file creation
    const createHandler = async () => {
      this.configLoaded = false;
      await this.loadConfig();
      this.notifyListeners();
    };

    this.fileWatcher.onDidChange(changeHandler);
    this.fileWatcher.onDidDelete(deleteHandler);
    this.fileWatcher.onDidCreate(createHandler);

    return new vscode.Disposable(() => {
      this.stopWatching();
    });
  }

  /**
   * Stop watching the config file
   */
  stopWatching(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = null;
    }
  }

  /**
   * Notify all listeners of a configuration change
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.cachedConfig);
    }
  }

  /**
   * Clear the cached configuration
   * Forces a reload on next access
   */
  clearCache(): void {
    this.cachedConfig = null;
    this.configLoaded = false;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stopWatching();
    this.listeners = [];
    this.cachedConfig = null;
    this.configLoaded = false;
  }
}

/**
 * Singleton ConfigService instance
 */
let configServiceInstance: ConfigService | null = null;

/**
 * Get or create the ConfigService for the current workspace
 * @returns The ConfigService instance or null if no workspace is open
 */
export function getConfigService(): ConfigService | null {
  if (configServiceInstance) {
    return configServiceInstance;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }

  configServiceInstance = new ConfigService(workspaceFolders[0].uri.fsPath);
  return configServiceInstance;
}

/**
 * Reset the ConfigService singleton
 * Useful for testing or when workspace changes
 */
export function resetConfigService(): void {
  if (configServiceInstance) {
    configServiceInstance.dispose();
    configServiceInstance = null;
  }
}
