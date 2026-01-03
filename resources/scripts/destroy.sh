#!/bin/bash
# =============================================================================
# Agentify Infrastructure Destroy Script (2-Phase)
# =============================================================================
# This script tears down Agentify infrastructure in 2 phases:
#
#   Phase 1: Delete AgentCore agents, Policy Engine, and MCP Gateway (always succeeds)
#   Phase 2: Delete CDK stacks (only when ENIs are released)
#
# Note: AgentCore ENIs can take up to 8 hours to release after agent deletion.
#       If Phase 2 fails due to hanging ENIs, wait and re-run the script.
#
# Usage:
#   ./scripts/destroy.sh                # Destroy everything (2 phases)
#   ./scripts/destroy.sh --force        # Skip confirmation
#   ./scripts/destroy.sh --check-only   # Just check ENI status
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

# Get VPC ID from infrastructure.json or CloudFormation
get_vpc_id() {
    local vpc_id=""

    # Try infrastructure.json first
    if [ -f "${PROJECT_ROOT}/.agentify/infrastructure.json" ] && command -v jq &> /dev/null; then
        vpc_id=$(jq -r '.vpc_id // empty' "${PROJECT_ROOT}/.agentify/infrastructure.json" 2>/dev/null)
    fi

    # Fallback to CloudFormation stack outputs
    if [ -z "$vpc_id" ]; then
        NETWORKING_STACK="Agentify-${PROJECT_NAME}-Networking-${REGION}"
        vpc_id=$(aws cloudformation describe-stacks \
            --stack-name "${NETWORKING_STACK}" \
            --region "${REGION}" \
            --query "Stacks[0].Outputs[?OutputKey=='VpcId'].OutputValue" \
            --output text 2>/dev/null || echo "")
    fi

    echo "$vpc_id"
}

# Check for hanging AgentCore ENIs in the project VPC
# Returns: 0 if no ENIs, 1 if ENIs exist (sets HANGING_ENI_COUNT and HANGING_ENI_LIST)
check_hanging_enis() {
    local vpc_id="$1"

    if [ -z "$vpc_id" ]; then
        print_warning "No VPC ID found, cannot check ENIs"
        HANGING_ENI_COUNT=0
        return 0
    fi

    # Query for agentic_ai ENIs in VPC
    HANGING_ENI_LIST=$(aws ec2 describe-network-interfaces \
        --region "${REGION}" \
        --filters "Name=vpc-id,Values=${vpc_id}" \
                  "Name=interface-type,Values=agentic_ai" \
        --query 'NetworkInterfaces[].[NetworkInterfaceId,SubnetId,PrivateIpAddress]' \
        --output text 2>/dev/null || echo "")

    if [ -n "$HANGING_ENI_LIST" ]; then
        HANGING_ENI_COUNT=$(echo "$HANGING_ENI_LIST" | wc -l | tr -d ' ')
        return 1
    fi

    HANGING_ENI_COUNT=0
    return 0
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
    print_error "uv is not installed. Please install it first."
    exit 1
fi
print_success "uv found"

if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi
print_success "AWS CLI found"

# Check AWS credentials
print_step "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured or expired. Please configure AWS credentials."
    exit 1
fi
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
print_success "AWS credentials valid (Account: ${ACCOUNT_ID})"

# Parse arguments
FORCE=false
CHECK_ONLY=false
REGION="${AWS_REGION:-us-east-1}"

while [[ $# -gt 0 ]]; do
    case $1 in
        --force|-f)
            FORCE=true
            shift
            ;;
        --check-only)
            CHECK_ONLY=true
            shift
            ;;
        --region|-r)
            REGION="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Destroys Agentify infrastructure in 2 phases:"
            echo "  Phase 1: Delete AgentCore agents, Policy Engine, and MCP Gateway"
            echo "  Phase 2: Delete CDK stacks (VPC, DynamoDB, etc.)"
            echo ""
            echo "Note: AgentCore ENIs can take up to 8 hours to release after agent deletion."
            echo "      If Phase 2 fails due to hanging ENIs, wait and re-run the script."
            echo ""
            echo "Options:"
            echo "  --force, -f        Skip confirmation prompt"
            echo "  --check-only       Check ENI status without deleting anything"
            echo "  --region, -r       AWS region (default: us-east-1)"
            echo "  -h, --help         Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

cd "${PROJECT_ROOT}"

# Handle --check-only flag early
if [ "$CHECK_ONLY" = true ]; then
    echo ""
    echo "============================================="
    echo "  Agentify ENI Status Check"
    echo "  Project: ${PROJECT_NAME}"
    echo "  Region: ${REGION}"
    echo "============================================="
    echo ""

    print_step "Checking for hanging AgentCore ENIs..."
    VPC_ID=$(get_vpc_id)

    if [ -z "$VPC_ID" ]; then
        print_warning "No VPC found for project. Infrastructure may already be destroyed."
        exit 0
    fi

    print_step "Checking VPC: ${VPC_ID}"

    if check_hanging_enis "$VPC_ID"; then
        print_success "No hanging ENIs found. CDK destroy can proceed."
        echo ""
        echo "Run: ./scripts/destroy.sh --force"
    else
        print_warning "${HANGING_ENI_COUNT} AgentCore ENI(s) still attached:"
        echo ""
        echo "$HANGING_ENI_LIST" | while read -r eni subnet ip; do
            echo "    - ${eni} in ${subnet} (${ip})"
        done
        echo ""
        echo -e "${YELLOW}ENIs are managed by AWS and can take up to 8 hours to release.${NC}"
        echo "CDK destroy cannot proceed until ENIs are released."
        echo ""
        echo "To retry: ./scripts/destroy.sh --check-only"
    fi
    exit 0
fi

echo ""
echo "============================================="
echo "  Agentify Infrastructure Teardown"
echo "  Project: ${PROJECT_NAME}"
echo "  Region: ${REGION}"
echo "============================================="
echo ""

# Confirmation prompt
if [ "$FORCE" = false ]; then
    echo -e "${YELLOW}WARNING: This will destroy AWS resources.${NC}"
    echo ""
    echo "The following will be deleted:"
    echo "  - AgentCore agents (if any deployed)"
    echo "  - AgentCore Policy Engine (if configured)"
    echo "  - AgentCore MCP Gateway (if configured)"
    echo "  - SSM Parameters (/agentify/${PROJECT_NAME}/*)"
    echo "  - DynamoDB workflow events table"
    echo "  - VPC and networking resources"
    echo "  - ECR repositories (if created)"
    echo ""
    read -p "Are you sure you want to continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Aborted by user"
        exit 0
    fi
fi

# =============================================================================
# PHASE 1: Cleanup (Agents + Policy Engine + Gateway)
# =============================================================================
echo ""
echo "============================================="
echo "  Phase 1: Cleanup (Agents + Policy + Gateway)"
echo "============================================="
echo ""

PHASE1_AGENTS_DELETED=false
PHASE1_POLICY_DELETED=false
PHASE1_GATEWAY_DELETED=false

# Step 1: Delete AgentCore Agents
print_step "Step 1: Deleting AgentCore agents..."

# Check if agentcore toolkit is installed and config exists
if [ -f "${PROJECT_ROOT}/.bedrock_agentcore.yaml" ]; then
    # Ensure agentcore toolkit is available (install in CDK dir if needed)
    cd "${CDK_DIR}"
    uv sync --quiet 2>/dev/null || true
    if ! uv run agentcore --help &> /dev/null 2>&1; then
        print_step "Installing AgentCore Starter Toolkit..."
        uv add --dev bedrock-agentcore-starter-toolkit 2>/dev/null || true
    fi
    cd "${PROJECT_ROOT}"

    if uv run --project "${CDK_DIR}" agentcore --help &> /dev/null 2>&1; then
        # Get list of configured agents from YAML (agents section, indented entries)
        AGENTS=$(grep -A 100 "^agents:" "${PROJECT_ROOT}/.bedrock_agentcore.yaml" 2>/dev/null | grep "^  [a-z_0-9]*:$" | sed 's/://g' | tr -d ' ' || echo "")

        # IMPORTANT: Extract agent_id values BEFORE destroying
        # agentcore destroy removes the agent from .bedrock_agentcore.yaml,
        # so we need the IDs upfront to poll AWS directly
        declare -a AGENT_IDS=()
        if [ -n "$AGENTS" ]; then
            for AGENT in $AGENTS; do
                AGENT_ID=$(grep -A 20 "^  ${AGENT}:" "${PROJECT_ROOT}/.bedrock_agentcore.yaml" 2>/dev/null | grep "agent_id:" | head -1 | sed 's/.*agent_id: *//' | tr -d ' "' || echo "")
                if [ -n "$AGENT_ID" ]; then
                    AGENT_IDS+=("$AGENT_ID")
                    print_step "Found agent ${AGENT} with ID: ${AGENT_ID}"
                fi
            done
        fi

        if [ -n "$AGENTS" ]; then
            # Issue destroy commands for all agents
            for AGENT in $AGENTS; do
                print_step "Destroying agent: ${AGENT}"
                uv run --project "${CDK_DIR}" agentcore destroy -a "${AGENT}" --force 2>/dev/null || print_warning "Agent ${AGENT} may already be destroyed"
            done
            print_success "Agent destroy commands issued"

            # Poll AWS directly until all agents are fully deleted
            # This is critical because agentcore destroy is async and removes
            # the agent from .bedrock_agentcore.yaml immediately, but ENIs
            # won't release until the agent runtime is actually deleted in AWS
            if [ ${#AGENT_IDS[@]} -gt 0 ]; then
                print_step "Waiting for agents to be fully deleted from AWS..."
                MAX_WAIT=300  # 5 minutes max
                POLL_INTERVAL=10
                ELAPSED=0

                while [ $ELAPSED -lt $MAX_WAIT ]; do
                    ALL_DELETED=true
                    for AGENT_ID in "${AGENT_IDS[@]}"; do
                        # Poll AWS directly - get-agent-runtime returns error when agent doesn't exist
                        if aws bedrock-agentcore-control get-agent-runtime \
                            --agent-runtime-id "$AGENT_ID" \
                            --region "${REGION}" &>/dev/null; then
                            # Agent still exists in AWS
                            STATUS=$(aws bedrock-agentcore-control get-agent-runtime \
                                --agent-runtime-id "$AGENT_ID" \
                                --region "${REGION}" \
                                --query 'status' --output text 2>/dev/null || echo "unknown")
                            print_step "Agent ${AGENT_ID} still exists in AWS (status: ${STATUS})"
                            ALL_DELETED=false
                        fi
                    done

                    if [ "$ALL_DELETED" = true ]; then
                        print_success "All agents deleted from AWS"
                        PHASE1_AGENTS_DELETED=true
                        break
                    fi

                    echo "  Waiting ${POLL_INTERVAL}s for agent deletion... (${ELAPSED}s/${MAX_WAIT}s)"
                    sleep $POLL_INTERVAL
                    ELAPSED=$((ELAPSED + POLL_INTERVAL))
                done

                if [ $ELAPSED -ge $MAX_WAIT ]; then
                    print_warning "Timeout waiting for agent deletion. Proceeding anyway..."
                fi
            fi
        else
            print_warning "No agents found in .bedrock_agentcore.yaml"
        fi
    else
        print_warning "AgentCore Starter Toolkit not installed. Skipping agent deletion."
    fi
else
    print_warning "No AgentCore config found. Skipping agent deletion."
fi

# Step 1b: Delete AgentCore Policy Engine
print_step "Step 1b: Deleting AgentCore Policy Engine..."

INFRA_CONFIG="${PROJECT_ROOT}/.agentify/infrastructure.json"

if [ -f "${INFRA_CONFIG}" ] && command -v jq &> /dev/null; then
    POLICY_ENGINE_ID=$(jq -r '.policy.policyEngineId // empty' "${INFRA_CONFIG}" 2>/dev/null)

    if [ -n "$POLICY_ENGINE_ID" ]; then
        cd "${CDK_DIR}"
        
        # Ensure agentcore toolkit is available
        if ! uv run agentcore --version &> /dev/null 2>&1; then
            print_step "Installing AgentCore Starter Toolkit..."
            uv add --dev bedrock-agentcore-starter-toolkit 2>/dev/null || true
        fi

        # First, list and delete all policies in the engine
        print_step "Deleting policies from Policy Engine: ${POLICY_ENGINE_ID}"
        
        POLICY_LIST=$(uv run agentcore policy list-policies \
            --policy-engine-id "$POLICY_ENGINE_ID" \
            --region "${REGION}" 2>&1 || echo "")
        
        # Extract policy IDs from output (format varies, try common patterns)
        POLICY_IDS=$(echo "$POLICY_LIST" | grep -oE '[a-zA-Z0-9_-]+-[a-zA-Z0-9]+' | sort -u || true)
        
        for POLICY_ID in $POLICY_IDS; do
            # Skip if it looks like the engine ID itself
            if [ "$POLICY_ID" != "$POLICY_ENGINE_ID" ]; then
                print_step "Deleting policy: ${POLICY_ID}"
                uv run agentcore policy delete-policy \
                    --policy-engine-id "$POLICY_ENGINE_ID" \
                    --policy-id "$POLICY_ID" \
                    --region "${REGION}" 2>/dev/null || true
            fi
        done

        # Now delete the Policy Engine itself
        print_step "Deleting Policy Engine: ${POLICY_ENGINE_ID}"
        if uv run agentcore policy delete-policy-engine \
            --policy-engine-id "$POLICY_ENGINE_ID" \
            --region "${REGION}" 2>/dev/null; then
            print_success "Policy Engine deleted: ${POLICY_ENGINE_ID}"
            PHASE1_POLICY_DELETED=true
        else
            print_warning "Could not delete Policy Engine ${POLICY_ENGINE_ID} (may already be deleted)"
        fi
        
        cd "${PROJECT_ROOT}"
    else
        print_warning "No Policy Engine ID found in infrastructure.json"
    fi
else
    print_warning "No infrastructure.json found. Skipping Policy Engine deletion."
fi

# Step 2: Cleanup MCP Gateway
print_step "Step 2: Cleaning up AgentCore MCP Gateway..."

GATEWAY_CONFIG="${CDK_DIR}/gateway_config.json"
if [ -f "${GATEWAY_CONFIG}" ]; then
    cd "${CDK_DIR}"
    # Sync dependencies to ensure toolkit is available
    uv sync --quiet 2>/dev/null || true
    print_step "Running Gateway cleanup (includes Cognito resources)..."
    if uv run python gateway/cleanup_gateway.py --force; then
        print_success "Gateway cleanup complete"
        PHASE1_GATEWAY_DELETED=true
    else
        print_warning "Gateway cleanup failed. You may need to delete it manually."
    fi
    cd "${PROJECT_ROOT}"
else
    print_warning "No gateway_config.json found. Skipping Gateway cleanup."
fi

# Step 2b: Cleanup SSM Parameters
print_step "Step 2b: Cleaning up SSM Parameters..."

SSM_PREFIX="/agentify/${PROJECT_NAME}"
print_step "Deleting SSM parameters under ${SSM_PREFIX}/*"

# List and delete parameters
SSM_PARAMS=$(aws ssm get-parameters-by-path \
    --path "${SSM_PREFIX}" \
    --recursive \
    --query "Parameters[].Name" \
    --output text \
    --region "${REGION}" 2>/dev/null || echo "")

if [ -n "$SSM_PARAMS" ]; then
    for PARAM in $SSM_PARAMS; do
        aws ssm delete-parameter --name "$PARAM" --region "${REGION}" 2>/dev/null || true
        print_success "Deleted SSM parameter: $PARAM"
    done
else
    print_warning "No SSM parameters found under ${SSM_PREFIX}"
fi

# Also cleanup agent-specific SSM parameters
AGENT_SSM_PREFIX="/agentify/agents"
AGENT_PARAMS=$(aws ssm get-parameters-by-path \
    --path "${AGENT_SSM_PREFIX}" \
    --recursive \
    --query "Parameters[].Name" \
    --output text \
    --region "${REGION}" 2>/dev/null || echo "")

if [ -n "$AGENT_PARAMS" ]; then
    for PARAM in $AGENT_PARAMS; do
        aws ssm delete-parameter --name "$PARAM" --region "${REGION}" 2>/dev/null || true
        print_success "Deleted SSM parameter: $PARAM"
    done
fi

# =============================================================================
# PHASE 2: Infrastructure (CDK)
# =============================================================================
echo ""
echo "============================================="
echo "  Phase 2: Infrastructure (CDK)"
echo "============================================="
echo ""

# Check for hanging ENIs before attempting CDK destroy
print_step "Checking for hanging AgentCore ENIs..."
VPC_ID=$(get_vpc_id)

if [ -n "$VPC_ID" ]; then
    print_step "Checking VPC: ${VPC_ID}"

    if ! check_hanging_enis "$VPC_ID"; then
        print_error "${HANGING_ENI_COUNT} AgentCore ENI(s) still attached to VPC subnets:"
        echo ""
        echo "$HANGING_ENI_LIST" | while read -r eni subnet ip; do
            echo "    - ${eni} in ${subnet} (${ip})"
        done
        echo ""
        echo "============================================="
        echo -e "  ${YELLOW}Phase 1 Complete - Phase 2 Blocked${NC}"
        echo "============================================="
        echo ""
        echo "Completed:"
        if [ "$PHASE1_AGENTS_DELETED" = true ]; then
            echo "  ✓ AgentCore agents deleted"
        else
            echo "  - AgentCore agents (none found or already deleted)"
        fi
        if [ "$PHASE1_POLICY_DELETED" = true ]; then
            echo "  ✓ Policy Engine deleted"
        else
            echo "  - Policy Engine (none found or already deleted)"
        fi
        if [ "$PHASE1_GATEWAY_DELETED" = true ]; then
            echo "  ✓ MCP Gateway deleted"
        else
            echo "  - MCP Gateway (none found or already deleted)"
        fi
        echo ""
        echo "Blocked:"
        echo "  - CDK stacks (waiting for ENI release)"
        echo ""
        echo -e "${YELLOW}ENIs are managed by AWS and can take up to 8 hours to release.${NC}"
        echo "CDK destroy cannot proceed until ENIs are released."
        echo ""
        echo "To check status:    ./scripts/destroy.sh --check-only"
        echo "To retry destroy:   ./scripts/destroy.sh --force"
        echo ""
        exit 1
    fi

    print_success "No hanging ENIs found"
else
    print_warning "No VPC found. Infrastructure may already be destroyed or never created."
fi

# CDK Destroy
print_step "Destroying CDK stacks..."

# Change to CDK directory
cd "${CDK_DIR}"

# Check if CDK is set up
if [ ! -f "pyproject.toml" ]; then
    print_warning "CDK project not found. Nothing to destroy."
    exit 0
fi

# Install dependencies if needed
uv sync --quiet 2>/dev/null || true

# List stacks to show what will be destroyed
print_step "Stacks to be destroyed:"
uv run cdk list -c project="${PROJECT_NAME}" -c region="${REGION}" 2>/dev/null | while read -r stack; do
    echo "  - ${stack}"
done

# Destroy all stacks
print_step "Running cdk destroy (this may take 5-10 minutes)..."
uv run cdk destroy -c project="${PROJECT_NAME}" -c region="${REGION}" --all --force
print_success "CDK stacks destroyed"

# Return to project root
cd "${PROJECT_ROOT}"

# Clean up local config files
print_step "Cleaning up local configuration files..."

if [ -f "${PROJECT_ROOT}/.agentify/infrastructure.json" ]; then
    rm -f "${PROJECT_ROOT}/.agentify/infrastructure.json"
    print_success "Removed .agentify/infrastructure.json"
fi

if [ -f "${CDK_DIR}/gateway_config.json" ]; then
    rm -f "${CDK_DIR}/gateway_config.json"
    print_success "Removed gateway_config.json"
fi

if [ -f "${CDK_DIR}/cdk-outputs.json" ]; then
    rm -f "${CDK_DIR}/cdk-outputs.json"
    print_success "Removed cdk-outputs.json"
fi

echo ""
echo "============================================="
echo -e "  ${GREEN}Teardown Complete!${NC}"
echo "============================================="
echo ""
echo "All resources have been deleted:"
echo "  - AgentCore agents"
echo "  - AgentCore Policy Engine"
echo "  - AgentCore MCP Gateway"
echo "  - SSM Parameters"
echo "  - AWS CDK resources (VPC, DynamoDB, etc.)"
echo ""
echo "Notes:"
echo "  - CloudWatch logs may be retained based on retention policy"
echo "  - ECR repositories may need manual cleanup if not empty"
echo ""
echo "To check for remaining resources:"
echo "  aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE --query 'StackSummaries[?starts_with(StackName, \`Agentify\`)].StackName'"
echo ""
