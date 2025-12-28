# Raw Idea: AI Gap-Filling Conversation

**Feature Name:** AI Gap-Filling Conversation

**Description:** Create wizard step 2 as a conversational UI where Claude analyzes the business objective and system selections, then proposes industry-typical assumptions.

**Conversation Flow:**
1. On step entry, auto-send context summary to Claude: "User's objective: {objective}. Industry: {industry}. Known systems: {systems}."
2. Claude responds with structured proposal: "Based on your {industry} context, here's what I'm assuming about your environment..." with specific module/integration assumptions
3. User can accept all, or reply with corrections: "Actually we use SAP IBP, not APO"
4. Claude acknowledges and refines: "Got it, updating to SAP IBP for demand planning..."
5. Conversation continues until user clicks "Confirm & Continue"

**UI Pattern:**
- Chat-style interface with Claude messages (left-aligned) and user messages (right-aligned)
- Claude messages include "Accept Assumptions" button for quick confirmation
- Editable text input for user refinements
- Streaming token display as Claude responds
- "Regenerate" button to get fresh proposal

**State Output:**
- `confirmedAssumptions: {system: string, modules: string[], integrations: string[]}[]`
- Stored in wizard state for downstream steps
