/**
 * DynamoDB client service with lazy singleton pattern
 * Provides both low-level DynamoDBClient and high-level DynamoDBDocumentClient
 * with retry configuration and credential provider support.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { getAwsRegion } from '../config/dynamoDbConfig';
import {
  ICredentialProvider,
  getDefaultCredentialProvider,
} from './credentialProvider';

/**
 * Default retry configuration
 */
const DEFAULT_MAX_RETRIES = 3;

/**
 * Cached DynamoDB client instance
 */
let dynamoDbClient: DynamoDBClient | null = null;
let documentClient: DynamoDBDocumentClient | null = null;
let currentRegion: string | null = null;
let currentCredentialProvider: ICredentialProvider | null = null;

/**
 * Create a new DynamoDB client with retry configuration
 * @param region AWS region for the client
 * @param credentialProvider Optional credential provider (defaults to DefaultCredentialProvider)
 * @returns DynamoDB client instance
 */
function createClient(
  region: string,
  credentialProvider?: ICredentialProvider
): DynamoDBClient {
  const provider = credentialProvider ?? getDefaultCredentialProvider();

  return new DynamoDBClient({
    region,
    credentials: provider.getCredentials(),
    // Configure retry strategy with exponential backoff
    maxAttempts: DEFAULT_MAX_RETRIES,
    retryMode: 'adaptive', // Uses adaptive retry with exponential backoff
  });
}

/**
 * Get the DynamoDB client instance
 * Creates a new client if one doesn't exist or if the region/credentials have changed
 *
 * @param credentialProvider Optional credential provider (defaults to DefaultCredentialProvider)
 * @returns DynamoDB client
 */
export function getDynamoDbClient(
  credentialProvider?: ICredentialProvider
): DynamoDBClient {
  const region = getAwsRegion();
  const provider = credentialProvider ?? getDefaultCredentialProvider();

  // Check if we need to create a new client
  const needsNewClient =
    !dynamoDbClient ||
    currentRegion !== region ||
    (credentialProvider && currentCredentialProvider !== credentialProvider);

  if (needsNewClient) {
    // Close existing client if region or credentials changed
    if (dynamoDbClient) {
      dynamoDbClient.destroy();
    }

    dynamoDbClient = createClient(region, provider);
    documentClient = null; // Reset document client when base client changes
    currentRegion = region;
    currentCredentialProvider = provider;
  }

  // TypeScript assertion: dynamoDbClient is guaranteed non-null after the block above
  return dynamoDbClient!;
}

/**
 * Get the DynamoDB Document client instance
 * The Document client provides simplified operations with automatic
 * marshalling/unmarshalling of JavaScript objects
 *
 * @param credentialProvider Optional credential provider (defaults to DefaultCredentialProvider)
 * @returns DynamoDB Document client
 */
export function getDynamoDbDocumentClient(
  credentialProvider?: ICredentialProvider
): DynamoDBDocumentClient {
  const region = getAwsRegion();

  // Check if we need to create a new document client
  if (!documentClient || currentRegion !== region) {
    documentClient = DynamoDBDocumentClient.from(
      getDynamoDbClient(credentialProvider),
      {
        marshallOptions: {
          removeUndefinedValues: true,
          convertEmptyValues: false,
        },
        unmarshallOptions: {
          wrapNumbers: false,
        },
      }
    );
  }

  return documentClient;
}

/**
 * Reset the client instances
 * Useful for testing or when credentials/configuration change
 */
export function resetClients(): void {
  if (dynamoDbClient) {
    dynamoDbClient.destroy();
  }
  dynamoDbClient = null;
  documentClient = null;
  currentRegion = null;
  currentCredentialProvider = null;
}

/**
 * Get the current retry configuration
 * @returns Current max retries setting
 */
export function getMaxRetries(): number {
  return DEFAULT_MAX_RETRIES;
}
