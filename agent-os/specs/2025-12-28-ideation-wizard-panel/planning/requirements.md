# Spec Requirements: Ideation Wizard Panel & Business Objective Step

## Initial Description

Create Ideation Wizard webview panel with multi-step wizard navigation framework (step indicator, next/back buttons, progress tracking), then build the first step with:
1. Multi-line text input for business objective/problem statement
2. Industry vertical dropdown (Retail, FSI, Healthcare, Life Sciences, Manufacturing, Energy, Telecom, Public Sector, Media & Entertainment, Travel & Hospitality, Other) with conditional "Other industry" free-text field when "Other" is selected
3. System checkboxes grouped by category - CRM (Salesforce, HubSpot, Dynamics), ERP (SAP S/4HANA, Oracle, NetSuite), Data (Databricks, Snowflake, Redshift), HR (Workday, SuccessFactors), Service (ServiceNow, Zendesk)
4. "Other systems" free-text field
5. Optional file upload for additional context (account plan, requirements doc - stored in memory, not persisted)

Wizard state held in memory; file persistence added in item 22.

## Requirements Discussion

### First Round Questions

**Q1:** I assume the wizard navigation framework should use a horizontal step indicator at the top showing numbered steps (Step 1: Business Objective, Step 2: Gap Filling, etc.) with visual completion states (completed/current/pending), similar to common checkout wizards. Is that correct, or would you prefer a different navigation pattern like a sidebar stepper or compact breadcrumbs?

**Answer:** Horizontal step indicator at the top with 6 steps:
- Business Context (this item)
- AI Gap Filling (item 15)
- Agent Design (item 16)
- Mock Data (item 17)
- Demo Strategy (item 18)
- Generate (item 19)

**Q2:** I'm thinking the multi-step wizard should allow navigation back to previous steps but require validation before proceeding to the next step (e.g., business objective text is required). Should we also allow skipping ahead to review already-completed steps, or enforce strict linear progression?

**Answer:**
- Back: Always allowed
- Forward: Only when current step passes validation
- Direct jump: Allow clicking completed steps, but not skipping ahead to unvisited
- Step 1 validation: Business objective required, industry required, systems optional with soft warning

**Q3:** For the industry vertical dropdown, I assume selecting an industry should auto-suggest common systems for that vertical (e.g., selecting "Healthcare" might highlight HIPAA-relevant systems). Should we implement this cross-field intelligence, or keep the industry and systems selections completely independent?

**Answer:** Keep independent in Step 1. Auto-suggestions are Claude's job in Step 2.

**Q4:** The system checkboxes are grouped by category (CRM, ERP, Data, HR, Service). I assume each category should be collapsible to manage visual complexity, with all categories expanded by default. Is that correct, or should they be displayed as a flat grid without collapsible sections?

**Answer:** Flat grid with visual category headers (not collapsible). CSS grid with category labels as subheadings. Responsive: stack to 2 columns on narrow panels.

**Q5:** For the file upload (account plan, requirements doc), I assume we should support common document formats: PDF, DOCX, TXT, and perhaps MD. Should we set a file size limit (e.g., 5MB) since files are stored in memory? Also, should users be able to upload multiple files or just one?

**Answer:**
- Formats: .pdf, .docx, .txt, .md
- Size limit: 5MB
- Count: Single file
- Storage: Uint8Array in memory
- Display: Show filename + size after upload, with "Remove" button

**Q6:** Given that wizard state is held in memory initially (persistence in item 22), I assume navigating away from the panel and back should preserve the current wizard state within the same session. Is that correct?

**Answer:** Yes, preserve in IdeationWizardPanel class instance. Lost on dispose (item 22 adds persistence).

State structure:
```typescript
interface WizardState {
  currentStep: number;
  businessObjective: string;
  industry: string;
  customIndustry?: string;
  systems: string[];
  customSystems?: string;
  uploadedFile?: { name: string; size: number; data: Uint8Array };
}
```

**Q7:** Is there anything that should explicitly NOT be included in this first step, or any future functionality we should design around but not implement yet?

**Answer:** No Claude/Bedrock calls, no gap-filling UI, no agent design step, no file persistence, no file parsing, no AI validation. Design wizard framework generic for 6 steps but only build Step 1 UI now.

### Existing Code to Reference

**Similar Features Identified:**
- Feature: DemoViewerPanel - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/demoViewerPanel.ts`
- Components to potentially reuse: Inline HTML/CSS/JS generation pattern, VS Code webview message handling, state management within panel class
- Backend logic to reference: ConfigService pattern for state, validation service patterns from inputPanelValidation.ts

**Technical Pattern Confirmed:** Follow existing DemoViewerPanel inline HTML pattern (no separate React build).

### Follow-up Questions

No follow-up questions needed - answers were comprehensive.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A - No visual files to analyze.

## Requirements Summary

### Functional Requirements

**Wizard Navigation Framework:**
- Horizontal 6-step indicator at top of panel
- Steps: Business Context, AI Gap Filling, Agent Design, Mock Data, Demo Strategy, Generate
- Visual states for each step: completed (checkmark), current (highlighted), pending (grayed)
- Back button: Always enabled
- Next button: Enabled only when current step validation passes
- Direct step click: Allowed for completed steps only, no skipping ahead to unvisited

**Step 1 - Business Context UI:**

1. **Business Objective Input**
   - Multi-line textarea for problem statement
   - Required field (validation blocks Next)
   - Placeholder text to guide user

2. **Industry Vertical Dropdown**
   - Required field (validation blocks Next)
   - Options: Retail, FSI, Healthcare, Life Sciences, Manufacturing, Energy, Telecom, Public Sector, Media & Entertainment, Travel & Hospitality, Other
   - Conditional "Other industry" free-text field when "Other" is selected

3. **System Checkboxes**
   - Flat CSS grid layout with category headers as subheadings
   - Categories and systems:
     - CRM: Salesforce, HubSpot, Dynamics
     - ERP: SAP S/4HANA, Oracle, NetSuite
     - Data: Databricks, Snowflake, Redshift
     - HR: Workday, SuccessFactors
     - Service: ServiceNow, Zendesk
   - Optional with soft warning if none selected
   - Responsive: 2 columns on narrow panels

4. **Other Systems Input**
   - Free-text field for additional systems not in checkbox list
   - Optional field

5. **File Upload**
   - Single file only
   - Accepted formats: .pdf, .docx, .txt, .md
   - Size limit: 5MB
   - Storage: Uint8Array in memory (not persisted)
   - Display after upload: filename + size + Remove button
   - Optional field

**State Management:**
- WizardState interface stored in panel class instance
- State preserved when navigating away and back within session
- State lost on panel dispose (persistence added in roadmap item 22)

### Reusability Opportunities

- DemoViewerPanel inline HTML generation pattern
- VS Code webview postMessage/onDidReceiveMessage communication
- State management within panel class instance
- InputPanelValidation service patterns for validation logic
- CSS variables using VS Code theme tokens (--vscode-*)

### Scope Boundaries

**In Scope:**
- Wizard navigation framework (step indicator, next/back buttons, step click navigation)
- All 6 step placeholders with proper step names
- Step 1 (Business Context) complete UI implementation
- Form validation for Step 1 (business objective required, industry required, systems soft warning)
- File upload with size/format validation
- In-memory state management
- Responsive layout for narrow panels

**Out of Scope:**
- Claude/Bedrock API calls (item 14)
- AI Gap Filling UI (item 15)
- Agent Design UI (items 18-20)
- Mock Data Strategy UI (item 21)
- Demo Strategy UI (item 23)
- Generate step UI (item 27)
- State persistence to filesystem (item 22)
- File content parsing/extraction
- AI-powered validation
- Industry-system auto-suggestions

### Technical Considerations

- Follow existing DemoViewerPanel inline HTML/CSS/JS pattern
- Use VS Code webview API (WebviewViewProvider)
- State stored in IdeationWizardPanelProvider class instance
- Message passing between webview and extension host via postMessage
- CSS Grid for system checkbox layout
- File stored as Uint8Array for later use by Claude in Step 2
- Design wizard framework to be extensible for remaining 5 steps
- Use VS Code theme CSS variables for consistent styling
