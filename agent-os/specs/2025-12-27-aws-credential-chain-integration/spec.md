# Specification: AWS Credential Chain Integration

## Goal

Integrate the AWS SDK's default credential provider chain to automatically consume credentials from shared AWS config files, supporting IAM credentials, IAM Identity Center (SSO), and assumed roles; add project-level region and profile configuration in `.agentify/config.json` that overrides VS Code settings.

## User Stories

- As a developer, I want Agentify to automatically use my existing AWS credentials from `~/.aws/credentials` or SSO session so that I do not need to manually configure credentials in the extension
- As a team member working on multiple projects, I want each project to specify its own AWS region and profile in `.agentify/config.json` so that I can work with different AWS accounts without changing global settings

## Specific Requirements

**AWS Credential Provider Chain**
- Use `fromNodeProviderChain` from `@aws-sdk/credential-providers` with optional `profile` parameter
- Support credential sources in order: environment variables, shared credentials file (`~/.aws/credentials`), shared config file (`~/.aws/config`), IAM Identity Center (SSO), assumed roles via STS, IAM roles on AWS infrastructure
- Pass the profile from config.json to the credential provider chain when specified
- Reset cached credentials when config.json profile changes via `DefaultCredentialProvider.reset()`

**AWS Profile Configuration**
- Add optional `aws.profile` field to `.agentify/config.json` schema
- When profile is specified, pass it to `fromNodeProviderChain({ profile: 'profile-name' })`
- When profile is not specified, let AWS SDK use default behavior (AWS_PROFILE env var or `[default]` profile)
- Validate that profile value is a non-empty string when provided

**Region Configuration Hierarchy**
- Primary source: `.agentify/config.json` at `infrastructure.dynamodb.region` (existing field)
- Fallback source: VS Code setting `agentify.aws.region`
- Modify `getAwsRegion()` in dynamoDbConfig.ts to check config.json first via ConfigService
- Use single region for both DynamoDB and Bedrock API calls

**Expanded Bedrock Region Support**
- Update VS Code settings enum to include all Bedrock-supported regions: us-east-1, us-west-2, eu-west-1, eu-west-2, eu-central-1, ap-southeast-1, ap-southeast-2, ap-northeast-1, ap-south-1, ca-central-1, sa-east-1
- Store region list as constant array in a dedicated module for easy maintenance
- Allow config.json region to be any valid AWS region string (not restricted to Bedrock list)

**Credential Validation on Activation**
- Validate credentials when extension activates using existing `validateCredentials()` function
- Update status bar to show credential health: 'ready' (valid), 'aws-error' (invalid/missing)
- Show warning notification if credentials are missing or invalid on activation
- Do not block extension activation; allow offline workflows

**Credential Validation on API Calls**
- Validate credentials before each DynamoDB and Bedrock API call
- Catch credential errors at service boundary and surface via status bar
- Transform credential errors to `AgentifyError` with appropriate code

**SSO Token Expiration Detection**
- Detect SSO token expiration by checking for `TokenProviderError` error name or message containing "token expired" or "sso"
- Add new error code `SSO_TOKEN_EXPIRED` to `AgentifyErrorCode` enum
- Create `createSsoTokenExpiredError()` factory function with actionable message
- Prompt user to run `aws sso login --profile <profile>` command when SSO expiration detected

**Status Bar Credential Indicator**
- Extend `StatusState` type to include 'sso-expired' state
- Update `StatusBarManager.updateStatus()` to handle SSO expiration state with distinct icon and tooltip
- Add "Run AWS SSO Login" option to status bar quick-pick menu when in SSO expired state
- Show profile name in tooltip when a profile is configured: "Agentify: Ready (profile: my-profile)"

## Existing Code to Leverage

**`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/credentialProvider.ts`**
- Already implements `fromNodeProviderChain` with error wrapping pattern
- Add `profile` option to `createProvider()` method configuration
- Extend error detection to distinguish SSO expiration from other credential errors
- Use existing `reset()` method for credential cache invalidation

**`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/config/dynamoDbConfig.ts`**
- Has `getAwsRegion()` that returns region from VS Code settings
- Modify to async function that first checks ConfigService for config.json region
- Reuse `onConfigurationChange` pattern for change notification

**`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/configService.ts`**
- Already manages `.agentify/config.json` with caching and file watching
- Use `getConfig()` to read profile and region values
- Use `onConfigChanged` to react to config file changes

**`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/config.ts`**
- Add optional `aws?: { profile?: string }` section to `AgentifyConfig` interface
- Extend `validateConfigSchema()` to validate aws.profile is string when present
- Existing `infrastructure.dynamodb.region` field serves as region source

**`/Users/peerjakobsen/projects/KiroPlugins/agentify/src/statusBar.ts`**
- Has existing `StatusState` with 'aws-error' state to build upon
- Extend `StatusBarManager.updateStatus()` with SSO-specific handling
- Add SSO login command option to `showQuickPick()` menu

## Out of Scope

- Credential caching or persistence beyond AWS SDK default behavior
- Multi-account switching within a single project session
- Integration with AWS Toolkit extension's credential system
- Custom credential providers beyond AWS SDK default chain
- Automatic `aws sso login` execution from within the extension
- Credential rotation or refresh token management
- AWS organization-level credential management
- Cross-region replication or multi-region failover
- Credential encryption or secure storage within extension
- Support for non-standard AWS endpoint URLs or custom credential endpoints
