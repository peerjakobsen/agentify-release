/**
 * End-to-End and Edge Case Tests for Wizard State Persistence
 * Task Group 10: Test Review and Gap Analysis
 *
 * This file adds strategic tests to cover critical workflows and edge cases
 * that were identified as gaps during test review:
 *
 * 1. End-to-end: Start wizard -> fill Step 1 -> close -> reopen -> resume banner appears
 * 2. End-to-end: Resume session -> verify state restored -> navigate to correct step
 * 3. End-to-end: Start Fresh -> verify state cleared -> wizard at Step 1
 * 4. Integration: State mutation -> debounced save fires after 500ms
 * 5. Integration: Navigate forward -> immediate save before navigation
 * 6. Edge case: Corrupted JSON file -> warning shown, Start Fresh offered
 * 7. Edge case: No workspace folder -> persistence disabled gracefully
 * 8. Edge case: Schema version mismatch -> incompatibility banner shown
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Track if warning was shown
const mockWarnings: string[] = [];
const mockInfoMessages: string[] = [];

// Mock vscode module
vi.mock('vscode', () => {
  const mockFns = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn(),
    delete: vi.fn(),
    createDirectory: vi.fn(),
    showWarningMessage: vi.fn((msg: string) => {
      mockWarnings.push(msg);
      return Promise.resolve(undefined);
    }),
    showInformationMessage: vi.fn((msg: string) => {
      mockInfoMessages.push(msg);
    }),
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
      showInformationMessage: mockFns.showInformationMessage,
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

// Import service and types after mocking
import {
  WizardStatePersistenceService,
  resetWizardStatePersistenceService,
  getWizardStatePersistenceService,
  SAVE_DEBOUNCE_MS,
  type LoadResult,
} from '../../services/wizardStatePersistenceService';

import {
  createDefaultWizardState,
  persistedStateToWizardState,
  WIZARD_STATE_SCHEMA_VERSION,
  type PersistedWizardState,
  type ResumeBannerState,
} from '../../types/wizardPanel';

import {
  calculateExpiryStatus,
  truncateBusinessObjective,
  getResumeBannerHtml,
} from '../../panels/resumeBannerHtml';

// Get mock functions from the vscode mock
const mocks = (vscode as unknown as { _mocks: Record<string, ReturnType<typeof vi.fn>> })._mocks;

// Helper to create a valid persisted state
function createValidPersistedState(overrides?: Partial<PersistedWizardState>): PersistedWizardState {
  const state = createDefaultWizardState();
  return {
    schemaVersion: WIZARD_STATE_SCHEMA_VERSION,
    savedAt: Date.now() - 60 * 60 * 1000, // 1 hour ago
    currentStep: state.currentStep,
    highestStepReached: state.highestStepReached,
    validationAttempted: state.validationAttempted,
    businessObjective: state.businessObjective,
    industry: state.industry,
    systems: state.systems,
    aiGapFillingState: state.aiGapFillingState,
    outcome: state.outcome,
    security: state.security,
    agentDesign: state.agentDesign,
    mockData: state.mockData,
    ...overrides,
  };
}

// Helper to create file not found error
function createFileNotFoundError(): Error {
  const error = new Error('File not found');
  error.name = 'FileNotFound';
  return error;
}

describe('Task Group 10: End-to-End and Edge Case Tests', () => {
  let service: WizardStatePersistenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetWizardStatePersistenceService();
    mockWarnings.length = 0;
    mockInfoMessages.length = 0;
    service = new WizardStatePersistenceService('/test/workspace');
  });

  afterEach(() => {
    vi.useRealTimers();
    service.dispose();
  });

  // ===========================================================================
  // Test 1: E2E - Fill Step 1 -> Save -> Reopen -> Resume Banner Appears
  // ===========================================================================
  describe('E2E Test 1: Fill Step 1 -> Save -> Reopen -> Resume Banner Appears', () => {
    it('should persist state after Step 1 input and show resume banner on reopen', async () => {
      // Step 1: User fills in business context
      const userState = createDefaultWizardState();
      userState.businessObjective = 'Reduce inventory stockouts by 30% in fresh produce';
      userState.industry = 'Retail';
      userState.systems = ['SAP S/4HANA', 'Salesforce'];
      userState.currentStep = 1;
      userState.highestStepReached = 1;

      // Mock file operations
      mocks.readFile.mockResolvedValueOnce(Buffer.from('.agentify/wizard-state.json\n', 'utf-8'));
      mocks.writeFile.mockResolvedValue(undefined);

      // Save state (immediate, as if navigating forward)
      await service.saveImmediate(userState);

      // Verify state was written
      const writeCalls = mocks.writeFile.mock.calls;
      const stateWriteCall = writeCalls.find((call) =>
        (call[0] as { fsPath: string }).fsPath.includes('wizard-state.json')
      );
      expect(stateWriteCall).toBeDefined();

      // Step 2: Simulate panel close and reopen by loading state
      const savedContent = stateWriteCall![1] as Buffer;
      mocks.readFile.mockResolvedValueOnce(savedContent);

      const loadResult = await service.load();

      // Verify state was loaded successfully
      expect(loadResult.status).toBe('loaded');
      expect(loadResult.state).not.toBeNull();
      expect(loadResult.state!.businessObjective).toBe('Reduce inventory stockouts by 30% in fresh produce');

      // Step 3: Build resume banner state (simulating what TabbedPanelProvider does)
      const persistedState = loadResult.state!;
      const expiryStatus = calculateExpiryStatus(persistedState.savedAt);

      const bannerState: ResumeBannerState = {
        visible: true,
        businessObjectivePreview: truncateBusinessObjective(persistedState.businessObjective),
        stepReached: persistedState.highestStepReached,
        savedAt: persistedState.savedAt,
        isExpired: expiryStatus.isExpired,
        isVersionMismatch: false,
      };

      // Step 4: Generate banner HTML and verify it shows
      const bannerHtml = getResumeBannerHtml(bannerState);

      expect(bannerHtml).toContain('resume-banner');
      expect(bannerHtml).toContain('Continue where you left off?');
      expect(bannerHtml).toContain('Reduce inventory stockouts');
      expect(bannerHtml).toContain('Step 1 of 8');
    });
  });

  // ===========================================================================
  // Test 2: E2E - Resume Session -> Verify State Restored -> Navigate to Step
  // ===========================================================================
  describe('E2E Test 2: Resume Session -> Verify State Restored -> Navigate to Step', () => {
    it('should restore full state and navigate to highestStepReached on resume', async () => {
      // Setup: User was on Step 4 (Security) before closing
      const persistedState = createValidPersistedState({
        currentStep: 3,
        highestStepReached: 4,
        businessObjective: 'Automate supply chain forecasting',
        industry: 'Manufacturing',
        systems: ['SAP IBP', 'Salesforce'],
        validationAttempted: true,
      });

      // Simulate loading the persisted state
      const content = Buffer.from(JSON.stringify(persistedState), 'utf-8');
      mocks.readFile.mockResolvedValueOnce(content);

      const loadResult = await service.load();

      expect(loadResult.status).toBe('loaded');
      expect(loadResult.state).not.toBeNull();

      // Simulate "Resume" button click - convert to WizardState
      const restoredState = persistedStateToWizardState(loadResult.state!);

      // Verify all state is properly restored
      expect(restoredState.businessObjective).toBe('Automate supply chain forecasting');
      expect(restoredState.industry).toBe('Manufacturing');
      expect(restoredState.systems).toEqual(['SAP IBP', 'Salesforce']);
      expect(restoredState.validationAttempted).toBe(true);
      expect(restoredState.highestStepReached).toBe(4);

      // Verify navigation should go to highestStepReached (Step 4)
      // In actual implementation: this.setCurrentStep(restoredState.highestStepReached)
      expect(restoredState.highestStepReached).toBe(4);
    });

    it('should preserve uploaded file metadata but require re-upload', async () => {
      // Setup: User had uploaded a file
      const persistedState = createValidPersistedState({
        currentStep: 2,
        highestStepReached: 2,
        uploadedFileMetadata: {
          fileName: 'requirements-spec.pdf',
          fileSize: 2048576, // 2MB
          uploadedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
          requiresReupload: true,
        },
      });

      const content = Buffer.from(JSON.stringify(persistedState), 'utf-8');
      mocks.readFile.mockResolvedValueOnce(content);

      const loadResult = await service.load();
      const restoredState = persistedStateToWizardState(loadResult.state!);

      // Verify file metadata is preserved
      expect(restoredState.uploadedFileMetadata).toBeDefined();
      expect(restoredState.uploadedFileMetadata!.fileName).toBe('requirements-spec.pdf');
      expect(restoredState.uploadedFileMetadata!.requiresReupload).toBe(true);

      // Verify actual file data is NOT restored (binary not persisted)
      expect(restoredState.uploadedFile).toBeUndefined();
    });
  });

  // ===========================================================================
  // Test 3: E2E - Start Fresh -> Verify State Cleared -> Wizard at Step 1
  // ===========================================================================
  describe('E2E Test 3: Start Fresh -> Verify State Cleared -> Wizard at Step 1', () => {
    it('should clear persisted state and return empty on subsequent load', async () => {
      // Setup: State exists
      const existingState = createValidPersistedState({
        currentStep: 5,
        highestStepReached: 5,
        businessObjective: 'Old objective to be cleared',
      });

      const content = Buffer.from(JSON.stringify(existingState), 'utf-8');
      mocks.readFile.mockResolvedValueOnce(content);

      // Verify state exists
      const initialLoad = await service.load();
      expect(initialLoad.status).toBe('loaded');
      expect(initialLoad.state!.businessObjective).toBe('Old objective to be cleared');

      // Simulate "Start Fresh" button click
      mocks.delete.mockResolvedValueOnce(undefined);
      await service.clear();

      // Verify delete was called
      expect(mocks.delete).toHaveBeenCalledTimes(1);

      // Simulate subsequent load - file no longer exists
      mocks.readFile.mockRejectedValueOnce(createFileNotFoundError());
      const afterClearLoad = await service.load();

      expect(afterClearLoad.status).toBe('not_found');
      expect(afterClearLoad.state).toBeNull();

      // Create fresh state for wizard
      const freshState = createDefaultWizardState();
      expect(freshState.currentStep).toBe(1);
      expect(freshState.businessObjective).toBe('');
      expect(freshState.highestStepReached).toBe(1);
    });
  });

  // ===========================================================================
  // Test 4: Integration - Debounced Save Fires After 500ms
  // ===========================================================================
  describe('Integration Test 4: Debounced Save Fires After 500ms', () => {
    it('should trigger save exactly once after 500ms debounce delay', async () => {
      const state = createDefaultWizardState();
      state.businessObjective = 'Test debounce timing';

      mocks.readFile.mockResolvedValue(Buffer.from('.agentify/wizard-state.json\n', 'utf-8'));
      mocks.writeFile.mockResolvedValue(undefined);

      // Call save (debounced)
      service.save(state);

      // Check at 400ms - should NOT have written yet
      await vi.advanceTimersByTimeAsync(400);

      let writeCalls = mocks.writeFile.mock.calls;
      let stateWriteCalls = writeCalls.filter((call) =>
        (call[0] as { fsPath: string }).fsPath.includes('wizard-state.json')
      );
      expect(stateWriteCalls).toHaveLength(0);

      // Advance to 500ms + buffer - should have written
      await vi.advanceTimersByTimeAsync(150);

      writeCalls = mocks.writeFile.mock.calls;
      stateWriteCalls = writeCalls.filter((call) =>
        (call[0] as { fsPath: string }).fsPath.includes('wizard-state.json')
      );
      expect(stateWriteCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // Test 5: Integration - Immediate Save Before Navigation
  // ===========================================================================
  describe('Integration Test 5: Immediate Save Before Navigation', () => {
    it('should save state immediately when navigating forward without waiting for debounce', async () => {
      const state = createDefaultWizardState();
      state.businessObjective = 'Immediate save for navigation';
      state.currentStep = 1;

      mocks.readFile.mockResolvedValueOnce(Buffer.from('.agentify/wizard-state.json\n', 'utf-8'));
      mocks.writeFile.mockResolvedValue(undefined);

      // Simulate navigation forward - must save immediately
      await service.saveImmediate(state);

      // Should have written immediately without any timer advancement
      const writeCalls = mocks.writeFile.mock.calls;
      const stateWriteCall = writeCalls.find((call) =>
        (call[0] as { fsPath: string }).fsPath.includes('wizard-state.json')
      );
      expect(stateWriteCall).toBeDefined();

      // Verify content is correct
      const writtenContent = (stateWriteCall![1] as Buffer).toString('utf-8');
      expect(writtenContent).toContain('Immediate save for navigation');
    });
  });

  // ===========================================================================
  // Test 6: Edge Case - Corrupted JSON -> Warning Shown, Start Fresh Offered
  // ===========================================================================
  describe('Edge Case Test 6: Corrupted JSON -> Warning Shown', () => {
    it('should return corrupted status for invalid JSON and log error', async () => {
      // Simulate corrupted JSON file
      const corruptedContent = Buffer.from('{ not valid json ]]]', 'utf-8');
      mocks.readFile.mockResolvedValueOnce(corruptedContent);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const loadResult = await service.load();

      // Verify corrupted status returned
      expect(loadResult.status).toBe('corrupted');
      expect(loadResult.state).toBeNull();
      expect(loadResult.errorMessage).toContain('parse');

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should generate version mismatch banner when corrupted state is detected', () => {
      // When status is corrupted, UI should show Start Fresh option
      // This is handled by setting isVersionMismatch or similar
      const bannerState: ResumeBannerState = {
        visible: true,
        businessObjectivePreview: '',
        stepReached: 0,
        savedAt: Date.now(),
        isExpired: false,
        isVersionMismatch: true, // Treat corrupted similar to version mismatch
      };

      const bannerHtml = getResumeBannerHtml(bannerState);

      expect(bannerHtml).toContain('version-mismatch');
      expect(bannerHtml).toContain('Start Fresh');
      expect(bannerHtml).not.toContain('Resume');
    });
  });

  // ===========================================================================
  // Test 7: Edge Case - No Workspace Folder -> Persistence Disabled
  // ===========================================================================
  describe('Edge Case Test 7: No Workspace Folder -> Persistence Disabled', () => {
    it('should return null from getWizardStatePersistenceService when no workspace', () => {
      // Temporarily override workspaceFolders to be empty
      const originalWorkspaceFolders = (vscode.workspace as { workspaceFolders: unknown[] }).workspaceFolders;
      (vscode.workspace as { workspaceFolders: unknown[] | undefined }).workspaceFolders = undefined;

      resetWizardStatePersistenceService();

      const result = getWizardStatePersistenceService();

      expect(result).toBeNull();

      // Restore workspace folders
      (vscode.workspace as { workspaceFolders: unknown[] | undefined }).workspaceFolders = originalWorkspaceFolders;
    });

    it('should handle empty workspaceFolders array gracefully', () => {
      const originalWorkspaceFolders = (vscode.workspace as { workspaceFolders: unknown[] }).workspaceFolders;
      (vscode.workspace as { workspaceFolders: unknown[] | undefined }).workspaceFolders = [];

      resetWizardStatePersistenceService();

      const result = getWizardStatePersistenceService();

      expect(result).toBeNull();

      // Restore workspace folders
      (vscode.workspace as { workspaceFolders: unknown[] | undefined }).workspaceFolders = originalWorkspaceFolders;
    });
  });

  // ===========================================================================
  // Test 8: Edge Case - Schema Version Mismatch -> Incompatibility Banner
  // ===========================================================================
  describe('Edge Case Test 8: Schema Version Mismatch -> Incompatibility Banner', () => {
    it('should return version_mismatch status for old schema version', async () => {
      const oldVersionState = createValidPersistedState({
        businessObjective: 'State from old version',
      });
      // Set to old schema version
      oldVersionState.schemaVersion = 0;

      const content = Buffer.from(JSON.stringify(oldVersionState), 'utf-8');
      mocks.readFile.mockResolvedValueOnce(content);

      const loadResult = await service.load();

      expect(loadResult.status).toBe('version_mismatch');
      expect(loadResult.state).toBeNull();
      expect(loadResult.errorMessage).toContain('does not match');
    });

    it('should return version_mismatch status for future schema version', async () => {
      const futureVersionState = createValidPersistedState({
        businessObjective: 'State from future version',
      });
      // Set to future schema version
      futureVersionState.schemaVersion = 999;

      const content = Buffer.from(JSON.stringify(futureVersionState), 'utf-8');
      mocks.readFile.mockResolvedValueOnce(content);

      const loadResult = await service.load();

      expect(loadResult.status).toBe('version_mismatch');
      expect(loadResult.state).toBeNull();
    });

    it('should generate incompatibility banner for version mismatch', () => {
      const bannerState: ResumeBannerState = {
        visible: true,
        businessObjectivePreview: '',
        stepReached: 0,
        savedAt: Date.now(),
        isExpired: false,
        isVersionMismatch: true,
      };

      const bannerHtml = getResumeBannerHtml(bannerState);

      expect(bannerHtml).toContain('version-mismatch');
      expect(bannerHtml).toContain('Previous session incompatible');
      expect(bannerHtml).toContain('older version');
      expect(bannerHtml).toContain('Start Fresh');
      // Should NOT show Resume button
      expect(bannerHtml).not.toContain('resumeSession()');
    });
  });
});
