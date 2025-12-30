/**
 * Tests for Steering File Service
 * Task Group 1: Conflict Detection & Backup
 * Task Group 2: File Writing Operations
 * Task Group 3: Generation Orchestration
 *
 * Tests the SteeringFileService that orchestrates steering file
 * generation with progress events for the Step 8 UI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock SteeringGenerationService before other imports
vi.mock('../../services/steeringGenerationService', () => ({
  getSteeringGenerationService: vi.fn(() => ({
    onFileStart: vi.fn().mockReturnValue({ dispose: () => {} }),
    onFileComplete: vi.fn().mockReturnValue({ dispose: () => {} }),
    onFileError: vi.fn().mockReturnValue({ dispose: () => {} }),
    generateSteeringFiles: vi.fn().mockResolvedValue({
      success: true,
      files: [
        { fileName: 'product.md', content: '# Product', status: 'created' },
        { fileName: 'tech.md', content: '# Tech', status: 'created' },
        { fileName: 'structure.md', content: '# Structure', status: 'created' },
        { fileName: 'customer-context.md', content: '# Customer Context', status: 'created' },
        { fileName: 'integration-landscape.md', content: '# Integration Landscape', status: 'created' },
        { fileName: 'security-policies.md', content: '# Security Policies', status: 'created' },
        { fileName: 'demo-strategy.md', content: '# Demo Strategy', status: 'created' },
        { fileName: 'agentify-integration.md', content: '# Agentify Integration', status: 'created' },
      ],
    }),
    retryFiles: vi.fn().mockResolvedValue({
      success: true,
      files: [{ fileName: 'structure.md', content: '# Structure', status: 'created' }],
    }),
    dispose: vi.fn(),
  })),
  resetSteeringGenerationService: vi.fn(),
}));

// Create vscode mock
vi.mock('vscode', () => {
  const createMockStat = vi.fn();
  const createMockReadDirectory = vi.fn();
  const createMockCopy = vi.fn();
  const createMockCreateDirectory = vi.fn();
  const createMockWriteFile = vi.fn();
  const createMockShowQuickPick = vi.fn();

  return {
    EventEmitter: class {
      private listeners: ((data: unknown) => void)[] = [];
      event = (listener: (data: unknown) => void) => {
        this.listeners.push(listener);
        return { dispose: () => {} };
      };
      fire = (data: unknown) => {
        this.listeners.forEach((l) => l(data));
      };
      dispose = vi.fn();
    },
    Uri: {
      file: (path: string) => ({ fsPath: path, path }),
      joinPath: (base: { fsPath: string }, ...parts: string[]) => ({
        fsPath: `${base.fsPath}/${parts.join('/')}`,
        path: `${base.fsPath}/${parts.join('/')}`,
      }),
    },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
      fs: {
        stat: createMockStat,
        readDirectory: createMockReadDirectory,
        copy: createMockCopy,
        createDirectory: createMockCreateDirectory,
        writeFile: createMockWriteFile,
      },
    },
    window: {
      showQuickPick: createMockShowQuickPick,
      showInformationMessage: vi.fn(),
    },
    FileType: {
      File: 1,
      Directory: 2,
    },
    // Export the mock functions for test access
    __test__: {
      mockStat: createMockStat,
      mockReadDirectory: createMockReadDirectory,
      mockCopy: createMockCopy,
      mockCreateDirectory: createMockCreateDirectory,
      mockWriteFile: createMockWriteFile,
      mockShowQuickPick: createMockShowQuickPick,
    },
  };
});

// Import after mocks
import * as vscode from 'vscode';
import {
  SteeringFileService,
  getSteeringFileService,
  resetSteeringFileService,
  type FileProgressEvent,
  type FileCompleteEvent,
  type FileErrorEvent,
} from '../../services/steeringFileService';
import { STEERING_FILES } from '../../types/wizardPanel';

// Type for accessing test mocks
const vscodeMocks = (vscode as unknown as { __test__: {
  mockStat: ReturnType<typeof vi.fn>;
  mockReadDirectory: ReturnType<typeof vi.fn>;
  mockCopy: ReturnType<typeof vi.fn>;
  mockCreateDirectory: ReturnType<typeof vi.fn>;
  mockWriteFile: ReturnType<typeof vi.fn>;
  mockShowQuickPick: ReturnType<typeof vi.fn>;
}}).__test__;

// Mock ExtensionContext for service initialization
const mockContext = {
  extensionUri: { fsPath: '/test/extension' },
  subscriptions: [],
  workspaceState: { get: vi.fn(), update: vi.fn() },
  globalState: { get: vi.fn(), update: vi.fn(), setKeysForSync: vi.fn() },
  extensionPath: '/test/extension',
  storagePath: '/test/storage',
  globalStoragePath: '/test/global-storage',
  logPath: '/test/log',
  extensionMode: 3,
  asAbsolutePath: (path: string) => `/test/extension/${path}`,
} as unknown as vscode.ExtensionContext;

// ============================================================================
// Task Group 1: Conflict Detection & Backup Tests
// ============================================================================

describe('Task Group 1: SteeringFileService Conflict Detection & Backup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSteeringFileService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetSteeringFileService();
  });

  // ---------------------------------------------------------------------------
  // Test 1.1: checkForExistingFiles() returns true when directory exists with files
  // ---------------------------------------------------------------------------
  describe('Test 1.1: checkForExistingFiles() returns true when directory exists with .md files', () => {
    it('should return true when .kiro/steering/ exists with .md files', async () => {
      const service = new SteeringFileService(mockContext);

      // Mock stat to succeed (directory exists)
      vscodeMocks.mockStat.mockResolvedValue({ type: 2 }); // Directory type

      // Mock readDirectory to return .md files
      vscodeMocks.mockReadDirectory.mockResolvedValue([
        ['product.md', 1], // File type
        ['tech.md', 1],
      ]);

      const result = await service.checkForExistingFiles();

      expect(result).toBe(true);
      expect(vscodeMocks.mockStat).toHaveBeenCalled();
      expect(vscodeMocks.mockReadDirectory).toHaveBeenCalled();
    });

    it('should return false when directory does not exist', async () => {
      const service = new SteeringFileService(mockContext);

      // Mock stat to throw (directory doesn't exist)
      vscodeMocks.mockStat.mockRejectedValue(new Error('FileNotFound'));

      const result = await service.checkForExistingFiles();

      expect(result).toBe(false);
    });

    it('should return false when directory exists but has no .md files', async () => {
      const service = new SteeringFileService(mockContext);

      vscodeMocks.mockStat.mockResolvedValue({ type: 2 });
      vscodeMocks.mockReadDirectory.mockResolvedValue([
        ['.gitkeep', 1],
        ['readme.txt', 1],
      ]);

      const result = await service.checkForExistingFiles();

      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 1.2: backupSteeringDirectory() creates timestamped backup folder
  // ---------------------------------------------------------------------------
  describe('Test 1.2: backupSteeringDirectory() creates timestamped backup folder', () => {
    it('should copy directory to timestamped backup location', async () => {
      const service = new SteeringFileService(mockContext);

      vscodeMocks.mockCopy.mockResolvedValue(undefined);

      const backupPath = await service.backupSteeringDirectory();

      expect(vscodeMocks.mockCopy).toHaveBeenCalled();
      expect(backupPath).toContain('.kiro/steering.backup-');
      // Verify timestamp format: YYYY-MM-DDTHHMMSS
      expect(backupPath).toMatch(/steering\.backup-\d{4}-\d{2}-\d{2}T\d{6}/);
    });

    it('should use recursive copy option', async () => {
      const service = new SteeringFileService(mockContext);

      vscodeMocks.mockCopy.mockResolvedValue(undefined);

      await service.backupSteeringDirectory();

      // Verify recursive option was passed
      expect(vscodeMocks.mockCopy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { overwrite: true }
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Test 1.3: showConflictDialog() shows QuickPick with three options
  // ---------------------------------------------------------------------------
  describe('Test 1.3: showConflictDialog() shows QuickPick with three options', () => {
    it('should show QuickPick with Overwrite, Backup & Overwrite, and Cancel options', async () => {
      const service = new SteeringFileService(mockContext);

      vscodeMocks.mockShowQuickPick.mockResolvedValue({ label: 'Overwrite' });

      await service.showConflictDialog();

      expect(vscodeMocks.mockShowQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: 'Overwrite' }),
          expect.objectContaining({ label: 'Backup & Overwrite' }),
          expect.objectContaining({ label: 'Cancel' }),
        ]),
        expect.objectContaining({
          placeHolder: expect.stringContaining('Existing steering files'),
          ignoreFocusOut: true,
        })
      );
    });

    it('should return "overwrite" when user selects Overwrite', async () => {
      const service = new SteeringFileService(mockContext);

      vscodeMocks.mockShowQuickPick.mockResolvedValue({ label: 'Overwrite' });

      const result = await service.showConflictDialog();

      expect(result).toBe('overwrite');
    });

    it('should return "backup" when user selects Backup & Overwrite', async () => {
      const service = new SteeringFileService(mockContext);

      vscodeMocks.mockShowQuickPick.mockResolvedValue({ label: 'Backup & Overwrite' });

      const result = await service.showConflictDialog();

      expect(result).toBe('backup');
    });

    it('should return "cancel" when user selects Cancel', async () => {
      const service = new SteeringFileService(mockContext);

      vscodeMocks.mockShowQuickPick.mockResolvedValue({ label: 'Cancel' });

      const result = await service.showConflictDialog();

      expect(result).toBe('cancel');
    });

    it('should return "cancel" when dialog is dismissed', async () => {
      const service = new SteeringFileService(mockContext);

      vscodeMocks.mockShowQuickPick.mockResolvedValue(undefined);

      const result = await service.showConflictDialog();

      expect(result).toBe('cancel');
    });
  });
});

// ============================================================================
// Task Group 2: File Writing Operations Tests
// ============================================================================

describe('Task Group 2: SteeringFileService File Writing Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSteeringFileService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetSteeringFileService();
  });

  // ---------------------------------------------------------------------------
  // Test 2.1: _ensureSteeringDirectory() creates directory if not exists
  // ---------------------------------------------------------------------------
  describe('Test 2.1: _ensureSteeringDirectory() creates directory', () => {
    it('should create .kiro/steering/ directory', async () => {
      const service = new SteeringFileService(mockContext);

      vscodeMocks.mockCreateDirectory.mockResolvedValue(undefined);

      await service['_ensureSteeringDirectory']();

      expect(vscodeMocks.mockCreateDirectory).toHaveBeenCalled();
    });

    it('should be idempotent - not throw if directory exists', async () => {
      const service = new SteeringFileService(mockContext);

      // First call creates directory
      vscodeMocks.mockCreateDirectory.mockResolvedValue(undefined);
      await service['_ensureSteeringDirectory']();

      // Second call should also succeed
      await expect(service['_ensureSteeringDirectory']()).resolves.not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2.2: _writeSteeringFile() writes UTF-8 content
  // ---------------------------------------------------------------------------
  describe('Test 2.2: _writeSteeringFile() writes UTF-8 content', () => {
    it('should write file with UTF-8 encoding', async () => {
      const service = new SteeringFileService(mockContext);

      vscodeMocks.mockCreateDirectory.mockResolvedValue(undefined);
      vscodeMocks.mockWriteFile.mockResolvedValue(undefined);

      const filePath = await service['_writeSteeringFile']('product.md', '# Product\n\nTest content');

      expect(vscodeMocks.mockWriteFile).toHaveBeenCalled();
      expect(filePath).toContain('.kiro/steering/product.md');
    });

    it('should return full file path after write', async () => {
      const service = new SteeringFileService(mockContext);

      vscodeMocks.mockCreateDirectory.mockResolvedValue(undefined);
      vscodeMocks.mockWriteFile.mockResolvedValue(undefined);

      const filePath = await service['_writeSteeringFile']('tech.md', '# Tech');

      expect(filePath).toContain('/test/workspace/.kiro/steering/tech.md');
    });
  });
});

// ============================================================================
// Task Group 3: Generation Orchestration Tests
// ============================================================================

describe('Task Group 3: SteeringFileService Generation Orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSteeringFileService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetSteeringFileService();
  });

  // ---------------------------------------------------------------------------
  // Test 3.1: Generation aborts if user cancels conflict dialog
  // ---------------------------------------------------------------------------
  describe('Test 3.1: Generation aborts if user cancels conflict dialog', () => {
    it('should not call Bedrock when user cancels', async () => {
      const service = new SteeringFileService(mockContext);

      // Mock existing files
      vscodeMocks.mockStat.mockResolvedValue({ type: 2 });
      vscodeMocks.mockReadDirectory.mockResolvedValue([['product.md', 1]]);

      // User cancels
      vscodeMocks.mockShowQuickPick.mockResolvedValue({ label: 'Cancel' });

      const wizardState = createMinimalWizardState();

      const result = await service.generateSteeringFiles(wizardState);

      expect(result.cancelled).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3.2: Backup is created before generation when selected
  // ---------------------------------------------------------------------------
  describe('Test 3.2: Backup is created before generation when selected', () => {
    it('should create backup when user selects Backup & Overwrite', async () => {
      const service = new SteeringFileService(mockContext);

      // Mock existing files
      vscodeMocks.mockStat.mockResolvedValue({ type: 2 });
      vscodeMocks.mockReadDirectory.mockResolvedValue([['product.md', 1]]);

      // User selects backup
      vscodeMocks.mockShowQuickPick.mockResolvedValue({ label: 'Backup & Overwrite' });
      vscodeMocks.mockCopy.mockResolvedValue(undefined);
      vscodeMocks.mockCreateDirectory.mockResolvedValue(undefined);
      vscodeMocks.mockWriteFile.mockResolvedValue(undefined);

      const wizardState = createMinimalWizardState();

      const result = await service.generateSteeringFiles(wizardState);

      // Verify backup was created
      expect(vscodeMocks.mockCopy).toHaveBeenCalled();
      expect(result.backupPath).toContain('steering.backup-');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3.3: Complete generation flow emits events
  // ---------------------------------------------------------------------------
  describe('Test 3.3: Complete generation flow emits events', () => {
    it('should emit onFileComplete events with file paths', async () => {
      const service = new SteeringFileService(mockContext);
      const completeEvents: FileCompleteEvent[] = [];

      service.onFileComplete((event) => {
        completeEvents.push(event);
      });

      // Mock no existing files
      vscodeMocks.mockStat.mockRejectedValue(new Error('FileNotFound'));
      vscodeMocks.mockCreateDirectory.mockResolvedValue(undefined);
      vscodeMocks.mockWriteFile.mockResolvedValue(undefined);

      const wizardState = createMinimalWizardState();

      await service.generateSteeringFiles(wizardState);

      // Check that events were emitted with file paths
      expect(completeEvents.length).toBe(STEERING_FILES.length);
      completeEvents.forEach((event) => {
        expect(event.filePath).toContain('.kiro/steering/');
        expect(event.filePath).toContain('.md');
      });
    });
  });
});

// ============================================================================
// Singleton Pattern and Dispose Tests
// ============================================================================

describe('Singleton and disposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSteeringFileService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetSteeringFileService();
  });

  it('getSteeringFileService should return singleton instance', () => {
    const service1 = getSteeringFileService(mockContext);
    const service2 = getSteeringFileService();

    expect(service1).toBe(service2);
  });

  it('resetSteeringFileService should dispose and clear instance', () => {
    const service = getSteeringFileService(mockContext);
    resetSteeringFileService();
    const newService = getSteeringFileService(mockContext);

    expect(newService).not.toBe(service);
  });

  it('dispose should clean up event emitters', () => {
    const service = new SteeringFileService(mockContext);
    service.dispose();

    // Should not throw when called after dispose
    expect(() => service.dispose()).not.toThrow();
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

function createMinimalWizardState() {
  return {
    currentStep: 8,
    businessObjective: 'Test',
    industry: 'Retail',
    systems: ['SAP'],
    aiGapFillingState: {
      confirmedAssumptions: [],
      assumptionsAccepted: true,
      conversationHistory: [],
      isStreaming: false,
    },
    outcome: {
      primaryOutcome: 'Test',
      successMetrics: [],
      stakeholders: [],
      isLoading: false,
      primaryOutcomeEdited: false,
      metricsEdited: false,
      stakeholdersEdited: false,
      customStakeholders: [],
      suggestionsAccepted: true,
      refinedSections: { outcome: false, kpis: false, stakeholders: false },
    },
    security: {
      dataSensitivity: 'internal' as const,
      complianceFrameworks: [],
      approvalGates: [],
      guardrailNotes: '',
      skipped: false,
    },
    agentDesign: {
      confirmedAgents: [{
        id: 'test',
        name: 'Test',
        role: 'Test',
        tools: [],
        nameEdited: false,
        roleEdited: false,
        toolsEdited: false,
      }],
      confirmedOrchestration: 'workflow' as const,
      confirmedEdges: [],
      proposedAgents: [],
      proposedOrchestration: 'workflow' as const,
      proposedEdges: [],
      orchestrationReasoning: '',
      proposalAccepted: true,
      isLoading: false,
      aiCalled: true,
      originalOrchestration: 'workflow' as const,
    },
    mockData: {
      mockDefinitions: [],
      useCustomerTerminology: false,
      isLoading: false,
      aiCalled: false,
    },
    demoStrategy: {
      ahaMoments: [],
      persona: { name: '', role: '', painPoint: '' },
      narrativeScenes: [],
      isGeneratingMoments: false,
      isGeneratingPersona: false,
      isGeneratingNarrative: false,
      momentsEdited: false,
      personaEdited: false,
      narrativeEdited: false,
    },
    generation: {
      isGenerating: false,
      currentFileIndex: -1,
      completedFiles: [],
      generatedFilePaths: [],
      accordionExpanded: false,
      canGenerate: true,
    },
    highestStepReached: 8,
    validationAttempted: false,
  };
}
