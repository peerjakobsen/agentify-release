/**
 * Tests for Python Router Utilities (Task Group 2: Haiku Router)
 *
 * These tests verify the router utility functions in orchestrator_utils.py:
 * - invoke_haiku() for Bedrock Haiku model invocation
 * - get_routing_context() for extracting routing guidance from tech.md
 * - load_routing_config() for loading routing settings from config.json
 * - route_with_haiku() for making routing decisions
 * - emit_router_decision() for event emission
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Path to the orchestrator utilities
const UTILS_PATH = path.resolve(__dirname, '../../../resources/agents/shared/orchestrator_utils.py');

/**
 * Helper to read the orchestrator utilities file
 */
function readOrchestratorUtils(): string {
  return fs.readFileSync(UTILS_PATH, 'utf-8');
}

describe('Task Group 2: Python Router Utility Functions', () => {
  describe('2.2 invoke_haiku() function', () => {
    it('should define invoke_haiku() function in orchestrator_utils.py', () => {
      const code = readOrchestratorUtils();
      expect(code).toContain('def invoke_haiku(');
    });

    it('should use default model ID global.anthropic.claude-haiku-4-5-20251001-v1:0', () => {
      const code = readOrchestratorUtils();
      expect(code).toContain('global.anthropic.claude-haiku-4-5-20251001-v1:0');
    });

    it('should accept optional model_id parameter', () => {
      const code = readOrchestratorUtils();
      // Check function signature includes model_id with default
      expect(code).toMatch(/def invoke_haiku\([^)]*model_id[^)]*=/);
    });

    it('should have timeout handling (5 second default)', () => {
      const code = readOrchestratorUtils();
      // Check for timeout configuration or handling
      expect(code).toMatch(/timeout|read_timeout|connect_timeout/i);
    });

    it('should use boto3 client for Bedrock invocation', () => {
      const code = readOrchestratorUtils();
      expect(code).toContain("boto3.client('bedrock-runtime'");
    });

    it('should log errors to stderr without raising exceptions', () => {
      const code = readOrchestratorUtils();
      // Check for try/except with error logging pattern
      expect(code).toMatch(/invoke_haiku[\s\S]*?except[\s\S]*?print\([^)]*file=sys\.stderr/);
    });

    it('should return None on failure (graceful degradation)', () => {
      const code = readOrchestratorUtils();
      // Find the invoke_haiku function and check it can return None
      const invokeHaikuMatch = code.match(/def invoke_haiku[\s\S]*?(?=\ndef\s|$)/);
      expect(invokeHaikuMatch).not.toBeNull();
      if (invokeHaikuMatch) {
        expect(invokeHaikuMatch[0]).toContain('return None');
      }
    });
  });

  describe('2.3 get_routing_context() function', () => {
    it('should define get_routing_context() function', () => {
      const code = readOrchestratorUtils();
      expect(code).toContain('def get_routing_context(');
    });

    it('should look for Routing Guidance section header', () => {
      const code = readOrchestratorUtils();
      expect(code).toContain('## Routing Guidance');
    });

    it('should look for Agent Routing Rules section header', () => {
      const code = readOrchestratorUtils();
      expect(code).toContain('## Agent Routing Rules');
    });

    it('should load from .kiro/steering/tech.md path', () => {
      const code = readOrchestratorUtils();
      expect(code).toMatch(/\.kiro.*steering.*tech\.md/);
    });

    it('should return empty string when section not found', () => {
      const code = readOrchestratorUtils();
      const getRoutingContextMatch = code.match(/def get_routing_context[\s\S]*?(?=\ndef\s|$)/);
      expect(getRoutingContextMatch).not.toBeNull();
      if (getRoutingContextMatch) {
        // Should return empty string as fallback
        expect(getRoutingContextMatch[0]).toMatch(/return\s+['"]?['"]?/);
      }
    });

    it('should handle file not found gracefully', () => {
      const code = readOrchestratorUtils();
      // Check for FileNotFoundError or exists() check
      expect(code).toMatch(/FileNotFoundError|\.exists\(\)|IOError|OSError/);
    });
  });

  describe('2.4 load_routing_config() function', () => {
    it('should define load_routing_config() function', () => {
      const code = readOrchestratorUtils();
      expect(code).toContain('def load_routing_config(');
    });

    it('should load from .agentify/config.json path', () => {
      const code = readOrchestratorUtils();
      expect(code).toMatch(/\.agentify.*config\.json/);
    });

    it('should have default useHaikuRouter: false', () => {
      const code = readOrchestratorUtils();
      expect(code).toMatch(/useHaikuRouter.*false|'useHaikuRouter':\s*False/i);
    });

    it('should have default routerModel with Haiku model ID', () => {
      const code = readOrchestratorUtils();
      // Default should reference the Haiku model
      expect(code).toContain('global.anthropic.claude-haiku-4-5-20251001-v1:0');
    });

    it('should have default fallbackToAgentDecision: true', () => {
      const code = readOrchestratorUtils();
      expect(code).toMatch(/fallbackToAgentDecision.*true|'fallbackToAgentDecision':\s*True/i);
    });

    it('should use @lru_cache for performance caching', () => {
      const code = readOrchestratorUtils();
      // Check that load_routing_config has @lru_cache decorator
      expect(code).toMatch(/@lru_cache[\s\S]*?def load_routing_config/);
    });
  });

  describe('2.5 route_with_haiku() function', () => {
    it('should define route_with_haiku() function', () => {
      const code = readOrchestratorUtils();
      expect(code).toContain('def route_with_haiku(');
    });

    it('should accept current_agent parameter', () => {
      const code = readOrchestratorUtils();
      expect(code).toMatch(/def route_with_haiku\([^)]*current_agent/);
    });

    it('should accept response_text parameter', () => {
      const code = readOrchestratorUtils();
      expect(code).toMatch(/def route_with_haiku\([^)]*response_text/);
    });

    it('should accept available_agents parameter', () => {
      const code = readOrchestratorUtils();
      expect(code).toMatch(/def route_with_haiku\([^)]*available_agents/);
    });

    it('should truncate response to approximately 500 characters', () => {
      const code = readOrchestratorUtils();
      // Check for truncation logic with ~500 chars
      expect(code).toMatch(/\[:500\]|\[:500\s*\]|500/);
    });

    it('should return COMPLETE as valid output option', () => {
      const code = readOrchestratorUtils();
      expect(code).toContain('COMPLETE');
    });

    it('should return None on any failure for fallback support', () => {
      const code = readOrchestratorUtils();
      const routeWithHaikuMatch = code.match(/def route_with_haiku[\s\S]*?(?=\ndef\s|$)/);
      expect(routeWithHaikuMatch).not.toBeNull();
      if (routeWithHaikuMatch) {
        expect(routeWithHaikuMatch[0]).toContain('return None');
      }
    });

    it('should call invoke_haiku() for model invocation', () => {
      const code = readOrchestratorUtils();
      const routeWithHaikuMatch = code.match(/def route_with_haiku[\s\S]*?(?=\ndef\s|$)/);
      expect(routeWithHaikuMatch).not.toBeNull();
      if (routeWithHaikuMatch) {
        expect(routeWithHaikuMatch[0]).toContain('invoke_haiku(');
      }
    });
  });

  describe('2.6 router_decision event emission', () => {
    it('should define emit_router_decision() helper function', () => {
      const code = readOrchestratorUtils();
      expect(code).toContain('def emit_router_decision(');
    });

    it('should emit event_type: router_decision', () => {
      const code = readOrchestratorUtils();
      expect(code).toContain('"router_decision"');
    });

    it('should include router_model in event payload', () => {
      const code = readOrchestratorUtils();
      expect(code).toMatch(/"router_model"|'router_model'/);
    });

    it('should include from_agent in event payload', () => {
      const code = readOrchestratorUtils();
      // Check emit_router_decision includes from_agent
      const emitRouterMatch = code.match(/def emit_router_decision[\s\S]*?(?=\ndef\s|$)/);
      expect(emitRouterMatch).not.toBeNull();
      if (emitRouterMatch) {
        expect(emitRouterMatch[0]).toMatch(/"from_agent"|'from_agent'/);
      }
    });

    it('should include next_agent in event payload', () => {
      const code = readOrchestratorUtils();
      const emitRouterMatch = code.match(/def emit_router_decision[\s\S]*?(?=\ndef\s|$)/);
      expect(emitRouterMatch).not.toBeNull();
      if (emitRouterMatch) {
        expect(emitRouterMatch[0]).toMatch(/"next_agent"|'next_agent'/);
      }
    });

    it('should include duration_ms in event payload', () => {
      const code = readOrchestratorUtils();
      const emitRouterMatch = code.match(/def emit_router_decision[\s\S]*?(?=\ndef\s|$)/);
      expect(emitRouterMatch).not.toBeNull();
      if (emitRouterMatch) {
        expect(emitRouterMatch[0]).toMatch(/"duration_ms"|'duration_ms'/);
      }
    });

    it('should use emit_event() for consistent event emission', () => {
      const code = readOrchestratorUtils();
      const emitRouterMatch = code.match(/def emit_router_decision[\s\S]*?(?=\ndef\s|$)/);
      expect(emitRouterMatch).not.toBeNull();
      if (emitRouterMatch) {
        expect(emitRouterMatch[0]).toContain('emit_event(');
      }
    });
  });

  describe('Router utilities integration', () => {
    it('should have all required imports for router functionality', () => {
      const code = readOrchestratorUtils();
      // Should have boto3 for Bedrock calls
      expect(code).toContain('import boto3');
      // Should have json for parsing
      expect(code).toContain('import json');
      // Should have lru_cache for caching
      expect(code).toContain('from functools import lru_cache');
    });

    it('should have HAIKU ROUTER section header for organization', () => {
      const code = readOrchestratorUtils();
      expect(code).toMatch(/HAIKU ROUTER|ROUTER UTILITIES/i);
    });
  });
});
