# Agentify Discovery Questions

Use these questions to gather customer context before suggesting wizard inputs. You don't need answers to ALL questions - even partial information helps create a compelling demo.

---

## Universal Questions (Ask First)

### The Basics
1. **What's the business problem?** What pain point or opportunity are we addressing?
2. **Who's the audience?** Who will see this demo? (Title/role, technical depth)
3. **What systems do you know about?** Even partial info helps (e.g., "they have SAP")
4. **What does success look like?** How would they measure improvement?

### If Time Permits
5. Are they evaluating competitors? Which ones?
6. Have they seen AI demos before? What resonated (or didn't)?
7. Is there a specific event/deadline driving this? (Board meeting, QBR, etc.)

---

## Retail Industry

### Inventory & Supply Chain
- Fresh/perishable or general merchandise?
- Store count and geographic spread?
- Current demand forecasting approach? (Manual, statistical, ML-based)
- Known pain points? (Stockouts, overstock, waste, visibility)

### Typical System Landscape
| If they say... | They likely also have... |
|----------------|-------------------------|
| SAP | S/4HANA Retail, IBP, CAR, possibly Ariba |
| Oracle | Oracle Retail, Demantra, or JD Edwards |
| Blue Yonder | Luminate Platform, WMS, TMS |
| Manhattan | WMS, TMS, possibly DOM |

### Suggested Value Maps
- Inventory replenishment optimization
- Demand forecasting accuracy
- Markdown optimization
- Store operations efficiency

---

## Financial Services

### Banking & Lending
- Retail banking, commercial, or wealth management?
- What's the primary use case? (Fraud, risk, customer service, operations)
- Regulatory environment? (Fed, OCC, state regulators)
- Real-time requirements? (Fraud needs milliseconds, risk can be batch)

### Insurance
- P&C, Life, or Health insurance?
- Claims processing or underwriting focus?
- Agent/broker channel or direct?

### Typical System Landscape
| If they say... | They likely also have... |
|----------------|-------------------------|
| Salesforce | Financial Services Cloud, possibly nCino |
| FIS/Fiserv | Core banking, payments processing |
| Guidewire | PolicyCenter, ClaimCenter, BillingCenter |
| Duck Creek | Policy, Billing, Claims suite |

### Suggested Value Maps
- Fraud detection and prevention
- Credit risk assessment
- Claims automation
- Customer 360 / next best action
- Regulatory compliance automation

### ⚠️ Always Flag
- Data sensitivity: Confidential or Restricted
- Compliance: SOX, PCI-DSS, GLBA, state regulations
- Approval gates: Transactions over thresholds need human review

---

## Healthcare

### Provider vs Payer
- Hospital/health system (provider) or insurance company (payer)?
- If provider: What EHR? (Epic, Cerner, Meditech, Allscripts)
- If payer: What claims platform? (Facets, QNXT, HealthEdge)

### Common Use Cases
- Prior authorization automation
- Clinical documentation improvement
- Care coordination
- Revenue cycle optimization
- Member/patient engagement

### Typical System Landscape
| If they say... | They likely also have... |
|----------------|-------------------------|
| Epic | MyChart, Caboodle, Cogito |
| Cerner | PowerChart, HealtheIntent |
| Facets (TriZetto) | Claims, eligibility, benefits |
| QNXT | Claims processing, care management |

### Suggested Value Maps
- Prior authorization turnaround
- Clinical decision support
- Care gap closure
- Denial management
- Population health analytics

### ⚠️ Always Flag
- Data sensitivity: **Restricted** (PHI)
- Compliance: **HIPAA required**, possibly HITRUST
- Approval gates: "Clinical decisions require human review"
- Mock data: "Must use synthetic patient data, no real PHI"

---

## Manufacturing

### Discrete vs Process
- Discrete manufacturing (automotive, electronics, machinery)?
- Process manufacturing (chemicals, food & beverage, pharma)?
- What's the focus? (Production, supply chain, quality, maintenance)

### Typical System Landscape
| If they say... | They likely also have... |
|----------------|-------------------------|
| SAP | S/4HANA, PP (Production Planning), QM, PM |
| Oracle | Oracle Manufacturing Cloud, SCM |
| Siemens | Opcenter, MindSphere |
| Rockwell | FactoryTalk, Plex |

### Suggested Value Maps
- Predictive maintenance
- Production optimization
- Quality defect prediction
- Supply chain visibility
- Energy optimization

---

## Technology / Software

### SaaS vs Enterprise
- B2B SaaS or enterprise software?
- What's the focus? (Customer success, support, sales, product)

### Typical System Landscape
| If they say... | They likely also have... |
|----------------|-------------------------|
| Salesforce | Sales Cloud, Service Cloud, possibly Slack |
| ServiceNow | ITSM, CSM, HR Service Delivery |
| Zendesk | Support, Guide, Chat |
| Jira | Confluence, Bitbucket, Opsgenie |

### Suggested Value Maps
- Customer support automation
- Incident management
- Sales intelligence
- Product usage analytics
- Churn prediction

---

## When Information Is Missing

If the user doesn't know specifics, suggest industry-typical defaults:

**Script:** "Based on typical {industry} companies focused on {value map}, here's what I'd assume:
- They likely use {system1} for {purpose1}
- They probably have {system2} for {purpose2}
- For the demo, we can create realistic mock data for these systems

If they correct us during the demo, it shows we understand the landscape. If we're right, it's impressive. Either way, we're prepared."
