#!/bin/bash
# =============================================================================
# Agentify Infrastructure Setup Script
# =============================================================================
# This script deploys the shared infrastructure for Agentify demos:
#   - VPC with private subnets (for AgentCore Runtime)
#   - DynamoDB table (for Demo Viewer event streaming)
#
# Run this ONCE before deploying any agents. The infrastructure is shared
# across all Agentify projects in your AWS account.
#
# Usage:
#   ./scripts/setup.sh                    # Deploy infrastructure
#   ./scripts/setup.sh --skip-cdk         # Skip CDK, deploy agent only
#   ./scripts/setup.sh --agent my_agent   # Deploy a specific agent
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

# Load environment variables if .env exists
if [ -f "${PROJECT_ROOT}/.env" ]; then
    print_step "Loading environment variables from .env"
    set -a
    source "${PROJECT_ROOT}/.env"
    set +a
    print_success "Environment loaded"
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

    # Synthesize first to validate
    print_step "Running cdk synth..."
    uv run cdk synth -c region="${REGION}" --quiet
    print_success "CDK synthesis complete"

    # Deploy all stacks
    print_step "Deploying CDK stacks (this may take 5-10 minutes)..."
    uv run cdk deploy -c region="${REGION}" --all --require-approval never
    print_success "CDK deployment complete"

    # Return to project root
    cd "${PROJECT_ROOT}"

    # Fetch and display infrastructure outputs
    print_step "Fetching infrastructure outputs..."

    NETWORKING_STACK="Agentify-Networking-${REGION}"
    OBSERVABILITY_STACK="Agentify-Observability-${REGION}"

    SUBNET_IDS=$(aws cloudformation describe-stacks \
        --stack-name "${NETWORKING_STACK}" \
        --query "Stacks[0].Outputs[?ExportName=='agentify-PrivateSubnetIds'].OutputValue" \
        --output text --region "${REGION}" 2>/dev/null)

    SG_ID=$(aws cloudformation describe-stacks \
        --stack-name "${NETWORKING_STACK}" \
        --query "Stacks[0].Outputs[?ExportName=='agentify-AgentSecurityGroupId'].OutputValue" \
        --output text --region "${REGION}" 2>/dev/null)

    TABLE_NAME=$(aws cloudformation describe-stacks \
        --stack-name "${OBSERVABILITY_STACK}" \
        --query "Stacks[0].Outputs[?ExportName=='agentify-WorkflowEventsTableName'].OutputValue" \
        --output text --region "${REGION}" 2>/dev/null)

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
        NETWORKING_STACK="Agentify-Networking-${REGION}"

        SUBNET_IDS=$(aws cloudformation describe-stacks \
            --stack-name "${NETWORKING_STACK}" \
            --query "Stacks[0].Outputs[?ExportName=='agentify-PrivateSubnetIds'].OutputValue" \
            --output text --region "${REGION}" 2>/dev/null)

        SG_ID=$(aws cloudformation describe-stacks \
            --stack-name "${NETWORKING_STACK}" \
            --query "Stacks[0].Outputs[?ExportName=='agentify-AgentSecurityGroupId'].OutputValue" \
            --output text --region "${REGION}" 2>/dev/null)

        if [ -z "$SUBNET_IDS" ] || [ -z "$SG_ID" ]; then
            print_error "Infrastructure not found. Run without --skip-cdk first."
            exit 1
        fi
    fi
fi

# Step 2: Deploy Agent (if specified)
if [ -n "$AGENT_NAME" ]; then
    print_step "Step 2: Deploying agent '${AGENT_NAME}'..."

    # Check if agentcore toolkit is installed
    if ! uv run agentcore --version &> /dev/null 2>&1; then
        print_step "Installing AgentCore Starter Toolkit..."
        uv add bedrock-agentcore-starter-toolkit
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
    uv run agentcore deploy -a "${AGENT_NAME}" --auto-update-on-conflict
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
        TABLE_ARN=$(aws dynamodb describe-table --table-name agentify-workflow-events --query "Table.TableArn" --output text --region "${REGION}" 2>/dev/null || echo "")

        if [ -n "$TABLE_ARN" ]; then
            POLICY_NAME="AgentifyAccess-${AGENT_NAME}"
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
                        "Action": ["ssm:GetParameter", "ssm:GetParameters"],
                        "Resource": ["arn:aws:ssm:'${REGION}':'${ACCOUNT_ID}':parameter/agentify/*"]
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
        fi
    else
        print_warning "Could not find execution role for ${AGENT_NAME}"
    fi

else
    print_step "Step 2: No agent specified (use --agent NAME to deploy an agent)"
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
