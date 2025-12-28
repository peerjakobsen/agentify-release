/**
 * Tests for profile discovery service (Task Group 2)
 *
 * These tests validate AWS profile discovery from ~/.aws/credentials and ~/.aws/config files.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  discoverAwsProfiles,
  parseProfilesFromCredentialsFile,
  parseProfilesFromConfigFile,
} from '../services/profileDiscoveryService';

// Mock vscode module for tests
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue: string) => {
        if (key === 'aws.region') return 'us-east-1';
        return defaultValue;
      }),
    })),
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    fs: {
      stat: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      createDirectory: vi.fn(),
    },
    createFileSystemWatcher: vi.fn(() => ({
      onDidChange: vi.fn(),
      onDidDelete: vi.fn(),
      onDidCreate: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  Uri: {
    file: (path: string) => ({ fsPath: path }),
  },
  RelativePattern: vi.fn(),
  Disposable: vi.fn().mockImplementation((fn) => ({ dispose: fn })),
}));

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock os module
vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
}));

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockHomedir = vi.mocked(os.homedir);

describe('parseProfilesFromCredentialsFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse profile names from [profile_name] sections', () => {
    const credentialsContent = `
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

[production]
aws_access_key_id = AKIAI44QH8DHBEXAMPLE
aws_secret_access_key = je7MtGbClwBF/2Zp9Utk/h3yCo8nvbEXAMPLEKEY

[staging]
aws_access_key_id = AKIAI44QH8DHBEXAMPLE
aws_secret_access_key = je7MtGbClwBF/2Zp9Utk/h3yCo8nvbEXAMPLEKEY
`;

    const profiles = parseProfilesFromCredentialsFile(credentialsContent);
    expect(profiles).toEqual(['default', 'production', 'staging']);
  });

  it('should handle empty content', () => {
    const profiles = parseProfilesFromCredentialsFile('');
    expect(profiles).toEqual([]);
  });
});

describe('parseProfilesFromConfigFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse profile names from [profile name] sections and [default]', () => {
    const configContent = `
[default]
region = us-east-1

[profile dev]
region = us-west-2
sso_start_url = https://my-sso-portal.awsapps.com/start

[profile production]
region = us-east-1
role_arn = arn:aws:iam::123456789012:role/ProductionRole
source_profile = default
`;

    const profiles = parseProfilesFromConfigFile(configContent);
    expect(profiles).toEqual(['default', 'dev', 'production']);
  });

  it('should handle empty content', () => {
    const profiles = parseProfilesFromConfigFile('');
    expect(profiles).toEqual([]);
  });
});

describe('discoverAwsProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHomedir.mockReturnValue('/home/testuser');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return profiles from credentials file', async () => {
    const credentialsContent = `
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

[my-profile]
aws_access_key_id = AKIAI44QH8DHBEXAMPLE
aws_secret_access_key = je7MtGbClwBF/2Zp9Utk/h3yCo8nvbEXAMPLEKEY
`;

    mockExistsSync.mockImplementation((filepath) => {
      const pathStr = String(filepath);
      return pathStr.includes('credentials');
    });

    mockReadFileSync.mockImplementation((filepath) => {
      const pathStr = String(filepath);
      if (pathStr.includes('credentials')) {
        return credentialsContent;
      }
      return '';
    });

    const profiles = await discoverAwsProfiles();

    expect(profiles).toContain('default');
    expect(profiles).toContain('my-profile');
  });

  it('should return empty array when no profiles exist', async () => {
    mockExistsSync.mockReturnValue(false);

    const profiles = await discoverAwsProfiles();

    expect(profiles).toEqual([]);
  });

  it('should handle missing credentials file gracefully', async () => {
    // Config file exists but credentials file does not
    mockExistsSync.mockImplementation((filepath) => {
      const pathStr = String(filepath);
      return pathStr.includes('config');
    });

    const configContent = `
[default]
region = us-east-1

[profile sso-profile]
region = us-west-2
`;

    mockReadFileSync.mockImplementation((filepath) => {
      const pathStr = String(filepath);
      if (pathStr.includes('config')) {
        return configContent;
      }
      throw new Error('File not found');
    });

    const profiles = await discoverAwsProfiles();

    expect(profiles).toContain('default');
    expect(profiles).toContain('sso-profile');
  });

  it('should deduplicate profiles from both files and return sorted list', async () => {
    const credentialsContent = `
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

[shared-profile]
aws_access_key_id = AKIAI44QH8DHBEXAMPLE
aws_secret_access_key = je7MtGbClwBF/2Zp9Utk/h3yCo8nvbEXAMPLEKEY
`;

    const configContent = `
[default]
region = us-east-1

[profile shared-profile]
region = us-west-2

[profile config-only-profile]
region = eu-west-1
`;

    mockExistsSync.mockReturnValue(true);

    mockReadFileSync.mockImplementation((filepath) => {
      const pathStr = String(filepath);
      if (pathStr.includes('credentials')) {
        return credentialsContent;
      }
      if (pathStr.includes('config')) {
        return configContent;
      }
      return '';
    });

    const profiles = await discoverAwsProfiles();

    // Should be deduplicated and sorted
    expect(profiles).toEqual(['config-only-profile', 'default', 'shared-profile']);
  });
});
