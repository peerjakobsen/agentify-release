# Task Breakdown: Security & Guardrails Step (Wizard Step 4)

## Overview
Feature: Wizard Step 4 for compliance and approval gate configuration in the Ideation Wizard

## Task List

### Foundation Layer

#### Task Group 1: State Management & Types
**Dependencies:** None

- [x] 1.0 Complete state management foundation
  - [x] 1.1 Write 4 focused tests for SecurityGuardrailsState in `src/test/panels/tabbedPanel.step4.test.ts`
    - Test default state creation with correct initial values
    - Test industry-to-compliance mapping function
    - Test state reset when industry changes
    - Test skipped flag behavior
  - [x] 1.2 Create SecurityGuardrailsState interface in tabbedPanel.ts
    - Add fields: `dataSensitivity: string` (default: 'Internal')
    - Add fields: `complianceFrameworks: string[]` (default: empty array)
    - Add fields: `approvalGates: string[]` (default: empty array)
    - Add fields: `guardrailNotes: string` (default: empty string)
    - Add fields: `aiSuggested: boolean` (default: false)
    - Add fields: `aiCalled: boolean` (default: false)
    - Add fields: `skipped: boolean` (default: false)
    - Add fields: `industryDefaultsApplied: boolean` (default: false)
    - Follow pattern from `OutcomeDefinitionState` interface
  - [x] 1.3 Add securityGuardrails field to IdeationState interface
    - Reference: `IdeationState` interface in tabbedPanel.ts
    - Type: `SecurityGuardrailsState`
  - [x] 1.4 Create INDUSTRY_COMPLIANCE_MAPPING constant
    - Healthcare: ['HIPAA']
    - Life Sciences: ['HIPAA']
    - FSI: ['PCI-DSS', 'SOC 2']
    - Retail: ['PCI-DSS']
    - Public Sector: ['FedRAMP']
    - Energy: ['SOC 2']
    - Telecom: ['SOC 2']
    - Manufacturing: []
    - Media & Entertainment: []
    - Travel & Hospitality: ['PCI-DSS']
    - Other: []
  - [x] 1.5 Create helper constants for Step 4 options
    - DATA_SENSITIVITY_OPTIONS:
      ```typescript
      [
        { value: 'Public', label: 'Public', helperText: 'Data that can be shown to anyone. Example: product catalog, public pricing' },
        { value: 'Internal', label: 'Internal', helperText: 'Business data not for external sharing. Example: sales forecasts, inventory levels' },
        { value: 'Confidential', label: 'Confidential', helperText: 'Sensitive business data. Example: customer lists, financial reports' },
        { value: 'Restricted', label: 'Restricted', helperText: 'Highly sensitive, regulatory implications. Example: PII, health records, payment data' }
      ]
      ```
    - COMPLIANCE_FRAMEWORK_OPTIONS: ['SOC 2', 'HIPAA', 'PCI-DSS', 'GDPR', 'FedRAMP', 'None/Not specified']
    - APPROVAL_GATE_OPTIONS: array of gate strings
  - [x] 1.6 Update createDefaultIdeationState() to include securityGuardrails
    - Reference: createDefaultIdeationState() function in tabbedPanel.ts
    - Initialize with default values (Internal sensitivity, empty arrays)
  - [x] 1.7 Ensure state foundation tests pass
    - Run ONLY the 4 tests written in 1.1
    - Verify type definitions compile correctly

**Acceptance Criteria:**
- SecurityGuardrailsState interface defined with all required fields
- IdeationState extended with securityGuardrails field
- Default state initialization working correctly
- Industry-to-compliance mapping implemented
- 4 tests pass

### Message Handling Layer

#### Task Group 2: Message Handlers
**Dependencies:** Task Group 1

- [x] 2.0 Complete message handling infrastructure
  - [x] 2.1 Write 4 focused tests for message handlers in `src/test/panels/tabbedPanel.step4.test.ts`
    - Test updateDataSensitivity command updates state correctly
    - Test toggleComplianceFramework adds/removes framework
    - Test toggleApprovalGate adds/removes gate
    - Test updateGuardrailNotes clears aiSuggested flag
  - [x] 2.2 Add Step 4 message handlers to handleIdeationMessage()
    - Handle: 'updateDataSensitivity' - sets dataSensitivity value
    - Handle: 'toggleComplianceFramework' - toggles framework in array
    - Handle: 'toggleApprovalGate' - toggles gate in array
    - Handle: 'updateGuardrailNotes' - updates notes and clears aiSuggested flag
    - Handle: 'skipSecurityStep' - applies defaults and sets skipped: true
    - Reference pattern: toggleSystem handler in handleIdeationMessage()
  - [x] 2.3 Implement industry change detection for compliance reset
    - When industry changes in Step 1, reset industryDefaultsApplied to false
    - Add to 'updateIndustry' handler in handleIdeationMessage()
    - Preserve other Step 4 state unless industry changed
  - [x] 2.4 Add state sync for Step 4 fields in syncStateToWebview()
    - Reference: syncStateToWebview method in tabbedPanel.ts
    - Include securityGuardrails in state sync
  - [x] 2.5 Ensure message handler tests pass
    - Run ONLY the 4 tests written in 2.1
    - Verify state updates propagate correctly

**Acceptance Criteria:**
- All 6 message types handled correctly
- State updates trigger UI re-render
- Industry change resets compliance defaults flag
- 4 tests pass

### UI Components Layer

#### Task Group 3: Step 4 HTML Generation
**Dependencies:** Task Group 2

- [x] 3.0 Complete Step 4 HTML rendering
  - [x] 3.1 Write 4 focused tests for HTML generation in `src/test/panels/tabbedPanel.step4.test.ts`
    - Test radio button renders with correct selection
    - Test checkbox grid renders with correct checked states
    - Test helper text displays for each sensitivity level
    - Test AI suggested badge visibility based on aiSuggested flag
  - [x] 3.2 Create getStep4Html() method
    - Follow pattern from getStep3Html() in tabbedPanel.ts
    - Return complete HTML for Security & Guardrails step
    - Include loading state handling for AI suggestions
  - [x] 3.3 Implement Data Sensitivity radio button section
    - Four mutually exclusive options: Public, Internal, Confidential, Restricted
    - Pre-select 'Internal' by default
    - Display inline helper text for each option using values from DATA_SENSITIVITY_OPTIONS
    - Reuse radio button styling from getStep1Html()
  - [x] 3.4 Implement Compliance Frameworks checkbox grid
    - Six checkboxes: SOC 2, HIPAA, PCI-DSS, GDPR, FedRAMP, None/Not specified
    - Use two-column grid layout (systems-grid CSS class)
    - Reuse system-option class styling
  - [x] 3.5 Implement Human Approval Gates checkbox section
    - Four predefined checkboxes
    - Labels: "Before external API calls", "Before data modification", "Before sending recommendations", "Before financial transactions"
    - Default: none selected
  - [x] 3.6 Implement Guardrail Notes textarea
    - Optional free-form textarea
    - Placeholder text: "Additional security constraints..."
    - Display "AI suggested" badge when aiSuggested is true
    - Badge disappears once user edits (tracked via handler)
  - [x] 3.7 Add Skip button to navigation area
    - Position alongside Back/Next buttons
    - Style as secondary button
    - Reference nav-buttons section in getStepContentHtml()
  - [x] 3.8 Update getStepContentHtml() to route to getStep4Html()
    - Add condition for currentStep === 4
  - [x] 3.9 Ensure HTML generation tests pass
    - Run ONLY the 4 tests written in 3.1
    - Verify HTML output matches expected structure

**Acceptance Criteria:**
- Step 4 renders with all form sections
- Radio buttons are mutually exclusive
- Checkboxes support multiple selection
- AI suggested badge displays/hides correctly
- Skip button is visible and styled
- 4 tests pass

### Styling Layer

#### Task Group 4: CSS Styles
**Dependencies:** Task Group 3

- [x] 4.0 Complete Step 4 styling
  - [x] 4.1 Write 2 focused tests for CSS output in `src/test/panels/tabbedPanel.step4.test.ts`
    - Test Step 4 specific styles are included in getIdeationStyles()
    - Test AI suggested badge styling is present
  - [x] 4.2 Add Step 4 specific CSS to getIdeationStyles()
    - Add radio button wrapper styles for data sensitivity
    - Add helper text inline styles
    - Add AI suggested badge styles (small indicator)
    - Reuse existing form-section, form-label patterns
  - [x] 4.3 Add Skip button styling
    - Secondary button style variation
    - Visual distinction from primary Next button
    - Hover and disabled states
  - [x] 4.4 Ensure CSS tests pass
    - Run ONLY the 2 tests written in 4.1
    - Verify styles render correctly in webview

**Acceptance Criteria:**
- Step 4 matches visual design system
- Radio buttons and checkboxes are consistently styled
- AI suggested badge is subtle but visible
- Skip button has appropriate visual weight
- 2 tests pass

### Script Layer

#### Task Group 5: JavaScript Functions
**Dependencies:** Task Group 4

- [x] 5.0 Complete Step 4 JavaScript functions
  - [x] 5.1 Write 3 focused tests for JavaScript handlers in `src/test/panels/tabbedPanel.step4.test.ts`
    - Test updateDataSensitivity sends correct message
    - Test toggleComplianceFramework sends correct message
    - Test skipSecurityStep sends command and navigates
  - [x] 5.2 Add Step 4 functions to getIdeationScript()
    - Add: updateDataSensitivity(value) - posts message
    - Add: toggleComplianceFramework(framework) - posts toggle message
    - Add: toggleApprovalGate(gate) - posts toggle message
    - Add: updateGuardrailNotes(value) - posts message
    - Add: skipSecurityStep() - posts skip command
    - Reference pattern: toggleStakeholder function in getIdeationScript()
  - [x] 5.3 Add textarea input handler for guardrail notes
    - Debounce input to avoid excessive message posting
    - Clear AI suggested flag on any edit
  - [x] 5.4 Ensure JavaScript tests pass
    - Run ONLY the 3 tests written in 5.1
    - Verify functions post correct messages

**Acceptance Criteria:**
- All form interactions send correct messages
- Skip button navigates forward with skipped flag
- Textarea editing clears AI suggested indicator
- 3 tests pass

### Navigation Layer

#### Task Group 6: Navigation Integration
**Dependencies:** Task Group 5

- [x] 6.0 Complete navigation integration
  - [x] 6.1 Write 3 focused tests for navigation in `src/test/panels/tabbedPanel.step4.test.ts`
    - Test step entry triggers AI suggestion when conditions met
    - Test back navigation preserves state
    - Test skip navigation applies defaults
  - [x] 6.2 Update ideationNavigateForward() for Step 4 entry
    - Add auto-trigger for AI suggestions when entering Step 4
    - Reference pattern: triggerAutoSendForStep3 in tabbedPanel.ts
    - Only trigger if guardrailNotes empty AND aiCalled is false
  - [x] 6.3 Implement triggerAutoSendForStep4() method
    - Check if guardrailNotes is empty AND aiCalled is false
    - If conditions met, call guardrail suggestion function
    - Set aiCalled to true to prevent repeated calls on back navigation
  - [x] 6.4 Implement industry defaults application on first visit
    - On Step 4 entry, check industryDefaultsApplied flag
    - If false, apply compliance defaults based on industry
    - Set industryDefaultsApplied to true
    - If industry changed since last visit, reapply defaults
  - [x] 6.5 Implement skip functionality in handleIdeationMessage
    - On 'skipSecurityStep': apply defaults (Internal, empty arrays)
    - Set skipped: true
    - Navigate forward (increment currentStep)
  - [x] 6.6 Ensure navigation tests pass
    - Run ONLY the 3 tests written in 6.1
    - Verify step transitions work correctly

**Acceptance Criteria:**
- AI suggestions triggered on first Step 4 entry
- Industry defaults applied on first visit only
- Skip applies defaults and advances to Step 5
- Back navigation preserves all state
- 3 tests pass

### AI Integration Layer

#### Task Group 7: Guardrail Suggestion Utility
**Dependencies:** Task Group 6

- [x] 7.0 Complete AI guardrail suggestion utility
  - [x] 7.1 Write 4 focused tests for guardrail suggestions in `src/test/panels/tabbedPanel.step4.test.ts`
    - Test context message building with all inputs
    - Test parsing guardrail notes from Claude response
    - Test error handling returns fallback text
    - Test aiSuggested flag is set correctly
  - [x] 7.2 Create buildGuardrailContextMessage() utility function
    - Input: businessObjective, industry, systems, confirmedAssumptions
    - Output: Formatted context string for Claude
    - Reference pattern: buildOutcomeContextMessage in outcomeDefinitionService.ts
    - Keep simple - no conversation history needed
  - [x] 7.3 Create parseGuardrailNotesFromResponse() utility function
    - Extract plain text guardrail notes from Claude response
    - No JSON parsing needed - just extract text content
    - Return string or null if parsing fails
  - [x] 7.4 Create sendGuardrailSuggestionRequest() method
    - Initialize Bedrock client (reuse pattern from Step 3)
    - Send single request with context message
    - Wait for complete response (no streaming display needed)
    - On success: populate guardrailNotes, set aiSuggested: true, set aiCalled: true
    - On failure: set fallback text "No PII in demo data, mask account numbers..."
    - Reference: sendOutcomeContextToClaude pattern in outcomeDefinitionService.ts
  - [x] 7.5 Create or extend guardrail suggestion prompt
    - Inline prompt in buildGuardrailContextMessage() (separate file not needed)
    - Simple prompt asking for security guardrail notes based on context
    - Output should be plain text, not JSON
  - [x] 7.6 Ensure AI integration tests pass
    - Run ONLY the 4 tests written in 7.1
    - Verify suggestion populates textarea correctly

**Acceptance Criteria:**
- Context message includes all relevant Step 1-2 data
- AI response populates guardrail notes textarea
- AI suggested badge displays after population
- Fallback text applied on API failure
- 4 tests pass

### Polish Layer

#### Task Group 8: AI Suggested Badge UX
**Dependencies:** Task Group 7

- [x] 8.0 Complete AI suggested badge behavior
  - [x] 8.1 Write 2 focused tests for badge behavior in `src/test/panels/tabbedPanel.step4.test.ts`
    - Test badge visible when aiSuggested is true
    - Test badge hidden after any user edit
  - [x] 8.2 Implement badge visibility logic in getStep4Html()
    - Conditionally render badge based on aiSuggested state
    - Position badge near textarea label or inside textarea container
  - [x] 8.3 Ensure badge clears on edit
    - Verify updateGuardrailNotes handler sets aiSuggested: false
    - Test that any keystroke in textarea clears the badge
  - [x] 8.4 Ensure badge UX tests pass
    - Run ONLY the 2 tests written in 8.1
    - Verify badge appears and disappears correctly

**Acceptance Criteria:**
- Badge visible immediately after AI population
- Badge hidden after any user edit
- Badge does not reappear unless AI regenerates
- 2 tests pass

### Testing

#### Task Group 9: Test Review & Gap Analysis
**Dependencies:** Task Groups 1-8

- [x] 9.0 Review existing tests and fill critical gaps only
  - [x] 9.1 Review tests from Task Groups 1-8 in `src/test/panels/tabbedPanel.step4.test.ts`
    - Review the 4 tests written by Task Group 1 (state management)
    - Review the 4 tests written by Task Group 2 (message handlers)
    - Review the 4 tests written by Task Group 3 (HTML generation)
    - Review the 2 tests written by Task Group 4 (CSS)
    - Review the 3 tests written by Task Group 5 (JavaScript)
    - Review the 3 tests written by Task Group 6 (navigation)
    - Review the 4 tests written by Task Group 7 (AI integration)
    - Review the 2 tests written by Task Group 8 (badge UX)
    - Total existing tests: approximately 26 tests
  - [x] 9.2 Analyze test coverage gaps for Step 4 feature only
    - Identify critical user workflows that lack test coverage
    - Focus ONLY on gaps related to Security & Guardrails step
    - Do NOT assess entire application test coverage
    - Prioritize end-to-end workflows over unit test gaps
  - [x] 9.3 Write up to 6 additional strategic tests maximum in `src/test/panels/tabbedPanel.step4.test.ts`
    - Add maximum of 6 new tests to fill identified critical gaps
    - Focus on integration points and end-to-end workflows
    - Potential gaps to cover:
      - Industry change resets compliance selections
      - Skip then back navigation state preservation
      - Multiple compliance frameworks selection
    - Do NOT write comprehensive coverage for all scenarios
  - [x] 9.4 Run feature-specific tests only
    - Run ONLY tests related to Step 4 feature (all tests from 1.1 through 8.1, plus 9.3)
    - Expected total: approximately 32 tests maximum
    - Do NOT run the entire application test suite
    - Verify critical workflows pass

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 32 tests total)
- Critical user workflows for Step 4 are covered
- No more than 6 additional tests added
- Testing focused exclusively on Security & Guardrails step

## Execution Order

Recommended implementation sequence:
1. State Management & Types (Task Group 1) - Foundation for all other work
2. Message Handlers (Task Group 2) - Connect UI to state
3. Step 4 HTML Generation (Task Group 3) - Build the UI
4. CSS Styles (Task Group 4) - Style the UI
5. JavaScript Functions (Task Group 5) - Enable interactivity
6. Navigation Integration (Task Group 6) - Connect to wizard flow
7. Guardrail Suggestion Utility (Task Group 7) - AI integration
8. AI Suggested Badge UX (Task Group 8) - Polish interaction
9. Test Review & Gap Analysis (Task Group 9) - Final verification

## Files Created
- `src/test/panels/tabbedPanel.step4.test.ts` — Step 4 tests

## Files Modified
- `src/panels/tabbedPanel.ts` — Main Step 4 implementation

## Existing Patterns to Leverage
| Pattern | Location | Usage |
|---------|----------|-------|
| Radio button styling | tabbedPanel.ts:getStep1Html() | Data sensitivity selector |
| Checkbox grid layout | tabbedPanel.ts:systems-grid CSS | Compliance frameworks |
| Form section pattern | tabbedPanel.ts:form-section CSS | All form sections |
| AI service pattern | outcomeDefinitionService.ts | Guardrail suggestions |
| Toggle handler | tabbedPanel.ts:toggleSystem | Checkbox interactions |
| Loading indicator | tabbedPanel.ts:typing-indicator | AI loading state |
| State interface | tabbedPanel.ts:OutcomeDefinitionState | SecurityGuardrailsState |
| Navigation trigger | tabbedPanel.ts:triggerAutoSendForStep3 | Step 4 AI trigger |

## Notes

- Step 4 is designed as a small (S) optional step with Skip capability
- AI integration is simpler than Step 3 - single request, no streaming display
- Industry defaults should only apply on first visit to prevent overwriting user selections
- The "AI suggested" badge provides transparency about AI-generated content
- No "Accept" or "Regenerate" buttons needed - user can edit freely or use Skip
