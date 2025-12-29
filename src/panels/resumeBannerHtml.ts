/**
 * Resume Banner HTML Generators
 * HTML rendering functions for the wizard state resume banner
 *
 * Task Group 4: Resume Banner HTML and Styling
 */

import { WIZARD_STEPS } from './ideationConstants';
import type { ResumeBannerState } from '../types/wizardPanel';

/**
 * Expiry threshold in days
 * Task 4.4: 7-day soft expiry
 */
export const EXPIRY_THRESHOLD_DAYS = 7;

/**
 * Maximum length for business objective preview
 * Task 4.5: Truncate to 80 characters
 */
export const PREVIEW_MAX_LENGTH = 80;

/**
 * Expiry status result
 * Task 4.4: Returned by calculateExpiryStatus()
 */
export interface ExpiryStatus {
  /** Whether the state is older than 7 days */
  isExpired: boolean;
  /** Number of days since the state was saved */
  daysOld: number;
}

/**
 * Format time since a timestamp
 * Task 4.3: Human-readable time formatting
 * @param timestamp Unix timestamp in milliseconds
 * @returns Human-readable time string
 */
export function formatTimeSince(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;

  // Convert to various units
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'Just now';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }

  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

/**
 * Calculate expiry status from saved timestamp
 * Task 4.4: Determines if state is expired (> 7 days old)
 * @param savedAt Unix timestamp when state was saved
 * @returns ExpiryStatus with isExpired flag and daysOld count
 */
export function calculateExpiryStatus(savedAt: number): ExpiryStatus {
  const now = Date.now();
  const diffMs = now - savedAt;
  const daysOld = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return {
    isExpired: daysOld >= EXPIRY_THRESHOLD_DAYS,
    daysOld,
  };
}

/**
 * Truncate business objective for preview
 * Task 4.5: Truncate to 80 characters with ellipsis
 * @param objective Full business objective text
 * @returns Truncated preview string
 */
export function truncateBusinessObjective(objective: string): string {
  if (!objective) {
    return 'No objective set';
  }

  const trimmed = objective.trim();
  if (trimmed.length <= PREVIEW_MAX_LENGTH) {
    return trimmed;
  }

  return trimmed.substring(0, PREVIEW_MAX_LENGTH - 3) + '...';
}

/**
 * Get step label by step number
 * @param stepNumber Step number (1-8)
 * @returns Step label or empty string if not found
 */
function getStepLabel(stepNumber: number): string {
  const step = WIZARD_STEPS.find(s => s.step === stepNumber);
  return step ? step.label : '';
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Get Resume Banner HTML
 * Task 4.5: Renders the resume banner with all required information
 * @param bannerState Resume banner state with visibility and data
 * @returns HTML string for the resume banner
 */
export function getResumeBannerHtml(bannerState: ResumeBannerState): string {
  if (!bannerState.visible) {
    return '';
  }

  // Handle version mismatch case
  if (bannerState.isVersionMismatch) {
    return getVersionMismatchBannerHtml();
  }

  const stepLabel = getStepLabel(bannerState.stepReached);
  const timeSince = formatTimeSince(bannerState.savedAt);
  const preview = escapeHtml(bannerState.businessObjectivePreview);

  // Expiry warning text
  const expiryWarningHtml = bannerState.isExpired
    ? '<div class="resume-banner-warning">This session is older than 7 days. Some data may be outdated.</div>'
    : '';

  return `
    <div class="resume-banner">
      <div class="resume-banner-icon">&#128190;</div>
      <div class="resume-banner-content">
        <div class="resume-banner-title">Continue where you left off?</div>
        <div class="resume-banner-preview">"${preview}"</div>
        <div class="resume-banner-meta">
          <span class="resume-banner-step">Step ${bannerState.stepReached} of 8 - ${escapeHtml(stepLabel)}</span>
          <span class="resume-banner-time">${escapeHtml(timeSince)}</span>
        </div>
        ${expiryWarningHtml}
      </div>
      <div class="resume-banner-actions">
        <button class="resume-btn primary" onclick="resumeSession()">Resume</button>
        <button class="resume-btn secondary" onclick="startFresh()">Start Fresh</button>
      </div>
    </div>
  `;
}

/**
 * Get Version Mismatch Banner HTML
 * Task 4.6: Renders incompatibility banner when schema version doesn't match
 * @returns HTML string for the version mismatch banner
 */
export function getVersionMismatchBannerHtml(): string {
  return `
    <div class="resume-banner version-mismatch">
      <div class="resume-banner-icon warning">&#9888;</div>
      <div class="resume-banner-content">
        <div class="resume-banner-title">Previous session incompatible</div>
        <div class="resume-banner-description">
          Your previous wizard session was created with an older version and cannot be restored.
        </div>
      </div>
      <div class="resume-banner-actions">
        <button class="resume-btn primary" onclick="startFresh()">Start Fresh</button>
      </div>
    </div>
  `;
}

/**
 * Get file re-upload indicator HTML
 * Task 5.4: Shows indicator when file needs to be re-uploaded
 * @param fileName Original filename
 * @param fileSize File size in bytes
 * @returns HTML string for the re-upload indicator
 */
export function getFileReuploadIndicatorHtml(fileName: string, fileSize: number): string {
  const formattedSize = formatFileSize(fileSize);

  return `
    <div class="file-reupload-indicator">
      <div class="file-reupload-icon">&#128196;</div>
      <div class="file-reupload-content">
        <span class="file-reupload-name">${escapeHtml(fileName)}</span>
        <span class="file-reupload-size">(${formattedSize})</span>
        <span class="file-reupload-status">- re-upload required</span>
      </div>
    </div>
  `;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get Resume Banner CSS styles
 * Task 4.7: CSS styles for the resume banner
 * @returns CSS string for resume banner styling
 */
export function getResumeBannerStyles(): string {
  return `
    /* Resume Banner Styles (Task Group 4) */
    .resume-banner {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-editorWidget-border);
      border-radius: 6px;
      border-left: 3px solid var(--vscode-button-background);
    }

    .resume-banner.version-mismatch {
      border-left-color: var(--vscode-inputValidation-warningBorder, #cca700);
    }

    .resume-banner-icon {
      font-size: 24px;
      flex-shrink: 0;
    }

    .resume-banner-icon.warning {
      color: var(--vscode-inputValidation-warningForeground, #cca700);
    }

    .resume-banner-content {
      flex: 1;
      min-width: 0;
    }

    .resume-banner-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-foreground);
      margin-bottom: 4px;
    }

    .resume-banner-preview {
      font-size: 12px;
      color: var(--vscode-foreground);
      font-style: italic;
      margin-bottom: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .resume-banner-description {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }

    .resume-banner-meta {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .resume-banner-step {
      font-weight: 500;
    }

    .resume-banner-time {
      opacity: 0.8;
    }

    .resume-banner-warning {
      margin-top: 8px;
      padding: 6px 10px;
      font-size: 11px;
      color: var(--vscode-inputValidation-warningForeground, #cca700);
      background: var(--vscode-inputValidation-warningBackground, rgba(205, 145, 0, 0.1));
      border: 1px solid var(--vscode-inputValidation-warningBorder, #cca700);
      border-radius: 4px;
    }

    .resume-banner-actions {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex-shrink: 0;
    }

    .resume-btn {
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 500;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      white-space: nowrap;
    }

    .resume-btn.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .resume-btn.primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .resume-btn.secondary {
      background: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-input-border);
    }

    .resume-btn.secondary:hover {
      background: var(--vscode-input-background);
    }

    /* File Re-upload Indicator Styles (Task 5.4) */
    .file-reupload-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: var(--vscode-inputValidation-warningBackground, rgba(205, 145, 0, 0.1));
      border: 1px solid var(--vscode-inputValidation-warningBorder, #cca700);
      border-radius: 4px;
      margin-bottom: 12px;
    }

    .file-reupload-icon {
      font-size: 18px;
      flex-shrink: 0;
    }

    .file-reupload-content {
      font-size: 12px;
      color: var(--vscode-foreground);
    }

    .file-reupload-name {
      font-weight: 500;
    }

    .file-reupload-size {
      color: var(--vscode-descriptionForeground);
    }

    .file-reupload-status {
      color: var(--vscode-inputValidation-warningForeground, #cca700);
      font-style: italic;
    }
  `;
}
