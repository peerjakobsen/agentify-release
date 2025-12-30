# Spec Requirements: Wizard Step 7 - Demo Design

## Initial Description
Build wizard step 7 for capturing demo presentation strategy. This step helps AWS sales teams prepare compelling demos by defining:

1. **Key "Aha Moments"** (repeatable field groups):
   - Moment title: "What should impress the audience?" - e.g., "Real-time SAP inventory sync"
   - When it occurs: dropdown selecting which agent/tool triggers this moment
   - What to say: suggested talking point for presenter

2. **Demo Persona** (with AI generation):
   - Persona name (text): e.g., "Maria, Regional Inventory Manager"
   - Persona role (text): e.g., "Reviews morning replenishment recommendations for 12 stores"
   - Persona pain point (text): e.g., "Currently spends 2 hours manually checking stock levels"
   - AI assist: "Generate Persona" button creates persona based on industry/objective context

3. **Narrative Flow** (ordered scenes with AI generation):
   - Ordered list of demo scenes (reorderable via arrow buttons)
   - Each scene: title, description, which agents are highlighted
   - "Generate Narrative" button: model proposes scene sequence based on agent design

**Output:**
- Stored in wizard state for `demo-strategy.md` generation in Phase 4

## Requirements Discussion

### First Round Questions

**Q1:** Looking at Steps 3, 5, and 6, each triggers AI automatically on step entry when context has changed. Should Step 7 follow the same pattern - auto-generate all three sections together on step entry, or should each section have separate "Generate" buttons with no auto-trigger?
**Answer:** Separate "Generate" buttons for each section. No auto-trigger on step entry.
- Step 7 is creative/subjective unlike Steps 3, 5, 6
- Users may want to write their own content without AI
- Three simultaneous generations would be slow/overwhelming
- Each section has a "Generate" button (with sparkle icon)
- Sections start empty
- "Generate All" button at top for full AI assist

**Q2:** Steps 3 and 5 use a two-phase approach: Phase 1 shows AI suggestions as read-only cards with "Accept" button, Phase 2 shows editable forms. Should Step 7 follow this same pattern, or be immediately editable (like Step 4 Security)?
**Answer:** Immediately editable (like Step 4 Security)
- Content is creative, not analytical
- Two-phase adds friction for personalized content
- AI generation is optional assistance, not a proposal
- Empty editable fields on entry
- "Generate" populates fields with AI suggestions
- No "Accept" phase needed

**Q3:** Should there be constraints on Aha Moments? Minimum required? Maximum allowed?
**Answer:** Minimum: 0 (optional). Maximum: 5. Recommend at least 1.
- Warning (not blocking) if 0 moments when proceeding
- Hard limit of 5 with disabled "Add" button at limit
- Soft guidance: "Tip: 2-3 key moments keeps your demo focused"

**Q4:** For the "drag-to-reorder" scenes capability, should we implement full drag-and-drop, or are up/down arrow buttons acceptable?
**Answer:** Up/down arrow buttons. No drag-and-drop.
- HTML5 drag-and-drop in VS Code webviews is finicky
- Arrow buttons are simpler, accessible, reliable
- Scenes typically 3-6 items, making arrows practical

**Q5:** The "When it occurs" dropdown for Aha Moments needs to show agents and their tools. Should the dropdown show agents only, tools only, or both grouped?
**Answer:** Both, grouped with clear labels
Format:
```
-- Agents --
  Orchestrator
  Inventory Agent
-- Tools --
  sap_get_inventory (Inventory Agent)
```
Show tool's parent agent in parentheses for context.

**Q6:** Should users be able to define multiple personas, or keep it as a single persona?
**Answer:** Single persona only
- Sales demos focus on one user story
- Multiple personas adds complexity without clear benefit
- Users can run wizard multiple times for different scenarios

**Q7:** What should explicitly NOT be included in this step?
**Answer:** Exclusions for this iteration:
- Drag-and-drop reordering (use arrow buttons instead)
- Multiple personas
- Scene timing/duration estimates
- Presenter notes beyond "what to say" field
- Demo script export (PDF/PPTX)
- Video/screenshot placeholders in scenes
- Branching narratives (conditional scene paths)

### Existing Code to Reference

**Similar Features Identified:**
- Feature: Success Metrics repeatable fields - Path: `src/panels/ideationStepHtml.ts` (Step 3 metrics with add/remove rows)
- Feature: Step 4 immediately-editable pattern - Path: `src/panels/ideationStep4Logic.ts`
- Feature: Step 6 Logic Handler pattern - Path: `src/panels/ideationStep6Logic.ts`
- Feature: AI streaming with Bedrock - Path: `src/services/mockDataService.ts`
- Components to potentially reuse: Repeatable field group pattern from Step 3 metrics, loading states with spinner, edited flags pattern
- Backend logic to reference: Service initialization, streaming handlers (onToken, onComplete, onError), state management pattern

### Follow-up Questions
No follow-up questions needed - answers were comprehensive.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A - No visuals to analyze.

## Requirements Summary

### Functional Requirements

**UI Pattern:**
- Immediately editable form (no two-phase proposal/accept)
- Empty fields on step entry
- Three sections: Aha Moments, Demo Persona, Narrative Flow
- Each section has individual "Generate" button
- "Generate All" button at top for full AI generation

**Aha Moments Section:**
- Repeatable field group (add/remove rows)
- Fields per moment:
  - Title (text input)
  - Trigger dropdown (agents and tools, grouped)
  - Talking point (text area)
- Minimum: 0 (warning if empty on proceed)
- Maximum: 5 (disable "Add" at limit)
- Tip text: "2-3 key moments keeps your demo focused"

**Demo Persona Section:**
- Single persona (not multiple)
- Fields:
  - Name (text input)
  - Role (text input)
  - Pain Point (text area)
- All fields plain text
- "Generate Persona" button for AI assist

**Narrative Flow Section:**
- Ordered list of scenes
- Reorder via up/down arrow buttons (no drag-and-drop)
- Fields per scene:
  - Title (text input)
  - Description (text area, max 500 characters)
  - Highlighted agents (multi-select from confirmed agents)
- Maximum: 8 scenes
- "Generate Narrative" button for AI assist

**AI Generation:**
- Separate loading states per section (isGeneratingMoments, isGeneratingPersona, isGeneratingNarrative)
- Generate populates fields but does not lock them
- User edits tracked via edited flags (momentsEdited, personaEdited, narrativeEdited)
- Regenerate replaces content (respects edited flags pattern)

### State Structure

```typescript
interface DemoStrategyState {
  ahaMoments: AhaMoment[];
  persona: DemoPersona;
  narrativeScenes: NarrativeScene[];
  isGeneratingMoments: boolean;
  isGeneratingPersona: boolean;
  isGeneratingNarrative: boolean;
  momentsEdited: boolean;
  personaEdited: boolean;
  narrativeEdited: boolean;
}

interface AhaMoment {
  id: string;
  title: string;
  triggerType: 'agent' | 'tool';
  triggerName: string;
  talkingPoint: string;
}

interface DemoPersona {
  name: string;
  role: string;
  painPoint: string;
}

interface NarrativeScene {
  id: string;
  title: string;
  description: string;  // Max 500 chars
  highlightedAgents: string[];
}
```

### AI Prompt Context

**Aha Moments Generation:**
- Context: Industry, business objective, confirmed agents, confirmed tools
- Prompt pattern: "Based on this agent workflow for {industry}, suggest 2-3 key 'aha moments'..."

**Persona Generation:**
- Context: Industry, business objective, outcome definition
- Prompt pattern: "Create a realistic demo persona for {industry} who would benefit from this {businessObjective} workflow..."

**Narrative Generation:**
- Context: Agent design, edges/flow, aha moments (if defined)
- Prompt pattern: "Create a 4-5 scene demo flow for presenting this agent workflow..."

### Reusability Opportunities
- Repeatable field group pattern from Step 3 (SuccessMetrics add/remove)
- Step 4 immediate-edit pattern (no two-phase)
- Step 6 logic handler structure for AI service integration
- Existing streaming handlers (onToken, onComplete, onError)
- Edited flags pattern from multiple steps

### Scope Boundaries

**In Scope:**
- Three-section demo strategy form
- Individual and bulk AI generation
- Aha moments with agent/tool trigger dropdown
- Single demo persona with AI generation
- Narrative scenes with arrow-button reordering
- Validation warnings (non-blocking)
- State persistence via wizard-state.json
- Output for demo-strategy.md steering file

**Out of Scope:**
- Drag-and-drop reordering
- Multiple personas
- Scene timing/duration estimates
- Extended presenter notes
- Demo script export (PDF/PPTX)
- Video/screenshot placeholders
- Branching narratives
- Auto-trigger AI on step entry

### Technical Considerations
- Follow Step6LogicHandler pattern for new Step7LogicHandler
- Reuse BedrockConversationService pattern for AI calls
- Agent/tool dropdown populated from agentDesign.confirmedAgents
- State integrated into existing WizardState and PersistedWizardState
- Add to WIZARD_COMMANDS for webview message handling
- HTML rendering added to ideationStepHtml.ts
- New prompt file: resources/prompts/demo-strategy-assistant.md

### Constraints
- Maximum 5 aha moments
- Maximum 8 narrative scenes
- Scene descriptions maximum 500 characters
- Persona fields are plain text (no rich formatting)
- Arrow buttons for reordering (not drag-and-drop)
