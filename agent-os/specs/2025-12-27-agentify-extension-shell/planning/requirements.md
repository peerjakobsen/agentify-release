# Spec Requirements: Agentify Extension Shell

## Initial Description
Agentify Extension Shell — Create single Kiro IDE extension with shared services (AWS clients, config, types) and registration for two webview panels: Demo Viewer (runtime) and Ideation Wizard (design-time)

## Requirements Discussion

### First Round Questions

**Q1:** I assume the extension should activate on startup when a workspace contains an `.agentify/` folder, indicating it's an Agentify project. Is that correct, or should it use a different activation trigger?
**Answer:** Hybrid activation approach with three events:
- `onStartupFinished`
- `workspaceContains:.agentify/config.json`
- `onCommand:agentify.initializeProject`

Extension registers commands immediately, but panels/AWS services only initialize when `.agentify/config.json` exists.

**Q2:** For the shared AWS clients (DynamoDB, Bedrock), should they be lazily initialized singletons with built-in retry logic and error handling?
**Answer:** Yes, lazy singletons with built-in retry (3 retries, exponential backoff) and credential error handling. Panels receive clean typed errors like `CredentialsNotConfiguredError` or `TableNotFoundError`.

**Q3:** The tech stack mentions integrating with Kiro's built-in AWS Explorer for credentials. For this shell spec, should we create a placeholder/interface for credential retrieval?
**Answer:** Use standard AWS credential chain initially with a `CredentialProvider` interface for future Kiro integration. `DefaultCredentialProvider` uses `fromNodeProviderChain()`.

**Q4:** For the webview panel registration, should both panels appear in the Activity Bar with custom icons?
**Answer:** Yes, Activity Bar with custom icons. Both panels in sidebar, also accessible via Command Palette. Use VS Code's viewContainer contribution.

**Q5:** Should the Config Service also handle config file creation/updates (for when the Initialize Project command runs)?
**Answer:** Yes, include creation/updates. Single service for all config operations: `getConfig()`, `isInitialized()`, `onConfigChanged` event, `createConfig()`, `updateConfig()`, `validateConfig()`.

**Q6:** For shared TypeScript types, are there other shared types beyond config schema, DynamoDB event types, and webview message protocols?
**Answer:** Original list plus:
- StdoutEvent (for local mode streaming)
- GraphNode, GraphEdge (visualization types)
- TriggerType union and config interfaces
- AgentifyError class with AgentifyErrorCode enum

**Q7:** Should the extension include any status bar items showing connection status?
**Answer:** Single status bar item with states:
- "Not Initialized" (gray)
- "Ready" (green, with checkmark)
- "AWS Error" (yellow, with warning icon)
Click opens quick-pick menu with commands.

**Q8:** Is there anything that should explicitly be excluded from this spec?
**Answer:** Shell should NOT include:
- Panel UI implementation (React components)
- DynamoDB polling logic
- Workflow trigger execution
- Bedrock/Claude API calls
- Initialize Project command implementation
- Python packages
- CloudFormation template
- React Flow graph visualization

Shell SHOULD include only:
- Extension manifest and entry point
- Service interfaces and lazy singleton implementations
- Shared TypeScript types
- Activity Bar view containers (empty shells)
- Webview panel registration (stubs)
- Status bar item
- Command registration (stubs)

### Existing Code to Reference
No similar existing features identified for reference.

### Follow-up Questions
None required - answers were comprehensive.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A

## Requirements Summary

### Functional Requirements

**Extension Activation**
- Activate on `onStartupFinished` for command availability
- Activate on `workspaceContains:.agentify/config.json` for project detection
- Activate on `onCommand:agentify.initializeProject` for first-time setup
- Commands registered immediately; panels/AWS services initialize only when config exists

**Shared AWS Clients**
- DynamoDB client as lazy singleton
- Bedrock client as lazy singleton
- 3 retries with exponential backoff
- Clean typed errors: `CredentialsNotConfiguredError`, `TableNotFoundError`
- `CredentialProvider` interface with `DefaultCredentialProvider` implementation
- Uses `fromNodeProviderChain()` from AWS SDK for standard credential chain

**Config Service**
- Read `.agentify/config.json`
- Watch for config file changes with `onConfigChanged` event
- Typed access to config values
- Schema validation on load
- `getConfig()` method
- `isInitialized()` method
- `createConfig()` method for project initialization
- `updateConfig()` method for modifications
- `validateConfig()` method for schema validation

**Webview Panel Registration**
- Activity Bar view container with custom icons
- Demo Viewer panel registration (stub)
- Ideation Wizard panel registration (stub)
- Accessible via Command Palette
- Uses VS Code's viewContainer contribution point

**Status Bar**
- Single status bar item
- States: "Not Initialized" (gray), "Ready" (green), "AWS Error" (yellow)
- Click opens quick-pick menu with commands

**Command Registration**
- `agentify.initializeProject` (stub)
- `agentify.openDemoViewer` (stub)
- `agentify.openIdeationWizard` (stub)

### Shared TypeScript Types

**Config Types**
- `AgentifyConfig` (version, project, infrastructure, workflow)
- `ProjectConfig` (name, valueMap, industry)
- `InfrastructureConfig` with nested dynamodb object (tableName, tableArn, region)
- `WorkflowConfig` (orchestrationPattern, triggerType, triggerConfig, agents, edges)
- `AgentDefinition` (id, name, role)
- `EdgeDefinition` (from, to)
- `TriggerType` union (`'local' | 'agentcore' | 'http'`)
- `LocalTriggerConfig` (entryScript, pythonPath)
- `AgentCoreTriggerConfig` (agentId, aliasId)
- `HttpTriggerConfig` (endpoint, method)
- `TriggerConfig` discriminated union

**Event Types**
- `EventSource` type: `'stdout' | 'dynamodb'`
- Stdout events (for local mode real-time streaming):
  - `GraphStructureEvent` (type, nodes, edges, entry_points)
  - `NodeStartEvent` (type, node_id)
  - `NodeStopEvent` (type, node_id, status, execution_time_ms)
  - `NodeStreamEvent` (type, node_id, data)
  - `WorkflowCompleteEvent` (type, status, execution_time_ms, execution_order)
- DynamoDB events (for tool call tracking):
  - `ToolCallEvent` (event_type, agent_name, system, operation, input/output, status)
  - `AgentSpanEvent` (event_type, agent_name, role, duration_ms)
- `MergedEvent` wrapper with `source: EventSource` discriminator
- `AgentifyEvent` discriminated union

**Visualization Types**
- `NodeStatus` type: `'pending' | 'running' | 'completed' | 'failed'`
- `GraphNode` (id, name, role, status, executionTimeMs)
- `GraphEdge` (id, from, to, animated)
- `GraphData` (nodes, edges, entryPoints)

**Communication Types**
- Extension-to-webview: `EventMessage`, `GraphUpdateMessage`, `StatusMessage`, `ConfigMessage`
- Webview-to-extension: `RunWorkflowMessage`, `StopWorkflowMessage`, `CommandMessage`
- `WebviewMessage` discriminated union
- `PanelMessage` discriminated union

**Error Types**
- `AgentifyError` class
- `AgentifyErrorCode` enum (including `CREDENTIALS_NOT_CONFIGURED`, `TABLE_NOT_FOUND`, etc.)

### Dual-Mode Architecture

The event types support dual-mode architecture:
- **Local mode**: Real-time graph events via stdout streaming + tool events via DynamoDB
- **AgentCore mode**: All events via DynamoDB polling

The `MergedEvent` wrapper with `source` discriminator allows the Demo Viewer to handle both event sources uniformly while tracking their origin for UI purposes (e.g., stdout events update graph instantly, DynamoDB events populate tool call log).

### Reusability Opportunities
- No existing similar features identified in the codebase
- This shell establishes foundational patterns for all subsequent specs

### Scope Boundaries

**In Scope:**
- Extension manifest (`package.json`) with contribution points
- Extension entry point (`extension.ts`) with activate/deactivate
- Service interfaces and lazy singleton implementations
- Shared TypeScript type definitions
- Activity Bar view containers (empty shells)
- Webview panel registration (stub implementations)
- Status bar item with state management
- Command registration (stub implementations)
- CredentialProvider interface and DefaultCredentialProvider
- Config service with full CRUD operations
- Error types and error handling patterns

**Out of Scope:**
- Panel UI implementation (React components) - separate specs
- DynamoDB polling logic - Spec #8
- Workflow trigger execution - Spec #10
- Bedrock/Claude API calls - Spec #15
- Initialize Project command implementation - Spec #4
- Python observability packages - Spec #9
- CloudFormation template - already done in Spec #1
- React Flow graph visualization - Spec #23
- AWS Connection Integration with Kiro Explorer - Spec #3

### Technical Considerations

**Extension Platform**
- Kiro IDE (VS Code Extension API compatible)
- TypeScript 5.0+
- esbuild for bundling
- npm package manager
- Node 22 LTS

**AWS SDK Dependencies**
- `@aws-sdk/client-dynamodb`
- `@aws-sdk/lib-dynamodb` (DocumentClient)
- `@aws-sdk/client-bedrock-runtime`
- `@aws-sdk/credential-providers`

**Architecture Patterns**
- Lazy singleton pattern for AWS clients
- Interface-based design for future Kiro AWS Explorer integration
- Event emitter pattern for config changes
- Typed error handling with error codes

**File Structure (Expected)**
```
src/
  extension.ts           # Entry point
  services/
    configService.ts     # Config CRUD and watching
    credentialProvider.ts # Credential interface and default impl
    dynamoDbClient.ts    # Lazy singleton DynamoDB client
    bedrockClient.ts     # Lazy singleton Bedrock client
  types/
    config.ts            # Config schema types
    events.ts            # DynamoDB and stdout event types
    graph.ts             # Visualization types
    messages.ts          # Webview message protocols
    errors.ts            # Error class and codes
  panels/
    demoViewerPanel.ts   # Stub registration
    ideationWizardPanel.ts # Stub registration
  statusBar.ts           # Status bar management
```
