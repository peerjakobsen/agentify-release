/**
 * Ideation Step HTML Generators
 * HTML rendering functions for each wizard step
 */

import {
  WIZARD_STEPS,
  INDUSTRY_OPTIONS,
  SYSTEM_OPTIONS,
  DATA_SENSITIVITY_OPTIONS,
  COMPLIANCE_FRAMEWORK_OPTIONS,
  APPROVAL_GATE_OPTIONS,
  STAKEHOLDER_OPTIONS,
} from './ideationConstants';
import type {
  MockDataState,
  MockToolDefinition,
  PersistedFileMetadata,
  DemoStrategyState,
  AhaMoment,
  NarrativeScene,
  GenerationState,
  StepSummary,
  StepValidationStatus,
} from '../types/wizardPanel';
import { STEERING_FILES, ROOT_DOC_FILES } from '../types/wizardPanel';
import { getFileReuploadIndicatorHtml } from './resumeBannerHtml';

/**
 * Total Phase 1 steering files (7 files in .kiro/steering/)
 * DEMO.md is now generated separately in Phase 4
 */
const TOTAL_STEERING_FILES = STEERING_FILES.length;

// ============================================================================
// Types (local to tabbedPanel - should be consolidated later)
// ============================================================================

interface SystemAssumption {
  system: string;
  modules: string[];
  integrations: string[];
  source: 'ai-proposed' | 'user-corrected';
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  parsedAssumptions?: SystemAssumption[];
}

interface AIGapFillingState {
  conversationHistory: ConversationMessage[];
  confirmedAssumptions: SystemAssumption[];
  assumptionsAccepted: boolean;
  isStreaming: boolean;
  step1InputHash?: string;
  streamingError?: string;
}

interface SuccessMetric {
  name: string;
  targetValue: string;
  unit: string;
}

interface RefinedSectionsState {
  outcome: boolean;
  kpis: boolean;
  stakeholders: boolean;
}

interface OutcomeDefinitionState {
  primaryOutcome: string;
  successMetrics: SuccessMetric[];
  stakeholders: string[];
  isLoading: boolean;
  loadingError?: string;
  primaryOutcomeEdited: boolean;
  metricsEdited: boolean;
  stakeholdersEdited: boolean;
  customStakeholders: string[];
  suggestionsAccepted: boolean;
  step2AssumptionsHash?: string;
  refinedSections: RefinedSectionsState;
}

interface SecurityGuardrailsState {
  dataSensitivity: string;
  complianceFrameworks: string[];
  approvalGates: string[];
  guardrailNotes: string;
  aiSuggested: boolean;
  aiCalled: boolean;
  skipped: boolean;
  industryDefaultsApplied: boolean;
  isLoading: boolean;
}

// Step 5: Agent Design types
type OrchestrationPattern = 'graph' | 'swarm' | 'workflow';

interface ProposedAgent {
  id: string;
  name: string;
  role: string;
  tools: string[];
  // Task 5.2: Phase 2 edited flags
  nameEdited?: boolean;
  roleEdited?: boolean;
  toolsEdited?: boolean;
}

interface ProposedEdge {
  from: string;
  to: string;
  condition?: string;
}

// Task 5.5: Edge suggestion interface
interface EdgeSuggestion {
  edges: ProposedEdge[];
  visible: boolean;
}

interface AgentDesignState {
  proposedAgents: ProposedAgent[];
  proposedOrchestration: OrchestrationPattern;
  proposedEdges: ProposedEdge[];
  orchestrationReasoning: string;
  proposalAccepted: boolean;
  isLoading: boolean;
  error?: string;
  step4Hash?: string;
  aiCalled: boolean;
  // Task 5.4: Phase 2 fields
  originalOrchestration?: OrchestrationPattern;
  confirmedAgents?: ProposedAgent[];
  confirmedOrchestration?: OrchestrationPattern;
  confirmedEdges?: ProposedEdge[];
  edgeSuggestion?: EdgeSuggestion;
}

export interface IdeationState {
  currentStep: number;
  highestStepReached: number;
  validationAttempted: boolean;
  businessObjective: string;
  industry: string;
  customIndustry?: string;
  systems: string[];
  customSystems?: string;
  uploadedFile?: {
    name: string;
    size: number;
    data: Uint8Array;
  };
  /** Task 5.4: Metadata for previously uploaded file (for re-upload indicator) */
  uploadedFileMetadata?: PersistedFileMetadata;
  aiGapFillingState: AIGapFillingState;
  outcome: OutcomeDefinitionState;
  securityGuardrails: SecurityGuardrailsState;
  agentDesign: AgentDesignState;
  mockData?: MockDataState;
  /** Task 3.2: Demo strategy state for Step 7 */
  demoStrategy?: DemoStrategyState;
  /** Task 1.7: Generation state for Step 8 */
  generation?: GenerationState;
}

interface IdeationValidationError {
  type: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface IdeationValidationState {
  isValid: boolean;
  errors: IdeationValidationError[];
  hasWarnings: boolean;
}

// ============================================================================
// Constants for Step 7
// ============================================================================

/** Maximum number of aha moments allowed */
const MAX_AHA_MOMENTS = 5;

/** Maximum number of narrative scenes allowed */
const MAX_NARRATIVE_SCENES = 8;

/** Maximum characters for scene description */
const MAX_SCENE_DESCRIPTION_LENGTH = 500;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Capitalize the first letter of a string
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Build flow summary string from edges using arrow notation
 * -> for sequential, [a | b] for parallel, ? suffix for conditional
 */
function buildFlowSummary(edges: ProposedEdge[]): string {
  if (edges.length === 0) return '';

  // Build adjacency map to detect parallel paths
  const adjacencyMap = new Map<string, Array<{ to: string; condition?: string }>>();
  const allNodes = new Set<string>();

  edges.forEach((edge) => {
    allNodes.add(edge.from);
    allNodes.add(edge.to);
    if (!adjacencyMap.has(edge.from)) {
      adjacencyMap.set(edge.from, []);
    }
    adjacencyMap.get(edge.from)!.push({ to: edge.to, condition: edge.condition });
  });

  // Find starting nodes (nodes that are not targets of any edge)
  const targetNodes = new Set(edges.map((e) => e.to));
  const startNodes = Array.from(allNodes).filter((node) => !targetNodes.has(node));

  if (startNodes.length === 0) {
    // Fallback: use first edge's source
    if (edges.length > 0) {
      startNodes.push(edges[0].from);
    } else {
      return '';
    }
  }

  // Build linear flow representation
  const flowParts: string[] = [];
  const visited = new Set<string>();

  function traverse(node: string): void {
    if (visited.has(node)) return;
    visited.add(node);

    const outEdges = adjacencyMap.get(node) || [];

    if (outEdges.length === 0) {
      // Terminal node
      flowParts.push(node);
    } else if (outEdges.length === 1) {
      // Single path
      const edge = outEdges[0];
      const nodeStr = edge.condition ? `${node}?` : node;
      flowParts.push(nodeStr);
      traverse(edge.to);
    } else {
      // Multiple outgoing edges - parallel or branching
      flowParts.push(node);
      const parallelTargets = outEdges.map((e) => (e.condition ? `${e.to}?` : e.to));
      flowParts.push(`[${parallelTargets.join(' | ')}]`);

      // Continue traversing from parallel targets to find common endpoint
      outEdges.forEach((e) => {
        const nextEdges = adjacencyMap.get(e.to) || [];
        if (nextEdges.length > 0 && !visited.has(e.to)) {
          traverse(e.to);
        }
      });
    }
  }

  // Start traversal from first start node
  traverse(startNodes[0]);

  // Join with arrows
  return flowParts.join(' -> ');
}

/**
 * Task 5.7: Get validation warnings for agent design
 * Returns array of warning messages for orphan agents and missing entry points
 */
function getAgentDesignValidationWarnings(agents: ProposedAgent[], edges: ProposedEdge[]): string[] {
  const warnings: string[] = [];

  if (agents.length === 0) return warnings;

  // Find connected agent IDs
  const connectedAgentIds = new Set<string>();
  for (const edge of edges) {
    if (edge.from) connectedAgentIds.add(edge.from);
    if (edge.to) connectedAgentIds.add(edge.to);
  }

  // Find orphan agents (agents not in any edge)
  const orphanAgents = agents.filter(a => !connectedAgentIds.has(a.id));
  if (orphanAgents.length > 0 && edges.length > 0) {
    const orphanNames = orphanAgents.map(a => a.name || a.id).join(', ');
    warnings.push(`Orphan agent(s) with no connections: ${orphanNames}`);
  }

  // Check for entry point (agent with no incoming edges)
  if (edges.length > 0) {
    const agentsWithIncomingEdges = new Set<string>();
    for (const edge of edges) {
      if (edge.to) agentsWithIncomingEdges.add(edge.to);
    }

    // Find agents in edges but without incoming edges
    const agentIdsInEdges = new Set<string>();
    for (const edge of edges) {
      if (edge.from) agentIdsInEdges.add(edge.from);
      if (edge.to) agentIdsInEdges.add(edge.to);
    }

    let hasEntryPoint = false;
    for (const agentId of agentIdsInEdges) {
      if (!agentsWithIncomingEdges.has(agentId)) {
        hasEntryPoint = true;
        break;
      }
    }

    if (!hasEntryPoint && agentIdsInEdges.size > 0) {
      warnings.push('No entry point detected: all agents have incoming edges (circular dependency)');
    }
  }

  // Check for incomplete edges
  const incompleteEdges = edges.filter(e => !e.from || !e.to);
  if (incompleteEdges.length > 0) {
    warnings.push(`${incompleteEdges.length} edge(s) have missing from/to values`);
  }

  return warnings;
}

// ============================================================================
// Step 7 Helper Functions
// ============================================================================

/**
 * Task 3.5: Build trigger dropdown options grouped by agents and tools
 * @param confirmedAgents Array of confirmed agents from Step 5
 * @returns HTML string for dropdown options
 */
function buildTriggerDropdownOptions(confirmedAgents: ProposedAgent[], selectedValue?: string): string {
  // Build agent options group
  const agentOptionsHtml = confirmedAgents.map(agent => {
    const value = `agent:${agent.name}`;
    const selected = selectedValue === value ? 'selected' : '';
    return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(agent.name)}</option>`;
  }).join('');

  // Build tool options group
  const toolOptionsHtml: string[] = [];
  confirmedAgents.forEach(agent => {
    agent.tools.forEach(tool => {
      const value = `tool:${tool}`;
      const selected = selectedValue === value ? 'selected' : '';
      toolOptionsHtml.push(
        `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(tool)} (${escapeHtml(agent.name)})</option>`
      );
    });
  });

  return `
    <option value="">Select trigger...</option>
    <optgroup label="-- Agents --">
      ${agentOptionsHtml}
    </optgroup>
    <optgroup label="-- Tools --">
      ${toolOptionsHtml.join('')}
    </optgroup>
  `;
}

/**
 * Task 3.8: Build multi-select checkbox list for highlighted agents
 * @param sceneIndex Index of the scene
 * @param selectedAgents Array of selected agent IDs
 * @param confirmedAgents Array of confirmed agents from Step 5
 * @returns HTML string for agent checkboxes
 */
function buildAgentMultiSelect(
  sceneIndex: number,
  selectedAgents: string[],
  confirmedAgents: ProposedAgent[]
): string {
  if (confirmedAgents.length === 0) {
    return '<p class="no-agents-hint">No agents available</p>';
  }

  const checkboxesHtml = confirmedAgents.map(agent => {
    const checked = selectedAgents.includes(agent.id) ? 'checked' : '';
    return `
      <label class="agent-checkbox">
        <input
          type="checkbox"
          value="${escapeHtml(agent.id)}"
          ${checked}
          onchange="handleStep7Command('step7UpdateScene', { index: ${sceneIndex}, field: 'highlightedAgents', agentId: '${escapeHtml(agent.id)}', checked: this.checked })"
        >
        <span class="checkbox-label">${escapeHtml(agent.name)}</span>
      </label>
    `;
  }).join('');

  return `<div class="agent-multiselect">${checkboxesHtml}</div>`;
}

// ============================================================================
// Step HTML Generators
// ============================================================================

/**
 * Get step indicator HTML
 */
export function getStepIndicatorHtml(state: IdeationState): string {
  const steps = WIZARD_STEPS.map(step => {
    const isCompleted = step.step < state.currentStep;
    const isCurrent = step.step === state.currentStep;
    const isClickable = step.step <= state.highestStepReached && step.step !== state.currentStep;

    let stateClass = 'pending';
    if (isCompleted) stateClass = 'completed';
    else if (isCurrent) stateClass = 'current';

    const clickHandler = isClickable ? `onclick="goToStep(${step.step})"` : '';
    const clickableClass = isClickable ? 'clickable' : '';

    const icon = isCompleted
      ? '<svg class="step-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>'
      : `<span>${step.step}</span>`;

    return `
        <div class="step-item ${stateClass} ${clickableClass}" ${clickHandler}>
          <div class="step-tooltip">${step.label}</div>
          <div class="step-circle">${icon}</div>
          <div class="step-label">${step.label}</div>
        </div>
      `;
  }).join('');

  return `<div class="step-indicator">${steps}</div>`;
}

/**
 * Get step content HTML (dispatch to individual step renderers)
 */
export function getStepContentHtml(state: IdeationState, validation: IdeationValidationState): string {
  if (state.currentStep === 1) {
    return getStep1Html(state, validation);
  }
  if (state.currentStep === 2) {
    return getStep2Html(state);
  }
  if (state.currentStep === 3) {
    return getStep3Html(state);
  }
  if (state.currentStep === 4) {
    return getStep4Html(state);
  }
  if (state.currentStep === 5) {
    return getStep5Html(state);
  }
  if (state.currentStep === 6) {
    return getStep6Html(state);
  }
  if (state.currentStep === 7) {
    return getStep7Html(state);
  }
  if (state.currentStep === 8) {
    const generationState: GenerationState = state.generation || {
      isGenerating: false,
      currentFileIndex: 0,
      completedFiles: [],
      generatedFilePaths: [],
      accordionExpanded: false,
      canGenerate: true,
      steeringComplete: false,
      // Phase 2: Policy files (renamed from cedar)
      policyGenerating: false,
      policyGenerated: false,
      policyFilePaths: [],
      policyError: undefined,
      policySkipped: false,
      // Phase 3: Roadmap
      roadmapGenerating: false,
      roadmapGenerated: false,
      roadmapFilePath: '',
      roadmapError: undefined,
      // Phase 4: Demo
      demoGenerating: false,
      demoGenerated: false,
      demoFilePath: '',
      demoError: undefined,
    };
    const summaries = computeStepSummaries(state);
    return generateStep8Html(generationState, summaries);
  }
  return `
      <div class="placeholder-content">
        <p>Step ${state.currentStep} - Coming Soon</p>
        <p style="font-size: 12px; margin-top: 8px;">This step will be implemented in a future update.</p>
      </div>
    `;
}

/**
 * Get Step 1 HTML - Business Context
 */
export function getStep1Html(state: IdeationState, validation: IdeationValidationState): string {
  const showBusinessObjectiveError = state.validationAttempted &&
    validation.errors.some(e => e.type === 'businessObjective');
  const showIndustryError = state.validationAttempted &&
    validation.errors.some(e => e.type === 'industry');
  const showSystemsWarning = validation.errors.some(e => e.type === 'systems' && e.severity === 'warning');

  const industryOptions = INDUSTRY_OPTIONS.map(opt =>
    `<option value="${opt}" ${state.industry === opt ? 'selected' : ''}>${opt}</option>`
  ).join('');

  const systemsHtml = Object.entries(SYSTEM_OPTIONS).map(([category, systems]) => `
      <div class="system-category">
        <h4>${category}</h4>
        ${systems.map(sys => `
          <label class="system-option">
            <input type="checkbox" ${state.systems.includes(sys) ? 'checked' : ''} onchange="toggleSystem('${sys}')">
            ${sys}
          </label>
        `).join('')}
      </div>
    `).join('');

  // Task 5.4: File upload area with re-upload indicator support
  const fileUploadArea = `<div class="file-upload-area" onclick="document.getElementById('file-input').click()">
          <p>Click to upload a file</p>
          <p style="font-size: 11px; color: var(--vscode-descriptionForeground);">PDF, DOCX, TXT, MD (max 5MB)</p>
          <input type="file" id="file-input" accept=".pdf,.docx,.txt,.md" style="display: none" onchange="handleFileUpload(event)">
        </div>`;

  let fileHtml: string;
  if (state.uploadedFile) {
    // File is currently uploaded - show file info with remove button
    fileHtml = `<div class="file-info">
          <span>${escapeHtml(state.uploadedFile.name)} (${formatFileSize(state.uploadedFile.size)})</span>
          <button class="remove-file" onclick="removeFile()">Remove</button>
        </div>`;
  } else if (state.uploadedFileMetadata) {
    // File was previously uploaded but not available (resumed session) - show re-upload indicator
    fileHtml = getFileReuploadIndicatorHtml(
      state.uploadedFileMetadata.fileName,
      state.uploadedFileMetadata.fileSize
    ) + fileUploadArea;
  } else {
    // No file - show upload area only
    fileHtml = fileUploadArea;
  }

  return `
      ${showSystemsWarning ? `<div class="warning-banner">${validation.errors.find(e => e.type === 'systems')?.message}</div>` : ''}

      <div class="form-section">
        <label class="form-label required">Business Objective</label>
        <textarea
          placeholder="Describe the business problem or objective..."
          oninput="updateBusinessObjective(this.value)"
        >${escapeHtml(state.businessObjective)}</textarea>
        ${showBusinessObjectiveError ? '<div class="error-message">Business objective is required</div>' : ''}
      </div>

      <div class="form-section">
        <label class="form-label required">Industry</label>
        <select onchange="updateIndustry(this.value)">
          <option value="">Select an industry...</option>
          ${industryOptions}
        </select>
        ${showIndustryError ? '<div class="error-message">Please select an industry</div>' : ''}
        ${state.industry === 'Other' ? `
          <input type="text"
            placeholder="Specify your industry..."
            style="margin-top: 8px;"
            value="${escapeHtml(state.customIndustry || '')}"
            oninput="updateCustomIndustry(this.value)">
        ` : ''}
      </div>

      <div class="form-section">
        <label class="form-label">Systems to Integrate</label>
        <div class="systems-grid">
          ${systemsHtml}
        </div>
        <div class="other-systems-label">Other Systems</div>
        <input type="text"
          placeholder="e.g., Mainframe, Custom API, Legacy DB..."
          value="${escapeHtml(state.customSystems || '')}"
          oninput="updateCustomSystems(this.value)">
      </div>

      <div class="form-section">
        <label class="form-label">Supporting Document</label>
        ${fileHtml}
      </div>
    `;
}

/**
 * Get Step 2 (AI Gap-Filling) HTML
 */
export function getStep2Html(state: IdeationState): string {
  const gapState = state.aiGapFillingState;
  const isStreaming = gapState?.isStreaming ?? false;
  const hasError = !!gapState?.streamingError;
  const assumptionsAccepted = gapState?.assumptionsAccepted ?? false;
  const conversationHistory = gapState?.conversationHistory ?? [];
  const conversationCount = conversationHistory.filter((m: { role: string }) => m.role === 'user').length;
  const showHint = conversationCount >= 3 && !assumptionsAccepted;

  // Render conversation messages
  const messagesHtml = conversationHistory
    .map((msg: { role: string; content: string; parsedAssumptions?: Array<{ system: string; modules: string[]; integrations: string[]; source: string }> }) => {
      if (msg.role === 'user') {
        return `
            <div class="chat-message user-message">
              <div class="message-content">
                <div class="message-text">${escapeHtml(msg.content)}</div>
              </div>
            </div>
          `;
      } else {
        // Claude message with optional assumption cards
        let assumptionsHtml = '';
        if (msg.parsedAssumptions && msg.parsedAssumptions.length > 0) {
          const cardsHtml = msg.parsedAssumptions.map((a: { system: string; modules: string[]; integrations: string[]; source: string }) => {
            const modulesHtml = a.modules.map((m: string) => `<span class="module-chip">${escapeHtml(m)}</span>`).join('');
            const integrationsHtml = a.integrations.map((i: string) => `<li>${escapeHtml(i)}</li>`).join('');
            const sourceClass = a.source === 'user-corrected' ? 'user-corrected' : '';
            return `
                <div class="assumption-card ${sourceClass}">
                  <div class="assumption-header">${escapeHtml(a.system)}</div>
                  ${modulesHtml ? `<div class="assumption-modules">${modulesHtml}</div>` : ''}
                  ${integrationsHtml ? `<ul class="assumption-integrations">${integrationsHtml}</ul>` : ''}
                </div>
              `;
          }).join('');

          const acceptDisabled = assumptionsAccepted || isStreaming;
          const acceptLabel = assumptionsAccepted ? 'Accepted ✓' : 'Accept Assumptions';

          assumptionsHtml = `
              <div class="assumptions-container">
                ${cardsHtml}
                <button class="accept-btn" onclick="acceptAssumptions()" ${acceptDisabled ? 'disabled' : ''}>
                  ${acceptLabel}
                </button>
              </div>
            `;
        }

        return `
            <div class="chat-message claude-message">
              <div class="message-avatar">🤖</div>
              <div class="message-content">
                <div class="message-text">${escapeHtml(msg.content)}</div>
                ${assumptionsHtml}
              </div>
            </div>
          `;
      }
    })
    .join('');

  // Render streaming indicator or error
  let statusHtml = '';
  if (isStreaming) {
    statusHtml = `
        <div class="chat-message claude-message streaming">
          <div class="message-avatar">🤖</div>
          <div class="message-content">
            <div class="message-text streaming-text"></div>
            <div class="typing-indicator">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
        </div>
      `;
  } else if (hasError) {
    statusHtml = `
        <div class="chat-message error-message">
          <div class="error-content">
            <div class="error-text">Response interrupted: ${escapeHtml(gapState?.streamingError || '')}</div>
            <button class="retry-btn" onclick="retryLastMessage()">Try Again</button>
          </div>
        </div>
      `;
  }

  // Render finalization hint
  const hintHtml = showHint
    ? '<div class="finalization-hint">Ready to finalize? Click Confirm & Continue.</div>'
    : '';

  return `
      <div class="step2-header">
        <p class="step-description">Claude will analyze your context and propose assumptions about your environment.</p>
        <button class="regenerate-btn" onclick="regenerateAssumptions()" ${isStreaming ? 'disabled' : ''}>
          ↻ Regenerate
        </button>
      </div>

      <div class="chat-container">
        <div class="chat-messages" id="chatMessages">
          ${messagesHtml}
          ${statusHtml}
        </div>
      </div>

      ${hintHtml}

      <div class="chat-input-area">
        <input
          type="text"
          id="chatInput"
          class="chat-input"
          placeholder="Refine assumptions..."
          ${isStreaming ? 'disabled' : ''}
          onkeydown="handleChatKeydown(event)"
        >
        <button class="send-btn" onclick="sendChatMessage()" ${isStreaming ? 'disabled' : ''}>
          Send
        </button>
      </div>
    `;
}

/**
 * Get Step 3 (Outcome Definition) HTML
 */
export function getStep3Html(state: IdeationState): string {
  const outcomeState = state.outcome;
  const showErrors = state.validationAttempted;
  const suggestionsAccepted = outcomeState.suggestionsAccepted ?? false;
  const isLoading = outcomeState.isLoading ?? false;
  const refinedSections = outcomeState.refinedSections ?? { outcome: false, kpis: false, stakeholders: false };

  // Render loading indicator or error
  let loadingHtml = '';
  if (isLoading) {
    loadingHtml = `
        <div class="outcome-loading">
          <div class="typing-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
          <span class="loading-text">Generating suggestions...</span>
        </div>
      `;
  } else if (outcomeState.loadingError) {
    loadingHtml = `
        <div class="outcome-error">
          <span class="error-text">${escapeHtml(outcomeState.loadingError)}</span>
          <button class="dismiss-error-btn" onclick="dismissOutcomeError()">Dismiss</button>
        </div>
      `;
  }

  // Refine input (visible in both phases)
  const refineInputHtml = `
      <div class="chat-input-area">
        <input
          type="text"
          id="outcomeRefineInput"
          class="chat-input"
          placeholder="Refine outcomes..."
          ${isLoading ? 'disabled' : ''}
          onkeydown="handleOutcomeRefineKeydown(event)"
        >
        <button class="send-btn" onclick="sendOutcomeRefinement()" ${isLoading ? 'disabled' : ''}>
          Send
        </button>
      </div>
      <p class="refine-hints">Try: "Add a metric for cost savings" or "Make the outcome more specific to risk"</p>
    `;

  // Phase 1: Suggestion Review (read-only card)
  if (!suggestionsAccepted) {
    // Build KPIs list for suggestion card
    const kpisListHtml = outcomeState.successMetrics.length > 0
      ? outcomeState.successMetrics.map((metric) => `
            <li>${escapeHtml(metric.name)}${metric.targetValue ? `: ${escapeHtml(metric.targetValue)}` : ''}${metric.unit ? ` ${escapeHtml(metric.unit)}` : ''}</li>
          `).join('')
      : '<li class="empty-hint">No KPIs suggested yet</li>';

    // Build stakeholders tags for suggestion card
    const stakeholdersTagsHtml = outcomeState.stakeholders.length > 0
      ? outcomeState.stakeholders.map((s) => `<span class="stakeholder-tag">${escapeHtml(s)}</span>`).join('')
      : '<span class="empty-hint">No stakeholders suggested yet</span>';

    // Refined indicators
    const outcomeRefinedBadge = refinedSections.outcome ? '<span class="refined-badge">(refined)</span>' : '';
    const kpisRefinedBadge = refinedSections.kpis ? '<span class="refined-badge">(refined)</span>' : '';
    const stakeholdersRefinedBadge = refinedSections.stakeholders ? '<span class="refined-badge">(refined)</span>' : '';

    return `
        <div class="step3-header">
          <p class="step-description">Review AI-generated outcome suggestions, refine if needed, then accept to edit.</p>
          <button class="regenerate-btn" onclick="regenerateOutcomeSuggestions()" ${isLoading ? 'disabled' : ''}>
            ↻ Regenerate
          </button>
        </div>

        ${loadingHtml}

        <div class="suggestion-card">
          <div class="suggestion-section">
            <div class="suggestion-header">Primary Outcome ${outcomeRefinedBadge}</div>
            <div class="suggestion-content">
              ${outcomeState.primaryOutcome ? escapeHtml(outcomeState.primaryOutcome) : '<span class="empty-hint">Waiting for AI suggestions...</span>'}
            </div>
          </div>

          <div class="suggestion-section">
            <div class="suggestion-header">Suggested KPIs ${kpisRefinedBadge}</div>
            <ul class="suggestion-kpis">
              ${kpisListHtml}
            </ul>
          </div>

          <div class="suggestion-section">
            <div class="suggestion-header">Suggested Stakeholders ${stakeholdersRefinedBadge}</div>
            <div class="suggestion-stakeholders">
              ${stakeholdersTagsHtml}
            </div>
          </div>

          <button class="accept-btn" onclick="acceptOutcomeSuggestions()" ${isLoading || !outcomeState.primaryOutcome ? 'disabled' : ''}>
            Accept Suggestions
          </button>
        </div>

        ${refineInputHtml}
      `;
  }

  // Phase 2: Editable Form (after acceptance)
  const primaryOutcomeError = showErrors && !outcomeState.primaryOutcome.trim();
  const metricsWarning = outcomeState.successMetrics.length === 0;

  // Render metrics list (editable)
  const metricsHtml = outcomeState.successMetrics.map((metric, index) => `
      <div class="metric-row" data-index="${index}">
        <input
          type="text"
          class="metric-input metric-name"
          placeholder="Metric name"
          value="${escapeHtml(metric.name)}"
          oninput="updateMetric(${index}, 'name', this.value)"
        >
        <input
          type="text"
          class="metric-input metric-target"
          placeholder="Target"
          value="${escapeHtml(metric.targetValue)}"
          oninput="updateMetric(${index}, 'targetValue', this.value)"
        >
        <input
          type="text"
          class="metric-input metric-unit"
          placeholder="Unit"
          value="${escapeHtml(metric.unit)}"
          oninput="updateMetric(${index}, 'unit', this.value)"
        >
        <button class="remove-metric-btn" onclick="removeMetric(${index})" title="Remove metric">✕</button>
      </div>
    `).join('');

  // Combine static stakeholders with AI-suggested custom stakeholders
  const allStakeholders = [...STAKEHOLDER_OPTIONS];
  const aiSuggestedStakeholders = outcomeState.customStakeholders.filter(
    (s) => !STAKEHOLDER_OPTIONS.includes(s)
  );

  // Render stakeholder checkboxes
  const stakeholderCheckboxesHtml = allStakeholders.map((stakeholder) => {
    const checked = outcomeState.stakeholders.includes(stakeholder) ? 'checked' : '';
    const stakeholderId = stakeholder.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    return `
        <label class="stakeholder-checkbox">
          <input type="checkbox" id="stakeholder-${stakeholderId}" value="${stakeholder}" ${checked} onchange="toggleStakeholder('${stakeholder}')">
          <span class="checkbox-label">${escapeHtml(stakeholder)}</span>
        </label>
      `;
  }).join('');

  // Render AI-suggested stakeholders with badge
  const aiStakeholderCheckboxesHtml = aiSuggestedStakeholders.map((stakeholder) => {
    const checked = outcomeState.stakeholders.includes(stakeholder) ? 'checked' : '';
    const stakeholderId = stakeholder.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    return `
        <label class="stakeholder-checkbox ai-suggested">
          <input type="checkbox" id="stakeholder-${stakeholderId}" value="${stakeholder}" ${checked} onchange="toggleStakeholder('${escapeHtml(stakeholder)}')">
          <span class="checkbox-label">${escapeHtml(stakeholder)}</span>
          <span class="ai-badge">AI suggested</span>
        </label>
      `;
  }).join('');

  return `
      <div class="step3-header">
        <p class="step-description">Define measurable business outcomes and success metrics for your workflow.</p>
        <button class="regenerate-btn" onclick="regenerateOutcomeSuggestions()" ${isLoading ? 'disabled' : ''}>
          ↻ Regenerate
        </button>
      </div>

      ${loadingHtml}

      <div class="accepted-banner">Accepted ✓</div>

      <div class="form-section">
        <label class="form-label required">Primary Outcome</label>
        <textarea
          class="${primaryOutcomeError ? 'error' : ''}"
          placeholder="Describe the measurable business result you want to achieve..."
          oninput="updatePrimaryOutcome(this.value)"
        >${escapeHtml(outcomeState.primaryOutcome)}</textarea>
        ${primaryOutcomeError ? '<div class="error-message">Primary outcome is required</div>' : ''}
      </div>

      <div class="form-section">
        <label class="form-label">Success Metrics</label>
        ${metricsWarning && showErrors ? '<div class="warning-banner">Consider adding at least one success metric to measure outcomes</div>' : ''}
        <div class="metrics-list">
          ${metricsHtml}
        </div>
        <button class="add-metric-btn" onclick="addMetric()">+ Add Metric</button>
      </div>

      <div class="form-section">
        <label class="form-label">Stakeholders</label>
        <p class="field-hint">Select stakeholders who will benefit from or be impacted by this workflow.</p>
        <div class="stakeholders-grid">
          ${stakeholderCheckboxesHtml}
          ${aiStakeholderCheckboxesHtml}
        </div>
        <div class="custom-stakeholder-input">
          <input
            type="text"
            id="customStakeholderInput"
            placeholder="Add custom stakeholder..."
            onkeydown="handleCustomStakeholderKeydown(event)"
          >
          <button class="add-stakeholder-btn" onclick="addCustomStakeholder()">Add</button>
        </div>
      </div>

      ${refineInputHtml}
    `;
}

/**
 * Get Step 4 HTML - Security & Guardrails
 */
export function getStep4Html(state: IdeationState): string {
  const securityState = state.securityGuardrails;
  const isLoading = securityState.isLoading;

  // Loading indicator
  let loadingHtml = '';
  if (isLoading) {
    loadingHtml = `
        <div class="guardrail-loading">
          <div class="typing-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
          <span class="loading-text">Generating guardrail suggestions...</span>
        </div>
      `;
  }

  // Data Sensitivity radio buttons
  const sensitivityOptionsHtml = DATA_SENSITIVITY_OPTIONS.map(opt => `
      <label class="sensitivity-radio-option">
        <input
          type="radio"
          name="dataSensitivity"
          value="${opt.value}"
          ${securityState.dataSensitivity === opt.value ? 'checked' : ''}
          onchange="updateDataSensitivity('${opt.value}')"
        >
        <div class="sensitivity-radio-content">
          <span class="sensitivity-label">${opt.label}</span>
          <span class="sensitivity-helper">${opt.helperText}</span>
        </div>
      </label>
    `).join('');

  // Compliance Frameworks checkboxes
  const complianceOptionsHtml = COMPLIANCE_FRAMEWORK_OPTIONS.map(framework => `
      <label class="system-option">
        <input
          type="checkbox"
          ${securityState.complianceFrameworks.includes(framework) ? 'checked' : ''}
          onchange="toggleComplianceFramework('${escapeHtml(framework)}')"
        >
        <span>${escapeHtml(framework)}</span>
      </label>
    `).join('');

  // Approval Gates checkboxes
  const approvalGatesHtml = APPROVAL_GATE_OPTIONS.map(gate => `
      <label class="system-option">
        <input
          type="checkbox"
          ${securityState.approvalGates.includes(gate) ? 'checked' : ''}
          onchange="toggleApprovalGate('${escapeHtml(gate)}')"
        >
        <span>${escapeHtml(gate)}</span>
      </label>
    `).join('');

  // AI suggested badge
  const aiSuggestedBadge = securityState.aiSuggested
    ? '<span class="ai-suggested-badge">✨ AI suggested</span>'
    : '';

  return `
      <div class="step-content">
        <h2>Security & Guardrails</h2>
        <p class="step-description">Configure security settings and compliance requirements for your demo. This step is optional.</p>

        ${loadingHtml}

        <div class="form-section">
          <label class="form-label">Data Sensitivity</label>
          <div class="sensitivity-radio-group">
            ${sensitivityOptionsHtml}
          </div>
        </div>

        <div class="form-section">
          <label class="form-label">Compliance Frameworks</label>
          <p class="field-description">Select applicable compliance frameworks based on your industry.</p>
          <div class="systems-grid">
            ${complianceOptionsHtml}
          </div>
        </div>

        <div class="form-section">
          <label class="form-label">Human Approval Gates</label>
          <p class="field-description">Select workflow stages that require human approval.</p>
          <div class="systems-grid">
            ${approvalGatesHtml}
          </div>
        </div>

        <div class="form-section">
          <label class="form-label">
            Guardrail Notes
            ${aiSuggestedBadge}
          </label>
          <p class="field-description">Additional security constraints for this demo.</p>
          <textarea
            class="guardrail-notes-input"
            rows="4"
            placeholder="Additional security constraints..."
            oninput="updateGuardrailNotes(this.value)"
            ${isLoading ? 'disabled' : ''}
          >${escapeHtml(securityState.guardrailNotes)}</textarea>
        </div>
      </div>
    `;
}

/**
 * Get Step 5 HTML - Agent Design Proposal
 * Task Group 4 & 5: Full Phase 1/Phase 2 UI with editing capabilities
 */
export function getStep5Html(state: IdeationState): string {
  const agentDesignState = state.agentDesign;
  const isLoading = agentDesignState?.isLoading ?? false;
  const hasAgents = agentDesignState?.proposedAgents?.length > 0;
  const proposalAccepted = agentDesignState?.proposalAccepted ?? false;
  const originalOrchestration = agentDesignState?.originalOrchestration ?? agentDesignState?.proposedOrchestration ?? 'workflow';

  // Loading indicator
  let loadingHtml = '';
  if (isLoading) {
    loadingHtml = `
        <div class="agent-design-loading">
          <div class="typing-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
          <span class="loading-text">Generating agent proposal...</span>
        </div>
      `;
  }

  // Error display
  let errorHtml = '';
  if (agentDesignState?.error) {
    errorHtml = `
        <div class="agent-design-error">
          <span class="error-text">${escapeHtml(agentDesignState.error)}</span>
        </div>
      `;
  }

  // Task 4.3: Accepted banner for Phase 2 (following Step 3 pattern)
  const acceptedBannerHtml = proposalAccepted
    ? '<div class="accepted-banner">Proposal Accepted - Now customize your agent design</div>'
    : '';

  // =========================================================================
  // Phase 2: Editable Agent Cards
  // =========================================================================
  let agentCardsHtml = '';
  if (hasAgents) {
    if (proposalAccepted) {
      // Task 5.2: Phase 2 - Editable agent cards
      const editableCardsHtml = agentDesignState.proposedAgents.map((agent) => {
        // Task 5.2: Tool tags as chips with remove button
        const toolsChipsHtml = agent.tools.map((tool, toolIndex) =>
          `<span class="module-chip tool-chip">
            ${escapeHtml(tool)}
            <button class="remove-tool-btn" onclick="removeAgentTool('${escapeHtml(agent.id)}', ${toolIndex})" title="Remove tool">✕</button>
          </span>`
        ).join('');

        return `
          <div class="agent-card agent-card-editable" data-agent-id="${escapeHtml(agent.id)}">
            <div class="agent-header">
              <input type="text"
                class="agent-name-input"
                value="${escapeHtml(agent.name)}"
                placeholder="Agent name..."
                oninput="updateAgentName('${escapeHtml(agent.id)}', this.value)">
              <span class="agent-id-badge">#${escapeHtml(agent.id)}</span>
            </div>
            <textarea
              class="agent-role-input"
              placeholder="Describe agent role..."
              oninput="updateAgentRole('${escapeHtml(agent.id)}', this.value)"
            >${escapeHtml(agent.role)}</textarea>
            <div class="agent-tools-section">
              <label class="form-label">Tools</label>
              <div class="agent-tools-editable">
                ${toolsChipsHtml}
              </div>
              <div class="tool-input-group">
                <input type="text"
                  class="tool-input"
                  placeholder="Add tool..."
                  data-agent-id="${escapeHtml(agent.id)}"
                  onkeydown="handleToolInputKeydown(event, '${escapeHtml(agent.id)}')">
              </div>
            </div>
            <button class="remove-agent-btn" onclick="removeAgent('${escapeHtml(agent.id)}')" title="Remove agent">
              <span class="trash-icon">🗑</span> Remove Agent
            </button>
          </div>
        `;
      }).join('');

      agentCardsHtml = `
        <div class="agent-cards-grid">
          ${editableCardsHtml}
        </div>
        <button class="add-agent-btn" onclick="addAgent()">+ Add Agent</button>
      `;
    } else {
      // Phase 1 - Read-only agent cards
      const readOnlyCardsHtml = agentDesignState.proposedAgents.map((agent) => {
        const toolsHtml = agent.tools.map((tool) =>
          `<span class="module-chip">${escapeHtml(tool)}</span>`
        ).join('');

        return `
          <div class="agent-card">
            <div class="agent-header">
              <span class="agent-name">${escapeHtml(agent.name)}</span>
              <span class="agent-id-badge">#${escapeHtml(agent.id)}</span>
            </div>
            <p class="agent-role">${escapeHtml(agent.role)}</p>
            ${toolsHtml ? `<div class="agent-tools">${toolsHtml}</div>` : ''}
          </div>
        `;
      }).join('');

      agentCardsHtml = `
        <div class="agent-cards-grid">
          ${readOnlyCardsHtml}
        </div>
      `;
    }
  }

  // =========================================================================
  // Task 5.4: Orchestration Section with Dropdown (Phase 2) or Badge (Phase 1)
  // =========================================================================
  let orchestrationHtml = '';
  if (hasAgents) {
    if (proposalAccepted) {
      // Task 5.4: Phase 2 - Orchestration dropdown with AI badge
      // Pattern descriptions for tooltips (Item 20: Orchestration Pattern Help)
      const patternDescriptions: Record<string, string> = {
        graph: 'LLM picks path at runtime based on conditions. Best for: approval gates, decision trees, conditional workflows.',
        swarm: 'Agents hand off autonomously. Best for: complex problem-solving, collaborative analysis, emergent behavior.',
        workflow: 'Fixed DAG with parallel execution. Best for: predictable pipelines, batch processing, strict ordering.'
      };

      const orchestrationOptions = ['graph', 'swarm', 'workflow'].map(pattern => {
        const isSelected = agentDesignState.proposedOrchestration === pattern;
        const isOriginal = originalOrchestration === pattern;
        const badgeHtml = isOriginal ? ' (AI Suggested)' : '';
        const tooltip = patternDescriptions[pattern] || '';
        return `<option value="${pattern}" ${isSelected ? 'selected' : ''} title="${escapeHtml(tooltip)}">${capitalizeFirst(pattern)}${badgeHtml}</option>`;
      }).join('');

      // Show AI Suggested badge next to dropdown
      const aiSuggestedBadgeHtml = `<span class="ai-suggested-badge">AI Suggested: ${capitalizeFirst(originalOrchestration)}</span>`;

      orchestrationHtml = `
        <div class="orchestration-section">
          <div class="orchestration-header">
            <label class="form-label">Orchestration Pattern</label>
            ${aiSuggestedBadgeHtml}
          </div>
          <select class="orchestration-select" onchange="updateOrchestration(this.value)">
            ${orchestrationOptions}
          </select>
          <div class="orchestration-reasoning">
            <button class="expand-toggle" onclick="toggleOrchestrationReasoning()">
              <span class="chevron">&#9654;</span>
              <span>Why this pattern?</span>
            </button>
            <div class="reasoning-content">
              <p>${escapeHtml(agentDesignState.orchestrationReasoning || 'No reasoning provided.')}</p>
            </div>
          </div>
        </div>
      `;
    } else {
      // Phase 1 - Read-only orchestration badge
      const patternName = capitalizeFirst(agentDesignState.proposedOrchestration);
      const reasoningText = agentDesignState.orchestrationReasoning || 'No reasoning provided.';

      orchestrationHtml = `
        <div class="orchestration-section">
          <div class="orchestration-header">
            <span class="orchestration-label">Orchestration Pattern:</span>
            <span class="orchestration-badge">${escapeHtml(patternName)}</span>
          </div>
          <div class="orchestration-reasoning">
            <button class="expand-toggle" onclick="toggleOrchestrationReasoning()">
              <span class="chevron">&#9654;</span>
              <span>Why this pattern?</span>
            </button>
            <div class="reasoning-content">
              <p>${escapeHtml(reasoningText)}</p>
            </div>
          </div>
        </div>
      `;
    }
  }

  // =========================================================================
  // Task 5.5: Edge Suggestion Card (non-blocking, Phase 2 only)
  // =========================================================================
  let edgeSuggestionHtml = '';
  if (proposalAccepted && agentDesignState?.edgeSuggestion?.visible) {
    const suggestedEdgesHtml = agentDesignState.edgeSuggestion.edges.map(edge =>
      `<li>${escapeHtml(edge.from)} → ${escapeHtml(edge.to)}${edge.condition ? ` (${escapeHtml(edge.condition)})` : ''}</li>`
    ).join('');

    edgeSuggestionHtml = `
      <div class="edge-suggestion-card">
        <div class="edge-suggestion-header">
          <span class="suggestion-icon">💡</span>
          <span>Suggested edges for ${capitalizeFirst(agentDesignState.proposedOrchestration)} pattern:</span>
        </div>
        <ul class="edge-suggestion-list">
          ${suggestedEdgesHtml}
        </ul>
        <div class="edge-suggestion-actions">
          <button class="apply-suggestion-btn" onclick="applyEdgeSuggestion()">Apply</button>
          <button class="dismiss-suggestion-btn" onclick="dismissEdgeSuggestion()">Dismiss</button>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // Task 5.6: Edge Editing Table (Phase 2 only)
  // =========================================================================
  let edgeTableHtml = '';
  if (proposalAccepted && hasAgents) {
    // Build agent options for dropdowns
    const agentOptions = agentDesignState.proposedAgents.map(agent =>
      `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.name || agent.id)}</option>`
    ).join('');

    const edgeRowsHtml = agentDesignState.proposedEdges.map((edge, index) => {
      const fromAgent = agentDesignState.proposedAgents.find(a => a.id === edge.from);
      const toAgent = agentDesignState.proposedAgents.find(a => a.id === edge.to);
      const fromName = fromAgent?.name || edge.from || 'source agent';
      const toName = toAgent?.name || edge.to || 'target agent';
      const arrowTooltip = `${fromName} passes its output to ${toName}`;

      const fromOptions = agentDesignState.proposedAgents.map(agent =>
        `<option value="${escapeHtml(agent.id)}" ${edge.from === agent.id ? 'selected' : ''}>${escapeHtml(agent.name || agent.id)}</option>`
      ).join('');
      const toOptions = agentDesignState.proposedAgents.map(agent =>
        `<option value="${escapeHtml(agent.id)}" ${edge.to === agent.id ? 'selected' : ''}>${escapeHtml(agent.name || agent.id)}</option>`
      ).join('');

      return `
        <tr class="edge-row" data-index="${index}">
          <td>
            <select class="edge-select" onchange="updateEdge(${index}, 'from', this.value)">
              <option value="">Select agent...</option>
              ${fromOptions}
            </select>
          </td>
          <td class="edge-arrow" title="${escapeHtml(arrowTooltip)}">→</td>
          <td>
            <select class="edge-select" onchange="updateEdge(${index}, 'to', this.value)">
              <option value="">Select agent...</option>
              ${toOptions}
            </select>
          </td>
          <td>
            <button class="remove-edge-btn" onclick="removeEdge(${index})" title="Remove edge">✕</button>
          </td>
        </tr>
      `;
    }).join('');

    edgeTableHtml = `
      <div class="edge-editing-section">
        <label class="form-label">Agent Flow Edges</label>
        <p class="edge-description">Define how agents pass data to each other. Each edge connects a source agent to a target agent.</p>
        <table class="edge-table">
          <thead>
            <tr>
              <th>From <span class="header-hint">(source)</span></th>
              <th></th>
              <th>To <span class="header-hint">(target)</span></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${edgeRowsHtml}
          </tbody>
        </table>
        <button class="add-edge-btn" onclick="addEdge()">+ Add Edge</button>
      </div>
    `;
  }

  // Flow summary for Phase 1
  let flowSummaryHtml = '';
  if (!proposalAccepted && hasAgents && agentDesignState.proposedEdges?.length > 0) {
    const flowSummary = buildFlowSummary(agentDesignState.proposedEdges);
    if (flowSummary) {
      flowSummaryHtml = `
        <div class="flow-summary-section">
          <label class="form-label">Agent Flow</label>
          <div class="flow-summary">
            <code>${flowSummary}</code>
          </div>
        </div>
      `;
    }
  }

  // =========================================================================
  // Task 5.7: Validation Warnings Display (Phase 2 only, non-blocking)
  // =========================================================================
  let validationWarningsHtml = '';
  if (proposalAccepted && hasAgents) {
    const warnings = getAgentDesignValidationWarnings(
      agentDesignState.proposedAgents,
      agentDesignState.proposedEdges
    );

    if (warnings.length > 0) {
      const warningsListHtml = warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('');
      validationWarningsHtml = `
        <div class="validation-warnings">
          <div class="validation-warnings-header">
            <span class="warning-icon">⚠</span>
            <span>Validation Warnings (non-blocking)</span>
          </div>
          <ul class="validation-warnings-list">
            ${warningsListHtml}
          </ul>
        </div>
      `;
    }
  }

  // =========================================================================
  // Action Buttons
  // =========================================================================
  const buttonsDisabled = isLoading ? 'disabled' : '';
  let actionButtonsHtml = '';

  if (proposalAccepted) {
    // Task 5.8: Phase 2 - Show Regenerate and Confirm Design buttons
    actionButtonsHtml = `
      <div class="agent-design-actions">
        <button class="regenerate-btn" onclick="regenerateAgentProposal()" ${buttonsDisabled}>
          ↻ Regenerate
        </button>
        <button class="confirm-design-btn primary-btn" onclick="confirmDesign()" ${buttonsDisabled}>
          Confirm Design
        </button>
      </div>
    `;
  } else {
    // Phase 1: Show "Accept Suggestions" and "Accept & Continue" buttons
    actionButtonsHtml = `
      <div class="agent-design-actions">
        <button class="regenerate-btn" onclick="regenerateAgentProposal()" ${buttonsDisabled}>
          ↻ Regenerate
        </button>
        <button class="accept-btn" onclick="acceptSuggestionsPhase2()" ${buttonsDisabled || (!hasAgents ? 'disabled' : '')}>
          Accept Suggestions
        </button>
        <button class="secondary-btn" onclick="acceptAndContinue()" ${buttonsDisabled || (!hasAgents ? 'disabled' : '')}>
          Accept &amp; Continue
        </button>
      </div>
    `;
  }

  // Adjustment input section - always visible when there are agents (both phases)
  const adjustmentInputHtml = hasAgents ? `
      <div class="adjustment-section">
        <div class="adjustment-input-group">
          <input type="text"
            id="adjustment-input"
            class="adjustment-input"
            placeholder="Adjust agent design..."
            ${isLoading ? 'disabled' : ''}
            onkeydown="handleAdjustmentKeydown(event)">
          <button class="send-adjustment-btn" onclick="sendAgentDesignAdjustment()" ${isLoading || !hasAgents ? 'disabled' : ''}>
            Send
          </button>
        </div>
        <p class="adjustment-hints">
          e.g., "Add a fraud detection agent" or "Change orchestration to workflow"
        </p>
      </div>
    ` : '';

  return `
      <div class="step5-header">
        <h2>Agent Design</h2>
        <p class="step-description">Review the AI-proposed agent team for your workflow. Accept to continue or regenerate for a different design.</p>
      </div>

      ${loadingHtml}
      ${errorHtml}
      ${acceptedBannerHtml}
      ${agentCardsHtml}
      ${orchestrationHtml}
      ${edgeSuggestionHtml}
      ${edgeTableHtml}
      ${flowSummaryHtml}
      ${validationWarningsHtml}
      ${actionButtonsHtml}
      ${adjustmentInputHtml}
    `;
}

// ============================================================================
// Step 6: Mock Data Strategy
// ============================================================================

/**
 * Get validation warnings for Step 6 mock data
 */
function getMockDataValidationWarnings(mockDefinitions: MockToolDefinition[]): string[] {
  const warnings: string[] = [];

  for (const def of mockDefinitions) {
    if (!def.sampleData || def.sampleData.length === 0) {
      warnings.push(`${def.tool} has no sample data — demo will use empty responses`);
    }
    if (!def.mockRequest || Object.keys(def.mockRequest).length === 0) {
      warnings.push(`${def.tool} has empty mockRequest schema`);
    }
    if (!def.mockResponse || Object.keys(def.mockResponse).length === 0) {
      warnings.push(`${def.tool} has empty mockResponse schema`);
    }
  }

  return warnings;
}

/**
 * Render a JSON editor with syntax highlighting
 */
function renderJsonEditor(
  json: object,
  toolIndex: number,
  field: 'request' | 'response',
  command: string
): string {
  const jsonString = JSON.stringify(json, null, 2);

  return `
    <div class="json-editor" data-tool-index="${toolIndex}" data-field="${field}">
      <textarea
        class="json-textarea"
        data-tool-index="${toolIndex}"
        rows="${Math.min(10, jsonString.split('\n').length + 1)}"
        onchange="handleStep6Command('${command}', { toolIndex: ${toolIndex}, value: this.value })"
        onblur="handleStep6Command('${command}', { toolIndex: ${toolIndex}, value: this.value })"
      >${escapeHtml(jsonString)}</textarea>
    </div>
  `;
}

/**
 * Render sample data table for a tool
 */
function renderSampleDataTable(def: MockToolDefinition, toolIndex: number): string {
  const schemaKeys = Object.keys(def.mockResponse || {});
  if (schemaKeys.length === 0) {
    return '<p class="no-schema-message">Define mockResponse schema to enable sample data editing</p>';
  }

  const headerCells = schemaKeys.map(key => `<th>${escapeHtml(key)}</th>`).join('');

  const rows = (def.sampleData || []).map((row, rowIndex) => {
    const cells = schemaKeys.map(key => {
      const value = (row as Record<string, unknown>)[key];
      const inputType = typeof value === 'number' ? 'number' : 'text';
      const displayValue = value !== undefined && value !== null ? String(value) : '';

      return `
        <td>
          <input
            type="${inputType}"
            class="sample-data-input"
            value="${escapeHtml(displayValue)}"
            data-tool-index="${toolIndex}"
            data-row-index="${rowIndex}"
            data-field="${escapeHtml(key)}"
            onchange="handleStep6Command('step6UpdateRow', { toolIndex: ${toolIndex}, rowIndex: ${rowIndex}, field: '${escapeHtml(key)}', value: this.value })"
          />
        </td>
      `;
    }).join('');

    return `
      <tr data-row-index="${rowIndex}">
        ${cells}
        <td class="row-actions">
          <button class="delete-row-btn" onclick="handleStep6Command('step6DeleteRow', { toolIndex: ${toolIndex}, rowIndex: ${rowIndex} })" title="Delete row">✕</button>
        </td>
      </tr>
    `;
  }).join('');

  const sampleCount = def.sampleData?.length || 0;
  const canAddRow = sampleCount < 5;
  const addRowDisabled = !canAddRow ? 'disabled' : '';
  const maxRowsMessage = !canAddRow ? '<span class="max-rows-hint">Maximum 5 rows reached</span>' : '';

  return `
    <table class="sample-data-table">
      <thead>
        <tr>
          ${headerCells}
          <th class="actions-col"></th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <div class="sample-data-actions">
      <button class="add-row-btn" onclick="handleStep6Command('step6AddRow', { toolIndex: ${toolIndex} })" ${addRowDisabled}>+ Add Row</button>
      ${maxRowsMessage}
    </div>
  `;
}

/**
 * Render accordion card for a mock tool definition
 */
function renderMockAccordionCard(def: MockToolDefinition, toolIndex: number): string {
  const expandedClass = def.expanded ? 'expanded' : '';
  // Always use chevron-right - CSS transform handles rotation when expanded
  const chevronIcon = 'codicon-chevron-right';

  // Import summary if present (stored in extended interface)
  const importSummary = (def as MockToolDefinition & { importSummary?: string }).importSummary;
  const importSummaryHtml = importSummary
    ? `<div class="import-summary">${escapeHtml(importSummary)}</div>`
    : '';

  return `
    <div class="mock-accordion-card ${expandedClass}" data-tool-index="${toolIndex}">
      <div class="mock-accordion-header" onclick="handleStep6Command('step6ToggleAccordion', { toolIndex: ${toolIndex} })">
        <span class="codicon ${chevronIcon}"></span>
        <div class="accordion-header-content">
          <span class="tool-name">${escapeHtml(def.tool)}</span>
          <span class="tool-description">${escapeHtml(def.description || '')}</span>
        </div>
      </div>
      <div class="mock-accordion-content">
        <div class="json-section">
          <label class="form-label">Mock Request Schema</label>
          ${renderJsonEditor(def.mockRequest, toolIndex, 'request', 'step6UpdateRequest')}
        </div>
        <div class="json-section">
          <label class="form-label">Mock Response Schema</label>
          ${renderJsonEditor(def.mockResponse, toolIndex, 'response', 'step6UpdateResponse')}
        </div>
        <div class="sample-data-section">
          <label class="form-label">Sample Data</label>
          ${renderSampleDataTable(def, toolIndex)}
        </div>
        <div class="tool-import-section">
          <button class="import-btn" onclick="handleStep6Command('step6ImportData', { toolIndex: ${toolIndex} })">
            Import Sample Data
          </button>
          ${importSummaryHtml}
        </div>
      </div>
    </div>
  `;
}

/**
 * Get Step 6 HTML - Mock Data Strategy
 */
export function getStep6Html(state: IdeationState): string {
  const mockDataState = state.mockData as MockDataState | undefined;
  const isLoading = mockDataState?.isLoading ?? false;
  const error = mockDataState?.error;
  const mockDefinitions = mockDataState?.mockDefinitions ?? [];
  const useCustomerTerminology = mockDataState?.useCustomerTerminology ?? false;

  // Loading indicator
  let loadingHtml = '';
  if (isLoading) {
    loadingHtml = `
      <div class="mock-data-loading">
        <div class="typing-indicator">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
        <span class="loading-text">Generating mock data definitions...</span>
      </div>
    `;
  }

  // Error display
  let errorHtml = '';
  if (error) {
    errorHtml = `
      <div class="mock-data-error">
        <span class="error-text">${escapeHtml(error)}</span>
      </div>
    `;
  }

  // Accordion cards for each tool
  let accordionCardsHtml = '';
  if (mockDefinitions.length > 0) {
    accordionCardsHtml = mockDefinitions.map((def, index) =>
      renderMockAccordionCard(def, index)
    ).join('');
  }

  // Validation warnings (non-blocking)
  let validationWarningsHtml = '';
  if (mockDefinitions.length > 0) {
    const warnings = getMockDataValidationWarnings(mockDefinitions);
    if (warnings.length > 0) {
      const warningsListHtml = warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('');
      validationWarningsHtml = `
        <div class="validation-warnings non-blocking">
          <div class="validation-warnings-header">
            <span class="warning-icon">⚠</span>
            <span>Validation Warnings (non-blocking)</span>
          </div>
          <ul class="validation-warnings-list">
            ${warningsListHtml}
          </ul>
        </div>
      `;
    }
  }

  // Action buttons
  const buttonsDisabled = isLoading ? 'disabled' : '';
  const terminologyToggleClass = useCustomerTerminology ? 'active' : '';

  const actionButtonsHtml = `
    <div class="mock-data-actions">
      <button class="regenerate-btn" onclick="handleStep6Command('step6RegenerateAll', {})" ${buttonsDisabled}>
        ↻ Regenerate All
      </button>
      <button class="terminology-toggle ${terminologyToggleClass}" onclick="handleStep6Command('step6ToggleTerminology', { enabled: ${!useCustomerTerminology} })" ${buttonsDisabled}>
        Use Customer Terminology
      </button>
    </div>
  `;

  return `
    <div class="step6-header">
      <h2>Mock Data Strategy</h2>
      <p class="step-description">Configure mock data for each tool to enable realistic demos. AI-generated sample data can be customized for your customer's terminology.</p>
    </div>

    ${loadingHtml}
    ${errorHtml}

    <div class="mock-definitions-container">
      ${accordionCardsHtml}
    </div>

    ${validationWarningsHtml}
    ${actionButtonsHtml}
  `;
}

// ============================================================================
// Step 7: Demo Strategy
// ============================================================================

/**
 * Render an aha moment row
 * Task 3.4: Repeatable row pattern following Step 3 metrics
 */
function renderAhaMomentRow(
  moment: AhaMoment,
  index: number,
  confirmedAgents: ProposedAgent[]
): string {
  // Build the selected value for dropdown
  const selectedValue = moment.triggerType && moment.triggerName
    ? `${moment.triggerType}:${moment.triggerName}`
    : '';

  return `
    <div class="aha-moment-row" data-index="${index}">
      <div class="moment-fields">
        <div class="moment-field">
          <label class="field-label">Title</label>
          <input
            type="text"
            class="moment-title-input"
            placeholder="What impresses the audience?"
            value="${escapeHtml(moment.title)}"
            oninput="handleStep7Command('step7UpdateMoment', { index: ${index}, field: 'title', value: this.value })"
          >
        </div>
        <div class="moment-field">
          <label class="field-label">Trigger</label>
          <select
            class="moment-trigger-select"
            onchange="handleStep7Command('step7UpdateMoment', { index: ${index}, field: 'trigger', value: this.value })"
          >
            ${buildTriggerDropdownOptions(confirmedAgents, selectedValue)}
          </select>
        </div>
        <div class="moment-field moment-field-wide">
          <label class="field-label">Talking Point</label>
          <textarea
            class="moment-talking-point"
            placeholder="What should the presenter say?"
            oninput="handleStep7Command('step7UpdateMoment', { index: ${index}, field: 'talkingPoint', value: this.value })"
          >${escapeHtml(moment.talkingPoint)}</textarea>
        </div>
      </div>
      <button
        class="remove-moment-btn"
        onclick="handleStep7Command('step7RemoveMoment', { index: ${index} })"
        title="Remove moment"
      >🗑️</button>
    </div>
  `;
}

/**
 * Render a narrative scene card
 * Task 3.7: Scene with title, description, and highlighted agents
 */
function renderNarrativeSceneCard(
  scene: NarrativeScene,
  index: number,
  totalScenes: number,
  confirmedAgents: ProposedAgent[]
): string {
  const isFirst = index === 0;
  const isLast = index === totalScenes - 1;
  const descriptionLength = scene.description.length;
  const warningClass = descriptionLength > 450 ? 'warning' : '';

  return `
    <div class="narrative-scene-card" data-index="${index}">
      <div class="scene-header">
        <span class="scene-number">${index + 1}</span>
        <div class="scene-actions">
          <button
            class="scene-arrow-btn"
            onclick="handleStep7Command('step7MoveSceneUp', { index: ${index} })"
            ${isFirst ? 'disabled' : ''}
            title="Move up"
          >↑</button>
          <button
            class="scene-arrow-btn"
            onclick="handleStep7Command('step7MoveSceneDown', { index: ${index} })"
            ${isLast ? 'disabled' : ''}
            title="Move down"
          >↓</button>
          <button
            class="remove-scene-btn"
            onclick="handleStep7Command('step7RemoveScene', { index: ${index} })"
            title="Remove scene"
          >🗑️</button>
        </div>
      </div>
      <div class="scene-fields">
        <div class="scene-field">
          <label class="field-label">Scene Title</label>
          <input
            type="text"
            class="scene-title-input"
            placeholder="Scene title..."
            value="${escapeHtml(scene.title)}"
            oninput="handleStep7Command('step7UpdateScene', { index: ${index}, field: 'title', value: this.value })"
          >
        </div>
        <div class="scene-field">
          <label class="field-label">Description</label>
          <textarea
            class="scene-description-input"
            placeholder="What happens in this scene? (max 500 characters)"
            maxlength="${MAX_SCENE_DESCRIPTION_LENGTH}"
            oninput="handleStep7Command('step7UpdateScene', { index: ${index}, field: 'description', value: this.value })"
          >${escapeHtml(scene.description)}</textarea>
          <span class="char-counter ${warningClass}">${descriptionLength}/${MAX_SCENE_DESCRIPTION_LENGTH} characters</span>
        </div>
        <div class="scene-field">
          <label class="field-label">Highlighted Agents</label>
          ${buildAgentMultiSelect(index, scene.highlightedAgents, confirmedAgents)}
        </div>
      </div>
    </div>
  `;
}

/**
 * Get Step 7 HTML - Demo Strategy
 * Task 3.2: Main Step 7 HTML generator
 */
export function getStep7Html(state: IdeationState): string {
  const demoStrategy = state.demoStrategy;
  const confirmedAgents = state.agentDesign?.confirmedAgents ?? [];

  // Handle missing demoStrategy state
  if (!demoStrategy) {
    return `
      <div class="step7-header">
        <h2>Demo Strategy</h2>
        <p class="step-description">Define your demo presentation strategy with aha moments, persona, and narrative flow.</p>
      </div>
      <div class="demo-strategy-error">
        <span class="error-text">Demo strategy state not initialized. Please go back and complete previous steps.</span>
      </div>
    `;
  }

  const {
    ahaMoments,
    persona,
    narrativeScenes,
    isGeneratingMoments,
    isGeneratingPersona,
    isGeneratingNarrative,
  } = demoStrategy;

  // Check if any section is generating
  const anyGenerating = isGeneratingMoments || isGeneratingPersona || isGeneratingNarrative;

  // =========================================================================
  // Task 3.3: Generate All Button
  // =========================================================================
  const generateAllHtml = `
    <div class="generate-all-section">
      <button
        class="generate-all-btn"
        onclick="handleStep7Command('step7GenerateAll', {})"
        ${anyGenerating ? 'disabled' : ''}
      >
        <span class="sparkle-icon">✨</span>
        Generate All
      </button>
    </div>
  `;

  // =========================================================================
  // Task 3.4: Aha Moments Section
  // =========================================================================
  let ahaMomentsContentHtml = '';
  if (isGeneratingMoments) {
    ahaMomentsContentHtml = `
      <div class="section-loading">
        <div class="typing-indicator">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
        <span class="loading-text">Generating aha moments...</span>
      </div>
    `;
  } else if (ahaMoments.length === 0) {
    ahaMomentsContentHtml = `
      <div class="empty-state">
        <p>No aha moments yet. Add one manually or click <span class="sparkle-icon">✨</span> Generate Moments</p>
      </div>
    `;
  } else {
    ahaMomentsContentHtml = ahaMoments.map((moment, index) =>
      renderAhaMomentRow(moment, index, confirmedAgents)
    ).join('');
  }

  const canAddMoment = ahaMoments.length < MAX_AHA_MOMENTS;
  const ahaMomentsHtml = `
    <div class="demo-strategy-section aha-moments-section">
      <div class="section-header">
        <div class="section-header-left">
          <h3>Aha Moments</h3>
        </div>
        <button
          class="generate-section-btn"
          onclick="handleStep7Command('step7GenerateMoments', {})"
          ${isGeneratingMoments ? 'disabled' : ''}
        >
          <span class="sparkle-icon">✨</span>
          Generate Moments
        </button>
      </div>
      <p class="section-tip">Tip: 2-3 key moments keeps your demo focused</p>

      <div class="aha-moments-list">
        ${ahaMomentsContentHtml}
      </div>

      <button
        class="add-moment-btn"
        onclick="handleStep7Command('step7AddMoment', {})"
        ${!canAddMoment ? 'disabled' : ''}
      >
        + Add Moment
      </button>
      ${!canAddMoment ? '<span class="max-rows-hint">Maximum 5 moments reached</span>' : ''}
    </div>
  `;

  // =========================================================================
  // Task 3.6: Demo Persona Section
  // =========================================================================
  let personaContentHtml = '';
  if (isGeneratingPersona) {
    personaContentHtml = `
      <div class="section-loading">
        <div class="typing-indicator">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
        <span class="loading-text">Generating persona...</span>
      </div>
    `;
  } else {
    personaContentHtml = `
      <div class="persona-fields">
        <div class="persona-field">
          <label class="field-label">Name</label>
          <input
            type="text"
            class="persona-input"
            placeholder="e.g., Maria, Regional Inventory Manager"
            value="${escapeHtml(persona.name)}"
            oninput="handleStep7Command('step7UpdatePersonaName', { value: this.value })"
          >
        </div>
        <div class="persona-field">
          <label class="field-label">Role</label>
          <input
            type="text"
            class="persona-input"
            placeholder="e.g., Reviews morning replenishment recommendations for 12 stores"
            value="${escapeHtml(persona.role)}"
            oninput="handleStep7Command('step7UpdatePersonaRole', { value: this.value })"
          >
        </div>
        <div class="persona-field">
          <label class="field-label">Pain Point</label>
          <textarea
            class="persona-textarea"
            placeholder="e.g., Currently spends 2 hours manually checking stock levels"
            oninput="handleStep7Command('step7UpdatePersonaPainPoint', { value: this.value })"
          >${escapeHtml(persona.painPoint)}</textarea>
        </div>
      </div>
    `;
  }

  const personaHtml = `
    <div class="demo-strategy-section persona-section">
      <div class="section-header">
        <div class="section-header-left">
          <h3>Demo Persona</h3>
        </div>
        <button
          class="generate-section-btn"
          onclick="handleStep7Command('step7GeneratePersona', {})"
          ${isGeneratingPersona ? 'disabled' : ''}
        >
          <span class="sparkle-icon">✨</span>
          Generate Persona
        </button>
      </div>

      ${personaContentHtml}
    </div>
  `;

  // =========================================================================
  // Task 3.7: Narrative Flow Section
  // =========================================================================
  let narrativeContentHtml = '';
  if (isGeneratingNarrative) {
    narrativeContentHtml = `
      <div class="section-loading">
        <div class="typing-indicator">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
        <span class="loading-text">Generating narrative...</span>
      </div>
    `;
  } else if (narrativeScenes.length === 0) {
    narrativeContentHtml = `
      <div class="empty-state">
        <p>No scenes defined yet. Add one manually or click <span class="sparkle-icon">✨</span> Generate Narrative</p>
      </div>
    `;
  } else {
    narrativeContentHtml = narrativeScenes.map((scene, index) =>
      renderNarrativeSceneCard(scene, index, narrativeScenes.length, confirmedAgents)
    ).join('');
  }

  const canAddScene = narrativeScenes.length < MAX_NARRATIVE_SCENES;
  const narrativeHtml = `
    <div class="demo-strategy-section narrative-section">
      <div class="section-header">
        <div class="section-header-left">
          <h3>Narrative Flow</h3>
        </div>
        <button
          class="generate-section-btn"
          onclick="handleStep7Command('step7GenerateNarrative', {})"
          ${isGeneratingNarrative ? 'disabled' : ''}
        >
          <span class="sparkle-icon">✨</span>
          Generate Narrative
        </button>
      </div>

      <div class="narrative-scenes-list">
        ${narrativeContentHtml}
      </div>

      <button
        class="add-scene-btn"
        onclick="handleStep7Command('step7AddScene', {})"
        ${!canAddScene ? 'disabled' : ''}
      >
        + Add Scene
      </button>
      ${!canAddScene ? '<span class="max-rows-hint">Maximum 8 scenes reached</span>' : ''}
    </div>
  `;

  // =========================================================================
  // Combine all sections
  // =========================================================================
  return `
    <div class="step7-header">
      <h2>Demo Strategy</h2>
      <p class="step-description">Define your demo presentation strategy with aha moments, persona, and narrative flow.</p>
    </div>

    ${generateAllHtml}
    ${ahaMomentsHtml}
    ${personaHtml}
    ${narrativeHtml}
  `;
}

/**
 * Get navigation buttons HTML
 * Task 8.2: Generate button now calls generateSteeringFiles()
 */
export function getNavigationButtonsHtml(state: IdeationState): string {
  const isFirstStep = state.currentStep === 1;
  const isLastStep = state.currentStep === 8;
  const isStep4 = state.currentStep === 4;

  // Step 8 has its own action buttons in generateStep8Html(), so don't render navigation buttons
  if (isLastStep) {
    return '';
  }

  // Skip button for Step 4 (optional step)
  const skipButton = isStep4
    ? '<button class="nav-btn skip-btn" onclick="skipSecurityStep()">Skip</button>'
    : '';

  return `
      <div class="nav-buttons">
        ${isFirstStep ? '<div></div>' : '<button class="nav-btn secondary" onclick="previousStep()">Back</button>'}
        <div class="nav-buttons-right">
          ${skipButton}
          <button class="nav-btn primary" onclick="nextStep()">Next</button>
        </div>
      </div>
    `;
}

/**
 * Get Ideation content HTML (combines step indicator, content, and navigation)
 */
export function getIdeationContentHtml(state: IdeationState, validation: IdeationValidationState): string {
  return `
      ${getStepIndicatorHtml(state)}
      ${getStepContentHtml(state, validation)}
      ${getNavigationButtonsHtml(state)}
    `;
}

// ============================================================================
// Step 8: Helper Functions
// ============================================================================

/** Step names for display */
const STEP_NAMES: Record<number, string> = {
  1: 'Business Context',
  2: 'AI Gap Filling',
  3: 'Outcomes',
  4: 'Security',
  5: 'Agent Design',
  6: 'Mock Data',
  7: 'Demo Strategy',
};

/**
 * Truncate text to a maximum length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Compute step summaries from IdeationState
 * Used by getStepContentHtml for Step 8 rendering
 */
export function computeStepSummaries(state: IdeationState): StepSummary[] {
  const summaries: StepSummary[] = [];

  for (let stepNumber = 1; stepNumber <= 7; stepNumber++) {
    const { status, message } = getValidationStatusForStep(stepNumber, state);
    const summaryData = getSummaryDataForStep(stepNumber, state);

    summaries.push({
      stepNumber,
      stepName: STEP_NAMES[stepNumber],
      summaryData,
      validationStatus: status,
      validationMessage: message,
    });
  }

  return summaries;
}

/**
 * Get validation status for a specific step
 */
function getValidationStatusForStep(
  stepNumber: number,
  state: IdeationState
): { status: StepValidationStatus; message?: string } {
  switch (stepNumber) {
    case 1:
      if (!state.businessObjective || state.businessObjective.trim() === '') {
        return { status: 'error', message: 'Business objective is required' };
      }
      if (!state.industry || state.industry.trim() === '') {
        return { status: 'error', message: 'Industry is required' };
      }
      if (state.systems.length === 0) {
        return { status: 'warning', message: 'No systems selected' };
      }
      return { status: 'complete' };

    case 2:
      if (!state.aiGapFillingState.assumptionsAccepted) {
        return { status: 'warning', message: 'Assumptions not yet accepted' };
      }
      return { status: 'complete' };

    case 3:
      if (!state.outcome.primaryOutcome || state.outcome.primaryOutcome.trim() === '') {
        return { status: 'error', message: 'Primary outcome is required' };
      }
      if (state.outcome.successMetrics.length === 0) {
        return { status: 'warning', message: 'No success metrics defined' };
      }
      return { status: 'complete' };

    case 4:
      if (state.securityGuardrails.skipped) {
        return { status: 'warning', message: 'Security configuration was skipped' };
      }
      return { status: 'complete' };

    case 5:
      if (!state.agentDesign.confirmedAgents || state.agentDesign.confirmedAgents.length === 0) {
        return { status: 'error', message: 'No agents configured' };
      }
      return { status: 'complete' };

    case 6: {
      const mockData = state.mockData;
      if (!mockData || mockData.mockDefinitions.length === 0) {
        return { status: 'warning', message: 'No mock data defined' };
      }
      const hasEmptySampleData = mockData.mockDefinitions.some(
        (def) => def.sampleData.length === 0
      );
      if (hasEmptySampleData) {
        return { status: 'warning', message: 'Some tools have no sample data' };
      }
      return { status: 'complete' };
    }

    case 7: {
      const demoStrategy = state.demoStrategy;
      if (!demoStrategy) {
        return { status: 'warning', message: 'Demo strategy not configured' };
      }
      if (demoStrategy.ahaMoments.length === 0) {
        return { status: 'warning', message: 'No aha moments defined' };
      }
      if (demoStrategy.narrativeScenes.length === 0) {
        return { status: 'warning', message: 'No narrative scenes defined' };
      }
      return { status: 'complete' };
    }

    default:
      return { status: 'complete' };
  }
}

/**
 * Get summary data for a specific step
 */
function getSummaryDataForStep(
  stepNumber: number,
  state: IdeationState
): Record<string, string> {
  switch (stepNumber) {
    case 1:
      return {
        'Industry': state.industry || 'Not specified',
        'Systems': state.systems.length > 0 ? `${state.systems.length} system(s)` : 'None selected',
        'Objective': truncateText(state.businessObjective, 50) || 'Not specified',
      };

    case 2:
      return {
        'Assumptions': `${state.aiGapFillingState.confirmedAssumptions.length} confirmed`,
        'Status': state.aiGapFillingState.assumptionsAccepted ? 'Accepted' : 'Pending',
      };

    case 3:
      return {
        'Outcome': truncateText(state.outcome.primaryOutcome, 40) || 'Not specified',
        'KPIs': `${state.outcome.successMetrics.length} metric(s)`,
        'Stakeholders': `${state.outcome.stakeholders.length} stakeholder(s)`,
      };

    case 4:
      if (state.securityGuardrails.skipped) {
        return { 'Status': 'Skipped' };
      }
      return {
        'Sensitivity': state.securityGuardrails.dataSensitivity || 'Not specified',
        'Frameworks': state.securityGuardrails.complianceFrameworks.length > 0
          ? state.securityGuardrails.complianceFrameworks.join(', ')
          : 'None',
      };

    case 5: {
      const agents = state.agentDesign.confirmedAgents || [];
      return {
        'Agents': `${agents.length} configured`,
        'Pattern': state.agentDesign.confirmedOrchestration || 'Not specified',
      };
    }

    case 6: {
      const mockData = state.mockData;
      if (!mockData) {
        return { 'Status': 'Not configured' };
      }
      return {
        'Tools': `${mockData.mockDefinitions.length} defined`,
        'Status': mockData.mockDefinitions.length > 0 ? 'Configured' : 'Pending',
      };
    }

    case 7: {
      const demoStrategy = state.demoStrategy;
      if (!demoStrategy) {
        return { 'Status': 'Not configured' };
      }
      return {
        'Aha Moments': `${demoStrategy.ahaMoments.length} defined`,
        'Scenes': `${demoStrategy.narrativeScenes.length} scenes`,
        'Persona': demoStrategy.persona.name || 'Not specified',
      };
    }

    default:
      return {};
  }
}

// ============================================================================
// Step 8: Generation HTML Functions
// Task Group 4: Pre-Generation Summary UI
// ============================================================================

/**
 * Task 4.5: Get status icon SVG based on validation status
 * Following logPanelHtmlGenerator.ts pattern for consistent icons
 */
export function getStatusIconSvg(status: StepValidationStatus): string {
  switch (status) {
    case 'complete':
      return `<svg class="status-icon status-complete" viewBox="0 0 16 16" fill="currentColor">
        <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
      </svg>`;
    case 'warning':
      return `<svg class="status-icon status-warning" viewBox="0 0 16 16" fill="currentColor">
        <path fill-rule="evenodd" d="M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z"/>
      </svg>`;
    case 'error':
      return `<svg class="status-icon status-error" viewBox="0 0 16 16" fill="currentColor">
        <path fill-rule="evenodd" d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
      </svg>`;
    default:
      return '';
  }
}

/**
 * Task 4.4: Render a single step summary card
 * Uses .agent-card class structure from Step 5 for consistent styling
 */
export function renderStepSummaryCard(summary: StepSummary): string {
  const statusIcon = getStatusIconSvg(summary.validationStatus);

  // Build summary data rows
  const dataRowsHtml = Object.entries(summary.summaryData)
    .map(([key, value]) => `
      <div class="summary-card-data-row">
        <span class="summary-card-data-key">${escapeHtml(key)}:</span>
        <span class="summary-card-data-value">${escapeHtml(value)}</span>
      </div>
    `)
    .join('');

  // Build validation message if present
  const validationMessageHtml = summary.validationMessage
    ? `<div class="validation-message ${summary.validationStatus}">${escapeHtml(summary.validationMessage)}</div>`
    : '';

  return `
    <div class="summary-card" data-step="${summary.stepNumber}">
      <div class="summary-card-header">
        <span class="summary-card-title">${escapeHtml(summary.stepName)}</span>
        ${statusIcon}
      </div>
      ${validationMessageHtml}
      <div class="summary-card-body">
        ${dataRowsHtml}
      </div>
      <div class="summary-card-footer">
        <button
          class="summary-card-edit-btn"
          data-step="${summary.stepNumber}"
          onclick="handleStep8Command('step8EditStep', { step: ${summary.stepNumber} })"
        >
          Edit
        </button>
      </div>
    </div>
  `;
}

/**
 * Task 4.3: Render pre-generation summary grid
 * Displays summary cards for Steps 1-7
 */
export function renderPreGenerationSummary(summaries: StepSummary[]): string {
  const cardsHtml = summaries.map(summary => renderStepSummaryCard(summary)).join('');

  return `
    <div class="summary-cards-grid">
      ${cardsHtml}
    </div>
  `;
}

/**
 * Task 5.4: Render file progress list for the generation accordion
 * Shows status for each steering file during generation
 */
export function renderFileProgressList(state: GenerationState): string {
  const filesHtml = STEERING_FILES.map((fileName, index) => {
    let statusClass = 'pending';
    let statusIcon = '<span class="file-status-pending">○</span>';
    let errorMessage = '';

    if (state.completedFiles.includes(fileName)) {
      statusClass = 'complete';
      statusIcon = getStatusIconSvg('complete');
    } else if (state.failedFile?.name === fileName) {
      statusClass = 'error';
      statusIcon = getStatusIconSvg('error');
      errorMessage = `<span class="file-error-message">${escapeHtml(state.failedFile.error)}</span>`;
    } else if (state.currentFileIndex === index && state.isGenerating) {
      statusClass = 'active';
      statusIcon = '<span class="spinner-icon"></span>';
    } else if (state.failedFile && index > STEERING_FILES.indexOf(state.failedFile.name)) {
      statusClass = 'skipped';
      statusIcon = '<span class="file-status-skipped">—</span>';
    }

    return `
      <div class="file-progress-item ${statusClass}">
        <span class="file-progress-icon">${statusIcon}</span>
        <span class="file-progress-name">${escapeHtml(fileName)}</span>
        ${errorMessage}
      </div>
    `;
  }).join('');

  return `<div class="file-progress-list">${filesHtml}</div>`;
}

/**
 * Task 5.2: Render generation progress checklist
 * Shows the 3-item checklist with nested file progress accordion
 */
export function renderGenerationProgress(state: GenerationState): string {
  const completedCount = state.completedFiles.length;
  const totalCount = TOTAL_STEERING_FILES;

  // Determine status of each checklist item
  const validateStatus = state.isGenerating || completedCount > 0 ? 'complete' : 'pending';
  const generateStatus = state.failedFile ? 'error' :
    completedCount === totalCount ? 'complete' :
    state.isGenerating ? 'active' : 'pending';
  const readyStatus = completedCount === totalCount && !state.failedFile ? 'complete' : 'pending';

  // Status icons
  const validateIcon = validateStatus === 'complete' ? getStatusIconSvg('complete') : '<span class="progress-pending">○</span>';
  const generateIcon = generateStatus === 'active' ? '<span class="spinner-icon"></span>' :
    generateStatus === 'complete' ? getStatusIconSvg('complete') :
    generateStatus === 'error' ? getStatusIconSvg('error') : '<span class="progress-pending">○</span>';
  const readyIcon = readyStatus === 'complete' ? getStatusIconSvg('complete') : '<span class="progress-pending">○</span>';

  // Accordion summary text
  const summaryText = state.isGenerating
    ? `Generating... (${completedCount}/${totalCount} files)`
    : state.failedFile
      ? `Failed at ${state.failedFile.name}`
      : `${completedCount}/${totalCount} files created`;

  // Accordion expanded state
  const accordionClass = state.accordionExpanded ? 'expanded' : '';
  const chevronIcon = state.accordionExpanded ? 'chevron-down' : 'chevron-right';


  return `
    <div class="progress-checklist">
      <div class="progress-item ${validateStatus}">
        <span class="progress-icon">${validateIcon}</span>
        <span class="progress-label">Validate wizard inputs</span>
      </div>

      <div class="progress-item ${generateStatus}">
        <div class="progress-accordion ${accordionClass}">
          <div class="progress-accordion-header" onclick="handleStep8Command('step8ToggleAccordion', {})">
            <span class="progress-icon">${generateIcon}</span>
            <span class="progress-label">Generate steering files</span>
            <span class="progress-summary">${summaryText}</span>
            <span class="accordion-chevron ${chevronIcon}"></span>
          </div>
          <div class="progress-accordion-content">
            ${renderFileProgressList(state)}
          </div>
        </div>
      </div>

      <div class="progress-item ${readyStatus}">
        <span class="progress-icon">${readyIcon}</span>
        <span class="progress-label">Ready for Kiro</span>
      </div>
    </div>
  `;
}

// ============================================================================
// Phase Card Render Functions (4-phase always-visible layout)
// ============================================================================

/**
 * Phase 1: Render steering files generation section
 * Shows progress during generation, file list on success, retry on error
 */
export function renderPhase1SteeringSection(state: GenerationState): string {
  const completedCount = state.completedFiles.length;
  const totalCount = TOTAL_STEERING_FILES;

  // Show loading state
  if (state.isGenerating) {
    return `
      <div class="phase-card active">
        <div class="phase-header">
          <span class="phase-number"><span class="spinner-icon"></span></span>
          <div class="phase-title">
            <h3>Steering Files</h3>
            <span class="phase-file">.kiro/steering/*.md</span>
          </div>
        </div>
        <div class="phase-progress">
          <span class="progress-text">Generating... (${completedCount}/${totalCount} files)</span>
          <div class="progress-accordion ${state.accordionExpanded ? 'expanded' : ''}">
            <div class="progress-accordion-header" onclick="handleStep8Command('step8ToggleAccordion', {})">
              <span class="accordion-chevron ${state.accordionExpanded ? 'chevron-down' : 'chevron-right'}"></span>
              <span>View files</span>
            </div>
            <div class="progress-accordion-content">
              ${renderFileProgressList(state)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Show success state
  if (state.steeringComplete) {
    const filesHtml = state.generatedFilePaths.map((filePath, index) => {
      const fileName = STEERING_FILES[index] || filePath.split('/').pop() || 'unknown';
      return `
        <div class="generated-file-item">
          <span class="generated-file-name">${escapeHtml(fileName)}</span>
          <button
            class="open-file-link"
            onclick="handleStep8Command('step8OpenFile', { filePath: '${escapeHtml(filePath)}' })"
          >
            Open
          </button>
        </div>
      `;
    }).join('');

    return `
      <div class="phase-card complete">
        <div class="phase-header">
          <span class="phase-number complete">${getStatusIconSvg('complete')}</span>
          <div class="phase-title">
            <h3>Steering Files</h3>
            <span class="phase-file">.kiro/steering/*.md</span>
          </div>
        </div>
        <div class="file-list collapsed">
          ${filesHtml}
        </div>
        <div class="phase-actions">
          <button
            class="open-folder-btn nav-btn secondary"
            onclick="handleStep8Command('step8OpenKiroFolder', {})"
          >
            Open Folder
          </button>
          <button
            class="regenerate-link"
            onclick="handleStep8Command('step8Generate', {})"
          >
            Regenerate
          </button>
        </div>
      </div>
    `;
  }

  // Show error state
  if (state.failedFile) {
    return `
      <div class="phase-card error">
        <div class="phase-header">
          <span class="phase-number error">${getStatusIconSvg('error')}</span>
          <div class="phase-title">
            <h3>Steering Files</h3>
            <span class="phase-file">.kiro/steering/*.md</span>
          </div>
        </div>
        <div class="phase-error">
          <p class="error-details">Failed at ${escapeHtml(state.failedFile.name)}: ${escapeHtml(state.failedFile.error)}</p>
          <div class="error-actions">
            <button
              class="retry-btn nav-btn primary"
              onclick="handleStep8Command('step8Retry', {})"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Show initial state with Generate button
  const disabledGenerate = !state.canGenerate ? 'disabled' : '';
  const generateTooltip = !state.canGenerate ? 'title="Fix validation errors to generate"' : '';

  return `
    <div class="phase-card">
      <div class="phase-header">
        <span class="phase-number">1</span>
        <div class="phase-title">
          <h3>Steering Files</h3>
          <span class="phase-file">.kiro/steering/*.md</span>
        </div>
      </div>
      <p class="phase-description">
        Generate ${totalCount} steering files that guide Kiro in building your agent workflow.
      </p>
      <button
        class="generate-btn nav-btn primary"
        ${disabledGenerate}
        ${generateTooltip}
        onclick="handleStep8Command('step8Generate', {})"
      >
        Generate Steering Files
      </button>
    </div>
  `;
}

/**
 * Phase 2: Render policy files generation section
 * Shows policy generation for compliance/security rules
 */
export function renderPhase2PolicySection(state: GenerationState): string {
  // Skip entirely if policy was skipped (no security config)
  if (state.policySkipped) {
    return `
      <div class="phase-card skipped">
        <div class="phase-header">
          <span class="phase-number skipped">—</span>
          <div class="phase-title">
            <h3>Policy Files</h3>
            <span class="phase-file">policies/*.txt</span>
          </div>
        </div>
        <p class="phase-description skipped-text">
          Skipped — no compliance frameworks or approval gates configured in Step 4.
        </p>
      </div>
    `;
  }

  // Show loading state
  if (state.policyGenerating) {
    return `
      <div class="phase-card active">
        <div class="phase-header">
          <span class="phase-number"><span class="spinner-icon"></span></span>
          <div class="phase-title">
            <h3>Policy Files</h3>
            <span class="phase-file">policies/*.txt</span>
          </div>
        </div>
        <div class="phase-progress">
          <div class="typing-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
          <span class="loading-text">Generating policy files...</span>
        </div>
      </div>
    `;
  }

  // Show success state
  if (state.policyGenerated && state.policyFilePaths.length > 0) {
    const filesHtml = state.policyFilePaths.map((filePath) => {
      const fileName = filePath.split('/').pop() || 'unknown';
      return `
        <div class="generated-file-item">
          <span class="generated-file-name">${escapeHtml(fileName)}</span>
          <button
            class="open-file-link"
            onclick="handleStep8Command('step8OpenFile', { filePath: '${escapeHtml(filePath)}' })"
          >
            Open
          </button>
        </div>
      `;
    }).join('');

    return `
      <div class="phase-card complete">
        <div class="phase-header">
          <span class="phase-number complete">${getStatusIconSvg('complete')}</span>
          <div class="phase-title">
            <h3>Policy Files</h3>
            <span class="phase-file">policies/*.txt</span>
          </div>
        </div>
        <div class="file-list collapsed">
          ${filesHtml}
        </div>
        <div class="phase-actions">
          <button
            class="regenerate-link"
            onclick="handleStep8Command('step8GeneratePolicies', {})"
          >
            Regenerate
          </button>
        </div>
      </div>
    `;
  }

  // Show error state
  if (state.policyError) {
    return `
      <div class="phase-card error">
        <div class="phase-header">
          <span class="phase-number error">${getStatusIconSvg('error')}</span>
          <div class="phase-title">
            <h3>Policy Files</h3>
            <span class="phase-file">policies/*.txt</span>
          </div>
        </div>
        <div class="phase-error">
          <p class="error-details">${escapeHtml(state.policyError)}</p>
          <button
            class="retry-btn nav-btn primary"
            onclick="handleStep8Command('step8GeneratePolicies', {})"
          >
            Try Again
          </button>
        </div>
      </div>
    `;
  }

  // Show initial state with Generate button
  return `
    <div class="phase-card">
      <div class="phase-header">
        <span class="phase-number">2</span>
        <div class="phase-title">
          <h3>Policy Files</h3>
          <span class="phase-file">policies/*.txt</span>
        </div>
      </div>
      <p class="phase-description">
        Generate natural language policy descriptions for AgentCore authorization.
      </p>
      <button
        class="generate-btn nav-btn primary"
        onclick="handleStep8Command('step8GeneratePolicies', {})"
      >
        Generate Policies
      </button>
    </div>
  `;
}

/**
 * Phase 4: Render demo strategy generation section
 * Shows DEMO.md generation for demo narrative and talking points
 */
export function renderPhase4DemoSection(state: GenerationState): string {
  // Show loading state
  if (state.demoGenerating) {
    return `
      <div class="phase-card active">
        <div class="phase-header">
          <span class="phase-number"><span class="spinner-icon"></span></span>
          <div class="phase-title">
            <h3>Demo Strategy</h3>
            <span class="phase-file">DEMO.md</span>
          </div>
        </div>
        <div class="phase-progress">
          <div class="typing-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
          <span class="loading-text">Generating DEMO.md...</span>
        </div>
      </div>
    `;
  }

  // Show success state
  if (state.demoGenerated && state.demoFilePath) {
    return `
      <div class="phase-card complete">
        <div class="phase-header">
          <span class="phase-number complete">${getStatusIconSvg('complete')}</span>
          <div class="phase-title">
            <h3>Demo Strategy</h3>
            <span class="phase-file">DEMO.md</span>
          </div>
        </div>
        <div class="demo-success">
          <p class="success-hint">Your demo script with personas, aha moments, and talking points is ready.</p>
          <div class="phase-actions">
            <button
              class="open-demo-btn nav-btn primary"
              onclick="handleStep8Command('step8OpenDemo', {})"
            >
              Open DEMO.md
            </button>
            <button
              class="regenerate-link"
              onclick="handleStep8Command('step8GenerateDemo', {})"
            >
              Regenerate
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Show error state
  if (state.demoError) {
    return `
      <div class="phase-card error">
        <div class="phase-header">
          <span class="phase-number error">${getStatusIconSvg('error')}</span>
          <div class="phase-title">
            <h3>Demo Strategy</h3>
            <span class="phase-file">DEMO.md</span>
          </div>
        </div>
        <div class="phase-error">
          <p class="error-details">${escapeHtml(state.demoError)}</p>
          <button
            class="retry-btn nav-btn primary"
            onclick="handleStep8Command('step8GenerateDemo', {})"
          >
            Try Again
          </button>
        </div>
      </div>
    `;
  }

  // Show initial state with Generate button
  return `
    <div class="phase-card">
      <div class="phase-header">
        <span class="phase-number">4</span>
        <div class="phase-title">
          <h3>Demo Strategy</h3>
          <span class="phase-file">DEMO.md</span>
        </div>
      </div>
      <p class="phase-description">
        Generate a demo script with personas, narrative scenes, and aha moments.
      </p>
      <button
        class="generate-btn nav-btn primary"
        onclick="handleStep8Command('step8GenerateDemo', {})"
      >
        Generate Demo
      </button>
    </div>
  `;
}

/**
 * Task 6.4: Render post-generation success UI
 * @deprecated - Kept for reference, replaced by phase-card layout
 */
export function renderPostGenerationSuccess(state: GenerationState): string {
  const filesHtml = state.generatedFilePaths.map((filePath, index) => {
    const fileName = STEERING_FILES[index] || filePath.split('/').pop() || 'unknown';
    return `
      <div class="generated-file-item">
        <span class="generated-file-name">${escapeHtml(fileName)}</span>
        <button
          class="open-file-link"
          data-file-path="${escapeHtml(filePath)}"
          onclick="handleStep8Command('step8OpenFile', { filePath: '${escapeHtml(filePath)}' })"
        >
          Open File
        </button>
      </div>
    `;
  }).join('');

  return `
    <div class="post-generation-success">
      <div class="success-message">
        ${getStatusIconSvg('complete')}
        <span>Phase 1: Steering files generated successfully!</span>
      </div>
      <div class="file-list">
        ${filesHtml}
      </div>
    </div>
    ${renderPhase3RoadmapSection(state)}
    <div class="step8-bottom-actions">
      <button
        class="start-over-button"
        onclick="handleStep8Command('step8StartOver', {})"
      >
        Start Over
      </button>
    </div>
  `;
}

/**
 * Phase 3: Render roadmap generation section
 * Shows Generate Roadmap button with dependency warning if steering files not complete
 */
export function renderPhase3RoadmapSection(state: GenerationState): string {
  // Dependency warning when steering files not complete
  const dependencyWarning = !state.steeringComplete ? `
    <div class="dependency-warning">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 12.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zM8.75 9a.75.75 0 0 1-1.5 0V5a.75.75 0 0 1 1.5 0v4z"/>
      </svg>
      <span>Generate steering files first for best results</span>
    </div>
  ` : '';

  // Show loading state
  if (state.roadmapGenerating) {
    return `
      <div class="phase-card active">
        <div class="phase-header">
          <span class="phase-number">3</span>
          <div class="phase-title">
            <h3>Implementation Roadmap</h3>
            <span class="phase-file">ROADMAP.md</span>
          </div>
        </div>
        ${dependencyWarning}
        <div class="roadmap-generating">
          <div class="typing-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
          <span class="loading-text">Generating ROADMAP.md...</span>
        </div>
      </div>
    `;
  }

  // Show success state
  if (state.roadmapGenerated && state.roadmapFilePath) {
    return `
      <div class="phase-card complete">
        <div class="phase-header">
          <span class="phase-number complete">${getStatusIconSvg('complete')}</span>
          <div class="phase-title">
            <h3>Implementation Roadmap</h3>
            <span class="phase-file">ROADMAP.md</span>
          </div>
        </div>
        <div class="roadmap-success">
          <div class="roadmap-instructions">
            <p><strong>Next Step — Ask Kiro:</strong></p>
            <div class="kiro-prompt-hint">
              <code>"Create specs for item 1 in ROADMAP.md"</code>
            </div>
            <p class="roadmap-note">Then follow Kiro's spec-driven development flow. Repeat for each item in order.</p>
          </div>
          <div class="phase-actions">
            <button
              class="open-roadmap-btn nav-btn primary"
              onclick="handleStep8Command('step8OpenRoadmap', {})"
            >
              Open ROADMAP.md
            </button>
            <button
              class="regenerate-link"
              onclick="handleStep8Command('step8GenerateRoadmap', {})"
            >
              Regenerate
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Show error state
  if (state.roadmapError) {
    return `
      <div class="phase-card error">
        <div class="phase-header">
          <span class="phase-number error">${getStatusIconSvg('error')}</span>
          <div class="phase-title">
            <h3>Implementation Roadmap</h3>
            <span class="phase-file">ROADMAP.md</span>
          </div>
        </div>
        ${dependencyWarning}
        <div class="phase-error">
          <p class="error-details">${escapeHtml(state.roadmapError)}</p>
          <button
            class="retry-btn nav-btn primary"
            onclick="handleStep8Command('step8GenerateRoadmap', {})"
          >
            Try Again
          </button>
        </div>
      </div>
    `;
  }

  // Show initial state with Generate Roadmap button
  return `
    <div class="phase-card">
      <div class="phase-header">
        <span class="phase-number">3</span>
        <div class="phase-title">
          <h3>Implementation Roadmap</h3>
          <span class="phase-file">ROADMAP.md</span>
        </div>
      </div>
      ${dependencyWarning}
      <p class="phase-description">
        Generate a step-by-step implementation roadmap with copy-paste prompts for Kiro IDE.
      </p>
      <button
        class="generate-btn nav-btn primary"
        onclick="handleStep8Command('step8GenerateRoadmap', {})"
      >
        Generate Roadmap
      </button>
    </div>
  `;
}

/**
 * Task 6.5: Render generation error UI
 * Shows error message with retry option
 */
export function renderGenerationError(state: GenerationState): string {
  if (!state.failedFile) return '';

  return `
    <div class="generation-error">
      <div class="error-message">
        ${getStatusIconSvg('error')}
        <span>Generation failed at ${escapeHtml(state.failedFile.name)}</span>
      </div>
      <p class="error-details">${escapeHtml(state.failedFile.error)}</p>
      <div class="error-actions">
        <button
          class="retry-btn"
          onclick="handleStep8Command('step8Retry', {})"
        >
          Retry
        </button>
        <button
          class="start-over-button secondary"
          onclick="handleStep8Command('step8StartOver', {})"
        >
          Start Over
        </button>
      </div>
    </div>
  `;
}

/**
 * Task 6.2: Render action buttons for Step 8
 * Shows Generate and Generate & Open in Kiro buttons
 */
export function renderStep8ActionButtons(state: GenerationState): string {
  const disabledGenerate = state.isGenerating || !state.canGenerate ? 'disabled' : '';
  const generateTooltip = !state.canGenerate
    ? 'title="Fix validation errors to generate"'
    : state.isGenerating
      ? 'title="Generation in progress"'
      : '';

  return `
    <div class="step8-action-buttons">
      <button
        class="generate-btn nav-btn primary"
        ${disabledGenerate}
        ${generateTooltip}
        onclick="handleStep8Command('step8Generate', {})"
      >
        ${state.isGenerating ? 'Generating...' : 'Generate'}
      </button>
      <button
        class="generate-kiro-btn nav-btn secondary"
        ${disabledGenerate}
        onclick="handleStep8Command('step8GenerateAndOpenKiro', {})"
      >
        Generate & Open in Kiro
      </button>
    </div>
  `;
}

/**
 * Task 4.2: Generate Step 8 HTML
 * Main entry point for Step 8 rendering
 * Refactored: 4-phase always-visible layout
 */
export function generateStep8Html(state: GenerationState, summaries: StepSummary[]): string {
  // Pre-generation summary is collapsible (collapsed by default after any phase completes)
  const anyPhaseComplete = state.steeringComplete || state.policyGenerated || state.roadmapGenerated || state.demoGenerated;
  const summaryClass = anyPhaseComplete ? 'collapsed' : '';

  return `
    <div class="step8-header">
      <h2>Generate</h2>
      <p class="step-description">Generate project files for your agent workflow. Each phase can be generated independently.</p>
    </div>

    <div class="pre-gen-summary ${summaryClass}">
      <details ${anyPhaseComplete ? '' : 'open'}>
        <summary>Review Wizard Inputs</summary>
        ${renderPreGenerationSummary(summaries)}
      </details>
    </div>

    <div class="generation-phases">
      ${renderPhase1SteeringSection(state)}
      ${renderPhase2PolicySection(state)}
      ${renderPhase3RoadmapSection(state)}
      ${renderPhase4DemoSection(state)}
    </div>

    <div class="step8-bottom-actions">
      <button
        class="start-over-button"
        onclick="handleStep8Command('step8StartOver', {})"
      >
        Start Over
      </button>
    </div>
  `;
}
