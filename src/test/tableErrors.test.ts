/**
 * Tests for error messages (Task Group 3)
 *
 * These tests validate the user-facing error messages are clear and actionable.
 * Updated for CDK-based deployment (CloudFormation template has been removed).
 */

import { describe, it, expect } from 'vitest';
import {
  getTableNotFoundMessage,
  getCredentialsNotConfiguredMessage,
  getTableNotActiveMessage,
  getTableValidationSuccessMessage,
  CDK_SETUP_SCRIPT_PATH,
} from '../messages/tableErrors';

describe('Table Error Messages', () => {
  // Test: Table not found message is clear and includes deployment instructions
  it('should provide clear message when table is not found', () => {
    const message = getTableNotFoundMessage('my-table');

    expect(message).toContain('my-table');
    expect(message).toContain('not found');
    expect(message).toContain('setup.sh');
    expect(message).toContain('cdk/README.md');
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
    expect(deletingMessage).toContain('setup.sh');
  });

  // Test: Success message is informative
  it('should provide clear success message', () => {
    const message = getTableValidationSuccessMessage('agentify-workflow-events');

    expect(message).toContain('Connected');
    expect(message).toContain('agentify-workflow-events');
  });

  // Test: CDK setup script path is correct
  it('should have correct CDK setup script path', () => {
    expect(CDK_SETUP_SCRIPT_PATH).toBe('scripts/setup.sh');
  });
});
