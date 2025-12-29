/**
 * Step 6: Mock Data Strategy Logic
 * Handles AI-powered mock data generation and editing for each tool
 *
 * Task Group 3: Step 6 Logic Handler for Wizard Step 6 Mock Data Strategy
 */

import * as vscode from 'vscode';
import {
  getMockDataService,
  MockDataService,
  buildMockDataContextMessage,
  parseMockDefinitionsFromResponse,
  generateStep5Hash,
  buildTerminologyRefinementMessage,
} from '../services/mockDataService';
import type {
  MockDataState,
  MockToolDefinition,
  ProposedAgent,
} from '../types/wizardPanel';
import { createDefaultMockDataState } from '../types/wizardPanel';

/**
 * Step 5 inputs needed for Step 6 context
 * Task 3.2: Define Step6ContextInputs interface with confirmedAgents, industry
 */
export interface Step6ContextInputs {
  /** Confirmed agents from Step 5 with their assigned tools */
  confirmedAgents: ProposedAgent[];
  /** Industry context from Step 1 */
  industry: string;
}

/**
 * Callbacks for UI updates
 * Task 3.2: Define Step6Callbacks interface with updateWebviewContent, syncStateToWebview
 */
export interface Step6Callbacks {
  /** Refresh the webview HTML content */
  updateWebviewContent: () => void;
  /** Sync state to the webview for persistence */
  syncStateToWebview: () => void;
}

/**
 * Step 6 Logic Handler
 * Task 3.2: Manages AI mock data generation and user editing
 * Follows pattern from Step5LogicHandler
 */
export class Step6LogicHandler {
  private _mockDataService?: MockDataService;
  private _mockDataDisposables: vscode.Disposable[] = [];
  private _mockDataStreamingResponse = '';
  private _context?: vscode.ExtensionContext;
  private _state: MockDataState;
  private _callbacks: Step6Callbacks;
  private _isTerminologyRefinement = false;

  constructor(
    context: vscode.ExtensionContext | undefined,
    state: MockDataState,
    callbacks: Step6Callbacks
  ) {
    this._context = context;
    this._state = state;
    this._callbacks = callbacks;
  }

  /**
   * Update state reference (for when parent state changes)
   */
  public setState(state: MockDataState): void {
    this._state = state;
  }

  /**
   * Get current state
   */
  public getState(): MockDataState {
    return this._state;
  }

  /**
   * Initialize MockDataService
   */
  private initMockDataService(): MockDataService | undefined {
    if (this._mockDataService) {
      return this._mockDataService;
    }

    if (!this._context) {
      console.warn('[Step6Logic] Extension context not available for MockData service');
      return undefined;
    }

    this._mockDataService = getMockDataService(this._context);

    // Subscribe to streaming events
    // Task 3.4: Implement streaming handlers
    this._mockDataDisposables.push(
      this._mockDataService.onToken((token) => {
        this.handleMockDataStreamingToken(token);
      })
    );

    this._mockDataDisposables.push(
      this._mockDataService.onComplete((response) => {
        this.handleMockDataStreamingComplete(response);
      })
    );

    this._mockDataDisposables.push(
      this._mockDataService.onError((error) => {
        this.handleMockDataStreamingError(error.message);
      })
    );

    return this._mockDataService;
  }

  // ============================================================================
  // Task 3.3: triggerAutoSend() Method
  // ============================================================================

  /**
   * Trigger auto-send when entering Step 6
   * Re-triggers AI if Step 5 confirmed agents have changed
   * Task 3.3: Check if step5Hash has changed or aiCalled is false
   */
  public triggerAutoSend(inputs: Step6ContextInputs): void {
    const currentHash = generateStep5Hash(inputs.confirmedAgents);

    // Check if inputs have changed since last visit
    if (this._state.step5Hash !== currentHash) {
      // Reset mock data state
      const defaultState = createDefaultMockDataState();
      this._state.mockDefinitions = defaultState.mockDefinitions;
      this._state.useCustomerTerminology = defaultState.useCustomerTerminology;
      this._state.isLoading = false;
      this._state.error = undefined;
      this._state.aiCalled = false;
      this._state.step5Hash = currentHash;

      // Trigger AI
      this.sendMockDataContextToClaude(inputs);
    } else if (!this._state.aiCalled && !this._state.isLoading) {
      // Fresh entry with no AI call yet
      this.sendMockDataContextToClaude(inputs);
    }
  }

  // ============================================================================
  // Task 3.4: Streaming Handlers
  // ============================================================================

  /**
   * Handle incoming streaming token for mock data
   * Task 3.4: handleMockDataStreamingToken() accumulates response
   */
  private handleMockDataStreamingToken(token: string): void {
    this._mockDataStreamingResponse += token;
    // Note: Step 6 doesn't show streaming preview, just accumulates
  }

  /**
   * Handle streaming complete for mock data
   * Task 3.4: handleMockDataStreamingComplete() parses and updates state
   */
  private handleMockDataStreamingComplete(response: string): void {
    this._state.isLoading = false;

    // Parse the mock definitions from response
    const definitions = parseMockDefinitionsFromResponse(response);

    if (definitions) {
      if (this._isTerminologyRefinement) {
        // Terminology refinement - merge updated sample data while preserving edited flags
        this.mergeTerminologyRefinement(definitions);
      } else {
        // Initial generation - apply all definitions
        this._state.mockDefinitions = definitions;
      }
    } else {
      this._state.error = 'Failed to parse mock definitions from AI response';
    }

    this._mockDataStreamingResponse = '';
    this._isTerminologyRefinement = false;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Handle streaming error for mock data
   * Task 3.4: handleMockDataStreamingError() sets error state
   */
  private handleMockDataStreamingError(errorMessage: string): void {
    this._state.isLoading = false;
    this._state.error = errorMessage;
    this._mockDataStreamingResponse = '';
    this._isTerminologyRefinement = false;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Build and send context to Claude for mock data generation
   */
  public async sendMockDataContextToClaude(inputs: Step6ContextInputs): Promise<void> {
    // Mark that we attempted to call AI (even if service unavailable)
    this._state.aiCalled = true;

    const service = this.initMockDataService();
    if (!service) {
      this._state.error = 'Mock data service not available. Please check your configuration.';
      this._callbacks.syncStateToWebview();
      return;
    }

    // Build context message from Step 5 confirmed agents
    const contextMessage = buildMockDataContextMessage(
      inputs.confirmedAgents,
      inputs.industry
    );

    // Set loading state
    this._state.isLoading = true;
    this._state.error = undefined;
    this._mockDataStreamingResponse = '';
    this._isTerminologyRefinement = false;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    // Send message to Claude (streaming handled by event handlers)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _token of service.sendMessage(contextMessage)) {
        // Tokens are handled by onToken event handler
      }
    } catch (error) {
      this.handleMockDataStreamingError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ============================================================================
  // Task 3.5: Mock Definition Editing Methods
  // ============================================================================

  /**
   * Update mock request JSON for a tool
   * Task 3.5: handleUpdateMockRequest(toolIndex, jsonString) with requestEdited flag
   */
  public handleUpdateMockRequest(toolIndex: number, jsonString: string): void {
    if (toolIndex < 0 || toolIndex >= this._state.mockDefinitions.length) {
      return;
    }

    try {
      const parsed = JSON.parse(jsonString);
      this._state.mockDefinitions[toolIndex].mockRequest = parsed;
      this._state.mockDefinitions[toolIndex].requestEdited = true;
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
    } catch {
      // Invalid JSON - don't update, keep original value
      // The UI will show "Invalid JSON" warning via getValidationWarnings()
    }
  }

  /**
   * Update mock response JSON for a tool
   * Task 3.5: handleUpdateMockResponse(toolIndex, jsonString) with responseEdited flag
   */
  public handleUpdateMockResponse(toolIndex: number, jsonString: string): void {
    if (toolIndex < 0 || toolIndex >= this._state.mockDefinitions.length) {
      return;
    }

    try {
      const parsed = JSON.parse(jsonString);
      this._state.mockDefinitions[toolIndex].mockResponse = parsed;
      this._state.mockDefinitions[toolIndex].responseEdited = true;
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
    } catch {
      // Invalid JSON - don't update, keep original value
    }
  }

  /**
   * Toggle accordion expand/collapse state for a tool
   * Task 3.5: handleToggleAccordion(toolIndex) for expand/collapse
   */
  public handleToggleAccordion(toolIndex: number): void {
    if (toolIndex < 0 || toolIndex >= this._state.mockDefinitions.length) {
      return;
    }

    this._state.mockDefinitions[toolIndex].expanded =
      !this._state.mockDefinitions[toolIndex].expanded;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  // ============================================================================
  // Task 3.6: Sample Data Editing Methods
  // ============================================================================

  /**
   * Add a new sample data row to a tool
   * Task 3.6: handleAddSampleRow(toolIndex) with max 5 row limit
   *
   * @returns true if row was added, false if limit reached
   */
  public handleAddSampleRow(toolIndex: number): boolean {
    if (toolIndex < 0 || toolIndex >= this._state.mockDefinitions.length) {
      return false;
    }

    const definition = this._state.mockDefinitions[toolIndex];

    // Check max 5 row limit
    if (definition.sampleData.length >= 5) {
      return false;
    }

    // Create empty row based on mockResponse schema
    const emptyRow = this.createEmptyRowFromSchema(definition.mockResponse);
    definition.sampleData.push(emptyRow);
    definition.sampleDataEdited = true;

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
    return true;
  }

  /**
   * Update a sample data row
   * Task 3.6: handleUpdateSampleRow(toolIndex, rowIndex, data) with sampleDataEdited flag
   */
  public handleUpdateSampleRow(
    toolIndex: number,
    rowIndex: number,
    data: object
  ): void {
    if (toolIndex < 0 || toolIndex >= this._state.mockDefinitions.length) {
      return;
    }

    const definition = this._state.mockDefinitions[toolIndex];

    if (rowIndex < 0 || rowIndex >= definition.sampleData.length) {
      return;
    }

    definition.sampleData[rowIndex] = data;
    definition.sampleDataEdited = true;

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Delete a sample data row
   * Task 3.6: handleDeleteSampleRow(toolIndex, rowIndex)
   */
  public handleDeleteSampleRow(toolIndex: number, rowIndex: number): void {
    if (toolIndex < 0 || toolIndex >= this._state.mockDefinitions.length) {
      return;
    }

    const definition = this._state.mockDefinitions[toolIndex];

    if (rowIndex < 0 || rowIndex >= definition.sampleData.length) {
      return;
    }

    definition.sampleData.splice(rowIndex, 1);
    definition.sampleDataEdited = true;

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Create an empty row based on mockResponse schema
   * Helper for handleAddSampleRow
   */
  private createEmptyRowFromSchema(schema: object): object {
    const row: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(schema)) {
      if (typeof value === 'string') {
        row[key] = '';
      } else if (typeof value === 'number') {
        row[key] = 0;
      } else if (typeof value === 'boolean') {
        row[key] = false;
      } else if (Array.isArray(value)) {
        row[key] = [];
      } else if (typeof value === 'object' && value !== null) {
        row[key] = {};
      } else {
        row[key] = null;
      }
    }

    return row;
  }

  // ============================================================================
  // Task 3.7: Bulk Action Methods
  // ============================================================================

  /**
   * Regenerate all mock definitions from AI
   * Task 3.7: handleRegenerateAll() resets and re-fetches from AI
   */
  public handleRegenerateAll(inputs: Step6ContextInputs): void {
    // Preserve step5Hash
    const hash = this._state.step5Hash;

    // Reset state to defaults
    const defaultState = createDefaultMockDataState();
    this._state.mockDefinitions = defaultState.mockDefinitions;
    this._state.useCustomerTerminology = defaultState.useCustomerTerminology;
    this._state.isLoading = false;
    this._state.error = undefined;
    this._state.aiCalled = false;
    this._state.step5Hash = hash;

    // Reset service conversation
    if (this._mockDataService) {
      this._mockDataService.resetConversation();
    }

    // Re-fetch mock definitions (this will set aiCalled = true)
    this.sendMockDataContextToClaude(inputs);
  }

  /**
   * Toggle customer terminology setting
   * Task 3.7: handleToggleTerminology(enabled) triggers refinement if enabled
   */
  public handleToggleTerminology(enabled: boolean, inputs: Step6ContextInputs): void {
    this._state.useCustomerTerminology = enabled;

    if (enabled && this._state.mockDefinitions.length > 0 && !this._state.isLoading) {
      // Trigger terminology refinement
      this.sendTerminologyRefinementToClaude(inputs);
    }

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Send terminology refinement request to Claude
   */
  private async sendTerminologyRefinementToClaude(inputs: Step6ContextInputs): Promise<void> {
    const service = this.initMockDataService();
    if (!service) {
      this._state.error = 'Mock data service not available.';
      this._callbacks.syncStateToWebview();
      return;
    }

    // Build refinement message
    const refinementMessage = buildTerminologyRefinementMessage(
      this._state.mockDefinitions,
      inputs.industry
    );

    // Set loading state
    this._state.isLoading = true;
    this._state.error = undefined;
    this._mockDataStreamingResponse = '';
    this._isTerminologyRefinement = true;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    // Send message to Claude
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _token of service.sendMessage(refinementMessage)) {
        // Tokens are handled by onToken event handler
      }
    } catch (error) {
      this.handleMockDataStreamingError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Merge terminology refinement results while respecting edited flags
   * Only updates sampleData for tools where sampleDataEdited is false
   */
  private mergeTerminologyRefinement(aiDefinitions: MockToolDefinition[]): void {
    for (const aiDef of aiDefinitions) {
      const existingDef = this._state.mockDefinitions.find(
        (d) => d.tool === aiDef.tool
      );

      if (existingDef && !existingDef.sampleDataEdited) {
        // Only update sampleData if user hasn't edited it
        existingDef.sampleData = aiDef.sampleData;
      }
    }
  }

  // ============================================================================
  // Task 3.8: getValidationWarnings() Method
  // ============================================================================

  /**
   * Get validation warnings (non-blocking)
   * Task 3.8: Returns array of warning messages
   *
   * Warnings include:
   * - Tool has empty sampleData array
   * - mockRequest or mockResponse is empty/invalid JSON
   */
  public getValidationWarnings(): string[] {
    const warnings: string[] = [];

    for (const definition of this._state.mockDefinitions) {
      // Warning if tool has empty sampleData
      if (definition.sampleData.length === 0) {
        warnings.push(
          `Warning: ${definition.tool} has no sample data - demo will use empty responses`
        );
      }

      // Warning if mockRequest is empty
      if (
        !definition.mockRequest ||
        Object.keys(definition.mockRequest).length === 0
      ) {
        warnings.push(
          `Warning: ${definition.tool} has empty mockRequest schema`
        );
      }

      // Warning if mockResponse is empty
      if (
        !definition.mockResponse ||
        Object.keys(definition.mockResponse).length === 0
      ) {
        warnings.push(
          `Warning: ${definition.tool} has empty mockResponse schema`
        );
      }
    }

    return warnings;
  }

  /**
   * Handle back navigation to Step 6 from Step 7
   * Preserves state, does not reset
   */
  public handleBackNavigationToStep6(): void {
    // Preserve the current state
    // This allows the user to continue editing where they left off
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this._mockDataDisposables.forEach((d) => d.dispose());
    this._mockDataDisposables = [];
  }
}
