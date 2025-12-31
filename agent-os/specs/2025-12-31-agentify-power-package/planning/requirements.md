# Spec Requirements: Agentify Power Package

## Initial Description

Create a Kiro Power that bundles steering guidance and enforcement hooks. This is a generic package installed during project initialization (extends Item 4), not per-ideation. Ensures all agent code follows Agentify patterns from day one.

Key elements:
- Power structure with POWER.md and hooks/ directory
- Enforcement hooks for observability, CLI contracts, tool patterns, and gateway handlers
- Steering guidance for pre-bundled infrastructure, decorator order, agent handler patterns
- Gateway Lambda handler patterns
- Event emission patterns
- AgentCore CLI deployment guidance
- Common pitfalls documentation
- Distribution bundled with Agentify extension

## Requirements Discussion

### First Round Questions

**Q1:** Hook Behavior on Violations: I assume that decorator order violations and recreating pre-bundled code should be blocking errors (preventing save/generation), while missing docstrings or context cleanup warnings should be non-blocking warnings. Is that the right severity distinction, or should all hooks be advisory-only to avoid disrupting developer flow?

**Answer:** Tiered severity approach:
- **Blocking (prevent generation/save):**
  - Recreating `agents/shared/` modules (critical architectural violation)
  - Wrong decorator order (`@instrument_tool` before `@tool`)
- **Non-blocking warnings:**
  - Missing `clear_instrumentation_context()` in finally block
  - Missing docstrings
  - Gateway handler patterns

Rationale: Blocking violations are "silent failures" that would cause demos to break mysteriously.

**Q2:** Installation Timing: I understand the power is installed during "Agentify: Initialize Project" (extending Item 4). Should the power be installed automatically (no user prompt, always installed), or with confirmation ("Install Agentify enforcement hooks?" prompt)?

**Answer:** Automatic installation, no prompt. Install automatically during "Agentify: Initialize Project" without user confirmation. Rationale: Extends Item 4, ensures patterns from day one, no friction.

**Q3:** Hook Feedback UI: When hooks detect issues, how should violations be surfaced to the developer? I'm thinking: Kiro's native hook output (shown in problems panel or inline), VS Code diagnostics (squiggly underlines with hover info), or toast notifications for critical errors?

**Answer:** Kiro's native hook output (problems panel). Use Kiro's native mechanism. Rationale: Kiro-native, portable, standard location for linting issues.

**Q4:** Existing Steering Prompt Relationship: The codebase already has `agentify-integration-steering.prompt.md` (25KB) with detailed patterns. Should the POWER.md content reference this steering file (e.g., "See `.kiro/steering/agentify-integration.md` for full details"), or duplicate critical patterns inline for self-contained guidance?

**Answer:** Reference + condensed critical patterns:
- Inline: The 7 critical patterns (cheat sheet)
- Reference: "For complete details, see `.kiro/steering/agentify-integration.md`"
Rationale: Scannable POWER.md, avoids duplication/drift.

**Q5:** Kiro Power Manifest Format: I assume we should use the standard Kiro powers format with `manifest.json` pointing to `POWER.md` and hooks. Should activation be keyword-based (activates when user mentions "agent", "workflow", "Strands", etc.), or always active once installed (since all agent work needs these patterns)?

**Answer:** Keyword-based activation with keywords: ["agent", "workflow", "Strands", "orchestrator", "demo", "multi-agent", "tool", "handler"]. Rationale: Only inject patterns when contextually relevant.

**Q6:** What should we explicitly exclude from this spec? For example, should we defer unit tests for hooks, cross-platform testing, or Kiro community publishing to a future spec?

**Answer:** Explicit exclusions (defer to future specs):
- Unit tests for hooks
- Cross-platform testing
- Kiro community publishing (marked M in roadmap)
- Hook auto-fix capabilities
- Custom severity configuration

Include in this spec:
- Power directory structure
- POWER.md content
- All 4 hook implementations
- Integration with Initialize Project command
- Basic manual testing instructions

### Existing Code to Reference

**Similar Features Identified:**
- Feature: Resource Extraction Service - Path: `src/services/resourceExtractionService.ts`
  - Pattern for extracting bundled resources from extension to workspace
  - Handles directory creation, recursive copy, permission setting
- Feature: Initialize Project Command - Path: `src/commands/initializeProject.ts`
  - Integration point for power installation (extends Step 7)
  - Pattern for checking existing files and handling overwrite
- Feature: Agentify Integration Steering Prompt - Path: `resources/prompts/steering/agentify-integration-steering.prompt.md`
  - Contains full implementation patterns that POWER.md should reference
  - Defines decorator order, context management, DynamoDB patterns
- Feature: Steering File Template - Path: `src/templates/steeringFile.ts`
  - Pattern for creating Kiro steering files during initialization

### Follow-up Questions

No follow-up questions needed - user provided comprehensive answers.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A

## Requirements Summary

### Functional Requirements

**Power Structure:**
- Create `resources/agentify-power/` directory in extension bundle
- Include `POWER.md` with condensed critical patterns (7 items)
- Include `hooks/` directory with 4 enforcement hooks
- Include `manifest.json` with keyword-based activation

**POWER.md Content (7 Critical Patterns):**
1. Pre-bundled infrastructure - `agents/shared/` imports, never recreate
2. Decorator order - `@tool` FIRST, `@instrument_tool` ON TOP
3. Agent handler pattern - `set_instrumentation_context` in try, `clear` in finally
4. Gateway Lambda handler pattern - mock data co-located, return JSON string
5. Event emission patterns - stdout events, DynamoDB tool events
6. AgentCore CLI deployment - `agentcore deploy`, only `main.py` runs locally
7. Common pitfalls - consolidated don'ts with rationale

**Hook Implementations:**
1. `observability-enforcer.kiro.hook` - Pattern: `agents/**/*.py`
   - BLOCKING: Recreating `agents/shared/` modules
   - BLOCKING: Wrong decorator order
   - WARNING: Missing context cleanup in finally

2. `cli-contract-validator.kiro.hook` - Pattern: `agents/main.py`
   - WARNING: Missing argparse setup
   - WARNING: Missing `--prompt`, `--workflow-id`, `--trace-id` arguments
   - WARNING: Missing `AGENTIFY_TABLE_NAME`, `AGENTIFY_TABLE_REGION` env var reads

3. `tool-pattern.kiro.hook` - Pattern: `agents/*/tools/*.py`
   - BLOCKING: Wrong decorator order
   - BLOCKING: Locally-defined `@instrument_tool` decorator
   - WARNING: Missing `@tool` decorator
   - WARNING: Missing docstrings or type hints

4. `gateway-handler.kiro.hook` - Pattern: `cdk/gateway/handlers/*/handler.py`
   - WARNING: External file references (must use `os.path.dirname(__file__)`)
   - WARNING: Non-string return values (must use `json.dumps()`)
   - WARNING: Missing mock_data.json check

**Installation Integration:**
- Extend `handleInitializeProject()` in `src/commands/initializeProject.ts`
- Add Step 8: Install Agentify Power (after steering file creation)
- Extract `resources/agentify-power/` to `.kiro/powers/agentify/`
- Create/update `.kiro/powers/manifest.json` with power registration
- Automatic, no user confirmation required

**Manifest Format:**
```json
{
  "powers": [
    {
      "name": "agentify",
      "path": "./agentify",
      "activationKeywords": ["agent", "workflow", "Strands", "orchestrator", "demo", "multi-agent", "tool", "handler"]
    }
  ]
}
```

### Reusability Opportunities

- `resourceExtractionService.ts` - Reuse `copyDirectoryRecursive()` for power extraction
- `initializeProject.ts` - Extend existing initialization flow pattern
- `agentify-integration-steering.prompt.md` - Reference for detailed patterns (POWER.md links to this)

### Scope Boundaries

**In Scope:**
- Power directory structure creation (`resources/agentify-power/`)
- POWER.md with 7 condensed critical patterns
- 4 hook implementations with tiered severity
- Integration with Initialize Project command
- Power manifest.json with keyword activation
- Basic manual testing instructions in spec

**Out of Scope:**
- Unit tests for hooks (future spec)
- Cross-platform testing (future spec)
- Kiro community publishing (future spec, marked M in roadmap)
- Hook auto-fix capabilities (future enhancement)
- Custom severity configuration UI (future enhancement)
- Visual diagram generation for hook flow

### Technical Considerations

**Hook Trigger Events:**
- All hooks use `fileSaved` event trigger
- Pattern matching uses glob patterns per hook

**Blocking vs Warning Implementation:**
- Blocking violations: Hook returns error-level output that Kiro interprets as blocking
- Warnings: Hook returns warning-level output shown in problems panel

**File Patterns:**
- `agents/**/*.py` - All Python files in agents directory tree
- `agents/main.py` - Specific entry point file
- `agents/*/tools/*.py` - Tool files within agent subdirectories
- `cdk/gateway/handlers/*/handler.py` - Gateway Lambda handlers

**Pre-existing Infrastructure:**
- `agents/shared/` is bundled via Item 28.6 (separate roadmap item)
- CDK stacks bundled via existing `resourceExtractionService.ts`
- POWER.md references these, hooks enforce their use

**Kiro Powers API:**
- Use standard Kiro powers directory structure (`.kiro/powers/`)
- Follow Kiro hooks format per https://kiro.dev/docs/hooks/types/
- Use keyword-based activation per https://kiro.dev/docs/powers/
