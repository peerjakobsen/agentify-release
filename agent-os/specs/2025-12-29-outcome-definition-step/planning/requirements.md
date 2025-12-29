# Spec Requirements: Outcome Definition Step

## Initial Description

Build wizard step 3 for defining measurable business outcomes:

**AI-Driven Suggestions on Step Entry:**
- Auto-send context (objective, industry, assumptions from Step 2) to Bedrock
- Model returns JSON with suggested primary outcome, KPIs, and relevant stakeholders
- Display suggestions as editable starting points, not locked values

**Fields:**
- Primary outcome statement (text input pre-filled with AI suggestion, fully editable)
- Success metrics (repeatable field group with AI-suggested KPIs, user can edit/add/remove)
- Stakeholders (multi-select with AI-suggested options pre-checked, user can uncheck/add custom)

**User Control:**
- All AI suggestions are editable, removable, or ignorable
- "Add Custom" option always available for each field
- "Regenerate Suggestions" button for fresh AI proposal
- User modifications take precedence over AI suggestions

**Fallback:**
- If AI fails: show static stakeholder list (Internal/External groups) and empty fields
- Manual entry always works regardless of AI status

**Validation:**
- Primary outcome required
- At least one success metric recommended (warning, not blocking)

## Requirements Discussion

### First Round Questions

**Q1:** I'm assuming the AI should return suggestions in a structured JSON format (similar to the gap-filling assumptions pattern), with fields for `primaryOutcome`, `suggestedKPIs`, and `stakeholders`. Is that correct, or would you prefer a different approach like inline suggestions within natural language?

**Answer:** Structured JSON confirmed with the following TypeScript interface:
```typescript
interface OutcomeSuggestions {
  primaryOutcome: string;
  suggestedKPIs: Array<{ name: string; targetValue: string; unit: string; }>;
  stakeholders: string[];  // From STAKEHOLDER_OPTIONS + custom suggestions
}
```

**Q2:** The existing type `SuccessMetric` has `name`, `targetValue`, and `unit` fields. I assume each metric row should have these three inputs displayed horizontally. Should there be a constraint on minimum/maximum metrics (e.g., 1-5 KPIs), or allow unlimited?

**Answer:** Soft limits approach:
- Minimum: 0 (with warning message)
- AI suggests: 3-5 KPIs
- Soft cap: 10 metrics with guidance message
- No hard maximum limit

**Q3:** I see `STAKEHOLDER_OPTIONS` is defined as a static list. Should the AI-suggested stakeholders come from this list (with pre-checked boxes), or should the AI be able to suggest stakeholders outside this list that get added dynamically?

**Answer:** Two-tier approach:
- Static `STAKEHOLDER_OPTIONS` checkbox list with expanded options: Operations, Finance, Supply Chain, Customer Service, Executive, IT, Sales, Marketing, HR, Legal
- AI can suggest stakeholders outside the static list, displayed with "(AI suggested)" badge
- User can add custom stakeholders via text input field

**Q4:** I assume the AI call should fire automatically on step entry (like Step 2), using context from Steps 1 and 2 (objective, industry, systems, confirmed assumptions). Should the user see a loading state while waiting, or should the form be immediately editable with suggestions populating when ready?

**Answer:** Auto-trigger on step entry with:
- Form immediately editable (no blocking loading state)
- AI suggestions populate asynchronously when ready
- Do not overwrite any user edits made while waiting

**Q5:** Should "Regenerate Suggestions" re-fetch AI suggestions for all three fields (outcome, metrics, stakeholders), or should there be per-field regeneration buttons?

**Answer:** Single button regenerates all fields. Show confirmation dialog if user has made edits to warn about potential overwrites.

**Q6:** You mentioned "at least one success metric recommended (warning, not blocking)". I assume the primary outcome is required (blocking) and stakeholders are optional. Is that correct?

**Answer:** Confirmed:
- Primary outcome: Required (blocking - cannot proceed without)
- Success metrics: Recommended (warning at 0 metrics, non-blocking)
- Stakeholders: Optional (no warning or blocking)

**Q7:** Is there anything you want to explicitly exclude from this step?

**Answer:** Explicit exclusions:
- No calculated/derived metrics
- No tracking metrics over time
- No external integrations or data sources
- No metric dependencies or relationships
- No weighting or priority scoring for metrics
- No historical baselines

### Existing Code to Reference

Based on codebase analysis during research:

**Similar Features Identified:**
- Feature: Step 2 AI Gap-Filling - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/ideationWizardPanel.ts` (lines 554-730)
  - Chat-style streaming UI pattern
  - Assumption card rendering pattern
  - Accept/regenerate button patterns
- Feature: Bedrock Conversation Service - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/bedrockConversationService.ts`
  - Streaming token handling
  - EventEmitter pattern for async updates
- Feature: Gap-Filling Service - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/gapFillingService.ts`
  - JSON parsing from Claude responses
  - Context message building pattern
- Feature: Wizard Types - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/wizardPanel.ts`
  - `OutcomeDefinitionState` interface already defined
  - `SuccessMetric` interface already defined
  - `STAKEHOLDER_OPTIONS` constant (needs expansion)
- Components to potentially reuse:
  - Form group styling patterns from Step 1
  - System checkbox pattern for stakeholder multi-select
  - File upload zone pattern for custom input sections

### Follow-up Questions

No follow-up questions needed. The user's answers were comprehensive and addressed all architectural and UX considerations.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
Not applicable - no visuals to analyze.

## Requirements Summary

### Functional Requirements

**Primary Outcome Field:**
- Single textarea for outcome statement
- Pre-filled with AI suggestion when available
- Fully editable by user
- Required field (blocks navigation if empty)

**Success Metrics Field:**
- Repeatable field group with add/remove capability
- Each metric has: name (text), targetValue (text), unit (text)
- AI suggests 3-5 metrics on step entry
- Soft cap guidance at 10 metrics
- Warning shown if 0 metrics (non-blocking)
- "Add Metric" button always available

**Stakeholders Field:**
- Multi-select checkbox list with 10 static options
- AI-suggested items pre-checked
- AI can suggest additional stakeholders outside static list (shown with "(AI suggested)" badge)
- Custom stakeholder text input for user additions
- Fully optional field

**AI Integration:**
- Auto-trigger Bedrock call on step entry
- Send context: business objective, industry, systems, confirmed assumptions from Steps 1-2
- Parse JSON response matching `OutcomeSuggestions` interface
- Async population without blocking form interaction
- Preserve user edits (don't overwrite while populating)

**Regenerate Functionality:**
- Single "Regenerate Suggestions" button
- Confirmation dialog if user has made any edits
- Regenerates all three fields (outcome, metrics, stakeholders)

**Fallback Behavior:**
- If AI fails: show empty outcome field, empty metrics list, static stakeholder checkboxes unchecked
- Manual entry always functional regardless of AI status
- Error message displayed but not blocking

### Reusability Opportunities

- Assumption card pattern from Step 2 for displaying AI-suggested metrics
- Streaming/async update pattern from BedrockConversationService
- JSON parsing pattern from gapFillingService
- Form validation pattern from Step 1
- Checkbox group pattern from systems selection in Step 1

### Scope Boundaries

**In Scope:**
- Primary outcome textarea with AI pre-fill
- Repeatable success metrics field group (name, targetValue, unit)
- Two-tier stakeholder selection (static checkboxes + AI suggestions + custom input)
- Auto-trigger AI on step entry
- Regenerate suggestions button with confirmation
- Validation (required outcome, warning for 0 metrics)
- Fallback to manual entry on AI failure
- Async population without blocking user interaction
- Preserve user edits during async population

**Out of Scope:**
- Calculated or derived metrics
- Metric tracking over time / historical data
- External integrations or data sources for metrics
- Metric dependencies or relationships between metrics
- Weighting or priority scoring for metrics
- Historical baselines or benchmarks
- Per-field regeneration buttons (single button only)
- Hard limits on metric count

### Technical Considerations

- Extend `STAKEHOLDER_OPTIONS` constant to include: Operations, Finance, Supply Chain, Customer Service, Executive, IT, Sales, Marketing, HR, Legal
- Create new prompt file for outcome suggestions (similar to `gap-filling-assistant.md`)
- Add new service or extend gapFillingService for outcome suggestion parsing
- Track "user-edited" state for each field to handle regeneration confirmation
- JSON response schema must match `OutcomeSuggestions` interface
- Streaming not required for this step (single JSON response expected)
- Follow existing CSS patterns using VS Code CSS variables
- Follow existing message command pattern for webview-extension communication
