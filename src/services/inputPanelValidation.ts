/**
 * Input Panel Validation Service
 * Validates prerequisites for workflow execution in the Demo Viewer panel
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigService, getConfigService } from './configService';
import { validateCredentialsOnActivation } from './credentialValidation';
import type { ValidationError, ValidationState } from '../types/inputPanel';

/**
 * Service for validating input panel requirements
 * Checks entry script, AWS credentials, and project initialization
 */
export class InputPanelValidationService {
  private cachedValidationState: ValidationState | null = null;
  private configChangeDisposable: vscode.Disposable | null = null;

  /**
   * Creates a new InputPanelValidationService
   * @param configService - The config service for reading project configuration
   * @param workspaceRoot - The root directory of the workspace
   */
  constructor(
    private readonly configService: ConfigService,
    private readonly workspaceRoot: string
  ) {
    // Auto-invalidate cache on config changes
    this.configChangeDisposable = this.configService.onConfigChanged(() => {
      this.invalidateCache();
    });
  }

  /**
   * Validates that the entry script file exists
   *
   * @param entryScriptPath - Relative path to the entry script
   * @returns ValidationError if file not found, null if valid
   */
  async validateEntryScript(entryScriptPath: string): Promise<ValidationError | null> {
    if (!entryScriptPath) {
      return {
        type: 'entryScript',
        message: 'Entry script path is not configured. Set workflow.entryScript in config.',
      };
    }

    const fullPath = path.join(this.workspaceRoot, entryScriptPath);
    const fileUri = vscode.Uri.file(fullPath);

    try {
      await vscode.workspace.fs.stat(fileUri);
      return null; // File exists
    } catch {
      return {
        type: 'entryScript',
        message: `Entry script not found: ${entryScriptPath}`,
      };
    }
  }

  /**
   * Validates that AWS credentials are properly configured
   *
   * @returns ValidationError if credentials invalid, null if valid
   */
  async validateAwsCredentials(): Promise<ValidationError | null> {
    const statusState = await validateCredentialsOnActivation();

    if (statusState === 'ready') {
      return null;
    }

    // Map StatusState to appropriate error message
    if (statusState === 'sso-expired') {
      return {
        type: 'awsCredentials',
        message: 'AWS SSO session expired. Run "aws sso login" to refresh.',
      };
    }

    return {
      type: 'awsCredentials',
      message: 'AWS credentials not configured or invalid.',
    };
  }

  /**
   * Validates that the project is initialized with .agentify/config.json
   *
   * @returns ValidationError if not initialized, null if valid
   */
  async validateProjectInitialized(): Promise<ValidationError | null> {
    const isInitialized = await this.configService.isInitialized();

    if (isInitialized) {
      return null;
    }

    return {
      type: 'projectInitialized',
      message: 'Project not initialized. Click "Get Started" to set up Agentify.',
    };
  }

  /**
   * Runs all validations and returns combined result
   *
   * @returns ValidationState with aggregated errors
   */
  async validateAll(): Promise<ValidationState> {
    // Return cached result if available
    if (this.cachedValidationState) {
      return this.cachedValidationState;
    }

    const errors: ValidationError[] = [];

    // 1. Check project initialization first (most fundamental)
    const projectError = await this.validateProjectInitialized();
    if (projectError) {
      errors.push(projectError);
      // If project not initialized, skip other validations
      this.cachedValidationState = { isValid: false, errors };
      return this.cachedValidationState;
    }

    // 2. Get config for entry script path
    const config = await this.configService.getConfig();
    const entryScriptPath = config?.workflow?.entryScript || '';

    // 3. Check entry script exists
    const entryScriptError = await this.validateEntryScript(entryScriptPath);
    if (entryScriptError) {
      errors.push(entryScriptError);
    }

    // 4. Check AWS credentials
    const credentialsError = await this.validateAwsCredentials();
    if (credentialsError) {
      errors.push(credentialsError);
    }

    this.cachedValidationState = {
      isValid: errors.length === 0,
      errors,
    };

    return this.cachedValidationState;
  }

  /**
   * Invalidates the cached validation state
   * Forces re-validation on next validateAll() call
   */
  invalidateCache(): void {
    this.cachedValidationState = null;
  }

  /**
   * Disposes of resources
   */
  dispose(): void {
    if (this.configChangeDisposable) {
      this.configChangeDisposable.dispose();
      this.configChangeDisposable = null;
    }
    this.cachedValidationState = null;
  }
}

/**
 * Singleton instance of the validation service
 */
let validationServiceInstance: InputPanelValidationService | null = null;

/**
 * Gets or creates the InputPanelValidationService singleton
 *
 * @returns The validation service instance, or null if no workspace is open
 */
export function getInputPanelValidationService(): InputPanelValidationService | null {
  if (validationServiceInstance) {
    return validationServiceInstance;
  }

  const configService = getConfigService();
  if (!configService) {
    return null;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }

  validationServiceInstance = new InputPanelValidationService(
    configService,
    workspaceFolders[0].uri.fsPath
  );

  return validationServiceInstance;
}

/**
 * Resets the validation service singleton
 * Useful for testing or when workspace changes
 */
export function resetInputPanelValidationService(): void {
  if (validationServiceInstance) {
    validationServiceInstance.dispose();
    validationServiceInstance = null;
  }
}
