/**
 * Demo Viewer Chat Logic Handler
 * Integrates chat UI with WorkflowTriggerService and StdoutEventParser
 *
 * Follows patterns from ideationStep2Logic.ts for streaming token handling
 * and service integration.
 */

import * as vscode from 'vscode';
import {
  createInitialChatState,
  createInitialUiState,
  addUserMessage,
  addAgentMessage,
  appendToStreamingContent,
  finalizeAgentMessage,
  updatePipelineStage,
  setWorkflowStartTime,
  resetChatState,
  addErrorMessage,
  determineMessagePane,
  addHandoffMessage,
  matchToolEventsToMessages,
} from '../utils/chatStateUtils';
import type {
  ChatSessionState,
  ChatUiState,
  ChatPanelState,
} from '../types/chatPanel';
import {
  getWorkflowTriggerService,
  type ProcessState,
} from '../services/workflowTriggerService';
import {
  getStdoutEventParser,
  type StdoutEventParser,
} from '../services/stdoutEventParser';
import type { MergedEvent, StdoutEvent, NodeStreamEvent, NodeStartEvent, NodeStopEvent, GraphStructureEvent, WorkflowCompleteEvent, WorkflowErrorEvent, ToolCallEvent, DynamoDbEvent } from '../types/events';
import { isToolCallEvent } from '../types/events';
import { formatTime } from '../utils/timerFormatter';
import { getDynamoDbPollingService } from '../services/dynamoDbPollingService';

/**
 * Callbacks for updating the webview from chat logic
 */
export interface ChatLogicCallbacks {
  updateWebviewContent: () => void;
  syncStateToWebview: () => void;
  postStreamingToken: (content: string, pane?: string | null) => void;
}

/**
 * Chat logic handler for Demo Viewer
 * Manages chat state and coordinates with workflow services
 */
export class DemoViewerChatLogic implements vscode.Disposable {
  // -------------------------------------------------------------------------
  // Private State
  // -------------------------------------------------------------------------

  /** Current chat session state */
  private _sessionState: ChatSessionState;

  /** Current UI state */
  private _uiState: ChatUiState;

  /** Callbacks for webview updates */
  private _callbacks: ChatLogicCallbacks;

  /** Extension context */
  private _context?: vscode.ExtensionContext;

  /** Event subscriptions for cleanup */
  private _disposables: vscode.Disposable[] = [];

  /** Timer interval for elapsed time updates */
  private _timerInterval: ReturnType<typeof setInterval> | null = null;

  /** Reference to stdout event parser */
  private _stdoutParser: StdoutEventParser | null = null;

  /** Collected tool call events from DynamoDB polling */
  private _toolEvents: ToolCallEvent[] = [];

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  constructor(
    context: vscode.ExtensionContext | undefined,
    callbacks: ChatLogicCallbacks
  ) {
    this._context = context;
    this._callbacks = callbacks;
    this._sessionState = createInitialChatState();
    this._uiState = createInitialUiState();

    // Subscribe to workflow services
    this.subscribeToWorkflowEvents();
  }

  // -------------------------------------------------------------------------
  // Public State Accessors
  // -------------------------------------------------------------------------

  /**
   * Gets the current chat session state
   */
  public getSessionState(): ChatSessionState {
    return this._sessionState;
  }

  /**
   * Gets the current UI state
   */
  public getUiState(): ChatUiState {
    return this._uiState;
  }

  /**
   * Gets the combined chat panel state
   */
  public getChatPanelState(): ChatPanelState {
    return {
      session: this._sessionState,
      ui: this._uiState,
    };
  }

  /**
   * Gets the formatted elapsed time
   */
  public getFormattedElapsedTime(): string {
    return formatTime(this._uiState.elapsedTimeMs);
  }

  // -------------------------------------------------------------------------
  // Public Message Handlers
  // -------------------------------------------------------------------------

  /**
   * Handles sending a user message and starting workflow
   * Button-only trigger (no Enter key handling for demo safety)
   *
   * @param content - User message content
   */
  public async handleSendMessage(content: string): Promise<void> {
    if (!content.trim()) {
      return;
    }

    // Add user message to state
    this._sessionState = addUserMessage(this._sessionState, content);

    // Update UI state to show running
    this._uiState = {
      ...this._uiState,
      inputDisabled: true,
      isWorkflowRunning: true,
      errorMessage: null,
    };

    // Set workflow start time
    this._sessionState = setWorkflowStartTime(this._sessionState);

    // Start timer
    this.startTimer();

    // Update UI immediately to show user message
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    try {
      // Start workflow via WorkflowTriggerService
      const service = getWorkflowTriggerService();
      const { workflowId, traceId } = await service.start(content);

      // Update workflow ID in session state
      this._sessionState = {
        ...this._sessionState,
        workflowId,
      };

      console.log(`[DemoViewerChatLogic] Workflow started: ${workflowId}, trace: ${traceId}`);
    } catch (error) {
      // Handle workflow start error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.handleWorkflowError(errorMessage);
    }
  }

  /**
   * Handles starting a new conversation
   * Resets chat state and generates new IDs
   */
  public handleNewConversation(): void {
    // Stop any running timer
    this.stopTimer();

    // Stop any running DynamoDB polling from previous workflow
    const dynamoDbService = getDynamoDbPollingService();
    if (dynamoDbService) {
      dynamoDbService.stopPolling();
    }

    // Reset session state
    this._sessionState = resetChatState();

    // Reset UI state
    this._uiState = createInitialUiState();

    // Reset stdout parser for new workflow
    if (this._stdoutParser) {
      this._stdoutParser.reset();
    }

    // Reset tool events collection
    this._toolEvents = [];

    // Update UI
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  // -------------------------------------------------------------------------
  // Private Service Integration
  // -------------------------------------------------------------------------

  /**
   * Subscribes to WorkflowTriggerService and StdoutEventParser events
   */
  private subscribeToWorkflowEvents(): void {
    const workflowService = getWorkflowTriggerService();

    // Subscribe to process state changes
    const stateSubscription = workflowService.onProcessStateChange((state) => {
      this.handleProcessStateChange(state);
    });
    this._disposables.push(stateSubscription);

    // Subscribe to process exit
    const exitSubscription = workflowService.onProcessExit((info) => {
      this.handleProcessExit(info.code, info.signal);
    });
    this._disposables.push(exitSubscription);

    // Subscribe to stderr for error logging
    const stderrSubscription = workflowService.onStderr((data) => {
      console.error(`[DemoViewerChatLogic] Stderr: ${data}`);
    });
    this._disposables.push(stderrSubscription);

    // Subscribe to stdout event parser
    this._stdoutParser = getStdoutEventParser();
    const eventSubscription = this._stdoutParser.onEvent((mergedEvent) => {
      this.handleStdoutEvent(mergedEvent);
    });
    this._disposables.push(eventSubscription);

    // Subscribe to DynamoDB polling service for tool call events
    const dynamoDbService = getDynamoDbPollingService();
    if (dynamoDbService) {
      const toolEventSubscription = dynamoDbService.onEvent((event: DynamoDbEvent) => {
        this.handleDynamoDbEvent(event);
      });
      this._disposables.push(toolEventSubscription);
    }
  }

  /**
   * Handles DynamoDB events, filtering for tool call events
   * Collects tool events and matches them to messages
   */
  private handleDynamoDbEvent(event: DynamoDbEvent): void {
    if (isToolCallEvent(event)) {
      console.log(`[DemoViewerChatLogic] Tool event received: ${event.agent_name} - ${event.system}:${event.operation} (${event.status})`);

      // Add to tool events collection
      this._toolEvents.push(event);

      // Match tool events to messages and update state
      this._sessionState = {
        ...this._sessionState,
        messages: matchToolEventsToMessages(this._sessionState.messages, this._toolEvents),
      };

      // Update UI to show tool chips
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
    }
  }

  /**
   * Gets the event type from either 'type' or 'event_type' field
   * Python orchestrator emits 'event_type', TypeScript types use 'type'
   */
  private getEventType(event: StdoutEvent): string | undefined {
    if ('type' in event && typeof (event as { type?: string }).type === 'string') {
      return (event as { type: string }).type;
    }
    if ('event_type' in event && typeof (event as { event_type?: string }).event_type === 'string') {
      return (event as { event_type: string }).event_type;
    }
    return undefined;
  }

  /**
   * Handles stdout events from StdoutEventParser
   * Processes graph_structure, node_start, node_stop, node_stream events
   */
  private handleStdoutEvent(mergedEvent: MergedEvent<StdoutEvent>): void {
    const event = mergedEvent.event;
    const eventType = this.getEventType(event);

    console.log(`[DemoViewerChatLogic] Received stdout event: ${eventType}`, event);

    if (!eventType) {
      console.log('[DemoViewerChatLogic] No event type found, skipping');
      return;
    }

    switch (eventType) {
      case 'node_stream':
        this.handleNodeStreamEvent(event as NodeStreamEvent);
        break;
      case 'node_start':
        this.handleNodeStartEvent(event as NodeStartEvent);
        break;
      case 'node_stop':
        this.handleNodeStopEvent(event as NodeStopEvent);
        break;
      case 'graph_structure':
        this.handleGraphStructureEvent(event as GraphStructureEvent);
        break;
      case 'workflow_complete':
        this.handleWorkflowCompleteEvent(event as WorkflowCompleteEvent);
        break;
      case 'workflow_error':
        this.handleWorkflowErrorEvent(event as WorkflowErrorEvent);
        break;
    }
  }

  /**
   * Handles graph_structure event to set up pipeline stages
   * Python emits nodes in event.graph.nodes, TypeScript types expect event.nodes
   * Also extracts session_id and starts DynamoDB polling for tool events
   */
  private handleGraphStructureEvent(event: GraphStructureEvent): void {
    // Handle both Python format (graph.nodes) and TypeScript format (nodes)
    const eventAny = event as unknown as {
      graph?: { nodes: Array<{ id?: string; name: string }> };
      session_id?: string;
    };
    const nodes = event.nodes || eventAny.graph?.nodes || [];

    console.log('[DemoViewerChatLogic] Graph structure nodes:', nodes);

    // Extract session_id and start DynamoDB polling
    // Python uses session_id as the DynamoDB partition key (workflow_id in DynamoDB)
    const sessionId = eventAny.session_id;
    if (sessionId) {
      console.log(`[DemoViewerChatLogic] Starting DynamoDB polling with session_id: ${sessionId}`);
      const dynamoDbService = getDynamoDbPollingService();
      if (dynamoDbService) {
        dynamoDbService.startPolling(sessionId);
      }
    } else {
      console.warn('[DemoViewerChatLogic] No session_id in graph_structure event, tool events will not be polled');
    }

    // Add all nodes as pending pipeline stages
    // Use node.name if available, fallback to node.id
    for (const node of nodes) {
      const nodeAny = node as { id?: string; name?: string };
      const displayName = nodeAny.name || nodeAny.id || 'Unknown';
      console.log(`[DemoViewerChatLogic] Adding pipeline stage: ${displayName}`);
      this._sessionState = updatePipelineStage(this._sessionState, displayName, 'pending');
    }

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Handles node_start event
   * Creates new agent message bubble and updates pipeline status
   * Routes messages to correct pane based on from_agent field
   * Python provides both node_id and node_name - use node_name for display
   */
  private handleNodeStartEvent(event: NodeStartEvent): void {
    // Python emits node_name for display, node_id for identification
    const eventAny = event as unknown as { node_name?: string; from_agent?: string | null; handoff_prompt?: string };
    const agentName = eventAny.node_name || event.node_id;

    // Extract from_agent and handoff_prompt from event
    // Use event fields if available, otherwise check eventAny for Python format
    const fromAgent = event.from_agent !== undefined ? event.from_agent : (eventAny.from_agent ?? null);
    const handoffPrompt = event.handoff_prompt || eventAny.handoff_prompt || '';

    console.log(`[DemoViewerChatLogic] Node start: ${agentName}, from_agent: ${fromAgent}, pipeline stages:`, this._sessionState.pipelineStages);

    // If first node_start received, set entryAgentName
    if (this._sessionState.entryAgentName === null) {
      this._sessionState = {
        ...this._sessionState,
        entryAgentName: agentName,
      };
      console.log(`[DemoViewerChatLogic] Set entry agent: ${agentName}`);
    }

    // If from_agent is not null, add handoff message to collaboration pane
    if (fromAgent !== null && handoffPrompt) {
      this._sessionState = addHandoffMessage(this._sessionState, fromAgent, handoffPrompt);
      console.log(`[DemoViewerChatLogic] Added handoff message from ${fromAgent}`);
    }

    // Determine pane based on from_agent
    const pane = determineMessagePane(fromAgent);

    // Update pipeline stage to active
    this._sessionState = updatePipelineStage(this._sessionState, agentName, 'active');

    // Create new agent message bubble in the correct pane
    this._sessionState = addAgentMessage(this._sessionState, agentName, pane);

    console.log(`[DemoViewerChatLogic] After node start, messages: ${this._sessionState.messages.length}, pane: ${pane}`);

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Handles node_stop event
   * Finalizes agent message and updates pipeline status
   * Streaming content routes to the same pane as the corresponding node_start
   * Python provides both node_id and node_name - use node_name for display
   * Python also sends the full response in node_stop (not via streaming)
   */
  private handleNodeStopEvent(event: NodeStopEvent): void {
    // Python emits node_name for display, node_id for identification
    const eventAny = event as unknown as { node_name?: string; response?: string };
    const agentName = eventAny.node_name || event.node_id;

    // Extract response from event (Python sends full response in node_stop)
    const response = eventAny.response || '';

    console.log(`[DemoViewerChatLogic] Node stop: ${agentName}, response length: ${response.length}, activePane: ${this._sessionState.activeMessagePane}`);

    // If we have a response and no streaming content, set it directly
    if (response && !this._sessionState.streamingContent) {
      this._sessionState = appendToStreamingContent(this._sessionState, response);
    }

    // Finalize the current streaming message
    // The message retains its pane assignment from node_start
    this._sessionState = finalizeAgentMessage(this._sessionState);

    // Update pipeline stage based on status
    const status = event.status === 'completed' ? 'completed' : 'pending';
    this._sessionState = updatePipelineStage(this._sessionState, agentName, status);

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Handles node_stream event (streaming tokens)
   * Uses pattern from ideationStep2Logic.ts handleStreamingToken
   */
  private handleNodeStreamEvent(event: NodeStreamEvent): void {
    // Append token to streaming content
    this._sessionState = appendToStreamingContent(this._sessionState, event.data);

    // Post streaming token to webview for real-time update
    // Include activeMessagePane so the correct pane scrolls
    this._callbacks.postStreamingToken(
      this._sessionState.streamingContent,
      this._sessionState.activeMessagePane
    );
  }

  /**
   * Handles workflow_complete event
   */
  private handleWorkflowCompleteEvent(event: WorkflowCompleteEvent): void {
    // Finalize any pending streaming message
    if (this._sessionState.activeAgentName) {
      this._sessionState = finalizeAgentMessage(this._sessionState);
    }

    // Stop DynamoDB polling (workflow finished)
    const dynamoDbService = getDynamoDbPollingService();
    if (dynamoDbService) {
      dynamoDbService.stopPolling();
    }

    // Stop timer
    this.stopTimer();

    // Update UI state
    this._uiState = {
      ...this._uiState,
      inputDisabled: false,
      isWorkflowRunning: false,
    };

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    console.log(`[DemoViewerChatLogic] Workflow complete: ${event.status}, time: ${event.execution_time_ms}ms`);
  }

  /**
   * Handles workflow_error event
   * Python emits 'error' field, TypeScript type expects 'error_message'
   */
  private handleWorkflowErrorEvent(event: WorkflowErrorEvent): void {
    // Handle both 'error' and 'error_message' fields
    const eventAny = event as unknown as { error?: string };
    const errorMessage = event.error_message || eventAny.error || 'Unknown workflow error';
    this.handleWorkflowError(errorMessage);
  }

  /**
   * Handles process state changes
   */
  private handleProcessStateChange(state: ProcessState): void {
    console.log(`[DemoViewerChatLogic] Process state changed: ${state}`);

    if (state === 'failed' || state === 'killed') {
      this.handleWorkflowError(`Workflow process ${state}`);
    }
  }

  /**
   * Handles process exit
   */
  private handleProcessExit(code: number | null, signal: string | null): void {
    console.log(`[DemoViewerChatLogic] Process exited: code=${code}, signal=${signal}`);

    // Stop timer if still running
    this.stopTimer();

    // If non-zero exit code and no explicit error, show generic error
    if (code !== 0 && code !== null && !this._uiState.errorMessage) {
      this.handleWorkflowError(`Workflow exited with code ${code}`);
    } else if (!this._uiState.isWorkflowRunning) {
      // Normal completion, just update UI
      this._uiState = {
        ...this._uiState,
        inputDisabled: false,
        isWorkflowRunning: false,
      };

      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
    }
  }

  /**
   * Handles workflow errors
   */
  private handleWorkflowError(errorMessage: string): void {
    // Add error message to chat
    this._sessionState = addErrorMessage(this._sessionState, errorMessage);

    // Update UI state
    this._uiState = {
      ...this._uiState,
      inputDisabled: false,
      isWorkflowRunning: false,
      errorMessage,
    };

    // Stop timer
    this.stopTimer();

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  // -------------------------------------------------------------------------
  // Timer Management
  // -------------------------------------------------------------------------

  /**
   * Starts the elapsed time timer
   */
  private startTimer(): void {
    // Stop any existing timer
    this.stopTimer();

    // Update timer every second
    this._timerInterval = setInterval(() => {
      if (this._sessionState.startTime > 0) {
        this._uiState = {
          ...this._uiState,
          elapsedTimeMs: Date.now() - this._sessionState.startTime,
        };

        // Post timer update to webview
        this._callbacks.syncStateToWebview();
      }
    }, 1000);
  }

  /**
   * Stops the elapsed time timer
   */
  private stopTimer(): void {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  // -------------------------------------------------------------------------
  // Disposal
  // -------------------------------------------------------------------------

  /**
   * Disposes of all resources
   */
  public dispose(): void {
    // Stop timer
    this.stopTimer();

    // Dispose all subscriptions
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
    this._disposables = [];
  }
}
