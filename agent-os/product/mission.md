# Product Mission

## Pitch

Value Map Agentifier is a Kiro IDE plugin system that helps AWS sales field teams transform customer account plan value maps into working multi-agent demo applications by providing AI-assisted ideation, automated code generation via Kiro's spec-driven development, and a standardized observability UI — enabling teams to show customers exactly how agentic AI can solve their specific business challenges.

## Users

### Primary Customers

- **AWS Account Team Members**: Sales representatives and Solutions Architects who work with enterprise customers on strategic account plans and need to demonstrate AWS AI capabilities in customer-relevant contexts
- **AWS Specialist SAs**: AI/ML or Industry specialists who support account teams with deeper technical expertise and customize demos for proof-of-concepts

### User Personas

**Account Executive Alex** (35-45)
- **Role:** Enterprise Account Manager at AWS
- **Context:** Managing strategic accounts with multi-million dollar potential; preparing for quarterly business reviews where demonstrating AI value is critical
- **Pain Points:** Generic AWS demos don't resonate with customers; building custom demos takes weeks; lacks full visibility into customer's technical landscape
- **Goals:** Create compelling, customer-specific AI demos in hours instead of weeks; win customer confidence by showing exactly how agentic AI solves their problems

**Solutions Architect Sam** (28-40)
- **Role:** Solutions Architect supporting enterprise accounts
- **Context:** Knows "customer has SAP" but not specific modules; comfortable with IDE tools but time-constrained before customer meetings
- **Pain Points:** Cannot quickly prototype agent workflows; explaining multi-agent orchestration is difficult without visual demos; no standardized way to show agent behavior
- **Goals:** Rapidly prototype demos that map to customer value maps; provide clear observability into agent decision-making

**Specialist SA Maya** (30-45)
- **Role:** AI/ML Specialist Solutions Architect
- **Context:** Deep technical expertise; extends and customizes demos into production proof-of-concepts
- **Pain Points:** Starting from scratch for each customer; no reusable patterns across industries
- **Goals:** Use generated demos as starting points; leverage industry templates for faster delivery

## The Problem

### Generic Demos Don't Resonate
AWS field teams show generic AI demos that don't connect to customer's specific business priorities and systems. Customers see technology, not solutions to their problems.

**Our Solution:** AI-assisted ideation that transforms customer account plan value maps into tailored demo scenarios featuring their specific systems and business outcomes.

### Building Custom Demos Takes Too Long
Creating a customer-specific agentic workflow demo requires weeks of development effort, making it impractical before most customer meetings.

**Our Solution:** Automated generation of Kiro-compatible artifacts that leverage spec-driven development to produce working demos in hours.

### Account Teams Lack Full Customer Context
Field teams know high-level details (industry, major systems like SAP or Salesforce) but not specific integration details needed for realistic demos.

**Our Solution:** Claude-powered gap filling that proposes industry-typical configurations based on what the account team does know.

### Agentic AI Is Hard to Explain
Customers struggle to understand multi-agent orchestration without seeing it in action. Abstract explanations don't convey the value.

**Our Solution:** Real-time agent graph visualization showing exactly how agents collaborate, hand off work, and make decisions.

### No Visibility Into Agent Behavior
Customers can't see what's happening "under the hood" when agents execute, making the technology feel like a black box.

**Our Solution:** Standardized observability UI with execution logs, tool calls, and outcome metrics that demystify agent behavior.

## Differentiators

### AI-Assisted Knowledge Gap Filling
Unlike manual demo building that requires complete customer technical knowledge, we use Claude to propose industry-typical configurations based on partial information.
This results in realistic demos even when account teams only know high-level customer systems.

### Seamless Kiro Integration
Unlike standalone prototyping tools, we generate native Kiro steering files and MCP configurations that feed directly into Kiro's spec-driven development flow.
This results in working agent code through Kiro's established development workflow.

### Standardized Observability UI
Unlike custom-built demo UIs for each project, we provide a reusable Demo Viewer panel that works with any generated demo.
This results in consistent, professional observability across all customer demonstrations.

### Value Map to Demo Pipeline
Unlike disconnected tools requiring manual handoffs, we provide an end-to-end flow from account plan upload to working multi-agent demo.
This results in 2-hour demo creation instead of multi-week development cycles.

### Built on AWS Native Services
Unlike vendor-agnostic tools, we leverage AgentCore Runtime, Bedrock, and DynamoDB for optimal AWS integration.
This results in demos that showcase AWS's agentic AI capabilities and pave the path to production deployment.

## Key Features

The Agentify extension provides two webview panels within a single installation:

### Ideation Wizard Panel (Design-Time)
- **Business Objective Input:** Enter business objective/problem statement, select industry vertical, identify known customer systems (SAP, Salesforce, Databricks, etc.), and optionally upload context documents (account plans, requirements docs)
- **AI-Assisted Gap Filling:** Claude uses provided context to propose agent designs and fills in industry-typical configurations when specific details are unknown
- **Outcome Definition:** Define measurable business outcomes and success criteria that map to customer priorities
- **Agent Design:** AI-proposed agent teams with appropriate orchestration patterns for the use case
- **Mock Data Strategy:** Realistic mock data generation based on industry context for compelling demos
- **Demo Narrative Flow:** Capture key "aha moments" and demo persona for impactful customer presentations
- **Kiro Artifact Generation:** Automatic creation of steering files, MCP configurations, and hooks
- **Kiro Spec Trigger:** Seamless handoff to Kiro's spec-driven development flow

### Demo Viewer Panel (Runtime)
- **Workflow Triggering:** Support for local subprocess, AgentCore API, and HTTP endpoint modes
- **Input Panel:** Simple prompt input, Run Workflow button, and workflow ID display
- **Agent Graph Visualization:** Live React Flow graph showing agents, handoffs, and execution status with real-time updates
- **Execution Log Panel:** Chronological events with timestamps and expandable details (tool calls from DynamoDB)
- **Outcome Panel:** Final results, success/failure indicators, and key metrics

### Shared Services
- **AWS Clients:** DynamoDB and Bedrock clients shared across both panels
- **Configuration Service:** Reads `.agentify/config.json` for project settings
- **Project Initialization:** "Agentify: Initialize Project" command sets up infrastructure and config

### Advanced Features
- **Industry Templates:** Pre-built agent patterns for retail, FSI, healthcare, and manufacturing
- **Value Map Templates:** Common value maps with suggested agent team configurations
- **Demo Script Generator:** AI-generated talking points aligned with demo narrative
- **Demo Library:** Save, share, and reuse demos across the team
