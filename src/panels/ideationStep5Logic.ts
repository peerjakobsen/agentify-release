/**
 * Step 5: Agent Design Proposal Logic
 * Handles AI-powered agent team design proposals and Phase 2 manual editing
 *
 * Task Group 2: Extended with Phase 2 editing methods for Step 5 Agent Design Editing feature
 */

import * as vscode from 'vscode';
import {
  getAgentDesignService,
  AgentDesignService,
  buildAgentDesignContextMessage,
  parseAgentProposalFromResponse,
} from '../services/agentDesignService';
import type {
  AgentDesignState,
  SystemAssumption,
  SuccessMetric,
  ProposedAgent,
  ProposedEdge,
  OrchestrationPattern,
} from '../types/wizardPanel';
import { createDefaultAgentDesignState } from '../types/wizardPanel';

/**
 * Step 1-4 inputs needed for Step 5 context
 */
export interface Step5ContextInputs {
  businessObjective: string;
  industry: string;
  customIndustry?: string;
  systems: string[];
  customSystems?: string;
  confirmedAssumptions: SystemAssumption[];
  primaryOutcome: string;
  successMetrics: SuccessMetric[];
  dataSensitivity: string;
  complianceFrameworks: string[];
  approvalGates: string[];
}

/**
 * Callbacks for UI updates
 */
export interface Step5Callbacks {
  updateWebviewContent: () => void;
  syncStateToWebview: () => void;
}

/**
 * Generate a hash of Steps 1-4 inputs for change detection
 * Uses the djb2 hash algorithm
 */
export function generateStep4Hash(inputs: Step5ContextInputs): string {
  const data = {
    industry: inputs.industry,
    customIndustry: inputs.customIndustry,
    systems: inputs.systems.sort(),
    customSystems: inputs.customSystems,
    assumptions: inputs.confirmedAssumptions
      .map(a => ({ system: a.system, modules: a.modules.sort() }))
      .sort((a, b) => a.system.localeCompare(b.system)),
    primaryOutcome: inputs.primaryOutcome,
    successMetrics: inputs.successMetrics.map(m => ({ name: m.name, targetValue: m.targetValue, unit: m.unit })),
    dataSensitivity: inputs.dataSensitivity,
    complianceFrameworks: inputs.complianceFrameworks.sort(),
    approvalGates: inputs.approvalGates.sort(),
  };

  const combined = JSON.stringify(data);

  // djb2 hash algorithm
  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 33) ^ combined.charCodeAt(i);
  }

  return (hash >>> 0).toString(16);
}

/**
 * Step 5 Logic Handler
 * Manages AI agent design proposals and Phase 2 manual editing
 */
export class Step5LogicHandler {
  private _agentDesignService?: AgentDesignService;
  private _agentDesignDisposables: vscode.Disposable[] = [];
  private _agentDesignStreamingResponse = '';
  private _context?: vscode.ExtensionContext;
  private _state: AgentDesignState;
  private _callbacks: Step5Callbacks;
  private _isRefinementRequest = false;
  private _nextAgentId = 1;

  constructor(context: vscode.ExtensionContext | undefined, state: AgentDesignState, callbacks: Step5Callbacks) {
    this._context = context;
    this._state = state;
    this._callbacks = callbacks;
    this._initializeNextAgentId();
  }

  /**
   * Initialize the next agent ID counter based on existing agents
   */
  private _initializeNextAgentId(): void {
    const existingAgentIds = this._state.proposedAgents
      .map(a => {
        const match = a.id.match(/^agent_(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);

    this._nextAgentId = existingAgentIds.length > 0 ? Math.max(...existingAgentIds) + 1 : 1;
  }

  /**
   * Update state reference (for when parent state changes)
   */
  public setState(state: AgentDesignState): void {
    this._state = state;
    this._initializeNextAgentId();
  }

  /**
   * Get current state
   */
  public getState(): AgentDesignState {
    return this._state;
  }

  /**
   * Initialize AgentDesignService
   */
  private initAgentDesignService(): AgentDesignService | undefined {
    if (this._agentDesignService) {
      return this._agentDesignService;
    }

    if (!this._context) {
      console.warn('[Step5Logic] Extension context not available for AgentDesign service');
      return undefined;
    }

    this._agentDesignService = getAgentDesignService(this._context);

    // Subscribe to streaming events
    this._agentDesignDisposables.push(
      this._agentDesignService.onToken((token) => {
        this.handleAgentDesignStreamingToken(token);
      })
    );

    this._agentDesignDisposables.push(
      this._agentDesignService.onComplete((response) => {
        this.handleAgentDesignStreamingComplete(response);
      })
    );

    this._agentDesignDisposables.push(
      this._agentDesignService.onError((error) => {
        this.handleAgentDesignStreamingError(error.message);
      })
    );

    return this._agentDesignService;
  }

  /**
   * Trigger auto-send when entering Step 5
   * Re-triggers AI if Steps 1-4 inputs have changed AND no agent data exists
   * Users can always use "Regenerate" button to refresh existing data
   */
  public triggerAutoSend(inputs: Step5ContextInputs): void {
    const currentHash = generateStep4Hash(inputs);
    const hasExistingAgents = this._state.proposedAgents.length > 0;

    // Skip auto-generation if we already have agent data
    // Users can use the "Regenerate" button to refresh from scratch
    if (hasExistingAgents) {
      // Just update the hash to prevent re-triggering on subsequent visits
      this._state.step4Hash = currentHash;
      return;
    }

    // Check if inputs have changed since last visit
    if (this._state.step4Hash !== currentHash) {
      // Reset agent design state
      const defaultState = createDefaultAgentDesignState();
      this._state.proposedAgents = defaultState.proposedAgents;
      this._state.proposedOrchestration = defaultState.proposedOrchestration;
      this._state.proposedEdges = defaultState.proposedEdges;
      this._state.orchestrationReasoning = defaultState.orchestrationReasoning;
      this._state.proposalAccepted = false;
      this._state.isLoading = false;
      this._state.error = undefined;
      this._state.aiCalled = false;
      this._state.step4Hash = currentHash;

      // Trigger AI
      this.sendAgentDesignContextToClaude(inputs);
    } else if (!this._state.aiCalled && !this._state.isLoading) {
      // Fresh entry with no AI call yet
      this.sendAgentDesignContextToClaude(inputs);
    }
  }

  /**
   * Handle incoming streaming token for agent design
   */
  private handleAgentDesignStreamingToken(token: string): void {
    this._agentDesignStreamingResponse += token;
    // Note: Step 5 doesn't show streaming preview, just accumulates
  }

  /**
   * Handle streaming complete for agent design
   * Task 2.7: Respects edited flags when in Phase 2 (refinement request)
   */
  private handleAgentDesignStreamingComplete(response: string): void {
    this._state.isLoading = false;

    // Parse the proposal from response
    const proposal = parseAgentProposalFromResponse(response);
    if (proposal) {
      // Task 2.7: In Phase 2 (refinement), respect edited flags
      if (this._isRefinementRequest && this._state.proposalAccepted) {
        // Ensure agents have edited flags initialized
        const agentsWithFlags = proposal.agents.map(a => ({
          ...a,
          nameEdited: a.nameEdited ?? false,
          roleEdited: a.roleEdited ?? false,
          toolsEdited: a.toolsEdited ?? false,
        }));
        this.mergeAiProposalRespectingEditedFlags(agentsWithFlags);
        // Update edges and orchestration (these are not tracked per-field)
        this._state.proposedEdges = proposal.edges;
        // Only update orchestration if user hasn't changed it from original
        if (this._state.proposedOrchestration === this._state.originalOrchestration) {
          this._state.proposedOrchestration = proposal.orchestrationPattern;
        }
        this._state.orchestrationReasoning = proposal.reasoning;
      } else {
        // Initial proposal or Phase 1 - apply all fields
        // Ensure agents have edited flags initialized
        this._state.proposedAgents = proposal.agents.map(a => ({
          ...a,
          nameEdited: a.nameEdited ?? false,
          roleEdited: a.roleEdited ?? false,
          toolsEdited: a.toolsEdited ?? false,
        }));
        this._state.proposedOrchestration = proposal.orchestrationPattern;
        this._state.proposedEdges = proposal.edges;
        this._state.orchestrationReasoning = proposal.reasoning;
      }
    } else {
      this._state.error = 'Failed to parse agent proposal from AI response';
    }

    this._agentDesignStreamingResponse = '';
    this._isRefinementRequest = false;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Handle streaming error for agent design
   */
  private handleAgentDesignStreamingError(errorMessage: string): void {
    this._state.isLoading = false;
    this._state.error = errorMessage;
    this._agentDesignStreamingResponse = '';
    this._isRefinementRequest = false;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Build and send context to Claude for agent design
   */
  public async sendAgentDesignContextToClaude(inputs: Step5ContextInputs): Promise<void> {
    const service = this.initAgentDesignService();
    if (!service) {
      this._state.error = 'Agent design service not available. Please check your configuration.';
      this._callbacks.syncStateToWebview();
      return;
    }

    // Build context message from Steps 1-4 inputs
    const effectiveIndustry = inputs.industry === 'Other'
      ? (inputs.customIndustry || inputs.industry)
      : inputs.industry;

    const contextMessage = buildAgentDesignContextMessage(
      inputs.businessObjective,
      effectiveIndustry,
      inputs.systems,
      inputs.customSystems,
      inputs.confirmedAssumptions,
      inputs.primaryOutcome,
      inputs.successMetrics,
      inputs.dataSensitivity,
      inputs.complianceFrameworks,
      inputs.approvalGates
    );

    // Set loading state
    this._state.isLoading = true;
    this._state.error = undefined;
    this._state.aiCalled = true;
    this._agentDesignStreamingResponse = '';
    this._isRefinementRequest = false;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    // Send message to Claude (streaming handled by event handlers)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _token of service.sendMessage(contextMessage)) {
        // Tokens are handled by onToken event handler
      }
    } catch (error) {
      this.handleAgentDesignStreamingError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Handle regenerate proposal request
   */
  public handleRegenerateProposal(inputs: Step5ContextInputs): void {
    // Clear state (preserve step4Hash)
    const hash = this._state.step4Hash;
    const defaultState = createDefaultAgentDesignState();
    this._state.proposedAgents = defaultState.proposedAgents;
    this._state.proposedOrchestration = defaultState.proposedOrchestration;
    this._state.proposedEdges = defaultState.proposedEdges;
    this._state.orchestrationReasoning = defaultState.orchestrationReasoning;
    this._state.proposalAccepted = false;
    this._state.isLoading = false;
    this._state.error = undefined;
    this._state.aiCalled = false;
    this._state.step4Hash = hash;

    // Reset service conversation
    if (this._agentDesignService) {
      this._agentDesignService.resetConversation();
    }

    // Re-fetch proposal
    this.sendAgentDesignContextToClaude(inputs);
  }

  /**
   * Handle accept proposal (existing Phase 1 accept)
   */
  public handleAcceptProposal(): void {
    this._state.proposalAccepted = true;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  // ============================================================================
  // Task 2.2: Phase 2 Transition Method
  // ============================================================================

  /**
   * Handle accept suggestions and transition to Phase 2
   * Task 2.2: Sets proposalAccepted: true and stores originalOrchestration
   */
  public handleAcceptSuggestionsPhase2(): void {
    this._state.proposalAccepted = true;
    this._state.originalOrchestration = this._state.proposedOrchestration;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  // ============================================================================
  // Task 2.3: Agent Editing Methods
  // ============================================================================

  /**
   * Update agent name and set nameEdited flag
   */
  public handleUpdateAgentName(agentId: string, name: string): void {
    const agent = this._state.proposedAgents.find(a => a.id === agentId);
    if (agent) {
      agent.name = name;
      agent.nameEdited = true;
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
    }
  }

  /**
   * Update agent role and set roleEdited flag
   */
  public handleUpdateAgentRole(agentId: string, role: string): void {
    const agent = this._state.proposedAgents.find(a => a.id === agentId);
    if (agent) {
      agent.role = role;
      agent.roleEdited = true;
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
    }
  }

  /**
   * Task 6.2: Update agent memory configuration
   * Handles per-agent memory settings (usesShortTermMemory, usesLongTermMemory, ltmStrategy)
   */
  public handleUpdateAgentMemory(agentId: string, field: string, value: boolean | string): void {
    const agent = this._state.proposedAgents.find(a => a.id === agentId);
    if (agent) {
      if (field === 'usesShortTermMemory') {
        agent.usesShortTermMemory = value as boolean;
      } else if (field === 'usesLongTermMemory') {
        agent.usesLongTermMemory = value as boolean;
      } else if (field === 'ltmStrategy') {
        agent.ltmStrategy = value as 'semantic' | 'summary' | 'user_preference';
      }
      agent.memoryEdited = true;
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
    }
  }

  /**
   * Add tool to agent and set toolsEdited flag
   */
  public handleAddAgentTool(agentId: string, tool: string): void {
    const agent = this._state.proposedAgents.find(a => a.id === agentId);
    if (agent && tool.trim()) {
      agent.tools.push(tool.trim());
      agent.toolsEdited = true;
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
    }
  }

  /**
   * Remove tool from agent and set toolsEdited flag
   */
  public handleRemoveAgentTool(agentId: string, toolIndex: number): void {
    const agent = this._state.proposedAgents.find(a => a.id === agentId);
    if (agent && toolIndex >= 0 && toolIndex < agent.tools.length) {
      agent.tools.splice(toolIndex, 1);
      agent.toolsEdited = true;
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
    }
  }

  // ============================================================================
  // Task 2.4: Agent Add/Remove Methods
  // ============================================================================

  /**
   * Add a new empty agent with auto-generated ID
   * Task 2.4: Generates unique ID using pattern agent_${nextId}
   */
  public handleAddAgent(): void {
    const newAgent: ProposedAgent = {
      id: `agent_${this._nextAgentId}`,
      name: '',
      role: '',
      tools: [],
      nameEdited: false,
      roleEdited: false,
      toolsEdited: false,
    };

    this._state.proposedAgents.push(newAgent);
    this._nextAgentId++;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Remove agent and all associated edges
   * Task 2.4: Auto-removes edges when agent is deleted
   */
  public handleRemoveAgent(agentId: string): void {
    // Remove the agent
    this._state.proposedAgents = this._state.proposedAgents.filter(a => a.id !== agentId);

    // Remove all edges that reference this agent
    this._state.proposedEdges = this._state.proposedEdges.filter(
      e => e.from !== agentId && e.to !== agentId
    );

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Get the count of edges associated with an agent
   * Helper for confirmation dialog
   */
  public getAgentEdgeCount(agentId: string): number {
    return this._state.proposedEdges.filter(
      e => e.from === agentId || e.to === agentId
    ).length;
  }

  // ============================================================================
  // Task 2.5: Orchestration and Edge Methods
  // ============================================================================

  /**
   * Update orchestration pattern
   */
  public handleUpdateOrchestration(pattern: OrchestrationPattern): void {
    this._state.proposedOrchestration = pattern;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Add an empty edge row
   */
  public handleAddEdge(): void {
    const newEdge: ProposedEdge = { from: '', to: '' };
    this._state.proposedEdges.push(newEdge);
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Remove edge at specified index
   */
  public handleRemoveEdge(index: number): void {
    if (index >= 0 && index < this._state.proposedEdges.length) {
      this._state.proposedEdges.splice(index, 1);
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
    }
  }

  /**
   * Update edge field (from or to)
   */
  public handleUpdateEdge(index: number, field: 'from' | 'to', agentId: string): void {
    if (index >= 0 && index < this._state.proposedEdges.length) {
      this._state.proposedEdges[index][field] = agentId;
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
    }
  }

  /**
   * Apply edge suggestion from AI
   */
  public handleApplyEdgeSuggestion(): void {
    if (this._state.edgeSuggestion?.edges) {
      this._state.proposedEdges = [...this._state.edgeSuggestion.edges];
      this._state.edgeSuggestion = undefined;
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
    }
  }

  /**
   * Dismiss edge suggestion
   */
  public handleDismissEdgeSuggestion(): void {
    this._state.edgeSuggestion = undefined;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  // ============================================================================
  // Task 2.5b: Back Navigation Method
  // ============================================================================

  /**
   * Handle back navigation to Step 5 from Step 6
   * Task 2.5b: Preserves Phase 2 state, does not reset to Phase 1
   */
  public handleBackNavigationToStep5(): void {
    // Preserve the current Phase 2 state
    // Do not reset proposalAccepted or confirmed fields
    // This allows the user to continue editing where they left off
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  // ============================================================================
  // Task 2.6: Confirmation Methods
  // ============================================================================

  /**
   * Handle accept and continue directly to Step 6 (from Phase 1)
   * Task 2.6: Copies proposals to confirmed fields, returns true to signal navigation
   */
  public handleAcceptAndContinue(): boolean {
    // Deep copy proposed agents to confirmed
    this._state.confirmedAgents = this._state.proposedAgents.map(a => ({
      ...a,
      tools: [...a.tools],
    }));
    this._state.confirmedOrchestration = this._state.proposedOrchestration;
    this._state.confirmedEdges = this._state.proposedEdges.map(e => ({ ...e }));

    // Set proposal accepted (even though we're skipping Phase 2)
    this._state.proposalAccepted = true;
    this._state.originalOrchestration = this._state.proposedOrchestration;

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    return true;
  }

  /**
   * Handle confirm design (from Phase 2)
   * Task 2.6: Copies potentially edited proposals to confirmed fields
   */
  public handleConfirmDesign(): boolean {
    // Deep copy proposed agents to confirmed (preserving edited flags)
    this._state.confirmedAgents = this._state.proposedAgents.map(a => ({
      ...a,
      tools: [...a.tools],
    }));
    this._state.confirmedOrchestration = this._state.proposedOrchestration;
    this._state.confirmedEdges = this._state.proposedEdges.map(e => ({ ...e }));

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    return true;
  }

  // ============================================================================
  // Task 2.7: Updated Send Adjustment (respects edited flags)
  // ============================================================================

  /**
   * Handle send adjustment request
   * Task 2.7: Includes edited flags in context message to AI
   */
  public async handleSendAdjustment(adjustmentText: string, inputs: Step5ContextInputs): Promise<void> {
    if (!adjustmentText.trim()) return;

    const service = this.initAgentDesignService();
    if (!service) {
      this._state.error = 'Agent design service not available. Please check your configuration.';
      this._callbacks.syncStateToWebview();
      return;
    }

    // Build adjustment message that includes current state and edited flags
    const currentAgentsWithFlags = this._state.proposedAgents
      .map(a => {
        const editedIndicators = [];
        if (a.nameEdited) editedIndicators.push('name edited by user');
        if (a.roleEdited) editedIndicators.push('role edited by user');
        if (a.toolsEdited) editedIndicators.push('tools edited by user');

        const editedNote = editedIndicators.length > 0
          ? ` [${editedIndicators.join(', ')}]`
          : '';

        return `- ${a.name} (#${a.id}): ${a.role}${editedNote}`;
      })
      .join('\n');

    const editedFieldsNote = this._state.proposalAccepted
      ? `\n\nIMPORTANT: Some fields have been manually edited by the user (marked above). Do NOT change those edited fields in your response. Only update fields that have not been edited.`
      : '';

    const adjustmentMessage = `The user wants to adjust the current agent design proposal.

Current agents:
${currentAgentsWithFlags}

Current orchestration: ${this._state.proposedOrchestration}
${editedFieldsNote}

User's adjustment request: "${adjustmentText}"

Please provide an updated agent design proposal that incorporates the user's requested changes. Return the complete updated proposal in JSON format.`;

    // Set loading state and mark as refinement request
    this._state.isLoading = true;
    this._state.error = undefined;
    this._agentDesignStreamingResponse = '';
    this._isRefinementRequest = this._state.proposalAccepted;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    // Send adjustment message to Claude (streaming handled by event handlers)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _token of service.sendMessage(adjustmentMessage)) {
        // Tokens are handled by onToken event handler
      }
    } catch (error) {
      this.handleAgentDesignStreamingError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Merge AI proposal while respecting edited flags
   * Task 2.7: Only updates fields where edited flag is false
   */
  public mergeAiProposalRespectingEditedFlags(aiAgents: ProposedAgent[]): void {
    for (const aiAgent of aiAgents) {
      const existingAgent = this._state.proposedAgents.find(a => a.id === aiAgent.id);

      if (existingAgent) {
        // Only update fields that haven't been edited by user
        if (!existingAgent.nameEdited) {
          existingAgent.name = aiAgent.name;
        }
        if (!existingAgent.roleEdited) {
          existingAgent.role = aiAgent.role;
        }
        if (!existingAgent.toolsEdited) {
          existingAgent.tools = [...aiAgent.tools];
        }
        // Task 6.4: Respect memoryEdited flag for memory fields
        if (!existingAgent.memoryEdited) {
          existingAgent.usesShortTermMemory = aiAgent.usesShortTermMemory;
          existingAgent.usesLongTermMemory = aiAgent.usesLongTermMemory;
          existingAgent.ltmStrategy = aiAgent.ltmStrategy;
        }
      } else {
        // New agent from AI - add it
        this._state.proposedAgents.push({
          ...aiAgent,
          tools: [...aiAgent.tools],
          nameEdited: false,
          roleEdited: false,
          toolsEdited: false,
          // Task 6.4: Initialize memory fields for new agents
          usesShortTermMemory: aiAgent.usesShortTermMemory ?? true,
          usesLongTermMemory: aiAgent.usesLongTermMemory ?? false,
          ltmStrategy: aiAgent.ltmStrategy ?? 'semantic',
          memoryEdited: false,
        });
      }
    }

    // Note: We don't remove agents that AI didn't mention, to preserve user-added agents
  }

  // ============================================================================
  // Task 2.8: Validation Helper Methods
  // ============================================================================

  /**
   * Get agents with no incoming or outgoing edges
   * Task 2.8: Returns orphan agents for validation warnings
   */
  public getOrphanAgents(): ProposedAgent[] {
    const connectedAgentIds = new Set<string>();

    for (const edge of this._state.proposedEdges) {
      if (edge.from) connectedAgentIds.add(edge.from);
      if (edge.to) connectedAgentIds.add(edge.to);
    }

    return this._state.proposedAgents.filter(a => !connectedAgentIds.has(a.id));
  }

  /**
   * Check if at least one agent has no incoming edges (entry point)
   * Task 2.8: Returns true if an entry point exists
   */
  public hasEntryPoint(): boolean {
    const agentsWithIncomingEdges = new Set<string>();

    for (const edge of this._state.proposedEdges) {
      if (edge.to) agentsWithIncomingEdges.add(edge.to);
    }

    // Find agents that are in edges but have no incoming
    const agentIdsInEdges = new Set<string>();
    for (const edge of this._state.proposedEdges) {
      if (edge.from) agentIdsInEdges.add(edge.from);
      if (edge.to) agentIdsInEdges.add(edge.to);
    }

    // An entry point is an agent that appears in edges but has no incoming edges
    for (const agentId of agentIdsInEdges) {
      if (!agentsWithIncomingEdges.has(agentId)) {
        return true;
      }
    }

    // If no agents are in edges at all, check if we have any agents
    // (they would all be potential entry points)
    if (agentIdsInEdges.size === 0 && this._state.proposedAgents.length > 0) {
      return true;
    }

    return false;
  }

  /**
   * Get validation warnings (non-blocking)
   * Task 2.8: Returns array of warning messages
   */
  public getValidationWarnings(): string[] {
    const warnings: string[] = [];

    // Check for orphan agents
    const orphans = this.getOrphanAgents();
    if (orphans.length > 0) {
      const orphanNames = orphans.map(a => a.name || a.id).join(', ');
      warnings.push(`Orphan agent(s) with no connections: ${orphanNames}`);
    }

    // Check for entry point
    if (this._state.proposedEdges.length > 0 && !this.hasEntryPoint()) {
      warnings.push('No entry point detected: all agents have incoming edges (circular dependency)');
    }

    // Check for incomplete edges
    const incompleteEdges = this._state.proposedEdges.filter(e => !e.from || !e.to);
    if (incompleteEdges.length > 0) {
      warnings.push(`${incompleteEdges.length} edge(s) have missing from/to values`);
    }

    return warnings;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this._agentDesignDisposables.forEach(d => d.dispose());
    this._agentDesignDisposables = [];
  }
}
