/**
 * Tests for Gitignore Integration
 * Task Group 9: Gitignore Template Update
 *
 * Verifies that wizard-state.json is properly excluded from version control
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode module before importing the service
vi.mock('vscode', () => {
  const mockFns = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn(),
    delete: vi.fn(),
    createDirectory: vi.fn(),
    showWarningMessage: vi.fn(),
    eventFire: vi.fn(),
    eventDispose: vi.fn(),
  };

  return {
    workspace: {
      fs: {
        readFile: mockFns.readFile,
        writeFile: mockFns.writeFile,
        stat: mockFns.stat,
        delete: mockFns.delete,
        createDirectory: mockFns.createDirectory,
      },
      workspaceFolders: [
        {
          uri: {
            fsPath: '/test/workspace',
          },
        },
      ],
    },
    window: {
      showWarningMessage: mockFns.showWarningMessage,
    },
    Uri: {
      file: (filePath: string) => ({ fsPath: filePath }),
      joinPath: (...args: unknown[]) => {
        const paths = args.map((arg) =>
          typeof arg === 'string' ? arg : (arg as { fsPath: string }).fsPath || ''
        );
        return { fsPath: paths.join('/') };
      },
    },
    EventEmitter: vi.fn().mockImplementation(() => ({
      event: vi.fn(),
      fire: mockFns.eventFire,
      dispose: mockFns.eventDispose,
    })),
    Disposable: vi.fn().mockImplementation((fn) => ({ dispose: fn })),
    _mocks: mockFns,
  };
});

// Import vscode to access mocks
import * as vscode from 'vscode';

// Import service and constants after mocking
import {
  WizardStatePersistenceService,
  resetWizardStatePersistenceService,
  WIZARD_STATE_GITIGNORE_ENTRY,
} from '../../services/wizardStatePersistenceService';

import { createDefaultWizardState } from '../../types/wizardPanel';

// Get mock functions from the vscode mock
const mocks = (vscode as unknown as { _mocks: Record<string, ReturnType<typeof vi.fn>> })._mocks;

describe('Task Group 9: Gitignore Template Update', () => {
  let service: WizardStatePersistenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetWizardStatePersistenceService();
    service = new WizardStatePersistenceService('/test/workspace');
  });

  afterEach(() => {
    vi.useRealTimers();
    service.dispose();
  });

  // ===========================================================================
  // Test 9.1: .gitignore includes wizard-state.json
  // ===========================================================================
  describe('Test 9.1: .gitignore includes wizard-state.json', () => {
    it('should export correct WIZARD_STATE_GITIGNORE_ENTRY constant', () => {
      // Verify the gitignore entry constant is correctly defined
      expect(WIZARD_STATE_GITIGNORE_ENTRY).toBe('.agentify/wizard-state.json');
    });

    it('should add wizard-state.json to .gitignore when saving state', async () => {
      const state = createDefaultWizardState();
      state.businessObjective = 'Test for gitignore';

      // Mock .gitignore read - file exists but does not have the entry
      mocks.readFile.mockResolvedValueOnce(Buffer.from('node_modules\n.env\n', 'utf-8'));
      mocks.writeFile.mockResolvedValue(undefined);

      await service.saveImmediate(state);

      // Find the .gitignore write call
      const writeCalls = mocks.writeFile.mock.calls;
      const gitignoreWriteCall = writeCalls.find((call) =>
        (call[0] as { fsPath: string }).fsPath.includes('.gitignore')
      );

      expect(gitignoreWriteCall).toBeDefined();

      // Verify the written content includes wizard-state.json entry
      const writtenContent = (gitignoreWriteCall![1] as Buffer).toString('utf-8');
      expect(writtenContent).toContain('.agentify/wizard-state.json');
    });

    it('should not duplicate wizard-state.json entry if already in .gitignore', async () => {
      const state = createDefaultWizardState();
      state.businessObjective = 'Test duplicate prevention';

      // Mock .gitignore read - already has the entry
      const existingGitignore = 'node_modules\n.agentify/wizard-state.json\n.env\n';
      mocks.readFile.mockResolvedValueOnce(Buffer.from(existingGitignore, 'utf-8'));
      mocks.writeFile.mockResolvedValue(undefined);

      await service.saveImmediate(state);

      // Find the .gitignore write call (should NOT exist since entry already present)
      const writeCalls = mocks.writeFile.mock.calls;
      const gitignoreWriteCall = writeCalls.find((call) => {
        const fsPath = (call[0] as { fsPath: string }).fsPath;
        return fsPath.endsWith('.gitignore') && !fsPath.includes('wizard-state');
      });

      // If .gitignore was written, verify it does not have duplicate entries
      if (gitignoreWriteCall) {
        const writtenContent = (gitignoreWriteCall[1] as Buffer).toString('utf-8');
        const matches = writtenContent.match(/\.agentify\/wizard-state\.json/g);
        // Should have at most 1 occurrence
        expect(matches?.length || 0).toBeLessThanOrEqual(1);
      }
    });

    it('should create .gitignore with wizard-state.json if file does not exist', async () => {
      const state = createDefaultWizardState();
      state.businessObjective = 'Test gitignore creation';

      // Mock .gitignore read - file does not exist
      const fileNotFoundError = new Error('File not found');
      fileNotFoundError.name = 'FileNotFound';
      mocks.readFile.mockRejectedValueOnce(fileNotFoundError);
      mocks.writeFile.mockResolvedValue(undefined);

      await service.saveImmediate(state);

      // Find the .gitignore write call
      const writeCalls = mocks.writeFile.mock.calls;
      const gitignoreWriteCall = writeCalls.find((call) =>
        (call[0] as { fsPath: string }).fsPath.endsWith('.gitignore')
      );

      expect(gitignoreWriteCall).toBeDefined();

      // Verify the written content includes wizard-state.json entry
      const writtenContent = (gitignoreWriteCall![1] as Buffer).toString('utf-8');
      expect(writtenContent).toContain('.agentify/wizard-state.json');
    });

    it('should add wizard-state.json after .agentify/config.json if present', async () => {
      const state = createDefaultWizardState();
      state.businessObjective = 'Test gitignore ordering';

      // Mock .gitignore read - has config.json entry
      const existingGitignore = 'node_modules\n.agentify/config.json\n.env\n';
      mocks.readFile.mockResolvedValueOnce(Buffer.from(existingGitignore, 'utf-8'));
      mocks.writeFile.mockResolvedValue(undefined);

      await service.saveImmediate(state);

      // Find the .gitignore write call
      const writeCalls = mocks.writeFile.mock.calls;
      const gitignoreWriteCall = writeCalls.find((call) =>
        (call[0] as { fsPath: string }).fsPath.endsWith('.gitignore')
      );

      expect(gitignoreWriteCall).toBeDefined();

      // Verify the entry is added
      const writtenContent = (gitignoreWriteCall![1] as Buffer).toString('utf-8');
      expect(writtenContent).toContain('.agentify/wizard-state.json');

      // Verify ordering: wizard-state.json should come after config.json
      const configIndex = writtenContent.indexOf('.agentify/config.json');
      const wizardStateIndex = writtenContent.indexOf('.agentify/wizard-state.json');
      expect(wizardStateIndex).toBeGreaterThan(configIndex);
    });

    it('should add comment header when .gitignore is empty', async () => {
      const state = createDefaultWizardState();
      state.businessObjective = 'Test gitignore with comment';

      // Mock .gitignore read - empty file
      mocks.readFile.mockResolvedValueOnce(Buffer.from('', 'utf-8'));
      mocks.writeFile.mockResolvedValue(undefined);

      await service.saveImmediate(state);

      // Find the .gitignore write call
      const writeCalls = mocks.writeFile.mock.calls;
      const gitignoreWriteCall = writeCalls.find((call) =>
        (call[0] as { fsPath: string }).fsPath.endsWith('.gitignore')
      );

      expect(gitignoreWriteCall).toBeDefined();

      // Verify the written content includes comment and entry
      const writtenContent = (gitignoreWriteCall![1] as Buffer).toString('utf-8');
      expect(writtenContent).toContain('# Agentify wizard state');
      expect(writtenContent).toContain('.agentify/wizard-state.json');
    });
  });

  // ===========================================================================
  // Additional tests for robustness
  // ===========================================================================
  describe('Gitignore entry robustness', () => {
    it('should handle .gitignore without trailing newline', async () => {
      const state = createDefaultWizardState();
      state.businessObjective = 'Test no trailing newline';

      // Mock .gitignore read - no trailing newline
      mocks.readFile.mockResolvedValueOnce(Buffer.from('node_modules', 'utf-8'));
      mocks.writeFile.mockResolvedValue(undefined);

      await service.saveImmediate(state);

      // Find the .gitignore write call
      const writeCalls = mocks.writeFile.mock.calls;
      const gitignoreWriteCall = writeCalls.find((call) =>
        (call[0] as { fsPath: string }).fsPath.endsWith('.gitignore')
      );

      expect(gitignoreWriteCall).toBeDefined();

      // Verify the entry is added properly
      const writtenContent = (gitignoreWriteCall![1] as Buffer).toString('utf-8');
      expect(writtenContent).toContain('.agentify/wizard-state.json');
    });
  });
});
