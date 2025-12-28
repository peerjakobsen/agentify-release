/**
 * Tests for Input Panel Validation Service (Task Group 2)
 *
 * Tests for:
 * - Entry script validation (file exists check)
 * - AWS credential validation integration
 * - Project initialization validation
 * - Combined validation result aggregation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Track mock state
let mockFileExists = true;
let mockIsInitialized = true;
let mockCredentialStatus = 'ready';
let mockConfig: { workflow?: { entryScript?: string } } | null = null;

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' }, name: 'test-workspace' }],
    fs: {
      stat: vi.fn().mockImplementation(async () => {
        if (mockFileExists) {
          return { type: 1 }; // File exists
        }
        const error = new Error('File not found');
        (error as NodeJS.ErrnoException).code = 'FileNotFound';
        throw error;
      }),
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
  Disposable: vi.fn().mockImplementation((fn) => ({ dispose: fn })),
}));

// Mock config service
vi.mock('../services/configService', () => ({
  getConfigService: () => ({
    isInitialized: vi.fn().mockImplementation(() => Promise.resolve(mockIsInitialized)),
    getConfig: vi.fn().mockImplementation(() => Promise.resolve(mockConfig)),
    onConfigChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  }),
  ConfigService: vi.fn().mockImplementation(() => ({
    isInitialized: vi.fn().mockImplementation(() => Promise.resolve(mockIsInitialized)),
    getConfig: vi.fn().mockImplementation(() => Promise.resolve(mockConfig)),
    onConfigChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  })),
}));

// Mock credential validation
vi.mock('../services/credentialValidation', () => ({
  validateCredentialsOnActivation: vi.fn().mockImplementation(() =>
    Promise.resolve(mockCredentialStatus)
  ),
}));

// Import module under test after mocks
import { InputPanelValidationService } from '../services/inputPanelValidation';
import { ConfigService } from '../services/configService';

describe('Input Panel Validation - Entry Script', () => {
  let service: InputPanelValidationService;
  let mockConfigService: ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFileExists = true;
    mockIsInitialized = true;
    mockCredentialStatus = 'ready';
    mockConfig = { workflow: { entryScript: 'agents/main.py' } };

    mockConfigService = new ConfigService('/test/workspace');
    service = new InputPanelValidationService(mockConfigService, '/test/workspace');
  });

  it('should return null when entry script exists', async () => {
    mockFileExists = true;

    const result = await service.validateEntryScript('agents/main.py');

    expect(result).toBeNull();
  });

  it('should return error when entry script not found', async () => {
    mockFileExists = false;

    const result = await service.validateEntryScript('agents/main.py');

    expect(result).not.toBeNull();
    expect(result?.type).toBe('entryScript');
    expect(result?.message).toContain('Entry script not found');
  });

  it('should return error when entry script path is empty', async () => {
    const result = await service.validateEntryScript('');

    expect(result).not.toBeNull();
    expect(result?.type).toBe('entryScript');
    expect(result?.message).toContain('not configured');
  });
});

describe('Input Panel Validation - AWS Credentials', () => {
  let service: InputPanelValidationService;
  let mockConfigService: ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFileExists = true;
    mockIsInitialized = true;
    mockCredentialStatus = 'ready';
    mockConfig = { workflow: { entryScript: 'agents/main.py' } };

    mockConfigService = new ConfigService('/test/workspace');
    service = new InputPanelValidationService(mockConfigService, '/test/workspace');
  });

  it('should return null when credentials are valid', async () => {
    mockCredentialStatus = 'ready';

    const result = await service.validateAwsCredentials();

    expect(result).toBeNull();
  });

  it('should return error when SSO session expired', async () => {
    mockCredentialStatus = 'sso-expired';

    const result = await service.validateAwsCredentials();

    expect(result).not.toBeNull();
    expect(result?.type).toBe('awsCredentials');
    expect(result?.message).toContain('SSO session expired');
  });

  it('should return error when credentials are invalid', async () => {
    mockCredentialStatus = 'aws-error';

    const result = await service.validateAwsCredentials();

    expect(result).not.toBeNull();
    expect(result?.type).toBe('awsCredentials');
    expect(result?.message).toContain('not configured');
  });
});

describe('Input Panel Validation - Project Initialization', () => {
  let service: InputPanelValidationService;
  let mockConfigService: ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFileExists = true;
    mockIsInitialized = true;
    mockCredentialStatus = 'ready';
    mockConfig = { workflow: { entryScript: 'agents/main.py' } };

    mockConfigService = new ConfigService('/test/workspace');
    service = new InputPanelValidationService(mockConfigService, '/test/workspace');
  });

  it('should return null when project is initialized', async () => {
    mockIsInitialized = true;

    const result = await service.validateProjectInitialized();

    expect(result).toBeNull();
  });

  it('should return error when project is not initialized', async () => {
    mockIsInitialized = false;

    const result = await service.validateProjectInitialized();

    expect(result).not.toBeNull();
    expect(result?.type).toBe('projectInitialized');
    expect(result?.message).toContain('not initialized');
  });
});

describe('Input Panel Validation - Combined Validation', () => {
  let service: InputPanelValidationService;
  let mockConfigService: ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFileExists = true;
    mockIsInitialized = true;
    mockCredentialStatus = 'ready';
    mockConfig = { workflow: { entryScript: 'agents/main.py' } };

    mockConfigService = new ConfigService('/test/workspace');
    service = new InputPanelValidationService(mockConfigService, '/test/workspace');
  });

  it('should return isValid true when all validations pass', async () => {
    mockIsInitialized = true;
    mockFileExists = true;
    mockCredentialStatus = 'ready';

    const result = await service.validateAll();

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return isValid false with aggregated errors when multiple validations fail', async () => {
    mockIsInitialized = true;
    mockFileExists = false;
    mockCredentialStatus = 'aws-error';

    // Invalidate cache to get fresh results
    service.invalidateCache();
    const result = await service.validateAll();

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);

    const errorTypes = result.errors.map(e => e.type);
    expect(errorTypes).toContain('entryScript');
    expect(errorTypes).toContain('awsCredentials');
  });

  it('should skip other validations when project not initialized', async () => {
    mockIsInitialized = false;
    mockFileExists = false;
    mockCredentialStatus = 'aws-error';

    service.invalidateCache();
    const result = await service.validateAll();

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe('projectInitialized');
  });

  it('should cache validation results', async () => {
    mockIsInitialized = true;
    mockFileExists = true;
    mockCredentialStatus = 'ready';

    // First call
    const result1 = await service.validateAll();
    expect(result1.isValid).toBe(true);

    // Change state (should still return cached result)
    mockFileExists = false;
    const result2 = await service.validateAll();

    // Should be cached, so still valid
    expect(result2.isValid).toBe(true);

    // Invalidate cache
    service.invalidateCache();
    const result3 = await service.validateAll();

    // Now should reflect new state
    expect(result3.isValid).toBe(false);
  });
});
