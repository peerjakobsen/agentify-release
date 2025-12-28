# Getting Started with Agentify

This guide walks you through setting up Agentify for AI agent workflow observability.

## Prerequisites

- VS Code 1.85+
- AWS account with SSO access
- AWS CLI v2 installed

## Step 1: Configure AWS SSO (One-Time Setup)

If you haven't configured AWS SSO yet, run:

```bash
aws configure sso
```

You'll be prompted for:

| Prompt | Example |
|--------|---------|
| SSO start URL | `https://your-org.awsapps.com/start/` |
| SSO region | `eu-west-1` |
| Account | Select from list |
| Role | `AdministratorAccess` (or your role) |
| Profile name | `AdministratorAccess-123456789012` |

This creates a profile in `~/.aws/config`:

```ini
[profile AdministratorAccess-123456789012]
sso_session = your-session
sso_account_id = 123456789012
sso_role_name = AdministratorAccess
region = us-east-1

[sso-session your-session]
sso_start_url = https://your-org.awsapps.com/start/
sso_region = eu-west-1
```

## Step 2: Login to AWS SSO

Authenticate with AWS SSO:

```bash
aws sso login --profile AdministratorAccess-123456789012
```

This opens your browser for authentication and caches temporary credentials in `~/.aws/sso/cache/`.

> **Note:** SSO tokens expire after 8-12 hours. You'll need to run this command again when they expire.

## Step 3: Initialize Your Project

1. Open your project folder in VS Code
2. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run **"Agentify: Initialize Project"**

The initialization wizard will:

1. **Select AWS Profile** — Choose your SSO profile or "Use default credentials"
2. **Select AWS Region** — Choose where to deploy (e.g., `us-east-1`)
3. **Deploy Infrastructure** — Creates a DynamoDB table via CloudFormation
4. **Generate Config** — Creates `.agentify/config.json`
5. **Create Steering File** — Creates `.kiro/steering/agentify-integration.md`

## What Gets Created

After initialization, your project will have:

```
your-project/
├── .agentify/
│   └── config.json              # AWS & DynamoDB configuration
└── .kiro/
    └── steering/
        └── agentify-integration.md  # Integration guidance for Kiro
```

### `.agentify/config.json`

```json
{
  "version": "1.0.0",
  "infrastructure": {
    "dynamodb": {
      "tableName": "agentify-events-your-project",
      "tableArn": "arn:aws:dynamodb:us-east-1:...",
      "region": "us-east-1"
    }
  },
  "aws": {
    "profile": "AdministratorAccess-123456789012"
  },
  "workflow": {
    "triggerType": "local",
    "triggerConfig": {
      "type": "local",
      "entryScript": "agents/main.py",
      "pythonPath": ".venv/bin/python"
    }
  }
}
```

## Handling SSO Token Expiration

When your SSO token expires, you'll see:

- **Status bar** shows yellow key icon with "SSO expired"
- **Notification** appears: "AWS SSO session expired. Click to refresh credentials."

### Quick Fix

Click **"Run SSO Login"** in the notification, or run manually:

```bash
aws sso login --profile AdministratorAccess-123456789012
```

Then reload VS Code (`Cmd+Shift+P` → "Developer: Reload Window").

## How AWS SSO Credentials Work

```
┌─────────────────────────────────────────────────────────────────┐
│                        ~/.aws/config                             │
│  [profile AdministratorAccess-123456789012]                     │
│  sso_session = your-session                                      │
│  sso_account_id = 123456789012         ← Static configuration   │
│  sso_role_name = AdministratorAccess                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ~/.aws/sso/cache/*.json                       │
│  {                                                               │
│    "accessToken": "eyJ...",            ← Temporary token        │
│    "expiresAt": "2024-12-28T16:00:00Z" ← Expires in 8-12 hours  │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AWS SDK / Agentify                           │
│  1. Reads profile from config                                    │
│  2. Finds cached token in sso/cache                             │
│  3. If expired → prompts for re-login                           │
│  4. If valid → assumes role and connects                        │
└─────────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### "DynamoDB table not found"

The CloudFormation stack may not have deployed. Check AWS Console or run:

```bash
aws cloudformation describe-stacks \
  --stack-name agentify-workflow-events-your-project \
  --profile AdministratorAccess-123456789012
```

### "AWS credentials not configured"

Ensure you've run `aws configure sso` and `aws sso login`.

### "Access denied"

Your IAM role may lack DynamoDB permissions. Ensure your role has:
- `dynamodb:DescribeTable`
- `dynamodb:PutItem`
- `dynamodb:Query`

## Next Steps

- Add Python observability decorators to your agents (see `.kiro/steering/agentify-integration.md`)
- View workflow events in the Agentify panel
- Configure workflow triggers for automated execution
