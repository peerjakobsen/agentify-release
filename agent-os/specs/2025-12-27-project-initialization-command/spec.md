# Specification: Project Initialization Command

## Goal
Implement the "Agentify: Initialize Project" command that validates AWS credentials, deploys the DynamoDB infrastructure via CloudFormation, and configures the project with necessary config and steering files.

## User Stories
- As a developer, I want to initialize Agentify in my project with a single command so that I can start observing AI agent workflows without manual AWS setup
- As a team member sharing an AWS account, I want the initialization to create uniquely-named resources so that my infrastructure does not conflict with teammates

## Specific Requirements

**AWS Profile Selection UI**
- Display VS Code QuickPick dropdown listing all AWS profiles from `~/.aws/config` and `~/.aws/credentials`
- Include "Use default" option at top of the list (selected by default)
- Do not allow custom text entry; users must select from available profiles
- Store selected profile in `.agentify/config.json` under `aws.profile` field
- Use AWS SDK `loadSharedConfigFiles` or similar to discover available profiles

**AWS Region Selection UI**
- Display QuickPick with common AWS regions after profile selection
- Default to value from VS Code setting `agentify.aws.region` if configured
- Store selected region in config for CloudFormation deployment
- Region list should include at minimum: us-east-1, us-east-2, us-west-1, us-west-2, eu-west-1, eu-central-1, ap-northeast-1, ap-southeast-1

**Credential Validation**
- Validate AWS credentials using selected profile before CloudFormation deployment
- Reuse existing `DefaultCredentialProvider` class with `setProfile()` method
- Display clear error message if credentials invalid or SSO token expired
- Offer "Run AWS SSO Login" action for SSO token expiration errors

**CloudFormation Stack Deployment**
- Always deploy infrastructure via CloudFormation (never reuse externally-created tables)
- Read template from bundled `infrastructure/dynamodb-table.yaml` at runtime
- Auto-generate stack name: `agentify-workflow-events-{sanitized-workspace-name}`
- Sanitize workspace name: lowercase, replace spaces/special chars with hyphens, truncate to fit 128 char limit
- Use CloudFormation SDK `CreateStackCommand` with template body and TableName parameter

**Deployment Progress and Polling**
- Show VS Code progress notification during deployment with withProgress API
- Poll stack status using `DescribeStacksCommand` every 5 seconds
- Handle status transitions: CREATE_IN_PROGRESS -> CREATE_COMPLETE or CREATE_FAILED
- On CREATE_COMPLETE, extract TableName and TableArn from stack outputs
- On CREATE_FAILED, display error reason from stack events and offer cleanup guidance

**Config File Generation**
- Create `.agentify/config.json` using existing `ConfigService.createConfig()` method
- Populate infrastructure.dynamodb with tableName, tableArn, and region from stack outputs
- Set aws.profile if non-default profile was selected
- Include placeholder values for project and workflow sections (to be configured later)
- Follow existing `AgentifyConfig` type schema from `src/types/config.ts`

**Steering File Creation**
- Create `.kiro/steering/agentify-integration.md` with integration instructions for Kiro AI
- Prompt user before overwriting if file already exists
- Content should describe the agentify_observability decorators and DynamoDB event patterns
- Create `.kiro/steering/` directory if it does not exist

**Idempotency Handling**
- Check for existing `.agentify/config.json` before starting initialization
- If config exists, prompt user with options: "Reinitialize" or "Cancel"
- "Reinitialize" should deploy new stack (previous stack remains; user can delete manually)
- Clear ConfigService cache after successful reinitialization

**Demo Viewer Integration**
- Add "Get Started" button in Demo Viewer panel when project not initialized
- Button should trigger `agentify.initializeProject` command
- After successful initialization, refresh Demo Viewer to show ready state

## Visual Design
No visual mockups provided. Implementation should follow standard VS Code extension UX patterns:
- QuickPick dropdowns for profile and region selection
- Progress notifications using `vscode.window.withProgress` with cancellation support
- Information, warning, and error message dialogs for user feedback
- Confirmation dialogs for reinitialize and overwrite prompts

## Existing Code to Leverage

**credentialProvider.ts**
- `DefaultCredentialProvider` class with `setProfile()` method for dynamic profile selection
- `getDefaultCredentialProvider()` singleton accessor
- `validateCredentials()` function for pre-flight credential validation
- SSO token expiration detection via `isSsoTokenExpiredError()` helper

**configService.ts**
- `ConfigService.isInitialized()` method to check for existing config
- `ConfigService.createConfig()` method to write new config file with validation
- Automatic `.agentify/` directory creation when config does not exist
- `getConfigService()` singleton accessor for workspace-scoped instance

**statusBar.ts**
- `StatusBarManager.updateStatus()` for reflecting initialization state
- Status states: 'not-initialized', 'ready', 'aws-error', 'sso-expired'
- `handleQuickPickSelection()` pattern for command dispatch from status menu

**extension.ts**
- `handleInitializeProject()` stub function ready for implementation
- Command registration pattern in `registerCommands()` function
- `initializeWithConfig()` flow to call after successful initialization
- Panel provider refresh pattern for Demo Viewer and Ideation Wizard

**infrastructure/dynamodb-table.yaml**
- CloudFormation template with TableName parameter for customization
- Outputs: TableName and TableArn for config population
- PAY_PER_REQUEST billing mode and TTL configuration pre-configured

## Out of Scope
- Python virtual environment creation or configuration
- `agents/` folder structure creation
- Bedrock model access validation
- Workflow trigger configuration (handled by later specs)
- IAM role or policy creation (users expected to have pre-configured permissions)
- Reusing externally-created DynamoDB tables without CloudFormation
- Custom CloudFormation template parameters beyond TableName
- Multi-region deployment or cross-account setup
- Stack update or drift detection for existing stacks
- Automatic cleanup of failed CloudFormation stacks
