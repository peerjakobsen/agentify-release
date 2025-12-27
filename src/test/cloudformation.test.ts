/**
 * Tests for CloudFormation template validation (Task Group 1)
 *
 * These tests validate the CloudFormation template structure and content.
 * Integration tests for actual AWS deployment are marked as optional.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

const TEMPLATE_PATH = join(__dirname, '../../infrastructure/dynamodb-table.yaml');

describe('CloudFormation Template', () => {
  // Test 1.1.1: Template file exists and is valid YAML
  it('should have valid YAML syntax', () => {
    expect(existsSync(TEMPLATE_PATH)).toBe(true);

    const templateContent = readFileSync(TEMPLATE_PATH, 'utf-8');
    expect(templateContent.length).toBeGreaterThan(0);

    // Parse YAML - will throw if invalid
    const template = parseYaml(templateContent);
    expect(template).toBeDefined();
    expect(template.AWSTemplateFormatVersion).toBe('2010-09-09');
  });

  // Test 1.1.2: Required outputs are defined
  it('should define required outputs (TableName, TableArn)', () => {
    const templateContent = readFileSync(TEMPLATE_PATH, 'utf-8');
    const template = parseYaml(templateContent);

    expect(template.Outputs).toBeDefined();
    expect(template.Outputs.TableName).toBeDefined();
    expect(template.Outputs.TableArn).toBeDefined();

    // Verify outputs have descriptions
    expect(template.Outputs.TableName.Description).toBeDefined();
    expect(template.Outputs.TableArn.Description).toBeDefined();
  });

  // Test 1.1.3: Parameter defaults are correctly specified
  it('should have correct parameter defaults', () => {
    const templateContent = readFileSync(TEMPLATE_PATH, 'utf-8');
    const template = parseYaml(templateContent);

    expect(template.Parameters).toBeDefined();
    expect(template.Parameters.TableName).toBeDefined();
    expect(template.Parameters.TableName.Default).toBe('agentify-workflow-events');
    expect(template.Parameters.TableName.Type).toBe('String');
  });

  // Test 1.1.4: DynamoDB table configuration is correct
  it('should configure DynamoDB table with correct schema', () => {
    const templateContent = readFileSync(TEMPLATE_PATH, 'utf-8');
    const template = parseYaml(templateContent);

    const table = template.Resources.WorkflowEventsTable;
    expect(table).toBeDefined();
    expect(table.Type).toBe('AWS::DynamoDB::Table');

    const properties = table.Properties;

    // Verify key schema
    expect(properties.KeySchema).toContainEqual({
      AttributeName: 'workflow_id',
      KeyType: 'HASH',
    });
    expect(properties.KeySchema).toContainEqual({
      AttributeName: 'timestamp',
      KeyType: 'RANGE',
    });

    // Verify attribute definitions
    expect(properties.AttributeDefinitions).toContainEqual({
      AttributeName: 'workflow_id',
      AttributeType: 'S',
    });
    expect(properties.AttributeDefinitions).toContainEqual({
      AttributeName: 'timestamp',
      AttributeType: 'N',
    });

    // Verify billing mode
    expect(properties.BillingMode).toBe('PAY_PER_REQUEST');

    // Verify TTL configuration
    expect(properties.TimeToLiveSpecification).toBeDefined();
    expect(properties.TimeToLiveSpecification.AttributeName).toBe('ttl');
    expect(properties.TimeToLiveSpecification.Enabled).toBe(true);
  });

  // Test 1.1.5: Template includes deployment documentation
  it('should include deployment instructions in comments', () => {
    const templateContent = readFileSync(TEMPLATE_PATH, 'utf-8');

    // Check for deployment instructions
    expect(templateContent).toContain('DEPLOYMENT INSTRUCTIONS');
    expect(templateContent).toContain('aws cloudformation deploy');
    expect(templateContent).toContain('--template-file');

    // Check for payload size documentation
    expect(templateContent).toContain('350KB');
    expect(templateContent).toContain('50KB');
    expect(templateContent).toContain('truncation');
  });
});
