/**
 * AWS Profile Discovery Service
 * Discovers available AWS profiles from ~/.aws/credentials and ~/.aws/config files
 *
 * Following patterns established in credentialProvider.ts and tableValidator.ts
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Interface for profile discovery service operations
 * Enables dependency injection and testing
 */
export interface IProfileDiscoveryService {
  /**
   * Get list of available AWS profiles
   * @returns Array of profile names sorted alphabetically
   */
  listAvailableProfiles(): Promise<string[]>;
}

/**
 * Parses profile names from AWS credentials file content
 * Credentials file uses [profile_name] sections directly
 *
 * @param content The content of ~/.aws/credentials file
 * @returns Array of profile names
 */
export function parseProfilesFromCredentialsFile(content: string): string[] {
  const profiles: string[] = [];

  // Match [profile_name] sections (simple bracket notation)
  const profileRegex = /^\[([^\]]+)\]\s*$/gm;
  let match: RegExpExecArray | null;

  while ((match = profileRegex.exec(content)) !== null) {
    const profileName = match[1].trim();
    if (profileName) {
      profiles.push(profileName);
    }
  }

  return profiles;
}

/**
 * Parses profile names from AWS config file content
 * Config file uses [profile name] sections (with 'profile' prefix) except for [default]
 *
 * @param content The content of ~/.aws/config file
 * @returns Array of profile names
 */
export function parseProfilesFromConfigFile(content: string): string[] {
  const profiles: string[] = [];

  // Match [default] or [profile name] sections
  const profileRegex = /^\[(?:profile\s+)?([^\]]+)\]\s*$/gm;
  let match: RegExpExecArray | null;

  while ((match = profileRegex.exec(content)) !== null) {
    const profileName = match[1].trim();
    if (profileName) {
      profiles.push(profileName);
    }
  }

  return profiles;
}

/**
 * Gets the path to the AWS credentials file
 * @returns Path to ~/.aws/credentials
 */
function getCredentialsFilePath(): string {
  return path.join(os.homedir(), '.aws', 'credentials');
}

/**
 * Gets the path to the AWS config file
 * @returns Path to ~/.aws/config
 */
function getConfigFilePath(): string {
  return path.join(os.homedir(), '.aws', 'config');
}

/**
 * Reads file content safely, returning empty string if file does not exist
 * @param filePath Path to the file
 * @returns File content or empty string
 */
function readFileSafely(filePath: string): string {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch {
    // File read failed - return empty string
  }
  return '';
}

/**
 * Discovers available AWS profiles from ~/.aws/credentials and ~/.aws/config files
 * Returns a deduplicated, alphabetically sorted list of profile names
 *
 * @returns Promise resolving to array of profile names
 */
export async function discoverAwsProfiles(): Promise<string[]> {
  const profiles = new Set<string>();

  // Read profiles from credentials file
  const credentialsPath = getCredentialsFilePath();
  const credentialsContent = readFileSafely(credentialsPath);
  if (credentialsContent) {
    const credentialsProfiles = parseProfilesFromCredentialsFile(credentialsContent);
    credentialsProfiles.forEach((profile) => profiles.add(profile));
  }

  // Read profiles from config file
  const configPath = getConfigFilePath();
  const configContent = readFileSafely(configPath);
  if (configContent) {
    const configProfiles = parseProfilesFromConfigFile(configContent);
    configProfiles.forEach((profile) => profiles.add(profile));
  }

  // Convert to sorted array
  return Array.from(profiles).sort();
}

/**
 * Profile discovery service implementation
 * Provides methods to discover available AWS profiles
 */
export class ProfileDiscoveryService implements IProfileDiscoveryService {
  /**
   * Get list of available AWS profiles
   * Reads from both ~/.aws/credentials and ~/.aws/config
   *
   * @returns Array of profile names sorted alphabetically
   */
  async listAvailableProfiles(): Promise<string[]> {
    return discoverAwsProfiles();
  }
}

/**
 * Singleton instance of the profile discovery service
 */
let profileDiscoveryServiceInstance: ProfileDiscoveryService | null = null;

/**
 * Get the profile discovery service singleton instance
 * @returns ProfileDiscoveryService instance
 */
export function getProfileDiscoveryService(): ProfileDiscoveryService {
  if (!profileDiscoveryServiceInstance) {
    profileDiscoveryServiceInstance = new ProfileDiscoveryService();
  }
  return profileDiscoveryServiceInstance;
}

/**
 * Reset the profile discovery service singleton
 * Useful for testing
 */
export function resetProfileDiscoveryService(): void {
  profileDiscoveryServiceInstance = null;
}
