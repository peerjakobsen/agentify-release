#!/bin/bash
# =============================================================================
# Agentify Setup - MCP Gateway
# =============================================================================
# Sets up the AgentCore MCP Gateway for tool invocations:
#   - Registers Lambda functions as gateway targets
#   - Configures OAuth authentication via Cognito
#   - Stores credentials in SSM Parameter Store
#
# This script can be run standalone or called by setup.sh
#
# Usage:
#   ./scripts/setup-gateway.sh                    # Setup gateway
#   ./scripts/setup-gateway.sh --region eu-west-1 # Setup in specific region
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
    echo "Setup AgentCore MCP Gateway for tool invocations."
    echo ""
    echo "Options:"
    echo "  --region, -r REGION    AWS region (default: us-east-1)"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                     # Setup gateway"
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

    show_banner "MCP Gateway Setup"

    # Check if schemas exist
    SCHEMAS_DIR="${CDK_DIR}/gateway/schemas"
    SCHEMA_FILES=$(find "$SCHEMAS_DIR" -name "*.json" 2>/dev/null | head -1)

    if [ -z "$SCHEMA_FILES" ]; then
        print_warning "No gateway schemas found in ${SCHEMAS_DIR}"
        print_warning "Skipping Gateway setup. Add schemas and re-run this script."
        echo ""
        echo "To create schemas, add JSON schema files to:"
        echo "  ${SCHEMAS_DIR}/"
        exit 0
    fi

    setup_gateway
    store_credentials_in_ssm
    show_testing_commands
}

# =============================================================================
# Gateway Setup
# =============================================================================

setup_gateway() {
    cd "${CDK_DIR}"

    # Ensure AgentCore toolkit is installed
    ensure_agentcore_toolkit

    print_step "Running Gateway setup..."
    if uv run python gateway/setup_gateway.py --region "${REGION}" --name "${PROJECT_NAME}-gateway"; then
        print_success "Gateway setup complete"
    else
        print_error "Gateway setup failed"
        print_warning "You can run it manually: python cdk/gateway/setup_gateway.py"
        cd "${PROJECT_ROOT}"
        exit 1
    fi

    cd "${PROJECT_ROOT}"
}

# =============================================================================
# Store Credentials in SSM
# =============================================================================

store_credentials_in_ssm() {
    if [ ! -f "$GATEWAY_CONFIG" ]; then
        print_warning "Gateway config not found: ${GATEWAY_CONFIG}"
        return 1
    fi

    if ! command -v jq &> /dev/null; then
        print_warning "jq not found, skipping SSM credential storage"
        return 1
    fi

    # Load gateway info
    GATEWAY_ID=$(jq -r '.gateway_id // empty' "$GATEWAY_CONFIG")
    GATEWAY_URL=$(jq -r '.gateway_url // empty' "$GATEWAY_CONFIG")
    GATEWAY_ARN=$(jq -r '.gateway_arn // empty' "$GATEWAY_CONFIG")

    if [ -z "$GATEWAY_ID" ]; then
        print_warning "Gateway ID not found in config"
        return 1
    fi

    # List registered targets
    print_step "Listing registered Gateway targets..."
    PAGER="" uv run agentcore gateway list-mcp-gateway-targets --id "$GATEWAY_ID" --region "${REGION}" 2>/dev/null || true

    # Store credentials in SSM
    print_step "Storing Gateway credentials in SSM Parameter Store..."
    SSM_PREFIX="/agentify/${PROJECT_NAME}/gateway"

    DEPLOY_CLIENT_ID=$(jq -r '.oauth.client_id // empty' "$GATEWAY_CONFIG")
    DEPLOY_CLIENT_SECRET=$(jq -r '.oauth.client_secret // empty' "$GATEWAY_CONFIG")
    DEPLOY_TOKEN_ENDPOINT=$(jq -r '.oauth.token_endpoint // empty' "$GATEWAY_CONFIG")
    DEPLOY_SCOPE=$(jq -r '.oauth.scope // empty' "$GATEWAY_CONFIG")

    # Write each parameter
    aws ssm put-parameter --name "${SSM_PREFIX}/url" --value "${GATEWAY_URL}" --type "String" --overwrite --region "${REGION}" 2>/dev/null || true
    aws ssm put-parameter --name "${SSM_PREFIX}/client_id" --value "${DEPLOY_CLIENT_ID}" --type "String" --overwrite --region "${REGION}" 2>/dev/null || true
    aws ssm put-parameter --name "${SSM_PREFIX}/client_secret" --value "${DEPLOY_CLIENT_SECRET}" --type "SecureString" --overwrite --region "${REGION}" 2>/dev/null || true
    aws ssm put-parameter --name "${SSM_PREFIX}/token_endpoint" --value "${DEPLOY_TOKEN_ENDPOINT}" --type "String" --overwrite --region "${REGION}" 2>/dev/null || true
    aws ssm put-parameter --name "${SSM_PREFIX}/scope" --value "${DEPLOY_SCOPE}" --type "String" --overwrite --region "${REGION}" 2>/dev/null || true

    print_success "Gateway credentials stored in SSM: ${SSM_PREFIX}/*"

    # Export for other scripts
    export GATEWAY_ID GATEWAY_URL GATEWAY_ARN SSM_PREFIX
}

# =============================================================================
# Show Testing Commands
# =============================================================================

show_testing_commands() {
    if [ -z "$GATEWAY_ID" ]; then
        return
    fi

    echo ""
    echo "============================================="
    echo "  MCP Gateway Testing Commands"
    echo "============================================="
    echo ""
    echo "List targets:"
    echo "  uv run agentcore gateway list-mcp-gateway-targets --id ${GATEWAY_ID} --region ${REGION}"
    echo ""
    echo "Test a tool (replace TOOL_NAME and INPUT):"
    echo "  # First get OAuth token from gateway_config.json"
    echo "  # Then call: POST ${GATEWAY_URL}"
    echo "  # With JSON-RPC body: {\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"TARGET___TOOL\",\"arguments\":{}}}"
    echo ""
    echo "Gateway credentials stored in SSM: ${SSM_PREFIX}/*"
    echo ""
}

# Run main
main
