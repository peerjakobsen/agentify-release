#!/bin/bash
# =============================================================================
# Agentify Setup - Common Functions Library
# =============================================================================
# Shared functions and variables used by all setup scripts.
# This file is sourced by other setup scripts, not executed directly.
#
# Usage:
#   source "$(dirname "${BASH_SOURCE[0]}")/setup-common.sh"
#   init_common
# =============================================================================

# Disable pagers globally to prevent blocking on command output
export AWS_PAGER=""
export PAGER=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Print Functions
# =============================================================================

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

# =============================================================================
# Path Resolution
# =============================================================================

# Get the directory where setup scripts live
get_script_dir() {
    cd "$(dirname "${BASH_SOURCE[1]}")" && pwd
}

# Derive project root from script location (scripts are in resources/scripts/)
# or from current working directory for generated projects
get_project_root() {
    local script_dir="$1"

    # Check if we're in the extension's resources/scripts directory
    if [[ "$script_dir" == *"/resources/scripts" ]]; then
        # Extension development mode - project root is parent of resources
        cd "${script_dir}/../.." && pwd
    else
        # Generated project mode - scripts are at root level
        cd "${script_dir}/.." && pwd
    fi
}

# Sanitize project name for CloudFormation (lowercase, no special chars)
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

# =============================================================================
# Configuration Loading
# =============================================================================

# Load environment variables from .env file
load_env_file() {
    local project_root="$1"
    if [ -f "${project_root}/.env" ]; then
        print_step "Loading environment variables from .env"
        set -a
        source "${project_root}/.env"
        set +a
        print_success "Environment loaded"
    fi
}

# Load AWS profile from config.json
load_aws_profile() {
    local project_root="$1"
    local config_json="${project_root}/.agentify/config.json"

    if [ -z "$AWS_PROFILE" ] && [ -f "${config_json}" ]; then
        if command -v jq &> /dev/null; then
            local profile_from_config
            profile_from_config=$(jq -r '.aws.profile // empty' "${config_json}" 2>/dev/null)
            if [ -n "$profile_from_config" ]; then
                export AWS_PROFILE="$profile_from_config"
                print_success "Using AWS profile from config.json: ${AWS_PROFILE}"
            fi
        fi
    fi
}

# =============================================================================
# Tool Validation
# =============================================================================

# Check if required tools are installed
check_required_tools() {
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
}

# Check AWS credentials are valid
check_aws_credentials() {
    print_step "Checking AWS credentials..."
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured or expired. Please configure AWS credentials."
        exit 1
    fi
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    export ACCOUNT_ID
    print_success "AWS credentials valid (Account: ${ACCOUNT_ID})"
}

# Ensure AgentCore toolkit is installed
ensure_agentcore_toolkit() {
    if ! uv run agentcore --version &> /dev/null 2>&1; then
        print_step "Installing AgentCore Starter Toolkit..."
        uv add --dev bedrock-agentcore-starter-toolkit
    fi
}

# =============================================================================
# Initialization
# =============================================================================

# Initialize common variables and load configuration
# Call this at the start of each setup script after sourcing this file
init_common() {
    local custom_region="${1:-}"

    # Set up paths
    SCRIPT_DIR="$(get_script_dir)"
    PROJECT_ROOT="$(get_project_root "$SCRIPT_DIR")"
    CDK_DIR="${PROJECT_ROOT}/cdk"

    # Derive project name
    WORKSPACE_FOLDER="$(basename "${PROJECT_ROOT}")"
    PROJECT_NAME="$(sanitize_project_name "${WORKSPACE_FOLDER}")"
    PROJECT_NAME="${PROJECT_NAME:-agentify}"  # Fallback if empty

    # Load configuration
    load_env_file "$PROJECT_ROOT"
    load_aws_profile "$PROJECT_ROOT"

    # Set region (command line > env var > default)
    REGION="${custom_region:-${AWS_REGION:-us-east-1}}"

    # Check tools and credentials
    check_required_tools
    check_aws_credentials

    # Export variables for use in sourcing scripts
    export SCRIPT_DIR PROJECT_ROOT CDK_DIR PROJECT_NAME REGION ACCOUNT_ID

    # Common config file paths
    export CONFIG_JSON="${PROJECT_ROOT}/.agentify/config.json"
    export WIZARD_STATE="${PROJECT_ROOT}/.agentify/wizard-state.json"
    export INFRA_JSON="${PROJECT_ROOT}/.agentify/infrastructure.json"
    export INFRA_CONFIG="${INFRA_JSON}"  # Alias for compatibility
    export GATEWAY_CONFIG="${CDK_DIR}/gateway_config.json"
}

# =============================================================================
# Utility Functions
# =============================================================================

# Display header banner
show_banner() {
    local title="$1"
    echo ""
    echo "============================================="
    echo "  ${title}"
    echo "  Project: ${PROJECT_NAME}"
    echo "  Region: ${REGION}"
    echo "============================================="
    echo ""
}

# Check if this script is being sourced or executed directly
is_sourced() {
    [[ "${BASH_SOURCE[0]}" != "${0}" ]]
}

# If executed directly, show usage
if ! is_sourced; then
    echo "This script is meant to be sourced, not executed directly."
    echo ""
    echo "Usage in other scripts:"
    echo '  source "$(dirname "${BASH_SOURCE[0]}")/setup-common.sh"'
    echo '  init_common'
    exit 1
fi
