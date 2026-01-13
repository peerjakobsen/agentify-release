#!/bin/bash
# =============================================================================
# Agentify Workflow Orchestrator Script
# =============================================================================
# This script runs the main.py orchestrator which invokes remote agents
# deployed to AgentCore Runtime. It handles AWS credential discovery,
# separates JSON events from human output, and shows DynamoDB tool events.
#
# Usage:
#   ./scripts/orchestrate.sh -p "Customer ticket description"
#   ./scripts/orchestrate.sh --prompt "Customer needs refund" --json output.json
#   ./scripts/orchestrate.sh -p "Returning customer" --user-id user-123
#
# Examples:
#   ./scripts/orchestrate.sh -p "Customer TKT-001 has API errors"
#   ./scripts/orchestrate.sh --prompt "Billing issue" --skip-events
#   ./scripts/orchestrate.sh -p "Returning user" --user-id user-456
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
CYAN='\033[0;36m'
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

# Load region and table name from infrastructure.json
INFRA_JSON="${PROJECT_ROOT}/.agentify/infrastructure.json"
if [ -f "${INFRA_JSON}" ] && command -v jq &> /dev/null; then
    REGION=$(jq -r '.region // empty' "${INFRA_JSON}" 2>/dev/null)
    TABLE_NAME_FROM_INFRA=$(jq -r '.workflow_events_table // empty' "${INFRA_JSON}" 2>/dev/null)
    # Cross-Agent Memory: Load MEMORY_ID from infrastructure.json
    MEMORY_ID_FROM_INFRA=$(jq -r '.memory.memoryId // empty' "${INFRA_JSON}" 2>/dev/null)
    # Persistent Memory: Load PERSISTENT_MEMORY_ID from infrastructure.json
    PERSISTENT_MEMORY_ID_FROM_INFRA=$(jq -r '.persistentMemory.memoryId // empty' "${INFRA_JSON}" 2>/dev/null)
fi
REGION="${REGION:-${AWS_REGION:-us-east-1}}"

# Export environment variables for Python orchestrator
export AWS_REGION="${REGION}"
if [ -n "$TABLE_NAME_FROM_INFRA" ]; then
    export AGENTIFY_TABLE_NAME="${TABLE_NAME_FROM_INFRA}"
fi
# Cross-Agent Memory: Export MEMORY_ID for Python subprocess
if [ -n "$MEMORY_ID_FROM_INFRA" ]; then
    export MEMORY_ID="${MEMORY_ID_FROM_INFRA}"
fi
# Persistent Memory: Export PERSISTENT_MEMORY_ID for Python subprocess
if [ -n "$PERSISTENT_MEMORY_ID_FROM_INFRA" ]; then
    export PERSISTENT_MEMORY_ID="${PERSISTENT_MEMORY_ID_FROM_INFRA}"
fi

# Parse arguments
PROMPT=""
WORKFLOW_ID=""
TRACE_ID=""
USER_ID=""
JSON_OUTPUT=""
SKIP_EVENTS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --prompt|-p)
            PROMPT="$2"
            shift 2
            ;;
        --workflow-id|-w)
            WORKFLOW_ID="$2"
            shift 2
            ;;
        --trace-id|-t)
            TRACE_ID="$2"
            shift 2
            ;;
        --user-id|-u)
            USER_ID="$2"
            shift 2
            ;;
        --json|-j)
            JSON_OUTPUT="$2"
            shift 2
            ;;
        --skip-events)
            SKIP_EVENTS=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Run the orchestrator workflow that invokes remote agents in AgentCore."
            echo ""
            echo "Options:"
            echo "  --prompt, -p TEXT      Ticket description to process (required)"
            echo "  --workflow-id, -w ID   Workflow ID (auto-generated if not provided)"
            echo "  --trace-id, -t ID      Trace ID (auto-generated if not provided)"
            echo "  --user-id, -u ID       User ID for persistent memory (optional)"
            echo "  --json, -j FILE        Save JSON events to file (default: temp file)"
            echo "  --skip-events          Skip DynamoDB event query"
            echo "  -h, --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 -p \"Customer TKT-001 has API errors\""
            echo "  $0 --prompt \"Billing issue\" --json events.json"
            echo "  $0 -p \"VIP customer complaint\" --skip-events"
            echo "  $0 -p \"Returning user\" --user-id user-123"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate required arguments
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

# Auto-generate IDs if not provided
WORKFLOW_ID="${WORKFLOW_ID:-wf-$(date +%s)}"
TRACE_ID="${TRACE_ID:-$(python3 -c 'import uuid; print(uuid.uuid4().hex)')}"

# Create temp file for JSON events if not specified
if [ -z "$JSON_OUTPUT" ]; then
    JSON_OUTPUT=$(mktemp "/tmp/workflow-${WORKFLOW_ID}.XXXXXX.json")
fi

echo ""
echo "============================================="
echo "  Agentify Workflow Orchestrator"
echo "  Project: ${PROJECT_NAME}"
echo "  Region: ${REGION}"
if [ -n "$AWS_PROFILE" ]; then
    echo "  Profile: ${AWS_PROFILE}"
fi
if [ -n "$MEMORY_ID" ]; then
    echo "  Cross-Agent Memory: ${MEMORY_ID}"
fi
if [ -n "$PERSISTENT_MEMORY_ID" ]; then
    echo "  Persistent Memory: ${PERSISTENT_MEMORY_ID}"
fi
if [ -n "$USER_ID" ]; then
    echo "  User ID: ${USER_ID}"
fi
echo "============================================="
echo ""
echo "Workflow ID: ${WORKFLOW_ID}"
echo "Trace ID:    ${TRACE_ID}"
echo "Prompt:      ${PROMPT:0:60}$([ ${#PROMPT} -gt 60 ] && echo '...')"
echo ""

# Change to project root for uv commands
cd "${PROJECT_ROOT}"

# Run orchestrator - capture both streams separately
print_step "Running orchestrator workflow..."
echo ""

# Create temp file to capture stderr
STDERR_FILE=$(mktemp)

# Build CLI arguments
CLI_ARGS=(
    "--prompt" "$PROMPT"
    "--workflow-id" "$WORKFLOW_ID"
    "--trace-id" "$TRACE_ID"
    "--turn-number" "1"
)

# Add optional user-id argument if provided
if [ -n "$USER_ID" ]; then
    CLI_ARGS+=("--user-id" "$USER_ID")
fi

# Add persistent memory ID if available (Item 39.5)
if [ -n "$PERSISTENT_MEMORY_ID" ]; then
    CLI_ARGS+=("--persistent-memory-id" "$PERSISTENT_MEMORY_ID")
fi

# Run main.py: stdout (JSON) to file, stderr (human) to both terminal and temp file
# Use process substitution to capture stderr while also displaying it
# Always turn-number 1 for fresh runs (multi-turn handled by Demo Viewer extension)
set +e  # Don't exit on error - we want to capture exit code
uv run python agents/main.py "${CLI_ARGS[@]}" \
    > "$JSON_OUTPUT" 2> >(tee "$STDERR_FILE" >&2)
EXIT_CODE=$?
set -e

# Extract session ID from stderr output
SESSION_ID=$(grep -o 'Session ID: [a-f0-9-]\+' "$STDERR_FILE" 2>/dev/null | head -1 | sed 's/Session ID: //')
rm -f "$STDERR_FILE"

echo ""

# Report workflow result
if [ $EXIT_CODE -eq 0 ]; then
    print_success "Workflow completed successfully"
else
    print_error "Workflow failed with exit code $EXIT_CODE"
fi

# Query DynamoDB events unless skipped
if [ "$SKIP_EVENTS" = false ] && [ -n "$SESSION_ID" ]; then
    echo ""
    print_step "Querying DynamoDB for tool events..."

    TABLE_NAME="${PROJECT_NAME}-workflow-events"

    # Query DynamoDB for events
    EVENTS=$(aws dynamodb query \
        --table-name "$TABLE_NAME" \
        --key-condition-expression "workflow_id = :wid" \
        --expression-attribute-values "{\":wid\": {\"S\": \"${SESSION_ID}\"}}" \
        --region "${REGION}" \
        --output json 2>/dev/null || echo '{"Items": [], "Count": 0}')

    EVENT_COUNT=$(echo "$EVENTS" | jq -r '.Count // 0')

    if [ "$EVENT_COUNT" -gt 0 ]; then
        echo ""
        echo -e "${CYAN}TOOL EVENTS (Session: ${SESSION_ID}):${NC}"
        echo "------------------------------------------------------------"
        printf "%-20s %-25s %-12s %s\n" "Agent" "Operation" "Status" "Duration"
        echo "------------------------------------------------------------"

        # Parse and display events (new format: agent_name, operation instead of agent, tool_name)
        echo "$EVENTS" | jq -r '.Items[] | "\(.agent_name.S // .agent.S // "unknown")\t\(.operation.S // .tool_name.S // "unknown")\t\(.status.S // "unknown")\t\(.duration_ms.N // "-")ms"' | \
        while IFS=$'\t' read -r agent operation status duration; do
            printf "%-20s %-25s %-12s %s\n" "$agent" "$operation" "$status" "$duration"
        done

        echo "------------------------------------------------------------"
        print_success "Found ${EVENT_COUNT} tool events"
    else
        print_warning "No tool events found in DynamoDB for session ${SESSION_ID}"
        echo ""
        echo "Possible causes:"
        echo "  - Agents do not have @instrument_tool decorators"
        echo "  - SSM parameter not configured: /${PROJECT_NAME}/services/dynamodb/workflow-events-table"
        echo "  - IAM permissions missing for DynamoDB or SSM"
    fi
elif [ "$SKIP_EVENTS" = true ]; then
    print_warning "Skipping DynamoDB event query (--skip-events)"
elif [ -z "$SESSION_ID" ]; then
    print_warning "Could not extract session ID - skipping DynamoDB query"
fi

echo ""
print_success "JSON events saved to: ${JSON_OUTPUT}"

echo ""
echo "============================================="
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "  ${GREEN}Orchestration Complete${NC}"
else
    echo -e "  ${RED}Orchestration Failed${NC}"
fi
echo "============================================="
echo ""

# Propagate exit code
exit $EXIT_CODE
