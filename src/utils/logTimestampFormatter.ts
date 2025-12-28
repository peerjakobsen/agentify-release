/**
 * Log Timestamp Formatting Utility
 * Formats timestamps for display in the execution log panel
 */

/**
 * Formats a timestamp to HH:MM:SS.mmm format
 *
 * @param timestamp - Epoch milliseconds, ISO string, or Date object
 * @returns Formatted time string in HH:MM:SS.mmm format
 *
 * @example
 * formatLogTimestamp(1703750400123) // '12:00:00.123'
 * formatLogTimestamp('2023-12-28T12:00:00.123Z') // '12:00:00.123'
 * formatLogTimestamp(new Date(2023, 11, 28, 12, 0, 0, 123)) // '12:00:00.123'
 */
export function formatLogTimestamp(timestamp: number | string | Date | null | undefined): string {
  // Handle null/undefined
  if (timestamp === null || timestamp === undefined) {
    return '--:--:--.---';
  }

  // Convert to Date object
  let date: Date;

  if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    return '--:--:--.---';
  }

  // Handle invalid date
  if (isNaN(date.getTime())) {
    return '--:--:--.---';
  }

  // Extract time components
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const milliseconds = date.getMilliseconds().toString().padStart(3, '0');

  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

/**
 * Formats a duration in milliseconds to a human-readable string
 *
 * @param durationMs - Duration in milliseconds
 * @returns Formatted duration string
 *
 * @example
 * formatDuration(150) // '150ms'
 * formatDuration(1500) // '1.5s'
 * formatDuration(62000) // '1m 2s'
 */
export function formatDuration(durationMs: number | null | undefined): string {
  if (durationMs === null || durationMs === undefined) {
    return '?';
  }

  if (durationMs < 0) {
    return '0ms';
  }

  // Under 1 second: show milliseconds
  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }

  // Under 1 minute: show seconds with one decimal
  if (durationMs < 60000) {
    const seconds = durationMs / 1000;
    return `${seconds.toFixed(1)}s`;
  }

  // 1 minute or more: show minutes and seconds
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);

  if (seconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}
