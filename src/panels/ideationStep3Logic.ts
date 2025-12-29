/**
 * Step 3: Outcome Definition AI Logic
 * Extracted from tabbedPanel.ts for maintainability
 */

import * as vscode from 'vscode';
import { getOutcomeDefinitionService, OutcomeDefinitionService } from '../services/outcomeDefinitionService';
import type { SystemAssumption, OutcomeDefinitionState, SuccessMetric, RefinedSectionsState } from '../types/wizardPanel';

/**
 * Step 1-2 inputs needed for Step 3 context
 */
export interface Step1And2Inputs {
  businessObjective: string;
  industry: string;
  customIndustry?: string;
  systems: string[];
  customSystems?: string;
  confirmedAssumptions: SystemAssumption[];
}

/**
 * Callbacks for UI updates
 */
export interface Step3Callbacks {
  updateWebviewContent: () => void;
  syncStateToWebview: () => void;
}

/**
 * Create default Outcome Definition state
 */
export function createDefaultOutcomeDefinitionState(): OutcomeDefinitionState {
  return {
    primaryOutcome: '',
    successMetrics: [],
    stakeholders: [],
    isLoading: false,
    primaryOutcomeEdited: false,
    metricsEdited: false,
    stakeholdersEdited: false,
    customStakeholders: [],
    suggestionsAccepted: false,
    step2AssumptionsHash: undefined,
    refinedSections: { outcome: false, kpis: false, stakeholders: false },
  };
}

/**
 * Step 3 Logic Handler
 * Manages AI outcome suggestions and refinement
 */
export class Step3LogicHandler {
  private _outcomeService?: OutcomeDefinitionService;
  private _outcomeDisposables: vscode.Disposable[] = [];
  private _outcomeStreamingResponse = '';
  private _isOutcomeRefinement = false;
  private _step2AssumptionsHash?: string;
  private _context?: vscode.ExtensionContext;
  private _state: OutcomeDefinitionState;
  private _callbacks: Step3Callbacks;

  constructor(context: vscode.ExtensionContext | undefined, state: OutcomeDefinitionState, callbacks: Step3Callbacks) {
    this._context = context;
    this._state = state;
    this._callbacks = callbacks;
  }

  /**
   * Update state reference (for when parent state changes)
   */
  public setState(state: OutcomeDefinitionState): void {
    this._state = state;
  }

  /**
   * Get current state
   */
  public getState(): OutcomeDefinitionState {
    return this._state;
  }

  /**
   * Get the outcome service (for external use like Step 4 guardrails)
   */
  public getService(): OutcomeDefinitionService | undefined {
    return this.initOutcomeService();
  }

  /**
   * Reset the service conversation
   */
  public resetServiceConversation(): void {
    this._outcomeService?.resetConversation();
  }

  /**
   * Initialize OutcomeDefinitionService for Step 3 AI suggestions
   */
  private initOutcomeService(): OutcomeDefinitionService | undefined {
    if (this._outcomeService) {
      return this._outcomeService;
    }

    if (!this._context) {
      console.warn('[Step3Logic] Extension context not available for Outcome service');
      return undefined;
    }

    this._outcomeService = getOutcomeDefinitionService(this._context);

    // Subscribe to streaming events
    this._outcomeDisposables.push(
      this._outcomeService.onToken((token) => {
        this.handleOutcomeStreamingToken(token);
      })
    );

    this._outcomeDisposables.push(
      this._outcomeService.onComplete((response) => {
        this.handleOutcomeStreamingComplete(response);
      })
    );

    this._outcomeDisposables.push(
      this._outcomeService.onError((error) => {
        this.handleOutcomeStreamingError(error.message);
      })
    );

    return this._outcomeService;
  }

  /**
   * Generate a hash of Step 2 confirmed assumptions for change detection
   * Uses the djb2 hash algorithm
   */
  public generateStep2AssumptionsHash(confirmedAssumptions: SystemAssumption[]): string {
    // Sort by system name for consistent hash
    const sorted = [...confirmedAssumptions].sort((a, b) => a.system.localeCompare(b.system));
    const combined = JSON.stringify(sorted);

    // djb2 hash algorithm
    let hash = 5381;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash * 33) ^ combined.charCodeAt(i);
    }

    return (hash >>> 0).toString(16);
  }

  /**
   * Trigger auto-send when entering Step 3
   * Re-triggers AI if Step 2 assumptions have changed, or if fresh entry
   */
  public triggerAutoSend(inputs: Step1And2Inputs): void {
    const currentHash = this.generateStep2AssumptionsHash(inputs.confirmedAssumptions);

    // Check if assumptions have changed since last visit
    if (this._step2AssumptionsHash !== currentHash) {
      // Reset outcome state (preserve customStakeholders)
      const customStakeholders = this._state.customStakeholders;
      this._state.primaryOutcome = '';
      this._state.successMetrics = [];
      this._state.stakeholders = [];
      this._state.customStakeholders = customStakeholders;
      this._state.primaryOutcomeEdited = false;
      this._state.metricsEdited = false;
      this._state.stakeholdersEdited = false;
      this._state.isLoading = false;
      this._state.loadingError = undefined;
      this._state.suggestionsAccepted = false;
      this._state.step2AssumptionsHash = currentHash;
      this._state.refinedSections = { outcome: false, kpis: false, stakeholders: false };

      // Update hash
      this._step2AssumptionsHash = currentHash;

      // Trigger AI
      this.sendOutcomeContextToClaude(inputs);
    } else if (!this._state.primaryOutcome && !this._state.isLoading) {
      // Fresh entry with no outcome yet
      this.sendOutcomeContextToClaude(inputs);
    }
  }

  /**
   * Handle incoming streaming token for outcome suggestions
   */
  private handleOutcomeStreamingToken(token: string): void {
    this._outcomeStreamingResponse += token;
    // Note: Step 3 doesn't show streaming preview, just accumulates
  }

  /**
   * Handle streaming complete for outcome suggestions
   * Parses response and populates form fields (respecting edited flags)
   */
  private handleOutcomeStreamingComplete(response: string): void {
    this._state.isLoading = false;

    const service = this._outcomeService;
    if (!service) {
      this._outcomeStreamingResponse = '';
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
      return;
    }

    // Handle refinement response differently from initial suggestions
    if (this._isOutcomeRefinement) {
      // Try to parse as refinement changes first
      const changes = service.parseRefinementChangesFromResponse(response);
      if (changes) {
        // Apply changes and track which sections were refined
        if (changes.outcome !== undefined) {
          // In Phase 1 (not accepted) or Phase 2 with no manual edits: apply the change
          if (!this._state.suggestionsAccepted || !this._state.primaryOutcomeEdited) {
            this._state.primaryOutcome = changes.outcome;
            this._state.refinedSections.outcome = true;
          }
        }
        if (changes.kpis !== undefined) {
          if (!this._state.suggestionsAccepted || !this._state.metricsEdited) {
            this._state.successMetrics = changes.kpis;
            this._state.refinedSections.kpis = true;
          }
        }
        if (changes.stakeholders !== undefined) {
          if (!this._state.suggestionsAccepted || !this._state.stakeholdersEdited) {
            this.applyStakeholderChanges(changes.stakeholders);
            this._state.refinedSections.stakeholders = true;
          }
        }
      } else {
        // Fall back to parsing as full suggestions (AI might return full response)
        this.applyOutcomeSuggestions(service.parseOutcomeSuggestionsFromResponse(response));
      }
    } else {
      // Initial suggestions request - parse and apply full suggestions
      this.applyOutcomeSuggestions(service.parseOutcomeSuggestionsFromResponse(response));
    }

    this._outcomeStreamingResponse = '';
    this._isOutcomeRefinement = false;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Apply full outcome suggestions to state (for initial requests)
   */
  private applyOutcomeSuggestions(suggestions: ReturnType<OutcomeDefinitionService['parseOutcomeSuggestionsFromResponse']>): void {
    if (!suggestions) return;

    // Only update fields that haven't been manually edited
    if (!this._state.primaryOutcomeEdited && suggestions.primaryOutcome) {
      this._state.primaryOutcome = suggestions.primaryOutcome;
    }
    if (!this._state.metricsEdited && suggestions.suggestedKPIs) {
      this._state.successMetrics = suggestions.suggestedKPIs;
    }
    if (!this._state.stakeholdersEdited && suggestions.stakeholders) {
      this.applyStakeholderChanges(suggestions.stakeholders);
    }
  }

  /**
   * Apply stakeholder changes, separating standard and custom stakeholders
   */
  private applyStakeholderChanges(stakeholders: string[]): void {
    const standardOptions = ['Operations', 'Finance', 'IT', 'HR', 'Sales', 'Marketing', 'Customer Service', 'Executive Leadership'];
    const customFromAI = stakeholders.filter(s => !standardOptions.includes(s));
    const standardFromAI = stakeholders.filter(s => standardOptions.includes(s));

    this._state.stakeholders = standardFromAI;
    // Add custom AI stakeholders to customStakeholders array (if not already there)
    customFromAI.forEach(s => {
      if (!this._state.customStakeholders.includes(s)) {
        this._state.customStakeholders.push(s);
      }
      if (!this._state.stakeholders.includes(s)) {
        this._state.stakeholders.push(s);
      }
    });
  }

  /**
   * Handle streaming error for outcome suggestions
   */
  private handleOutcomeStreamingError(errorMessage: string): void {
    this._state.isLoading = false;
    this._state.loadingError = errorMessage;
    this._outcomeStreamingResponse = '';
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Build and send context to Claude for outcome suggestions
   */
  public async sendOutcomeContextToClaude(inputs: Step1And2Inputs): Promise<void> {
    const service = this.initOutcomeService();
    if (!service) {
      this._state.loadingError = 'Outcome service not available. Please check your configuration.';
      this._callbacks.syncStateToWebview();
      return;
    }

    // Build context message from Steps 1-2 inputs
    const contextMessage = service.buildOutcomeContextMessage(
      inputs.businessObjective,
      inputs.industry === 'Other'
        ? (inputs.customIndustry || inputs.industry)
        : inputs.industry,
      inputs.systems,
      inputs.confirmedAssumptions,
      inputs.customSystems
    );

    // Set loading state (initial request, not refinement)
    this._state.isLoading = true;
    this._state.loadingError = undefined;
    this._outcomeStreamingResponse = '';
    this._isOutcomeRefinement = false;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    // Send message to Claude (streaming handled by event handlers)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _token of service.sendMessage(contextMessage)) {
        // Tokens are handled by onToken event handler
      }
    } catch (error) {
      this.handleOutcomeStreamingError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Handle send outcome refinement message
   */
  public async handleSendOutcomeRefinement(content: string): Promise<void> {
    if (!content.trim()) return;

    const service = this.initOutcomeService();
    if (!service) {
      this._state.loadingError = 'Outcome service not available. Please check your configuration.';
      this._callbacks.syncStateToWebview();
      return;
    }

    // Set loading state (this is a refinement request)
    this._state.isLoading = true;
    this._state.loadingError = undefined;
    this._outcomeStreamingResponse = '';
    this._isOutcomeRefinement = true;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    // Send refinement message to Claude
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _token of service.sendRefinementMessage(
        content.trim(),
        this._state
      )) {
        // Tokens are handled by onToken event handler
      }
    } catch (error) {
      this.handleOutcomeStreamingError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Handle regenerate suggestions (called from command handler)
   */
  public handleRegenerateSuggestions(inputs: Step1And2Inputs): void {
    // Reset outcome state (preserve customStakeholders)
    const customStakeholdersToPreserve = this._state.customStakeholders;
    const step2Hash = this._state.step2AssumptionsHash;

    this._state.primaryOutcome = '';
    this._state.successMetrics = [];
    this._state.stakeholders = [];
    this._state.customStakeholders = customStakeholdersToPreserve;
    this._state.primaryOutcomeEdited = false;
    this._state.metricsEdited = false;
    this._state.stakeholdersEdited = false;
    this._state.isLoading = false;
    this._state.loadingError = undefined;
    this._state.suggestionsAccepted = false;
    this._state.step2AssumptionsHash = step2Hash;
    this._state.refinedSections = { outcome: false, kpis: false, stakeholders: false };

    // Reset outcome service conversation
    this._outcomeService?.resetConversation();

    // Fetch fresh AI suggestions
    this.sendOutcomeContextToClaude(inputs);
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this._outcomeDisposables.forEach(d => d.dispose());
    this._outcomeDisposables = [];
  }
}
