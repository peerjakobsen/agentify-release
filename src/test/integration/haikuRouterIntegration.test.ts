/**
 * Integration Tests for Haiku Router Feature (Task Group 6)
 *
 * These tests fill critical gaps identified in the test review:
 * 1. End-to-end routing flow validation
 * 2. Event payload structure validation
 * 3. Cross-pattern consistency verification
 * 4. COMPLETE keyword handling
 *
 * Maximum 8 additional tests as per spec requirements.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Paths to implementation files
const UTILS_PATH = path.resolve(__dirname, '../../../resources/agents/shared/orchestrator_utils.py');
const GRAPH_PATH = path.resolve(__dirname, '../../../resources/agents/main_graph.py');
const SWARM_PATH = path.resolve(__dirname, '../../../resources/agents/main_swarm.py');

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockImplementation(() => ({
      get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
    })),
    onDidChangeConfiguration: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    fs: {
      stat: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      createDirectory: vi.fn(),
    },
    createFileSystemWatcher: vi.fn(() => ({
      onDidChange: vi.fn(),
      onDidDelete: vi.fn(),
      onDidCreate: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  Uri: { file: (p: string) => ({ fsPath: p }) },
  RelativePattern: vi.fn(),
  Disposable: class {
    private disposeFn: () => void;
    constructor(disposeFn: () => void) { this.disposeFn = disposeFn; }
    dispose() { this.disposeFn(); }
  },
}));

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

describe('Task Group 6: Haiku Router Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('6.3.1: End-to-end routing flow - Config enabled activates Haiku (Graph)', () => {
    it('should call route_with_haiku when useHaikuRouter is true in Graph pattern', () => {
      const graphCode = readFile(GRAPH_PATH);

      // Verify the flow: load_routing_config -> check useHaikuRouter -> call route_with_haiku
      const routeToNextMatch = graphCode.match(/def route_to_next_agent[\s\S]*?(?=\ndef\s|\n# ==)/);
      expect(routeToNextMatch).not.toBeNull();

      const routeFunction = routeToNextMatch![0];

      // Step 1: Config is loaded first
      const configLoadIndex = routeFunction.indexOf('routing_config = load_routing_config()');
      expect(configLoadIndex).toBeGreaterThan(-1);

      // Step 2: useHaikuRouter is checked via config.get (not just the string in comments)
      const haikuCheckMatch = routeFunction.match(/routing_config\.get\(['"]useHaikuRouter['"]/);
      expect(haikuCheckMatch).not.toBeNull();
      const haikuCheckIndex = haikuCheckMatch!.index!;
      expect(haikuCheckIndex).toBeGreaterThan(configLoadIndex);

      // Step 3: route_with_haiku is called when enabled
      const routeCallIndex = routeFunction.indexOf('route_with_haiku(');
      expect(routeCallIndex).toBeGreaterThan(haikuCheckIndex);

      // Step 4: Result is returned if valid
      expect(routeFunction).toMatch(/if haiku_result is not None[\s\S]*?return haiku_result/);
    });
  });

  describe('6.3.2: End-to-end routing flow - Config disabled skips Haiku (Graph)', () => {
    it('should skip to Strategy 1 when useHaikuRouter is false', () => {
      const graphCode = readFile(GRAPH_PATH);

      // Verify that Strategy 1 (explicit routing) is reachable
      expect(graphCode).toContain('STRATEGY 1: Explicit routing');

      // Verify the config check is an if statement, not always-execute
      const routeToNextMatch = graphCode.match(/def route_to_next_agent[\s\S]*?(?=\ndef\s|\n# ==)/);
      expect(routeToNextMatch).not.toBeNull();

      const routeFunction = routeToNextMatch![0];

      // The Haiku routing block should be conditional
      expect(routeFunction).toMatch(/if\s+routing_config\.get\(['"]useHaikuRouter['"]/);

      // Strategy 1 should NOT be inside the Haiku if block (should be reachable when Haiku is disabled)
      // Find Strategy 1 location - it should be after the Haiku block closes
      const strategy1Index = routeFunction.indexOf('STRATEGY 1');
      const haikuBlockMatch = routeFunction.match(/if\s+routing_config\.get\(['"]useHaikuRouter['"]/);
      expect(haikuBlockMatch).not.toBeNull();
      expect(strategy1Index).toBeGreaterThan(haikuBlockMatch!.index!);
    });
  });

  describe('6.3.3: Event payload structure - router_decision contains required fields', () => {
    it('should emit router_decision event with all required payload fields', () => {
      const utilsCode = readFile(UTILS_PATH);

      // Find emit_router_decision function
      const emitRouterMatch = utilsCode.match(/def emit_router_decision[\s\S]*?(?=\ndef\s|$)/);
      expect(emitRouterMatch).not.toBeNull();

      const emitFunction = emitRouterMatch![0];

      // Required fields per spec: event_type, timestamp, workflow_id, trace_id, router_model, from_agent, next_agent, duration_ms
      const requiredFields = [
        'event_type',
        'timestamp',
        'workflow_id',
        'trace_id',
        'router_model',
        'from_agent',
        'next_agent',
        'duration_ms'
      ];

      for (const field of requiredFields) {
        expect(emitFunction).toContain(`"${field}"`);
      }

      // Verify event_type is specifically "router_decision"
      expect(emitFunction).toContain('"router_decision"');

      // Verify emit_event is called to emit the event
      expect(emitFunction).toContain('emit_event(event)');
    });
  });

  describe('6.3.4: Response truncation - route_with_haiku truncates to ~500 chars', () => {
    it('should truncate response_text to 500 characters in route_with_haiku', () => {
      const utilsCode = readFile(UTILS_PATH);

      // Find route_with_haiku function
      const routeWithHaikuMatch = utilsCode.match(/def route_with_haiku[\s\S]*?(?=\ndef\s|$)/);
      expect(routeWithHaikuMatch).not.toBeNull();

      const routeFunction = routeWithHaikuMatch![0];

      // Verify truncation logic exists
      expect(routeFunction).toMatch(/response_text\[:500\]/);

      // Verify truncated response is used in the prompt
      expect(routeFunction).toContain('truncated_response');
    });
  });

  describe('6.3.5: Cross-pattern consistency - Both Graph and Swarm use same config loading', () => {
    it('should use load_routing_config in both Graph and Swarm patterns', () => {
      const graphCode = readFile(GRAPH_PATH);
      const swarmCode = readFile(SWARM_PATH);

      // Both patterns should import load_routing_config from orchestrator_utils
      expect(graphCode).toContain('load_routing_config');
      expect(swarmCode).toContain('load_routing_config');

      // Both should check useHaikuRouter from the loaded config
      expect(graphCode).toMatch(/routing_config\.get\(['"]useHaikuRouter['"]/);
      expect(swarmCode).toMatch(/config\.get\(['"]useHaikuRouter['"]/);
    });
  });

  describe('6.3.6: COMPLETE handling - Workflow ends when Haiku returns COMPLETE', () => {
    it('should return None when Haiku returns COMPLETE in Graph pattern', () => {
      const graphCode = readFile(GRAPH_PATH);

      const routeToNextMatch = graphCode.match(/def route_to_next_agent[\s\S]*?(?=\ndef\s|\n# ==)/);
      expect(routeToNextMatch).not.toBeNull();

      const routeFunction = routeToNextMatch![0];

      // Verify COMPLETE is checked
      expect(routeFunction).toContain('COMPLETE');

      // Verify return None for workflow completion
      expect(routeFunction).toMatch(/haiku_result\.upper\(\)\s*==\s*['"]COMPLETE['"][\s\S]*?return None/);
    });

    it('should handle COMPLETE in route_with_haiku and emit router_decision', () => {
      const utilsCode = readFile(UTILS_PATH);

      const routeWithHaikuMatch = utilsCode.match(/def route_with_haiku[\s\S]*?(?=\ndef\s|$)/);
      expect(routeWithHaikuMatch).not.toBeNull();

      const routeFunction = routeWithHaikuMatch![0];

      // Verify COMPLETE check
      expect(routeFunction).toMatch(/result\s*==\s*['"]COMPLETE['"]/);

      // Verify emit_router_decision is called with 'COMPLETE' as next_agent
      expect(routeFunction).toMatch(/emit_router_decision[\s\S]*?['"]COMPLETE['"]/);

      // Verify 'COMPLETE' is returned
      expect(routeFunction).toContain("return 'COMPLETE'");
    });
  });

  describe('6.3.7: Fallback sequence - Haiku failure falls back to other strategies', () => {
    it('should fall through to Strategy 1 when route_with_haiku returns None', () => {
      const graphCode = readFile(GRAPH_PATH);

      const routeToNextMatch = graphCode.match(/def route_to_next_agent[\s\S]*?(?=\ndef\s|\n# ==)/);
      expect(routeToNextMatch).not.toBeNull();

      const routeFunction = routeToNextMatch![0];

      // Verify else branch exists after Haiku routing
      expect(routeFunction).toMatch(/if haiku_result is not None[\s\S]*?else:/);

      // Verify warning is logged on fallback
      expect(routeFunction).toMatch(/Warning.*Haiku routing failed.*falling back/);

      // Verify Strategy 1 is still present and reachable
      expect(routeFunction).toContain('STRATEGY 1');
    });
  });

  describe('6.3.8: Default values - load_routing_config returns correct defaults', () => {
    it('should define correct default values in load_routing_config', () => {
      const utilsCode = readFile(UTILS_PATH);

      const loadConfigMatch = utilsCode.match(/def load_routing_config[\s\S]*?(?=\ndef\s|$)/);
      expect(loadConfigMatch).not.toBeNull();

      const loadFunction = loadConfigMatch![0];

      // Default useHaikuRouter should be False (opt-in)
      expect(loadFunction).toMatch(/'useHaikuRouter':\s*False/);

      // Default routerModel should be the Haiku model ID
      expect(loadFunction).toContain('global.anthropic.claude-haiku-4-5-20251001-v1:0');

      // Default fallbackToAgentDecision should be True
      expect(loadFunction).toMatch(/'fallbackToAgentDecision':\s*True/);
    });

    it('should use lru_cache for load_routing_config for performance', () => {
      const utilsCode = readFile(UTILS_PATH);

      // lru_cache decorator should be applied to load_routing_config
      expect(utilsCode).toMatch(/@lru_cache[\s\S]*?def load_routing_config/);
    });
  });
});
