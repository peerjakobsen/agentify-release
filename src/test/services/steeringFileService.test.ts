/**
 * Tests for Steering File Service Stub
 * Task Group 2: Stub Steering File Service
 *
 * Tests the SteeringFileService stub that simulates steering file
 * generation with progress events for the Step 8 UI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode module before importing the service
vi.mock('vscode', () => ({
  EventEmitter: class {
    private listeners: ((data: unknown) => void)[] = [];
    event = (listener: (data: unknown) => void) => {
      this.listeners.push(listener);
      return { dispose: () => {} };
    };
    fire = (data: unknown) => {
      this.listeners.forEach((l) => l(data));
    };
    dispose = vi.fn();
  },
  Uri: {
    file: vi.fn().mockReturnValue({ fsPath: '/test/path' }),
    joinPath: vi.fn().mockReturnValue({ fsPath: '/test/path' }),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
  },
}));

// Import after mock
import {
  SteeringFileService,
  getSteeringFileService,
  resetSteeringFileService,
  type FileProgressEvent,
  type FileCompleteEvent,
  type FileErrorEvent,
} from '../../services/steeringFileService';

// ============================================================================
// Task 2.1: 5 Focused Tests for SteeringFileService Stub
// ============================================================================

describe('Task Group 2: SteeringFileService Stub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSteeringFileService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetSteeringFileService();
  });

  // ---------------------------------------------------------------------------
  // Test 1: Service emits 'fileStart' event for each file
  // ---------------------------------------------------------------------------
  describe('Test 1: Service emits fileStart event for each file', () => {
    it('should emit fileStart event with correct fileName and index', async () => {
      const service = new SteeringFileService();
      const fileStartEvents: FileProgressEvent[] = [];

      service.onFileStart((event) => {
        fileStartEvents.push(event);
      });

      // Mock state object
      const mockState = { businessObjective: 'Test' };

      // Use fast delay for tests
      await service.generateSteeringFiles(mockState as any, undefined, 10);

      // Should have 7 fileStart events
      expect(fileStartEvents).toHaveLength(7);
      expect(fileStartEvents[0].fileName).toBe('product.md');
      expect(fileStartEvents[0].index).toBe(0);
      expect(fileStartEvents[0].total).toBe(7);
      expect(fileStartEvents[3].fileName).toBe('customer-context.md');
      expect(fileStartEvents[3].index).toBe(3);
      expect(fileStartEvents[6].fileName).toBe('demo-strategy.md');
      expect(fileStartEvents[6].index).toBe(6);
    });

    it('should emit fileStart events in correct sequence', async () => {
      const service = new SteeringFileService();
      const events: string[] = [];

      service.onFileStart((event) => {
        events.push(`start:${event.fileName}`);
      });
      service.onFileComplete((event) => {
        events.push(`complete:${event.fileName}`);
      });

      await service.generateSteeringFiles({} as any, undefined, 10);

      // Verify start comes before complete for each file
      expect(events[0]).toBe('start:product.md');
      expect(events[1]).toBe('complete:product.md');
      expect(events[2]).toBe('start:tech.md');
      expect(events[3]).toBe('complete:tech.md');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2: Service emits 'fileComplete' event with file path
  // ---------------------------------------------------------------------------
  describe('Test 2: Service emits fileComplete event with file path', () => {
    it('should emit fileComplete event with fileName and filePath', async () => {
      const service = new SteeringFileService();
      const fileCompleteEvents: FileCompleteEvent[] = [];

      service.onFileComplete((event) => {
        fileCompleteEvents.push(event);
      });

      await service.generateSteeringFiles({} as any, undefined, 10);

      expect(fileCompleteEvents).toHaveLength(7);
      expect(fileCompleteEvents[0].fileName).toBe('product.md');
      expect(fileCompleteEvents[0].filePath).toContain('.kiro/steering/product.md');
    });

    it('should generate file paths with .kiro/steering/ prefix', async () => {
      const service = new SteeringFileService();
      const paths: string[] = [];

      service.onFileComplete((event) => {
        paths.push(event.filePath);
      });

      await service.generateSteeringFiles({} as any, undefined, 10);

      paths.forEach((path) => {
        expect(path).toContain('.kiro/steering/');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3: Service emits 'fileError' event on simulated failure
  // ---------------------------------------------------------------------------
  describe('Test 3: Service emits fileError event on simulated failure', () => {
    it('should emit fileError when simulateError option is provided', async () => {
      const service = new SteeringFileService();
      const errorEvents: FileErrorEvent[] = [];

      service.onFileError((event) => {
        errorEvents.push(event);
      });

      // The service has a method to simulate error at specific file index
      const result = await service.generateSteeringFiles({} as any, undefined, 10, 2);

      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].fileName).toBe('structure.md');
      expect(errorEvents[0].error).toContain('Simulated error');
    });

    it('should stop generation after error', async () => {
      const service = new SteeringFileService();
      const completeEvents: FileCompleteEvent[] = [];

      service.onFileComplete((event) => {
        completeEvents.push(event);
      });

      // Simulate error at file index 2
      await service.generateSteeringFiles({} as any, undefined, 10, 2);

      // Only files before the error should complete (indices 0, 1)
      expect(completeEvents).toHaveLength(2);
      expect(completeEvents[0].fileName).toBe('product.md');
      expect(completeEvents[1].fileName).toBe('tech.md');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 4: Service returns generated file paths on completion
  // ---------------------------------------------------------------------------
  describe('Test 4: Service returns generated file paths on completion', () => {
    it('should return files array with all generated file paths', async () => {
      const service = new SteeringFileService();

      const result = await service.generateSteeringFiles({} as any, undefined, 10);

      expect(result.files).toHaveLength(7);
      expect(result.files[0]).toContain('product.md');
      expect(result.files[6]).toContain('demo-strategy.md');
    });

    it('should return placeholder: true flag', async () => {
      const service = new SteeringFileService();

      const result = await service.generateSteeringFiles({} as any, undefined, 10);

      expect(result.placeholder).toBe(true);
    });

    it('should return partial files array when error occurs', async () => {
      const service = new SteeringFileService();

      // Simulate error at index 2
      const result = await service.generateSteeringFiles({} as any, undefined, 10, 2);

      // Should only have files before the error
      expect(result.files).toHaveLength(2);
      expect(result.error).toBeDefined();
      expect(result.error?.fileName).toBe('structure.md');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 5: Service accepts wizard state as input parameter
  // ---------------------------------------------------------------------------
  describe('Test 5: Service accepts wizard state as input parameter', () => {
    it('should accept state parameter and complete successfully', async () => {
      const service = new SteeringFileService();

      // Full mock state object
      const mockState = {
        businessObjective: 'Automate inventory management',
        industry: 'Retail',
        systems: ['SAP S/4HANA'],
        aiGapFillingState: { confirmedAssumptions: [] },
        outcome: { primaryOutcome: 'Reduce manual effort' },
        security: { dataSensitivity: 'internal' },
        agentDesign: { confirmedAgents: [] },
        mockData: { mockDefinitions: [] },
        demoStrategy: { ahaMoments: [] },
      };

      const result = await service.generateSteeringFiles(mockState as any, undefined, 10);

      expect(result.files).toHaveLength(7);
      expect(result.placeholder).toBe(true);
    });

    it('should accept startIndex for retry functionality', async () => {
      const service = new SteeringFileService();
      const fileStartEvents: FileProgressEvent[] = [];

      service.onFileStart((event) => {
        fileStartEvents.push(event);
      });

      // Start from index 3 (skip first 3 files)
      await service.generateSteeringFiles({} as any, 3, 10);

      // Should only start from index 3
      expect(fileStartEvents).toHaveLength(4);
      expect(fileStartEvents[0].fileName).toBe('customer-context.md');
      expect(fileStartEvents[0].index).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Additional Tests for Singleton Pattern and Dispose
  // ---------------------------------------------------------------------------
  describe('Singleton and disposal', () => {
    it('getSteeringFileService should return singleton instance', () => {
      const service1 = getSteeringFileService();
      const service2 = getSteeringFileService();

      expect(service1).toBe(service2);
    });

    it('resetSteeringFileService should dispose and clear instance', () => {
      const service = getSteeringFileService();
      resetSteeringFileService();
      const newService = getSteeringFileService();

      expect(newService).not.toBe(service);
    });

    it('dispose should clean up event emitters', () => {
      const service = new SteeringFileService();
      service.dispose();

      // Should not throw when called after dispose
      expect(() => service.dispose()).not.toThrow();
    });
  });
});
