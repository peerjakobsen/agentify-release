/**
 * Step 8: Generation Logic
 * Handles pre-generation summary display, steering file generation orchestration,
 * and post-generation actions including file reveal and start over functionality.
 *
 * Task Group 3: Step 8 Logic Handler for Wizard Step 8 Generate
 * Task Group 4: Step 8 Integration with SteeringFileService
 * Phase 2: Roadmap Generation - Extended with roadmap generation handlers
 */

import * as vscode from 'vscode';
import {
  getSteeringFileService,
  SteeringFileService,
} from '../services/steeringFileService';
import {
  getRoadmapGenerationService,
  RoadmapGenerationService,
  ROADMAP_OUTPUT_FILE,
} from '../services/roadmapGenerationService';
import { getSteeringGenerationService } from '../services/steeringGenerationService';
import type {
  GenerationState,
  StepSummary,
  StepValidationStatus,
  AIGapFillingState,
  OutcomeDefinitionState,
  SecurityState,
  AgentDesignState,
  MockDataState,
  DemoStrategyState,
  WizardState,
} from '../types/wizardPanel';
import { STEERING_FILES, ROOT_DOC_FILES } from '../types/wizardPanel';

/**
 * Total steering files generated in Phase 1 (7 files)
 * DEMO.md is now generated separately in Phase 4
 */
const TOTAL_STEERING_FILES = STEERING_FILES.length;

// Task 6.3: Import environment detection utility
import { isKiroEnvironment, getKiroLearnMoreUrl } from '../utils/environment';
// Import steering directory path for reveal
import { STEERING_DIR_PATH } from '../templates/steeringFile';
// Phase 3: Import path for orchestrator template copying
import * as path from 'path';

/**
 * Step 8 context inputs needed for file generation
 * Task 3.3: Define Step8ContextInputs interface with full IdeationState reference
 */
export interface Step8ContextInputs {
  /** Business objective from Step 1 */
  businessObjective: string;
  /** Industry context from Step 1 */
  industry: string;
  /** Selected systems from Step 1 */
  systems: string[];
  /** AI gap-filling state from Step 2 */
  aiGapFillingState: AIGapFillingState;
  /** Outcome definition from Step 3 */
  outcome: OutcomeDefinitionState;
  /** Security configuration from Step 4 */
  security: SecurityState;
  /** Agent design from Step 5 */
  agentDesign: AgentDesignState;
  /** Mock data from Step 6 */
  mockData: MockDataState;
  /** Demo strategy from Step 7 */
  demoStrategy: DemoStrategyState;
}

/**
 * Callbacks for UI updates
 * Task 3.4: Define Step8Callbacks interface
 */
export interface Step8Callbacks {
  /** Refresh the webview HTML content */
  updateWebviewContent: () => void;
  /** Sync state to the webview for persistence */
  syncStateToWebview: () => void;
  /** Show confirmation dialog and return selected option */
  showConfirmDialog: (message: string, options: string[]) => Promise<string | undefined>;
  /** Open a file in the editor */
  openFile: (filePath: string) => Promise<void>;
  /** Callback when user confirms start over */
  onStartOver: () => void;
  /** Get the full WizardState for generation */
  getWizardState: () => WizardState;
  /** Get the extension context for service initialization */
  getContext: () => vscode.ExtensionContext | undefined;
}

/**
 * Step names for summary display
 */
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
 * Step 8 Logic Handler
 * Task 3.2: Manages pre-generation summary, file generation, and post-generation actions
 * Task 4.2: Updated to pass full WizardState to SteeringFileService
 * Phase 2: Extended with roadmap generation handlers
 * Follows pattern from Step6LogicHandler and Step7LogicHandler
 */
export class Step8LogicHandler {
  private _steeringFileService?: SteeringFileService;
  private _roadmapService?: RoadmapGenerationService;
  private _serviceDisposables: vscode.Disposable[] = [];
  private _state: GenerationState;
  private _callbacks: Step8Callbacks;

  constructor(state: GenerationState, callbacks: Step8Callbacks) {
    this._state = state;
    this._callbacks = callbacks;
  }

  /**
   * Update state reference (for when parent state changes)
   */
  public setState(state: GenerationState): void {
    this._state = state;
  }

  /**
   * Get current state
   */
  public getState(): GenerationState {
    return this._state;
  }

  /**
   * Initialize SteeringFileService and subscribe to events
   */
  private initService(): SteeringFileService {
    if (this._steeringFileService) {
      return this._steeringFileService;
    }

    const context = this._callbacks.getContext();
    this._steeringFileService = getSteeringFileService(context);

    // Subscribe to file progress events
    this._serviceDisposables.push(
      this._steeringFileService.onFileStart((event) => {
        this.handleFileStart(event.fileName, event.index);
      })
    );

    this._serviceDisposables.push(
      this._steeringFileService.onFileComplete((event) => {
        this.handleFileComplete(event.fileName, event.filePath);
      })
    );

    this._serviceDisposables.push(
      this._steeringFileService.onFileError((event) => {
        this.handleFileError(event.fileName, event.error);
      })
    );

    return this._steeringFileService;
  }

  /**
   * Initialize RoadmapGenerationService and subscribe to events
   * Phase 2: Task 3.2 - Add RoadmapGenerationService initialization
   */
  private initRoadmapService(): RoadmapGenerationService {
    if (this._roadmapService) {
      return this._roadmapService;
    }

    const context = this._callbacks.getContext();
    if (!context) {
      throw new Error('Extension context is required for RoadmapGenerationService');
    }

    this._roadmapService = getRoadmapGenerationService(context);

    // Phase 2: Task 3.3 - Subscribe to RoadmapGenerationService events
    this._serviceDisposables.push(
      this._roadmapService.onGenerationStart(() => {
        this._state.roadmapGenerating = true;
        this._state.roadmapError = undefined;
        this._callbacks.updateWebviewContent();
        this._callbacks.syncStateToWebview();
      })
    );

    this._serviceDisposables.push(
      this._roadmapService.onGenerationComplete((event) => {
        this._state.roadmapGenerating = false;
        this._state.roadmapGenerated = true;
        this._state.roadmapFilePath = event.filePath;
        this._state.roadmapError = undefined;
        this._callbacks.updateWebviewContent();
        this._callbacks.syncStateToWebview();
      })
    );

    this._serviceDisposables.push(
      this._roadmapService.onGenerationError((event) => {
        this._state.roadmapGenerating = false;
        this._state.roadmapError = event.error;
        this._callbacks.updateWebviewContent();
        this._callbacks.syncStateToWebview();
      })
    );

    return this._roadmapService;
  }

  // ============================================================================
  // Task 4.4: Pre-generation Validation Enforcement
  // ============================================================================

  /**
   * Check if generation can proceed based on validation status
   * Task 4.4: Enforces validation before generation
   * @returns true if generation can proceed, false otherwise
   */
  public canProceedWithGeneration(inputs: Step8ContextInputs): boolean {
    // Check for any 'error' validation status
    for (let stepNumber = 1; stepNumber <= 7; stepNumber++) {
      const result = this.getValidationStatusForStep(stepNumber, inputs);
      if (result.status === 'error') {
        return false;
      }
    }
    return true;
  }

  // ============================================================================
  // Existing Steering Files Detection
  // ============================================================================

  /**
   * Check if files already exist on disk and update state accordingly.
   * This enables proper UI display when resuming a wizard after files were generated
   * in a previous session. Checks all 4 phases independently.
   *
   * @returns true if all Phase 1 steering files exist on disk
   */
  public async checkExistingSteeringFiles(): Promise<boolean> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return false;
    }

    const steeringDir = vscode.Uri.joinPath(workspaceFolder.uri, '.kiro', 'steering');
    const existingFiles: string[] = [];
    const existingPaths: string[] = [];

    // Phase 1: Check each steering file
    for (const filename of STEERING_FILES) {
      const fileUri = vscode.Uri.joinPath(steeringDir, filename);
      try {
        await vscode.workspace.fs.stat(fileUri);
        existingFiles.push(filename);
        existingPaths.push(fileUri.fsPath);
      } catch {
        // File doesn't exist
      }
    }

    // Phase 1 completion check (7 steering files)
    const allSteeringFilesExist = STEERING_FILES.every(f => existingFiles.includes(f));
    const isPhase1Complete = allSteeringFilesExist && existingFiles.includes('product.md');

    if (isPhase1Complete) {
      // Update Phase 1 state
      this._state.completedFiles = existingFiles;
      this._state.generatedFilePaths = existingPaths;
      this._state.accordionExpanded = false;
      this._state.steeringComplete = true;
    }

    // Phase 2: Check for policy files in policies/ directory
    const policiesDir = vscode.Uri.joinPath(workspaceFolder.uri, 'policies');
    const policyFilePaths: string[] = [];
    try {
      const entries = await vscode.workspace.fs.readDirectory(policiesDir);
      for (const [filename] of entries) {
        if (filename.endsWith('.txt')) {
          const fileUri = vscode.Uri.joinPath(policiesDir, filename);
          policyFilePaths.push(fileUri.fsPath);
        }
      }
      if (policyFilePaths.length > 0) {
        this._state.policyGenerated = true;
        this._state.policyFilePaths = policyFilePaths;
      }
    } catch {
      // Policies directory doesn't exist
    }

    // Phase 3: Check if ROADMAP.md exists
    const roadmapUri = vscode.Uri.joinPath(workspaceFolder.uri, ROADMAP_OUTPUT_FILE);
    try {
      await vscode.workspace.fs.stat(roadmapUri);
      this._state.roadmapGenerated = true;
      this._state.roadmapFilePath = roadmapUri.fsPath;
    } catch {
      // Roadmap doesn't exist yet
    }

    // Phase 4: Check if DEMO.md exists
    const demoUri = vscode.Uri.joinPath(workspaceFolder.uri, 'DEMO.md');
    try {
      await vscode.workspace.fs.stat(demoUri);
      this._state.demoGenerated = true;
      this._state.demoFilePath = demoUri.fsPath;
    } catch {
      // DEMO.md doesn't exist yet
    }

    // Update UI if any phase was detected
    if (isPhase1Complete || policyFilePaths.length > 0 || this._state.roadmapGenerated || this._state.demoGenerated) {
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
    }

    return allSteeringFilesExist;
  }

  // ============================================================================
  // Task 3.5 & 4.2: handleGenerate() Method - Updated for Full WizardState
  // ============================================================================

  /**
   * Start steering file generation
   * Task 3.5: Sets isGenerating, resets state, calls service
   * Task 4.2: Now passes full WizardState to SteeringFileService
   * Task 4.3: Removed isPlaceholderMode handling
   */
  public async handleGenerate(inputs: Step8ContextInputs): Promise<void> {
    // Task 4.4: Enforce validation before generation
    if (!this.canProceedWithGeneration(inputs)) {
      vscode.window.showErrorMessage('Cannot generate: Please fix all errors in previous steps');
      return;
    }

    // Reset generation state
    this._state.isGenerating = true;
    this._state.currentFileIndex = -1;
    this._state.completedFiles = [];
    this._state.failedFile = undefined;
    this._state.generatedFilePaths = [];
    this._state.accordionExpanded = true; // Auto-expand during generation

    // Reset Phase 1 completion and policy state
    this._state.steeringComplete = false;
    this._state.policyGenerating = false;
    this._state.policyGenerated = false;
    this._state.policyFilePaths = [];
    this._state.policyError = undefined;
    this._state.policySkipped = false;

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    // Initialize service and start generation
    const service = this.initService();

    try {
      // Task 4.2: Get full WizardState from callbacks
      const wizardState = this._callbacks.getWizardState();

      // Call service with full WizardState
      const result = await service.generateSteeringFiles(wizardState);

      // Handle cancelled result
      if (result.cancelled) {
        this._state.isGenerating = false;
        this._state.accordionExpanded = false;
        this._callbacks.updateWebviewContent();
        this._callbacks.syncStateToWebview();
        return;
      }

      if (result.success) {
        // Success - all steering files generated
        this._state.generatedFilePaths = result.files;
        this._state.accordionExpanded = false; // Auto-collapse on success
        this._state.steeringComplete = true; // Mark Phase 1 as complete

        // Show success toast (policy generation is now manual in Phase 2)
        this.showSuccessToast(result.files.length, result.backupPath, false);
      } else if (result.error) {
        // Partial failure
        this._state.failedFile = {
          name: result.error.fileName,
          error: result.error.message,
        };
        this._state.accordionExpanded = true; // Keep expanded on error
      }
    } catch (error) {
      // Unexpected error
      this._state.failedFile = {
        name: STEERING_FILES[this._state.currentFileIndex] || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    this._state.isGenerating = false;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  // ============================================================================
  // Task 4.5: Success Handling with Toast and Actions
  // ============================================================================

  /**
   * Show success toast with optional actions
   * Task 4.5: Shows toast with file count and backup path info
   */
  private showSuccessToast(
    fileCount: number,
    backupPath?: string,
    policyGenerated: boolean = false
  ): void {
    let message = `Successfully generated ${fileCount} steering file${fileCount !== 1 ? 's' : ''} in .kiro/steering/`;

    if (policyGenerated) {
      message += ` + policies in policies/`;
    }

    if (backupPath) {
      message += ` (previous files backed up)`;
    }

    vscode.window.showInformationMessage(message, 'Open Folder').then((selection) => {
      if (selection === 'Open Folder') {
        this.revealSteeringFolder();
      }
    });
  }

  /**
   * Reveal the steering folder in the explorer
   */
  private async revealSteeringFolder(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const steeringFolderUri = vscode.Uri.joinPath(
        workspaceFolder.uri,
        STEERING_DIR_PATH
      );

      try {
        await vscode.commands.executeCommand('revealInExplorer', steeringFolderUri);
      } catch {
        // Fallback: just show the folder in explorer view
        await vscode.commands.executeCommand('workbench.view.explorer');
      }
    }
  }

  // ============================================================================
  // Phase 2: Policy File Generation
  // ============================================================================

  /**
   * Generate policy files (Phase 2)
   * Manual trigger for policy generation based on security configuration
   */
  public async handleGeneratePolicies(): Promise<void> {
    const context = this._callbacks.getContext();
    if (!context) {
      vscode.window.showErrorMessage('No extension context available for policy generation');
      return;
    }

    const wizardState = this._callbacks.getWizardState();
    const generationService = getSteeringGenerationService(context);

    // Check if policy generation should run based on security config
    if (!generationService.shouldGenerateCedarPolicies(wizardState)) {
      this._state.policySkipped = true;
      this._state.policyError = 'No compliance frameworks or approval gates configured';
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
      vscode.window.showInformationMessage('Policy generation skipped - no security configuration requires policies');
      return;
    }

    // Update state to indicate policy generation is starting
    this._state.policyGenerating = true;
    this._state.policyError = undefined;
    this._state.policySkipped = false;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    try {
      // Generate policy descriptions
      const policyResult = await generationService.generateCedarPolicies(wizardState);

      if (policyResult.success && policyResult.policies.length > 0) {
        // Get workspace folder for writing
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          throw new Error('No workspace folder open');
        }

        // Write policy description files to policies/*.txt
        const filePaths = await generationService.writeCedarPolicies(
          workspaceFolder.uri,
          policyResult.policies
        );

        // Update state with success
        this._state.policyGenerated = true;
        this._state.policyFilePaths = filePaths;
        console.log(`[Step8] Policy descriptions generated: ${filePaths.length} files`);

        vscode.window.showInformationMessage(
          `Generated ${filePaths.length} policy file${filePaths.length !== 1 ? 's' : ''} in policies/`
        );
      } else {
        // Policy generation failed
        this._state.policyError = policyResult.error || 'Unknown policy generation error';
        console.warn(`[Step8] Policy generation failed: ${this._state.policyError}`);
        vscode.window.showErrorMessage(`Policy generation failed: ${this._state.policyError}`);
      }
    } catch (error) {
      // Unexpected error
      const errorMessage = error instanceof Error ? error.message : String(error);
      this._state.policyError = errorMessage;
      console.error(`[Step8] Policy generation error: ${errorMessage}`);
      vscode.window.showErrorMessage(`Policy generation failed: ${errorMessage}`);
    } finally {
      this._state.policyGenerating = false;
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
    }
  }

  // ============================================================================
  // Phase 4: Demo Strategy Generation
  // ============================================================================

  /**
   * Generate DEMO.md at project root (Phase 4)
   * Manual trigger for demo strategy file generation
   */
  public async handleGenerateDemo(): Promise<void> {
    const context = this._callbacks.getContext();
    if (!context) {
      vscode.window.showErrorMessage('No extension context available for demo generation');
      return;
    }

    const wizardState = this._callbacks.getWizardState();

    // Update state to indicate demo generation is starting
    this._state.demoGenerating = true;
    this._state.demoError = undefined;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    try {
      const generationService = getSteeringGenerationService(context);

      // Generate demo strategy content using the existing prompt
      const content = await generationService.generateSingleFile(wizardState, 'demo-strategy');

      // Get workspace folder for writing
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('No workspace folder open');
      }

      // Write DEMO.md to project root
      const demoUri = vscode.Uri.joinPath(workspaceFolder.uri, 'DEMO.md');
      await vscode.workspace.fs.writeFile(demoUri, Buffer.from(content, 'utf-8'));

      // Update state with success
      this._state.demoGenerated = true;
      this._state.demoFilePath = demoUri.fsPath;
      console.log('[Step8] DEMO.md generated successfully');

      vscode.window.showInformationMessage(
        'DEMO.md generated successfully!',
        'Open File'
      ).then((selection) => {
        if (selection === 'Open File') {
          this.handleOpenDemo();
        }
      });
    } catch (error) {
      // Unexpected error
      const errorMessage = error instanceof Error ? error.message : String(error);
      this._state.demoError = errorMessage;
      console.error(`[Step8] Demo generation error: ${errorMessage}`);
      vscode.window.showErrorMessage(`Demo generation failed: ${errorMessage}`);
    } finally {
      this._state.demoGenerating = false;
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
    }
  }

  /**
   * Open the generated DEMO.md file in the editor
   */
  public async handleOpenDemo(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const demoUri = vscode.Uri.joinPath(workspaceFolder.uri, 'DEMO.md');

    try {
      // Check if file exists
      await vscode.workspace.fs.stat(demoUri);

      // Open the file in the editor
      await vscode.window.showTextDocument(demoUri, {
        preview: false,
        viewColumn: vscode.ViewColumn.One,
      });
    } catch {
      vscode.window.showErrorMessage(
        'DEMO.md not found. Generate it first using the "Generate Demo" button.'
      );
    }
  }

  // ============================================================================
  // Task 6.3: handleGenerateAndOpenKiro() Method
  // ============================================================================

  /**
   * Generate steering files and open in Kiro (or show message for VS Code users)
   * Task 6.3: Calls handleGenerate and shows environment-appropriate message
   *
   * TODO: Phase 3 Item 34 will replace toast with:
   * vscode.commands.executeCommand('kiro.startSpecFlow', ...)
   */
  public async handleGenerateAndOpenKiro(inputs: Step8ContextInputs): Promise<void> {
    // First, generate the steering files
    await this.handleGenerate(inputs);

    // If generation failed, don't proceed with post-generation actions
    if (this._state.failedFile || this._state.generatedFilePaths.length === 0) {
      return;
    }

    // Check environment and show appropriate message
    if (isKiroEnvironment()) {
      // In Kiro: Reveal the steering folder and show info toast
      await this.revealSteeringFolder();

      // Show info toast for Kiro users
      vscode.window.showInformationMessage(
        'Steering files generated! Kiro spec integration coming in Phase 3'
      );
    } else {
      // In VS Code: Show message with Learn More link
      const selection = await vscode.window.showInformationMessage(
        'Steering files generated! Open this project in Kiro IDE for spec-driven development',
        'Learn More'
      );

      if (selection === 'Learn More') {
        // Open Kiro website
        const kiroUrl = getKiroLearnMoreUrl();
        vscode.env.openExternal(vscode.Uri.parse(kiroUrl));
      }
    }
  }

  /**
   * Handle file start event from service
   */
  private handleFileStart(fileName: string, index: number): void {
    this._state.currentFileIndex = index;
    this._state.accordionExpanded = true; // Auto-expand during generation
    this._callbacks.updateWebviewContent();
  }

  /**
   * Handle file complete event from service
   */
  private handleFileComplete(fileName: string, filePath: string): void {
    this._state.completedFiles.push(fileName);
    this._state.generatedFilePaths.push(filePath);
    this._callbacks.updateWebviewContent();
  }

  /**
   * Handle file error event from service
   */
  private handleFileError(fileName: string, error: string): void {
    this._state.failedFile = { name: fileName, error };
    this._state.accordionExpanded = true; // Auto-expand on error
    this._callbacks.updateWebviewContent();
  }

  // ============================================================================
  // Task 3.6 & 4.6: handleRetry() Method - Updated for Selective Retry
  // ============================================================================

  /**
   * Retry generation for failed files only
   * Task 3.6: Resume from failedFile index, not from beginning
   * Task 4.6: Now uses retryFailedFiles for selective retry
   */
  public async handleRetry(inputs: Step8ContextInputs): Promise<void> {
    // Get the failed file name
    const failedFileName = this._state.failedFile?.name;

    if (!failedFileName) {
      // No failed file to retry
      return;
    }

    // Clear failed file state
    this._state.failedFile = undefined;
    this._state.isGenerating = true;
    this._state.accordionExpanded = true;

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    // Initialize service and retry generation
    const service = this.initService();

    try {
      // Task 4.6: Get full WizardState from callbacks
      const wizardState = this._callbacks.getWizardState();

      // Retry only the failed file(s) - files from failedFileName to end
      const failedIndex = STEERING_FILES.indexOf(failedFileName);
      const filesToRetry = STEERING_FILES.slice(failedIndex);

      const result = await service.retryFailedFiles(wizardState, filesToRetry);

      if (result.success) {
        // Success - merge new files with previously completed
        this._state.generatedFilePaths = [
          ...this._state.generatedFilePaths,
          ...result.files,
        ];
        this._state.accordionExpanded = false; // Auto-collapse on success
        this._state.steeringComplete = true; // Mark Phase 1 as complete

        // Show success toast
        this.showSuccessToast(TOTAL_STEERING_FILES);
      } else if (result.error) {
        // Retry also failed
        this._state.failedFile = {
          name: result.error.fileName,
          error: result.error.message,
        };
      }
    } catch (error) {
      // Unexpected error
      this._state.failedFile = {
        name: failedFileName,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    this._state.isGenerating = false;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  // ============================================================================
  // Task 3.7: handleStartOver() Method
  // ============================================================================

  /**
   * Start over with confirmation dialog
   * Task 3.7: Shows confirmation, calls onStartOver callback if confirmed
   */
  public async handleStartOver(): Promise<void> {
    const result = await this._callbacks.showConfirmDialog(
      'This will clear all wizard data. Generated files will not be deleted.',
      ['Start Over', 'Cancel']
    );

    if (result === 'Start Over') {
      this._callbacks.onStartOver();
    }
  }

  // ============================================================================
  // Task 3.8: handleOpenFile() Method
  // ============================================================================

  /**
   * Open a generated file in the editor
   * Task 3.8: Calls callbacks.openFile(filePath)
   */
  public async handleOpenFile(filePath: string): Promise<void> {
    await this._callbacks.openFile(filePath);
  }

  // ============================================================================
  // Task 3.9: handleToggleAccordion() Method
  // ============================================================================

  /**
   * Toggle the progress accordion expand/collapse state
   * Task 3.9: Toggles state.accordionExpanded
   */
  public handleToggleAccordion(): void {
    this._state.accordionExpanded = !this._state.accordionExpanded;
    this._callbacks.updateWebviewContent();
  }

  // ============================================================================
  // Phase 2: Roadmap Generation Handlers
  // ============================================================================

  /**
   * Generate ROADMAP.md at project root
   * Phase 2: Task 3.4 - Implement handleGenerateRoadmap() method
   *
   * Flow:
   * 1. Initialize roadmap service
   * 2. Call generateRoadmap() to get content
   * 3. Write content to project root as ROADMAP.md
   * 4. State updates handled via event subscriptions
   */
  public async handleGenerateRoadmap(): Promise<void> {
    try {
      // Initialize roadmap service
      const service = this.initRoadmapService();

      // Generate roadmap content (events will update state)
      const content = await service.generateRoadmap();

      // Write to project root (human-facing documentation)
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('No workspace folder open');
      }

      const roadmapUri = vscode.Uri.joinPath(
        workspaceFolder.uri,
        ROADMAP_OUTPUT_FILE
      );

      await vscode.workspace.fs.writeFile(
        roadmapUri,
        Buffer.from(content, 'utf-8')
      );

      // Update file path in state (event handler already set roadmapGenerated)
      this._state.roadmapFilePath = roadmapUri.fsPath;
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();

      // Phase 3: Copy pattern-specific orchestrator template
      try {
        await this.copyOrchestratorTemplate();
        console.log('Phase 3 complete: Orchestrator template copied');
      } catch (templateError) {
        // Log but don't fail the overall operation - roadmap was still generated
        console.error('Warning: Failed to copy orchestrator template:', templateError);
        vscode.window.showWarningMessage(
          'Roadmap generated, but orchestrator template copy failed. You may need to manually copy agents/main.py'
        );
      }

      // Show success message
      vscode.window.showInformationMessage(
        'Implementation roadmap generated successfully!',
        'Open Roadmap'
      ).then((selection) => {
        if (selection === 'Open Roadmap') {
          this.handleOpenRoadmap();
        }
      });
    } catch (error) {
      // Error handling is done via event subscription, but catch unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!this._state.roadmapError) {
        this._state.roadmapGenerating = false;
        this._state.roadmapError = errorMessage;
        this._callbacks.updateWebviewContent();
        this._callbacks.syncStateToWebview();
      }
    }
  }

  /**
   * Open the generated ROADMAP.md file in the editor
   * Phase 2: Task 3.5 - Implement handleOpenRoadmap() method
   */
  public async handleOpenRoadmap(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const roadmapUri = vscode.Uri.joinPath(
      workspaceFolder.uri,
      ROADMAP_OUTPUT_FILE
    );

    try {
      // Check if file exists
      await vscode.workspace.fs.stat(roadmapUri);

      // Open the file in the editor
      await vscode.window.showTextDocument(roadmapUri, {
        preview: false,
        viewColumn: vscode.ViewColumn.One,
      });
    } catch {
      vscode.window.showErrorMessage(
        `${ROADMAP_OUTPUT_FILE} not found. Generate it first using the "Generate Roadmap" button.`
      );
    }
  }

  // ============================================================================
  // Phase 3: Orchestrator Template Copying
  // ============================================================================

  /**
   * Copy pattern-specific orchestrator template to agents/main.py
   * Phase 3: Based on wizard state's confirmedOrchestration value
   *
   * Copies:
   * 1. main_{pattern}.py → agents/main.py
   * 2. orchestrator_utils.py → agents/shared/orchestrator_utils.py
   */
  public async copyOrchestratorTemplate(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder open');
    }

    const context = this._callbacks.getContext();
    if (!context) {
      throw new Error('Extension context is required for template copying');
    }

    // Get orchestration pattern from wizard state
    const wizardState = this._callbacks.getWizardState();
    const pattern = wizardState.agentDesign?.confirmedOrchestration?.toLowerCase() || 'graph';

    // Map pattern to template file name
    const templateMap: Record<string, string> = {
      'graph': 'main_graph.py',
      'swarm': 'main_swarm.py',
      'workflow': 'main_workflow.py',
    };
    const templateFileName = templateMap[pattern] || 'main_graph.py';

    // Get extension resources path
    const extensionPath = context.extensionPath;

    // Source and destination paths for main.py
    const mainTemplateSrc = vscode.Uri.file(
      path.join(extensionPath, 'resources', 'agents', templateFileName)
    );
    const mainTemplateDest = vscode.Uri.joinPath(
      workspaceFolder.uri,
      'agents',
      'main.py'
    );

    // Source and destination paths for orchestrator_utils.py
    const utilsSrc = vscode.Uri.file(
      path.join(extensionPath, 'resources', 'agents', 'shared', 'orchestrator_utils.py')
    );
    const utilsDest = vscode.Uri.joinPath(
      workspaceFolder.uri,
      'agents',
      'shared',
      'orchestrator_utils.py'
    );

    try {
      // Ensure agents/ directory exists
      const agentsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'agents');
      try {
        await vscode.workspace.fs.stat(agentsDir);
      } catch {
        await vscode.workspace.fs.createDirectory(agentsDir);
      }

      // Ensure agents/shared/ directory exists
      const sharedDir = vscode.Uri.joinPath(agentsDir, 'shared');
      try {
        await vscode.workspace.fs.stat(sharedDir);
      } catch {
        await vscode.workspace.fs.createDirectory(sharedDir);
      }

      // Copy orchestrator template
      const templateContent = await vscode.workspace.fs.readFile(mainTemplateSrc);
      await vscode.workspace.fs.writeFile(mainTemplateDest, templateContent);
      console.log(`Copied ${templateFileName} to agents/main.py`);

      // Copy orchestrator_utils.py
      const utilsContent = await vscode.workspace.fs.readFile(utilsSrc);
      await vscode.workspace.fs.writeFile(utilsDest, utilsContent);
      console.log('Copied orchestrator_utils.py to agents/shared/');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to copy orchestrator template: ${errorMessage}`);
      throw new Error(`Failed to copy orchestrator template (${pattern}): ${errorMessage}`);
    }
  }

  /**
   * Reveal the .kiro/steering folder in the explorer
   * Phase 2: Task 3.6 - Implement handleOpenKiroFolder() method
   */
  public async handleOpenKiroFolder(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const steeringFolderUri = vscode.Uri.joinPath(
      workspaceFolder.uri,
      STEERING_DIR_PATH
    );

    try {
      // Check if folder exists
      await vscode.workspace.fs.stat(steeringFolderUri);

      // Reveal in explorer
      await vscode.commands.executeCommand('revealInExplorer', steeringFolderUri);
    } catch {
      // Fallback: just show the explorer view
      await vscode.commands.executeCommand('workbench.view.explorer');
      vscode.window.showWarningMessage(
        'Steering folder not found. Generate steering files first.'
      );
    }
  }

  // ============================================================================
  // Task 3.10: getStepSummaries() Method
  // ============================================================================

  /**
   * Get step summaries for pre-generation display
   * Task 3.10: Returns StepSummary[] for Steps 1-7
   */
  public getStepSummaries(inputs: Step8ContextInputs): StepSummary[] {
    const summaries: StepSummary[] = [];

    for (let stepNumber = 1; stepNumber <= 7; stepNumber++) {
      const validationResult = this.getValidationStatusForStep(stepNumber, inputs);
      const summaryData = this.getSummaryDataForStep(stepNumber, inputs);

      summaries.push({
        stepNumber,
        stepName: STEP_NAMES[stepNumber],
        summaryData,
        validationStatus: validationResult.status,
        validationMessage: validationResult.message,
      });
    }

    return summaries;
  }

  /**
   * Get summary data for a specific step
   * Helper for getStepSummaries()
   */
  private getSummaryDataForStep(
    stepNumber: number,
    inputs: Step8ContextInputs
  ): Record<string, string> {
    switch (stepNumber) {
      case 1:
        return {
          'Industry': inputs.industry || 'Not specified',
          'Systems': inputs.systems.length > 0 ? `${inputs.systems.length} system(s)` : 'None selected',
          'Objective': this.truncateText(inputs.businessObjective, 50) || 'Not specified',
        };

      case 2:
        return {
          'Assumptions': `${inputs.aiGapFillingState.confirmedAssumptions.length} confirmed`,
          'Status': inputs.aiGapFillingState.assumptionsAccepted ? 'Accepted' : 'Pending',
        };

      case 3:
        return {
          'Outcome': this.truncateText(inputs.outcome.primaryOutcome, 40) || 'Not specified',
          'KPIs': `${inputs.outcome.successMetrics.length} metric(s)`,
          'Stakeholders': `${inputs.outcome.stakeholders.length} stakeholder(s)`,
        };

      case 4:
        if (inputs.security.skipped) {
          return { 'Status': 'Skipped' };
        }
        return {
          'Sensitivity': inputs.security.dataSensitivity,
          'Frameworks': inputs.security.complianceFrameworks.length > 0
            ? inputs.security.complianceFrameworks.join(', ')
            : 'None selected',
        };

      case 5:
        return {
          'Agents': `${inputs.agentDesign.confirmedAgents.length} agent${inputs.agentDesign.confirmedAgents.length !== 1 ? 's' : ''}`,
          'Orchestration': inputs.agentDesign.confirmedOrchestration,
        };

      case 6:
        return {
          'Tools': `${inputs.mockData.mockDefinitions.length} tool${inputs.mockData.mockDefinitions.length !== 1 ? 's' : ''}`,
          'Customer Terminology': inputs.mockData.useCustomerTerminology ? 'Enabled' : 'Disabled',
        };

      case 7:
        return {
          'Aha Moments': `${inputs.demoStrategy.ahaMoments.length} moment(s)`,
          'Scenes': `${inputs.demoStrategy.narrativeScenes.length} scene(s)`,
          'Persona': inputs.demoStrategy.persona.name || 'Not defined',
        };

      default:
        return {};
    }
  }

  /**
   * Truncate text with ellipsis
   */
  private truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  // ============================================================================
  // Task 3.11: aggregateValidationStatus() for each step
  // ============================================================================

  /**
   * Get validation status for a specific step
   * Task 3.11: Returns status and optional message per step
   */
  public getValidationStatusForStep(
    stepNumber: number,
    inputs: Step8ContextInputs
  ): { status: StepValidationStatus; message?: string } {
    switch (stepNumber) {
      case 1:
        return this.validateStep1(inputs);
      case 2:
        return this.validateStep2(inputs);
      case 3:
        return this.validateStep3(inputs);
      case 4:
        return this.validateStep4(inputs);
      case 5:
        return this.validateStep5(inputs);
      case 6:
        return this.validateStep6(inputs);
      case 7:
        return this.validateStep7(inputs);
      default:
        return { status: 'complete' };
    }
  }

  /**
   * Validate Step 1: Business Context
   * Check businessObjective, industry required fields
   */
  private validateStep1(inputs: Step8ContextInputs): { status: StepValidationStatus; message?: string } {
    if (!inputs.businessObjective || inputs.businessObjective.trim() === '') {
      return { status: 'error', message: 'Business objective is required' };
    }
    if (!inputs.industry || inputs.industry.trim() === '') {
      return { status: 'error', message: 'Industry is required' };
    }
    if (inputs.systems.length === 0) {
      return { status: 'warning', message: 'No systems selected' };
    }
    return { status: 'complete' };
  }

  /**
   * Validate Step 2: AI Gap Filling
   * Check assumptionsAccepted flag
   */
  private validateStep2(inputs: Step8ContextInputs): { status: StepValidationStatus; message?: string } {
    if (!inputs.aiGapFillingState.assumptionsAccepted) {
      return { status: 'warning', message: 'Assumptions not yet accepted' };
    }
    return { status: 'complete' };
  }

  /**
   * Validate Step 3: Outcomes
   * Check primaryOutcome, successMetrics length
   */
  private validateStep3(inputs: Step8ContextInputs): { status: StepValidationStatus; message?: string } {
    if (!inputs.outcome.primaryOutcome || inputs.outcome.primaryOutcome.trim() === '') {
      return { status: 'error', message: 'Primary outcome is required' };
    }
    if (inputs.outcome.successMetrics.length === 0) {
      return { status: 'warning', message: 'No success metrics defined' };
    }
    return { status: 'complete' };
  }

  /**
   * Validate Step 4: Security
   * Return 'warning' if skipped, otherwise 'complete'
   */
  private validateStep4(inputs: Step8ContextInputs): { status: StepValidationStatus; message?: string } {
    if (inputs.security.skipped) {
      return { status: 'warning', message: 'Security configuration was skipped' };
    }
    return { status: 'complete' };
  }

  /**
   * Validate Step 5: Agent Design
   * Check confirmedAgents length
   */
  private validateStep5(inputs: Step8ContextInputs): { status: StepValidationStatus; message?: string } {
    if (inputs.agentDesign.confirmedAgents.length === 0) {
      return { status: 'error', message: 'No agents configured' };
    }
    return { status: 'complete' };
  }

  /**
   * Validate Step 6: Mock Data
   * Check mockDefinitions length, warn if empty sampleData
   */
  private validateStep6(inputs: Step8ContextInputs): { status: StepValidationStatus; message?: string } {
    if (inputs.mockData.mockDefinitions.length === 0) {
      return { status: 'warning', message: 'No mock data defined' };
    }

    // Check if any tool has empty sample data
    const hasEmptySampleData = inputs.mockData.mockDefinitions.some(
      (def) => def.sampleData.length === 0
    );
    if (hasEmptySampleData) {
      return { status: 'warning', message: 'Some tools have no sample data' };
    }

    return { status: 'complete' };
  }

  /**
   * Validate Step 7: Demo Strategy
   * Check ahaMoments length, warn if empty
   */
  private validateStep7(inputs: Step8ContextInputs): { status: StepValidationStatus; message?: string } {
    if (inputs.demoStrategy.ahaMoments.length === 0) {
      return { status: 'warning', message: 'No aha moments defined' };
    }
    if (inputs.demoStrategy.narrativeScenes.length === 0) {
      return { status: 'warning', message: 'No narrative scenes defined' };
    }
    return { status: 'complete' };
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this._serviceDisposables.forEach((d) => d.dispose());
    this._serviceDisposables = [];
  }
}
