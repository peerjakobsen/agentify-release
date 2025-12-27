/**
 * Tests for credential provider enhancements (Task Group 2)
 *
 * These tests validate profile support, SSO token expiration detection,
 * and the createSsoTokenExpiredError factory function.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DefaultCredentialProvider,
  resetDefaultCredentialProvider,
} from '../services/credentialProvider';
import {
  AgentifyErrorCode,
  createSsoTokenExpiredError,
  isAgentifyError,
} from '../types';

// Mock vscode module for tests
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue: string) => {
        if (key === 'aws.region') return 'us-east-1';
        return defaultValue;
      }),
    })),
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    fs: {
      stat: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      createDirectory: vi.fn(),
    },
    createFileSystemWatcher: vi.fn(() => ({
      onDidChange: vi.fn(),
      onDidDelete: vi.fn(),
      onDidCreate: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  Uri: {
    file: (path: string) => ({ fsPath: path }),
  },
  RelativePattern: vi.fn(),
  Disposable: vi.fn().mockImplementation((fn) => ({ dispose: fn })),
}));

// Mock the @aws-sdk/credential-providers module
vi.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: vi.fn(),
}));

import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const mockFromNodeProviderChain = vi.mocked(fromNodeProviderChain);

describe('DefaultCredentialProvider profile support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDefaultCredentialProvider();
    // Default mock implementation that returns credentials successfully
    mockFromNodeProviderChain.mockReturnValue(async () => ({
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    }));
  });

  afterEach(() => {
    resetDefaultCredentialProvider();
  });

  // Test 2.1.1: createProvider() passes profile option when profile is specified
  it('should pass profile option to fromNodeProviderChain when profile is specified', () => {
    const provider = new DefaultCredentialProvider('my-profile');
    provider.getCredentials();

    expect(mockFromNodeProviderChain).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: 'my-profile',
      })
    );
  });

  // Test 2.1.2: createProvider() works without profile (uses default behavior)
  it('should not pass profile option when profile is not specified', () => {
    const provider = new DefaultCredentialProvider();
    provider.getCredentials();

    expect(mockFromNodeProviderChain).toHaveBeenCalledWith(
      expect.not.objectContaining({
        profile: expect.anything(),
      })
    );
    // Verify maxRetries is still passed
    expect(mockFromNodeProviderChain).toHaveBeenCalledWith(
      expect.objectContaining({
        maxRetries: 3,
      })
    );
  });

  // Test 2.1.7: reset() clears cached provider (existing behavior preserved)
  it('should clear cached provider and create new one with profile when reset', () => {
    const provider = new DefaultCredentialProvider('initial-profile');
    provider.getCredentials();

    expect(mockFromNodeProviderChain).toHaveBeenCalledTimes(1);

    // Reset and get credentials again
    provider.reset();
    provider.getCredentials();

    expect(mockFromNodeProviderChain).toHaveBeenCalledTimes(2);
  });

  // Test: setProfile() changes profile and resets cached credentials
  it('should reset cached provider when profile changes via setProfile', () => {
    const provider = new DefaultCredentialProvider('initial-profile');
    provider.getCredentials();

    expect(mockFromNodeProviderChain).toHaveBeenCalledWith(
      expect.objectContaining({ profile: 'initial-profile' })
    );

    // Change profile
    provider.setProfile('new-profile');
    provider.getCredentials();

    expect(mockFromNodeProviderChain).toHaveBeenCalledWith(
      expect.objectContaining({ profile: 'new-profile' })
    );
  });
});

describe('SSO token expiration detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDefaultCredentialProvider();
  });

  afterEach(() => {
    resetDefaultCredentialProvider();
  });

  // Test 2.1.3: SSO token expiration is detected by TokenProviderError name
  it('should detect SSO expiration by TokenProviderError error name', async () => {
    const tokenProviderError = new Error('Token provider failed');
    tokenProviderError.name = 'TokenProviderError';

    mockFromNodeProviderChain.mockReturnValue(async () => {
      throw tokenProviderError;
    });

    const provider = new DefaultCredentialProvider('sso-profile');
    const credentialFn = provider.getCredentials();

    await expect(credentialFn()).rejects.toMatchObject({
      code: AgentifyErrorCode.SSO_TOKEN_EXPIRED,
    });
  });

  // Test 2.1.4: SSO token expiration is detected by message containing "token expired"
  it('should detect SSO expiration by message containing "token expired"', async () => {
    const expiredTokenError = new Error(
      'The SSO token expired. Please refresh your credentials.'
    );
    expiredTokenError.name = 'SomeOtherError';

    mockFromNodeProviderChain.mockReturnValue(async () => {
      throw expiredTokenError;
    });

    const provider = new DefaultCredentialProvider('sso-profile');
    const credentialFn = provider.getCredentials();

    await expect(credentialFn()).rejects.toMatchObject({
      code: AgentifyErrorCode.SSO_TOKEN_EXPIRED,
    });
  });

  // Test 2.1.5: SSO token expiration is detected by message containing "sso"
  it('should detect SSO expiration by message containing "sso" (case insensitive)', async () => {
    const ssoError = new Error(
      'SSO session has expired. Please run aws sso login.'
    );
    ssoError.name = 'CredentialsProviderError';

    mockFromNodeProviderChain.mockReturnValue(async () => {
      throw ssoError;
    });

    const provider = new DefaultCredentialProvider('sso-profile');
    const credentialFn = provider.getCredentials();

    await expect(credentialFn()).rejects.toMatchObject({
      code: AgentifyErrorCode.SSO_TOKEN_EXPIRED,
    });
  });

  // Test: Non-SSO credential errors should use generic credential error
  it('should use generic credential error for non-SSO credential errors', async () => {
    const genericError = new Error('Could not load credentials from any source');
    genericError.name = 'CredentialsProviderError';

    mockFromNodeProviderChain.mockReturnValue(async () => {
      throw genericError;
    });

    const provider = new DefaultCredentialProvider();
    const credentialFn = provider.getCredentials();

    await expect(credentialFn()).rejects.toMatchObject({
      code: AgentifyErrorCode.CREDENTIALS_NOT_CONFIGURED,
    });
  });
});

describe('createSsoTokenExpiredError factory function', () => {
  // Test 2.1.6: createSsoTokenExpiredError() returns correct error code and message
  it('should return error with SSO_TOKEN_EXPIRED code and actionable message', () => {
    const error = createSsoTokenExpiredError('my-profile');

    expect(isAgentifyError(error)).toBe(true);
    expect(error.code).toBe(AgentifyErrorCode.SSO_TOKEN_EXPIRED);
    expect(error.message).toContain('SSO token expired');
    expect(error.message).toContain('aws sso login');
    expect(error.message).toContain('my-profile');
  });

  // Test: createSsoTokenExpiredError without profile
  it('should return error with generic message when no profile specified', () => {
    const error = createSsoTokenExpiredError();

    expect(error.code).toBe(AgentifyErrorCode.SSO_TOKEN_EXPIRED);
    expect(error.message).toContain('SSO token expired');
    expect(error.message).toContain('aws sso login');
    expect(error.message).not.toContain('--profile');
  });

  // Test: createSsoTokenExpiredError with cause error
  it('should include cause error when provided', () => {
    const cause = new Error('Original error');
    const error = createSsoTokenExpiredError('my-profile', cause);

    expect(error.cause).toBe(cause);
  });
});
