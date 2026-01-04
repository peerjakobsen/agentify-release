# Agentify

A VS Code/Kiro extension for prototyping agentic AI demos with real-time execution observability and workflow ideation.

## What is Agentify?

Agentify helps you:
- **Monitor AI agent workflows** - Real-time execution logs, tool calls, and outcome visualization
- **Design agent systems** - Interactive ideation wizard to plan AI agent architectures
- **Integrate with AWS** - DynamoDB for event storage, Bedrock for AI-powered suggestions

## Installation

### From VSIX File

1. Download the latest `.vsix` file from the [Releases](./releases/) folder
2. In VS Code/Kiro, open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run `Extensions: Install from VSIX...`
4. Select the downloaded `.vsix` file
5. Reload the window when prompted

### Requirements

- VS Code 1.85+ or Kiro
- AWS account with SSO configured
- Node.js 22+

## Getting Started

After installation:

1. Open the Command Palette and run `Agentify: Initialize Project`
2. Follow the setup wizard to configure AWS SSO and DynamoDB
3. Use `Agentify: Open Demo Viewer` to monitor executions
4. Use `Agentify: Open Ideation Wizard` to design new workflows

## Documentation

See the [docs](./docs/) folder for detailed guides.

## Issues and Feature Requests

Found a bug or have an idea? Please [open an issue](../../issues/new/choose) using the appropriate template:

- **Bug Report** - Something isn't working as expected
- **Feature Request** - Suggest an enhancement or new feature

When reporting issues, please include:
- Your VS Code/Kiro version
- Agentify extension version
- Steps to reproduce the issue
- Any relevant error messages

## License

This project is provided as-is for prototyping and demonstration purposes.
