#!/bin/bash
# =============================================================================
# Agentify Setup - Policy Engine
# =============================================================================
# Sets up the AgentCore Policy Engine using Natural Language policy generation:
#   - Creates Policy Engine (or finds existing)
#   - Generates Cedar policies from .txt descriptions
#   - Uses hash-based change detection to avoid redundant generation
#   - Associates Policy Engine with Gateway
#
# This script can be run standalone or called by setup.sh
#
# Usage:
#   ./scripts/setup-policies.sh                    # Setup policies
#   ./scripts/setup-policies.sh --region eu-west-1 # Setup in specific region
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
    echo "Setup AgentCore Policy Engine with Cedar policies."
    echo ""
    echo "Options:"
    echo "  --region, -r REGION    AWS region (default: us-east-1)"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                     # Setup policies"
    echo "  $0 --region eu-west-1  # Setup in EU region"
    echo ""
    echo "Prerequisites:"
    echo "  - Gateway must be configured (gateway_config.json)"
    echo "  - Policy descriptions in policies/*.txt"
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
# Hash Functions for Change Detection
# =============================================================================

# Calculate file hash (cross-platform)
calculate_file_hash() {
    local file="$1"
    if command -v sha256sum &> /dev/null; then
        sha256sum "$file" | cut -d' ' -f1
    elif command -v shasum &> /dev/null; then
        shasum -a 256 "$file" | cut -d' ' -f1
    else
        # Fallback: use md5 if available
        if command -v md5sum &> /dev/null; then
            md5sum "$file" | cut -d' ' -f1
        elif command -v md5 &> /dev/null; then
            md5 -q "$file"
        else
            echo ""
        fi
    fi
}

# Get stored hash for a policy from infrastructure.json
get_stored_policy_hash() {
    local policy_name="$1"
    local config_file="$2"
    if [ -f "$config_file" ] && command -v jq &> /dev/null; then
        jq -r ".policy.hashes.\"${policy_name}\" // empty" "$config_file" 2>/dev/null
    else
        echo ""
    fi
}

# Update stored hash for a policy in infrastructure.json
update_stored_policy_hash() {
    local policy_name="$1"
    local hash_value="$2"
    local config_file="$3"

    if [ -f "$config_file" ] && command -v jq &> /dev/null; then
        # Ensure policy.hashes object exists, then update the specific hash
        jq --arg name "$policy_name" --arg hash "$hash_value" \
           '.policy.hashes = (.policy.hashes // {}) | .policy.hashes[$name] = $hash' \
           "$config_file" > "${config_file}.tmp" && mv "${config_file}.tmp" "$config_file"
    fi
}

# =============================================================================
# Policy Helper Functions
# =============================================================================

# Delete a policy by name
delete_policy_by_name() {
    local policy_engine_id="$1"
    local policy_name="$2"
    local region="$3"

    # Get policy ID from list output
    local policy_id
    policy_id=$(uv run agentcore policy list-policies \
        --policy-engine-id "$policy_engine_id" \
        --region "$region" 2>&1 | grep -i "$policy_name" | grep -oE "${policy_name}-[a-zA-Z0-9]+" | head -1 || true)

    if [ -n "$policy_id" ]; then
        print_step "  Deleting outdated policy: $policy_id"
        uv run agentcore policy delete-policy \
            --policy-engine-id "$policy_engine_id" \
            --policy-id "$policy_id" \
            --region "$region" 2>/dev/null || true
    fi
}

# Find existing policy engine by name in AWS
find_existing_policy_engine() {
    local name="$1"
    local region="$2"

    # Use AWS CLI directly for JSON output
    local list_output
    list_output=$(aws bedrock-agentcore-control list-policy-engines --region "${region}" 2>/dev/null) || return 1

    # Parse JSON to find matching engine by name
    if command -v jq &> /dev/null; then
        echo "$list_output" | jq -r ".policyEngines[] | select(.name == \"${name}\") | .policyEngineId" 2>/dev/null | head -1
    else
        # Fallback: use grep
        echo "$list_output" | grep -oE "\"policyEngineId\":\s*\"${name}-[a-zA-Z0-9]+\"" | sed 's/.*"\([^"]*\)"$/\1/' | head -1
    fi
}

# =============================================================================
# Main
# =============================================================================

main() {
    # Initialize common variables
    init_common "$CUSTOM_REGION"

    show_banner "Policy Engine Setup"

    POLICIES_DIR="${PROJECT_ROOT}/policies"

    # Check prerequisites
    if ! check_prerequisites; then
        exit 0
    fi

    # Get or create Policy Engine
    POLICY_ENGINE_ID=""
    get_or_create_policy_engine

    if [ -z "$POLICY_ENGINE_ID" ]; then
        print_error "Could not create or find Policy Engine"
        exit 1
    fi

    # Generate and create policies
    generate_policies

    # Associate with Gateway
    associate_with_gateway

    # Show configuration summary
    show_policy_summary
}

# =============================================================================
# Check Prerequisites
# =============================================================================

check_prerequisites() {
    # Check for policy files
    POLICY_TXT_FILES=$(find "$POLICIES_DIR" -name "*.txt" 2>/dev/null | head -1)

    if [ -z "$POLICY_TXT_FILES" ]; then
        print_warning "No policies/ directory or .txt policy description files found"
        print_warning "Skipping Policy Engine setup"
        echo ""
        echo "To create policies, add .txt files with natural language descriptions to:"
        echo "  ${POLICIES_DIR}/"
        return 1
    fi

    # Check for gateway config
    if [ ! -f "$GATEWAY_CONFIG" ]; then
        print_warning "No Gateway configured (gateway_config.json not found)"
        print_warning "Skipping Policy Engine setup. Run setup-gateway.sh first."
        return 1
    fi

    # Get Gateway ARN
    GATEWAY_ARN=$(jq -r '.gateway_arn // empty' "$GATEWAY_CONFIG" 2>/dev/null)

    if [ -z "$GATEWAY_ARN" ]; then
        print_warning "No Gateway ARN found in gateway_config.json"
        return 1
    fi

    cd "${CDK_DIR}"
    ensure_agentcore_toolkit
    cd "${PROJECT_ROOT}"

    return 0
}

# =============================================================================
# Get or Create Policy Engine
# =============================================================================

get_or_create_policy_engine() {
    # Sanitize project name for policy engine (AWS requires ^[A-Za-z][A-Za-z0-9_]*$)
    POLICY_ENGINE_NAME=$(echo "${PROJECT_NAME}_policy_engine" | sed 's/-/_/g')

    # Check if Policy Engine already exists - first in local config, then query AWS
    EXISTING_POLICY_ENGINE_ID=$(jq -r '.policy.policyEngineId // empty' "$INFRA_CONFIG" 2>/dev/null)

    if [ -z "$EXISTING_POLICY_ENGINE_ID" ]; then
        # Config file doesn't have it - check AWS directly
        print_step "Checking for existing Policy Engine in AWS..."
        EXISTING_POLICY_ENGINE_ID=$(find_existing_policy_engine "$POLICY_ENGINE_NAME" "$REGION")

        if [ -n "$EXISTING_POLICY_ENGINE_ID" ]; then
            print_success "Found existing Policy Engine in AWS: $EXISTING_POLICY_ENGINE_ID"
        fi
    fi

    if [ -n "$EXISTING_POLICY_ENGINE_ID" ]; then
        POLICY_ENGINE_ID="$EXISTING_POLICY_ENGINE_ID"
        print_success "Using existing Policy Engine: $POLICY_ENGINE_ID"
        return
    fi

    # Create new Policy Engine
    print_step "Creating Policy Engine: ${POLICY_ENGINE_NAME}..."

    cd "${CDK_DIR}"

    POLICY_ENGINE_OUTPUT=$(uv run agentcore policy create-policy-engine \
        --name "${POLICY_ENGINE_NAME}" \
        --description "Generated by Agentify from Step 4 security inputs" \
        --region "${REGION}" 2>&1) || true

    cd "${PROJECT_ROOT}"

    # Extract Policy Engine ID from output
    POLICY_ENGINE_ID=$(echo "$POLICY_ENGINE_OUTPUT" | grep -i "Engine ID:" | sed 's/.*Engine ID:[[:space:]]*//' | head -1 || true)

    # Alternative extraction if above fails
    if [ -z "$POLICY_ENGINE_ID" ]; then
        POLICY_ENGINE_ID=$(echo "$POLICY_ENGINE_OUTPUT" | grep -oE "${POLICY_ENGINE_NAME}-[a-zA-Z0-9_]+" | head -1 || true)
    fi

    if [ -n "$POLICY_ENGINE_ID" ]; then
        print_success "Policy Engine created: $POLICY_ENGINE_ID"
    else
        print_warning "Could not extract Policy Engine ID from output:"
        echo "$POLICY_ENGINE_OUTPUT"
        print_warning "Attempting to list policy engines to find it..."

        POLICY_ENGINE_ID=$(find_existing_policy_engine "$POLICY_ENGINE_NAME" "$REGION")

        if [ -n "$POLICY_ENGINE_ID" ]; then
            print_success "Found Policy Engine: $POLICY_ENGINE_ID"
        fi
    fi
}

# =============================================================================
# Generate Policies
# =============================================================================

generate_policies() {
    print_step "Processing policy files..."

    POLICY_COUNT=0
    GENERATION_FAILURES=0

    cd "${CDK_DIR}"

    for POLICY_FILE in "$POLICIES_DIR"/*.txt; do
        if [ -f "$POLICY_FILE" ]; then
            process_policy_file "$POLICY_FILE"
        fi
    done

    cd "${PROJECT_ROOT}"

    if [ $POLICY_COUNT -gt 0 ]; then
        print_success "Processed $POLICY_COUNT Cedar policies"
    fi
    if [ $GENERATION_FAILURES -gt 0 ]; then
        print_warning "$GENERATION_FAILURES policy generation(s) failed"
    fi
}

process_policy_file() {
    local policy_file="$1"
    local policy_base_name
    policy_base_name=$(basename "$policy_file" .txt)

    # Convert hyphens to underscores (policy names must match ^[A-Za-z][A-Za-z0-9_]*$)
    local policy_name
    policy_name=$(echo "$policy_base_name" | sed 's/-/_/g')

    # Read natural language description
    local policy_description
    policy_description=$(cat "$policy_file")

    print_step "Checking policy: $policy_name"

    # Hash-based change detection
    local current_hash stored_hash
    current_hash=$(calculate_file_hash "$policy_file")
    stored_hash=$(get_stored_policy_hash "$policy_name" "$INFRA_CONFIG")

    if [ -n "$current_hash" ] && [ "$current_hash" = "$stored_hash" ]; then
        print_success "  Policy $policy_name unchanged (hash match), skipping"
        POLICY_COUNT=$((POLICY_COUNT + 1))
        return
    fi

    # Check if policy already exists in AWS
    local policy_name_prefix existing_aws_policy
    policy_name_prefix=$(echo "$policy_name" | cut -c1-15)
    existing_aws_policy=$(uv run agentcore policy list-policies \
        --policy-engine-id "$POLICY_ENGINE_ID" \
        --region "${REGION}" 2>&1 | grep -i "$policy_name_prefix" || true)

    if [ -n "$stored_hash" ]; then
        # Hash differs - need to delete and recreate
        print_step "  Policy content changed, deleting old version..."
        delete_policy_by_name "$POLICY_ENGINE_ID" "$policy_name" "${REGION}"
    elif [ -n "$existing_aws_policy" ]; then
        # Migration case: AWS policy exists but no stored hash
        print_success "  Policy $policy_name exists in AWS, storing hash for future detection"
        update_stored_policy_hash "$policy_name" "$current_hash" "$INFRA_CONFIG"
        POLICY_COUNT=$((POLICY_COUNT + 1))
        return
    fi

    # Generate Cedar from natural language
    generate_cedar_policy "$policy_name" "$policy_description" "$current_hash"
}

generate_cedar_policy() {
    local policy_name="$1"
    local policy_description="$2"
    local current_hash="$3"

    print_step "Generating Cedar policy from NL: $policy_name"
    echo "  Description: $policy_description"

    # Add timestamp to generation name to ensure uniqueness
    local generation_timestamp generation_name
    generation_timestamp=$(date +%s)
    generation_name="${policy_name}_${generation_timestamp}"

    # Step 1: Start policy generation
    local generation_output generation_id
    generation_output=$(uv run agentcore policy start-policy-generation \
        --policy-engine-id "$POLICY_ENGINE_ID" \
        --name "$generation_name" \
        --resource-arn "$GATEWAY_ARN" \
        --content "$policy_description" \
        --region "${REGION}" 2>&1) || true

    # Extract Generation ID from output
    generation_id=$(echo "$generation_output" | grep -i "Generation ID:" | sed 's/.*Generation ID:[[:space:]]*//' | head -1 || true)

    if [ -z "$generation_id" ]; then
        generation_id=$(echo "$generation_output" | grep -oE "${generation_name}-[a-zA-Z0-9]+" | head -1 || true)
    fi

    if [ -z "$generation_id" ]; then
        print_warning "Failed to start generation for $policy_name"
        echo "$generation_output"
        GENERATION_FAILURES=$((GENERATION_FAILURES + 1))
        return
    fi

    print_step "  Generation started: $generation_id"

    # Step 2: Poll until generation is complete
    poll_for_completion "$generation_id" "$policy_name" "$current_hash"
}

poll_for_completion() {
    local generation_id="$1"
    local policy_name="$2"
    local current_hash="$3"

    local max_poll_attempts=30
    local poll_interval=2
    local poll_count=0
    local generation_status="GENERATING"

    while [ "$generation_status" = "GENERATING" ] && [ $poll_count -lt $max_poll_attempts ]; do
        sleep $poll_interval
        poll_count=$((poll_count + 1))

        local status_output
        status_output=$(uv run agentcore policy get-policy-generation \
            --policy-engine-id "$POLICY_ENGINE_ID" \
            --generation-id "$generation_id" \
            --region "${REGION}" 2>&1) || true

        generation_status=$(echo "$status_output" | grep -i "Status:" | sed 's/.*Status:[[:space:]]*//' | head -1 || true)

        if [ -z "$generation_status" ]; then
            generation_status="GENERATING"
        fi

        echo -n "."
    done
    echo ""

    if [ "$generation_status" != "GENERATED" ]; then
        print_warning "Generation failed or timed out for $policy_name (status: $generation_status)"
        GENERATION_FAILURES=$((GENERATION_FAILURES + 1))
        return
    fi

    print_step "  Generation complete, extracting Cedar..."

    # Step 3: Get generated Cedar from assets
    extract_and_create_policy "$generation_id" "$policy_name" "$current_hash"
}

extract_and_create_policy() {
    local generation_id="$1"
    local policy_name="$2"
    local current_hash="$3"

    local policy_def_file
    policy_def_file=$(mktemp)

    python3 "${SCRIPT_DIR}/extract_cedar.py" "$POLICY_ENGINE_ID" "$generation_id" "${REGION}" "$policy_def_file"
    local extract_status=$?

    if [ $extract_status -ne 0 ] || [ ! -s "$policy_def_file" ]; then
        print_warning "Could not extract Cedar from generation assets for $policy_name"
        rm -f "$policy_def_file"
        GENERATION_FAILURES=$((GENERATION_FAILURES + 1))
        return
    fi

    local policy_def
    policy_def=$(cat "$policy_def_file")
    rm -f "$policy_def_file"

    # Create the policy
    print_step "  Creating policy: $policy_name"
    if uv run agentcore policy create-policy \
        --policy-engine-id "$POLICY_ENGINE_ID" \
        --name "$policy_name" \
        --description "Generated via NL from: $(echo "$policy_def" | head -c 100)..." \
        --definition "$policy_def" \
        --region "${REGION}" 2>&1 | tee /tmp/policy_create_output.txt | grep -q "Policy creation initiated"; then
        print_success "Created policy: $policy_name"
        POLICY_COUNT=$((POLICY_COUNT + 1))

        # Store hash for change detection on future runs
        if [ -n "$current_hash" ]; then
            update_stored_policy_hash "$policy_name" "$current_hash" "$INFRA_CONFIG"
        fi
    else
        print_warning "Failed to create policy $policy_name"
        if [ -f /tmp/policy_create_output.txt ]; then
            tail -10 /tmp/policy_create_output.txt
        fi
        GENERATION_FAILURES=$((GENERATION_FAILURES + 1))
    fi
}

# =============================================================================
# Associate with Gateway
# =============================================================================

associate_with_gateway() {
    print_step "Associating Policy Engine with Gateway..."

    # Get policy mode from config.json (default to LOG_ONLY for safety)
    local policy_mode
    policy_mode=$(jq -r '.policy.mode // "LOG_ONLY"' "$CONFIG_JSON" 2>/dev/null)
    if [ -z "$policy_mode" ] || [ "$policy_mode" = "null" ]; then
        policy_mode="LOG_ONLY"
    fi

    # Construct Policy Engine ARN
    POLICY_ENGINE_ARN="arn:aws:bedrock-agentcore:${REGION}:${ACCOUNT_ID}:policy-engine/${POLICY_ENGINE_ID}"

    cd "${CDK_DIR}"

    if uv run agentcore gateway update-gateway \
        --arn "$GATEWAY_ARN" \
        --policy-engine-arn "$POLICY_ENGINE_ARN" \
        --policy-engine-mode "$policy_mode" \
        --region "${REGION}" 2>/dev/null; then
        print_success "Policy Engine associated with Gateway (mode: $policy_mode)"
    else
        print_warning "Failed to associate Policy Engine with Gateway"
    fi

    cd "${PROJECT_ROOT}"

    # Save Policy Engine info to infrastructure.json
    if [ -f "$INFRA_CONFIG" ] && command -v jq &> /dev/null; then
        jq --arg peid "$POLICY_ENGINE_ID" \
           --arg pearn "$POLICY_ENGINE_ARN" \
           --arg mode "$policy_mode" \
            '.policy = (.policy // {}) + {"policyEngineId": $peid, "policyEngineArn": $pearn, "mode": $mode}' \
            "$INFRA_CONFIG" > "${INFRA_CONFIG}.tmp" && mv "${INFRA_CONFIG}.tmp" "$INFRA_CONFIG"
        print_success "Policy Engine config saved to infrastructure.json"
    fi

    # Export for summary
    export POLICY_MODE="$policy_mode"
}

# =============================================================================
# Show Policy Summary
# =============================================================================

show_policy_summary() {
    echo ""
    echo "============================================="
    echo "  Policy Engine Configuration"
    echo "============================================="
    echo ""
    echo "Policy Engine ID:  $POLICY_ENGINE_ID"
    echo "Enforcement Mode:  ${POLICY_MODE:-LOG_ONLY}"
    echo "Policies Created:  $POLICY_COUNT (via NL generation)"
    echo ""
    echo "List policies:"
    echo "  uv run agentcore policy list-policies --policy-engine-id $POLICY_ENGINE_ID --region ${REGION}"
    echo ""
    echo "Change enforcement mode:"
    echo "  uv run agentcore gateway update-gateway --arn $GATEWAY_ARN --policy-engine-mode ENFORCE --region ${REGION}"
    echo ""
}

# Run main
main
