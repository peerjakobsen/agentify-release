# Specification: Steering Document Prompts

## Goal
Create 8 system prompts that transform wizard state JSON into Kiro steering markdown documents, enabling spec-driven development for agent workflows.

## User Stories
- As an Agentify user, I want wizard state automatically transformed into Kiro steering files so that I can immediately begin spec-driven development in Kiro
- As a demo presenter, I want steering documents that capture business context, tech decisions, and demo strategy so that Kiro understands the full workflow scope

## Specific Requirements

**Pure Markdown Output Format**
- Each prompt outputs ONLY raw markdown content without JSON wrappers or code blocks
- Include explicit instruction: "Output ONLY the markdown content. Do not wrap in JSON or code blocks."
- Output is written directly to `.kiro/steering/*.md` files by the generation service
- No intermediate parsing required by TypeScript - direct file write

**YAML Frontmatter Convention**
- Optional YAML frontmatter with `inclusion: always | fileMatch | manual`
- `always`: Document included in every Kiro context (product.md, tech.md)
- `fileMatch`: Document included when working on matching file types
- `manual`: Document only included when explicitly referenced

**Markdown Structure Standards**
- H1 (#) for document title only
- H2 (##) for major sections
- Prose paragraphs preferred over excessive bullet lists
- Code snippets only when demonstrating patterns (not implementations)
- Focus on explaining "why" not just "what"

**State Validation Layering**
- TypeScript pre-validates required steps (1, 2, 3, 5) before calling prompts - error if missing
- Prompts include fallback instructions for optional steps (4, 6, 7)
- Security defaults to "internal" sensitivity, empty frameworks/gates
- Mock data references tool names only when step 6 skipped
- Demo strategy omitted entirely when step 7 skipped

**Shared Tools Pre-Analysis**
- TypeScript `analyzeSharedTools()` pre-processes tool usage across agents
- Identifies tools used by 2+ agents as "shared tools" candidates
- Prompt receives pre-analyzed `sharedTools[]` and `perAgentTools[]` arrays
- Prompt focuses on markdown formatting, not analysis logic

**AgentCore Content Accuracy**
- Prompts for tech.md, structure.md, and agentify-integration.md include AgentCore patterns
- Use placeholders: `{agent_name}`, `{region}`, `{gateway_id}`, `{policy_name}`
- Include CLI command patterns: `agentcore deploy`, `agentcore gateway register`
- Include Cedar policy patterns for approval gates mapping
- Include DynamoDB event emission patterns for observability

**Input Schema Documentation**
- Each prompt documents the JSON input schema it expects
- Schema references specific WizardState interface fields
- Include examples of expected input structure for each prompt

**Fallback Instructions for Optional Steps**
- Step 4 (Security): Default to internal sensitivity, no compliance frameworks, no approval gates
- Step 6 (Mock Data): Reference tool names without mock schema details
- Step 7 (Demo Strategy): Omit demo-strategy.md entirely or generate minimal placeholder

## Visual Design
No visual assets provided for this specification.

## Existing Code to Leverage

**`resources/prompts/agent-design-assistant.md`**
- Demonstrates prompt structure with Responsibilities, Response Format, Field Definitions, Examples, and Important Notes sections
- Shows JSON schema documentation pattern that can be adapted for input schema documentation
- Provides tool naming convention reference (`{system}_{operation}` format)

**`resources/prompts/demo-strategy-assistant.md`**
- Contains industry-specific examples (Retail, Healthcare, FSI, Manufacturing)
- Shows persona, aha moment, and narrative scene patterns to reference in demo-strategy-steering.prompt.md
- Demonstrates talking point and presentation-focused content

**`resources/prompts/gap-filling-assistant.md`**
- Shows conversational response format with JSON embedded in markdown
- Demonstrates the assumptions/integrations data format used in customer-context.md
- Provides integration description format: `[Source] -> [Target]: [data/purpose]`

**`src/types/wizardPanel.ts`**
- Contains all TypeScript interfaces for wizard state (WizardState, AgentDesignState, MockDataState, etc.)
- Defines data structures prompts will receive as JSON input
- Includes field documentation useful for prompt input schemas

**Existing Prompt Section Patterns**
- "Your Responsibilities" section listing 3-5 numbered tasks
- "Response Format" section with JSON schema examples
- "Guidelines" section with best practices bullets
- "Important Notes" section with critical instructions

## Out of Scope
- Actual TypeScript implementation code (separate spec item 28.2)
- File writing logic and service orchestration (separate spec item 28.3)
- SteeringGenerationService implementation
- Mock payload content (reference tool names only)
- Hardcoded configuration values (use placeholders only)
- Version-specific dependencies or package versions
- Agentify-internal implementation details (DynamoDB table names, etc.)
- Sensitive data patterns or real credentials
- Verbose explanations or tutorial content
- Complete AgentCore documentation (reference MCP server for accuracy)
