/**
 * Tests for Step 6 HTML Rendering - Mock Data Strategy
 * Task Group 5: HTML Rendering and JSON Editor for Wizard Step 6
 */

import { describe, it, expect } from 'vitest';
import { getStep6Html } from '../../panels/ideationStepHtml';
import { createDefaultMockDataState, createDefaultAgentDesignState } from '../../types/wizardPanel';
import type { MockDataState, MockToolDefinition, IdeationState } from '../../types/wizardPanel';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a minimal IdeationState for testing Step 6
 */
function createTestIdeationState(mockDataState?: Partial<MockDataState>): IdeationState {
  return {
    currentStep: 6,
    highestStepReached: 6,
    validationAttempted: false,
    businessObjective: 'Test objective',
    industry: 'Retail',
    systems: ['SAP S/4HANA'],
    aiGapFillingState: {
      conversationHistory: [],
      confirmedAssumptions: [],
      assumptionsAccepted: true,
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
      suggestionsAccepted: true,
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
      ...createDefaultAgentDesignState(),
      confirmedAgents: [
        {
          id: 'planner',
          name: 'Planning Agent',
          role: 'Plans the workflow',
          tools: ['sap_get_inventory', 'sap_query_orders'],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
        },
      ],
    },
    mockData: {
      ...createDefaultMockDataState(),
      ...mockDataState,
    },
  } as IdeationState;
}

/**
 * Create a sample MockToolDefinition for testing
 */
function createSampleMockDefinition(overrides?: Partial<MockToolDefinition>): MockToolDefinition {
  return {
    tool: 'sap_get_inventory',
    system: 'SAP S/4HANA',
    operation: 'getInventory',
    mockRequest: { material_id: 'string', plant: 'string' },
    mockResponse: { quantity: 0, unit: 'string', location: 'string' },
    sampleData: [
      { quantity: 100, unit: 'EA', location: 'Warehouse A' },
      { quantity: 50, unit: 'EA', location: 'Warehouse B' },
    ],
    expanded: true,
    requestEdited: false,
    responseEdited: false,
    sampleDataEdited: false,
    ...overrides,
  };
}

// ============================================================================
// Task 5.1: 5 Focused Tests for Step 6 HTML Rendering
// ============================================================================

describe('Task Group 5: Step 6 HTML Rendering', () => {
  describe('Test 1: Accordion rendering for each tool', () => {
    it('should render an accordion card for each mock definition', () => {
      const state = createTestIdeationState({
        mockDefinitions: [
          createSampleMockDefinition({ tool: 'sap_get_inventory', system: 'SAP S/4HANA', expanded: true }),
          createSampleMockDefinition({ tool: 'salesforce_query', system: 'Salesforce', expanded: false }),
        ],
        aiCalled: true,
      });

      const html = getStep6Html(state);

      // Should render accordion cards
      expect(html).toContain('mock-accordion-card');
      expect(html).toContain('sap_get_inventory');
      expect(html).toContain('salesforce_query');
      expect(html).toContain('SAP S/4HANA');
      expect(html).toContain('Salesforce');
    });

    it('should show expand/collapse toggle for each accordion', () => {
      const state = createTestIdeationState({
        mockDefinitions: [createSampleMockDefinition({ expanded: true })],
        aiCalled: true,
      });

      const html = getStep6Html(state);

      // Should have clickable header with toggle functionality
      expect(html).toContain('mock-accordion-header');
      expect(html).toContain('step6ToggleAccordion');
      // Should use VS Code codicon for chevron
      expect(html).toContain('codicon');
    });

    it('should track expanded state with CSS class', () => {
      const expandedState = createTestIdeationState({
        mockDefinitions: [createSampleMockDefinition({ expanded: true })],
        aiCalled: true,
      });
      const collapsedState = createTestIdeationState({
        mockDefinitions: [createSampleMockDefinition({ expanded: false })],
        aiCalled: true,
      });

      const expandedHtml = getStep6Html(expandedState);
      const collapsedHtml = getStep6Html(collapsedState);

      expect(expandedHtml).toContain('expanded');
      expect(collapsedHtml).not.toContain('mock-accordion-card expanded');
    });
  });

  describe('Test 2: JSON editor with syntax highlighting', () => {
    it('should render JSON editor for mock request schema', () => {
      const state = createTestIdeationState({
        mockDefinitions: [createSampleMockDefinition({ expanded: true })],
        aiCalled: true,
      });

      const html = getStep6Html(state);

      // Should have JSON editor textarea
      expect(html).toContain('json-editor');
      expect(html).toContain('step6UpdateRequest');
    });

    it('should render JSON editor for mock response schema', () => {
      const state = createTestIdeationState({
        mockDefinitions: [createSampleMockDefinition({ expanded: true })],
        aiCalled: true,
      });

      const html = getStep6Html(state);

      expect(html).toContain('step6UpdateResponse');
    });

    it('should render JSON in textarea editor', () => {
      const state = createTestIdeationState({
        mockDefinitions: [createSampleMockDefinition({ expanded: true })],
        aiCalled: true,
      });

      const html = getStep6Html(state);

      // Should have textarea for JSON editing
      expect(html).toContain('json-textarea');
      expect(html).toContain('json-editor');
    });
  });

  describe('Test 3: Sample data table rendering', () => {
    it('should render sample data table with columns from mockResponse schema', () => {
      const state = createTestIdeationState({
        mockDefinitions: [createSampleMockDefinition({ expanded: true })],
        aiCalled: true,
      });

      const html = getStep6Html(state);

      // Should render table with columns
      expect(html).toContain('sample-data-table');
      expect(html).toContain('quantity');
      expect(html).toContain('unit');
      expect(html).toContain('location');
    });

    it('should render sample data rows with inline input fields', () => {
      const state = createTestIdeationState({
        mockDefinitions: [createSampleMockDefinition({ expanded: true })],
        aiCalled: true,
      });

      const html = getStep6Html(state);

      // Should have input fields for editing
      expect(html).toContain('step6UpdateRow');
      expect(html).toContain('100'); // quantity value
      expect(html).toContain('Warehouse A'); // location value
    });

    it('should show add row button and delete row buttons', () => {
      const state = createTestIdeationState({
        mockDefinitions: [createSampleMockDefinition({ expanded: true })],
        aiCalled: true,
      });

      const html = getStep6Html(state);

      expect(html).toContain('step6AddRow');
      expect(html).toContain('step6DeleteRow');
    });

    it('should disable add row button when at 5 rows', () => {
      const state = createTestIdeationState({
        mockDefinitions: [
          createSampleMockDefinition({
            expanded: true,
            sampleData: [
              { quantity: 1, unit: 'EA', location: 'A' },
              { quantity: 2, unit: 'EA', location: 'B' },
              { quantity: 3, unit: 'EA', location: 'C' },
              { quantity: 4, unit: 'EA', location: 'D' },
              { quantity: 5, unit: 'EA', location: 'E' },
            ],
          }),
        ],
        aiCalled: true,
      });

      const html = getStep6Html(state);

      // Should show disabled add button with message
      expect(html).toContain('disabled');
      expect(html).toContain('5 rows');
    });
  });

  describe('Test 4: Validation warnings section', () => {
    it('should render validation warnings when tool has no sample data', () => {
      const state = createTestIdeationState({
        mockDefinitions: [
          createSampleMockDefinition({
            tool: 'empty_tool',
            sampleData: [],
            expanded: true,
          }),
        ],
        aiCalled: true,
      });

      const html = getStep6Html(state);

      // Should show validation warning
      expect(html).toContain('validation-warnings');
      expect(html).toContain('no sample data');
    });

    it('should render validation warnings when mockRequest is empty', () => {
      const state = createTestIdeationState({
        mockDefinitions: [
          createSampleMockDefinition({
            mockRequest: {},
            expanded: true,
          }),
        ],
        aiCalled: true,
      });

      const html = getStep6Html(state);

      expect(html).toContain('validation-warnings');
      expect(html).toContain('empty mockRequest');
    });

    it('should not block navigation (non-blocking warnings)', () => {
      const state = createTestIdeationState({
        mockDefinitions: [createSampleMockDefinition({ sampleData: [] })],
        aiCalled: true,
      });

      const html = getStep6Html(state);

      // Should show warnings but not disable navigation
      // The nav buttons are rendered separately, so warnings section should exist without disabled class on main content
      expect(html).toContain('validation-warnings');
      expect(html).toContain('non-blocking');
    });
  });

  describe('Test 5: Action buttons (Regenerate All, Import Sample Data)', () => {
    it('should render Regenerate All button', () => {
      const state = createTestIdeationState({
        mockDefinitions: [createSampleMockDefinition()],
        aiCalled: true,
      });

      const html = getStep6Html(state);

      expect(html).toContain('Regenerate All');
      expect(html).toContain('step6RegenerateAll');
    });

    it('should render Use Customer Terminology toggle', () => {
      const state = createTestIdeationState({
        mockDefinitions: [createSampleMockDefinition()],
        aiCalled: true,
        useCustomerTerminology: false,
      });

      const html = getStep6Html(state);

      expect(html).toContain('Use Customer Terminology');
      expect(html).toContain('step6ToggleTerminology');
    });

    it('should render Import Sample Data button inside accordion', () => {
      const state = createTestIdeationState({
        mockDefinitions: [createSampleMockDefinition({ expanded: true })],
        aiCalled: true,
      });

      const html = getStep6Html(state);

      expect(html).toContain('Import Sample Data');
      expect(html).toContain('step6ImportData');
    });

    it('should disable buttons during loading', () => {
      const state = createTestIdeationState({
        mockDefinitions: [],
        isLoading: true,
        aiCalled: true,
      });

      const html = getStep6Html(state);

      // Regenerate should be disabled during loading (disabled attribute comes before button text)
      expect(html).toMatch(/disabled[^>]*>[\s\S]*Regenerate All/);
    });
  });

  // ============================================================================
  // Additional Tests for Loading and Error States
  // ============================================================================

  describe('Loading and Error States', () => {
    it('should render loading state during AI generation', () => {
      const state = createTestIdeationState({
        isLoading: true,
        aiCalled: false,
      });

      const html = getStep6Html(state);

      expect(html).toContain('mock-data-loading');
      expect(html).toContain('typing-indicator');
    });

    it('should render error state if AI call fails', () => {
      const state = createTestIdeationState({
        isLoading: false,
        error: 'Failed to generate mock definitions',
        aiCalled: true,
      });

      const html = getStep6Html(state);

      expect(html).toContain('mock-data-error');
      expect(html).toContain('Failed to generate mock definitions');
    });
  });

  // ============================================================================
  // Import Summary Display Tests
  // ============================================================================

  describe('Import Summary Display', () => {
    it('should display import summary when present', () => {
      const state = createTestIdeationState({
        mockDefinitions: [
          {
            ...createSampleMockDefinition({ expanded: true }),
            importSummary: 'Imported 3 rows. Mapped: quantity, unit. Ignored: extra_field.',
          } as MockToolDefinition & { importSummary?: string },
        ],
        aiCalled: true,
      });

      const html = getStep6Html(state);

      // Import summary should be rendered if present in state
      // Note: This tests the rendering, actual import summary storage is in logic handler
      expect(html).toContain('import-summary');
    });
  });
});
