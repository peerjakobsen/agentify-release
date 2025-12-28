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
  getAwsProfile,
  DynamoDbConfiguration,
} from './config/dynamoDbConfig';
import { resetClients } from './services/dynamoDbClient';
import { resetBedrockClient } from './services/bedrockClient';
import {
  ConfigService,
  getConfigService,
  resetConfigService,
} from './services/configService';
import {
  getDefaultCredentialProvider,
  resetDefaultCredentialProvider,
} from './services/credentialProvider';
import {
  validateCredentialsOnActivation,
  setStatusUpdateCallback,
} from './services/credentialValidation';
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
import { handleInitializeProject as initializeProjectHandler } from './commands/initializeProject';
import type { AgentifyConfig } from './types';
import type { LogEntry } from './types/logPanel';

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

  // Set up status update callback for credential validation
  setStatusUpdateCallback((state: StatusState) => {
    statusBarManager?.updateStatus(state);
  });

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
    () => handleInitializeProject(context)
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

  // Load Demo Events command (for testing UI)
  const loadDemoEventsCmd = vscode.commands.registerCommand(
    'agentify.loadDemoEvents',
    handleLoadDemoEvents
  );
  context.subscriptions.push(loadDemoEventsCmd);

  // Register refresh credentials command
  const refreshCredentialsCmd = vscode.commands.registerCommand(
    'agentify.refreshCredentials',
    handleRefreshCredentials
  );
  context.subscriptions.push(refreshCredentialsCmd);
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

    // Subscribe to config changes (handles profile and region updates)
    const configChangeSub = configService.onConfigChanged(handleAgentifyConfigChange);
    context.subscriptions.push(configChangeSub);

    // Initialize profile from config
    await initializeProfileFromConfig();

    // Initialize AWS services and validate
    await initializeAwsServices();
  }
}

/**
 * Initialize the AWS profile from config.json
 */
async function initializeProfileFromConfig(): Promise<void> {
  const profile = await getAwsProfile();
  const credentialProvider = getDefaultCredentialProvider();
  credentialProvider.setProfile(profile);
  statusBarManager?.setProfile(profile);
  console.log('[Agentify] Profile initialized:', profile ?? 'default');
}

/**
 * Initialize AWS services and validate connection
 */
async function initializeAwsServices(): Promise<void> {
  if (awsServicesInitialized) {
    return;
  }

  awsServicesInitialized = true;

  // First, validate credentials on activation
  const credentialStatus = await validateCredentialsOnActivation();

  if (credentialStatus !== 'ready') {
    // Update status bar with credential status
    statusBarManager?.updateStatus(credentialStatus);

    // Show warning notification but don't block activation
    if (credentialStatus === 'sso-expired') {
      vscode.window.showWarningMessage(
        'Agentify: AWS SSO token expired. Run "aws sso login" to refresh.',
        'Learn More'
      ).then((selection) => {
        if (selection === 'Learn More') {
          vscode.env.openExternal(
            vscode.Uri.parse('https://docs.aws.amazon.com/cli/latest/userguide/sso-using-profile.html')
          );
        }
      });
    } else {
      vscode.window.showWarningMessage(
        'Agentify: AWS credentials not configured. Some features may be unavailable.',
        'Learn More'
      ).then((selection) => {
        if (selection === 'Learn More') {
          vscode.env.openExternal(
            vscode.Uri.parse('https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html')
          );
        }
      });
    }

    return;
  }

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
    case TableValidationErrorType.SSO_TOKEN_EXPIRED:
      statusBarManager?.updateStatus('sso-expired');
      vscode.window.showWarningMessage(
        'Agentify: AWS SSO session expired. Click to refresh credentials.',
        'Run SSO Login'
      ).then((selection) => {
        if (selection === 'Run SSO Login') {
          // Open terminal with aws sso login command
          const profile = statusBarManager?.getProfile();
          const command = profile
            ? `aws sso login --profile ${profile}`
            : 'aws sso login';
          const terminal = vscode.window.createTerminal({
            name: 'AWS SSO Login',
            hideFromUser: false,
          });
          terminal.show();
          terminal.sendText(command);
        }
      });
      break;

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
async function handleAgentifyConfigChange(config: AgentifyConfig | null): Promise<void> {
  if (config) {
    // Update profile in credential provider if it changed
    const newProfile = config.aws?.profile;
    const credentialProvider = getDefaultCredentialProvider();
    const currentProfile = credentialProvider.getProfile();

    if (newProfile !== currentProfile) {
      console.log('[Agentify] Profile changed:', currentProfile, '->', newProfile ?? 'default');
      credentialProvider.setProfile(newProfile);
      statusBarManager?.setProfile(newProfile);
      // setProfile automatically calls reset() when profile changes

      // Reset AWS clients to use new credentials
      resetClients();
      resetBedrockClient();
    }

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
 * Delegates to the initializeProject command module
 * Handles post-initialization flow including Demo Viewer refresh and status bar update
 */
async function handleInitializeProject(context: vscode.ExtensionContext): Promise<void> {
  // Execute initialization command
  const result = await initializeProjectHandler(context);

  // Handle post-initialization flow
  if (result.success) {
    // Trigger AWS services initialization if config was created
    const configFiles = await vscode.workspace.findFiles('.agentify/config.json', null, 1);
    if (configFiles.length > 0 && !awsServicesInitialized) {
      await initializeWithConfig(context);
    }

    // Refresh Demo Viewer panel to update "Get Started" button visibility
    await refreshDemoViewerPanel();

    // Refresh Ideation Wizard panel
    await refreshIdeationWizardPanel();
  }
}

/**
 * Refresh the Demo Viewer panel after initialization
 * Updates the "Get Started" button visibility based on initialization state
 */
async function refreshDemoViewerPanel(): Promise<void> {
  if (demoViewerProvider) {
    try {
      await demoViewerProvider.refresh();
      console.log('[Agentify] Demo Viewer panel refreshed');
    } catch (error) {
      console.warn('[Agentify] Failed to refresh Demo Viewer panel:', error);
    }
  }
}

/**
 * Refresh the Ideation Wizard panel after initialization
 */
async function refreshIdeationWizardPanel(): Promise<void> {
  if (ideationWizardProvider) {
    try {
      await ideationWizardProvider.refresh();
      console.log('[Agentify] Ideation Wizard panel refreshed');
    } catch (error) {
      console.warn('[Agentify] Failed to refresh Ideation Wizard panel:', error);
    }
  }
}

/**
 * Get the Demo Viewer panel provider
 * Exposed for testing and external refresh triggers
 */
export function getDemoViewerProvider(): DemoViewerPanelProvider | null {
  return demoViewerProvider;
}

/**
 * Get the Ideation Wizard panel provider
 * Exposed for testing and external refresh triggers
 */
export function getIdeationWizardProvider(): IdeationWizardPanelProvider | null {
  return ideationWizardProvider;
}

/**
 * Get the status bar manager
 * Exposed for testing
 */
export function getStatusBarManager(): StatusBarManager | null {
  return statusBarManager;
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
 * Command handler: Refresh Credentials
 * Clears credential caches, re-validates, and updates status bar
 */
async function handleRefreshCredentials(): Promise<void> {
  // Show progress while checking
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Checking AWS credentials...',
      cancellable: false,
    },
    async () => {
      // Reset all credential caches
      resetDefaultCredentialProvider();
      resetClients();
      resetBedrockClient();

      // Re-initialize profile from config (crucial - new provider needs profile set)
      await initializeProfileFromConfig();

      // Re-validate credentials and update status
      const credentialStatus = await validateCredentialsOnActivation();

      if (credentialStatus === 'ready') {
        // Credentials are now valid - also validate table access
        await validateAndUpdateStatus();
      } else {
        // Still have credential issues
        statusBarManager?.updateStatus(credentialStatus);

        if (credentialStatus === 'sso-expired') {
          vscode.window.showWarningMessage(
            'AWS SSO token still expired. Please complete the SSO login in the terminal.'
          );
        } else {
          vscode.window.showWarningMessage(
            'AWS credentials still invalid. Please check your configuration.'
          );
        }
      }
    }
  );
}

/**
 * Command handler: Load Demo Events
 * Injects sample log entries for UI testing
 */
async function handleLoadDemoEvents(): Promise<void> {
  if (!demoViewerProvider) {
    vscode.window.showWarningMessage('Demo Viewer panel not available');
    return;
  }

  // Generate sample events that simulate a realistic workflow
  const baseTime = Date.now();
  const sampleEvents: LogEntry[] = [
    {
      id: `demo-${baseTime}-1`,
      timestamp: baseTime,
      eventType: 'node_start',
      agentName: 'orchestrator_agent',
      summary: 'Agent started',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    },
    {
      id: `demo-${baseTime}-2`,
      timestamp: baseTime + 150,
      eventType: 'tool_call',
      agentName: 'orchestrator_agent',
      summary: 'Tool: bedrock -> invoke_model',
      payload: {
        system: 'bedrock',
        operation: 'invoke_model',
        input: {
          model_id: 'anthropic.claude-3-sonnet',
          prompt: 'Analyze the user request and determine the next steps...',
          max_tokens: 4096,
        },
      },
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    },
    {
      id: `demo-${baseTime}-3`,
      timestamp: baseTime + 1200,
      eventType: 'tool_result',
      agentName: 'orchestrator_agent',
      summary: 'Tool completed: bedrock -> invoke_model',
      payload: {
        system: 'bedrock',
        operation: 'invoke_model',
        output: {
          response: 'I will help you with that request. Let me delegate to the researcher agent...',
          usage: { input_tokens: 156, output_tokens: 89 },
        },
      },
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'success',
    },
    {
      id: `demo-${baseTime}-4`,
      timestamp: baseTime + 1250,
      eventType: 'node_stop',
      agentName: 'orchestrator_agent',
      summary: 'Agent completed (1.2s)',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'success',
      durationMs: 1250,
    },
    {
      id: `demo-${baseTime}-5`,
      timestamp: baseTime + 1300,
      eventType: 'node_start',
      agentName: 'researcher_agent',
      summary: 'Agent started',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    },
    {
      id: `demo-${baseTime}-6`,
      timestamp: baseTime + 1450,
      eventType: 'tool_call',
      agentName: 'researcher_agent',
      summary: 'Tool: filesystem -> read_file',
      payload: {
        system: 'filesystem',
        operation: 'read_file',
        input: { path: '/src/config/settings.json' },
      },
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    },
    {
      id: `demo-${baseTime}-7`,
      timestamp: baseTime + 1520,
      eventType: 'tool_result',
      agentName: 'researcher_agent',
      summary: 'Tool completed: filesystem -> read_file',
      payload: {
        system: 'filesystem',
        operation: 'read_file',
        output: {
          content: '{\n  "appName": "MyApp",\n  "version": "1.0.0",\n  "features": {\n    "darkMode": true,\n    "notifications": true\n  }\n}',
          bytes: 142,
        },
      },
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'success',
    },
    {
      id: `demo-${baseTime}-8`,
      timestamp: baseTime + 1600,
      eventType: 'tool_call',
      agentName: 'researcher_agent',
      summary: 'Tool: web -> fetch_url',
      payload: {
        system: 'web',
        operation: 'fetch_url',
        input: { url: 'https://api.example.com/data', method: 'GET' },
      },
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    },
    {
      id: `demo-${baseTime}-9`,
      timestamp: baseTime + 2800,
      eventType: 'tool_result',
      agentName: 'researcher_agent',
      summary: 'Tool failed: Connection timeout',
      payload: {
        system: 'web',
        operation: 'fetch_url',
        error: 'Connection timeout after 1200ms',
      },
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'error',
      errorMessage: 'Connection timeout after 1200ms',
    },
    {
      id: `demo-${baseTime}-10`,
      timestamp: baseTime + 2900,
      eventType: 'node_stop',
      agentName: 'researcher_agent',
      summary: 'Agent completed (1.6s)',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'success',
      durationMs: 1600,
    },
    {
      id: `demo-${baseTime}-11`,
      timestamp: baseTime + 3000,
      eventType: 'node_start',
      agentName: 'writer_agent',
      summary: 'Agent started',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    },
    {
      id: `demo-${baseTime}-12`,
      timestamp: baseTime + 3100,
      eventType: 'tool_call',
      agentName: 'writer_agent',
      summary: 'Tool: bedrock -> invoke_model',
      payload: {
        system: 'bedrock',
        operation: 'invoke_model',
        input: {
          model_id: 'anthropic.claude-3-sonnet',
          prompt: 'Based on the research findings, generate a summary report...',
        },
      },
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'neutral',
    },
    {
      id: `demo-${baseTime}-13`,
      timestamp: baseTime + 4500,
      eventType: 'tool_result',
      agentName: 'writer_agent',
      summary: 'Tool completed: bedrock -> invoke_model',
      payload: {
        system: 'bedrock',
        operation: 'invoke_model',
        output: {
          response: 'Here is your summary report:\n\n## Analysis Results\n\nThe application configuration shows...',
          usage: { input_tokens: 892, output_tokens: 456 },
        },
      },
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'success',
    },
    {
      id: `demo-${baseTime}-14`,
      timestamp: baseTime + 4600,
      eventType: 'node_stop',
      agentName: 'writer_agent',
      summary: 'Agent completed (1.6s)',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'success',
      durationMs: 1600,
    },
    {
      id: `demo-${baseTime}-15`,
      timestamp: baseTime + 4700,
      eventType: 'workflow_complete',
      agentName: 'Workflow',
      summary: 'Workflow completed (4.7s)',
      isExpanded: false,
      isTruncationExpanded: false,
      status: 'success',
      durationMs: 4700,
    },
  ];

  // Add events to the log panel
  for (const event of sampleEvents) {
    demoViewerProvider.addLogEntry(event);
  }

  // Set demo outcome panel with sample result
  const sampleResult = `## Inventory Optimization Report

Based on analysis of current stock levels and demand forecasts:

### Key Findings
- **SKU-2847**: Stock levels critically low (12 units remaining)
- **SKU-1923**: Overstock detected (340 units, 45 days supply)
- **SKU-5521**: Demand spike predicted for next week (+180%)

### Recommended Actions
1. Place urgent reorder for SKU-2847 (recommended: 500 units)
2. Run promotion on SKU-1923 to reduce overstock
3. Pre-position SKU-5521 inventory in regional warehouses

### Financial Impact
- Projected savings: **$47,200** over next quarter
- Stockout prevention value: **$12,800**`;

  const sampleSources = [
    'SAP S/4HANA Inventory',
    'Databricks Demand Forecast',
    'Weather API',
  ];

  demoViewerProvider.setOutcomeSuccess(sampleResult, sampleSources);

  vscode.window.showInformationMessage(`Loaded ${sampleEvents.length} demo events into Execution Log + Outcome Panel`);
}

/**
 * Deactivate the extension
 * Called when the extension is deactivated
 */
export function deactivate(): void {
  // Clear status update callback
  setStatusUpdateCallback(null);

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
