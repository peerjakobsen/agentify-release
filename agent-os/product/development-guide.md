# Agentify Extension Development Guide

## Overview

Agentify is a Kiro IDE extension that helps AWS field teams transform customer value maps into working multi-agent demo applications. Since Kiro is built on Code OSS (the open-source foundation of VS Code), the Agentify extension is fully compatible with both VS Code and Kiro IDE.

This guide covers the development workflow, environment compatibility, and best practices for building and testing the extension.

---

## Environment Compatibility

### Architecture Foundation

```
┌─────────────────────────────────────────────────────────────────┐
│                        Code OSS                                 │
│                   (Open Source Base)                            │
├─────────────────────────────────────────────────────────────────┤
│                            │                                    │
│              ┌─────────────┴─────────────┐                      │
│              │                           │                      │
│              ▼                           ▼                      │
│       ┌─────────────┐             ┌─────────────┐               │
│       │   VS Code   │             │    Kiro     │               │
│       │             │             │             │               │
│       │ + Marketplace│            │ + Steering  │               │
│       │ + Copilot   │             │ + Specs     │               │
│       │ + ...       │             │ + Hooks     │               │
│       └─────────────┘             └─────────────┘               │
│                                                                 │
│       Same Extension API: vscode.*                              │
│       Same Package Format: .vsix                                │
│       Same Webview API                                          │
│       Same File System API                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### API Compatibility Matrix

| VS Code API | VS Code | Kiro | Notes |
|-------------|---------|------|-------|
| `vscode.commands` | ✅ | ✅ | Command registration and execution |
| `vscode.window` | ✅ | ✅ | Windows, panels, notifications |
| `vscode.workspace` | ✅ | ✅ | File system, configuration |
| `vscode.extensions` | ✅ | ✅ | Extension management |
| `vscode.env` | ✅ | ✅ | Environment info |
| `vscode.Uri` | ✅ | ✅ | URI handling |
| `vscode.EventEmitter` | ✅ | ✅ | Event system |
| `WebviewView` | ✅ | ✅ | Sidebar panels |
| `WebviewPanel` | ✅ | ✅ | Editor area panels |
| `StatusBarItem` | ✅ | ✅ | Status bar |
| `TreeView` | ✅ | ✅ | Tree views |
| `FileSystemWatcher` | ✅ | ✅ | File watching |

### Extension Package Compatibility

| Aspect | VS Code | Kiro | Identical? |
|--------|---------|------|------------|
| Package format | `.vsix` | `.vsix` | ✅ Yes |
| Manifest file | `package.json` | `package.json` | ✅ Yes |
| Activation events | Standard | Standard | ✅ Yes |
| Contribution points | Standard | Standard | ✅ Yes |
| Extension API namespace | `vscode.*` | `vscode.*` | ✅ Yes |
| Webview content security | Same CSP | Same CSP | ✅ Yes |

---

## Feature Availability by Environment

### Works in Both VS Code and Kiro

```
┌─────────────────────────────────────────────────────────────────┐
│                 UNIVERSAL FEATURES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Extension Infrastructure                                       │
│  ├── Extension activation and lifecycle                         │
│  ├── Command registration and execution                         │
│  ├── Activity Bar view containers                               │
│  ├── Webview panels (Demo Viewer, Ideation Wizard)              │
│  ├── Status bar items                                           │
│  └── Settings and configuration                                 │
│                                                                 │
│  Shared Services                                                │
│  ├── ConfigService (.agentify/config.json management)           │
│  ├── CredentialProvider (AWS credential chain)                  │
│  ├── DynamoDbClient (event polling)                             │
│  └── BedrockClient (Claude API calls)                           │
│                                                                 │
│  Demo Viewer Panel                                              │
│  ├── Workflow trigger (local Python subprocess)                 │
│  ├── stdout event streaming                                     │
│  ├── DynamoDB event polling                                     │
│  ├── React Flow graph visualization                             │
│  └── Execution log display                                      │
│                                                                 │
│  Ideation Wizard Panel                                          │
│  ├── Business objective input                                   │
│  ├── Claude conversation for gap-filling                        │
│  ├── Agent design interface                                     │
│  ├── Mock data strategy                                         │
│  └── Steering file generation                                   │
│                                                                 │
│  File Generation                                                │
│  ├── .agentify/config.json                                      │
│  ├── .kiro/steering/*.md files                                  │
│  └── Infrastructure templates                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Kiro-Only Features

```
┌─────────────────────────────────────────────────────────────────┐
│                   KIRO-EXCLUSIVE FEATURES                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Spec-Driven Development                                        │
│  ├── .kiro/steering/ file interpretation                        │
│  ├── Requirements generation from steering                      │
│  ├── Design document generation                                 │
│  ├── Task breakdown generation                                  │
│  └── Automated code generation from specs                       │
│                                                                 │
│  Kiro-Specific Integration                                      │
│  ├── kiro.startSpecFlow command                                 │
│  ├── Kiro AWS Explorer (future credential integration)          │
│  ├── Kiro hooks system                                          │
│  └── Kiro MCP server configuration                              │
│                                                                 │
│  End-to-End Workflow                                            │
│  ├── Ideation → Steering → Specs → Code pipeline                │
│  └── Automatic observability decorator injection                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Development Workflow

### Recommended Approach

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   PHASE 1: DEVELOP              PHASE 2: INTEGRATE              │
│   ┌─────────────────┐          ┌─────────────────┐              │
│   │                 │          │                 │              │
│   │    VS Code      │          │      Kiro       │              │
│   │                 │          │                 │              │
│   │  • F5 debugging │          │  • Full flow    │              │
│   │  • Fast reload  │          │  • Spec engine  │              │
│   │  • Breakpoints  │          │  • E2E testing  │              │
│   │  • Console logs │          │                 │              │
│   │                 │          │                 │              │
│   └────────┬────────┘          └────────┬────────┘              │
│            │                            │                       │
│            ▼                            ▼                       │
│   ┌─────────────────┐          ┌─────────────────┐              │
│   │ Test extension  │          │ Test complete   │              │
│   │ functionality:  │          │ pipeline:       │              │
│   │                 │          │                 │              │
│   │ • Panels render │          │ • Ideation →    │              │
│   │ • AWS clients   │          │   Steering →    │              │
│   │ • Event stream  │          │   Specs →       │              │
│   │ • Config CRUD   │          │   Agents →      │              │
│   │ • Status bar    │          │   Demo          │              │
│   └─────────────────┘          └─────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### When to Use Each Environment

| Task | Environment | Reason |
|------|-------------|--------|
| Extension development | VS Code | Better debugging tools, faster iteration |
| UI component development | VS Code | Hot reload, React DevTools |
| AWS client testing | VS Code | Works identically, easier debugging |
| Unit tests | VS Code | Standard test runners |
| Panel integration testing | VS Code | Full webview functionality |
| Spec-driven code generation | Kiro | Kiro-exclusive feature |
| End-to-end workflow testing | Kiro | Tests complete pipeline |
| Pre-release validation | Kiro | Production environment |
| Demo preparation | Kiro | Real usage environment |

---

## Project Setup

### Prerequisites

```bash
# Node.js 18+ required
node --version  # v18.x or higher

# VS Code for development
code --version  # 1.85+ recommended

# Kiro for integration testing
# Download from: https://kiro.dev

# AWS CLI configured (for testing AWS features)
aws sts get-caller-identity
```

### Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd agentify

# Install dependencies
npm install

# Build extension
npm run build

# Run tests
npm test
```

### Launch Configurations

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension (VS Code)",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}"
      ],
      "outFiles": [
        "${workspaceFolder}/dist/**/*.js"
      ],
      "preLaunchTask": "npm: watch"
    },
    {
      "name": "Run Extension (Kiro - macOS)",
      "type": "extensionHost",
      "request": "launch",
      "runtimeExecutable": "/Applications/Kiro.app/Contents/MacOS/Kiro",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}"
      ],
      "outFiles": [
        "${workspaceFolder}/dist/**/*.js"
      ],
      "preLaunchTask": "npm: watch"
    },
    {
      "name": "Run Extension (Kiro - Windows)",
      "type": "extensionHost",
      "request": "launch",
      "runtimeExecutable": "${env:LOCALAPPDATA}/Programs/Kiro/Kiro.exe",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}"
      ],
      "outFiles": [
        "${workspaceFolder}/dist/**/*.js"
      ],
      "preLaunchTask": "npm: watch"
    },
    {
      "name": "Run Extension (Kiro - Linux)",
      "type": "extensionHost",
      "request": "launch",
      "runtimeExecutable": "/usr/share/kiro/kiro",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}"
      ],
      "outFiles": [
        "${workspaceFolder}/dist/**/*.js"
      ],
      "preLaunchTask": "npm: watch"
    },
    {
      "name": "Extension Tests",
      "type": "extensionHost",
      "request": "launch",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}",
        "--extensionTestsPath=${workspaceFolder}/dist/test/suite/index"
      ],
      "outFiles": [
        "${workspaceFolder}/dist/**/*.js"
      ],
      "preLaunchTask": "npm: watch"
    }
  ]
}
```

### Tasks Configuration

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "npm",
      "script": "watch",
      "problemMatcher": "$tsc-watch",
      "isBackground": true,
      "presentation": {
        "reveal": "never"
      },
      "group": {
        "kind": "build",
        "isDefault": true
      }
    },
    {
      "type": "npm",
      "script": "build",
      "problemMatcher": "$tsc",
      "group": "build"
    },
    {
      "type": "npm",
      "script": "lint",
      "problemMatcher": ["$eslint-stylish"],
      "group": "test"
    }
  ]
}
```

---

## Environment Detection

### Detecting Kiro vs VS Code

```typescript
// src/utils/environment.ts

/**
 * Checks if the extension is running in Kiro IDE
 */
export function isKiroEnvironment(): boolean {
  const appName = vscode.env.appName.toLowerCase();
  return appName.includes('kiro');
}

/**
 * Checks if the extension is running in VS Code
 */
export function isVSCodeEnvironment(): boolean {
  const appName = vscode.env.appName.toLowerCase();
  return appName.includes('visual studio code') || appName.includes('code');
}

/**
 * Gets the current IDE name for display purposes
 */
export function getIDEName(): string {
  if (isKiroEnvironment()) {
    return 'Kiro';
  }
  return 'VS Code';
}

/**
 * Checks if Kiro-specific features are available
 */
export function hasKiroFeatures(): boolean {
  if (!isKiroEnvironment()) {
    return false;
  }

  // Check for Kiro-specific commands
  return vscode.commands.getCommands(true).then(commands =>
    commands.some(cmd => cmd.startsWith('kiro.'))
  );
}
```

### Graceful Degradation Pattern

```typescript
// src/services/kiroIntegration.ts

import * as vscode from 'vscode';
import { isKiroEnvironment, getIDEName } from '../utils/environment';

/**
 * Triggers Kiro's spec-driven development flow
 * Gracefully degrades in VS Code with helpful messaging
 */
export async function triggerKiroSpecFlow(prompt: string): Promise<boolean> {
  if (!isKiroEnvironment()) {
    const result = await vscode.window.showWarningMessage(
      'Spec-driven development requires Kiro IDE. ' +
      'The steering files have been generated in .kiro/steering/. ' +
      'Open this project in Kiro to continue with code generation.',
      'Open Kiro Documentation',
      'OK'
    );

    if (result === 'Open Kiro Documentation') {
      vscode.env.openExternal(vscode.Uri.parse('https://kiro.dev/docs'));
    }

    return false;
  }

  try {
    // Execute Kiro-specific command
    await vscode.commands.executeCommand('kiro.startSpecFlow', {
      prompt,
      steeringPath: '.kiro/steering'
    });
    return true;
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to start spec flow: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return false;
  }
}

/**
 * Shows feature availability based on current environment
 */
export function showFeatureAvailability(): void {
  const ide = getIDEName();
  const features = [
    `✅ Demo Viewer panel`,
    `✅ Ideation Wizard panel`,
    `✅ AWS integration (DynamoDB, Bedrock)`,
    `✅ Local workflow execution`,
    `✅ Steering file generation`,
    isKiroEnvironment() ? `✅ Spec-driven code generation` : `⚠️ Spec-driven code generation (Kiro only)`,
    isKiroEnvironment() ? `✅ End-to-end agent pipeline` : `⚠️ End-to-end agent pipeline (Kiro only)`,
  ];

  vscode.window.showInformationMessage(
    `Agentify running in ${ide}:\n${features.join('\n')}`,
    { modal: true }
  );
}
```

### Conditional UI Elements

```typescript
// src/panels/ideationWizardPanel.ts

export class IdeationWizardPanel {
  private async renderTriggerButton(): Promise<string> {
    if (isKiroEnvironment()) {
      return `
        <button id="triggerSpecs" class="primary-button">
          🚀 Generate Agent Code with Kiro
        </button>
      `;
    } else {
      return `
        <button id="triggerSpecs" class="secondary-button" title="Requires Kiro IDE">
          📄 Generate Steering Files
        </button>
        <p class="hint">
          💡 Open this project in Kiro IDE to generate agent code from steering files
        </p>
      `;
    }
  }
}
```

---

## Installation Methods

### Development Installation (Symlink)

Fastest iteration for development:

```bash
# macOS/Linux - VS Code
ln -s $(pwd) ~/.vscode/extensions/agentify

# macOS - Kiro
ln -s $(pwd) ~/.kiro/extensions/agentify

# Windows - VS Code (run as admin)
mklink /D "%USERPROFILE%\.vscode\extensions\agentify" "%CD%"

# Windows - Kiro (run as admin)
mklink /D "%USERPROFILE%\.kiro\extensions\agentify" "%CD%"
```

### Package Installation (.vsix)

For testing packaged extension:

```bash
# Package the extension
npx vsce package

# Install in VS Code
code --install-extension agentify-0.1.0.vsix

# Install in Kiro
kiro --install-extension agentify-0.1.0.vsix

# Or use command palette:
# "Extensions: Install from VSIX..."
```

### Uninstallation

```bash
# VS Code
code --uninstall-extension <publisher>.agentify

# Kiro
kiro --uninstall-extension <publisher>.agentify

# Or remove symlink
rm ~/.vscode/extensions/agentify
rm ~/.kiro/extensions/agentify
```

---

## Testing Strategy

### Test Categories

```
┌─────────────────────────────────────────────────────────────────┐
│                      TEST PYRAMID                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                        ┌───────┐                                │
│                       /  E2E   \        Run in Kiro             │
│                      /  Tests   \       (spec flow)             │
│                     /─────────────\                             │
│                    /  Integration  \    Run in both             │
│                   /     Tests       \   (AWS, panels)           │
│                  /───────────────────\                          │
│                 /     Unit Tests      \ Run anywhere            │
│                /  (types, services)    \(fast, isolated)        │
│               /─────────────────────────\                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Running Tests

```bash
# Unit tests (fast, no VS Code required)
npm run test:unit

# Integration tests (requires VS Code Extension Host)
npm run test:integration

# All tests
npm test

# Watch mode for development
npm run test:watch
```

### Environment-Specific Tests

```typescript
// src/test/suite/environment.test.ts

import { isKiroEnvironment } from '../../utils/environment';

describe('Environment Detection', () => {
  it('should detect current environment', () => {
    // This test result depends on where it's run
    const isKiro = isKiroEnvironment();
    console.log(`Running in: ${isKiro ? 'Kiro' : 'VS Code'}`);

    // Environment-specific assertions
    if (isKiro) {
      // Kiro-specific test assertions
    } else {
      // VS Code-specific test assertions
    }
  });
});

describe('Kiro-Only Features', function() {
  before(function() {
    if (!isKiroEnvironment()) {
      this.skip(); // Skip these tests in VS Code
    }
  });

  it('should trigger spec flow', async () => {
    // Test Kiro-specific functionality
  });
});
```

---

## Debugging Tips

### VS Code Debugging

1. **Set breakpoints** in TypeScript source files
2. **Press F5** to launch Extension Development Host
3. **Open Output panel** → select "Agentify" channel
4. **Use Debug Console** for evaluating expressions

### Common Issues

| Issue | VS Code | Kiro | Solution |
|-------|---------|------|----------|
| Extension not loading | Check activation events | Same | Verify `package.json` activation events |
| Webview blank | Check CSP | Same | Review Content-Security-Policy in webview |
| AWS credentials fail | Check credential chain | Same | Run `aws sts get-caller-identity` |
| Panel not appearing | Check viewsContainers | Same | Verify Activity Bar configuration |
| Commands not found | Check contributes.commands | Same | Ensure command IDs match |

### Logging

```typescript
// Use output channel for debugging
const outputChannel = vscode.window.createOutputChannel('Agentify');

export function log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const timestamp = new Date().toISOString();
  const prefix = level.toUpperCase().padEnd(5);
  outputChannel.appendLine(`[${timestamp}] ${prefix} ${message}`);

  // Also log to console for Extension Development Host debugging
  if (level === 'error') {
    console.error(`[Agentify] ${message}`);
  } else {
    console.log(`[Agentify] ${message}`);
  }
}
```

---

## Publishing

### Registry Options

| Registry | VS Code | Kiro | Notes |
|----------|---------|------|-------|
| VS Code Marketplace | ✅ | ❌ | Microsoft-owned, requires publisher account |
| Open VSX | ✅ | ✅ | Open source registry, Kiro's default |
| Private | ✅ | ✅ | Direct .vsix distribution |

### Publishing to Open VSX

```bash
# Install ovsx CLI
npm install -g ovsx

# Login (get token from https://open-vsx.org)
ovsx login

# Publish
ovsx publish agentify-0.1.0.vsix
```

### Internal Distribution

For AWS internal use, distribute `.vsix` directly:

```bash
# Package
npx vsce package

# Share via S3, internal portal, etc.
aws s3 cp agentify-0.1.0.vsix s3://internal-tools/extensions/
```

---

## Summary

### Key Takeaways

1. **Same extension format** — `.vsix` packages work in both VS Code and Kiro
2. **Same API** — `vscode.*` namespace is identical
3. **Develop in VS Code** — Better debugging, faster iteration
4. **Test in Kiro** — For spec-driven features and end-to-end validation
5. **Graceful degradation** — Kiro-only features show helpful messages in VS Code
6. **Environment detection** — Use `isKiroEnvironment()` for conditional behavior

### Quick Reference

```bash
# Development
npm run watch        # Watch mode
F5                   # Launch in VS Code
F5 (Kiro config)     # Launch in Kiro

# Testing
npm test             # Run all tests
npm run test:watch   # Watch mode

# Packaging
npx vsce package     # Create .vsix

# Installation
code --install-extension agentify-0.1.0.vsix   # VS Code
kiro --install-extension agentify-0.1.0.vsix   # Kiro
```

---

## References

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Webview Guide](https://code.visualstudio.com/api/extension-guides/webview)
- [Kiro Documentation](https://kiro.dev/docs)
- [Open VSX Registry](https://open-vsx.org)
- [VSCE Packaging Tool](https://github.com/microsoft/vscode-vsce)
