/**
 * Tests for GapFillingService
 *
 * Task Group 2: System Prompt and Claude Integration
 * 5 focused tests for gap-filling conversation service layer
 */

import { describe, it, expect, vi } from 'vitest';

// Mock vscode module before importing the service
vi.mock('vscode', () => {
  const mockReadFile = vi.fn();

  return {
    workspace: {
      fs: {
        readFile: mockReadFile,
      },
    },
    Uri: {
      joinPath: (...args: unknown[]) => {
        const paths = args.map((arg) => (typeof arg === 'string' ? arg : (arg as { fsPath: string }).fsPath || ''));
        return { fsPath: paths.join('/') };
      },
    },
    _mockReadFile: mockReadFile,
  };
});

// Import the service under test
import {
  buildContextMessage,
  parseAssumptionsFromResponse,
  generateStep1Hash,
  hasStep1Changed,
} from '../../services/gapFillingService';
import type { SystemAssumption } from '../../types/wizardPanel';

describe('Task Group 2: GapFillingService', () => {
  describe('buildContextMessage - context message formatting from Step 1 inputs', () => {
    it('should format context message correctly from Step 1 inputs', () => {
      const businessObjective = 'Reduce stockouts by 30% through AI-powered demand forecasting';
      const industry = 'Retail';
      const systems = ['SAP S/4HANA', 'Salesforce'];

      const result = buildContextMessage(businessObjective, industry, systems);

      // Verify the message contains all required components
      expect(result).toContain(businessObjective);
      expect(result).toContain(industry);
      expect(result).toContain('SAP S/4HANA');
      expect(result).toContain('Salesforce');

      // Verify proper formatting structure
      expect(result).toMatch(/objective/i);
      expect(result).toMatch(/industry/i);
      expect(result).toMatch(/system/i);
    });

    it('should handle empty systems array gracefully', () => {
      const businessObjective = 'Automate customer service workflows';
      const industry = 'FSI';
      const systems: string[] = [];

      const result = buildContextMessage(businessObjective, industry, systems);

      expect(result).toContain(businessObjective);
      expect(result).toContain(industry);
      // Should indicate no specific systems mentioned
      expect(result).toMatch(/no.*system|none.*specified|not.*specified/i);
    });

    it('should handle custom industry value', () => {
      const businessObjective = 'Optimize supply chain';
      const industry = 'Other: Aerospace';
      const systems = ['Custom ERP'];

      const result = buildContextMessage(businessObjective, industry, systems);

      expect(result).toContain('Aerospace');
    });
  });

  describe('parseAssumptionsFromResponse - JSON assumption parsing from Claude response', () => {
    it('should parse valid JSON assumptions from Claude response with prose', () => {
      const claudeResponse = `Based on your business objective and selected systems, I've analyzed the typical enterprise architecture for your industry.

Here are my assumptions about your system configuration:

\`\`\`json
{
  "assumptions": [
    {
      "system": "SAP S/4HANA",
      "modules": ["MM", "SD", "PP"],
      "integrations": ["Salesforce CRM sync", "EDI with suppliers"]
    },
    {
      "system": "Salesforce",
      "modules": ["Sales Cloud", "Service Cloud"],
      "integrations": ["SAP S/4HANA order data", "Marketing automation"]
    }
  ]
}
\`\`\`

These assumptions are based on common configurations in the Retail industry. Please let me know if you'd like me to adjust any of these assumptions.`;

      const result = parseAssumptionsFromResponse(claudeResponse);

      expect(result).toHaveLength(2);
      expect(result[0].system).toBe('SAP S/4HANA');
      expect(result[0].modules).toEqual(['MM', 'SD', 'PP']);
      expect(result[0].integrations).toEqual(['Salesforce CRM sync', 'EDI with suppliers']);
      expect(result[0].source).toBe('ai-proposed');
      expect(result[1].system).toBe('Salesforce');
      expect(result[1].source).toBe('ai-proposed');
    });

    it('should return empty array for response without JSON block', () => {
      const claudeResponse = `I understand you want to reduce stockouts. Let me ask some clarifying questions before proposing system assumptions.

What specific modules of SAP S/4HANA are you currently using? And how is it integrated with your CRM?`;

      const result = parseAssumptionsFromResponse(claudeResponse);

      expect(result).toEqual([]);
    });

    it('should handle malformed JSON gracefully and return empty array', () => {
      const claudeResponse = `Here are my assumptions:

\`\`\`json
{
  "assumptions": [
    {
      "system": "SAP S/4HANA",
      "modules": ["MM", "SD"
      // Missing closing brackets
    }
  ]
}
\`\`\``;

      const result = parseAssumptionsFromResponse(claudeResponse);

      expect(result).toEqual([]);
    });

    it('should handle JSON without assumptions array gracefully', () => {
      const claudeResponse = `Here's some analysis:

\`\`\`json
{
  "analysis": "Your systems look good",
  "confidence": 0.85
}
\`\`\``;

      const result = parseAssumptionsFromResponse(claudeResponse);

      expect(result).toEqual([]);
    });
  });

  describe('generateStep1Hash - conversation history reset on Step 1 changes', () => {
    it('should generate consistent hash for same Step 1 inputs', () => {
      const hash1 = generateStep1Hash(
        'Reduce stockouts by 30%',
        'Retail',
        ['SAP S/4HANA', 'Salesforce']
      );
      const hash2 = generateStep1Hash(
        'Reduce stockouts by 30%',
        'Retail',
        ['SAP S/4HANA', 'Salesforce']
      );

      expect(hash1).toBe(hash2);
      expect(hash1).toBeTruthy();
    });

    it('should generate different hash when Step 1 inputs change', () => {
      const originalHash = generateStep1Hash(
        'Reduce stockouts by 30%',
        'Retail',
        ['SAP S/4HANA', 'Salesforce']
      );

      // Change business objective
      const changedObjectiveHash = generateStep1Hash(
        'Improve customer satisfaction',
        'Retail',
        ['SAP S/4HANA', 'Salesforce']
      );

      // Change industry
      const changedIndustryHash = generateStep1Hash(
        'Reduce stockouts by 30%',
        'Manufacturing',
        ['SAP S/4HANA', 'Salesforce']
      );

      // Change systems
      const changedSystemsHash = generateStep1Hash(
        'Reduce stockouts by 30%',
        'Retail',
        ['SAP S/4HANA', 'ServiceNow']
      );

      expect(changedObjectiveHash).not.toBe(originalHash);
      expect(changedIndustryHash).not.toBe(originalHash);
      expect(changedSystemsHash).not.toBe(originalHash);
    });

    it('hasStep1Changed should detect when reset is needed', () => {
      const originalHash = generateStep1Hash(
        'Reduce stockouts by 30%',
        'Retail',
        ['SAP S/4HANA']
      );

      // Same inputs - no reset needed
      expect(hasStep1Changed(
        originalHash,
        'Reduce stockouts by 30%',
        'Retail',
        ['SAP S/4HANA']
      )).toBe(false);

      // Different inputs - reset needed
      expect(hasStep1Changed(
        originalHash,
        'Different objective',
        'Retail',
        ['SAP S/4HANA']
      )).toBe(true);
    });
  });

  describe('parseAssumptionsFromResponse - streaming state and source tracking', () => {
    it('should set source to ai-proposed for initial assumptions', () => {
      const claudeResponse = `\`\`\`json
{
  "assumptions": [
    {
      "system": "Workday",
      "modules": ["HCM", "Payroll"],
      "integrations": []
    }
  ]
}
\`\`\``;

      const result = parseAssumptionsFromResponse(claudeResponse);

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('ai-proposed');
    });

    it('should preserve assumptions array structure with proper typing', () => {
      const claudeResponse = `\`\`\`json
{
  "assumptions": [
    {
      "system": "ServiceNow",
      "modules": ["ITSM", "CMDB"],
      "integrations": ["Jira sync", "Slack notifications"]
    }
  ]
}
\`\`\``;

      const result = parseAssumptionsFromResponse(claudeResponse);

      // Verify structure matches SystemAssumption interface
      const assumption: SystemAssumption = result[0];
      expect(typeof assumption.system).toBe('string');
      expect(Array.isArray(assumption.modules)).toBe(true);
      expect(Array.isArray(assumption.integrations)).toBe(true);
      expect(['ai-proposed', 'user-corrected']).toContain(assumption.source);
    });
  });

  describe('error recovery - preserving conversation history', () => {
    it('should handle response with multiple JSON blocks (use first valid one)', () => {
      const claudeResponse = `Let me show you a comparison:

First option:
\`\`\`json
{
  "assumptions": [
    {
      "system": "Option A",
      "modules": ["Module 1"],
      "integrations": []
    }
  ]
}
\`\`\`

Second option (different format):
\`\`\`json
{
  "alternative": "This is not assumptions format"
}
\`\`\``;

      const result = parseAssumptionsFromResponse(claudeResponse);

      // Should parse the first valid assumptions block
      expect(result).toHaveLength(1);
      expect(result[0].system).toBe('Option A');
    });

    it('should handle assumptions with missing optional fields', () => {
      const claudeResponse = `\`\`\`json
{
  "assumptions": [
    {
      "system": "Legacy System",
      "modules": [],
      "integrations": []
    }
  ]
}
\`\`\``;

      const result = parseAssumptionsFromResponse(claudeResponse);

      expect(result).toHaveLength(1);
      expect(result[0].system).toBe('Legacy System');
      expect(result[0].modules).toEqual([]);
      expect(result[0].integrations).toEqual([]);
      expect(result[0].source).toBe('ai-proposed');
    });
  });
});
