/**
 * Tests for Resource Extraction Service (Task Group 2)
 *
 * These tests validate the resource extraction logic including:
 * - Recursive directory extraction preserves nested files
 * - Existing folder detection triggers QuickPick dialog
 * - Skip option preserves existing folder
 * - Overwrite option replaces existing folder
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Track mock state
let mockCdkFolderExists = false;
let mockScriptsFolderExists = false;
let mockWrittenFiles: Map<string, Uint8Array> = new Map();
let mockCreatedDirectories: string[] = [];
let mockDeletedPaths: string[] = [];

// Mock directory structure for source files
const mockSourceFiles: Map<string, Uint8Array | 'directory'> = new Map();

// Helper to set up mock source directory structure
function setupMockSourceStructure() {
  mockSourceFiles.clear();
  // CDK structure
  mockSourceFiles.set('/ext/resources/cdk', 'directory');
  mockSourceFiles.set('/ext/resources/cdk/README.md', Buffer.from('# CDK README'));
  mockSourceFiles.set('/ext/resources/cdk/app.py', Buffer.from('#!/usr/bin/env python'));
  mockSourceFiles.set('/ext/resources/cdk/stacks', 'directory');
  mockSourceFiles.set('/ext/resources/cdk/stacks/__init__.py', Buffer.from(''));
  mockSourceFiles.set('/ext/resources/cdk/stacks/networking.py', Buffer.from('# Networking Stack'));
  mockSourceFiles.set('/ext/resources/cdk/stacks/observability.py', Buffer.from('# Observability Stack'));
  // Scripts structure
  mockSourceFiles.set('/ext/resources/scripts', 'directory');
  mockSourceFiles.set('/ext/resources/scripts/setup.sh', Buffer.from('#!/bin/bash\n# Setup script'));
  mockSourceFiles.set('/ext/resources/scripts/destroy.sh', Buffer.from('#!/bin/bash\n# Destroy script'));
  mockSourceFiles.set('/ext/resources/scripts/templates', 'directory');
  mockSourceFiles.set('/ext/resources/scripts/templates/Dockerfile.template', Buffer.from('FROM python:3.11'));
}

// Mock vscode module
vi.mock('vscode', () => ({
  window: {
    showQuickPick: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
  workspace: {
    fs: {
      stat: vi.fn().mockImplementation(async (uri: { fsPath: string }) => {
        const fsPath = uri.fsPath;

        // Check if it's a source file/directory from our mock structure
        if (mockSourceFiles.has(fsPath)) {
          const entry = mockSourceFiles.get(fsPath);
          if (entry === 'directory') {
            return { type: 2 }; // Directory
          }
          return { type: 1 }; // File
        }

        // Check destination paths
        if (fsPath === '/workspace/cdk' && mockCdkFolderExists) {
          return { type: 2 }; // Directory
        }
        if (fsPath === '/workspace/scripts' && mockScriptsFolderExists) {
          return { type: 2 }; // Directory
        }

        // Check written files
        if (mockWrittenFiles.has(fsPath)) {
          return { type: 1 }; // File
        }

        // Check created directories
        if (mockCreatedDirectories.includes(fsPath)) {
          return { type: 2 }; // Directory
        }

        const error = new Error('File not found');
        (error as NodeJS.ErrnoException).code = 'FileNotFound';
        throw error;
      }),
      readFile: vi.fn().mockImplementation(async (uri: { fsPath: string }) => {
        const fsPath = uri.fsPath;
        const content = mockSourceFiles.get(fsPath);
        if (content && content !== 'directory') {
          return content;
        }
        throw new Error('File not found');
      }),
      writeFile: vi.fn().mockImplementation(async (uri: { fsPath: string }, content: Uint8Array) => {
        mockWrittenFiles.set(uri.fsPath, content);
      }),
      createDirectory: vi.fn().mockImplementation(async (uri: { fsPath: string }) => {
        mockCreatedDirectories.push(uri.fsPath);
      }),
      readDirectory: vi.fn().mockImplementation(async (uri: { fsPath: string }) => {
        const fsPath = uri.fsPath;
        const entries: Array<[string, number]> = [];

        // Find all direct children of this path
        for (const [path, type] of mockSourceFiles.entries()) {
          if (path.startsWith(fsPath + '/')) {
            const relativePath = path.slice(fsPath.length + 1);
            // Only include direct children (no further slashes)
            if (!relativePath.includes('/')) {
              entries.push([
                relativePath,
                type === 'directory' ? 2 : 1, // FileType.Directory = 2, FileType.File = 1
              ]);
            }
          }
        }

        return entries;
      }),
      delete: vi.fn().mockImplementation(async (uri: { fsPath: string }) => {
        mockDeletedPaths.push(uri.fsPath);
      }),
    },
  },
  Uri: {
    file: (path: string) => ({ fsPath: path }),
  },
  FileType: {
    Unknown: 0,
    File: 1,
    Directory: 2,
    SymbolicLink: 64,
  },
}));

// Import vscode after mocking
import * as vscode from 'vscode';

// Import module under test
import {
  extractBundledResources,
  checkExistingCdkFolder,
  showOverwritePrompt,
  CDK_SOURCE_PATH,
  CDK_DEST_PATH,
  SCRIPTS_SOURCE_PATH,
  SCRIPTS_DEST_PATH,
  OVERWRITE_OPTIONS,
  type ExtractionResult,
} from '../services/resourceExtractionService';

// Helper to get mocked window
const getMockedWindow = () =>
  vscode.window as unknown as {
    showQuickPick: ReturnType<typeof vi.fn>;
    showInformationMessage: ReturnType<typeof vi.fn>;
    showErrorMessage: ReturnType<typeof vi.fn>;
  };

// Helper to get mocked fs
const getMockedFs = () =>
  vscode.workspace.fs as unknown as {
    stat: ReturnType<typeof vi.fn>;
    writeFile: ReturnType<typeof vi.fn>;
    createDirectory: ReturnType<typeof vi.fn>;
    readDirectory: ReturnType<typeof vi.fn>;
    readFile: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

describe('Resource Extraction Service - Directory Structure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCdkFolderExists = false;
    mockScriptsFolderExists = false;
    mockWrittenFiles.clear();
    mockCreatedDirectories = [];
    mockDeletedPaths = [];
    setupMockSourceStructure();
  });

  // Test 2.1.1: Extraction preserves nested directory structure
  it('should preserve nested directory structure during extraction', async () => {
    const result = await extractBundledResources('/ext', '/workspace');

    expect(result.success).toBe(true);
    expect(result.cdkExtracted).toBe(true);
    expect(result.scriptsExtracted).toBe(true);

    // Check that directories were created
    expect(mockCreatedDirectories).toContain('/workspace/cdk');
    expect(mockCreatedDirectories).toContain('/workspace/cdk/stacks');
    expect(mockCreatedDirectories).toContain('/workspace/scripts');
    expect(mockCreatedDirectories).toContain('/workspace/scripts/templates');

    // Check that files were written
    expect(mockWrittenFiles.has('/workspace/cdk/README.md')).toBe(true);
    expect(mockWrittenFiles.has('/workspace/cdk/app.py')).toBe(true);
    expect(mockWrittenFiles.has('/workspace/cdk/stacks/__init__.py')).toBe(true);
    expect(mockWrittenFiles.has('/workspace/cdk/stacks/networking.py')).toBe(true);
    expect(mockWrittenFiles.has('/workspace/cdk/stacks/observability.py')).toBe(true);
    expect(mockWrittenFiles.has('/workspace/scripts/setup.sh')).toBe(true);
    expect(mockWrittenFiles.has('/workspace/scripts/destroy.sh')).toBe(true);
    expect(mockWrittenFiles.has('/workspace/scripts/templates/Dockerfile.template')).toBe(true);
  });

  // Test 2.1.2: File content is preserved during extraction
  it('should preserve file content during extraction', async () => {
    await extractBundledResources('/ext', '/workspace');

    const readmeContent = mockWrittenFiles.get('/workspace/cdk/README.md');
    expect(Buffer.from(readmeContent!).toString()).toBe('# CDK README');

    const setupContent = mockWrittenFiles.get('/workspace/scripts/setup.sh');
    expect(Buffer.from(setupContent!).toString()).toBe('#!/bin/bash\n# Setup script');
  });
});

describe('Resource Extraction Service - Existing Folder Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCdkFolderExists = false;
    mockScriptsFolderExists = false;
    mockWrittenFiles.clear();
    mockCreatedDirectories = [];
    mockDeletedPaths = [];
    setupMockSourceStructure();
  });

  // Test 2.1.3: Existing folder detection returns true when folder exists
  it('should detect existing CDK folder', async () => {
    mockCdkFolderExists = true;

    const exists = await checkExistingCdkFolder('/workspace');

    expect(exists).toBe(true);
    expect(getMockedFs().stat).toHaveBeenCalled();
  });

  // Test 2.1.4: Existing folder detection returns false when folder does not exist
  it('should return false when CDK folder does not exist', async () => {
    mockCdkFolderExists = false;

    const exists = await checkExistingCdkFolder('/workspace');

    expect(exists).toBe(false);
  });
});

describe('Resource Extraction Service - Overwrite Prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCdkFolderExists = false;
    mockScriptsFolderExists = false;
    mockWrittenFiles.clear();
    mockCreatedDirectories = [];
    mockDeletedPaths = [];
    setupMockSourceStructure();
  });

  // Test 2.1.5: Skip option preserves existing folder
  it('should skip extraction when user chooses Skip option', async () => {
    mockCdkFolderExists = true;

    // Simulate user choosing "Skip"
    const result = await extractBundledResources('/ext', '/workspace', false);

    expect(result.success).toBe(true);
    expect(result.cdkExtracted).toBe(false);
    expect(result.scriptsExtracted).toBe(false);
    expect(result.message).toContain('skipped');

    // Verify no files were written
    expect(mockWrittenFiles.size).toBe(0);
    expect(mockDeletedPaths.length).toBe(0);
  });

  // Test 2.1.6: Overwrite option replaces existing folder
  it('should overwrite existing folder when overwrite is true', async () => {
    mockCdkFolderExists = true;
    mockScriptsFolderExists = true;

    const result = await extractBundledResources('/ext', '/workspace', true);

    expect(result.success).toBe(true);
    expect(result.cdkExtracted).toBe(true);
    expect(result.scriptsExtracted).toBe(true);

    // Verify existing folders were deleted first
    expect(mockDeletedPaths).toContain('/workspace/cdk');
    expect(mockDeletedPaths).toContain('/workspace/scripts');

    // Verify new files were written
    expect(mockWrittenFiles.has('/workspace/cdk/README.md')).toBe(true);
  });
});

describe('Resource Extraction Service - QuickPick Dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test for showOverwritePrompt - returns 'skip' when user selects Skip
  it('should return skip when user selects Skip option', async () => {
    getMockedWindow().showQuickPick.mockResolvedValue({ label: OVERWRITE_OPTIONS.SKIP });

    const choice = await showOverwritePrompt();

    expect(choice).toBe('skip');
    expect(getMockedWindow().showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: OVERWRITE_OPTIONS.SKIP }),
        expect.objectContaining({ label: OVERWRITE_OPTIONS.OVERWRITE }),
      ]),
      expect.objectContaining({
        placeHolder: expect.stringContaining('CDK folder already exists'),
      })
    );
  });

  // Test for showOverwritePrompt - returns 'overwrite' when user selects Overwrite
  it('should return overwrite when user selects Overwrite option', async () => {
    getMockedWindow().showQuickPick.mockResolvedValue({ label: OVERWRITE_OPTIONS.OVERWRITE });

    const choice = await showOverwritePrompt();

    expect(choice).toBe('overwrite');
  });

  // Test for showOverwritePrompt - returns null when user cancels
  it('should return null when user cancels QuickPick', async () => {
    getMockedWindow().showQuickPick.mockResolvedValue(null);

    const choice = await showOverwritePrompt();

    expect(choice).toBeNull();
  });
});

describe('Resource Extraction Service - Constants', () => {
  it('should have correct source paths', () => {
    expect(CDK_SOURCE_PATH).toBe('resources/cdk');
    expect(SCRIPTS_SOURCE_PATH).toBe('resources/scripts');
  });

  it('should have correct destination paths', () => {
    expect(CDK_DEST_PATH).toBe('cdk');
    expect(SCRIPTS_DEST_PATH).toBe('scripts');
  });

  it('should have correct overwrite options', () => {
    expect(OVERWRITE_OPTIONS.SKIP).toBe('Skip (keep existing)');
    expect(OVERWRITE_OPTIONS.OVERWRITE).toBe('Overwrite');
  });
});

describe('Resource Extraction Service - Return Types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCdkFolderExists = false;
    mockScriptsFolderExists = false;
    mockWrittenFiles.clear();
    mockCreatedDirectories = [];
    mockDeletedPaths = [];
    setupMockSourceStructure();
  });

  it('should return correct extraction result structure on success', async () => {
    const result = await extractBundledResources('/ext', '/workspace');

    expect(result).toMatchObject({
      success: true,
      cdkExtracted: true,
      scriptsExtracted: true,
      cdkPath: '/workspace/cdk',
      scriptsPath: '/workspace/scripts',
      message: expect.stringContaining('successfully'),
    });
  });

  it('should return correct paths even when skipped', async () => {
    mockCdkFolderExists = true;

    const result = await extractBundledResources('/ext', '/workspace', false);

    expect(result.cdkPath).toBe('/workspace/cdk');
    expect(result.scriptsPath).toBe('/workspace/scripts');
  });
});
