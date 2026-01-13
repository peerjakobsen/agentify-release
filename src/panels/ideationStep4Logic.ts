/**
 * Step 4: Security & Guardrails Logic
 * Extracted from tabbedPanel.ts for maintainability
 */

import type { OutcomeDefinitionService } from '../services/outcomeDefinitionService';
import type { SystemAssumption, LtmStrategy } from '../types/wizardPanel';
import { INDUSTRY_COMPLIANCE_MAPPING } from './ideationConstants';
import {
  DEFAULT_MEMORY_EXPIRY_DAYS,
  MIN_MEMORY_EXPIRY_DAYS,
  MAX_MEMORY_EXPIRY_DAYS,
  DEFAULT_LTM_RETENTION_DAYS,
  LTM_RETENTION_OPTIONS,
} from '../types/wizardPanel';

/**
 * Security & Guardrails state
 * Cross-Agent Memory Feature: Extended with memory configuration fields
 * Persistent Session Memory Feature: Extended with LTM configuration fields
 * CRITICAL: This interface MUST match SecurityState in src/types/wizardPanel.ts
 */
export interface SecurityGuardrailsState {
  dataSensitivity: string;
  complianceFrameworks: string[];
  approvalGates: string[];
  guardrailNotes: string;
  aiSuggested: boolean;
  aiCalled: boolean;
  skipped: boolean;
  industryDefaultsApplied: boolean;
  isLoading: boolean;
  /** Whether cross-agent memory is enabled for data sharing between agents */
  crossAgentMemoryEnabled: boolean;
  /** Memory expiry in days (1-365), only used when crossAgentMemoryEnabled is true */
  memoryExpiryDays: number;
  /** Whether long-term memory (persistent session memory) is enabled */
  longTermMemoryEnabled: boolean;
  /** LTM retention in days (7, 30, or 90), only used when longTermMemoryEnabled is true */
  ltmRetentionDays: number;
  /** LTM strategy (semantic, summary, or user_preference) */
  ltmStrategy: LtmStrategy;
}

/**
 * Step 1-2 inputs needed for Step 4 context
 */
export interface Step4ContextInputs {
  businessObjective: string;
  industry: string;
  customIndustry?: string;
  systems: string[];
  confirmedAssumptions: SystemAssumption[];
}

/**
 * Callbacks for UI updates
 */
export interface Step4Callbacks {
  updateWebviewContent: () => void;
  syncStateToWebview: () => void;
}

/**
 * Create default Security & Guardrails state
 * Cross-Agent Memory Feature: Includes memory configuration defaults
 * Persistent Session Memory Feature: Includes LTM configuration defaults
 */
export function createDefaultSecurityGuardrailsState(): SecurityGuardrailsState {
  return {
    dataSensitivity: 'Internal',
    complianceFrameworks: [],
    approvalGates: [],
    guardrailNotes: '',
    aiSuggested: false,
    aiCalled: false,
    skipped: false,
    industryDefaultsApplied: false,
    isLoading: false,
    crossAgentMemoryEnabled: true,
    memoryExpiryDays: DEFAULT_MEMORY_EXPIRY_DAYS,
    longTermMemoryEnabled: false,
    ltmRetentionDays: DEFAULT_LTM_RETENTION_DAYS,
    ltmStrategy: 'semantic',
  };
}

/**
 * Validate memory expiry days value is within allowed range
 * Cross-Agent Memory Feature: Validation helper
 */
export function validateMemoryExpiryDays(days: number): number {
  if (typeof days !== 'number' || isNaN(days)) {
    return DEFAULT_MEMORY_EXPIRY_DAYS;
  }
  return Math.max(MIN_MEMORY_EXPIRY_DAYS, Math.min(MAX_MEMORY_EXPIRY_DAYS, Math.round(days)));
}

/**
 * Validate LTM retention days value is one of the allowed values
 * Persistent Session Memory Feature: Validation helper
 */
export function validateLtmRetentionDays(days: number): number {
  if (typeof days !== 'number' || isNaN(days)) {
    return DEFAULT_LTM_RETENTION_DAYS;
  }
  // Must be one of the allowed values: 7, 30, or 90
  const allowedValues = LTM_RETENTION_OPTIONS as readonly number[];
  if (allowedValues.includes(days)) {
    return days;
  }
  // Find closest allowed value
  const sorted = [...allowedValues].sort((a, b) => Math.abs(a - days) - Math.abs(b - days));
  return sorted[0];
}

/**
 * Validate LTM strategy is one of the allowed values
 * Persistent Session Memory Feature: Validation helper
 */
export function validateLtmStrategy(strategy: string): LtmStrategy {
  const validStrategies: LtmStrategy[] = ['semantic', 'summary', 'user_preference'];
  if (validStrategies.includes(strategy as LtmStrategy)) {
    return strategy as LtmStrategy;
  }
  return 'semantic';
}

/**
 * Step 4 Logic Handler
 * Manages security & guardrails configuration
 */
export class Step4LogicHandler {
  private _state: SecurityGuardrailsState;
  private _callbacks: Step4Callbacks;

  constructor(state: SecurityGuardrailsState, callbacks: Step4Callbacks) {
    this._state = state;
    this._callbacks = callbacks;
  }

  /**
   * Update state reference (for when parent state changes)
   */
  public setState(state: SecurityGuardrailsState): void {
    this._state = state;
  }

  /**
   * Get current state
   */
  public getState(): SecurityGuardrailsState {
    return this._state;
  }

  /**
   * Apply industry-aware compliance defaults for Step 4
   */
  public applyIndustryDefaults(industry: string, customIndustry?: string): void {
    // Only apply defaults on first visit or if industry changed
    if (this._state.industryDefaultsApplied) {
      return;
    }

    // Get industry (handle "Other" case)
    const effectiveIndustry = industry === 'Other'
      ? (customIndustry || 'Other')
      : industry;

    // Look up compliance defaults for this industry
    const complianceDefaults = INDUSTRY_COMPLIANCE_MAPPING[effectiveIndustry] || [];

    // Apply defaults
    this._state.complianceFrameworks = [...complianceDefaults];
    this._state.industryDefaultsApplied = true;

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Trigger AI guardrail suggestions for Step 4
   */
  public triggerAutoSend(
    inputs: Step4ContextInputs,
    outcomeService: OutcomeDefinitionService | undefined
  ): void {
    // Only trigger if guardrailNotes is empty AND AI hasn't been called yet
    if (this._state.guardrailNotes === '' && !this._state.aiCalled) {
      this.sendGuardrailSuggestionRequest(inputs, outcomeService);
    }
  }

  /**
   * Send guardrail suggestion request to Claude
   */
  public async sendGuardrailSuggestionRequest(
    inputs: Step4ContextInputs,
    outcomeService: OutcomeDefinitionService | undefined
  ): Promise<void> {
    // Mark AI as called to prevent repeated calls
    this._state.aiCalled = true;
    this._state.isLoading = true;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();

    try {
      // Build context from Steps 1-2
      const context = this.buildGuardrailContextMessage(inputs);

      // Get service
      if (!outcomeService) {
        throw new Error('Service not available');
      }

      // Send request using the conversation service and collect response
      let fullResponse = '';
      for await (const chunk of outcomeService.sendMessage(context)) {
        fullResponse += chunk;
      }

      // Parse response - it's plain text
      if (fullResponse.trim()) {
        this._state.guardrailNotes = fullResponse.trim();
        this._state.aiSuggested = true;
      } else {
        // Use fallback
        this._state.guardrailNotes = 'No PII in demo data, mask account numbers...';
        this._state.aiSuggested = false;
      }
    } catch (error) {
      // Use fallback on error
      this._state.guardrailNotes = 'No PII in demo data, mask account numbers...';
      this._state.aiSuggested = false;
      console.error('Guardrail suggestion error:', error);
    } finally {
      this._state.isLoading = false;
      this._callbacks.updateWebviewContent();
      this._callbacks.syncStateToWebview();
    }
  }

  /**
   * Build context message for guardrail suggestions
   */
  private buildGuardrailContextMessage(inputs: Step4ContextInputs): string {
    const industry = inputs.industry === 'Other'
      ? (inputs.customIndustry || 'Other')
      : inputs.industry;

    const systems = inputs.systems.join(', ') || 'No specific systems';

    const assumptions = inputs.confirmedAssumptions
      .map(a => `${a.system}: ${a.modules?.join(', ') || 'N/A'}`)
      .join('; ') || 'No confirmed assumptions';

    return `Based on the following context, suggest 2-3 brief security guardrail notes for an AI demo:

Business Objective: ${inputs.businessObjective}
Industry: ${industry}
Systems: ${systems}
Integration Details: ${assumptions}

Please provide practical security considerations specific to this demo scenario. Keep suggestions concise (2-3 bullet points). Focus on data handling, privacy concerns, and demo-appropriate safeguards. Do not include extensive explanations - just the key guardrail notes.`;
  }

  /**
   * Reset industry defaults flag (called when industry changes)
   */
  public resetIndustryDefaults(): void {
    this._state.industryDefaultsApplied = false;
  }

  /**
   * Toggle cross-agent memory enabled/disabled
   * Cross-Agent Memory Feature: Handler for memory toggle
   */
  public toggleCrossAgentMemory(enabled: boolean): void {
    this._state.crossAgentMemoryEnabled = enabled;
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Update memory expiry days
   * Cross-Agent Memory Feature: Handler for expiry dropdown
   */
  public updateMemoryExpiryDays(days: number): void {
    this._state.memoryExpiryDays = validateMemoryExpiryDays(days);
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Toggle long-term memory enabled/disabled
   * Persistent Session Memory Feature: Handler for LTM toggle
   * When enabled, automatically enables cross-agent memory (STM) as well
   */
  public toggleLongTermMemory(enabled: boolean): void {
    this._state.longTermMemoryEnabled = enabled;

    // LTM requires STM - auto-enable cross-agent memory when LTM is enabled
    if (enabled && !this._state.crossAgentMemoryEnabled) {
      this._state.crossAgentMemoryEnabled = true;
    }

    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Update LTM retention days
   * Persistent Session Memory Feature: Handler for retention dropdown
   */
  public updateLtmRetentionDays(days: number): void {
    this._state.ltmRetentionDays = validateLtmRetentionDays(days);
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }

  /**
   * Update LTM strategy
   * Persistent Session Memory Feature: Handler for strategy dropdown
   */
  public updateLtmStrategy(strategy: string): void {
    this._state.ltmStrategy = validateLtmStrategy(strategy);
    this._callbacks.updateWebviewContent();
    this._callbacks.syncStateToWebview();
  }
}
