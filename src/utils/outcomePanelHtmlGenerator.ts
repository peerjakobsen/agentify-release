/**
 * Outcome Panel HTML Generator
 * Generates HTML for the Outcome Panel section of the Demo Viewer webview
 * Displays workflow results with markdown or JSON rendering
 */

import type { OutcomePanelState } from '../types/logPanel';
import {
  OUTCOME_JSON_TRUNCATION_THRESHOLD,
  OUTCOME_JSON_PREVIEW_LINES,
  OUTCOME_MARKDOWN_TRUNCATION_THRESHOLD,
} from '../types/logPanel';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Check if content contains binary/non-UTF8 data
 */
export function containsBinaryData(content: string): boolean {
  // Check for null bytes or control characters (except common whitespace)
  // eslint-disable-next-line no-control-regex
  const binaryPattern = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;
  return binaryPattern.test(content);
}

// ============================================================================
// Markdown Rendering
// ============================================================================

// Placeholder markers that won't be matched by markdown patterns
const CODE_BLOCK_MARKER = '\u0000CB';
const INLINE_CODE_MARKER = '\u0000IC';
const MARKER_END = '\u0000';

/**
 * Render markdown content to HTML
 * Supports: headers (H1-H6), bold, italic, lists, code spans, code blocks
 */
export function renderMarkdown(content: string): string {
  if (!content) {
    return '';
  }

  // Check for binary data (but not our own markers which we add during processing)
  if (containsBinaryData(content)) {
    return '<div class="outcome-binary-notice">Result contains binary data</div>';
  }

  // Store code blocks and inline code before any processing
  const codeBlocks: string[] = [];
  const inlineCodeSpans: string[] = [];

  // Step 1: Extract code blocks first (triple backticks) - on raw content
  let processed = content.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    const index = codeBlocks.length;
    // Escape HTML inside code blocks
    codeBlocks.push(`<pre class="outcome-code-block"><code>${escapeHtml(code.trim())}</code></pre>`);
    return `${CODE_BLOCK_MARKER}${index}${MARKER_END}`;
  });

  // Step 2: Extract inline code spans (single backticks)
  processed = processed.replace(/`([^`]+)`/g, (_match, code) => {
    const index = inlineCodeSpans.length;
    // Escape HTML inside inline code
    inlineCodeSpans.push(`<code class="outcome-code-inline">${escapeHtml(code)}</code>`);
    return `${INLINE_CODE_MARKER}${index}${MARKER_END}`;
  });

  // Step 3: Now escape HTML for the rest of the content
  processed = escapeHtml(processed);

  // Step 4: Process markdown patterns

  // Process headers (H1-H6)
  processed = processed.replace(/^###### (.+)$/gm, '<h6 class="outcome-h6">$1</h6>');
  processed = processed.replace(/^##### (.+)$/gm, '<h5 class="outcome-h5">$1</h5>');
  processed = processed.replace(/^#### (.+)$/gm, '<h4 class="outcome-h4">$1</h4>');
  processed = processed.replace(/^### (.+)$/gm, '<h3 class="outcome-h3">$1</h3>');
  processed = processed.replace(/^## (.+)$/gm, '<h2 class="outcome-h2">$1</h2>');
  processed = processed.replace(/^# (.+)$/gm, '<h1 class="outcome-h1">$1</h1>');

  // Process bold text (**text** or __text__)
  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  processed = processed.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Process italic text (*text* or _text_) - be careful not to match bold markers
  processed = processed.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  processed = processed.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');

  // Process numbered lists
  processed = processed.replace(/^(\d+)\. (.+)$/gm, '<li class="outcome-list-item outcome-list-numbered">$2</li>');

  // Process bulleted lists (- or *)
  processed = processed.replace(/^[-*] (.+)$/gm, '<li class="outcome-list-item outcome-list-bullet">$1</li>');

  // Wrap consecutive list items in ul/ol elements
  processed = processed.replace(
    /(<li class="outcome-list-item outcome-list-bullet">[^<]+<\/li>\n?)+/g,
    '<ul class="outcome-list">$&</ul>'
  );
  processed = processed.replace(
    /(<li class="outcome-list-item outcome-list-numbered">[^<]+<\/li>\n?)+/g,
    '<ol class="outcome-list">$&</ol>'
  );

  // Process line breaks (preserve double line breaks as paragraph breaks)
  processed = processed.replace(/\n\n/g, '</p><p class="outcome-paragraph">');
  processed = processed.replace(/\n/g, '<br>');

  // Wrap content in paragraph if not already wrapped
  if (!processed.startsWith('<') || processed.startsWith('<br>') || processed.startsWith('<strong>') || processed.startsWith('<em>')) {
    processed = `<p class="outcome-paragraph">${processed}</p>`;
  }

  // Step 5: Restore inline code spans (escaped markers)
  const escapedInlineMarker = escapeHtml(INLINE_CODE_MARKER);
  const escapedMarkerEnd = escapeHtml(MARKER_END);
  inlineCodeSpans.forEach((span, index) => {
    processed = processed.replace(`${escapedInlineMarker}${index}${escapedMarkerEnd}`, span);
  });

  // Step 6: Restore code blocks (escaped markers)
  const escapedCodeBlockMarker = escapeHtml(CODE_BLOCK_MARKER);
  codeBlocks.forEach((block, index) => {
    processed = processed.replace(`${escapedCodeBlockMarker}${index}${escapedMarkerEnd}`, block);
  });

  return processed;
}

// ============================================================================
// JSON Rendering
// ============================================================================

/**
 * JSON token types for syntax highlighting
 */
type JsonTokenType = 'string' | 'number' | 'boolean' | 'null' | 'key' | 'punctuation';

/**
 * Tokenize JSON string for syntax highlighting
 * Returns HTML with span elements for each token type
 * Reuses the same color classes as the log panel: json-string, json-number, etc.
 */
export function tokenizeJson(jsonString: string): string {
  const patterns: Array<{ type: JsonTokenType; regex: RegExp }> = [
    // Match property keys (string followed by colon)
    { type: 'key', regex: /"([^"\\]|\\.)*"\s*(?=:)/g },
    // Match string values
    { type: 'string', regex: /"([^"\\]|\\.)*"/g },
    // Match numbers (including negatives and decimals)
    { type: 'number', regex: /-?\d+\.?\d*(?:[eE][+-]?\d+)?/g },
    // Match boolean values
    { type: 'boolean', regex: /\b(true|false)\b/g },
    // Match null
    { type: 'null', regex: /\bnull\b/g },
  ];

  // Create a map of positions to tokens
  const tokens: Array<{ start: number; end: number; type: JsonTokenType; text: string }> = [];

  for (const { type, regex } of patterns) {
    let match: RegExpExecArray | null;
    const regexClone = new RegExp(regex.source, regex.flags);
    while ((match = regexClone.exec(jsonString)) !== null) {
      // Check if this position is already covered by another token
      const isOverlapping = tokens.some(
        (t) => match!.index < t.end && match!.index + match![0].length > t.start
      );
      if (!isOverlapping) {
        tokens.push({
          start: match.index,
          end: match.index + match[0].length,
          type,
          text: match[0],
        });
      }
    }
  }

  // Sort tokens by position
  tokens.sort((a, b) => a.start - b.start);

  // Build highlighted HTML
  let result = '';
  let lastIndex = 0;

  for (const token of tokens) {
    // Add any non-token text before this token
    if (token.start > lastIndex) {
      result += escapeHtml(jsonString.slice(lastIndex, token.start));
    }
    // Add the highlighted token
    result += `<span class="json-${token.type}">${escapeHtml(token.text)}</span>`;
    lastIndex = token.end;
  }

  // Add any remaining text after the last token
  if (lastIndex < jsonString.length) {
    result += escapeHtml(jsonString.slice(lastIndex));
  }

  return result;
}

/**
 * Render JSON content with syntax highlighting
 */
export function renderJson(content: Record<string, unknown>): string {
  const jsonString = JSON.stringify(content, null, 2);
  const highlighted = tokenizeJson(jsonString);
  return `<pre class="outcome-json-content">${highlighted}</pre>`;
}

// ============================================================================
// Content Truncation
// ============================================================================

/**
 * Truncate content information
 */
export interface TruncationInfo {
  content: string;
  isTruncated: boolean;
  totalLines: number;
  shownLines: number;
  remainingLines: number;
}

/**
 * Truncate JSON content if it exceeds threshold
 */
export function truncateJsonContent(content: Record<string, unknown>, isExpanded: boolean): TruncationInfo {
  const jsonString = JSON.stringify(content, null, 2);
  const lines = jsonString.split('\n');
  const totalLines = lines.length;

  if (totalLines <= OUTCOME_JSON_TRUNCATION_THRESHOLD || isExpanded) {
    return {
      content: jsonString,
      isTruncated: false,
      totalLines,
      shownLines: totalLines,
      remainingLines: 0,
    };
  }

  const truncatedLines = lines.slice(0, OUTCOME_JSON_PREVIEW_LINES);
  return {
    content: truncatedLines.join('\n'),
    isTruncated: true,
    totalLines,
    shownLines: OUTCOME_JSON_PREVIEW_LINES,
    remainingLines: totalLines - OUTCOME_JSON_PREVIEW_LINES,
  };
}

/**
 * Truncate markdown/text content if it exceeds threshold
 */
export function truncateMarkdownContent(content: string, isExpanded: boolean): TruncationInfo {
  const lines = content.split('\n');
  const totalLines = lines.length;

  if (totalLines <= OUTCOME_MARKDOWN_TRUNCATION_THRESHOLD || isExpanded) {
    return {
      content,
      isTruncated: false,
      totalLines,
      shownLines: totalLines,
      remainingLines: 0,
    };
  }

  const truncatedLines = lines.slice(0, OUTCOME_MARKDOWN_TRUNCATION_THRESHOLD);
  return {
    content: truncatedLines.join('\n'),
    isTruncated: true,
    totalLines,
    shownLines: OUTCOME_MARKDOWN_TRUNCATION_THRESHOLD,
    remainingLines: totalLines - OUTCOME_MARKDOWN_TRUNCATION_THRESHOLD,
  };
}

// ============================================================================
// Result Content Rendering
// ============================================================================

/**
 * Render result content based on type (string or object)
 */
export function renderResultContent(
  result: string | Record<string, unknown> | undefined,
  isExpanded: boolean
): { html: string; isTruncated: boolean; remainingLines: number; rawContent: string } {
  // Empty result
  if (result === undefined || result === null || result === '') {
    return {
      html: '<div class="outcome-empty-result">Workflow completed with no output</div>',
      isTruncated: false,
      remainingLines: 0,
      rawContent: '',
    };
  }

  // String result (render as markdown)
  if (typeof result === 'string') {
    // Check for binary data
    if (containsBinaryData(result)) {
      return {
        html: '<div class="outcome-binary-notice">Result contains binary data</div>',
        isTruncated: false,
        remainingLines: 0,
        rawContent: result,
      };
    }

    const truncationInfo = truncateMarkdownContent(result, isExpanded);
    const html = renderMarkdown(truncationInfo.content);

    return {
      html,
      isTruncated: truncationInfo.isTruncated,
      remainingLines: truncationInfo.remainingLines,
      rawContent: result,
    };
  }

  // Object result (render as JSON)
  const truncationInfo = truncateJsonContent(result, isExpanded);
  const highlighted = tokenizeJson(truncationInfo.content);
  const html = `<pre class="outcome-json-content">${highlighted}</pre>`;

  return {
    html,
    isTruncated: truncationInfo.isTruncated,
    remainingLines: truncationInfo.remainingLines,
    rawContent: JSON.stringify(result, null, 2),
  };
}

// ============================================================================
// Panel HTML Generation
// ============================================================================

/**
 * Generate checkmark icon SVG for success state
 */
function getSuccessIcon(): string {
  return `<svg class="outcome-icon outcome-icon-success" viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
  </svg>`;
}

/**
 * Generate X icon SVG for error state
 */
function getErrorIcon(): string {
  return `<svg class="outcome-icon outcome-icon-error" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
  </svg>`;
}

/**
 * Generate clipboard icon SVG for copy button
 */
function getClipboardIcon(): string {
  return `<svg class="outcome-copy-icon" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6z"/>
    <path d="M2 6a2 2 0 0 1 2-2v10h8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"/>
  </svg>`;
}

/**
 * Generate sources line HTML
 */
function generateSourcesLine(sources: string[] | undefined): string {
  if (!sources || sources.length === 0) {
    return '';
  }

  const escapedSources = sources.map(s => escapeHtml(s)).join(', ');
  return `<div class="outcome-sources">Sources: ${escapedSources}</div>`;
}

/**
 * Generate copy button HTML
 */
function generateCopyButton(rawContent: string): string {
  const escapedContent = escapeHtml(rawContent).replace(/'/g, '&#39;');
  return `
    <button class="outcome-copy-btn" data-raw-content="${escapedContent}" title="Copy to clipboard">
      ${getClipboardIcon()}
      <span class="outcome-copy-text">Copy</span>
    </button>
  `.trim();
}

/**
 * Generate "Show full result..." link for truncated content
 */
function generateShowMoreLink(isExpanded: boolean, remainingLines: number): string {
  if (remainingLines <= 0) {
    return '';
  }

  const linkText = isExpanded ? 'Show less...' : `Show full result... (${remainingLines} more lines)`;
  return `
    <button class="outcome-show-more" data-action="${isExpanded ? 'collapse' : 'expand'}">
      ${linkText}
    </button>
  `.trim();
}

/**
 * Generate success state panel HTML
 */
function generateSuccessPanel(state: OutcomePanelState): string {
  const { html, isTruncated, remainingLines, rawContent } = renderResultContent(
    state.result,
    state.isExpanded
  );

  const sourcesHtml = generateSourcesLine(state.sources);
  const copyButtonHtml = rawContent ? generateCopyButton(rawContent) : '';
  const showMoreHtml = isTruncated ? generateShowMoreLink(state.isExpanded, remainingLines) : '';

  return `
    <div class="outcome-panel outcome-panel-success" id="outcomePanel">
      <div class="outcome-header">
        ${getSuccessIcon()}
        <span class="outcome-title">Workflow Result</span>
        ${copyButtonHtml}
      </div>
      <div class="outcome-content">
        ${html}
        ${showMoreHtml}
      </div>
      ${sourcesHtml}
    </div>
  `.trim();
}

/**
 * Generate error state panel HTML
 */
function generateErrorPanel(state: OutcomePanelState): string {
  const errorMessage = escapeHtml(state.errorMessage || 'An unknown error occurred');

  return `
    <div class="outcome-panel outcome-panel-error" id="outcomePanel">
      <div class="outcome-header">
        ${getErrorIcon()}
        <span class="outcome-title">Workflow Error</span>
      </div>
      <div class="outcome-content">
        <div class="outcome-error-message">${errorMessage}</div>
      </div>
    </div>
  `.trim();
}

/**
 * Generate complete outcome panel HTML based on state
 * Returns empty string when status is 'hidden'
 */
export function generateOutcomePanelHtml(state: OutcomePanelState): string {
  switch (state.status) {
    case 'hidden':
      return '';
    case 'success':
      return generateSuccessPanel(state);
    case 'error':
      return generateErrorPanel(state);
    default:
      return '';
  }
}

// ============================================================================
// CSS Styles
// ============================================================================

/**
 * Generate CSS styles for the outcome panel
 * Follows the same architecture as logPanelHtmlGenerator.ts
 */
export function generateOutcomePanelCss(): string {
  return `
    /* Outcome Panel Container */
    .outcome-panel {
      border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #444));
      border-radius: 4px;
      margin-top: 16px;
      overflow: hidden;
    }

    /* Success State Styling */
    .outcome-panel-success {
      background-color: var(--vscode-editor-background);
    }

    /* Error State Styling */
    .outcome-panel-error {
      background-color: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.1));
      border-color: var(--vscode-inputValidation-errorBorder, #be1100);
    }

    /* Panel Header */
    .outcome-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #444));
      background-color: var(--vscode-editor-background);
    }

    .outcome-panel-error .outcome-header {
      border-bottom-color: var(--vscode-inputValidation-errorBorder, #be1100);
    }

    .outcome-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      flex: 1;
    }

    /* Icons */
    .outcome-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .outcome-icon-success {
      color: var(--vscode-testing-iconPassed, #4ec9b0);
    }

    .outcome-icon-error {
      color: var(--vscode-errorForeground, #f48771);
    }

    /* Content Area */
    .outcome-content {
      padding: 12px;
      font-size: 13px;
      line-height: 1.5;
      color: var(--vscode-foreground);
    }

    /* Markdown Styles */
    .outcome-paragraph {
      margin: 0 0 12px 0;
    }

    .outcome-paragraph:last-child {
      margin-bottom: 0;
    }

    .outcome-h1, .outcome-h2, .outcome-h3,
    .outcome-h4, .outcome-h5, .outcome-h6 {
      margin: 16px 0 8px 0;
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    .outcome-h1:first-child, .outcome-h2:first-child, .outcome-h3:first-child,
    .outcome-h4:first-child, .outcome-h5:first-child, .outcome-h6:first-child {
      margin-top: 0;
    }

    .outcome-h1 { font-size: 1.5em; }
    .outcome-h2 { font-size: 1.3em; }
    .outcome-h3 { font-size: 1.15em; }
    .outcome-h4 { font-size: 1.05em; }
    .outcome-h5 { font-size: 1em; }
    .outcome-h6 { font-size: 0.95em; color: var(--vscode-descriptionForeground); }

    .outcome-list {
      margin: 8px 0;
      padding-left: 24px;
    }

    .outcome-list-item {
      margin: 4px 0;
    }

    .outcome-code-inline {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.9em;
      background-color: var(--vscode-textCodeBlock-background, rgba(0, 0, 0, 0.2));
      padding: 2px 6px;
      border-radius: 3px;
    }

    .outcome-code-block {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      background-color: var(--vscode-textCodeBlock-background, rgba(0, 0, 0, 0.2));
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 12px 0;
    }

    .outcome-code-block code {
      white-space: pre;
    }

    /* JSON Styles */
    .outcome-json-content {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      line-height: 1.4;
      margin: 0;
      padding: 8px;
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #333));
      border-radius: 3px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* Empty Result */
    .outcome-empty-result {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }

    /* Binary Data Notice */
    .outcome-binary-notice {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      padding: 8px;
      background-color: var(--vscode-textCodeBlock-background, rgba(0, 0, 0, 0.2));
      border-radius: 4px;
    }

    /* Error Message */
    .outcome-error-message {
      color: var(--vscode-foreground);
      font-size: 13px;
    }

    /* Sources Line */
    .outcome-sources {
      padding: 8px 12px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      border-top: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #444));
    }

    /* Copy Button */
    .outcome-copy-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 4px 8px;
      font-size: 11px;
      border-radius: 3px;
      cursor: pointer;
    }

    .outcome-copy-btn:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .outcome-copy-btn:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }

    .outcome-copy-btn.copied {
      background-color: var(--vscode-testing-iconPassed, #4ec9b0);
      color: var(--vscode-button-foreground);
    }

    .outcome-copy-icon {
      width: 12px;
      height: 12px;
    }

    /* Show More Link */
    .outcome-show-more {
      display: block;
      width: 100%;
      margin-top: 8px;
      padding: 6px 8px;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-textLink-foreground);
      border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border, #333));
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      font-family: var(--vscode-font-family);
      text-align: left;
    }

    .outcome-show-more:hover {
      background-color: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05));
      text-decoration: underline;
    }
  `;
}

/**
 * Generate JavaScript handlers for outcome panel interactions
 */
export function generateOutcomePanelJs(): string {
  return `
    // Outcome panel copy button handler
    document.addEventListener('click', function(e) {
      const copyBtn = e.target.closest('.outcome-copy-btn');
      if (copyBtn) {
        const rawContent = copyBtn.dataset.rawContent;
        if (rawContent) {
          // Decode HTML entities
          const textarea = document.createElement('textarea');
          textarea.innerHTML = rawContent;
          const decodedContent = textarea.value;

          navigator.clipboard.writeText(decodedContent).then(() => {
            copyBtn.classList.add('copied');
            const textSpan = copyBtn.querySelector('.outcome-copy-text');
            if (textSpan) {
              textSpan.textContent = 'Copied!';
            }
            setTimeout(() => {
              copyBtn.classList.remove('copied');
              if (textSpan) {
                textSpan.textContent = 'Copy';
              }
            }, 2000);
          }).catch(err => {
            console.error('Failed to copy:', err);
          });
        }
      }

      // Show more/less handler
      const showMoreBtn = e.target.closest('.outcome-show-more');
      if (showMoreBtn) {
        const action = showMoreBtn.dataset.action;
        vscode.postMessage({
          command: 'outcomePanelToggleExpand',
          expand: action === 'expand'
        });
      }
    });
  `;
}
