# Spec Requirements: Wizard Step 6 Mock Data Strategy

## Initial Description

Build wizard step 6 for AI-generated mock data configuration. For each tool identified in agent design, the model proposes mock data shape including tool name, system, operation, mock request schema, mock response schema, and sample data.

Key features from raw idea:
- Auto-generation on step entry
- Accordion display for each tool with mock definition
- JSON editor for request/response schemas (with syntax highlighting)
- Sample data table with add/edit/delete rows
- "Use customer terminology" toggle for industry-specific naming
- Bulk actions: "Regenerate All" and "Import Sample Data"
- Validation warnings for missing definitions or empty sample data
- Output stored in wizard state for Phase 4 steering file generation

## Requirements Discussion

### First Round Questions

**Q1:** AI Generation Pattern - Should this follow the two-phase pattern (AI proposes, user accepts/adjusts) like Steps 4-5, or go directly to editable state?
**Answer:** Direct editing from the start, skip two-phase pattern. AI generates, user edits inline, done. Show AI-generated mocks in editable accordions immediately. Include "Regenerate All" button for fresh AI pass.

**Q2:** JSON Schema Editor - Should this have full JSON Schema validation, or basic syntax highlighting?
**Answer:** No JSON Schema validation, just syntax highlighting. Show simple "Invalid JSON" warning if malformed. Use existing tokenizeJson() pattern from Execution Log panel.

**Q3:** "Use Customer Terminology" Toggle - Should this trigger a full regeneration, or just a refinement pass on existing data?
**Answer:** Simple AI refinement request, no terminology mapping system. Send current mock definitions + wizard context to Claude. Prompt: "Regenerate sample data using terminology typical for {industry}". One-shot refinement, no persistent mapping.

**Q4:** Sample Data Table - Should there be a limit on rows, or allow unlimited sample data?
**Answer:** Limit to 5 rows per tool. Display "+5 more rows available" message if user tries to add more.

**Q5:** Import Sample Data - Should imported data auto-map to fields, or show a mapping UI?
**Answer:** Auto-map matching fields (case-insensitive), ignore unmatched. No interactive mapping UI. Use placeholder values for missing required fields. Show summary: "Imported 5 rows. Mapped: sku, quantity. Ignored: extra_field".

**Q6:** Error Response Mocking - Should users be able to define error responses for failure scenario demos?
**Answer:** Not needed for MVP, happy path demos only. Add to "Deferred" section in spec.

**Q7:** Validation Strictness - Should validation block navigation, or just warn?
**Answer:** Non-blocking validation, allow proceeding. Consistent with Step 5 pattern. Warnings: "Warning: {tool_name} has no sample data - demo will use empty responses".

**Q8:** Exclusions/Constraints - Anything specifically out of scope?
**Answer:**
- Exclude: Error response mocking (deferred), JSON Schema validation, Complex CSV mapping UI, Persistent terminology mappings
- Constraints: Max 5 sample rows per tool, Sample data must be valid JSON (basic syntax check), File upload limited to CSV and JSON formats, File size limit: 1MB

### Existing Code to Reference

**Similar Features Identified:**
- Feature: tokenizeJson() - Path: Execution Log panel (existing JSON syntax highlighting pattern)
- Feature: Step 5 Agent Design - Similar direct-edit accordion pattern with AI generation
- Feature: Step 4/5 validation pattern - Non-blocking warnings approach

### Follow-up Questions

No follow-up questions needed - answers were comprehensive.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A - No visual files found in the visuals folder.

## Requirements Summary

### Functional Requirements

**Auto-Generation on Step Entry:**
- AI generates mock definitions for each tool from Step 5 agent design
- Show AI-generated mocks in editable accordions immediately (direct-edit pattern)
- Include "Regenerate All" button for fresh AI pass

**Mock Definition Structure:**
- Tool name, system, operation
- Mock request schema (JSON with syntax highlighting)
- Mock response schema (JSON with syntax highlighting)
- Sample data array (max 5 rows)

**Display & Editing:**
- Accordion for each tool with mock definition
- JSON editor with syntax highlighting using existing tokenizeJson() pattern
- Basic JSON syntax validation (show "Invalid JSON" warning if malformed)
- Sample data table with add/edit/delete rows (max 5 rows)
- Show "+5 more rows available" message if limit reached

**Customer Terminology Toggle:**
- Simple AI refinement request when toggled ON
- Send current mock definitions + wizard context to Claude
- Prompt: "Regenerate sample data using terminology typical for {industry}"
- One-shot refinement, no persistent terminology mapping

**Bulk Actions:**
- "Regenerate All" - fresh mock data proposal from AI
- "Import Sample Data" - upload CSV/JSON files
  - Auto-map matching fields (case-insensitive)
  - Ignore unmatched fields
  - Use placeholder values for missing required fields
  - Show import summary: "Imported X rows. Mapped: field1, field2. Ignored: field3"
  - File formats: CSV and JSON only
  - File size limit: 1MB

**Validation:**
- Non-blocking warnings (allow proceeding)
- Consistent with Step 5 pattern
- Warning messages: "Warning: {tool_name} has no sample data - demo will use empty responses"
- Warning if any tool missing mock definition

**State Management:**
- Track edited state per tool (requestEdited, responseEdited, sampleDataEdited)
- Track step5Hash for change detection
- Store mock definitions in wizard state for Phase 4 steering file generation

### Suggested State Structure

```typescript
interface MockDataState {
  mockDefinitions: MockToolDefinition[];
  useCustomerTerminology: boolean;
  isLoading: boolean;
  error?: string;
  step5Hash?: string;
  aiCalled: boolean;
}

interface MockToolDefinition {
  tool: string;
  system: string;
  operation: string;
  mockRequest: object;
  mockResponse: object;
  sampleData: object[];  // max 5
  expanded: boolean;
  requestEdited: boolean;
  responseEdited: boolean;
  sampleDataEdited: boolean;
}
```

### Reusability Opportunities

- tokenizeJson() pattern from Execution Log panel for JSON syntax highlighting
- Step 5 accordion pattern for tool display
- Step 4/5 validation pattern for non-blocking warnings
- Existing AI service patterns for Claude API calls

### Scope Boundaries

**In Scope:**
- AI-generated mock definitions for each tool
- Direct-edit accordions with JSON syntax highlighting
- Sample data tables with add/edit/delete (max 5 rows)
- Customer terminology toggle with AI refinement
- CSV/JSON import with auto-mapping
- Non-blocking validation warnings
- "Regenerate All" bulk action
- State persistence for Phase 4 integration

**Out of Scope:**
- Error response mocking (deferred to future iteration)
- Full JSON Schema validation
- Interactive CSV mapping UI
- Persistent terminology mappings
- More than 5 sample rows per tool
- File formats other than CSV and JSON

### Technical Considerations

- Use existing tokenizeJson() pattern from Execution Log panel
- Follow Step 5 direct-edit accordion pattern
- Maintain consistency with Step 4/5 validation approach (non-blocking warnings)
- File upload limited to CSV/JSON, max 1MB
- Mock definitions stored in wizard state for integration-landscape.md generation in Phase 4
- Track step5Hash to detect when agent design changes (potential mock invalidation)

### Deferred Features

- Error response mocking for failure scenario demos
- Full JSON Schema validation
- Complex CSV mapping UI with field mapping interface
- Persistent terminology mappings per customer/industry
