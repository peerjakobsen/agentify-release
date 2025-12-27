# Task Breakdown: DynamoDB Observability Table

## Overview
Total Tasks: 16

**Extension:** Agentify (`agentify`) — single extension with two webview panels:
- Demo Viewer panel — runtime visualization
- Ideation Wizard panel — design-time workflow

This spec provides infrastructure for the Demo Viewer panel. Shared services (AWS clients, config, types) will be reused by both panels.

**Related Specs:**
- This spec is a prerequisite for the "Project Initialization Command" which will create `.agentify/config.json` with infrastructure details
- The initialization command will reference the CloudFormation template created here

This spec covers three deliverables:
1. CloudFormation template for DynamoDB table provisioning
2. Extension configuration for table name and AWS region settings
3. Extension startup validation for table existence

## Task List

### Infrastructure Layer

#### Task Group 1: CloudFormation Template
**Dependencies:** None

- [x] 1.0 Complete CloudFormation template for DynamoDB table
  - [x] 1.1 Write 3-5 focused tests for CloudFormation template validation
    - Test template syntax validity using AWS CloudFormation validate-template
    - Test that required outputs are defined (TableName, TableArn)
    - Test parameter defaults are correctly specified
    - Test deployment and deletion lifecycle (integration test)
  - [x] 1.2 Create CloudFormation template file
    - Create `infrastructure/dynamodb-table.yaml`
    - Add descriptive template metadata (description, version)
    - Include inline deployment instructions in comments
  - [x] 1.3 Define template parameters
    - TableName parameter with default `agentify-workflow-events`
    - Add parameter descriptions for clarity
  - [x] 1.4 Configure DynamoDB table resource
    - Partition key: `workflow_id` (String type)
    - Sort key: `timestamp` (Number type for epoch milliseconds)
    - BillingMode: PAY_PER_REQUEST (on-demand capacity)
    - Enable TTL on attribute `ttl`
  - [x] 1.5 Add template outputs
    - Output TableName for reference
    - Output TableArn for IAM policy configuration
  - [x] 1.6 Document payload size constraints
    - Add comments documenting 350KB payload limit
    - Document 50KB headroom for other attributes
    - Note that truncation is producer responsibility
  - [x] 1.7 Ensure infrastructure tests pass
    - Run template validation tests
    - Verify template deploys successfully (if AWS access available)

**Acceptance Criteria:**
- Template validates with `aws cloudformation validate-template`
- Template deploys successfully creating table with correct schema
- Table uses on-demand billing mode
- TTL is enabled on `ttl` attribute
- Template includes clear deployment documentation in comments

### Extension Configuration Layer

#### Task Group 2: Extension Project Setup
**Dependencies:** None (can run parallel with Task Group 1)

- [x] 2.0 Complete extension project foundation
  - [x] 2.1 Write 2-4 focused tests for extension configuration
    - Test default table name is `agentify-workflow-events`
    - Test default region is `us-east-1`
    - Test configuration can be read from settings
    - Test configuration changes are detected
  - [x] 2.2 Initialize Kiro extension project structure
    - Create `package.json` with extension manifest
    - Configure extension activation events
    - Add @aws-sdk/client-dynamodb dependency
    - Add @aws-sdk/lib-dynamodb dependency
  - [x] 2.3 Define extension configuration schema
    - Add `contributes.configuration` to package.json
    - Define `agentify.dynamodb.tableName` setting
    - Set default value to `agentify-workflow-events`
    - Define `agentify.aws.region` setting
    - Set default to `us-east-1` with options: us-east-1, us-west-2, eu-west-1
    - Add setting descriptions for user guidance
  - [x] 2.4 Create configuration service module
    - Create `src/config/dynamoDbConfig.ts`
    - Implement `getTableName()` function
    - Implement `getAwsRegion()` function
    - Subscribe to configuration change events
    - Export configuration interface and functions
  - [x] 2.5 Ensure configuration tests pass
    - Run ONLY the tests written in 2.1
    - Verify configuration defaults work correctly

**Acceptance Criteria:**
- Extension package.json defines tableName configuration
- Default table name is `agentify-workflow-events`
- Configuration service correctly reads settings
- Configuration changes are properly handled

### Extension Validation Layer

#### Task Group 3: Table Existence Validation
**Dependencies:** Task Group 2

- [x] 3.0 Complete table validation on extension startup
  - [x] 3.1 Write 3-5 focused tests for table validation
    - Test successful validation when table exists and is ACTIVE
    - Test error handling when table does not exist
    - Test error handling when AWS credentials are not configured
    - Test error message directs user to deploy CloudFormation template
    - Test handling of table in non-ACTIVE states (CREATING, etc.)
  - [x] 3.2 Create DynamoDB client service
    - Create `src/services/dynamoDbClient.ts`
    - Initialize DynamoDB client using AWS SDK
    - Handle credential resolution (AWS Explorer integration)
    - Export client factory function
  - [x] 3.3 Implement table validation service
    - Create `src/services/tableValidator.ts`
    - Implement `validateTableExists()` using DescribeTable API
    - Check table status is ACTIVE
    - Return validation result with table metadata
  - [x] 3.4 Create user-facing error messages
    - Create `src/messages/tableErrors.ts`
    - Define clear error message when table not found
    - Include CloudFormation deployment instructions in error
    - Include link to infrastructure/dynamodb-table.yaml
  - [x] 3.5 Integrate validation into extension activation
    - Update `src/extension.ts` activation handler
    - Call table validation on activation
    - Show information message on successful validation
    - Show error message with guidance on validation failure
  - [x] 3.6 Ensure validation tests pass
    - Run ONLY the tests written in 3.1
    - Verify error messages are clear and actionable

**Acceptance Criteria:**
- Extension validates table existence on startup
- Uses DynamoDB DescribeTable API correctly
- Clear error message shown when table not found
- Error message includes CloudFormation deployment guidance
- Successful validation allows extension to proceed

### Integration and Documentation

#### Task Group 4: Test Review and Integration
**Dependencies:** Task Groups 1-3

- [x] 4.0 Review tests and validate end-to-end workflow
  - [x] 4.1 Review tests from Task Groups 1-3
    - Review 3-5 infrastructure tests (Task 1.1)
    - Review 2-4 configuration tests (Task 2.1)
    - Review 3-5 validation tests (Task 3.1)
    - Total existing tests: approximately 8-14 tests
  - [x] 4.2 Analyze test coverage gaps for this feature
    - Identify critical workflows that lack coverage
    - Focus on integration between components
    - Prioritize end-to-end extension activation flow
  - [x] 4.3 Write up to 5 additional integration tests if needed
    - Test full extension activation with valid table
    - Test full extension activation with missing table
    - Test configuration change triggers re-validation
    - Do NOT write exhaustive unit tests for all scenarios
  - [x] 4.4 Run feature-specific tests only
    - Run all tests related to this spec (approximately 13-19 tests)
    - Verify CloudFormation template validates
    - Verify extension activates correctly
    - Do NOT run unrelated test suites

**Acceptance Criteria:**
- All feature-specific tests pass (approximately 13-19 tests total)
- Extension activates and validates table successfully
- Error handling works correctly for missing table
- No more than 5 additional integration tests added

## Execution Order

Recommended implementation sequence:

1. **Task Group 1 (Infrastructure)** and **Task Group 2 (Extension Setup)** - Can run in parallel
   - CloudFormation template is independent of extension code
   - Extension project setup is foundation for validation layer

2. **Task Group 3 (Table Validation)** - Depends on Task Group 2
   - Requires extension project structure to exist
   - Requires configuration service for table name

3. **Task Group 4 (Integration)** - Depends on all previous groups
   - Reviews and integrates all components
   - Validates end-to-end workflow

## Technical Notes

### CloudFormation Template Location
- Template: `infrastructure/dynamodb-table.yaml`
- Deployable via: `aws cloudformation deploy --template-file infrastructure/dynamodb-table.yaml --stack-name agentify-workflow-events`

### Extension File Structure
```
src/
  config/
    dynamoDbConfig.ts       # Configuration service
  services/
    dynamoDbClient.ts       # DynamoDB client factory
    tableValidator.ts       # Table existence validation
  messages/
    tableErrors.ts          # User-facing error messages
  extension.ts              # Main extension entry point
infrastructure/
  dynamodb-table.yaml       # CloudFormation template
```

### AWS SDK Dependencies
- `@aws-sdk/client-dynamodb` - Core DynamoDB client
- `@aws-sdk/lib-dynamodb` - DocumentClient for simplified operations

### Key Implementation Details
- Table name configurable via `agentify.dynamodb.tableName` setting
- Default table name: `agentify-workflow-events`
- AWS region configurable via `agentify.aws.region` setting
- Default region: `us-east-1` (options: us-east-1, us-west-2, eu-west-1)
- TTL attribute: `ttl` (set by event producers, not extension)
- Payload size limit: 350KB (enforced by event producers)
- Timestamp format: Epoch milliseconds (Number type)

### TTL Configuration
- TTL value: 24 hours from event creation
- Set by: agentify_observability decorator package (not the extension)
- Calculation: `ttl = int(time.time()) + 86400`
