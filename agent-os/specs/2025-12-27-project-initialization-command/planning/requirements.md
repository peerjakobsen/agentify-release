# Spec Requirements: Project Initialization Command

## Initial Description
Project Initialization Command — Add "Agentify: Initialize Project" command that: (1) checks AWS credentials via default credential chain, (2) validates DynamoDB table exists using tableValidator service, (3) if table missing, prompts user to deploy using bundled `infrastructure/dynamodb-table.yaml` template via CloudFormation SDK, (4) waits for stack CREATE_COMPLETE, (5) generates `.agentify/config.json` with table name, region, and stack name, (6) creates `.kiro/steering/agentify-integration.md` steering file. The CloudFormation template from spec #1 is packaged with the extension for automated deployment.

## Requirements Discussion

### First Round Questions

**Q1:** I assume the command should be idempotent - if the user runs "Agentify: Initialize Project" on an already-initialized project (`.agentify/config.json` exists), we should detect this and ask if they want to reinitialize or skip. Is that correct, or should we simply overwrite existing configuration?
**Answer:** Detect and ask if they want to reinitialize or skip.

**Q2:** For CloudFormation stack naming, I'm thinking we should use a default stack name like `agentify-workflow-events` with an option for the user to customize it (since multiple developers might share the same AWS account). Should we auto-generate a unique name, prompt for custom name, or use fixed default?
**Answer:** Auto-generate a unique name (e.g., `agentify-workflow-events-{workspace-name}`).

**Q3:** I assume we should prompt the user to select an AWS region before deployment, defaulting to the region from VS Code settings (`agentify.aws.region`). Should we also prompt for AWS profile selection if they have multiple profiles configured?
**Answer:** Yes, prompt for AWS profile selection if they have multiple profiles configured.

**Q4:** For the CloudFormation deployment flow, I'm planning to show a progress notification with deployment status, poll for stack status (CREATE_IN_PROGRESS -> CREATE_COMPLETE), and handle CREATE_FAILED gracefully with error messages and rollback. Is there a preferred polling interval?
**Answer:** 5-second polling interval is fine.

**Q5:** If the table already exists in the account (deployed outside this command), should we reuse it, prompt user to choose, or always require deployment through CloudFormation?
**Answer:** Always require deployment through CloudFormation for consistency.

**Q6:** For the `.kiro/steering/agentify-integration.md` file, should we only create if it doesn't exist, always overwrite, or prompt before overwriting?
**Answer:** Prompt before overwriting an existing file.

**Q7:** I assume the command should be accessible from both the Command Palette and potentially a "Get Started" button in the Demo Viewer panel when the project isn't initialized. Is that correct?
**Answer:** Yes, both Command Palette and "Get Started" button in Demo Viewer panel.

**Q8:** Is there anything specifically out of scope for this command?
**Answer:** See follow-up questions below for detailed scope boundaries.

### Existing Code to Reference

**Similar Features Identified:**
- Service: `tableValidator.ts` - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/tableValidator.ts` - validates DynamoDB table existence and status
- Service: `credentialProvider.ts` - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/credentialProvider.ts` - AWS credential chain with profile support
- Service: `credentialValidation.ts` - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/credentialValidation.ts` - credential validation with status updates
- Service: `configService.ts` - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/configService.ts` - manages `.agentify/config.json` CRUD operations
- Module: `statusBar.ts` - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/statusBar.ts` - status bar state management patterns
- Entry point: `extension.ts` - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/extension.ts` - command registration pattern (see `registerCommands()` and `handleInitializeProject()` stub)
- Template: `infrastructure/dynamodb-table.yaml` - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/infrastructure/dynamodb-table.yaml` - CloudFormation template to deploy

**New Dependencies Required:**
- `@aws-sdk/client-cloudformation` - not currently in package.json, needed for CloudFormation SDK operations

### Follow-up Questions

**Follow-up 1:** What is specifically out of scope for this command?
**Answer:** Based on roadmap analysis and user confirmation:
- Python virtual environment setup: NOT in roadmap - out of scope
- Bedrock model access validation: NOT explicitly planned - out of scope
- Workflow trigger configuration: Handled by later specs (#5, #10) - out of scope
- IAM role/policy creation: NOT in roadmap - out of scope (user expects pre-configured permissions)

**Follow-up 2:** For auto-generating the stack name from workspace name, how should we handle spaces, special characters, and long names?
**Answer:** Yes to both - sanitize (lowercase, replace spaces/special chars with hyphens) and truncate if needed to fit CloudFormation's 128 character limit.

**Follow-up 3:** For AWS profile selection UI when multiple profiles exist, what UI pattern should we use?
**Answer:**
- Show a VS Code QuickPick dropdown listing all available profiles
- Include a "Use default" option at the top
- Do NOT allow typing custom profile names (only select from list)

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A - No visual mockups were provided. Implementation should follow standard VS Code extension UX patterns for:
- QuickPick dropdowns for profile/region selection
- Progress notifications for CloudFormation deployment
- Information/warning/error messages for user feedback
- Confirmation dialogs for reinitialize and overwrite prompts

## Requirements Summary

### Functional Requirements
- **Command Registration**: Register "Agentify: Initialize Project" command accessible from Command Palette
- **Entry Point in Demo Viewer**: Add "Get Started" button in Demo Viewer panel when project not initialized
- **Idempotency Check**: Detect existing `.agentify/config.json` and prompt user to reinitialize or skip
- **AWS Profile Selection**: Show QuickPick with available profiles + "Use default" option (no custom typing)
- **AWS Region Selection**: Prompt for region, defaulting to VS Code setting `agentify.aws.region`
- **Credential Validation**: Check AWS credentials via default credential chain before proceeding
- **CloudFormation Deployment**: Always deploy via CloudFormation (no reuse of externally-created tables)
- **Stack Naming**: Auto-generate stack name as `agentify-workflow-events-{sanitized-workspace-name}`
- **Workspace Name Sanitization**: Lowercase, replace spaces/special chars with hyphens, truncate to fit 128 char limit
- **Deployment Progress**: Show progress notification with status updates
- **Polling**: Poll CloudFormation stack status every 5 seconds
- **Error Handling**: Handle CREATE_FAILED gracefully with error messages
- **Config Generation**: Create `.agentify/config.json` with table name, table ARN, region, and stack name
- **Steering File Creation**: Create `.kiro/steering/agentify-integration.md`
- **Steering File Overwrite**: Prompt user before overwriting existing steering file

### Reusability Opportunities
- Reuse `credentialProvider.ts` for AWS credential chain with profile support
- Reuse `credentialValidation.ts` for pre-flight credential validation
- Reuse `tableValidator.ts` pattern for CloudFormation stack status validation
- Reuse `configService.ts` for creating `.agentify/config.json`
- Reuse `statusBar.ts` patterns for updating status during initialization
- Follow command registration pattern from `extension.ts`

### Scope Boundaries

**In Scope:**
- AWS credential validation via default credential chain
- AWS profile selection (QuickPick UI)
- AWS region selection
- CloudFormation stack deployment using bundled template
- Stack status polling with progress notification
- `.agentify/config.json` generation
- `.kiro/steering/agentify-integration.md` creation
- Idempotency handling (reinitialize prompts)
- "Get Started" button in Demo Viewer panel

**Out of Scope:**
- Python virtual environment creation
- `agents/` folder structure creation
- Bedrock model access validation
- Workflow trigger configuration (handled by spec #5, #10)
- IAM role or policy creation (users expected to have pre-configured permissions)
- Reusing externally-created DynamoDB tables (always deploy via CloudFormation)

### Technical Considerations
- **New Dependency**: Must add `@aws-sdk/client-cloudformation` to package.json
- **CloudFormation SDK Operations**: CreateStack, DescribeStacks for polling
- **Template Bundling**: `infrastructure/dynamodb-table.yaml` must be accessible at runtime (bundled with extension)
- **Stack Name Constraints**: CloudFormation limits stack names to 128 characters, alphanumeric + hyphens only
- **Profile Discovery**: Use AWS SDK to list available profiles from `~/.aws/config` and `~/.aws/credentials`
- **Steering File Template**: Define content for `.kiro/steering/agentify-integration.md` based on tech-stack.md specifications
- **Config Schema**: Follow existing `AgentifyConfig` type from `src/types/config.ts`
