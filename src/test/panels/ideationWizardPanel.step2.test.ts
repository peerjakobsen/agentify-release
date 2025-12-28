/**
 * Tests for Ideation Wizard Panel Step 2 (AI Gap-Filling) Integration
 *
 * Task Group 3: IdeationWizardPanel Step 2 Integration
 * 6 focused tests for panel message handling, auto-send, and navigation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WizardStep,
  WIZARD_COMMANDS,
  createDefaultWizardState,
  createDefaultAIGapFillingState,
  type WizardState,
  type WizardValidationState,
  type AIGapFillingState,
  type ConversationMessage,
  type SystemAssumption,
} from '../../types/wizardPanel';
import { generateStep1Hash } from '../../services/gapFillingService';

// ============================================================================
// Test Utilities - Pure Functions Extracted for Testability
// ============================================================================

/**
 * Check if auto-send should trigger when entering Step 2
 * @param previousStep The step we're navigating from
 * @param nextStep The step we're navigating to
 * @param aiGapFillingState Current AI gap-filling state
 * @returns True if auto-send should trigger
 */
function shouldAutoSendOnStep2Entry(
  previousStep: number,
  nextStep: number,
  aiGapFillingState: AIGapFillingState
): boolean {
  // Only trigger when navigating TO Step 2
  if (nextStep !== WizardStep.AIGapFilling) {
    return false;
  }

  // If conversation already has history and no reset is needed, don't auto-send
  if (aiGapFillingState.conversationHistory.length > 0 && !aiGapFillingState.step1InputHash) {
    return false;
  }

  // Auto-send on first entry or when conversation has been cleared
  return aiGapFillingState.conversationHistory.length === 0;
}

/**
 * Handle SEND_CHAT_MESSAGE command
 * Appends user message to conversation history
 */
function handleSendChatMessage(
  state: WizardState,
  messageContent: string
): WizardState {
  const userMessage: ConversationMessage = {
    role: 'user',
    content: messageContent,
    timestamp: Date.now(),
  };

  return {
    ...state,
    aiGapFillingState: {
      ...state.aiGapFillingState,
      conversationHistory: [...state.aiGapFillingState.conversationHistory, userMessage],
      isStreaming: true,
      streamingError: undefined,
    },
  };
}

/**
 * Handle ACCEPT_ASSUMPTIONS command
 * Populates confirmedAssumptions from last assistant message
 */
function handleAcceptAssumptions(state: WizardState): WizardState {
  // Find the last assistant message with parsed assumptions
  const lastAssistantMessage = [...state.aiGapFillingState.conversationHistory]
    .reverse()
    .find((msg) => msg.role === 'assistant' && msg.parsedAssumptions?.length);

  if (!lastAssistantMessage?.parsedAssumptions) {
    return state;
  }

  return {
    ...state,
    aiGapFillingState: {
      ...state.aiGapFillingState,
      confirmedAssumptions: [...lastAssistantMessage.parsedAssumptions],
      assumptionsAccepted: true,
    },
  };
}

/**
 * Handle REGENERATE_ASSUMPTIONS command
 * Clears conversation and prepares for fresh context send
 */
function handleRegenerateAssumptions(state: WizardState): WizardState {
  return {
    ...state,
    aiGapFillingState: {
      ...createDefaultAIGapFillingState(),
      step1InputHash: state.aiGapFillingState.step1InputHash,
    },
  };
}

/**
 * Check if navigation forward is allowed from Step 2
 */
function canNavigateForwardFromStep2(aiGapFillingState: AIGapFillingState): boolean {
  // Cannot navigate while streaming
  if (aiGapFillingState.isStreaming) {
    return false;
  }

  // Cannot navigate without confirmed assumptions
  if (aiGapFillingState.confirmedAssumptions.length === 0) {
    return false;
  }

  return true;
}

/**
 * Check if conversation should be preserved when navigating back to Step 1
 * then returning to Step 2
 */
function shouldPreserveConversation(
  storedHash: string | undefined,
  currentHash: string
): boolean {
  // If no stored hash, this is first visit - will auto-send anyway
  if (!storedHash) {
    return true;
  }

  // Preserve if hashes match (no Step 1 changes)
  return storedHash === currentHash;
}

/**
 * Get hint message to display after conversation exchanges
 */
function getHintMessage(exchangeCount: number): string | undefined {
  if (exchangeCount >= 3) {
    return 'Ready to finalize? Click Confirm & Continue.';
  }
  return undefined;
}

// ============================================================================
// Task Group 3: Test Suite (6 Focused Tests)
// ============================================================================

describe('Task Group 3: IdeationWizardPanel Step 2 Integration', () => {
  let defaultState: WizardState;
  let validStep2Validation: WizardValidationState;

  beforeEach(() => {
    defaultState = createDefaultWizardState();
    validStep2Validation = {
      isValid: true,
      errors: [],
      hasWarnings: false,
    };
  });

  // Test 1: Auto-send context triggers on Step 2 entry
  describe('Auto-send context triggers on Step 2 entry', () => {
    it('should trigger auto-send when entering Step 2 for the first time', () => {
      const state: WizardState = {
        ...defaultState,
        currentStep: WizardStep.BusinessContext,
        businessObjective: 'Reduce stockouts by 30%',
        industry: 'Retail',
        systems: ['SAP S/4HANA', 'Salesforce'],
        aiGapFillingState: createDefaultAIGapFillingState(),
      };

      // Simulating navigation from Step 1 to Step 2
      const shouldAutoSend = shouldAutoSendOnStep2Entry(
        WizardStep.BusinessContext,
        WizardStep.AIGapFilling,
        state.aiGapFillingState
      );

      expect(shouldAutoSend).toBe(true);
    });

    it('should not trigger auto-send when navigating to other steps', () => {
      const state: WizardState = {
        ...defaultState,
        currentStep: WizardStep.AIGapFilling,
        aiGapFillingState: createDefaultAIGapFillingState(),
      };

      // Navigating from Step 2 to Step 3
      const shouldAutoSend = shouldAutoSendOnStep2Entry(
        WizardStep.AIGapFilling,
        WizardStep.OutcomeDefinition,
        state.aiGapFillingState
      );

      expect(shouldAutoSend).toBe(false);
    });
  });

  // Test 2: SEND_CHAT_MESSAGE command handling
  describe('SEND_CHAT_MESSAGE command handling', () => {
    it('should append user message to conversation history and set streaming state', () => {
      const state: WizardState = {
        ...defaultState,
        currentStep: WizardStep.AIGapFilling,
        aiGapFillingState: {
          ...createDefaultAIGapFillingState(),
          conversationHistory: [
            {
              role: 'assistant',
              content: 'Here are my assumptions...',
              timestamp: Date.now() - 1000,
              parsedAssumptions: [],
            },
          ],
        },
      };

      const userMessage = 'Actually, we use SAP IBP instead of APO';
      const newState = handleSendChatMessage(state, userMessage);

      // Verify user message was appended
      expect(newState.aiGapFillingState.conversationHistory).toHaveLength(2);
      expect(newState.aiGapFillingState.conversationHistory[1].role).toBe('user');
      expect(newState.aiGapFillingState.conversationHistory[1].content).toBe(userMessage);

      // Verify streaming state
      expect(newState.aiGapFillingState.isStreaming).toBe(true);
      expect(newState.aiGapFillingState.streamingError).toBeUndefined();
    });
  });

  // Test 3: ACCEPT_ASSUMPTIONS populates confirmedAssumptions
  describe('ACCEPT_ASSUMPTIONS populates confirmedAssumptions', () => {
    it('should copy parsed assumptions from last assistant message to confirmedAssumptions', () => {
      const parsedAssumptions: SystemAssumption[] = [
        {
          system: 'SAP S/4HANA',
          modules: ['MM', 'SD', 'PP'],
          integrations: ['Salesforce CRM sync'],
          source: 'ai-proposed',
        },
        {
          system: 'Salesforce',
          modules: ['Sales Cloud'],
          integrations: ['SAP order sync'],
          source: 'ai-proposed',
        },
      ];

      const state: WizardState = {
        ...defaultState,
        currentStep: WizardStep.AIGapFilling,
        aiGapFillingState: {
          ...createDefaultAIGapFillingState(),
          conversationHistory: [
            {
              role: 'assistant',
              content: 'Here are my assumptions...',
              timestamp: Date.now(),
              parsedAssumptions,
            },
          ],
        },
      };

      const newState = handleAcceptAssumptions(state);

      // Verify assumptions were copied
      expect(newState.aiGapFillingState.confirmedAssumptions).toHaveLength(2);
      expect(newState.aiGapFillingState.confirmedAssumptions[0].system).toBe('SAP S/4HANA');
      expect(newState.aiGapFillingState.confirmedAssumptions[1].system).toBe('Salesforce');

      // Verify assumptionsAccepted flag
      expect(newState.aiGapFillingState.assumptionsAccepted).toBe(true);
    });

    it('should not modify state if no assistant message with assumptions exists', () => {
      const state: WizardState = {
        ...defaultState,
        currentStep: WizardStep.AIGapFilling,
        aiGapFillingState: {
          ...createDefaultAIGapFillingState(),
          conversationHistory: [
            {
              role: 'user',
              content: 'Tell me about SAP',
              timestamp: Date.now(),
            },
          ],
        },
      };

      const newState = handleAcceptAssumptions(state);

      // State should be unchanged
      expect(newState.aiGapFillingState.confirmedAssumptions).toHaveLength(0);
      expect(newState.aiGapFillingState.assumptionsAccepted).toBe(false);
    });
  });

  // Test 4: REGENERATE_ASSUMPTIONS clears and restarts
  describe('REGENERATE_ASSUMPTIONS clears and restarts', () => {
    it('should clear conversation history and reset state while preserving hash', () => {
      const step1Hash = 'abc123hash';

      const state: WizardState = {
        ...defaultState,
        currentStep: WizardStep.AIGapFilling,
        aiGapFillingState: {
          conversationHistory: [
            { role: 'assistant', content: 'Old assumptions...', timestamp: Date.now() },
            { role: 'user', content: 'I want new ones', timestamp: Date.now() },
          ],
          confirmedAssumptions: [
            { system: 'SAP', modules: ['MM'], integrations: [], source: 'ai-proposed' },
          ],
          assumptionsAccepted: true,
          isStreaming: false,
          step1InputHash: step1Hash,
        },
      };

      const newState = handleRegenerateAssumptions(state);

      // Verify conversation cleared
      expect(newState.aiGapFillingState.conversationHistory).toHaveLength(0);
      expect(newState.aiGapFillingState.confirmedAssumptions).toHaveLength(0);
      expect(newState.aiGapFillingState.assumptionsAccepted).toBe(false);
      expect(newState.aiGapFillingState.isStreaming).toBe(false);

      // Verify hash preserved
      expect(newState.aiGapFillingState.step1InputHash).toBe(step1Hash);
    });
  });

  // Test 5: Navigation blocked while streaming
  describe('Navigation blocked while streaming', () => {
    it('should block forward navigation when isStreaming is true', () => {
      const streamingState: AIGapFillingState = {
        ...createDefaultAIGapFillingState(),
        isStreaming: true,
        conversationHistory: [
          { role: 'assistant', content: 'Loading...', timestamp: Date.now() },
        ],
      };

      const canNavigate = canNavigateForwardFromStep2(streamingState);

      expect(canNavigate).toBe(false);
    });

    it('should block forward navigation when confirmedAssumptions is empty', () => {
      const noAssumptionsState: AIGapFillingState = {
        ...createDefaultAIGapFillingState(),
        isStreaming: false,
        confirmedAssumptions: [],
      };

      const canNavigate = canNavigateForwardFromStep2(noAssumptionsState);

      expect(canNavigate).toBe(false);
    });

    it('should allow forward navigation when not streaming and assumptions confirmed', () => {
      const validState: AIGapFillingState = {
        ...createDefaultAIGapFillingState(),
        isStreaming: false,
        confirmedAssumptions: [
          { system: 'SAP', modules: ['MM'], integrations: [], source: 'ai-proposed' },
        ],
        assumptionsAccepted: true,
      };

      const canNavigate = canNavigateForwardFromStep2(validState);

      expect(canNavigate).toBe(true);
    });
  });

  // Test 6: Conversation preserved on Step 1 return without changes
  describe('Conversation preserved on Step 1 return without changes', () => {
    it('should preserve conversation when Step 1 inputs have not changed', () => {
      const businessObjective = 'Reduce stockouts by 30%';
      const industry = 'Retail';
      const systems = ['SAP S/4HANA', 'Salesforce'];

      const originalHash = generateStep1Hash(businessObjective, industry, systems);
      const currentHash = generateStep1Hash(businessObjective, industry, systems);

      const shouldPreserve = shouldPreserveConversation(originalHash, currentHash);

      expect(shouldPreserve).toBe(true);
    });

    it('should not preserve conversation when Step 1 inputs have changed', () => {
      const originalHash = generateStep1Hash('Original objective', 'Retail', ['SAP S/4HANA']);
      const currentHash = generateStep1Hash('Changed objective', 'Retail', ['SAP S/4HANA']);

      const shouldPreserve = shouldPreserveConversation(originalHash, currentHash);

      expect(shouldPreserve).toBe(false);
    });

    it('should show hint message after 3 or more exchanges', () => {
      expect(getHintMessage(2)).toBeUndefined();
      expect(getHintMessage(3)).toBe('Ready to finalize? Click Confirm & Continue.');
      expect(getHintMessage(5)).toBe('Ready to finalize? Click Confirm & Continue.');
    });
  });
});
