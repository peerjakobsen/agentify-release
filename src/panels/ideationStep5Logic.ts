/**
 * Step 5: Agent Design Proposal Logic
 * Handles AI-powered agent team design proposals
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
 * Manages AI agent design proposals
 */
export class Step5LogicHandler {
  private _agentDesignService?: AgentDesignService;
  private _agentDesignDisposables: vscode.Disposable[] = [];
  private _agentDesignStreamingResponse = '';
  private _context?: vscode.ExtensionContext;
  private _state: AgentDesignState;
  private _callbacks: Step5Callbacks;

  constructor(context: vscode.ExtensionContext | undefined, state: AgentDesignState, callbacks: Step5Callbacks) {
    this._context = context;
    this._state = state;
    this._callbacks = callbacks;
  }

  /**
   * Update state reference (for when parent state changes)
   */
  public setState(state: AgentDesignState): void {
    this._state = state;
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
   * Re-triggers AI if Steps 1-4 inputs have changed
   */
  public triggerAutoSend(inputs: Step5ContextInputs): void {
    const currentHash = generateStep4Hash(inputs);

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
   */
  private handleAgentDesignStreamingComplete(response: string): void {
    this._state.isLoading = false;

    // Parse the proposal from response
    const proposal = parseAgentProposalFromResponse(response);
    if (proposal) {
      this._state.proposedAgents = proposal.agents;
      this._state.proposedOrchestration = proposal.orchestrationPattern;
      this._state.proposedEdges = proposal.edges;
      this._state.orchestrationReasoning = proposal.reasoning;
    } else {
      this._state.error = 'Failed to parse agent proposal from AI response';
    }

    this._agentDesignStreamingResponse = '';
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
   * Handle accept proposal
   */
  public handleAcceptProposal(): void {
    this._state.proposalAccepted = true;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Handle adjust proposal (placeholder for future implementation)
   */
  public handleAdjustProposal(): void {
    this._state.proposalAccepted = true;
    // Stay on Step 5 - adjustment UI coming in Roadmap Item 19
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this._agentDesignDisposables.forEach(d => d.dispose());
    this._agentDesignDisposables = [];
  }
}
