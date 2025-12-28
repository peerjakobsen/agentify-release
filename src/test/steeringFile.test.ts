/**
 * Tests for Steering File Creation (Task Group 4)
 *
 * These tests validate the steering file creation logic including:
 * - Directory creation when .kiro/steering/ doesn't exist
 * - File content generation
 * - Overwrite prompt when file already exists
 * - Successful file write
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Track mock state
let mockFileExists = false;
let mockWrittenContent = '';
let mockDirectoryCreated = false;

// Mock vscode module
vi.mock('vscode', () => ({
  window: {
    showQuickPick: vi.fn(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
  workspace: {
    fs: {
      stat: vi.fn().mockImplementation(async () => {
        if (mockFileExists) {
          return { type: 1 }; // File exists
        }
        const error = new Error('File not found');
        (error as NodeJS.ErrnoException).code = 'FileNotFound';
        throw error;
      }),
      readFile: vi.fn(),
      writeFile: vi.fn().mockImplementation(async (_uri: unknown, content: Uint8Array) => {
        mockWrittenContent = Buffer.from(content).toString('utf-8');
      }),
      createDirectory: vi.fn().mockImplementation(async () => {
        mockDirectoryCreated = true;
      }),
    },
  },
  Uri: {
    file: (path: string) => ({ fsPath: path }),
  },
}));

// Import vscode after mocking
import * as vscode from 'vscode';

// Import module under test
import {
  createSteeringFile,
  STEERING_FILE_CONTENT,
  STEERING_DIR_PATH,
  STEERING_FILE_NAME,
} from '../templates/steeringFile';

// Helper to get mocked window
const getMockedWindow = () => vscode.window as unknown as {
  showQuickPick: ReturnType<typeof vi.fn>;
  showInformationMessage: ReturnType<typeof vi.fn>;
  showErrorMessage: ReturnType<typeof vi.fn>;
};

// Helper to get mocked fs
const getMockedFs = () => vscode.workspace.fs as unknown as {
  stat: ReturnType<typeof vi.fn>;
  writeFile: ReturnType<typeof vi.fn>;
  createDirectory: ReturnType<typeof vi.fn>;
};

describe('Steering File Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileExists = false;
    mockWrittenContent = '';
    mockDirectoryCreated = false;

    // Reset stat mock to throw by default (file doesn't exist)
    getMockedFs().stat.mockImplementation(async () => {
      if (mockFileExists) {
        return { type: 1 };
      }
      const error = new Error('File not found');
      (error as NodeJS.ErrnoException).code = 'FileNotFound';
      throw error;
    });
  });

  // Test 4.1.1: Creates .kiro/steering directory if it doesn't exist
  it('should create .kiro/steering directory if it does not exist', async () => {
    mockFileExists = false;

    const result = await createSteeringFile('/test/workspace');

    expect(getMockedFs().createDirectory).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(false);
  });

  // Test 4.1.2: Creates agentify-integration.md with correct content
  it('should create agentify-integration.md with correct content', async () => {
    mockFileExists = false;

    const result = await createSteeringFile('/test/workspace');

    expect(getMockedFs().writeFile).toHaveBeenCalled();
    expect(mockWrittenContent).toBe(STEERING_FILE_CONTENT);
    expect(result.success).toBe(true);
    expect(result.message).toBe('Steering file created');
  });

  // Test 4.1.3: Prompts before overwriting existing file
  it('should prompt user before overwriting existing file', async () => {
    mockFileExists = true;
    getMockedWindow().showQuickPick.mockResolvedValue({ label: 'Overwrite' });

    await createSteeringFile('/test/workspace');

    expect(getMockedWindow().showQuickPick).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Overwrite' }),
        expect.objectContaining({ label: 'Skip' }),
      ]),
      expect.objectContaining({
        placeHolder: expect.stringContaining('already exists'),
      })
    );
  });

  // Test 4.1.4: Preserves existing file when user declines overwrite
  it('should preserve existing file when user selects Skip', async () => {
    mockFileExists = true;
    getMockedWindow().showQuickPick.mockResolvedValue({ label: 'Skip' });

    const result = await createSteeringFile('/test/workspace');

    expect(getMockedFs().writeFile).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.message).toContain('skipped');
  });
});

describe('Steering File Constants', () => {
  it('should have correct directory path', () => {
    expect(STEERING_DIR_PATH).toBe('.kiro/steering');
  });

  it('should have correct file name', () => {
    expect(STEERING_FILE_NAME).toBe('agentify-integration.md');
  });

  it('should have content with expected sections', () => {
    expect(STEERING_FILE_CONTENT).toContain('# Agentify Integration');
    expect(STEERING_FILE_CONTENT).toContain('## 1. CLI Contract');
    expect(STEERING_FILE_CONTENT).toContain('## 2. Hybrid Identity Pattern');
    expect(STEERING_FILE_CONTENT).toContain('## 3. stdout Event Streaming');
    expect(STEERING_FILE_CONTENT).toContain('## 4. DynamoDB Event Persistence');
    expect(STEERING_FILE_CONTENT).toContain('## 5. Strands SDK Integration');
    expect(STEERING_FILE_CONTENT).toContain('--workflow-id');
    expect(STEERING_FILE_CONTENT).toContain('--trace-id');
    expect(STEERING_FILE_CONTENT).toContain('AGENTIFY_TABLE_NAME');
    expect(STEERING_FILE_CONTENT).toContain('emit_stdout_event');
    expect(STEERING_FILE_CONTENT).toContain('DynamoDBEventWriter');
  });
});

describe('Steering File - Overwrite Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileExists = true;
    mockWrittenContent = '';
    mockDirectoryCreated = false;

    getMockedFs().stat.mockResolvedValue({ type: 1 });
  });

  it('should overwrite file when user confirms', async () => {
    getMockedWindow().showQuickPick.mockResolvedValue({ label: 'Overwrite' });

    const result = await createSteeringFile('/test/workspace');

    expect(getMockedFs().writeFile).toHaveBeenCalled();
    expect(mockWrittenContent).toBe(STEERING_FILE_CONTENT);
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.message).toBe('Steering file overwritten');
  });

  it('should skip when user cancels QuickPick (null selection)', async () => {
    getMockedWindow().showQuickPick.mockResolvedValue(null);

    const result = await createSteeringFile('/test/workspace');

    expect(getMockedFs().writeFile).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
  });
});
