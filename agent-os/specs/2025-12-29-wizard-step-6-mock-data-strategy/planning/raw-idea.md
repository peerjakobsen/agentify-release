# Mock Data Strategy — Wizard Step 6

## Feature Description

Build wizard step 6 for AI-generated mock data configuration.

## Auto-Generation on Step Entry

For each tool identified in agent design, model proposes mock data shape:

```json
{
  "tool": "sap_inventory",
  "system": "SAP S/4HANA",
  "operation": "get_stock_levels",
  "mockRequest": {"warehouse_id": "string", "sku_list": "string[]"},
  "mockResponse": {"sku": "string", "quantity": "number", "location": "string"},
  "sampleData": [
    {"sku": "TOMATO-001", "quantity": 150, "location": "Produce-A3"}
  ]
}
```

## Display & Editing

- Accordion for each tool with mock definition
- JSON editor for request/response schemas (with syntax highlighting)
- Sample data table with add/edit/delete rows
- "Use customer terminology" toggle: when ON, model regenerates with industry-specific naming from wizard context

## Bulk Actions

- "Regenerate All" — fresh mock data proposal from model
- "Import Sample Data" — upload CSV/JSON to populate sample data tables

## Validation

- Warn if any tool missing mock definition
- Warn if sample data empty (demo won't be realistic)

## Output

- Mock definitions stored in wizard state
- Used in Phase 4 steering file generation (`integration-landscape.md`)
