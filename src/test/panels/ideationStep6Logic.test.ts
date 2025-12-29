/**
 * Tests for Step 6: Mock Data Strategy Logic Handler
 * Task Group 3: Step 6 Logic Handler
 *
 * Tests the Step6LogicHandler class that orchestrates mock data generation
 * and editing functionality for the Ideation Wizard Step 6.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode module before importing the logic handler
vi.mock('vscode', () => ({
  default: {
    EventEmitter: class {
      event = vi.fn();
      fire = vi.fn();
      dispose = vi.fn();
    },
  },
  EventEmitter: class {
    event = vi.fn();
    fire = vi.fn();
    dispose = vi.fn();
  },
}));

// Mock the mockDataService to prevent actual API calls
vi.mock('../../services/mockDataService', () => ({
  getMockDataService: vi.fn(),
  generateStep5Hash: vi.fn().mockReturnValue('test_hash_123'),
  buildMockDataContextMessage: vi.fn().mockReturnValue('test context message'),
  parseMockDefinitionsFromResponse: vi.fn().mockReturnValue([
    {
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
    },
  ]),
  buildTerminologyRefinementMessage: vi.fn().mockReturnValue('terminology refinement message'),
}));

// Import types and logic handler after mocks
import {
  Step6LogicHandler,
  type Step6ContextInputs,
  type Step6Callbacks,
} from '../../panels/ideationStep6Logic';
import {
  createDefaultMockDataState,
  type MockDataState,
  type MockToolDefinition,
} from '../../types/wizardPanel';
import { generateStep5Hash } from '../../services/mockDataService';

// ============================================================================
// Task 3.1: 6 Focused Tests for Step6LogicHandler
// ============================================================================

describe('Task Group 3: Step 6 Logic Handler', () => {
  // Common test fixtures
  let mockState: MockDataState;
  let mockCallbacks: Step6Callbacks;

  const sampleContextInputs: Step6ContextInputs = {
    confirmedAgents: [
      {
        id: 'inventory_agent',
        name: 'Inventory Manager',
        role: 'Manages inventory',
        tools: ['sap_get_inventory', 'sap_check_stock'],
        nameEdited: false,
        roleEdited: false,
        toolsEdited: false,
      },
    ],
    industry: 'Retail',
  };

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
    // Reset mock return value after clearAllMocks
    vi.mocked(generateStep5Hash).mockReturnValue('test_hash_123');

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
  // Test 1: triggerAutoSend() triggers AI when aiCalled is false
  // ---------------------------------------------------------------------------
  describe('Test 1: triggerAutoSend() triggers AI when aiCalled is false', () => {
    it('should not re-trigger AI if aiCalled is true and hash unchanged', () => {
      // Setup state where AI was already called with matching hash
      mockState.aiCalled = true;
      mockState.step5Hash = 'test_hash_123';
      mockState.isLoading = false;

      // Pass undefined context so no service is initialized
      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      handler.triggerAutoSend(sampleContextInputs);

      // Should remain unchanged since hash matches and AI already called
      expect(handler.getState().isLoading).toBe(false);
      expect(handler.getState().aiCalled).toBe(true);
    });

    it('should detect when AI needs to be called based on aiCalled flag', () => {
      // Verify initial state indicates AI should be called
      expect(mockState.aiCalled).toBe(false);
      expect(mockState.isLoading).toBe(false);
      expect(mockState.step5Hash).toBeUndefined();

      // The handler with no context will set error state rather than loading
      // This tests the state management logic
      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);
      handler.triggerAutoSend(sampleContextInputs);

      // With no context, error should be set (service not available)
      const state = handler.getState();
      expect(state.step5Hash).toBe('test_hash_123');
      expect(state.aiCalled).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2: triggerAutoSend() re-triggers when step5Hash changes
  // ---------------------------------------------------------------------------
  describe('Test 2: triggerAutoSend() re-triggers when step5Hash changes', () => {
    it('should reset state when hash changes', () => {
      // Set up state with previous hash and existing definitions
      mockState.aiCalled = true;
      mockState.step5Hash = 'old_hash';
      mockState.mockDefinitions = [sampleMockDefinition];
      mockState.useCustomerTerminology = true;

      // Mock different hash for new inputs
      vi.mocked(generateStep5Hash).mockReturnValue('new_hash');

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);
      handler.triggerAutoSend(sampleContextInputs);

      const state = handler.getState();
      // Should have reset state
      expect(state.step5Hash).toBe('new_hash');
      expect(state.mockDefinitions).toEqual([]);
      expect(state.useCustomerTerminology).toBe(false);
    });

    it('should clear existing mock definitions when hash changes', () => {
      mockState.aiCalled = true;
      mockState.step5Hash = 'old_hash';
      mockState.mockDefinitions = [sampleMockDefinition];

      vi.mocked(generateStep5Hash).mockReturnValue('different_hash');

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);
      handler.triggerAutoSend(sampleContextInputs);

      expect(handler.getState().mockDefinitions).toEqual([]);
    });

    it('should update step5Hash to new value', () => {
      mockState.aiCalled = true;
      mockState.step5Hash = 'original_hash';

      vi.mocked(generateStep5Hash).mockReturnValue('updated_hash');

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);
      handler.triggerAutoSend(sampleContextInputs);

      expect(handler.getState().step5Hash).toBe('updated_hash');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3: handleRegenerateAll() resets state and calls AI
  // ---------------------------------------------------------------------------
  describe('Test 3: handleRegenerateAll() resets state and calls AI', () => {
    it('should reset mockDefinitions to empty array', () => {
      mockState.mockDefinitions = [sampleMockDefinition];
      mockState.aiCalled = true;
      mockState.step5Hash = 'test_hash_123';

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);
      handler.handleRegenerateAll(sampleContextInputs);

      expect(handler.getState().mockDefinitions).toEqual([]);
    });

    it('should preserve step5Hash during regeneration', () => {
      mockState.step5Hash = 'existing_hash';
      mockState.aiCalled = true;
      mockState.mockDefinitions = [sampleMockDefinition];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);
      handler.handleRegenerateAll(sampleContextInputs);

      expect(handler.getState().step5Hash).toBe('existing_hash');
    });

    it('should reset useCustomerTerminology to false', () => {
      mockState.useCustomerTerminology = true;
      mockState.mockDefinitions = [sampleMockDefinition];
      mockState.aiCalled = true;

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);
      handler.handleRegenerateAll(sampleContextInputs);

      expect(handler.getState().useCustomerTerminology).toBe(false);
    });

    it('should set aiCalled to true after regenerate', () => {
      mockState.aiCalled = false;

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);
      handler.handleRegenerateAll(sampleContextInputs);

      expect(handler.getState().aiCalled).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 4: handleUpdateMockRequest() sets requestEdited flag
  // ---------------------------------------------------------------------------
  describe('Test 4: handleUpdateMockRequest() sets requestEdited flag', () => {
    it('should update mockRequest and set requestEdited flag', () => {
      mockState.mockDefinitions = [{ ...sampleMockDefinition }];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      const newRequest = JSON.stringify({ sku: 'string', warehouse: 'string' });
      handler.handleUpdateMockRequest(0, newRequest);

      const state = handler.getState();
      expect(state.mockDefinitions[0].requestEdited).toBe(true);
      expect(state.mockDefinitions[0].mockRequest).toEqual({
        sku: 'string',
        warehouse: 'string',
      });
    });

    it('should call updateWebviewContent and syncStateToWebview', () => {
      mockState.mockDefinitions = [{ ...sampleMockDefinition }];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      handler.handleUpdateMockRequest(0, '{"test": "value"}');

      expect(mockCallbacks.updateWebviewContent).toHaveBeenCalled();
      expect(mockCallbacks.syncStateToWebview).toHaveBeenCalled();
    });

    it('should handle invalid JSON gracefully by not updating', () => {
      mockState.mockDefinitions = [{ ...sampleMockDefinition }];
      const originalRequest = { ...sampleMockDefinition.mockRequest };

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      handler.handleUpdateMockRequest(0, 'invalid json');

      // Original should be preserved
      expect(handler.getState().mockDefinitions[0].mockRequest).toEqual(
        originalRequest
      );
      // requestEdited should remain false (no update happened)
      expect(handler.getState().mockDefinitions[0].requestEdited).toBe(false);
    });

    it('should handle out of bounds index gracefully', () => {
      mockState.mockDefinitions = [{ ...sampleMockDefinition }];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      // Should not throw
      handler.handleUpdateMockRequest(5, '{"test": "value"}');
      handler.handleUpdateMockRequest(-1, '{"test": "value"}');

      // State should be unchanged
      expect(handler.getState().mockDefinitions[0].requestEdited).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 5: handleToggleTerminology() triggers refinement request
  // ---------------------------------------------------------------------------
  describe('Test 5: handleToggleTerminology() triggers refinement request', () => {
    it('should set useCustomerTerminology flag to true when enabled', () => {
      mockState.mockDefinitions = [{ ...sampleMockDefinition }];
      mockState.aiCalled = true;

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      handler.handleToggleTerminology(true, sampleContextInputs);

      expect(handler.getState().useCustomerTerminology).toBe(true);
    });

    it('should set useCustomerTerminology flag to false when disabled', () => {
      mockState.mockDefinitions = [{ ...sampleMockDefinition }];
      mockState.useCustomerTerminology = true;

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      handler.handleToggleTerminology(false, sampleContextInputs);

      expect(handler.getState().useCustomerTerminology).toBe(false);
    });

    it('should not trigger refinement when no definitions exist', () => {
      mockState.mockDefinitions = [];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      handler.handleToggleTerminology(true, sampleContextInputs);

      // Should set flag but not trigger loading (no definitions to refine)
      expect(handler.getState().useCustomerTerminology).toBe(true);
      expect(handler.getState().isLoading).toBe(false);
    });

    it('should call callbacks when toggling', () => {
      mockState.mockDefinitions = [{ ...sampleMockDefinition }];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      handler.handleToggleTerminology(true, sampleContextInputs);

      expect(mockCallbacks.updateWebviewContent).toHaveBeenCalled();
      expect(mockCallbacks.syncStateToWebview).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Test 6: getValidationWarnings() returns correct warnings
  // ---------------------------------------------------------------------------
  describe('Test 6: getValidationWarnings() returns correct warnings', () => {
    it('should return warning if tool has empty sampleData array', () => {
      mockState.mockDefinitions = [
        {
          ...sampleMockDefinition,
          sampleData: [],
        },
      ];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      const warnings = handler.getValidationWarnings();

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain('sap_get_inventory');
      expect(warnings[0]).toContain('no sample data');
    });

    it('should return warning if mockRequest is empty object', () => {
      mockState.mockDefinitions = [
        {
          ...sampleMockDefinition,
          mockRequest: {},
        },
      ];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      const warnings = handler.getValidationWarnings();

      expect(warnings.some((w) => w.includes('empty') && w.includes('Request'))).toBe(
        true
      );
    });

    it('should return warning if mockResponse is empty object', () => {
      mockState.mockDefinitions = [
        {
          ...sampleMockDefinition,
          mockResponse: {},
        },
      ];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      const warnings = handler.getValidationWarnings();

      expect(
        warnings.some((w) => w.includes('empty') && w.includes('Response'))
      ).toBe(true);
    });

    it('should return empty array when all definitions are valid', () => {
      mockState.mockDefinitions = [sampleMockDefinition];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      const warnings = handler.getValidationWarnings();

      expect(warnings).toHaveLength(0);
    });

    it('should return multiple warnings for multiple issues', () => {
      mockState.mockDefinitions = [
        {
          ...sampleMockDefinition,
          sampleData: [],
          mockRequest: {},
        },
        {
          ...sampleMockDefinition,
          tool: 'another_tool',
          sampleData: [],
        },
      ];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      const warnings = handler.getValidationWarnings();

      expect(warnings.length).toBeGreaterThan(1);
    });

    it('should return empty array when no definitions exist', () => {
      mockState.mockDefinitions = [];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      const warnings = handler.getValidationWarnings();

      expect(warnings).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Additional supporting tests for completeness
  // ---------------------------------------------------------------------------
  describe('Mock definition editing methods', () => {
    it('handleUpdateMockResponse() should set responseEdited flag', () => {
      mockState.mockDefinitions = [{ ...sampleMockDefinition }];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      handler.handleUpdateMockResponse(0, '{"result": "success"}');

      expect(handler.getState().mockDefinitions[0].responseEdited).toBe(true);
    });

    it('handleToggleAccordion() should toggle expanded state', () => {
      mockState.mockDefinitions = [{ ...sampleMockDefinition, expanded: true }];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      handler.handleToggleAccordion(0);

      expect(handler.getState().mockDefinitions[0].expanded).toBe(false);
    });

    it('handleToggleAccordion() should toggle from false to true', () => {
      mockState.mockDefinitions = [{ ...sampleMockDefinition, expanded: false }];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      handler.handleToggleAccordion(0);

      expect(handler.getState().mockDefinitions[0].expanded).toBe(true);
    });
  });

  describe('Sample data editing methods', () => {
    it('handleAddSampleRow() should add row up to max 5', () => {
      mockState.mockDefinitions = [
        { ...sampleMockDefinition, sampleData: [{ quantity: 100 }] },
      ];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      const result = handler.handleAddSampleRow(0);

      expect(result).toBe(true);
      expect(handler.getState().mockDefinitions[0].sampleData).toHaveLength(2);
    });

    it('handleAddSampleRow() should set sampleDataEdited flag', () => {
      mockState.mockDefinitions = [{ ...sampleMockDefinition }];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      handler.handleAddSampleRow(0);

      expect(handler.getState().mockDefinitions[0].sampleDataEdited).toBe(true);
    });

    it('handleAddSampleRow() should not add beyond 5 rows', () => {
      mockState.mockDefinitions = [
        {
          ...sampleMockDefinition,
          sampleData: [{}, {}, {}, {}, {}], // Already 5 rows
        },
      ];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      const result = handler.handleAddSampleRow(0);

      expect(result).toBe(false);
      expect(handler.getState().mockDefinitions[0].sampleData).toHaveLength(5);
    });

    it('handleUpdateSampleRow() should set sampleDataEdited flag', () => {
      mockState.mockDefinitions = [{ ...sampleMockDefinition }];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      handler.handleUpdateSampleRow(0, 0, { quantity: 200 });

      expect(handler.getState().mockDefinitions[0].sampleDataEdited).toBe(true);
    });

    it('handleUpdateSampleRow() should update the row data', () => {
      mockState.mockDefinitions = [{ ...sampleMockDefinition }];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      handler.handleUpdateSampleRow(0, 0, { quantity: 500, unit: 'kg' });

      expect(handler.getState().mockDefinitions[0].sampleData[0]).toEqual({
        quantity: 500,
        unit: 'kg',
      });
    });

    it('handleDeleteSampleRow() should remove the row', () => {
      mockState.mockDefinitions = [
        {
          ...sampleMockDefinition,
          sampleData: [{ a: 1 }, { b: 2 }, { c: 3 }],
        },
      ];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      handler.handleDeleteSampleRow(0, 1);

      const data = handler.getState().mockDefinitions[0].sampleData;
      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({ a: 1 });
      expect(data[1]).toEqual({ c: 3 });
    });

    it('handleDeleteSampleRow() should set sampleDataEdited flag', () => {
      mockState.mockDefinitions = [
        {
          ...sampleMockDefinition,
          sampleData: [{ a: 1 }, { b: 2 }],
        },
      ];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      handler.handleDeleteSampleRow(0, 0);

      expect(handler.getState().mockDefinitions[0].sampleDataEdited).toBe(true);
    });
  });

  describe('State management', () => {
    it('setState() should update the internal state reference', () => {
      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      const newState = createDefaultMockDataState();
      newState.mockDefinitions = [sampleMockDefinition];
      newState.aiCalled = true;

      handler.setState(newState);

      expect(handler.getState()).toBe(newState);
      expect(handler.getState().mockDefinitions).toHaveLength(1);
    });

    it('getState() should return current state', () => {
      mockState.mockDefinitions = [sampleMockDefinition];

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      expect(handler.getState()).toBe(mockState);
    });
  });

  describe('Back navigation handling', () => {
    it('handleBackNavigationToStep6() should preserve state and call callbacks', () => {
      mockState.mockDefinitions = [sampleMockDefinition];
      mockState.aiCalled = true;
      mockState.useCustomerTerminology = true;

      const handler = new Step6LogicHandler(undefined, mockState, mockCallbacks);

      handler.handleBackNavigationToStep6();

      // State should be preserved
      expect(handler.getState().mockDefinitions).toHaveLength(1);
      expect(handler.getState().aiCalled).toBe(true);
      expect(handler.getState().useCustomerTerminology).toBe(true);

      // Callbacks should be called
      expect(mockCallbacks.updateWebviewContent).toHaveBeenCalled();
      expect(mockCallbacks.syncStateToWebview).toHaveBeenCalled();
    });
  });
});
