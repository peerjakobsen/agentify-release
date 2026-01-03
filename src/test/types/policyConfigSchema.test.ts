/**
 * Tests for PolicyConfig interface and validation
 *
 * Task Group 1: Configuration Schema Updates
 * Tests PolicyConfig interface structure, default values, and validation
 */

import { describe, it, expect } from 'vitest';
import { validateConfigSchema, type PolicyConfig, type PolicyMode } from '../../types/config';

// Helper to create a minimal valid config for testing
function createMinimalValidConfig() {
  return {
    version: '1.0.0',
    project: {
      name: 'Test Project',
      valueMap: 'Test value',
      industry: 'retail',
    },
    infrastructure: {
      bedrock: {
        modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
        region: 'us-east-1',
      },
    },
    workflow: {
      entryScript: 'agents/main.py',
      pythonPath: 'python3',
      orchestrationPattern: 'workflow',
      agents: [],
      edges: [],
    },
  };
}

describe('PolicyConfig Schema', () => {
  // Test 1.1.1: PolicyConfig interface structure validation
  it('should accept valid PolicyConfig with LOG_ONLY mode', () => {
    const config = {
      ...createMinimalValidConfig(),
      policy: {
        mode: 'LOG_ONLY',
      },
    };

    const result = validateConfigSchema(config);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // Test 1.1.2: PolicyConfig interface accepts ENFORCE mode
  it('should accept valid PolicyConfig with ENFORCE mode', () => {
    const config = {
      ...createMinimalValidConfig(),
      policy: {
        mode: 'ENFORCE',
      },
    };

    const result = validateConfigSchema(config);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // Test 1.1.3: Policy section is optional for backward compatibility
  it('should accept config without policy section for backward compatibility', () => {
    const config = createMinimalValidConfig();
    // No policy section

    const result = validateConfigSchema(config);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // Test 1.1.4: Invalid policy mode is rejected
  it('should reject invalid policy.mode value', () => {
    const config = {
      ...createMinimalValidConfig(),
      policy: {
        mode: 'INVALID_MODE',
      },
    };

    const result = validateConfigSchema(config);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid "policy.mode" field - must be "LOG_ONLY" or "ENFORCE"');
  });
});

describe('PolicyConfig Type Definitions', () => {
  // Test that PolicyMode type is correctly defined
  it('should have correct PolicyMode type values', () => {
    // Type assertion tests
    const logOnly: PolicyMode = 'LOG_ONLY';
    const enforce: PolicyMode = 'ENFORCE';

    expect(logOnly).toBe('LOG_ONLY');
    expect(enforce).toBe('ENFORCE');
  });

  // Test that PolicyConfig interface has correct structure
  it('should have correct PolicyConfig interface structure', () => {
    // Type assertion test - if this compiles, the interface is correct
    const policyConfig: PolicyConfig = {
      mode: 'LOG_ONLY',
    };

    expect(policyConfig.mode).toBe('LOG_ONLY');
  });

  // Test default mode recommendation
  it('should document LOG_ONLY as the recommended default', () => {
    // This test documents the expected default behavior
    // LOG_ONLY is the safe default for demos (doesn't block execution)
    const defaultConfig: PolicyConfig = {
      mode: 'LOG_ONLY',
    };

    // Verify the default is set correctly
    expect(defaultConfig.mode).toBe('LOG_ONLY');
  });
});

describe('PolicyConfig Validation Edge Cases', () => {
  // Test that policy must be an object when provided
  it('should reject non-object policy value', () => {
    const config = {
      ...createMinimalValidConfig(),
      policy: 'not-an-object',
    };

    const result = validateConfigSchema(config);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid "policy" field - must be an object when provided');
  });

  // Test that null policy is rejected
  it('should reject null policy value', () => {
    const config = {
      ...createMinimalValidConfig(),
      policy: null,
    };

    const result = validateConfigSchema(config);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid "policy" field - must be an object when provided');
  });

  // Test that policy.mode can be omitted (for potential future extensibility)
  it('should accept policy object without mode field', () => {
    const config = {
      ...createMinimalValidConfig(),
      policy: {},
    };

    const result = validateConfigSchema(config);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // Test that non-string mode is rejected
  it('should reject non-string policy.mode value', () => {
    const config = {
      ...createMinimalValidConfig(),
      policy: {
        mode: 123,
      },
    };

    const result = validateConfigSchema(config);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid "policy.mode" field - must be a string when provided');
  });
});
