# Raw Idea: Implementation Roadmap Generation (Phase 2)

**Item 28.4: Implementation Roadmap Generation (Phase 2)**

Generate `roadmap.md` from steering files with Kiro usage guidance. This adds Phase 2 to the Step 8 UI - after Phase 1 steering files are generated, a "Generate Roadmap" button appears that creates a roadmap.md file containing numbered implementation items with copy-paste prompts for Kiro IDE.

Key aspects:
- Trigger: "Generate Roadmap" button appears after Phase 1 steering files are written
- Input: Loads 4 steering files (tech.md, structure.md, integration-landscape.md, agentify-integration.md)
- Output: `.kiro/steering/roadmap.md`
- Prompt file already exists: `resources/prompts/steering/roadmap-steering.prompt.md`
- Phase 2 UI section in Step 8 with generation progress, success state, usage instructions
- Error handling for missing steering files or generation failures
