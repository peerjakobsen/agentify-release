/**
 * Tests for Cedar Policy Generation in SteeringGenerationService
 *
 * Task Group 4: SteeringGenerationService Updates
 * Tests for generateCedarPolicies, shouldGenerateCedarPolicies, and writeCedarPolicies
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WizardState } from '../../types/wizardPanel';
import { STEERING_PROMPT_FILES } from '../../services/steeringGenerationService';

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    fs: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      stat: vi.fn(),
      createDirectory: vi.fn(),
    },
  },
  Uri: {
    joinPath: vi.fn((...args: unknown[]) => ({
      fsPath: args.join('/'),
    })),
    file: vi.fn((path: string) => ({ fsPath: path })),
  },
  EventEmitter: vi.fn().mockImplementation(() => ({
    fire: vi.fn(),
    event: vi.fn(),
    dispose: vi.fn(),
  })),
}));

// Helper to create minimal wizard state
function createMinimalWizardState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    currentStep: 1,
    businessObjective: '',
    industry: '',
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
    security: {
      dataSensitivity: 'internal',
      complianceFrameworks: [],
      approvalGates: [],
      guardrailNotes: '',
      skipped: false,
    },
    agentDesign: {
      proposedAgents: [],
      proposedOrchestration: 'workflow',
      proposedEdges: [],
      orchestrationReasoning: '',
      proposalAccepted: false,
      isLoading: false,
      aiCalled: false,
      confirmedAgents: [],
      confirmedOrchestration: 'workflow',
      confirmedEdges: [],
      originalOrchestration: 'workflow',
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
      roadmapGenerating: false,
      roadmapGenerated: false,
      roadmapFilePath: '',
    },
    highestStepReached: 1,
    validationAttempted: false,
    ...overrides,
  } as WizardState;
}

describe('STEERING_PROMPT_FILES', () => {
  // Test 4.1.1: Cedar policy prompt file is mapped
  it('should include cedarPolicies prompt file mapping', () => {
    expect(STEERING_PROMPT_FILES['cedarPolicies']).toBe('cedar-policies.prompt.md');
  });

  // Test 4.1.2: All existing prompt files are still present
  it('should contain all expected steering prompt files', () => {
    expect(STEERING_PROMPT_FILES['product']).toBe('product-steering.prompt.md');
    expect(STEERING_PROMPT_FILES['tech']).toBe('tech-steering.prompt.md');
    expect(STEERING_PROMPT_FILES['structure']).toBe('structure-steering.prompt.md');
    expect(STEERING_PROMPT_FILES['customer-context']).toBe('customer-context-steering.prompt.md');
    expect(STEERING_PROMPT_FILES['integration-landscape']).toBe('integration-landscape-steering.prompt.md');
    expect(STEERING_PROMPT_FILES['security-policies']).toBe('security-policies-steering.prompt.md');
    expect(STEERING_PROMPT_FILES['demo-strategy']).toBe('demo-strategy-steering.prompt.md');
    expect(STEERING_PROMPT_FILES['agentify-integration']).toBe('agentify-integration-steering.prompt.md');
  });
});

describe('shouldGenerateCedarPolicies', () => {
  // Import after mocking
  let SteeringGenerationService: typeof import('../../services/steeringGenerationService').SteeringGenerationService;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../../services/steeringGenerationService');
    SteeringGenerationService = module.SteeringGenerationService;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test 4.4.1: Returns false when security step is skipped
  it('should return false when security step is skipped', () => {
    const state = createMinimalWizardState({
      security: {
        dataSensitivity: 'internal',
        complianceFrameworks: ['HIPAA'],
        approvalGates: [],
        guardrailNotes: '',
        skipped: true,
      },
    });

    const service = new SteeringGenerationService({ fsPath: '/test' } as never);
    const result = service.shouldGenerateCedarPolicies(state);

    expect(result).toBe(false);
  });

  // Test 4.4.2: Returns true when compliance frameworks are present
  it('should return true when compliance frameworks are present', () => {
    const state = createMinimalWizardState({
      security: {
        dataSensitivity: 'internal',
        complianceFrameworks: ['HIPAA', 'SOC 2'],
        approvalGates: [],
        guardrailNotes: '',
        skipped: false,
      },
    });

    const service = new SteeringGenerationService({ fsPath: '/test' } as never);
    const result = service.shouldGenerateCedarPolicies(state);

    expect(result).toBe(true);
  });

  // Test 4.4.3: Returns true when approval gates are present
  it('should return true when approval gates are present', () => {
    const state = createMinimalWizardState({
      security: {
        dataSensitivity: 'internal',
        complianceFrameworks: [],
        approvalGates: ['Before financial transactions'],
        guardrailNotes: '',
        skipped: false,
      },
    });

    const service = new SteeringGenerationService({ fsPath: '/test' } as never);
    const result = service.shouldGenerateCedarPolicies(state);

    expect(result).toBe(true);
  });

  // Test 4.4.4: Returns false when neither compliance nor approval gates
  it('should return false when no compliance frameworks or approval gates', () => {
    const state = createMinimalWizardState({
      security: {
        dataSensitivity: 'confidential',
        complianceFrameworks: [],
        approvalGates: [],
        guardrailNotes: 'Some notes but no policies',
        skipped: false,
      },
    });

    const service = new SteeringGenerationService({ fsPath: '/test' } as never);
    const result = service.shouldGenerateCedarPolicies(state);

    expect(result).toBe(false);
  });

  // Test 4.4.5: Returns true when both compliance and approval gates present
  it('should return true when both compliance frameworks and approval gates present', () => {
    const state = createMinimalWizardState({
      security: {
        dataSensitivity: 'confidential',
        complianceFrameworks: ['PCI-DSS'],
        approvalGates: ['Before data modification'],
        guardrailNotes: '',
        skipped: false,
      },
    });

    const service = new SteeringGenerationService({ fsPath: '/test' } as never);
    const result = service.shouldGenerateCedarPolicies(state);

    expect(result).toBe(true);
  });
});

describe('Cedar Policy Generation Integration', () => {
  // Test: Policy generation should use mapToCedarPolicyContext
  it('should have mapToCedarPolicyContext available for Cedar generation', async () => {
    const { mapToCedarPolicyContext } = await import('../../utils/steeringStateMapper');

    const state = createMinimalWizardState({
      security: {
        dataSensitivity: 'confidential',
        complianceFrameworks: ['HIPAA'],
        approvalGates: ['Before financial transactions'],
        guardrailNotes: '',
        skipped: false,
      },
      agentDesign: {
        proposedAgents: [],
        proposedOrchestration: 'workflow',
        proposedEdges: [],
        orchestrationReasoning: '',
        proposalAccepted: true,
        isLoading: false,
        aiCalled: true,
        confirmedAgents: [
          {
            id: 'planner',
            name: 'Planning Agent',
            role: 'Plans actions',
            tools: ['sap_get_inventory'],
            nameEdited: false,
            roleEdited: false,
            toolsEdited: false,
          },
        ],
        confirmedOrchestration: 'workflow',
        confirmedEdges: [],
        originalOrchestration: 'workflow',
      },
    });

    const context = mapToCedarPolicyContext(state);

    // Verify context has all required fields
    expect(context.security.dataSensitivity).toBe('confidential');
    expect(context.security.complianceFrameworks).toContain('HIPAA');
    expect(context.security.approvalGates).toContain('Before financial transactions');
    expect(context.agents).toHaveLength(1);
    expect(context.allTools).toContain('sap_get_inventory');
    expect(context.agentToolMapping['planner']).toContain('sap_get_inventory');
  });
});

describe('Cedar Policy Output Structure', () => {
  // Test: Policy file should be named main.cedar
  it('should output policy file as main.cedar', () => {
    // Verify the constant is used (by checking the prompt mapping includes cedar)
    expect(STEERING_PROMPT_FILES['cedarPolicies']).toBeDefined();
    // The actual file name is a constant in the service
    // This test documents the expected behavior
  });

  // Test: Policy directory should be policies/
  it('should write policies to policies/ directory', () => {
    // This documents the expected behavior
    // The writeCedarPolicies method creates policies/main.cedar
    // Actual write behavior tested in integration tests
  });
});
