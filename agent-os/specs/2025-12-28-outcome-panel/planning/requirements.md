# Spec Requirements: Outcome Panel

## Initial Description
Build outcome display section in Demo Viewer (below Execution Log) showing: (1) success/failure status with checkmark/X icon from `workflow_complete` or `workflow_error` stdout events, (2) workflow result rendered as markdown when result is a string, with formatted JSON fallback (syntax highlighting, collapsible) for structured objects, (3) "Sources" line listing data sources used if provided in outcome payload, (4) copy-to-clipboard button for result content. Panel starts hidden/collapsed until first workflow completes, clears immediately when new run starts (not waiting for new outcome). Error state displays error message prominently without stack trace - keep it clean for demo audiences. Does NOT duplicate execution duration (already shown in Input Panel timer).

## Requirements Discussion

### First Round Questions

**Q1:** I notice the existing `WorkflowCompleteEvent` in `events.ts` includes `status`, `execution_time_ms`, and `execution_order`, but not a `result` or `sources` field. I assume we need to extend this event type to include an outcome payload. What is the expected structure?

**Answer:** Yes, extend the event types with this structure:
```typescript
// For workflow_complete event
interface WorkflowCompletePayload {
  status: 'success';
  execution_time_ms: number;
  result?: string | Record<string, unknown>;  // Workflow output (markdown string or structured data)
  sources?: string[];  // Data sources consulted, e.g., ["SAP S/4HANA", "Databricks", "Weather API"]
}

// For workflow_error event
interface WorkflowErrorPayload {
  status: 'error';
  execution_time_ms?: number;  // Optional - may not complete
  error_message: string;       // Human-readable error description
  error_code?: string;         // Optional machine-readable code
}
```
Note: Payloads come from stdout events emitted by `main.py`. The steering file guides Kiro to generate code that emits these fields.

**Q2:** For the "Sources" line mentioned in the spec, I assume this refers to data sources the agents consulted during execution. Should these be displayed as a simple comma-separated list, or would you prefer badges/chips for each source?

**Answer:** Simple comma-separated list with subtle styling (not badges/chips). Use muted text color (`--vscode-descriptionForeground`). Only show if sources array is non-empty.

**Q3:** For rendering markdown results, I'm planning to use a simple approach that handles basic markdown without adding a heavy library dependency. What level of markdown support is needed?

**Answer:** Basic markdown is sufficient:
- Headers, bold, italic
- Bulleted and numbered lists
- Code spans and code blocks
- Line breaks

NOT needed: tables, task lists, images, links. Lightweight regex-based approach is fine.

**Q4:** For the JSON fallback display when results are structured objects, should the JSON be collapsible or always fully expanded?

**Answer:** Always fully expanded. If JSON exceeds ~30 lines, show first 20 with "Show full result..." link.

**Q5:** I assume the panel should appear in the same visual order as specified - below the Execution Log section, replacing the current placeholder. Is that correct?

**Answer:** Correct - replace "Outcome Panel (Coming Soon)" placeholder at lines 877-880 of demoViewerPanel.ts. Order: Input Panel -> Agent Graph -> Execution Log -> Outcome Panel

**Q6:** For error states, should the error message be displayed in a distinct error banner style or in the same card style as successful outcomes?

**Answer:** Distinct error banner with:
- Light error background (`--vscode-inputValidation-errorBackground`)
- Error border (`--vscode-inputValidation-errorBorder`)
- Error icon (X) in `--vscode-errorForeground`
- Error message in normal foreground (not red)
Visually distinct but not alarming.

**Q7:** Is there anything that should explicitly be excluded from this implementation?

**Answer:** Out of scope:
- Partial results on error
- Stack traces
- Retry button
- Result history/comparison
- Export to file
- Result validation/formatting options
- Animated transitions
- Loading/pending state
- Integration with Execution Log click-to-scroll

Edge cases to handle:
- Empty result: Show "Workflow completed with no output"
- Very long result (>100 lines): Truncate with "Show full result..."
- Non-UTF8/binary: Show "Result contains binary data" message, offer copy as raw

### Existing Code to Reference

No similar existing features identified for reference.

### Follow-up Questions

No follow-up questions were needed - initial answers were comprehensive.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A - No visual files to analyze.

## Requirements Summary

### Functional Requirements

**Core Functionality:**
- Display workflow outcome from `workflow_complete` or `workflow_error` stdout events
- Show success/failure status with appropriate icon (checkmark for success, X for error)
- Render result content as markdown (for strings) or syntax-highlighted JSON (for objects)
- Display "Sources" line when data sources array is provided and non-empty
- Provide copy-to-clipboard button for result content

**State Management:**
- Panel starts hidden until first workflow completes
- Panel clears immediately when new workflow run starts (before new outcome arrives)
- Panel does NOT show execution duration (already displayed in Input Panel timer)

**Markdown Rendering (for string results):**
- Headers (H1-H6)
- Bold and italic text
- Bulleted and numbered lists
- Inline code spans
- Code blocks
- Line breaks
- Lightweight regex-based implementation (no external library)

**JSON Rendering (for object results):**
- Syntax highlighting matching existing log panel patterns
- Always fully expanded (not collapsible)
- Truncation at ~30 lines, showing first 20 with "Show full result..." link

**Error Display:**
- Distinct error banner styling
- Error icon with `--vscode-errorForeground` color
- Error message in normal foreground (readable, not alarming)
- Background: `--vscode-inputValidation-errorBackground`
- Border: `--vscode-inputValidation-errorBorder`
- No stack traces displayed

**Edge Cases:**
- Empty result: Display "Workflow completed with no output"
- Very long result (>100 lines): Truncate with expandable "Show full result..." link
- Non-UTF8/binary data: Display "Result contains binary data" with raw copy option

### Event Type Extensions

**WorkflowCompleteEvent (extended):**
```typescript
interface WorkflowCompleteEvent extends BaseEvent {
  type: 'workflow_complete';
  status: 'success';
  execution_time_ms: number;
  execution_order: string[];
  result?: string | Record<string, unknown>;
  sources?: string[];
}
```

**WorkflowErrorEvent (new):**
```typescript
interface WorkflowErrorEvent extends BaseEvent {
  type: 'workflow_error';
  status: 'error';
  execution_time_ms?: number;
  error_message: string;
  error_code?: string;
}
```

### UI/Styling Requirements

**Success State:**
- Checkmark icon in success color (`--vscode-testing-iconPassed` or similar)
- Standard panel border and background
- Result content area with appropriate rendering

**Error State:**
- X icon in `--vscode-errorForeground`
- Background: `--vscode-inputValidation-errorBackground`
- Border: `--vscode-inputValidation-errorBorder`
- Error message in `--vscode-foreground` (not red)

**Sources Line:**
- Comma-separated list
- Muted color: `--vscode-descriptionForeground`
- Only displayed when sources array exists and is non-empty

**Copy Button:**
- Copy result content to clipboard
- Standard VS Code button styling

### Reusability Opportunities

- JSON syntax highlighting: Reuse `tokenizeJson()` from `logPanelHtmlGenerator.ts`
- Escape HTML utility: Reuse `escapeHtml()` from existing utils
- Panel state management patterns: Follow `LogPanelState` pattern from `logPanel.ts`
- CSS custom properties: Use existing semantic color variables from log panel CSS

### Scope Boundaries

**In Scope:**
- Outcome Panel UI component
- Success and error state display
- Markdown rendering (basic)
- JSON rendering with syntax highlighting
- Sources display
- Copy-to-clipboard functionality
- Event type extensions in `events.ts`
- Panel state management
- Truncation for long results

**Out of Scope:**
- Partial results on error
- Stack trace display
- Retry button/functionality
- Result history or comparison
- Export to file
- Result validation/formatting options
- Animated transitions
- Loading/pending state indicator
- Click-to-scroll integration with Execution Log
- External markdown library dependencies

### Technical Considerations

- Panel position: Replace placeholder at lines 877-880 of `demoViewerPanel.ts`
- Event source: stdout events from Python subprocess (`main.py`)
- Steering file updates: Document new event fields for Kiro code generation
- State clearing: Must clear panel state when `handleRunWorkflow()` is called
- Truncation thresholds: 30 lines for JSON, 100 lines for markdown/general
