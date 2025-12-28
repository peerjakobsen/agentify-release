/**
 * Tests for AWS configuration schema changes (Task Group 1)
 *
 * These tests validate the aws.profile field validation and
 * backward compatibility with existing configurations.
 */

import { describe, it, expect } from 'vitest';
import { validateConfigSchema, type AgentifyConfig } from '../types/config';
import {
  BEDROCK_SUPPORTED_REGIONS,
  isBedrockSupportedRegion,
  BEDROCK_REGION_DESCRIPTIONS,
} from '../config/bedrockRegions';

// Base valid config to extend for tests
const validBaseConfig: AgentifyConfig = {
  version: '1.0.0',
  project: {
    name: 'Test Project',
    valueMap: 'Test value map',
    industry: 'tech',
  },
  infrastructure: {
    dynamodb: {
      tableName: 'agentify-events',
      tableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/agentify-events',
      region: 'us-east-1',
    },
  },
  workflow: {
    entryScript: 'agents/main.py',
    pythonPath: '.venv/bin/python',
    orchestrationPattern: 'graph',
    agents: [{ id: 'agent-1', name: 'Agent 1', role: 'Test role' }],
    edges: [],
  },
};

describe('AWS config schema validation', () => {
  // Test 1.1.1: aws.profile validation accepts valid non-empty string
  it('should accept valid non-empty string for aws.profile', () => {
    const configWithProfile = {
      ...validBaseConfig,
      aws: { profile: 'my-dev-profile' },
    };

    const result = validateConfigSchema(configWithProfile);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // Test 1.1.2: aws.profile validation rejects empty string
  it('should reject empty string for aws.profile', () => {
    const configWithEmptyProfile = {
      ...validBaseConfig,
      aws: { profile: '' },
    };

    const result = validateConfigSchema(configWithEmptyProfile);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('aws.profile'))).toBe(true);
    expect(result.errors.some((e) => e.includes('non-empty'))).toBe(true);
  });

  // Test 1.1.3: config validation passes when aws section is omitted (optional)
  it('should pass validation when aws section is completely omitted', () => {
    const configWithoutAws = { ...validBaseConfig };
    // Ensure aws is not present
    delete (configWithoutAws as Record<string, unknown>).aws;

    const result = validateConfigSchema(configWithoutAws);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // Test 1.1.4: config validation passes when aws.profile is omitted (optional)
  it('should pass validation when aws section exists but profile is omitted', () => {
    const configWithEmptyAws = {
      ...validBaseConfig,
      aws: {},
    };

    const result = validateConfigSchema(configWithEmptyAws);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // Test 1.1.5: existing config validation still works with new optional fields
  it('should validate existing configs unchanged with new optional aws fields', () => {
    // This test ensures backward compatibility
    const result = validateConfigSchema(validBaseConfig);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);

    // Also test that all required field validations still work
    const invalidConfig = {
      version: '1.0.0',
      project: { name: 'Test' },
    };
    const invalidResult = validateConfigSchema(invalidConfig);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors.some((e) => e.includes('valueMap'))).toBe(true);
  });

  // Test 1.1.6: aws.profile rejects non-string values
  it('should reject non-string values for aws.profile', () => {
    const configWithNumericProfile = {
      ...validBaseConfig,
      aws: { profile: 123 },
    };

    const result = validateConfigSchema(configWithNumericProfile);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('aws.profile'))).toBe(true);
  });
});

describe('Bedrock regions constant', () => {
  // Test: BEDROCK_SUPPORTED_REGIONS contains expected regions
  it('should export BEDROCK_SUPPORTED_REGIONS with all expected regions', () => {
    expect(BEDROCK_SUPPORTED_REGIONS).toContain('us-east-1');
    expect(BEDROCK_SUPPORTED_REGIONS).toContain('us-west-2');
    expect(BEDROCK_SUPPORTED_REGIONS).toContain('eu-west-1');
    expect(BEDROCK_SUPPORTED_REGIONS).toContain('eu-west-2');
    expect(BEDROCK_SUPPORTED_REGIONS).toContain('eu-central-1');
    expect(BEDROCK_SUPPORTED_REGIONS).toContain('ap-southeast-1');
    expect(BEDROCK_SUPPORTED_REGIONS).toContain('ap-southeast-2');
    expect(BEDROCK_SUPPORTED_REGIONS).toContain('ap-northeast-1');
    expect(BEDROCK_SUPPORTED_REGIONS).toContain('ap-south-1');
    expect(BEDROCK_SUPPORTED_REGIONS).toContain('ca-central-1');
    expect(BEDROCK_SUPPORTED_REGIONS).toContain('sa-east-1');
    expect(BEDROCK_SUPPORTED_REGIONS).toHaveLength(11);
  });

  // Test: isBedrockSupportedRegion helper function works correctly
  it('should correctly identify Bedrock-supported regions', () => {
    expect(isBedrockSupportedRegion('us-east-1')).toBe(true);
    expect(isBedrockSupportedRegion('eu-central-1')).toBe(true);
    expect(isBedrockSupportedRegion('ap-northeast-1')).toBe(true);
    expect(isBedrockSupportedRegion('invalid-region')).toBe(false);
    expect(isBedrockSupportedRegion('us-east-2')).toBe(false);
    expect(isBedrockSupportedRegion('')).toBe(false);
  });

  // Test: BEDROCK_REGION_DESCRIPTIONS has descriptions for all regions
  it('should have descriptions for all Bedrock-supported regions', () => {
    for (const region of BEDROCK_SUPPORTED_REGIONS) {
      expect(BEDROCK_REGION_DESCRIPTIONS[region]).toBeDefined();
      expect(typeof BEDROCK_REGION_DESCRIPTIONS[region]).toBe('string');
      expect(BEDROCK_REGION_DESCRIPTIONS[region].length).toBeGreaterThan(0);
    }
  });
});
