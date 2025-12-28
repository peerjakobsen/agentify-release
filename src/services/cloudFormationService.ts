/**
 * CloudFormation service for deploying and managing stacks
 * Provides infrastructure deployment for Agentify DynamoDB tables
 *
 * Following patterns established in credentialProvider.ts and tableValidator.ts
 */

import {
  CloudFormationClient,
  CreateStackCommand,
  DescribeStacksCommand,
  DescribeStackEventsCommand,
  StackStatus,
  type Output,
} from '@aws-sdk/client-cloudformation';
import * as fs from 'fs';
import * as path from 'path';
import {
  ICredentialProvider,
  getDefaultCredentialProvider,
} from './credentialProvider';
import { AgentifyError, AgentifyErrorCode } from '../types';

/**
 * Stack deployment result containing outputs from CloudFormation
 */
export interface StackDeploymentResult {
  /** The stack ID returned by CloudFormation */
  stackId: string;
  /** The table name output from the stack */
  tableName: string;
  /** The table ARN output from the stack */
  tableArn: string;
}

/**
 * Stack output extracted from DescribeStacks response
 */
export interface StackOutputs {
  /** The DynamoDB table name */
  tableName: string;
  /** The DynamoDB table ARN */
  tableArn: string;
}

/**
 * Configuration for CloudFormation service
 */
export interface CloudFormationServiceConfig {
  /** AWS region for CloudFormation operations */
  region: string;
  /** Optional credential provider (defaults to DefaultCredentialProvider) */
  credentialProvider?: ICredentialProvider;
}

/**
 * Interface for CloudFormation service operations
 * Enables dependency injection and testing
 */
export interface ICloudFormationService {
  /**
   * Deploy a CloudFormation stack
   * @param stackName Name for the CloudFormation stack
   * @param templateBody CloudFormation template content
   * @param tableName Table name parameter for the template
   * @returns Stack ID for tracking deployment
   */
  deployStack(
    stackName: string,
    templateBody: string,
    tableName: string
  ): Promise<string>;

  /**
   * Wait for stack creation to complete
   * @param stackId Stack ID to monitor
   * @param pollingIntervalMs Polling interval in milliseconds (default: 5000)
   * @returns Resolves when stack reaches CREATE_COMPLETE
   * @throws AgentifyError on CREATE_FAILED or ROLLBACK states
   */
  waitForStackComplete(
    stackId: string,
    pollingIntervalMs?: number
  ): Promise<void>;

  /**
   * Get outputs from a completed stack
   * @param stackId Stack ID to query
   * @returns Stack outputs containing TableName and TableArn
   */
  getStackOutputs(stackId: string): Promise<StackOutputs>;
}

/**
 * Prefix for auto-generated stack names
 */
const STACK_NAME_PREFIX = 'agentify-workflow-events-';

/**
 * Maximum length for CloudFormation stack names
 */
const MAX_STACK_NAME_LENGTH = 128;

/**
 * Default polling interval for stack status (5 seconds)
 */
const DEFAULT_POLLING_INTERVAL_MS = 5000;

/**
 * Maximum wait time for stack creation (10 minutes)
 */
const MAX_WAIT_TIME_MS = 10 * 60 * 1000;

/**
 * Sanitizes a workspace name for use in CloudFormation stack names
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes consecutive hyphens
 * - Truncates to fit within 128 character limit
 *
 * @param workspaceName The workspace name to sanitize
 * @returns Sanitized stack name in format: agentify-workflow-events-{sanitized-name}
 */
export function sanitizeStackName(workspaceName: string): string {
  // Handle empty or whitespace-only names
  const trimmed = workspaceName.trim();
  if (!trimmed) {
    return `${STACK_NAME_PREFIX}default`;
  }

  // Convert to lowercase
  let sanitized = trimmed.toLowerCase();

  // Replace spaces and special characters with hyphens
  // CloudFormation allows: alphanumeric, hyphens
  sanitized = sanitized.replace(/[^a-z0-9-]/g, '-');

  // Remove consecutive hyphens
  sanitized = sanitized.replace(/-+/g, '-');

  // Remove leading and trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, '');

  // Handle case where sanitization results in empty string
  if (!sanitized) {
    return `${STACK_NAME_PREFIX}default`;
  }

  // Calculate available length for workspace name
  const maxWorkspaceLength = MAX_STACK_NAME_LENGTH - STACK_NAME_PREFIX.length;

  // Truncate if necessary
  if (sanitized.length > maxWorkspaceLength) {
    sanitized = sanitized.substring(0, maxWorkspaceLength);
    // Remove trailing hyphen if truncation created one
    sanitized = sanitized.replace(/-+$/, '');
  }

  return `${STACK_NAME_PREFIX}${sanitized}`;
}

/**
 * Reads the CloudFormation template from the bundled extension files
 *
 * @param extensionPath Path to the extension root directory
 * @returns CloudFormation template content as string
 * @throws Error if template file cannot be read
 */
export function getCloudFormationTemplate(extensionPath: string): string {
  const templatePath = path.join(extensionPath, 'infrastructure', 'dynamodb-table.yaml');

  try {
    return fs.readFileSync(templatePath, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new AgentifyError(
      AgentifyErrorCode.CONFIG_NOT_FOUND,
      `Failed to read CloudFormation template at '${templatePath}': ${message}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * CloudFormation service implementation
 * Manages stack deployment and status tracking
 */
export class CloudFormationService implements ICloudFormationService {
  private readonly client: CloudFormationClient;
  private readonly region: string;

  /**
   * Creates a new CloudFormationService
   * @param config Service configuration with region and optional credentials
   */
  constructor(config: CloudFormationServiceConfig) {
    this.region = config.region;
    const credentialProvider = config.credentialProvider ?? getDefaultCredentialProvider();

    this.client = new CloudFormationClient({
      region: config.region,
      credentials: credentialProvider.getCredentials(),
      maxAttempts: 3,
      retryMode: 'adaptive',
    });
  }

  /**
   * Deploy a CloudFormation stack with the DynamoDB table template
   */
  async deployStack(
    stackName: string,
    templateBody: string,
    tableName: string
  ): Promise<string> {
    const command = new CreateStackCommand({
      StackName: stackName,
      TemplateBody: templateBody,
      Parameters: [
        {
          ParameterKey: 'TableName',
          ParameterValue: tableName,
        },
      ],
      Tags: [
        {
          Key: 'Application',
          Value: 'Agentify',
        },
        {
          Key: 'ManagedBy',
          Value: 'AgentifyExtension',
        },
      ],
    });

    try {
      const response = await this.client.send(command);

      if (!response.StackId) {
        throw new AgentifyError(
          AgentifyErrorCode.UNKNOWN_ERROR,
          'CloudFormation CreateStack did not return a stack ID'
        );
      }

      return response.StackId;
    } catch (error) {
      // Re-throw AgentifyErrors as-is
      if (error instanceof AgentifyError) {
        throw error;
      }

      // Handle specific AWS errors
      if (error instanceof Error) {
        const errorName = error.name;

        if (errorName === 'AlreadyExistsException') {
          throw new AgentifyError(
            AgentifyErrorCode.UNKNOWN_ERROR,
            `CloudFormation stack '${stackName}' already exists. Delete it or use a different name.`,
            error
          );
        }

        if (
          errorName === 'AccessDeniedException' ||
          errorName === 'UnauthorizedOperation'
        ) {
          throw new AgentifyError(
            AgentifyErrorCode.ACCESS_DENIED,
            `Access denied when creating CloudFormation stack. Ensure your AWS credentials have cloudformation:CreateStack permission.`,
            error
          );
        }

        if (
          errorName === 'CredentialsProviderError' ||
          errorName === 'ExpiredTokenException'
        ) {
          throw new AgentifyError(
            AgentifyErrorCode.CREDENTIALS_NOT_CONFIGURED,
            'AWS credentials not configured or expired. Please configure valid AWS credentials.',
            error
          );
        }

        throw new AgentifyError(
          AgentifyErrorCode.UNKNOWN_ERROR,
          `Failed to create CloudFormation stack: ${error.message}`,
          error
        );
      }

      throw new AgentifyError(
        AgentifyErrorCode.UNKNOWN_ERROR,
        'An unexpected error occurred while creating the CloudFormation stack'
      );
    }
  }

  /**
   * Wait for stack creation to complete by polling status
   */
  async waitForStackComplete(
    stackId: string,
    pollingIntervalMs: number = DEFAULT_POLLING_INTERVAL_MS
  ): Promise<void> {
    const startTime = Date.now();

    while (true) {
      // Check for timeout
      if (Date.now() - startTime > MAX_WAIT_TIME_MS) {
        throw new AgentifyError(
          AgentifyErrorCode.UNKNOWN_ERROR,
          `Stack creation timed out after ${MAX_WAIT_TIME_MS / 1000 / 60} minutes`
        );
      }

      const command = new DescribeStacksCommand({
        StackName: stackId,
      });

      try {
        const response = await this.client.send(command);
        const stack = response.Stacks?.[0];

        if (!stack) {
          throw new AgentifyError(
            AgentifyErrorCode.UNKNOWN_ERROR,
            `Stack '${stackId}' not found during status check`
          );
        }

        const status = stack.StackStatus;

        // Success states
        if (status === StackStatus.CREATE_COMPLETE) {
          return;
        }

        // Failure states
        if (
          status === StackStatus.CREATE_FAILED ||
          status === StackStatus.ROLLBACK_COMPLETE ||
          status === StackStatus.ROLLBACK_FAILED ||
          status === StackStatus.ROLLBACK_IN_PROGRESS
        ) {
          // Get failure reason from stack events
          const failureReason = await this.getStackFailureReason(stackId);
          throw new AgentifyError(
            AgentifyErrorCode.UNKNOWN_ERROR,
            `Stack creation failed with status '${status}': ${failureReason}`,
          );
        }

        // In progress states - continue polling
        if (status === StackStatus.CREATE_IN_PROGRESS) {
          await this.sleep(pollingIntervalMs);
          continue;
        }

        // Unexpected status
        throw new AgentifyError(
          AgentifyErrorCode.UNKNOWN_ERROR,
          `Unexpected stack status: ${status}`
        );
      } catch (error) {
        // Re-throw AgentifyErrors as-is
        if (error instanceof AgentifyError) {
          throw error;
        }

        if (error instanceof Error) {
          throw new AgentifyError(
            AgentifyErrorCode.UNKNOWN_ERROR,
            `Failed to check stack status: ${error.message}`,
            error
          );
        }

        throw new AgentifyError(
          AgentifyErrorCode.UNKNOWN_ERROR,
          'An unexpected error occurred while checking stack status'
        );
      }
    }
  }

  /**
   * Get outputs from a completed CloudFormation stack
   */
  async getStackOutputs(stackId: string): Promise<StackOutputs> {
    const command = new DescribeStacksCommand({
      StackName: stackId,
    });

    try {
      const response = await this.client.send(command);
      const stack = response.Stacks?.[0];

      if (!stack) {
        throw new AgentifyError(
          AgentifyErrorCode.UNKNOWN_ERROR,
          `Stack '${stackId}' not found when retrieving outputs`
        );
      }

      const outputs = stack.Outputs ?? [];
      const tableNameOutput = outputs.find((o: Output) => o.OutputKey === 'TableName');
      const tableArnOutput = outputs.find((o: Output) => o.OutputKey === 'TableArn');

      if (!tableNameOutput?.OutputValue || !tableArnOutput?.OutputValue) {
        throw new AgentifyError(
          AgentifyErrorCode.UNKNOWN_ERROR,
          'Stack outputs missing TableName or TableArn'
        );
      }

      return {
        tableName: tableNameOutput.OutputValue,
        tableArn: tableArnOutput.OutputValue,
      };
    } catch (error) {
      // Re-throw AgentifyErrors as-is
      if (error instanceof AgentifyError) {
        throw error;
      }

      if (error instanceof Error) {
        throw new AgentifyError(
          AgentifyErrorCode.UNKNOWN_ERROR,
          `Failed to retrieve stack outputs: ${error.message}`,
          error
        );
      }

      throw new AgentifyError(
        AgentifyErrorCode.UNKNOWN_ERROR,
        'An unexpected error occurred while retrieving stack outputs'
      );
    }
  }

  /**
   * Get the failure reason from stack events
   */
  private async getStackFailureReason(stackId: string): Promise<string> {
    try {
      const command = new DescribeStackEventsCommand({
        StackName: stackId,
      });

      const response = await this.client.send(command);
      const events = response.StackEvents ?? [];

      // Find the first FAILED event with a reason
      for (const event of events) {
        if (
          event.ResourceStatus?.includes('FAILED') &&
          event.ResourceStatusReason
        ) {
          return event.ResourceStatusReason;
        }
      }

      return 'No failure reason found in stack events';
    } catch {
      return 'Unable to retrieve failure reason';
    }
  }

  /**
   * Sleep utility for polling
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Creates a CloudFormation service instance
 * @param region AWS region for operations
 * @param credentialProvider Optional credential provider
 * @returns CloudFormationService instance
 */
export function createCloudFormationService(
  region: string,
  credentialProvider?: ICredentialProvider
): CloudFormationService {
  return new CloudFormationService({
    region,
    credentialProvider,
  });
}
