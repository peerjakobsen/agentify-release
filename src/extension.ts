/**
 * Agentify Extension Entry Point
 * Provides AI agent workflow observability and ideation for Kiro IDE
 *
 * Activation Strategy:
 * - Commands are registered immediately on any activation trigger
 * - Panels and AWS services only initialize when .agentify/config.json exists
 * - Status bar reflects current project and AWS connection state
 */

import * as vscode from 'vscode';
import {
  initializeConfigurationWatcher,
  onConfigurationChange,
  DynamoDbConfiguration,
} from './config/dynamoDbConfig';
import { resetClients } from './services/dynamoDbClient';
import { resetBedrockClient } from './services/bedrockClient';
import { ConfigService, getConfigService, resetConfigService } from './services/configService';
import { resetDefaultCredentialProvider } from './services/credentialProvider';
import { validateTableExists } from './services/tableValidator';
import { StatusBarManager, StatusState } from './statusBar';
import {
  DemoViewerPanelProvider,
  DEMO_VIEWER_VIEW_ID,
} from './panels/demoViewerPanel';
import {
  IdeationWizardPanelProvider,
  IDEATION_WIZARD_VIEW_ID,
} from './panels/ideationWizardPanel';
import { TableValidationErrorType } from './messages/tableErrors';

/**
 * Extension context for managing lifecycle
 */
let extensionContext: vscode.ExtensionContext | null = null;

/**
 * Status bar manager instance
 */
let statusBarManager: StatusBarManager | null = null;

/**
 * Panel providers
 */
let demoViewerProvider: DemoViewerPanelProvider | null = null;
let ideationWizardProvider: IdeationWizardPanelProvider | null = null;

/**
 * Config service instance
 */
let configService: ConfigService | null = null;

/**
 * Whether AWS services have been initialized
 */
let awsServicesInitialized = false;

/**
 * Activate the extension
 * Called when the extension is first activated
 * @param context Extension context
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  extensionContext = context;

  // Create status bar immediately
  statusBarManager = new StatusBarManager();
  context.subscriptions.push({ dispose: () => statusBarManager?.dispose() });

  // Register commands immediately (available regardless of config state)
  registerCommands(context);

  // Initialize configuration watcher for VS Code settings
  const configWatcher = initializeConfigurationWatcher();
  context.subscriptions.push(configWatcher);

  // Subscribe to configuration changes for re-validation
  const configChangeSubscription = onConfigurationChange(handleVsCodeConfigChange);
  context.subscriptions.push(configChangeSubscription);

  // Check for Agentify project config and initialize accordingly
  await initializeForWorkspace(context);
}

/**
 * Register all extension commands
 * Commands are registered immediately and work in both initialized and uninitialized states
 */
function registerCommands(context: vscode.ExtensionContext): void {
  // Initialize Project command
  const initializeCmd = vscode.commands.registerCommand(
    'agentify.initializeProject',
    handleInitializeProject
  );
  context.subscriptions.push(initializeCmd);

  // Open Demo Viewer command
  const openDemoViewerCmd = vscode.commands.registerCommand(
    'agentify.openDemoViewer',
    handleOpenDemoViewer
  );
  context.subscriptions.push(openDemoViewerCmd);

  // Open Ideation Wizard command
  const openIdeationWizardCmd = vscode.commands.registerCommand(
    'agentify.openIdeationWizard',
    handleOpenIdeationWizard
  );
  context.subscriptions.push(openIdeationWizardCmd);

  // Show Status command
  const showStatusCmd = vscode.commands.registerCommand(
    'agentify.showStatus',
    handleShowStatus
  );
  context.subscriptions.push(showStatusCmd);
}

/**
 * Initialize extension based on workspace state
 * Checks for .agentify/config.json and initializes services accordingly
 */
async function initializeForWorkspace(context: vscode.ExtensionContext): Promise<void> {
  // Check if .agentify/config.json exists in the workspace
  const configFiles = await vscode.workspace.findFiles('.agentify/config.json', null, 1);
  const hasConfig = configFiles.length > 0;

  if (hasConfig) {
    // Initialize config service and watch for changes
    await initializeWithConfig(context);
  } else {
    // Update status bar to show not initialized
    statusBarManager?.updateStatus('not-initialized');
  }

  // Register panel providers (they show placeholder content until project is initialized)
  registerPanelProviders(context);
}

/**
 * Initialize extension when config file exists
 */
async function initializeWithConfig(context: vscode.ExtensionContext): Promise<void> {
  // Get or create config service
  configService = getConfigService();

  if (configService) {
    // Start watching for config file changes
    const watcherDisposable = configService.startWatching();
    context.subscriptions.push(watcherDisposable);

    // Subscribe to config changes
    const configChangeSub = configService.onConfigChanged(handleAgentifyConfigChange);
    context.subscriptions.push(configChangeSub);

    // Initialize AWS services and validate
    await initializeAwsServices();
  }
}

/**
 * Initialize AWS services and validate connection
 */
async function initializeAwsServices(): Promise<void> {
  if (awsServicesInitialized) {
    return;
  }

  awsServicesInitialized = true;

  // Validate DynamoDB table exists and is accessible
  await validateAndUpdateStatus();
}

/**
 * Validate AWS connection and update status bar
 */
async function validateAndUpdateStatus(): Promise<void> {
  try {
    const result = await validateTableExists();

    if (result.isValid) {
      statusBarManager?.updateStatus('ready');
      vscode.window.showInformationMessage(
        `Agentify: Connected to DynamoDB table '${result.tableName}'`
      );
    } else if (result.error) {
      handleValidationError(result.error.type, result.error.message);
    }
  } catch (error) {
    console.error('[Agentify] Validation error:', error);
    statusBarManager?.updateStatus('aws-error');
  }
}

/**
 * Handle validation errors and update status
 */
function handleValidationError(errorType: TableValidationErrorType, message: string): void {
  switch (errorType) {
    case TableValidationErrorType.CREDENTIALS_NOT_CONFIGURED:
      statusBarManager?.updateStatus('aws-error');
      vscode.window.showErrorMessage(
        'Agentify: AWS credentials not configured. Please configure AWS credentials.',
        'Learn More'
      ).then((selection) => {
        if (selection === 'Learn More') {
          vscode.env.openExternal(
            vscode.Uri.parse('https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html')
          );
        }
      });
      break;

    case TableValidationErrorType.TABLE_NOT_FOUND:
      statusBarManager?.updateStatus('aws-error');
      vscode.window.showErrorMessage(
        'Agentify: DynamoDB table not found. Deploy the CloudFormation template to create it.'
      );
      break;

    case TableValidationErrorType.ACCESS_DENIED:
      statusBarManager?.updateStatus('aws-error');
      vscode.window.showErrorMessage(
        'Agentify: Access denied to DynamoDB table. Check your IAM permissions.'
      );
      break;

    default:
      statusBarManager?.updateStatus('aws-error');
      vscode.window.showErrorMessage(`Agentify: ${message}`);
  }

  console.error('[Agentify]', message);
}

/**
 * Register panel providers for the Activity Bar
 */
function registerPanelProviders(context: vscode.ExtensionContext): void {
  // Create Demo Viewer provider
  demoViewerProvider = new DemoViewerPanelProvider(context.extensionUri);
  const demoViewerRegistration = vscode.window.registerWebviewViewProvider(
    DEMO_VIEWER_VIEW_ID,
    demoViewerProvider
  );
  context.subscriptions.push(demoViewerRegistration);

  // Create Ideation Wizard provider
  ideationWizardProvider = new IdeationWizardPanelProvider(context.extensionUri);
  const ideationWizardRegistration = vscode.window.registerWebviewViewProvider(
    IDEATION_WIZARD_VIEW_ID,
    ideationWizardProvider
  );
  context.subscriptions.push(ideationWizardRegistration);
}

/**
 * Handle VS Code configuration changes (settings.json)
 */
async function handleVsCodeConfigChange(newConfig: DynamoDbConfiguration): Promise<void> {
  // Reset clients when configuration changes
  resetClients();
  resetBedrockClient();

  // Re-validate with new configuration if we have a project
  if (awsServicesInitialized) {
    await validateAndUpdateStatus();
  }
}

/**
 * Handle Agentify config file changes (.agentify/config.json)
 */
async function handleAgentifyConfigChange(config: unknown): Promise<void> {
  if (config) {
    // Config exists - ensure AWS services are initialized
    if (!awsServicesInitialized) {
      await initializeAwsServices();
    } else {
      // Re-validate connection
      await validateAndUpdateStatus();
    }
  } else {
    // Config was deleted - update status
    statusBarManager?.updateStatus('not-initialized');
    awsServicesInitialized = false;
  }
}

/**
 * Command handler: Initialize Project
 */
async function handleInitializeProject(): Promise<void> {
  // Stub implementation - will be implemented in Spec #4
  vscode.window.showInformationMessage(
    'Initialize Project command coming soon. This will set up Agentify in your workspace.'
  );
}

/**
 * Command handler: Open Demo Viewer
 */
async function handleOpenDemoViewer(): Promise<void> {
  // Focus the Demo Viewer panel
  await vscode.commands.executeCommand(`${DEMO_VIEWER_VIEW_ID}.focus`);
}

/**
 * Command handler: Open Ideation Wizard
 */
async function handleOpenIdeationWizard(): Promise<void> {
  // Focus the Ideation Wizard panel
  await vscode.commands.executeCommand(`${IDEATION_WIZARD_VIEW_ID}.focus`);
}

/**
 * Command handler: Show Status
 */
async function handleShowStatus(): Promise<void> {
  await statusBarManager?.showQuickPick();
}

/**
 * Deactivate the extension
 * Called when the extension is deactivated
 */
export function deactivate(): void {
  // Reset all AWS clients
  resetClients();
  resetBedrockClient();
  resetDefaultCredentialProvider();

  // Reset config service
  resetConfigService();

  // Clean up status bar (handled by subscriptions, but reset for clarity)
  statusBarManager = null;

  // Reset panel providers
  demoViewerProvider = null;
  ideationWizardProvider = null;

  // Reset state
  configService = null;
  awsServicesInitialized = false;
  extensionContext = null;
}
