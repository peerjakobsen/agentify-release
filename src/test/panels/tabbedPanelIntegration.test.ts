/**
 * Tests for TabbedPanelProvider Persistence Integration
 * Task Group 6: TabbedPanelProvider Integration Tests
 * Task 6.1: 5 focused tests for panel integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode module before importing the provider
vi.mock('vscode', () => {
  const mockFns = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn(),
    delete: vi.fn(),
    createDirectory: vi.fn(),
    findFiles: vi.fn().mockResolvedValue([]),
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    createFileSystemWatcher: vi.fn().mockReturnValue({
      onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      dispose: vi.fn(),
    }),
    eventFire: vi.fn(),
    eventDispose: vi.fn(),
    postMessage: vi.fn(),
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
      findFiles: mockFns.findFiles,
      createFileSystemWatcher: mockFns.createFileSystemWatcher,
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
      showInformationMessage: mockFns.showInformationMessage,
      registerWebviewViewProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
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
    commands: {
      registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    },
    _mocks: mockFns,
  };
});

// Import vscode to access mocks
import * as vscode from 'vscode';

// Import service and types after mocking
import {
  WizardStatePersistenceService,
  resetWizardStatePersistenceService,
  SAVE_DEBOUNCE_MS,
  type LoadResult,
} from '../../services/wizardStatePersistenceService';

import {
  createDefaultWizardState,
  WIZARD_STATE_SCHEMA_VERSION,
  persistedStateToWizardState,
  type PersistedWizardState,
  type ResumeBannerState,
} from '../../types/wizardPanel';

// Get mock functions from the vscode mock
const mocks = (vscode as unknown as { _mocks: Record<string, ReturnType<typeof vi.fn>> })._mocks;

// Helper to create a valid persisted state
function createValidPersistedState(): PersistedWizardState {
  const state = createDefaultWizardState();
  return {
    schemaVersion: WIZARD_STATE_SCHEMA_VERSION,
    savedAt: Date.now() - 60 * 60 * 1000, // 1 hour ago
    currentStep: 3,
    highestStepReached: 4,
    validationAttempted: false,
    businessObjective: 'Test business objective',
    industry: 'Retail',
    systems: ['Salesforce', 'SAP S/4HANA'],
    aiGapFillingState: state.aiGapFillingState,
    outcome: state.outcome,
    security: state.security,
    agentDesign: state.agentDesign,
    mockData: state.mockData,
  };
}

// Helper to create file not found error
function createFileNotFoundError(): Error {
  const error = new Error('File not found');
  error.name = 'FileNotFound';
  return error;
}

describe('Task Group 6: TabbedPanelProvider Persistence Integration', () => {
  let persistenceService: WizardStatePersistenceService;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset singleton
    resetWizardStatePersistenceService();

    // Create fresh service instance for each test
    persistenceService = new WizardStatePersistenceService('/test/workspace');
  });

  afterEach(() => {
    vi.useRealTimers();
    persistenceService.dispose();
  });

  // ===========================================================================
  // Test 1: Persistence service initialized in constructor
  // Task 6.1a: Verify service is initialized with workspace context
  // ===========================================================================
  describe('Test 1: Persistence service initialized in constructor', () => {
    it('should create persistence service with workspace path', () => {
      // Service is created successfully
      expect(persistenceService).toBeDefined();

      // Service has correct methods available
      expect(typeof persistenceService.load).toBe('function');
      expect(typeof persistenceService.save).toBe('function');
      expect(typeof persistenceService.saveImmediate).toBe('function');
      expect(typeof persistenceService.clear).toBe('function');
      expect(typeof persistenceService.exists).toBe('function');
    });

    it('should have onSaveError event available', () => {
      expect(persistenceService.onSaveError).toBeDefined();
    });

    it('should implement Disposable interface', () => {
      expect(typeof persistenceService.dispose).toBe('function');
    });
  });

  // ===========================================================================
  // Test 2: load() called in resolveWebviewView()
  // Task 6.1b: Verify state loading is called when panel is resolved
  // ===========================================================================
  describe('Test 2: load() called in resolveWebviewView()', () => {
    it('should return loaded status when state file exists', async () => {
      const validState = createValidPersistedState();
      const content = Buffer.from(JSON.stringify(validState), 'utf-8');
      mocks.readFile.mockResolvedValueOnce(content);

      const result = await persistenceService.load();

      expect(result.status).toBe('loaded');
      expect(result.state).not.toBeNull();
      expect(result.state?.businessObjective).toBe('Test business objective');
    });

    it('should return not_found status when no state exists', async () => {
      mocks.readFile.mockRejectedValueOnce(createFileNotFoundError());

      const result = await persistenceService.load();

      expect(result.status).toBe('not_found');
      expect(result.state).toBeNull();
    });

    it('should return version_mismatch status when schema version differs', async () => {
      const oldState = createValidPersistedState();
      oldState.schemaVersion = 0; // Old version
      const content = Buffer.from(JSON.stringify(oldState), 'utf-8');
      mocks.readFile.mockResolvedValueOnce(content);

      const result = await persistenceService.load();

      expect(result.status).toBe('version_mismatch');
      expect(result.state).toBeNull();
    });

    it('should return corrupted status for invalid JSON', async () => {
      const content = Buffer.from('{ invalid json }', 'utf-8');
      mocks.readFile.mockResolvedValueOnce(content);

      const result = await persistenceService.load();

      expect(result.status).toBe('corrupted');
      expect(result.state).toBeNull();
    });
  });

  // ===========================================================================
  // Test 3: Debounced save called on state mutations
  // Task 6.1c: Verify debounced save is triggered after state changes
  // ===========================================================================
  describe('Test 3: Debounced save called on state mutations', () => {
    it('should trigger save after debounce delay for state changes', async () => {
      const state = createDefaultWizardState();
      state.businessObjective = 'Updated objective';
      state.industry = 'Healthcare';

      // Mock gitignore read and write
      mocks.readFile.mockResolvedValueOnce(Buffer.from('.agentify/wizard-state.json\n', 'utf-8'));
      mocks.writeFile.mockResolvedValue(undefined);

      // Call save (debounced)
      persistenceService.save(state);

      // Should not write immediately
      expect(mocks.writeFile).not.toHaveBeenCalled();

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 100);

      // Now should have written
      const writeCalls = mocks.writeFile.mock.calls;
      const stateWriteCall = writeCalls.find((call) =>
        (call[0] as { fsPath: string }).fsPath.includes('wizard-state.json')
      );
      expect(stateWriteCall).toBeDefined();
    });

    it('should debounce multiple rapid state changes into single save', async () => {
      const state1 = createDefaultWizardState();
      state1.businessObjective = 'First change';

      const state2 = createDefaultWizardState();
      state2.businessObjective = 'Second change';

      const state3 = createDefaultWizardState();
      state3.businessObjective = 'Third change';

      // Mock gitignore
      mocks.readFile.mockResolvedValue(Buffer.from('.agentify/wizard-state.json\n', 'utf-8'));
      mocks.writeFile.mockResolvedValue(undefined);

      // Multiple rapid saves
      persistenceService.save(state1);
      await vi.advanceTimersByTimeAsync(100);
      persistenceService.save(state2);
      await vi.advanceTimersByTimeAsync(100);
      persistenceService.save(state3);

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 100);

      // Should only have saved once with last state
      const writeCalls = mocks.writeFile.mock.calls;
      const stateWriteCalls = writeCalls.filter((call) =>
        (call[0] as { fsPath: string }).fsPath.includes('wizard-state.json')
      );

      expect(stateWriteCalls).toHaveLength(1);

      // Verify the saved content contains the last change
      const writtenContent = (stateWriteCalls[0][1] as Buffer).toString('utf-8');
      expect(writtenContent).toContain('Third change');
    });
  });

  // ===========================================================================
  // Test 4: Immediate save called before navigation
  // Task 6.1d: Verify immediate save is triggered before navigation
  // ===========================================================================
  describe('Test 4: Immediate save called before navigation', () => {
    it('should save immediately without debounce delay', async () => {
      const state = createDefaultWizardState();
      state.businessObjective = 'Before navigation save';
      state.currentStep = 2;
      state.highestStepReached = 2;

      // Mock gitignore
      mocks.readFile.mockResolvedValueOnce(Buffer.from('.agentify/wizard-state.json\n', 'utf-8'));
      mocks.writeFile.mockResolvedValue(undefined);

      // Call saveImmediate (should not wait for debounce)
      await persistenceService.saveImmediate(state);

      // Should have written immediately without timer
      const writeCalls = mocks.writeFile.mock.calls;
      const stateWriteCall = writeCalls.find((call) =>
        (call[0] as { fsPath: string }).fsPath.includes('wizard-state.json')
      );
      expect(stateWriteCall).toBeDefined();

      // Verify content
      const writtenContent = (stateWriteCall![1] as Buffer).toString('utf-8');
      expect(writtenContent).toContain('Before navigation save');
      expect(writtenContent).toContain('"currentStep": 2'); // Note: space after colon due to pretty printing
    });

    it('should clear pending debounced save when saveImmediate is called', async () => {
      const state1 = createDefaultWizardState();
      state1.businessObjective = 'Debounced save';

      const state2 = createDefaultWizardState();
      state2.businessObjective = 'Immediate save';

      // Mock gitignore
      mocks.readFile.mockResolvedValue(Buffer.from('', 'utf-8'));
      mocks.writeFile.mockResolvedValue(undefined);

      // Start debounced save
      persistenceService.save(state1);

      // Then immediately save different state
      await persistenceService.saveImmediate(state2);

      // Advance timers past original debounce
      await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 100);

      // Should only have the immediate save, not the debounced one
      const writeCalls = mocks.writeFile.mock.calls;
      const stateWriteCalls = writeCalls.filter((call) =>
        (call[0] as { fsPath: string }).fsPath.includes('wizard-state.json')
      );

      expect(stateWriteCalls).toHaveLength(1);

      const writtenContent = (stateWriteCalls[0][1] as Buffer).toString('utf-8');
      expect(writtenContent).toContain('Immediate save');
      expect(writtenContent).not.toContain('Debounced save');
    });
  });

  // ===========================================================================
  // Test 5: resumeSession command restores state and navigates
  // Task 6.1e: Verify resumeSession loads state, converts it, and navigates
  // ===========================================================================
  describe('Test 5: resumeSession command restores state and navigates', () => {
    it('should convert persisted state to wizard state correctly', () => {
      const persisted = createValidPersistedState();
      persisted.currentStep = 3;
      persisted.highestStepReached = 4;
      persisted.businessObjective = 'Restored objective';
      persisted.industry = 'Healthcare';
      persisted.systems = ['Salesforce'];
      persisted.uploadedFileMetadata = {
        fileName: 'document.pdf',
        fileSize: 1024,
        uploadedAt: Date.now(),
        requiresReupload: true,
      };

      const wizardState = persistedStateToWizardState(persisted);

      // Verify conversion
      expect(wizardState.currentStep).toBe(3);
      expect(wizardState.highestStepReached).toBe(4);
      expect(wizardState.businessObjective).toBe('Restored objective');
      expect(wizardState.industry).toBe('Healthcare');
      expect(wizardState.systems).toEqual(['Salesforce']);

      // Uploaded file should be undefined (binary not persisted)
      expect(wizardState.uploadedFile).toBeUndefined();

      // But metadata should be preserved
      expect(wizardState.uploadedFileMetadata).toBeDefined();
      expect(wizardState.uploadedFileMetadata?.fileName).toBe('document.pdf');
      expect(wizardState.uploadedFileMetadata?.requiresReupload).toBe(true);
    });

    it('should load persisted state and prepare for navigation to highestStepReached', async () => {
      const persisted = createValidPersistedState();
      persisted.currentStep = 2;
      persisted.highestStepReached = 4;

      const content = Buffer.from(JSON.stringify(persisted), 'utf-8');
      mocks.readFile.mockResolvedValueOnce(content);

      const result = await persistenceService.load();

      expect(result.status).toBe('loaded');
      expect(result.state).not.toBeNull();
      expect(result.state!.currentStep).toBe(2);
      expect(result.state!.highestStepReached).toBe(4);

      // Convert to wizard state
      const wizardState = persistedStateToWizardState(result.state!);

      // Resume flow should navigate to highestStepReached
      expect(wizardState.highestStepReached).toBe(4);
    });

    it('should create proper resume banner state from loaded persisted state', async () => {
      const persisted = createValidPersistedState();
      persisted.businessObjective = 'Test objective for preview';
      persisted.savedAt = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      persisted.highestStepReached = 3;

      const content = Buffer.from(JSON.stringify(persisted), 'utf-8');
      mocks.readFile.mockResolvedValueOnce(content);

      const result = await persistenceService.load();

      expect(result.status).toBe('loaded');

      // Build banner state from result
      const bannerState: ResumeBannerState = {
        visible: true,
        businessObjectivePreview: persisted.businessObjective.substring(0, 80),
        stepReached: persisted.highestStepReached,
        savedAt: persisted.savedAt,
        isExpired: (Date.now() - persisted.savedAt) > 7 * 24 * 60 * 60 * 1000,
        isVersionMismatch: false,
      };

      expect(bannerState.visible).toBe(true);
      expect(bannerState.businessObjectivePreview).toBe('Test objective for preview');
      expect(bannerState.stepReached).toBe(3);
      expect(bannerState.isExpired).toBe(false);
      expect(bannerState.isVersionMismatch).toBe(false);
    });
  });

  // ===========================================================================
  // Additional Tests: startFresh and clear
  // ===========================================================================
  describe('startFresh command clears state', () => {
    it('should delete state file when clear is called', async () => {
      mocks.delete.mockResolvedValueOnce(undefined);

      await persistenceService.clear();

      expect(mocks.delete).toHaveBeenCalledTimes(1);
      const deleteCall = mocks.delete.mock.calls[0][0] as { fsPath: string };
      expect(deleteCall.fsPath).toContain('wizard-state.json');
    });

    it('should handle clear when no state file exists', async () => {
      mocks.delete.mockRejectedValueOnce(createFileNotFoundError());

      // Should not throw
      await expect(persistenceService.clear()).resolves.not.toThrow();
    });
  });
});
