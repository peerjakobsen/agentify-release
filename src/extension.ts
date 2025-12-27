import * as vscode from 'vscode';
import {
  initializeConfigurationWatcher,
  getDynamoDbConfiguration,
  onConfigurationChange,
  DynamoDbConfiguration,
} from './config/dynamoDbConfig';
import { validateTableExists } from './services/tableValidator';
import { resetClients } from './services/dynamoDbClient';
import {
  getTableValidationSuccessMessage,
  TableValidationErrorType,
} from './messages/tableErrors';

/**
 * Extension context for managing lifecycle
 */
let extensionContext: vscode.ExtensionContext | null = null;

/**
 * Activate the extension
 * Called when the extension is first activated
 * @param context Extension context
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  extensionContext = context;

  // Initialize configuration watcher
  const configWatcher = initializeConfigurationWatcher();
  context.subscriptions.push(configWatcher);

  // Subscribe to configuration changes for re-validation
  const configChangeSubscription = onConfigurationChange(handleConfigurationChange);
  context.subscriptions.push(configChangeSubscription);

  // Validate table exists on startup
  await validateAndNotify();
}

/**
 * Deactivate the extension
 * Called when the extension is deactivated
 */
export function deactivate(): void {
  resetClients();
  extensionContext = null;
}

/**
 * Validate the DynamoDB table and show appropriate notification
 */
async function validateAndNotify(): Promise<void> {
  const config = getDynamoDbConfiguration();
  const result = await validateTableExists(config.tableName);

  if (result.isValid) {
    vscode.window.showInformationMessage(
      getTableValidationSuccessMessage(result.tableName)
    );
  } else if (result.error) {
    // Show appropriate error message based on error type
    const errorMessage = result.error.message;

    switch (result.error.type) {
      case TableValidationErrorType.TABLE_NOT_FOUND:
        // Show error with option to open template
        vscode.window.showErrorMessage(
          `Agentify: Table '${result.tableName}' not found. Deploy the CloudFormation template to create it.`,
          'View Template'
        ).then((selection) => {
          if (selection === 'View Template') {
            openCloudFormationTemplate();
          }
        });
        break;

      case TableValidationErrorType.CREDENTIALS_NOT_CONFIGURED:
        vscode.window.showErrorMessage(
          'Agentify: AWS credentials not configured. Please configure AWS credentials to use this extension.',
          'Learn More'
        ).then((selection) => {
          if (selection === 'Learn More') {
            vscode.env.openExternal(
              vscode.Uri.parse('https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html')
            );
          }
        });
        break;

      case TableValidationErrorType.TABLE_NOT_ACTIVE:
        vscode.window.showWarningMessage(
          `Agentify: Table '${result.tableName}' is ${result.tableStatus}. Waiting for table to become active...`
        );
        break;

      case TableValidationErrorType.ACCESS_DENIED:
        vscode.window.showErrorMessage(
          `Agentify: Access denied to table '${result.tableName}'. Check your IAM permissions.`
        );
        break;

      default:
        vscode.window.showErrorMessage(
          `Agentify: ${errorMessage}`
        );
    }

    // Log full error message to output channel for debugging
    console.error('[Agentify]', errorMessage);
  }
}

/**
 * Handle configuration changes
 * @param newConfig New configuration values
 */
async function handleConfigurationChange(newConfig: DynamoDbConfiguration): Promise<void> {
  // Reset clients when configuration changes
  resetClients();

  // Re-validate with new configuration
  await validateAndNotify();
}

/**
 * Open the CloudFormation template file
 */
async function openCloudFormationTemplate(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showWarningMessage(
      'No workspace folder open. Please open a workspace to view the CloudFormation template.'
    );
    return;
  }

  const templatePath = vscode.Uri.joinPath(
    workspaceFolders[0].uri,
    'infrastructure',
    'dynamodb-table.yaml'
  );

  try {
    const doc = await vscode.workspace.openTextDocument(templatePath);
    await vscode.window.showTextDocument(doc);
  } catch {
    vscode.window.showWarningMessage(
      'CloudFormation template not found in workspace. See the Agentify documentation for the template.'
    );
  }
}
