# Task Breakdown: Ideation Wizard Panel & Business Objective Step

## Overview
Total Tasks: 4 Task Groups with 28 sub-tasks

## Task List

### Types & Interfaces Layer

#### Task Group 1: WizardState Type Definitions
**Dependencies:** None

- [x] 1.0 Complete type definitions for wizard state management
  - [x] 1.1 Write 2-4 focused tests for WizardState interface and validation types
    - Test file: `src/test/types/wizardPanel.test.ts`
    - Test WizardState interface shape matches spec requirements
    - Test WizardValidationError type allows required field types (businessObjective, industry) and warning types (systems)
    - Test UploadedFile interface for file metadata structure
  - [x] 1.2 Create WizardState interface in `src/types/wizardPanel.ts`
    - Fields: currentStep (number), businessObjective (string), industry (string), customIndustry (optional string), systems (string[]), customSystems (optional string), uploadedFile (optional object with name, size, data as Uint8Array)
    - Follow established naming conventions from `inputPanel.ts`
    - Add JSDoc documentation for each field
  - [x] 1.3 Create WizardValidationError interface
    - Fields: type (string union for 'businessObjective' | 'industry' | 'systems'), message (string), severity ('error' | 'warning')
    - Distinguish between blocking errors and soft warnings
  - [x] 1.4 Create WizardValidationState interface
    - Fields: isValid (boolean), errors (WizardValidationError[]), hasWarnings (boolean)
  - [x] 1.5 Define WizardStep enum and WIZARD_STEPS constant array
    - Steps: BusinessContext (1), AIGapFilling (2), AgentDesign (3), MockData (4), DemoStrategy (5), Generate (6)
    - Include step labels for display
  - [x] 1.6 Define INDUSTRY_OPTIONS and SYSTEM_OPTIONS constants
    - Industry options: Retail, FSI, Healthcare, Life Sciences, Manufacturing, Energy, Telecom, Public Sector, Media & Entertainment, Travel & Hospitality, Other
    - System options grouped by category: CRM (Salesforce, HubSpot, Dynamics), ERP (SAP S/4HANA, Oracle, NetSuite), Data (Databricks, Snowflake, Redshift), HR (Workday, SuccessFactors), Service (ServiceNow, Zendesk)
  - [x] 1.7 Define WIZARD_COMMANDS constant
    - Message command strings: 'nextStep', 'previousStep', 'goToStep', 'updateBusinessObjective', 'updateIndustry', 'updateCustomIndustry', 'toggleSystem', 'updateCustomSystems', 'uploadFile', 'removeFile', 'syncState'
    - Ensures type-safe message handling between webview and extension
  - [x] 1.8 Ensure type definition tests pass
    - Run ONLY the 2-4 tests written in 1.1
    - Verify TypeScript compilation succeeds

**Acceptance Criteria:**
- The 2-4 tests written in 1.1 pass
- All interfaces compile without TypeScript errors
- Types follow established patterns from inputPanel.ts
- JSDoc documentation complete for all exported types

### Wizard Navigation Framework

#### Task Group 2: Wizard Navigation UI Framework
**Dependencies:** Task Group 1

- [x] 2.0 Complete wizard navigation framework
  - [x] 2.1 Write 2-4 focused tests for wizard navigation logic
    - Test file: `src/test/panels/ideationWizardPanel.navigation.test.ts`
    - Test step navigation state transitions (forward only when valid, back always)
    - Test direct step click behavior (allow completed, block unvisited)
    - Test step validation gating (Next button disabled when invalid)
  - [x] 2.2 Extend IdeationWizardPanelProvider with WizardState instance variable
    - Path: `src/panels/ideationWizardPanel.ts`
    - Initialize default WizardState on construction
    - State preserved when panel hidden/shown (instance variable, not workspace state)
    - State lost on dispose (per spec, persistence added in roadmap item 22)
  - [x] 2.3 Implement getWizardHtmlContent() method for full wizard HTML
    - Replace existing getHtmlContent() placeholder
    - Include Content-Security-Policy meta tag matching DemoViewerPanel
    - Use VS Code theme CSS variables (--vscode-*) for styling
    - Structure: header with step indicator, main content area, footer with navigation buttons
  - [x] 2.4 Generate horizontal 6-step indicator HTML/CSS
    - Visual states: completed (checkmark icon), current (highlighted), pending (grayed)
    - Step labels: Business Context, AI Gap Filling, Agent Design, Mock Data, Demo Strategy, Generate
    - Click handlers: completed steps navigate immediately, current step does nothing, unvisited steps are disabled (no click handler)
    - Flexbox layout, responsive width
  - [x] 2.5 Generate navigation button HTML/CSS
    - Back button: Always enabled except on Step 1
    - Next button: Enabled only when currentStep validation passes
    - Button styling per VS Code theme variables
  - [x] 2.6 Implement step content container with placeholders for Steps 2-6
    - Show placeholder text for unimplemented steps
    - Container receives step-specific content via generateStepContent(step) method
  - [x] 2.7 Implement handleMessage for navigation commands
    - Commands: 'nextStep', 'previousStep', 'goToStep'
    - Validate before allowing forward navigation
    - Update WizardState.currentStep and re-render
  - [x] 2.8 Implement syncStateToWebview() for wizard state synchronization
    - Send current step, validation state, form values to webview
    - Follow pattern from DemoViewerPanel.syncStateToWebview()
  - [x] 2.9 Ensure wizard navigation tests pass
    - Run ONLY the 2-4 tests written in 2.1
    - Verify navigation state machine works correctly

**Acceptance Criteria:**
- The 2-4 tests written in 2.1 pass
- 6-step indicator renders with correct visual states
- Back navigation works from any step
- Next navigation blocked when validation fails
- Direct step click only works for completed steps
- State preserved across panel hide/show

### Step 1 Business Context UI

#### Task Group 3: Step 1 Form Implementation
**Dependencies:** Task Group 2

- [x] 3.0 Complete Step 1 Business Context form UI
  - [x] 3.1 Write 2-4 focused tests for Step 1 form components
    - Test file: `src/test/panels/ideationWizardPanel.step1.test.ts`
    - Test business objective textarea binding and required validation
    - Test industry dropdown with "Other" conditional field
    - Test file upload size/format validation (5MB limit, .pdf/.docx/.txt/.md)
  - [x] 3.2 Implement generateStep1Html() method for Business Context form
    - Form container with proper section spacing
    - All form elements with appropriate labels and placeholders
    - CSS Grid layout for system checkboxes
  - [x] 3.3 Implement business objective textarea
    - Multi-line textarea with placeholder text
    - Required field indicator
    - Bind value to WizardState.businessObjective
    - Inline error display when empty on Next attempt
  - [x] 3.4 Implement industry vertical dropdown
    - Required select with all industry options from INDUSTRY_OPTIONS constant
    - Conditional "Other industry" text input when "Other" selected
    - Bind to WizardState.industry and WizardState.customIndustry
    - Inline error display when not selected on Next attempt
  - [x] 3.5 Implement system checkboxes grid
    - CSS Grid layout with category headers as subheadings (not collapsible)
    - Categories: CRM, ERP, Data, HR, Service with systems per SYSTEM_OPTIONS
    - Responsive: 2 columns on narrow panels using container query or media query
    - Bind selected values to WizardState.systems array
    - Optional with soft warning (yellow banner) if none selected
  - [x] 3.6 Implement "Other systems" text input
    - Free-text input field for additional systems
    - Optional field, no validation
    - Bind to WizardState.customSystems
  - [x] 3.7 Implement file upload component
    - Single file upload button with accepted formats: .pdf, .docx, .txt, .md
    - Size limit validation: 5MB max with error message
    - After upload: display filename + size + Remove button
    - Store as Uint8Array in WizardState.uploadedFile with name and size metadata
    - File stored in memory only (not persisted to disk)
  - [x] 3.8 Implement handleMessage for Step 1 form commands
    - Commands: 'updateBusinessObjective', 'updateIndustry', 'updateCustomIndustry', 'toggleSystem', 'updateCustomSystems', 'uploadFile', 'removeFile'
    - Update WizardState on each command
    - Re-validate and sync state to webview
  - [x] 3.9 Implement Step 1 validation logic
    - businessObjective: Required - show inline error when empty
    - industry: Required - show inline error when not selected
    - systems: Optional with soft warning (yellow banner) if none selected - does NOT block Next
    - uploadedFile: Optional, validate size (5MB) and format (.pdf, .docx, .txt, .md)
    - Validation runs on Next click; does not block Back navigation
  - [x] 3.10 Ensure Step 1 form tests pass
    - Run ONLY the 2-4 tests written in 3.1
    - Verify all form bindings work correctly

**Acceptance Criteria:**
- The 2-4 tests written in 3.1 pass
- Business objective textarea validates as required
- Industry dropdown shows conditional "Other" field
- System checkboxes render in grid with category headers
- Responsive layout stacks to 2 columns on narrow panels
- File upload validates size and format
- Soft warning appears when no systems selected but does not block navigation

### Testing

#### Task Group 4: Test Review & Integration Testing
**Dependencies:** Task Groups 1-3

- [x] 4.0 Review existing tests and fill critical gaps only
  - [x] 4.1 Review tests from Task Groups 1-3
    - Review the 2-4 tests written for types (Task 1.1)
    - Review the 2-4 tests written for navigation (Task 2.1)
    - Review the 2-4 tests written for Step 1 form (Task 3.1)
    - Total existing tests: approximately 6-12 tests
  - [x] 4.2 Analyze test coverage gaps for this feature only
    - Identify critical user workflows that lack test coverage
    - Focus on end-to-end wizard flow: form input -> validation -> navigation
    - Check webview-extension message passing integration
    - Do NOT assess entire application test coverage
  - [x] 4.3 Write up to 6 additional strategic tests maximum
    - Test file: `src/test/panels/ideationWizardPanel.integration.test.ts`
    - Test complete Step 1 -> validation -> Next button flow
    - Test state preservation across panel hide/show
    - Test file upload with valid/invalid files
    - Test soft warning vs blocking error behavior
    - Do NOT write comprehensive coverage for all scenarios
  - [x] 4.4 Run feature-specific tests only
    - Run ONLY tests related to wizard panel feature (tests from 1.1, 2.1, 3.1, and 4.3)
    - Expected total: approximately 12-18 tests maximum
    - Do NOT run the entire application test suite
    - Verify critical workflows pass

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 12-18 tests total)
- Critical user workflows for wizard Step 1 are covered
- No more than 6 additional tests added when filling gaps
- Testing focused exclusively on this spec's feature requirements

## Execution Order

Recommended implementation sequence:
1. Types & Interfaces Layer (Task Group 1) - Define data structures first
2. Wizard Navigation Framework (Task Group 2) - Build navigation infrastructure
3. Step 1 Business Context UI (Task Group 3) - Implement form UI and bindings
4. Test Review & Integration Testing (Task Group 4) - Verify complete feature

## Files to Create/Modify

**New Files:**
- `src/types/wizardPanel.ts` - Type definitions
- `src/test/types/wizardPanel.test.ts` - Type tests
- `src/test/panels/ideationWizardPanel.navigation.test.ts` - Navigation tests
- `src/test/panels/ideationWizardPanel.step1.test.ts` - Step 1 form tests
- `src/test/panels/ideationWizardPanel.integration.test.ts` - Integration tests

**Modified Files:**
- `src/panels/ideationWizardPanel.ts` - Main implementation

**Reference Files:**
- `src/panels/demoViewerPanel.ts` - Pattern for inline HTML/CSS/JS generation
- `src/services/inputPanelValidation.ts` - Validation pattern reference
- `src/types/inputPanel.ts` - Type definition patterns

## Technical Notes

- Follow existing DemoViewerPanel inline HTML pattern (no separate React build)
- Use VS Code webview API (WebviewViewProvider interface)
- Message passing between webview and extension via postMessage/onDidReceiveMessage
- CSS Grid for system checkbox layout with container queries for responsiveness
- File stored as Uint8Array for later use by Claude in Step 2 (roadmap item 15)
- Design wizard framework to be extensible for remaining 5 steps
- Use VS Code theme CSS variables (--vscode-*) for consistent styling
