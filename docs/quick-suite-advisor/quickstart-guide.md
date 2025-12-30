# Agentify Quick Start Guide

## What is Agentify?

Agentify is a VS Code/Kiro IDE extension that helps you create customer-specific agentic AI demos in hours instead of weeks. It combines:

1. **Ideation Wizard** - 8 guided steps to capture business context and design agents
2. **Steering Generation** - AI generates spec files for Kiro's code generation
3. **Demo Viewer** - Real-time visualization of agent execution

---

## Installation

### Prerequisites
- VS Code 1.85+ or Kiro IDE
- Node.js 18+
- AWS CLI configured with valid credentials
- Access to Amazon Bedrock (Claude models)

### Install the Extension

**Option A: From VSIX file**
1. Download `agentify-x.x.x.vsix` from the internal distribution
2. Open VS Code/Kiro
3. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows)
4. Type "Install from VSIX" and select the file

**Option B: From marketplace (when available)**
1. Open Extensions view (`Cmd+Shift+X`)
2. Search for "Agentify"
3. Click Install

### Verify Installation
1. Look for the Agentify icon in the Activity Bar (left sidebar)
2. Click it to open the Agentify panel
3. You should see "Ideation Wizard" and "Demo Viewer" options

---

## First-Time Setup

### 1. Configure AWS Credentials
Agentify uses your AWS credentials to call Bedrock. Ensure you have:
```bash
aws configure
# Or set environment variables:
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
export AWS_REGION=us-east-1
```

### 2. Open/Create a Project Folder
Agentify creates files in your workspace:
```
your-project/
├── .agentify/
│   └── config.json      # Agentify configuration
├── .kiro/
│   └── steering/        # Generated steering files
│       ├── product.md
│       ├── tech.md
│       └── ...
```

### 3. Open Ideation Wizard
1. Click the Agentify icon in Activity Bar
2. Click "Start Ideation Wizard"
3. Begin with Step 1: Business Context

---

## The 8-Step Wizard Flow

| Step | What You Do | Time |
|------|-------------|------|
| 1. Business Context | Enter objective, industry, known systems | 2 min |
| 2. AI Gap Filling | Review and confirm AI assumptions | 2 min |
| 3. Outcomes | Define success metrics and stakeholders | 2 min |
| 4. Security | Set data sensitivity and compliance | 1 min |
| 5. Agent Design | Review proposed agents and orchestration | 3 min |
| 6. Mock Data | Customize test data strategy | 2 min |
| 7. Demo Strategy | Plan narrative and key moments | 2 min |
| 8. Generate | Create steering files | 1 min |

**Total: ~15 minutes to complete the wizard**

---

## After the Wizard: Kiro Integration

### If Using Kiro IDE
1. Kiro reads the `.kiro/steering/` files automatically
2. Open Kiro's spec panel
3. Kiro generates: Requirements → Design → Tasks → Code
4. Review and iterate on generated agents

### If Using VS Code
1. Steering files are still generated
2. You can manually implement based on the specs
3. Or open the project in Kiro for code generation

---

## Using the Demo Viewer

### Setup
1. Deploy your agents to Bedrock AgentCore (or run locally)
2. Configure connection in `.agentify/config.json`:
```json
{
  "demoViewer": {
    "endpoint": "local",
    "mainScript": "src/main.py"
  }
}
```

### Running a Demo
1. Open Demo Viewer panel
2. Enter a prompt (e.g., "Generate replenishment plan for Northeast region")
3. Click "Run Workflow"
4. Watch agents activate in the graph visualization
5. See tool calls in the execution log
6. Review final outcome

---

## Common Issues

### "Bedrock credentials not found"
- Run `aws sts get-caller-identity` to verify credentials
- Check that your IAM role has Bedrock permissions

### "Model not available"
- Ensure Claude models are enabled in your Bedrock console
- Check you're in a supported region (us-east-1, us-west-2, eu-west-1)

### "Steering files not generating"
- Check the Output panel for errors (View → Output → Agentify)
- Verify wizard state is complete (all required fields filled)

### "Demo Viewer shows no events"
- Verify your agent code includes observability decorators
- Check DynamoDB table configuration if using cloud deployment

---

## Tips for Great Demos

1. **Know your audience** - Executives want outcomes, practitioners want details
2. **Start with the problem** - "Your customer loses $X to stockouts..."
3. **Narrate the agent graph** - "Watch as three agents work in parallel..."
4. **Highlight tool calls** - "Here it's querying SAP for current inventory..."
5. **Show the rationale** - "The agent explains WHY it recommends this order..."

---

## Getting Help

- **Agentify Advisor** - Ask me! I can help with wizard inputs and industry guidance
- **Documentation** - Full docs at [internal link]
- **Slack** - #agentify-support channel
- **Office Hours** - Thursdays 2pm PT
