#!/bin/bash
# =============================================================================
# Agentify Setup - CDK Infrastructure Deployment
# =============================================================================
# Deploys the shared CDK infrastructure for Agentify demos:
#   - VPC with private subnets (for AgentCore Runtime)
#   - DynamoDB table (for Demo Viewer event streaming)
#   - Lambda functions for Gateway tools (auto-discovered)
#
# This script can be run standalone or called by setup.sh
#
# Usage:
#   ./scripts/setup-cdk.sh                    # Deploy CDK infrastructure
#   ./scripts/setup-cdk.sh --region eu-west-1 # Deploy to specific region
#   ./scripts/setup-cdk.sh --skip             # Skip deployment, load existing
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
    echo "Deploy CDK infrastructure for Agentify."
    echo ""
    echo "Options:"
    echo "  --skip                 Skip deployment, load existing infrastructure"
    echo "  --region, -r REGION    AWS region (default: us-east-1)"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                     # Deploy infrastructure"
    echo "  $0 --region eu-west-1  # Deploy to EU region"
    echo "  $0 --skip              # Load existing infrastructure config"
}

SKIP_CDK=false
CUSTOM_REGION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip)
            SKIP_CDK=true
            shift
            ;;
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

    show_banner "CDK Infrastructure Deployment"

    if [ "$SKIP_CDK" = true ]; then
        skip_deployment
    else
        deploy_infrastructure
    fi

    # Output the infrastructure variables for other scripts
    echo ""
    echo "Infrastructure Outputs:"
    echo "  Private Subnets: ${SUBNET_IDS}"
    echo "  Security Group:  ${SG_ID}"
    echo "  DynamoDB Table:  ${TABLE_NAME}"
    echo ""
}

# =============================================================================
# Deploy Infrastructure
# =============================================================================

deploy_infrastructure() {
    print_step "Deploying CDK infrastructure..."

    # Change to CDK directory
    cd "${CDK_DIR}"

    # Install dependencies
    print_step "Installing CDK dependencies..."
    uv sync --quiet
    print_success "Dependencies installed"

    # Bootstrap CDK if needed
    print_step "Checking CDK bootstrap status..."
    if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region "${REGION}" &> /dev/null; then
        print_step "Bootstrapping CDK in ${REGION}..."
        uv run cdk bootstrap "aws://${ACCOUNT_ID}/${REGION}"
        print_success "CDK bootstrapped"
    else
        print_success "CDK already bootstrapped"
    fi

    # Deploy all stacks
    print_step "Deploying CDK stacks (this may take 5-10 minutes)..."
    uv run cdk deploy -c project="${PROJECT_NAME}" -c region="${REGION}" --all --require-approval never --outputs-file cdk-outputs.json
    print_success "CDK deployment complete"

    # Fetch infrastructure outputs
    fetch_outputs_from_cdk

    # Return to project root
    cd "${PROJECT_ROOT}"

    # Save config for later use
    save_infrastructure_config
}

# =============================================================================
# Fetch Outputs from CDK
# =============================================================================

fetch_outputs_from_cdk() {
    print_step "Fetching infrastructure outputs..."

    CDK_OUTPUTS_FILE="${CDK_DIR}/cdk-outputs.json"

    if [ -f "${CDK_OUTPUTS_FILE}" ] && command -v jq &> /dev/null; then
        # Parse outputs from CDK outputs file
        NETWORKING_STACK="Agentify-${PROJECT_NAME}-Networking-${REGION}"
        OBSERVABILITY_STACK="Agentify-${PROJECT_NAME}-Observability-${REGION}"

        SUBNET_IDS=$(jq -r ".\"${NETWORKING_STACK}\".PrivateSubnetIds // empty" "${CDK_OUTPUTS_FILE}" 2>/dev/null)
        SG_ID=$(jq -r ".\"${NETWORKING_STACK}\".AgentSecurityGroupId // empty" "${CDK_OUTPUTS_FILE}" 2>/dev/null)
        TABLE_NAME=$(jq -r ".\"${OBSERVABILITY_STACK}\".WorkflowEventsTableName // empty" "${CDK_OUTPUTS_FILE}" 2>/dev/null)
    else
        # Fallback to CloudFormation query
        fetch_outputs_from_cloudformation
    fi

    # Export for other scripts
    export SUBNET_IDS SG_ID TABLE_NAME
}

fetch_outputs_from_cloudformation() {
    NETWORKING_STACK="Agentify-${PROJECT_NAME}-Networking-${REGION}"
    OBSERVABILITY_STACK="Agentify-${PROJECT_NAME}-Observability-${REGION}"

    SUBNET_IDS=$(aws cloudformation describe-stacks \
        --stack-name "${NETWORKING_STACK}" \
        --query "Stacks[0].Outputs[?ExportName=='${PROJECT_NAME}-PrivateSubnetIds'].OutputValue" \
        --output text --region "${REGION}" 2>/dev/null)

    SG_ID=$(aws cloudformation describe-stacks \
        --stack-name "${NETWORKING_STACK}" \
        --query "Stacks[0].Outputs[?ExportName=='${PROJECT_NAME}-AgentSecurityGroupId'].OutputValue" \
        --output text --region "${REGION}" 2>/dev/null)

    TABLE_NAME=$(aws cloudformation describe-stacks \
        --stack-name "${OBSERVABILITY_STACK}" \
        --query "Stacks[0].Outputs[?ExportName=='${PROJECT_NAME}-WorkflowEventsTableName'].OutputValue" \
        --output text --region "${REGION}" 2>/dev/null)
}

# =============================================================================
# Skip Deployment (Load Existing)
# =============================================================================

skip_deployment() {
    print_warning "Skipping CDK deployment (--skip)"

    # Try to load from local config first
    if [ -f "${INFRA_CONFIG}" ]; then
        SUBNET_IDS=$(jq -r '.vpc_subnet_ids' "${INFRA_CONFIG}")
        SG_ID=$(jq -r '.vpc_security_group_id' "${INFRA_CONFIG}")
        TABLE_NAME=$(jq -r '.workflow_events_table // empty' "${INFRA_CONFIG}")
        print_success "Loaded infrastructure config from ${INFRA_CONFIG}"
    else
        # Fetch from CloudFormation
        print_step "Fetching infrastructure from CloudFormation..."
        fetch_outputs_from_cloudformation

        if [ -z "$SUBNET_IDS" ] || [ -z "$SG_ID" ]; then
            print_error "Infrastructure not found. Run without --skip first."
            exit 1
        fi
        print_success "Loaded infrastructure from CloudFormation"
    fi

    # Export for other scripts
    export SUBNET_IDS SG_ID TABLE_NAME
}

# =============================================================================
# Save Infrastructure Config
# =============================================================================

save_infrastructure_config() {
    CONFIG_FILE="${PROJECT_ROOT}/.agentify/infrastructure.json"
    mkdir -p "$(dirname "${CONFIG_FILE}")"

    # Check if file exists and preserve existing data (like policy hashes)
    if [ -f "${CONFIG_FILE}" ] && command -v jq &> /dev/null; then
        # Update only infrastructure fields, preserve others
        jq --arg pn "${PROJECT_NAME}" \
           --arg rg "${REGION}" \
           --arg sn "${SUBNET_IDS}" \
           --arg sg "${SG_ID}" \
           --arg tn "${TABLE_NAME}" \
           --arg dt "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
           '. + {
               project_name: $pn,
               region: $rg,
               vpc_subnet_ids: $sn,
               vpc_security_group_id: $sg,
               workflow_events_table: $tn,
               deployed_at: $dt
           }' "${CONFIG_FILE}" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "${CONFIG_FILE}"
    else
        # Create new config file
        cat > "${CONFIG_FILE}" << EOF
{
  "project_name": "${PROJECT_NAME}",
  "region": "${REGION}",
  "vpc_subnet_ids": "${SUBNET_IDS}",
  "vpc_security_group_id": "${SG_ID}",
  "workflow_events_table": "${TABLE_NAME}",
  "deployed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
    fi

    print_success "Infrastructure config saved to ${CONFIG_FILE}"
}

# Run main
main
