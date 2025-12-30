# Agentify Wizard Suggestions by Scenario

This document contains pre-built suggestions for common demo scenarios. Use these as starting points and customize based on customer specifics.

---

## Retail: Inventory Replenishment

### Scenario
A retail customer wants to reduce stockouts in fresh produce while minimizing waste.

### Wizard Suggestions

**Step 1 - Business Context:**
- Objective: "Reduce fresh produce stockouts by 25% while cutting waste by 15%"
- Industry: Retail
- Systems: SAP S/4HANA, SAP IBP, possibly Databricks for analytics

**Step 3 - Outcomes:**
- Primary: "Prioritized replenishment recommendations with business rationale"
- Metrics: Stockout rate, inventory turns, shrink/waste %, days of supply
- Stakeholders: Supply Chain Director, Store Operations, Category Managers

**Step 4 - Security:**
- Data Sensitivity: Internal
- Compliance: None specific (retail inventory isn't regulated)
- Approval Gates: "Orders exceeding $50K require manager approval"

**Step 5 - Agent Design:**
```
Agents:
├── Inventory Agent - Fetches current stock positions from SAP
├── Demand Agent - Analyzes sales velocity and forecasts from IBP
├── Supplier Agent - Checks lead times and supplier availability
└── Recommendation Agent - Synthesizes data into prioritized orders

Orchestration: Graph (parallel data gathering → sequential synthesis)

Edges:
- Orchestrator spawns [Inventory, Demand, Supplier] in parallel
- All three feed into Recommendation Agent
- Recommendation Agent produces final output
```

**Step 6 - Mock Data:**
- 50 SKUs across produce categories (tomatoes, lettuce, peppers, etc.)
- 10 stores in Northeast region
- 30-day sales history with weekly seasonality
- Variable lead times (24h local, 72h regional)

**Step 7 - Demo Strategy:**
- Persona: Regional Supply Chain Manager
- Key Moments: 
  1. "Watch three agents gather data simultaneously"
  2. "See how it prioritizes by urgency and business impact"
  3. "The rationale explains WHY - not just WHAT"

---

## Healthcare: Prior Authorization

### Scenario
A health plan wants to reduce prior authorization turnaround time while maintaining clinical accuracy.

### Wizard Suggestions

**Step 1 - Business Context:**
- Objective: "Reduce prior auth turnaround from 3 days to under 1 hour for routine requests"
- Industry: Healthcare
- Systems: Epic (clinical), Facets or QNXT (claims), possibly Salesforce Health Cloud

**Step 3 - Outcomes:**
- Primary: "Automated prior auth decision with clinical rationale and supporting evidence"
- Metrics: Turnaround time, auto-approval rate, appeal rate, provider satisfaction
- Stakeholders: Chief Medical Officer, VP Operations, Provider Relations

**Step 4 - Security:**
- Data Sensitivity: **Restricted** (PHI)
- Compliance: **HIPAA**, possibly HITRUST, state regulations
- Approval Gates: "All denials require human clinician review before release"
- Guardrails: "Demo uses synthetic patient data only. No real PHI."

**Step 5 - Agent Design:**
```
Agents:
├── Intake Agent - Parses prior auth request, extracts CPT/ICD codes
├── Policy Agent - Retrieves applicable coverage rules and guidelines
├── Clinical Agent - Pulls relevant patient history and context
└── Decision Agent - Applies medical necessity criteria, generates recommendation

Orchestration: Graph (parallel lookup → sequential decision)

Edges:
- Intake Agent parses request first
- [Policy, Clinical] agents work in parallel with parsed data
- Decision Agent synthesizes into recommendation
```

**Step 6 - Mock Data:**
- 20 sample prior auth requests (mix of approvals, denials, pends)
- Medical policies for common procedures (imaging, DME, specialty drugs)
- Synthetic patient histories with relevant diagnoses
- Provider directory with NPI numbers

**Step 7 - Demo Strategy:**
- Persona: Care Management Nurse or Medical Director
- Key Moments:
  1. "Request parsed and understood in seconds"
  2. "Clinical history and policy checked simultaneously"
  3. "Decision includes specific guideline citations"
  4. "Denials queue for human review - AI recommends, humans decide"

---

## Financial Services: Fraud Detection

### Scenario
A bank wants to improve real-time fraud detection while reducing false positives.

### Wizard Suggestions

**Step 1 - Business Context:**
- Objective: "Detect 95% of fraud while reducing false positive rate by 40%"
- Industry: Financial Services
- Systems: Core banking (FIS/Fiserv), Salesforce, fraud platform (FICO, SAS)

**Step 3 - Outcomes:**
- Primary: "Real-time fraud risk score with explanation and recommended action"
- Metrics: Detection rate, false positive rate, customer friction score
- Stakeholders: Chief Risk Officer, Fraud Operations Director, Customer Experience

**Step 4 - Security:**
- Data Sensitivity: **Confidential**
- Compliance: PCI-DSS, SOX, BSA/AML, state regulations
- Approval Gates: "Transactions over $10K flagged high-risk require human review"
- Guardrails: "No real account numbers in demo. Use tokenized test data."

**Step 5 - Agent Design:**
```
Agents:
├── Transaction Agent - Analyzes transaction patterns and velocity
├── Customer Agent - Builds customer behavior profile and history
├── Network Agent - Checks for known fraud patterns and linked accounts
└── Risk Agent - Synthesizes signals into risk score with explanation

Orchestration: Graph (parallel analysis → risk synthesis)

Edges:
- All three analysis agents run in parallel on transaction event
- Risk Agent combines signals and produces score
- High-risk scores trigger alert workflow
```

**Step 6 - Mock Data:**
- 1000 historical transactions (95% legitimate, 5% fraudulent)
- 50 customer profiles with behavior baselines
- Known fraud patterns (velocity, geographic, device)
- Test cases covering edge scenarios

**Step 7 - Demo Strategy:**
- Persona: Fraud Analyst
- Key Moments:
  1. "Transaction analyzed across three dimensions simultaneously"
  2. "Risk score explains WHICH factors contributed"
  3. "Low-risk transactions flow through, high-risk queue for review"
  4. "False positive example shows improved precision"

---

## Manufacturing: Predictive Maintenance

### Scenario
A manufacturer wants to predict equipment failures before they cause unplanned downtime.

### Wizard Suggestions

**Step 1 - Business Context:**
- Objective: "Predict equipment failures 48+ hours in advance with 85% accuracy"
- Industry: Manufacturing
- Systems: SAP PM (Plant Maintenance), Siemens MindSphere or Rockwell FactoryTalk, historian

**Step 3 - Outcomes:**
- Primary: "Maintenance recommendation with predicted failure time and confidence"
- Metrics: Prediction accuracy, lead time, unplanned downtime reduction
- Stakeholders: Plant Manager, Maintenance Director, Reliability Engineer

**Step 4 - Security:**
- Data Sensitivity: Internal
- Compliance: Safety regulations if applicable (OSHA)
- Approval Gates: "Critical equipment maintenance requires supervisor sign-off"

**Step 5 - Agent Design:**
```
Agents:
├── Sensor Agent - Collects and normalizes real-time sensor data
├── Pattern Agent - Compares current readings to failure signatures
├── History Agent - Retrieves maintenance history and failure records
└── Prediction Agent - Generates failure probability and recommended action

Orchestration: Workflow (sequential analysis pipeline)

Edges:
- Sensor Agent processes incoming data
- Pattern Agent analyzes for anomalies
- History Agent adds context
- Prediction Agent produces recommendation
```

**Step 6 - Mock Data:**
- Sensor readings for 5 critical machines (temperature, vibration, pressure)
- 6 months of historical data with 3 actual failure events
- Maintenance work orders and resolution times
- Failure mode signatures for common issues

**Step 7 - Demo Strategy:**
- Persona: Reliability Engineer
- Key Moments:
  1. "Real-time sensor data streaming in"
  2. "Anomaly detected - pattern matches previous failure"
  3. "48-hour warning with specific component identified"
  4. "Work order automatically generated in SAP"

---

## Quick Reference: Industry Defaults

| Industry | Data Sensitivity | Key Compliance | Typical Orchestration |
|----------|------------------|----------------|----------------------|
| Retail | Internal | None | Graph (parallel gather) |
| Healthcare | Restricted | HIPAA | Graph + Human gate |
| Financial Services | Confidential | SOX, PCI, BSA | Graph + Human gate |
| Manufacturing | Internal | Safety regs | Workflow (sequential) |
| Technology | Internal | SOC2 | Graph (parallel) |
