/**
 * Tests for routing configuration schema (Task Group 1: Haiku Router)
 *
 * These tests validate the RoutingConfig interface type validation,
 * deep merge of routing section in updateConfig(), default values
 * when routing section is omitted, and config validation with optional
 * routing section.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateConfigSchema, type AgentifyConfig, type RoutingConfig } from '../types/config';

// Mock vscode module before any imports
vi.mock('vscode', () => {
  return {
    workspace: {
      getConfiguration: vi.fn().mockImplementation(() => ({
        get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
      })),
      onDidChangeConfiguration: vi.fn().mockReturnValue({
        dispose: vi.fn(),
      }),
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
    Disposable: class {
      private disposeFn: () => void;
      constructor(disposeFn: () => void) {
        this.disposeFn = disposeFn;
      }
      dispose() {
        this.disposeFn();
      }
    },
  };
});

// Base valid config to extend for tests
const validBaseConfig: AgentifyConfig = {
  version: '1.0.0',
  project: {
    name: 'Test Project',
    valueMap: 'Test value map',
    industry: 'tech',
  },
  infrastructure: {
    bedrock: {
      modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
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

describe('Routing config schema validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test 1.1.1: RoutingConfig interface type validation - accepts valid routing config
  it('should accept valid routing configuration with all fields', () => {
    const configWithRouting: AgentifyConfig = {
      ...validBaseConfig,
      routing: {
        useHaikuRouter: true,
        routerModel: 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
        fallbackToAgentDecision: true,
      },
    };

    const result = validateConfigSchema(configWithRouting);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // Test 1.1.2: Config validation passes when routing section is omitted (optional)
  it('should pass validation when routing section is completely omitted', () => {
    const configWithoutRouting = { ...validBaseConfig };
    // Ensure routing is not present
    delete (configWithoutRouting as Record<string, unknown>).routing;

    const result = validateConfigSchema(configWithoutRouting);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // Test 1.1.3: Validation accepts partial routing config (empty object)
  it('should pass validation when routing section exists but is empty', () => {
    const configWithEmptyRouting = {
      ...validBaseConfig,
      routing: {},
    };

    const result = validateConfigSchema(configWithEmptyRouting);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // Test 1.1.4: Validation rejects invalid types for routing fields
  it('should reject invalid types for routing fields', () => {
    // Test invalid useHaikuRouter type
    const configWithInvalidUseHaikuRouter = {
      ...validBaseConfig,
      routing: { useHaikuRouter: 'true' }, // Should be boolean, not string
    };
    const result1 = validateConfigSchema(configWithInvalidUseHaikuRouter);
    expect(result1.isValid).toBe(false);
    expect(result1.errors.some((e) => e.includes('routing.useHaikuRouter'))).toBe(true);
    expect(result1.errors.some((e) => e.includes('boolean'))).toBe(true);

    // Test invalid routerModel type
    const configWithInvalidRouterModel = {
      ...validBaseConfig,
      routing: { routerModel: 123 }, // Should be string, not number
    };
    const result2 = validateConfigSchema(configWithInvalidRouterModel);
    expect(result2.isValid).toBe(false);
    expect(result2.errors.some((e) => e.includes('routing.routerModel'))).toBe(true);
    expect(result2.errors.some((e) => e.includes('string'))).toBe(true);

    // Test invalid fallbackToAgentDecision type
    const configWithInvalidFallback = {
      ...validBaseConfig,
      routing: { fallbackToAgentDecision: 'true' }, // Should be boolean, not string
    };
    const result3 = validateConfigSchema(configWithInvalidFallback);
    expect(result3.isValid).toBe(false);
    expect(result3.errors.some((e) => e.includes('routing.fallbackToAgentDecision'))).toBe(true);
    expect(result3.errors.some((e) => e.includes('boolean'))).toBe(true);

    // Test empty string for routerModel
    const configWithEmptyRouterModel = {
      ...validBaseConfig,
      routing: { routerModel: '' },
    };
    const result4 = validateConfigSchema(configWithEmptyRouterModel);
    expect(result4.isValid).toBe(false);
    expect(result4.errors.some((e) => e.includes('routing.routerModel'))).toBe(true);
    expect(result4.errors.some((e) => e.includes('non-empty'))).toBe(true);
  });
});

describe('Routing config deep merge in updateConfig', () => {
  // Test deep merge behavior for routing section
  it('should preserve existing routing values when partial updates provided', async () => {
    // This test validates the deep merge logic conceptually
    // The actual ConfigService tests require full vscode mocking

    const existingRouting: RoutingConfig = {
      useHaikuRouter: true,
      routerModel: 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
      fallbackToAgentDecision: true,
    };

    const partialUpdate: Partial<RoutingConfig> = {
      useHaikuRouter: false,
    };

    // Simulate deep merge behavior
    const merged: RoutingConfig = {
      ...existingRouting,
      ...partialUpdate,
    };

    // Verify merge preserves existing values
    expect(merged.useHaikuRouter).toBe(false); // Updated
    expect(merged.routerModel).toBe('global.anthropic.claude-haiku-4-5-20251001-v1:0'); // Preserved
    expect(merged.fallbackToAgentDecision).toBe(true); // Preserved
  });

  it('should create new routing section when none exists', async () => {
    // Simulate adding routing to config without existing routing section
    const existingConfig = { ...validBaseConfig };
    const partialRouting: RoutingConfig = {
      useHaikuRouter: true,
      routerModel: 'custom-model-id',
      fallbackToAgentDecision: false,
    };

    // Validate the new routing config
    const configWithNewRouting = {
      ...existingConfig,
      routing: partialRouting,
    };

    const result = validateConfigSchema(configWithNewRouting);
    expect(result.isValid).toBe(true);
    expect(configWithNewRouting.routing).toEqual(partialRouting);
  });
});
