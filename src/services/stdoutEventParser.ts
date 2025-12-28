/**
 * Stdout Event Parser Service
 * Parses JSON events from workflow subprocess stdout stream
 * Converts raw stdout data into typed MergedEvent objects
 */

import type {
  MergedEvent,
  StdoutEvent,
  AgentifyEvent,
} from '../types/events';

/**
 * Interface for event handling callbacks
 */
export interface StdoutEventCallbacks {
  /** Called when a valid event is parsed */
  onEvent?: (mergedEvent: MergedEvent) => void;
  /** Called when an error occurs during parsing */
  onParseError?: (error: Error, rawData: string) => void;
}

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

/**
 * Parses stdout data into typed events
 * Handles newline-delimited JSON format
 */
export class StdoutEventParser {
  private buffer = '';
  private callbacks: StdoutEventCallbacks;
  private deduplicator: EventDeduplicator;

  constructor(callbacks: StdoutEventCallbacks = {}, deduplicator?: EventDeduplicator) {
    this.callbacks = callbacks;
    this.deduplicator = deduplicator || new EventDeduplicator();
  }

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

      // Emit the event
      this.callbacks.onEvent?.(mergedEvent);
    } catch (error) {
      // Not valid JSON or parsing failed
      this.callbacks.onParseError?.(
        error instanceof Error ? error : new Error(String(error)),
        trimmed
      );
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
   * Updates the callbacks
   */
  setCallbacks(callbacks: StdoutEventCallbacks): void {
    this.callbacks = callbacks;
  }
}

/**
 * Creates a stdout event handler function for use with WorkflowTriggerService
 * Returns a function that processes stdout data and calls the callback for each event
 *
 * @param onEvent - Callback for each parsed event
 * @param onParseError - Optional callback for parse errors
 * @returns Function to handle stdout data chunks
 */
export function createStdoutEventHandler(
  onEvent: (mergedEvent: MergedEvent) => void,
  onParseError?: (error: Error, rawData: string) => void
): {
  handler: (data: string) => void;
  parser: StdoutEventParser;
} {
  const parser = new StdoutEventParser({
    onEvent,
    onParseError,
  });

  return {
    handler: (data: string) => parser.processChunk(data),
    parser,
  };
}

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
