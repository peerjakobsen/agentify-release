#!/bin/bash
# =============================================================================
# Agentify Agent Invoke Script
# =============================================================================
# This script invokes an agent and verifies DynamoDB instrumentation data.
#
# Usage:
#   ./scripts/invoke.sh -a <agent_name> -p "<prompt>"
#   ./scripts/invoke.sh --agent <agent_name> --prompt "<prompt>"
#
# Examples:
#   ./scripts/invoke.sh -a triage -p "Customer has login issues"
#   ./scripts/invoke.sh --agent technical --prompt "Check ticket TKT-001"
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

# Derive project name from workspace folder (sanitized for CloudFormation)
sanitize_project_name() {
    local name="$1"
    echo "$name" | tr '[:upper:]' '[:lower:]' | \
        sed 's/[_ ]/-/g' | \
        sed 's/[^a-z0-9-]//g' | \
        sed 's/-\+/-/g' | \
        sed 's/^-//;s/-$//'
}

WORKSPACE_FOLDER="$(basename "${PROJECT_ROOT}")"
PROJECT_NAME="$(sanitize_project_name "${WORKSPACE_FOLDER}")"
PROJECT_NAME="${PROJECT_NAME:-agentify}"

# Load environment variables if .env exists
if [ -f "${PROJECT_ROOT}/.env" ]; then
    set -a
    source "${PROJECT_ROOT}/.env"
    set +a
fi

# Load AWS profile from config.json if not already set
CONFIG_JSON="${PROJECT_ROOT}/.agentify/config.json"
if [ -z "$AWS_PROFILE" ] && [ -f "${CONFIG_JSON}" ]; then
    if command -v jq &> /dev/null; then
        PROFILE_FROM_CONFIG=$(jq -r '.aws.profile // empty' "${CONFIG_JSON}" 2>/dev/null)
        if [ -n "$PROFILE_FROM_CONFIG" ]; then
            export AWS_PROFILE="$PROFILE_FROM_CONFIG"
        fi
    fi
fi

# Load region from infrastructure.json or use default
INFRA_JSON="${PROJECT_ROOT}/.agentify/infrastructure.json"
if [ -f "${INFRA_JSON}" ] && command -v jq &> /dev/null; then
    REGION=$(jq -r '.region // empty' "${INFRA_JSON}" 2>/dev/null)
fi
REGION="${REGION:-${AWS_REGION:-us-east-1}}"

# Parse arguments
AGENT_NAME=""
PROMPT=""
SKIP_DYNAMO_CHECK=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --agent|-a)
            AGENT_NAME="$2"
            shift 2
            ;;
        --prompt|-p)
            PROMPT="$2"
            shift 2
            ;;
        --skip-check)
            SKIP_DYNAMO_CHECK=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --agent, -a NAME     Agent name to invoke (required)"
            echo "  --prompt, -p TEXT    Prompt to send to agent (required)"
            echo "  --skip-check         Skip DynamoDB verification"
            echo "  -h, --help           Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 -a triage -p \"Customer has login issues\""
            echo "  $0 --agent technical --prompt \"Check ticket TKT-001\""
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate required arguments
if [ -z "$AGENT_NAME" ]; then
    print_error "Agent name is required. Use --agent or -a"
    echo "Run '$0 --help' for usage information"
    exit 1
fi

if [ -z "$PROMPT" ]; then
    print_error "Prompt is required. Use --prompt or -p"
    echo "Run '$0 --help' for usage information"
    exit 1
fi

# Check required tools
if ! command -v uv &> /dev/null; then
    print_error "uv is not installed. Please install it first."
    exit 1
fi

if ! command -v jq &> /dev/null; then
    print_error "jq is not installed. Please install it: brew install jq"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured or expired."
    exit 1
fi

echo ""
echo "============================================="
echo "  Agentify Agent Invoke"
echo "  Project: ${PROJECT_NAME}"
echo "  Agent: ${AGENT_NAME}"
echo "  Region: ${REGION}"
if [ -n "$AWS_PROFILE" ]; then
    echo "  Profile: ${AWS_PROFILE}"
fi
echo "============================================="
echo ""

# Change to project root for uv commands
cd "${PROJECT_ROOT}"

# Invoke agent and capture output
print_step "Invoking agent '${AGENT_NAME}'..."
echo ""

# Create temp file for output
INVOKE_OUTPUT=$(mktemp)

# Run agentcore invoke and capture output
if uv run agentcore invoke "{\"prompt\": \"${PROMPT}\"}" -a "${AGENT_NAME}" 2>&1 | tee "${INVOKE_OUTPUT}"; then
    print_success "Agent invocation complete"
else
    print_error "Agent invocation failed"
    rm -f "${INVOKE_OUTPUT}"
    exit 1
fi

# Extract session ID from output
SESSION_ID=$(grep -o 'Session: [a-f0-9-]\+' "${INVOKE_OUTPUT}" | head -1 | sed 's/Session: //')
rm -f "${INVOKE_OUTPUT}"

if [ -z "$SESSION_ID" ]; then
    print_warning "Could not extract session ID from output"
    if [ "$SKIP_DYNAMO_CHECK" = false ]; then
        print_warning "Skipping DynamoDB verification"
    fi
    exit 0
fi

print_success "Session ID: ${SESSION_ID}"

# Skip DynamoDB check if requested
if [ "$SKIP_DYNAMO_CHECK" = true ]; then
    print_warning "Skipping DynamoDB verification (--skip-check)"
    exit 0
fi

echo ""
print_step "Verifying DynamoDB instrumentation..."

# Get table name
TABLE_NAME="${PROJECT_NAME}-workflow-events"

# Query DynamoDB for events with this workflow_id
EVENTS=$(aws dynamodb query \
    --table-name "${TABLE_NAME}" \
    --key-condition-expression "workflow_id = :wid" \
    --expression-attribute-values "{\":wid\": {\"S\": \"${SESSION_ID}\"}}" \
    --region "${REGION}" \
    --output json 2>/dev/null || echo '{"Items": [], "Count": 0}')

EVENT_COUNT=$(echo "$EVENTS" | jq -r '.Count // 0')

if [ "$EVENT_COUNT" -gt 0 ]; then
    print_success "Found ${EVENT_COUNT} events in DynamoDB"
    echo ""
    echo "Events:"
    echo "$EVENTS" | jq -r '.Items[] | "  \(.tool_name.S // "unknown") [\(.status.S // "unknown")] - \(.agent.S // "unknown")"'
else
    print_warning "No events found in DynamoDB for session ${SESSION_ID}"
    echo ""
    echo "Possible causes:"
    echo "  - Agent does not have @instrument_tool decorators"
    echo "  - SSM parameter not configured: /${PROJECT_NAME}/services/dynamodb/workflow-events-table"
    echo "  - IAM permissions missing for DynamoDB or SSM"
    echo ""
    echo "Check agent logs:"
    echo "  aws logs tail /aws/bedrock-agentcore/runtimes/${AGENT_NAME}-* --since 5m"
fi

echo ""
echo "============================================="
echo -e "  ${GREEN}Invoke Complete${NC}"
echo "============================================="
echo ""
