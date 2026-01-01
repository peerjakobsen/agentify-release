#!/bin/bash
# =============================================================================
# Agentify Infrastructure Destroy Script
# =============================================================================
# This script tears down Agentify infrastructure:
#   - AgentCore agents (if deployed)
#   - AgentCore MCP Gateway (if configured)
#   - CDK stacks (VPC, DynamoDB, Lambda functions)
#
# Usage:
#   ./scripts/destroy.sh                # Destroy everything
#   ./scripts/destroy.sh --force        # Skip confirmation
#   ./scripts/destroy.sh --skip-agents  # Keep agents, destroy Gateway + infra
# =============================================================================

set -e

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
SKIP_AGENTS=false
REGION="${AWS_REGION:-us-east-1}"

while [[ $# -gt 0 ]]; do
    case $1 in
        --force|-f)
            FORCE=true
            shift
            ;;
        --skip-agents)
            SKIP_AGENTS=true
            shift
            ;;
        --region|-r)
            REGION="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --force, -f        Skip confirmation prompt"
            echo "  --skip-agents      Skip agent deletion"
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
    echo "  - AgentCore MCP Gateway (if configured)"
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

# Step 1: Delete AgentCore Agents
if [ "$SKIP_AGENTS" = false ]; then
    print_step "Step 1/3: Deleting AgentCore agents..."

    # Check if agentcore toolkit is installed and config exists
    if [ -f "${PROJECT_ROOT}/.bedrock_agentcore.yaml" ]; then
        if uv run agentcore --version &> /dev/null 2>&1; then
            # Get list of configured agents
            AGENTS=$(grep "^  [a-z_]*:" "${PROJECT_ROOT}/.bedrock_agentcore.yaml" 2>/dev/null | sed 's/://g' | tr -d ' ' || echo "")

            if [ -n "$AGENTS" ]; then
                for AGENT in $AGENTS; do
                    print_step "Destroying agent: ${AGENT}"
                    uv run agentcore destroy -a "${AGENT}" --force 2>/dev/null || print_warning "Agent ${AGENT} may already be destroyed"
                done
                print_success "Agent destroy commands issued"

                # Poll until all agents are fully deleted
                # AgentCore destroy is async - ENIs won't release until agents are gone
                print_step "Waiting for agents to be fully deleted..."
                MAX_WAIT=300  # 5 minutes max
                POLL_INTERVAL=10
                ELAPSED=0

                while [ $ELAPSED -lt $MAX_WAIT ]; do
                    ALL_DELETED=true
                    for AGENT in $AGENTS; do
                        # Check if agent still exists (status command returns non-zero if not found)
                        if uv run agentcore status -a "${AGENT}" &>/dev/null; then
                            STATUS=$(uv run agentcore status -a "${AGENT}" 2>/dev/null | grep -i "status" | head -1 || echo "unknown")
                            print_step "Agent ${AGENT} still exists: ${STATUS}"
                            ALL_DELETED=false
                        fi
                    done

                    if [ "$ALL_DELETED" = true ]; then
                        print_success "All agents deleted"
                        break
                    fi

                    echo "  Waiting ${POLL_INTERVAL}s for agent deletion... (${ELAPSED}s/${MAX_WAIT}s)"
                    sleep $POLL_INTERVAL
                    ELAPSED=$((ELAPSED + POLL_INTERVAL))
                done

                if [ $ELAPSED -ge $MAX_WAIT ]; then
                    print_warning "Timeout waiting for agent deletion. Proceeding anyway..."
                fi

                # Additional wait for ENI release after agents are gone
                print_step "Waiting 30s for ENI release..."
                sleep 30
            else
                print_warning "No agents found in .bedrock_agentcore.yaml"
            fi
        else
            print_warning "AgentCore Starter Toolkit not installed. Skipping agent deletion."
        fi
    else
        print_warning "No AgentCore config found. Skipping agent deletion."
    fi
else
    print_warning "Step 1/3: Skipping agent deletion (--skip-agents)"
fi

# Step 2: Cleanup MCP Gateway
print_step "Step 2/3: Cleaning up AgentCore MCP Gateway..."

GATEWAY_CONFIG="${CDK_DIR}/gateway_config.json"
if [ -f "${GATEWAY_CONFIG}" ]; then
    cd "${CDK_DIR}"
    # Sync dependencies to ensure toolkit is available
    uv sync --quiet 2>/dev/null || true
    print_step "Running Gateway cleanup (includes Cognito resources)..."
    uv run python gateway/cleanup_gateway.py --force && \
        print_success "Gateway cleanup complete" || \
        print_warning "Gateway cleanup failed. You may need to delete it manually."
    cd "${PROJECT_ROOT}"
else
    print_warning "No gateway_config.json found. Skipping Gateway cleanup."
fi

# Step 3: CDK Destroy
print_step "Step 3/3: Destroying CDK stacks..."

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

# Clean up local config
if [ -f "${PROJECT_ROOT}/.agentify/infrastructure.json" ]; then
    rm -f "${PROJECT_ROOT}/.agentify/infrastructure.json"
    print_success "Removed local infrastructure config"
fi

echo ""
echo "============================================="
echo -e "  ${GREEN}Teardown Complete!${NC}"
echo "============================================="
echo ""
echo "Notes:"
echo "  - AgentCore agents have been deleted"
echo "  - AgentCore MCP Gateway has been deleted"
echo "  - AWS CDK resources have been deleted"
echo "  - CloudWatch logs may be retained based on retention policy"
echo "  - ECR repositories may need manual cleanup if not empty"
echo ""
echo "To check for remaining resources:"
echo "  aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE --query 'StackSummaries[?starts_with(StackName, \`Agentify\`)].StackName'"
echo ""
