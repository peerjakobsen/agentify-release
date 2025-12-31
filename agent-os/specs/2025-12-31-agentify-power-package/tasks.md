# Task Breakdown: Agentify Power Package

## Overview
Total Task Groups: 8 (32 subtasks)

This spec creates a Kiro Power that bundles steering guidance and enforcement hooks, installed automatically during project initialization to ensure all agent code follows Agentify patterns from day one.

## Task List

### Power Content Layer

#### Task Group 1: Power Directory Structure and Manifest
**Dependencies:** None

- [x] 1.0 Complete power directory structure and configuration
  - [x] 1.1 Create `resources/agentify-power/` directory structure
    - Create root directory: `resources/agentify-power/`
    - Create hooks subdirectory: `resources/agentify-power/hooks/`
    - Follow existing pattern from `resources/cdk/` and `resources/scripts/`
  - [x] 1.2 Create `manifest.json` with keyword-based activation
    - Use standard Kiro powers manifest format
    - Configure keyword activation array: `["agent", "workflow", "Strands", "orchestrator", "demo", "multi-agent", "tool", "handler"]`
    - Point to POWER.md and hooks directory
    - Reference pattern from https://kiro.dev/docs/powers/
  - [x] 1.3 Create `POWER.md` with 7 critical patterns
    - Pattern 1: Pre-bundled infrastructure - import from `agents/shared/`, never recreate
    - Pattern 2: Decorator order - `@tool` FIRST, `@instrument_tool` ON TOP of the stack
    - Pattern 3: Agent handler pattern - `set_instrumentation_context()` in try, `clear_instrumentation_context()` in finally
    - Pattern 4: Gateway Lambda handler - mock data co-located, return JSON string via `json.dumps()`
    - Pattern 5: Event emission - stdout events for real-time, DynamoDB tool events for persistence
    - Pattern 6: AgentCore CLI deployment - `agentcore deploy`, only `main.py` runs locally
    - Pattern 7: Common pitfalls - consolidated don'ts with rationale
    - Include reference: "For complete details, see `.kiro/steering/agentify-integration.md`"
  - [x] 1.4 Verify power directory structure matches Kiro standards
    - Ensure all files are in correct locations
    - Validate manifest.json is valid JSON

**Acceptance Criteria:**
- `resources/agentify-power/` directory exists with correct structure
- `manifest.json` contains valid Kiro power configuration with keyword activation
- `POWER.md` contains all 7 critical patterns in scannable format
- Directory follows existing resource extraction patterns

---

### Hook Implementation Layer

#### Task Group 2: Observability Enforcer Hook
**Dependencies:** Task Group 1

- [x] 2.0 Complete observability-enforcer.kiro.hook
  - [x] 2.1 Create `hooks/observability-enforcer.kiro.hook` file structure
    - Pattern: `agents/**/*.py` (all Python files in agents directory tree)
    - Configure trigger event: `fileSaved`
    - Reference Kiro hooks format: https://kiro.dev/docs/hooks/types/
  - [x] 2.2 Implement BLOCKING: Detect recreation of `agents/shared/` modules
    - Check for local definitions of instrumentation functions
    - Ensure imports like `from agents.shared.instrumentation import` exist
    - Fail generation if local definitions found
    - Provide clear error message explaining the violation
  - [x] 2.3 Implement BLOCKING: Detect wrong decorator order
    - `@instrument_tool` must come BEFORE `@tool` in stack order (decorators read bottom-up)
    - Pattern: `@instrument_tool` should appear on line above `@tool`
    - Fail generation with clear explanation of correct order
  - [x] 2.4 Implement WARNING: Detect missing `clear_instrumentation_context()` in finally blocks
    - Check for try/finally patterns with `set_instrumentation_context()`
    - Warn if `clear_instrumentation_context()` not found in corresponding finally
    - Non-blocking warning to problems panel

**Acceptance Criteria:**
- Hook file exists at `resources/agentify-power/hooks/observability-enforcer.kiro.hook`
- BLOCKING violations prevent code generation and show clear errors
- WARNING violations show in problems panel but allow generation
- Pattern matching covers all Python files in agents directory tree

---

#### Task Group 3: CLI Contract Validator Hook
**Dependencies:** Task Group 1

- [x] 3.0 Complete cli-contract-validator.kiro.hook
  - [x] 3.1 Create `hooks/cli-contract-validator.kiro.hook` file structure
    - Pattern: `agents/main.py` (entry point file only)
    - Configure trigger event: `fileSaved`
  - [x] 3.2 Implement WARNING: Detect missing argparse setup
    - Check for `import argparse` or `from argparse import`
    - Check for `ArgumentParser` instantiation
    - Non-blocking warning if missing
  - [x] 3.3 Implement WARNING: Detect missing required CLI arguments
    - Check for `--prompt` argument definition
    - Check for `--workflow-id` argument definition
    - Check for `--trace-id` argument definition
    - Warn for each missing argument
  - [x] 3.4 Implement WARNING: Detect missing environment variable reads
    - Check for `AGENTIFY_TABLE_NAME` environment variable read
    - Check for `AGENTIFY_TABLE_REGION` or `AWS_REGION` environment variable read
    - Non-blocking warning if missing

**Acceptance Criteria:**
- Hook file exists at `resources/agentify-power/hooks/cli-contract-validator.kiro.hook`
- All checks are WARNING level (non-blocking)
- Warnings appear in Kiro problems panel with actionable guidance
- Only triggers for `agents/main.py` file

---

#### Task Group 4: Tool Pattern Hook
**Dependencies:** Task Group 1

- [x] 4.0 Complete tool-pattern.kiro.hook
  - [x] 4.1 Create `hooks/tool-pattern.kiro.hook` file structure
    - Pattern: `agents/*/tools/*.py` (tool files within agent subdirectories)
    - Configure trigger event: `fileSaved`
  - [x] 4.2 Implement BLOCKING: Detect wrong decorator order on tool functions
    - `@tool` must be bottom decorator (closest to function def)
    - `@instrument_tool` must be on top of stack (above `@tool`)
    - Fail generation with clear explanation
  - [x] 4.3 Implement BLOCKING: Detect locally-defined `@instrument_tool` decorator
    - Must import from `agents.shared.instrumentation`
    - Fail if `def instrument_tool` found locally
    - Provide error message directing to shared module
  - [x] 4.4 Implement WARNING: Detect missing decorators and documentation
    - Warn if function lacks `@tool` decorator
    - Warn if tool function missing docstring
    - Warn if tool function missing type hints on parameters
    - Non-blocking warnings to problems panel

**Acceptance Criteria:**
- Hook file exists at `resources/agentify-power/hooks/tool-pattern.kiro.hook`
- BLOCKING violations (wrong order, local decorator) prevent generation
- WARNING violations (missing docs/hints) show but allow generation
- Pattern matches tool files in nested agent directories

---

#### Task Group 5: Gateway Handler Hook
**Dependencies:** Task Group 1

- [x] 5.0 Complete gateway-handler.kiro.hook
  - [x] 5.1 Create `hooks/gateway-handler.kiro.hook` file structure
    - Pattern: `cdk/gateway/handlers/*/handler.py` (Lambda handlers)
    - Configure trigger event: `fileSaved`
  - [x] 5.2 Implement WARNING: Detect external file references without proper path handling
    - Check for file path constructions
    - Warn if not using `os.path.dirname(__file__)` pattern
    - Provide guidance on Lambda file path requirements
  - [x] 5.3 Implement WARNING: Detect non-string return values
    - Check handler return statements
    - Warn if returning dict/object without `json.dumps()`
    - API Gateway requires string response bodies
  - [x] 5.4 Implement WARNING: Detect missing mock_data.json check
    - Lambda handlers should support local development
    - Warn if no check for mock_data.json file existence
    - Provide pattern for co-located mock data

**Acceptance Criteria:**
- Hook file exists at `resources/agentify-power/hooks/gateway-handler.kiro.hook`
- All checks are WARNING level (non-blocking)
- Warnings provide actionable guidance for Lambda handler patterns
- Pattern matches handler files in gateway subdirectories

---

### Integration Layer

#### Task Group 6: TypeScript Service Extension
**Dependencies:** Task Groups 1-5

- [x] 6.0 Complete TypeScript integration for power installation
  - [x] 6.1 Add power path constants to `src/services/resourceExtractionService.ts`
    - Add `POWER_SOURCE_PATH = 'resources/agentify-power'`
    - Add `POWER_DEST_PATH = '.kiro/powers/agentify'`
    - Follow existing `CDK_SOURCE_PATH` / `CDK_DEST_PATH` pattern
  - [x] 6.2 Create `extractPowerResources()` function
    - Option A: Export `copyDirectoryRecursive()` from resourceExtractionService.ts (currently private async function)
    - Option B: Export `extractResourceDirectory()` which wraps copyDirectoryRecursive internally (also currently private)
    - Option C: Create new public function that duplicates the pattern (least preferred, code duplication)
    - Recommended: Option B - export `extractResourceDirectory()` as it handles the full copy flow
    - Use `checkFolderExists()` for idempotency (already exported)
    - No overwrite prompt (auto-install behavior)
    - Return `PowerInstallResult` interface
  - [x] 6.3 Create `PowerInstallResult` interface
    - Model after existing `ExtractionResult` interface
    - Include: `success`, `powerPath`, `message` fields
    - Keep interface focused on power-specific needs
  - [x] 6.4 Create/update `.kiro/powers/manifest.json` registration function
    - Create `.kiro/powers/` directory if needed
    - Create manifest.json with power registration (format: `{ "powers": ["./agentify"] }`)
    - Handle case where manifest already exists (merge powers array, avoid duplicates)
    - Register agentify power with relative path `./agentify`
    - Note: If Kiro uses different registration format, adjust based on official docs

**Acceptance Criteria:**
- New constants and functions follow existing patterns in resourceExtractionService.ts
- `extractResourceDirectory()` is exported from resourceExtractionService.ts
- `extractPowerResources()` handles both fresh install and reinitialize
- Powers manifest.json correctly registers the agentify power
- No user prompts during power installation (automatic)

---

#### Task Group 7: Initialize Project Command Extension
**Dependencies:** Task Group 6

- [x] 7.0 Complete Initialize Project command extension
  - [x] 7.1 Import power extraction functions in `src/commands/initializeProject.ts`
    - Import `extractPowerResources` from resourceExtractionService
    - Follow existing import pattern for extraction functions
  - [x] 7.2 Add `powerInstalled` field to `InitializationResult` interface
    - Optional boolean field: `powerInstalled?: boolean`
    - Track power installation status in result
  - [x] 7.3 Add Step 8: Install Agentify Power after steering file creation
    - Place after Step 7 (steering file creation)
    - Call `extractPowerResources(extensionPath, workspaceRoot)`
    - Use non-blocking error handling pattern (console.warn, don't fail initialization)
    - Update `powerInstalled` in result object
  - [x] 7.4 Update file header comment to include Step 8
    - Add "8. Installs Agentify Power to .kiro/powers/agentify/"
    - Renumber existing Step 8 (auto-open README) to Step 9
    - Update success notification step to Step 10

**Acceptance Criteria:**
- Power installation happens automatically after steering file creation
- Errors during power installation don't fail the overall initialization
- `InitializationResult` correctly tracks power installation status
- File header documentation accurately reflects all steps

---

### Manual Testing

#### Task Group 8: Manual Verification
**Dependencies:** Task Groups 1-7

- [x] 8.0 Verify complete implementation through manual testing
  - [x] 8.1 Test fresh project initialization
    - Run "Agentify: Initialize Project" on new project
    - Verify `.kiro/powers/agentify/` directory created
    - Verify `POWER.md`, `manifest.json`, and all 4 hooks present
    - Verify `.kiro/powers/manifest.json` exists with power registration
  - [x] 8.2 Test reinitialization behavior
    - Run "Agentify: Initialize Project" on already-initialized project
    - Select "Reinitialize project"
    - Verify power files are refreshed (not duplicated)
    - Verify powers manifest.json maintains correct structure
  - [x] 8.3 Test hook activation in Kiro
    - Create Python file at `agents/test_agent/tools/test_tool.py`
    - Write tool with wrong decorator order
    - Verify BLOCKING error appears and prevents generation
    - Fix decorator order, verify generation proceeds
  - [x] 8.4 Test warning-level hooks
    - Create `agents/main.py` without required arguments
    - Verify warnings appear in problems panel
    - Verify file can still be saved (non-blocking)
    - Add required arguments, verify warnings clear

**Acceptance Criteria:**
- Fresh initialization creates complete power structure
- Reinitialization correctly refreshes power files
- BLOCKING hooks prevent code generation on violations
- WARNING hooks show issues but allow file saves
- All 4 hooks trigger on their designated file patterns

---

## Execution Order

Recommended implementation sequence:

1. **Task Group 1: Power Directory Structure and Manifest** - Create the base resources that all other tasks depend on
2. **Task Group 2: Observability Enforcer Hook** - Most critical hook (blocks architectural violations)
3. **Task Group 3: CLI Contract Validator Hook** - Entry point validation
4. **Task Group 4: Tool Pattern Hook** - Tool file validation
5. **Task Group 5: Gateway Handler Hook** - Lambda handler validation
6. **Task Group 6: TypeScript Service Extension** - Backend integration
7. **Task Group 7: Initialize Project Command Extension** - Wire up auto-installation
8. **Task Group 8: Manual Verification** - Validate end-to-end functionality

## Notes

**Excluded from this spec (per requirements):**
- Unit tests for hooks (defer to future spec)
- Cross-platform testing (defer to future spec)
- Kiro community publishing (marked M in roadmap)
- Hook auto-fix capabilities (future enhancement)
- Custom severity configuration UI (future enhancement)

**Tiered Severity Summary:**
| Level | Effect | Use Cases |
|-------|--------|-----------|
| BLOCKING | Prevents generation/save | Recreating shared modules, wrong decorator order, locally-defined decorators |
| WARNING | Shows in problems panel | Missing context cleanup, CLI patterns, gateway handler issues |

**Key Patterns to Follow:**
- `src/services/resourceExtractionService.ts` - Export `extractResourceDirectory()` for power extraction (currently private function)
- `src/templates/steeringFile.ts` - Reference for path constants and result interfaces
- `src/commands/initializeProject.ts` - Follow existing step pattern with non-blocking error handling

---

## Implementation Summary

### Files Created

**Power Resources (`resources/agentify-power/`):**
- `manifest.json` - Kiro power manifest with keyword activation
- `POWER.md` - 7 critical patterns quick reference
- `hooks/observability-enforcer.kiro.hook` - BLOCKING: shared module recreation, decorator order; WARNING: missing context cleanup
- `hooks/cli-contract-validator.kiro.hook` - WARNING: argparse, CLI arguments, env vars
- `hooks/tool-pattern.kiro.hook` - BLOCKING: decorator order, local decorator; WARNING: missing docs/hints
- `hooks/gateway-handler.kiro.hook` - WARNING: file paths, return types, mock data

### Files Modified

**TypeScript (`src/`):**
- `services/resourceExtractionService.ts` - Added power path constants, `PowerInstallResult` interface, `extractPowerResources()` function, `extractResourceDirectory()` export, powers manifest management
- `commands/initializeProject.ts` - Added Step 8 for power installation, updated step numbering, added `powerInstalled` to result interface

### Manual Testing Instructions

**8.1 Fresh Project Initialization:**
```bash
# 1. Open VS Code in a new/empty project folder
# 2. Run command: "Agentify: Initialize Project"
# 3. Select AWS profile and region
# 4. Verify created structure:
ls -la .kiro/powers/agentify/
# Expected: POWER.md, manifest.json, hooks/
ls -la .kiro/powers/
# Expected: manifest.json with {"powers": ["./agentify"]}
```

**8.2 Reinitialization Behavior:**
```bash
# 1. In already-initialized project, run "Agentify: Initialize Project"
# 2. Select "Reinitialize project"
# 3. Verify power files are refreshed (check file timestamps)
# 4. Verify .kiro/powers/manifest.json still has single entry (no duplicates)
```

**8.3 Hook Activation (BLOCKING):**
```python
# Create: agents/test_agent/tools/test_tool.py
# Write with WRONG decorator order:
from strands import tool
from agents.shared.instrumentation import instrument_tool

@tool                    # WRONG - should be below
@instrument_tool         # WRONG - should be above
def bad_tool(param: str) -> dict:
    return {'result': param}

# Expected: BLOCKING error in Kiro problems panel
# Fix by swapping decorator order, verify error clears
```

**8.4 Warning-Level Hooks:**
```python
# Create: agents/main.py without required elements:
def main():
    print("Hello")

if __name__ == '__main__':
    main()

# Expected: Warnings for:
# - Missing argparse import
# - Missing --prompt, --workflow-id, --trace-id arguments
# - Missing AGENTIFY_TABLE_NAME environment variable read
# File should still save (non-blocking)
```
