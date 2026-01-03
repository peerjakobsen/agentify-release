# Raw Idea: Cedar Policy Generation

**Item 41: Cedar Policy Generation**

Translate Step 4 security inputs into enforceable AgentCore Policy Engine Cedar policies.

**Problem:**
Step 4 captures security intent (data sensitivity, compliance frameworks, approval gates) but generates only documentation (`security-policies.md`). This Markdown is steering for Kiro, not enforceable runtime policies. AgentCore Policy Engine uses Cedar language for actual enforcement.

**Solution: End-to-End Policy Pipeline**
```
Step 4 Inputs → AI generates Cedar policies → CLI creates Policy Engine → Associate with Gateway
```

Key components:
1. New prompt file (`cedar-policies.prompt.md`) that transforms wizard state into Cedar syntax
2. Generated policy files in `policies/` directory
3. setup.sh Step 2b — Creates Policy Engine and associates with Gateway
4. destroy.sh Step 1b — Cleans up Policy Engine on teardown
5. Demo Viewer visibility — Shows policy ALLOW/DENY events in execution log

This is a Large (L) sized item involving prompt creation, service updates, script changes, and Demo Viewer integration.
