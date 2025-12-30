/**
 * Tests for Step 7 Demo Strategy - Logic Handler
 * Task Group 4: Logic handler for Step 7 Demo Strategy feature
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock vscode before importing the handler
vi.mock('vscode', () => ({
  default: {},
  EventEmitter: class MockEventEmitter {
    private listeners: (() => void)[] = [];
    event = (listener: () => void) => {
      this.listeners.push(listener);
      return { dispose: () => {} };
    };
    fire = () => this.listeners.forEach((l) => l());
    dispose = () => {};
  },
  Disposable: {
    from: (...disposables: { dispose: () => void }[]) => ({
      dispose: () => disposables.forEach((d) => d.dispose()),
    }),
  },
}));

import { Step7LogicHandler } from '../../panels/ideationStep7Logic';
import {
  createDefaultDemoStrategyState,
  type DemoStrategyState,
} from '../../types/wizardPanel';

// ============================================================================
// Task 4.1: 5 Focused Tests for Logic Handler
// ============================================================================

describe('Task Group 4: Step 7 Demo Strategy - Logic Handler', () => {
  let state: DemoStrategyState;
  let callbacks: {
    updateWebviewContent: ReturnType<typeof vi.fn>;
    syncStateToWebview: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    state = createDefaultDemoStrategyState();
    callbacks = {
      updateWebviewContent: vi.fn(),
      syncStateToWebview: vi.fn(),
    };
  });

  describe('Test 1: handleAddMoment() respects max 5 limit', () => {
    it('should add moment when under limit', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      // Add first moment
      const result1 = handler.handleAddMoment();
      expect(result1).toBe(true);
      expect(handler.getState().ahaMoments).toHaveLength(1);
      expect(handler.getState().ahaMoments[0].id).toBeTruthy();
      expect(handler.getState().ahaMoments[0].title).toBe('');

      // Add more moments up to 5
      expect(handler.handleAddMoment()).toBe(true);
      expect(handler.handleAddMoment()).toBe(true);
      expect(handler.handleAddMoment()).toBe(true);
      expect(handler.handleAddMoment()).toBe(true);
      expect(handler.getState().ahaMoments).toHaveLength(5);
    });

    it('should reject moment when at max 5 limit', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      // Add 5 moments
      for (let i = 0; i < 5; i++) {
        handler.handleAddMoment();
      }
      expect(handler.getState().ahaMoments).toHaveLength(5);

      // Attempt to add 6th moment
      const result = handler.handleAddMoment();
      expect(result).toBe(false);
      expect(handler.getState().ahaMoments).toHaveLength(5);
    });
  });

  describe('Test 2: handleMoveSceneUp/Down() swaps scenes correctly', () => {
    it('should swap scenes when moving up', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      // Add three scenes
      handler.handleAddScene();
      handler.handleAddScene();
      handler.handleAddScene();

      // Update scene titles for identification
      handler.handleUpdateScene(0, 'title', 'Scene A');
      handler.handleUpdateScene(1, 'title', 'Scene B');
      handler.handleUpdateScene(2, 'title', 'Scene C');

      const scenes = handler.getState().narrativeScenes;
      expect(scenes[0].title).toBe('Scene A');
      expect(scenes[1].title).toBe('Scene B');
      expect(scenes[2].title).toBe('Scene C');

      // Move scene at index 1 up
      handler.handleMoveSceneUp(1);

      const updatedScenes = handler.getState().narrativeScenes;
      expect(updatedScenes[0].title).toBe('Scene B');
      expect(updatedScenes[1].title).toBe('Scene A');
      expect(updatedScenes[2].title).toBe('Scene C');
    });

    it('should swap scenes when moving down', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      // Add three scenes
      handler.handleAddScene();
      handler.handleAddScene();
      handler.handleAddScene();

      // Update scene titles for identification
      handler.handleUpdateScene(0, 'title', 'Scene A');
      handler.handleUpdateScene(1, 'title', 'Scene B');
      handler.handleUpdateScene(2, 'title', 'Scene C');

      // Move scene at index 0 down
      handler.handleMoveSceneDown(0);

      const updatedScenes = handler.getState().narrativeScenes;
      expect(updatedScenes[0].title).toBe('Scene B');
      expect(updatedScenes[1].title).toBe('Scene A');
      expect(updatedScenes[2].title).toBe('Scene C');
    });

    it('should not swap when moving first scene up (boundary)', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      handler.handleAddScene();
      handler.handleAddScene();
      handler.handleUpdateScene(0, 'title', 'Scene A');
      handler.handleUpdateScene(1, 'title', 'Scene B');

      // Attempt to move first scene up (should be no-op)
      handler.handleMoveSceneUp(0);

      const scenes = handler.getState().narrativeScenes;
      expect(scenes[0].title).toBe('Scene A');
      expect(scenes[1].title).toBe('Scene B');
    });

    it('should not swap when moving last scene down (boundary)', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      handler.handleAddScene();
      handler.handleAddScene();
      handler.handleUpdateScene(0, 'title', 'Scene A');
      handler.handleUpdateScene(1, 'title', 'Scene B');

      // Attempt to move last scene down (should be no-op)
      handler.handleMoveSceneDown(1);

      const scenes = handler.getState().narrativeScenes;
      expect(scenes[0].title).toBe('Scene A');
      expect(scenes[1].title).toBe('Scene B');
    });
  });

  describe('Test 3: handleGenerateMoments() sets loading state and calls service', () => {
    it('should set isGeneratingMoments and trigger UI update when called', async () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      const inputs = {
        industry: 'Retail',
        businessObjective: 'Improve inventory management',
        confirmedAgents: [],
        outcomeDefinition: 'Reduce stockouts by 50%',
        confirmedEdges: [],
      };

      // Track what state was passed to the callback
      let loadingStateWasSet = false;
      callbacks.updateWebviewContent.mockImplementation(() => {
        // Check if loading state was true at time of first callback
        if (!loadingStateWasSet && handler.getState().isGeneratingMoments) {
          loadingStateWasSet = true;
        }
      });

      // Start generation (will fail without service but should set loading state first)
      await handler.handleGenerateMoments(inputs);

      // Verify the loading state was set at some point (callbacks were called)
      expect(callbacks.updateWebviewContent).toHaveBeenCalled();
      expect(callbacks.syncStateToWebview).toHaveBeenCalled();

      // Verify loading state was true at the first callback
      expect(loadingStateWasSet).toBe(true);

      // After completion, loading state should be reset (service unavailable)
      expect(handler.getState().isGeneratingMoments).toBe(false);
    });
  });

  describe('Test 4: handleGenerateAll() triggers all three sections sequentially', () => {
    it('should call all three generate methods', async () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      // Spy on individual generate methods
      const generateMomentsSpy = vi.spyOn(handler, 'handleGenerateMoments');
      const generatePersonaSpy = vi.spyOn(handler, 'handleGeneratePersona');
      const generateNarrativeSpy = vi.spyOn(handler, 'handleGenerateNarrative');

      const inputs = {
        industry: 'Retail',
        businessObjective: 'Improve inventory management',
        confirmedAgents: [],
        outcomeDefinition: 'Reduce stockouts by 50%',
        confirmedEdges: [],
      };

      // Call handleGenerateAll
      await handler.handleGenerateAll(inputs);

      // Verify all three methods were called
      expect(generateMomentsSpy).toHaveBeenCalledWith(inputs);
      expect(generatePersonaSpy).toHaveBeenCalledWith(inputs);
      expect(generateNarrativeSpy).toHaveBeenCalledWith(inputs);
    });
  });

  describe('Test 5: handleAddScene() respects max 8 limit', () => {
    it('should add scene when under limit', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      // Add first scene
      const result1 = handler.handleAddScene();
      expect(result1).toBe(true);
      expect(handler.getState().narrativeScenes).toHaveLength(1);
      expect(handler.getState().narrativeScenes[0].id).toBeTruthy();
      expect(handler.getState().narrativeScenes[0].title).toBe('');
    });

    it('should reject scene when at max 8 limit', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      // Add 8 scenes
      for (let i = 0; i < 8; i++) {
        handler.handleAddScene();
      }
      expect(handler.getState().narrativeScenes).toHaveLength(8);

      // Attempt to add 9th scene
      const result = handler.handleAddScene();
      expect(result).toBe(false);
      expect(handler.getState().narrativeScenes).toHaveLength(8);
    });
  });

  describe('Test 6: getValidationWarnings() returns warnings for empty sections', () => {
    it('should return warning when ahaMoments is empty', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      const warnings = handler.getValidationWarnings();

      expect(warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('No aha moments defined'),
        })
      );
    });

    it('should return warning when narrativeScenes is empty', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      const warnings = handler.getValidationWarnings();

      expect(warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('No narrative scenes defined'),
        })
      );
    });

    it('should return no warnings when sections have content', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      // Add content to sections
      handler.handleAddMoment();
      handler.handleUpdateMoment(0, 'title', 'Test Moment');
      handler.handleAddScene();
      handler.handleUpdateScene(0, 'title', 'Test Scene');

      const warnings = handler.getValidationWarnings();

      expect(warnings).not.toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('No aha moments defined'),
        })
      );
      expect(warnings).not.toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('No narrative scenes defined'),
        })
      );
    });
  });

  describe('Edited flags are set correctly', () => {
    it('should set momentsEdited when updating moment', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      handler.handleAddMoment();
      expect(handler.getState().momentsEdited).toBe(false);

      handler.handleUpdateMoment(0, 'title', 'Test Title');
      expect(handler.getState().momentsEdited).toBe(true);
    });

    it('should set personaEdited when updating persona', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      expect(handler.getState().personaEdited).toBe(false);

      handler.handleUpdatePersonaName('Test Name');
      expect(handler.getState().personaEdited).toBe(true);
    });

    it('should set narrativeEdited when updating scene', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      handler.handleAddScene();
      expect(handler.getState().narrativeEdited).toBe(false);

      handler.handleUpdateScene(0, 'title', 'Test Title');
      expect(handler.getState().narrativeEdited).toBe(true);
    });
  });
});
