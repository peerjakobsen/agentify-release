/**
 * Credential validation utilities for AWS API calls
 * Provides wrapper functions for validating credentials and handling errors
 */

import {
  AgentifyError,
  AgentifyErrorCode,
  isAgentifyError,
  createCredentialsNotConfiguredError,
} from '../types';
import {
  validateCredentials,
  getDefaultCredentialProvider,
} from './credentialProvider';
import type { StatusState } from '../statusBar';

/**
 * Callback type for status updates
 */
export type StatusUpdateCallback = (state: StatusState) => void;

/**
 * Current status update callback
 * Set this to enable status bar updates during credential validation
 */
let statusUpdateCallback: StatusUpdateCallback | null = null;

/**
 * Set the callback function for status updates
 * @param callback Function to call when status should be updated
 */
export function setStatusUpdateCallback(callback: StatusUpdateCallback | null): void {
  statusUpdateCallback = callback;
}

/**
 * Update status bar state based on error
 * @param error The error to map to a status state
 */
function updateStatusFromError(error: unknown): void {
  if (!statusUpdateCallback) {
    return;
  }

  if (isAgentifyError(error)) {
    switch (error.code) {
      case AgentifyErrorCode.SSO_TOKEN_EXPIRED:
        statusUpdateCallback('sso-expired');
        break;
      case AgentifyErrorCode.CREDENTIALS_NOT_CONFIGURED:
      case AgentifyErrorCode.ACCESS_DENIED:
      case AgentifyErrorCode.AWS_CONNECTION_ERROR:
        statusUpdateCallback('aws-error');
        break;
      default:
        statusUpdateCallback('aws-error');
    }
  } else {
    statusUpdateCallback('aws-error');
  }
}

/**
 * Validates credentials on extension activation and returns the appropriate status
 * Does not throw - returns the status state instead
 *
 * @param forceRefresh Force refresh credentials from source (bypass cache)
 * @returns Promise resolving to the status state based on credential health
 */
export async function validateCredentialsOnActivation(forceRefresh: boolean = false): Promise<StatusState> {
  try {
    await validateCredentials(getDefaultCredentialProvider(), forceRefresh);
    console.log('[Agentify] Credential validation successful');
    return 'ready';
  } catch (error) {
    console.warn('[Agentify] Credential validation failed:', error);

    if (isAgentifyError(error)) {
      switch (error.code) {
        case AgentifyErrorCode.SSO_TOKEN_EXPIRED:
          return 'sso-expired';
        case AgentifyErrorCode.CREDENTIALS_NOT_CONFIGURED:
        case AgentifyErrorCode.ACCESS_DENIED:
        default:
          return 'aws-error';
      }
    }

    return 'aws-error';
  }
}

/**
 * Wrapper function for API calls that validates credentials and handles errors
 * Updates status bar state on credential errors
 *
 * @param operation The async operation to execute
 * @returns Promise resolving to the operation result
 * @throws AgentifyError with appropriate code if credentials fail
 */
export async function withCredentialValidation<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Check if it's a credential-related error
    if (error instanceof Error) {
      const errorName = error.name;
      const errorMessage = error.message.toLowerCase();

      // SSO token expiration detection
      if (
        errorName === 'TokenProviderError' ||
        errorMessage.includes('token expired') ||
        errorMessage.includes('sso')
      ) {
        const profile = getDefaultCredentialProvider().getProfile();
        const ssoError = new AgentifyError(
          AgentifyErrorCode.SSO_TOKEN_EXPIRED,
          `SSO token expired. Run 'aws sso login${profile ? ` --profile ${profile}` : ''}' to refresh.`,
          error
        );
        updateStatusFromError(ssoError);
        throw ssoError;
      }

      // Generic credential errors
      if (
        errorName === 'CredentialsProviderError' ||
        errorName === 'ExpiredTokenException' ||
        errorMessage.includes('could not load credentials') ||
        errorMessage.includes('credentials')
      ) {
        const credError = createCredentialsNotConfiguredError(error);
        updateStatusFromError(credError);
        throw credError;
      }

      // Access denied
      if (
        errorName === 'AccessDeniedException' ||
        errorMessage.includes('access denied') ||
        errorMessage.includes('not authorized')
      ) {
        const accessError = new AgentifyError(
          AgentifyErrorCode.ACCESS_DENIED,
          'Access denied to AWS resource. Check your IAM permissions.',
          error
        );
        updateStatusFromError(accessError);
        throw accessError;
      }
    }

    // For AgentifyErrors, just update status and rethrow
    if (isAgentifyError(error)) {
      updateStatusFromError(error);
      throw error;
    }

    // For other errors, wrap and throw
    throw error;
  }
}

/**
 * Validates credentials and updates the status bar
 * Used before making API calls to catch issues early
 *
 * @returns Promise resolving to true if credentials are valid
 * @throws AgentifyError if credentials are invalid
 */
export async function validateAndUpdateStatus(): Promise<boolean> {
  try {
    await validateCredentials();
    if (statusUpdateCallback) {
      statusUpdateCallback('ready');
    }
    return true;
  } catch (error) {
    updateStatusFromError(error);
    throw error;
  }
}
