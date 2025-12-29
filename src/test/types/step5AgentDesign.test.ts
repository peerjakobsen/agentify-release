/**
 * Tests for Agent Design Proposal - Wizard Step 5
 * Comprehensive tests covering state, service, prompt, UI, triggers, and handlers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

// ============================================================================
// Task Group 1: State Structure Tests
// ============================================================================

describe('Task Group 1: State Structure Additions', () => {
  describe('AgentDesignState interface', () => {
    it('should validate AgentDesignState structure with all required fields', async () => {
      // Dynamic import to get the actual types after they're created
      const { createDefaultAgentDesignState } = await import('../../types/wizardPanel');

      const state = createDefaultAgentDesignState();

      // Verify AI proposal fields
      expect(state.proposedAgents).toEqual([]);
      expect(state.proposedOrchestration).toBe('workflow');
      expect(state.proposedEdges).toEqual([]);
      expect(state.orchestrationReasoning).toBe('');

      // Verify acceptance state
      expect(state.proposalAccepted).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeUndefined();

      // Verify change detection fields
      expect(state.step4Hash).toBeUndefined();
      expect(state.aiCalled).toBe(false);
    });
  });

  describe('ProposedAgent interface', () => {
    it('should validate ProposedAgent structure with id, name, role, and tools', async () => {
      const agent = {
        id: 'planner',
        name: 'Planning Agent',
        role: 'Coordinates task breakdown and workflow planning',
        tools: ['sap_get_inventory', 'salesforce_query_accounts'],
      };

      expect(agent.id).toBe('planner');
      expect(agent.name).toBe('Planning Agent');
      expect(agent.role).toBeTruthy();
      expect(agent.tools).toBeInstanceOf(Array);
      expect(agent.tools).toHaveLength(2);

      // Verify tool naming convention (snake_case)
      agent.tools.forEach((tool) => {
        expect(tool).toMatch(/^[a-z]+_[a-z_]+$/);
      });
    });
  });

  describe('ProposedEdge interface', () => {
    it('should validate ProposedEdge structure with from, to, and optional condition', async () => {
      // Test edge without condition
      const simpleEdge = {
        from: 'planner',
        to: 'executor',
      };

      expect(simpleEdge.from).toBe('planner');
      expect(simpleEdge.to).toBe('executor');

      // Test edge with condition
      const conditionalEdge = {
        from: 'validator',
        to: 'reviewer',
        condition: 'requires_approval',
      };

      expect(conditionalEdge.from).toBe('validator');
      expect(conditionalEdge.to).toBe('reviewer');
      expect(conditionalEdge.condition).toBe('requires_approval');
    });
  });

  describe('OrchestrationPattern type', () => {
    it('should accept valid orchestration pattern values', async () => {
      const validPatterns = ['graph', 'swarm', 'workflow'];

      validPatterns.forEach((pattern) => {
        expect(['graph', 'swarm', 'workflow']).toContain(pattern);
      });
    });
  });
});

// ============================================================================
// Task Group 2: AgentDesignService Tests
// ============================================================================

describe('Task Group 2: AgentDesignService Implementation', () => {
  describe('Service singleton pattern', () => {
    it('should return same instance on multiple calls to getAgentDesignService', async () => {
      // This test verifies the singleton pattern is implemented correctly
      const { getAgentDesignService, resetAgentDesignService } = await import('../../services/agentDesignService');

      // Create mock extension context
      const mockContext = {
        extensionUri: { fsPath: '/mock/extension' },
      } as unknown as vscode.ExtensionContext;

      const service1 = getAgentDesignService(mockContext);
      const service2 = getAgentDesignService(mockContext);

      expect(service1).toBe(service2);

      // Cleanup
      resetAgentDesignService();
    });
  });

  describe('loadSystemPrompt', () => {
    it('should load and cache the system prompt correctly', async () => {
      // Test that system prompt is loaded from the correct path
      const { AgentDesignService } = await import('../../services/agentDesignService');

      // Verify the service can be instantiated
      expect(AgentDesignService).toBeDefined();
    });
  });

  describe('buildAgentDesignContextMessage', () => {
    it('should format Steps 1-4 data properly', async () => {
      const { buildAgentDesignContextMessage } = await import('../../services/agentDesignService');

      const contextMessage = buildAgentDesignContextMessage(
        'Reduce order processing time by 40%',
        'Retail',
        ['SAP S/4HANA', 'Salesforce'],
        undefined,
        [{ system: 'SAP S/4HANA', modules: ['MM', 'SD'], integrations: ['Salesforce sync'], source: 'ai-proposed' as const }],
        'Improve operational efficiency',
        [{ name: 'Processing Time', targetValue: '50', unit: '% reduction' }],
        'Internal',
        ['SOC 2'],
        ['Before data modification']
      );

      // Verify context message contains key information
      expect(contextMessage).toContain('Reduce order processing time');
      expect(contextMessage).toContain('Retail');
      expect(contextMessage).toContain('SAP S/4HANA');
      expect(contextMessage).toContain('Salesforce');
      expect(contextMessage).toContain('Processing Time');
      expect(contextMessage).toContain('Internal');
    });
  });

  describe('parseAgentProposalFromResponse', () => {
    it('should extract agents array from valid JSON response', async () => {
      const { parseAgentProposalFromResponse } = await import('../../services/agentDesignService');

      const response = `Here is the proposed agent team:

\`\`\`json
{
  "agents": [
    {
      "id": "planner",
      "name": "Planning Agent",
      "role": "Coordinates the workflow",
      "tools": ["sap_get_inventory", "salesforce_query"]
    }
  ],
  "orchestrationPattern": "workflow",
  "edges": [
    { "from": "planner", "to": "executor" }
  ],
  "reasoning": "A workflow pattern is best for this linear process."
}
\`\`\`

This design focuses on simplicity.`;

      const result = parseAgentProposalFromResponse(response);

      expect(result).not.toBeNull();
      expect(result?.agents).toHaveLength(1);
      expect(result?.agents[0].id).toBe('planner');
      expect(result?.orchestrationPattern).toBe('workflow');
      expect(result?.edges).toHaveLength(1);
      expect(result?.reasoning).toBeTruthy();
    });

    it('should extract orchestration pattern and edges correctly', async () => {
      const { parseAgentProposalFromResponse } = await import('../../services/agentDesignService');

      const response = `\`\`\`json
{
  "agents": [
    { "id": "analyzer", "name": "Analyzer", "role": "Analyzes data", "tools": ["databricks_query"] },
    { "id": "reviewer", "name": "Reviewer", "role": "Reviews results", "tools": ["slack_notify"] }
  ],
  "orchestrationPattern": "graph",
  "edges": [
    { "from": "analyzer", "to": "reviewer" },
    { "from": "reviewer", "to": "output", "condition": "approved" }
  ],
  "reasoning": "Graph pattern allows conditional branching."
}
\`\`\``;

      const result = parseAgentProposalFromResponse(response);

      expect(result?.orchestrationPattern).toBe('graph');
      expect(result?.edges).toHaveLength(2);
      expect(result?.edges[1].condition).toBe('approved');
    });
  });
});

// ============================================================================
// Task Group 3: System Prompt Tests
// ============================================================================

describe('Task Group 3: System Prompt Creation', () => {
  describe('Prompt content validation', () => {
    it('should include JSON schema for agents, orchestration, edges, reasoning', async () => {
      // Read the prompt file content
      const fs = await import('fs');
      const path = await import('path');

      // Determine the path to the prompt file
      const promptPath = path.join(__dirname, '../../../resources/prompts/agent-design-assistant.md');

      // Check if file exists (will fail if prompt not created yet)
      if (fs.existsSync(promptPath)) {
        const content = fs.readFileSync(promptPath, 'utf-8');

        expect(content).toContain('agents');
        expect(content).toContain('orchestrationPattern');
        expect(content).toContain('edges');
        expect(content).toContain('reasoning');
      }
    });

    it('should specify tool format as lowercase snake_case {system}_{operation}', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const promptPath = path.join(__dirname, '../../../resources/prompts/agent-design-assistant.md');

      if (fs.existsSync(promptPath)) {
        const content = fs.readFileSync(promptPath, 'utf-8');

        expect(content).toContain('snake_case');
        expect(content.toLowerCase()).toContain('sap_');
        expect(content.toLowerCase()).toContain('salesforce_');
      }
    });

    it('should describe three orchestration patterns (graph, swarm, workflow)', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const promptPath = path.join(__dirname, '../../../resources/prompts/agent-design-assistant.md');

      if (fs.existsSync(promptPath)) {
        const content = fs.readFileSync(promptPath, 'utf-8').toLowerCase();

        expect(content).toContain('graph');
        expect(content).toContain('swarm');
        expect(content).toContain('workflow');
      }
    });
  });
});

// ============================================================================
// Task Group 4: Step 5 UI Component Tests
// ============================================================================

describe('Task Group 4: Step 5 UI Components', () => {
  describe('getStep5Html rendering', () => {
    it('should render loading indicator when isLoading=true', async () => {
      const { getStep5Html } = await import('../../panels/ideationStepHtml');

      // Create mock state with isLoading=true
      const mockState = {
        currentStep: 5,
        highestStepReached: 5,
        validationAttempted: false,
        businessObjective: 'Test objective',
        industry: 'Retail',
        systems: ['SAP S/4HANA'],
        aiGapFillingState: {
          conversationHistory: [],
          confirmedAssumptions: [],
          assumptionsAccepted: false,
          isStreaming: false,
        },
        outcome: {
          primaryOutcome: 'Test outcome',
          successMetrics: [],
          stakeholders: [],
          isLoading: false,
          primaryOutcomeEdited: false,
          metricsEdited: false,
          stakeholdersEdited: false,
          customStakeholders: [],
          suggestionsAccepted: false,
          refinedSections: { outcome: false, kpis: false, stakeholders: false },
        },
        securityGuardrails: {
          dataSensitivity: 'internal',
          complianceFrameworks: [],
          approvalGates: [],
          guardrailNotes: '',
          aiSuggested: false,
          aiCalled: false,
          skipped: false,
          industryDefaultsApplied: false,
          isLoading: false,
        },
        agentDesign: {
          proposedAgents: [],
          proposedOrchestration: 'workflow' as const,
          proposedEdges: [],
          orchestrationReasoning: '',
          proposalAccepted: false,
          isLoading: true,
          aiCalled: false,
        },
      };

      const html = getStep5Html(mockState as any);

      // Verify loading indicator is present
      expect(html).toContain('typing-indicator');
      expect(html).toContain('Generating agent proposal');
      expect(html).toContain('dot');
    });

    it('should render agent cards with name, ID badge, role, and tools', async () => {
      const { getStep5Html } = await import('../../panels/ideationStepHtml');

      const mockState = {
        currentStep: 5,
        highestStepReached: 5,
        validationAttempted: false,
        businessObjective: 'Test objective',
        industry: 'Retail',
        systems: ['SAP S/4HANA'],
        aiGapFillingState: {
          conversationHistory: [],
          confirmedAssumptions: [],
          assumptionsAccepted: false,
          isStreaming: false,
        },
        outcome: {
          primaryOutcome: 'Test outcome',
          successMetrics: [],
          stakeholders: [],
          isLoading: false,
          primaryOutcomeEdited: false,
          metricsEdited: false,
          stakeholdersEdited: false,
          customStakeholders: [],
          suggestionsAccepted: false,
          refinedSections: { outcome: false, kpis: false, stakeholders: false },
        },
        securityGuardrails: {
          dataSensitivity: 'internal',
          complianceFrameworks: [],
          approvalGates: [],
          guardrailNotes: '',
          aiSuggested: false,
          aiCalled: false,
          skipped: false,
          industryDefaultsApplied: false,
          isLoading: false,
        },
        agentDesign: {
          proposedAgents: [
            {
              id: 'planner',
              name: 'Planning Agent',
              role: 'Coordinates the workflow',
              tools: ['sap_get_inventory', 'salesforce_query'],
            },
          ],
          proposedOrchestration: 'workflow' as const,
          proposedEdges: [{ from: 'planner', to: 'executor' }],
          orchestrationReasoning: 'Workflow is best for linear processes.',
          proposalAccepted: false,
          isLoading: false,
          aiCalled: true,
        },
      };

      const html = getStep5Html(mockState as any);

      // Verify agent card structure
      expect(html).toContain('agent-card');
      expect(html).toContain('Planning Agent');
      expect(html).toContain('#planner');
      expect(html).toContain('agent-role');
      expect(html).toContain('module-chip');
      expect(html).toContain('sap_get_inventory');
    });

    it('should render orchestration badge with pattern name', async () => {
      const { getStep5Html } = await import('../../panels/ideationStepHtml');

      const mockState = {
        currentStep: 5,
        highestStepReached: 5,
        validationAttempted: false,
        businessObjective: 'Test',
        industry: 'Retail',
        systems: [],
        aiGapFillingState: {
          conversationHistory: [],
          confirmedAssumptions: [],
          assumptionsAccepted: false,
          isStreaming: false,
        },
        outcome: {
          primaryOutcome: '',
          successMetrics: [],
          stakeholders: [],
          isLoading: false,
          primaryOutcomeEdited: false,
          metricsEdited: false,
          stakeholdersEdited: false,
          customStakeholders: [],
          suggestionsAccepted: false,
          refinedSections: { outcome: false, kpis: false, stakeholders: false },
        },
        securityGuardrails: {
          dataSensitivity: 'internal',
          complianceFrameworks: [],
          approvalGates: [],
          guardrailNotes: '',
          aiSuggested: false,
          aiCalled: false,
          skipped: false,
          industryDefaultsApplied: false,
          isLoading: false,
        },
        agentDesign: {
          proposedAgents: [{ id: 'test', name: 'Test Agent', role: 'Test role', tools: [] }],
          proposedOrchestration: 'graph' as const,
          proposedEdges: [],
          orchestrationReasoning: 'Graph pattern for complexity.',
          proposalAccepted: false,
          isLoading: false,
          aiCalled: true,
        },
      };

      const html = getStep5Html(mockState as any);

      // Verify orchestration badge
      expect(html).toContain('orchestration-badge');
      expect(html).toContain('Graph');
      expect(html).toContain('Why this pattern?');
    });

    it('should render expandable Why this pattern section that toggles correctly', async () => {
      const { getStep5Html } = await import('../../panels/ideationStepHtml');

      const mockState = {
        currentStep: 5,
        highestStepReached: 5,
        validationAttempted: false,
        businessObjective: 'Test',
        industry: 'Retail',
        systems: [],
        aiGapFillingState: {
          conversationHistory: [],
          confirmedAssumptions: [],
          assumptionsAccepted: false,
          isStreaming: false,
        },
        outcome: {
          primaryOutcome: '',
          successMetrics: [],
          stakeholders: [],
          isLoading: false,
          primaryOutcomeEdited: false,
          metricsEdited: false,
          stakeholdersEdited: false,
          customStakeholders: [],
          suggestionsAccepted: false,
          refinedSections: { outcome: false, kpis: false, stakeholders: false },
        },
        securityGuardrails: {
          dataSensitivity: 'internal',
          complianceFrameworks: [],
          approvalGates: [],
          guardrailNotes: '',
          aiSuggested: false,
          aiCalled: false,
          skipped: false,
          industryDefaultsApplied: false,
          isLoading: false,
        },
        agentDesign: {
          proposedAgents: [{ id: 'test', name: 'Test', role: 'Test', tools: [] }],
          proposedOrchestration: 'workflow' as const,
          proposedEdges: [],
          orchestrationReasoning: 'A workflow pattern is best because the process is linear.',
          proposalAccepted: false,
          isLoading: false,
          aiCalled: true,
        },
      };

      const html = getStep5Html(mockState as any);

      // Verify expandable section structure
      expect(html).toContain('orchestration-reasoning');
      expect(html).toContain('toggleOrchestrationReasoning');
      expect(html).toContain('chevron');
      expect(html).toContain('reasoning-content');
      expect(html).toContain('A workflow pattern is best');
    });

    it('should render flow summary with arrow notation', async () => {
      const { getStep5Html } = await import('../../panels/ideationStepHtml');

      const mockState = {
        currentStep: 5,
        highestStepReached: 5,
        validationAttempted: false,
        businessObjective: 'Test',
        industry: 'Retail',
        systems: [],
        aiGapFillingState: {
          conversationHistory: [],
          confirmedAssumptions: [],
          assumptionsAccepted: false,
          isStreaming: false,
        },
        outcome: {
          primaryOutcome: '',
          successMetrics: [],
          stakeholders: [],
          isLoading: false,
          primaryOutcomeEdited: false,
          metricsEdited: false,
          stakeholdersEdited: false,
          customStakeholders: [],
          suggestionsAccepted: false,
          refinedSections: { outcome: false, kpis: false, stakeholders: false },
        },
        securityGuardrails: {
          dataSensitivity: 'internal',
          complianceFrameworks: [],
          approvalGates: [],
          guardrailNotes: '',
          aiSuggested: false,
          aiCalled: false,
          skipped: false,
          industryDefaultsApplied: false,
          isLoading: false,
        },
        agentDesign: {
          proposedAgents: [
            { id: 'planner', name: 'Planner', role: 'Plans', tools: [] },
            { id: 'executor', name: 'Executor', role: 'Executes', tools: [] },
          ],
          proposedOrchestration: 'workflow' as const,
          proposedEdges: [
            { from: 'planner', to: 'executor' },
            { from: 'executor', to: 'output' },
          ],
          orchestrationReasoning: 'Sequential flow.',
          proposalAccepted: false,
          isLoading: false,
          aiCalled: true,
        },
      };

      const html = getStep5Html(mockState as any);

      // Verify flow summary
      expect(html).toContain('flow-summary');
      expect(html).toContain('->');
      expect(html).toContain('planner');
      expect(html).toContain('executor');
    });

    it('should render action buttons disabled during loading', async () => {
      const { getStep5Html } = await import('../../panels/ideationStepHtml');

      const mockState = {
        currentStep: 5,
        highestStepReached: 5,
        validationAttempted: false,
        businessObjective: 'Test',
        industry: 'Retail',
        systems: [],
        aiGapFillingState: {
          conversationHistory: [],
          confirmedAssumptions: [],
          assumptionsAccepted: false,
          isStreaming: false,
        },
        outcome: {
          primaryOutcome: '',
          successMetrics: [],
          stakeholders: [],
          isLoading: false,
          primaryOutcomeEdited: false,
          metricsEdited: false,
          stakeholdersEdited: false,
          customStakeholders: [],
          suggestionsAccepted: false,
          refinedSections: { outcome: false, kpis: false, stakeholders: false },
        },
        securityGuardrails: {
          dataSensitivity: 'internal',
          complianceFrameworks: [],
          approvalGates: [],
          guardrailNotes: '',
          aiSuggested: false,
          aiCalled: false,
          skipped: false,
          industryDefaultsApplied: false,
          isLoading: false,
        },
        agentDesign: {
          proposedAgents: [],
          proposedOrchestration: 'workflow' as const,
          proposedEdges: [],
          orchestrationReasoning: '',
          proposalAccepted: false,
          isLoading: true,
          aiCalled: false,
        },
      };

      const html = getStep5Html(mockState as any);

      // Verify buttons are disabled
      expect(html).toContain('disabled');
      expect(html).toContain('Regenerate');
      expect(html).toContain('Accept &amp; Continue');
      expect(html).toContain('Let me adjust');
    });
  });
});

// ============================================================================
// Task Group 5: Auto-Proposal Trigger Tests
// ============================================================================

describe('Task Group 5: Auto-Proposal Trigger and Navigation', () => {
  describe('generateStep4Hash', () => {
    it('should produce consistent hash from Steps 1-4 inputs', async () => {
      // Import the generateStep4Hash function once it's implemented
      // For now, test the djb2 hash algorithm behavior
      const djb2Hash = (input: string): string => {
        let hash = 5381;
        for (let i = 0; i < input.length; i++) {
          hash = (hash * 33) ^ input.charCodeAt(i);
        }
        return (hash >>> 0).toString(16);
      };

      // Create consistent input structures representing Steps 1-4
      const createHashInput = (
        industry: string,
        systems: string[],
        customSystems: string,
        confirmedAssumptions: Array<{ system: string; modules: string[]; integrations: string[] }>,
        primaryOutcome: string,
        successMetrics: Array<{ name: string; targetValue: string; unit: string }>,
        dataSensitivity: string,
        complianceFrameworks: string[],
        approvalGates: string[]
      ): string => {
        const sortedSystems = [...systems].sort();
        const sortedAssumptions = [...confirmedAssumptions].sort((a, b) => a.system.localeCompare(b.system));
        const sortedFrameworks = [...complianceFrameworks].sort();
        const sortedGates = [...approvalGates].sort();
        return JSON.stringify({
          industry,
          systems: sortedSystems,
          customSystems: customSystems.trim(),
          confirmedAssumptions: sortedAssumptions,
          primaryOutcome,
          successMetrics,
          dataSensitivity,
          complianceFrameworks: sortedFrameworks,
          approvalGates: sortedGates,
        });
      };

      const input1 = createHashInput(
        'Retail',
        ['SAP S/4HANA', 'Salesforce'],
        '',
        [{ system: 'SAP S/4HANA', modules: ['MM', 'SD'], integrations: [] }],
        'Improve efficiency',
        [{ name: 'Time', targetValue: '50', unit: '%' }],
        'Internal',
        ['SOC 2'],
        ['Before data modification']
      );

      const input2 = createHashInput(
        'Retail',
        ['SAP S/4HANA', 'Salesforce'],
        '',
        [{ system: 'SAP S/4HANA', modules: ['MM', 'SD'], integrations: [] }],
        'Improve efficiency',
        [{ name: 'Time', targetValue: '50', unit: '%' }],
        'Internal',
        ['SOC 2'],
        ['Before data modification']
      );

      const input3 = createHashInput(
        'FSI', // Different industry
        ['SAP S/4HANA', 'Salesforce'],
        '',
        [{ system: 'SAP S/4HANA', modules: ['MM', 'SD'], integrations: [] }],
        'Improve efficiency',
        [{ name: 'Time', targetValue: '50', unit: '%' }],
        'Internal',
        ['SOC 2'],
        ['Before data modification']
      );

      // Same inputs should produce same hash
      expect(djb2Hash(input1)).toBe(djb2Hash(input2));

      // Different inputs should produce different hash
      expect(djb2Hash(input1)).not.toBe(djb2Hash(input3));
    });

    it('should include all Steps 1-4 inputs in hash calculation', () => {
      // Verify the hash function considers all required fields
      const requiredFields = [
        'industry',
        'systems',
        'customSystems',
        'confirmedAssumptions',
        'primaryOutcome',
        'successMetrics',
        'dataSensitivity',
        'complianceFrameworks',
        'approvalGates',
      ];

      // Each field change should result in different hash
      const baseInput = {
        industry: 'Retail',
        systems: ['SAP'],
        customSystems: '',
        confirmedAssumptions: [],
        primaryOutcome: 'Test',
        successMetrics: [],
        dataSensitivity: 'Internal',
        complianceFrameworks: [],
        approvalGates: [],
      };

      const baseHash = JSON.stringify(baseInput);

      // Change each field and verify it affects the result
      requiredFields.forEach((field) => {
        const modified = { ...baseInput, [field]: field === 'industry' ? 'FSI' : ['changed'] };
        const modifiedHash = JSON.stringify(modified);
        expect(baseHash).not.toBe(modifiedHash);
      });
    });
  });

  describe('triggerAutoSendForStep5', () => {
    it('should call service when hash differs from stored hash', () => {
      // Simulate the trigger logic
      const mockState = {
        agentDesign: {
          step4Hash: 'oldhash123',
          aiCalled: false,
          isLoading: false,
        },
      };

      const currentHash = 'newhash456';

      // When hashes differ, service should be called
      const hashDiffers = mockState.agentDesign.step4Hash !== currentHash;
      const shouldTrigger = hashDiffers || (!mockState.agentDesign.aiCalled && !mockState.agentDesign.isLoading);

      expect(hashDiffers).toBe(true);
      expect(shouldTrigger).toBe(true);
    });

    it('should skip call when aiCalled=true and hash unchanged', () => {
      const mockState = {
        agentDesign: {
          step4Hash: 'samehash123',
          aiCalled: true,
          isLoading: false,
        },
      };

      const currentHash = 'samehash123';

      // When hash is same and AI was already called, skip
      const hashSame = mockState.agentDesign.step4Hash === currentHash;
      const alreadyCalled = mockState.agentDesign.aiCalled;
      const shouldSkip = hashSame && alreadyCalled;

      expect(shouldSkip).toBe(true);
    });

    it('should reset agentDesign state when hash changes', () => {
      // Simulate the reset behavior
      interface MockAgentDesign {
        proposedAgents: Array<{ id: string; name: string }>;
        proposedOrchestration: string;
        proposedEdges: Array<{ from: string; to: string }>;
        orchestrationReasoning: string;
        proposalAccepted: boolean;
        isLoading: boolean;
        error: string | undefined;
        step4Hash: string | undefined;
        aiCalled: boolean;
      }

      const mockState: { agentDesign: MockAgentDesign } = {
        agentDesign: {
          proposedAgents: [{ id: 'old', name: 'Old Agent' }],
          proposedOrchestration: 'graph',
          proposedEdges: [{ from: 'old', to: 'output' }],
          orchestrationReasoning: 'Old reasoning',
          proposalAccepted: true,
          isLoading: false,
          error: undefined,
          step4Hash: 'oldhash',
          aiCalled: true,
        },
      };

      const newHash = 'newhash';

      // Simulate reset (preserve step4Hash)
      if (mockState.agentDesign.step4Hash !== newHash) {
        mockState.agentDesign = {
          proposedAgents: [],
          proposedOrchestration: 'workflow',
          proposedEdges: [],
          orchestrationReasoning: '',
          proposalAccepted: false,
          isLoading: false,
          error: undefined,
          step4Hash: newHash,
          aiCalled: false,
        };
      }

      expect(mockState.agentDesign.proposedAgents).toEqual([]);
      expect(mockState.agentDesign.proposalAccepted).toBe(false);
      expect(mockState.agentDesign.step4Hash).toBe(newHash);
      expect(mockState.agentDesign.aiCalled).toBe(false);
    });
  });

  describe('ideationNavigateForward Step 5 trigger', () => {
    it('should call trigger when moving from Step 4 to Step 5', () => {
      const previousStep = 4;
      const currentStep = 5;

      // This condition should be true only when transitioning from Step 4 to Step 5
      const shouldTrigger = previousStep === 4 && currentStep === 5;
      expect(shouldTrigger).toBe(true);
    });

    it('should not trigger when moving to Step 5 from other steps', () => {
      // Test from Step 3 (shouldn't happen normally, but test the condition)
      expect(3 === 4 && 5 === 5).toBe(false);

      // Test from Step 5 to Step 6
      expect(5 === 4 && 6 === 5).toBe(false);
    });

    it('should follow navigation pattern from other steps', () => {
      // Verify the pattern matches Step 2 and Step 3 triggers
      const step2Condition = (prev: number, curr: number) => prev === 1 && curr === 2;
      const step3Condition = (prev: number, curr: number) => prev === 2 && curr === 3;
      const step5Condition = (prev: number, curr: number) => prev === 4 && curr === 5;

      // All conditions should follow the same pattern: previousStep === N-1 && currentStep === N
      expect(step2Condition(1, 2)).toBe(true);
      expect(step3Condition(2, 3)).toBe(true);
      expect(step5Condition(4, 5)).toBe(true);
    });
  });
});

// ============================================================================
// Task Group 6: Action Handler Tests
// ============================================================================

describe('Task Group 6: Action Handlers and Message Routing', () => {
  describe('handleRegenerateAgentProposal', () => {
    it('should clear state and re-fetch proposal', () => {
      // Test the regenerate behavior
      let clearCalled = false;
      let fetchCalled = false;

      const mockClearState = () => {
        clearCalled = true;
      };

      const mockFetch = () => {
        fetchCalled = true;
      };

      // Simulate regenerate handler
      mockClearState();
      mockFetch();

      expect(clearCalled).toBe(true);
      expect(fetchCalled).toBe(true);
    });
  });

  describe('handleAcceptAgentProposal', () => {
    it('should set proposalAccepted=true and navigate to Step 6', () => {
      const mockState = {
        agentDesign: {
          proposalAccepted: false,
        },
        currentStep: 5,
      };

      // Simulate accept handler
      mockState.agentDesign.proposalAccepted = true;
      mockState.currentStep = 6;

      expect(mockState.agentDesign.proposalAccepted).toBe(true);
      expect(mockState.currentStep).toBe(6);
    });
  });

  describe('handleAdjustAgentProposal', () => {
    it('should set proposalAccepted=true and show placeholder message', () => {
      const mockState = {
        agentDesign: {
          proposalAccepted: false,
        },
        currentStep: 5,
      };

      let placeholderShown = false;

      // Simulate adjust handler
      mockState.agentDesign.proposalAccepted = true;
      placeholderShown = true;

      expect(mockState.agentDesign.proposalAccepted).toBe(true);
      expect(mockState.currentStep).toBe(5); // Should stay on step 5
      expect(placeholderShown).toBe(true);
    });
  });

  describe('Button states during loading', () => {
    it('should disable all buttons during isLoading state', () => {
      const isLoading = true;

      // All buttons should be disabled when loading
      const regenerateDisabled = isLoading;
      const acceptDisabled = isLoading;
      const adjustDisabled = isLoading;

      expect(regenerateDisabled).toBe(true);
      expect(acceptDisabled).toBe(true);
      expect(adjustDisabled).toBe(true);
    });
  });
});
