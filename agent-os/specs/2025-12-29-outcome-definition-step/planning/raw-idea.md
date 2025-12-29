# Outcome Definition Step

**Feature Name:** Outcome Definition Step

**Description:** Build wizard step 3 for defining measurable business outcomes:

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
