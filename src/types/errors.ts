/**
 * Error codes for Agentify operations
 * Extends existing TableValidationErrorType pattern for unified error handling
 */
export enum AgentifyErrorCode {
  /** AWS credentials not configured or invalid */
  CREDENTIALS_NOT_CONFIGURED = 'CREDENTIALS_NOT_CONFIGURED',
  /** SSO token has expired and needs refresh */
  SSO_TOKEN_EXPIRED = 'SSO_TOKEN_EXPIRED',
  /** DynamoDB table not found */
  TABLE_NOT_FOUND = 'TABLE_NOT_FOUND',
  /** DynamoDB table exists but is not in ACTIVE state */
  TABLE_NOT_ACTIVE = 'TABLE_NOT_ACTIVE',
  /** Access denied to AWS resource */
  ACCESS_DENIED = 'ACCESS_DENIED',
  /** Configuration file is invalid */
  CONFIG_INVALID = 'CONFIG_INVALID',
  /** Configuration file not found */
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  /** Generic AWS connection error */
  AWS_CONNECTION_ERROR = 'AWS_CONNECTION_ERROR',
  /** Unknown error */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  /** Bedrock API request was throttled - recoverable with retry */
  BEDROCK_THROTTLED = 'BEDROCK_THROTTLED',
  /** Bedrock access denied - user needs to enable Bedrock in AWS console */
  BEDROCK_ACCESS_DENIED = 'BEDROCK_ACCESS_DENIED',
  /** Bedrock model not available in the specified region */
  BEDROCK_MODEL_NOT_AVAILABLE = 'BEDROCK_MODEL_NOT_AVAILABLE',
  /** Network error connecting to Bedrock - recoverable with retry */
  BEDROCK_NETWORK_ERROR = 'BEDROCK_NETWORK_ERROR',
  /** Invalid request sent to Bedrock API - not recoverable */
  BEDROCK_INVALID_REQUEST = 'BEDROCK_INVALID_REQUEST',
}

/**
 * Custom error class for Agentify operations
 * Provides structured error handling with error codes and optional cause
 */
export class AgentifyError extends Error {
  /**
   * Error code identifying the type of error
   */
  public readonly code: AgentifyErrorCode;

  /**
   * Optional underlying cause of this error
   */
  public readonly cause?: Error;

  /**
   * Creates a new AgentifyError
   * @param code Error code from AgentifyErrorCode enum
   * @param message Human-readable error message
   * @param cause Optional underlying error that caused this error
   */
  constructor(code: AgentifyErrorCode, message: string, cause?: Error) {
    super(message);
    this.name = 'AgentifyError';
    this.code = code;
    this.cause = cause;

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AgentifyError);
    }
  }
}

/**
 * Type guard to check if an error is an AgentifyError
 * @param error The error to check
 * @returns True if the error is an AgentifyError
 */
export function isAgentifyError(error: unknown): error is AgentifyError {
  return error instanceof AgentifyError;
}

/**
 * Type guard to check if an error has a specific error code
 * @param error The error to check
 * @param code The error code to match
 * @returns True if the error is an AgentifyError with the specified code
 */
export function hasErrorCode(error: unknown, code: AgentifyErrorCode): boolean {
  return isAgentifyError(error) && error.code === code;
}

/**
 * Creates a CredentialsNotConfiguredError
 * @param cause Optional underlying error
 * @returns AgentifyError with CREDENTIALS_NOT_CONFIGURED code
 */
export function createCredentialsNotConfiguredError(cause?: Error): AgentifyError {
  return new AgentifyError(
    AgentifyErrorCode.CREDENTIALS_NOT_CONFIGURED,
    'AWS credentials not configured. Please configure AWS credentials using the AWS CLI, environment variables, or shared credentials file.',
    cause
  );
}

/**
 * Creates an SSO Token Expired error with actionable guidance
 * @param profileName Optional AWS profile name for specific remediation command
 * @param cause Optional underlying error that caused this error
 * @returns AgentifyError with SSO_TOKEN_EXPIRED code
 */
export function createSsoTokenExpiredError(
  profileName?: string,
  cause?: Error
): AgentifyError {
  const profileArg = profileName ? ` --profile ${profileName}` : '';
  const message = `SSO token expired. Run 'aws sso login${profileArg}' to refresh.`;

  return new AgentifyError(AgentifyErrorCode.SSO_TOKEN_EXPIRED, message, cause);
}

/**
 * Creates a TableNotFoundError
 * @param tableName Name of the table that was not found
 * @param cause Optional underlying error
 * @returns AgentifyError with TABLE_NOT_FOUND code
 */
export function createTableNotFoundError(tableName: string, cause?: Error): AgentifyError {
  return new AgentifyError(
    AgentifyErrorCode.TABLE_NOT_FOUND,
    `DynamoDB table '${tableName}' not found. Deploy the CloudFormation template to create it.`,
    cause
  );
}

/**
 * Creates a ConfigNotFoundError
 * @param path Path to the config file
 * @returns AgentifyError with CONFIG_NOT_FOUND code
 */
export function createConfigNotFoundError(path: string): AgentifyError {
  return new AgentifyError(
    AgentifyErrorCode.CONFIG_NOT_FOUND,
    `Agentify configuration not found at '${path}'. Run 'Initialize Project' to create it.`
  );
}

/**
 * Creates a ConfigInvalidError
 * @param errors Array of validation error messages
 * @returns AgentifyError with CONFIG_INVALID code
 */
export function createConfigInvalidError(errors: string[]): AgentifyError {
  return new AgentifyError(
    AgentifyErrorCode.CONFIG_INVALID,
    `Invalid configuration: ${errors.join(', ')}`
  );
}

// ============================================================================
// Bedrock Error Factory Functions
// ============================================================================

/**
 * Creates a Bedrock Throttled error for rate limiting scenarios
 * @param retryAfterMs Optional retry delay in milliseconds
 * @param cause Optional underlying error
 * @returns AgentifyError with BEDROCK_THROTTLED code
 */
export function createBedrockThrottledError(
  retryAfterMs?: number,
  cause?: Error
): AgentifyError {
  const retryInfo = retryAfterMs ? ` Retry after ${retryAfterMs}ms.` : '';
  const message = `Bedrock API request was throttled.${retryInfo} The request will be retried automatically.`;

  return new AgentifyError(AgentifyErrorCode.BEDROCK_THROTTLED, message, cause);
}

/**
 * Creates a Bedrock Access Denied error with guidance to enable Bedrock
 * @param cause Optional underlying error
 * @returns AgentifyError with BEDROCK_ACCESS_DENIED code
 */
export function createBedrockAccessDeniedError(cause?: Error): AgentifyError {
  return new AgentifyError(
    AgentifyErrorCode.BEDROCK_ACCESS_DENIED,
    'Access denied to Bedrock. Enable Bedrock access in AWS console and ensure your IAM role has the required permissions.',
    cause
  );
}

/**
 * Creates a Bedrock Model Not Available error with model and region context
 * @param modelId The model ID that is not available
 * @param region The AWS region where the model was requested
 * @param cause Optional underlying error
 * @returns AgentifyError with BEDROCK_MODEL_NOT_AVAILABLE code
 */
export function createBedrockModelNotAvailableError(
  modelId: string,
  region: string,
  cause?: Error
): AgentifyError {
  return new AgentifyError(
    AgentifyErrorCode.BEDROCK_MODEL_NOT_AVAILABLE,
    `Model '${modelId}' is not available in region '${region}'. Check the AWS Bedrock console for available models in your region.`,
    cause
  );
}

/**
 * Creates a Bedrock Network error for connectivity issues
 * @param cause Optional underlying error
 * @returns AgentifyError with BEDROCK_NETWORK_ERROR code
 */
export function createBedrockNetworkError(cause?: Error): AgentifyError {
  return new AgentifyError(
    AgentifyErrorCode.BEDROCK_NETWORK_ERROR,
    'Network error connecting to Bedrock. Please check your internet connection and try again.',
    cause
  );
}

/**
 * Creates a Bedrock Invalid Request error for malformed requests
 * @param details Details about why the request was invalid
 * @param cause Optional underlying error
 * @returns AgentifyError with BEDROCK_INVALID_REQUEST code
 */
export function createBedrockInvalidRequestError(
  details: string,
  cause?: Error
): AgentifyError {
  return new AgentifyError(
    AgentifyErrorCode.BEDROCK_INVALID_REQUEST,
    `Invalid Bedrock request: ${details}`,
    cause
  );
}
