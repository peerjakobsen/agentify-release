/**
 * Timer Formatting Utility
 * Formats elapsed time for display in the input panel
 */

/**
 * Formats milliseconds into a display string
 *
 * Formats:
 * - Running: MM:SS (e.g., '00:04')
 * - Completed/Error: MM:SS.d (e.g., '00:12.3')
 * - Not started: '--:--'
 *
 * @param ms - Elapsed time in milliseconds, or null/undefined if not started
 * @param showDecimal - Whether to show one decimal place for sub-second precision
 * @returns Formatted time string
 */
export function formatTime(ms: number | null | undefined, showDecimal: boolean = false): string {
  // Return placeholder for null/undefined input
  if (ms === null || ms === undefined) {
    return '--:--';
  }

  // Handle edge case of negative values
  const safeMs = Math.max(0, ms);

  // Calculate components
  const totalSeconds = safeMs / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // Format minutes (always 2 digits)
  const minutesStr = minutes.toString().padStart(2, '0');

  if (showDecimal) {
    // Format with one decimal: MM:SS.d
    const secondsStr = seconds.toFixed(1).padStart(4, '0');
    return `${minutesStr}:${secondsStr}`;
  } else {
    // Format without decimal: MM:SS
    const secondsStr = Math.floor(seconds).toString().padStart(2, '0');
    return `${minutesStr}:${secondsStr}`;
  }
}
