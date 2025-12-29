/**
 * Tests for Step 6 Mock Data Strategy - Type Definitions and State Structure
 * Task Group 1: Type definitions for Step 6 Mock Data Strategy feature
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultMockDataState,
  WIZARD_COMMANDS,
  type MockToolDefinition,
  type MockDataState,
} from '../../types/wizardPanel';

// ============================================================================
// Task 1.1: 4 Focused Tests for Type Definitions
// ============================================================================

describe('Task Group 1: Step 6 Mock Data - Type Definitions and State Structure', () => {
  describe('Test 1: MockDataState initialization with default values', () => {
    it('should initialize MockDataState with correct defaults', () => {
      const state = createDefaultMockDataState();

      // Verify mockDefinitions is empty array
      expect(state.mockDefinitions).toEqual([]);

      // Verify useCustomerTerminology is false
      expect(state.useCustomerTerminology).toBe(false);

      // Verify loading/error state
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeUndefined();

      // Verify change detection fields
      expect(state.step5Hash).toBeUndefined();
      expect(state.aiCalled).toBe(false);
    });
  });

  describe('Test 2: MockToolDefinition structure validation', () => {
    it('should support all required fields on MockToolDefinition interface', () => {
      // Create a mock tool definition with all fields
      const mockTool: MockToolDefinition = {
        tool: 'sap_get_inventory',
        system: 'SAP S/4HANA',
        operation: 'getInventory',
        mockRequest: { sku: 'string', warehouse: 'string' },
        mockResponse: { quantity: 0, unit: 'string', location: 'string' },
        sampleData: [
          { quantity: 100, unit: 'pcs', location: 'WH-001' },
          { quantity: 50, unit: 'pcs', location: 'WH-002' },
        ],
        expanded: true,
        requestEdited: false,
        responseEdited: false,
        sampleDataEdited: false,
      };

      // Verify all fields exist with correct types
      expect(mockTool.tool).toBe('sap_get_inventory');
      expect(mockTool.system).toBe('SAP S/4HANA');
      expect(mockTool.operation).toBe('getInventory');
      expect(mockTool.mockRequest).toBeInstanceOf(Object);
      expect(mockTool.mockResponse).toBeInstanceOf(Object);
      expect(mockTool.sampleData).toBeInstanceOf(Array);
      expect(mockTool.expanded).toBe(true);
      expect(mockTool.requestEdited).toBe(false);
      expect(mockTool.responseEdited).toBe(false);
      expect(mockTool.sampleDataEdited).toBe(false);

      // Test that edited flags can be set to true
      const editedMockTool: MockToolDefinition = {
        ...mockTool,
        requestEdited: true,
        responseEdited: true,
        sampleDataEdited: true,
      };

      expect(editedMockTool.requestEdited).toBe(true);
      expect(editedMockTool.responseEdited).toBe(true);
      expect(editedMockTool.sampleDataEdited).toBe(true);
    });
  });

  describe('Test 3: sampleData array max 5 row constraint', () => {
    it('should allow up to 5 rows in sampleData', () => {
      const mockTool: MockToolDefinition = {
        tool: 'sap_get_inventory',
        system: 'SAP S/4HANA',
        operation: 'getInventory',
        mockRequest: { sku: 'string' },
        mockResponse: { quantity: 0 },
        sampleData: [
          { quantity: 100 },
          { quantity: 200 },
          { quantity: 300 },
          { quantity: 400 },
          { quantity: 500 },
        ],
        expanded: false,
        requestEdited: false,
        responseEdited: false,
        sampleDataEdited: false,
      };

      // Verify exactly 5 rows
      expect(mockTool.sampleData).toHaveLength(5);

      // Verify data integrity
      expect(mockTool.sampleData[0]).toEqual({ quantity: 100 });
      expect(mockTool.sampleData[4]).toEqual({ quantity: 500 });
    });

    it('should support empty sampleData array', () => {
      const mockTool: MockToolDefinition = {
        tool: 'sap_get_inventory',
        system: 'SAP S/4HANA',
        operation: 'getInventory',
        mockRequest: {},
        mockResponse: {},
        sampleData: [],
        expanded: false,
        requestEdited: false,
        responseEdited: false,
        sampleDataEdited: false,
      };

      expect(mockTool.sampleData).toHaveLength(0);
    });
  });

  describe('Test 4: edited flags (requestEdited, responseEdited, sampleDataEdited)', () => {
    it('should track edited state independently for each section', () => {
      // Create mock definition with specific edited states
      const mockTool: MockToolDefinition = {
        tool: 'salesforce_query_accounts',
        system: 'Salesforce',
        operation: 'queryAccounts',
        mockRequest: { query: 'string' },
        mockResponse: { accounts: [] },
        sampleData: [],
        expanded: true,
        requestEdited: true,
        responseEdited: false,
        sampleDataEdited: true,
      };

      // Verify independent flag tracking
      expect(mockTool.requestEdited).toBe(true);
      expect(mockTool.responseEdited).toBe(false);
      expect(mockTool.sampleDataEdited).toBe(true);

      // Verify state serialization preserves edited flags
      const serialized = JSON.stringify(mockTool);
      const deserialized: MockToolDefinition = JSON.parse(serialized);

      expect(deserialized.requestEdited).toBe(true);
      expect(deserialized.responseEdited).toBe(false);
      expect(deserialized.sampleDataEdited).toBe(true);
    });

    it('should preserve edited flags in MockDataState serialization', () => {
      const state: MockDataState = {
        mockDefinitions: [
          {
            tool: 'tool1',
            system: 'System1',
            operation: 'op1',
            mockRequest: {},
            mockResponse: {},
            sampleData: [{ value: 1 }],
            expanded: true,
            requestEdited: true,
            responseEdited: false,
            sampleDataEdited: true,
          },
          {
            tool: 'tool2',
            system: 'System2',
            operation: 'op2',
            mockRequest: {},
            mockResponse: {},
            sampleData: [],
            expanded: false,
            requestEdited: false,
            responseEdited: true,
            sampleDataEdited: false,
          },
        ],
        useCustomerTerminology: true,
        isLoading: false,
        error: undefined,
        step5Hash: 'hash123',
        aiCalled: true,
      };

      const serialized = JSON.stringify(state);
      const deserialized: MockDataState = JSON.parse(serialized);

      // Verify first tool's edited flags
      expect(deserialized.mockDefinitions[0].requestEdited).toBe(true);
      expect(deserialized.mockDefinitions[0].responseEdited).toBe(false);
      expect(deserialized.mockDefinitions[0].sampleDataEdited).toBe(true);

      // Verify second tool's edited flags
      expect(deserialized.mockDefinitions[1].requestEdited).toBe(false);
      expect(deserialized.mockDefinitions[1].responseEdited).toBe(true);
      expect(deserialized.mockDefinitions[1].sampleDataEdited).toBe(false);

      // Verify state-level fields
      expect(deserialized.useCustomerTerminology).toBe(true);
      expect(deserialized.step5Hash).toBe('hash123');
      expect(deserialized.aiCalled).toBe(true);
    });
  });

  describe('Test: Step 6 wizard commands are properly typed', () => {
    it('should define all Step 6 wizard commands with correct values', () => {
      // Step 6 mock data commands
      expect(WIZARD_COMMANDS.STEP6_UPDATE_REQUEST).toBe('step6UpdateRequest');
      expect(WIZARD_COMMANDS.STEP6_UPDATE_RESPONSE).toBe('step6UpdateResponse');
      expect(WIZARD_COMMANDS.STEP6_ADD_ROW).toBe('step6AddRow');
      expect(WIZARD_COMMANDS.STEP6_UPDATE_ROW).toBe('step6UpdateRow');
      expect(WIZARD_COMMANDS.STEP6_DELETE_ROW).toBe('step6DeleteRow');
      expect(WIZARD_COMMANDS.STEP6_TOGGLE_ACCORDION).toBe('step6ToggleAccordion');
      expect(WIZARD_COMMANDS.STEP6_REGENERATE_ALL).toBe('step6RegenerateAll');
      expect(WIZARD_COMMANDS.STEP6_IMPORT_DATA).toBe('step6ImportData');
      expect(WIZARD_COMMANDS.STEP6_TOGGLE_TERMINOLOGY).toBe('step6ToggleTerminology');

      // Verify all commands follow camelCase naming pattern starting with step6
      const step6Commands = [
        WIZARD_COMMANDS.STEP6_UPDATE_REQUEST,
        WIZARD_COMMANDS.STEP6_UPDATE_RESPONSE,
        WIZARD_COMMANDS.STEP6_ADD_ROW,
        WIZARD_COMMANDS.STEP6_UPDATE_ROW,
        WIZARD_COMMANDS.STEP6_DELETE_ROW,
        WIZARD_COMMANDS.STEP6_TOGGLE_ACCORDION,
        WIZARD_COMMANDS.STEP6_REGENERATE_ALL,
        WIZARD_COMMANDS.STEP6_IMPORT_DATA,
        WIZARD_COMMANDS.STEP6_TOGGLE_TERMINOLOGY,
      ];

      step6Commands.forEach((command) => {
        expect(command).toMatch(/^step6[A-Z][a-zA-Z0-9]+$/);
      });
    });
  });
});
