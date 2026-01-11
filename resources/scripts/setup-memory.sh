#!/bin/bash
# =============================================================================
# Agentify Setup - Cross-Agent Memory
# =============================================================================
# Sets up AgentCore Memory for cross-agent data sharing:
#   - Creates a Memory resource with semantic strategy
#   - Configures expiry based on wizard settings
#   - Stores MEMORY_ID in infrastructure.json
#
# This script can be run standalone or called by setup.sh
#
# Usage:
#   ./scripts/setup-memory.sh                    # Setup memory
#   ./scripts/setup-memory.sh --region eu-west-1 # Setup in specific region
# =============================================================================

set -e

# Source common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/setup-common.sh"

# =============================================================================
# Argument Parsing
# =============================================================================

show_help() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Setup AgentCore Memory for cross-agent data sharing."
    echo ""
    echo "Options:"
    echo "  --region, -r REGION    AWS region (default: us-east-1)"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                     # Setup memory"
    echo "  $0 --region eu-west-1  # Setup in EU region"
}

CUSTOM_REGION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --region|-r)
            CUSTOM_REGION="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# =============================================================================
# Main
# =============================================================================

main() {
    # Initialize common variables
    init_common "$CUSTOM_REGION"

    show_banner "Cross-Agent Memory Setup"

    # Check if memory is enabled in config
    if ! check_memory_enabled; then
        print_warning "Cross-Agent Memory is disabled in config"
        print_warning "Skipping Memory setup. Enable it in the Agentify wizard (Step 4) to use."
        exit 0
    fi

    # Check if memory already exists (idempotent)
    if check_memory_exists; then
        print_success "Memory already configured in infrastructure.json"
        show_memory_status
        exit 0
    fi

    setup_memory
    store_memory_config
    show_memory_status
}

# =============================================================================
# Check if Memory is Enabled
# =============================================================================

check_memory_enabled() {
    if [ ! -f "$CONFIG_JSON" ]; then
        print_warning "Config file not found: ${CONFIG_JSON}"
        return 1
    fi

    if ! command -v jq &> /dev/null; then
        print_warning "jq not found, assuming memory is enabled"
        return 0
    fi

    # Check memory.crossAgent.enabled in config
    ENABLED=$(jq -r '.memory.crossAgent.enabled // true' "$CONFIG_JSON" 2>/dev/null)

    if [ "$ENABLED" = "false" ]; then
        return 1
    fi

    return 0
}

# =============================================================================
# Check if Memory Already Exists
# =============================================================================

check_memory_exists() {
    if [ ! -f "$INFRA_JSON" ]; then
        return 1
    fi

    if ! command -v jq &> /dev/null; then
        return 1
    fi

    # Check if memory.memoryId exists in infrastructure.json
    EXISTING_ID=$(jq -r '.memory.memoryId // empty' "$INFRA_JSON" 2>/dev/null)

    if [ -n "$EXISTING_ID" ]; then
        MEMORY_ID="$EXISTING_ID"
        export MEMORY_ID
        return 0
    fi

    return 1
}

# =============================================================================
# Memory Setup
# =============================================================================

setup_memory() {
    cd "${CDK_DIR}"

    # Ensure AgentCore toolkit is installed
    ensure_agentcore_toolkit

    # Get expiry days from config (default 7)
    EXPIRY_DAYS=7
    if [ -f "$CONFIG_JSON" ] && command -v jq &> /dev/null; then
        EXPIRY_DAYS=$(jq -r '.memory.crossAgent.expiryDays // 7' "$CONFIG_JSON" 2>/dev/null)
    fi

    # Calculate expiry in seconds (days * 24 * 60 * 60)
    EXPIRY_SECONDS=$((EXPIRY_DAYS * 86400))

    print_step "Creating AgentCore Memory resource..."
    print_step "  Name: ${PROJECT_NAME}-memory"
    print_step "  Strategy: semantic"
    print_step "  Expiry: ${EXPIRY_DAYS} day(s)"

    # Create memory using agentcore CLI
    MEMORY_OUTPUT=$(uv run agentcore memory create \
        --name "${PROJECT_NAME}-memory" \
        --strategy semantic \
        --expiry "${EXPIRY_SECONDS}" \
        --region "${REGION}" 2>&1) || {
        print_error "Memory creation failed"
        echo "$MEMORY_OUTPUT"
        cd "${PROJECT_ROOT}"
        exit 1
    }

    # Extract MEMORY_ID from output
    # Output format may vary, try common patterns
    MEMORY_ID=$(echo "$MEMORY_OUTPUT" | grep -oE 'mem-[a-zA-Z0-9]+' | head -1)

    if [ -z "$MEMORY_ID" ]; then
        # Try alternative extraction
        MEMORY_ID=$(echo "$MEMORY_OUTPUT" | grep -i "memory_id" | grep -oE '[a-zA-Z0-9-]+' | tail -1)
    fi

    if [ -z "$MEMORY_ID" ]; then
        print_error "Could not extract Memory ID from output:"
        echo "$MEMORY_OUTPUT"
        cd "${PROJECT_ROOT}"
        exit 1
    fi

    print_success "Memory created: ${MEMORY_ID}"
    export MEMORY_ID

    cd "${PROJECT_ROOT}"
}

# =============================================================================
# Store Memory Config
# =============================================================================

store_memory_config() {
    if [ -z "$MEMORY_ID" ]; then
        print_warning "No MEMORY_ID to store"
        return 1
    fi

    if ! command -v jq &> /dev/null; then
        print_warning "jq not found, skipping infrastructure.json update"
        return 1
    fi

    # Create infrastructure.json if it doesn't exist
    if [ ! -f "$INFRA_JSON" ]; then
        echo '{}' > "$INFRA_JSON"
    fi

    # Add memory section to infrastructure.json
    print_step "Storing Memory ID in infrastructure.json..."

    TMP_FILE=$(mktemp)
    jq --arg mid "$MEMORY_ID" '.memory.memoryId = $mid' "$INFRA_JSON" > "$TMP_FILE" && \
        mv "$TMP_FILE" "$INFRA_JSON"

    print_success "Memory ID stored in ${INFRA_JSON}"
}

# =============================================================================
# Show Memory Status
# =============================================================================

show_memory_status() {
    if [ -z "$MEMORY_ID" ]; then
        return
    fi

    echo ""
    echo "============================================="
    echo "  Cross-Agent Memory Configuration"
    echo "============================================="
    echo ""
    echo "Memory ID: ${MEMORY_ID}"
    echo ""
    echo "Usage in Python orchestrators:"
    echo "  from agents.shared import init_memory"
    echo "  init_memory(session_id)"
    echo ""
    echo "Environment variable for agents:"
    echo "  MEMORY_ID=${MEMORY_ID}"
    echo ""
}

# Run main
main
