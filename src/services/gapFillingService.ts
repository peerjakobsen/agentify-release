/**
 * Gap-Filling Service
 *
 * Provides utility functions for the AI gap-filling conversation in Step 2 of the
 * Ideation Wizard. Handles context message building, JSON assumption parsing from
 * Claude responses, and Step 1 change detection.
 *
 * This service provides stateless utility functions that can be used alongside the
 * BedrockConversationService for actual Claude communication.
 */

import * as vscode from 'vscode';
import type { SystemAssumption } from '../types/wizardPanel';

// ============================================================================
// Constants
// ============================================================================

/**
 * Path to the gap-filling assistant prompt relative to extension root
 */
const GAP_FILLING_PROMPT_PATH = 'resources/prompts/gap-filling-assistant.md';

// ============================================================================
// Context Message Building
// ============================================================================

/**
 * Build a context message from Step 1 inputs to send to Claude
 * Formats the business objective, industry, and systems into a structured prompt
 *
 * @param businessObjective The user's business objective/problem statement
 * @param industry The selected industry vertical
 * @param systems Array of selected system names
 * @param customSystems Optional comma-separated string of additional systems
 * @returns Formatted context message string
 */
export function buildContextMessage(
  businessObjective: string,
  industry: string,
  systems: string[],
  customSystems?: string
): string {
  // Combine selected systems with custom systems
  const allSystems = [...systems];

  // Parse custom systems (comma-separated) and add to the list
  if (customSystems && customSystems.trim()) {
    const customList = customSystems
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    allSystems.push(...customList);
  }

  const systemsList =
    allSystems.length > 0
      ? allSystems.join(', ')
      : 'No specific systems specified';

  return `User's business objective: ${businessObjective}

Industry: ${industry}

Known systems: ${systemsList}

Based on this context, please analyze the typical enterprise architecture and propose assumptions about the system modules and integrations that would be relevant for achieving this business objective.`;
}

// ============================================================================
// JSON Assumption Parsing
// ============================================================================

/**
 * Parse assumptions from a Claude response that contains embedded JSON
 * Extracts the JSON block between markdown code fences and parses the assumptions array
 *
 * @param response The full Claude response text (may include prose and JSON)
 * @returns Array of SystemAssumption objects, or empty array if parsing fails
 */
export function parseAssumptionsFromResponse(response: string): SystemAssumption[] {
  try {
    // Find all JSON blocks in the response using exec loop
    const matches: RegExpExecArray[] = [];
    let match: RegExpExecArray | null;

    // Reset regex lastIndex and use exec loop for compatibility
    const regex = /```json\s*([\s\S]*?)```/g;
    while ((match = regex.exec(response)) !== null) {
      matches.push(match);
    }

    if (matches.length === 0) {
      return [];
    }

    // Try each JSON block until we find one with valid assumptions
    for (const m of matches) {
      const jsonString = m[1].trim();

      try {
        const parsed = JSON.parse(jsonString);

        // Check if this JSON has an assumptions array
        if (parsed && Array.isArray(parsed.assumptions)) {
          return validateAndTransformAssumptions(parsed.assumptions);
        }
      } catch {
        // This JSON block didn't parse or doesn't have assumptions, try next one
        continue;
      }
    }

    // No valid assumptions found in any JSON block
    return [];
  } catch {
    // Any unexpected error - return empty array
    return [];
  }
}

/**
 * Validate and transform raw assumption objects into typed SystemAssumption array
 * Ensures all required fields exist and adds the source field
 *
 * @param rawAssumptions Array of raw assumption objects from JSON
 * @returns Array of validated SystemAssumption objects
 */
function validateAndTransformAssumptions(
  rawAssumptions: unknown[]
): SystemAssumption[] {
  const validAssumptions: SystemAssumption[] = [];

  for (const raw of rawAssumptions) {
    if (!isValidRawAssumption(raw)) {
      continue;
    }

    validAssumptions.push({
      system: raw.system,
      modules: Array.isArray(raw.modules) ? raw.modules : [],
      integrations: Array.isArray(raw.integrations) ? raw.integrations : [],
      source: 'ai-proposed',
    });
  }

  return validAssumptions;
}

/**
 * Type guard to check if a raw object has the required assumption fields
 *
 * @param obj Unknown object to validate
 * @returns True if object has required assumption structure
 */
function isValidRawAssumption(
  obj: unknown
): obj is { system: string; modules?: string[]; integrations?: string[] } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'system' in obj &&
    typeof (obj as { system: unknown }).system === 'string'
  );
}

// ============================================================================
// Step 1 Change Detection
// ============================================================================

/**
 * Generate a hash of Step 1 inputs for change detection
 * Used to determine if the user has modified inputs that require conversation reset
 *
 * @param businessObjective The business objective text
 * @param industry The selected industry
 * @param systems Array of selected systems
 * @param customSystems Optional comma-separated string of additional systems
 * @returns A hash string representing the combined inputs
 */
export function generateStep1Hash(
  businessObjective: string,
  industry: string,
  systems: string[],
  customSystems?: string
): string {
  // Create a deterministic string from all inputs
  // Sort systems to ensure consistent hash regardless of selection order
  const sortedSystems = [...systems].sort();
  const combined = JSON.stringify({
    businessObjective: businessObjective.trim(),
    industry: industry.trim(),
    systems: sortedSystems,
    customSystems: (customSystems || '').trim(),
  });

  // Use a simple hash function (djb2 variant)
  // For production, consider using crypto.subtle.digest
  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 33) ^ combined.charCodeAt(i);
  }

  // Convert to unsigned 32-bit integer and then to hex string
  return (hash >>> 0).toString(16);
}

/**
 * Check if Step 1 inputs have changed compared to a stored hash
 * Used to determine if conversation state should be reset
 *
 * @param storedHash The previously stored hash (or undefined if none)
 * @param businessObjective Current business objective
 * @param industry Current industry selection
 * @param systems Current systems array
 * @param customSystems Optional comma-separated string of additional systems
 * @returns True if inputs have changed (reset needed), false if unchanged
 */
export function hasStep1Changed(
  storedHash: string | undefined,
  businessObjective: string,
  industry: string,
  systems: string[],
  customSystems?: string
): boolean {
  // If no stored hash, this is the first visit - no change detected
  if (!storedHash) {
    return false;
  }

  const currentHash = generateStep1Hash(businessObjective, industry, systems, customSystems);
  return currentHash !== storedHash;
}

// ============================================================================
// GapFillingService Class
// ============================================================================

/**
 * Service class for gap-filling conversation functionality
 * Provides instance methods that wrap the utility functions and can
 * load the system prompt from the extension resources
 */
export class GapFillingService implements vscode.Disposable {
  /** Extension URI for resource loading */
  private readonly _extensionUri: vscode.Uri;

  /** Cached system prompt */
  private _systemPrompt: string | null = null;

  /**
   * Creates a new GapFillingService
   * @param extensionUri The extension URI for loading resources
   */
  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  /**
   * Load the gap-filling system prompt from resources
   * Caches the prompt after first load
   *
   * @returns The system prompt content
   */
  public async loadSystemPrompt(): Promise<string> {
    if (this._systemPrompt !== null) {
      return this._systemPrompt;
    }

    const promptUri = vscode.Uri.joinPath(
      this._extensionUri,
      ...GAP_FILLING_PROMPT_PATH.split('/')
    );

    const content = await vscode.workspace.fs.readFile(promptUri);
    this._systemPrompt = Buffer.from(content).toString('utf-8');

    return this._systemPrompt;
  }

  /**
   * Build context message from Step 1 inputs
   * Instance method wrapper for the utility function
   */
  public buildContextMessage(
    businessObjective: string,
    industry: string,
    systems: string[],
    customSystems?: string
  ): string {
    return buildContextMessage(businessObjective, industry, systems, customSystems);
  }

  /**
   * Parse assumptions from Claude response
   * Instance method wrapper for the utility function
   */
  public parseAssumptionsFromResponse(response: string): SystemAssumption[] {
    return parseAssumptionsFromResponse(response);
  }

  /**
   * Generate hash for Step 1 inputs
   * Instance method wrapper for the utility function
   */
  public generateStep1Hash(
    businessObjective: string,
    industry: string,
    systems: string[],
    customSystems?: string
  ): string {
    return generateStep1Hash(businessObjective, industry, systems, customSystems);
  }

  /**
   * Check if Step 1 inputs have changed
   * Instance method wrapper for the utility function
   */
  public hasStep1Changed(
    storedHash: string | undefined,
    businessObjective: string,
    industry: string,
    systems: string[],
    customSystems?: string
  ): boolean {
    return hasStep1Changed(storedHash, businessObjective, industry, systems, customSystems);
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this._systemPrompt = null;
  }
}

// ============================================================================
// Singleton Pattern
// ============================================================================

/**
 * Singleton instance of the service
 */
let instance: GapFillingService | null = null;

/**
 * Get the singleton GapFillingService instance
 *
 * @param context The VS Code extension context (required for first call)
 * @returns The GapFillingService singleton
 */
export function getGapFillingService(
  context: vscode.ExtensionContext
): GapFillingService {
  if (!instance) {
    instance = new GapFillingService(context.extensionUri);
  }
  return instance;
}

/**
 * Reset the singleton instance
 * Useful for testing or cleanup
 */
export function resetGapFillingService(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
