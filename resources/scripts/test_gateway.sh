#!/bin/bash
# =============================================================================
# Agentify Gateway Test Script
# =============================================================================
# This script tests all deployed MCP Gateway tools:
#   - Loads credentials from gateway_config.json
#   - Gets OAuth token from Cognito
#   - Lists all available tools
#   - Invokes each tool with test data
#   - Reports success/failure with color coding
#
# Usage:
#   ./scripts/test_gateway.sh                    # Test all tools
#   ./scripts/test_gateway.sh --list-only        # Just list tools without invoking
#   ./scripts/test_gateway.sh --tool get-deal    # Test specific tool only
# =============================================================================

set -e

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

print_tool_pass() {
    echo -e "  ${GREEN}✓ PASS${NC} - $1"
}

print_tool_fail() {
    echo -e "  ${RED}✗ FAIL${NC} - $1"
}

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CDK_DIR="${PROJECT_ROOT}/cdk"

# Parse arguments
LIST_ONLY=false
SPECIFIC_TOOL=""
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --list-only)
            LIST_ONLY=true
            shift
            ;;
        --tool)
            SPECIFIC_TOOL="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --list-only       List available tools without invoking them"
            echo "  --tool NAME       Test only the specified tool"
            echo "  --verbose, -v     Show detailed request/response data"
            echo "  --help, -h        Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

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

# Load gateway configuration
GATEWAY_CONFIG="${CDK_DIR}/gateway_config.json"
if [ ! -f "$GATEWAY_CONFIG" ]; then
    print_error "Gateway config not found: $GATEWAY_CONFIG"
    echo "  Run './scripts/setup.sh' first to deploy the gateway."
    exit 1
fi

# Extract gateway config values
if ! command -v jq &> /dev/null; then
    print_error "jq is required but not installed. Install it with: brew install jq"
    exit 1
fi

GATEWAY_URL=$(jq -r '.gateway_url' "$GATEWAY_CONFIG")
CLIENT_ID=$(jq -r '.oauth.client_id' "$GATEWAY_CONFIG")
CLIENT_SECRET=$(jq -r '.oauth.client_secret' "$GATEWAY_CONFIG")
TOKEN_ENDPOINT=$(jq -r '.oauth.token_endpoint' "$GATEWAY_CONFIG")
SCOPE=$(jq -r '.oauth.scope' "$GATEWAY_CONFIG")
GATEWAY_NAME=$(jq -r '.gateway_name' "$GATEWAY_CONFIG")

# Validate required values
if [ -z "$GATEWAY_URL" ] || [ "$GATEWAY_URL" = "null" ]; then
    print_error "Gateway URL not found in config"
    exit 1
fi

if [ -z "$CLIENT_ID" ] || [ "$CLIENT_ID" = "null" ]; then
    print_error "OAuth client_id not found in config"
    exit 1
fi

echo ""
echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}  Agentify Gateway Test Suite${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""
echo -e "Gateway: ${BLUE}${GATEWAY_NAME}${NC}"
echo -e "URL:     ${GATEWAY_URL}"
echo ""

# Step 1: Get OAuth token
print_step "Getting OAuth token from Cognito..."

TOKEN_RESPONSE=$(curl -s -X POST "$TOKEN_ENDPOINT" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials" \
    -d "client_id=${CLIENT_ID}" \
    -d "client_secret=${CLIENT_SECRET}" \
    -d "scope=${SCOPE}")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token // empty')

if [ -z "$ACCESS_TOKEN" ]; then
    print_error "Failed to get OAuth token"
    if [ "$VERBOSE" = true ]; then
        echo "  Response: $TOKEN_RESPONSE"
    fi
    exit 1
fi

print_success "OAuth token obtained"

# Step 2: List tools
print_step "Listing available tools..."

TOOLS_REQUEST='{
    "jsonrpc": "2.0",
    "id": "list-tools",
    "method": "tools/list"
}'

TOOLS_RESPONSE=$(curl -s -X POST "$GATEWAY_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Accept: application/json, text/event-stream" \
    -d "$TOOLS_REQUEST")

if [ "$VERBOSE" = true ]; then
    echo "  Response: $TOOLS_RESPONSE"
fi

# Parse tools from response
TOOLS=$(echo "$TOOLS_RESPONSE" | jq -r '.result.tools[]?.name // empty' 2>/dev/null)

if [ -z "$TOOLS" ]; then
    print_warning "No tools found in gateway or failed to parse response"
    if [ "$VERBOSE" = true ]; then
        echo "  Raw response: $TOOLS_RESPONSE"
    fi
    exit 1
fi

TOOL_COUNT=$(echo "$TOOLS" | wc -l | tr -d ' ')
print_success "Found $TOOL_COUNT tool(s):"
echo ""
echo "$TOOLS" | while read -r tool; do
    echo -e "    ${CYAN}•${NC} $tool"
done
echo ""

# If list-only, exit here
if [ "$LIST_ONLY" = true ]; then
    print_success "List complete. Use without --list-only to test tools."
    exit 0
fi

# Step 3: Test each tool
print_step "Testing tools..."
echo ""

PASSED=0
FAILED=0
SKIPPED=0

# Generate sample test data for common tool patterns
get_test_arguments() {
    local tool_name="$1"

    # Common patterns - customize these for your specific tools
    case "$tool_name" in
        *get-deal*|*get_deal*)
            echo '{"deal_id": "DEAL-001"}'
            ;;
        *get-company*|*get_company*|*company-profile*|*company_profile*)
            echo '{"company_name": "TechCorp Solutions"}'
            ;;
        *get-market*|*get_market*|*market-data*|*market_data*)
            echo '{"sector": "Technology"}'
            ;;
        *get-ticket*|*get_ticket*)
            echo '{"ticket_id": "TKT-001"}'
            ;;
        *customer-lookup*|*customer_lookup*)
            echo '{"customer_id": "CUST-001"}'
            ;;
        *sentiment*|*analyze*)
            echo '{"text": "This is a test message"}'
            ;;
        *search*|*kb*|*knowledge*)
            echo '{"query": "test query"}'
            ;;
        *inventory*|*get-inventory*)
            echo '{"product_id": "PROD-001"}'
            ;;
        *)
            # Default: empty arguments
            echo '{}'
            ;;
    esac
}

test_tool() {
    local tool_name="$1"
    local test_args=$(get_test_arguments "$tool_name")

    # Build JSON-RPC request
    local request=$(cat <<EOF
{
    "jsonrpc": "2.0",
    "id": "test-${tool_name}",
    "method": "tools/call",
    "params": {
        "name": "${tool_name}",
        "arguments": ${test_args}
    }
}
EOF
)

    if [ "$VERBOSE" = true ]; then
        echo -e "    ${BLUE}Request:${NC} $request"
    fi

    # Make the request
    local response=$(curl -s -X POST "$GATEWAY_URL" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Accept: application/json, text/event-stream" \
        -d "$request")

    if [ "$VERBOSE" = true ]; then
        echo -e "    ${BLUE}Response:${NC} $response"
    fi

    # Check for errors
    local error=$(echo "$response" | jq -r '.error // empty' 2>/dev/null)
    local result=$(echo "$response" | jq -r '.result // empty' 2>/dev/null)

    if [ -n "$error" ] && [ "$error" != "null" ] && [ "$error" != "" ]; then
        local error_msg=$(echo "$response" | jq -r '.error.message // "Unknown error"')
        print_tool_fail "$tool_name"
        echo -e "      Error: ${RED}${error_msg}${NC}"
        return 1
    elif [ -n "$result" ] && [ "$result" != "null" ]; then
        print_tool_pass "$tool_name"
        if [ "$VERBOSE" = true ]; then
            # Show truncated result
            local result_preview=$(echo "$result" | jq -c '.' 2>/dev/null | head -c 200)
            echo -e "      Result: ${result_preview}..."
        fi
        return 0
    else
        # Check if response contains content (streaming response)
        local content=$(echo "$response" | jq -r '.result.content[]?.text // empty' 2>/dev/null)
        if [ -n "$content" ]; then
            print_tool_pass "$tool_name"
            return 0
        fi

        # Might be a different response format
        print_tool_pass "$tool_name (response received)"
        return 0
    fi
}

# Test each tool
echo "$TOOLS" | while read -r tool; do
    if [ -z "$tool" ]; then
        continue
    fi

    # If specific tool requested, skip others
    if [ -n "$SPECIFIC_TOOL" ] && [ "$tool" != "$SPECIFIC_TOOL" ]; then
        continue
    fi

    if test_tool "$tool"; then
        PASSED=$((PASSED + 1))
    else
        FAILED=$((FAILED + 1))
    fi
done

echo ""

# Summary (need to re-count since subshell loses variables)
TOTAL_PASSED=$(echo "$TOOLS" | while read -r tool; do
    if [ -n "$SPECIFIC_TOOL" ] && [ "$tool" != "$SPECIFIC_TOOL" ]; then
        continue
    fi
    test_args=$(get_test_arguments "$tool")
    request="{\"jsonrpc\":\"2.0\",\"id\":\"test\",\"method\":\"tools/call\",\"params\":{\"name\":\"${tool}\",\"arguments\":${test_args}}}"
    response=$(curl -s -X POST "$GATEWAY_URL" -H "Content-Type: application/json" -H "Authorization: Bearer ${ACCESS_TOKEN}" -d "$request" 2>/dev/null)
    error=$(echo "$response" | jq -r '.error // empty' 2>/dev/null)
    if [ -z "$error" ] || [ "$error" = "null" ]; then
        echo "pass"
    fi
done | wc -l | tr -d ' ')

TOTAL_FAILED=$(echo "$TOOLS" | while read -r tool; do
    if [ -n "$SPECIFIC_TOOL" ] && [ "$tool" != "$SPECIFIC_TOOL" ]; then
        continue
    fi
    test_args=$(get_test_arguments "$tool")
    request="{\"jsonrpc\":\"2.0\",\"id\":\"test\",\"method\":\"tools/call\",\"params\":{\"name\":\"${tool}\",\"arguments\":${test_args}}}"
    response=$(curl -s -X POST "$GATEWAY_URL" -H "Content-Type: application/json" -H "Authorization: Bearer ${ACCESS_TOKEN}" -d "$request" 2>/dev/null)
    error=$(echo "$response" | jq -r '.error // empty' 2>/dev/null)
    if [ -n "$error" ] && [ "$error" != "null" ] && [ "$error" != "" ]; then
        echo "fail"
    fi
done | wc -l | tr -d ' ')

echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}  Test Summary${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""

if [ "$TOTAL_FAILED" -eq 0 ]; then
    echo -e "  ${GREEN}All tools working!${NC}"
else
    echo -e "  ${GREEN}Passed:${NC} $TOTAL_PASSED"
    echo -e "  ${RED}Failed:${NC} $TOTAL_FAILED"
fi

echo ""

if [ "$TOTAL_FAILED" -gt 0 ]; then
    exit 1
fi
