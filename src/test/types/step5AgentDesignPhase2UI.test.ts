/**
 * Tests for Agent Design Phase 2 - Editing UI Components
 * Task Group 5: Phase 2 Editing UI for Step 5 Agent Design Editing feature
 */

import { describe, it, expect } from 'vitest';
import { getStep5Html } from '../../panels/ideationStepHtml';

// ============================================================================
// Task 5.1: 6 Focused Tests for Phase 2 Editing UI
// ============================================================================

// Helper to create a mock state for Phase 2 testing
const createPhase2MockState = (overrides: Record<string, unknown> = {}) => ({
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
        nameEdited: false,
        roleEdited: false,
        toolsEdited: false,
      },
      {
        id: 'executor',
        name: 'Execution Agent',
        role: 'Executes tasks',
        tools: ['sap_update_inventory'],
        nameEdited: false,
        roleEdited: false,
        toolsEdited: false,
      },
    ],
    proposedOrchestration: 'workflow' as const,
    proposedEdges: [
      { from: 'planner', to: 'executor' },
    ],
    orchestrationReasoning: 'Workflow is best for linear processes.',
    proposalAccepted: true, // Phase 2 mode
    isLoading: false,
    aiCalled: true,
    confirmedAgents: [],
    confirmedOrchestration: 'workflow' as const,
    confirmedEdges: [],
    originalOrchestration: 'workflow' as const,
    edgeSuggestion: undefined,
    ...overrides,
  },
});

describe('Task Group 5: Phase 2 Editing UI', () => {
  describe('Test 1: Agent card transforms to editable form in Phase 2', () => {
    it('should render editable form fields for agent cards in Phase 2', () => {
      const mockState = createPhase2MockState();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html = getStep5Html(mockState as any);

      // Verify editable form elements are present for name
      expect(html).toContain('input');
      expect(html).toContain('agent-name-input');
      expect(html).toContain('updateAgentName');

      // Verify editable form elements for role
      expect(html).toContain('textarea');
      expect(html).toContain('agent-role-input');
      expect(html).toContain('updateAgentRole');

      // Verify tool tag input exists with keydown handler
      // The handleToolInputKeydown function calls addAgentTool internally via JS
      expect(html).toContain('tool-input');
      expect(html).toContain('handleToolInputKeydown');
    });

    it('should NOT render editable form in Phase 1', () => {
      const mockState = createPhase2MockState({ proposalAccepted: false });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html = getStep5Html(mockState as any);

      // In Phase 1, we should NOT have editable agent inputs
      expect(html).not.toContain('agent-name-input');
      expect(html).not.toContain('agent-role-input');
    });
  });

  describe('Test 2: Tool tag input adds tags on Enter/comma', () => {
    it('should render tool tag input with proper keydown handler', () => {
      const mockState = createPhase2MockState();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html = getStep5Html(mockState as any);

      // Verify tool input with keydown handler for Enter/comma
      expect(html).toContain('tool-input');
      expect(html).toContain('handleToolInputKeydown');

      // Verify existing tools are displayed as chips with remove button
      expect(html).toContain('module-chip');
      expect(html).toContain('sap_get_inventory');
      expect(html).toContain('removeAgentTool');
    });
  });

  describe('Test 3: Orchestration dropdown shows AI recommendation badge', () => {
    it('should render orchestration dropdown with AI Suggested badge on original pattern', () => {
      const mockState = createPhase2MockState({
        proposedOrchestration: 'graph',
        originalOrchestration: 'workflow',
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html = getStep5Html(mockState as any);

      // Verify dropdown is present with all options
      expect(html).toContain('<select');
      expect(html).toContain('orchestration-select');
      expect(html).toContain('updateOrchestration');
      expect(html).toContain('graph');
      expect(html).toContain('swarm');
      expect(html).toContain('workflow');

      // Verify AI Suggested badge is shown on original orchestration
      expect(html).toContain('ai-suggested-badge');
      expect(html).toContain('AI Suggested');
    });
  });

  describe('Test 4: Edge table populates dropdowns from agent list', () => {
    it('should render edge table with agent name dropdowns', () => {
      const mockState = createPhase2MockState();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html = getStep5Html(mockState as any);

      // Verify edge table structure
      expect(html).toContain('edge-table');
      expect(html).toContain('edge-row');

      // Verify dropdowns contain agent names
      expect(html).toContain('Planning Agent');
      expect(html).toContain('Execution Agent');

      // Verify edge controls
      expect(html).toContain('updateEdge');
      expect(html).toContain('removeEdge');
      expect(html).toContain('addEdge');
    });
  });

  describe('Test 5: "+ Add Agent" creates new empty card', () => {
    it('should render Add Agent button with proper styling and handler', () => {
      const mockState = createPhase2MockState();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html = getStep5Html(mockState as any);

      // Verify Add Agent button exists with correct styling
      expect(html).toContain('add-agent-btn');
      expect(html).toContain('+ Add Agent');
      expect(html).toContain('addAgent()');
    });
  });

  describe('Test 6: "Remove Agent" shows confirmation when agent has edges', () => {
    it('should render Remove Agent button with proper handler', () => {
      const mockState = createPhase2MockState();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html = getStep5Html(mockState as any);

      // Verify Remove Agent button exists on each card
      expect(html).toContain('remove-agent-btn');
      expect(html).toContain('removeAgent');

      // The confirmation logic is handled in tabbedPanel.ts (already tested in Task 3.3)
      // Here we just verify the button renders correctly
    });
  });

  describe('Additional Phase 2 UI Tests', () => {
    it('should render edge suggestion card when visible', () => {
      const mockState = createPhase2MockState({
        edgeSuggestion: {
          edges: [
            { from: 'planner', to: 'executor' },
            { from: 'executor', to: 'output' },
          ],
          visible: true,
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html = getStep5Html(mockState as any);

      // Verify edge suggestion card is rendered
      expect(html).toContain('edge-suggestion-card');
      expect(html).toContain('applyEdgeSuggestion');
      expect(html).toContain('dismissEdgeSuggestion');
      expect(html).toContain('Apply');
      expect(html).toContain('Dismiss');
    });

    it('should NOT render edge suggestion card when not visible', () => {
      const mockState = createPhase2MockState({
        edgeSuggestion: undefined,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html = getStep5Html(mockState as any);

      expect(html).not.toContain('edge-suggestion-card');
    });

    it('should render validation warnings for orphan agents', () => {
      // Create state with an orphan agent (agent not connected in edges)
      // To detect orphans, we need edges that DON'T include all agents
      const mockState = createPhase2MockState({
        proposedAgents: [
          {
            id: 'planner',
            name: 'Planning Agent',
            role: 'Plans',
            tools: [],
            nameEdited: false,
            roleEdited: false,
            toolsEdited: false,
          },
          {
            id: 'executor',
            name: 'Executor Agent',
            role: 'Executes',
            tools: [],
            nameEdited: false,
            roleEdited: false,
            toolsEdited: false,
          },
          {
            id: 'orphan',
            name: 'Orphan Agent',
            role: 'No connections',
            tools: [],
            nameEdited: false,
            roleEdited: false,
            toolsEdited: false,
          },
        ],
        // Only planner->executor edge, orphan is not connected
        proposedEdges: [{ from: 'planner', to: 'executor' }],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html = getStep5Html(mockState as any);

      // Verify validation warnings section exists (orphan agent detected)
      expect(html).toContain('validation-warnings');
      expect(html).toContain('Orphan Agent');
    });

    it('should render Confirm Design button in Phase 2', () => {
      const mockState = createPhase2MockState();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html = getStep5Html(mockState as any);

      // Verify Confirm Design button is present
      expect(html).toContain('confirm-design-btn');
      expect(html).toContain('Confirm Design');
      expect(html).toContain('confirmDesign');
    });

    it('should NOT render Confirm Design button in Phase 1', () => {
      const mockState = createPhase2MockState({ proposalAccepted: false });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html = getStep5Html(mockState as any);

      // Confirm Design should not be in Phase 1
      expect(html).not.toContain('confirm-design-btn');
    });
  });
});
