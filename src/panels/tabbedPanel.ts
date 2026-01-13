/**
 * Tabbed Panel Provider
 * Unified panel with tabs for Ideation Wizard and Demo Viewer
 * Each tab gets full panel height for optimal UX
 */

import * as vscode from 'vscode';
import { getIdeationStyles } from './ideationStyles';
import { getIdeationScript } from './ideationScript';
import {
  getIdeationContentHtml,
  escapeHtml,
  IdeationState as StepHtmlIdeationState,
  IdeationValidationState as StepHtmlValidationState,
} from './ideationStepHtml';
import {
  WIZARD_STEPS,
  STAKEHOLDER_OPTIONS,
} from './ideationConstants';

// Step logic handlers
import {
  Step2LogicHandler,
  createDefaultAIGapFillingState,
  AIGapFillingState,
  SystemAssumption,
  ConversationMessage,
} from './ideationStep2Logic';
import {
  Step3LogicHandler,
  createDefaultOutcomeDefinitionState,
} from './ideationStep3Logic';
import {
  Step4LogicHandler,
  createDefaultSecurityGuardrailsState,
  SecurityGuardrailsState,
} from './ideationStep4Logic';
import {
  Step5LogicHandler,
  generateStep4Hash,
} from './ideationStep5Logic';
import {
  Step6LogicHandler,
} from './ideationStep6Logic';
// Task 4.10: Import Step7LogicHandler
import {
  Step7LogicHandler,
} from './ideationStep7Logic';
// Task 6.7: Import Step8LogicHandler
import {
  Step8LogicHandler,
  Step8ContextInputs,
} from './ideationStep8Logic';
import {
  createDefaultAgentDesignState,
  createDefaultMockDataState,
  createDefaultDemoStrategyState,
  createDefaultGenerationState,
  createDefaultWizardState,
  persistedStateToWizardState,
  AgentDesignState,
  MockDataState,
  DemoStrategyState,
  GenerationState,
  OutcomeDefinitionState,
  SuccessMetric,
  RefinedSectionsState,
  OrchestrationPattern,
  ResumeBannerState,
  WizardState,
  LtmStrategy,
  DEFAULT_LTM_RETENTION_DAYS,
} from '../types/wizardPanel';
import {
  getWizardStatePersistenceService,
  WizardStatePersistenceService,
} from '../services/wizardStatePersistenceService';
import {
  getResumeBannerHtml,
  getResumeBannerStyles,
  truncateBusinessObjective,
  calculateExpiryStatus,
} from './resumeBannerHtml';
// Task 8.2: Import steering file creation function
import { createSteeringFile } from '../templates/steeringFile';

// Demo Viewer Chat UI imports (Task Group 4: Service Integration)
import { DemoViewerChatLogic } from './demoViewerChatLogic';
import { getDemoViewerChatStyles } from './demoViewerChatStyles';
import { generateChatPanelHtml } from '../utils/chatPanelHtmlGenerator';
import { generateChatPanelJs } from '../utils/chatPanelJsGenerator';

/**
 * View ID for the Tabbed Panel
 */
export const TABBED_PANEL_VIEW_ID = 'agentify.tabbedPanel';

/**
 * Tab identifiers
 */
export type TabId = 'ideation' | 'demo';

/**
 * Tab configuration
 */
interface TabConfig {
  id: TabId;
  label: string;
}

/**
 * Available tabs
 */
const TABS: TabConfig[] = [
  { id: 'ideation', label: 'Ideation' },
  { id: 'demo', label: 'Demo Viewer' },
];

/**
 * Webview panel provider for the unified tabbed interface
 */
export class TabbedPanelProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _activeTab: TabId = 'ideation';
  private _extensionUri: vscode.Uri;
  private _context?: vscode.ExtensionContext;

  // Ideation Wizard state
  private _ideationState: IdeationState;
  private _ideationValidation: IdeationValidationState;

  // Demo Viewer state
  private _demoState: DemoState;

  // Config change listener
  private _configChangeDisposable?: vscode.Disposable;

  // Step logic handlers
  private _step2Handler?: Step2LogicHandler;
  private _step3Handler?: Step3LogicHandler;
  private _step4Handler?: Step4LogicHandler;
  private _step5Handler?: Step5LogicHandler;
  private _step6Handler?: Step6LogicHandler;
  // Task 4.10: Step 7 handler for demo strategy
  private _step7Handler?: Step7LogicHandler;
  // Task 6.7: Step 8 handler for generation
  private _step8Handler?: Step8LogicHandler;

  // Demo Viewer Chat Logic Handler (Task Group 4)
  private _chatHandler?: DemoViewerChatLogic;

  // Task 6.2: Persistence service and resume banner state
  private _persistenceService: WizardStatePersistenceService | null = null;
  private _resumeBannerState: ResumeBannerState = {
    visible: false,
    businessObjectivePreview: '',
    stepReached: 1,
    savedAt: 0,
    isExpired: false,
    isVersionMismatch: false,
  };

  constructor(extensionUri: vscode.Uri, context?: vscode.ExtensionContext) {
    this._extensionUri = extensionUri;
    this._context = context;

    // Initialize Ideation state
    this._ideationState = createDefaultIdeationState();
    this._ideationValidation = { isValid: false, errors: [], hasWarnings: false };

    // Initialize Demo state
    this._demoState = createDefaultDemoState();

    // Initialize step handlers
    this.initStepHandlers();

    // Task 6.2: Initialize persistence service
    this._persistenceService = getWizardStatePersistenceService();
  }

  /**
   * Initialize step logic handlers
   */
  private initStepHandlers(): void {
    const callbacks = {
      updateWebviewContent: () => this.updateWebviewContent(),
      syncStateToWebview: () => this.syncStateToWebview(),
      postStreamingToken: (content: string) => this.postStreamingToken(content),
    };

    this._step2Handler = new Step2LogicHandler(
      this._context,
      this._ideationState.aiGapFillingState,
      callbacks
    );

    this._step3Handler = new Step3LogicHandler(
      this._context,
      this._ideationState.outcome,
      {
        updateWebviewContent: callbacks.updateWebviewContent,
        syncStateToWebview: callbacks.syncStateToWebview,
      }
    );

    this._step4Handler = new Step4LogicHandler(
      this._ideationState.securityGuardrails,
      {
        updateWebviewContent: callbacks.updateWebviewContent,
        syncStateToWebview: callbacks.syncStateToWebview,
      }
    );

    this._step5Handler = new Step5LogicHandler(
      this._context,
      this._ideationState.agentDesign,
      {
        updateWebviewContent: callbacks.updateWebviewContent,
        syncStateToWebview: callbacks.syncStateToWebview,
      }
    );

    // Task 6.3: Initialize Step 6 handler
    this._step6Handler = new Step6LogicHandler(
      this._context,
      this._ideationState.mockData,
      {
        updateWebviewContent: callbacks.updateWebviewContent,
        syncStateToWebview: callbacks.syncStateToWebview,
      }
    );

    // Task 4.10: Initialize Step 7 handler
    this._step7Handler = new Step7LogicHandler(
      this._context,
      this._ideationState.demoStrategy,
      {
        updateWebviewContent: callbacks.updateWebviewContent,
        syncStateToWebview: callbacks.syncStateToWebview,
      }
    );

    // Task 6.7: Initialize Step 8 handler
    this._step8Handler = new Step8LogicHandler(
      this._ideationState.generation,
      {
        updateWebviewContent: callbacks.updateWebviewContent,
        syncStateToWebview: callbacks.syncStateToWebview,
        showConfirmDialog: async (message: string, options: string[]) => {
          return vscode.window.showWarningMessage(message, { modal: true }, ...options);
        },
        openFile: async (filePath: string) => {
          const fileUri = vscode.Uri.file(filePath);
          await vscode.commands.executeCommand('vscode.open', fileUri);
        },
        onStartOver: () => this.handleStartFresh(),
        getWizardState: () => this.ideationStateToWizardState(),
        getContext: () => this._context,
      }
    );

    // Initialize Demo Viewer Chat Logic Handler (Task Group 4)
    this._chatHandler = new DemoViewerChatLogic(
      this._context,
      {
        updateWebviewContent: () => this.updateWebviewContent(),
        syncStateToWebview: () => this.syncStateToWebview(),
        postStreamingToken: (content: string, pane?: string | null) => this.postDemoStreamingToken(content, pane),
      }
    );
  }

  /**
   * Post streaming token to webview (Ideation Wizard)
   */
  private postStreamingToken(content: string): void {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'streamingToken',
        content,
      });
    }
  }

  /**
   * Post streaming token to webview (Demo Viewer Chat)
   * Task Group 4: Separate method for demo chat streaming
   * Includes pane parameter for dual-pane scroll behavior
   */
  private postDemoStreamingToken(content: string, pane?: string | null): void {
    if (this._view && this._activeTab === 'demo') {
      this._view.webview.postMessage({
        type: 'streamingToken',
        content,
        pane,
      });
    }
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    const startTime = Date.now();
    console.log(`[TabbedPanel] ${startTime} resolveWebviewView START`);
    this._view = webviewView;

    console.log(`[TabbedPanel] ${Date.now() - startTime}ms Setting webview options`);
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // Render initial content immediately (before async work)
    console.log(`[TabbedPanel] ${Date.now() - startTime}ms Rendering initial content...`);
    try {
      this.updateWebviewContent();
      console.log(`[TabbedPanel] ${Date.now() - startTime}ms Initial content rendered`);
      this.syncStateToWebview();
      console.log(`[TabbedPanel] ${Date.now() - startTime}ms Initial state synced`);
    } catch (error) {
      console.error(`[TabbedPanel] ${Date.now() - startTime}ms Error rendering initial content:`, error);
    }

    // Set up message handler immediately
    console.log(`[TabbedPanel] ${Date.now() - startTime}ms Setting up message handler`);
    webviewView.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      undefined,
      []
    );

    // Watch for config changes
    console.log(`[TabbedPanel] ${Date.now() - startTime}ms Setting up config watcher`);
    try {
      this.subscribeToConfigChanges();
      console.log(`[TabbedPanel] ${Date.now() - startTime}ms Config watcher set up`);
    } catch (error) {
      console.error(`[TabbedPanel] ${Date.now() - startTime}ms Error setting up config watcher:`, error);
    }

    console.log(`[TabbedPanel] ${Date.now() - startTime}ms resolveWebviewView SYNC COMPLETE, starting async work`);

    // Check project initialization and load persisted state in background
    // Use Promise.race with timeout to prevent hanging
    const asyncWork = async () => {
      const asyncStart = Date.now();
      try {
        console.log(`[TabbedPanel] ${asyncStart - startTime}ms Async: Starting checkProjectInitialization`);
        await this.checkProjectInitialization();
        console.log(`[TabbedPanel] ${Date.now() - startTime}ms Async: checkProjectInitialization complete`);

        console.log(`[TabbedPanel] ${Date.now() - startTime}ms Async: Starting loadPersistedState`);
        await this.loadPersistedState();
        console.log(`[TabbedPanel] ${Date.now() - startTime}ms Async: loadPersistedState complete`);

        console.log(`[TabbedPanel] ${Date.now() - startTime}ms Async: Updating webview content`);
        this.updateWebviewContent();
        this.syncStateToWebview();
        console.log(`[TabbedPanel] ${Date.now() - startTime}ms Async: ALL COMPLETE`);
      } catch (error) {
        console.error(`[TabbedPanel] ${Date.now() - startTime}ms Async error:`, error);
      }
    };

    // Run with 10 second timeout
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Async initialization timed out after 10s')), 10000)
    );

    Promise.race([asyncWork(), timeout]).catch((error) => {
      console.error(`[TabbedPanel] ${Date.now() - startTime}ms TIMEOUT or ERROR:`, error);
    });
  }

  /**
   * Check if project is initialized
   */
  private async checkProjectInitialization(): Promise<void> {
    try {
      const configFiles = await vscode.workspace.findFiles('.agentify/config.json', null, 1);
      this._demoState.isProjectInitialized = configFiles.length > 0;
    } catch {
      this._demoState.isProjectInitialized = false;
    }
  }

  /**
   * Load persisted state and set up resume banner
   * Task 6.3: Implement state loading in resolveWebviewView()
   */
  private async loadPersistedState(): Promise<void> {
    if (!this._persistenceService) {
      return;
    }

    try {
      const result = await this._persistenceService.load();

      switch (result.status) {
        case 'loaded':
          if (result.state) {
            // Set up resume banner with state preview
            const expiryStatus = calculateExpiryStatus(result.state.savedAt);
            this._resumeBannerState = {
              visible: true,
              businessObjectivePreview: truncateBusinessObjective(result.state.businessObjective),
              stepReached: result.state.highestStepReached,
              savedAt: result.state.savedAt,
              isExpired: expiryStatus.isExpired,
              isVersionMismatch: false,
            };
          }
          break;

        case 'version_mismatch':
          // Show version mismatch banner
          this._resumeBannerState = {
            visible: true,
            businessObjectivePreview: '',
            stepReached: 1,
            savedAt: 0,
            isExpired: false,
            isVersionMismatch: true,
          };
          break;

        case 'corrupted':
          // Show warning notification, treat as not found
          vscode.window.showWarningMessage(
            'Previous wizard session data is corrupted. Starting fresh.'
          );
          // Clear the corrupted file
          await this._persistenceService.clear();
          break;

        case 'not_found':
          // No action needed, no banner shown
          break;
      }
    } catch (error) {
      console.error('[TabbedPanel] Failed to load persisted state:', error);
    }
  }

  /**
   * Handle resumeSession command
   * Task 6.6: Load persisted state, convert to WizardState, restore and navigate
   */
  private async handleResumeSession(): Promise<void> {
    if (!this._persistenceService) {
      return;
    }

    try {
      const result = await this._persistenceService.load();

      if (result.status === 'loaded' && result.state) {
        // Convert persisted state to wizard state
        const wizardState = persistedStateToWizardState(result.state);

        // Update ideation state with restored values
        this._ideationState.currentStep = wizardState.currentStep;
        this._ideationState.highestStepReached = wizardState.highestStepReached;
        this._ideationState.validationAttempted = wizardState.validationAttempted;
        this._ideationState.businessObjective = wizardState.businessObjective;
        this._ideationState.industry = wizardState.industry;
        this._ideationState.customIndustry = wizardState.customIndustry;
        this._ideationState.systems = wizardState.systems;
        this._ideationState.customSystems = wizardState.customSystems;
        this._ideationState.uploadedFile = undefined; // Binary not persisted
        this._ideationState.uploadedFileMetadata = wizardState.uploadedFileMetadata;
        this._ideationState.aiGapFillingState = wizardState.aiGapFillingState;
        this._ideationState.outcome = wizardState.outcome;
        // Determine if Step 4 was already configured (has user selections)
        const hasStep4Data =
          wizardState.security.complianceFrameworks.length > 0 ||
          wizardState.security.approvalGates.length > 0 ||
          wizardState.security.guardrailNotes.trim() !== '' ||
          wizardState.security.skipped;

        this._ideationState.securityGuardrails = {
          dataSensitivity: wizardState.security.dataSensitivity,
          complianceFrameworks: wizardState.security.complianceFrameworks,
          approvalGates: wizardState.security.approvalGates,
          guardrailNotes: wizardState.security.guardrailNotes,
          skipped: wizardState.security.skipped,
          aiSuggested: false,
          // Preserve existing selections by marking defaults as applied
          industryDefaultsApplied: hasStep4Data,
          // Prevent AI re-trigger if guardrailNotes already has content
          aiCalled: wizardState.security.guardrailNotes.trim() !== '',
          isLoading: false,
          // Cross-Agent Memory Feature: Restore memory settings from wizard state
          crossAgentMemoryEnabled: wizardState.security.crossAgentMemoryEnabled ?? true,
          memoryExpiryDays: wizardState.security.memoryExpiryDays ?? 7,
          // Persistent Session Memory Feature: Restore LTM settings from wizard state
          longTermMemoryEnabled: wizardState.security.longTermMemoryEnabled ?? false,
          ltmRetentionDays: wizardState.security.ltmRetentionDays ?? DEFAULT_LTM_RETENTION_DAYS,
          ltmStrategy: wizardState.security.ltmStrategy ?? 'semantic',
        };
        this._ideationState.agentDesign = wizardState.agentDesign;
        this._ideationState.mockData = wizardState.mockData;
        // Task 3.2: Restore demo strategy state
        this._ideationState.demoStrategy = wizardState.demoStrategy;
        // Task 6.7: Restore generation state
        this._ideationState.generation = wizardState.generation;

        // Re-initialize step handlers with restored state
        this.initStepHandlers();

        // Navigate to highestStepReached
        this._ideationState.currentStep = wizardState.highestStepReached;

        // Hide the resume banner
        this._resumeBannerState.visible = false;

        // If resuming directly to Step 8, check for existing steering files
        if (this._ideationState.currentStep === 8) {
          await this.updateStep8CanGenerate();
        }

        // Update UI
        this.updateWebviewContent();
        this.syncStateToWebview();
      }
    } catch (error) {
      console.error('[TabbedPanel] Failed to resume session:', error);
      vscode.window.showErrorMessage('Failed to resume previous session.');
    }
  }

  /**
   * Handle startFresh command
   * Task 6.7: Clear persisted state and reset to default wizard state
   */
  private async handleStartFresh(): Promise<void> {
    if (this._persistenceService) {
      try {
        await this._persistenceService.clear();
      } catch (error) {
        console.error('[TabbedPanel] Failed to clear persisted state:', error);
      }
    }

    // Reset to default state
    this._ideationState = createDefaultIdeationState();
    this._ideationValidation = { isValid: false, errors: [], hasWarnings: false };

    // Re-initialize step handlers with fresh state
    this.initStepHandlers();

    // Hide the resume banner
    this._resumeBannerState.visible = false;

    // Stay on Step 1
    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Handle generateSteeringFiles command
   * Task 8.2: Generate steering files and clear wizard state on success
   */
  private async handleGenerateSteeringFiles(): Promise<void> {
    // Get workspace root
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open. Please open a folder first.');
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    try {
      // Create the steering file
      const result = await createSteeringFile(workspaceRoot);

      if (result.success) {
        // Task 8.2: Clear wizard state after successful generation
        if (this._persistenceService) {
          await this._persistenceService.clear();
          console.log('[TabbedPanel] Wizard state cleared after successful generation');
        }

        // Show success message
        if (result.skipped) {
          vscode.window.showInformationMessage(result.message);
        } else {
          vscode.window.showInformationMessage('Steering files generated successfully!');
        }
      } else {
        // Generation failed - state is preserved (no clear called)
        vscode.window.showErrorMessage(`Failed to generate steering files: ${result.message}`);
      }
    } catch (error) {
      // Generation threw an error - state is preserved (no clear called)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[TabbedPanel] Failed to generate steering files:', error);
      vscode.window.showErrorMessage(`Failed to generate steering files: ${errorMessage}`);
    }
  }

  /**
   * Convert IdeationState to WizardState for persistence
   * Task 6.4: Helper to map local state to persistable format
   */
  private ideationStateToWizardState(): WizardState {
    return {
      currentStep: this._ideationState.currentStep,
      highestStepReached: this._ideationState.highestStepReached,
      validationAttempted: this._ideationState.validationAttempted,
      businessObjective: this._ideationState.businessObjective,
      industry: this._ideationState.industry,
      customIndustry: this._ideationState.customIndustry,
      systems: this._ideationState.systems,
      customSystems: this._ideationState.customSystems,
      uploadedFile: this._ideationState.uploadedFile,
      uploadedFileMetadata: this._ideationState.uploadedFileMetadata,
      aiGapFillingState: this._ideationState.aiGapFillingState,
      outcome: this._ideationState.outcome,
      security: {
        dataSensitivity: this._ideationState.securityGuardrails.dataSensitivity as 'public' | 'internal' | 'confidential' | 'restricted',
        complianceFrameworks: this._ideationState.securityGuardrails.complianceFrameworks,
        approvalGates: this._ideationState.securityGuardrails.approvalGates,
        guardrailNotes: this._ideationState.securityGuardrails.guardrailNotes,
        skipped: this._ideationState.securityGuardrails.skipped,
        // Cross-Agent Memory Feature: Include memory settings in persisted state
        crossAgentMemoryEnabled: this._ideationState.securityGuardrails.crossAgentMemoryEnabled,
        memoryExpiryDays: this._ideationState.securityGuardrails.memoryExpiryDays,
        // Persistent Session Memory Feature: Include LTM settings in persisted state
        longTermMemoryEnabled: this._ideationState.securityGuardrails.longTermMemoryEnabled,
        ltmRetentionDays: this._ideationState.securityGuardrails.ltmRetentionDays,
        ltmStrategy: this._ideationState.securityGuardrails.ltmStrategy,
      },
      agentDesign: this._ideationState.agentDesign,
      mockData: this._ideationState.mockData,
      // Task 3.2: Include demo strategy in persisted state
      demoStrategy: this._ideationState.demoStrategy,
      // Task 6.7: Include generation state
      generation: this._ideationState.generation,
    };
  }

  /**
   * Save current state with debouncing
   * Task 6.4: Wire debounced save to state mutation handlers
   */
  private saveState(): void {
    if (this._persistenceService) {
      const wizardState = this.ideationStateToWizardState();
      this._persistenceService.save(wizardState);
    }
  }

  /**
   * Save current state immediately (no debounce)
   * Task 6.5: Wire immediate save to navigation handlers
   */
  private async saveStateImmediate(): Promise<void> {
    if (this._persistenceService) {
      const wizardState = this.ideationStateToWizardState();
      await this._persistenceService.saveImmediate(wizardState);
    }
  }

  /**
   * Subscribe to config file changes
   */
  private subscribeToConfigChanges(): void {
    const watcher = vscode.workspace.createFileSystemWatcher('**/.agentify/config.json');

    this._configChangeDisposable = vscode.Disposable.from(
      watcher,
      watcher.onDidCreate(() => {
        this._demoState.isProjectInitialized = true;
        this.updateWebviewContent();
      }),
      watcher.onDidDelete(() => {
        this._demoState.isProjectInitialized = false;
        this.updateWebviewContent();
      })
    );
  }

  /**
   * Handle messages from webview
   */
  private handleMessage(message: { command: string; [key: string]: unknown }): void {
    const { command } = message;

    // Tab switching
    if (command === 'switchTab') {
      this._activeTab = message.tab as TabId;
      this.updateWebviewContent();
      this.syncStateToWebview();
      return;
    }

    // Route to appropriate handler based on active tab
    if (this._activeTab === 'ideation') {
      this.handleIdeationMessage(message);
    } else {
      this.handleDemoMessage(message);
    }
  }

  /**
   * Handle Ideation Wizard messages
   */
  private handleIdeationMessage(message: { command: string; [key: string]: unknown }): void {
    const { command } = message;

    switch (command) {
      case 'nextStep':
        this.ideationNavigateForward();
        break;
      case 'previousStep':
        this.ideationNavigateBackward();
        break;
      case 'goToStep':
        this.ideationNavigateToStep(message.step as number);
        break;
      case 'updateBusinessObjective':
        this._ideationState.businessObjective = message.value as string;
        this.validateIdeationStep1();
        this.syncStateToWebview();
        this.saveState(); // Task 6.4: Debounced save
        break;
      case 'updateIndustry':
        this._ideationState.industry = message.value as string;
        if (message.value !== 'Other') {
          this._ideationState.customIndustry = undefined;
        }
        // Reset Step 4 industry defaults so they can be reapplied for new industry
        this._step4Handler?.resetIndustryDefaults();
        this.validateIdeationStep1();
        this.updateWebviewContent();
        this.syncStateToWebview();
        this.saveState(); // Task 6.4: Debounced save
        break;
      case 'updateCustomIndustry':
        this._ideationState.customIndustry = message.value as string;
        this.syncStateToWebview();
        this.saveState(); // Task 6.4: Debounced save
        break;
      case 'toggleSystem':
        const system = message.value as string;
        const idx = this._ideationState.systems.indexOf(system);
        if (idx >= 0) {
          this._ideationState.systems.splice(idx, 1);
        } else {
          this._ideationState.systems.push(system);
        }
        this.validateIdeationStep1();
        this.updateWebviewContent();
        this.syncStateToWebview();
        this.saveState(); // Task 6.4: Debounced save
        break;
      case 'updateCustomSystems':
        this._ideationState.customSystems = message.value as string;
        this.syncStateToWebview();
        this.saveState(); // Task 6.4: Debounced save
        break;
      case 'uploadFile':
        const fileData = message.file as { name: string; size: number; data: number[] };
        if (fileData) {
          this._ideationState.uploadedFile = {
            name: fileData.name,
            size: fileData.size,
            data: new Uint8Array(fileData.data),
          };
          // Clear previous metadata when new file uploaded
          this._ideationState.uploadedFileMetadata = undefined;
          this.validateIdeationStep1();
          this.updateWebviewContent();
          this.syncStateToWebview();
          this.saveState(); // Task 6.4: Debounced save
        }
        break;
      case 'removeFile':
        this._ideationState.uploadedFile = undefined;
        this._ideationState.uploadedFileMetadata = undefined;
        this.validateIdeationStep1();
        this.updateWebviewContent();
        this.syncStateToWebview();
        this.saveState(); // Task 6.4: Debounced save
        break;

      // Step 2: AI Gap-Filling commands
      case 'sendChatMessage':
        this._step2Handler?.handleSendChatMessage(message.value as string);
        break;
      case 'acceptAssumptions':
        this._step2Handler?.handleAcceptAssumptions();
        break;
      case 'regenerateAssumptions':
        this._step2Handler?.handleRegenerateAssumptions(this.getStep1Inputs());
        break;
      case 'retryLastMessage':
        this._step2Handler?.handleRetryLastMessage(this.getStep1Inputs());
        break;

      // Step 3: Outcome Definition commands
      case 'updatePrimaryOutcome':
        this._ideationState.outcome.primaryOutcome = message.value as string;
        this._ideationState.outcome.primaryOutcomeEdited = true;
        this.syncStateToWebview();
        this.saveState(); // Task 6.4: Debounced save
        break;
      case 'addMetric':
        this._ideationState.outcome.successMetrics.push({
          name: '',
          targetValue: '',
          unit: '',
        });
        this._ideationState.outcome.metricsEdited = true;
        this.updateWebviewContent();
        this.syncStateToWebview();
        this.saveState(); // Task 6.4: Debounced save
        break;
      case 'removeMetric':
        const metricIndex = message.index as number;
        if (metricIndex >= 0 && metricIndex < this._ideationState.outcome.successMetrics.length) {
          this._ideationState.outcome.successMetrics.splice(metricIndex, 1);
          this._ideationState.outcome.metricsEdited = true;
          this.updateWebviewContent();
          this.syncStateToWebview();
          this.saveState(); // Task 6.4: Debounced save
        }
        break;
      case 'updateMetric':
        const updateIndex = message.index as number;
        const field = message.field as string;
        const metric = this._ideationState.outcome.successMetrics[updateIndex];
        if (metric) {
          if (field === 'name') {
            metric.name = message.value as string;
          } else if (field === 'targetValue') {
            metric.targetValue = message.value as string;
          } else if (field === 'unit') {
            metric.unit = message.value as string;
          }
          this._ideationState.outcome.metricsEdited = true;
          this.syncStateToWebview();
          this.saveState(); // Task 6.4: Debounced save
        }
        break;
      case 'toggleStakeholder':
        const stakeholder = message.value as string;
        const stakeholders = this._ideationState.outcome.stakeholders;
        const stakeholderIdx = stakeholders.indexOf(stakeholder);
        if (stakeholderIdx >= 0) {
          stakeholders.splice(stakeholderIdx, 1);
        } else {
          stakeholders.push(stakeholder);
        }
        this._ideationState.outcome.stakeholdersEdited = true;
        this.syncStateToWebview();
        this.saveState(); // Task 6.4: Debounced save
        break;
      case 'addCustomStakeholder':
        const customStakeholder = message.value as string;
        if (customStakeholder && customStakeholder.trim()) {
          const trimmedValue = customStakeholder.trim();
          // Add to custom stakeholders if not already in static list or custom list
          if (
            !STAKEHOLDER_OPTIONS.includes(trimmedValue) &&
            !this._ideationState.outcome.customStakeholders.includes(trimmedValue)
          ) {
            this._ideationState.outcome.customStakeholders.push(trimmedValue);
          }
          // Also add to selected stakeholders
          if (!this._ideationState.outcome.stakeholders.includes(trimmedValue)) {
            this._ideationState.outcome.stakeholders.push(trimmedValue);
          }
          this._ideationState.outcome.stakeholdersEdited = true;
          this.updateWebviewContent();
          this.syncStateToWebview();
          this.saveState(); // Task 6.4: Debounced save
        }
        break;
      case 'regenerateOutcomeSuggestions':
        this._step3Handler?.handleRegenerateSuggestions(this.getStep1And2Inputs());
        break;
      case 'acceptOutcomeSuggestions':
        // Transition from Phase 1 to Phase 2
        this._ideationState.outcome.suggestionsAccepted = true;
        // Reset edited flags so AI refinements can still update fields
        this._ideationState.outcome.primaryOutcomeEdited = false;
        this._ideationState.outcome.metricsEdited = false;
        this._ideationState.outcome.stakeholdersEdited = false;
        this.updateWebviewContent();
        this.syncStateToWebview();
        this.saveState(); // Task 6.4: Debounced save
        break;
      case 'sendOutcomeRefinement':
        this._step3Handler?.handleSendOutcomeRefinement(message.value as string);
        break;
      case 'dismissOutcomeError':
        this._ideationState.outcome.loadingError = undefined;
        this.updateWebviewContent();
        this.syncStateToWebview();
        break;

      // Step 4: Security & Guardrails commands
      case 'updateDataSensitivity':
        this._ideationState.securityGuardrails.dataSensitivity = message.value as string;
        this.updateWebviewContent();
        this.syncStateToWebview();
        this.saveState(); // Task 6.4: Debounced save
        break;
      case 'toggleComplianceFramework':
        const framework = message.value as string;
        const frameworks = this._ideationState.securityGuardrails.complianceFrameworks;
        const frameworkIdx = frameworks.indexOf(framework);
        if (frameworkIdx >= 0) {
          frameworks.splice(frameworkIdx, 1);
        } else {
          frameworks.push(framework);
        }
        this.updateWebviewContent();
        this.syncStateToWebview();
        this.saveState(); // Task 6.4: Debounced save
        break;
      case 'toggleApprovalGate':
        const gate = message.value as string;
        const gates = this._ideationState.securityGuardrails.approvalGates;
        const gateIdx = gates.indexOf(gate);
        if (gateIdx >= 0) {
          gates.splice(gateIdx, 1);
        } else {
          gates.push(gate);
        }
        this.updateWebviewContent();
        this.syncStateToWebview();
        this.saveState(); // Task 6.4: Debounced save
        break;
      case 'updateGuardrailNotes':
        this._ideationState.securityGuardrails.guardrailNotes = message.value as string;
        this._ideationState.securityGuardrails.aiSuggested = false;
        this.syncStateToWebview();
        this.saveState(); // Task 6.4: Debounced save
        break;
      // Cross-Agent Memory Feature: Memory settings handlers
      case 'toggleCrossAgentMemory':
        this._ideationState.securityGuardrails.crossAgentMemoryEnabled = message.value as boolean;
        this.syncStateToWebview();
        this.saveState();
        break;
      case 'updateMemoryExpiryDays':
        this._ideationState.securityGuardrails.memoryExpiryDays = message.value as number;
        this.syncStateToWebview();
        this.saveState();
        break;
      // Persistent Session Memory Feature: LTM settings handlers
      case 'toggleLongTermMemory':
        this._step4Handler?.toggleLongTermMemory(message.value as boolean);
        this.saveState();
        break;
      case 'updateLtmRetentionDays':
        this._step4Handler?.updateLtmRetentionDays(message.value as number);
        this.saveState();
        break;
      case 'updateLtmStrategy':
        this._step4Handler?.updateLtmStrategy(message.value as string);
        this.saveState();
        break;
      case 'skipSecurityStep':
        // Apply sensible defaults
        this._ideationState.securityGuardrails.dataSensitivity = 'Internal';
        this._ideationState.securityGuardrails.complianceFrameworks = [];
        this._ideationState.securityGuardrails.approvalGates = [];
        this._ideationState.securityGuardrails.guardrailNotes = '';
        this._ideationState.securityGuardrails.skipped = true;
        // Navigate forward
        this._ideationState.currentStep = Math.min(this._ideationState.currentStep + 1, WIZARD_STEPS.length);
        this._ideationState.highestStepReached = Math.max(this._ideationState.highestStepReached, this._ideationState.currentStep);
        this.updateWebviewContent();
        this.syncStateToWebview();
        this.saveState(); // Task 6.4: Debounced save
        break;

      // Step 5: Agent Design commands (Phase 1)
      case 'regenerateAgentProposal':
        this._step5Handler?.handleRegenerateProposal(this.getStep5Inputs());
        break;
      case 'acceptAgentProposal':
        this._step5Handler?.handleAcceptProposal();
        // Navigate to Step 6
        this._ideationState.currentStep = Math.min(this._ideationState.currentStep + 1, WIZARD_STEPS.length);
        this._ideationState.highestStepReached = Math.max(this._ideationState.highestStepReached, this._ideationState.currentStep);
        this.updateWebviewContent();
        this.syncStateToWebview();
        break;
      case 'sendAgentDesignAdjustment':
        this._step5Handler?.handleSendAdjustment(message.value as string, this.getStep5Inputs());
        break;
      case 'toggleOrchestrationReasoning':
        // Toggle handled in JS, just sync state
        this.syncStateToWebview();
        break;

      // =========================================================================
      // Step 5 Phase 2: Agent Design Editing commands (Task Group 3)
      // =========================================================================

      // Phase transition commands
      case 'acceptSuggestionsPhase2':
        // Transition from Phase 1 to Phase 2 (stays on Step 5 in editable mode)
        this._step5Handler?.handleAcceptSuggestionsPhase2();
        break;

      case 'acceptAndContinue':
        // Accept proposal and continue directly to Step 6 (skip manual editing)
        if (this._step5Handler) {
          const success = this._step5Handler.handleAcceptAndContinue();
          if (success) {
            this._ideationState.currentStep = Math.min(this._ideationState.currentStep + 1, WIZARD_STEPS.length);
            this._ideationState.highestStepReached = Math.max(this._ideationState.highestStepReached, this._ideationState.currentStep);
            // Task 6.4: Trigger auto-send for Step 6 when entering via Accept & Continue
            if (this._ideationState.currentStep === 6) {
              this._step6Handler?.triggerAutoSend(this.getStep6Inputs());
            }
            this.updateWebviewContent();
            this.syncStateToWebview();
          }
        }
        break;

      // Agent editing commands
      case 'updateAgentName':
        this._step5Handler?.handleUpdateAgentName(
          message.agentId as string,
          message.value as string
        );
        break;

      case 'updateAgentRole':
        this._step5Handler?.handleUpdateAgentRole(
          message.agentId as string,
          message.value as string
        );
        break;

      // Task 6.2: Per-agent memory configuration
      case 'updateAgentMemory':
        this._step5Handler?.handleUpdateAgentMemory(
          message.agentId as string,
          message.field as string,
          message.value as boolean | string
        );
        this.saveState();
        break;

      case 'addAgentTool':
        this._step5Handler?.handleAddAgentTool(
          message.agentId as string,
          message.value as string
        );
        break;

      case 'removeAgentTool':
        this._step5Handler?.handleRemoveAgentTool(
          message.agentId as string,
          message.index as number
        );
        break;

      // Agent add/remove commands
      case 'addAgent':
        this._step5Handler?.handleAddAgent();
        break;

      case 'removeAgent':
        this.handleRemoveAgentWithConfirmation(message.agentId as string);
        break;

      // Handle confirmation response for agent removal
      case 'confirmRemoveAgent':
        this._step5Handler?.handleRemoveAgent(message.agentId as string);
        break;

      // Orchestration commands
      case 'updateOrchestration':
        if (this._step5Handler) {
          const pattern = message.value as OrchestrationPattern;
          this._step5Handler.handleUpdateOrchestration(pattern);
          // Trigger AI edge suggestion for the new pattern
          this.triggerEdgeSuggestionForPattern(pattern);
        }
        break;

      // Edge commands
      case 'addEdge':
        this._step5Handler?.handleAddEdge();
        break;

      case 'removeEdge':
        this._step5Handler?.handleRemoveEdge(message.index as number);
        break;

      case 'updateEdge':
        this._step5Handler?.handleUpdateEdge(
          message.index as number,
          message.field as 'from' | 'to',
          message.value as string
        );
        break;

      // Edge suggestion commands
      case 'applyEdgeSuggestion':
        this._step5Handler?.handleApplyEdgeSuggestion();
        break;

      case 'dismissEdgeSuggestion':
        this._step5Handler?.handleDismissEdgeSuggestion();
        break;

      // Confirmation command
      case 'confirmDesign':
        if (this._step5Handler) {
          const success = this._step5Handler.handleConfirmDesign();
          if (success) {
            this._ideationState.currentStep = Math.min(this._ideationState.currentStep + 1, WIZARD_STEPS.length);
            this._ideationState.highestStepReached = Math.max(this._ideationState.highestStepReached, this._ideationState.currentStep);
            // Task 6.4: Trigger auto-send for Step 6 when entering via Confirm Design
            if (this._ideationState.currentStep === 6) {
              this._step6Handler?.triggerAutoSend(this.getStep6Inputs());
            }
            this.updateWebviewContent();
            this.syncStateToWebview();
          }
        }
        break;

      // =========================================================================
      // Step 6: Mock Data Strategy commands (Task Group 6)
      // Task 6.3: Handle Step 6 commands
      // =========================================================================

      case 'step6UpdateRequest':
        this._step6Handler?.handleUpdateMockRequest(
          message.toolIndex as number,
          message.value as string
        );
        break;

      case 'step6UpdateResponse':
        this._step6Handler?.handleUpdateMockResponse(
          message.toolIndex as number,
          message.value as string
        );
        break;

      case 'step6AddRow':
        this._step6Handler?.handleAddSampleRow(message.toolIndex as number);
        break;

      case 'step6UpdateRow':
        this.handleStep6UpdateRow(message);
        break;

      case 'step6DeleteRow':
        this._step6Handler?.handleDeleteSampleRow(
          message.toolIndex as number,
          message.rowIndex as number
        );
        break;

      case 'step6ToggleAccordion':
        this._step6Handler?.handleToggleAccordion(message.toolIndex as number);
        break;

      case 'step6RegenerateAll':
        this._step6Handler?.handleRegenerateAll(this.getStep6Inputs());
        break;

      case 'step6ImportData':
        this.handleStep6ImportData(message.toolIndex as number);
        break;

      case 'step6ToggleTerminology':
        this._step6Handler?.handleToggleTerminology(
          message.enabled as boolean,
          this.getStep6Inputs()
        );
        break;

      // =========================================================================
      // Step 7: Demo Strategy commands (Task Group 4)
      // Task 4.10: Handle Step 7 commands
      // =========================================================================

      // Aha Moments commands
      case 'step7AddMoment':
        this._step7Handler?.handleAddMoment();
        this.saveState();
        break;

      case 'step7UpdateMoment':
        this._step7Handler?.handleUpdateMoment(
          message.index as number,
          message.field as 'title' | 'triggerType' | 'triggerName' | 'talkingPoint',
          message.value as string
        );
        this.saveState();
        break;

      case 'step7RemoveMoment':
        this._step7Handler?.handleRemoveMoment(message.index as number);
        this.saveState();
        break;

      // Demo Persona commands
      case 'step7UpdatePersonaName':
        this._step7Handler?.handleUpdatePersonaName(message.value as string);
        this.saveState();
        break;

      case 'step7UpdatePersonaRole':
        this._step7Handler?.handleUpdatePersonaRole(message.value as string);
        this.saveState();
        break;

      case 'step7UpdatePersonaPainPoint':
        this._step7Handler?.handleUpdatePersonaPainPoint(message.value as string);
        this.saveState();
        break;

      // Narrative Flow commands
      case 'step7AddScene':
        this._step7Handler?.handleAddScene();
        this.saveState();
        break;

      case 'step7UpdateScene':
        this._step7Handler?.handleUpdateScene(
          message.index as number,
          message.field as 'title' | 'description' | 'highlightedAgents',
          message.value as string | string[]
        );
        this.saveState();
        break;

      case 'step7RemoveScene':
        this._step7Handler?.handleRemoveScene(message.index as number);
        this.saveState();
        break;

      case 'step7MoveSceneUp':
        this._step7Handler?.handleMoveSceneUp(message.index as number);
        this.saveState();
        break;

      case 'step7MoveSceneDown':
        this._step7Handler?.handleMoveSceneDown(message.index as number);
        this.saveState();
        break;

      // Highlighted agents toggle for scenes
      case 'step7ToggleHighlightedAgent':
        this._step7Handler?.handleToggleHighlightedAgent(
          message.sceneIndex as number,
          message.agentId as string
        );
        this.saveState();
        break;

      // AI Generation commands
      case 'step7GenerateMoments':
        this._step7Handler?.handleGenerateMoments(this.getStep7Inputs());
        break;

      case 'step7GeneratePersona':
        this._step7Handler?.handleGeneratePersona(this.getStep7Inputs());
        break;

      case 'step7GenerateNarrative':
        this._step7Handler?.handleGenerateNarrative(this.getStep7Inputs());
        break;

      case 'step7GenerateAll':
        this._step7Handler?.handleGenerateAll(this.getStep7Inputs());
        break;

      // =========================================================================
      // Step 8: Generate Steering Files commands (Task Group 6)
      // Task 6.7: Handle Step 8 commands
      // =========================================================================

      case 'step8Generate':
        this._step8Handler?.handleGenerate(this.getStep8Inputs());
        break;

      case 'step8GenerateAndOpenKiro':
        this._step8Handler?.handleGenerateAndOpenKiro(this.getStep8Inputs());
        break;

      case 'step8StartOver':
        this._step8Handler?.handleStartOver();
        break;

      case 'step8OpenFile':
        this._step8Handler?.handleOpenFile(message.filePath as string);
        break;

      case 'step8Retry':
        this._step8Handler?.handleRetry(this.getStep8Inputs());
        break;

      case 'step8ToggleAccordion':
        this._step8Handler?.handleToggleAccordion();
        break;

      case 'step8EditStep':
        // Navigate to the specified step for editing
        this.ideationNavigateToStep(message.step as number);
        break;

      // Phase 2: Roadmap Generation commands
      case 'step8GenerateRoadmap':
        this._step8Handler?.handleGenerateRoadmap();
        break;

      case 'step8OpenRoadmap':
        this._step8Handler?.handleOpenRoadmap();
        break;

      case 'step8OpenKiroFolder':
        this._step8Handler?.handleOpenKiroFolder();
        break;

      // Phase 2: Policy Generation commands
      case 'step8GeneratePolicies':
        this._step8Handler?.handleGeneratePolicies();
        break;

      // Phase 4: Demo Generation commands
      case 'step8GenerateDemo':
        this._step8Handler?.handleGenerateDemo();
        break;

      case 'step8OpenDemo':
        this._step8Handler?.handleOpenDemo();
        break;

      // Legacy command for backward compatibility
      case 'generateSteeringFiles':
        this.handleGenerateSteeringFiles();
        break;

      // =========================================================================
      // Resume Banner commands (Task Group 6)
      // =========================================================================

      case 'resumeSession':
        // Task 6.6: Implement resumeSession message handler
        this.handleResumeSession();
        break;

      case 'startFresh':
        // Task 6.7: Implement startFresh message handler
        this.handleStartFresh();
        break;

      case 'dismissResumeBanner':
        // Dismiss banner without action
        this._resumeBannerState.visible = false;
        this.updateWebviewContent();
        this.syncStateToWebview();
        break;
    }
  }

  /**
   * Handle Demo Viewer messages
   * Task Group 4: Updated to handle chat UI messages
   */
  private handleDemoMessage(message: { command: string; [key: string]: unknown }): void {
    const { command } = message;

    switch (command) {
      case 'initializeProject':
        vscode.commands.executeCommand('agentify.initializeProject');
        break;

      // Legacy workflow commands (kept for backward compatibility)
      case 'runWorkflow':
        this._demoState.promptText = message.prompt as string;
        vscode.commands.executeCommand('agentify.runWorkflow', { prompt: this._demoState.promptText });
        break;
      case 'updatePrompt':
        this._demoState.promptText = message.value as string;
        this.syncStateToWebview();
        break;

      // =========================================================================
      // Demo Viewer Chat UI Commands (Task Group 4)
      // =========================================================================

      case 'sendMessage':
        // Button-only submission handler (no Enter key for demo safety)
        this._chatHandler?.handleSendMessage(message.content as string);
        break;

      case 'newConversation':
        // Reset chat state for new conversation
        this._chatHandler?.handleNewConversation();
        break;
    }
  }

  // =========================================================================
  // Task 6.3: Step 6 Helper Methods
  // =========================================================================

  /**
   * Handle step6UpdateRow command
   * Parses the row data from field/value updates and calls the handler
   */
  private handleStep6UpdateRow(message: { [key: string]: unknown }): void {
    const toolIndex = message.toolIndex as number;
    const rowIndex = message.rowIndex as number;
    const fieldName = message.field as string;
    const value = message.value as string;

    // Get current row data
    const definition = this._ideationState.mockData.mockDefinitions[toolIndex];
    if (!definition || rowIndex >= definition.sampleData.length) {
      return;
    }

    // Update the specific field in the row
    const currentRow = { ...(definition.sampleData[rowIndex] as Record<string, unknown>) };

    // Try to parse as number if the schema expects a number
    const schemaType = typeof (definition.mockResponse as Record<string, unknown>)[fieldName];
    if (schemaType === 'number') {
      const numValue = parseFloat(value);
      currentRow[fieldName] = isNaN(numValue) ? value : numValue;
    } else {
      currentRow[fieldName] = value;
    }

    this._step6Handler?.handleUpdateSampleRow(toolIndex, rowIndex, currentRow);
  }

  /**
   * Handle step6ImportData command
   * Opens file picker and processes imported data for a specific tool
   */
  private async handleStep6ImportData(toolIndex: number): Promise<void> {
    const definition = this._ideationState.mockData.mockDefinitions[toolIndex];
    if (!definition) {
      return;
    }

    // Open file picker for CSV/JSON files
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: {
        'Data Files': ['csv', 'json'],
      },
      title: `Import Sample Data for ${definition.tool}`,
    });

    if (!uris || uris.length === 0) {
      return;
    }

    try {
      // Read the file content
      const fileUri = uris[0];
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      const content = Buffer.from(fileContent).toString('utf-8');
      const fileName = fileUri.fsPath.split('/').pop() || fileUri.fsPath.split('\\').pop() || 'file';
      const fileSizeBytes = fileContent.byteLength;

      // Import the processImportedFile utility
      const { processImportedFile } = await import('../utils/mockDataImportUtils');

      // Process the imported file
      const result = processImportedFile(
        content,
        fileName,
        fileSizeBytes,
        definition.mockResponse
      );

      if (result.success && result.rows.length > 0) {
        // Update sample data for this tool
        definition.sampleData = result.rows;
        definition.sampleDataEdited = true;

        // Store import summary for display (extend the definition temporarily)
        (definition as typeof definition & { importSummary?: string }).importSummary = result.summary;

        this.updateWebviewContent();
        this.syncStateToWebview();

        // Show success message
        vscode.window.showInformationMessage(result.summary);
      } else if (result.error) {
        vscode.window.showErrorMessage(`Import failed: ${result.error}`);
      } else {
        vscode.window.showWarningMessage('No data found in file');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Failed to import file: ${errorMessage}`);
    }
  }

  // =========================================================================
  // Task 3.3: Agent Removal Confirmation Dialog Handling
  // =========================================================================

  /**
   * Handle agent removal with confirmation if agent has edges
   * Task 3.3: Shows confirmation dialog before removing agent with connections
   */
  private async handleRemoveAgentWithConfirmation(agentId: string): Promise<void> {
    if (!this._step5Handler) return;

    // Check if agent has edges
    const edgeCount = this._step5Handler.getAgentEdgeCount(agentId);

    if (edgeCount > 0) {
      // Agent has edges - show confirmation dialog
      const confirmMessage = `This agent has ${edgeCount} connection${edgeCount > 1 ? 's' : ''} that will be removed. Continue?`;

      const result = await vscode.window.showWarningMessage(
        confirmMessage,
        { modal: true },
        'Continue',
        'Cancel'
      );

      if (result === 'Continue') {
        this._step5Handler.handleRemoveAgent(agentId);
      }
    } else {
      // No edges - remove directly
      this._step5Handler.handleRemoveAgent(agentId);
    }
  }

  // =========================================================================
  // Task 3.4: Wire Orchestration Change to AI Edge Suggestion
  // =========================================================================

  /**
   * Trigger AI edge suggestion when orchestration pattern changes
   * Task 3.4: Calls AI service to suggest edges for the new pattern
   */
  private async triggerEdgeSuggestionForPattern(pattern: OrchestrationPattern): Promise<void> {
    if (!this._step5Handler || !this._context) return;

    const state = this._step5Handler.getState();

    // Only suggest edges if we have agents
    if (state.proposedAgents.length < 2) return;

    // Get the AgentDesignService and request edge suggestions
    try {
      const { getAgentDesignService } = await import('../services/agentDesignService');
      const service = getAgentDesignService(this._context);

      // Call the edge suggestion method
      const suggestedEdges = await service.suggestEdgesForPattern(
        state.proposedAgents,
        pattern
      );

      if (suggestedEdges && suggestedEdges.length > 0) {
        // Store the suggestion in state (non-blocking)
        state.edgeSuggestion = {
          edges: suggestedEdges,
          visible: true,
        };
        this.updateWebviewContent();
        this.syncStateToWebview();
      }
    } catch (error) {
      // Edge suggestion is non-blocking - log error but don't show to user
      console.warn('[TabbedPanel] Edge suggestion failed:', error);
    }
  }

  /**
   * Get Step 1 inputs for Step 2
   */
  private getStep1Inputs() {
    return {
      businessObjective: this._ideationState.businessObjective,
      industry: this._ideationState.industry,
      systems: this._ideationState.systems,
      customSystems: this._ideationState.customSystems,
    };
  }

  /**
   * Get Steps 1-2 inputs for Step 3
   */
  private getStep1And2Inputs() {
    return {
      businessObjective: this._ideationState.businessObjective,
      industry: this._ideationState.industry,
      customIndustry: this._ideationState.customIndustry,
      systems: this._ideationState.systems,
      customSystems: this._ideationState.customSystems,
      confirmedAssumptions: this._ideationState.aiGapFillingState.confirmedAssumptions,
    };
  }

  /**
   * Get Steps 1-4 inputs for Step 5
   */
  private getStep5Inputs() {
    return {
      businessObjective: this._ideationState.businessObjective,
      industry: this._ideationState.industry,
      customIndustry: this._ideationState.customIndustry,
      systems: this._ideationState.systems,
      customSystems: this._ideationState.customSystems,
      confirmedAssumptions: this._ideationState.aiGapFillingState.confirmedAssumptions,
      primaryOutcome: this._ideationState.outcome.primaryOutcome,
      successMetrics: this._ideationState.outcome.successMetrics,
      dataSensitivity: this._ideationState.securityGuardrails.dataSensitivity,
      complianceFrameworks: this._ideationState.securityGuardrails.complianceFrameworks,
      approvalGates: this._ideationState.securityGuardrails.approvalGates,
    };
  }

  /**
   * Get Step 5 confirmed agents and industry for Step 6
   * Task 6.4: Get inputs for Step 6 auto-send
   */
  private getStep6Inputs() {
    return {
      confirmedAgents: this._ideationState.agentDesign.confirmedAgents,
      industry: this._ideationState.industry === 'Other'
        ? (this._ideationState.customIndustry || this._ideationState.industry)
        : this._ideationState.industry,
    };
  }

  /**
   * Get inputs for Step 7 AI generation
   * Task 4.10: Get inputs for Step 7 AI calls
   */
  private getStep7Inputs() {
    return {
      industry: this._ideationState.industry === 'Other'
        ? (this._ideationState.customIndustry || this._ideationState.industry)
        : this._ideationState.industry,
      businessObjective: this._ideationState.businessObjective,
      confirmedAgents: this._ideationState.agentDesign.confirmedAgents,
      outcomeDefinition: this._ideationState.outcome.primaryOutcome,
      confirmedEdges: this._ideationState.agentDesign.confirmedEdges,
    };
  }

  /**
   * Get inputs for Step 8 steering file generation
   * Task 6.7: Get inputs for Step 8 generation
   */
  private getStep8Inputs(): Step8ContextInputs {
    return {
      businessObjective: this._ideationState.businessObjective,
      industry: this._ideationState.industry === 'Other'
        ? (this._ideationState.customIndustry || this._ideationState.industry)
        : this._ideationState.industry,
      systems: this._ideationState.systems,
      aiGapFillingState: this._ideationState.aiGapFillingState,
      outcome: this._ideationState.outcome,
      security: {
        dataSensitivity: this._ideationState.securityGuardrails.dataSensitivity as 'public' | 'internal' | 'confidential' | 'restricted',
        complianceFrameworks: this._ideationState.securityGuardrails.complianceFrameworks,
        approvalGates: this._ideationState.securityGuardrails.approvalGates,
        guardrailNotes: this._ideationState.securityGuardrails.guardrailNotes,
        skipped: this._ideationState.securityGuardrails.skipped,
        // Cross-Agent Memory Feature: Include memory settings in steering context
        crossAgentMemoryEnabled: this._ideationState.securityGuardrails.crossAgentMemoryEnabled,
        memoryExpiryDays: this._ideationState.securityGuardrails.memoryExpiryDays,
        // Persistent Session Memory Feature: Include LTM settings in steering context
        longTermMemoryEnabled: this._ideationState.securityGuardrails.longTermMemoryEnabled,
        ltmRetentionDays: this._ideationState.securityGuardrails.ltmRetentionDays,
        ltmStrategy: this._ideationState.securityGuardrails.ltmStrategy,
      },
      agentDesign: this._ideationState.agentDesign,
      mockData: this._ideationState.mockData,
      demoStrategy: this._ideationState.demoStrategy,
    };
  }

  /**
   * Validate Ideation Step 1
   */
  private validateIdeationStep1(): void {
    const errors: IdeationValidationError[] = [];

    if (!this._ideationState.businessObjective.trim()) {
      errors.push({ type: 'businessObjective', message: 'Business objective is required', severity: 'error' });
    }

    if (!this._ideationState.industry) {
      errors.push({ type: 'industry', message: 'Please select an industry', severity: 'error' });
    }

    if (this._ideationState.systems.length === 0) {
      errors.push({ type: 'systems', message: 'Consider selecting systems your workflow will integrate with', severity: 'warning' });
    }

    if (this._ideationState.uploadedFile && this._ideationState.uploadedFile.size > 5 * 1024 * 1024) {
      errors.push({ type: 'file', message: 'File size exceeds 5MB limit', severity: 'error' });
    }

    const blockingErrors = errors.filter(e => e.severity === 'error');
    this._ideationValidation = {
      isValid: blockingErrors.length === 0,
      errors,
      hasWarnings: errors.some(e => e.severity === 'warning'),
    };
  }

  /**
   * Navigate forward in wizard
   * Task 6.5: Made async for immediate save before navigation
   */
  private async ideationNavigateForward(): Promise<void> {
    this._ideationState.validationAttempted = true;
    this.validateIdeationStep1();

    if (!this._ideationValidation.isValid) {
      this.syncStateToWebview();
      return;
    }

    // Task 6.5: Immediate save before navigation
    await this.saveStateImmediate();

    const previousStep = this._ideationState.currentStep;

    if (this._ideationState.currentStep < WIZARD_STEPS.length) {
      this._ideationState.currentStep++;
      this._ideationState.highestStepReached = Math.max(
        this._ideationState.highestStepReached,
        this._ideationState.currentStep
      );
      this._ideationState.validationAttempted = false;
      this.updateWebviewContent();
      this.syncStateToWebview();

      // Auto-send context to Claude when entering Step 2
      if (previousStep === 1 && this._ideationState.currentStep === 2) {
        this._step2Handler?.triggerAutoSend(this.getStep1Inputs());
      }

      // Auto-send context to Claude when entering Step 3
      if (previousStep === 2 && this._ideationState.currentStep === 3) {
        this._step3Handler?.triggerAutoSend(this.getStep1And2Inputs());
      }

      // Apply industry defaults and trigger AI suggestions when entering Step 4
      if (this._ideationState.currentStep === 4) {
        this._step4Handler?.applyIndustryDefaults(
          this._ideationState.industry,
          this._ideationState.customIndustry
        );
        this._step4Handler?.triggerAutoSend(
          {
            businessObjective: this._ideationState.businessObjective,
            industry: this._ideationState.industry,
            customIndustry: this._ideationState.customIndustry,
            systems: this._ideationState.systems,
            confirmedAssumptions: this._ideationState.aiGapFillingState.confirmedAssumptions,
          },
          this._step3Handler?.getService()
        );
      }

      // Auto-send context to Claude when entering Step 5
      if (previousStep === 4 && this._ideationState.currentStep === 5) {
        this._step5Handler?.triggerAutoSend(this.getStep5Inputs());
      }

      // Task 6.4: Auto-send context to Claude when entering Step 6
      if (previousStep === 5 && this._ideationState.currentStep === 6) {
        this._step6Handler?.triggerAutoSend(this.getStep6Inputs());
      }

      // Note: Step 7 does NOT auto-trigger AI on entry (manual Generate buttons only)

      // Task 6.7: Update Step 8 canGenerate when entering Step 8
      if (this._ideationState.currentStep === 8) {
        this.updateStep8CanGenerate();
      }
    }
  }

  /**
   * Navigate backward in wizard
   * Task 6.5: Made async for immediate save before navigation
   */
  private async ideationNavigateBackward(): Promise<void> {
    if (this._ideationState.currentStep > 1) {
      // Task 6.5: Immediate save before navigation
      await this.saveStateImmediate();

      // Task 2.5b: Handle back navigation from Step 6 to Step 5
      if (this._ideationState.currentStep === 6) {
        this._step5Handler?.handleBackNavigationToStep5();
      }

      // Task 6.5: Handle back navigation from Step 7 to Step 6
      if (this._ideationState.currentStep === 7) {
        this._step6Handler?.handleBackNavigationToStep6();
      }

      // Task 4.10: Handle back navigation from Step 8 to Step 7
      if (this._ideationState.currentStep === 8) {
        this._step7Handler?.handleBackNavigationToStep7();
      }

      this._ideationState.currentStep--;
      this._ideationState.validationAttempted = false;
      this.updateWebviewContent();
      this.syncStateToWebview();
    }
  }

  /**
   * Navigate to specific step
   * Task 6.5: Made async for immediate save before navigation
   */
  private async ideationNavigateToStep(step: number): Promise<void> {
    if (step >= 1 && step <= this._ideationState.highestStepReached && step !== this._ideationState.currentStep) {
      // Task 6.5: Immediate save before navigation
      await this.saveStateImmediate();

      // Task 2.5b: Handle back navigation from Step 6 to Step 5
      if (this._ideationState.currentStep === 6 && step === 5) {
        this._step5Handler?.handleBackNavigationToStep5();
      }

      // Task 6.5: Handle back navigation from Step 7 to Step 6
      if (this._ideationState.currentStep === 7 && step === 6) {
        this._step6Handler?.handleBackNavigationToStep6();
      }

      // Task 4.10: Handle back navigation from Step 8 to Step 7
      if (this._ideationState.currentStep === 8 && step === 7) {
        this._step7Handler?.handleBackNavigationToStep7();
      }

      this._ideationState.currentStep = step;
      this._ideationState.validationAttempted = false;
      this.updateWebviewContent();
      this.syncStateToWebview();
    }
  }

  /**
   * Update Step 8 canGenerate flag based on validation status
   * Task 6.7: Calculate canGenerate from step summaries
   */
  private async updateStep8CanGenerate(): Promise<void> {
    if (!this._step8Handler) return;

    const summaries = this._step8Handler.getStepSummaries(this.getStep8Inputs());
    const hasError = summaries.some(s => s.validationStatus === 'error');
    this._ideationState.generation.canGenerate = !hasError;
    this._step8Handler.setState(this._ideationState.generation);

    // Check for existing steering files on disk (for resume scenarios)
    // This populates completedFiles and generatedFilePaths if files exist
    await this._step8Handler.checkExistingSteeringFiles();

    // Sync updated state BACK from Step8Logic to _ideationState.generation
    // This ensures HTML rendering sees the detected files
    this._ideationState.generation = this._step8Handler.getState();
  }

  /**
   * Update webview content
   */
  private updateWebviewContent(): void {
    if (this._view) {
      // Debug: Log chat state when updating demo viewer
      if (this._activeTab === 'demo' && this._chatHandler) {
        const chatState = this._chatHandler.getChatPanelState();
        console.log('[TabbedPanel] updateWebviewContent - chat state:', {
          pipelineStages: chatState.session.pipelineStages.length,
          messages: chatState.session.messages.length,
          isWorkflowRunning: chatState.ui.isWorkflowRunning,
          errorMessage: chatState.ui.errorMessage,
        });
      }
      this._view.webview.html = this.getHtmlContent();
    }
  }

  /**
   * Sync state to webview
   */
  private syncStateToWebview(): void {
    if (!this._view) return;

    this._view.webview.postMessage({
      type: 'stateSync',
      activeTab: this._activeTab,
      ideation: {
        state: this._ideationState,
        validation: this._ideationValidation,
        resumeBanner: this._resumeBannerState, // Task 6.6: Include resume banner state
      },
      demo: {
        state: this._demoState,
        // Task Group 4: Include chat state when in demo tab
        chat: this._chatHandler?.getChatPanelState(),
      },
    });
  }

  /**
   * Get full HTML content
   */
  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>Agentify</title>
  <style>
    ${this.getBaseStyles()}
    ${this.getTabStyles()}
    ${this._activeTab === 'ideation' ? getIdeationStyles() + getResumeBannerStyles() : this.getDemoStyles()}
  </style>
</head>
<body>
  ${this.getTabBarHtml()}
  <div class="tab-content">
    ${this._activeTab === 'ideation' ? getResumeBannerHtml(this._resumeBannerState) + getIdeationContentHtml(this._ideationState as unknown as StepHtmlIdeationState, this._ideationValidation as unknown as StepHtmlValidationState) : this.getDemoContentHtml()}
  </div>
  <script>
    const vscode = acquireVsCodeApi();

    function switchTab(tabId) {
      vscode.postMessage({ command: 'switchTab', tab: tabId });
    }

    // Task 6.6: Resume banner button handlers
    function resumeSession() {
      vscode.postMessage({ command: 'resumeSession' });
    }

    function startFresh() {
      vscode.postMessage({ command: 'startFresh' });
    }

    ${this._activeTab === 'ideation' ? getIdeationScript() : this.getDemoScript()}

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'stateSync') {
        handleStateSync(message);
      }
      if (message.type === 'streamingToken') {
        // Update the streaming message content in real-time
        const streamingText = document.querySelector('.streaming .streaming-text');
        const typingIndicator = document.querySelector('.streaming .typing-indicator');
        if (streamingText) {
          streamingText.textContent = message.content;
          // Hide typing indicator once we have content
          if (typingIndicator && message.content) {
            typingIndicator.style.display = 'none';
          }
          // Auto-scroll to bottom - handle dual-pane layout
          const paneContainers = document.querySelectorAll('.pane-messages');
          if (paneContainers.length > 0) {
            // Dual-pane: scroll the pane containing the streaming message
            if (message.pane) {
              const selector = message.pane === 'conversation' ? '.pane-left .pane-messages' : '.pane-right .pane-messages';
              const paneContainer = document.querySelector(selector);
              if (paneContainer) paneContainer.scrollTop = paneContainer.scrollHeight;
            } else {
              // Fallback: scroll all panes
              paneContainers.forEach(c => c.scrollTop = c.scrollHeight);
            }
          } else {
            // Legacy single container
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
          }
        }
      }
    });
  </script>
</body>
</html>`;
  }

  /**
   * Get base styles
   */
  private getBaseStyles(): string {
    return `
      * { box-sizing: border-box; }
      body {
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        background-color: var(--vscode-editor-background);
        margin: 0;
        padding: 0;
        height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .tab-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }
    `;
  }

  /**
   * Get tab bar styles
   */
  private getTabStyles(): string {
    return `
      .tab-bar {
        display: flex;
        border-bottom: 1px solid var(--vscode-panel-border);
        background: var(--vscode-editor-background);
        flex-shrink: 0;
      }
      .tab {
        padding: 10px 16px;
        cursor: pointer;
        border: none;
        background: transparent;
        color: var(--vscode-foreground);
        font-size: 13px;
        font-family: var(--vscode-font-family);
        opacity: 0.7;
        border-bottom: 2px solid transparent;
        transition: opacity 0.15s, border-color 0.15s;
      }
      .tab:hover {
        opacity: 1;
      }
      .tab.active {
        opacity: 1;
        border-bottom-color: var(--vscode-focusBorder);
        color: var(--vscode-foreground);
      }
    `;
  }

  /**
   * Get tab bar HTML
   */
  private getTabBarHtml(): string {
    const tabs = TABS.map(tab => `
      <button class="tab ${this._activeTab === tab.id ? 'active' : ''}" onclick="switchTab('${tab.id}')">
        ${tab.label}
      </button>
    `).join('');

    return `<div class="tab-bar">${tabs}</div>`;
  }


  /**
   * Get Demo styles
   * Task Group 4: Include chat UI styles when project is initialized
   */
  private getDemoStyles(): string {
    const baseStyles = `
      .demo-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .prompt-section label {
        display: block;
        font-size: 13px;
        font-weight: 500;
        margin-bottom: 6px;
      }
      .prompt-textarea {
        width: 100%;
        min-height: 100px;
        padding: 8px;
        font-size: 13px;
        font-family: var(--vscode-font-family);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: 4px;
        resize: vertical;
      }
      .prompt-textarea:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }
      .run-btn {
        width: 100%;
        padding: 10px;
        font-size: 14px;
        font-weight: 500;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .run-btn:hover {
        background: var(--vscode-button-hoverBackground);
      }
      .placeholder-panel {
        background: var(--vscode-input-background);
        border: 1px dashed var(--vscode-input-border);
        border-radius: 4px;
        padding: 24px;
        text-align: center;
        color: var(--vscode-descriptionForeground);
        font-size: 13px;
      }
      .get-started-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        text-align: center;
      }
      .get-started-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.7;
      }
      .get-started-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .get-started-desc {
        font-size: 13px;
        color: var(--vscode-descriptionForeground);
        margin-bottom: 24px;
        max-width: 280px;
      }
      .get-started-btn {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 10px 24px;
        font-size: 14px;
        font-weight: 500;
        border-radius: 4px;
        cursor: pointer;
      }
      .get-started-btn:hover {
        background: var(--vscode-button-hoverBackground);
      }
    `;

    // Include chat UI styles when project is initialized
    if (this._demoState.isProjectInitialized) {
      return baseStyles + getDemoViewerChatStyles();
    }

    return baseStyles;
  }


  /**
   * Get Demo content HTML
   * Task Group 4: Use chat UI when project is initialized
   */
  private getDemoContentHtml(): string {
    if (!this._demoState.isProjectInitialized) {
      return `
        <div class="get-started-container">
          <div class="get-started-icon">&#128640;</div>
          <div class="get-started-title">Welcome to Agentify</div>
          <div class="get-started-desc">Initialize your project to start observing AI agent workflows.</div>
          <button class="get-started-btn" onclick="initializeProject()">Get Started</button>
        </div>
      `;
    }

    // Task Group 4: Use chat panel HTML when project is initialized
    if (this._chatHandler) {
      return generateChatPanelHtml(this._chatHandler.getChatPanelState());
    }

    // Fallback to legacy UI if chat handler not available
    return `
      <div class="demo-container">
        <div class="prompt-section">
          <label>PROMPT</label>
          <textarea class="prompt-textarea"
            placeholder="Enter your prompt for the AI agent..."
            oninput="updatePrompt(this.value)"
          >${escapeHtml(this._demoState.promptText)}</textarea>
        </div>
        <button class="run-btn" onclick="runWorkflow()">
          &#9654; Run Workflow
        </button>
        <div class="placeholder-panel">
          AGENT GRAPH (COMING SOON)
        </div>
        <div class="placeholder-panel">
          EXECUTION LOG
        </div>
      </div>
    `;
  }


  /**
   * Get Demo script
   * Task Group 4: Include chat panel JS when project is initialized
   */
  private getDemoScript(): string {
    const baseScript = `
      function initializeProject() {
        vscode.postMessage({ command: 'initializeProject' });
      }
      function runWorkflow() {
        const prompt = document.querySelector('.prompt-textarea')?.value || '';
        vscode.postMessage({ command: 'runWorkflow', prompt });
      }
      function updatePrompt(value) {
        vscode.postMessage({ command: 'updatePrompt', value });
      }
      function handleStateSync(message) {
        // Update elapsed time from chat state
        if (message.demo && message.demo.chat && message.demo.chat.ui) {
          const elapsedMs = message.demo.chat.ui.elapsedTimeMs;
          const elapsedElement = document.getElementById('elapsed-time');
          if (elapsedElement && elapsedMs !== null && elapsedMs !== undefined) {
            const totalSeconds = elapsedMs / 1000;
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = Math.floor(totalSeconds % 60);
            const formatted = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
            elapsedElement.textContent = formatted;
          }
        }
      }
    `;

    // Include chat panel JS when project is initialized
    if (this._demoState.isProjectInitialized) {
      return baseScript + generateChatPanelJs();
    }

    return baseScript;
  }


  /**
   * Reset the wizard to default state
   * Task Group 7: Public method for the VS Code command
   */
  public async resetWizard(): Promise<void> {
    await this.handleStartFresh();
  }

  /**
   * Refresh the panel
   */
  public async refresh(): Promise<void> {
    await this.checkProjectInitialization();
    this.validateIdeationStep1();
    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Get active tab
   */
  public get activeTab(): TabId {
    return this._activeTab;
  }

  /**
   * Set active tab
   */
  public setActiveTab(tab: TabId): void {
    this._activeTab = tab;
    this.updateWebviewContent();
    this.syncStateToWebview();
  }

  /**
   * Dispose
   */
  public dispose(): void {
    this._configChangeDisposable?.dispose();
    this._step2Handler?.dispose();
    this._step3Handler?.dispose();
    this._step5Handler?.dispose();
    this._step6Handler?.dispose();
    // Task 4.10: Dispose Step 7 handler
    this._step7Handler?.dispose();
    // Task 6.7: Dispose Step 8 handler
    this._step8Handler?.dispose();
    // Task Group 4: Dispose chat handler
    this._chatHandler?.dispose();
    this._persistenceService?.dispose(); // Task 6.2: Clean up persistence service
  }
}

// ============================================
// Supporting Types and Constants
// ============================================

// Re-export types from step logic modules
export { SystemAssumption, ConversationMessage, AIGapFillingState };

interface IdeationState {
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
  // Task 6.2: Metadata for previously uploaded file (from resumed session)
  uploadedFileMetadata?: {
    fileName: string;
    fileSize: number;
    uploadedAt: number;
    requiresReupload: true;
  };
  aiGapFillingState: AIGapFillingState;
  outcome: OutcomeDefinitionState;
  securityGuardrails: SecurityGuardrailsState;
  agentDesign: AgentDesignState;
  mockData: MockDataState;
  // Task 3.2: Demo strategy state for Step 7
  demoStrategy: DemoStrategyState;
  // Task 6.7: Generation state for Step 8
  generation: GenerationState;
}

interface IdeationValidationError {
  type: string;
  message: string;
  severity: 'error' | 'warning';
}

interface IdeationValidationState {
  isValid: boolean;
  errors: IdeationValidationError[];
  hasWarnings: boolean;
}

interface DemoState {
  isProjectInitialized: boolean;
  promptText: string;
}

function createDefaultIdeationState(): IdeationState {
  return {
    currentStep: 1,
    highestStepReached: 1,
    validationAttempted: false,
    businessObjective: '',
    industry: '',
    systems: [],
    aiGapFillingState: createDefaultAIGapFillingState(),
    outcome: createDefaultOutcomeDefinitionState(),
    securityGuardrails: createDefaultSecurityGuardrailsState(),
    agentDesign: createDefaultAgentDesignState(),
    mockData: createDefaultMockDataState(),
    // Task 3.2: Initialize demo strategy
    demoStrategy: createDefaultDemoStrategyState(),
    // Task 6.7: Initialize generation state
    generation: createDefaultGenerationState(),
  };
}

function createDefaultDemoState(): DemoState {
  return {
    isProjectInitialized: false,
    promptText: '',
  };
}
