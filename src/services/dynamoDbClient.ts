import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { getAwsRegion } from '../config/dynamoDbConfig';

/**
 * Cached DynamoDB client instance
 */
let dynamoDbClient: DynamoDBClient | null = null;
let documentClient: DynamoDBDocumentClient | null = null;
let currentRegion: string | null = null;

/**
 * Create a new DynamoDB client
 * @param region AWS region for the client
 * @returns DynamoDB client instance
 */
function createClient(region: string): DynamoDBClient {
  return new DynamoDBClient({
    region,
    // Credentials are resolved automatically via:
    // 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
    // 2. Shared credentials file (~/.aws/credentials)
    // 3. IAM role (when running on AWS)
    // 4. Kiro AWS Explorer integration (when available)
  });
}

/**
 * Get the DynamoDB client instance
 * Creates a new client if one doesn't exist or if the region has changed
 * @returns DynamoDB client
 */
export function getDynamoDbClient(): DynamoDBClient {
  const region = getAwsRegion();

  if (!dynamoDbClient || currentRegion !== region) {
    // Close existing client if region changed
    if (dynamoDbClient) {
      dynamoDbClient.destroy();
    }

    dynamoDbClient = createClient(region);
    documentClient = null; // Reset document client when base client changes
    currentRegion = region;
  }

  return dynamoDbClient;
}

/**
 * Get the DynamoDB Document client instance
 * The Document client provides simplified operations with automatic
 * marshalling/unmarshalling of JavaScript objects
 * @returns DynamoDB Document client
 */
export function getDynamoDbDocumentClient(): DynamoDBDocumentClient {
  if (!documentClient || currentRegion !== getAwsRegion()) {
    documentClient = DynamoDBDocumentClient.from(getDynamoDbClient(), {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });
  }

  return documentClient;
}

/**
 * Reset the client instances
 * Useful for testing or when credentials change
 */
export function resetClients(): void {
  if (dynamoDbClient) {
    dynamoDbClient.destroy();
  }
  dynamoDbClient = null;
  documentClient = null;
  currentRegion = null;
}
