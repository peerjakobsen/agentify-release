/**
 * Tests for shared type definitions (Task Group 1)
 *
 * These tests validate error handling, type guards, and config validation.
 */

import { describe, it, expect } from 'vitest';
import {
  // Error types
  AgentifyError,
  AgentifyErrorCode,
  isAgentifyError,
  hasErrorCode,
  createCredentialsNotConfiguredError,
  createTableNotFoundError,
  createConfigNotFoundError,
  createConfigInvalidError,
  // Event type guards
  isGraphStructureEvent,
  isNodeStartEvent,
  isNodeStopEvent,
  isToolCallEvent,
  isAgentSpanEvent,
  isStdoutEvent,
  isDynamoDbEvent,
  // Config validation
  validateConfigSchema,
} from '../types';
import type {
  GraphStructureEvent,
  NodeStartEvent,
  ToolCallEvent,
  AgentSpanEvent,
  AgentifyConfig,
} from '../types';

describe('AgentifyError class', () => {
  it('should create error with code and message', () => {
    const error = new AgentifyError(
      AgentifyErrorCode.CREDENTIALS_NOT_CONFIGURED,
      'AWS credentials not configured'
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AgentifyError);
    expect(error.code).toBe(AgentifyErrorCode.CREDENTIALS_NOT_CONFIGURED);
    expect(error.message).toBe('AWS credentials not configured');
    expect(error.name).toBe('AgentifyError');
    expect(error.cause).toBeUndefined();
  });

  it('should create error with optional cause', () => {
    const cause = new Error('Underlying error');
    const error = new AgentifyError(
      AgentifyErrorCode.AWS_CONNECTION_ERROR,
      'Connection failed',
      cause
    );

    expect(error.cause).toBe(cause);
    expect(error.code).toBe(AgentifyErrorCode.AWS_CONNECTION_ERROR);
  });

  it('should have all required error codes defined', () => {
    const requiredCodes = [
      'CREDENTIALS_NOT_CONFIGURED',
      'TABLE_NOT_FOUND',
      'TABLE_NOT_ACTIVE',
      'ACCESS_DENIED',
      'CONFIG_INVALID',
      'CONFIG_NOT_FOUND',
      'AWS_CONNECTION_ERROR',
      'UNKNOWN_ERROR',
    ];

    for (const code of requiredCodes) {
      expect(AgentifyErrorCode[code as keyof typeof AgentifyErrorCode]).toBeDefined();
    }
  });
});

describe('Error type guards', () => {
  it('should identify AgentifyError with isAgentifyError', () => {
    const agentifyError = new AgentifyError(
      AgentifyErrorCode.TABLE_NOT_FOUND,
      'Table not found'
    );
    const regularError = new Error('Regular error');

    expect(isAgentifyError(agentifyError)).toBe(true);
    expect(isAgentifyError(regularError)).toBe(false);
    expect(isAgentifyError(null)).toBe(false);
    expect(isAgentifyError(undefined)).toBe(false);
    expect(isAgentifyError('string error')).toBe(false);
  });

  it('should check error code with hasErrorCode', () => {
    const error = new AgentifyError(
      AgentifyErrorCode.ACCESS_DENIED,
      'Access denied'
    );

    expect(hasErrorCode(error, AgentifyErrorCode.ACCESS_DENIED)).toBe(true);
    expect(hasErrorCode(error, AgentifyErrorCode.TABLE_NOT_FOUND)).toBe(false);
    expect(hasErrorCode(new Error('regular'), AgentifyErrorCode.ACCESS_DENIED)).toBe(false);
  });
});

describe('Error factory functions', () => {
  it('should create CredentialsNotConfiguredError', () => {
    const error = createCredentialsNotConfiguredError();
    expect(error.code).toBe(AgentifyErrorCode.CREDENTIALS_NOT_CONFIGURED);
    expect(error.message).toContain('AWS credentials not configured');
  });

  it('should create TableNotFoundError with table name', () => {
    const error = createTableNotFoundError('my-table');
    expect(error.code).toBe(AgentifyErrorCode.TABLE_NOT_FOUND);
    expect(error.message).toContain('my-table');
  });

  it('should create ConfigNotFoundError with path', () => {
    const error = createConfigNotFoundError('.agentify/config.json');
    expect(error.code).toBe(AgentifyErrorCode.CONFIG_NOT_FOUND);
    expect(error.message).toContain('.agentify/config.json');
  });

  it('should create ConfigInvalidError with errors array', () => {
    const errors = ['Missing version', 'Invalid project name'];
    const error = createConfigInvalidError(errors);
    expect(error.code).toBe(AgentifyErrorCode.CONFIG_INVALID);
    expect(error.message).toContain('Missing version');
    expect(error.message).toContain('Invalid project name');
  });
});

describe('Event type guards', () => {
  const baseEvent = {
    workflow_id: 'wf-123',
    timestamp: Date.now(),
  };

  it('should identify GraphStructureEvent', () => {
    const event: GraphStructureEvent = {
      ...baseEvent,
      type: 'graph_structure',
      nodes: [],
      edges: [],
      entry_points: [],
    };

    expect(isGraphStructureEvent(event)).toBe(true);
    expect(isNodeStartEvent(event)).toBe(false);
    expect(isStdoutEvent(event)).toBe(true);
    expect(isDynamoDbEvent(event)).toBe(false);
  });

  it('should identify NodeStartEvent', () => {
    const event: NodeStartEvent = {
      ...baseEvent,
      type: 'node_start',
      node_id: 'agent-1',
    };

    expect(isNodeStartEvent(event)).toBe(true);
    expect(isNodeStopEvent(event)).toBe(false);
    expect(isStdoutEvent(event)).toBe(true);
  });

  it('should identify ToolCallEvent', () => {
    const event: ToolCallEvent = {
      ...baseEvent,
      event_type: 'tool_call',
      agent_name: 'research-agent',
      system: 'web',
      operation: 'search',
      input: { query: 'test' },
      status: 'completed',
    };

    expect(isToolCallEvent(event)).toBe(true);
    expect(isAgentSpanEvent(event)).toBe(false);
    expect(isDynamoDbEvent(event)).toBe(true);
    expect(isStdoutEvent(event)).toBe(false);
  });

  it('should identify AgentSpanEvent', () => {
    const startEvent: AgentSpanEvent = {
      ...baseEvent,
      event_type: 'agent_start',
      agent_name: 'research-agent',
      role: 'Researcher',
    };
    const endEvent: AgentSpanEvent = {
      ...baseEvent,
      event_type: 'agent_end',
      agent_name: 'research-agent',
      role: 'Researcher',
      duration_ms: 1500,
    };

    expect(isAgentSpanEvent(startEvent)).toBe(true);
    expect(isAgentSpanEvent(endEvent)).toBe(true);
    expect(isDynamoDbEvent(startEvent)).toBe(true);
  });
});

describe('Config schema validation', () => {
  const validConfig: AgentifyConfig = {
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
      orchestrationPattern: 'graph',
      triggerType: 'local',
      triggerConfig: {
        type: 'local',
        entryScript: 'agents/main.py',
        pythonPath: '.venv/bin/python',
      },
      agents: [{ id: 'agent-1', name: 'Agent 1', role: 'Test role' }],
      edges: [],
    },
  };

  it('should validate a correct config', () => {
    const result = validateConfigSchema(validConfig);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject non-object config', () => {
    expect(validateConfigSchema(null).isValid).toBe(false);
    expect(validateConfigSchema('string').isValid).toBe(false);
    expect(validateConfigSchema(123).isValid).toBe(false);
  });

  it('should detect missing version', () => {
    const invalid = { ...validConfig, version: undefined };
    const result = validateConfigSchema(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('version'))).toBe(true);
  });

  it('should detect missing project fields', () => {
    const invalid = {
      ...validConfig,
      project: { name: 'Test' }, // missing valueMap and industry
    };
    const result = validateConfigSchema(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('valueMap'))).toBe(true);
    expect(result.errors.some((e) => e.includes('industry'))).toBe(true);
  });

  it('should detect invalid orchestration pattern', () => {
    const invalid = {
      ...validConfig,
      workflow: { ...validConfig.workflow, orchestrationPattern: 'invalid' },
    };
    const result = validateConfigSchema(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('orchestrationPattern'))).toBe(true);
  });

  it('should detect invalid trigger type', () => {
    const invalid = {
      ...validConfig,
      workflow: { ...validConfig.workflow, triggerType: 'invalid' },
    };
    const result = validateConfigSchema(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('triggerType'))).toBe(true);
  });
});
