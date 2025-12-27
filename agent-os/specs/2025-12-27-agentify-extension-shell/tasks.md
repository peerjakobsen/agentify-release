# Task Breakdown: Agentify Extension Shell

## Overview
Total Tasks: 4 Task Groups with 27 sub-tasks

This spec establishes the foundational VS Code/Kiro IDE extension infrastructure including shared TypeScript types, AWS client services, Activity Bar view containers, status bar management, and stub command registration.

## Task List

### Foundation Layer

#### Task Group 1: Shared TypeScript Types
**Dependencies:** None

- [x] 1.0 Complete shared type definitions
  - [x] 1.1 Write 4-6 focused tests for type validation and error handling
    - Test `AgentifyError` class instantiation with error codes
    - Test type guard functions for event type discrimination
    - Test config type validation helpers
    - Test error code enum completeness
  - [x] 1.2 Create `src/types/errors.ts` with error types
    - Define `AgentifyErrorCode` enum extending existing `TableValidationErrorType` pattern
    - Include codes: `CREDENTIALS_NOT_CONFIGURED`, `TABLE_NOT_FOUND`, `TABLE_NOT_ACTIVE`, `ACCESS_DENIED`, `CONFIG_INVALID`, `CONFIG_NOT_FOUND`, `AWS_CONNECTION_ERROR`
    - Create `AgentifyError` class with `code`, `message`, and optional `cause` properties
    - Add type guards for error identification
  - [x] 1.3 Create `src/types/config.ts` with config schema types
    - Define `AgentifyConfig` interface with fields: `version: string`, `project: ProjectConfig`, `infrastructure: InfrastructureConfig`, `workflow: WorkflowConfig`
    - Define `ProjectConfig` interface with fields: `name: string`, `valueMap: string` (customer value map), `industry: string` (retail, fsi, healthcare, etc.)
    - Define `InfrastructureConfig` interface with nested `dynamodb` object containing: `tableName: string`, `tableArn: string`, `region: string`
    - Define `WorkflowConfig` interface with fields: `orchestrationPattern: 'graph' | 'swarm' | 'workflow'`, `triggerType: TriggerType`, `triggerConfig: TriggerConfig`, `agents: AgentDefinition[]`, `edges: EdgeDefinition[]`
    - Define `AgentDefinition` interface with fields: `id: string`, `name: string`, `role: string`
    - Define `EdgeDefinition` interface with fields: `from: string`, `to: string`
    - Add JSDoc documentation for each type
  - [x] 1.4 Create `src/types/triggers.ts` with trigger types
    - Define `TriggerType` union type: `'local' | 'agentcore' | 'http'`
    - Define `LocalTriggerConfig` interface with fields: `entryScript: string` (e.g., "agents/main.py"), `pythonPath: string` (e.g., ".venv/bin/python")
    - Define `AgentCoreTriggerConfig` interface with fields: `agentId: string` (Bedrock agent ARN), `aliasId: string` (Agent alias ID)
    - Define `HttpTriggerConfig` interface with fields: `endpoint: string` (Webhook URL), `method: string` (HTTP method, default "POST")
    - Define `TriggerConfig` discriminated union of all three config types
  - [x] 1.5 Create `src/types/events.ts` with event types
    - Define `BaseEvent` interface with common fields: `workflow_id: string`, `timestamp: number` (epoch milliseconds)
    - Define `EventSource` type: `'stdout' | 'dynamodb'`
    - Define stdout-specific event types (for local mode real-time streaming):
      - `GraphStructureEvent`: type "graph_structure", nodes array, edges array, entry_points array
      - `NodeStartEvent`: type "node_start", node_id
      - `NodeStopEvent`: type "node_stop", node_id, status, execution_time_ms
      - `NodeStreamEvent`: type "node_stream", node_id, data (token text)
      - `WorkflowCompleteEvent`: type "workflow_complete", status, execution_time_ms, execution_order array
    - Define DynamoDB-specific event types (for tool call tracking):
      - `ToolCallEvent`: event_type "tool_call", agent_name, system, operation, input/output, status
      - `AgentSpanEvent`: event_type "agent_start" | "agent_end", agent_name, role, duration_ms
    - Define `MergedEvent` wrapper with `source: EventSource` discriminator
    - Define `AgentifyEvent` discriminated union combining all event types
  - [x] 1.6 Create `src/types/graph.ts` with visualization types
    - Define `NodeStatus` type: `'pending' | 'running' | 'completed' | 'failed'`
    - Define `GraphNode` interface with fields: `id: string` (matches agent id), `name: string` (display name), `role: string` (agent role description), `status: NodeStatus`, `executionTimeMs?: number` (populated after completion)
    - Define `GraphEdge` interface with fields: `id: string` (unique edge identifier), `from: string` (source node id), `to: string` (target node id), `animated?: boolean` (true when data flowing)
    - Define `GraphData` interface containing: `nodes: GraphNode[]`, `edges: GraphEdge[]`, `entryPoints: string[]` (node ids that receive initial input)
  - [x] 1.7 Create `src/types/messages.ts` with webview message protocols
    - Define extension-to-webview messages:
      - `EventMessage`: delivers merged events to panel, includes `source: EventSource` field
      - `GraphUpdateMessage`: full graph state update
      - `StatusMessage`: workflow status change
      - `ConfigMessage`: config data for panel initialization
    - Define webview-to-extension messages:
      - `RunWorkflowMessage`: trigger workflow with prompt
      - `StopWorkflowMessage`: cancel running workflow
      - `CommandMessage`: request command execution
    - Define `WebviewMessage` discriminated union of all extension-to-webview messages
    - Define `PanelMessage` discriminated union of all webview-to-extension messages
  - [x] 1.8 Create `src/types/index.ts` barrel export
    - Export all types from a single entry point
    - Organize exports by category (config, events, errors, etc.)
  - [x] 1.9 Ensure type definition tests pass
    - Run ONLY the 4-6 tests written in 1.1
    - Verify TypeScript compilation succeeds with strict mode

**Acceptance Criteria:**
- All 4-6 tests from 1.1 pass
- Types compile without errors in strict mode
- Barrel export provides clean import paths
- JSDoc comments provide IntelliSense documentation

### Service Layer

#### Task Group 2: Core Services
**Dependencies:** Task Group 1

- [x] 2.0 Complete service implementations
  - [x] 2.1 Write 6-8 focused tests for service functionality
    - Test `ICredentialProvider` interface contract
    - Test `DefaultCredentialProvider` initialization
    - Test `ConfigService.isInitialized()` returns correct boolean
    - Test `ConfigService.getConfig()` returns typed config or null
    - Test `ConfigService.validateConfig()` returns validation result
    - Test DynamoDB client lazy initialization pattern
    - Test Bedrock client lazy initialization pattern
    - Test client reset functionality
  - [x] 2.2 Create `src/services/credentialProvider.ts`
    - Define `ICredentialProvider` interface with `getCredentials()` method
    - Implement `DefaultCredentialProvider` class using `fromNodeProviderChain()` from `@aws-sdk/credential-providers`
    - Add error handling that surfaces `CredentialsNotConfiguredError`
    - Export interface and default implementation
  - [x] 2.3 Create `src/services/configService.ts`
    - Implement `ConfigService` class managing `.agentify/config.json`
    - Implement `getConfig()` returning typed `AgentifyConfig | null`
    - Implement `isInitialized()` returning boolean
    - Implement `createConfig(config: AgentifyConfig)` for project initialization
    - Implement `updateConfig(partial: Partial<AgentifyConfig>)` for modifications
    - Implement `validateConfig()` returning `{ isValid: boolean; errors: string[] }`
    - Create `onConfigChanged` event emitter using `vscode.workspace.createFileSystemWatcher`
    - Follow existing `dynamoDbConfig.ts` patterns for file watching
  - [x] 2.4 Extend `src/services/dynamoDbClient.ts` with retry and credential provider
    - Add retry configuration: 3 retries with exponential backoff using AWS SDK retry strategy
    - Accept `ICredentialProvider` parameter (default to `DefaultCredentialProvider`)
    - Return typed `CredentialsNotConfiguredError` or `TableNotFoundError` on failures
    - Maintain existing lazy singleton pattern and `resetClients()` function
    - Keep backward compatibility with existing API
  - [x] 2.5 Create `src/services/bedrockClient.ts`
    - Follow same lazy singleton pattern as `dynamoDbClient.ts`
    - Configure `BedrockRuntimeClient` for Bedrock Runtime operations
    - Add 3 retries with exponential backoff
    - Accept `ICredentialProvider` interface
    - Implement `getBedrockClient()` function
    - Implement `resetBedrockClient()` for configuration changes
    - Return typed `CredentialsNotConfiguredError` on credential failures
  - [x] 2.6 Ensure service layer tests pass
    - Run ONLY the 6-8 tests written in 2.1
    - Verify services can be instantiated
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- All 6-8 tests from 2.1 pass
- Credential provider follows interface pattern for future Kiro integration
- Config service handles all CRUD operations
- AWS clients use lazy initialization with proper retry configuration
- Error types are properly surfaced from services

### Extension Infrastructure

#### Task Group 3: Extension Entry Point and UI Shell
**Dependencies:** Task Groups 1, 2

- [x] 3.0 Complete extension infrastructure
  - [x] 3.1 Write 4-6 focused tests for extension behavior
    - Test activation with config file present initializes services
    - Test activation without config file registers commands only
    - Test status bar state transitions
    - Test command registration
    - Test deactivation cleans up resources
  - [x] 3.2 Update `package.json` with contribution points
    - Add activation events: `onStartupFinished`, `workspaceContains:.agentify/config.json`, `onCommand:agentify.initializeProject`
    - Add `viewsContainers` contribution for Activity Bar with `agentify` container
    - Add `views` contribution with `agentify.demoViewer` and `agentify.ideationWizard`
    - Add command contributions for all four commands
    - Add icon reference for Activity Bar
    - Add new dependencies: `@aws-sdk/client-bedrock-runtime`, `@aws-sdk/credential-providers`
  - [x] 3.3 Create `src/panels/demoViewerPanel.ts` stub
    - Implement `DemoViewerPanelProvider` class implementing `vscode.WebviewViewProvider`
    - Implement `resolveWebviewView()` showing placeholder "Demo Viewer panel coming soon"
    - Export provider for registration in extension.ts
  - [x] 3.4 Create `src/panels/ideationWizardPanel.ts` stub
    - Implement `IdeationWizardPanelProvider` class implementing `vscode.WebviewViewProvider`
    - Implement `resolveWebviewView()` showing placeholder "Ideation Wizard panel coming soon"
    - Export provider for registration in extension.ts
  - [x] 3.5 Create `src/statusBar.ts` for status bar management
    - Create `StatusBarManager` class
    - Implement three states: "Not Initialized" (gray), "Ready" (green checkmark), "AWS Error" (yellow warning)
    - Use `vscode.StatusBarAlignment.Right` with priority 100
    - Implement click handler opening quick-pick menu with commands:
      - "Initialize Project" → runs `agentify.initializeProject`
      - "Open Demo Viewer" → runs `agentify.openDemoViewer`
      - "Open Ideation Wizard" → runs `agentify.openIdeationWizard`
      - "View AWS Connection Status" → runs `agentify.showStatus`
    - Implement `updateStatus(state: StatusState)` method
    - Implement `dispose()` for cleanup
  - [x] 3.6 Refactor `src/extension.ts` with hybrid activation
    - Import `ConfigService`, AWS clients, panel providers, `StatusBarManager`
    - Implement detection of `.agentify/config.json` using `vscode.workspace.findFiles`
    - Register commands immediately on any activation trigger
    - Initialize panels and AWS services only when config exists
    - Register stub command handlers
    - Update status bar based on config existence and AWS validation
    - Clean up all services in `deactivate()` function
    - Push all disposables to `context.subscriptions`
  - [x] 3.7 Register stub commands
    - `agentify.initializeProject`: Show info message "Initialize Project command coming soon"
    - `agentify.openDemoViewer`: Reveal Demo Viewer panel in sidebar
    - `agentify.openIdeationWizard`: Reveal Ideation Wizard panel in sidebar
    - `agentify.showStatus`: Open quick-pick status menu with available commands
  - [x] 3.8 Create Activity Bar icon asset
    - Create `resources/agentify-icon.svg` for Activity Bar
    - Follow VS Code icon guidelines (monochrome, 24x24)
  - [x] 3.9 Ensure extension infrastructure tests pass
    - Run ONLY the 4-6 tests written in 3.1
    - Verify extension activates without errors
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- All 4-6 tests from 3.1 pass
- Extension activates on all three trigger events
- Activity Bar shows Agentify container with both panels
- Status bar displays correct state based on project initialization
- All four commands are registered and accessible via Command Palette
- Clean disposal of all resources on deactivation

### Testing

#### Task Group 4: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-3

- [x] 4.0 Review existing tests and fill critical gaps only
  - [x] 4.1 Review tests from Task Groups 1-3
    - Review 4-6 tests from type definitions (Task 1.1)
    - Review 6-8 tests from services (Task 2.1)
    - Review 4-6 tests from extension infrastructure (Task 3.1)
    - Total existing tests: approximately 14-20 tests
  - [x] 4.2 Analyze test coverage gaps for this feature only
    - Identify critical integration paths lacking coverage
    - Focus on config-to-service initialization flow
    - Prioritize status bar state machine transitions
    - Check webview provider registration flow
  - [x] 4.3 Write up to 8 additional strategic tests maximum
    - Add integration test for full activation flow with config present
    - Add integration test for activation flow without config
    - Add test for config file change triggering re-initialization
    - Add test for AWS credential error handling flow
    - Add test for status bar click handler opening quick-pick
    - Focus on end-to-end workflows over unit test gaps
  - [x] 4.4 Run feature-specific tests only
    - Run ONLY tests related to this spec (tests from 1.1, 2.1, 3.1, and 4.3)
    - Expected total: approximately 22-28 tests maximum
    - Verify all critical workflows pass
    - Do NOT run the entire application test suite unless explicitly requested

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 22-28 tests total)
- Critical integration paths are covered
- No more than 8 additional tests added
- Extension activates and functions correctly in both initialized and uninitialized states

## Execution Order

Recommended implementation sequence:

1. **Task Group 1: Shared TypeScript Types**
   - Establishes type foundation used by all other layers
   - No external dependencies
   - Enables type-safe development throughout

2. **Task Group 2: Core Services**
   - Depends on types from Group 1
   - Credential provider and config service enable AWS client initialization
   - Services are consumed by extension infrastructure

3. **Task Group 3: Extension Entry Point and UI Shell**
   - Depends on types and services from Groups 1-2
   - Wires everything together into functional extension
   - Creates user-facing UI components

4. **Task Group 4: Test Review and Gap Analysis**
   - Depends on all prior groups being complete
   - Validates end-to-end functionality
   - Ensures quality before spec completion

## File Structure (Final)

```
src/
  extension.ts              # Refactored entry point with hybrid activation
  statusBar.ts              # Status bar management
  types/
    index.ts                # Barrel export
    config.ts               # Config schema types
    triggers.ts             # Trigger type definitions
    events.ts               # Event types for DynamoDB and stdout
    graph.ts                # Visualization types
    messages.ts             # Webview message protocols
    errors.ts               # Error class and codes
  services/
    configService.ts        # Config CRUD and file watching
    credentialProvider.ts   # Credential interface and default impl
    dynamoDbClient.ts       # Extended with retry and credential provider
    bedrockClient.ts        # New lazy singleton Bedrock client
    tableValidator.ts       # Existing (unchanged)
  panels/
    demoViewerPanel.ts      # Stub WebviewViewProvider
    ideationWizardPanel.ts  # Stub WebviewViewProvider
  config/
    dynamoDbConfig.ts       # Existing (unchanged)
  messages/
    tableErrors.ts          # Existing (unchanged)
  test/
    types.test.ts           # Type validation tests
    services.test.ts        # Service layer tests
    extension.test.ts       # Extension infrastructure tests
    integration.test.ts     # Integration tests (extended)
resources/
  agentify-icon.svg         # Activity Bar icon
```

## Dependencies Summary

| Task Group | Depends On | Produces |
|------------|------------|----------|
| Group 1: Types | None | Shared type definitions |
| Group 2: Services | Group 1 | Credential provider, config service, AWS clients |
| Group 3: Extension | Groups 1, 2 | Functioning extension shell |
| Group 4: Testing | Groups 1, 2, 3 | Validated, tested extension |

## Notes

- This spec establishes foundational patterns that subsequent specs will extend
- Panel implementations (React components) are out of scope - handled in separate specs
- DynamoDB polling logic, workflow execution, and AI features are explicitly out of scope
- The credential provider interface enables future Kiro AWS Explorer integration without code changes
- Status bar provides user feedback for extension state without requiring panel interaction
- The event types support dual-mode architecture:
  - **Local mode**: Real-time graph events via stdout streaming + tool events via DynamoDB
  - **AgentCore mode**: All events via DynamoDB polling
- The `MergedEvent` wrapper with `source` discriminator allows the Demo Viewer to handle both event sources uniformly while tracking their origin for UI purposes (e.g., stdout events update graph instantly, DynamoDB events populate tool call log)
