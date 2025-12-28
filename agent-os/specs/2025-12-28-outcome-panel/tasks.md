# Task Breakdown: Outcome Panel

## Overview
Total Tasks: 4 Task Groups with 24 Sub-tasks

This feature adds an Outcome Panel to the Demo Viewer that displays workflow execution results, including success/failure status, rendered content (markdown or JSON), data sources, and copy-to-clipboard functionality.

## Task List

### Foundation Layer

#### Task Group 1: Type System and State Management
**Dependencies:** None

- [x] 1.0 Complete type system and state foundation
  - [x] 1.1 Write 4-6 focused tests for type guards and state management
    - Test `isWorkflowErrorEvent()` type guard with valid error events
    - Test `isWorkflowErrorEvent()` type guard with non-error events
    - Test `isWorkflowCompleteEvent()` correctly identifies events with result/sources fields
    - Test OutcomePanelState initialization and state transitions
    - Test state clearing behavior
  - [x] 1.2 Extend WorkflowCompleteEvent in `/src/types/events.ts`
    - Add optional `result` field: `string | Record<string, unknown>`
    - Add optional `sources` field: `string[]`
    - Update existing `WorkflowCompleteEvent` interface (search for `interface WorkflowCompleteEvent`)
  - [x] 1.3 Create WorkflowErrorEvent type in `/src/types/events.ts`
    - Define interface with `type: 'workflow_error'`
    - Add required `error_message: string` field
    - Add optional `error_code?: string` field
    - Add optional `execution_time_ms?: number` field
  - [x] 1.4 Add type guard `isWorkflowErrorEvent()` in `/src/types/events.ts`
    - Follow existing type guard pattern (see `isWorkflowCompleteEvent()` as reference)
    - Check for `type === 'workflow_error'` and required fields
  - [x] 1.5 Update StdoutEvent union type to include WorkflowErrorEvent
    - Ensure proper type discrimination in event handling
  - [x] 1.6 Create OutcomePanelState interface in `/src/types/logPanel.ts`
    - Follow `LogPanelState` interface pattern in the same file
    - Include fields: `status` (success/error/hidden), `result`, `sources`, `errorMessage`, `isExpanded`
  - [x] 1.7 Ensure type system tests pass
    - Run ONLY the 4-6 tests written in 1.1
    - Verify type guards work correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 1.1 pass
- WorkflowCompleteEvent extended with result and sources fields
- WorkflowErrorEvent type properly defined
- Type guard correctly identifies error events
- OutcomePanelState interface follows existing patterns

### Content Rendering Layer

#### Task Group 2: Markdown and JSON Rendering Utilities
**Dependencies:** Task Group 1

- [x] 2.0 Complete content rendering utilities
  - [x] 2.1 Write 6-8 focused tests for content rendering
    - Test markdown header rendering (H1-H6)
    - Test markdown bold/italic text rendering
    - Test markdown list rendering (bulleted and numbered)
    - Test markdown code spans and code blocks
    - Test JSON rendering with syntax highlighting tokens
    - Test content truncation at 30 lines (JSON) and 100 lines (markdown)
    - Test empty result handling
    - Test binary/non-UTF8 data detection
  - [x] 2.2 Create markdown renderer in `/src/utils/outcomePanelHtmlGenerator.ts`
    - Implement regex-based parser for headers (H1-H6)
    - Implement bold (`**text**`) and italic (`*text*`) parsing
    - Implement bulleted list (`- item`) and numbered list (`1. item`) parsing
    - Implement inline code spans (backticks) and code blocks (triple backticks)
    - Handle line breaks properly
    - Use `escapeHtml()` from `logPanelHtmlGenerator.ts` for all content
  - [x] 2.3 Create JSON renderer in `/src/utils/outcomePanelHtmlGenerator.ts`
    - Reuse `tokenizeJson()` function from `logPanelHtmlGenerator.ts`
    - Apply same color classes: `json-string`, `json-number`, `json-boolean`, `json-null`, `json-key`
    - Implement always-expanded display (no collapsible tree)
    - Implement line counting for truncation logic
  - [x] 2.4 Implement content truncation logic
    - JSON: Show first 20 lines if content exceeds 30 lines
    - Markdown/text: Truncate at 100 lines
    - Generate "Show full result..." link markup
    - Track expanded/collapsed state for truncated content
  - [x] 2.5 Implement edge case handlers
    - Empty result: Return "Workflow completed with no output" message
    - Binary data detection: Check for non-UTF8 characters
    - Binary data: Return "Result contains binary data" with raw copy indicator
  - [x] 2.6 Run ONLY the 6-8 tests written in 2.1
    - Verify markdown renders correctly
    - Verify JSON syntax highlighting works
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 6-8 tests written in 2.1 pass
- Markdown renders headers, bold, italic, lists, and code correctly
- JSON renders with proper syntax highlighting
- Truncation works at specified thresholds
- Edge cases handled gracefully

### UI Components Layer

#### Task Group 3: Outcome Panel HTML and Styling
**Dependencies:** Task Group 2

- [x] 3.0 Complete UI components and styling
  - [x] 3.1 Write 4-6 focused tests for UI components
    - Test success state panel HTML structure
    - Test error state panel HTML structure with correct styling
    - Test sources line rendering when sources provided
    - Test copy button presence and attributes
    - Test panel hidden state (no HTML output)
    - Test panel clearing on new workflow start
  - [x] 3.2 Create outcome panel HTML generator in `/src/utils/outcomePanelHtmlGenerator.ts`
    - Implement `generateOutcomePanelHtml(state: OutcomePanelState): string`
    - Return empty string when `status === 'hidden'`
    - Generate success state container with checkmark icon
    - Generate error state container with X icon and error styling
    - Include content area for rendered result
    - Include sources line when sources array is non-empty
  - [x] 3.3 Implement success state styling
    - Checkmark icon using `--vscode-testing-iconPassed` color
    - Standard panel border and background consistent with log section
    - Result content area with appropriate padding
  - [x] 3.4 Implement error state styling
    - X icon using `--vscode-errorForeground` color
    - Background: `--vscode-inputValidation-errorBackground`
    - Border: `--vscode-inputValidation-errorBorder`
    - Error message in `--vscode-foreground` (not red text)
  - [x] 3.5 Implement sources line component
    - Comma-separated list format: "Sources: SAP S/4HANA, Databricks, Weather API"
    - Muted color: `--vscode-descriptionForeground`
    - Only render when sources array exists and has items
  - [x] 3.6 Implement copy-to-clipboard button
    - Standard VS Code button styling with clipboard icon
    - Data attribute for raw result content (string or stringified JSON)
    - Visual feedback class for successful copy
  - [x] 3.7 Add CSS styles to outcome panel stylesheet
    - Follow CSS architecture from `logPanelHtmlGenerator.ts` (see `getLogPanelStyles()` or similar CSS generation function)
    - Reuse semantic color variables: `--log-color-success`, `--log-color-error`
    - Add outcome-panel-specific classes for success/error states
    - Add styles for truncated content and "Show full result..." link
  - [x] 3.8 Ensure UI component tests pass
    - Run ONLY the 4-6 tests written in 3.1
    - Verify HTML structure is correct
    - Verify styling classes are applied correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 3.1 pass
- Success and error states render with correct visual styling
- Sources line appears only when data is available
- Copy button has correct attributes and styling
- CSS follows existing log panel patterns

### Integration Layer

#### Task Group 4: Demo Viewer Integration and Event Handling
**Dependencies:** Task Group 3

- [x] 4.0 Complete Demo Viewer integration
  - [x] 4.1 Write 4-6 focused tests for integration
    - Test panel renders in correct position (after Execution Log)
    - Test `workflow_complete` event updates panel with success state
    - Test `workflow_error` event updates panel with error state
    - Test panel clears when `handleRunWorkflow()` is called
    - Test copy button click handler copies correct content
    - Test "Show full result..." link expands truncated content
  - [x] 4.2 Replace placeholder in `/src/panels/demoViewerPanel.ts`
    - Remove the "Outcome Panel (Coming Soon)" placeholder (search for this text or "Coming Soon" in the file)
    - Insert call to `generateOutcomePanelHtml(outcomePanelState)`
    - Maintain correct panel hierarchy: Input Panel -> Agent Graph -> Execution Log -> Outcome Panel
  - [x] 4.3 Initialize outcome panel state in Demo Viewer
    - Add `outcomePanelState: OutcomePanelState` to panel state
    - Initialize with `status: 'hidden'`
    - Include in state update and re-render logic
  - [x] 4.4 Handle workflow_complete event for success outcomes
    - Update state with `status: 'success'`
    - Extract `result` field (determine if string or object)
    - Extract `sources` array if present
    - Trigger panel re-render
  - [x] 4.5 Handle workflow_error event for error outcomes
    - Update state with `status: 'error'`
    - Extract `error_message` for display
    - Extract `error_code` if present (for future use)
    - Trigger panel re-render
  - [x] 4.6 Implement panel clearing on new workflow run
    - Clear outcome panel state in `handleRunWorkflow()` before starting new execution
    - Set `status: 'hidden'` immediately
    - Trigger panel re-render to remove previous outcome
  - [x] 4.7 Implement copy-to-clipboard click handler
    - Add event listener for copy button clicks
    - Copy raw result content (string or stringified JSON)
    - Add visual feedback class temporarily after successful copy
    - Handle clipboard API errors gracefully
  - [x] 4.8 Implement "Show full result..." expand handler
    - Add event listener for expand link clicks
    - Toggle `isExpanded` state
    - Re-render with full content visible
    - Update link text to "Show less..." when expanded
  - [x] 4.9 Ensure integration tests pass
    - Run ONLY the 4-6 tests written in 4.1
    - Verify end-to-end event handling works
    - Verify panel updates correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 4.1 pass
- Outcome Panel appears in correct position in Demo Viewer
- Success and error events properly update panel state
- Panel clears when new workflow starts
- Copy and expand interactions work correctly

### Testing

#### Task Group 5: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-4

- [x] 5.0 Review existing tests and fill critical gaps only
  - [x] 5.1 Review tests from Task Groups 1-4
    - Review the 4-6 tests written for type system (Task 1.1)
    - Review the 6-8 tests written for content rendering (Task 2.1)
    - Review the 4-6 tests written for UI components (Task 3.1)
    - Review the 4-6 tests written for integration (Task 4.1)
    - Total existing tests: approximately 18-26 tests
  - [x] 5.2 Analyze test coverage gaps for Outcome Panel feature only
    - Identify critical user workflows that lack test coverage
    - Focus ONLY on gaps related to this spec's feature requirements
    - Do NOT assess entire application test coverage
    - Prioritize end-to-end workflows over unit test gaps
  - [x] 5.3 Write up to 8 additional strategic tests maximum
    - Add maximum of 8 new tests to fill identified critical gaps
    - Focus on integration points and end-to-end workflows
    - Consider: event flow from Python subprocess to UI render
    - Consider: state persistence across multiple workflow runs
    - Do NOT write comprehensive coverage for all scenarios
  - [x] 5.4 Run feature-specific tests only
    - Run ONLY tests related to Outcome Panel feature
    - Expected total: approximately 26-34 tests maximum
    - Do NOT run the entire application test suite
    - Verify critical workflows pass

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 26-34 tests total)
- Critical user workflows for Outcome Panel are covered
- No more than 8 additional tests added when filling in testing gaps
- Testing focused exclusively on this spec's feature requirements

## Execution Order

Recommended implementation sequence:

1. **Foundation Layer (Task Group 1)** - Type extensions and state management
   - Must complete first as all other layers depend on these types

2. **Content Rendering Layer (Task Group 2)** - Markdown and JSON utilities
   - Depends on types for result field typing
   - Required before UI can display content

3. **UI Components Layer (Task Group 3)** - HTML generation and styling
   - Depends on content renderers for result display
   - Depends on state types for component props

4. **Integration Layer (Task Group 4)** - Demo Viewer wiring
   - Depends on all previous layers
   - Brings all components together in the panel

5. **Testing (Task Group 5)** - Gap analysis and final verification
   - Depends on all implementation being complete
   - Final quality gate before feature completion

## Key Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `/src/types/events.ts` | Modify | Extend WorkflowCompleteEvent, add WorkflowErrorEvent |
| `/src/types/logPanel.ts` | Modify | Add OutcomePanelState interface |
| `/src/utils/outcomePanelHtmlGenerator.ts` | Create | Markdown renderer, JSON renderer, panel HTML |
| `/src/panels/demoViewerPanel.ts` | Modify | Integration, event handling, state management |

## Reusability Notes

- **JSON Tokenizer**: Reuse `tokenizeJson()` function from `logPanelHtmlGenerator.ts`
- **HTML Escaping**: Reuse `escapeHtml()` function from `logPanelHtmlGenerator.ts`
- **State Pattern**: Follow `LogPanelState` interface pattern from `logPanel.ts`
- **CSS Variables**: Leverage existing semantic color variables from log panel CSS
- **Type Guards**: Follow `isWorkflowCompleteEvent()` pattern from `events.ts`
