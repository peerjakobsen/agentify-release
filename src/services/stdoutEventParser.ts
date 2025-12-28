/**
 * Stdout Event Parser Service
 *
 * Parses JSON events from workflow subprocess stdout stream.
 * Converts raw stdout data into typed MergedEvent objects and emits them
 * via vscode.EventEmitter pattern for subscribers to consume.
 *
 * Usage:
 *   const parser = getStdoutEventParser();
 *   parser.onEvent((mergedEvent) => handleEvent(mergedEvent));
 *   parser.onParseError((error) => handleError(error));
 */

import * as vscode from 'vscode';
import type {
  MergedEvent,
  StdoutEvent,
  AgentifyEvent,
} from '../types/events';
import { getWorkflowTriggerService } from './workflowTriggerService';

// ============================================================================
// EventDeduplicator Class
// ============================================================================

/**
 * Tracks seen event IDs for deduplication
 */
export class EventDeduplicator {
  private seenEventIds: Set<string> = new Set();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Checks if an event has been seen before and marks it as seen
   * Returns true if this is a duplicate, false if it's new
   */
  isDuplicate(eventId: string | undefined): boolean {
    if (!eventId) {
      return false;
    }

    if (this.seenEventIds.has(eventId)) {
      return true;
    }

    // Add to seen set
    this.seenEventIds.add(eventId);

    // Evict oldest entries if set is too large
    if (this.seenEventIds.size > this.maxSize) {
      const iterator = this.seenEventIds.values();
      const oldest = iterator.next().value;
      if (oldest) {
        this.seenEventIds.delete(oldest);
      }
    }

    return false;
  }

  /**
   * Clears all seen event IDs (called on new workflow run)
   */
  clear(): void {
    this.seenEventIds.clear();
  }

  /**
   * Gets the number of tracked event IDs
   */
  get size(): number {
    return this.seenEventIds.size;
  }
}

// ============================================================================
// StdoutEventParser Class
// ============================================================================

/**
 * Parses stdout data into typed events
 * Handles newline-delimited JSON format
 * Implements vscode.Disposable for proper resource cleanup
 */
export class StdoutEventParser implements vscode.Disposable {
  // -------------------------------------------------------------------------
  // Private State Fields
  // -------------------------------------------------------------------------

  /** Buffer for incomplete lines */
  private buffer = '';

  /** Deduplicator for event IDs */
  private deduplicator: EventDeduplicator;

  /** Array of subscriptions to dispose */
  private _disposables: vscode.Disposable[] = [];

  // -------------------------------------------------------------------------
  // EventEmitters (VS Code pattern from dynamoDbPollingService.ts)
  // -------------------------------------------------------------------------

  /** Event emitter for parsed stdout events */
  private readonly _onEvent = new vscode.EventEmitter<MergedEvent<StdoutEvent>>();

  /** Public event for subscribing to parsed stdout events */
  public readonly onEvent = this._onEvent.event;

  /** Event emitter for parse errors */
  private readonly _onParseError = new vscode.EventEmitter<{ error: Error; rawData: string }>();

  /** Public event for subscribing to parse errors */
  public readonly onParseError = this._onParseError.event;

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  constructor(deduplicator?: EventDeduplicator) {
    this.deduplicator = deduplicator || new EventDeduplicator();

    // Subscribe to WorkflowTriggerService.onStdoutLine
    const workflowService = getWorkflowTriggerService();
    const subscription = workflowService.onStdoutLine((line) => {
      this.processLine(line);
    });
    this._disposables.push(subscription);
  }

  // -------------------------------------------------------------------------
  // Public Methods
  // -------------------------------------------------------------------------

  /**
   * Processes raw stdout data chunk
   * Handles partial lines by buffering
   *
   * @param data - Raw string data from stdout
   */
  processChunk(data: string): void {
    // Add data to buffer
    this.buffer += data;

    // Process complete lines
    const lines = this.buffer.split('\n');

    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || '';

    // Process each complete line
    for (const line of lines) {
      this.processLine(line);
    }
  }

  /**
   * Flushes any remaining buffered data
   * Call this when the stream ends
   */
  flush(): void {
    if (this.buffer.trim()) {
      this.processLine(this.buffer);
      this.buffer = '';
    }
  }

  /**
   * Resets the parser state (called on new workflow run)
   */
  reset(): void {
    this.buffer = '';
    this.deduplicator.clear();
  }

  /**
   * Dispose of all resources
   * Implements vscode.Disposable
   */
  dispose(): void {
    // Dispose all subscriptions
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
    this._disposables = [];

    // Dispose EventEmitters
    this._onEvent.dispose();
    this._onParseError.dispose();

    // Clear buffer and deduplicator
    this.buffer = '';
    this.deduplicator.clear();
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  /**
   * Processes a single line of stdout data
   *
   * @param line - A single line of stdout data
   */
  private processLine(line: string): void {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      return;
    }

    // Skip non-JSON lines (logs, warnings, etc.)
    if (!trimmed.startsWith('{')) {
      return;
    }

    try {
      const parsed = JSON.parse(trimmed) as StdoutEvent;

      // Validate it looks like an event (has type or event_type)
      if (!this.isValidEvent(parsed)) {
        return;
      }

      // Generate event ID for deduplication
      const eventId = this.generateEventId(parsed);

      // Check for duplicates
      if (this.deduplicator.isDuplicate(eventId)) {
        return;
      }

      // Wrap as MergedEvent
      const mergedEvent: MergedEvent<StdoutEvent> = {
        source: 'stdout',
        event: parsed,
      };

      // Fire the event via EventEmitter
      this._onEvent.fire(mergedEvent);
    } catch (error) {
      // Not valid JSON or parsing failed
      this._onParseError.fire({
        error: error instanceof Error ? error : new Error(String(error)),
        rawData: trimmed,
      });
    }
  }

  /**
   * Validates that parsed data looks like a valid event
   */
  private isValidEvent(data: unknown): data is StdoutEvent {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;

    // Stdout events have 'type' field
    // DynamoDB events have 'event_type' field
    return (
      (typeof obj.type === 'string' || typeof obj.event_type === 'string') &&
      typeof obj.workflow_id === 'string' &&
      typeof obj.timestamp === 'number'
    );
  }

  /**
   * Generates a unique ID for deduplication
   */
  private generateEventId(event: StdoutEvent): string {
    const type = 'type' in event ? event.type : 'unknown';
    const nodeId = 'node_id' in event ? (event as { node_id?: string }).node_id : '';

    return `${event.workflow_id}-${type}-${event.timestamp}-${nodeId}`;
  }
}

// ============================================================================
// Singleton Pattern (from dynamoDbPollingService.ts)
// ============================================================================

/**
 * Singleton instance of the stdout event parser
 */
let instance: StdoutEventParser | null = null;

/**
 * Get the singleton StdoutEventParser instance
 * Creates the instance on first call (lazy initialization)
 *
 * @returns The StdoutEventParser singleton
 */
export function getStdoutEventParser(): StdoutEventParser {
  if (!instance) {
    instance = new StdoutEventParser();
  }
  return instance;
}

/**
 * Reset the singleton instance
 * Disposes current instance and sets to null
 * Useful for testing or when cleanup is needed
 */
export function resetStdoutEventParser(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}

// ============================================================================
// Utility Functions (preserved from original)
// ============================================================================

/**
 * Parses a single stdout line into a MergedEvent
 * Returns null if the line is not a valid event JSON
 *
 * @param line - A single line of stdout data
 * @returns MergedEvent or null if not a valid event
 */
export function parseStdoutLine(line: string): MergedEvent | null {
  const trimmed = line.trim();

  // Skip empty lines or non-JSON
  if (!trimmed || !trimmed.startsWith('{')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);

    // Validate it has required fields
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (!parsed.type && !parsed.event_type) ||
      typeof parsed.workflow_id !== 'string' ||
      typeof parsed.timestamp !== 'number'
    ) {
      return null;
    }

    return {
      source: 'stdout',
      event: parsed as AgentifyEvent,
    };
  } catch {
    return null;
  }
}

/**
 * Orders events chronologically by timestamp
 *
 * @param events - Array of merged events
 * @returns New array sorted by timestamp (ascending)
 */
export function orderEventsByTimestamp(events: MergedEvent[]): MergedEvent[] {
  return [...events].sort((a, b) => a.event.timestamp - b.event.timestamp);
}
