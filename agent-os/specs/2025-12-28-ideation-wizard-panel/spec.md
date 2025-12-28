# Specification: Ideation Wizard Panel & Business Objective Step

## Goal
Build a multi-step wizard framework for the Ideation Wizard webview panel with 6-step navigation, then implement Step 1 (Business Context) with form inputs for business objective, industry selection, system checkboxes, and optional file upload.

## User Stories
- As a user, I want to navigate through a wizard to design AI agent workflows so that I can systematically capture all required information
- As a user, I want to input my business objective and context in Step 1 so that the AI can understand my use case for agent ideation

## Specific Requirements

**Wizard Navigation Framework**
- Horizontal 6-step indicator at top showing: Business Context, AI Gap Filling, Agent Design, Mock Data, Demo Strategy, Generate
- Visual states per step: completed (checkmark icon), current (highlighted/active), pending (grayed out)
- Back button always enabled; Next button enabled only when current step validation passes
- Direct step click navigation allowed for completed steps only; cannot skip ahead to unvisited steps
- Store currentStep in WizardState interface; framework must be extensible for remaining 5 steps (UI placeholders only)

**Business Objective Textarea**
- Multi-line textarea for entering problem statement or business objective
- Required field - validation blocks Next button when empty
- Include placeholder text guiding user on expected input
- Bind value to WizardState.businessObjective

**Industry Vertical Dropdown**
- Required select dropdown with options: Retail, FSI, Healthcare, Life Sciences, Manufacturing, Energy, Telecom, Public Sector, Media & Entertainment, Travel & Hospitality, Other
- When "Other" is selected, show conditional free-text input for custom industry
- Store selection in WizardState.industry and WizardState.customIndustry

**System Checkboxes Grid**
- Flat CSS Grid layout with category headers as subheadings (not collapsible)
- Categories: CRM (Salesforce, HubSpot, Dynamics), ERP (SAP S/4HANA, Oracle, NetSuite), Data (Databricks, Snowflake, Redshift), HR (Workday, SuccessFactors), Service (ServiceNow, Zendesk)
- Optional field with soft warning if none selected (does not block Next)
- Responsive layout: stack to 2 columns on narrow panels using CSS media query or container query
- Store selected systems in WizardState.systems array

**Other Systems Text Input**
- Free-text input field for additional systems not in checkbox list
- Optional field with no validation
- Store value in WizardState.customSystems

**File Upload**
- Single file upload only (not multiple)
- Accepted formats: .pdf, .docx, .txt, .md
- Size limit: 5MB - show validation error if exceeded
- Store as Uint8Array in WizardState.uploadedFile with name and size metadata
- After upload, display filename + size with "Remove" button
- File stored in memory only (not persisted to disk)

**Step 1 Validation Logic**
- businessObjective: Required - show inline error when empty and user attempts Next
- industry: Required - show inline error when not selected and user attempts Next
- systems: Optional with soft warning (yellow banner) if none selected - does not block Next
- Validation runs on Next click; does not block Back navigation

**State Management**
- WizardState interface stored in IdeationWizardPanelProvider class instance
- State preserved when panel hidden/shown within same session
- State lost on panel dispose (file persistence comes in roadmap item 22)
- Use postMessage/onDidReceiveMessage for webview-extension communication

## Visual Design
No visual mockups provided. Follow VS Code theme patterns established in DemoViewerPanel.

## Existing Code to Leverage

**DemoViewerPanelProvider (`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/demoViewerPanel.ts`)**
- Follow inline HTML/CSS/JS generation pattern (no separate React build)
- Copy webview options configuration pattern with enableScripts and localResourceRoots
- Replicate postMessage and onDidReceiveMessage communication pattern
- Use same Content-Security-Policy meta tag approach
- Reference CSS variable usage for VS Code theme tokens (--vscode-*)

**IdeationWizardPanelProvider stub (`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/ideationWizardPanel.ts`)**
- Extend existing stub implementation rather than creating new file
- Preserve existing view ID constant (IDEATION_WIZARD_VIEW_ID)
- Maintain existing public API methods (postMessage, isVisible, refresh, reveal)

**InputPanelValidationService (`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/inputPanelValidation.ts`)**
- Reference validation pattern with ValidationError and ValidationState interfaces
- Use similar approach for Step 1 validation with error type categorization
- Consider creating WizardValidationService if validation logic grows complex

**Input Panel Types (`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/inputPanel.ts`)**
- Reference existing TypeScript interface patterns for new WizardState type
- Follow established naming conventions and documentation style

## Out of Scope
- Claude/Bedrock API calls (roadmap item 14)
- AI Gap Filling step UI and logic (roadmap item 15)
- Agent Design step UI and logic (roadmap items 18-20)
- Mock Data Strategy step UI (roadmap item 21)
- Demo Strategy step UI (roadmap item 23)
- Generate step UI (roadmap item 27)
- File persistence to disk/workspace state (roadmap item 22)
- File content parsing or text extraction from uploaded documents
- AI-powered validation of form inputs
- Industry-to-system auto-suggestion intelligence
- Steps 2-6 implementation beyond placeholder containers
