# Spec Requirements: CDK Infrastructure Bundling & Extraction

## Initial Description

Replace CloudFormation SDK deployment with bundled CDK infrastructure that users deploy manually.

**From raw-idea.md:**

28.5. CDK Infrastructure Bundling & Extraction - Replace CloudFormation SDK deployment with bundled CDK infrastructure:

**File Extraction on "Initialize Project":**
- Extract bundled `resources/cdk/` to `{workspace}/cdk/` (full CDK project with NetworkingStack + ObservabilityStack)
- Extract bundled `resources/scripts/` to `{workspace}/scripts/` (setup.sh, destroy.sh, Dockerfile template)
- Auto-open `cdk/README.md` in editor with deployment instructions

**User-Driven Deployment:**
- User runs `./scripts/setup.sh --region {region}` manually
- setup.sh outputs to `.agentify/infrastructure.json` (deployment info)
- Clear instructions include CDK bootstrap (first-time), deployment command, cost estimate (~$32/mo)

**Config Architecture:**
- Keep separate files: `infrastructure.json` (deployment outputs), `config.json` (extension settings)
- Extension reads from `infrastructure.json` when present for DynamoDB table name/region

**Code Cleanup:**
- Remove `src/services/cloudFormationService.ts`
- Remove `infrastructure/dynamodb-table.yaml`
- Remove `infrastructure/` folder
- Update `initializeProject.ts` to use file extraction instead of SDK calls

**Bundling:**
- Ensure `resources/cdk/` and `resources/scripts/` included in VSIX package
- Add `cdk/README.md` with comprehensive deployment instructions

## Requirements Discussion

### First Round Questions

**Q1:** I assume the CDK infrastructure should be extracted once per workspace during "Initialize Project", and subsequent initializations should detect existing `cdk/` folder and offer to skip extraction. Is that correct, or should we always overwrite?

**Answer:** Detect existing `cdk/` folder and offer to skip. Show a quick pick: "CDK folder exists. Overwrite with latest version?" with options: "Skip (keep existing)" / "Overwrite". This protects user customizations while allowing updates.

**Q2:** The existing CDK includes both NetworkingStack (VPC, NAT Gateway, endpoints ~$60/mo) and ObservabilityStack (DynamoDB, ~$0/mo). I assume users should be able to deploy either just the ObservabilityStack for simpler/cheaper setups, or both stacks together. Should we provide separate deployment options, or always deploy everything?

**Answer:** Always deploy everything together. The NetworkingStack is required for AgentCore - without VPC configuration, agents can't deploy. Keep it simple: one command deploys everything needed.

**Q3:** I'm thinking the "Initialize Project" command should: (a) extract files, (b) auto-open `cdk/README.md`, and (c) show a VS Code notification with the command to run. Should we also add a "Deploy Infrastructure" button in the notification that opens an integrated terminal with the command pre-populated?

**Answer:** Just auto-open README.md. No terminal button. Users need to read about CDK bootstrap, understand costs, and review what they're creating. The README is the right place for this.

**Q4:** The raw idea specifies separating `infrastructure.json` (deployment outputs) from `config.json` (extension settings). I assume the extension should first check for `infrastructure.json`, and if present, use its values for `tableName`/`region` instead of looking in `config.json`. For backward compatibility, should we also fall back to reading from `config.json` if `infrastructure.json` is missing?

**Answer:** Yes, fall back to config.json. Read infrastructure.json first, then fall back to config.json for the DynamoDB table name. This supports existing projects that deployed via the old SDK approach.

**Q5:** Currently `initializeProject.ts` creates `config.json` with `infrastructure.dynamodb.*` fields populated from CloudFormation outputs. With the new model, should we: (a) still create `config.json` but leave infrastructure fields empty/placeholder until user runs setup.sh, or (b) not create `config.json` at all until infrastructure is deployed?

**Answer:** Still create config.json but leave infrastructure fields empty. Keep files separate:
- config.json = extension settings (AWS profile, region preference)
- infrastructure.json = deployment outputs (created by setup.sh)

**Q6:** The current flow validates AWS credentials upfront and deploys automatically. The new flow is user-driven via setup.sh. Should "Initialize Project" still prompt for AWS profile/region selection to pre-populate the setup.sh command, or should we remove credential validation entirely since deployment is manual?

**Answer:** Still prompt for region, skip credential validation. Region is useful to pre-populate in setup.sh command and store in config.json. Profile selection can stay for convenience but don't validate credentials.

**Q7:** I assume we should not delete the existing `cloudFormationService.ts` until we've fully migrated, allowing a transition period. Or do you want a clean break where the old SDK-based flow is removed immediately?

**Answer:** Remove cloudFormationService.ts immediately. Clean break. No value in keeping dead code.

### Existing Code to Reference

No similar existing features identified for reference by the user. However, based on codebase exploration:

**Relevant Files for Implementation:**
- `src/commands/initializeProject.ts` - Current initialization flow to modify
- `src/services/cloudFormationService.ts` - To be removed
- `src/services/configService.ts` - Config reading/writing patterns
- `src/templates/steeringFile.ts` - File creation patterns
- `resources/cdk/` - CDK project to be extracted (already exists)
- `resources/scripts/setup.sh` - Setup script (already exists, writes to infrastructure.json)
- `resources/scripts/destroy.sh` - Destroy script (already exists)
- `infrastructure/dynamodb-table.yaml` - To be removed

### Follow-up Questions

No follow-up questions needed. All answers were comprehensive and clear.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A

## Requirements Summary

### Functional Requirements

**File Extraction:**
- Extract bundled `resources/cdk/` to `{workspace}/cdk/`
- Extract bundled `resources/scripts/` to `{workspace}/scripts/`
- Detect existing `cdk/` folder before extraction
- Show quick pick if folder exists: "Skip (keep existing)" / "Overwrite"
- Auto-open `cdk/README.md` in editor after extraction

**User Prompts:**
- Prompt for AWS region selection (store in config.json)
- Profile selection can stay for convenience
- Skip credential validation (deployment is manual)

**Config File Architecture:**
- Create `config.json` with extension settings (profile, region preference)
- Leave infrastructure fields empty/placeholder in config.json
- `infrastructure.json` created by setup.sh (not by extension)
- Extension reads DynamoDB config: check infrastructure.json first, fall back to config.json

**Code Removal:**
- Delete `src/services/cloudFormationService.ts`
- Delete `infrastructure/dynamodb-table.yaml`
- Delete `infrastructure/` folder entirely
- Remove all CloudFormation SDK imports and usage from initializeProject.ts

**Bundling:**
- Ensure `resources/cdk/` included in VSIX package
- Ensure `resources/scripts/` included in VSIX package

### Reusability Opportunities

- Config service patterns in `src/services/configService.ts` for reading infrastructure.json
- File writing patterns in `src/templates/steeringFile.ts` for extracting bundled files
- Quick pick patterns in `initializeProject.ts` for overwrite confirmation

### Scope Boundaries

**In Scope:**
- File extraction from bundled resources to workspace
- Overwrite detection and user confirmation
- Auto-opening README.md after extraction
- Region prompt (without credential validation)
- Profile prompt (optional, no validation)
- Config.json creation with empty infrastructure fields
- Reading from infrastructure.json with config.json fallback
- Removal of CloudFormation SDK code and infrastructure/ folder

**Out of Scope:**
- Auto-deployment from extension (user runs scripts manually)
- Infrastructure state management (CDK handles this)
- Multi-region support in single project
- Custom VPC configurations (use defaults)
- Destroy/teardown from extension UI (user runs destroy.sh manually)
- Progress monitoring of CDK deployment
- AgentCore agent deployment automation (that's Phase 2)
- Terminal integration or pre-populated commands
- Selective stack deployment (always deploy everything)

### Technical Considerations

**Existing CDK Infrastructure:**
- NetworkingStack: VPC, private subnets, NAT Gateway, VPC endpoints (~$60/mo)
- ObservabilityStack: DynamoDB table for workflow events (~$0/mo)
- Both stacks required for AgentCore agent deployment

**Config File Schema Changes:**
- `config.json`: Extension settings only (version, project, aws profile/region, workflow settings)
- `infrastructure.json`: Deployment outputs (region, vpc_subnet_ids, vpc_security_group_id, workflow_events_table, deployed_at)

**Backward Compatibility:**
- Existing projects with infrastructure info in config.json will continue to work
- Extension checks infrastructure.json first, falls back to config.json

**File Paths:**
- Source: `resources/cdk/` and `resources/scripts/` (bundled with extension)
- Destination: `{workspace}/cdk/` and `{workspace}/scripts/`
- Config: `.agentify/config.json` (extension settings)
- Infrastructure: `.agentify/infrastructure.json` (deployment outputs, created by setup.sh)
