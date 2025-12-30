# Spec Initialization

## Spec Name
Wizard Step 7: Demo Design

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
   - Ordered list of demo scenes (drag-to-reorder)
   - Each scene: title, description, which agents are highlighted
   - "Generate Narrative" button: model proposes scene sequence based on agent design

**Output:**
- Stored in wizard state for `demo-strategy.md` generation in Phase 4

## Context

- This is step 7 of an 8-step ideation wizard
- Follows existing step patterns (Step2Logic, Step3Logic, Step4Logic, Step5Logic, Step6Logic handlers)
- Uses AI via Bedrock Claude integration for persona and narrative generation
- State persisted to wizard-state.json
- Output feeds into steering file generation in Step 8
