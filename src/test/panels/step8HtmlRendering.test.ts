/**
 * Tests for Step 8: HTML Rendering
 * Task Group 4: Pre-Generation Summary UI
 * Task Group 5: Generation Progress UI
 *
 * Tests the HTML rendering functions for Step 8 summary cards,
 * status icons, and progress UI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode module before importing HTML generators
vi.mock('vscode', () => ({
  EventEmitter: class {
    private listeners: ((data: unknown) => void)[] = [];
    event = (listener: (data: unknown) => void) => {
      this.listeners.push(listener);
      return { dispose: () => {} };
    };
    fire = (data: unknown) => {
      this.listeners.forEach((l) => l(data));
    };
    dispose = vi.fn();
  },
  Uri: {
    file: vi.fn().mockReturnValue({ fsPath: '/test/path' }),
    joinPath: vi.fn().mockReturnValue({ fsPath: '/test/path' }),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
  },
}));

// Import after mocks
import {
  renderStepSummaryCard,
  getStatusIconSvg,
  generateStep8Html,
  renderPreGenerationSummary,
  renderGenerationProgress,
  renderFileProgressList,
} from '../../panels/ideationStepHtml';
import type { StepSummary, GenerationState } from '../../types/wizardPanel';
import { createDefaultGenerationState, STEERING_FILES } from '../../types/wizardPanel';

// ============================================================================
// Task 4.1: 4 Focused Tests for Summary Card HTML Generation
// ============================================================================

describe('Task Group 4: Step 8 HTML Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Test 1: renderStepSummaryCard() outputs correct HTML structure
  // ---------------------------------------------------------------------------
  describe('Test 1: renderStepSummaryCard() outputs correct HTML structure', () => {
    it('should render card with step name and number', () => {
      const summary: StepSummary = {
        stepNumber: 1,
        stepName: 'Business Context',
        summaryData: {
          'Industry': 'Retail',
          'Systems': '3 system(s)',
        },
        validationStatus: 'complete',
      };

      const html = renderStepSummaryCard(summary);

      expect(html).toContain('class="summary-card"');
      expect(html).toContain('Business Context');
      expect(html).toContain('data-step="1"');
    });

    it('should render summary data key-value pairs', () => {
      const summary: StepSummary = {
        stepNumber: 3,
        stepName: 'Outcomes',
        summaryData: {
          'Outcome': 'Reduce manual effort by 50%',
          'KPIs': '3 metric(s)',
        },
        validationStatus: 'complete',
      };

      const html = renderStepSummaryCard(summary);

      expect(html).toContain('Outcome');
      expect(html).toContain('Reduce manual effort by 50%');
      expect(html).toContain('KPIs');
      expect(html).toContain('3 metric(s)');
    });

    it('should render Edit button with step navigation data', () => {
      const summary: StepSummary = {
        stepNumber: 5,
        stepName: 'Agent Design',
        summaryData: { 'Agents': '2 agents' },
        validationStatus: 'complete',
      };

      const html = renderStepSummaryCard(summary);

      expect(html).toContain('class="summary-card-edit-btn"');
      expect(html).toContain('data-step="5"');
      expect(html).toContain('Edit');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2: Card shows green checkmark icon for valid status
  // ---------------------------------------------------------------------------
  describe('Test 2: Card shows green checkmark icon for valid status', () => {
    it('should render check icon SVG for complete status', () => {
      const summary: StepSummary = {
        stepNumber: 1,
        stepName: 'Business Context',
        summaryData: { 'Industry': 'Retail' },
        validationStatus: 'complete',
      };

      const html = renderStepSummaryCard(summary);

      expect(html).toContain('class="status-icon status-complete"');
      expect(html).toContain('<svg');
      expect(html).toContain('viewBox="0 0 16 16"');
    });

    it('should not show validation message for complete status', () => {
      const summary: StepSummary = {
        stepNumber: 1,
        stepName: 'Business Context',
        summaryData: { 'Industry': 'Retail' },
        validationStatus: 'complete',
      };

      const html = renderStepSummaryCard(summary);

      expect(html).not.toContain('class="validation-message"');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3: Card shows yellow warning icon with message for warning status
  // ---------------------------------------------------------------------------
  describe('Test 3: Card shows yellow warning icon with message for warning status', () => {
    it('should render warning icon SVG for warning status', () => {
      const summary: StepSummary = {
        stepNumber: 4,
        stepName: 'Security',
        summaryData: { 'Status': 'Skipped' },
        validationStatus: 'warning',
        validationMessage: 'Security configuration was skipped',
      };

      const html = renderStepSummaryCard(summary);

      expect(html).toContain('class="status-icon status-warning"');
    });

    it('should display validation message for warning status', () => {
      const summary: StepSummary = {
        stepNumber: 4,
        stepName: 'Security',
        summaryData: { 'Status': 'Skipped' },
        validationStatus: 'warning',
        validationMessage: 'Security configuration was skipped',
      };

      const html = renderStepSummaryCard(summary);

      expect(html).toContain('class="validation-message warning"');
      expect(html).toContain('Security configuration was skipped');
    });

    it('should render error icon SVG for error status', () => {
      const summary: StepSummary = {
        stepNumber: 1,
        stepName: 'Business Context',
        summaryData: {},
        validationStatus: 'error',
        validationMessage: 'Business objective is required',
      };

      const html = renderStepSummaryCard(summary);

      expect(html).toContain('class="status-icon status-error"');
    });

    it('should display validation message for error status', () => {
      const summary: StepSummary = {
        stepNumber: 1,
        stepName: 'Business Context',
        summaryData: {},
        validationStatus: 'error',
        validationMessage: 'Business objective is required',
      };

      const html = renderStepSummaryCard(summary);

      expect(html).toContain('class="validation-message error"');
      expect(html).toContain('Business objective is required');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 4: Card shows "Edit" button with correct step navigation data
  // ---------------------------------------------------------------------------
  describe('Test 4: Card shows Edit button with correct step navigation data', () => {
    it('should render Edit button for each step', () => {
      for (let stepNumber = 1; stepNumber <= 7; stepNumber++) {
        const summary: StepSummary = {
          stepNumber,
          stepName: `Step ${stepNumber}`,
          summaryData: {},
          validationStatus: 'complete',
        };

        const html = renderStepSummaryCard(summary);

        expect(html).toContain(`data-step="${stepNumber}"`);
        expect(html).toContain('step8EditStep');
      }
    });

    it('should include onclick handler for step8EditStep command', () => {
      const summary: StepSummary = {
        stepNumber: 3,
        stepName: 'Outcomes',
        summaryData: { 'Outcome': 'Test' },
        validationStatus: 'complete',
      };

      const html = renderStepSummaryCard(summary);

      expect(html).toContain("handleStep8Command('step8EditStep'");
      expect(html).toContain('step: 3');
    });
  });

  // ---------------------------------------------------------------------------
  // Additional Tests for Status Icons
  // ---------------------------------------------------------------------------
  describe('getStatusIconSvg()', () => {
    it('should return check icon for complete status', () => {
      const icon = getStatusIconSvg('complete');

      expect(icon).toContain('class="status-icon status-complete"');
      expect(icon).toContain('svg');
      expect(icon).toContain('path');
    });

    it('should return warning icon for warning status', () => {
      const icon = getStatusIconSvg('warning');

      expect(icon).toContain('class="status-icon status-warning"');
      expect(icon).toContain('svg');
    });

    it('should return error icon for error status', () => {
      const icon = getStatusIconSvg('error');

      expect(icon).toContain('class="status-icon status-error"');
      expect(icon).toContain('svg');
    });
  });

  // ---------------------------------------------------------------------------
  // Tests for renderPreGenerationSummary()
  // ---------------------------------------------------------------------------
  describe('renderPreGenerationSummary()', () => {
    it('should render a container with summary-cards-grid class', () => {
      const summaries: StepSummary[] = [
        {
          stepNumber: 1,
          stepName: 'Business Context',
          summaryData: { 'Industry': 'Retail' },
          validationStatus: 'complete',
        },
      ];

      const html = renderPreGenerationSummary(summaries);

      expect(html).toContain('class="summary-cards-grid"');
    });

    it('should render a card for each summary', () => {
      const summaries: StepSummary[] = [
        {
          stepNumber: 1,
          stepName: 'Business Context',
          summaryData: { 'Industry': 'Retail' },
          validationStatus: 'complete',
        },
        {
          stepNumber: 2,
          stepName: 'AI Gap Filling',
          summaryData: { 'Assumptions': '5 confirmed' },
          validationStatus: 'complete',
        },
      ];

      const html = renderPreGenerationSummary(summaries);

      expect(html).toContain('Business Context');
      expect(html).toContain('AI Gap Filling');
      expect(html).toContain('data-step="1"');
      expect(html).toContain('data-step="2"');
    });
  });

  // ---------------------------------------------------------------------------
  // Tests for generateStep8Html()
  // ---------------------------------------------------------------------------
  describe('generateStep8Html()', () => {
    it('should render pre-generation UI when not generating', () => {
      const generationState = createDefaultGenerationState();
      const summaries: StepSummary[] = [
        {
          stepNumber: 1,
          stepName: 'Business Context',
          summaryData: { 'Industry': 'Retail' },
          validationStatus: 'complete',
        },
      ];

      const html = generateStep8Html(generationState, summaries);

      expect(html).toContain('class="step8-header"');
      expect(html).toContain('Generate');
      expect(html).toContain('summary-cards-grid');
    });

    it('should render action buttons', () => {
      const generationState = createDefaultGenerationState();
      const summaries: StepSummary[] = [];

      const html = generateStep8Html(generationState, summaries);

      // Check for generate button with its classes (may have multiple classes)
      expect(html).toContain('generate-btn');
      expect(html).toContain('Generate');
    });

    it('should disable generate button when canGenerate is false', () => {
      const generationState = createDefaultGenerationState();
      generationState.canGenerate = false;
      const summaries: StepSummary[] = [];

      const html = generateStep8Html(generationState, summaries);

      expect(html).toContain('disabled');
      // Check for generate button class (may have multiple classes)
      expect(html).toContain('generate-btn');
    });
  });
});

// ============================================================================
// Task 5.1: 5 Focused Tests for Generation Progress UI
// ============================================================================

describe('Task Group 5: Generation Progress UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Test 1: renderGenerationProgress() shows 3-item checklist
  // ---------------------------------------------------------------------------
  describe('Test 1: renderGenerationProgress() shows 3-item checklist', () => {
    it('should render progress checklist container', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = true;

      const html = renderGenerationProgress(state);

      expect(html).toContain('class="progress-checklist"');
    });

    it('should show 3 main progress items', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = true;

      const html = renderGenerationProgress(state);

      // Check for all 3 checklist items
      expect(html).toContain('Validate wizard inputs');
      expect(html).toContain('Generate steering files');
      expect(html).toContain('Ready for Kiro');
    });

    it('should show validate step as complete when generating', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = true;

      const html = renderGenerationProgress(state);

      // Validate step should be complete when generation starts
      expect(html).toContain('progress-item');
      expect(html).toContain('complete');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2: Progress shows spinner icon while generating
  // ---------------------------------------------------------------------------
  describe('Test 2: Progress shows spinner icon while generating', () => {
    it('should render spinner icon during generation', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = true;
      state.currentFileIndex = 0;

      const html = renderGenerationProgress(state);

      // Should show spinner for active state
      expect(html).toContain('spinner-icon');
    });

    it('should not show spinner when not generating', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = false;

      const html = renderGenerationProgress(state);

      // Should not have spinner when idle (only pending circles)
      expect(html).not.toContain('spinner-icon');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3: Accordion auto-expands during generation
  // ---------------------------------------------------------------------------
  describe('Test 3: Accordion auto-expands during generation', () => {
    it('should show expanded accordion when accordionExpanded is true', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = true;
      state.accordionExpanded = true;

      const html = renderGenerationProgress(state);

      // Should have expanded class on accordion
      expect(html).toContain('expanded');
    });

    it('should show accordion toggle chevron', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = true;
      state.accordionExpanded = true;

      const html = renderGenerationProgress(state);

      // Should have accordion chevron for expand/collapse
      expect(html).toContain('accordion-chevron');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 4: Accordion shows file-level progress with status icons
  // ---------------------------------------------------------------------------
  describe('Test 4: Accordion shows file-level progress with status icons', () => {
    it('should render file progress list', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = true;
      state.accordionExpanded = true;

      const html = renderFileProgressList(state);

      expect(html).toContain('file-progress-list');
    });

    it('should show all steering files in progress list', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = true;

      const html = renderFileProgressList(state);

      // Should show all 7 steering files
      STEERING_FILES.forEach((fileName) => {
        expect(html).toContain(fileName);
      });
    });

    it('should show complete status for finished files', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = true;
      state.completedFiles = ['product.md', 'tech.md'];
      state.currentFileIndex = 2;

      const html = renderFileProgressList(state);

      // Completed files should have complete class
      expect(html).toContain('file-progress-item');
      expect(html).toContain('complete');
    });

    it('should show error status for failed file', () => {
      const state: GenerationState = {
        ...createDefaultGenerationState(),
        failedFile: { name: 'structure.md', error: 'Test error' },
        currentFileIndex: 2,
      };

      const html = renderFileProgressList(state);

      // Failed file should have error class and message
      expect(html).toContain('error');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 5: Summary text shows progress count
  // ---------------------------------------------------------------------------
  describe('Test 5: Summary text shows progress count', () => {
    it('should show progress count during generation', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = true;
      state.completedFiles = ['product.md', 'tech.md', 'structure.md'];
      state.currentFileIndex = 3;

      const html = renderGenerationProgress(state);

      // Should show progress count like "3/8 files"
      expect(html).toContain('3/8');
    });

    it('should show completed count when all files done', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = false;
      state.completedFiles = [...STEERING_FILES];
      state.generatedFilePaths = STEERING_FILES.map((f) => `/test/${f}`);

      const html = renderGenerationProgress(state);

      // Should show complete count
      expect(html).toContain('8/8');
    });

    it('should show Generating text during active generation', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = true;
      state.completedFiles = ['product.md'];
      state.currentFileIndex = 1;

      const html = renderGenerationProgress(state);

      // Should indicate generation in progress
      expect(html).toContain('Generating');
    });

    it('should show placeholder mode indicator when isPlaceholderMode is true', () => {
      const state = createDefaultGenerationState();
      state.isGenerating = true;
      state.isPlaceholderMode = true;
      state.completedFiles = ['product.md'];

      const html = renderGenerationProgress(state);

      // Should show preview mode indicator
      expect(html).toContain('preview-mode-indicator');
    });
  });
});
