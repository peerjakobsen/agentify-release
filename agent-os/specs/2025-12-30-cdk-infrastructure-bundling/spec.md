# Specification: CDK Infrastructure Bundling & Extraction

## Goal

Replace the automated CloudFormation SDK deployment in "Initialize Project" with bundled CDK infrastructure that users deploy manually, providing transparency into costs, control over AWS resources, and a cleaner architecture separating extension settings from deployment outputs.

## User Stories

- As a developer, I want to review infrastructure costs and understand what AWS resources will be created before deploying, so that I can make informed decisions about my cloud spending
- As a developer, I want my existing projects that used the old SDK deployment to continue working, so that I don't have to redeploy infrastructure when updating the extension

## Specific Requirements

**File Extraction from Bundled Resources**
- Extract `resources/cdk/` to `{workspace}/cdk/` on "Initialize Project" command
- Extract `resources/scripts/` to `{workspace}/scripts/` on "Initialize Project" command
- Use VS Code's `vscode.workspace.fs` API for cross-platform file operations
- Preserve directory structure and all nested files during extraction
- Use extension context's `extensionPath` to locate bundled resources

**Existing CDK Folder Detection**
- Check if `{workspace}/cdk/` folder exists before extraction
- Show QuickPick dialog with two options: "Skip (keep existing)" / "Overwrite"
- Default behavior protects user customizations to CDK or script files
- Log user's choice for debugging purposes

**Auto-Open README After Extraction**
- Open `cdk/README.md` in the editor after successful extraction
- Use `vscode.window.showTextDocument()` to display the file
- README contains CDK bootstrap instructions, deployment command, and cost estimate (~$60/mo)
- No terminal integration or pre-populated commands - user reads README first

**Region and Profile Prompts (Simplified)**
- Keep existing `showRegionSelection()` QuickPick from `initializeProject.ts`
- Keep existing `showProfileSelection()` QuickPick for convenience
- Remove credential validation step - deployment is manual via setup.sh
- Store selected region and profile in config.json for user reference

**Config File Architecture (Separation of Concerns)**
- Create `.agentify/config.json` with extension settings only (version, project placeholder, AWS profile, region, workflow settings)
- Leave infrastructure fields empty or omit entirely in config.json
- setup.sh script creates `.agentify/infrastructure.json` with deployment outputs (region, vpc_subnet_ids, vpc_security_group_id, workflow_events_table, deployed_at)
- Extension reads DynamoDB config: check infrastructure.json first, fall back to config.json

**Infrastructure Config Reader (Backward Compatibility)**
- Create new function in configService.ts: `getInfrastructureConfig()`
- Check for `.agentify/infrastructure.json` first and parse it
- Fall back to reading `infrastructure.dynamodb.*` fields from config.json
- Return normalized object with `tableName` and `region` regardless of source
- Existing projects with infrastructure in config.json continue working

**Code Cleanup (Clean Break)**
- Delete `src/services/cloudFormationService.ts` entirely
- Delete `infrastructure/dynamodb-table.yaml` CloudFormation template
- Delete `infrastructure/` folder entirely
- Remove all CloudFormation SDK imports from `initializeProject.ts`
- Remove `deployCloudFormationStack()` function and related code
- Remove `@aws-sdk/client-cloudformation` dependency from package.json

**VSIX Bundling Configuration**
- Ensure `resources/cdk/` included in VSIX via package.json `files` array
- Ensure `resources/scripts/` included in VSIX package
- Existing `"resources/**"` glob in package.json should cover both folders
- Verify during build that bundled files are present in output

## Visual Design

No visual mockups provided.

## Existing Code to Leverage

**`src/commands/initializeProject.ts` - Initialization Flow**
- Reuse `showProfileSelection()` QuickPick for AWS profile selection
- Reuse `showRegionSelection()` QuickPick for AWS region selection
- Reuse `checkExistingConfig()` for idempotency check pattern
- Adapt `showSuccessNotification()` to open README instead of steering file

**`src/services/configService.ts` - Config Management**
- Reuse `createConfig()` pattern for writing config.json with validation
- Reuse `loadConfig()` pattern for reading infrastructure.json
- Extend singleton pattern to handle infrastructure.json as secondary file
- Leverage `vscode.workspace.fs` API usage for cross-platform file operations

**`src/templates/steeringFile.ts` - File Creation Patterns**
- Reuse directory creation pattern with `vscode.workspace.fs.createDirectory()`
- Reuse overwrite prompt QuickPick pattern for CDK folder detection
- Reuse `Buffer.from()` for writing file content
- Adapt `SteeringFileResult` interface for extraction result reporting

**`resources/scripts/setup.sh` - Infrastructure Output Format**
- Script already writes to `.agentify/infrastructure.json` with correct schema
- Script outputs: region, vpc_subnet_ids, vpc_security_group_id, workflow_events_table, deployed_at
- No changes needed to setup.sh - extension just needs to read its output

**`package.json` - Bundling Configuration**
- Existing `"files": ["resources/**"]` glob includes CDK and scripts folders
- Verify at build time that `resources/cdk/` and `resources/scripts/` are bundled
- Remove `@aws-sdk/client-cloudformation` from dependencies after cleanup

## Out of Scope

- Auto-deployment from extension (users run setup.sh manually)
- Terminal integration or pre-populated shell commands
- Infrastructure state management (CDK handles this)
- Multi-region support in single project
- Custom VPC configurations (users can modify extracted CDK)
- Destroy/teardown command from extension UI (users run destroy.sh manually)
- Progress monitoring of CDK deployment
- AgentCore agent deployment automation (Phase 2 roadmap item)
- Selective stack deployment (always deploy NetworkingStack + ObservabilityStack together)
- CDK version checking or updates (users manage their extracted CDK)
