# Agentify Advisor - Quick Suite Chat Agent

This folder contains configuration and reference documents for the **Agentify Advisor** Quick Suite chat agent.

## Purpose

Agentify Advisor is an AI-powered enablement companion for AWS field teams using the Agentify extension. It helps field teams rapidly create compelling agentic AI demos tailored to their customer's business challenges.

## Files

| File | Purpose | Quick Suite Usage |
|------|---------|-------------------|
| `persona-instructions.md` | Agent identity and behavior | Paste into **Persona Instructions** field |
| `wizard-reference.md` | Complete wizard field reference | Attach as **Reference Document** |
| `discovery-questions.md` | Industry-specific question banks | Attach as **Reference Document** |
| `quickstart-guide.md` | Installation and getting started | Attach as **Reference Document** |
| `scenario-suggestions.md` | Pre-built demo scenarios | Attach as **Reference Document** |
| `concept.md` | Full concept document with architecture | Internal reference |

## Quick Suite Setup

### 1. Create Custom Chat Agent
- Go to Quick Suite → Chat Agents → Create Custom Agent
- Name: "Agentify Advisor"

### 2. Configure Persona
- Copy contents of `persona-instructions.md` into Persona Instructions field

### 3. Attach Reference Documents
- Upload all other `.md` files as Reference Documents

### 4. Connect Knowledge Sources (Spaces)
- **HighSpot Space** - Connect via connector for industry knowledge
- **Agentify Docs Space** - Create and upload extension documentation

### 5. Test and Iterate
- Test with sample conversations
- Refine persona based on feedback
