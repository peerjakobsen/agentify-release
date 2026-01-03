# Spec Requirements: Cedar Policy Generation

## Initial Description

**Item 41: Cedar Policy Generation**

Translate Step 4 security inputs into enforceable AgentCore Policy Engine Cedar policies.

**Problem:**
Step 4 captures security intent (data sensitivity, compliance frameworks, approval gates) but generates only documentation (`security-policies.md`). This Markdown is steering for Kiro, not enforceable runtime policies. AgentCore Policy Engine uses Cedar language for actual enforcement.

**Solution: End-to-End Policy Pipeline**
```
Step 4 Inputs -> AI generates Cedar policies -> CLI creates Policy Engine -> Associate with Gateway
```

Key components:
1. New prompt file (`cedar-policies.prompt.md`) that transforms wizard state into Cedar syntax
2. Generated policy files in `policies/` directory
3. setup.sh Step 2b - Creates Policy Engine and associates with Gateway
4. destroy.sh Step 1b - Cleans up Policy Engine on teardown
5. Demo Viewer visibility - Shows policy ALLOW/DENY events in execution log

This is a Large (L) sized item involving prompt creation, service updates, script changes, and Demo Viewer integration.

## Requirements Discussion

### First Round Questions

**Q1:** Should Cedar policy generation be automatic when generating steering files (Step 8), or should it be a separate button/action?

**Answer:** Automatic as part of Step 8 "Generate Steering Files". Cedar policies are derived from Step 4 inputs - natural output of ideation process. No separate button - policies generated alongside steering files. UI already shows per-file status - policies become additional files in checklist.

**Q2:** How should mock data from Step 6 relate to policy generation (e.g., does mock data inform policy conditions)?

**Answer:** Out of scope for policies. Mock data defines test data shapes. Policies are about access control (who can do what). Orthogonal concerns. Policies come from Step 4 (sensitivity, compliance, approval gates) + Step 5 (agents/tools to protect).

**Q3:** Should generated Cedar policies use generic claim names with intuitive defaults, or specific claim names that require users to understand their identity provider setup?

**Answer:** Generic claim names with intuitive defaults. Target users are field teams, not security engineers. Use intuitive claim names:
- `context.claims.approval_authority == "finance_committee"`
- `context.claims.user_role == "admin"`
- `context.input.amount < 10000`

Users can customize generated .cedar files post-generation. Don't add complexity to Step 4.

**Q4:** For compliance frameworks (HIPAA, PCI-DSS, GDPR), should policies be comprehensive or representative examples?

**Answer:** Representative examples for demo purposes. Full compliance frameworks would generate hundreds of policies. For demos, generate 2-3 representative policies per framework:
- HIPAA: PHI access requires healthcare_provider role
- PCI-DSS: Card data tools require PCI-certified principal
- GDPR: EU data requires consent claim present

Comment each policy with "Example - expand for production" to set expectations.

**Q5:** What should be the default Policy Engine mode - ENFORCE or LOG_ONLY?

**Answer:** LOG_ONLY. Even with mock data, ENFORCE could break demos if policies too restrictive. LOG_ONLY lets demos run smoothly while showing policy decisions in logs. Config supports override to ENFORCE.

**Q6:** Should policy evaluation events be visible in the Demo Viewer, and how should they be surfaced?

**Answer:** Option C (Simplest) for v1: Skip real-time policy events. Just log to CloudWatch. Users can view in console. Add to Demo Viewer in future iteration. Keeps scope tight.

**Q7:** Should policies support Principal entity type (agent identity), or focus only on Action and Gateway?

**Answer:** No for v1 - Action and Gateway only. Principal (agent identity) adds complexity - requires identity model, authentication mapping. Keep v1 focused on Action + Gateway (tool-level policies).

**Q8:** Are there any features or capabilities that should be explicitly excluded from this implementation?

**Answer:** Explicit exclusions:
- Custom Cedar editing UI (users edit .cedar files in IDE)
- Policy versioning (demos don't need version history)
- Policy testing/simulation (would require Cedar validator)
- External policy management (no external IAM integration)
- Policy inheritance/composition (keep flat and simple)
- Cross-Gateway policies (one Gateway per demo project)
- Policy templates marketplace (future, not v1)
- Real-time policy debugging (CloudWatch logs sufficient)

### Existing Code to Reference

No similar existing features identified for reference.

### Follow-up Questions

No follow-up questions were needed - the user's answers were comprehensive.

## Visual Assets

### Files Provided:

No visual assets provided.

### Visual Insights:

N/A

## Requirements Summary

### Functional Requirements

- Generate Cedar policy files automatically during Step 8 "Generate Steering Files"
- Derive policies from Step 4 (data sensitivity, compliance frameworks, approval gates) and Step 5 (agents/tools)
- Create `cedar-policies.prompt.md` to transform wizard state into Cedar syntax
- Output generated policy files to `policies/` directory
- Use generic, intuitive claim names that field teams can understand
- Generate 2-3 representative policies per compliance framework (HIPAA, PCI-DSS, GDPR)
- Include "Example - expand for production" comments in compliance policies
- Default Policy Engine mode: LOG_ONLY with config override to ENFORCE
- Update setup.sh (Step 2b) to create Policy Engine and associate with Gateway
- Update destroy.sh (Step 1b) to clean up Policy Engine on teardown
- Log policy decisions to CloudWatch

### Reusability Opportunities

- Existing Step 8 file generation UI patterns for policy file status display
- Existing prompt file structure for `cedar-policies.prompt.md`
- Existing setup.sh/destroy.sh script patterns for CLI commands

### Scope Boundaries

**In Scope:**
- Cedar policy generation from Step 4 and Step 5 inputs
- New prompt file (`cedar-policies.prompt.md`)
- Policy files in `policies/` directory
- CLI script updates (setup.sh, destroy.sh)
- Policy Engine creation and Gateway association
- CloudWatch logging for policy decisions
- Support for Action and Gateway entity types
- LOG_ONLY default mode with ENFORCE override

**Out of Scope:**
- Custom Cedar editing UI (users edit .cedar files in IDE)
- Policy versioning
- Policy testing/simulation
- External policy management / IAM integration
- Policy inheritance/composition
- Cross-Gateway policies
- Policy templates marketplace
- Real-time policy debugging
- Demo Viewer integration for policy events (future enhancement)
- Principal entity type support (v1 excludes agent identity)
- Mock data integration (orthogonal concern)

### Technical Considerations

- Policy Engine uses Cedar language for enforcement
- Policies associate with Gateway per demo project
- Config-driven mode switching (LOG_ONLY vs ENFORCE)
- CloudWatch serves as policy event logging destination
- Generated policies should be human-readable and customizable
- Claim names should be intuitive for non-security-engineer users
