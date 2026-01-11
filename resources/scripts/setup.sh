#!/bin/bash
# =============================================================================
# Agentify Infrastructure Setup Script
# =============================================================================
# This is the main orchestrator that coordinates all setup tasks:
#   - CDK infrastructure (VPC, DynamoDB, Lambda functions)
#   - Cross-Agent Memory (AgentCore Memory for data sharing)
#   - MCP Gateway (tool registration, OAuth)
#   - Policy Engine (Cedar policies from NL descriptions)
#   - Agent deployment (single agent to AgentCore Runtime)
#
# Each step is handled by a dedicated script that can also run standalone.
#
# Usage:
#   ./scripts/setup.sh                    # Deploy infrastructure + Memory + Gateway + Policy
#   ./scripts/setup.sh --skip-cdk         # Skip CDK, deploy Memory + Gateway + Policy only
#   ./scripts/setup.sh --agent my_agent   # Deploy everything + agent
#   ./scripts/setup.sh --skip-cdk --agent my_agent  # Deploy agent only
#
# Individual scripts (can run standalone):
#   ./scripts/setup-cdk.sh                # CDK infrastructure only
#   ./scripts/setup-memory.sh             # Cross-Agent Memory only
#   ./scripts/setup-gateway.sh            # MCP Gateway only
#   ./scripts/setup-policies.sh           # Policy Engine only
#   ./scripts/setup-agent.sh -a NAME      # Single agent only
# =============================================================================

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common functions for print utilities
source "${SCRIPT_DIR}/setup-common.sh"

# =============================================================================
# Argument Parsing
# =============================================================================

show_help() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Deploy Agentify infrastructure and agents."
    echo ""
    echo "Options:"
    echo "  --skip-cdk             Skip CDK infrastructure deployment"
    echo "  --agent, -a NAME       Deploy a specific agent after infrastructure"
    echo "  --region, -r REGION    AWS region (default: us-east-1)"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                              # Deploy infrastructure only"
    echo "  $0 --agent inventory_agent      # Deploy infrastructure + agent"
    echo "  $0 --skip-cdk --agent my_agent  # Deploy agent only (infra exists)"
    echo ""
    echo "Individual scripts (can run standalone):"
    echo "  ./scripts/setup-cdk.sh          # CDK infrastructure"
    echo "  ./scripts/setup-memory.sh       # Cross-Agent Memory"
    echo "  ./scripts/setup-gateway.sh      # MCP Gateway"
    echo "  ./scripts/setup-policies.sh     # Policy Engine"
    echo "  ./scripts/setup-agent.sh -a X   # Single agent"
}

SKIP_CDK=false
AGENT_NAME=""
REGION=""

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

# Build region argument for sub-scripts
REGION_ARG=""
if [ -n "$REGION" ]; then
    REGION_ARG="--region ${REGION}"
fi

# =============================================================================
# Main Orchestration
# =============================================================================

echo ""
echo "============================================="
echo "  Agentify Infrastructure Setup"
echo "============================================="
echo ""

# Step 1: CDK Infrastructure
print_step "Step 1: CDK Infrastructure"
if [ "$SKIP_CDK" = true ]; then
    print_warning "Skipping CDK deployment (--skip-cdk)"
    "${SCRIPT_DIR}/setup-cdk.sh" --skip ${REGION_ARG}
else
    "${SCRIPT_DIR}/setup-cdk.sh" ${REGION_ARG}
fi
echo ""

# Step 2: Cross-Agent Memory
print_step "Step 2: Cross-Agent Memory"
"${SCRIPT_DIR}/setup-memory.sh" ${REGION_ARG}
echo ""

# Step 3: MCP Gateway
print_step "Step 3: MCP Gateway"
"${SCRIPT_DIR}/setup-gateway.sh" ${REGION_ARG}
echo ""

# Step 4: Policy Engine
print_step "Step 4: Policy Engine"
"${SCRIPT_DIR}/setup-policies.sh" ${REGION_ARG}
echo ""

# Step 5: Agent Deployment (if specified)
if [ -n "$AGENT_NAME" ]; then
    print_step "Step 5: Agent Deployment"
    "${SCRIPT_DIR}/setup-agent.sh" --agent "${AGENT_NAME}" ${REGION_ARG}
    echo ""
else
    print_step "Step 5: No agent specified (use --agent NAME to deploy an agent)"
fi

# =============================================================================
# Completion Summary
# =============================================================================

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
echo "Individual setup scripts (can run standalone):"
echo "  - CDK infrastructure:  ./scripts/setup-cdk.sh"
echo "  - Cross-Agent Memory:  ./scripts/setup-memory.sh"
echo "  - MCP Gateway:         ./scripts/setup-gateway.sh"
echo "  - Policy Engine:       ./scripts/setup-policies.sh"
echo "  - Single agent:        ./scripts/setup-agent.sh -a <agent_name>"
echo ""
echo "Agent management:"
echo "  - Check status: uv run agentcore status"
echo "  - Delete agent: uv run agentcore delete -a <agent_name> --force"
echo ""
