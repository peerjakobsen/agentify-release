# Ideation Wizard Scenarios

This document provides sample scenarios for the Ideation Wizard, demonstrating typical inputs for different industries. Use these as reference when creating agent workflow demos.

---

## Scenario 1: Financial Services (FSI) - Loan Processing Automation

### Step 1: Business Context

**Business Objective:**
```
Automate the commercial loan underwriting process to reduce manual document review time and improve decision consistency. Currently, loan officers spend 4-6 hours per application reviewing financial documents, cross-referencing credit reports, and compiling risk assessments. We need an AI agent that can extract key financial metrics, flag anomalies, and generate preliminary risk scores while ensuring compliance with regulatory requirements.
```

**Industry:** FSI

**Systems to Integrate:**
- CRM: Salesforce
- Data: Snowflake

**Custom Systems:**
```
IBM Mainframe (z/OS) with core banking system (FIS Profile, Fiserv DNA), Experian Credit API, Moody's Analytics, DocuSign, internal loan origination system (LOS), MQ Series for mainframe messaging
```

**Additional Context (suggested file):** Commercial_Loan_Guidelines_2024.pdf

---

### Step 2: AI Gap-Filling (Expected Assumptions)

The AI should propose assumptions like:
- **IBM Mainframe (z/OS):** Core banking system (FIS Profile or Fiserv DNA), customer master data, account balances, transaction history. Integration via MQ Series message queues and CICS web services
- **Salesforce:** Modules: Financial Services Cloud. Integrations: Customer relationship history, previous loan applications, relationship manager notes
- **Snowflake:** Integrations: Historical loan performance data, credit model training datasets, regulatory reporting warehouse

**Sample Refinement Prompt:**
```
We use FIS Profile for core banking, not Fiserv DNA. The mainframe integration goes through our API gateway (Apigee) which wraps the CICS transactions. We also need to integrate with our Basel III compliance engine for capital adequacy calculations and pull data from Bloomberg Terminal for market risk indicators.
```

---

### Step 3: Outcome Definition

#### Phase 1: AI Suggestions (Read-Only Card)

The AI generates initial suggestions based on business context and confirmed assumptions:

**Primary Outcome:**
```
Reduce commercial loan underwriting cycle time by 50% while maintaining decision quality and ensuring regulatory compliance.
```

**Suggested KPIs:**
- Document processing time: 60 minutes
- Risk assessment accuracy: 90%
- Compliance check completion: 100%

**Suggested Stakeholders:**
`Finance` `Operations` `Legal` `Risk Management`

---

**Sample Refinement Prompt:**
```
Make the cycle time reduction more aggressive - we're targeting 70%. Add metrics for false positive rate on fraud flags and loan officer productivity. Also add Executive as a stakeholder since they're sponsoring this initiative.
```

---

#### Phase 2: Accepted & Edited Values

After clicking "Accept Suggestions" and applying refinements:

**Primary Outcome:**
```
Reduce commercial loan underwriting cycle time by 60% while maintaining or improving decision quality and regulatory compliance accuracy.
```

**Success Metrics:**

| Metric Name | Target Value | Unit |
|-------------|--------------|------|
| Document processing time | 45 | minutes |
| Risk assessment accuracy | 95 | % |
| Compliance check completion | 100 | % |
| False positive rate (fraud flags) | < 2 | % |
| Loan officer productivity | 3x | applications/day |

**Stakeholders:**
- [x] Finance
- [x] Operations
- [x] Executive
- [x] Legal
- [ ] IT
- [ ] Customer Service

---

### Step 4: Security & Guardrails

**Data Sensitivity:** Confidential

**Compliance Frameworks:**
- [x] PCI-DSS
- [x] SOC 2

**Approval Gates:**
- [x] Before external API calls
- [x] Before data modification
- [x] Before sending recommendations
- [x] Before financial transactions

**Guardrail Notes:**
```
All loan decisions require human approval before communication to customer. Agent must log all data access for audit trail. PII must be masked in any logging or reporting outputs.
```

---

### Step 5: Agent Design Proposal

#### AI-Proposed Agent Team

| Agent | Role | Tools |
|-------|------|-------|
| **Document Extractor** | Extract financial metrics from loan documents | `salesforce_get_application`, `docusign_get_documents`, `mainframe_get_customer_data` |
| **Credit Analyzer** | Pull credit reports and analyze creditworthiness | `experian_get_credit_report`, `moodys_get_risk_score`, `snowflake_query_loan_history` |
| **Compliance Checker** | Verify regulatory compliance and flag issues | `mainframe_get_account_balances`, `basel_calculate_capital_adequacy`, `bloomberg_get_market_risk` |
| **Risk Assessor** | Generate preliminary risk scores and recommendations | `snowflake_query_performance_data`, `salesforce_get_relationship_notes` |
| **Output Formatter** | Compile final underwriting report | `salesforce_update_opportunity`, `los_create_assessment` |

**Orchestration Pattern:** `workflow`

**Why this pattern?**
```
Loan underwriting follows a deterministic sequence: documents must be extracted before credit analysis, compliance checks run in parallel with risk assessment, and all results feed into the final report. The workflow pattern ensures consistent execution order with automatic parallelization where safe.
```

**Flow Summary:**
```
Document Extractor → [Credit Analyzer | Compliance Checker] → Risk Assessor → Output Formatter
```

---

**Sample Adjustment Prompt:**
```
Add a Fraud Detection agent between Document Extractor and Credit Analyzer. It should use the mainframe transaction history and Experian fraud indicators. Also rename Output Formatter to Underwriting Report Generator.
```

---

## Scenario 2: Manufacturing - Predictive Maintenance Agent

### Step 1: Business Context

**Business Objective:**
```
Implement an AI-powered predictive maintenance system for our automotive parts manufacturing facility. Our production lines experience approximately 15 unplanned downtime events per month, costing $50,000+ per incident. We need an agent that can monitor IoT sensor data in real-time, predict equipment failures before they occur, automatically generate maintenance work orders, and optimize spare parts inventory based on predicted failure patterns.
```

**Industry:** Manufacturing

**Systems to Integrate:**
- ERP: SAP S/4HANA
- Service: ServiceNow
- Data: Databricks

**Custom Systems:**
```
Siemens MindSphere (IoT platform), OSIsoft PI System, Rockwell FactoryTalk, CMMS (Maximo)
```

**Additional Context (suggested file):** Equipment_Specifications_LineA.pdf

---

### Step 2: AI Gap-Filling (Expected Assumptions)

The AI should propose assumptions like:
- **SAP S/4HANA:** Modules: PM (Plant Maintenance), MM (Materials Management), PP (Production Planning). Integrations: Work order creation, spare parts inventory, production scheduling
- **ServiceNow:** Modules: IT Service Management, Field Service. Integrations: Incident creation, maintenance technician dispatch
- **Databricks:** Integrations: ML model training for failure prediction, sensor data processing pipelines

**Sample Refinement Prompt:**
```
We're using Siemens S7-1500 PLCs across all production lines. The agent needs to read OPC-UA data directly. Also, we have shift schedules in Kronos that should factor into maintenance window recommendations.
```

---

### Step 3: Outcome Definition

#### Phase 1: AI Suggestions (Read-Only Card)

The AI generates initial suggestions based on business context and confirmed assumptions:

**Primary Outcome:**
```
Reduce unplanned production downtime through AI-driven predictive maintenance while optimizing maintenance costs.
```

**Suggested KPIs:**
- Unplanned downtime reduction: 50%
- Prediction accuracy (failures): 80%
- Mean time to repair: 4 hours

**Suggested Stakeholders:**
`Operations` `IT` `Supply Chain`

---

**Sample Refinement Prompt:**
```
We're targeting 70% downtime reduction based on our OEE analysis. Add metrics for spare parts inventory turns and maintenance cost per unit. Mean time to repair should be 2 hours max. Also include Finance since they're tracking the ROI.
```

---

#### Phase 2: Accepted & Edited Values

After clicking "Accept Suggestions" and applying refinements:

**Primary Outcome:**
```
Reduce unplanned production downtime by 70% through AI-driven predictive maintenance while optimizing maintenance labor and spare parts costs.
```

**Success Metrics:**

| Metric Name | Target Value | Unit |
|-------------|--------------|------|
| Unplanned downtime reduction | 70 | % |
| Prediction accuracy (failures) | 85 | % |
| Mean time to repair | 2 | hours |
| Spare parts inventory turns | 6 | per year |
| Maintenance cost per unit | 15 | % reduction |

**Stakeholders:**
- [x] Operations
- [x] Supply Chain
- [x] Finance
- [x] IT
- [ ] Executive
- [ ] Customer Service

---

### Step 4: Security & Guardrails

**Data Sensitivity:** Internal

**Compliance Frameworks:**
- [x] SOC 2

**Approval Gates:**
- [x] Before data modification
- [ ] Before external API calls
- [ ] Before sending recommendations
- [ ] Before financial transactions

**Guardrail Notes:**
```
Agent cannot directly control equipment - all actions must be recommendations to human operators. Emergency shutdown scenarios require immediate human notification via SMS. Maintenance windows must respect collective bargaining agreement shift rules.
```

---

### Step 5: Agent Design Proposal

#### AI-Proposed Agent Team

| Agent | Role | Tools |
|-------|------|-------|
| **Sensor Monitor** | Continuously monitor IoT sensor data for anomalies | `mindsphere_get_sensor_data`, `osisoft_query_pi_tags`, `factorytalk_get_plc_status` |
| **Failure Predictor** | Run ML models to predict equipment failures | `databricks_run_prediction`, `mindsphere_get_asset_health`, `sap_get_maintenance_history` |
| **Work Order Creator** | Generate and route maintenance work orders | `sap_create_work_order`, `servicenow_create_incident`, `maximo_schedule_maintenance` |
| **Parts Optimizer** | Analyze spare parts inventory and recommend orders | `sap_get_inventory_levels`, `sap_create_purchase_requisition`, `kronos_get_shift_schedule` |
| **Notification Agent** | Alert technicians and supervisors of predicted failures | `servicenow_dispatch_technician`, `sap_notify_supervisor` |

**Orchestration Pattern:** `graph`

**Why this pattern?**
```
Predictive maintenance requires conditional routing based on failure severity and type. Critical failures trigger immediate notifications, while minor issues can wait for scheduled windows. The graph pattern allows the LLM to dynamically route based on real-time conditions and maintenance urgency.
```

**Flow Summary:**
```
Sensor Monitor → Failure Predictor → [Work Order Creator | Notification Agent]? → Parts Optimizer
```

---

**Sample Adjustment Prompt:**
```
Add an OEE Calculator agent that tracks Overall Equipment Effectiveness metrics. It should pull data from FactoryTalk and feed into the Failure Predictor for correlation. Also, the Parts Optimizer should integrate with our supplier portal for automated reorder suggestions.
```

---

## Scenario 3: Life Sciences - Clinical Trial Document Processing

### Step 1: Business Context

**Business Objective:**
```
Accelerate clinical trial regulatory submission preparation by automating document compilation and cross-referencing. Our regulatory affairs team currently spends 200+ hours per NDA submission manually compiling Clinical Study Reports (CSRs), cross-referencing patient data, and ensuring consistency across hundreds of documents. We need an AI agent that can extract structured data from clinical trial databases, auto-generate document sections following FDA/EMA templates, identify inconsistencies, and prepare submission-ready packages.
```

**Industry:** Life Sciences

**Systems to Integrate:**
- Data: Snowflake
- ERP: Oracle

**Custom Systems:**
```
Veeva Vault RIM (Regulatory Information Management), Medidata Rave (Clinical Trial Data), SAS for statistical analysis, electronic Common Technical Document (eCTD) publishing system
```

**Additional Context (suggested file):** FDA_eCTD_Submission_Guidelines.pdf

---

### Step 2: AI Gap-Filling (Expected Assumptions)

The AI should propose assumptions like:
- **Oracle:** Modules: Oracle Clinical, Oracle Health Sciences Data Management. Integrations: Clinical trial master data, patient demographics, adverse event reporting
- **Snowflake:** Integrations: Aggregated clinical data warehouse, statistical analysis outputs, historical submission data
- **Veeva Vault:** Assumed integration for regulatory document management, submission tracking, and compliance workflows

**Sample Refinement Prompt:**
```
We need to ensure the agent can handle both FDA and EMA submission formats. The agent should also integrate with our LIMS (Laboratory Information Management System) for bioanalytical data. All patient identifiers must be anonymized according to HIPAA Safe Harbor standards.
```

---

### Step 3: Outcome Definition

#### Phase 1: AI Suggestions (Read-Only Card)

The AI generates initial suggestions based on business context and confirmed assumptions:

**Primary Outcome:**
```
Accelerate NDA/BLA submission preparation while improving document quality and ensuring regulatory compliance.
```

**Suggested KPIs:**
- Submission prep time: 120 hours
- Document consistency score: 95%
- First-pass acceptance rate: 90%

**Suggested Stakeholders:**
`Operations` `Legal` `IT` `Regulatory Affairs`

---

**Sample Refinement Prompt:**
```
Target 50% reduction in prep time (down to 100 hours). Add cross-reference accuracy as a metric - we need 99.5% minimum. Include deficiency letter reduction since that's a key executive metric. Add Clinical Operations, Medical Writing, and Quality Assurance as stakeholders - they're critical for this workflow.
```

---

#### Phase 2: Accepted & Edited Values

After clicking "Accept Suggestions" and applying refinements:

**Primary Outcome:**
```
Reduce NDA/BLA submission preparation time by 50% while improving document quality scores and ensuring 100% regulatory compliance across FDA and EMA requirements.
```

**Success Metrics:**

| Metric Name | Target Value | Unit |
|-------------|--------------|------|
| Submission prep time | 100 | hours |
| Document consistency score | 98 | % |
| First-pass acceptance rate | 95 | % |
| Cross-reference accuracy | 99.5 | % |
| Deficiency letter reduction | 60 | % reduction |

**Stakeholders:**
- [x] Operations
- [x] Legal
- [x] Executive
- [x] IT
- [ ] Finance
- [ ] Customer Service

**Custom Stakeholders (AI-suggested):**
- [x] Regulatory Affairs
- [x] Clinical Operations
- [x] Medical Writing
- [x] Quality Assurance

---

### Step 4: Security & Guardrails

**Data Sensitivity:** Restricted

**Compliance Frameworks:**
- [x] HIPAA
- [x] SOC 2
- [x] GDPR

**Approval Gates:**
- [x] Before external API calls
- [x] Before data modification
- [x] Before sending recommendations

**Guardrail Notes:**
```
All patient data must be de-identified before AI processing. 21 CFR Part 11 compliance required for electronic signatures and audit trails. No patient-level data can leave the validated environment. All AI-generated content must be reviewed by qualified medical writer before submission. Agent must maintain complete audit trail for regulatory inspection.
```

---

### Step 5: Agent Design Proposal

#### AI-Proposed Agent Team

| Agent | Role | Tools |
|-------|------|-------|
| **Data Extractor** | Extract structured data from clinical databases | `medidata_query_study_data`, `oracle_get_patient_demographics`, `lims_get_bioanalytical_data` |
| **Document Compiler** | Generate CSR sections from templates | `veeva_get_template`, `snowflake_query_historical_submissions`, `sas_get_statistical_outputs` |
| **Cross-Reference Validator** | Identify inconsistencies across documents | `veeva_compare_documents`, `oracle_validate_references`, `snowflake_check_data_consistency` |
| **Compliance Auditor** | Verify FDA/EMA format compliance | `veeva_validate_ectd_structure`, `oracle_audit_signatures`, `veeva_check_21cfr11` |
| **Submission Packager** | Assemble final eCTD submission package | `veeva_create_submission`, `ectd_publish_package`, `veeva_generate_audit_trail` |

**Orchestration Pattern:** `workflow`

**Why this pattern?**
```
Regulatory submissions require strict sequential processing: data must be extracted and validated before documents can be compiled, cross-references checked before compliance audit, and everything verified before final packaging. The workflow pattern ensures deterministic execution with parallel processing only where data dependencies allow.
```

**Flow Summary:**
```
Data Extractor → Document Compiler → [Cross-Reference Validator | Compliance Auditor] → Submission Packager
```

---

**Sample Adjustment Prompt:**
```
Add a De-identification Agent at the start that anonymizes all patient data according to HIPAA Safe Harbor. It should run before Data Extractor. Also add a Medical Writing Assistant agent that helps format clinical narratives - it should work alongside Document Compiler.
```

---

## Quick Reference: Field Mappings

### Industries Available
- Retail
- FSI
- Healthcare
- Life Sciences
- Manufacturing
- Energy
- Telecom
- Public Sector
- Media & Entertainment
- Travel & Hospitality
- Other

### System Categories
| Category | Systems |
|----------|---------|
| CRM | Salesforce, HubSpot, Dynamics |
| ERP | SAP S/4HANA, Oracle, NetSuite |
| Data | Databricks, Snowflake, Redshift |
| HR | Workday, SuccessFactors |
| Service | ServiceNow, Zendesk |

### Default Stakeholders
- Operations
- Finance
- Supply Chain
- Customer Service
- Executive
- IT
- Sales
- Marketing
- HR
- Legal

### Compliance Frameworks
- SOC 2
- HIPAA
- PCI-DSS
- GDPR
- FedRAMP

### Industry Compliance Defaults
| Industry | Default Frameworks |
|----------|-------------------|
| Healthcare | HIPAA |
| Life Sciences | HIPAA |
| FSI | PCI-DSS, SOC 2 |
| Public Sector | FedRAMP |
