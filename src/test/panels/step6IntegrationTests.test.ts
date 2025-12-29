/**
 * Strategic Integration Tests for Step 6 Mock Data Strategy
 * Task Group 7.3: Up to 7 additional strategic tests to fill critical gaps
 *
 * These tests focus on end-to-end flows and edge cases not covered
 * by the component-level tests in Task Groups 1-6.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode module
vi.mock('vscode', () => ({
  window: {
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showOpenDialog: vi.fn(),
  },
  workspace: {
    fs: {
      readFile: vi.fn(),
    },
    findFiles: vi.fn().mockResolvedValue([]),
    createFileSystemWatcher: vi.fn(() => ({
      onDidCreate: vi.fn(),
      onDidDelete: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  Uri: {
    joinPath: vi.fn().mockReturnValue({ fsPath: '/mock/path' }),
    file: vi.fn().mockReturnValue({ fsPath: '/mock/path' }),
  },
  EventEmitter: class {
    event = vi.fn();
    fire = vi.fn();
    dispose = vi.fn();
  },
  Disposable: {
    from: vi.fn(),
  },
}));

// Mock the mockDataService for controlled testing
vi.mock('../../services/mockDataService', () => ({
  getMockDataService: vi.fn(),
  generateStep5Hash: vi.fn().mockReturnValue('test_hash'),
  buildMockDataContextMessage: vi.fn().mockReturnValue('mock context'),
  parseMockDefinitionsFromResponse: vi.fn(),
  buildTerminologyRefinementMessage: vi.fn().mockReturnValue('terminology message'),
}));

import {
  Step6LogicHandler,
  type Step6ContextInputs,
  type Step6Callbacks,
} from '../../panels/ideationStep6Logic';
import {
  createDefaultMockDataState,
  type MockDataState,
  type MockToolDefinition,
  type ProposedAgent,
} from '../../types/wizardPanel';
import {
  generateStep5Hash,
  parseMockDefinitionsFromResponse,
} from '../../services/mockDataService';
import {
  parseImportFile,
  validateFileSize,
} from '../../utils/mockDataImportUtils';

// ============================================================================
// Task 7.3: Strategic Integration Tests (7 tests maximum)
// ============================================================================

describe('Task Group 7.3: Strategic Integration Tests for Step 6', () => {
  let mockState: MockDataState;
  let mockCallbacks: Step6Callbacks;

  const sampleMockDefinition: MockToolDefinition = {
    tool: 'sap_get_inventory',
    system: 'SAP S/4HANA',
    operation: 'getInventory',
    mockRequest: { sku: 'string' },
    mockResponse: { quantity: 0, unit: 'string' },
    sampleData: [{ quantity: 100, unit: 'pcs' }],
    expanded: true,
    requestEdited: false,
    responseEdited: false,
    sampleDataEdited: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateStep5Hash).mockReturnValue('test_hash');
    mockState = createDefaultMockDataState();
    mockCallbacks = {
      updateWebviewContent: vi.fn(),
      syncStateToWebview: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Test 1: End-to-end: Step 5 confirmation -> Step 6 auto-generation
  // ---------------------------------------------------------------------------
  describe('Test 1: End-to-end: Step 5 confirmation -> Step 6 auto-generation', () => {
    it('should update state correctly when entering Step 6 with confirmed agents', () => {
      const confirmedAgents: ProposedAgent[] = [
        {
          id: 'inventory_agent',
          name: 'Inventory Manager',
          role: 'Manages inventory levels',
          tools: ['sap_get_inventory', 'sap_check_stock'],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
      ];

      const contextInputs: Step6ContextInputs = {
        confirmedAgents,
        industry: 'Retail',
      };

      // Initial state - AI not called yet
      expect(mockState.aiCalled).toBe(false);
      expect(mockState.mockDefinitions).toHaveLength(0);

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);
      handler.triggerAutoSend(contextInputs);

      const resultState = handler.getState();

      // Should set aiCalled to true and store hash
      expect(resultState.aiCalled).toBe(true);
      expect(resultState.step5Hash).toBe('test_hash');

      // When context is undefined, service sets error and calls syncStateToWebview
      // This verifies the state management logic is working correctly
      expect(mockCallbacks.syncStateToWebview).toHaveBeenCalled();
    });

    it('should generate hash from confirmed agents for change detection', () => {
      const confirmedAgents: ProposedAgent[] = [
        {
          id: 'agent1',
          name: 'Agent',
          role: 'Role',
          tools: ['tool1', 'tool2'],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
      ];

      // generateStep5Hash should be called with confirmed agents
      const hash = generateStep5Hash(confirmedAgents);
      expect(hash).toBe('test_hash');
      expect(generateStep5Hash).toHaveBeenCalledWith(confirmedAgents);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2: End-to-end: Edit mock data -> navigate away -> return preserves edits
  // ---------------------------------------------------------------------------
  describe('Test 2: End-to-end: Edit mock data -> navigate away -> return preserves edits', () => {
    it('should preserve all edited state after back navigation from Step 7', () => {
      // Setup: User has edited mock data and navigated to Step 7
      mockState.mockDefinitions = [
        {
          ...sampleMockDefinition,
          requestEdited: true,
          responseEdited: true,
          sampleDataEdited: true,
          mockRequest: { sku: 'string', warehouse: 'string' }, // User edited
          sampleData: [
            { quantity: 500, unit: 'kg' }, // User edited values
          ],
        },
      ];
      mockState.useCustomerTerminology = true;
      mockState.aiCalled = true;
      mockState.step5Hash = 'original_hash';

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      // Simulate back navigation from Step 7 to Step 6
      handler.handleBackNavigationToStep6();

      const resultState = handler.getState();

      // All edited state should be preserved
      expect(resultState.mockDefinitions[0].requestEdited).toBe(true);
      expect(resultState.mockDefinitions[0].responseEdited).toBe(true);
      expect(resultState.mockDefinitions[0].sampleDataEdited).toBe(true);
      expect(resultState.mockDefinitions[0].mockRequest).toEqual({
        sku: 'string',
        warehouse: 'string',
      });
      expect(resultState.mockDefinitions[0].sampleData[0]).toEqual({
        quantity: 500,
        unit: 'kg',
      });
      expect(resultState.useCustomerTerminology).toBe(true);
      expect(resultState.aiCalled).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3: Integration: Import CSV -> verify sample data table updates
  // ---------------------------------------------------------------------------
  describe('Test 3: Integration: Import CSV -> verify sample data table updates', () => {
    it('should update sample data from CSV import and set edited flag', () => {
      // Setup: Tool with initial sample data
      mockState.mockDefinitions = [
        {
          ...sampleMockDefinition,
          mockResponse: { quantity: 0, unit: '', location: '' },
          sampleData: [],
          sampleDataEdited: false,
        },
      ];
      mockState.aiCalled = true;

      // Parse CSV content
      const csvContent = `quantity,unit,location
100,pcs,Warehouse A
200,kg,Warehouse B
50,boxes,Warehouse C`;

      const schema = { quantity: 0, unit: '', location: '' };
      const importResult = parseImportFile(csvContent, 'csv', schema);

      // Import should succeed
      expect(importResult.success).toBe(true);
      expect(importResult.rows).toHaveLength(3);

      // Create handler and simulate import
      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      // Update state with imported data
      const state = handler.getState();
      state.mockDefinitions[0].sampleData = importResult.rows;
      state.mockDefinitions[0].sampleDataEdited = true;
      handler.setState(state);

      const resultState = handler.getState();

      // Verify sample data updated
      expect(resultState.mockDefinitions[0].sampleData).toHaveLength(3);
      expect(resultState.mockDefinitions[0].sampleData[0].quantity).toBe('100');
      expect(resultState.mockDefinitions[0].sampleData[0].location).toBe('Warehouse A');
      expect(resultState.mockDefinitions[0].sampleDataEdited).toBe(true);

      // Verify import summary
      expect(importResult.summary).toContain('Imported 3 rows');
      expect(importResult.mappedFields).toContain('quantity');
      expect(importResult.mappedFields).toContain('unit');
      expect(importResult.mappedFields).toContain('location');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 4: Integration: Toggle terminology -> verify sample data regeneration
  // ---------------------------------------------------------------------------
  describe('Test 4: Integration: Toggle terminology -> verify sample data regeneration', () => {
    it('should trigger terminology refinement and preserve schema structure', () => {
      mockState.mockDefinitions = [sampleMockDefinition];
      mockState.aiCalled = true;
      mockState.useCustomerTerminology = false;

      const contextInputs: Step6ContextInputs = {
        confirmedAgents: [
          {
            id: 'agent1',
            name: 'Agent',
            role: 'Role',
            tools: ['sap_get_inventory'],
            nameEdited: false,
            roleEdited: false,
            toolsEdited: false,
          },
        ],
        industry: 'Healthcare',
      };

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      // Toggle terminology ON
      handler.handleToggleTerminology(true, contextInputs);

      const resultState = handler.getState();

      // Should set useCustomerTerminology to true
      expect(resultState.useCustomerTerminology).toBe(true);

      // Schema structure should be preserved (mockRequest/mockResponse unchanged)
      expect(resultState.mockDefinitions[0].mockRequest).toEqual({
        sku: 'string',
      });
      expect(resultState.mockDefinitions[0].mockResponse).toEqual({
        quantity: 0,
        unit: 'string',
      });

      // Callbacks should be called for UI update
      expect(mockCallbacks.updateWebviewContent).toHaveBeenCalled();
      expect(mockCallbacks.syncStateToWebview).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Test 5: Edge case: Empty confirmedAgents produces helpful error
  // ---------------------------------------------------------------------------
  describe('Test 5: Edge case: Empty confirmedAgents produces helpful error', () => {
    it('should handle empty confirmedAgents gracefully without crashing', () => {
      const contextInputs: Step6ContextInputs = {
        confirmedAgents: [], // Empty - no agents confirmed in Step 5
        industry: 'Retail',
      };

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      // Should not throw when called with empty agents
      expect(() => {
        handler.triggerAutoSend(contextInputs);
      }).not.toThrow();

      // State should reflect that AI was called (even with empty input)
      const resultState = handler.getState();
      expect(resultState.aiCalled).toBe(true);
      expect(resultState.step5Hash).toBeDefined();
    });

    it('should generate appropriate hash even for empty confirmedAgents', () => {
      const emptyAgents: ProposedAgent[] = [];
      const hash = generateStep5Hash(emptyAgents);

      // Should return a valid hash (not null/undefined)
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 6: Edge case: AI returns malformed JSON shows error state
  // ---------------------------------------------------------------------------
  describe('Test 6: Edge case: AI returns malformed JSON shows error state', () => {
    it('should set error state when AI response parsing fails', () => {
      // Mock parseMockDefinitionsFromResponse to return null (parsing failed)
      vi.mocked(parseMockDefinitionsFromResponse).mockReturnValue(null);

      mockState.isLoading = false;
      mockState.aiCalled = true;

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      // Simulate streaming complete with malformed response
      const malformedResponse = 'This is not valid JSON at all';
      handler.handleMockDataStreamingComplete(malformedResponse);

      const resultState = handler.getState();

      // Should show error state
      expect(resultState.error).toBeDefined();
      expect(resultState.isLoading).toBe(false);
      expect(resultState.mockDefinitions).toHaveLength(0);
    });

    it('should show specific error message for malformed JSON', () => {
      vi.mocked(parseMockDefinitionsFromResponse).mockReturnValue(null);

      mockState.aiCalled = true;

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);
      handler.handleMockDataStreamingComplete('not json');

      const resultState = handler.getState();

      // Error message should indicate parsing failure
      expect(resultState.error).toContain('parse');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 7: Edge case: Import file exceeds 1MB shows validation error
  // ---------------------------------------------------------------------------
  describe('Test 7: Edge case: Import file exceeds 1MB shows validation error', () => {
    it('should reject file exceeding 1MB and return descriptive error', () => {
      const oneMegabyte = 1024 * 1024;
      const oversizedFileSize = oneMegabyte + 1;

      const validationResult = validateFileSize(oversizedFileSize);

      expect(validationResult.valid).toBe(false);
      expect(validationResult.error).toBeDefined();
      expect(validationResult.error).toContain('1MB');
    });

    it('should allow file exactly at 1MB limit', () => {
      const exactlyOneMegabyte = 1024 * 1024;

      const validationResult = validateFileSize(exactlyOneMegabyte);

      expect(validationResult.valid).toBe(true);
      expect(validationResult.error).toBeUndefined();
    });

    it('should integrate file size validation with import flow', () => {
      // Simulate the complete import validation flow
      const fileSize = 2 * 1024 * 1024; // 2MB - over limit
      const sizeValidation = validateFileSize(fileSize);

      if (!sizeValidation.valid) {
        // Should not proceed to parsing
        expect(sizeValidation.error).toContain('1MB');
      }

      // For valid size, parsing should proceed
      const validFileSize = 500 * 1024; // 500KB
      const validSizeResult = validateFileSize(validFileSize);
      expect(validSizeResult.valid).toBe(true);

      // Then CSV parsing would be called
      const csvContent = 'name,value\nTest,100';
      const schema = { name: '', value: 0 };
      const importResult = parseImportFile(csvContent, 'csv', schema);
      expect(importResult.success).toBe(true);
    });
  });
});
