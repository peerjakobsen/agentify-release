/**
 * Bedrock Runtime client service with lazy singleton pattern
 * Provides a BedrockRuntimeClient for invoking Bedrock models
 * with retry configuration and credential provider support.
 */

import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { getAwsRegion, getAwsRegionSync } from '../config/dynamoDbConfig';
import {
  ICredentialProvider,
  getDefaultCredentialProvider,
} from './credentialProvider';

/**
 * Default retry configuration
 */
const DEFAULT_MAX_RETRIES = 3;

/**
 * Cached Bedrock client instance
 */
let bedrockClient: BedrockRuntimeClient | null = null;
let currentRegion: string | null = null;
let currentCredentialProvider: ICredentialProvider | null = null;

/**
 * Create a new Bedrock Runtime client with retry configuration
 * @param region AWS region for the client
 * @param credentialProvider Optional credential provider (defaults to DefaultCredentialProvider)
 * @returns Bedrock Runtime client instance
 */
function createClient(
  region: string,
  credentialProvider?: ICredentialProvider
): BedrockRuntimeClient {
  const provider = credentialProvider ?? getDefaultCredentialProvider();

  return new BedrockRuntimeClient({
    region,
    credentials: provider.getCredentials(),
    // Configure retry strategy with exponential backoff
    maxAttempts: DEFAULT_MAX_RETRIES,
    retryMode: 'adaptive', // Uses adaptive retry with exponential backoff
  });
}

/**
 * Get the Bedrock Runtime client instance (async version with region hierarchy)
 * Creates a new client if one doesn't exist or if the region/credentials have changed
 *
 * The client is lazily initialized - it won't be created until first access.
 *
 * @param credentialProvider Optional credential provider (defaults to DefaultCredentialProvider)
 * @returns Promise resolving to Bedrock Runtime client
 */
export async function getBedrockClientAsync(
  credentialProvider?: ICredentialProvider
): Promise<BedrockRuntimeClient> {
  const region = await getAwsRegion();
  const provider = credentialProvider ?? getDefaultCredentialProvider();

  // Check if we need to create a new client
  const needsNewClient =
    !bedrockClient ||
    currentRegion !== region ||
    (credentialProvider && currentCredentialProvider !== credentialProvider);

  if (needsNewClient) {
    // Close existing client if region or credentials changed
    if (bedrockClient) {
      bedrockClient.destroy();
    }

    bedrockClient = createClient(region, provider);
    currentRegion = region;
    currentCredentialProvider = provider;
  }

  // TypeScript assertion: bedrockClient is guaranteed non-null after the block above
  return bedrockClient!;
}

/**
 * Get the Bedrock Runtime client instance (sync version using VS Code settings only)
 * Creates a new client if one doesn't exist or if the region/credentials have changed
 *
 * The client is lazily initialized - it won't be created until first access.
 *
 * @param credentialProvider Optional credential provider (defaults to DefaultCredentialProvider)
 * @returns Bedrock Runtime client
 */
export function getBedrockClient(
  credentialProvider?: ICredentialProvider
): BedrockRuntimeClient {
  const region = getAwsRegionSync();
  const provider = credentialProvider ?? getDefaultCredentialProvider();

  // Check if we need to create a new client
  const needsNewClient =
    !bedrockClient ||
    currentRegion !== region ||
    (credentialProvider && currentCredentialProvider !== credentialProvider);

  if (needsNewClient) {
    // Close existing client if region or credentials changed
    if (bedrockClient) {
      bedrockClient.destroy();
    }

    bedrockClient = createClient(region, provider);
    currentRegion = region;
    currentCredentialProvider = provider;
  }

  // TypeScript assertion: bedrockClient is guaranteed non-null after the block above
  return bedrockClient!;
}

/**
 * Reset the Bedrock client instance
 * Useful for testing or when credentials/configuration change
 */
export function resetBedrockClient(): void {
  if (bedrockClient) {
    bedrockClient.destroy();
  }
  bedrockClient = null;
  currentRegion = null;
  currentCredentialProvider = null;
}

/**
 * Check if a Bedrock client has been created
 * Useful for testing lazy initialization
 * @returns True if a client exists
 */
export function hasBedrockClient(): boolean {
  return bedrockClient !== null;
}

/**
 * Get the current retry configuration
 * @returns Current max retries setting
 */
export function getMaxRetries(): number {
  return DEFAULT_MAX_RETRIES;
}
