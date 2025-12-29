# Spec Initialization

## Feature Name
Security & Guardrails Step (Wizard Step 4)

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

## Context
This is the fourth step in the Ideation Wizard within the Agentify VS Code extension. The wizard helps AWS sales teams create AI agent demo configurations. Previous steps gather business context (Step 1), AI gap-filling assumptions (Step 2), and outcome definitions (Step 3).

## Date Created
2025-12-29
