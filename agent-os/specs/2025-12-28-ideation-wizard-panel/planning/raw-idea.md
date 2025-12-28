# Raw Idea

## Feature Name
Ideation Wizard Panel & Business Objective Step

## Description
Create Ideation Wizard webview panel with multi-step wizard navigation framework (step indicator, next/back buttons, progress tracking), then build the first step with:

1. Multi-line text input for business objective/problem statement
2. Industry vertical dropdown with the following options:
   - Retail
   - FSI
   - Healthcare
   - Life Sciences
   - Manufacturing
   - Energy
   - Telecom
   - Public Sector
   - Media & Entertainment
   - Travel & Hospitality
   - Other
   - Conditional "Other industry" free-text field when "Other" is selected
3. System checkboxes grouped by category:
   - **CRM:** Salesforce, HubSpot, Dynamics
   - **ERP:** SAP S/4HANA, Oracle, NetSuite
   - **Data:** Databricks, Snowflake, Redshift
   - **HR:** Workday, SuccessFactors
   - **Service:** ServiceNow, Zendesk
4. "Other systems" free-text field
5. Optional file upload for additional context (account plan, requirements doc)
   - Stored in memory, not persisted
   - File persistence to be added in item 22

## Technical Notes
- Wizard state held in memory
- File persistence added in future roadmap item 22
