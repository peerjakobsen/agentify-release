/**
 * Integration Tests for Step 7 Demo Strategy - Gap Analysis
 * Task Group 5: Strategic tests to fill critical coverage gaps
 *
 * These tests focus on:
 * - End-to-end workflows
 * - Sequential execution verification
 * - Array reindexing after removal
 * - Complete field update workflows
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
// Task 5.3: Up to 8 Strategic Integration Tests
// ============================================================================

describe('Task Group 5: Step 7 Demo Strategy - Integration Tests', () => {
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

  // -------------------------------------------------------------------------
  // Test 1: Integration - Add moment, update all fields, verify complete state
  // -------------------------------------------------------------------------
  describe('Integration: Full moment creation workflow', () => {
    it('should create moment, update all fields, and maintain complete state', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      // Add a new moment
      handler.handleAddMoment();
      expect(handler.getState().ahaMoments).toHaveLength(1);

      const momentId = handler.getState().ahaMoments[0].id;
      expect(momentId).toBeTruthy();

      // Update title
      handler.handleUpdateMoment(0, 'title', 'Real-time SAP inventory sync');
      expect(handler.getState().ahaMoments[0].title).toBe('Real-time SAP inventory sync');

      // Update trigger type and name
      handler.handleUpdateMoment(0, 'triggerType', 'tool');
      handler.handleUpdateMoment(0, 'triggerName', 'sap_get_inventory');
      expect(handler.getState().ahaMoments[0].triggerType).toBe('tool');
      expect(handler.getState().ahaMoments[0].triggerName).toBe('sap_get_inventory');

      // Update talking point
      handler.handleUpdateMoment(0, 'talkingPoint', 'Watch the agent pull live inventory data');
      expect(handler.getState().ahaMoments[0].talkingPoint).toBe(
        'Watch the agent pull live inventory data'
      );

      // Verify ID persisted through updates
      expect(handler.getState().ahaMoments[0].id).toBe(momentId);

      // Verify edited flag was set
      expect(handler.getState().momentsEdited).toBe(true);

      // Verify callbacks were triggered for UI updates
      expect(callbacks.updateWebviewContent.mock.calls.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Test 2: Integration - Scene reordering sequence with multiple moves
  // -------------------------------------------------------------------------
  describe('Integration: Scene reordering maintains correct indices', () => {
    it('should correctly update indices after multiple reorder operations', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      // Create 4 scenes
      handler.handleAddScene();
      handler.handleAddScene();
      handler.handleAddScene();
      handler.handleAddScene();

      // Label them for tracking
      handler.handleUpdateScene(0, 'title', 'Scene A');
      handler.handleUpdateScene(1, 'title', 'Scene B');
      handler.handleUpdateScene(2, 'title', 'Scene C');
      handler.handleUpdateScene(3, 'title', 'Scene D');

      // Initial order: A, B, C, D
      expect(handler.getState().narrativeScenes.map((s) => s.title)).toEqual([
        'Scene A',
        'Scene B',
        'Scene C',
        'Scene D',
      ]);

      // Move D up twice (index 3 -> 2 -> 1)
      handler.handleMoveSceneUp(3);
      handler.handleMoveSceneUp(2);

      // Order should now be: A, D, B, C
      expect(handler.getState().narrativeScenes.map((s) => s.title)).toEqual([
        'Scene A',
        'Scene D',
        'Scene B',
        'Scene C',
      ]);

      // Move A down twice (index 0 -> 1 -> 2)
      handler.handleMoveSceneDown(0);
      handler.handleMoveSceneDown(1);

      // Order should now be: D, B, A, C
      expect(handler.getState().narrativeScenes.map((s) => s.title)).toEqual([
        'Scene D',
        'Scene B',
        'Scene A',
        'Scene C',
      ]);

      // Verify IDs are still unique
      const ids = handler.getState().narrativeScenes.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // Test 3: Integration - Generate All executes in sequential order
  // -------------------------------------------------------------------------
  describe('Integration: Generate All triggers sections sequentially', () => {
    it('should call generate methods in moments -> persona -> narrative order', async () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      const callOrder: string[] = [];

      // Spy on individual generate methods to track call order
      vi.spyOn(handler, 'handleGenerateMoments').mockImplementation(async () => {
        callOrder.push('moments');
      });
      vi.spyOn(handler, 'handleGeneratePersona').mockImplementation(async () => {
        callOrder.push('persona');
      });
      vi.spyOn(handler, 'handleGenerateNarrative').mockImplementation(async () => {
        callOrder.push('narrative');
      });

      const inputs = {
        industry: 'Retail',
        businessObjective: 'Improve inventory management',
        confirmedAgents: [],
        outcomeDefinition: 'Reduce stockouts by 50%',
        confirmedEdges: [],
      };

      await handler.handleGenerateAll(inputs);

      // Verify sequential order
      expect(callOrder).toEqual(['moments', 'persona', 'narrative']);
    });
  });

  // -------------------------------------------------------------------------
  // Test 4: Edge case - Remove moment when at max 5 limit
  // -------------------------------------------------------------------------
  describe('Edge case: Remove moment at max limit enables adding', () => {
    it('should allow adding moment after removing one at max limit', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      // Fill to max (5 moments)
      for (let i = 0; i < 5; i++) {
        handler.handleAddMoment();
        handler.handleUpdateMoment(i, 'title', `Moment ${i + 1}`);
      }
      expect(handler.getState().ahaMoments).toHaveLength(5);

      // Verify cannot add more
      expect(handler.handleAddMoment()).toBe(false);

      // Remove one moment (index 2)
      handler.handleRemoveMoment(2);
      expect(handler.getState().ahaMoments).toHaveLength(4);

      // Verify remaining moments
      expect(handler.getState().ahaMoments.map((m) => m.title)).toEqual([
        'Moment 1',
        'Moment 2',
        'Moment 4',
        'Moment 5',
      ]);

      // Now adding should work again
      expect(handler.handleAddMoment()).toBe(true);
      expect(handler.getState().ahaMoments).toHaveLength(5);
    });
  });

  // -------------------------------------------------------------------------
  // Test 5: Edge case - Move first scene up (no-op verification)
  // -------------------------------------------------------------------------
  describe('Edge case: Move first scene up is no-op', () => {
    it('should not change state when moving first scene up', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      handler.handleAddScene();
      handler.handleAddScene();
      handler.handleUpdateScene(0, 'title', 'First');
      handler.handleUpdateScene(1, 'title', 'Second');

      const initialIds = handler.getState().narrativeScenes.map((s) => s.id);

      // Attempt to move first scene up (should be no-op)
      handler.handleMoveSceneUp(0);

      // Verify order unchanged
      expect(handler.getState().narrativeScenes.map((s) => s.title)).toEqual([
        'First',
        'Second',
      ]);

      // Verify IDs unchanged
      expect(handler.getState().narrativeScenes.map((s) => s.id)).toEqual(initialIds);
    });
  });

  // -------------------------------------------------------------------------
  // Test 6: Edge case - Move last scene down (no-op verification)
  // -------------------------------------------------------------------------
  describe('Edge case: Move last scene down is no-op', () => {
    it('should not change state when moving last scene down', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      handler.handleAddScene();
      handler.handleAddScene();
      handler.handleAddScene();
      handler.handleUpdateScene(0, 'title', 'First');
      handler.handleUpdateScene(1, 'title', 'Middle');
      handler.handleUpdateScene(2, 'title', 'Last');

      const initialIds = handler.getState().narrativeScenes.map((s) => s.id);

      // Attempt to move last scene down (should be no-op)
      handler.handleMoveSceneDown(2);

      // Verify order unchanged
      expect(handler.getState().narrativeScenes.map((s) => s.title)).toEqual([
        'First',
        'Middle',
        'Last',
      ]);

      // Verify IDs unchanged
      expect(handler.getState().narrativeScenes.map((s) => s.id)).toEqual(initialIds);
    });
  });

  // -------------------------------------------------------------------------
  // Test 7: Integration - Complete persona update workflow
  // -------------------------------------------------------------------------
  describe('Integration: Persona update workflow', () => {
    it('should update all persona fields and track edited state', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      // Initial state - empty persona, not edited
      expect(handler.getState().persona.name).toBe('');
      expect(handler.getState().persona.role).toBe('');
      expect(handler.getState().persona.painPoint).toBe('');
      expect(handler.getState().personaEdited).toBe(false);

      // Update name
      handler.handleUpdatePersonaName('Maria Chen');
      expect(handler.getState().persona.name).toBe('Maria Chen');
      expect(handler.getState().personaEdited).toBe(true);

      // Update role
      handler.handleUpdatePersonaRole('Regional Inventory Manager');
      expect(handler.getState().persona.role).toBe('Regional Inventory Manager');

      // Update pain point
      handler.handleUpdatePersonaPainPoint(
        'Spends 3 hours daily checking stock levels across 12 stores'
      );
      expect(handler.getState().persona.painPoint).toBe(
        'Spends 3 hours daily checking stock levels across 12 stores'
      );

      // Verify complete persona state
      expect(handler.getState().persona).toEqual({
        name: 'Maria Chen',
        role: 'Regional Inventory Manager',
        painPoint: 'Spends 3 hours daily checking stock levels across 12 stores',
      });
    });
  });

  // -------------------------------------------------------------------------
  // Test 8: Integration - Remove scene and verify reindexing
  // -------------------------------------------------------------------------
  describe('Integration: Remove scene maintains array integrity', () => {
    it('should correctly reindex scenes after removal', () => {
      const handler = new Step7LogicHandler(undefined, state, callbacks);

      // Create 5 scenes
      for (let i = 0; i < 5; i++) {
        handler.handleAddScene();
        handler.handleUpdateScene(i, 'title', `Scene ${i + 1}`);
        handler.handleUpdateScene(i, 'description', `Description for scene ${i + 1}`);
      }

      // Store IDs for verification
      const originalIds = handler.getState().narrativeScenes.map((s) => s.id);
      expect(originalIds).toHaveLength(5);

      // Remove middle scene (index 2 - 'Scene 3')
      handler.handleRemoveMoment;
      handler.handleRemoveScene(2);

      // Verify 4 scenes remain
      expect(handler.getState().narrativeScenes).toHaveLength(4);

      // Verify correct scenes remain in order
      expect(handler.getState().narrativeScenes.map((s) => s.title)).toEqual([
        'Scene 1',
        'Scene 2',
        'Scene 4',
        'Scene 5',
      ]);

      // Verify IDs match (excluding removed)
      const remainingIds = handler.getState().narrativeScenes.map((s) => s.id);
      expect(remainingIds).toEqual([
        originalIds[0],
        originalIds[1],
        originalIds[3],
        originalIds[4],
      ]);

      // Verify can update by new indices
      handler.handleUpdateScene(2, 'title', 'Updated Scene 4');
      expect(handler.getState().narrativeScenes[2].title).toBe('Updated Scene 4');

      // Verify narrativeEdited flag
      expect(handler.getState().narrativeEdited).toBe(true);
    });
  });
});
