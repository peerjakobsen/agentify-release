# Spec Requirements: AWS Credential Chain Integration

## Initial Description

AWS Credential Chain Integration - Use AWS SDK's default credential provider chain to automatically consume credentials from shared AWS config files (~/.aws/credentials, ~/.aws/config), supporting IAM credentials, IAM Identity Center (SSO), and assumed roles configured via AWS CLI or AWS Toolkit; add project-level region configuration in .agentify/config.json for DynamoDB and Bedrock API calls.

## Requirements Discussion

### First Round Questions

**Q1:** I assume the goal is to move region configuration from VS Code settings to `.agentify/config.json` so each project can target different AWS regions without changing global IDE settings. Is that correct, or should we keep both options (VS Code settings as fallback, config.json as override)?
**Answer:** config.json as override, VS Code settings as fallback

**Q2:** I'm thinking we should support AWS profile selection (the `[profile-name]` sections in `~/.aws/config`) so users can switch between multiple AWS accounts/roles. Should we add a `profile` field to `.agentify/config.json`, or should we rely solely on the `AWS_PROFILE` environment variable?
**Answer:** Add profile field to config.json

**Q3:** For IAM Identity Center (SSO) credentials, the SDK should handle them automatically via `~/.aws/config`, but SSO tokens expire and require re-authentication via `aws sso login`. Should the extension detect expired SSO tokens and prompt users to run `aws sso login`, or just surface the SDK error message?
**Answer:** Detect expired tokens and prompt user to run `aws sso login`

**Q4:** I assume we should validate credentials on extension activation (or project initialization) and show a clear status indicator (e.g., in the status bar) showing credential health. Is that correct, or should validation only happen when an AWS API call is actually made?
**Answer:** Both - validate on activation AND when API calls are made

**Q5:** Should the region in `.agentify/config.json` support separate regions for DynamoDB and Bedrock? For example, DynamoDB in `us-east-1` but Bedrock in `us-west-2` for model availability. Or should we assume a single region for all AWS services?
**Answer:** No, keep everything in same region

**Q6:** The current region dropdown in VS Code settings is limited to `us-east-1`, `us-west-2`, and `eu-west-1`. Should we expand this to all Bedrock-supported regions, or should the config.json region field be a free-form string that accepts any valid AWS region code?
**Answer:** Expand to all Bedrock-supported regions

**Q7:** Is there anything that should be explicitly out of scope for this feature? For example: credential caching/persistence, multi-account switching within a single project, or integration with AWS Toolkit extension's credential system?
**Answer:**
- Cache the Bedrock region support list (IN scope)
- Credential caching/persistence (OUT of scope)
- Multi-account switching within single project (OUT of scope)
- Integration with AWS Toolkit extension (OUT of scope)

### Existing Code to Reference

**Similar Features Identified:**
- Feature: Credential Provider - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/credentialProvider.ts`
  - Already implements `fromNodeProviderChain` from `@aws-sdk/credential-providers`
  - Has `ICredentialProvider` interface for dependency injection
  - Includes `validateCredentials()` function
  - Wraps credential errors in `AgentifyError` for consistent error handling
- Feature: DynamoDB Config - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/config/dynamoDbConfig.ts`
  - Current region retrieval via VS Code settings
  - Configuration change listener pattern
- Feature: Config Service - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/configService.ts`
  - Manages `.agentify/config.json` read/write
  - File watching and change notification
  - Config validation pattern
- Feature: Config Types - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/config.ts`
  - `AgentifyConfig` interface with `infrastructure.dynamodb.region`
  - `validateConfigSchema()` function
- Feature: Status Bar - Path: `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/statusBar.ts`
  - Existing status bar implementation for status indicators

### Follow-up Questions

No follow-up questions needed - user answers were comprehensive.

## Visual Assets

### Files Provided:
No visual assets provided.

### Visual Insights:
N/A - No visuals to analyze.

## Requirements Summary

### Functional Requirements

**Credential Resolution:**
- Use AWS SDK's default credential provider chain (`fromNodeProviderChain`)
- Support credentials from:
  - Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
  - Shared credentials file (~/.aws/credentials)
  - Shared config file (~/.aws/config)
  - IAM Identity Center (SSO) credentials
  - Assumed roles via AWS STS
  - IAM roles (when running on AWS infrastructure)
- Add AWS profile selection via `profile` field in `.agentify/config.json`
- Pass selected profile to credential provider chain

**Region Configuration:**
- Primary source: `.agentify/config.json` (project-level override)
- Fallback source: VS Code settings `agentify.aws.region`
- Single region for all AWS services (DynamoDB and Bedrock)
- Expand available regions to all Bedrock-supported regions
- Cache the Bedrock region support list for performance

**Credential Validation:**
- Validate credentials on extension activation
- Validate credentials before each AWS API call
- Show credential health status in VS Code status bar
- Detect expired SSO tokens specifically
- Prompt users to run `aws sso login` when SSO tokens expire

**Error Handling:**
- Detect `CredentialsProviderError`, `ExpiredTokenException`, `TokenProviderError`
- Provide clear, actionable error messages
- Special handling for SSO token expiration with specific guidance

### Reusability Opportunities

**Existing Code to Extend:**
- `credentialProvider.ts` - Add profile support to `fromNodeProviderChain` options
- `dynamoDbConfig.ts` - Modify `getAwsRegion()` to check config.json first, then VS Code settings
- `configService.ts` - No changes needed, already handles config.json
- `config.ts` types - Add optional `profile` field to config schema

**Patterns to Follow:**
- Error wrapping pattern from `credentialProvider.ts`
- Configuration change listener pattern from `dynamoDbConfig.ts`
- Config validation pattern from `configService.ts`

### Scope Boundaries

**In Scope:**
- AWS SDK default credential chain integration
- Profile selection via config.json
- Region configuration hierarchy (config.json override, VS Code fallback)
- Credential validation on activation and API calls
- Status bar credential health indicator
- SSO token expiration detection and user prompting
- Expand region options to all Bedrock-supported regions
- Cache Bedrock region support list

**Out of Scope:**
- Credential caching/persistence (handled by AWS SDK/CLI)
- Multi-account switching within a single project
- Integration with AWS Toolkit extension's credential system
- Custom credential providers beyond AWS SDK default chain

### Technical Considerations

**Config Schema Changes:**
- Add optional `aws.profile` field to `.agentify/config.json`
- Region already exists at `infrastructure.dynamodb.region`
- Consider adding top-level `aws` section: `{ aws: { profile?: string, region: string } }`

**Integration Points:**
- `getDynamoDbClient()` and `getBedrockClient()` use `getAwsRegion()` - update this function
- `fromNodeProviderChain()` accepts `profile` option for profile selection
- Status bar module for credential health display

**Bedrock Region List:**
- Fetch or maintain list of Bedrock-supported regions
- Update VS Code settings enum to include all supported regions
- Consider fetching dynamically or bundling known list

**Error Detection:**
- SSO errors typically have name `TokenProviderError` or message containing "token"
- Need to distinguish SSO expiration from other credential errors
- Provide specific remediation steps for each error type
