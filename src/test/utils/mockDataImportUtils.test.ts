/**
 * Tests for Step 6 Mock Data Strategy - File Import Utilities
 * Task Group 4: CSV/JSON file import for sample data
 */

import { describe, it, expect } from 'vitest';
import {
  parseImportFile,
  mapFieldsToSchema,
  parseCSV,
  parseJSON,
  validateFileSize,
  type ImportResult,
} from '../../utils/mockDataImportUtils';

// ============================================================================
// Task 4.1: 4 Focused Tests for File Import
// ============================================================================

describe('Task Group 4: Step 6 Mock Data - File Import Utilities', () => {
  describe('Test 1: CSV parsing extracts rows correctly', () => {
    it('should parse CSV string with headers into array of objects', () => {
      const csvContent = `sku,quantity,unit
ABC-001,100,pcs
ABC-002,200,pcs
DEF-001,50,kg`;

      const result = parseCSV(csvContent);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ sku: 'ABC-001', quantity: '100', unit: 'pcs' });
      expect(result[1]).toEqual({ sku: 'ABC-002', quantity: '200', unit: 'pcs' });
      expect(result[2]).toEqual({ sku: 'DEF-001', quantity: '50', unit: 'kg' });
    });

    it('should handle quoted values with commas', () => {
      const csvContent = `name,description,price
"Widget A","A simple, basic widget",10.99
"Widget B","Another widget, with more features",25.50`;

      const result = parseCSV(csvContent);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'Widget A',
        description: 'A simple, basic widget',
        price: '10.99',
      });
      expect(result[1]).toEqual({
        name: 'Widget B',
        description: 'Another widget, with more features',
        price: '25.50',
      });
    });

    it('should limit to first 5 rows for sample data constraint', () => {
      const csvContent = `id,value
1,a
2,b
3,c
4,d
5,e
6,f
7,g`;

      const result = parseCSV(csvContent);

      expect(result).toHaveLength(5);
      expect(result[4]).toEqual({ id: '5', value: 'e' });
    });

    it('should handle empty CSV gracefully', () => {
      const csvContent = '';
      const result = parseCSV(csvContent);
      expect(result).toHaveLength(0);
    });

    it('should handle CSV with only headers', () => {
      const csvContent = 'name,value,unit';
      const result = parseCSV(csvContent);
      expect(result).toHaveLength(0);
    });
  });

  describe('Test 2: JSON array parsing extracts rows correctly', () => {
    it('should parse JSON array of objects', () => {
      const jsonContent = `[
        {"sku": "ABC-001", "quantity": 100, "unit": "pcs"},
        {"sku": "ABC-002", "quantity": 200, "unit": "pcs"},
        {"sku": "DEF-001", "quantity": 50, "unit": "kg"}
      ]`;

      const result = parseJSON(jsonContent);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ sku: 'ABC-001', quantity: 100, unit: 'pcs' });
      expect(result[1]).toEqual({ sku: 'ABC-002', quantity: 200, unit: 'pcs' });
      expect(result[2]).toEqual({ sku: 'DEF-001', quantity: 50, unit: 'kg' });
    });

    it('should limit to first 5 rows for sample data constraint', () => {
      const jsonContent = JSON.stringify([
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 },
        { id: 5 },
        { id: 6 },
        { id: 7 },
      ]);

      const result = parseJSON(jsonContent);

      expect(result).toHaveLength(5);
      expect(result[4]).toEqual({ id: 5 });
    });

    it('should throw error for invalid JSON', () => {
      const invalidJson = 'not valid json';
      expect(() => parseJSON(invalidJson)).toThrow();
    });

    it('should throw error for non-array JSON', () => {
      const objectJson = '{"key": "value"}';
      expect(() => parseJSON(objectJson)).toThrow('JSON must be an array');
    });

    it('should handle empty JSON array', () => {
      const emptyArray = '[]';
      const result = parseJSON(emptyArray);
      expect(result).toHaveLength(0);
    });
  });

  describe('Test 3: Field auto-mapping (case-insensitive)', () => {
    it('should map import fields to schema keys case-insensitively', () => {
      const importedRows = [
        { SKU: 'ABC-001', QUANTITY: 100, Unit: 'pcs' },
        { SKU: 'DEF-002', QUANTITY: 200, Unit: 'kg' },
      ];

      const schema = {
        sku: '',
        quantity: 0,
        unit: '',
      };

      const result = mapFieldsToSchema(importedRows, schema);

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({ sku: 'ABC-001', quantity: 100, unit: 'pcs' });
      expect(result.rows[1]).toEqual({ sku: 'DEF-002', quantity: 200, unit: 'kg' });
      expect(result.mappedFields).toContain('sku');
      expect(result.mappedFields).toContain('quantity');
      expect(result.mappedFields).toContain('unit');
      expect(result.ignoredFields).toHaveLength(0);
    });

    it('should track ignored fields that do not match schema', () => {
      const importedRows = [
        { sku: 'ABC-001', quantity: 100, extra_field: 'ignored' },
      ];

      const schema = {
        sku: '',
        quantity: 0,
        unit: '',
      };

      const result = mapFieldsToSchema(importedRows, schema);

      expect(result.mappedFields).toContain('sku');
      expect(result.mappedFields).toContain('quantity');
      expect(result.ignoredFields).toContain('extra_field');
      expect(result.rows[0]).not.toHaveProperty('extra_field');
    });

    it('should use placeholder values for missing required fields', () => {
      const importedRows = [
        { sku: 'ABC-001' },
      ];

      const schema = {
        sku: '',
        quantity: 0,
        unit: '',
      };

      const result = mapFieldsToSchema(importedRows, schema);

      expect(result.rows[0]).toEqual({
        sku: 'ABC-001',
        quantity: 0,
        unit: '',
      });
    });

    it('should handle nested schema fields', () => {
      const importedRows = [
        { account_name: 'Acme Corp', contact_email: 'test@acme.com' },
      ];

      const schema = {
        accountName: '',
        contactEmail: '',
        status: 'active',
      };

      // Case-insensitive matching with underscore variations
      const result = mapFieldsToSchema(importedRows, schema);

      // account_name should match accountName (case-insensitive, underscore removed)
      expect(result.rows[0].accountName).toBe('Acme Corp');
      expect(result.rows[0].contactEmail).toBe('test@acme.com');
      expect(result.rows[0].status).toBe('active');
    });
  });

  describe('Test 4: File size validation (max 1MB)', () => {
    const MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

    it('should accept files under 1MB', () => {
      const smallContent = 'x'.repeat(1000); // 1KB
      const result = validateFileSize(smallContent.length);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept files exactly 1MB', () => {
      const result = validateFileSize(MAX_SIZE_BYTES);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject files over 1MB', () => {
      const result = validateFileSize(MAX_SIZE_BYTES + 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('1MB');
    });

    it('should return appropriate error message for large files', () => {
      const twoMegabytes = 2 * 1024 * 1024;
      const result = validateFileSize(twoMegabytes);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File size exceeds maximum of 1MB');
    });
  });

  describe('Integration: parseImportFile function', () => {
    it('should parse CSV file and return ImportResult', () => {
      const csvContent = `name,value
Test1,100
Test2,200`;

      const schema = { name: '', value: 0 };
      const result = parseImportFile(csvContent, 'csv', schema);

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(2);
      expect(result.mappedFields).toContain('name');
      expect(result.mappedFields).toContain('value');
      expect(result.summary).toContain('Imported 2 rows');
    });

    it('should parse JSON file and return ImportResult', () => {
      const jsonContent = JSON.stringify([
        { name: 'Test1', value: 100 },
        { name: 'Test2', value: 200 },
      ]);

      const schema = { name: '', value: 0 };
      const result = parseImportFile(jsonContent, 'json', schema);

      expect(result.success).toBe(true);
      expect(result.rows).toHaveLength(2);
      expect(result.mappedFields).toContain('name');
      expect(result.mappedFields).toContain('value');
    });

    it('should return error for invalid JSON', () => {
      const invalidJson = 'not valid json';
      const schema = { name: '', value: 0 };
      const result = parseImportFile(invalidJson, 'json', schema);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.rows).toHaveLength(0);
    });

    it('should generate import summary with mapped and ignored fields', () => {
      const csvContent = `sku,quantity,extra
ABC,100,ignored`;

      const schema = { sku: '', quantity: 0 };
      const result = parseImportFile(csvContent, 'csv', schema);

      expect(result.summary).toContain('Imported 1 rows');
      expect(result.summary).toContain('Mapped: sku, quantity');
      expect(result.summary).toContain('Ignored: extra');
    });
  });
});
