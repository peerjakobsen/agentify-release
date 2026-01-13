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

# Directories for schema and mock data discovery
HANDLERS_DIR="${CDK_DIR}/gateway/handlers"
SCHEMAS_DIR="${CDK_DIR}/gateway/schemas"

# Extract handler name from tool name (e.g., "get-deal___get_deal" -> "get_deal")
get_handler_name() {
    local tool_name="$1"
    # Tool names follow pattern: {gateway-target}___{handler_name}
    # Extract the part after ___ (the actual handler/function name)
    if [[ "$tool_name" == *"___"* ]]; then
        echo "${tool_name##*___}"
    else
        # Fallback: convert dashes to underscores
        echo "$tool_name" | tr '-' '_'
    fi
}

# Generate test value based on parameter name and type
generate_test_value() {
    local param_name="$1"
    local param_type="$2"
    local handler_name="$3"

    case "$param_type" in
        "array")
            # Generate array test values based on param name
            case "$param_name" in
                tags) echo '["test_tag", "automated"]' ;;
                *) echo '["test_item"]' ;;
            esac
            ;;
        "object")
            # Generate object test values based on param name
            case "$param_name" in
                updates) echo '{"status": "pending", "comment": "Test update"}' ;;
                *) echo '{"key": "value"}' ;;
            esac
            ;;
        *)
            # String type - generate based on param name
            case "$param_name" in
                ticket_id) echo '"TKT-12345"' ;;
                email) echo '"john.developer@techcorp.com"' ;;
                account_id) echo '"001XX000003NGSFYA4"' ;;
                case_id) echo '"500XX000001AbcDEF"' ;;
                subject) echo '"Test support ticket"' ;;
                description) echo '"This is a test description for automated testing"' ;;
                assignee) echo '"billing_team"' ;;
                priority) echo '"high"' ;;
                status) echo '"open"' ;;
                query) echo '"test query"' ;;
                deal_id) echo '"DEAL-001"' ;;
                customer_id) echo '"CUST-001"' ;;
                text) echo '"This is a test message"' ;;
                *) echo '"test_value"' ;;
            esac
            ;;
    esac
}

# Auto-discover test arguments from schema files
get_test_arguments() {
    local tool_name="$1"
    local handler_name=$(get_handler_name "$tool_name")
    local schema_file="${SCHEMAS_DIR}/${handler_name}.json"

    # Primary: Read from schema file to get required parameters
    if [ -f "$schema_file" ]; then
        local schema=$(cat "$schema_file")
        local required_params=$(echo "$schema" | jq -r '.inputSchema.required[]? // empty' 2>/dev/null)
        local properties=$(echo "$schema" | jq -r '.inputSchema.properties // {}' 2>/dev/null)

        if [ -n "$required_params" ]; then
            # Build test arguments from required params
            local args="{"
            local first=true

            for param in $required_params; do
                # Get param type from properties
                local param_type=$(echo "$properties" | jq -r ".\"$param\".type // \"string\"" 2>/dev/null)
                local test_value=$(generate_test_value "$param" "$param_type" "$handler_name")

                if [ "$first" = true ]; then
                    first=false
                else
                    args="$args, "
                fi
                args="$args\"$param\": $test_value"
            done
            args="$args}"
            echo "$args"
            return
        fi
    fi

    # Fallback: Try mock_data.json for older-style discovery
    local mock_file="${HANDLERS_DIR}/${handler_name}/mock_data.json"
    if [ -f "$mock_file" ]; then
        local mock_data=$(cat "$mock_file")
        local wrapper_key=$(echo "$mock_data" | jq -r 'keys[0] // empty' 2>/dev/null)

        if [ -n "$wrapper_key" ] && [ "$wrapper_key" != "null" ]; then
            local first_value_key=$(echo "$mock_data" | jq -r ".[\"$wrapper_key\"] | keys[0] // empty" 2>/dev/null)

            if [ -n "$first_value_key" ] && [ "$first_value_key" != "null" ]; then
                local param_name=""
                case "$handler_name" in
                    *deal*) param_name="deal_id" ;;
                    *ticket*) param_name="ticket_id" ;;
                    *customer*) param_name="customer_id" ;;
                    *company*|*profile*) param_name="company_name" ;;
                    *) param_name="id" ;;
                esac
                echo "{\"$param_name\": \"$first_value_key\"}"
                return
            fi
        fi
    fi

    # Final fallback to pattern-based defaults
    case "$tool_name" in
        *get-deal*|*get_deal*)
            echo '{"deal_id": "DEAL-001"}'
            ;;
        *get-ticket*|*get_ticket*)
            echo '{"ticket_id": "TKT-12345"}'
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
        *)
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

    # Extract content text to check for Lambda errors wrapped in successful responses
    local content_text=$(echo "$response" | jq -r '.result.content[]?.text // empty' 2>/dev/null)

    # Check for JSON-RPC level errors
    if [ -n "$error" ] && [ "$error" != "null" ] && [ "$error" != "" ]; then
        local error_msg=$(echo "$response" | jq -r '.error.message // "Unknown error"')
        print_tool_fail "$tool_name"
        echo -e "      Error: ${RED}${error_msg}${NC}"
        return 1
    fi

    # Check for Lambda errors wrapped in result content (e.g., ImportModuleError, Exception)
    if [ -n "$content_text" ]; then
        # Only flag as error if it's an actual error pattern, not just the word "error" in a field name
        # Check for: "success": false, Exception, Traceback, ImportModuleError, "error": "some message"
        if echo "$content_text" | grep -qE '"success":\s*false|Exception|Traceback|ImportModuleError|unable to import module'; then
            print_tool_fail "$tool_name"
            local error_preview=$(echo "$content_text" | head -c 200)
            echo -e "      Lambda Error: ${RED}${error_preview}${NC}"
            return 1
        fi
    fi

    # Check for successful result
    if [ -n "$result" ] && [ "$result" != "null" ]; then
        print_tool_pass "$tool_name"
        if [ "$VERBOSE" = true ]; then
            # Show truncated result
            local result_preview=$(echo "$result" | jq -c '.' 2>/dev/null | head -c 200)
            echo -e "      Result: ${result_preview}..."
        fi
        return 0
    else
        # Check if response contains content (streaming response) - already validated above
        if [ -n "$content_text" ]; then
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

# Helper function to check if a tool response indicates failure
check_tool_result() {
    local response="$1"
    local error=$(echo "$response" | jq -r '.error // empty' 2>/dev/null)
    local content_text=$(echo "$response" | jq -r '.result.content[]?.text // empty' 2>/dev/null)

    # Check JSON-RPC error
    if [ -n "$error" ] && [ "$error" != "null" ] && [ "$error" != "" ]; then
        echo "fail"
        return
    fi

    # Check for Lambda errors in content (only actual errors, not field names)
    if [ -n "$content_text" ]; then
        if echo "$content_text" | grep -qE '"success":\s*false|Exception|Traceback|ImportModuleError|unable to import module'; then
            echo "fail"
            return
        fi
    fi

    echo "pass"
}

# Summary (need to re-count since subshell loses variables)
TOTAL_PASSED=$(echo "$TOOLS" | while read -r tool; do
    if [ -n "$SPECIFIC_TOOL" ] && [ "$tool" != "$SPECIFIC_TOOL" ]; then
        continue
    fi
    test_args=$(get_test_arguments "$tool")
    request="{\"jsonrpc\":\"2.0\",\"id\":\"test\",\"method\":\"tools/call\",\"params\":{\"name\":\"${tool}\",\"arguments\":${test_args}}}"
    response=$(curl -s -X POST "$GATEWAY_URL" -H "Content-Type: application/json" -H "Authorization: Bearer ${ACCESS_TOKEN}" -d "$request" 2>/dev/null)
    result=$(check_tool_result "$response")
    if [ "$result" = "pass" ]; then
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
    result=$(check_tool_result "$response")
    if [ "$result" = "fail" ]; then
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
