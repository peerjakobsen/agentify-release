/**
 * Tests for System Prompt Loading
 *
 * Task Group 2: System Prompt Resource
 * Tests for loading the ideation assistant system prompt from bundled resources
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock vscode module
vi.mock('vscode', () => {
  const mockReadFile = vi.fn();
  return {
    workspace: {
      fs: {
        readFile: mockReadFile,
      },
    },
    Uri: {
      joinPath: (...args: unknown[]) => {
        const paths = args.map((arg) => (typeof arg === 'string' ? arg : (arg as { fsPath: string }).fsPath || ''));
        return { fsPath: paths.join('/') };
      },
      file: (path: string) => ({ fsPath: path }),
    },
    _mockReadFile: mockReadFile,
  };
});

import * as vscode from 'vscode';

// Access the mock function
const getMockReadFile = () => (vscode as unknown as { _mockReadFile: ReturnType<typeof vi.fn> })._mockReadFile;

describe('Task Group 2: System Prompt Resource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful prompt file loading', () => {
    it('loads prompt file via vscode.workspace.fs.readFile()', async () => {
      const mockReadFile = getMockReadFile();
      const expectedPromptContent = '# Ideation Assistant\n\nYou are an ideation assistant...';
      const promptBuffer = Buffer.from(expectedPromptContent, 'utf-8');

      mockReadFile.mockResolvedValueOnce(new Uint8Array(promptBuffer));

      const extensionUri = { fsPath: '/test/extension' };
      const promptUri = vscode.Uri.joinPath(extensionUri as vscode.Uri, 'resources', 'prompts', 'ideation-assistant.md');

      const content = await vscode.workspace.fs.readFile(promptUri);
      const textContent = Buffer.from(content).toString('utf-8');

      expect(mockReadFile).toHaveBeenCalledWith(promptUri);
      expect(textContent).toBe(expectedPromptContent);
    });
  });

  describe('error handling for missing prompt file', () => {
    it('throws error when prompt file is missing', async () => {
      const mockReadFile = getMockReadFile();
      const fileNotFoundError = new Error('File not found');
      (fileNotFoundError as NodeJS.ErrnoException).code = 'FileNotFound';
      mockReadFile.mockRejectedValueOnce(fileNotFoundError);

      const extensionUri = { fsPath: '/test/extension' };
      const promptUri = vscode.Uri.joinPath(extensionUri as vscode.Uri, 'resources', 'prompts', 'ideation-assistant.md');

      await expect(vscode.workspace.fs.readFile(promptUri)).rejects.toThrow('File not found');
    });
  });
});
