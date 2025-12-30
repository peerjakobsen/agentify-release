# Agentify Wizard Field Reference

This document describes each step of the Agentify Ideation Wizard and the fields users need to complete.

---

## Step 1: Business Context

**Purpose:** Capture the customer's business objective and technical landscape.

| Field | Description | Example |
|-------|-------------|---------|
| Business Objective | 1-2 sentence description of what the customer wants to achieve | "Reduce fresh produce stockouts by 30% while minimizing waste" |
| Industry | Customer's industry vertical | Retail, Healthcare, Financial Services, Manufacturing |
| Known Systems | Checkboxes for systems the customer uses | SAP, Salesforce, ServiceNow, Oracle, Workday, Databricks |
| Custom Systems | Free text for systems not in the list | "Blue Yonder WMS, Manhattan Associates" |

**Guidance:** If user only knows partial systems (e.g., "they have SAP"), suggest industry-typical modules.

---

## Step 2: AI Gap Filling

**Purpose:** Claude analyzes context and proposes assumptions about unknown details.

| Field | Description | Example |
|-------|-------------|---------|
| Proposed Assumptions | AI-generated list of likely system configurations | "SAP S/4HANA for inventory, SAP IBP for demand planning" |
| Confirmed Assumptions | User confirms which assumptions are correct | User checks the ones that match |
| Rejected Assumptions | User can reject incorrect assumptions | User unchecks wrong ones |

**Guidance:** Help users understand what each assumption means and why it's reasonable.

---

## Step 3: Outcomes

**Purpose:** Define what success looks like for this demo.

| Field | Description | Example |
|-------|-------------|---------|
| Primary Outcome | The main deliverable the agent workflow produces | "Prioritized replenishment recommendations with rationale" |
| Success Metrics | 2-4 measurable KPIs | "Stockout rate, inventory turns, waste reduction %" |
| Stakeholders | Who benefits from this outcome | "Supply Chain Director, Store Managers" |

**Guidance:** Outcomes should be concrete and demonstrable in a 5-minute demo.

---

## Step 4: Security & Guardrails

**Purpose:** Define data sensitivity and compliance requirements.

| Field | Description | Options |
|-------|-------------|---------|
| Data Sensitivity | Classification level | Public, Internal, Confidential, Restricted |
| Compliance Frameworks | Applicable regulations | HIPAA, SOX, PCI-DSS, GDPR, SOC2, Industry-specific |
| Approval Gates | Human-in-the-loop requirements | "Manager approval for orders > $10K" |
| Guardrail Notes | Additional security considerations | "No real PII in demo data" |

**Industry Defaults:**
- Healthcare → Restricted, HIPAA, "PHI requires human review"
- Financial Services → Confidential, SOX/PCI-DSS, "Transactions over threshold need approval"
- Retail → Internal, "No customer PII in demos"

---

## Step 5: Agent Design

**Purpose:** Define the team of AI agents and how they coordinate.

| Field | Description | Example |
|-------|-------------|---------|
| Agents | List of agents with name, role, tools | Inventory Agent: "Fetches stock levels from SAP" |
| Orchestration Pattern | How agents coordinate | Graph (flexible), Workflow (sequential), Swarm (autonomous) |
| Edges | Connections between agents | Orchestrator → [Inventory, Demand] → Recommendation |

**Common Patterns:**
- **Parallel gather → synthesize**: Multiple data agents feed into one decision agent
- **Sequential pipeline**: Each agent hands off to the next
- **Human-in-loop**: Approval agent gates final output

---

## Step 6: Mock Data

**Purpose:** Define realistic test data for the demo.

| Field | Description | Example |
|-------|-------------|---------|
| Mock Strategy | Approach to test data | "Realistic retail inventory with seasonal patterns" |
| Data Sources | Which systems need mock data | SAP inventory, Databricks forecasts |
| Sample Records | Example data shapes | SKU, quantity, location, velocity |

**Guidance:** Mock data should feel realistic but never use actual customer data.

---

## Step 7: Demo Strategy

**Purpose:** Plan the demonstration narrative.

| Field | Description | Example |
|-------|-------------|---------|
| Demo Persona | Who is the user in the demo | "Regional Supply Chain Manager" |
| Key Moments | 2-3 "aha" moments to highlight | "Watch how agents work in parallel", "See the rationale" |
| Narrative Flow | Story arc of the demo | Problem → Agent activation → Tool calls → Recommendation |

**Guidance:** Match narrative to audience - executives want outcomes, practitioners want details.

---

## Step 8: Generate

**Purpose:** Generate Kiro steering files and trigger implementation.

| Output | Description |
|--------|-------------|
| product.md | Business context as product description |
| tech.md | Technical stack and patterns |
| structure.md | Project folder structure |
| customer-context.md | Industry and value map details |
| integration-landscape.md | Systems and mock definitions |
| security-policies.md | Compliance and guardrails |
| demo-strategy.md | Narrative and key moments |
| agentify-integration.md | Demo Viewer observability contract |

**Next Steps:** Open project in Kiro IDE to run spec-driven code generation.
