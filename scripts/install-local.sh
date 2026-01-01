#!/bin/bash
#
# Install Local Extension
# Builds and installs the Agentify extension into VS Code
#
# Usage:
#   ./scripts/install-local.sh         # Install to VS Code
#   ./scripts/install-local.sh --cursor # Install to Cursor
#   ./scripts/install-local.sh --kiro   # Install to Kiro
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Determine which IDE to install to
IDE_CMD="code"
IDE_NAME="VS Code"

if [[ "$1" == "--cursor" ]]; then
    IDE_CMD="cursor"
    IDE_NAME="Cursor"
elif [[ "$1" == "--kiro" ]]; then
    IDE_CMD="kiro"
    IDE_NAME="Kiro"
fi

echo "==> Building Agentify extension..."
npm run compile

echo "==> Packaging extension..."
# Check if vsce is installed
if ! command -v vsce &> /dev/null; then
    echo "    Installing vsce..."
    npm install -g @vscode/vsce
fi

# Package the extension (suppress warnings for local dev)
vsce package --out agentify-latest.vsix --allow-missing-repository --skip-license

echo "==> Installing to $IDE_NAME..."
# Install the extension
$IDE_CMD --install-extension agentify-latest.vsix --force

echo "==> Cleaning up..."
rm -f agentify-latest.vsix

echo ""
echo "✓ Agentify extension installed to $IDE_NAME!"
echo ""
echo "  Reload your $IDE_NAME window to use the latest version:"
echo "  - Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)"
echo "  - Type 'Reload Window' and press Enter"
echo ""
