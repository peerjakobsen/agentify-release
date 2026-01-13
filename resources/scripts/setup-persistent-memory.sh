#!/bin/bash
# =============================================================================
# Agentify Setup - Persistent Memory (Long-Term)
# =============================================================================
# Sets up AgentCore Memory for persistent user preference storage:
#   - Creates a Memory resource with semantic strategy
#   - Configures retention based on wizard settings (7, 30, or 90 days)
#   - Stores PERSISTENT_MEMORY_ID in infrastructure.json
#
# This script can be run standalone or called by setup.sh
#
# Usage:
#   ./scripts/setup-persistent-memory.sh                    # Setup persistent memory
#   ./scripts/setup-persistent-memory.sh --region eu-west-1 # Setup in specific region
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
    echo "Setup AgentCore Memory for persistent user preference storage."
    echo ""
    echo "Options:"
    echo "  --region, -r REGION    AWS region (default: us-east-1)"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                     # Setup persistent memory"
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

    show_banner "Persistent Memory Setup (Long-Term)"

    # Check if persistent memory is enabled in config
    if ! check_persistent_memory_enabled; then
        print_warning "Persistent Memory is disabled in config"
        print_warning "Skipping Persistent Memory setup. Enable it in the Agentify wizard (Step 4) to use."
        exit 0
    fi

    # Check if persistent memory already exists (idempotent)
    if check_persistent_memory_exists; then
        print_success "Persistent Memory already configured in infrastructure.json"
        show_persistent_memory_status
        exit 0
    fi

    setup_persistent_memory
    store_persistent_memory_config
    show_persistent_memory_status
}

# =============================================================================
# Check if Persistent Memory is Enabled
# =============================================================================

check_persistent_memory_enabled() {
    if ! command -v jq &> /dev/null; then
        print_warning "jq not found, assuming persistent memory is disabled"
        return 1
    fi

    # Check wizard-state.json first (primary source from Agentify wizard)
    if [ -f "$WIZARD_STATE" ]; then
        ENABLED=$(jq -r '.security.longTermMemoryEnabled // false' "$WIZARD_STATE" 2>/dev/null)
        if [ "$ENABLED" = "true" ]; then
            return 0
        elif [ "$ENABLED" = "false" ]; then
            return 1
        fi
    fi

    # Fallback to config.json for backward compatibility
    if [ -f "$CONFIG_JSON" ]; then
        ENABLED=$(jq -r '.memory.persistence.enabled // false' "$CONFIG_JSON" 2>/dev/null)
        if [ "$ENABLED" = "true" ]; then
            return 0
        fi
    fi

    # Default to disabled if no config found
    return 1
}

# =============================================================================
# Check if Persistent Memory Already Exists
# =============================================================================

check_persistent_memory_exists() {
    if [ ! -f "$INFRA_JSON" ]; then
        return 1
    fi

    if ! command -v jq &> /dev/null; then
        return 1
    fi

    # Check if persistentMemory.memoryId exists in infrastructure.json
    EXISTING_ID=$(jq -r '.persistentMemory.memoryId // empty' "$INFRA_JSON" 2>/dev/null)

    if [ -n "$EXISTING_ID" ]; then
        PERSISTENT_MEMORY_ID="$EXISTING_ID"
        export PERSISTENT_MEMORY_ID
        return 0
    fi

    return 1
}

# =============================================================================
# Persistent Memory Setup
# =============================================================================

setup_persistent_memory() {
    cd "${CDK_DIR}"

    # Ensure AgentCore toolkit is installed
    ensure_agentcore_toolkit

    # Get retention days from wizard-state.json or config.json (default 30)
    RETENTION_DAYS=30
    if command -v jq &> /dev/null; then
        if [ -f "$WIZARD_STATE" ]; then
            RETENTION_DAYS=$(jq -r '.security.ltmRetentionDays // 30' "$WIZARD_STATE" 2>/dev/null)
        elif [ -f "$CONFIG_JSON" ]; then
            RETENTION_DAYS=$(jq -r '.memory.persistence.retentionDays // 30' "$CONFIG_JSON" 2>/dev/null)
        fi
    fi

    # Validate retention days (must be 7, 30, or 90)
    case "$RETENTION_DAYS" in
        7|30|90)
            ;;
        *)
            print_warning "Invalid retention days: ${RETENTION_DAYS}. Defaulting to 30."
            RETENTION_DAYS=30
            ;;
    esac

    # Get strategy name from wizard-state.json or config.json (default UserPreferences)
    STRATEGY_NAME="UserPreferences"
    if command -v jq &> /dev/null; then
        if [ -f "$WIZARD_STATE" ]; then
            # Convert wizard strategy names to valid memory strategy names
            LTM_STRATEGY=$(jq -r '.security.ltmStrategy // "user_preference"' "$WIZARD_STATE" 2>/dev/null)
            case "$LTM_STRATEGY" in
                user_preference) STRATEGY_NAME="UserPreferences" ;;
                semantic) STRATEGY_NAME="SemanticFacts" ;;
                *) STRATEGY_NAME="UserPreferences" ;;
            esac
        elif [ -f "$CONFIG_JSON" ]; then
            CUSTOM_STRATEGY=$(jq -r '.memory.persistence.strategyName // empty' "$CONFIG_JSON" 2>/dev/null)
            if [ -n "$CUSTOM_STRATEGY" ]; then
                STRATEGY_NAME="$CUSTOM_STRATEGY"
            fi
        fi
    fi

    # Build strategies JSON for semantic memory
    STRATEGIES_JSON="[{\"semanticMemoryStrategy\": {\"name\": \"${STRATEGY_NAME}\"}}]"

    # Convert project name to valid memory name (replace hyphens with underscores)
    # AgentCore Memory names must match: [a-zA-Z][a-zA-Z0-9_]{0,47}
    MEMORY_NAME="${PROJECT_NAME//-/_}_persistent_memory"

    print_step "Creating AgentCore Memory resource for persistent storage..."
    print_step "  Name: ${MEMORY_NAME}"
    print_step "  Strategy: semantic (${STRATEGY_NAME})"
    print_step "  Retention: ${RETENTION_DAYS} day(s)"

    # Create memory using agentcore CLI
    # Syntax: agentcore memory create <name> [OPTIONS]
    MEMORY_OUTPUT=$(uv run agentcore memory create "${MEMORY_NAME}" \
        --strategies "${STRATEGIES_JSON}" \
        --event-expiry-days "${RETENTION_DAYS}" \
        --region "${REGION}" \
        --wait 2>&1) || {
        print_error "Persistent Memory creation failed"
        echo "$MEMORY_OUTPUT"
        cd "${PROJECT_ROOT}"
        exit 1
    }

    # Extract PERSISTENT_MEMORY_ID from output
    # Output format: "Memory ID: support_triage_persistent_memory-0BCgey361B"
    PERSISTENT_MEMORY_ID=$(echo "$MEMORY_OUTPUT" | grep -E "^Memory ID:" | sed 's/Memory ID: *//')

    if [ -z "$PERSISTENT_MEMORY_ID" ]; then
        # Try alternative: "Created memory: support_triage_persistent_memory-0BCgey361B"
        PERSISTENT_MEMORY_ID=$(echo "$MEMORY_OUTPUT" | grep -E "Created memory:" | sed 's/Created memory: *//' | head -1)
    fi

    if [ -z "$PERSISTENT_MEMORY_ID" ]; then
        print_error "Could not extract Persistent Memory ID from output:"
        echo "$MEMORY_OUTPUT"
        cd "${PROJECT_ROOT}"
        exit 1
    fi

    print_success "Persistent Memory created: ${PERSISTENT_MEMORY_ID}"
    export PERSISTENT_MEMORY_ID

    cd "${PROJECT_ROOT}"
}

# =============================================================================
# Store Persistent Memory Config
# =============================================================================

store_persistent_memory_config() {
    if [ -z "$PERSISTENT_MEMORY_ID" ]; then
        print_warning "No PERSISTENT_MEMORY_ID to store"
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

    # Add persistentMemory section to infrastructure.json
    print_step "Storing Persistent Memory ID in infrastructure.json..."

    TMP_FILE=$(mktemp)
    jq --arg mid "$PERSISTENT_MEMORY_ID" '.persistentMemory.memoryId = $mid' "$INFRA_JSON" > "$TMP_FILE" && \
        mv "$TMP_FILE" "$INFRA_JSON"

    print_success "Persistent Memory ID stored in ${INFRA_JSON}"
}

# =============================================================================
# Show Persistent Memory Status
# =============================================================================

show_persistent_memory_status() {
    if [ -z "$PERSISTENT_MEMORY_ID" ]; then
        return
    fi

    echo ""
    echo "============================================="
    echo "  Persistent Memory Configuration (Long-Term)"
    echo "============================================="
    echo ""
    echo "Memory ID: ${PERSISTENT_MEMORY_ID}"
    echo ""
    echo "Usage in Python orchestrators:"
    echo "  from agents.shared import init_persistent_memory"
    echo "  init_persistent_memory(user_id='user-123', session_id='session-abc')"
    echo ""
    echo "Usage in agents:"
    echo "  from agents.shared import remember_preference, recall_preferences"
    echo "  remember_preference('communication', 'style', 'formal')"
    echo "  recall_preferences('communication style')"
    echo ""
    echo "Environment variable for agents:"
    echo "  PERSISTENT_MEMORY_ID=${PERSISTENT_MEMORY_ID}"
    echo ""
}

# Run main
main
