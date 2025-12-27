/**
 * Tests for error messages (Task Group 3)
 *
 * These tests validate the user-facing error messages are clear and actionable.
 */

import { describe, it, expect } from 'vitest';
import {
  getTableNotFoundMessage,
  getCredentialsNotConfiguredMessage,
  getTableNotActiveMessage,
  getTableValidationSuccessMessage,
  CLOUDFORMATION_TEMPLATE_PATH,
} from '../messages/tableErrors';

describe('Table Error Messages', () => {
  // Test: Table not found message is clear and includes deployment instructions
  it('should provide clear message when table is not found', () => {
    const message = getTableNotFoundMessage('my-table');

    expect(message).toContain('my-table');
    expect(message).toContain('not found');
    expect(message).toContain('cloudformation deploy');
    expect(message).toContain(CLOUDFORMATION_TEMPLATE_PATH);
  });

  // Test: Credentials not configured message includes setup guidance
  it('should provide credentials setup guidance', () => {
    const message = getCredentialsNotConfiguredMessage();

    expect(message).toContain('AWS credentials not configured');
    expect(message).toContain('aws configure');
    expect(message).toContain('AWS_ACCESS_KEY_ID');
    expect(message).toContain('~/.aws/credentials');
  });

  // Test: Table not active message includes status and guidance
  it('should provide guidance for non-ACTIVE table states', () => {
    const creatingMessage = getTableNotActiveMessage('my-table', 'CREATING');
    expect(creatingMessage).toContain('CREATING');
    expect(creatingMessage).toContain('wait');

    const deletingMessage = getTableNotActiveMessage('my-table', 'DELETING');
    expect(deletingMessage).toContain('DELETING');
    expect(deletingMessage).toContain('redeploy');
  });

  // Test: Success message is informative
  it('should provide clear success message', () => {
    const message = getTableValidationSuccessMessage('agentify-workflow-events');

    expect(message).toContain('Connected');
    expect(message).toContain('agentify-workflow-events');
  });

  // Test: CloudFormation template path is correct
  it('should have correct CloudFormation template path', () => {
    expect(CLOUDFORMATION_TEMPLATE_PATH).toBe('infrastructure/dynamodb-table.yaml');
  });
});
