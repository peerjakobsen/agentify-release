/**
 * Types of table validation errors
 */
export enum TableValidationErrorType {
  TABLE_NOT_FOUND = 'TABLE_NOT_FOUND',
  TABLE_NOT_ACTIVE = 'TABLE_NOT_ACTIVE',
  CREDENTIALS_NOT_CONFIGURED = 'CREDENTIALS_NOT_CONFIGURED',
  SSO_TOKEN_EXPIRED = 'SSO_TOKEN_EXPIRED',
  ACCESS_DENIED = 'ACCESS_DENIED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Table validation error structure
 */
export interface TableValidationError {
  type: TableValidationErrorType;
  message: string;
}

/**
 * Path to the CDK setup script relative to workspace root
 * Note: The old CloudFormation template has been replaced with CDK infrastructure
 */
export const CDK_SETUP_SCRIPT_PATH = 'scripts/setup.sh';

/**
 * Get user-facing error message when table is not found
 * @param tableName Name of the table that was not found
 * @returns Formatted error message with deployment instructions
 */
export function getTableNotFoundMessage(tableName: string): string {
  return `DynamoDB table '${tableName}' not found.

To deploy the required infrastructure, run the setup script:

  ./scripts/setup.sh --region us-east-1

Or open cdk/README.md for detailed deployment instructions.`;
}

/**
 * Get user-facing error message when SSO token has expired
 * @param profile Optional profile name
 * @returns Formatted error message with SSO login guidance
 */
export function getSsoTokenExpiredMessage(profile?: string): string {
  const profileArg = profile ? ` --profile ${profile}` : '';
  return `AWS SSO session has expired.

Run 'aws sso login${profileArg}' to refresh your credentials.`;
}

/**
 * Get user-facing error message when AWS credentials are not configured
 * @returns Formatted error message with credential setup guidance
 */
export function getCredentialsNotConfiguredMessage(): string {
  return `AWS credentials not configured.

Please configure AWS credentials using one of the following methods:

1. AWS CLI: Run 'aws configure' to set up credentials
2. Environment variables: Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
3. Shared credentials file: Create ~/.aws/credentials
4. IAM role: When running on AWS infrastructure

For more information, see:
https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html`;
}

/**
 * Get user-facing error message when table exists but is not in ACTIVE state
 * @param tableName Name of the table
 * @param currentStatus Current status of the table
 * @returns Formatted error message
 */
export function getTableNotActiveMessage(tableName: string, currentStatus: string): string {
  return `DynamoDB table '${tableName}' exists but is not ready.

Current status: ${currentStatus}

${getStatusGuidance(currentStatus)}`;
}

/**
 * Get guidance based on table status
 * @param status Table status
 * @returns Guidance message
 */
function getStatusGuidance(status: string): string {
  switch (status) {
    case 'CREATING':
      return 'The table is being created. Please wait a few moments and try again.';
    case 'UPDATING':
      return 'The table is being updated. Please wait for the update to complete.';
    case 'DELETING':
      return 'The table is being deleted. You may need to redeploy the infrastructure using ./scripts/setup.sh.';
    case 'ARCHIVED':
      return 'The table is archived. Please redeploy the infrastructure using ./scripts/setup.sh.';
    default:
      return 'Please wait for the table to become ACTIVE or check the AWS Console for details.';
  }
}

/**
 * Get success message when table validation passes
 * @param tableName Name of the validated table
 * @returns Success message
 */
export function getTableValidationSuccessMessage(tableName: string): string {
  return `Agentify: Connected to DynamoDB table '${tableName}'`;
}
