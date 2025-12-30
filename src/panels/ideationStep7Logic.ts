/**
 * Step 7: Demo Strategy Logic
 * Handles demo strategy content editing and AI generation for aha moments, persona, and narrative flow
 *
 * Task Group 4: Step 7 Logic Handler for Wizard Step 7 Demo Design
 */

import * as vscode from 'vscode';
import {
  getDemoStrategyService,
  DemoStrategyService,
  parseAhaMomentsFromResponse,
  parsePersonaFromResponse,
  parseNarrativeScenesFromResponse,
  type DemoStrategySection,
} from '../services/demoStrategyService';
import type {
  DemoStrategyState,
  AhaMoment,
  DemoPersona,
  NarrativeScene,
  ProposedAgent,
  ProposedEdge,
} from '../types/wizardPanel';
import { createDefaultDemoStrategyState } from '../types/wizardPanel';

/**
 * Step 7 context inputs needed for AI generation
 * Task 4.2: Define Step7ContextInputs interface
 */
export interface Step7ContextInputs {
  /** Industry context from Step 1 */
  industry: string;
  /** Business objective from Step 1 */
  businessObjective: string;
  /** Confirmed agents from Step 5 */
  confirmedAgents: ProposedAgent[];
  /** Outcome definition from Step 3 */
  outcomeDefinition: string;
  /** Confirmed edges from Step 5 */
  confirmedEdges: ProposedEdge[];
}

/**
 * Callbacks for UI updates
 * Task 4.2: Define Step7Callbacks interface
 */
export interface Step7Callbacks {
  /** Refresh the webview HTML content */
  updateWebviewContent: () => void;
  /** Sync state to the webview for persistence */
  syncStateToWebview: () => void;
}

/**
 * Generate a unique ID for items
 * Helper function following tasks.md pattern
 */
function generateItemId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Maximum number of aha moments
 */
const MAX_AHA_MOMENTS = 5;

/**
 * Maximum number of narrative scenes
 */
const MAX_NARRATIVE_SCENES = 8;

/**
 * Step 7 Logic Handler
 * Task 4.2: Manages demo strategy content and AI generation
 * Follows pattern from Step6LogicHandler
 */
export class Step7LogicHandler {
  private _demoStrategyService?: DemoStrategyService;
  private _serviceDisposables: vscode.Disposable[] = [];
  private _streamingResponse = '';
  private _context?: vscode.ExtensionContext;
  private _state: DemoStrategyState;
  private _callbacks: Step7Callbacks;
  private _currentSection: DemoStrategySection | null = null;

  constructor(
    context: vscode.ExtensionContext | undefined,
    state: DemoStrategyState,
    callbacks: Step7Callbacks
  ) {
    this._context = context;
    this._state = state;
    this._callbacks = callbacks;
  }

  /**
   * Update state reference (for when parent state changes)
   */
  public setState(state: DemoStrategyState): void {
    this._state = state;
  }

  /**
   * Get current state
   */
  public getState(): DemoStrategyState {
    return this._state;
  }

  /**
   * Initialize DemoStrategyService
   */
  private initService(): DemoStrategyService | undefined {
    if (this._demoStrategyService) {
      return this._demoStrategyService;
    }

    if (!this._context) {
      console.warn('[Step7Logic] Extension context not available for DemoStrategy service');
      return undefined;
    }

    this._demoStrategyService = getDemoStrategyService(this._context);

    // Subscribe to streaming events
    // Task 4.8: Implement streaming handlers
    this._serviceDisposables.push(
      this._demoStrategyService.onToken((token) => {
        this.handleStreamingToken(token);
      })
    );

    this._serviceDisposables.push(
      this._demoStrategyService.onComplete((response) => {
        this.handleStreamingComplete(response);
      })
    );

    this._serviceDisposables.push(
      this._demoStrategyService.onError((error) => {
        this.handleStreamingError(error.message);
      })
    );

    return this._demoStrategyService;
  }

  // ============================================================================
  // Task 4.3: Aha Moments Handlers
  // ============================================================================

  /**
   * Add a new empty aha moment
   * Task 4.3: handleAddMoment() generates unique ID, checks max 5 limit
   *
   * @returns true if moment was added, false if limit reached
   */
  public handleAddMoment(): boolean {
    if (this._state.ahaMoments.length >= MAX_AHA_MOMENTS) {
      return false;
    }

    const newMoment: AhaMoment = {
      id: generateItemId(),
      title: '',
      triggerType: 'agent',
      triggerName: '',
      talkingPoint: '',
    };

    this._state.ahaMoments.push(newMoment);
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
    return true;
  }

  /**
   * Update a moment field
   * Task 4.3: handleUpdateMoment(index, field, value) sets momentsEdited = true
   */
  public handleUpdateMoment(
    index: number,
    field: 'title' | 'triggerType' | 'triggerName' | 'talkingPoint',
    value: string
  ): void {
    if (index < 0 || index >= this._state.ahaMoments.length) {
      return;
    }

    const moment = this._state.ahaMoments[index];

    if (field === 'triggerType') {
      moment.triggerType = value as 'agent' | 'tool';
    } else {
      moment[field] = value;
    }

    this._state.momentsEdited = true;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Remove a moment at index
   * Task 4.3: handleRemoveMoment(index)
   */
  public handleRemoveMoment(index: number): void {
    if (index < 0 || index >= this._state.ahaMoments.length) {
      return;
    }

    this._state.ahaMoments.splice(index, 1);
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  // ============================================================================
  // Task 4.4: Demo Persona Handlers
  // ============================================================================

  /**
   * Update persona name
   * Task 4.4: handleUpdatePersonaName(value) sets personaEdited
   */
  public handleUpdatePersonaName(value: string): void {
    this._state.persona.name = value;
    this._state.personaEdited = true;
    this._callbacks.syncStateToWebview();
  }

  /**
   * Update persona role
   * Task 4.4: handleUpdatePersonaRole(value) sets personaEdited
   */
  public handleUpdatePersonaRole(value: string): void {
    this._state.persona.role = value;
    this._state.personaEdited = true;
    this._callbacks.syncStateToWebview();
  }

  /**
   * Update persona pain point
   * Task 4.4: handleUpdatePersonaPainPoint(value) sets personaEdited
   */
  public handleUpdatePersonaPainPoint(value: string): void {
    this._state.persona.painPoint = value;
    this._state.personaEdited = true;
    this._callbacks.syncStateToWebview();
  }

  // ============================================================================
  // Task 4.5: Narrative Flow Handlers
  // ============================================================================

  /**
   * Add a new empty scene
   * Task 4.5: handleAddScene() generates unique ID, checks max 8 limit
   *
   * @returns true if scene was added, false if limit reached
   */
  public handleAddScene(): boolean {
    if (this._state.narrativeScenes.length >= MAX_NARRATIVE_SCENES) {
      return false;
    }

    const newScene: NarrativeScene = {
      id: generateItemId(),
      title: '',
      description: '',
      highlightedAgents: [],
    };

    this._state.narrativeScenes.push(newScene);
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
    return true;
  }

  /**
   * Update a scene field
   * Task 4.5: handleUpdateScene(index, field, value) sets narrativeEdited
   */
  public handleUpdateScene(
    index: number,
    field: 'title' | 'description' | 'highlightedAgents',
    value: string | string[]
  ): void {
    if (index < 0 || index >= this._state.narrativeScenes.length) {
      return;
    }

    const scene = this._state.narrativeScenes[index];

    if (field === 'highlightedAgents') {
      scene.highlightedAgents = value as string[];
    } else {
      scene[field] = value as string;
    }

    this._state.narrativeEdited = true;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Remove a scene at index
   * Task 4.5: handleRemoveScene(index)
   */
  public handleRemoveScene(index: number): void {
    if (index < 0 || index >= this._state.narrativeScenes.length) {
      return;
    }

    this._state.narrativeScenes.splice(index, 1);
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Move a scene up (swap with previous)
   * Task 4.5: handleMoveSceneUp(index) disabled at index 0
   */
  public handleMoveSceneUp(index: number): void {
    // Boundary check: cannot move first scene up
    if (index <= 0 || index >= this._state.narrativeScenes.length) {
      return;
    }

    // Swap with previous scene
    const scenes = this._state.narrativeScenes;
    const temp = scenes[index - 1];
    scenes[index - 1] = scenes[index];
    scenes[index] = temp;

    this._state.narrativeEdited = true;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Move a scene down (swap with next)
   * Task 4.5: handleMoveSceneDown(index) disabled at last index
   */
  public handleMoveSceneDown(index: number): void {
    // Boundary check: cannot move last scene down
    if (index < 0 || index >= this._state.narrativeScenes.length - 1) {
      return;
    }

    // Swap with next scene
    const scenes = this._state.narrativeScenes;
    const temp = scenes[index + 1];
    scenes[index + 1] = scenes[index];
    scenes[index] = temp;

    this._state.narrativeEdited = true;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Toggle a highlighted agent for a scene
   * Helper for multi-select checkboxes
   */
  public handleToggleHighlightedAgent(sceneIndex: number, agentId: string): void {
    if (sceneIndex < 0 || sceneIndex >= this._state.narrativeScenes.length) {
      return;
    }

    const scene = this._state.narrativeScenes[sceneIndex];
    const agentIndex = scene.highlightedAgents.indexOf(agentId);

    if (agentIndex >= 0) {
      scene.highlightedAgents.splice(agentIndex, 1);
    } else {
      scene.highlightedAgents.push(agentId);
    }

    this._state.narrativeEdited = true;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  // ============================================================================
  // Task 4.6: AI Generation Handlers
  // ============================================================================

  /**
   * Generate aha moments via AI
   * Task 4.6: handleGenerateMoments(inputs) sets isGeneratingMoments, calls service
   * Generate always replaces section content (no confirmation dialog)
   */
  public async handleGenerateMoments(inputs: Step7ContextInputs): Promise<void> {
    // Set loading state first (before service check for immediate UI feedback)
    this._state.isGeneratingMoments = true;
    this._currentSection = 'moments';
    this._streamingResponse = '';
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    const service = this.initService();
    if (!service) {
      // Reset loading state if service unavailable
      this._state.isGeneratingMoments = false;
      this._currentSection = null;
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
      console.warn('[Step7Logic] Service not available for moments generation');
      return;
    }

    // Build context message
    const contextMessage = service.buildAhaMomentsContextMessage(
      inputs.industry,
      inputs.businessObjective,
      inputs.confirmedAgents
    );

    // Send message to Claude (streaming handled by event handlers)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _token of service.sendMessage(contextMessage, 'moments')) {
        // Tokens are handled by onToken event handler
      }
    } catch (error) {
      this.handleStreamingError(
        error instanceof Error ? error.message : 'Unknown error generating moments'
      );
    }
  }

  /**
   * Generate persona via AI
   * Task 4.6: handleGeneratePersona(inputs) sets isGeneratingPersona, calls service
   * Generate always replaces section content (no confirmation dialog)
   */
  public async handleGeneratePersona(inputs: Step7ContextInputs): Promise<void> {
    // Set loading state first (before service check for immediate UI feedback)
    this._state.isGeneratingPersona = true;
    this._currentSection = 'persona';
    this._streamingResponse = '';
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    const service = this.initService();
    if (!service) {
      // Reset loading state if service unavailable
      this._state.isGeneratingPersona = false;
      this._currentSection = null;
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
      console.warn('[Step7Logic] Service not available for persona generation');
      return;
    }

    // Build context message
    const contextMessage = service.buildPersonaContextMessage(
      inputs.industry,
      inputs.businessObjective,
      inputs.outcomeDefinition
    );

    // Send message to Claude (streaming handled by event handlers)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _token of service.sendMessage(contextMessage, 'persona')) {
        // Tokens are handled by onToken event handler
      }
    } catch (error) {
      this.handleStreamingError(
        error instanceof Error ? error.message : 'Unknown error generating persona'
      );
    }
  }

  /**
   * Generate narrative flow via AI
   * Task 4.6: handleGenerateNarrative(inputs) sets isGeneratingNarrative, calls service
   * Generate always replaces section content (no confirmation dialog)
   */
  public async handleGenerateNarrative(inputs: Step7ContextInputs): Promise<void> {
    // Set loading state first (before service check for immediate UI feedback)
    this._state.isGeneratingNarrative = true;
    this._currentSection = 'narrative';
    this._streamingResponse = '';
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    const service = this.initService();
    if (!service) {
      // Reset loading state if service unavailable
      this._state.isGeneratingNarrative = false;
      this._currentSection = null;
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
      console.warn('[Step7Logic] Service not available for narrative generation');
      return;
    }

    // Build context message
    const contextMessage = service.buildNarrativeContextMessage(
      inputs.confirmedAgents,
      inputs.confirmedEdges,
      this._state.ahaMoments
    );

    // Send message to Claude (streaming handled by event handlers)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _token of service.sendMessage(contextMessage, 'narrative')) {
        // Tokens are handled by onToken event handler
      }
    } catch (error) {
      this.handleStreamingError(
        error instanceof Error ? error.message : 'Unknown error generating narrative'
      );
    }
  }

  // ============================================================================
  // Task 4.7: handleGenerateAll(inputs) Method
  // ============================================================================

  /**
   * Generate all three sections sequentially
   * Task 4.7: Trigger all three sections sequentially (not parallel)
   * Each awaits previous completion before starting next
   */
  public async handleGenerateAll(inputs: Step7ContextInputs): Promise<void> {
    // Generate moments first
    await this.handleGenerateMoments(inputs);

    // Then generate persona
    await this.handleGeneratePersona(inputs);

    // Finally generate narrative
    await this.handleGenerateNarrative(inputs);
  }

  // ============================================================================
  // Task 4.8: Streaming Handlers
  // ============================================================================

  /**
   * Handle incoming streaming token
   * Task 4.8: Accumulates response for current section
   */
  private handleStreamingToken(token: string): void {
    this._streamingResponse += token;
    // Note: Step 7 doesn't show streaming preview, just accumulates
  }

  /**
   * Handle streaming complete
   * Task 4.8: Route responses to correct parser, update correct loading flag
   */
  private handleStreamingComplete(response: string): void {
    // Route to correct parser based on current section
    switch (this._currentSection) {
      case 'moments':
        this.processMomentsResponse(response);
        break;
      case 'persona':
        this.processPersonaResponse(response);
        break;
      case 'narrative':
        this.processNarrativeResponse(response);
        break;
    }

    this._streamingResponse = '';
    this._currentSection = null;
  }

  /**
   * Process aha moments response from AI
   */
  private processMomentsResponse(response: string): void {
    this._state.isGeneratingMoments = false;

    const moments = parseAhaMomentsFromResponse(response);
    if (moments && moments.length > 0) {
      // Replace existing moments with AI-generated ones (capped at MAX)
      this._state.ahaMoments = moments.slice(0, MAX_AHA_MOMENTS);
      // Reset edited flag since content is fresh from AI
      this._state.momentsEdited = false;
    }

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Process persona response from AI
   */
  private processPersonaResponse(response: string): void {
    this._state.isGeneratingPersona = false;

    const persona = parsePersonaFromResponse(response);
    if (persona) {
      // Replace existing persona with AI-generated one
      this._state.persona = persona;
      // Reset edited flag since content is fresh from AI
      this._state.personaEdited = false;
    }

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Process narrative response from AI
   */
  private processNarrativeResponse(response: string): void {
    this._state.isGeneratingNarrative = false;

    const scenes = parseNarrativeScenesFromResponse(response);
    if (scenes && scenes.length > 0) {
      // Replace existing scenes with AI-generated ones (capped at MAX)
      this._state.narrativeScenes = scenes.slice(0, MAX_NARRATIVE_SCENES);
      // Reset edited flag since content is fresh from AI
      this._state.narrativeEdited = false;
    }

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Handle streaming error
   * Task 4.8: Update correct loading flag on error
   */
  private handleStreamingError(errorMessage: string): void {
    console.error('[Step7Logic] Streaming error:', errorMessage);

    // Clear loading flag for current section
    switch (this._currentSection) {
      case 'moments':
        this._state.isGeneratingMoments = false;
        break;
      case 'persona':
        this._state.isGeneratingPersona = false;
        break;
      case 'narrative':
        this._state.isGeneratingNarrative = false;
        break;
    }

    this._streamingResponse = '';
    this._currentSection = null;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  // ============================================================================
  // Task 4.9: getValidationWarnings() Method
  // ============================================================================

  /**
   * Get validation warnings (non-blocking)
   * Task 4.9: Returns array of warning messages
   *
   * Warnings include:
   * - No aha moments defined
   * - No narrative scenes defined
   */
  public getValidationWarnings(): Array<{ type: string; message: string; severity: 'warning' }> {
    const warnings: Array<{ type: string; message: string; severity: 'warning' }> = [];

    // Warning if ahaMoments is empty
    if (this._state.ahaMoments.length === 0) {
      warnings.push({
        type: 'ahaMoments',
        message: 'No aha moments defined - consider adding key demo highlights',
        severity: 'warning',
      });
    }

    // Warning if narrativeScenes is empty
    if (this._state.narrativeScenes.length === 0) {
      warnings.push({
        type: 'narrativeScenes',
        message: 'No narrative scenes defined - consider adding demo flow scenes',
        severity: 'warning',
      });
    }

    return warnings;
  }

  /**
   * Handle back navigation to Step 7 from Step 8
   * Preserves state, does not reset
   */
  public handleBackNavigationToStep7(): void {
    // Preserve the current state
    // This allows the user to continue editing where they left off
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this._serviceDisposables.forEach((d) => d.dispose());
    this._serviceDisposables = [];
  }
}
