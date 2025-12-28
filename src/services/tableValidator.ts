import { DescribeTableCommand, TableStatus } from '@aws-sdk/client-dynamodb';
import { getDynamoDbClientAsync } from './dynamoDbClient';
import { getTableNameAsync } from '../config/dynamoDbConfig';
import {
  TableValidationError,
  TableValidationErrorType,
  getTableNotFoundMessage,
  getCredentialsNotConfiguredMessage,
  getSsoTokenExpiredMessage,
  getTableNotActiveMessage,
} from '../messages/tableErrors';
import { getDefaultCredentialProvider } from './credentialProvider';

/**
 * Result of table validation
 */
export interface TableValidationResult {
  isValid: boolean;
  tableName: string;
  tableArn?: string;
  tableStatus?: string;
  error?: TableValidationError;
}

/**
 * Validate that the DynamoDB table exists and is in ACTIVE state
 * @param tableName Optional table name to validate (uses configured name if not provided)
 * @returns Validation result with table metadata or error details
 */
export async function validateTableExists(tableName?: string): Promise<TableValidationResult> {
  const targetTableName = tableName ?? await getTableNameAsync();
  const client = await getDynamoDbClientAsync();

  try {
    const command = new DescribeTableCommand({
      TableName: targetTableName,
    });

    const response = await client.send(command);
    const table = response.Table;

    if (!table) {
      return {
        isValid: false,
        tableName: targetTableName,
        error: {
          type: TableValidationErrorType.TABLE_NOT_FOUND,
          message: getTableNotFoundMessage(targetTableName),
        },
      };
    }

    const tableStatus = table.TableStatus;

    // Check if table is in ACTIVE state
    if (tableStatus !== TableStatus.ACTIVE) {
      return {
        isValid: false,
        tableName: targetTableName,
        tableArn: table.TableArn,
        tableStatus: tableStatus,
        error: {
          type: TableValidationErrorType.TABLE_NOT_ACTIVE,
          message: getTableNotActiveMessage(targetTableName, tableStatus ?? 'UNKNOWN'),
        },
      };
    }

    return {
      isValid: true,
      tableName: targetTableName,
      tableArn: table.TableArn,
      tableStatus: tableStatus,
    };
  } catch (error: unknown) {
    // Handle specific AWS errors
    if (error instanceof Error) {
      const errorName = error.name;

      // Table does not exist
      if (errorName === 'ResourceNotFoundException') {
        return {
          isValid: false,
          tableName: targetTableName,
          error: {
            type: TableValidationErrorType.TABLE_NOT_FOUND,
            message: getTableNotFoundMessage(targetTableName),
          },
        };
      }

      // SSO token expired - check BEFORE generic credential errors
      const errorMessage = error.message.toLowerCase();
      if (
        errorName === 'TokenProviderError' ||
        errorMessage.includes('token expired') ||
        errorMessage.includes('sso session') ||
        errorMessage.includes('the sso session')
      ) {
        const profile = getDefaultCredentialProvider().getProfile();
        return {
          isValid: false,
          tableName: targetTableName,
          error: {
            type: TableValidationErrorType.SSO_TOKEN_EXPIRED,
            message: getSsoTokenExpiredMessage(profile),
          },
        };
      }

      // Credentials not configured or invalid
      if (
        errorName === 'CredentialsProviderError' ||
        errorName === 'ExpiredTokenException' ||
        errorName === 'UnrecognizedClientException' ||
        errorName === 'InvalidSignatureException'
      ) {
        return {
          isValid: false,
          tableName: targetTableName,
          error: {
            type: TableValidationErrorType.CREDENTIALS_NOT_CONFIGURED,
            message: getCredentialsNotConfiguredMessage(),
          },
        };
      }

      // Access denied
      if (errorName === 'AccessDeniedException') {
        return {
          isValid: false,
          tableName: targetTableName,
          error: {
            type: TableValidationErrorType.ACCESS_DENIED,
            message: `Access denied to DynamoDB table '${targetTableName}'. Please check your IAM permissions.`,
          },
        };
      }

      // Other errors
      return {
        isValid: false,
        tableName: targetTableName,
        error: {
          type: TableValidationErrorType.UNKNOWN_ERROR,
          message: `Failed to validate table '${targetTableName}': ${error.message}`,
        },
      };
    }

    // Unknown error type
    return {
      isValid: false,
      tableName: targetTableName,
      error: {
        type: TableValidationErrorType.UNKNOWN_ERROR,
        message: `An unexpected error occurred while validating table '${targetTableName}'.`,
      },
    };
  }
}
