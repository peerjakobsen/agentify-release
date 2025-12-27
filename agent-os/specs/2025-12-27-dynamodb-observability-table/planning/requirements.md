# Spec Requirements: DynamoDB Observability Table

## Initial Description

Create `agentify-workflow-events` DynamoDB table with workflow_id partition key, timestamp sort key, event_type, agent_name, payload, and TTL configuration.

This is for the Agentify Kiro IDE extension (VS Code-based) — a single extension with two webview panels: Demo Viewer (runtime visualization) and Ideation Wizard (design-time workflow). The table provides infrastructure for the Demo Viewer panel, storing events emitted by Python decorators (@agent_span, @tool_call, @handoff, @workflow_outcome) from the agentify_observability package.

## Requirements Discussion

### First Round Questions

**Q1:** I assume the table will be provisioned with on-demand capacity mode (pay-per-request) since demo workloads are unpredictable and cost optimization matters less than simplicity for a demo tool. Is that correct, or would you prefer provisioned capacity with auto-scaling?
**Answer:** On-demand capacity — correct assumption

**Q2:** For the timestamp sort key, I'm thinking we should use an ISO 8601 string with microsecond precision (e.g., `2025-12-27T14:30:00.123456Z`) to ensure proper sorting and readability in logs. Should we use this format, or would you prefer epoch milliseconds for query efficiency?
**Answer:** Epoch milliseconds (e.g., 1703687400123) — better for range queries, convert to readable format in UI

**Q3:** I assume the TTL should be set to 7 days by default - long enough to review demo results but short enough to keep costs low and avoid accumulating stale data. Is 7 days appropriate, or do you have a different retention requirement?
**Answer:** 24 hours TTL — demos are ephemeral, 7 days is excessive for demo data

**Q4:** For infrastructure provisioning, I'm thinking we should use AWS CloudFormation with a template file in the repository that users can deploy via AWS CLI or Console. This keeps it simple and doesn't require CDK dependencies. Is CloudFormation acceptable, or would you prefer CDK, Terraform, or a different approach?
**Answer:** CloudFormation — simple, AWS-native, no dependencies, one-click deploy

**Q5:** The roadmap mentions integrating with "Kiro's built-in AWS Explorer for credentials." I assume the table provisioning is a one-time manual setup (deploy CloudFormation template) separate from the extension, and the extension just connects to an existing table using the AWS Explorer credentials. Is this correct, or should the extension be able to create the table automatically?
**Answer:** Manual setup — provide CloudFormation template, extension validates table exists on startup, no auto-creation in V1

**Q6:** For the payload attribute, I assume this should be stored as a DynamoDB Map type (JSON object) to preserve structure for expandable details in the Execution Log Panel. Should there be any size limits enforced (e.g., truncate payloads over 400KB to stay within DynamoDB's item size limit)?
**Answer:** Yes, 350KB limit — truncate payload with "[TRUNCATED]" marker, log warning, leave 50KB headroom for other attributes

**Q7:** Should the table name `agentify-workflow-events` be hardcoded or configurable via extension settings? I'm assuming hardcoded is fine for V1 since this is an internal demo tool, but configurable would allow multiple isolated environments.
**Answer:** Configurable with default "agentify-workflow-events" — allows multi-user/multi-environment scenarios

**Q8:** Is there anything you want to explicitly exclude from this spec? For example: Global Secondary Indexes, encryption configuration, backup policies, or cross-region replication?
**Answer:** Exclude for V1: GSIs, custom encryption config, backup policies, cross-region replication — use AWS defaults, keep it minimal

### Existing Code to Reference

No similar existing features identified for reference. This is a greenfield project.

### Follow-up Questions

None required - answers were comprehensive.

## Visual Assets

### Files Provided:

No visual assets provided.

### Visual Insights:

N/A

## Requirements Summary

### Functional Requirements

- DynamoDB table named `agentify-workflow-events` (configurable via extension settings)
- Partition key: `workflow_id` (String)
- Sort key: `timestamp` (Number - epoch milliseconds)
- Additional attributes: `event_type`, `agent_name`, `payload` (Map type)
- TTL attribute for 24-hour automatic expiration
- On-demand capacity mode (pay-per-request)
- CloudFormation template for one-click deployment
- Extension validates table exists on startup (no auto-creation)
- Payload size limit of 350KB with truncation and warning

### Reusability Opportunities

- None identified (greenfield project)

### Scope Boundaries

**In Scope:**
- CloudFormation template for table creation
- Table schema with workflow_id partition key and timestamp sort key
- TTL configuration for 24-hour retention
- On-demand billing mode
- Configurable table name with default value
- Payload truncation logic specification (350KB limit)
- Documentation for deployment steps

**Out of Scope:**
- Global Secondary Indexes (GSIs)
- Custom encryption configuration (use AWS defaults)
- Backup policies (use AWS defaults)
- Cross-region replication
- Automatic table creation from extension
- Provisioned capacity mode

### Technical Considerations

- Timestamp stored as epoch milliseconds for efficient range queries
- UI layer responsible for converting timestamps to human-readable format
- 350KB payload limit leaves 50KB headroom for other item attributes
- Truncated payloads marked with "[TRUNCATED]" and logged as warning
- Table name configurable to support multi-user/multi-environment scenarios
- Extension must validate table exists before attempting operations
- CloudFormation template should be deployable via AWS CLI or Console
