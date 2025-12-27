/**
 * Credential provider for AWS services
 * Provides an interface for credential resolution with a default implementation
 * using the standard AWS credential chain.
 *
 * The interface pattern enables future integration with Kiro AWS Explorer
 * without changing service consumers.
 */

import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import type { AwsCredentialIdentityProvider } from '@aws-sdk/types';
import {
  AgentifyError,
  AgentifyErrorCode,
  createCredentialsNotConfiguredError,
} from '../types';

/**
 * Interface for AWS credential providers
 * Enables dependency injection and future integration with Kiro AWS Explorer
 */
export interface ICredentialProvider {
  /**
   * Get the credential provider function for AWS SDK clients
   * @returns AWS credential identity provider
   * @throws AgentifyError with CREDENTIALS_NOT_CONFIGURED code if credentials unavailable
   */
  getCredentials(): AwsCredentialIdentityProvider;
}

/**
 * Default credential provider using the standard AWS credential chain
 *
 * Resolves credentials in the following order:
 * 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * 2. Shared credentials file (~/.aws/credentials)
 * 3. IAM role (when running on AWS infrastructure)
 * 4. SSO credentials
 * 5. Web identity token
 */
export class DefaultCredentialProvider implements ICredentialProvider {
  private credentialProvider: AwsCredentialIdentityProvider | null = null;

  /**
   * Get the credential provider function
   * The provider is lazily initialized and cached
   *
   * @returns AWS credential identity provider
   */
  getCredentials(): AwsCredentialIdentityProvider {
    if (!this.credentialProvider) {
      this.credentialProvider = this.createProvider();
    }
    return this.credentialProvider;
  }

  /**
   * Creates the credential provider from the node provider chain
   * Wraps errors in AgentifyError for consistent error handling
   */
  private createProvider(): AwsCredentialIdentityProvider {
    const baseProvider = fromNodeProviderChain({
      // Use default timeout and retry settings
      maxRetries: 3,
    });

    // Wrap the provider to catch and transform credential errors
    return async () => {
      try {
        return await baseProvider();
      } catch (error) {
        // Transform credential errors to AgentifyError
        if (error instanceof Error) {
          const errorName = error.name;
          if (
            errorName === 'CredentialsProviderError' ||
            errorName === 'ExpiredTokenException' ||
            errorName === 'TokenProviderError' ||
            error.message.includes('Could not load credentials')
          ) {
            throw createCredentialsNotConfiguredError(error);
          }
        }
        throw error;
      }
    };
  }

  /**
   * Reset the cached credential provider
   * Call this when credentials may have changed
   */
  reset(): void {
    this.credentialProvider = null;
  }
}

/**
 * Singleton instance of the default credential provider
 */
let defaultProvider: DefaultCredentialProvider | null = null;

/**
 * Get the default credential provider instance
 * Uses a singleton pattern for efficiency
 *
 * @returns The default credential provider
 */
export function getDefaultCredentialProvider(): DefaultCredentialProvider {
  if (!defaultProvider) {
    defaultProvider = new DefaultCredentialProvider();
  }
  return defaultProvider;
}

/**
 * Reset the default credential provider
 * Useful for testing or when credentials change
 */
export function resetDefaultCredentialProvider(): void {
  if (defaultProvider) {
    defaultProvider.reset();
  }
  defaultProvider = null;
}

/**
 * Validates that AWS credentials are available
 * @param provider The credential provider to validate
 * @returns Promise resolving to true if credentials are valid
 * @throws AgentifyError if credentials are not configured
 */
export async function validateCredentials(
  provider: ICredentialProvider = getDefaultCredentialProvider()
): Promise<boolean> {
  try {
    const credentialFn = provider.getCredentials();
    await credentialFn();
    return true;
  } catch (error) {
    if (error instanceof AgentifyError) {
      throw error;
    }
    throw createCredentialsNotConfiguredError(
      error instanceof Error ? error : undefined
    );
  }
}
