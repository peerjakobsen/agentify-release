/**
 * Tests for OutcomeDefinitionService
 *
 * Task Group 2: Outcome Definition AI Service
 * 5 focused tests for outcome suggestion service layer
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
    EventEmitter: class MockEventEmitter {
      private handlers: Array<(e: unknown) => void> = [];
      event = (handler: (e: unknown) => void) => {
        this.handlers.push(handler);
        return { dispose: () => {} };
      };
      fire = (e: unknown) => this.handlers.forEach((h) => h(e));
      dispose = () => { this.handlers = []; };
    },
    _mockReadFile: mockReadFile,
  };
});

// Import the service under test
import {
  buildOutcomeContextMessage,
  parseOutcomeSuggestionsFromResponse,
} from '../../services/outcomeDefinitionService';
import type { SystemAssumption, OutcomeSuggestions } from '../../types/wizardPanel';

describe('Task Group 2: OutcomeDefinitionService', () => {
  describe('buildOutcomeContextMessage - context message formatting from Steps 1-2 inputs', () => {
    it('should format context message correctly from Steps 1-2 inputs including confirmed assumptions', () => {
      const businessObjective = 'Reduce stockouts by 30% through AI-powered demand forecasting';
      const industry = 'Retail';
      const systems = ['SAP S/4HANA', 'Salesforce'];
      const confirmedAssumptions: SystemAssumption[] = [
        {
          system: 'SAP S/4HANA',
          modules: ['MM', 'SD', 'PP'],
          integrations: ['Salesforce CRM sync', 'EDI with suppliers'],
          source: 'ai-proposed',
        },
        {
          system: 'Salesforce',
          modules: ['Sales Cloud', 'Service Cloud'],
          integrations: ['SAP inventory visibility'],
          source: 'user-corrected',
        },
      ];

      const result = buildOutcomeContextMessage(
        businessObjective,
        industry,
        systems,
        confirmedAssumptions
      );

      // Verify the message contains all required components
      expect(result).toContain(businessObjective);
      expect(result).toContain(industry);
      expect(result).toContain('SAP S/4HANA');
      expect(result).toContain('Salesforce');
      expect(result).toContain('MM, SD, PP');
      expect(result).toContain('Salesforce CRM sync');
      expect(result).toContain('Sales Cloud');

      // Verify proper formatting structure
      expect(result).toMatch(/business\s*objective/i);
      expect(result).toMatch(/industry/i);
      expect(result).toMatch(/system/i);
      expect(result).toMatch(/assumption/i);
    });

    it('should handle empty assumptions array gracefully', () => {
      const result = buildOutcomeContextMessage(
        'Automate customer service',
        'FSI',
        ['ServiceNow'],
        []
      );

      expect(result).toContain('Automate customer service');
      expect(result).toContain('FSI');
      expect(result).toContain('ServiceNow');
      expect(result).toMatch(/no.*assumption|yet/i);
    });
  });

  describe('parseOutcomeSuggestionsFromResponse - JSON parsing from Claude response', () => {
    it('should parse valid JSON outcome suggestions from Claude response with prose', () => {
      const claudeResponse = `Based on your objective to reduce stockouts in the Retail industry, I've analyzed your context and proposed measurable outcomes.

\`\`\`json
{
  "primaryOutcome": "Reduce inventory stockouts by 30% through AI-powered demand forecasting",
  "suggestedKPIs": [
    {
      "name": "Stockout Rate",
      "targetValue": "30",
      "unit": "% reduction"
    },
    {
      "name": "Forecast Accuracy",
      "targetValue": "85",
      "unit": "%"
    },
    {
      "name": "Inventory Turnover",
      "targetValue": "8",
      "unit": "x per year"
    }
  ],
  "stakeholders": ["Operations", "Supply Chain", "Finance", "Sales"]
}
\`\`\`

The stockout rate and forecast accuracy KPIs directly measure your primary objective.`;

      const result = parseOutcomeSuggestionsFromResponse(claudeResponse);

      expect(result).not.toBeNull();
      expect(result!.primaryOutcome).toContain('stockouts');
      expect(result!.suggestedKPIs).toHaveLength(3);
      expect(result!.suggestedKPIs[0].name).toBe('Stockout Rate');
      expect(result!.suggestedKPIs[0].targetValue).toBe('30');
      expect(result!.suggestedKPIs[0].unit).toBe('% reduction');
      expect(result!.stakeholders).toHaveLength(4);
      expect(result!.stakeholders).toContain('Operations');
      expect(result!.stakeholders).toContain('Sales');
    });

    it('should return null for response without JSON block', () => {
      const claudeResponse = `I understand your objective. Let me ask some clarifying questions before proposing outcome metrics.

What specific inventory categories are you targeting? And what is your current baseline stockout rate?`;

      const result = parseOutcomeSuggestionsFromResponse(claudeResponse);

      expect(result).toBeNull();
    });

    it('should handle malformed JSON gracefully and return null', () => {
      const claudeResponse = `Here are my suggestions:

\`\`\`json
{
  "primaryOutcome": "Reduce costs",
  "suggestedKPIs": [
    {
      "name": "Cost Reduction"
      // Missing comma and closing
\`\`\``;

      const result = parseOutcomeSuggestionsFromResponse(claudeResponse);

      expect(result).toBeNull();
    });

    it('should handle JSON without required fields gracefully and return null', () => {
      const claudeResponse = `Here's some analysis:

\`\`\`json
{
  "analysis": "Your systems look good",
  "confidence": 0.85,
  "recommendations": ["Add more data sources"]
}
\`\`\``;

      const result = parseOutcomeSuggestionsFromResponse(claudeResponse);

      expect(result).toBeNull();
    });

    it('should validate suggestedKPIs structure and filter invalid entries', () => {
      const claudeResponse = `\`\`\`json
{
  "primaryOutcome": "Improve efficiency by 40%",
  "suggestedKPIs": [
    {
      "name": "Processing Time",
      "targetValue": "50",
      "unit": "% reduction"
    },
    {
      "name": "Invalid KPI"
    },
    {
      "name": "Cost Savings",
      "targetValue": 1000000,
      "unit": "USD"
    }
  ],
  "stakeholders": ["Operations", "Finance", 123, "Executive"]
}
\`\`\``;

      const result = parseOutcomeSuggestionsFromResponse(claudeResponse);

      expect(result).not.toBeNull();
      // Should filter out the invalid KPI (missing targetValue and unit)
      expect(result!.suggestedKPIs).toHaveLength(2);
      expect(result!.suggestedKPIs[0].name).toBe('Processing Time');
      // Should convert number to string for targetValue
      expect(result!.suggestedKPIs[1].targetValue).toBe('1000000');
      // Should filter out non-string stakeholder (123)
      expect(result!.stakeholders).toHaveLength(3);
      expect(result!.stakeholders).not.toContain(123);
    });
  });
});
