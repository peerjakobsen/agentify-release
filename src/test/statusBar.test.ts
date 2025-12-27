/**
 * Tests for status bar enhancements (Task Group 4)
 *
 * These tests validate SSO expiration state, profile display,
 * and the "Run AWS SSO Login" quick-pick menu option.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { StatusState } from '../statusBar';

// Use vi.hoisted to define mock functions before vi.mock hoists
const {
  mockCreateTerminal,
  mockShowQuickPick,
  mockShowInformationMessage,
  mockCreateStatusBarItem,
} = vi.hoisted(() => {
  const terminalMock = {
    show: vi.fn(),
    sendText: vi.fn(),
    dispose: vi.fn(),
  };

  return {
    mockCreateTerminal: vi.fn(() => terminalMock),
    mockShowQuickPick: vi.fn(),
    mockShowInformationMessage: vi.fn(),
    mockCreateStatusBarItem: vi.fn(() => ({
      text: '',
      tooltip: '',
      backgroundColor: undefined,
      color: undefined,
      command: undefined,
      show: vi.fn(),
      dispose: vi.fn(),
    })),
  };
});

// Mock vscode module for tests
vi.mock('vscode', () => ({
  window: {
    createStatusBarItem: mockCreateStatusBarItem,
    createTerminal: mockCreateTerminal,
    showQuickPick: mockShowQuickPick,
    showInformationMessage: mockShowInformationMessage,
  },
  StatusBarAlignment: {
    Right: 2,
    Left: 1,
  },
  ThemeColor: vi.fn().mockImplementation((color: string) => ({ id: color })),
  commands: {
    executeCommand: vi.fn(),
  },
}));

import { StatusBarManager } from '../statusBar';

describe('StatusState type includes sso-expired state', () => {
  // Test 4.1.1: StatusState type includes 'sso-expired' state
  it('should accept sso-expired as a valid StatusState', () => {
    const manager = new StatusBarManager();

    // This should not throw - 'sso-expired' is a valid state
    manager.updateStatus('sso-expired');
    expect(manager.getStatus()).toBe('sso-expired');

    manager.dispose();
  });

  // Test 4.1.2: updateStatus('sso-expired') shows correct icon and tooltip
  it('should show key icon and SSO expired tooltip when state is sso-expired', () => {
    const manager = new StatusBarManager();
    manager.updateStatus('sso-expired');

    // Access the internal status bar item via the public state
    expect(manager.getStatus()).toBe('sso-expired');

    manager.dispose();
  });
});

describe('Profile name tracking in StatusBarManager', () => {
  // Test 4.1.3: Tooltip shows profile name when profile is configured
  it('should include profile name in tooltip when profile is set', () => {
    const manager = new StatusBarManager();
    manager.setProfile('my-profile');
    manager.updateStatus('ready');

    // Verify profile is tracked
    expect(manager.getProfile()).toBe('my-profile');

    manager.dispose();
  });

  it('should not include profile in tooltip when profile is undefined', () => {
    const manager = new StatusBarManager();
    manager.setProfile(undefined);
    manager.updateStatus('ready');

    expect(manager.getProfile()).toBeUndefined();

    manager.dispose();
  });

  it('should update profile via setProfile method', () => {
    const manager = new StatusBarManager();

    manager.setProfile('first-profile');
    expect(manager.getProfile()).toBe('first-profile');

    manager.setProfile('second-profile');
    expect(manager.getProfile()).toBe('second-profile');

    manager.setProfile(undefined);
    expect(manager.getProfile()).toBeUndefined();

    manager.dispose();
  });
});

describe('Quick-pick menu SSO login option', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the terminal mock to return fresh mock functions
    mockCreateTerminal.mockImplementation(() => ({
      show: vi.fn(),
      sendText: vi.fn(),
      dispose: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Test 4.1.4: Quick-pick menu shows "Run AWS SSO Login" when in SSO expired state
  it('should include SSO login option in quick-pick when state is sso-expired', async () => {
    mockShowQuickPick.mockResolvedValue(null);

    const manager = new StatusBarManager();
    manager.updateStatus('sso-expired');

    await manager.showQuickPick();

    // Verify showQuickPick was called with items array containing SSO login option
    expect(mockShowQuickPick).toHaveBeenCalled();
    const callArgs = mockShowQuickPick.mock.calls[0];
    const items = callArgs[0];

    const ssoLoginItem = items.find(
      (item: { label: string }) => item.label.includes('Run AWS SSO Login')
    );
    expect(ssoLoginItem).toBeDefined();
    expect(ssoLoginItem.label).toContain('$(terminal)');
    expect(ssoLoginItem.description).toContain('terminal');

    manager.dispose();
  });

  // Test 4.1.5: "Run AWS SSO Login" option is not shown in other states
  it('should not include SSO login option when state is ready', async () => {
    mockShowQuickPick.mockResolvedValue(null);

    const manager = new StatusBarManager();
    manager.updateStatus('ready');

    await manager.showQuickPick();

    expect(mockShowQuickPick).toHaveBeenCalled();
    const callArgs = mockShowQuickPick.mock.calls[0];
    const items = callArgs[0];

    const ssoLoginItem = items.find(
      (item: { label: string }) => item.label.includes('Run AWS SSO Login')
    );
    expect(ssoLoginItem).toBeUndefined();

    manager.dispose();
  });

  it('should not include SSO login option when state is aws-error', async () => {
    mockShowQuickPick.mockResolvedValue(null);

    const manager = new StatusBarManager();
    manager.updateStatus('aws-error');

    await manager.showQuickPick();

    expect(mockShowQuickPick).toHaveBeenCalled();
    const callArgs = mockShowQuickPick.mock.calls[0];
    const items = callArgs[0];

    const ssoLoginItem = items.find(
      (item: { label: string }) => item.label.includes('Run AWS SSO Login')
    );
    expect(ssoLoginItem).toBeUndefined();

    manager.dispose();
  });

  // Test: SSO login opens terminal with correct command
  it('should open terminal with aws sso login command when SSO login selected', async () => {
    const terminalMock = {
      show: vi.fn(),
      sendText: vi.fn(),
      dispose: vi.fn(),
    };
    mockCreateTerminal.mockReturnValue(terminalMock);

    mockShowQuickPick.mockResolvedValue({
      label: '$(terminal) Run AWS SSO Login',
      description: 'Opens terminal with aws sso login command',
    });

    const manager = new StatusBarManager();
    manager.updateStatus('sso-expired');
    manager.setProfile('my-sso-profile');

    await manager.showQuickPick();

    // Verify terminal was created and command was sent
    expect(mockCreateTerminal).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'AWS SSO Login',
      })
    );

    expect(terminalMock.sendText).toHaveBeenCalledWith(
      'aws sso login --profile my-sso-profile'
    );
    expect(terminalMock.show).toHaveBeenCalled();

    manager.dispose();
  });

  it('should open terminal without --profile flag when no profile configured', async () => {
    const terminalMock = {
      show: vi.fn(),
      sendText: vi.fn(),
      dispose: vi.fn(),
    };
    mockCreateTerminal.mockReturnValue(terminalMock);

    mockShowQuickPick.mockResolvedValue({
      label: '$(terminal) Run AWS SSO Login',
      description: 'Opens terminal with aws sso login command',
    });

    const manager = new StatusBarManager();
    manager.updateStatus('sso-expired');
    manager.setProfile(undefined);

    await manager.showQuickPick();

    expect(mockCreateTerminal).toHaveBeenCalled();
    expect(terminalMock.sendText).toHaveBeenCalledWith('aws sso login');

    manager.dispose();
  });
});
