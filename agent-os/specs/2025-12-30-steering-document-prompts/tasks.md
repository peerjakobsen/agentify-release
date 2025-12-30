# Task Breakdown: Steering Document Prompts

## Overview
Total Tasks: 25 tasks across 4 task groups

This spec creates 8 system prompts that transform wizard state JSON into pure markdown steering documents for Kiro spec-driven development. All prompts share common patterns but target different wizard state sections.

## Task List

### Prompt Foundation Layer

#### Task Group 1: Business Context Prompts
**Dependencies:** None

These prompts focus on business requirements and customer context - they do not require AgentCore patterns.

- [x] 1.0 Complete business context prompts
  - [x] 1.1 Read existing prompt patterns for reference
    - Read `/Users/peerjakobsen/projects/KiroPlugins/agentify/resources/prompts/agent-design-assistant.md` for structure
    - Read `/Users/peerjakobsen/projects/KiroPlugins/agentify/resources/prompts/gap-filling-assistant.md` for assumptions format
    - Note section patterns: Responsibilities, Response Format, Guidelines, Important Notes
  - [x] 1.2 Create `product-steering.prompt.md`
    - Location: `resources/prompts/steering/product-steering.prompt.md`
    - Document JSON input schema: `businessObjective`, `industry`, `outcomes.primaryOutcome`, `outcomes.successMetrics`, `outcomes.stakeholders`
    - Instruct Claude to output YAML frontmatter with `inclusion: always`
    - Output markdown sections: Product Vision, Business Objective, Success Metrics, Key Stakeholders
    - Include instruction: "Output ONLY the markdown content. Do not wrap in JSON or code blocks."
  - [x] 1.3 Create `customer-context-steering.prompt.md`
    - Location: `resources/prompts/steering/customer-context-steering.prompt.md`
    - Document JSON input schema: `industry`, `systems`, `gapFilling.confirmedAssumptions`
    - Instruct Claude to output YAML frontmatter with `inclusion: always`
    - Output markdown sections: Industry Context, Enterprise Systems, System Modules, Integration Patterns
    - Use integration description format from gap-filling-assistant: `[Source] -> [Target]: [data/purpose]`
    - Include fallback: If `confirmedAssumptions` is empty, generate minimal context from industry and systems only
  - [x] 1.4 Verify prompts follow markdown structure standards
    - H1 (#) for document title only
    - H2 (##) for major sections
    - Prose paragraphs preferred over excessive bullets
    - Focus on explaining "why" not just "what"

**Acceptance Criteria:**
- Both prompts include documented JSON input schemas
- Both prompts instruct Claude to output YAML frontmatter with `inclusion: always`
- Both prompts include explicit "Output ONLY markdown" instruction
- customer-context prompt includes fallback instructions for missing assumptions

### Technical Prompts Layer

#### Task Group 2: AgentCore-Integrated Prompts
**Dependencies:** Task Group 1

These prompts require AgentCore patterns and should query the AgentCore MCP server for accurate CLI commands, Cedar policy syntax, and event schemas.

- [x] 2.0 Complete AgentCore-integrated prompts
  - [x] 2.1 Query AgentCore MCP server for current patterns
    - Use `amazon-bedrock-agentcore-mcp-server` (already configured in project)
    - Query for: current CLI commands (`agentcore deploy`, `agentcore gateway register`)
    - Query for: Cedar policy syntax examples for approval gates
    - Query for: DynamoDB event emission best practices
    - Query for: runtime configuration options and defaults
    - Document findings and use accurate patterns in prompts (not hallucinated syntax)
    - Note: MCP queries happen at prompt-creation time, not at runtime when users generate steering files
    - Document placeholder patterns: `{agent_name}`, `{region}`, `{gateway_id}`, `{policy_name}`, `{table_name}`
    - **Implementation Note:** MCP tools were not directly accessible. Patterns derived from project's architecture.md, tech-stack.md, events.d.ts, and PyPI documentation for the MCP server package.
  - [x] 2.2 Create `tech-steering.prompt.md`
    - Location: `resources/prompts/steering/tech-steering.prompt.md`
    - Document JSON input schema: `agentDesign.confirmedAgents`, `agentDesign.confirmedOrchestration`, `agentDesign.confirmedEdges`, `security.dataSensitivity`, `security.approvalGates`
    - Instruct Claude to output YAML frontmatter with `inclusion: always`
    - Output markdown sections: Architecture Overview, Orchestration Pattern, AgentCore Deployment, Gateway Configuration, Policy Mapping
    - Include AgentCore CLI command templates with placeholders
    - Include Cedar policy pattern examples mapped from `security.approvalGates`
    - Include fallback: If security step skipped, use default `internal` sensitivity and empty gates
  - [x] 2.3 Create `structure-steering.prompt.md`
    - Location: `resources/prompts/steering/structure-steering.prompt.md`
    - Document JSON input schema: `agentDesign.confirmedAgents`, `mockData.mockDefinitions`
    - Instruct Claude to output YAML frontmatter with `inclusion: always`
    - Output markdown sections: Project Structure, Agent Folders, Tool Organization, File Naming Conventions
    - Map agent IDs to folder names (e.g., `agents/{agent_id}/`)
    - Map tools to expected file locations
    - Include fallback: If mockData skipped, list tool names without schema details
  - [x] 2.4 Create `agentify-integration-steering.prompt.md`
    - Location: `resources/prompts/steering/agentify-integration-steering.prompt.md`
    - Document JSON input schema: `agentDesign.confirmedAgents`, `agentDesign.confirmedOrchestration`
    - Instruct Claude to output YAML frontmatter with `inclusion: always`
    - Output markdown sections: Event Emission Contract, Agent IDs for Tracing, CLI Invocation Pattern, Required Decorators
    - Include DynamoDB event schema for Demo Viewer panel
    - Include OpenTelemetry trace correlation patterns
    - Reference AgentCore MCP patterns from 2.1

**Acceptance Criteria:**
- All prompts include AgentCore CLI patterns with placeholders
- tech-steering includes Cedar policy mapping from approval gates
- structure-steering maps agents to folder structure
- agentify-integration includes event emission contract
- All prompts include fallback instructions for optional steps

### Integration Prompts Layer

#### Task Group 3: Systems and Security Prompts
**Dependencies:** Task Group 1

These prompts focus on system integrations and security policies - they receive pre-analyzed data from TypeScript.

- [x] 3.0 Complete integration and security prompts
  - [x] 3.1 Create `integration-landscape-steering.prompt.md`
    - Location: `resources/prompts/steering/integration-landscape-steering.prompt.md`
    - Document JSON input schema:
      - From WizardState: `systems`, `agentDesign.confirmedAgents`, `mockData.mockDefinitions`
      - Pre-computed by TypeScript (not from WizardState): `sharedTools[]`, `perAgentTools[]` (see analyzeSharedTools() in SteeringGenerationService)
    - Instruct Claude to output YAML frontmatter with `inclusion: always`
    - Output markdown sections: Connected Systems, Shared Tools, Per-Agent Tools, Data Flow Patterns
    - Shared tools formatted as markdown table with "Tool Name", "System", "Used By Agents" columns
    - Include instruction that sharedTools analysis is pre-computed by TypeScript
    - Include fallback: If mockData skipped, reference tool names without mock schemas
  - [x] 3.2 Create `security-policies-steering.prompt.md`
    - Location: `resources/prompts/steering/security-policies-steering.prompt.md`
    - Document JSON input schema: `security.dataSensitivity`, `security.complianceFrameworks`, `security.approvalGates`, `security.guardrailNotes`
    - Instruct Claude to output YAML frontmatter with `inclusion: always`
    - Output markdown sections: Data Classification, Compliance Requirements, Approval Gates, Guardrail Constraints
    - Map sensitivity levels to recommended handling patterns
    - Map compliance frameworks to specific controls
    - Include fallback: If security step skipped, generate with defaults: `internal` sensitivity, no frameworks, no gates
  - [x] 3.3 Create `demo-strategy-steering.prompt.md`
    - Location: `resources/prompts/steering/demo-strategy-steering.prompt.md`
    - Document JSON input schema: `demoStrategy.ahaMoments`, `demoStrategy.persona`, `demoStrategy.narrativeScenes`
    - Reference demo-strategy-assistant.md for industry examples and persona format
    - Instruct Claude to output YAML frontmatter with `inclusion: manual`
    - Output markdown sections: Demo Persona, Aha Moments, Narrative Flow, Talking Points
    - Include fallback: If demo strategy step skipped, either omit file entirely OR generate minimal placeholder
  - [x] 3.4 Verify all prompts handle missing optional data gracefully
    - Step 4 (Security): Default to `internal` sensitivity, empty frameworks/gates
    - Step 6 (Mock Data): Reference tool names only, no mock schemas
    - Step 7 (Demo Strategy): Omit file or generate minimal placeholder

**Acceptance Criteria:**
- integration-landscape documents pre-analyzed sharedTools input
- integration-landscape outputs markdown tables for tool sharing
- security-policies maps sensitivity levels to handling patterns
- demo-strategy references existing demo-strategy-assistant patterns
- All prompts include clear fallback instructions

### Validation Layer

#### Task Group 4: Prompt Validation and Consistency
**Dependencies:** Task Groups 1-3

- [x] 4.0 Validate all prompts for consistency and completeness
  - [x] 4.1 Verify all 8 prompts follow consistent structure
    - Each prompt has: Purpose section, Input Schema section, Output Format section, Guidelines section, Important Notes section
    - Each prompt includes "Output ONLY markdown" instruction
    - Each prompt documents expected JSON input with field descriptions
  - [x] 4.2 Verify YAML frontmatter assignments
    - `inclusion: always` for: product, customer-context, tech, integration-landscape, security-policies
    - `inclusion: always` for: structure (agent folder patterns vary by project)
    - `inclusion: always` for: agentify-integration (critical for instrumentation)
    - `inclusion: manual` for: demo-strategy
  - [x] 4.3 Verify input schema coverage against WizardState
    - All referenced fields exist in `src/types/wizardPanel.ts`
    - Field paths are accurate (e.g., `agentDesign.confirmedAgents` not `agentDesign.agents`)
    - Optional fields marked as optional in schema documentation
  - [x] 4.4 Create steering directory if not exists
    - Create directory: `resources/prompts/steering/`
    - Verify all 8 prompt files are in correct location
  - [x] 4.5 Verify placeholder usage
    - No hardcoded values (region names, account IDs, etc.)
    - All dynamic values use placeholder format: `{placeholder_name}`
    - AgentCore commands use consistent placeholder names
  - [x] 4.6 Verify all field paths against actual WizardState interface
    - Check `src/types/wizardPanel.ts` for actual field names
    - Verify SecurityState field names (e.g., `dataSensitivity` vs `guardrails`)
    - Verify DemoStrategyState field names (e.g., `ahaMoments` vs `moments`)
    - Update prompts if interface uses different names than documented

**Acceptance Criteria:**
- All 8 prompt files created in `resources/prompts/steering/`
- All prompts follow consistent section structure
- All prompts have correct YAML frontmatter inclusion values
- All referenced WizardState fields are accurate
- No hardcoded values - all use placeholders

## Execution Order

Recommended implementation sequence:
1. **Task Group 1**: Business Context Prompts - Foundation prompts that establish patterns
2. **Task Group 2**: AgentCore-Integrated Prompts - Technical prompts requiring MCP server
3. **Task Group 3**: Systems and Security Prompts - Integration prompts with pre-analyzed data
4. **Task Group 4**: Validation - Consistency check across all prompts

## State Mapping Reference

| Prompt File | Wizard State Sections | Inclusion |
|-------------|----------------------|-----------|
| `product-steering.prompt.md` | `businessObjective`, `industry`, `outcomes.*` | always |
| `customer-context-steering.prompt.md` | `industry`, `systems`, `gapFilling.confirmedAssumptions` | always |
| `tech-steering.prompt.md` | `agentDesign.confirmed*`, `security.*` | always |
| `structure-steering.prompt.md` | `agentDesign.confirmedAgents`, `mockData.mockDefinitions` | always |
| `integration-landscape-steering.prompt.md` | `systems`, `agentDesign`, `mockData`, `sharedTools[]`*, `perAgentTools[]`* | always |
| `security-policies-steering.prompt.md` | `security.*` | always |
| `demo-strategy-steering.prompt.md` | `demoStrategy.*` | manual |
| `agentify-integration-steering.prompt.md` | `agentDesign.confirmed*` | always |

\* `sharedTools[]` and `perAgentTools[]` are computed by TypeScript before calling the prompt, not stored in WizardState

## Required vs Optional Step Handling

**Required Steps (error if missing):**
- Step 1: Business Context (`businessObjective`, `industry`, `systems`)
- Step 2: AI Gap-Filling (`confirmedAssumptions`)
- Step 3: Outcome Definition (`primaryOutcome`, `successMetrics`, `stakeholders`)
- Step 5: Agent Design (`confirmedAgents`, `confirmedOrchestration`, `confirmedEdges`)

**Optional Steps (fallback defaults):**
- Step 4: Security - Default: `dataSensitivity: 'internal'`, empty `complianceFrameworks`, empty `approvalGates`
- Step 6: Mock Data - Default: Reference tool names only, no mock schemas
- Step 7: Demo Strategy - Default: Omit `demo-strategy.md` or generate minimal placeholder

## Files to Create

```
resources/prompts/steering/
  product-steering.prompt.md
  tech-steering.prompt.md
  structure-steering.prompt.md
  customer-context-steering.prompt.md
  integration-landscape-steering.prompt.md
  security-policies-steering.prompt.md
  demo-strategy-steering.prompt.md
  agentify-integration-steering.prompt.md
```

## AgentCore MCP Server Reference

The project has `amazon-bedrock-agentcore-mcp-server` configured. When writing prompts that include AgentCore patterns:

1. Query the MCP server for accurate CLI syntax before writing
2. Do not guess or hallucinate AgentCore commands
3. Use consistent placeholder format: `{placeholder_name}`
4. Verify patterns work before committing prompt files

**Prompts requiring AgentCore MCP queries:**
- `tech-steering.prompt.md` - CLI commands, Gateway config, Cedar policies
- `structure-steering.prompt.md` - Project layout for AgentCore deployment
- `agentify-integration-steering.prompt.md` - Event emission, tracing patterns
