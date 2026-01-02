/**
 * Tests for Python Orchestrator Template Updates
 *
 * Task Group 5: Python Template Updates
 * Verifies that Python templates emit correct node_start events with
 * from_agent and handoff_prompt fields for dual-pane conversation UI
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Path to Python templates
const TEMPLATES_DIR = path.resolve(__dirname, '../../../resources/agents');

/**
 * Helper to read a Python template file
 */
function readPythonTemplate(filename: string): string {
  const filepath = path.join(TEMPLATES_DIR, filename);
  return fs.readFileSync(filepath, 'utf-8');
}

/**
 * Helper to extract node_start emit_event calls from Python code
 * Returns the dictionary content of emit_event calls with event_type: "node_start"
 */
function extractNodeStartEvents(pythonCode: string): string[] {
  const events: string[] = [];
  // Match emit_event({ ... }) patterns where event_type is "node_start"
  const emitEventRegex = /emit_event\(\{[^}]*"event_type":\s*"node_start"[^}]*\}\)/g;
  const matches = pythonCode.match(emitEventRegex);
  if (matches) {
    events.push(...matches);
  }
  return events;
}

/**
 * Check if a node_start event includes the from_agent field
 */
function hasFromAgentField(eventCode: string): boolean {
  return /"from_agent":/i.test(eventCode);
}

/**
 * Check if a node_start event includes the handoff_prompt field
 */
function hasHandoffPromptField(eventCode: string): boolean {
  return /"handoff_prompt":/i.test(eventCode);
}

/**
 * Check if Python code tracks previous_agent_name variable
 */
function tracksPreviousAgentName(pythonCode: string): boolean {
  // Check for initialization
  const hasInit = /previous_agent_name\s*=\s*None/i.test(pythonCode);
  // Check for update after agent completes
  const hasUpdate = /previous_agent_name\s*=\s*agent_name/i.test(pythonCode);
  return hasInit && hasUpdate;
}

describe('Task Group 5: Python Template Updates', () => {
  describe('5.1 Entry agent emits from_agent: null, handoff_prompt: <user prompt>', () => {
    it('main_graph.py node_start includes from_agent field', () => {
      const code = readPythonTemplate('main_graph.py');
      const nodeStartEvents = extractNodeStartEvents(code);

      expect(nodeStartEvents.length).toBeGreaterThan(0);
      nodeStartEvents.forEach((event) => {
        expect(hasFromAgentField(event)).toBe(true);
      });
    });

    it('main_graph.py node_start includes handoff_prompt field', () => {
      const code = readPythonTemplate('main_graph.py');
      const nodeStartEvents = extractNodeStartEvents(code);

      expect(nodeStartEvents.length).toBeGreaterThan(0);
      nodeStartEvents.forEach((event) => {
        expect(hasHandoffPromptField(event)).toBe(true);
      });
    });

    it('main_graph.py tracks previous_agent_name for from_agent value', () => {
      const code = readPythonTemplate('main_graph.py');
      expect(tracksPreviousAgentName(code)).toBe(true);
    });
  });

  describe('5.2 Subsequent agents emit from_agent: <sender>, handoff_prompt: <enhanced prompt>', () => {
    it('main_swarm.py node_start includes from_agent field', () => {
      const code = readPythonTemplate('main_swarm.py');
      const nodeStartEvents = extractNodeStartEvents(code);

      expect(nodeStartEvents.length).toBeGreaterThan(0);
      nodeStartEvents.forEach((event) => {
        expect(hasFromAgentField(event)).toBe(true);
      });
    });

    it('main_swarm.py node_start includes handoff_prompt field', () => {
      const code = readPythonTemplate('main_swarm.py');
      const nodeStartEvents = extractNodeStartEvents(code);

      expect(nodeStartEvents.length).toBeGreaterThan(0);
      nodeStartEvents.forEach((event) => {
        expect(hasHandoffPromptField(event)).toBe(true);
      });
    });

    it('main_swarm.py tracks previous_agent_name for from_agent value', () => {
      const code = readPythonTemplate('main_swarm.py');
      expect(tracksPreviousAgentName(code)).toBe(true);
    });
  });

  describe('5.3 Event structure matches TypeScript NodeStartEvent interface', () => {
    it('main_workflow.py node_start includes from_agent field', () => {
      const code = readPythonTemplate('main_workflow.py');
      const nodeStartEvents = extractNodeStartEvents(code);

      expect(nodeStartEvents.length).toBeGreaterThan(0);
      nodeStartEvents.forEach((event) => {
        expect(hasFromAgentField(event)).toBe(true);
      });
    });

    it('main_workflow.py node_start includes handoff_prompt field', () => {
      const code = readPythonTemplate('main_workflow.py');
      const nodeStartEvents = extractNodeStartEvents(code);

      expect(nodeStartEvents.length).toBeGreaterThan(0);
      nodeStartEvents.forEach((event) => {
        expect(hasHandoffPromptField(event)).toBe(true);
      });
    });

    it('main_workflow.py tracks previous_agent_name for from_agent value', () => {
      const code = readPythonTemplate('main_workflow.py');
      expect(tracksPreviousAgentName(code)).toBe(true);
    });
  });

  describe('5.4 All three orchestrator patterns emit correct fields', () => {
    const templates = ['main_graph.py', 'main_swarm.py', 'main_workflow.py'];

    templates.forEach((template) => {
      it(`${template} uses event_type field (not type) for consistency`, () => {
        const code = readPythonTemplate(template);
        const nodeStartEvents = extractNodeStartEvents(code);

        expect(nodeStartEvents.length).toBeGreaterThan(0);
        nodeStartEvents.forEach((event) => {
          // Should use event_type, not type
          expect(event).toContain('"event_type"');
        });
      });
    });

    it('all templates emit identical event structure for node_start', () => {
      const expectedFields = ['event_type', 'timestamp', 'session_id', 'workflow_id', 'trace_id', 'node_id', 'node_name', 'from_agent', 'handoff_prompt'];

      templates.forEach((template) => {
        const code = readPythonTemplate(template);
        const nodeStartEvents = extractNodeStartEvents(code);

        expect(nodeStartEvents.length).toBeGreaterThan(0);
        nodeStartEvents.forEach((event) => {
          expectedFields.forEach((field) => {
            expect(event).toContain(`"${field}"`);
          });
        });
      });
    });
  });
});
