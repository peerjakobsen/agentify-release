/**
 * Tests for Step 8 Generation Type Definitions
 * Task Group 1: State Interfaces and Types
 *
 * Tests the type definitions and factory functions for Step 8
 * pre-generation summary and steering file generation.
 */

import { describe, it, expect } from 'vitest';

import {
  createDefaultGenerationState,
  STEERING_FILES,
  WIZARD_COMMANDS,
  type GenerationState,
  type StepSummary,
} from '../../types/wizardPanel';

// ============================================================================
// Task 1.1: 4 Focused Tests for Step 8 Type Definitions
// ============================================================================

describe('Task Group 1: Step 8 Type Definitions', () => {
  // ---------------------------------------------------------------------------
  // Test 1: GenerationState interface initialization via factory function
  // ---------------------------------------------------------------------------
  describe('Test 1: GenerationState interface initialization', () => {
    it('should create default GenerationState with correct initial values', () => {
      const state = createDefaultGenerationState();

      // Verify all required fields exist with correct defaults
      expect(state.isGenerating).toBe(false);
      expect(state.currentFileIndex).toBe(-1);
      expect(state.completedFiles).toEqual([]);
      expect(state.failedFile).toBeUndefined();
      expect(state.generatedFilePaths).toEqual([]);
      expect(state.accordionExpanded).toBe(false);
      expect(state.canGenerate).toBe(true);
      // Phase 2 roadmap fields
      expect(state.roadmapGenerating).toBe(false);
      expect(state.roadmapGenerated).toBe(false);
      expect(state.roadmapFilePath).toBe('');
      expect(state.roadmapError).toBeUndefined();
    });

    it('should create independent state instances', () => {
      const state1 = createDefaultGenerationState();
      const state2 = createDefaultGenerationState();

      // Modify one instance
      state1.completedFiles.push('test.md');
      state1.isGenerating = true;

      // Verify the other is unaffected
      expect(state2.completedFiles).toEqual([]);
      expect(state2.isGenerating).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2: STEERING_FILES constant contains expected 8 files
  // ---------------------------------------------------------------------------
  describe('Test 2: STEERING_FILES constant', () => {
    it('should contain exactly 8 steering files', () => {
      expect(STEERING_FILES).toHaveLength(8);
    });

    it('should contain all expected steering file names', () => {
      const expectedFiles = [
        'product.md',
        'tech.md',
        'structure.md',
        'customer-context.md',
        'integration-landscape.md',
        'security-policies.md',
        'demo-strategy.md',
        'agentify-integration.md',
      ];

      expect(STEERING_FILES).toEqual(expectedFiles);
    });

    it('should have all files with .md extension', () => {
      for (const file of STEERING_FILES) {
        expect(file).toMatch(/\.md$/);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3: StepSummary interface structure with validation status
  // ---------------------------------------------------------------------------
  describe('Test 3: StepSummary interface structure', () => {
    it('should accept valid StepSummary with complete status', () => {
      const summary: StepSummary = {
        stepNumber: 1,
        stepName: 'Business Context',
        summaryData: {
          industry: 'Retail',
          systems: '3 systems',
          objective: 'Streamline inventory...',
        },
        validationStatus: 'complete',
      };

      expect(summary.stepNumber).toBe(1);
      expect(summary.stepName).toBe('Business Context');
      expect(summary.validationStatus).toBe('complete');
      expect(summary.summaryData['industry']).toBe('Retail');
      expect(summary.validationMessage).toBeUndefined();
    });

    it('should accept StepSummary with warning status and message', () => {
      const summary: StepSummary = {
        stepNumber: 4,
        stepName: 'Security',
        summaryData: {
          sensitivity: 'Internal',
          skipped: 'Yes',
        },
        validationStatus: 'warning',
        validationMessage: 'Security step was skipped',
      };

      expect(summary.validationStatus).toBe('warning');
      expect(summary.validationMessage).toBe('Security step was skipped');
    });

    it('should accept StepSummary with error status and message', () => {
      const summary: StepSummary = {
        stepNumber: 3,
        stepName: 'Outcomes',
        summaryData: {},
        validationStatus: 'error',
        validationMessage: 'Primary outcome is required',
      };

      expect(summary.validationStatus).toBe('error');
      expect(summary.validationMessage).toBe('Primary outcome is required');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 4: WIZARD_COMMANDS includes Step 8 commands
  // ---------------------------------------------------------------------------
  describe('Test 4: WIZARD_COMMANDS includes Step 8 commands', () => {
    it('should include STEP8_GENERATE command', () => {
      expect(WIZARD_COMMANDS.STEP8_GENERATE).toBe('step8Generate');
    });

    it('should include STEP8_GENERATE_AND_OPEN_KIRO command', () => {
      expect(WIZARD_COMMANDS.STEP8_GENERATE_AND_OPEN_KIRO).toBe('step8GenerateAndOpenKiro');
    });

    it('should include STEP8_START_OVER command', () => {
      expect(WIZARD_COMMANDS.STEP8_START_OVER).toBe('step8StartOver');
    });

    it('should include STEP8_OPEN_FILE command', () => {
      expect(WIZARD_COMMANDS.STEP8_OPEN_FILE).toBe('step8OpenFile');
    });

    it('should include STEP8_RETRY command', () => {
      expect(WIZARD_COMMANDS.STEP8_RETRY).toBe('step8Retry');
    });

    it('should include STEP8_TOGGLE_ACCORDION command', () => {
      expect(WIZARD_COMMANDS.STEP8_TOGGLE_ACCORDION).toBe('step8ToggleAccordion');
    });

    it('should include STEP8_EDIT_STEP command', () => {
      expect(WIZARD_COMMANDS.STEP8_EDIT_STEP).toBe('step8EditStep');
    });
  });
});
