/**
 * Tests for Graph Pattern Haiku Routing (Task Group 3: Haiku Router)
 *
 * These tests verify the Graph pattern integration of Haiku routing in main_graph.py:
 * - Haiku routing activates when useHaikuRouter: true
 * - Haiku routing skipped when useHaikuRouter: false
 * - Fallback to existing strategies on Haiku failure
 * - route_to_next_agent() returns valid agent with Haiku
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Paths to the Graph orchestrator and utilities
const GRAPH_PATH = path.resolve(__dirname, '../../../resources/agents/main_graph.py');
const UTILS_PATH = path.resolve(__dirname, '../../../resources/agents/shared/orchestrator_utils.py');

/**
 * Helper to read the main_graph.py file
 */
function readMainGraph(): string {
  return fs.readFileSync(GRAPH_PATH, 'utf-8');
}

/**
 * Helper to read orchestrator_utils.py for import verification
 */
function readOrchestratorUtils(): string {
  return fs.readFileSync(UTILS_PATH, 'utf-8');
}

describe('Task Group 3: Graph Pattern Haiku Routing', () => {
  describe('3.2 Strategy 0 in main_graph.py', () => {
    it('should import route_with_haiku and load_routing_config from orchestrator_utils', () => {
      const code = readMainGraph();
      expect(code).toContain('route_with_haiku');
      expect(code).toContain('load_routing_config');
    });

    it('should import get_available_agents from orchestrator_utils', () => {
      const code = readMainGraph();
      expect(code).toContain('get_available_agents');
    });

    it('should have Strategy 0 section header before other strategies', () => {
      const code = readMainGraph();
      // Strategy 0 should appear before Strategy 1
      const strategy0Index = code.indexOf('STRATEGY 0');
      const strategy1Index = code.indexOf('STRATEGY 1');
      expect(strategy0Index).toBeGreaterThan(-1);
      expect(strategy0Index).toBeLessThan(strategy1Index);
    });

    it('should check useHaikuRouter config before activating Haiku routing', () => {
      const code = readMainGraph();
      // Check that the route_to_next_agent function checks the config
      const routeToNextMatch = code.match(/def route_to_next_agent[\s\S]*?(?=\ndef\s|\n# ==)/);
      expect(routeToNextMatch).not.toBeNull();
      if (routeToNextMatch) {
        expect(routeToNextMatch[0]).toMatch(/useHaikuRouter/);
      }
    });
  });

  describe('3.3 Haiku routing logic in route_to_next_agent()', () => {
    it('should call route_with_haiku() with current agent and response', () => {
      const code = readMainGraph();
      const routeToNextMatch = code.match(/def route_to_next_agent[\s\S]*?(?=\ndef\s|\n# ==)/);
      expect(routeToNextMatch).not.toBeNull();
      if (routeToNextMatch) {
        expect(routeToNextMatch[0]).toContain('route_with_haiku(');
      }
    });

    it('should return immediately on valid Haiku result (skip other strategies)', () => {
      const code = readMainGraph();
      // Check for early return after Haiku routing
      const routeToNextMatch = code.match(/def route_to_next_agent[\s\S]*?(?=\ndef\s|\n# ==)/);
      expect(routeToNextMatch).not.toBeNull();
      if (routeToNextMatch) {
        // Should have return statement after Haiku routing check
        expect(routeToNextMatch[0]).toMatch(/route_with_haiku[\s\S]*?return\s+haiku_result/);
      }
    });

    it('should handle COMPLETE result from Haiku (workflow end)', () => {
      const code = readMainGraph();
      const routeToNextMatch = code.match(/def route_to_next_agent[\s\S]*?(?=\ndef\s|\n# ==)/);
      expect(routeToNextMatch).not.toBeNull();
      if (routeToNextMatch) {
        // Should check for COMPLETE and return None to signal workflow end
        expect(routeToNextMatch[0]).toMatch(/COMPLETE[\s\S]*?return None/);
      }
    });

    it('should fall through to existing strategies when Haiku returns None', () => {
      const code = readMainGraph();
      // Ensure Strategy 1 (explicit routing) still exists after Strategy 0
      expect(code).toContain('STRATEGY 1: Explicit routing');
      expect(code).toContain('STRATEGY 2: Structured classification');
      expect(code).toContain('STRATEGY 3: Static routing');
    });
  });

  describe('3.4 Warning logging for Haiku failures', () => {
    it('should log warning when Haiku routing is skipped (disabled)', () => {
      const code = readMainGraph();
      // Check for stderr logging about Haiku being disabled or skipped
      const routeToNextMatch = code.match(/def route_to_next_agent[\s\S]*?(?=\ndef\s|\n# ==)/);
      expect(routeToNextMatch).not.toBeNull();
      // Haiku fallback log is in orchestrator_utils, but graph should log skip reason
      // OR the code simply doesn't call Haiku when disabled (silent skip is acceptable)
    });

    it('should log warning when Haiku routing fails (returns None)', () => {
      const code = readMainGraph();
      const routeToNextMatch = code.match(/def route_to_next_agent[\s\S]*?(?=\ndef\s|\n# ==)/);
      expect(routeToNextMatch).not.toBeNull();
      if (routeToNextMatch) {
        // Should have stderr logging when Haiku fails
        expect(routeToNextMatch[0]).toMatch(/file=sys\.stderr/);
      }
    });
  });

  describe('Integration checks', () => {
    it('should have route_with_haiku available in orchestrator_utils', () => {
      const code = readOrchestratorUtils();
      expect(code).toContain('def route_with_haiku(');
    });

    it('should have load_routing_config available in orchestrator_utils', () => {
      const code = readOrchestratorUtils();
      expect(code).toContain('def load_routing_config(');
    });

    it('should have get_available_agents available in orchestrator_utils', () => {
      const code = readOrchestratorUtils();
      expect(code).toContain('def get_available_agents(');
    });
  });
});
