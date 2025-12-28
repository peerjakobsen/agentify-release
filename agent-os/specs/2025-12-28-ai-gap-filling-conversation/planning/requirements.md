# Spec Requirements: AI Gap-Filling Conversation

## Initial Description

Create wizard step 2 as a conversational UI where Claude analyzes the business objective and system selections from Step 1, then proposes industry-typical assumptions. Users can accept all assumptions at once or refine them through natural conversation. The step outputs confirmed assumptions for downstream wizard steps.

From Roadmap Item 15:
- Conversation Flow: Auto-send context on step entry, Claude proposes assumptions, user accepts or refines, conversation continues until "Confirm & Continue"
- UI Pattern: Chat-style interface with Claude messages (left-aligned) and user messages (right-aligned)
- State Output: `confirmedAssumptions` array stored in wizard state

## Requirements Discussion

### First Round Questions

**Q1:** I assume when the user enters Step 2, we automatically send the context summary to Claude without requiring a button click (matching the roadmap's "On step entry, auto-send context..."). Is that correct, or would you prefer a manual "Start Analysis" button first?
**Answer:** Auto-start. Yes, auto-send on step entry. User has already provided inputs in Step 1; no need for extra friction.

**Q2:** For the "Accept Assumptions" quick-action button embedded in Claude's responses, I'm thinking this should parse structured JSON from Claude's response to identify the assumptions being accepted. Should this button accept ALL assumptions at once, or should each assumption category (system modules, integrations) have its own accept/refine option?
**Answer:** Accept All at once. Single "Accept Assumptions" button accepts everything. Granular refinement happens through conversation ("Actually, we use SAP IBP not APO"). Keeps UI simple.

**Q3:** I assume the conversation should allow multiple back-and-forth exchanges until the user clicks "Confirm & Continue" -- there's no limit on refinement rounds. Is that correct, or should we encourage users to finalize within 2-3 exchanges?
**Answer:** Unlimited rounds. Allow unlimited back-and-forth. Optionally show a subtle hint after 3-4 exchanges: "Ready to finalize? Click Confirm & Continue."

**Q4:** When Claude proposes assumptions like "SAP S/4HANA with MM, SD, and PP modules," I'm assuming we should display these in a structured card format (not just prose text) so users can quickly scan and identify what needs correction. Do you agree with this approach, or should Claude responses remain purely conversational text?
**Answer:** Hybrid: structured cards with conversational context. Claude's prose intro/outro, but assumptions rendered as scannable cards. Easier to parse for state output and better UX for reviewing.

**Q5:** For the `confirmedAssumptions` output, I see the schema in the roadmap is `{system: string, modules: string[], integrations: string[]}[]`. Should this also capture which assumptions were AI-proposed vs. user-corrected, for potential downstream use (e.g., confidence indicators in steering files)?
**Answer:** Track source. Yes, add `source: 'ai-proposed' | 'user-corrected'` to each assumption. Useful for confidence indicators and debugging.

**Q6:** I assume if a user navigates back to Step 1 and changes the business objective or systems, we should clear the conversation history and re-trigger Claude's analysis when they return to Step 2. Is that correct?
**Answer:** Clear on Step 1 changes. Yes, if user goes back and modifies business objective, industry, or systems, clear conversation and re-trigger analysis when they return to Step 2.

**Q7:** If Claude's response fails mid-stream (network error, throttling), I'm planning to show an inline error with a "Retry" button rather than forcing the user back to Step 1. Should we also auto-save the partial conversation so users don't lose their refinements?
**Answer:** Preserve conversation on stream failure. Yes, save conversation history. Only lose the incomplete Claude response. Show "Response interrupted. Try again?" with retry button.

**Q8:** What should happen if the user tries to click "Confirm & Continue" without any Claude response yet (e.g., they immediately clicked next while Claude was still responding)? Block with validation, or allow them to proceed with no confirmed assumptions?
**Answer:** Block early confirm. Disable "Confirm & Continue" while Claude is streaming. Also disable if no assumptions have been confirmed (empty state). Require at least one confirmed assumption set.

### Existing Code to Reference

**Similar Features Identified:**
- Service: `BedrockConversationService` - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/bedrockConversationService.ts`
  - Provides streaming token delivery via `onToken` event emitter
  - Maintains conversation history in Converse API format
  - Handles throttling with exponential backoff
  - Loads system prompt from bundled resources
- Panel: `IdeationWizardPanel` - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/panels/ideationWizardPanel.ts`
  - Existing wizard step navigation framework
  - Message handling pattern between extension and webview
  - State synchronization via `SYNC_STATE` command
- Types: `WizardState` and related interfaces - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/wizardPanel.ts`
  - Step 2 already defined as `WizardStep.AIGapFilling = 2`
  - Wizard state structure for adding conversation/assumption fields

### Follow-up Questions

No follow-up questions were necessary. User answers were comprehensive.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A - No visual assets to analyze.

## Requirements Summary

### Functional Requirements

**Conversation Initialization:**
- Auto-send context summary to Claude on Step 2 entry (no manual trigger)
- Context includes: business objective, industry, selected systems from Step 1
- Show loading state while awaiting Claude's initial response

**Claude Response Display:**
- Hybrid format: conversational prose intro/outro with structured assumption cards
- Assumption cards must be scannable and clearly show: system name, modules, integrations
- Include "Accept Assumptions" button after Claude's proposal
- Stream tokens in real-time as Claude responds

**User Interaction:**
- Single "Accept Assumptions" button accepts all proposed assumptions at once
- Text input for user refinements (e.g., "Actually we use SAP IBP, not APO")
- Unlimited conversation rounds allowed
- Show subtle hint after 3-4 exchanges: "Ready to finalize? Click Confirm & Continue."

**Navigation & Validation:**
- "Confirm & Continue" button disabled while Claude is streaming
- "Confirm & Continue" button disabled if no assumptions confirmed (empty state)
- Require at least one confirmed assumption set to proceed
- "Regenerate" button to get fresh proposal from Claude

**State Clearing:**
- If user navigates back to Step 1 and modifies business objective, industry, or systems:
  - Clear conversation history
  - Re-trigger Claude analysis when returning to Step 2

**Error Handling:**
- On stream failure: preserve conversation history, lose only incomplete response
- Show inline error: "Response interrupted. Try again?" with retry button
- Do not force user back to Step 1 on errors

### State Output Schema

```typescript
interface SystemAssumption {
  system: string;
  modules: string[];
  integrations: string[];
  source: 'ai-proposed' | 'user-corrected';
}

// Added to WizardState
interface AIGapFillingState {
  conversationHistory: ConversationMessage[];
  confirmedAssumptions: SystemAssumption[];
  assumptionsAccepted: boolean;
  isStreaming: boolean;
}
```

### Reusability Opportunities

- `BedrockConversationService` already implements streaming, conversation history, and error handling
- Wizard navigation framework in `IdeationWizardPanel` handles step transitions
- `WizardState` type structure supports adding new step-specific state
- System prompt loading pattern from `resources/prompts/` folder

### Scope Boundaries

**In Scope:**
- Chat-style UI with left-aligned Claude messages, right-aligned user messages
- Streaming token display as Claude responds
- Structured assumption cards parsed from Claude's JSON response
- "Accept Assumptions" quick-action button
- Conversation history preservation on errors
- State clearing when Step 1 inputs change
- Validation preventing early navigation

**Out of Scope:**
- File upload within Step 2 (already handled in Step 1)
- Direct editing of individual assumption fields (refinement via conversation only)
- Saving conversation history to disk (handled by wizard state persistence in Item 22)
- Industry templates (Phase 5)

### Technical Considerations

**Integration Points:**
- `BedrockConversationService` for Claude API calls
- `IdeationWizardPanel` for wizard navigation and state management
- Webview message passing for UI updates
- System prompt in `resources/prompts/ideation-assistant.md` (may need gap-filling specific additions)

**Claude Response Format:**
- Claude must return structured JSON for assumptions within its response
- Need prompt engineering to ensure consistent parseable format
- Example expected structure in Claude response:
```json
{
  "assumptions": [
    {
      "system": "SAP S/4HANA",
      "modules": ["MM", "SD", "PP"],
      "integrations": ["Salesforce CRM sync", "EDI with suppliers"]
    }
  ]
}
```

**UI Components Needed:**
- Chat message container (scrollable)
- Claude message component (left-aligned, with streaming support)
- User message component (right-aligned)
- Assumption card component (structured display)
- Accept button component (embedded in Claude message)
- Text input with send button
- Loading/streaming indicator
- Error state with retry button

**State Management:**
- Track `isStreaming` to disable navigation during response
- Track `assumptionsAccepted` to enable "Confirm & Continue"
- Detect Step 1 changes to trigger conversation reset
- Preserve conversation on navigation away and back (until Step 1 changes)
