# Specification: Wizard Step 6 Mock Data Strategy

## Goal
Build wizard step 6 for AI-generated mock data configuration, providing editable mock definitions (request schema, response schema, sample data) for each tool identified in the Step 5 agent design.

## User Stories
- As a solution architect, I want AI-generated mock data for each tool so that I can quickly configure realistic demo scenarios without manual schema creation.
- As a demo builder, I want to import existing sample data from CSV/JSON files so that I can use real customer terminology in demonstrations.

## Specific Requirements

**Auto-Generation on Step Entry**
- Trigger AI generation when entering Step 6 if aiCalled is false or step5Hash has changed
- Parse confirmed agents from Step 5 to extract all tools requiring mock definitions
- Display AI-generated mocks immediately in editable accordions (direct-edit pattern, no two-phase accept flow)
- Store step5Hash for change detection to re-trigger generation when agent design changes

**Mock Definition Structure**
- Each MockToolDefinition contains: tool name, system, operation, mockRequest (JSON object), mockResponse (JSON object), sampleData array
- sampleData limited to maximum 5 rows per tool
- Track per-field edited flags: requestEdited, responseEdited, sampleDataEdited
- Track expanded state per accordion for UI persistence

**Accordion Display for Tools**
- Render one collapsible accordion per tool identified from Step 5 agent design
- Show tool name and system in accordion header
- Accordion body contains: JSON editor for request schema, JSON editor for response schema, sample data table
- Follow Step 5 direct-edit accordion styling and interaction patterns

**JSON Editor with Syntax Highlighting**
- Use existing tokenizeJson() function from logPanelHtmlGenerator.ts for syntax highlighting
- Apply CSS classes: json-string, json-number, json-boolean, json-null, json-key
- Provide contenteditable or textarea-based editing with real-time highlighting
- Basic JSON syntax validation only (show "Invalid JSON" warning if malformed, no JSON Schema validation)

**Sample Data Table**
- Display table with columns derived from mockResponse schema keys
- Support add row (max 5 rows), edit cell inline, delete row operations
- Show "+5 more rows available" message when limit reached on add attempt
- Track sampleDataEdited flag when any row changes

**Customer Terminology Toggle**
- Single toggle button labeled "Use Customer Terminology"
- When toggled ON, send AI refinement request with prompt: "Regenerate sample data using terminology typical for {industry}"
- One-shot refinement using wizard context (industry from Step 1), no persistent terminology mapping
- Update sampleData fields in response while preserving schema structure

**Bulk Actions**
- "Regenerate All" button triggers fresh AI mock generation for all tools
- "Import Sample Data" button opens file picker for CSV/JSON upload
- File constraints: CSV and JSON formats only, max 1MB file size
- Auto-map imported fields to schema (case-insensitive matching)
- Ignore unmatched fields, use placeholder values for missing required fields
- Display import summary: "Imported X rows. Mapped: field1, field2. Ignored: field3"

**Non-Blocking Validation**
- Warning if tool has empty sampleData: "Warning: {tool_name} has no sample data - demo will use empty responses"
- Warning if mockRequest or mockResponse is empty or invalid JSON
- Display warnings in dedicated section (follow Step 5 validation-warnings pattern)
- Allow navigation to next step regardless of warnings (non-blocking)

**State Management**
- MockDataState tracks: mockDefinitions array, useCustomerTerminology boolean, isLoading, error, step5Hash, aiCalled
- Store in wizard state at path: state.mockData
- Output flows to Phase 4 steering file generation (integration-landscape.md)

## Visual Design
No visual assets provided. Follow existing Step 5 accordion styling and Step 4/5 form patterns for visual consistency.

## Existing Code to Leverage

**tokenizeJson() in logPanelHtmlGenerator.ts**
- Provides JSON syntax highlighting with span elements for each token type
- Apply directly to mock request/response JSON content
- CSS classes already defined: json-string, json-number, json-boolean, json-null, json-key

**Step5LogicHandler in ideationStep5Logic.ts**
- Pattern for auto-triggering AI on step entry with hash-based change detection
- State management with edited flags per field
- Streaming service integration pattern with onToken, onComplete, onError handlers
- Method structure for handle* commands from webview

**getStep5Html() in ideationStepHtml.ts**
- Accordion card structure with expand/collapse toggle
- Editable form fields within cards (inputs, textareas)
- Validation warnings section rendering
- Action buttons layout (Regenerate, primary action)

**Step 4/5 validation pattern**
- Non-blocking warning display that does not prevent navigation
- Warning banner styling and warning-icon usage
- getValidationWarnings() method pattern returning string array

## Out of Scope
- Error response mocking for failure scenario demos (deferred to future iteration)
- Full JSON Schema validation beyond basic syntax checking
- Interactive CSV mapping UI with field mapping interface
- Persistent terminology mappings per customer or industry
- More than 5 sample data rows per tool
- File formats other than CSV and JSON for import
- Real-time collaboration or multi-user editing
- Undo/redo functionality for mock data edits
- Preview panel showing rendered mock responses
- Export mock data to external files
