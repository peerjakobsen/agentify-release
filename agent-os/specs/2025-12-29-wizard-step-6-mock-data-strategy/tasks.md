# Task Breakdown: Wizard Step 6 Mock Data Strategy

## Overview
Total Tasks: 33

## Task List

### State & Type Definitions

#### Task Group 1: TypeScript Types and State Structure
**Dependencies:** None

- [x] 1.0 Complete state and type definitions
  - [x] 1.1 Write 4 focused tests for MockDataState and MockToolDefinition types
    - Test MockDataState initialization with default values
    - Test MockToolDefinition structure validation
    - Test sampleData array max 5 row constraint
    - Test edited flags (requestEdited, responseEdited, sampleDataEdited)
  - [x] 1.2 Define MockToolDefinition interface in wizardPanel.ts
    - Fields: tool (string), system (string), operation (string)
    - Fields: mockRequest (object), mockResponse (object), sampleData (object[])
    - Fields: expanded (boolean), requestEdited (boolean), responseEdited (boolean), sampleDataEdited (boolean)
    - Reuse pattern from: ProposedAgent interface with edited flags
  - [x] 1.3 Define MockDataState interface in wizardPanel.ts
    - Fields: mockDefinitions (MockToolDefinition[]), useCustomerTerminology (boolean)
    - Fields: isLoading (boolean), error (string | undefined)
    - Fields: step5Hash (string | undefined), aiCalled (boolean)
    - Follow pattern from: AgentDesignState interface
  - [x] 1.4 Create createDefaultMockDataState() factory function
    - Initialize mockDefinitions as empty array
    - Set useCustomerTerminology to false
    - Set isLoading/aiCalled to false
    - Follow pattern from: createDefaultAgentDesignState()
  - [x] 1.5 Add Step 6 commands to WIZARD_COMMANDS in wizardPanel.ts
    - STEP6_UPDATE_REQUEST: 'step6UpdateRequest'
    - STEP6_UPDATE_RESPONSE: 'step6UpdateResponse'
    - STEP6_ADD_ROW: 'step6AddRow'
    - STEP6_UPDATE_ROW: 'step6UpdateRow'
    - STEP6_DELETE_ROW: 'step6DeleteRow'
    - STEP6_TOGGLE_ACCORDION: 'step6ToggleAccordion'
    - STEP6_REGENERATE_ALL: 'step6RegenerateAll'
    - STEP6_IMPORT_DATA: 'step6ImportData'
    - STEP6_TOGGLE_TERMINOLOGY: 'step6ToggleTerminology'
  - [x] 1.6 Add mockData field to IdeationState at path state.mockData
    - Update IdeationState interface
    - Update state initialization
  - [x] 1.7 Ensure state type tests pass
    - Run ONLY the 4 tests written in 1.1
    - Verify types compile without errors

**Acceptance Criteria:**
- The 4 tests written in 1.1 pass
- MockToolDefinition and MockDataState interfaces properly defined
- Factory function creates valid default state
- mockData integrated into IdeationState

### AI Service Layer

#### Task Group 2: Mock Data Generation Service
**Dependencies:** Task Group 1

- [x] 2.0 Complete AI mock data generation service
  - [x] 2.1 Write 6 focused tests for mock data service
    - Test buildMockDataContextMessage() generates correct prompt
    - Test parseMockDefinitionsFromResponse() extracts tool definitions
    - Test generateStep5Hash() produces consistent hashes
    - Test terminology refinement prompt construction
    - Test error handling for malformed AI responses
    - Test system prompt loads from resources/prompts/mock-data-assistant.md
  - [x] 2.2 Create mockDataService.ts following agentDesignService.ts pattern
    - Export getMockDataService() singleton getter
    - Implement streaming with onToken, onComplete, onError events
    - Use vscode.Disposable pattern for cleanup
  - [x] 2.3 Implement buildMockDataContextMessage() function
    - Create `resources/prompts/mock-data-assistant.md` system prompt
    - Include instructions for generating MockToolDefinition JSON format
    - Reference industry context and tool/system information
    - Follow pattern from `agent-design-assistant.md`
    - Extract tools from confirmedAgents in Step 5 state
    - Include tool name, system context, and operation type
    - Request JSON format for mockRequest, mockResponse, and sampleData
  - [x] 2.4 Implement parseMockDefinitionsFromResponse() function
    - Parse JSON array of MockToolDefinition objects from AI response
    - Initialize edited flags to false
    - Set expanded to true for first tool, false for others
    - Handle parsing errors gracefully
  - [x] 2.5 Implement generateStep5Hash() function
    - Hash confirmedAgents array from Step 5 state
    - Use djb2 algorithm matching generateStep4Hash() pattern
  - [x] 2.6 Implement buildTerminologyRefinementMessage() function
    - Include current mockDefinitions in context
    - Use prompt: "Regenerate sample data using terminology typical for {industry}"
    - Preserve schema structure, only update sampleData values
  - [x] 2.7 Ensure mock data service tests pass
    - Run ONLY the 6 tests written in 2.1
    - Verify message building and parsing functions work correctly

**Acceptance Criteria:**
- The 6 tests written in 2.1 pass
- Service follows agentDesignService.ts streaming pattern
- Context messages correctly extract Step 5 tool information
- Response parsing handles both valid and malformed responses

### Logic Handler Layer

#### Task Group 3: Step 6 Logic Handler
**Dependencies:** Task Group 2

- [x] 3.0 Complete Step 6 logic handler
  - [x] 3.1 Write 6 focused tests for Step6LogicHandler
    - Test triggerAutoSend() triggers AI when aiCalled is false
    - Test triggerAutoSend() re-triggers when step5Hash changes
    - Test handleRegenerateAll() resets state and calls AI
    - Test handleUpdateMockRequest() sets requestEdited flag
    - Test handleToggleTerminology() triggers refinement request
    - Test getValidationWarnings() returns correct warnings
  - [x] 3.2 Create ideationStep6Logic.ts following ideationStep5Logic.ts pattern
    - Define Step6ContextInputs interface with confirmedAgents, industry
    - Define Step6Callbacks interface with updateWebviewContent, syncStateToWebview
    - Create Step6LogicHandler class
  - [x] 3.3 Implement triggerAutoSend() method
    - Check if step5Hash has changed or aiCalled is false
    - Reset state if hash changed
    - Call sendMockDataContextToClaude()
    - Follow pattern from Step5LogicHandler.triggerAutoSend()
  - [x] 3.4 Implement streaming handlers
    - handleMockDataStreamingToken() accumulates response
    - handleMockDataStreamingComplete() parses and updates state
    - handleMockDataStreamingError() sets error state
    - Follow pattern from Step 5 streaming handlers
  - [x] 3.5 Implement mock definition editing methods
    - handleUpdateMockRequest(toolIndex, jsonString) with requestEdited flag
    - handleUpdateMockResponse(toolIndex, jsonString) with responseEdited flag
    - handleToggleAccordion(toolIndex) for expand/collapse
  - [x] 3.6 Implement sample data editing methods
    - handleAddSampleRow(toolIndex) with max 5 row limit
    - handleUpdateSampleRow(toolIndex, rowIndex, data) with sampleDataEdited flag
    - handleDeleteSampleRow(toolIndex, rowIndex)
  - [x] 3.7 Implement bulk action methods
    - handleRegenerateAll() resets and re-fetches from AI
    - handleToggleTerminology(enabled) triggers refinement if enabled
  - [x] 3.8 Implement getValidationWarnings() method
    - Warning if tool has empty sampleData array
    - Warning if mockRequest or mockResponse is empty/invalid JSON
    - Return string array for display
    - Follow pattern from Step5LogicHandler.getValidationWarnings()
  - [x] 3.9 Ensure logic handler tests pass
    - Run ONLY the 6 tests written in 3.1
    - Verify state transitions and flag updates work correctly

**Acceptance Criteria:**
- The 6 tests written in 3.1 pass
- Logic handler follows Step 5 pattern with hash-based change detection
- All editing methods properly set edited flags
- Validation warnings generated correctly

### File Import Utility

#### Task Group 4: CSV/JSON File Import
**Dependencies:** Task Group 1

- [x] 4.0 Complete file import utility
  - [x] 4.1 Write 4 focused tests for file import
    - Test CSV parsing extracts rows correctly
    - Test JSON array parsing extracts rows correctly
    - Test field auto-mapping (case-insensitive)
    - Test file size validation (max 1MB)
  - [x] 4.2 Create mockDataImportUtils.ts utility file
    - Export parseImportFile() function
    - Export mapFieldsToSchema() function
    - Export ImportResult interface with rows, mappedFields, ignoredFields
  - [x] 4.3 Implement CSV parsing
    - Parse CSV string to array of objects
    - Use first row as header for field names
    - Handle quoted values with commas
    - Limit to first 5 rows (max sample data constraint)
  - [x] 4.4 Implement JSON parsing
    - Parse JSON array of objects
    - Validate array structure
    - Limit to first 5 rows
  - [x] 4.5 Implement field auto-mapping
    - Match import fields to mockResponse schema keys
    - Case-insensitive matching
    - Use placeholder values for missing required fields
    - Track mapped and ignored fields for summary
  - [x] 4.6 Implement handleImportSampleData(toolIndex: number) in logic handler
    - Import applies to single tool's sample data (each tool has different schema)
    - File picker triggered from import button within tool's accordion
    - Open file picker for CSV/JSON files
    - Validate file size (max 1MB)
    - Parse file and map to tool's mockResponse schema
    - Update sampleData and set sampleDataEdited flag
    - Return import summary message
  - [x] 4.7 Ensure file import tests pass
    - Run ONLY the 4 tests written in 4.1
    - Verify parsing and mapping work correctly

**Acceptance Criteria:**
- The 4 tests written in 4.1 pass
- CSV and JSON files parsed correctly
- Field mapping is case-insensitive
- Import summary shows mapped/ignored fields

### UI Components

#### Task Group 5: HTML Rendering and JSON Editor
**Dependencies:** Task Groups 3, 4

- [x] 5.0 Complete UI components and HTML rendering
  - [x] 5.1 Write 5 focused tests for Step 6 HTML rendering
    - Test accordion rendering for each tool
    - Test JSON editor with syntax highlighting
    - Test sample data table rendering
    - Test validation warnings section
    - Test action buttons (Regenerate All, Import Sample Data)
  - [x] 5.2 Create getStep6Html() function in ideationStepHtml.ts
    - Follow getStep5Html() structure and styling
    - Render loading state during AI generation
    - Render error state if AI call fails
  - [x] 5.3 Implement accordion card structure for each tool
    - Header shows tool name and system
    - Expand/collapse toggle button
    - Follow Step 5 accordion card styling
    - Track expanded state per tool
  - [x] 5.4 Implement JSON editor component
    - Use tokenizeJson() from logPanelHtmlGenerator.ts for syntax highlighting
    - Apply CSS classes: json-string, json-number, json-boolean, json-null, json-key
    - Use textarea for editing with onchange handler
    - Show "Invalid JSON" warning if malformed
  - [x] 5.5 Implement sample data table component
    - Columns derived from mockResponse schema keys
    - Inline cell editing with input fields (type='text' for strings, type='number' for numbers)
    - Parse and validate cell values on blur/change
    - Add row button (disabled if 5 rows, show "+5 more rows available")
    - Delete row button per row
  - [x] 5.6 Implement action buttons section
    - "Regenerate All" button triggers handleRegenerateAll (global action)
    - "Use Customer Terminology" toggle button (global action)
    - Move "Import Sample Data" button inside each accordion, below sample data table
    - Import button calls STEP6_IMPORT_DATA with toolIndex parameter
    - Follow Step 5 button layout and styling for global actions
  - [x] 5.7 Implement validation warnings section
    - Render warnings from getValidationWarnings()
    - Follow Step 5 validation-warnings styling
    - Non-blocking (no disabled continue button)
  - [x] 5.8 Add import summary display
    - Display import summary within the tool's accordion (not global)
    - Show below the import button after successful import
    - Show "Imported X rows. Mapped: field1, field2. Ignored: field3"
    - Auto-dismiss or dismissable
  - [x] 5.9 Ensure UI component tests pass
    - Run ONLY the 5 tests written in 5.1
    - Verify HTML rendering produces correct structure

**Acceptance Criteria:**
- The 5 tests written in 5.1 pass
- Accordions render with correct expand/collapse behavior
- JSON editors show syntax highlighting
- Sample data tables support CRUD operations
- Validation warnings display correctly

### Integration Layer

#### Task Group 6: Webview Integration and Navigation
**Dependencies:** Task Group 5

- [x] 6.0 Complete webview integration
  - [x] 6.1 Write 3 focused tests for webview integration
    - Test step navigation triggers auto-send
    - Test webview message handling for Step 6 commands
    - Test state persistence across step navigation
  - [x] 6.2 Add Step 6 case to getStepContent() in ideationStepHtml.ts
    - Route to getStep6Html() when step is 6
    - Pass mockData state and context
  - [x] 6.3 Add Step 6 command handlers to webview message handler
    - Handle: WIZARD_COMMANDS.STEP6_UPDATE_REQUEST, WIZARD_COMMANDS.STEP6_UPDATE_RESPONSE
    - Handle: WIZARD_COMMANDS.STEP6_ADD_ROW, WIZARD_COMMANDS.STEP6_UPDATE_ROW, WIZARD_COMMANDS.STEP6_DELETE_ROW
    - Handle: WIZARD_COMMANDS.STEP6_TOGGLE_ACCORDION, WIZARD_COMMANDS.STEP6_REGENERATE_ALL
    - Handle: WIZARD_COMMANDS.STEP6_IMPORT_DATA, WIZARD_COMMANDS.STEP6_TOGGLE_TERMINOLOGY
    - Follow pattern from Step 5 command handlers using WIZARD_COMMANDS constants
  - [x] 6.4 Wire triggerAutoSend() to step navigation
    - Call when entering Step 6
    - Pass confirmedAgents from Step 5 and industry from Step 1
  - [x] 6.5 Implement back navigation from Step 7 to Step 6
    - Preserve mock data state (do not reset)
    - Follow pattern from handleBackNavigationToStep5()
  - [x] 6.6 Ensure webview integration tests pass
    - Run ONLY the 3 tests written in 6.1
    - Verify navigation and command handling work correctly

**Acceptance Criteria:**
- The 3 tests written in 6.1 pass
- Step 6 integrates into wizard navigation flow
- All webview commands handled correctly
- State persists across navigation

### Testing

#### Task Group 7: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-6

- [x] 7.0 Review existing tests and fill critical gaps only
  - [x] 7.1 Review tests from Task Groups 1-6
    - Review 4 tests from state/types (Task 1.1)
    - Review 6 tests from AI service (Task 2.1)
    - Review 6 tests from logic handler (Task 3.1)
    - Review 4 tests from file import (Task 4.1)
    - Review 5 tests from UI components (Task 5.1)
    - Review 3 tests from webview integration (Task 6.1)
    - Total existing tests: 112 tests (expanded from original 28 with additional coverage)
  - [x] 7.2 Analyze test coverage gaps for Step 6 feature only
    - Identify critical user workflows lacking coverage
    - Focus on end-to-end flows: AI generation -> editing -> import -> validation
    - Prioritize integration between components
  - [x] 7.3 Write up to 7 additional strategic tests maximum
    - End-to-end: Step 5 confirmation -> Step 6 auto-generation
    - End-to-end: Edit mock data -> navigate away -> return preserves edits
    - Integration: Import CSV -> verify sample data table updates
    - Integration: Toggle terminology -> verify sample data regeneration
    - Edge case: Empty confirmedAgents produces helpful error
    - Edge case: AI returns malformed JSON shows error state
    - Edge case: Import file exceeds 1MB shows validation error
  - [x] 7.4 Run feature-specific tests only
    - Run ONLY tests related to Step 6 feature (tests from 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, and 7.3)
    - Expected total: approximately 35 tests maximum
    - Do NOT run entire application test suite
    - Verify all critical workflows pass

**Acceptance Criteria:**
- All feature-specific tests pass (124 tests total)
- Critical user workflows for Step 6 are covered
- 12 additional test assertions added across 7 strategic test scenarios
- Testing focused exclusively on Step 6 feature requirements

## Execution Order

Recommended implementation sequence:

1. **State & Types (Task Group 1)** - Foundation for all other work
2. **AI Service Layer (Task Group 2)** - Core AI integration (depends on types)
3. **File Import Utility (Task Group 4)** - Can run in parallel with Task Group 2
4. **Logic Handler (Task Group 3)** - Orchestrates service and utilities (depends on 2, 4)
5. **UI Components (Task Group 5)** - Renders state (depends on 3, 4)
6. **Webview Integration (Task Group 6)** - Wires everything together (depends on 5)
7. **Test Review (Task Group 7)** - Final verification (depends on all)

## Key Patterns to Follow

| Pattern | Source File | Usage |
|---------|-------------|-------|
| Hash-based change detection | ideationStep5Logic.ts | triggerAutoSend() with step5Hash |
| Streaming AI service | agentDesignService.ts | onToken, onComplete, onError events |
| Edited flags per field | ProposedAgent in wizardPanel.ts | requestEdited, responseEdited flags |
| JSON syntax highlighting | logPanelHtmlGenerator.ts | tokenizeJson() function |
| Accordion cards | ideationStepHtml.ts getStep5Html() | Collapsible tool cards |
| Validation warnings | ideationStep5Logic.ts | getValidationWarnings() returning string[] |
| Non-blocking validation | Steps 4-5 pattern | Warnings displayed, navigation allowed |

## Technical Notes

- **State path:** `state.mockData` in IdeationState
- **Max sample rows:** 5 per tool (enforced in UI and logic)
- **File size limit:** 1MB for CSV/JSON imports
- **JSON validation:** Basic syntax only (no JSON Schema)
- **Output destination:** Phase 4 steering file generation (integration-landscape.md)
