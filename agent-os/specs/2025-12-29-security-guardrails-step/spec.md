# Specification: Security & Guardrails Step (Wizard Step 4)

## Goal
Build wizard step 4 for compliance and approval gate configuration in the Ideation Wizard, allowing users to define security constraints and human approval requirements for their AI agent demo workflows.

## User Stories
- As a demo builder, I want to specify data sensitivity levels so that the generated demo respects appropriate security constraints
- As a compliance-conscious user, I want relevant compliance frameworks pre-selected based on my industry so that I can quickly configure appropriate guardrails

## Specific Requirements

**Data Sensitivity Classification**
- Radio button group with four mutually exclusive options: Public, Internal, Confidential, Restricted
- Default selection: Internal (pre-selected on first visit)
- Helper text for each option displayed inline with demo-specific examples
- Only one option can be selected at a time
- Value stored in state as `dataSensitivity: string`

**Data Sensitivity Helper Text**
- Public: "e.g., product catalog, public pricing"
- Internal: "e.g., sales forecasts, inventory levels"
- Confidential: "e.g., customer lists, financial reports"
- Restricted: "e.g., PII, health records, payment data"

**Compliance Frameworks Selection**
- Checkbox group with six options: SOC 2, HIPAA, PCI-DSS, GDPR, FedRAMP, None/Not specified
- Multiple frameworks can be selected simultaneously
- "None/Not specified" acts as a regular checkbox, not mutually exclusive
- Industry-aware defaults applied on first step entry only
- Value stored in state as `complianceFrameworks: string[]`

**Industry-to-Compliance Mapping**
- Healthcare: HIPAA
- Life Sciences: HIPAA
- FSI: PCI-DSS, SOC 2
- Retail: PCI-DSS
- Public Sector: FedRAMP
- Energy: SOC 2
- Telecom: SOC 2
- Manufacturing: None
- Media & Entertainment: None
- Travel & Hospitality: PCI-DSS
- Other: None

**Human Approval Gates**
- Checkbox list with four predefined options
- Options: "Before external API calls", "Before data modification", "Before sending recommendations", "Before financial transactions"
- Default: None selected (fully automated demo mode)
- No custom "Other" option - users can add custom notes in Guardrail Notes textarea
- Value stored in state as `approvalGates: string[]`

**Guardrail Notes Textarea**
- Optional free-form textarea for additional security constraints
- AI pre-population triggered on step entry when guardrailNotes is empty and AI has not been called
- Display small "AI suggested" indicator badge while content is AI-generated
- Indicator disappears once user edits the field (tracked via `aiSuggested: boolean`)
- No "Accept" button required - user can edit freely or clear entirely
- No "Regenerate" button - single initial suggestion sufficient
- Fallback placeholder if AI fails: "No PII in demo data, mask account numbers..."

**AI Pre-Population Pattern**
- Create lightweight utility function (not full service class) for guardrail suggestions
- Input context: business objective, industry, systems, confirmed assumptions from Steps 1-2
- Output: Pre-formatted guardrail notes string
- Single request on step entry, populate textarea after complete (no streaming display)
- Track AI call state with `aiCalled: boolean` to prevent repeated calls on back navigation

**Skip Button Behavior**
- Prominent "Skip" button positioned alongside navigation buttons
- On skip: Apply sensible defaults (Internal sensitivity, no frameworks, no gates, empty notes)
- Track explicit skip with `skipped: boolean` state field
- "Skip" button sets `skipped: true` and navigates forward
- Navigate away without Skip: `skipped: false`, values preserved
- Status display in Generate step: checkmark for configured, skip icon for skipped, warning for not configured

**State Management**
- Add `SecurityGuardrailsState` interface to IdeationState
- Fields: dataSensitivity, complianceFrameworks[], approvalGates[], guardrailNotes, aiSuggested, aiCalled, skipped, industryDefaultsApplied
- Track `industryDefaultsApplied: boolean` to apply compliance defaults only on first visit
- Preserve state on back navigation; only reset if Step 1 industry changes

## Existing Code to Leverage

**Radio Button Styling (Step 1)**
- Path: `src/panels/tabbedPanel.ts` method `getStep1Html()`
- Reuse CSS classes for form sections, labels, and validation styling
- Follow same pattern for radio button wrapper and label structure

**Checkbox Grid Layout (Step 1)**
- Path: `src/panels/tabbedPanel.ts` systems-grid CSS class
- Use two-column grid layout for compliance frameworks
- Reuse `system-option` class styling for checkbox items

**AI Service Pattern (OutcomeDefinitionService)**
- Path: `src/services/outcomeDefinitionService.ts`
- Reference `buildOutcomeContextMessage()` for context building structure
- Use simpler utility function approach (no conversation history needed)
- Follow error handling pattern for Bedrock API failures

**Form Section Patterns**
- Existing `.form-section`, `.form-label`, helper text patterns from Steps 1-3
- Loading indicator and typing dots animation from Step 3

**Navigation Integration**
- WIZARD_STEPS constant already includes Step 4 "Security" entry
- Navigation methods `ideationNavigateForward()` and `ideationNavigateBackward()` handle step transitions

## Out of Scope
- Real security validation or enforcement of selected settings
- AWS security service integration (GuardDuty, Security Hub, Macie)
- Compliance attestation or certification workflows
- Role-based access control (RBAC) implementation
- Encryption key management or KMS integration
- Security scanning or vulnerability assessment
- Actual approval gate workflow implementation (configuration capture only)
- Data classification enforcement at runtime
- Two-phase suggestion card pattern (Step 3 style Accept flow)
- Regenerate button for AI guardrail suggestions
- Custom "Other" option for approval gates
