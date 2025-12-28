# Spec Requirements: stdout Event Streaming & Panel Integration

## Initial Description
Parse real-time JSON line events from `WorkflowTriggerService.onStdoutLine` following the schema in `agentify-integration.md`: `graph_structure`, `node_start`/`node_stream`/`node_stop`, `tool_call`/`tool_result`, `workflow_complete`/`workflow_error`. Create `StdoutEventParser` service that:

**Parsing:**
- Subscribes to `WorkflowTriggerService.onStdoutLine`
- Parses JSON, validates against event schema
- Emits typed `StdoutEvent` via `vscode.EventEmitter`
- Handles malformed JSON gracefully (log warning, skip)

**Panel Integration:**
- `DemoViewerPanel` subscribes to both `StdoutEventParser.onEvent` and `DynamoDbPollingService.onEvent`
- Events collected into single array, sorted by timestamp for Execution Log display
- `workflow_complete`/`workflow_error` events trigger Outcome Panel update
- `graph_structure`/`node_*` events reserved for Phase 3 Agent Graph visualization

No separate merge service needed - panel handles trivial array combination.

## Requirements Discussion

### First Round Questions

**Q1:** I notice the `StdoutEventParser` service already exists in `src/services/stdoutEventParser.ts` with parsing logic, deduplication, and callback patterns. I'm assuming we should refactor it to use the `vscode.EventEmitter` pattern (like `DynamoDbPollingService`) rather than the current callback approach, to maintain consistency with other services. Is that correct, or should we keep the callback pattern?

**Answer:** Refactor to `vscode.EventEmitter` for consistency with other services (`DynamoDbPollingService.onEvent`, `WorkflowTriggerService.onStdoutLine`, `ConfigService.onConfigChange`). Use the pattern:
```typescript
export class StdoutEventParser implements vscode.Disposable {
  private readonly _onEvent = new vscode.EventEmitter<StdoutEvent>();
  readonly onEvent = this._onEvent.event;

  private readonly _onParseError = new vscode.EventEmitter<ParseError>();
  readonly onParseError = this._onParseError.event;
}
```

**Q2:** For merging stdout and DynamoDB events, I'm assuming the `DemoViewerPanel` should simply subscribe to both event sources and maintain a single sorted array (by timestamp) in its existing `_logPanelState.entries`. Should we sort on every new event arrival, or batch updates with a small debounce (e.g., 50ms) to avoid excessive re-sorting during rapid event bursts?

**Answer:** Batch with 50ms debounce during rapid bursts (10+ events/sec during parallel agent runs). Implementation pattern provided with `pendingEvents`, `sortDebounceTimer`, `flushPendingEvents()`.

**Q3:** The existing `LogEntry` type in `logPanel.ts` appears designed for the execution log display. I'm assuming we need to create a transformer function that converts `MergedEvent` objects (from both stdout and DynamoDB sources) into `LogEntry` objects for display. Is there a specific format preference for how different event types should appear in the log?

**Answer:** Display format for each event type:
- `node_start`: "Start Planner Agent started"
- `node_stop`: "Check Planner Agent completed (1.2s)" or "X Planner Agent failed"
- `node_stream`: Skip in log (too noisy, Phase 3)
- `tool_call`: "Wrench SAP S/4HANA -> get_inventory_levels"
- `tool_result`: Nested under tool_call, shows output summary
- `workflow_complete`: "Check Workflow completed (4.2s)"
- `workflow_error`: "X Workflow failed: {error_message}"

**Q4:** For the Outcome Panel integration, I see `setOutcomeSuccess()` and `setOutcomeError()` methods already exist. I'm assuming we should call these when `workflow_complete` or `workflow_error` events arrive from the stdout stream. Should these also trigger when the same events come from DynamoDB polling (to handle AgentCore mode), or only from stdout?

**Answer:** stdout events only. DynamoDB never receives `workflow_complete` - that's stdout-only per `agentify-integration.md`. Event split is intentional:
- stdout: `graph_structure`, `node_*`, `workflow_complete/error` (real-time UI, terminal state)
- DynamoDB: `tool_call`, `agent_start`, `agent_end` (persistent history, tool details)

**Q5:** The `graph_structure` and `node_*` events are documented as "reserved for Phase 3 Agent Graph visualization." Should we still collect and store these events now for future use, or simply log them and skip adding to the execution log display?

**Answer:** Store them, but don't add to Execution Log:
- `graph_structure`: Store for Phase 3 Agent Graph
- `node_start`/`node_stop`: Store state AND add to log
- `node_stream`: Store for Phase 3, skip log (too noisy)

**Q6:** For error handling when stdout emits malformed JSON, the current `StdoutEventParser` has an `onParseError` callback. I'm assuming we should log these warnings to the VS Code Output channel rather than displaying them in the UI (to avoid cluttering the demo experience). Is that correct?

**Answer:** Log to VS Code Output channel (`vscode.window.createOutputChannel('Agentify')`), keep UI clean.

**Q7:** Is there anything specific that should be excluded from this implementation phase?

**Answer:** Defer to Phase 3 (items 24-26):
- Agent Graph visualization (item 24)
- Graph animation (item 25)
- Collapsible log sections (item 26)
- Filtering by agent/event type (item 26)
- Virtual scrolling (item 26)

### Existing Code to Reference

**Similar Features Identified:**
- Feature: DynamoDbPollingService - Path: `src/services/dynamoDbPollingService.ts` - EventEmitter pattern for event emission
- Feature: WorkflowTriggerService - Path: `src/services/workflowTriggerService.ts` - Stdout line emission pattern
- Feature: ConfigService - Path: `src/services/configService.ts` - Config change EventEmitter pattern
- Feature: Existing StdoutEventParser - Path: `src/services/stdoutEventParser.ts` - Current parsing logic to refactor
- Feature: DemoViewerPanel - Path: `src/panels/demoViewerPanel.ts` - Log entry management, outcome panel methods
- Feature: Event Types - Path: `src/types/events.ts` - All event type definitions
- Feature: Log Panel Types - Path: `src/types/logPanel.ts` - LogEntry type definition

### Follow-up Questions

No follow-up questions needed - all requirements were comprehensively answered.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A - No visuals to analyze.

## Requirements Summary

### Functional Requirements

**StdoutEventParser Service Refactor:**
- Refactor existing `StdoutEventParser` to use `vscode.EventEmitter` pattern
- Implement `onEvent: Event<StdoutEvent>` for parsed events
- Implement `onParseError: Event<ParseError>` for malformed JSON errors
- Implement `vscode.Disposable` interface for cleanup
- Subscribe to `WorkflowTriggerService.onStdoutLine` for raw stdout data
- Validate events against schema (require `type` or `event_type`, `workflow_id`, `timestamp`)
- Maintain deduplication logic with `EventDeduplicator`

**Event to LogEntry Transformation:**
- Create transformer function: `MergedEvent` -> `LogEntry`
- Display formats:
  - `node_start`: "Start {agent_name} started"
  - `node_stop` (success): "Check {agent_name} completed ({duration})"
  - `node_stop` (failure): "X {agent_name} failed"
  - `tool_call`: "Wrench {system} -> {operation}"
  - `tool_result`: Nested under tool_call with output summary
  - `workflow_complete`: "Check Workflow completed ({duration})"
  - `workflow_error`: "X Workflow failed: {error_message}"
- Skip `node_stream` events in log display (too noisy)

**DemoViewerPanel Integration:**
- Subscribe to `StdoutEventParser.onEvent`
- Subscribe to `DynamoDbPollingService.onEvent`
- Merge events into single sorted array by timestamp
- Implement 50ms debounce for batching rapid event bursts
- Store `graph_structure` events for Phase 3 (don't display)
- Store `node_stream` events for Phase 3 (don't display)
- Add `node_start`/`node_stop` to both storage and log display
- Add `tool_call`/`tool_result` from DynamoDB to log display

**Outcome Panel Triggers:**
- Call `setOutcomeSuccess()` on `workflow_complete` event from stdout
- Call `setOutcomeError()` on `workflow_error` event from stdout
- Do NOT trigger on DynamoDB events (terminal events are stdout-only)

**Error Handling:**
- Log malformed JSON warnings to VS Code Output channel (`Agentify`)
- Keep UI clean - no parse errors displayed to user

### Reusability Opportunities

- Existing `StdoutEventParser` parsing logic can be preserved, just refactor to EventEmitter
- `DynamoDbPollingService` provides pattern for singleton service with EventEmitter
- `WorkflowTriggerService` already emits `onStdoutLine` - just need to subscribe
- `DemoViewerPanel.addLogEntry()` and `addLogEntries()` already exist
- `setOutcomeSuccess()` and `setOutcomeError()` already implemented
- All event type definitions already exist in `src/types/events.ts`
- `LogEntry` type already defined in `src/types/logPanel.ts`

### Scope Boundaries

**In Scope:**
- StdoutEventParser service refactor to EventEmitter pattern
- Basic event to LogEntry transformation
- Merge stdout + DynamoDB events into single sorted array
- 50ms debounce for rapid event batching
- Outcome Panel trigger on `workflow_complete`/`workflow_error` stdout events
- Store `graph_structure`, `node_stream` events for Phase 3
- Log parse errors to VS Code Output channel

**Out of Scope:**
- Agent Graph visualization (Phase 3, item 24)
- Graph animation (Phase 3, item 25)
- Collapsible log sections by agent (Phase 3, item 26)
- Filtering by agent/event type (Phase 3, item 26)
- Virtual scrolling for large event lists (Phase 3, item 26)
- `node_stream` display in execution log (Phase 3)

### Technical Considerations

**Event Source Split (per agentify-integration.md):**
- stdout events: `graph_structure`, `node_start`, `node_stop`, `node_stream`, `workflow_complete`, `workflow_error`
- DynamoDB events: `tool_call`, `tool_result`, `agent_start`, `agent_end`

**Service Pattern:**
- Use singleton pattern consistent with other services
- Implement `vscode.Disposable` for cleanup
- Use `vscode.EventEmitter` for event emission

**Performance:**
- 50ms debounce for event batching during parallel agent execution
- Maintain existing 500 entry limit in log panel
- Deduplication to prevent duplicate events

**Files to Modify:**
- `src/services/stdoutEventParser.ts` - Refactor to EventEmitter pattern
- `src/panels/demoViewerPanel.ts` - Add subscriptions, event merging, outcome triggers
- May need new utility file for event-to-LogEntry transformation

**Files to Reference:**
- `src/services/dynamoDbPollingService.ts` - EventEmitter pattern
- `src/services/workflowTriggerService.ts` - onStdoutLine subscription point
- `src/types/events.ts` - Event type definitions
- `src/types/logPanel.ts` - LogEntry type definition
