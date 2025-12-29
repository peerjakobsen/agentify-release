# Specification: Outcome Definition Step (Step 3)

## Goal
Build wizard Step 3 to help users define measurable business outcomes, success metrics (KPIs), and stakeholders with AI-driven suggestions that auto-populate on step entry and remain fully editable.

## User Stories
- As a solution architect, I want AI to suggest relevant KPIs based on my business context so that I can quickly define measurable outcomes without starting from scratch
- As a user, I want full control to edit, add, or remove any AI suggestions so that the final outcomes accurately reflect my specific needs

## Specific Requirements

**AI Auto-Trigger on Step Entry**
- Fire Bedrock API call automatically when user enters Step 3 (same pattern as Step 2)
- Send context from Steps 1-2: businessObjective, industry, systems, confirmedAssumptions
- Do NOT block form interaction while AI is loading
- Track "AI is loading" state separate from form state
- Populate suggestions asynchronously without overwriting any user edits made while waiting

**OutcomeSuggestions Response Format**
- Create new prompt file `outcome-definition-assistant.md` in `resources/prompts/`
- AI must return JSON matching `OutcomeSuggestions` interface embedded in markdown code fences
- Interface: `{ primaryOutcome: string; suggestedKPIs: Array<{ name: string; targetValue: string; unit: string }>; stakeholders: string[] }`
- suggestedKPIs should contain 3-5 items
- stakeholders array can include items from STAKEHOLDER_OPTIONS plus custom AI suggestions

**Primary Outcome Field**
- Single textarea field for outcome statement
- Pre-fill with AI suggestion when available
- Track user-edited state to prevent AI overwrite
- Required field (blocking validation error if empty)
- Placeholder text: "Describe the measurable business result..."

**Success Metrics Repeatable Field Group**
- Render as horizontal rows with three inputs: name (text), targetValue (text), unit (text)
- Pre-populate with AI-suggested KPIs when available
- "Add Metric" button always visible below the list
- Each row has a remove button (trash icon)
- Soft cap at 10 metrics with guidance message "Consider focusing on 3-5 key metrics"
- Warning (non-blocking) shown if 0 metrics when navigating forward

**Stakeholders Multi-Select**
- Expand STAKEHOLDER_OPTIONS to include: Operations, Finance, Supply Chain, Customer Service, Executive, IT, Sales, Marketing, HR, Legal
- Render as checkbox grid (similar to systems selection in Step 1)
- AI-suggested items from static list are pre-checked
- AI-suggested items outside static list shown with "(AI suggested)" badge as additional checkboxes
- Custom stakeholder text input field with "Add" button below the grid
- Fully optional field (no validation)

**Regenerate Suggestions Button**
- Single button in step header area (similar to Step 2 regenerate button)
- Disabled while AI is loading
- If user has edited any field, show confirmation dialog: "Regenerating will replace current values. Continue?"
- Regenerates all three fields simultaneously
- Reset Bedrock service conversation before regenerating (new prompt context)

**User Edit Tracking**
- Track boolean flags: `primaryOutcomeEdited`, `metricsEdited`, `stakeholdersEdited`
- Set flag to true when user makes any change to that field group
- Use flags for regeneration confirmation logic
- Reset flags after regeneration completes

**Fallback Behavior**
- If AI call fails: show empty outcome field, empty metrics list, static stakeholders unchecked
- Display non-blocking error message: "AI suggestions unavailable. Enter values manually."
- Error message dismissable via close button
- All form fields remain fully functional for manual entry

## Visual Design
No visual mockups provided.

**Form Layout Reference**
- Follow Step 1 form styling: `.form-group`, `.textarea`, `.text-input` classes
- Step header with h2 title and description paragraph
- Regenerate button aligned right in header area (same as Step 2 chat-actions)
- Metrics displayed in `.metrics-list` container with horizontal rows
- Stakeholders in `.systems-grid` pattern (2-column responsive grid)

## Existing Code to Leverage

**Step 2 AI Pattern (ideationWizardPanel.ts lines 1952-2026)**
- `triggerAutoSendForStep2()` pattern for auto-triggering AI on step entry
- `sendContextToClaude()` pattern for building and sending context message
- Streaming state management with `_isStreaming` flag
- EventEmitter subscription pattern for `onToken`, `onComplete`, `onError`

**gapFillingService.ts JSON Parsing (lines 81-148)**
- `parseAssumptionsFromResponse()` pattern for extracting JSON from Claude responses
- Regex pattern for finding JSON blocks in markdown
- `validateAndTransformAssumptions()` pattern for type-safe parsing

**Bedrock Conversation Service (bedrockConversationService.ts)**
- `resetConversation()` method for clearing conversation before regeneration
- System prompt loading pattern via `_loadSystemPrompt()`
- Consider creating separate service instance or extending for outcome-specific prompt

**Form Validation Pattern (ideationWizardPanel.ts lines 148-197)**
- `validateStep1()` pattern for field-level validation with errors/warnings
- Return `WizardValidationState` with `isValid`, `errors`, `hasWarnings`
- CSS classes `.field-error` and `.field-warning` for inline messages

**WIZARD_COMMANDS Pattern (wizardPanel.ts lines 477-509)**
- Add new commands: `UPDATE_PRIMARY_OUTCOME`, `ADD_METRIC`, `REMOVE_METRIC`, `UPDATE_METRIC`, `TOGGLE_STAKEHOLDER`, `ADD_CUSTOM_STAKEHOLDER`, `REGENERATE_OUTCOME_SUGGESTIONS`

## Out of Scope
- Calculated or derived metrics (e.g., auto-computing percentages)
- Tracking metrics over time or historical trend display
- External integrations or data sources for real metric values
- Metric dependencies or relationships between metrics
- Weighting or priority scoring for metrics
- Historical baselines or benchmark comparisons
- Per-field regeneration buttons (only single "regenerate all" button)
- Hard limits on metric count (only soft guidance at 10)
- Streaming display of AI response (wait for complete JSON response)
- Metric templates or presets per industry
