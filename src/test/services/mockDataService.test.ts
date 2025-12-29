/**
 * Tests for Step 6 Mock Data Strategy - AI Service Layer
 * Task Group 2: Mock Data Generation Service
 */

import { describe, it, expect, vi } from 'vitest';

// Mock vscode module before importing the service
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
    },
    EventEmitter: vi.fn().mockImplementation(() => ({
      event: vi.fn(),
      fire: vi.fn(),
      dispose: vi.fn(),
    })),
    Disposable: vi.fn().mockImplementation((fn) => ({ dispose: fn })),
    _mockReadFile: mockReadFile,
  };
});

// Import the service under test
import {
  buildMockDataContextMessage,
  parseMockDefinitionsFromResponse,
  generateStep5Hash,
  buildTerminologyRefinementMessage,
  MOCK_DATA_PROMPT_PATH,
} from '../../services/mockDataService';
import type { ProposedAgent, MockToolDefinition } from '../../types/wizardPanel';

// ============================================================================
// Task 2.1: 6 Focused Tests for Mock Data Service
// ============================================================================

describe('Task Group 2: Mock Data Generation Service', () => {
  // Sample Step 5 confirmed agents for testing
  const sampleConfirmedAgents: ProposedAgent[] = [
    {
      id: 'inventory_agent',
      name: 'Inventory Manager',
      role: 'Manages inventory levels and stock availability',
      tools: ['sap_get_inventory', 'sap_check_stock_availability'],
      nameEdited: false,
      roleEdited: false,
      toolsEdited: false,
    },
    {
      id: 'order_agent',
      name: 'Order Processor',
      role: 'Processes customer orders and manages fulfillment',
      tools: ['salesforce_create_opportunity', 'sap_create_purchase_order'],
      nameEdited: false,
      roleEdited: false,
      toolsEdited: false,
    },
  ];

  // -------------------------------------------------------------------------
  // Test 1: buildMockDataContextMessage generates correct prompt
  // -------------------------------------------------------------------------
  describe('Test 1: buildMockDataContextMessage() generates correct prompt', () => {
    it('should include tool names extracted from confirmed agents', () => {
      const message = buildMockDataContextMessage(
        sampleConfirmedAgents,
        'Retail'
      );

      // Verify tool names are included
      expect(message).toContain('sap_get_inventory');
      expect(message).toContain('sap_check_stock_availability');
      expect(message).toContain('salesforce_create_opportunity');
      expect(message).toContain('sap_create_purchase_order');
    });

    it('should include industry context', () => {
      const message = buildMockDataContextMessage(
        sampleConfirmedAgents,
        'Healthcare'
      );

      expect(message).toContain('Healthcare');
    });

    it('should include system context for each tool', () => {
      const message = buildMockDataContextMessage(
        sampleConfirmedAgents,
        'Retail'
      );

      // System names derived from tool prefixes (SAP S/4HANA, Salesforce)
      expect(message).toContain('SAP S/4HANA');
      expect(message).toContain('Salesforce');
    });

    it('should request JSON format for mock definitions', () => {
      const message = buildMockDataContextMessage(
        sampleConfirmedAgents,
        'Retail'
      );

      expect(message).toContain('mockRequest');
      expect(message).toContain('mockResponse');
      expect(message).toContain('sampleData');
    });
  });

  // -------------------------------------------------------------------------
  // Test 2: parseMockDefinitionsFromResponse extracts tool definitions
  // -------------------------------------------------------------------------
  describe('Test 2: parseMockDefinitionsFromResponse() extracts tool definitions', () => {
    it('should parse valid JSON array from AI response', () => {
      const aiResponse = `Here are the mock definitions for your tools:

\`\`\`json
[
  {
    "tool": "sap_get_inventory",
    "system": "SAP S/4HANA",
    "operation": "getInventory",
    "mockRequest": { "sku": "string", "warehouse": "string" },
    "mockResponse": { "quantity": 0, "unit": "string" },
    "sampleData": [
      { "quantity": 100, "unit": "pcs" },
      { "quantity": 50, "unit": "pcs" }
    ]
  }
]
\`\`\``;

      const result = parseMockDefinitionsFromResponse(aiResponse);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].tool).toBe('sap_get_inventory');
      expect(result![0].system).toBe('SAP S/4HANA');
      expect(result![0].operation).toBe('getInventory');
      expect(result![0].mockRequest).toEqual({ sku: 'string', warehouse: 'string' });
      expect(result![0].mockResponse).toEqual({ quantity: 0, unit: 'string' });
      expect(result![0].sampleData).toHaveLength(2);
    });

    it('should initialize edited flags to false', () => {
      const aiResponse = `\`\`\`json
[
  {
    "tool": "sap_get_inventory",
    "system": "SAP",
    "operation": "get",
    "mockRequest": {},
    "mockResponse": {},
    "sampleData": []
  }
]
\`\`\``;

      const result = parseMockDefinitionsFromResponse(aiResponse);

      expect(result).not.toBeNull();
      expect(result![0].requestEdited).toBe(false);
      expect(result![0].responseEdited).toBe(false);
      expect(result![0].sampleDataEdited).toBe(false);
    });

    it('should set expanded to true for first tool, false for others', () => {
      const aiResponse = `\`\`\`json
[
  {
    "tool": "tool_one",
    "system": "System",
    "operation": "op1",
    "mockRequest": {},
    "mockResponse": {},
    "sampleData": []
  },
  {
    "tool": "tool_two",
    "system": "System",
    "operation": "op2",
    "mockRequest": {},
    "mockResponse": {},
    "sampleData": []
  },
  {
    "tool": "tool_three",
    "system": "System",
    "operation": "op3",
    "mockRequest": {},
    "mockResponse": {},
    "sampleData": []
  }
]
\`\`\``;

      const result = parseMockDefinitionsFromResponse(aiResponse);

      expect(result).not.toBeNull();
      expect(result![0].expanded).toBe(true);
      expect(result![1].expanded).toBe(false);
      expect(result![2].expanded).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Test 3: generateStep5Hash produces consistent hashes
  // -------------------------------------------------------------------------
  describe('Test 3: generateStep5Hash() produces consistent hashes', () => {
    it('should produce same hash for same input', () => {
      const hash1 = generateStep5Hash(sampleConfirmedAgents);
      const hash2 = generateStep5Hash(sampleConfirmedAgents);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', () => {
      const modifiedAgents: ProposedAgent[] = [
        {
          ...sampleConfirmedAgents[0],
          tools: ['different_tool'],
        },
      ];

      const hash1 = generateStep5Hash(sampleConfirmedAgents);
      const hash2 = generateStep5Hash(modifiedAgents);

      expect(hash1).not.toBe(hash2);
    });

    it('should return a hexadecimal string', () => {
      const hash = generateStep5Hash(sampleConfirmedAgents);

      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  // -------------------------------------------------------------------------
  // Test 4: Terminology refinement prompt construction
  // -------------------------------------------------------------------------
  describe('Test 4: buildTerminologyRefinementMessage() for terminology refinement', () => {
    const sampleMockDefinitions: MockToolDefinition[] = [
      {
        tool: 'sap_get_inventory',
        system: 'SAP S/4HANA',
        operation: 'getInventory',
        mockRequest: { sku: 'string' },
        mockResponse: { quantity: 0 },
        sampleData: [{ quantity: 100 }],
        expanded: true,
        requestEdited: false,
        responseEdited: false,
        sampleDataEdited: false,
      },
    ];

    it('should include current mock definitions in context', () => {
      const message = buildTerminologyRefinementMessage(
        sampleMockDefinitions,
        'Healthcare'
      );

      expect(message).toContain('sap_get_inventory');
      expect(message).toContain('quantity');
    });

    it('should use correct terminology refinement prompt', () => {
      const message = buildTerminologyRefinementMessage(
        sampleMockDefinitions,
        'Healthcare'
      );

      expect(message).toContain('Regenerate sample data using terminology typical for');
      expect(message).toContain('Healthcare');
    });

    it('should specify preserving schema structure', () => {
      const message = buildTerminologyRefinementMessage(
        sampleMockDefinitions,
        'Retail'
      );

      expect(message).toContain('schema');
      expect(message).toContain('sampleData');
    });
  });

  // -------------------------------------------------------------------------
  // Test 5: Error handling for malformed AI responses
  // -------------------------------------------------------------------------
  describe('Test 5: Error handling for malformed AI responses', () => {
    it('should return null for response without JSON block', () => {
      const result = parseMockDefinitionsFromResponse(
        'Here is some text without any JSON.'
      );

      expect(result).toBeNull();
    });

    it('should return null for invalid JSON in code block', () => {
      const result = parseMockDefinitionsFromResponse(`\`\`\`json
{ invalid json here
\`\`\``);

      expect(result).toBeNull();
    });

    it('should return null for JSON that is not an array', () => {
      const result = parseMockDefinitionsFromResponse(`\`\`\`json
{
  "tool": "sap_get_inventory",
  "system": "SAP"
}
\`\`\``);

      expect(result).toBeNull();
    });

    it('should handle JSON array with invalid tool definitions gracefully', () => {
      const result = parseMockDefinitionsFromResponse(`\`\`\`json
[
  {
    "tool": "valid_tool",
    "system": "System",
    "operation": "op",
    "mockRequest": {},
    "mockResponse": {},
    "sampleData": []
  },
  {
    "invalid": "structure"
  }
]
\`\`\``);

      // Should return only valid tools
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(1);
      expect(result![0].tool).toBe('valid_tool');
    });
  });

  // -------------------------------------------------------------------------
  // Test 6: System prompt loads from resources/prompts/mock-data-assistant.md
  // -------------------------------------------------------------------------
  describe('Test 6: System prompt path constant is defined correctly', () => {
    it('should export the correct prompt path constant', () => {
      // Verify the prompt path follows the expected pattern
      // The actual file loading is tested via integration tests
      expect(MOCK_DATA_PROMPT_PATH).toBe(
        'resources/prompts/mock-data-assistant.md'
      );
    });
  });
});
