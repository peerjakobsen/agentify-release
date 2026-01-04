#!/bin/bash

# Release script for Agentify public releases
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.2.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if version argument is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Version argument required${NC}"
    echo "Usage: ./scripts/release.sh <version>"
    echo "Example: ./scripts/release.sh 0.2.0"
    exit 1
fi

VERSION=$1
VSIX_FILE="dist/agentify-${VERSION}.vsix"
PUBLIC_DIR="public-release"
RELEASES_DIR="${PUBLIC_DIR}/releases"
PUBLIC_REPO="github.com/peerjakobsen/agentify-release"

echo -e "${YELLOW}Releasing Agentify v${VERSION}...${NC}"

# Check if VSIX file exists
if [ ! -f "$VSIX_FILE" ]; then
    echo -e "${RED}Error: VSIX file not found at ${VSIX_FILE}${NC}"
    echo "Please build the extension first with: npm run package"
    exit 1
fi

# Create releases directory if it doesn't exist
mkdir -p "$RELEASES_DIR"

# Copy VSIX to releases folder
echo "Copying ${VSIX_FILE} to ${RELEASES_DIR}/"
cp "$VSIX_FILE" "$RELEASES_DIR/"

# Update changelog reminder
echo -e "${YELLOW}Reminder: Update ${PUBLIC_DIR}/CHANGELOG.md with release notes${NC}"

# Git operations in private repo
echo "Committing changes to private repo..."
git add "${RELEASES_DIR}/agentify-${VERSION}.vsix"
git add "${PUBLIC_DIR}/CHANGELOG.md" 2>/dev/null || true
git commit -m "release: v${VERSION} public release"

echo -e "${GREEN}Private repo commit complete.${NC}"

# Push subtree to public repo
echo "Pushing subtree to public repo..."
git subtree push --prefix="$PUBLIC_DIR" "git@${PUBLIC_REPO}.git" main

echo -e "${GREEN}Release v${VERSION} complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify the release at https://${PUBLIC_REPO}"
echo "  2. Create a GitHub release with the VSIX file"
