/**
 * Tests for Resume Banner HTML Functions
 * Task Group 10: Test coverage for resume banner HTML generation
 */

import { describe, it, expect } from 'vitest';
import {
  formatTimeSince,
  calculateExpiryStatus,
  truncateBusinessObjective,
  getResumeBannerHtml,
  getVersionMismatchBannerHtml,
  getFileReuploadIndicatorHtml,
  EXPIRY_THRESHOLD_DAYS,
  PREVIEW_MAX_LENGTH,
} from '../../panels/resumeBannerHtml';
import type { ResumeBannerState } from '../../types/wizardPanel';

describe('Resume Banner HTML Functions', () => {
  // ===========================================================================
  // Task 4.3: formatTimeSince function
  // ===========================================================================

  describe('Task 4.3: formatTimeSince', () => {
    it('should return "Just now" for timestamps less than 1 minute ago', () => {
      const now = Date.now();
      expect(formatTimeSince(now - 30 * 1000)).toBe('Just now');
      expect(formatTimeSince(now)).toBe('Just now');
    });

    it('should return minutes for timestamps 1-59 minutes ago', () => {
      const now = Date.now();
      expect(formatTimeSince(now - 60 * 1000)).toBe('1 minute ago');
      expect(formatTimeSince(now - 5 * 60 * 1000)).toBe('5 minutes ago');
      expect(formatTimeSince(now - 59 * 60 * 1000)).toBe('59 minutes ago');
    });

    it('should return hours for timestamps 1-23 hours ago', () => {
      const now = Date.now();
      expect(formatTimeSince(now - 60 * 60 * 1000)).toBe('1 hour ago');
      expect(formatTimeSince(now - 3 * 60 * 60 * 1000)).toBe('3 hours ago');
      expect(formatTimeSince(now - 23 * 60 * 60 * 1000)).toBe('23 hours ago');
    });

    it('should return days for timestamps >= 24 hours ago', () => {
      const now = Date.now();
      expect(formatTimeSince(now - 24 * 60 * 60 * 1000)).toBe('1 day ago');
      expect(formatTimeSince(now - 5 * 24 * 60 * 60 * 1000)).toBe('5 days ago');
    });

    it('should handle singular forms correctly', () => {
      const now = Date.now();
      expect(formatTimeSince(now - 1 * 60 * 1000)).toBe('1 minute ago');
      expect(formatTimeSince(now - 1 * 60 * 60 * 1000)).toBe('1 hour ago');
      expect(formatTimeSince(now - 1 * 24 * 60 * 60 * 1000)).toBe('1 day ago');
    });
  });

  // ===========================================================================
  // Task 4.4: calculateExpiryStatus function
  // ===========================================================================

  describe('Task 4.4: calculateExpiryStatus', () => {
    it('should export EXPIRY_THRESHOLD_DAYS = 7', () => {
      expect(EXPIRY_THRESHOLD_DAYS).toBe(7);
    });

    it('should return isExpired: false for recent timestamps', () => {
      const now = Date.now();
      const result = calculateExpiryStatus(now - 3 * 24 * 60 * 60 * 1000); // 3 days ago

      expect(result.isExpired).toBe(false);
      expect(result.daysOld).toBe(3);
    });

    it('should return isExpired: true for timestamps >= 7 days old', () => {
      const now = Date.now();
      const result = calculateExpiryStatus(now - 7 * 24 * 60 * 60 * 1000); // 7 days ago

      expect(result.isExpired).toBe(true);
      expect(result.daysOld).toBe(7);
    });

    it('should return isExpired: true for very old timestamps', () => {
      const now = Date.now();
      const result = calculateExpiryStatus(now - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      expect(result.isExpired).toBe(true);
      expect(result.daysOld).toBe(30);
    });

    it('should return daysOld: 0 for today', () => {
      const now = Date.now();
      const result = calculateExpiryStatus(now - 60 * 60 * 1000); // 1 hour ago

      expect(result.daysOld).toBe(0);
      expect(result.isExpired).toBe(false);
    });
  });

  // ===========================================================================
  // Task 4.5: truncateBusinessObjective function
  // ===========================================================================

  describe('Task 4.5: truncateBusinessObjective', () => {
    it('should export PREVIEW_MAX_LENGTH = 80', () => {
      expect(PREVIEW_MAX_LENGTH).toBe(80);
    });

    it('should return original text if <= 80 characters', () => {
      const short = 'Reduce inventory stockouts';
      expect(truncateBusinessObjective(short)).toBe(short);
    });

    it('should truncate and add ellipsis for text > 80 characters', () => {
      const long = 'A'.repeat(100);
      const result = truncateBusinessObjective(long);

      expect(result).toHaveLength(80);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should return "No objective set" for empty string', () => {
      expect(truncateBusinessObjective('')).toBe('No objective set');
    });

    it('should trim whitespace', () => {
      const withSpaces = '   Reduce costs   ';
      expect(truncateBusinessObjective(withSpaces)).toBe('Reduce costs');
    });
  });

  // ===========================================================================
  // Task 4.5: getResumeBannerHtml function
  // ===========================================================================

  describe('Task 4.5: getResumeBannerHtml', () => {
    it('should return empty string when not visible', () => {
      const state: ResumeBannerState = {
        visible: false,
        businessObjectivePreview: 'Test',
        stepReached: 3,
        savedAt: Date.now(),
        isExpired: false,
        isVersionMismatch: false,
      };

      expect(getResumeBannerHtml(state)).toBe('');
    });

    it('should return version mismatch banner when isVersionMismatch is true', () => {
      const state: ResumeBannerState = {
        visible: true,
        businessObjectivePreview: '',
        stepReached: 0,
        savedAt: Date.now(),
        isExpired: false,
        isVersionMismatch: true,
      };

      const html = getResumeBannerHtml(state);

      expect(html).toContain('version-mismatch');
      expect(html).toContain('Previous session incompatible');
    });

    it('should render resume banner with correct elements', () => {
      const state: ResumeBannerState = {
        visible: true,
        businessObjectivePreview: 'Reduce stockouts by 30%',
        stepReached: 4,
        savedAt: Date.now() - 60 * 60 * 1000, // 1 hour ago
        isExpired: false,
        isVersionMismatch: false,
      };

      const html = getResumeBannerHtml(state);

      expect(html).toContain('resume-banner');
      expect(html).toContain('Continue where you left off?');
      expect(html).toContain('Reduce stockouts by 30%');
      expect(html).toContain('Step 4 of 8');
      expect(html).toContain('resumeSession()');
      expect(html).toContain('startFresh()');
    });

    it('should show expiry warning when session is expired', () => {
      const state: ResumeBannerState = {
        visible: true,
        businessObjectivePreview: 'Old objective',
        stepReached: 2,
        savedAt: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        isExpired: true,
        isVersionMismatch: false,
      };

      const html = getResumeBannerHtml(state);

      expect(html).toContain('resume-banner-warning');
      expect(html).toContain('older than 7 days');
    });
  });

  // ===========================================================================
  // Task 4.6: getVersionMismatchBannerHtml function
  // ===========================================================================

  describe('Task 4.6: getVersionMismatchBannerHtml', () => {
    it('should render version mismatch banner correctly', () => {
      const html = getVersionMismatchBannerHtml();

      expect(html).toContain('version-mismatch');
      expect(html).toContain('Previous session incompatible');
      expect(html).toContain('older version');
      expect(html).toContain('Start Fresh');
      expect(html).toContain('startFresh()');
      expect(html).not.toContain('resumeSession()');
    });
  });

  // ===========================================================================
  // Task 5.4: getFileReuploadIndicatorHtml function
  // ===========================================================================

  describe('Task 5.4: getFileReuploadIndicatorHtml', () => {
    it('should render file re-upload indicator correctly', () => {
      const html = getFileReuploadIndicatorHtml('document.pdf', 2048);

      expect(html).toContain('file-reupload-indicator');
      expect(html).toContain('document.pdf');
      expect(html).toContain('re-upload required');
    });

    it('should format file size in bytes', () => {
      const html = getFileReuploadIndicatorHtml('small.txt', 500);

      expect(html).toContain('500 B');
    });

    it('should format file size in KB', () => {
      const html = getFileReuploadIndicatorHtml('medium.pdf', 5 * 1024);

      expect(html).toContain('5.0 KB');
    });

    it('should format file size in MB', () => {
      const html = getFileReuploadIndicatorHtml('large.docx', 3 * 1024 * 1024);

      expect(html).toContain('3.0 MB');
    });

    it('should escape HTML in filename', () => {
      const html = getFileReuploadIndicatorHtml('<script>alert("xss")</script>.pdf', 1024);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });
});
