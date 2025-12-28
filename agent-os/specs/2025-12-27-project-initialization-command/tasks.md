# Task Breakdown: Project Initialization Command

## Overview
Total Tasks: 38

This feature implements the "Agentify: Initialize Project" command that validates AWS credentials, deploys DynamoDB infrastructure via CloudFormation, and configures the project with necessary config and steering files.

## Task List

### Infrastructure Layer

#### Task Group 1: CloudFormation Service
**Dependencies:** None

- [x] 1.0 Complete CloudFormation service layer
  - [x] 1.1 Write 4-6 focused tests for CloudFormation service
    - Test stack name sanitization (spaces, special chars, length truncation)
    - Test createStack method invocation with correct parameters
    - Test describeStack polling logic and status transitions
    - Test error handling for CREATE_FAILED status
    - Test extraction of outputs (TableName, TableArn) from stack response
  - [x] 1.2 Add @aws-sdk/client-cloudformation dependency
    - Add to package.json dependencies
    - Run npm install to update package-lock.json
  - [x] 1.3 Create CloudFormation service module
    - File: `src/services/cloudFormationService.ts`
    - Implement `CloudFormationService` class with DI for credential provider
    - Add method: `createStack(stackName: string, templateBody: string, tableName: string, region: string)`
    - Add method: `describeStack(stackName: string, region: string)`
    - Add method: `waitForStackComplete(stackName: string, region: string, pollingInterval: number)`
    - Follow existing service patterns from `tableValidator.ts` and `dynamoDbClient.ts`
  - [x] 1.4 Implement stack name sanitization utility
    - Function: `sanitizeStackName(workspaceName: string): string`
    - Lowercase conversion
    - Replace spaces and special characters with hyphens
    - Remove consecutive hyphens
    - Truncate to fit 128 character limit (with prefix `agentify-workflow-events-`)
    - Handle edge cases: empty name, only special chars
  - [x] 1.5 Implement CloudFormation template reader
    - Function: `getCloudFormationTemplate(extensionPath: string): string`
    - Read `infrastructure/dynamodb-table.yaml` from bundled extension files
    - Handle file not found error gracefully
  - [x] 1.6 Add CloudFormation stack status type definitions
    - File: `src/types/cloudformation.ts`
    - Define `StackStatus` type: 'CREATE_IN_PROGRESS' | 'CREATE_COMPLETE' | 'CREATE_FAILED' | etc.
    - Define `StackOutput` interface for TableName and TableArn
    - Define `StackDeploymentResult` interface with success/failure info
  - [x] 1.7 Ensure CloudFormation service tests pass
    - Run ONLY the 4-6 tests written in 1.1
    - Verify service methods work correctly with mocked SDK
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 1.1 pass
- CloudFormation SDK client is properly initialized with credentials
- Stack name sanitization handles all edge cases
- Template reading works from bundled extension path
- Stack creation and polling logic handles all status transitions

---

#### Task Group 2: AWS Profile Discovery Service
**Dependencies:** None (can run parallel with Task Group 1)

- [x] 2.0 Complete AWS profile discovery service
  - [x] 2.1 Write 3-5 focused tests for profile discovery
    - Test loading profiles from mock config/credentials files
    - Test handling missing files gracefully
    - Test profile list includes both config and credentials profiles
    - Test deduplication of profiles appearing in both files
  - [x] 2.2 Create profile discovery service module
    - File: `src/services/profileDiscoveryService.ts`
    - Use AWS SDK `loadSharedConfigFiles` to discover available profiles
    - Return array of profile names sorted alphabetically
    - Handle case where no profiles exist (empty array)
  - [x] 2.3 Add profile discovery function
    - Function: `discoverAwsProfiles(): Promise<string[]>`
    - Read from `~/.aws/config` and `~/.aws/credentials`
    - Deduplicate profiles appearing in both files
    - Return sorted, unique profile names
  - [x] 2.4 Ensure profile discovery tests pass
    - Run ONLY the 3-5 tests written in 2.1
    - Verify profiles are discovered correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 3-5 tests written in 2.1 pass
- Profiles are discovered from both config and credentials files
- Empty profile list handled gracefully
- Profiles are deduplicated and sorted

---

### Command Implementation Layer

#### Task Group 3: Initialize Project Command Handler
**Dependencies:** Task Groups 1, 2

- [x] 3.0 Complete initialize project command handler
  - [x] 3.1 Write 6-8 focused tests for command handler
    - Test idempotency check when config.json already exists
    - Test profile selection QuickPick flow
    - Test region selection QuickPick flow
    - Test credential validation before deployment
    - Test successful stack deployment and config creation
    - Test handling of deployment failure
    - Test config file generation with correct structure
  - [x] 3.2 Implement idempotency check logic
    - Use `ConfigService.isInitialized()` to check existing config
    - Show QuickPick with "Reinitialize" and "Cancel" options
    - Clear ConfigService cache on reinitialize selection
    - Return early on cancel
  - [x] 3.3 Implement AWS profile selection UI
    - Use `vscode.window.showQuickPick` for profile selection
    - Add "Use default" option at top of list (preselected)
    - Disable custom text entry (canPickMany: false, matchOnDetail: false)
    - Call `discoverAwsProfiles()` to populate profile list
    - Store selection for credential provider configuration
  - [x] 3.4 Implement AWS region selection UI
    - QuickPick with common regions: us-east-1, us-east-2, us-west-1, us-west-2, eu-west-1, eu-central-1, ap-northeast-1, ap-southeast-1
    - Default to VS Code setting `agentify.aws.region` if configured
    - Store selection for CloudFormation deployment
  - [x] 3.5 Implement credential validation step
    - Call `validateCredentials()` with selected profile
    - Use existing `isSsoTokenExpiredError` detection
    - Show error message with "Run AWS SSO Login" action for SSO errors
    - Show generic credential error for other failures
    - Abort initialization on credential failure
  - [x] 3.6 Implement CloudFormation deployment flow
    - Use `vscode.window.withProgress` for progress notification
    - Set cancellable: true for user abort option
    - Call `CloudFormationService.createStack()` with generated stack name
    - Auto-generate stack name: `agentify-workflow-events-{sanitized-workspace-name}`
    - Poll status every 5 seconds using `waitForStackComplete()`
    - Update progress message with current status
  - [x] 3.7 Implement deployment success handling
    - Extract TableName and TableArn from stack outputs
    - Generate config using `ConfigService.createConfig()`
    - Populate config per AgentifyConfig schema with placeholder project/workflow values
    - Include aws.profile if non-default profile was selected
    - Show success notification with table name
  - [x] 3.8 Implement deployment failure handling
    - Extract error reason from stack events
    - Show error message with failure details
    - Offer guidance for common failures (permissions, limit exceeded)
    - Do NOT automatically delete failed stack (user must clean up manually)
  - [x] 3.9 Ensure command handler tests pass
    - Run ONLY the 6-8 tests written in 3.1
    - Verify all flow paths work correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 6-8 tests written in 3.1 pass
- Idempotency check prompts user when config exists
- Profile and region selection UI works correctly
- Credentials are validated before deployment
- Progress notification shows deployment status
- Config file is generated with correct schema
- Errors are handled gracefully with user guidance

---

### File Generation Layer

#### Task Group 4: Steering File Creation
**Dependencies:** Task Group 3

- [x] 4.0 Complete steering file creation
  - [x] 4.1 Write 3-4 focused tests for steering file creation
    - Test steering file content generation
    - Test directory creation when `.kiro/steering/` does not exist
    - Test overwrite prompt when file already exists
    - Test successful file write
  - [x] 4.2 Create steering file template
    - Define content for `agentify-integration.md`
    - Include description of agentify_observability decorators
    - Include DynamoDB event patterns documentation
    - Include integration instructions for Kiro AI
    - Store template as string constant or separate file
  - [x] 4.3 Implement steering file creation logic
    - Function: `createSteeringFile(workspaceRoot: string): Promise<boolean>`
    - Create `.kiro/steering/` directory if it does not exist
    - Check if `agentify-integration.md` already exists
    - Prompt user with "Overwrite" / "Skip" options if file exists
    - Write steering file content on new or overwrite
    - Return success/skip status
  - [x] 4.4 Integrate steering file creation into command handler
    - Call `createSteeringFile()` after successful config creation
    - Handle both success and skip cases gracefully
    - Include steering file status in final success message
  - [x] 4.5 Ensure steering file tests pass
    - Run ONLY the 3-4 tests written in 4.1
    - Verify file creation and overwrite logic
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 3-4 tests written in 4.1 pass
- Steering file contains useful integration instructions
- Directory structure created when missing
- User prompted before overwriting existing file

---

### UI Integration Layer

#### Task Group 5: Demo Viewer Integration
**Dependencies:** Task Group 3

- [x] 5.0 Complete Demo Viewer integration
  - [x] 5.1 Write 2-3 focused tests for Demo Viewer integration
    - Test "Get Started" button visibility when not initialized
    - Test button click triggers agentify.initializeProject command
    - Test Demo Viewer refreshes after successful initialization
  - [x] 5.2 Add "Get Started" button to Demo Viewer panel
    - File: `src/panels/demoViewerPanel.ts`
    - Add button when project is not initialized
    - Button triggers `agentify.initializeProject` command
    - Style button to be prominent and inviting
  - [x] 5.3 Implement Demo Viewer state refresh
    - Listen for config changes via ConfigService.onConfigChanged
    - Refresh panel content when config is created
    - Hide "Get Started" button when initialized
    - Show ready state content when initialized
  - [x] 5.4 Ensure Demo Viewer integration tests pass
    - Run ONLY the 2-3 tests written in 5.1
    - Verify button appears and triggers command
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-3 tests written in 5.1 pass
- "Get Started" button visible in uninitialized state
- Button correctly triggers initialization command
- Panel refreshes to show ready state after initialization

---

### Post-Initialization Layer

#### Task Group 6: Post-Initialization Flow
**Dependencies:** Task Groups 3, 4, 5

- [x] 6.0 Complete post-initialization flow
  - [x] 6.1 Write 2-3 focused tests for post-initialization
    - Test success message shows after initialization completes
    - Test Demo Viewer refreshes after initialization
    - Test status bar updates after initialization
  - [x] 6.2 Implement success notification
    - Show information message with initialization summary
    - Include table name and region in message
    - Optionally offer to open the steering file
  - [x] 6.3 Trigger Demo Viewer refresh after initialization
    - Call refresh on Demo Viewer panel if it exists
    - Update "Get Started" button visibility
  - [x] 6.4 Ensure post-initialization tests pass
    - Run ONLY the 2-3 tests written in 6.1
    - Verify complete flow from command to ready state
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 2-3 tests written in 6.1 pass
- Status bar shows 'ready' after successful initialization
- AWS services validate and connect to new table
- Panel providers show initialized state

---

### Testing

#### Task Group 7: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-6

- [x] 7.0 Review existing tests and fill critical gaps only
  - [x] 7.1 Run full test suite for all new code
    - Ran all tests created in groups 1-6 (195 tests total)
    - All tests passing
    - No regressions identified
  - [x] 7.2 Review test coverage for edge cases
    - Verified error handling paths are tested
    - Verified cancellation flows are tested
    - Verified timeout scenarios are tested
    - Identified gaps in: user cancellation at various stages, timeout handling, SSO errors, stack exists errors
  - [x] 7.3 Add any missing critical tests (target: up to 10 additional tests)
    - Added 10 new tests in `src/test/initializationEdgeCases.test.ts`
    - Test 7.3.1: User cancels profile selection
    - Test 7.3.2: User cancels region selection
    - Test 7.3.3: User cancels idempotency prompt
    - Test 7.3.4: Cancellation during CloudFormation deployment
    - Test 7.3.5: Stack creation timeout error handling
    - Test 7.3.6: Stack rollback error handling
    - Test 7.3.7: SSO token expired error guidance
    - Test 7.3.8: Access denied error guidance
    - Test 7.3.9: Stack already exists guidance
    - Test 7.3.10: Missing CloudFormation template file
  - [x] 7.4 Final test run - all tests must pass
    - Final test count: 205 tests (195 existing + 10 new)
    - All 205 tests pass
    - 20 test files total

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 30-39 tests total)
- Critical user workflows for initialization are covered
- No more than 10 additional tests added when filling gaps
- Testing focused exclusively on initialization feature requirements

---

## Execution Order

Recommended implementation sequence:

```
Phase 1: Infrastructure Services (Parallel)
  - Task Group 1: CloudFormation Service
  - Task Group 2: AWS Profile Discovery Service

Phase 2: Command Implementation
  - Task Group 3: Initialize Project Command Handler

Phase 3: File and UI Integration (Parallel)
  - Task Group 4: Steering File Creation
  - Task Group 5: Demo Viewer Integration

Phase 4: Integration and Testing
  - Task Group 6: Post-Initialization Flow
  - Task Group 7: Test Review and Gap Analysis
```

## Key Files to Create/Modify

### New Files
- `src/services/cloudFormationService.ts` - CloudFormation SDK operations
- `src/services/profileDiscoveryService.ts` - AWS profile discovery
- `src/types/cloudformation.ts` - CloudFormation type definitions
- `src/templates/steeringFile.ts` - Steering file content template
- `src/commands/initializeProject.ts` - Initialize project command handler

### Files to Modify
- `package.json` - Add @aws-sdk/client-cloudformation dependency
- `src/extension.ts` - Implement `handleInitializeProject()` stub
- `src/panels/demoViewerPanel.ts` - Add "Get Started" button
- `src/services/configService.ts` - May need minor updates for reinitialization

### Test Files to Create
- `src/services/__tests__/cloudFormationService.test.ts`
- `src/services/__tests__/profileDiscoveryService.test.ts`
- `src/commands/__tests__/initializeProject.test.ts`
- `src/templates/__tests__/steeringFile.test.ts`
- `src/panels/__tests__/demoViewerPanel.test.ts`

## Existing Code to Leverage

| Component | File | Usage |
|-----------|------|-------|
| Credential Provider | `src/services/credentialProvider.ts` | `setProfile()`, `validateCredentials()` |
| Config Service | `src/services/configService.ts` | `isInitialized()`, `createConfig()`, `clearCache()` |
| Table Validator | `src/services/tableValidator.ts` | Pattern reference for AWS service calls |
| Status Bar | `src/statusBar.ts` | `updateStatus()` for state changes |
| Extension Entry | `src/extension.ts` | `handleInitializeProject()` stub, `initializeWithConfig()` |
| Config Types | `src/types/config.ts` | `AgentifyConfig` schema |
| CloudFormation Template | `infrastructure/dynamodb-table.yaml` | Template for stack deployment |

## Technical Notes

1. **Stack Name Generation**: Use format `agentify-workflow-events-{sanitized-workspace}` with sanitization: lowercase, hyphens for special chars, max 128 chars total.

2. **Polling Strategy**: Use 5-second intervals for CloudFormation status polling. Maximum wait time should be configurable (suggest 10 minutes default).

3. **Config Schema**: Follow existing `AgentifyConfig` type. Use placeholder values for `project` and `workflow` sections that will be configured by subsequent commands.

4. **Error Recovery**: On deployment failure, display error but do NOT auto-delete the failed stack. User may want to inspect stack events in AWS Console.

5. **Profile Selection**: The "Use default" option should result in `undefined` for `aws.profile` in config (not empty string), which triggers default SDK credential chain behavior.
