/**
 * Tests for Step 7 Demo Strategy - Type Definitions and State Structure
 * Task Group 1: Type definitions for Step 7 Demo Strategy feature
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultDemoStrategyState,
  createDefaultWizardState,
  wizardStateToPersistedState,
  persistedStateToWizardState,
  WIZARD_COMMANDS,
  type AhaMoment,
  type DemoPersona,
  type NarrativeScene,
  type DemoStrategyState,
  type WizardState,
  type PersistedWizardState,
} from '../../types/wizardPanel';

// ============================================================================
// Task 1.1: 4 Focused Tests for Type Definitions
// ============================================================================

describe('Task Group 1: Step 7 Demo Strategy - Type Definitions and State Structure', () => {
  describe('Test 1: createDefaultDemoStrategyState() returns correct structure', () => {
    it('should initialize DemoStrategyState with correct defaults', () => {
      const state = createDefaultDemoStrategyState();

      // Verify ahaMoments is empty array
      expect(state.ahaMoments).toEqual([]);

      // Verify persona has empty fields
      expect(state.persona).toEqual({
        name: '',
        role: '',
        painPoint: '',
      });

      // Verify narrativeScenes is empty array
      expect(state.narrativeScenes).toEqual([]);

      // Verify all loading flags are false
      expect(state.isGeneratingMoments).toBe(false);
      expect(state.isGeneratingPersona).toBe(false);
      expect(state.isGeneratingNarrative).toBe(false);

      // Verify all edited flags are false
      expect(state.momentsEdited).toBe(false);
      expect(state.personaEdited).toBe(false);
      expect(state.narrativeEdited).toBe(false);
    });
  });

  describe('Test 2: DemoStrategyState sub-interfaces structure validation', () => {
    it('should support AhaMoment interface with all required fields', () => {
      const moment: AhaMoment = {
        id: 'moment-1',
        title: 'Real-time SAP inventory sync',
        triggerType: 'tool',
        triggerName: 'sap_get_inventory',
        talkingPoint: 'Watch how the agent instantly pulls live inventory data from SAP.',
      };

      expect(moment.id).toBe('moment-1');
      expect(moment.title).toBe('Real-time SAP inventory sync');
      expect(moment.triggerType).toBe('tool');
      expect(moment.triggerName).toBe('sap_get_inventory');
      expect(moment.talkingPoint).toContain('inventory');
    });

    it('should support DemoPersona interface with all required fields', () => {
      const persona: DemoPersona = {
        name: 'Maria, Regional Inventory Manager',
        role: 'Reviews morning replenishment recommendations for 12 stores',
        painPoint: 'Currently spends 2 hours manually checking stock levels',
      };

      expect(persona.name).toBe('Maria, Regional Inventory Manager');
      expect(persona.role).toContain('replenishment');
      expect(persona.painPoint).toContain('2 hours');
    });

    it('should support NarrativeScene interface with all required fields', () => {
      const scene: NarrativeScene = {
        id: 'scene-1',
        title: 'Morning Check-In',
        description: 'Maria opens her dashboard and asks the agent for overnight alerts.',
        highlightedAgents: ['orchestrator', 'inventory-agent'],
      };

      expect(scene.id).toBe('scene-1');
      expect(scene.title).toBe('Morning Check-In');
      expect(scene.description.length).toBeLessThanOrEqual(500);
      expect(scene.highlightedAgents).toHaveLength(2);
      expect(scene.highlightedAgents).toContain('orchestrator');
    });
  });

  describe('Test 3: State conversion functions handle Step 7 state correctly', () => {
    it('should persist and restore DemoStrategyState through conversion', () => {
      // Create a populated wizard state with demo strategy data
      const wizardState = createDefaultWizardState();
      wizardState.demoStrategy = {
        ahaMoments: [
          {
            id: 'moment-1',
            title: 'Test Moment',
            triggerType: 'agent',
            triggerName: 'Orchestrator',
            talkingPoint: 'This is the key moment',
          },
        ],
        persona: {
          name: 'Test User',
          role: 'Test Role',
          painPoint: 'Test Pain Point',
        },
        narrativeScenes: [
          {
            id: 'scene-1',
            title: 'Scene 1',
            description: 'First scene description',
            highlightedAgents: ['orchestrator'],
          },
        ],
        isGeneratingMoments: false,
        isGeneratingPersona: false,
        isGeneratingNarrative: false,
        momentsEdited: true,
        personaEdited: true,
        narrativeEdited: false,
      };

      // Convert to persisted state
      const persisted = wizardStateToPersistedState(wizardState);

      // Verify demoStrategy is included in persisted state
      expect(persisted.demoStrategy).toBeDefined();
      expect(persisted.demoStrategy.ahaMoments).toHaveLength(1);
      expect(persisted.demoStrategy.ahaMoments[0].title).toBe('Test Moment');
      expect(persisted.demoStrategy.persona.name).toBe('Test User');
      expect(persisted.demoStrategy.narrativeScenes).toHaveLength(1);

      // Convert back to wizard state
      const restored = persistedStateToWizardState(persisted);

      // Verify demoStrategy is restored correctly
      expect(restored.demoStrategy).toBeDefined();
      expect(restored.demoStrategy.ahaMoments).toHaveLength(1);
      expect(restored.demoStrategy.ahaMoments[0].id).toBe('moment-1');
      expect(restored.demoStrategy.persona.name).toBe('Test User');
      expect(restored.demoStrategy.momentsEdited).toBe(true);
      expect(restored.demoStrategy.personaEdited).toBe(true);
      expect(restored.demoStrategy.narrativeEdited).toBe(false);
    });

    it('should include demoStrategy in default WizardState', () => {
      const state = createDefaultWizardState();

      expect(state.demoStrategy).toBeDefined();
      expect(state.demoStrategy.ahaMoments).toEqual([]);
      expect(state.demoStrategy.persona.name).toBe('');
      expect(state.demoStrategy.narrativeScenes).toEqual([]);
    });
  });

  describe('Test 4: Step 7 wizard commands are properly typed', () => {
    it('should define all Step 7 wizard commands with correct values', () => {
      // Aha Moments commands
      expect(WIZARD_COMMANDS.STEP7_ADD_MOMENT).toBe('step7AddMoment');
      expect(WIZARD_COMMANDS.STEP7_UPDATE_MOMENT).toBe('step7UpdateMoment');
      expect(WIZARD_COMMANDS.STEP7_REMOVE_MOMENT).toBe('step7RemoveMoment');

      // Demo Persona commands
      expect(WIZARD_COMMANDS.STEP7_UPDATE_PERSONA_NAME).toBe('step7UpdatePersonaName');
      expect(WIZARD_COMMANDS.STEP7_UPDATE_PERSONA_ROLE).toBe('step7UpdatePersonaRole');
      expect(WIZARD_COMMANDS.STEP7_UPDATE_PERSONA_PAIN_POINT).toBe('step7UpdatePersonaPainPoint');

      // Narrative Flow commands
      expect(WIZARD_COMMANDS.STEP7_ADD_SCENE).toBe('step7AddScene');
      expect(WIZARD_COMMANDS.STEP7_UPDATE_SCENE).toBe('step7UpdateScene');
      expect(WIZARD_COMMANDS.STEP7_REMOVE_SCENE).toBe('step7RemoveScene');
      expect(WIZARD_COMMANDS.STEP7_MOVE_SCENE_UP).toBe('step7MoveSceneUp');
      expect(WIZARD_COMMANDS.STEP7_MOVE_SCENE_DOWN).toBe('step7MoveSceneDown');

      // AI Generation commands
      expect(WIZARD_COMMANDS.STEP7_GENERATE_MOMENTS).toBe('step7GenerateMoments');
      expect(WIZARD_COMMANDS.STEP7_GENERATE_PERSONA).toBe('step7GeneratePersona');
      expect(WIZARD_COMMANDS.STEP7_GENERATE_NARRATIVE).toBe('step7GenerateNarrative');
      expect(WIZARD_COMMANDS.STEP7_GENERATE_ALL).toBe('step7GenerateAll');
    });

    it('should follow step7 naming convention for all commands', () => {
      const step7Commands = [
        WIZARD_COMMANDS.STEP7_ADD_MOMENT,
        WIZARD_COMMANDS.STEP7_UPDATE_MOMENT,
        WIZARD_COMMANDS.STEP7_REMOVE_MOMENT,
        WIZARD_COMMANDS.STEP7_UPDATE_PERSONA_NAME,
        WIZARD_COMMANDS.STEP7_UPDATE_PERSONA_ROLE,
        WIZARD_COMMANDS.STEP7_UPDATE_PERSONA_PAIN_POINT,
        WIZARD_COMMANDS.STEP7_ADD_SCENE,
        WIZARD_COMMANDS.STEP7_UPDATE_SCENE,
        WIZARD_COMMANDS.STEP7_REMOVE_SCENE,
        WIZARD_COMMANDS.STEP7_MOVE_SCENE_UP,
        WIZARD_COMMANDS.STEP7_MOVE_SCENE_DOWN,
        WIZARD_COMMANDS.STEP7_GENERATE_MOMENTS,
        WIZARD_COMMANDS.STEP7_GENERATE_PERSONA,
        WIZARD_COMMANDS.STEP7_GENERATE_NARRATIVE,
        WIZARD_COMMANDS.STEP7_GENERATE_ALL,
      ];

      step7Commands.forEach((command) => {
        expect(command).toMatch(/^step7[A-Z][a-zA-Z0-9]+$/);
      });
    });
  });
});
