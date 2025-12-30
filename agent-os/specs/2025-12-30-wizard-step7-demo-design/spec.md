# Specification: Wizard Step 7 - Demo Design

## Goal
Build wizard step 7 for capturing demo presentation strategy, enabling AWS sales teams to define key "aha moments," a demo persona, and a narrative flow with optional AI generation for each section.

## User Stories
- As an AWS sales rep, I want to define compelling "aha moments" tied to specific agents/tools so that my demo highlights the most impressive capabilities
- As a demo presenter, I want to generate a realistic persona and narrative flow based on my agent design so that my presentation tells a coherent customer story

## Specific Requirements

**Immediately Editable Form Pattern**
- Follow Step 4 (Security) pattern with no two-phase proposal/accept flow
- All fields editable immediately on step entry
- Sections start empty until user types or triggers AI generation
- Generate buttons populate fields without locking them
- No "Accept" phase needed for AI-generated content

**Three-Section Layout**
- Section order: Aha Moments, Demo Persona, Narrative Flow
- Each section has its own "Generate [SectionName]" button with sparkle icon
- "Generate All" button at top for full AI assistance
- Tip text below Aha Moments: "Tip: 2-3 key moments keeps your demo focused"

**Aha Moments Section**
- Repeatable field group pattern from Step 3 metrics (add/remove rows)
- Fields per moment: title (text input), trigger dropdown, talking point (textarea)
- Trigger dropdown grouped: "-- Agents --" header then agent names, "-- Tools --" header then tool names with parent agent in parentheses
- Minimum: 0 (warning if empty on proceed), Maximum: 5 (disable "Add" at limit)

**Demo Persona Section**
- Single persona only (not multiple)
- Three text fields: Name, Role, Pain Point
- Pain Point uses textarea for longer descriptions
- All plain text, no rich formatting
- "Generate Persona" button for AI assist

**Narrative Flow Section**
- Ordered list of scenes with arrow-button reordering (no drag-and-drop)
- Fields per scene: title, description (textarea max 500 chars), highlighted agents (multi-select)
- Arrow buttons: up/down for each scene row, disabled at boundaries
- Maximum: 8 scenes (disable "Add Scene" at limit)
- "Generate Narrative" button for AI assist

**AI Generation Behavior**
- Separate loading states: isGeneratingMoments, isGeneratingPersona, isGeneratingNarrative
- No auto-trigger on step entry (unlike Steps 3, 5, 6)
- Manual "Generate" button per section with sparkle icon
- "Generate All" triggers all three sections sequentially
- Edited flags track user modifications for regeneration decisions

**State Integration**
- Add DemoStrategyState to WizardState interface
- Add to PersistedWizardState for persistence
- Add createDefaultDemoStrategyState() factory function
- Add STEP7_* commands to WIZARD_COMMANDS

## Visual Design
No visual assets provided.

## Existing Code to Leverage

**Step 3 Metrics Repeatable Fields (`src/panels/ideationStepHtml.ts`)**
- Metric row pattern with add/remove buttons
- Index-based event handlers (updateMetric, removeMetric, addMetric)
- Pattern: data-index attributes for row identification

**Step 4 Immediate Edit Pattern (`src/panels/ideationStep4Logic.ts`)**
- No two-phase accept flow
- State updates directly on user input
- AI generation fills fields without blocking
- aiCalled flag for tracking generation state

**Step 6 Logic Handler (`src/panels/ideationStep6Logic.ts`)**
- Class-based handler with setState/getState pattern
- Streaming handlers (onToken, onComplete, onError) subscription
- triggerAutoSend() pattern (though Step 7 will not auto-trigger)
- handleRegenerateAll() for bulk regeneration

**MockDataService Streaming (`src/services/mockDataService.ts`)**
- Singleton service pattern with getMockDataService()
- EventEmitter pattern for onToken, onComplete, onError
- System prompt loading from resources/prompts/
- Bedrock ConverseStreamCommand usage

**Agent/Tool Dropdown Population**
- Data source: agentDesign.confirmedAgents from Step 5
- Each ProposedAgent has id, name, tools array
- Build grouped dropdown options from this data structure

## Out of Scope
- Drag-and-drop scene reordering (use arrow buttons instead)
- Multiple personas per demo
- Scene timing or duration estimates
- Extended presenter notes beyond "talking point" field
- Demo script export (PDF/PPTX)
- Video or screenshot placeholders in scenes
- Branching narratives or conditional scene paths
- Auto-trigger AI generation on step entry
- Real-time collaboration or sharing features
- Integration with external presentation tools
