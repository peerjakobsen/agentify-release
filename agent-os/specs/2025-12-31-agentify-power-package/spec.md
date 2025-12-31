# Specification: Agentify Power Package

## Goal
Create a Kiro Power that bundles steering guidance and enforcement hooks, ensuring all agent code follows Agentify patterns from day one through automatic installation during project initialization.

## User Stories
- As a developer, I want enforcement hooks to catch pattern violations during code generation so that my agents work correctly with the Demo Viewer
- As a developer, I want condensed critical patterns in POWER.md so that I can quickly reference Agentify conventions without reading lengthy documentation

## Specific Requirements

**Power Directory Structure**
- Create `resources/agentify-power/` directory in extension bundle
- Include `POWER.md` as the primary guidance document
- Include `manifest.json` with keyword-based activation configuration
- Include `hooks/` subdirectory containing all enforcement hooks

**POWER.md Content - 7 Critical Patterns**
- Pattern 1: Pre-bundled infrastructure - import from `agents/shared/`, never recreate
- Pattern 2: Decorator order - `@tool` FIRST, `@instrument_tool` ON TOP of the stack
- Pattern 3: Agent handler pattern - `set_instrumentation_context()` in try, `clear_instrumentation_context()` in finally
- Pattern 4: Gateway Lambda handler - mock data co-located, return JSON string via `json.dumps()`
- Pattern 5: Event emission - stdout events for real-time, DynamoDB tool events for persistence
- Pattern 6: AgentCore CLI deployment - `agentcore deploy`, only `main.py` runs locally
- Pattern 7: Common pitfalls - consolidated don'ts with rationale for each
- Include reference: "For complete details, see `.kiro/steering/agentify-integration.md`"

**manifest.json Configuration**
- Use standard Kiro powers manifest format
- Configure keyword-based activation with: "agent", "workflow", "Strands", "orchestrator", "demo", "multi-agent", "tool", "handler"
- Point to POWER.md and hooks directory

**observability-enforcer.kiro.hook**
- Pattern: `agents/**/*.py` (all Python files in agents directory tree)
- BLOCKING: Detect recreation of `agents/shared/` modules (imports like `from agents.shared.instrumentation import` must exist, never local definitions)
- BLOCKING: Detect wrong decorator order (`@instrument_tool` must come before `@tool` in stack order)
- WARNING: Detect missing `clear_instrumentation_context()` in finally blocks

**cli-contract-validator.kiro.hook**
- Pattern: `agents/main.py` (entry point file)
- WARNING: Detect missing argparse setup
- WARNING: Detect missing `--prompt`, `--workflow-id`, `--trace-id` arguments
- WARNING: Detect missing `AGENTIFY_TABLE_NAME`, `AGENTIFY_TABLE_REGION` environment variable reads

**tool-pattern.kiro.hook**
- Pattern: `agents/*/tools/*.py` (tool files within agent subdirectories)
- BLOCKING: Detect wrong decorator order (`@tool` must be bottom, `@instrument_tool` on top)
- BLOCKING: Detect locally-defined `@instrument_tool` decorator (must import from shared)
- WARNING: Detect missing `@tool` decorator on functions
- WARNING: Detect missing docstrings or type hints on tool functions

**gateway-handler.kiro.hook**
- Pattern: `cdk/gateway/handlers/*/handler.py` (Lambda handlers)
- WARNING: Detect external file references not using `os.path.dirname(__file__)`
- WARNING: Detect non-string return values (must use `json.dumps()`)
- WARNING: Detect missing mock_data.json check for local development

**Initialize Project Integration**
- Extend `handleInitializeProject()` in `src/commands/initializeProject.ts`
- Add Step 8: Install Agentify Power (after steering file creation in Step 7)
- Extract `resources/agentify-power/` to `.kiro/powers/agentify/` destination
- Create/update `.kiro/powers/manifest.json` with power registration
- Installation is automatic with no user confirmation required

## Visual Design
No visual assets provided.

## Existing Code to Leverage

**resourceExtractionService.ts**
- Reuse `copyDirectoryRecursive()` function for extracting power directory from extension bundle
- Follow same pattern of source/destination path constants (`POWER_SOURCE_PATH`, `POWER_DEST_PATH`)
- Leverage `checkFolderExists()` for idempotency checks
- No overwrite prompt needed for powers (auto-install)

**initializeProject.ts**
- Follow existing step pattern (Steps 1-7 already implemented)
- Add Step 8 after steering file creation (Step 7)
- Use same error handling pattern (non-blocking with console.warn)
- Extend `InitializationResult` interface if needed to track power installation

**steeringFile.ts Template Pattern**
- Reference STEERING_DIR_PATH constant pattern for power path constants
- Follow same `createDirectory` + `writeFile` flow
- Use similar `SteeringFileResult` pattern for `PowerInstallResult` interface

**agentify-integration-steering.prompt.md**
- POWER.md should reference this file for complete details
- Contains full `@instrument_tool` decorator documentation
- Contains complete `set_instrumentation_context()` / `clear_instrumentation_context()` patterns
- Contains DynamoDB event schema and CLI contract details

## Out of Scope
- Unit tests for hooks (defer to future spec)
- Cross-platform testing (defer to future spec)
- Kiro community publishing (marked M in roadmap, future spec)
- Hook auto-fix capabilities (future enhancement)
- Custom severity configuration UI (future enhancement)
- Visual diagram generation for hook flow
- Per-ideation power installation (this is project-level only)
- Interactive prompts during power installation
- Rollback or uninstall functionality
