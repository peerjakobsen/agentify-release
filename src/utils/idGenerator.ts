/**
 * ID Generation Utilities
 * Generates unique identifiers for workflow tracking and tracing
 */

import * as crypto from 'crypto';

/**
 * Generates a unique workflow ID
 *
 * Format: 'wf-' prefix + 8 alphanumeric characters
 * Example: 'wf-a1b2c3d4'
 *
 * @returns A unique workflow identifier string
 */
export function generateWorkflowId(): string {
  return 'wf-' + crypto.randomUUID().slice(0, 8);
}

/**
 * Generates an OTEL-compatible trace ID
 *
 * Format: 32-character lowercase hexadecimal string
 * Example: '80e1afed08e019fc1110464cfa66635c'
 *
 * The trace ID follows the OpenTelemetry specification which requires
 * a 16-byte (128-bit) identifier represented as 32 hex characters.
 * This format is compatible with AWS X-Ray and other distributed tracing systems.
 *
 * @returns A 32-character lowercase hex string
 */
export function generateTraceId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}
