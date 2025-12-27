# Task Breakdown: AWS Credential Chain Integration

## Overview
Total Tasks: 24 (across 4 task groups)

This spec enhances the Agentify VS Code extension to support AWS SDK's default credential provider chain with profile selection, region configuration hierarchy, and SSO token expiration detection.

## Task List

### Configuration Layer

#### Task Group 1: Configuration Schema and Constants
**Dependencies:** None

- [x] 1.0 Complete configuration schema updates
  - [x] 1.1 Write 4-6 focused tests for configuration schema changes
    - Test `aws.profile` validation accepts valid non-empty string
    - Test `aws.profile` validation rejects empty string
    - Test config validation passes when `aws` section is omitted (optional)
    - Test config validation passes when `aws.profile` is omitted (optional)
    - Test existing config validation still works with new optional fields
  - [x] 1.2 Create Bedrock supported regions constant module
    - Create `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/config/bedrockRegions.ts`
    - Export `BEDROCK_SUPPORTED_REGIONS` array: us-east-1, us-west-2, eu-west-1, eu-west-2, eu-central-1, ap-southeast-1, ap-southeast-2, ap-northeast-1, ap-south-1, ca-central-1, sa-east-1
    - Export `isBedrockSupportedRegion(region: string)` helper function
  - [x] 1.3 Add AWS config section to `AgentifyConfig` interface
    - Add optional `aws?: AwsConfig` field to `AgentifyConfig` in `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/config.ts`
    - Create `AwsConfig` interface with optional `profile?: string` field
    - Add JSDoc documentation for new fields
  - [x] 1.4 Extend `validateConfigSchema()` function
    - Add validation for `aws` section when present
    - Validate `aws.profile` is non-empty string when provided
    - Allow `aws` section to be completely omitted (backward compatible)
  - [x] 1.5 Update VS Code settings schema for expanded regions
    - Update `package.json` settings to include all Bedrock-supported regions in `agentify.aws.region` enum
    - Import region list from `bedrockRegions.ts` constant
  - [x] 1.6 Ensure configuration tests pass
    - Run ONLY the 4-6 tests written in 1.1
    - Verify schema validation works correctly

**Acceptance Criteria:**
- The 4-6 tests written in 1.1 pass
- `AgentifyConfig` interface includes optional `aws.profile` field
- `validateConfigSchema()` validates new fields correctly
- Bedrock regions constant is exported and usable
- VS Code settings include all Bedrock-supported regions

### Credential Provider Layer

#### Task Group 2: Credential Provider Enhancements
**Dependencies:** Task Group 1

- [x] 2.0 Complete credential provider enhancements
  - [x] 2.1 Write 5-7 focused tests for credential provider changes
    - Test `createProvider()` passes profile option when profile is specified
    - Test `createProvider()` works without profile (uses default behavior)
    - Test SSO token expiration is detected by `TokenProviderError` name
    - Test SSO token expiration is detected by message containing "token expired"
    - Test SSO token expiration is detected by message containing "sso"
    - Test `createSsoTokenExpiredError()` returns correct error code and message
    - Test `reset()` clears cached provider (existing behavior preserved)
  - [x] 2.2 Add `SSO_TOKEN_EXPIRED` error code
    - Add `SSO_TOKEN_EXPIRED = 'SSO_TOKEN_EXPIRED'` to `AgentifyErrorCode` enum in `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/errors.ts`
    - Create `createSsoTokenExpiredError(profileName?: string, cause?: Error)` factory function
    - Error message should include actionable guidance: "SSO token expired. Run 'aws sso login --profile <profile>' to refresh."
  - [x] 2.3 Extend `DefaultCredentialProvider` to accept profile option
    - Add private `profileName: string | undefined` property
    - Update constructor to accept optional profile parameter
    - Modify `createProvider()` to pass `{ profile: profileName }` to `fromNodeProviderChain()` when profile is set
  - [x] 2.4 Add `setProfile(profile: string | undefined)` method
    - Allow changing profile at runtime
    - Automatically call `reset()` when profile changes to clear cached credentials
  - [x] 2.5 Enhance SSO token expiration detection in error handler
    - In `createProvider()` error wrapper, detect SSO expiration:
      - Check error name === `TokenProviderError`
      - Check error message contains "token expired" (case insensitive)
      - Check error message contains "sso" (case insensitive)
    - Throw `createSsoTokenExpiredError()` instead of generic credential error when SSO detected
    - Include profile name in SSO error message for specific remediation
  - [x] 2.6 Ensure credential provider tests pass
    - Run ONLY the 5-7 tests written in 2.1
    - Verify profile support and SSO detection work correctly

**Acceptance Criteria:**
- The 5-7 tests written in 2.1 pass
- Credential provider accepts and uses profile option
- SSO token expiration is detected and reported with actionable message
- `SSO_TOKEN_EXPIRED` error code exists and is used appropriately

### Service Integration Layer

#### Task Group 3: Region Hierarchy and Credential Validation
**Dependencies:** Task Group 2

- [x] 3.0 Complete service integration updates
  - [x] 3.1 Write 4-6 focused tests for region hierarchy and validation
    - Test `getAwsRegion()` returns region from config.json when present
    - Test `getAwsRegion()` falls back to VS Code settings when config.json has no region
    - Test `getAwsRegion()` uses default when neither source has region
    - Test credential validation runs on activation and updates status bar
    - Test credential validation catches SSO expiration and shows specific state
  - [x] 3.2 Update `getAwsRegion()` to implement region hierarchy
    - Modify `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/config/dynamoDbConfig.ts`
    - Change `getAwsRegion()` to async function returning `Promise<string>`
    - First check `ConfigService.getConfig()?.infrastructure?.dynamodb?.region`
    - Fall back to VS Code settings `agentify.aws.region`
    - Finally fall back to `DEFAULT_REGION` constant
  - [x] 3.3 Add `getAwsProfile()` async function
    - Create new exported function in `dynamoDbConfig.ts`
    - Read profile from `ConfigService.getConfig()?.aws?.profile`
    - Return `undefined` if not configured (let AWS SDK use default behavior)
  - [x] 3.4 Wire profile to credential provider on config changes
    - Subscribe to `ConfigService.onConfigChanged()` in extension activation
    - When config changes, call `DefaultCredentialProvider.setProfile()` with new profile
    - Also call `DefaultCredentialProvider.reset()` to force credential refresh
  - [x] 3.5 Add credential validation on extension activation
    - In extension `activate()` function, call `validateCredentials()` after initialization
    - Update status bar based on validation result: 'ready' or 'aws-error' or 'sso-expired'
    - Show warning notification if credentials invalid (do not block activation)
    - Log validation result for debugging
  - [x] 3.6 Add credential validation before API calls
    - Create wrapper function `withCredentialValidation<T>(operation: () => Promise<T>)`
    - Catch credential errors and update status bar state
    - Transform errors to `AgentifyError` with appropriate code
    - Use in DynamoDB and Bedrock service calls
  - [x] 3.7 Ensure service integration tests pass
    - Run ONLY the 4-6 tests written in 3.1
    - Verify region hierarchy and credential validation work correctly

**Acceptance Criteria:**
- The 4-6 tests written in 3.1 pass
- Region is resolved from config.json first, then VS Code settings
- Profile from config.json is passed to credential provider
- Credentials are validated on activation and before API calls
- Status bar reflects credential health

### UI Layer

#### Task Group 4: Status Bar Enhancements
**Dependencies:** Task Group 3

- [x] 4.0 Complete status bar enhancements
  - [x] 4.1 Write 4-6 focused tests for status bar changes
    - Test `StatusState` type includes 'sso-expired' state
    - Test `updateStatus('sso-expired')` shows correct icon and tooltip
    - Test tooltip shows profile name when profile is configured
    - Test quick-pick menu shows "Run AWS SSO Login" when in SSO expired state
    - Test "Run AWS SSO Login" option is not shown in other states
  - [x] 4.2 Extend `StatusState` type with SSO expiration state
    - In `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/statusBar.ts`
    - Add 'sso-expired' to `StatusState` union type
    - Type becomes: `'not-initialized' | 'ready' | 'aws-error' | 'sso-expired'`
  - [x] 4.3 Add profile name tracking to `StatusBarManager`
    - Add private `profileName: string | undefined` property
    - Add `setProfile(profile: string | undefined)` method
    - Update tooltip to include profile when configured: "Agentify: Ready (profile: my-profile)"
  - [x] 4.4 Implement SSO expired state display
    - In `updateStatus()`, add case for 'sso-expired' state
    - Icon: `$(key)` (key icon to indicate authentication needed)
    - Text: `$(key) Agentify`
    - Tooltip: `Agentify: SSO Token Expired - Click to refresh`
    - Background: warning background color (same as aws-error)
  - [x] 4.5 Add "Run AWS SSO Login" to quick-pick menu
    - In `showQuickPick()`, add conditional menu item when state is 'sso-expired'
    - Label: `$(terminal) Run AWS SSO Login`
    - Description: `Opens terminal with aws sso login command`
    - Detail: Shows profile if configured
  - [x] 4.6 Implement SSO login terminal command handler
    - In `handleQuickPickSelection()`, handle SSO login selection
    - Open integrated terminal via `vscode.window.createTerminal()`
    - Send command: `aws sso login --profile <profile>` (or without --profile if not configured)
    - Focus the terminal for user to complete SSO flow
  - [x] 4.7 Update status descriptions for all states
    - In `getStatusDescription()`, add case for 'sso-expired': "SSO token expired"
    - In `showStatusDetails()`, add case for 'sso-expired' with specific guidance
  - [x] 4.8 Ensure status bar tests pass
    - Run ONLY the 4-6 tests written in 4.1
    - Verify SSO state handling and profile display work correctly

**Acceptance Criteria:**
- The 4-6 tests written in 4.1 pass
- Status bar shows distinct SSO expiration state
- Tooltip displays profile name when configured
- Quick-pick menu offers SSO login option when token expired
- Terminal opens with correct aws sso login command

### Testing

#### Task Group 5: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-4

- [x] 5.0 Review existing tests and fill critical gaps only
  - [x] 5.1 Review tests from Task Groups 1-4
    - Review the 4-6 tests written for configuration schema (Task 1.1)
    - Review the 5-7 tests written for credential provider (Task 2.1)
    - Review the 4-6 tests written for service integration (Task 3.1)
    - Review the 4-6 tests written for status bar (Task 4.1)
    - Total existing tests: approximately 17-25 tests
  - [x] 5.2 Analyze test coverage gaps for this feature only
    - Identify critical user workflows that lack test coverage:
      - End-to-end: config.json profile change triggers credential refresh
      - End-to-end: SSO expiration shows status bar state and allows SSO login
      - Integration: region hierarchy fallback chain works correctly
    - Focus ONLY on gaps related to AWS credential chain feature
    - Do NOT assess entire extension test coverage
  - [x] 5.3 Write up to 8 additional strategic tests maximum
    - Integration test: profile change in config.json triggers `DefaultCredentialProvider.setProfile()`
    - Integration test: region change in config.json updates `getAwsRegion()` return value
    - Integration test: activation validates credentials and sets initial status
    - Integration test: API call failure due to SSO expiration updates status bar to 'sso-expired'
    - End-to-end test: complete flow from config change to credential refresh
    - Error handling test: graceful degradation when config.json is missing aws section
    - Skip edge cases like malformed profile names or network timeouts
  - [x] 5.4 Run feature-specific tests only
    - Run ONLY tests related to AWS credential chain feature (tests from 1.1, 2.1, 3.1, 4.1, and 5.3)
    - Expected total: approximately 25-33 tests maximum
    - Do NOT run the entire extension test suite
    - Verify all critical workflows pass

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 25-33 tests total)
- Critical user workflows for AWS credential chain are covered
- No more than 8 additional tests added when filling gaps
- Testing focused exclusively on this spec's feature requirements

## Execution Order

Recommended implementation sequence:

1. **Configuration Layer (Task Group 1)** - Establishes the schema foundation
   - Must be first: other groups depend on `AwsConfig` types and Bedrock regions constant

2. **Credential Provider Layer (Task Group 2)** - Core credential functionality
   - Depends on: Task Group 1 for error codes
   - Implements: profile support and SSO detection

3. **Service Integration Layer (Task Group 3)** - Wires components together
   - Depends on: Task Groups 1 and 2
   - Implements: region hierarchy, credential validation, config change handling

4. **UI Layer (Task Group 4)** - User-facing feedback
   - Depends on: Task Groups 1, 2, and 3 for state management
   - Implements: status bar states, profile display, SSO login action

5. **Test Review and Gap Analysis (Task Group 5)** - Final validation
   - Depends on: All previous task groups
   - Reviews and fills testing gaps

## Files to Modify

| File | Task Group | Changes |
|------|------------|---------|
| `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/config.ts` | 1 | Add `AwsConfig` interface, extend `AgentifyConfig`, update validation |
| `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/types/errors.ts` | 2 | Add `SSO_TOKEN_EXPIRED` error code and factory function |
| `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/config/bedrockRegions.ts` | 1 | New file - Bedrock supported regions constant |
| `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/services/credentialProvider.ts` | 2 | Add profile support, SSO detection |
| `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/config/dynamoDbConfig.ts` | 3 | Async `getAwsRegion()`, add `getAwsProfile()`, region hierarchy |
| `/Users/peerjakobsen/projects/KiroPlugins/agentify/src/statusBar.ts` | 4 | Add 'sso-expired' state, profile display, SSO login action |
| `/Users/peerjakobsen/projects/KiroPlugins/agentify/package.json` | 1 | Expand region enum in settings schema |

## Notes

- All changes maintain backward compatibility with existing config.json files
- AWS SDK handles credential caching internally; we only manage profile selection
- SSO login opens terminal for user interaction; extension does not execute aws CLI directly
- Region and profile changes trigger credential provider reset for immediate effect
