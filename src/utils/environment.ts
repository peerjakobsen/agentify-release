/**
 * Environment Detection Utilities
 * Checks whether the extension is running in Kiro IDE or VS Code
 *
 * Task Group 6: Support for environment-aware functionality in Step 8
 */

import * as vscode from 'vscode';

/**
 * Check if the extension is running in Kiro IDE
 * Kiro IDE is a VS Code fork with specific extensions and features
 *
 * Detection methods:
 * 1. Check for Kiro-specific extensions
 * 2. Check for Kiro-specific configuration
 * 3. Check app name (appName may contain 'Kiro')
 *
 * @returns true if running in Kiro IDE, false if running in VS Code
 */
export function isKiroEnvironment(): boolean {
  // Method 1: Check for Kiro-specific extension
  const kiroExtension = vscode.extensions.getExtension('kiro.kiro');
  if (kiroExtension) {
    return true;
  }

  // Method 2: Check app name
  // VS Code reports 'Visual Studio Code' or 'code', Kiro reports 'Kiro'
  const appName = vscode.env.appName.toLowerCase();
  if (appName.includes('kiro')) {
    return true;
  }

  // Method 3: Check for Kiro-specific configuration
  const kiroConfig = vscode.workspace.getConfiguration('kiro');
  if (kiroConfig.has('enabled') && kiroConfig.get('enabled') === true) {
    return true;
  }

  return false;
}

/**
 * Get the Kiro learn more URL
 * Used when prompting VS Code users to try Kiro
 */
export function getKiroLearnMoreUrl(): string {
  return 'https://kiro.dev';
}
