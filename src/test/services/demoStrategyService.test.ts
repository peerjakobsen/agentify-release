/**
 * Tests for Step 7 Demo Strategy - AI Service Layer
 * Task Group 2: Demo Strategy Generation Service
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
  buildAhaMomentsContextMessage,
  buildPersonaContextMessage,
  buildNarrativeContextMessage,
  parseAhaMomentsFromResponse,
  parsePersonaFromResponse,
  parseNarrativeScenesFromResponse,
  DEMO_STRATEGY_PROMPT_PATH,
} from '../../services/demoStrategyService';
import type { ProposedAgent, ProposedEdge, AhaMoment } from '../../types/wizardPanel';

// ============================================================================
// Task 2.1: 5 Focused Tests for Demo Strategy Service
// ============================================================================

describe('Task Group 2: Demo Strategy Generation Service', () => {
  // Sample confirmed agents for testing
  const sampleConfirmedAgents: ProposedAgent[] = [
    {
      id: 'planner',
      name: 'Planning Agent',
      role: 'Analyzes inventory needs and creates replenishment plans',
      tools: ['sap_get_inventory', 'sap_check_availability'],
      nameEdited: false,
      roleEdited: false,
      toolsEdited: false,
    },
    {
      id: 'executor',
      name: 'Execution Agent',
      role: 'Executes purchase orders and updates inventory',
      tools: ['sap_create_purchase_order', 'salesforce_update_opportunity'],
      nameEdited: false,
      roleEdited: false,
      toolsEdited: false,
    },
  ];

  // Sample edges for testing
  const sampleEdges: ProposedEdge[] = [
    { from: 'planner', to: 'executor' },
    { from: 'executor', to: 'planner', condition: 'needs_review' },
  ];

  // Sample aha moments for narrative context
  const sampleAhaMoments: AhaMoment[] = [
    {
      id: 'aha1',
      title: 'Real-time inventory sync',
      triggerType: 'tool',
      triggerName: 'sap_get_inventory',
      talkingPoint: 'Notice how inventory updates in real-time across all systems.',
    },
  ];

  // -------------------------------------------------------------------------
  // Test 1: buildAhaMomentsContextMessage generates correct prompt
  // -------------------------------------------------------------------------
  describe('Test 1: buildAhaMomentsContextMessage() generates correct prompt', () => {
    it('should include industry and business objective context', () => {
      const message = buildAhaMomentsContextMessage(
        'Retail',
        'Automate inventory replenishment across 12 stores',
        sampleConfirmedAgents
      );

      expect(message).toContain('Retail');
      expect(message).toContain('Automate inventory replenishment across 12 stores');
    });

    it('should include agent names and their tools', () => {
      const message = buildAhaMomentsContextMessage(
        'Retail',
        'Automate inventory replenishment',
        sampleConfirmedAgents
      );

      expect(message).toContain('Planning Agent');
      expect(message).toContain('Execution Agent');
      expect(message).toContain('sap_get_inventory');
      expect(message).toContain('sap_create_purchase_order');
    });

    it('should request JSON array output format', () => {
      const message = buildAhaMomentsContextMessage(
        'Retail',
        'Automate inventory',
        sampleConfirmedAgents
      );

      expect(message).toContain('JSON');
      expect(message).toContain('aha moment');
    });
  });

  // -------------------------------------------------------------------------
  // Test 2: buildPersonaContextMessage generates correct prompt
  // -------------------------------------------------------------------------
  describe('Test 2: buildPersonaContextMessage() generates correct prompt', () => {
    it('should include industry and business objective', () => {
      const message = buildPersonaContextMessage(
        'Healthcare',
        'Streamline patient scheduling',
        'Reduce scheduling conflicts by 50%'
      );

      expect(message).toContain('Healthcare');
      expect(message).toContain('Streamline patient scheduling');
    });

    it('should include outcome definition when provided', () => {
      const message = buildPersonaContextMessage(
        'Retail',
        'Inventory management',
        'Reduce stockouts by 30% and improve inventory turnover'
      );

      expect(message).toContain('Reduce stockouts by 30%');
    });

    it('should request JSON object format with name, role, painPoint fields', () => {
      const message = buildPersonaContextMessage(
        'Manufacturing',
        'Production optimization',
        'Increase throughput'
      );

      expect(message).toContain('name');
      expect(message).toContain('role');
      expect(message).toContain('painPoint');
    });
  });

  // -------------------------------------------------------------------------
  // Test 3: buildNarrativeContextMessage generates correct prompt
  // -------------------------------------------------------------------------
  describe('Test 3: buildNarrativeContextMessage() generates correct prompt', () => {
    it('should include agent design and edges', () => {
      const message = buildNarrativeContextMessage(
        sampleConfirmedAgents,
        sampleEdges,
        []
      );

      expect(message).toContain('Planning Agent');
      expect(message).toContain('Execution Agent');
      expect(message).toContain('planner');
      expect(message).toContain('executor');
    });

    it('should include aha moments when provided', () => {
      const message = buildNarrativeContextMessage(
        sampleConfirmedAgents,
        sampleEdges,
        sampleAhaMoments
      );

      expect(message).toContain('Real-time inventory sync');
      expect(message).toContain('sap_get_inventory');
    });

    it('should request 4-5 scenes in JSON array format', () => {
      const message = buildNarrativeContextMessage(
        sampleConfirmedAgents,
        sampleEdges,
        []
      );

      expect(message).toContain('scene');
      expect(message).toContain('JSON');
    });
  });

  // -------------------------------------------------------------------------
  // Test 4: parseAhaMomentsFromResponse extracts JSON correctly
  // -------------------------------------------------------------------------
  describe('Test 4: parseAhaMomentsFromResponse() extracts JSON correctly', () => {
    it('should parse valid JSON array from AI response', () => {
      const aiResponse = `Here are the suggested aha moments:

\`\`\`json
[
  {
    "title": "Real-time inventory visibility",
    "triggerType": "tool",
    "triggerName": "sap_get_inventory",
    "talkingPoint": "Notice how the agent instantly retrieves inventory levels."
  },
  {
    "title": "Automated purchase order creation",
    "triggerType": "agent",
    "triggerName": "Execution Agent",
    "talkingPoint": "The agent autonomously creates purchase orders when stock is low."
  }
]
\`\`\``;

      const result = parseAhaMomentsFromResponse(aiResponse);

      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
      expect(result![0].title).toBe('Real-time inventory visibility');
      expect(result![0].triggerType).toBe('tool');
      expect(result![0].triggerName).toBe('sap_get_inventory');
      expect(result![1].triggerType).toBe('agent');
    });

    it('should generate unique IDs for each moment', () => {
      const aiResponse = `\`\`\`json
[
  {
    "title": "Moment 1",
    "triggerType": "agent",
    "triggerName": "Agent A",
    "talkingPoint": "Point 1"
  },
  {
    "title": "Moment 2",
    "triggerType": "tool",
    "triggerName": "tool_a",
    "talkingPoint": "Point 2"
  }
]
\`\`\``;

      const result = parseAhaMomentsFromResponse(aiResponse);

      expect(result).not.toBeNull();
      expect(result![0].id).toBeDefined();
      expect(result![1].id).toBeDefined();
      expect(result![0].id).not.toBe(result![1].id);
    });

    it('should return null for response without JSON block', () => {
      const result = parseAhaMomentsFromResponse('Some text without JSON.');
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const result = parseAhaMomentsFromResponse(`\`\`\`json
{ invalid json }
\`\`\``);
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Test 5: parsePersonaFromResponse and parseNarrativeScenesFromResponse
  // -------------------------------------------------------------------------
  describe('Test 5: Additional parsing functions', () => {
    describe('parsePersonaFromResponse()', () => {
      it('should parse valid persona JSON object', () => {
        const aiResponse = `Here is the suggested persona:

\`\`\`json
{
  "name": "Maria Chen",
  "role": "Regional Inventory Manager overseeing 12 retail stores",
  "painPoint": "Currently spends 3 hours daily manually checking stock levels across systems"
}
\`\`\``;

        const result = parsePersonaFromResponse(aiResponse);

        expect(result).not.toBeNull();
        expect(result!.name).toBe('Maria Chen');
        expect(result!.role).toContain('Regional Inventory Manager');
        expect(result!.painPoint).toContain('3 hours');
      });

      it('should return null for missing required fields', () => {
        const aiResponse = `\`\`\`json
{
  "name": "John",
  "role": "Manager"
}
\`\`\``;

        const result = parsePersonaFromResponse(aiResponse);
        expect(result).toBeNull();
      });
    });

    describe('parseNarrativeScenesFromResponse()', () => {
      it('should parse valid narrative scenes JSON array', () => {
        const aiResponse = `Here is the demo narrative:

\`\`\`json
[
  {
    "title": "Morning Check-In",
    "description": "Maria starts her day by reviewing the inventory dashboard.",
    "highlightedAgents": ["planner"]
  },
  {
    "title": "Automated Reorder",
    "description": "The agent detects low stock and initiates a purchase order.",
    "highlightedAgents": ["executor", "planner"]
  }
]
\`\`\``;

        const result = parseNarrativeScenesFromResponse(aiResponse);

        expect(result).not.toBeNull();
        expect(result).toHaveLength(2);
        expect(result![0].title).toBe('Morning Check-In');
        expect(result![0].highlightedAgents).toContain('planner');
        expect(result![1].highlightedAgents).toHaveLength(2);
      });

      it('should generate unique IDs for each scene', () => {
        const aiResponse = `\`\`\`json
[
  {
    "title": "Scene 1",
    "description": "Description 1",
    "highlightedAgents": []
  },
  {
    "title": "Scene 2",
    "description": "Description 2",
    "highlightedAgents": []
  }
]
\`\`\``;

        const result = parseNarrativeScenesFromResponse(aiResponse);

        expect(result).not.toBeNull();
        expect(result![0].id).toBeDefined();
        expect(result![1].id).toBeDefined();
        expect(result![0].id).not.toBe(result![1].id);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Test 6: System prompt path constant
  // -------------------------------------------------------------------------
  describe('Test 6: System prompt path constant is defined correctly', () => {
    it('should export the correct prompt path constant', () => {
      expect(DEMO_STRATEGY_PROMPT_PATH).toBe(
        'resources/prompts/demo-strategy-assistant.md'
      );
    });
  });
});
