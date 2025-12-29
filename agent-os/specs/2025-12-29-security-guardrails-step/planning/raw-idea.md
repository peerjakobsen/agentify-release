# Raw Idea: Security & Guardrails Step

## Feature Description

Security & Guardrails Step — Build wizard step 4 for compliance and approval gate configuration:

**Data Sensitivity Classification:**
- Radio buttons: Public, Internal, Confidential, Restricted
- Helper text explaining each level
- Default: Internal

**Compliance Frameworks (checkboxes):**
- SOC 2, HIPAA, PCI-DSS, GDPR, FedRAMP, None/Not specified
- Industry-aware defaults (Healthcare → HIPAA pre-checked, FSI → PCI-DSS + SOC 2)

**Human Approval Gates:**
- Checkbox list of workflow stages where human approval may be required
- Options: "Before external API calls", "Before data modification", "Before sending recommendations", "Before financial transactions"
- Default: None (fully automated demo)

**Guardrail Notes (optional text area):**
- Free-form notes for additional constraints
- On step entry: AI suggests relevant guardrail notes based on context from steps 1-2
- Suggestions are editable, user can modify or clear entirely
- Example placeholder if AI fails: "No PII in demo data, mask account numbers..."

This step is optional — "Skip" button available with sensible defaults applied.
