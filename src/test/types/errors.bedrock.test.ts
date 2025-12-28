/**
 * Tests for Bedrock Error Types and Config Schema
 *
 * Task Group 1: Error Types and Configuration Schema
 * Tests for new Bedrock error codes and config schema validation
 */

import { describe, it, expect } from 'vitest';

import {
  AgentifyErrorCode,
  AgentifyError,
  isAgentifyError,
  hasErrorCode,
  createBedrockThrottledError,
  createBedrockAccessDeniedError,
  createBedrockModelNotAvailableError,
  createBedrockNetworkError,
  createBedrockInvalidRequestError,
} from '../../types/errors';

import {
  validateConfigSchema,
} from '../../types/config';

// ============================================================================
// Task 1.1: Tests for Bedrock Error Codes and Config Schema
// ============================================================================

describe('Task Group 1: Bedrock Error Types and Config Schema', () => {
  describe('BEDROCK_THROTTLED error', () => {
    it('creates error with correct code and type guard validation', () => {
      const error = createBedrockThrottledError();

      expect(isAgentifyError(error)).toBe(true);
      expect(hasErrorCode(error, AgentifyErrorCode.BEDROCK_THROTTLED)).toBe(true);
      expect(error.code).toBe(AgentifyErrorCode.BEDROCK_THROTTLED);
      expect(error.message).toContain('throttled');
    });

    it('includes retry information when retryAfterMs is provided', () => {
      const error = createBedrockThrottledError(5000);

      expect(error.message).toContain('5000');
      expect(error.code).toBe(AgentifyErrorCode.BEDROCK_THROTTLED);
    });

    it('preserves cause error when provided', () => {
      const cause = new Error('Original throttle error');
      const error = createBedrockThrottledError(undefined, cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('BEDROCK_ACCESS_DENIED error', () => {
    it('creates error with guidance message about AWS console', () => {
      const error = createBedrockAccessDeniedError();

      expect(isAgentifyError(error)).toBe(true);
      expect(hasErrorCode(error, AgentifyErrorCode.BEDROCK_ACCESS_DENIED)).toBe(true);
      expect(error.code).toBe(AgentifyErrorCode.BEDROCK_ACCESS_DENIED);
      expect(error.message).toContain('Enable Bedrock access in AWS console');
    });

    it('preserves cause error when provided', () => {
      const cause = new Error('AccessDeniedException');
      const error = createBedrockAccessDeniedError(cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('BEDROCK_MODEL_NOT_AVAILABLE error', () => {
    it('creates error with model ID and region information', () => {
      const modelId = 'global.anthropic.claude-sonnet-4-5-20250929-v1:0';
      const region = 'us-east-1';
      const error = createBedrockModelNotAvailableError(modelId, region);

      expect(isAgentifyError(error)).toBe(true);
      expect(hasErrorCode(error, AgentifyErrorCode.BEDROCK_MODEL_NOT_AVAILABLE)).toBe(true);
      expect(error.code).toBe(AgentifyErrorCode.BEDROCK_MODEL_NOT_AVAILABLE);
      expect(error.message).toContain(modelId);
      expect(error.message).toContain(region);
    });
  });

  describe('bedrock.modelId config schema validation', () => {
    const validBaseConfig = {
      version: '1.0.0',
      project: {
        name: 'Test Project',
        valueMap: 'Test value map',
        industry: 'tech',
      },
      infrastructure: {
        dynamodb: {
          tableName: 'test-table',
          tableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/test-table',
          region: 'us-east-1',
        },
      },
      workflow: {
        entryScript: 'agents/main.py',
        pythonPath: 'python3',
        orchestrationPattern: 'graph',
        agents: [],
        edges: [],
      },
    };

    it('accepts valid bedrock.modelId configuration', () => {
      const config = {
        ...validBaseConfig,
        bedrock: {
          modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
        },
      };

      const result = validateConfigSchema(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts configuration without bedrock section (optional)', () => {
      const result = validateConfigSchema(validBaseConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects empty string for bedrock.modelId', () => {
      const config = {
        ...validBaseConfig,
        bedrock: {
          modelId: '',
        },
      };

      const result = validateConfigSchema(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('bedrock.modelId'))).toBe(true);
    });

    it('rejects non-string value for bedrock.modelId', () => {
      const config = {
        ...validBaseConfig,
        bedrock: {
          modelId: 123,
        },
      };

      const result = validateConfigSchema(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('bedrock.modelId'))).toBe(true);
    });
  });
});
