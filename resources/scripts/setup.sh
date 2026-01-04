#!/bin/bash
# =============================================================================
# Agentify Infrastructure Setup Script
# =============================================================================
# This script deploys the shared infrastructure for Agentify demos:
#   - VPC with private subnets (for AgentCore Runtime)
#   - DynamoDB table (for Demo Viewer event streaming)
#   - Lambda functions for Gateway tools (auto-discovered)
#   - AgentCore MCP Gateway (if schemas exist)
#   - AgentCore Policy Engine (if Cedar policies exist)
#
# Run this ONCE before deploying any agents. The infrastructure is shared
# across all Agentify projects in your AWS account.
#
# Usage:
#   ./scripts/setup.sh                    # Deploy infrastructure + Gateway + Policy
#   ./scripts/setup.sh --skip-cdk         # Skip CDK/Gateway, deploy agent only
#   ./scripts/setup.sh --agent my_agent   # Deploy infrastructure + Gateway + Policy + agent
# =============================================================================

set -e

# Disable pagers globally to prevent blocking on command output
export AWS_PAGER=""
export PAGER=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CDK_DIR="${PROJECT_ROOT}/cdk"

# Derive project name from workspace folder (sanitized for CloudFormation)
sanitize_project_name() {
    local name="$1"
    # Convert to lowercase, replace underscores/spaces with hyphens
    # Remove invalid characters, collapse multiple hyphens
    echo "$name" | tr '[:upper:]' '[:lower:]' | \
        sed 's/[_ ]/-/g' | \
        sed 's/[^a-z0-9-]//g' | \
        sed 's/-\+/-/g' | \
        sed 's/^-//;s/-$//'
}

WORKSPACE_FOLDER="$(basename "${PROJECT_ROOT}")"
PROJECT_NAME="$(sanitize_project_name "${WORKSPACE_FOLDER}")"
PROJECT_NAME="${PROJECT_NAME:-agentify}"  # Fallback if empty

# Load environment variables if .env exists
if [ -f "${PROJECT_ROOT}/.env" ]; then
    print_step "Loading environment variables from .env"
    set -a
    source "${PROJECT_ROOT}/.env"
    set +a
    print_success "Environment loaded"
fi

# Load AWS profile from config.json if not already set
CONFIG_JSON="${PROJECT_ROOT}/.agentify/config.json"
if [ -z "$AWS_PROFILE" ] && [ -f "${CONFIG_JSON}" ]; then
    if command -v jq &> /dev/null; then
        PROFILE_FROM_CONFIG=$(jq -r '.aws.profile // empty' "${CONFIG_JSON}" 2>/dev/null)
        if [ -n "$PROFILE_FROM_CONFIG" ]; then
            export AWS_PROFILE="$PROFILE_FROM_CONFIG"
            print_success "Using AWS profile from config.json: ${AWS_PROFILE}"
        fi
    fi
fi

# Check required tools
print_step "Checking required tools..."

if ! command -v uv &> /dev/null; then
    print_error "uv is not installed. Please install it first:"
    echo "  curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi
print_success "uv found"

if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi
print_success "AWS CLI found"

if ! command -v jq &> /dev/null; then
    print_warning "jq not found. Some features may not work. Install with: brew install jq"
fi

# Check AWS credentials
print_step "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured or expired. Please configure AWS credentials."
    exit 1
fi
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
print_success "AWS credentials valid (Account: ${ACCOUNT_ID})"

# Parse arguments
SKIP_CDK=false
AGENT_NAME=""
REGION="${AWS_REGION:-us-east-1}"

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-cdk)
            SKIP_CDK=true
            shift
            ;;
        --agent|-a)
            AGENT_NAME="$2"
            shift 2
            ;;
        --region|-r)
            REGION="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-cdk           Skip CDK infrastructure deployment"
            echo "  --agent, -a NAME     Deploy a specific agent"
            echo "  --region, -r REGION  AWS region (default: us-east-1)"
            echo "  -h, --help           Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                              # Deploy infrastructure only"
            echo "  $0 --agent inventory_agent      # Deploy infrastructure + agent"
            echo "  $0 --skip-cdk --agent my_agent  # Deploy agent only (infra exists)"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo ""
echo "============================================="
echo "  Agentify Infrastructure Setup"
echo "  Project: ${PROJECT_NAME}"
echo "  Region: ${REGION}"
echo "============================================="
echo ""

# Step 1: CDK Deploy
if [ "$SKIP_CDK" = false ]; then
    print_step "Step 1: Deploying CDK infrastructure..."

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
        uv run cdk bootstrap aws://${ACCOUNT_ID}/${REGION}
        print_success "CDK bootstrapped"
    else
        print_success "CDK already bootstrapped"
    fi

    # Deploy all stacks (synthesis happens automatically during deploy)
    print_step "Deploying CDK stacks (this may take 5-10 minutes)..."
    uv run cdk deploy -c project="${PROJECT_NAME}" -c region="${REGION}" --all --require-approval never --outputs-file cdk-outputs.json
    print_success "CDK deployment complete"

    # Fetch and display infrastructure outputs from cdk-outputs.json
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
    fi

    # Return to project root
    cd "${PROJECT_ROOT}"

    echo ""
    echo "Infrastructure Outputs:"
    echo "  Private Subnets: ${SUBNET_IDS}"
    echo "  Security Group:  ${SG_ID}"
    echo "  DynamoDB Table:  ${TABLE_NAME}"
    echo ""

    # Save config for later use
    CONFIG_FILE="${PROJECT_ROOT}/.agentify/infrastructure.json"
    mkdir -p "$(dirname "${CONFIG_FILE}")"
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
    print_success "Infrastructure config saved to ${CONFIG_FILE}"

else
    print_warning "Step 1: Skipping CDK deployment (--skip-cdk)"

    # Load existing config
    CONFIG_FILE="${PROJECT_ROOT}/.agentify/infrastructure.json"
    if [ -f "${CONFIG_FILE}" ]; then
        SUBNET_IDS=$(jq -r '.vpc_subnet_ids' "${CONFIG_FILE}")
        SG_ID=$(jq -r '.vpc_security_group_id' "${CONFIG_FILE}")
        print_success "Loaded infrastructure config from ${CONFIG_FILE}"
    else
        # Fetch from CloudFormation
        NETWORKING_STACK="Agentify-${PROJECT_NAME}-Networking-${REGION}"

        SUBNET_IDS=$(aws cloudformation describe-stacks \
            --stack-name "${NETWORKING_STACK}" \
            --query "Stacks[0].Outputs[?ExportName=='${PROJECT_NAME}-PrivateSubnetIds'].OutputValue" \
            --output text --region "${REGION}" 2>/dev/null)

        SG_ID=$(aws cloudformation describe-stacks \
            --stack-name "${NETWORKING_STACK}" \
            --query "Stacks[0].Outputs[?ExportName=='${PROJECT_NAME}-AgentSecurityGroupId'].OutputValue" \
            --output text --region "${REGION}" 2>/dev/null)

        if [ -z "$SUBNET_IDS" ] || [ -z "$SG_ID" ]; then
            print_error "Infrastructure not found. Run without --skip-cdk first."
            exit 1
        fi
    fi
fi

# Step 2: Setup MCP Gateway (if schemas exist)
print_step "Step 2: Setting up AgentCore MCP Gateway..."

# Check if schemas exist (ignore .gitkeep)
SCHEMAS_DIR="${CDK_DIR}/gateway/schemas"
SCHEMA_FILES=$(find "$SCHEMAS_DIR" -name "*.json" 2>/dev/null | head -1)

if [ -n "$SCHEMA_FILES" ]; then
    cd "${CDK_DIR}"

    # Check if agentcore toolkit is installed (must be in CDK dir for uv)
    if ! uv run agentcore --version &> /dev/null 2>&1; then
        print_step "Installing AgentCore Starter Toolkit..."
        uv add --dev bedrock-agentcore-starter-toolkit
    fi

    print_step "Running Gateway setup..."
    if uv run python gateway/setup_gateway.py --region "${REGION}" --name "${PROJECT_NAME}-gateway"; then
        print_success "Gateway setup complete"

        # Load gateway config to get gateway ID
        GATEWAY_CONFIG="${CDK_DIR}/gateway_config.json"
        if [ -f "$GATEWAY_CONFIG" ] && command -v jq &> /dev/null; then
            GATEWAY_ID=$(jq -r '.gateway_id // empty' "$GATEWAY_CONFIG")
            GATEWAY_URL=$(jq -r '.gateway_url // empty' "$GATEWAY_CONFIG")
            GATEWAY_ARN=$(jq -r '.gateway_arn // empty' "$GATEWAY_CONFIG")

            if [ -n "$GATEWAY_ID" ]; then
                echo ""
                print_step "Listing registered Gateway targets..."
                # Disable pager to prevent blocking on JSON output
                PAGER="" uv run agentcore gateway list-mcp-gateway-targets --id "$GATEWAY_ID" --region "${REGION}" 2>/dev/null || true

                # Store Gateway credentials in SSM Parameter Store
                # This allows agents to discover Gateway config at runtime without env vars
                print_step "Storing Gateway credentials in SSM Parameter Store..."
                SSM_PREFIX="/agentify/${PROJECT_NAME}/gateway"

                DEPLOY_CLIENT_ID=$(jq -r '.oauth.client_id // empty' "$GATEWAY_CONFIG")
                DEPLOY_CLIENT_SECRET=$(jq -r '.oauth.client_secret // empty' "$GATEWAY_CONFIG")
                DEPLOY_TOKEN_ENDPOINT=$(jq -r '.oauth.token_endpoint // empty' "$GATEWAY_CONFIG")
                DEPLOY_SCOPE=$(jq -r '.oauth.scope // empty' "$GATEWAY_CONFIG")

                # Write each parameter (use SecureString for secret)
                aws ssm put-parameter --name "${SSM_PREFIX}/url" --value "${GATEWAY_URL}" --type "String" --overwrite --region "${REGION}" 2>/dev/null || true
                aws ssm put-parameter --name "${SSM_PREFIX}/client_id" --value "${DEPLOY_CLIENT_ID}" --type "String" --overwrite --region "${REGION}" 2>/dev/null || true
                aws ssm put-parameter --name "${SSM_PREFIX}/client_secret" --value "${DEPLOY_CLIENT_SECRET}" --type "SecureString" --overwrite --region "${REGION}" 2>/dev/null || true
                aws ssm put-parameter --name "${SSM_PREFIX}/token_endpoint" --value "${DEPLOY_TOKEN_ENDPOINT}" --type "String" --overwrite --region "${REGION}" 2>/dev/null || true
                aws ssm put-parameter --name "${SSM_PREFIX}/scope" --value "${DEPLOY_SCOPE}" --type "String" --overwrite --region "${REGION}" 2>/dev/null || true

                print_success "Gateway credentials stored in SSM: ${SSM_PREFIX}/*"

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
            fi
        fi
    else
        print_warning "Gateway setup failed. You can run it manually: python cdk/gateway/setup_gateway.py"
    fi
    cd "${PROJECT_ROOT}"
else
    print_warning "No gateway schemas found in ${SCHEMAS_DIR}"
    print_warning "Skipping Gateway setup. Add schemas and run: python cdk/gateway/setup_gateway.py"
fi

# Step 2b: Setup AgentCore Policy Engine (using Natural Language policy generation)
print_step "Step 2b: Setting up AgentCore Policy Engine..."

POLICIES_DIR="${PROJECT_ROOT}/policies"
GATEWAY_CONFIG="${CDK_DIR}/gateway_config.json"
INFRA_CONFIG="${PROJECT_ROOT}/.agentify/infrastructure.json"

# Helper function to calculate file hash (cross-platform)
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

# Helper function to get stored hash for a policy from infrastructure.json
get_stored_policy_hash() {
    local policy_name="$1"
    local config_file="$2"
    if [ -f "$config_file" ] && command -v jq &> /dev/null; then
        jq -r ".policy.hashes.\"${policy_name}\" // empty" "$config_file" 2>/dev/null
    else
        echo ""
    fi
}

# Helper function to update stored hash for a policy in infrastructure.json
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

# Helper function to delete a policy by name
delete_policy_by_name() {
    local policy_engine_id="$1"
    local policy_name="$2"
    local region="$3"

    # Get policy ID from list output
    local policy_id=$(uv run agentcore policy list-policies \
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

# Helper function to find existing policy engine by name in AWS
# This prevents ConflictException when infrastructure.json is missing but engine exists
find_existing_policy_engine() {
    local name="$1"
    local region="$2"

    # Use AWS CLI directly for JSON output (agentcore toolkit outputs truncated tables)
    local list_output
    list_output=$(aws bedrock-agentcore-control list-policy-engines --region "${region}" 2>/dev/null) || return 1

    # Parse JSON to find matching engine by name and extract ID
    if command -v jq &> /dev/null; then
        echo "$list_output" | jq -r ".policyEngines[] | select(.name == \"${name}\") | .policyEngineId" 2>/dev/null | head -1
    else
        # Fallback: use grep to find the ID (less reliable)
        echo "$list_output" | grep -oE "\"policyEngineId\":\s*\"${name}-[a-zA-Z0-9]+\"" | sed 's/.*"\([^"]*\)"$/\1/' | head -1
    fi
}

# Check if policies directory exists and has .txt files (natural language policy descriptions)
POLICY_TXT_FILES=$(find "$POLICIES_DIR" -name "*.txt" 2>/dev/null | head -1)

if [ -n "$POLICY_TXT_FILES" ] && [ -f "$GATEWAY_CONFIG" ]; then
    cd "${CDK_DIR}"

    # Ensure agentcore toolkit is available
    if ! uv run agentcore --version &> /dev/null 2>&1; then
        print_step "Installing AgentCore Starter Toolkit..."
        uv add --dev bedrock-agentcore-starter-toolkit
    fi

    # Get Gateway ARN from config
    GATEWAY_ARN=$(jq -r '.gateway_arn // empty' "$GATEWAY_CONFIG" 2>/dev/null)

    if [ -n "$GATEWAY_ARN" ]; then
        # Sanitize project name for policy engine (AWS requires ^[A-Za-z][A-Za-z0-9_]*$)
        POLICY_ENGINE_NAME=$(echo "${PROJECT_NAME}_policy_engine" | sed 's/-/_/g')

        # Check if Policy Engine already exists - first in local config, then query AWS
        # This prevents ConflictException when infrastructure.json is missing but engine exists in AWS
        EXISTING_POLICY_ENGINE_ID=$(jq -r '.policy.policyEngineId // empty' "$INFRA_CONFIG" 2>/dev/null)

        if [ -z "$EXISTING_POLICY_ENGINE_ID" ]; then
            # Config file doesn't have it - check AWS directly
            print_step "Checking for existing Policy Engine in AWS..."
            EXISTING_POLICY_ENGINE_ID=$(find_existing_policy_engine "$POLICY_ENGINE_NAME" "$REGION")

            if [ -n "$EXISTING_POLICY_ENGINE_ID" ]; then
                print_success "Found existing Policy Engine in AWS: $EXISTING_POLICY_ENGINE_ID"
            fi
        fi

        if [ -z "$EXISTING_POLICY_ENGINE_ID" ]; then
            # No existing engine found - create new one
            print_step "Creating Policy Engine: ${POLICY_ENGINE_NAME}..."

            POLICY_ENGINE_OUTPUT=$(uv run agentcore policy create-policy-engine \
                --name "${POLICY_ENGINE_NAME}" \
                --description "Generated by Agentify from Step 4 security inputs" \
                --region "${REGION}" 2>&1) || true

            # Extract Policy Engine ID from output
            # Output format: "Engine ID: project_name_policy_engine-abc123xyz"
            POLICY_ENGINE_ID=$(echo "$POLICY_ENGINE_OUTPUT" | grep -i "Engine ID:" | sed 's/.*Engine ID:[[:space:]]*//' | head -1 || true)

            # Alternative extraction if above fails - look for the pattern anywhere
            if [ -z "$POLICY_ENGINE_ID" ]; then
                POLICY_ENGINE_ID=$(echo "$POLICY_ENGINE_OUTPUT" | grep -oE "${POLICY_ENGINE_NAME}-[a-zA-Z0-9_]+" | head -1 || true)
            fi

            if [ -n "$POLICY_ENGINE_ID" ]; then
                print_success "Policy Engine created: $POLICY_ENGINE_ID"
            else
                print_warning "Could not extract Policy Engine ID from output:"
                echo "$POLICY_ENGINE_OUTPUT"
                print_warning "Attempting to list policy engines to find it..."

                # Try to find the policy engine by listing (use sanitized name)
                POLICY_ENGINE_ID=$(find_existing_policy_engine "$POLICY_ENGINE_NAME" "$REGION")

                if [ -n "$POLICY_ENGINE_ID" ]; then
                    print_success "Found Policy Engine: $POLICY_ENGINE_ID"
                fi
            fi
        else
            POLICY_ENGINE_ID="$EXISTING_POLICY_ENGINE_ID"
            print_success "Using existing Policy Engine: $POLICY_ENGINE_ID"
        fi

        if [ -n "$POLICY_ENGINE_ID" ]; then
            # Generate and create policies from each .txt file using Natural Language generation
            # This uses AgentCore's native NL-to-Cedar API for reliable policy generation
            POLICY_COUNT=0
            GENERATION_FAILURES=0

            for POLICY_FILE in "$POLICIES_DIR"/*.txt; do
                if [ -f "$POLICY_FILE" ]; then
                    POLICY_BASE_NAME=$(basename "$POLICY_FILE" .txt)
                    # Convert hyphens to underscores (policy names must match ^[A-Za-z][A-Za-z0-9_]*$)
                    POLICY_NAME=$(echo "$POLICY_BASE_NAME" | sed 's/-/_/g')

                    # Read natural language description
                    POLICY_DESCRIPTION=$(cat "$POLICY_FILE")

                    print_step "Checking policy: $POLICY_NAME"

                    # Hash-based change detection
                    CURRENT_HASH=$(calculate_file_hash "$POLICY_FILE")
                    STORED_HASH=$(get_stored_policy_hash "$POLICY_NAME" "$INFRA_CONFIG")

                    if [ -n "$CURRENT_HASH" ] && [ "$CURRENT_HASH" = "$STORED_HASH" ]; then
                        print_success "  Policy $POLICY_NAME unchanged (hash match), skipping"
                        POLICY_COUNT=$((POLICY_COUNT + 1))
                        continue
                    fi

                    # Check if policy already exists in AWS
                    # Use first 15 chars for matching since list-policies truncates names
                    POLICY_NAME_PREFIX=$(echo "$POLICY_NAME" | cut -c1-15)
                    EXISTING_AWS_POLICY=$(uv run agentcore policy list-policies \
                        --policy-engine-id "$POLICY_ENGINE_ID" \
                        --region "${REGION}" 2>&1 | grep -i "$POLICY_NAME_PREFIX" || true)

                    if [ -n "$STORED_HASH" ]; then
                        # Hash differs - need to delete and recreate
                        print_step "  Policy content changed, deleting old version..."
                        delete_policy_by_name "$POLICY_ENGINE_ID" "$POLICY_NAME" "${REGION}"
                    elif [ -n "$EXISTING_AWS_POLICY" ]; then
                        # Migration case: AWS policy exists but no stored hash
                        # Store hash and skip (assume AWS policy is current)
                        print_success "  Policy $POLICY_NAME exists in AWS, storing hash for future detection"
                        update_stored_policy_hash "$POLICY_NAME" "$CURRENT_HASH" "$INFRA_CONFIG"
                        POLICY_COUNT=$((POLICY_COUNT + 1))
                        continue
                    fi

                    print_step "Generating Cedar policy from NL: $POLICY_NAME"
                    echo "  Description: $POLICY_DESCRIPTION"

                    # Add timestamp to generation name to ensure uniqueness
                    GENERATION_TIMESTAMP=$(date +%s)
                    GENERATION_NAME="${POLICY_NAME}_${GENERATION_TIMESTAMP}"

                    # Step 1: Start policy generation
                    GENERATION_OUTPUT=$(uv run agentcore policy start-policy-generation \
                        --policy-engine-id "$POLICY_ENGINE_ID" \
                        --name "$GENERATION_NAME" \
                        --resource-arn "$GATEWAY_ARN" \
                        --content "$POLICY_DESCRIPTION" \
                        --region "${REGION}" 2>&1) || true

                    # Extract Generation ID from output
                    GENERATION_ID=$(echo "$GENERATION_OUTPUT" | grep -i "Generation ID:" | sed 's/.*Generation ID:[[:space:]]*//' | head -1 || true)

                    if [ -z "$GENERATION_ID" ]; then
                        # Try alternative pattern
                        GENERATION_ID=$(echo "$GENERATION_OUTPUT" | grep -oE "${GENERATION_NAME}-[a-zA-Z0-9]+" | head -1 || true)
                    fi

                    if [ -z "$GENERATION_ID" ]; then
                        print_warning "Failed to start generation for $POLICY_NAME"
                        echo "$GENERATION_OUTPUT"
                        GENERATION_FAILURES=$((GENERATION_FAILURES + 1))
                        continue
                    fi

                    print_step "  Generation started: $GENERATION_ID"

                    # Step 2: Poll until generation is complete (typically ~20-30 seconds)
                    MAX_POLL_ATTEMPTS=30
                    POLL_INTERVAL=2
                    POLL_COUNT=0
                    GENERATION_STATUS="GENERATING"

                    while [ "$GENERATION_STATUS" = "GENERATING" ] && [ $POLL_COUNT -lt $MAX_POLL_ATTEMPTS ]; do
                        sleep $POLL_INTERVAL
                        POLL_COUNT=$((POLL_COUNT + 1))

                        STATUS_OUTPUT=$(uv run agentcore policy get-policy-generation \
                            --policy-engine-id "$POLICY_ENGINE_ID" \
                            --generation-id "$GENERATION_ID" \
                            --region "${REGION}" 2>&1) || true

                        # Extract status
                        GENERATION_STATUS=$(echo "$STATUS_OUTPUT" | grep -i "Status:" | sed 's/.*Status:[[:space:]]*//' | head -1 || true)

                        if [ -z "$GENERATION_STATUS" ]; then
                            GENERATION_STATUS="GENERATING"
                        fi

                        echo -n "."
                    done
                    echo ""

                    if [ "$GENERATION_STATUS" != "GENERATED" ]; then
                        print_warning "Generation failed or timed out for $POLICY_NAME (status: $GENERATION_STATUS)"
                        GENERATION_FAILURES=$((GENERATION_FAILURES + 1))
                        continue
                    fi

                    print_step "  Generation complete, extracting Cedar..."

                    # Step 3: Get generated Cedar from assets using helper script
                    POLICY_DEF_FILE=$(mktemp)
                    python3 "${SCRIPT_DIR}/extract_cedar.py" "$POLICY_ENGINE_ID" "$GENERATION_ID" "${REGION}" "$POLICY_DEF_FILE"
                    EXTRACT_STATUS=$?

                    if [ $EXTRACT_STATUS -ne 0 ] || [ ! -s "$POLICY_DEF_FILE" ]; then
                        print_warning "Could not extract Cedar from generation assets for $POLICY_NAME"
                        rm -f "$POLICY_DEF_FILE"
                        GENERATION_FAILURES=$((GENERATION_FAILURES + 1))
                        continue
                    fi

                    POLICY_DEF=$(cat "$POLICY_DEF_FILE")
                    rm -f "$POLICY_DEF_FILE"

                    print_step "  Creating policy: $POLICY_NAME"
                    if uv run agentcore policy create-policy \
                        --policy-engine-id "$POLICY_ENGINE_ID" \
                        --name "$POLICY_NAME" \
                        --description "Generated via NL from: $POLICY_DESCRIPTION" \
                        --definition "$POLICY_DEF" \
                        --region "${REGION}" 2>&1 | tee /tmp/policy_create_output.txt | grep -q "Policy creation initiated"; then
                        print_success "Created policy: $POLICY_NAME"
                        POLICY_COUNT=$((POLICY_COUNT + 1))

                        # Store hash for change detection on future runs
                        if [ -n "$CURRENT_HASH" ]; then
                            update_stored_policy_hash "$POLICY_NAME" "$CURRENT_HASH" "$INFRA_CONFIG"
                        fi
                    else
                        print_warning "Failed to create policy $POLICY_NAME"
                        if [ -f /tmp/policy_create_output.txt ]; then
                            cat /tmp/policy_create_output.txt | tail -10
                        fi
                        GENERATION_FAILURES=$((GENERATION_FAILURES + 1))
                    fi
                fi
            done

            if [ $POLICY_COUNT -gt 0 ]; then
                print_success "Created $POLICY_COUNT Cedar policies via NL generation"
            fi
            if [ $GENERATION_FAILURES -gt 0 ]; then
                print_warning "$GENERATION_FAILURES policy generation(s) failed"
            fi

            # Associate Policy Engine with Gateway
            print_step "Associating Policy Engine with Gateway..."

            # Get policy mode from config.json (default to LOG_ONLY for safety)
            POLICY_MODE=$(jq -r '.policy.mode // "LOG_ONLY"' "$CONFIG_JSON" 2>/dev/null)
            if [ -z "$POLICY_MODE" ] || [ "$POLICY_MODE" = "null" ]; then
                POLICY_MODE="LOG_ONLY"
            fi

            # Construct Policy Engine ARN
            POLICY_ENGINE_ARN="arn:aws:bedrock-agentcore:${REGION}:${ACCOUNT_ID}:policy-engine/${POLICY_ENGINE_ID}"

            if uv run agentcore gateway update-gateway \
                --arn "$GATEWAY_ARN" \
                --policy-engine-arn "$POLICY_ENGINE_ARN" \
                --policy-engine-mode "$POLICY_MODE" \
                --region "${REGION}" 2>/dev/null; then
                print_success "Policy Engine associated with Gateway (mode: $POLICY_MODE)"
            else
                print_warning "Failed to associate Policy Engine with Gateway"
            fi

            # Save Policy Engine info to infrastructure.json (preserve existing hashes)
            if [ -f "$INFRA_CONFIG" ] && command -v jq &> /dev/null; then
                jq --arg peid "$POLICY_ENGINE_ID" \
                   --arg pearn "$POLICY_ENGINE_ARN" \
                   --arg mode "$POLICY_MODE" \
                    '.policy = (.policy // {}) + {"policyEngineId": $peid, "policyEngineArn": $pearn, "mode": $mode}' \
                    "$INFRA_CONFIG" > "${INFRA_CONFIG}.tmp" && mv "${INFRA_CONFIG}.tmp" "$INFRA_CONFIG"
                print_success "Policy Engine config saved to infrastructure.json"
            fi

            echo ""
            echo "============================================="
            echo "  Policy Engine Configuration"
            echo "============================================="
            echo ""
            echo "Policy Engine ID:  $POLICY_ENGINE_ID"
            echo "Enforcement Mode:  $POLICY_MODE"
            echo "Policies Created:  $POLICY_COUNT (via NL generation)"
            echo ""
            echo "List policies:"
            echo "  uv run agentcore policy list-policies --policy-engine-id $POLICY_ENGINE_ID --region ${REGION}"
            echo ""
            echo "Change enforcement mode:"
            echo "  uv run agentcore gateway update-gateway --arn $GATEWAY_ARN --policy-engine-mode ENFORCE --region ${REGION}"
            echo ""
        else
            print_warning "Could not create or find Policy Engine"
        fi
    else
        print_warning "No Gateway ARN found in gateway_config.json, skipping Policy Engine"
    fi

    cd "${PROJECT_ROOT}"
else
    if [ -z "$POLICY_TXT_FILES" ]; then
        print_warning "No policies/ directory or .txt policy description files found"
    fi
    if [ ! -f "$GATEWAY_CONFIG" ]; then
        print_warning "No Gateway configured (gateway_config.json not found)"
    fi
    print_warning "Skipping Policy Engine setup"
fi

# Step 3: Deploy Agent (if specified)
if [ -n "$AGENT_NAME" ]; then
    print_step "Step 3: Deploying agent '${AGENT_NAME}'..."

    # Check if agentcore toolkit is installed
    if ! uv run agentcore --version &> /dev/null 2>&1; then
        print_step "Installing AgentCore Starter Toolkit..."
        uv add --dev bedrock-agentcore-starter-toolkit
    fi

    # Find the handler file
    HANDLER_FILE=""
    for pattern in "agents/${AGENT_NAME}.py" "agents/${AGENT_NAME}_handler.py" "agents/${AGENT_NAME}/handler.py"; do
        if [ -f "${PROJECT_ROOT}/${pattern}" ]; then
            HANDLER_FILE="${pattern}"
            break
        fi
    done

    if [ -z "$HANDLER_FILE" ]; then
        print_error "Could not find handler file for agent '${AGENT_NAME}'"
        print_warning "Expected one of:"
        echo "  - agents/${AGENT_NAME}.py"
        echo "  - agents/${AGENT_NAME}_handler.py"
        echo "  - agents/${AGENT_NAME}/handler.py"
        exit 1
    fi

    print_step "Found handler: ${HANDLER_FILE}"

    # Ensure Dockerfile exists
    DOCKERFILE_DIR="${PROJECT_ROOT}/.bedrock_agentcore/${AGENT_NAME}"
    DOCKERFILE_PATH="${DOCKERFILE_DIR}/Dockerfile"

    if [ ! -f "${DOCKERFILE_PATH}" ]; then
        print_step "Creating Dockerfile for ${AGENT_NAME}..."
        mkdir -p "${DOCKERFILE_DIR}"

        # Get handler module name (without .py extension and path)
        HANDLER_MODULE=$(basename "${HANDLER_FILE}" .py)

        # Copy template and replace placeholder
        TEMPLATE_PATH="${SCRIPT_DIR}/templates/Dockerfile.agentcore.template"
        if [ -f "${TEMPLATE_PATH}" ]; then
            sed "s/AGENT_HANDLER_MODULE/${HANDLER_MODULE}/" "${TEMPLATE_PATH}" > "${DOCKERFILE_PATH}"
        else
            print_warning "Dockerfile template not found, agentcore will generate one"
        fi
    fi

    # Configure agent if not already configured
    if ! grep -q "^  ${AGENT_NAME}:" "${PROJECT_ROOT}/.bedrock_agentcore.yaml" 2>/dev/null; then
        print_step "Configuring ${AGENT_NAME}..."
        uv run agentcore configure \
            --create \
            --name "${AGENT_NAME}" \
            --entrypoint "${PROJECT_ROOT}/${HANDLER_FILE}" \
            --vpc \
            --subnets "${SUBNET_IDS}" \
            --security-groups "${SG_ID}" \
            --region "${REGION}" \
            --disable-memory \
            --non-interactive

        # Enable ECR auto-create for first deploy
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' 's/ecr_auto_create: false/ecr_auto_create: true/' "${PROJECT_ROOT}/.bedrock_agentcore.yaml"
        else
            sed -i 's/ecr_auto_create: false/ecr_auto_create: true/' "${PROJECT_ROOT}/.bedrock_agentcore.yaml"
        fi
        print_success "${AGENT_NAME} configured"
    else
        print_success "${AGENT_NAME} already configured"
    fi

    # Deploy agent
    print_step "Deploying ${AGENT_NAME} via CodeBuild..."

    # Pass project name so agent can discover Gateway credentials from SSM
    DEPLOY_ENV_ARGS="--env AGENTIFY_PROJECT_NAME=${PROJECT_NAME}"

    uv run agentcore deploy -a "${AGENT_NAME}" --auto-update-on-conflict ${DEPLOY_ENV_ARGS}
    print_success "${AGENT_NAME} deployed"

    # Store agent ID in SSM Parameter Store
    print_step "Storing ${AGENT_NAME} ID in SSM Parameter Store..."

    AGENT_ID=$(grep -A 10 "^  ${AGENT_NAME}:" "${PROJECT_ROOT}/.bedrock_agentcore.yaml" | grep "agent_id:" | head -1 | sed 's/.*agent_id: *//' | tr -d ' "')

    if [ -n "$AGENT_ID" ]; then
        SSM_PARAM_NAME="/agentify/agents/${AGENT_NAME}/id"

        aws ssm put-parameter \
            --name "${SSM_PARAM_NAME}" \
            --value "${AGENT_ID}" \
            --type "String" \
            --overwrite \
            --region "${REGION}" 2>/dev/null && \
            print_success "Stored agent ID in SSM: ${SSM_PARAM_NAME}" || \
            print_warning "Could not store agent ID in SSM"
    else
        print_warning "Could not find agent ID in .bedrock_agentcore.yaml"
    fi

    # Add IAM permissions for DynamoDB workflow events table
    print_step "Adding IAM permissions for ${AGENT_NAME}..."

    EXECUTION_ROLE=$(grep -A 15 "^  ${AGENT_NAME}:" "${PROJECT_ROOT}/.bedrock_agentcore.yaml" | grep "execution_role:" | head -1 | sed 's/.*arn:aws:iam::[0-9]*:role\///' | tr -d ' ')

    if [ -n "$EXECUTION_ROLE" ]; then
        # Use project-specific table name (matches what CDK creates)
        TABLE_ARN=$(aws dynamodb describe-table --table-name "${PROJECT_NAME}-workflow-events" --query "Table.TableArn" --output text --region "${REGION}" 2>/dev/null || echo "")

        if [ -n "$TABLE_ARN" ]; then
            POLICY_NAME="AgentifyAccess-${AGENT_NAME}"
            # Grant access to both /agentify/* (gateway params) and /{project}/* (DynamoDB table param)
            POLICY_DOCUMENT='{
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Sid": "DynamoDBWorkflowEventsAccess",
                        "Effect": "Allow",
                        "Action": ["dynamodb:PutItem", "dynamodb:Query"],
                        "Resource": ["'${TABLE_ARN}'"]
                    },
                    {
                        "Sid": "SSMParameterAccess",
                        "Effect": "Allow",
                        "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
                        "Resource": [
                            "arn:aws:ssm:'${REGION}':'${ACCOUNT_ID}':parameter/agentify/*",
                            "arn:aws:ssm:'${REGION}':'${ACCOUNT_ID}':parameter/'${PROJECT_NAME}'/*"
                        ]
                    }
                ]
            }'

            aws iam put-role-policy \
                --role-name "${EXECUTION_ROLE}" \
                --policy-name "${POLICY_NAME}" \
                --policy-document "${POLICY_DOCUMENT}" \
                --region "${REGION}" 2>/dev/null && \
                print_success "IAM permissions added for ${AGENT_NAME}" || \
                print_warning "Could not add IAM permissions for ${AGENT_NAME}"
        else
            print_warning "DynamoDB table ${PROJECT_NAME}-workflow-events not found, skipping IAM policy"
        fi
    else
        print_warning "Could not find execution role for ${AGENT_NAME}"
    fi

else
    print_step "Step 3: No agent specified (use --agent NAME to deploy an agent)"
fi

echo ""
echo "============================================="
echo -e "  ${GREEN}Setup Complete!${NC}"
echo "============================================="
echo ""

if [ -n "$AGENT_NAME" ]; then
    echo "Test your agent:"
    echo "  uv run agentcore invoke '{\"prompt\": \"Hello!\"}' -a ${AGENT_NAME}"
    echo ""
    echo "View agent logs:"
    echo "  aws logs tail /aws/bedrock-agentcore/runtimes/${AGENT_NAME}-* --follow"
    echo ""
fi

echo "Next steps:"
echo "  1. Design your agentic workflow using the Agentify extension"
echo "  2. Generate steering files and implement agents with Kiro"
echo "  3. Deploy each agent: ./scripts/setup.sh --skip-cdk --agent <agent_name>"
echo "  4. Use Demo Viewer to visualize workflow execution"
echo ""
echo "Agent management:"
echo "  - Check status: uv run agentcore status"
echo "  - Delete agent: uv run agentcore delete -a <agent_name> --force"
echo ""
echo "Policy management:"
echo "  - List policies: uv run agentcore policy list-policies --policy-engine-id <id> --region ${REGION}"
echo "  - Switch to ENFORCE mode: uv run agentcore gateway update-gateway --arn <arn> --policy-engine-mode ENFORCE --region ${REGION}"
echo ""
