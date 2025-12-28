/**
 * DynamoDB Polling Service
 *
 * Polls DynamoDB for workflow events at regular intervals, emitting them to subscribers
 * via VS Code EventEmitters. Manages its own lifecycle including automatic stop on
 * terminal events and exponential backoff on errors.
 *
 * Usage:
 *   const service = getDynamoDbPollingService();
 *   service.onEvent((event) => handleEvent(event));
 *   service.onError((error) => handleError(error));
 *   service.startPolling(workflowId);
 */

import * as vscode from 'vscode';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDbEvent } from '../types/events';
import { getDynamoDbDocumentClientAsync } from './dynamoDbClient';
import { getConfigService } from './configService';

// ============================================================================
// Constants
// ============================================================================

/**
 * Base polling interval in milliseconds
 */
const BASE_POLL_INTERVAL_MS = 500;

/**
 * Exponential backoff sequence on errors (in milliseconds)
 */
const BACKOFF_SEQUENCE_MS = [1000, 2000, 4000, 8000, 16000, 30000];

/**
 * Terminal event types that trigger auto-stop
 */
const TERMINAL_EVENT_TYPES = ['workflow_complete', 'workflow_error'];

// ============================================================================
// DynamoDbPollingService Class
// ============================================================================

/**
 * Service for polling DynamoDB workflow events
 * Implements vscode.Disposable for proper resource cleanup
 */
export class DynamoDbPollingService implements vscode.Disposable {
  // -------------------------------------------------------------------------
  // Private State Fields
  // -------------------------------------------------------------------------

  /** Current workflow ID being polled */
  private _workflowId: string | null = null;

  /** Whether polling is currently active */
  private _isPolling = false;

  /** Last timestamp successfully queried (for pagination) */
  private _lastTimestamp = 0;

  /** Set of seen event keys for deduplication */
  private _seenEventKeys: Set<string> = new Set();

  /** Current interval timer ID */
  private _pollIntervalId: ReturnType<typeof setTimeout> | null = null;

  /** Current backoff interval in milliseconds */
  private _currentBackoffMs = BASE_POLL_INTERVAL_MS;

  /** Current backoff index (position in BACKOFF_SEQUENCE_MS) */
  private _backoffIndex = -1;

  // -------------------------------------------------------------------------
  // EventEmitters (VS Code pattern from configService.ts)
  // -------------------------------------------------------------------------

  /** Event emitter for DynamoDB events */
  private readonly _onEvent = new vscode.EventEmitter<DynamoDbEvent>();

  /** Public event for subscribing to DynamoDB events */
  public readonly onEvent = this._onEvent.event;

  /** Event emitter for polling errors */
  private readonly _onError = new vscode.EventEmitter<Error>();

  /** Public event for subscribing to polling errors */
  public readonly onError = this._onError.event;

  // -------------------------------------------------------------------------
  // Public State Accessor Methods
  // -------------------------------------------------------------------------

  /**
   * Returns whether the service is currently polling
   */
  public isPolling(): boolean {
    return this._isPolling;
  }

  /**
   * Returns the current workflow ID being polled, or null if not polling
   */
  public getCurrentWorkflowId(): string | null {
    return this._workflowId;
  }

  // -------------------------------------------------------------------------
  // Polling Lifecycle Methods
  // -------------------------------------------------------------------------

  /**
   * Start polling for events from a specific workflow
   *
   * @param workflowId - The workflow ID to poll events for
   */
  public startPolling(workflowId: string): void {
    // If already polling same workflow, no-op
    if (this._isPolling && this._workflowId === workflowId) {
      return;
    }

    // If polling different workflow, stop first
    if (this._isPolling) {
      this.stopPolling();
    }

    // Initialize state for new polling session
    this._workflowId = workflowId;
    this._isPolling = true;
    this._lastTimestamp = 0;
    this._seenEventKeys.clear();
    this._currentBackoffMs = BASE_POLL_INTERVAL_MS;
    this._backoffIndex = -1;

    // Start the polling - execute first poll immediately
    this._poll();
  }

  /**
   * Stop polling and clear the interval
   * Keeps workflowId for reference
   */
  public stopPolling(): void {
    if (this._pollIntervalId !== null) {
      clearTimeout(this._pollIntervalId);
      this._pollIntervalId = null;
    }
    this._isPolling = false;
  }

  /**
   * Dispose of all resources
   * Implements vscode.Disposable
   */
  public dispose(): void {
    this.stopPolling();
    this._onEvent.dispose();
    this._onError.dispose();
    this._workflowId = null;
    this._seenEventKeys.clear();
    this._lastTimestamp = 0;
  }

  // -------------------------------------------------------------------------
  // Private Polling Implementation
  // -------------------------------------------------------------------------

  /**
   * Schedule the next poll after the current interval
   */
  private _scheduleNextPoll(): void {
    // Clear any existing scheduled poll
    if (this._pollIntervalId !== null) {
      clearTimeout(this._pollIntervalId);
    }

    // Schedule the next poll
    this._pollIntervalId = setTimeout(() => {
      this._poll();
    }, this._currentBackoffMs);
  }

  /**
   * Execute a single poll cycle
   */
  private async _poll(): Promise<void> {
    // Guard against polling when stopped
    if (!this._isPolling || !this._workflowId) {
      return;
    }

    try {
      // Query for new events
      const events = await this._queryEvents();

      // Check if we should still be polling (could have been stopped during query)
      if (!this._isPolling) {
        return;
      }

      // Emit each new event
      for (const event of events) {
        this._onEvent.fire(event);

        // Check for terminal event
        if (this._isTerminalEvent(event)) {
          // Stop polling after emitting the terminal event
          this.stopPolling();
          return;
        }
      }

      // Reset backoff on success
      this._currentBackoffMs = BASE_POLL_INTERVAL_MS;
      this._backoffIndex = -1;

      // Schedule next poll
      if (this._isPolling) {
        this._scheduleNextPoll();
      }
    } catch (error) {
      this._handlePollError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Query DynamoDB for events newer than lastTimestamp
   *
   * @returns Array of new events, sorted ascending by timestamp
   */
  private async _queryEvents(): Promise<DynamoDbEvent[]> {
    // Get DynamoDB client
    const client = await getDynamoDbDocumentClientAsync();

    // Get table name from config
    const configService = getConfigService();
    const config = await configService?.getConfig();
    const tableName = config?.infrastructure?.dynamodb?.tableName;

    if (!tableName) {
      throw new Error('DynamoDB table name not configured');
    }

    // Build and execute query
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'workflow_id = :wfId AND #ts > :lastTimestamp',
      ExpressionAttributeNames: {
        '#ts': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':wfId': this._workflowId,
        ':lastTimestamp': this._lastTimestamp,
      },
    });

    const response = await client.send(command);

    // Handle empty or undefined results
    const items = (response.Items || []) as DynamoDbEvent[];

    // Sort ascending by timestamp
    items.sort((a, b) => a.timestamp - b.timestamp);

    // Apply deduplication
    const newEvents = this._deduplicateEvents(items);

    // Update lastTimestamp to highest from results
    if (newEvents.length > 0) {
      this._lastTimestamp = newEvents[newEvents.length - 1].timestamp;
    }

    return newEvents;
  }

  /**
   * Filter out events that have already been seen
   *
   * @param events - Array of events to filter
   * @returns Array of events not previously seen
   */
  private _deduplicateEvents(events: DynamoDbEvent[]): DynamoDbEvent[] {
    const newEvents: DynamoDbEvent[] = [];

    for (const event of events) {
      const key = `${event.workflow_id}:${event.timestamp}`;

      if (!this._seenEventKeys.has(key)) {
        this._seenEventKeys.add(key);
        newEvents.push(event);
      }
    }

    return newEvents;
  }

  /**
   * Check if an event is a terminal event (workflow_complete or workflow_error)
   *
   * @param event - The event to check
   * @returns True if the event is terminal
   */
  private _isTerminalEvent(event: DynamoDbEvent): boolean {
    // DynamoDB events use 'event_type' field
    if ('event_type' in event) {
      return TERMINAL_EVENT_TYPES.includes(event.event_type);
    }
    return false;
  }

  /**
   * Handle polling errors with exponential backoff
   *
   * @param error - The error that occurred
   */
  private _handlePollError(error: Error): void {
    // Guard against handling errors when stopped
    if (!this._isPolling) {
      return;
    }

    // Emit the error
    this._onError.fire(error);

    // Advance backoff
    this._backoffIndex = Math.min(this._backoffIndex + 1, BACKOFF_SEQUENCE_MS.length - 1);
    this._currentBackoffMs = BACKOFF_SEQUENCE_MS[this._backoffIndex];

    // Schedule next poll with backoff timing
    if (this._isPolling) {
      this._scheduleNextPoll();
    }
  }
}

// ============================================================================
// Singleton Pattern (from dynamoDbClient.ts)
// ============================================================================

/**
 * Singleton instance of the polling service
 */
let instance: DynamoDbPollingService | null = null;

/**
 * Get the singleton DynamoDbPollingService instance
 * Creates the instance on first call (lazy initialization)
 *
 * @returns The DynamoDbPollingService singleton
 */
export function getDynamoDbPollingService(): DynamoDbPollingService {
  if (!instance) {
    instance = new DynamoDbPollingService();
  }
  return instance;
}

/**
 * Reset the singleton instance
 * Useful for testing or when cleanup is needed
 */
export function resetDynamoDbPollingService(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
