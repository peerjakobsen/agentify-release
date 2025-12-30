# Task Breakdown: CDK Infrastructure Bundling & Extraction

## Overview
Total Tasks: 36 (across 4 task groups)

This spec replaces the automated CloudFormation SDK deployment with bundled CDK infrastructure that users deploy manually. The implementation involves file extraction, config architecture changes, code cleanup, and verification.

## Task List

### Config Service Layer

#### Task Group 1: Infrastructure Config Reader
**Dependencies:** None

- [x] 1.0 Complete infrastructure config reader
  - [x] 1.1 Write 4-6 focused tests for infrastructure config reading
    - Test `getTableNameAsync()` returns `workflow_events_table` from infrastructure.json when present
    - Test `getTableNameAsync()` falls back to `config.json` `infrastructure.dynamodb.tableName` when infrastructure.json missing
    - Test `getAwsRegion()` returns `region` from infrastructure.json when present
    - Test `getAwsRegion()` falls back to config.json when infrastructure.json missing
    - Test returns default values gracefully when neither file has data
  - [x] 1.2 Define infrastructure.json schema interface
    - Create `InfrastructureDeploymentConfig` interface in `src/config/dynamoDbConfig.ts`
    - Fields: `region`, `vpc_subnet_ids`, `vpc_security_group_id`, `workflow_events_table`, `deployed_at`
    - Note: This matches what setup.sh already writes to `.agentify/infrastructure.json`
  - [x] 1.3 Add infrastructure.json file path constant
    - Add `INFRASTRUCTURE_FILE_PATH = '.agentify/infrastructure.json'` to `dynamoDbConfig.ts`
    - Follow existing pattern of constants in that file
  - [x] 1.4 Update `getTableNameAsync()` to check infrastructure.json first
    - Read `.agentify/infrastructure.json` using `vscode.workspace.fs.readFile()`
    - Parse JSON and extract `workflow_events_table` field
    - Fall back to existing config.json path (`config?.infrastructure?.dynamodb?.tableName`)
    - Final fallback to `DEFAULT_TABLE_NAME` constant
  - [x] 1.5 Update `getAwsRegion()` to check infrastructure.json first
    - Read `.agentify/infrastructure.json` using `vscode.workspace.fs.readFile()`
    - Parse JSON and extract `region` field
    - Fall back to existing config.json path (`config?.infrastructure?.dynamodb?.region`)
    - Final fallback to `DEFAULT_REGION` constant
  - [x] 1.6 Ensure infrastructure config tests pass
    - Run ONLY the 4-6 tests written in 1.1
    - Verify both infrastructure.json and config.json fallback paths work
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 1.1 pass
- `getTableNameAsync()` correctly reads from infrastructure.json when present
- `getAwsRegion()` correctly reads from infrastructure.json when present
- Fallback to config.json works for backward compatibility
- Existing projects with old config.json format continue working

### File Extraction Layer

#### Task Group 2: Resource Extraction Service
**Dependencies:** None (can run in parallel with Task Group 1)

- [x] 2.0 Complete resource extraction service
  - [x] 2.1 Write 4-6 focused tests for file extraction
    - Test extraction of directory structure preserves nested files
    - Test existing folder detection triggers QuickPick dialog
    - Test "Skip" option preserves existing folder
    - Test "Overwrite" option replaces existing folder
  - [x] 2.2 Create new `src/services/resourceExtractionService.ts`
    - Create service file following existing service patterns
    - Import `vscode.workspace.fs` API for cross-platform operations
    - Import `vscode.ExtensionContext` type for accessing `extensionPath`
  - [x] 2.3 Implement `extractBundledResources()` function
    - Accept `extensionPath` and `workspaceRoot` parameters
    - Define source paths: `resources/cdk/` and `resources/scripts/`
    - Define destination paths: `{workspace}/cdk/` and `{workspace}/scripts/`
    - Return extraction result with success status and paths
  - [x] 2.4 Implement recursive directory copy helper
    - Create `copyDirectoryRecursive(sourceUri, destUri)` private function
    - Use `vscode.workspace.fs.readDirectory()` to list contents
    - Handle both files (copy) and directories (recurse)
    - Preserve directory structure and all nested files
  - [x] 2.5 Implement existing folder detection
    - Check if `{workspace}/cdk/` folder exists using `vscode.workspace.fs.stat()`
    - Return boolean indicating whether folder exists
    - Log detection for debugging purposes
  - [x] 2.6 Implement overwrite prompt QuickPick
    - Show QuickPick with options: "Skip (keep existing)" / "Overwrite"
    - Default selection protects user customizations
    - Return user choice for caller to handle
  - [x] 2.7 Ensure extraction service tests pass
    - Run ONLY the 4-6 tests written in 2.1
    - Verify extraction and overwrite handling work correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 2.1 pass
- Directory extraction preserves nested structure
- Existing folder detection works correctly
- QuickPick prompt allows skip or overwrite

### Initialize Project Refactoring

#### Task Group 3: Command Handler Updates
**Dependencies:** Task Groups 1 and 2

- [x] 3.0 Complete initializeProject.ts refactoring
  - [x] 3.1 Write 4-6 focused tests for new initialization flow
    - Test file extraction called during initialization
    - Test README.md auto-opens after successful extraction
    - Test config.json created without infrastructure.dynamodb fields
    - Test credential validation step removed (no failure on invalid creds)
  - [x] 3.2 Remove CloudFormation imports and related code
    - Remove import of `CloudFormationService`, `sanitizeStackName`, `getCloudFormationTemplate`
    - Remove import of credential validation services (keep profile selection)
    - Remove `deployCloudFormationStack()` function entirely
    - Remove `validateSelectedCredentials()` function entirely
  - [x] 3.3 Add resource extraction service imports
    - Import `extractBundledResources` from new extraction service
    - Import `checkExistingCdkFolder` from extraction service
    - Import `showOverwritePrompt` from extraction service
  - [x] 3.4 Update `generateConfig()` to exclude infrastructure.dynamodb fields
    - Remove `infrastructure.dynamodb.tableName`, `tableArn`, `region` from generated config
    - Keep `infrastructure.bedrock.modelId` and `infrastructure.bedrock.region` (user configures these)
    - Store selected `region` in `aws.region` field for user reference
    - Note: infrastructure.dynamodb will be populated from infrastructure.json after user runs setup.sh
  - [x] 3.5 Update `validateConfigSchema()` in `src/types/config.ts`
    - Make `infrastructure.dynamodb` section optional (not required for new projects)
    - Keep validation for `infrastructure.bedrock` section (still user-configured)
    - Ensure existing projects with full infrastructure section still validate
  - [x] 3.6 Update `handleInitializeProject()` flow
    - Remove Step 4: Validate credentials (deployment is manual)
    - Remove Step 5: Generate stack name
    - Remove Step 6: Deploy CloudFormation stack
    - Add new step: Check for existing cdk/ folder
    - Add new step: Show overwrite prompt if folder exists
    - Add new step: Extract bundled CDK and scripts (unless skipped)
  - [x] 3.7 Implement README auto-open after extraction
    - After successful extraction, construct path to `cdk/README.md`
    - Use `vscode.window.showTextDocument()` to open the file
    - Follow existing pattern from `showSuccessNotification()` for file opening
  - [x] 3.8 Update `showSuccessNotification()` for new flow
    - Change message to indicate files extracted (not deployed)
    - Update action button to "Open CDK README" instead of steering file
    - Include instruction that user should run setup.sh manually
  - [x] 3.9 Update `InitializationResult` interface
    - Remove `tableName` field (not known until user runs setup.sh)
    - Add `cdkExtracted: boolean` field
    - Add `scriptsExtracted: boolean` field
    - Keep `region` for reference
  - [x] 3.10 Ensure initialization flow tests pass
    - Run ONLY the 4-6 tests written in 3.1
    - Verify new extraction-based flow works correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 3.1 pass
- CloudFormation code completely removed from initializeProject.ts
- File extraction happens during initialization
- README.md auto-opens after extraction
- Config.json has extension settings only (infrastructure.dynamodb omitted)
- validateConfigSchema() accepts configs without infrastructure.dynamodb

### Code Cleanup & Verification

#### Task Group 4: Cleanup and Integration Testing
**Dependencies:** Task Groups 1, 2, and 3

- [x] 4.0 Complete code cleanup and verification
  - [x] 4.1 Delete CloudFormation service file
    - Delete `src/services/cloudFormationService.ts` entirely
    - Verify no remaining imports reference this file
    - Check for any test files that import cloudFormationService and update/remove
  - [x] 4.2 Delete infrastructure folder
    - Delete `infrastructure/dynamodb-table.yaml` file
    - Delete `infrastructure/` folder entirely
    - Verify no code references these deleted files
  - [x] 4.3 Remove CloudFormation SDK dependency
    - Remove `@aws-sdk/client-cloudformation` from package.json dependencies
    - Run `npm install` to update package-lock.json
    - Verify build still succeeds without the dependency
  - [x] 4.4 Verify VSIX bundling includes resources
    - Check package.json `files` array includes `"resources/**"`
    - Run `npm run package` or `vsce package` to build VSIX
    - Inspect VSIX contents to verify `resources/cdk/` and `resources/scripts/` are included
  - [x] 4.5 Update dynamoDbPollingService.ts to use helper functions
    - Find direct config access: `config?.infrastructure?.dynamodb?.tableName`
    - Replace with call to `getTableNameAsync()` from dynamoDbConfig.ts
    - This ensures consistent infrastructure.json -> config.json fallback behavior
  - [x] 4.6 Review and fill critical test gaps
    - Review tests from Task Groups 1-3 (approximately 12-18 tests)
    - Identify end-to-end workflow gaps for this feature
    - Add maximum 6 additional integration tests if needed:
      - Test full initialization flow with file extraction
      - Test infrastructure.json created by setup.sh is readable
      - Test backward compatibility with old config.json format
  - [x] 4.7 Run feature-specific tests
    - Run all tests written in 1.1, 2.1, 3.1, and 4.6
    - Expected total: approximately 18-24 tests
    - Verify all critical workflows pass
    - Do NOT run unrelated application tests

**Acceptance Criteria:**
- CloudFormation service file and infrastructure folder deleted
- `@aws-sdk/client-cloudformation` dependency removed
- VSIX bundle includes `resources/cdk/` and `resources/scripts/`
- dynamoDbPollingService.ts uses `getTableNameAsync()` helper
- All feature-specific tests pass (approximately 18-24 total)
- Backward compatibility with existing projects maintained

## Execution Order

Recommended implementation sequence:

1. **Task Group 1: Infrastructure Config Reader** - Foundation for reading deployment outputs
2. **Task Group 2: Resource Extraction Service** - Parallel with Group 1, creates extraction capabilities
3. **Task Group 3: Command Handler Updates** - Depends on Groups 1 & 2, refactors main flow
4. **Task Group 4: Cleanup and Verification** - Final cleanup and integration testing

**Note:** Task Groups 1 and 2 can be implemented in parallel as they have no dependencies on each other.

## Key File Changes Summary

**New Files:**
- `src/services/resourceExtractionService.ts` - File extraction logic
- `src/test/cdkInfrastructureIntegration.test.ts` - Integration tests for Task Group 4

**Modified Files:**
- `src/config/dynamoDbConfig.ts` - Add infrastructure.json reading to `getTableNameAsync()` and `getAwsRegion()`
- `src/types/config.ts` - Make `infrastructure.dynamodb` optional in `validateConfigSchema()`
- `src/commands/initializeProject.ts` - Replace CloudFormation with extraction
- `src/services/dynamoDbPollingService.ts` - Use `getTableNameAsync()` helper instead of direct config access
- `src/messages/tableErrors.ts` - Updated to reference CDK setup.sh instead of CloudFormation template
- `package.json` - Remove CloudFormation SDK dependency

**Deleted Files:**
- `src/services/cloudFormationService.ts`
- `src/test/cloudFormationService.test.ts`
- `src/test/cloudformation.test.ts`
- `infrastructure/dynamodb-table.yaml`
- `infrastructure/` (entire folder)

## Technical Notes

- Use `vscode.workspace.fs` API for all file operations (cross-platform compatibility)
- Use `context.extensionPath` to locate bundled resources in VSIX
- setup.sh already writes to `.agentify/infrastructure.json` - no changes needed to that script
- Existing projects with `infrastructure.dynamodb.*` in config.json must continue working
- The `getTableNameAsync()` and `getAwsRegion()` functions already exist in `dynamoDbConfig.ts` - update them to check infrastructure.json first
- `dynamoDbPollingService.ts` currently bypasses `getTableNameAsync()` by reading config directly - fix this for consistency

## infrastructure.json Schema Reference

The setup.sh script already writes this format (no changes needed to setup.sh):

```json
{
  "region": "us-east-1",
  "vpc_subnet_ids": "subnet-xxx,subnet-yyy",
  "vpc_security_group_id": "sg-xxx",
  "workflow_events_table": "agentify-workflow-events",
  "deployed_at": "2025-12-30T12:00:00Z"
}
```

The extension reads:
- `workflow_events_table` -> maps to table name for DynamoDB polling
- `region` -> maps to AWS region for DynamoDB client

## Test Results Summary

All 65 feature-specific tests pass:
- `infrastructureConfig.test.ts`: 6 tests
- `resourceExtractionService.test.ts`: 14 tests
- `initializeProject.test.ts`: 16 tests
- `postInitialization.test.ts`: 6 tests
- `initializationEdgeCases.test.ts`: 7 tests
- `cdkInfrastructureIntegration.test.ts`: 6 tests
- `tableErrors.test.ts`: 5 tests
- `tableValidator.test.ts`: 5 tests
