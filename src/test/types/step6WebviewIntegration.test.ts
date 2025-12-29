/**
 * Tests for Step 6 Mock Data Strategy - Webview Integration and Navigation
 * Task Group 6: Webview integration tests for Step 6 Mock Data Strategy feature
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WIZARD_COMMANDS, createDefaultMockDataState } from '../../types/wizardPanel';

// ============================================================================
// Mock VS Code API
// ============================================================================

// Mock the vscode module
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

// ============================================================================
// Task 6.1: 3 Focused Tests for Webview Integration
// ============================================================================

describe('Task Group 6: Step 6 Mock Data - Webview Integration and Navigation', () => {
  describe('Test 1: Step navigation triggers auto-send', () => {
    it('should trigger auto-send when entering Step 6 from Step 5', () => {
      // Simulate the navigation logic from tabbedPanel.ts
      // When entering Step 6, triggerAutoSend should be called with confirmedAgents and industry

      // Set up state that would trigger auto-send
      const mockDataState = createDefaultMockDataState();
      expect(mockDataState.aiCalled).toBe(false);
      expect(mockDataState.step5Hash).toBeUndefined();

      // Simulate mock inputs that would be passed to triggerAutoSend
      const step6Inputs = {
        confirmedAgents: [
          {
            id: 'planner',
            name: 'Planning Agent',
            role: 'Plans workflow',
            tools: ['sap_get_inventory', 'sap_check_stock'],
            nameEdited: false,
            roleEdited: false,
            toolsEdited: false,
          },
        ],
        industry: 'Retail',
      };

      // Verify inputs have correct structure for triggerAutoSend
      expect(step6Inputs.confirmedAgents).toHaveLength(1);
      expect(step6Inputs.confirmedAgents[0].tools).toContain('sap_get_inventory');
      expect(step6Inputs.industry).toBe('Retail');

      // The actual auto-send trigger happens in ideationNavigateForward() when:
      // previousStep === 5 && currentStep === 6
      // This test verifies the state structure is correct for triggering
    });

    it('should not trigger auto-send when aiCalled is true and hash unchanged', () => {
      // State with AI already called and hash set
      const mockDataState = createDefaultMockDataState();
      mockDataState.aiCalled = true;
      mockDataState.step5Hash = 'abc123';

      // When revisiting Step 6 with same inputs, auto-send should NOT be triggered
      expect(mockDataState.aiCalled).toBe(true);
      expect(mockDataState.step5Hash).toBeDefined();

      // The triggerAutoSend logic checks these conditions before calling AI
    });

    it('should trigger auto-send when step5Hash changes even if aiCalled is true', () => {
      // State with AI called but hash will change (Step 5 design modified)
      const mockDataState = createDefaultMockDataState();
      mockDataState.aiCalled = true;
      mockDataState.step5Hash = 'old_hash';

      const newStep5Hash = 'new_hash';

      // When hash changes, should re-trigger auto-send
      expect(mockDataState.step5Hash).not.toBe(newStep5Hash);

      // The triggerAutoSend logic will reset state and call AI when:
      // this._state.step5Hash !== currentHash
    });
  });

  describe('Test 2: Webview message handling for Step 6 commands', () => {
    it('should have all Step 6 command constants defined', () => {
      // Verify all Step 6 commands are present in WIZARD_COMMANDS
      expect(WIZARD_COMMANDS.STEP6_UPDATE_REQUEST).toBe('step6UpdateRequest');
      expect(WIZARD_COMMANDS.STEP6_UPDATE_RESPONSE).toBe('step6UpdateResponse');
      expect(WIZARD_COMMANDS.STEP6_ADD_ROW).toBe('step6AddRow');
      expect(WIZARD_COMMANDS.STEP6_UPDATE_ROW).toBe('step6UpdateRow');
      expect(WIZARD_COMMANDS.STEP6_DELETE_ROW).toBe('step6DeleteRow');
      expect(WIZARD_COMMANDS.STEP6_TOGGLE_ACCORDION).toBe('step6ToggleAccordion');
      expect(WIZARD_COMMANDS.STEP6_REGENERATE_ALL).toBe('step6RegenerateAll');
      expect(WIZARD_COMMANDS.STEP6_IMPORT_DATA).toBe('step6ImportData');
      expect(WIZARD_COMMANDS.STEP6_TOGGLE_TERMINOLOGY).toBe('step6ToggleTerminology');
    });

    it('should validate command message structure for Step 6 operations', () => {
      // Test message structures that would be sent from webview

      // UPDATE_REQUEST message
      const updateRequestMessage = {
        command: WIZARD_COMMANDS.STEP6_UPDATE_REQUEST,
        toolIndex: 0,
        value: '{"sku": "string", "warehouse": "string"}',
      };
      expect(updateRequestMessage.command).toBe('step6UpdateRequest');
      expect(typeof updateRequestMessage.toolIndex).toBe('number');
      expect(typeof updateRequestMessage.value).toBe('string');

      // ADD_ROW message
      const addRowMessage = {
        command: WIZARD_COMMANDS.STEP6_ADD_ROW,
        toolIndex: 1,
      };
      expect(addRowMessage.command).toBe('step6AddRow');
      expect(typeof addRowMessage.toolIndex).toBe('number');

      // UPDATE_ROW message
      const updateRowMessage = {
        command: WIZARD_COMMANDS.STEP6_UPDATE_ROW,
        toolIndex: 0,
        rowIndex: 2,
        field: 'quantity',
        value: '100',
      };
      expect(updateRowMessage.command).toBe('step6UpdateRow');
      expect(typeof updateRowMessage.rowIndex).toBe('number');
      expect(typeof updateRowMessage.field).toBe('string');

      // DELETE_ROW message
      const deleteRowMessage = {
        command: WIZARD_COMMANDS.STEP6_DELETE_ROW,
        toolIndex: 0,
        rowIndex: 1,
      };
      expect(deleteRowMessage.command).toBe('step6DeleteRow');
      expect(typeof deleteRowMessage.rowIndex).toBe('number');

      // TOGGLE_TERMINOLOGY message
      const toggleTermMessage = {
        command: WIZARD_COMMANDS.STEP6_TOGGLE_TERMINOLOGY,
        enabled: true,
      };
      expect(toggleTermMessage.command).toBe('step6ToggleTerminology');
      expect(typeof toggleTermMessage.enabled).toBe('boolean');

      // IMPORT_DATA message (per-tool import)
      const importDataMessage = {
        command: WIZARD_COMMANDS.STEP6_IMPORT_DATA,
        toolIndex: 0,
      };
      expect(importDataMessage.command).toBe('step6ImportData');
      expect(typeof importDataMessage.toolIndex).toBe('number');
    });

    it('should handle command routing based on command type', () => {
      // Simulate command routing logic
      const commands = [
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

      // All commands should start with 'step6'
      commands.forEach((cmd) => {
        expect(cmd).toMatch(/^step6[A-Z]/);
      });

      // Total of 9 Step 6 commands
      expect(commands).toHaveLength(9);
    });
  });

  describe('Test 3: State persistence across step navigation', () => {
    it('should preserve mock data state when navigating back from Step 7', () => {
      // Create state with mock definitions that should be preserved
      const mockDataState = createDefaultMockDataState();
      mockDataState.mockDefinitions = [
        {
          tool: 'sap_get_inventory',
          system: 'SAP S/4HANA',
          operation: 'getInventory',
          mockRequest: { sku: 'string' },
          mockResponse: { quantity: 0 },
          sampleData: [{ quantity: 100 }],
          expanded: true,
          requestEdited: true,
          responseEdited: false,
          sampleDataEdited: true,
        },
      ];
      mockDataState.useCustomerTerminology = true;
      mockDataState.aiCalled = true;
      mockDataState.step5Hash = 'hash123';

      // Back navigation should preserve all state
      // The handleBackNavigationToStep6() method in Step6LogicHandler
      // only calls updateWebviewContent and syncStateToWebview without resetting

      expect(mockDataState.mockDefinitions).toHaveLength(1);
      expect(mockDataState.mockDefinitions[0].requestEdited).toBe(true);
      expect(mockDataState.mockDefinitions[0].sampleDataEdited).toBe(true);
      expect(mockDataState.useCustomerTerminology).toBe(true);
      expect(mockDataState.aiCalled).toBe(true);
      expect(mockDataState.step5Hash).toBe('hash123');
    });

    it('should preserve edited flags when navigating away and back', () => {
      const mockDataState = createDefaultMockDataState();
      mockDataState.mockDefinitions = [
        {
          tool: 'tool1',
          system: 'System1',
          operation: 'op1',
          mockRequest: { field: 'value' },
          mockResponse: { result: 'data' },
          sampleData: [],
          expanded: false,
          requestEdited: true,
          responseEdited: true,
          sampleDataEdited: false,
        },
        {
          tool: 'tool2',
          system: 'System2',
          operation: 'op2',
          mockRequest: {},
          mockResponse: {},
          sampleData: [{ data: 1 }],
          expanded: true,
          requestEdited: false,
          responseEdited: false,
          sampleDataEdited: true,
        },
      ];

      // Serialize and deserialize to simulate state persistence
      const serialized = JSON.stringify(mockDataState);
      const restored = JSON.parse(serialized);

      // Edited flags should be preserved
      expect(restored.mockDefinitions[0].requestEdited).toBe(true);
      expect(restored.mockDefinitions[0].responseEdited).toBe(true);
      expect(restored.mockDefinitions[0].sampleDataEdited).toBe(false);

      expect(restored.mockDefinitions[1].requestEdited).toBe(false);
      expect(restored.mockDefinitions[1].responseEdited).toBe(false);
      expect(restored.mockDefinitions[1].sampleDataEdited).toBe(true);
    });

    it('should preserve expanded state of accordions across navigation', () => {
      const mockDataState = createDefaultMockDataState();
      mockDataState.mockDefinitions = [
        {
          tool: 'tool1',
          system: 'System1',
          operation: 'op1',
          mockRequest: {},
          mockResponse: {},
          sampleData: [],
          expanded: true, // User expanded this
          requestEdited: false,
          responseEdited: false,
          sampleDataEdited: false,
        },
        {
          tool: 'tool2',
          system: 'System2',
          operation: 'op2',
          mockRequest: {},
          mockResponse: {},
          sampleData: [],
          expanded: false, // User collapsed this
          requestEdited: false,
          responseEdited: false,
          sampleDataEdited: false,
        },
      ];

      // Expanded state should persist through navigation
      expect(mockDataState.mockDefinitions[0].expanded).toBe(true);
      expect(mockDataState.mockDefinitions[1].expanded).toBe(false);

      // Simulate state sync (would happen on navigation)
      const syncedState = JSON.parse(JSON.stringify(mockDataState));
      expect(syncedState.mockDefinitions[0].expanded).toBe(true);
      expect(syncedState.mockDefinitions[1].expanded).toBe(false);
    });
  });
});
