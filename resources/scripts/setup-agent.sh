#!/bin/bash
# =============================================================================
# Agentify Setup - Agent Deployment
# =============================================================================
# Deploys a single agent to AgentCore Runtime:
#   - Finds handler file
#   - Creates Dockerfile from template
#   - Configures agent with VPC settings
#   - Deploys via CodeBuild
#   - Adds IAM permissions for DynamoDB and SSM
#
# This script can be run standalone or called by setup.sh
#
# Usage:
#   ./scripts/setup-agent.sh --agent my_agent           # Deploy agent
#   ./scripts/setup-agent.sh -a my_agent --region eu-west-1
# =============================================================================

set -e

# Source common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/setup-common.sh"

# =============================================================================
# Argument Parsing
# =============================================================================

show_help() {
    echo "Usage: $0 --agent NAME [options]"
    echo ""
    echo "Deploy a single agent to AgentCore Runtime."
    echo ""
    echo "Required:"
    echo "  --agent, -a NAME       Agent name to deploy"
    echo ""
    echo "Options:"
    echo "  --region, -r REGION    AWS region (default: us-east-1)"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --agent inventory_agent    # Deploy inventory_agent"
    echo "  $0 -a my_agent -r eu-west-1   # Deploy to EU region"
    echo ""
    echo "Agent handler must be at one of:"
    echo "  - agents/{name}.py"
    echo "  - agents/{name}_handler.py"
    echo "  - agents/{name}/handler.py"
}

AGENT_NAME=""
CUSTOM_REGION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --agent|-a)
            AGENT_NAME="$2"
            shift 2
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

# Validate required arguments
if [ -z "$AGENT_NAME" ]; then
    print_error "Agent name is required"
    show_help
    exit 1
fi

# =============================================================================
# Main
# =============================================================================

main() {
    # Initialize common variables
    init_common "$CUSTOM_REGION"

    show_banner "Agent Deployment: ${AGENT_NAME}"

    # Ensure AgentCore toolkit is installed
    ensure_agentcore_toolkit

    # Load infrastructure config
    load_infrastructure_config

    # Find handler file
    find_handler_file

    # Ensure Dockerfile exists
    ensure_dockerfile

    # Configure agent
    configure_agent

    # Deploy agent
    deploy_agent

    # Store agent ID in SSM
    store_agent_id

    # Add IAM permissions
    add_iam_permissions

    # Show success message
    show_success_message
}

# =============================================================================
# Load Infrastructure Config
# =============================================================================

load_infrastructure_config() {
    if [ -f "${INFRA_CONFIG}" ]; then
        SUBNET_IDS=$(jq -r '.vpc_subnet_ids' "${INFRA_CONFIG}")
        SG_ID=$(jq -r '.vpc_security_group_id' "${INFRA_CONFIG}")
        print_success "Loaded infrastructure config"
    else
        # Fetch from CloudFormation
        print_step "Fetching infrastructure from CloudFormation..."

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
            print_error "Infrastructure not found. Run setup-cdk.sh first."
            exit 1
        fi
    fi

    export SUBNET_IDS SG_ID
}

# =============================================================================
# Find Handler File
# =============================================================================

find_handler_file() {
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

    print_success "Found handler: ${HANDLER_FILE}"
    export HANDLER_FILE
}

# =============================================================================
# Ensure Dockerfile
# =============================================================================

ensure_dockerfile() {
    DOCKERFILE_DIR="${PROJECT_ROOT}/.bedrock_agentcore/${AGENT_NAME}"
    DOCKERFILE_PATH="${DOCKERFILE_DIR}/Dockerfile"

    if [ -f "${DOCKERFILE_PATH}" ]; then
        print_success "Dockerfile already exists"
        return
    fi

    print_step "Creating Dockerfile for ${AGENT_NAME}..."
    mkdir -p "${DOCKERFILE_DIR}"

    # Get handler module name (without .py extension and path)
    HANDLER_MODULE=$(basename "${HANDLER_FILE}" .py)

    # Copy template and replace placeholder
    TEMPLATE_PATH="${SCRIPT_DIR}/templates/Dockerfile.agentcore.template"
    if [ -f "${TEMPLATE_PATH}" ]; then
        sed "s/AGENT_HANDLER_MODULE/${HANDLER_MODULE}/" "${TEMPLATE_PATH}" > "${DOCKERFILE_PATH}"
        print_success "Dockerfile created from template"
    else
        print_warning "Dockerfile template not found, agentcore will generate one"
    fi
}

# =============================================================================
# Configure Agent
# =============================================================================

configure_agent() {
    # Check if agent already configured
    if grep -q "^  ${AGENT_NAME}:" "${PROJECT_ROOT}/.bedrock_agentcore.yaml" 2>/dev/null; then
        print_success "${AGENT_NAME} already configured"
        return
    fi

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
}

# =============================================================================
# Deploy Agent
# =============================================================================

deploy_agent() {
    print_step "Deploying ${AGENT_NAME} via CodeBuild..."

    # Pass project name so agent can discover Gateway credentials from SSM
    DEPLOY_ENV_ARGS="--env AGENTIFY_PROJECT_NAME=${PROJECT_NAME}"

    uv run agentcore deploy -a "${AGENT_NAME}" --auto-update-on-conflict ${DEPLOY_ENV_ARGS}

    print_success "${AGENT_NAME} deployed"
}

# =============================================================================
# Store Agent ID in SSM
# =============================================================================

store_agent_id() {
    print_step "Storing ${AGENT_NAME} ID in SSM Parameter Store..."

    # agent_id is nested ~35 lines deep under bedrock_agentcore: section
    AGENT_ID=$(grep -A 50 "^  ${AGENT_NAME}:" "${PROJECT_ROOT}/.bedrock_agentcore.yaml" | \
               grep "agent_id:" | head -1 | sed 's/.*agent_id: *//' | tr -d ' "')

    if [ -n "$AGENT_ID" ]; then
        SSM_PARAM_NAME="/agentify/agents/${AGENT_NAME}/id"

        if aws ssm put-parameter \
            --name "${SSM_PARAM_NAME}" \
            --value "${AGENT_ID}" \
            --type "String" \
            --overwrite \
            --region "${REGION}" 2>/dev/null; then
            print_success "Stored agent ID in SSM: ${SSM_PARAM_NAME}"
        else
            print_warning "Could not store agent ID in SSM"
        fi
    else
        print_warning "Could not find agent ID in .bedrock_agentcore.yaml"
    fi

    export AGENT_ID
}

# =============================================================================
# Add IAM Permissions
# =============================================================================

add_iam_permissions() {
    print_step "Adding IAM permissions for ${AGENT_NAME}..."

    # execution_role is ~12 lines deep under aws: section, use 25 for safety
    EXECUTION_ROLE=$(grep -A 25 "^  ${AGENT_NAME}:" "${PROJECT_ROOT}/.bedrock_agentcore.yaml" | \
                     grep "execution_role:" | head -1 | sed 's/.*arn:aws:iam::[0-9]*:role\///' | tr -d ' ')

    if [ -z "$EXECUTION_ROLE" ]; then
        print_warning "Could not find execution role for ${AGENT_NAME}"
        return
    fi

    # Get DynamoDB table ARN
    TABLE_ARN=$(aws dynamodb describe-table \
        --table-name "${PROJECT_NAME}-workflow-events" \
        --query "Table.TableArn" \
        --output text \
        --region "${REGION}" 2>/dev/null || echo "")

    if [ -z "$TABLE_ARN" ]; then
        print_warning "DynamoDB table ${PROJECT_NAME}-workflow-events not found, skipping IAM policy"
        return
    fi

    POLICY_NAME="AgentifyAccess-${AGENT_NAME}"

    # Create policy document
    POLICY_DOCUMENT=$(cat << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "DynamoDBWorkflowEventsAccess",
            "Effect": "Allow",
            "Action": ["dynamodb:PutItem", "dynamodb:Query"],
            "Resource": ["${TABLE_ARN}"]
        },
        {
            "Sid": "SSMParameterAccess",
            "Effect": "Allow",
            "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
            "Resource": [
                "arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter/agentify/*",
                "arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter/${PROJECT_NAME}/*"
            ]
        }
    ]
}
EOF
)

    if aws iam put-role-policy \
        --role-name "${EXECUTION_ROLE}" \
        --policy-name "${POLICY_NAME}" \
        --policy-document "${POLICY_DOCUMENT}" \
        --region "${REGION}" 2>/dev/null; then
        print_success "IAM permissions added for ${AGENT_NAME}"
    else
        print_warning "Could not add IAM permissions for ${AGENT_NAME}"
    fi
}

# =============================================================================
# Show Success Message
# =============================================================================

show_success_message() {
    echo ""
    echo "============================================="
    echo -e "  ${GREEN}Agent Deployed Successfully!${NC}"
    echo "============================================="
    echo ""
    echo "Test your agent:"
    echo "  uv run agentcore invoke '{\"prompt\": \"Hello!\"}' -a ${AGENT_NAME}"
    echo ""
    echo "View agent logs:"
    echo "  aws logs tail /aws/bedrock-agentcore/runtimes/${AGENT_NAME}-* --follow"
    echo ""
    echo "Agent management:"
    echo "  - Check status: uv run agentcore status"
    echo "  - Delete agent: uv run agentcore delete -a ${AGENT_NAME} --force"
    echo ""
}

# Run main
main
