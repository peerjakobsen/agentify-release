# Spec Requirements: Security & Guardrails Step (Wizard Step 4)

## Initial Description
Build wizard step 4 for compliance and approval gate configuration in the Ideation Wizard. This step allows users to configure security settings for their AI agent demo workflows.

### Core Components (from Roadmap Item 17)

**Data Sensitivity Classification:**
- Radio buttons: Public, Internal, Confidential, Restricted
- Helper text explaining each level
- Default: Internal

**Compliance Frameworks (checkboxes):**
- SOC 2, HIPAA, PCI-DSS, GDPR, FedRAMP, None/Not specified
- Industry-aware defaults (Healthcare -> HIPAA pre-checked, FSI -> PCI-DSS + SOC 2)

**Human Approval Gates:**
- Checkbox list of workflow stages where human approval may be required
- Options: "Before external API calls", "Before data modification", "Before sending recommendations", "Before financial transactions"
- Default: None (fully automated demo)

**Guardrail Notes (optional text area):**
- Free-form notes for additional constraints
- On step entry: AI suggests relevant guardrail notes based on context from steps 1-2
- Suggestions are editable, user can modify or clear entirely
- Example placeholder if AI fails: "No PII in demo data, mask account numbers..."

**Step Behavior:**
- This step is optional - "Skip" button available with sensible defaults applied
- Sized as "S" (small) in roadmap estimation

## Requirements Discussion

### First Round Questions

**Q1:** AI-Suggested Guardrail Notes Pattern: I'm assuming the AI suggestions for guardrail notes should follow a simpler pattern than Step 3 (just pre-populate the textarea field on step entry, without the two-phase accept flow). Is that correct, or should it use the full suggestion card + accept pattern like Outcome Definition?
**Answer:** Simpler pattern - just pre-populate the textarea on step entry. Step is small (S), optional with Skip button. On step entry: if guardrailNotes empty AND AI hasn't been called, fire AI request, pre-populate textarea. User can edit freely or clear entirely. No "Accept" button needed. Include small "AI suggested" indicator that disappears once user edits.

**Q2:** Industry-Aware Compliance Defaults: The roadmap mentions Healthcare pre-checks HIPAA and FSI pre-checks PCI-DSS + SOC 2. I'm assuming the other industries should have specific defaults. Should I adjust any of these default mappings?
**Answer:** Complete industry-to-compliance mapping:
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

**Q3:** Skip Button Behavior: When users click "Skip," I'm assuming we apply sensible defaults (Internal classification, no compliance frameworks, no approval gates, empty guardrail notes). Should the wizard remember if they explicitly skipped vs never visited this step?
**Answer:** Track explicit skip vs never visited with `skipped: boolean` state field. "Skip" button sets skipped: true and applies defaults. Navigate away without Skip: skipped: false, values preserved. In Generate step show: checkmark for configured, skip icon for skipped, or warning for not configured.

**Q4:** Data Sensitivity Helper Text: Should the helper text for each classification level (Public, Internal, Confidential, Restricted) include examples specific to AWS demo scenarios, or use generic data classification definitions?
**Answer:** Demo-specific examples:
- Public: product catalog, public pricing
- Internal: sales forecasts, inventory levels
- Confidential: customer lists, financial reports
- Restricted: PII, health records, payment data

**Q5:** Human Approval Gates Extensibility: The roadmap lists four approval gate options. Should there be an "Other" option with a text field for custom approval scenarios?
**Answer:** Four predefined options only, no "Other" custom field. Users can add custom notes in Guardrail Notes textarea if needed.

**Q6:** Guardrail Notes AI Regeneration: Should users be able to regenerate AI suggestions for the guardrail notes (like the "Regenerate" button in Steps 2-3)?
**Answer:** No regenerate button - single initial suggestion sufficient. User can clear and type manually if needed.

**Q7:** Anything you want excluded from this step?
**Answer:** Explicit exclusions provided (see Scope Boundaries below).

### Existing Code to Reference

**Similar Features Identified:**
- Feature: Step 1 (Business Context) - Path: `src/panels/tabbedPanel.ts` (getStep1Html method)
  - Radio button and checkbox grid patterns
  - Form section styling with labels and helper text
- Feature: Step 3 (Outcome Definition) - Path: `src/panels/tabbedPanel.ts` (getStep3Html method)
  - AI pre-population pattern (simpler version needed)
  - Loading state handling
- Feature: OutcomeDefinitionService - Path: `src/services/outcomeDefinitionService.ts`
  - Pattern for creating a dedicated AI service for step-specific suggestions

### Follow-up Questions

No follow-up questions were needed. User provided comprehensive answers covering all aspects.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A - No visuals to analyze.

## Requirements Summary

### Functional Requirements

**Data Sensitivity Classification:**
- Radio button group with four options: Public, Internal, Confidential, Restricted
- Default selection: Internal
- Helper text for each option with demo-specific examples:
  - Public: "e.g., product catalog, public pricing"
  - Internal: "e.g., sales forecasts, inventory levels"
  - Confidential: "e.g., customer lists, financial reports"
  - Restricted: "e.g., PII, health records, payment data"

**Compliance Frameworks:**
- Checkbox group with options: SOC 2, HIPAA, PCI-DSS, GDPR, FedRAMP, None/Not specified
- Industry-aware pre-selection on step entry based on Step 1 industry selection:
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

**Human Approval Gates:**
- Checkbox list with four predefined options:
  - Before external API calls
  - Before data modification
  - Before sending recommendations
  - Before financial transactions
- Default: None selected (fully automated demo)
- No custom "Other" option

**Guardrail Notes:**
- Optional textarea for free-form notes
- AI pre-population on step entry:
  - Trigger: guardrailNotes empty AND AI hasn't been called for this session
  - Display "AI suggested" indicator while content is AI-generated
  - Indicator disappears once user edits the field
  - No "Accept" button required
  - No "Regenerate" button
- Fallback placeholder if AI fails: "No PII in demo data, mask account numbers..."

**Skip Button:**
- Prominent "Skip" button to bypass this optional step
- On skip: Apply defaults (Internal, no frameworks, no gates, empty notes)
- Track skip state with `skipped: boolean` field
- Generate step displays status:
  - Checkmark: Step was configured
  - Skip icon: Step was explicitly skipped
  - Warning: Step was never visited/configured

### Reusability Opportunities
- Radio button styling from Step 1 industry selector
- Checkbox grid layout from Step 1 systems selection
- Form section patterns (label, input, helper text) from existing steps
- AI service pattern from OutcomeDefinitionService (simplified version)
- Loading indicator and error handling from Step 3

### Scope Boundaries

**In Scope:**
- Radio buttons for data sensitivity classification
- Checkboxes for compliance frameworks with industry-aware defaults
- Checkboxes for human approval gates (four predefined options)
- Pre-populated textarea for guardrail notes with AI suggestion
- "AI suggested" indicator that disappears on edit
- Skip button with sensible defaults
- State tracking for skipped vs configured status
- Integration with wizard state and navigation

**Out of Scope:**
- Real security validation or enforcement
- AWS security service integration (GuardDuty, Security Hub, etc.)
- Compliance attestation or certification workflows
- Role-based access control (RBAC)
- Encryption key management
- Security scanning or vulnerability assessment
- Actual approval gate workflow implementation (just configuration capture)
- Data classification enforcement
- Two-phase suggestion card pattern (Step 3 style)
- Regenerate button for AI suggestions
- Custom "Other" option for approval gates

### Technical Considerations

**State Management:**
- Add new `SecurityGuardrailsState` interface to IdeationState
- Fields: dataSensitivity, complianceFrameworks[], approvalGates[], guardrailNotes, aiSuggested (boolean), skipped (boolean)
- Track if AI suggestion has been applied vs user-edited

**AI Integration:**
- Create lightweight service or utility function for guardrail suggestions
- Input: business objective, industry, systems, confirmed assumptions from Steps 1-2
- Output: Pre-formatted guardrail notes string
- Single request on step entry, no streaming display needed (populate after complete)

**Industry Detection:**
- Read industry from Step 1 state to determine compliance defaults
- Apply defaults only on first visit to step (not on back navigation)

**Navigation Integration:**
- Add Step 4 to wizard navigation flow
- Update step indicator to show Security step
- Handle forward/back navigation preserving state
- Skip button navigates forward while setting skipped flag
