# Spec Requirements: Steering Document Prompts

## Initial Description
Create system prompts for transforming wizard state into Kiro steering markdown documents. The prompts will be located in `resources/prompts/steering/` and will generate 8 steering files that guide Kiro's spec-driven development for agent workflows.

## Requirements Discussion

### First Round Questions

**Q1:** I'm assuming each prompt should follow the existing pattern from your other assistant prompts (like `agent-design-assistant.md`) where the AI generates structured JSON embedded in markdown that can be parsed by the service. Is that correct, or should these prompts generate pure markdown without a JSON wrapper since the output IS the steering file content?
**Answer:** Pure markdown, no JSON wrapper. The output IS the steering file and will be written directly to `.kiro/steering/*.md`. Each prompt should include the instruction: "Output ONLY the markdown content. Do not wrap in JSON or code blocks."

**Q2:** I notice there are no existing `.kiro/steering/` files in this project yet. Do you have examples of Kiro steering files from other projects that show the expected markdown structure, headings, and formatting conventions?
**Answer:** Steering files should follow these conventions:
- Optional YAML frontmatter with `inclusion: always | fileMatch | manual`
- H1 (#) for document title
- H2 (##) for major sections
- Prose paragraphs preferred over excessive bullets
- Code snippets only where demonstrating patterns
- Focus on explaining "why" not just "what"

**Q3:** I'm assuming the prompts should include instructions for handling missing or optional wizard data gracefully. Should the prompts include explicit fallback guidance, or should validation happen before generation?
**Answer:** Two-layer approach:
- TypeScript validates required steps (1, 2, 3, 5) before generation - error if missing
- Prompts include fallback instructions for optional steps (4, 6, 7) with sensible defaults
- Required steps: Step 1 Business Context, Step 2 Assumptions, Step 3 Outcomes, Step 5 Agent Design
- Optional steps with fallbacks: Step 4 Security, Step 6 Mock Data, Step 7 Demo Strategy

**Q4:** The roadmap mentions including AgentCore features guidance in `tech-steering.prompt.md`. Should this be high-level steering or include specific command examples and configuration templates?
**Answer:** Include specific examples and templates with placeholders:
- CLI commands: `agentcore deploy --agent-name {agent_name} --runtime python3.11`
- Gateway YAML config templates
- Cedar policy patterns for approval gates
- DynamoDB event emission patterns for observability
- Use placeholders like `{agent_name}`, `{region}` - never hardcoded values

**Q5:** For `integration-landscape-steering.prompt.md`, should the prompt instruct Claude to analyze the mockData.mockDefinitions and identify tools used by multiple agents, or should this analysis be done in TypeScript before calling the prompt?
**Answer:** Do analysis in TypeScript before calling the prompt:
- TypeScript function `analyzeSharedTools()` identifies tools used by 2+ agents
- Prompt receives pre-analyzed `sharedTools` and `perAgentTools` arrays
- Prompt focuses on formatting into markdown tables, not performing analysis

**Q6:** Is there anything you explicitly do NOT want in these prompts?
**Answer:** Exclusions list:
- No actual code implementations (only pattern snippets)
- No hardcoded values (use placeholders)
- No mock data content (reference only)
- No verbose explanations
- No sensitive data patterns
- No Agentify-internal implementation details
- No version-specific dependencies

### Existing Code to Reference

**Similar Features Identified:**
- Feature: Existing prompt files - Path: `resources/prompts/`
  - `agent-design-assistant.md` - JSON response format with examples
  - `demo-strategy-assistant.md` - Multiple JSON formats, industry examples
  - `gap-filling-assistant.md` - Conversational flow with JSON embedded
- Components to potentially reuse: Prompt structure patterns (responsibilities section, response format section, examples section)
- Backend logic to reference: BedrockConversationService for invoking prompts

### Follow-up Questions
None required - answers were comprehensive.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A

## Requirements Summary

### Functional Requirements
- Create 8 system prompt files in `resources/prompts/steering/`:
  - `product-steering.prompt.md`
  - `tech-steering.prompt.md`
  - `structure-steering.prompt.md`
  - `customer-context-steering.prompt.md`
  - `integration-landscape-steering.prompt.md`
  - `security-policies-steering.prompt.md`
  - `demo-strategy-steering.prompt.md`
  - `agentify-integration-steering.prompt.md`
- Each prompt transforms wizard state JSON into pure markdown steering content
- Output is written directly to `.kiro/steering/*.md` files
- Prompts must instruct: "Output ONLY the markdown content. Do not wrap in JSON or code blocks."

### State Mapping Per Document
| Document | Wizard State Sections Used |
|----------|---------------------------|
| `product.md` | businessObjective, industry, outcome (primaryOutcome, successMetrics, stakeholders) |
| `tech.md` | agentDesign (agents, orchestration, edges), security (for policy mapping) |
| `structure.md` | agentDesign.confirmedAgents (for folder names), mockData.mockDefinitions (for tools) |
| `customer-context.md` | industry, systems, aiGapFillingState.confirmedAssumptions |
| `integration-landscape.md` | systems, agentDesign (for shared tools analysis), mockData, pre-analyzed sharedTools/perAgentTools |
| `security-policies.md` | security (dataSensitivity, complianceFrameworks, approvalGates) |
| `demo-strategy.md` | demoStrategy (ahaMoments, persona, narrativeScenes) |
| `agentify-integration.md` | agentDesign.confirmedAgents (agent IDs), orchestration pattern |

### Markdown Structure Requirements
- Optional YAML frontmatter: `inclusion: always | fileMatch | manual`
- H1 (#) for document title
- H2 (##) for major sections
- Prose paragraphs preferred over excessive bullets
- Code snippets only where demonstrating patterns
- Focus on explaining "why" not just "what"

### AgentCore MCP Server Requirement
When generating prompts with AgentCore content, query the `amazon-bedrock-agentcore-mcp-server` MCP for:
- Current CLI commands and syntax
- Gateway registration patterns
- Cedar policy syntax
- Event schemas
- Runtime configuration

Applies to: `tech-steering.prompt.md`, `agentify-integration-steering.prompt.md`, `structure-steering.prompt.md`

### Validation Requirements
**Required Steps (TypeScript validation - error if missing):**
- Step 1: Business Context
- Step 2: AI Gap-Filling Assumptions
- Step 3: Outcome Definition
- Step 5: Agent Design

**Optional Steps (Prompt fallbacks with sensible defaults):**
- Step 4: Security & Guardrails
- Step 6: Mock Data Strategy
- Step 7: Demo Strategy

### Reusability Opportunities
- Follow prompt structure patterns from existing `resources/prompts/*.md` files
- TypeScript `analyzeSharedTools()` function pre-processes data for integration-landscape prompt
- BedrockConversationService handles prompt invocation

### Scope Boundaries
**In Scope:**
- 8 system prompt files for steering document generation
- JSON input schema documentation per prompt
- Markdown structure and section guidance
- AgentCore feature templates with placeholders
- Fallback instructions for optional wizard steps

**Out of Scope:**
- Actual code implementations (only pattern snippets)
- Hardcoded values (use placeholders only)
- Mock data content (reference only)
- Verbose explanations
- Sensitive data patterns
- Agentify-internal implementation details
- Version-specific dependencies
- The SteeringGenerationService TypeScript implementation (separate spec item 28.2)
- File writing logic (separate spec item 28.3)

### Technical Considerations
- Prompts generate pure markdown (no JSON wrapper)
- Each prompt receives relevant wizard state sections as JSON input
- Integration-landscape prompt receives pre-analyzed tool data from TypeScript
- AgentCore content should be sourced from MCP server for accuracy
- Prompts must handle missing optional data gracefully with defaults
