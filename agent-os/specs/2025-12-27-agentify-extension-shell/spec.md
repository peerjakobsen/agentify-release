# Specification: Agentify Extension Shell

## Goal
Create the foundational VS Code/Kiro IDE extension infrastructure with shared services (AWS clients, config, types), Activity Bar view containers for two webview panels (Demo Viewer and Ideation Wizard), status bar management, and stub command registration.

## User Stories
- As a developer, I want the extension to auto-detect Agentify projects so that I can start using the tooling without manual configuration
- As a developer, I want to see the extension status in the status bar so that I know if the extension is properly connected to AWS

## Specific Requirements

**Hybrid Extension Activation**
- Register three activation events: `onStartupFinished`, `workspaceContains:.agentify/config.json`, `onCommand:agentify.initializeProject`
- Commands register immediately on any activation trigger
- Panels and AWS services only initialize when `.agentify/config.json` exists in workspace
- Use `vscode.workspace.findFiles` to detect config file presence on activation
- Dispose all services cleanly in `deactivate()` function

**Project Config Service**
- Service manages `.agentify/config.json` file with full CRUD operations
- Implement `getConfig()` returning typed `AgentifyConfig` or null if not initialized
- Implement `isInitialized()` returning boolean based on config file existence
- Implement `createConfig(config: AgentifyConfig)` for project initialization
- Implement `updateConfig(partial: Partial<AgentifyConfig>)` for modifications
- Implement `validateConfig()` returning validation result with errors array
- Expose `onConfigChanged` event emitter for config file changes using `vscode.workspace.createFileSystemWatcher`

**Credential Provider Interface**
- Create `ICredentialProvider` interface with `getCredentials()` method returning AWS credential chain
- Implement `DefaultCredentialProvider` using `fromNodeProviderChain()` from `@aws-sdk/credential-providers`
- Interface enables future Kiro AWS Explorer integration without changing service consumers
- Credential errors surface as `CredentialsNotConfiguredError` typed error

**Lazy Singleton DynamoDB Client**
- Extend existing `dynamoDbClient.ts` pattern with retry configuration
- Add 3 retries with exponential backoff using AWS SDK built-in retry strategy
- Accept `ICredentialProvider` for credential resolution
- Return typed `CredentialsNotConfiguredError` or `TableNotFoundError` on failures
- Expose both low-level `DynamoDBClient` and `DynamoDBDocumentClient`

**Lazy Singleton Bedrock Client**
- Create `bedrockClient.ts` following same lazy singleton pattern as DynamoDB
- Configure for Bedrock Runtime operations with 3 retries and exponential backoff
- Accept same `ICredentialProvider` interface
- Expose typed error `CredentialsNotConfiguredError` on credential failures
- Client only instantiated when first accessed (lazy initialization)

**Activity Bar View Containers**
- Register `viewContainer` in package.json contributes section
- Create `agentify` view container in Activity Bar with custom icon
- Register `agentify.demoViewer` view for Demo Viewer panel (stub WebviewViewProvider)
- Register `agentify.ideationWizard` view for Ideation Wizard panel (stub WebviewViewProvider)
- Views show placeholder "Panel coming soon" message until implemented

**Status Bar Item**
- Single status bar item with ID `agentify.status`
- Three states: "Not Initialized" (gray, no icon), "Ready" (green, checkmark icon), "AWS Error" (yellow, warning icon)
- Use `vscode.StatusBarAlignment.Right` with priority 100
- Click handler opens quick-pick menu with available commands
- Status updates based on config existence and AWS connection validation

**Command Registration (Stubs)**
- Register `agentify.initializeProject` command (stub shows info message)
- Register `agentify.openDemoViewer` command (stub reveals Demo Viewer panel)
- Register `agentify.openIdeationWizard` command (stub reveals Ideation Wizard panel)
- Register `agentify.showStatus` command (opens quick-pick status menu)
- All commands accessible via Command Palette

**Shared TypeScript Types**
- Create `types/config.ts` with:
  - `AgentifyConfig` (version, project, infrastructure, workflow)
  - `ProjectConfig` (name, valueMap, industry)
  - `InfrastructureConfig` with nested dynamodb object (tableName, tableArn, region)
  - `WorkflowConfig` (orchestrationPattern, triggerType, triggerConfig, agents, edges)
  - `AgentDefinition` (id, name, role)
  - `EdgeDefinition` (from, to)
- Create `types/triggers.ts` with:
  - `TriggerType` union: `'local' | 'agentcore' | 'http'`
  - `LocalTriggerConfig` (entryScript, pythonPath)
  - `AgentCoreTriggerConfig` (agentId, aliasId)
  - `HttpTriggerConfig` (endpoint, method)
  - `TriggerConfig` discriminated union
- Create `types/events.ts` with:
  - `EventSource` type: `'stdout' | 'dynamodb'`
  - Stdout events: `GraphStructureEvent`, `NodeStartEvent`, `NodeStopEvent`, `NodeStreamEvent`, `WorkflowCompleteEvent`
  - DynamoDB events: `ToolCallEvent`, `AgentSpanEvent`
  - `MergedEvent` wrapper with source discriminator
  - `AgentifyEvent` discriminated union
- Create `types/graph.ts` with:
  - `NodeStatus` type: `'pending' | 'running' | 'completed' | 'failed'`
  - `GraphNode` (id, name, role, status, executionTimeMs)
  - `GraphEdge` (id, from, to, animated)
  - `GraphData` (nodes, edges, entryPoints)
- Create `types/messages.ts` with:
  - Extension-to-webview: `EventMessage`, `GraphUpdateMessage`, `StatusMessage`, `ConfigMessage`
  - Webview-to-extension: `RunWorkflowMessage`, `StopWorkflowMessage`, `CommandMessage`
  - `WebviewMessage` and `PanelMessage` discriminated unions
- Create `types/errors.ts` with `AgentifyError` class and `AgentifyErrorCode` enum

## Existing Code to Leverage

**`src/services/dynamoDbClient.ts`**
- Existing lazy singleton pattern with region-based cache invalidation
- Use same `getDynamoDbClient()` and `getDynamoDbDocumentClient()` API pattern
- Extend with retry configuration and credential provider injection
- Keep `resetClients()` for configuration change handling

**`src/config/dynamoDbConfig.ts`**
- Pattern for configuration change subscription via `onConfigurationChange()`
- Use `initializeConfigurationWatcher()` pattern with file system watcher
- Adapt listener pattern for new `ConfigService` with typed event emitter

**`src/messages/tableErrors.ts`**
- Error enum pattern with `TableValidationErrorType`
- Extend to unified `AgentifyErrorCode` enum covering all error types
- Keep user-facing message functions pattern for error display

**`src/services/tableValidator.ts`**
- Pattern for typed validation results with `TableValidationResult`
- Use same AWS error name checking for credential and access errors
- Extend pattern to general service validation approach

**`src/extension.ts`**
- Pattern for storing `ExtensionContext` and managing disposables
- Use `context.subscriptions.push()` for cleanup registration
- Follow same `activate()` / `deactivate()` structure with initialization checks

## Out of Scope
- Panel UI implementation (React components) - handled in separate specs
- DynamoDB polling logic for event streaming - Spec #8
- Workflow trigger execution logic - Spec #10
- Bedrock/Claude API calls for AI features - Spec #15
- Initialize Project command implementation (actual project scaffolding) - Spec #4
- Python observability packages - Spec #9
- CloudFormation template creation - already completed in Spec #1
- React Flow graph visualization components - Spec #23
- Kiro AWS Explorer credential integration - Spec #3
- Configuration UI or settings editor
