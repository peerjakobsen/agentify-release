/**
 * Mock Data Import Utilities
 * Task Group 4: CSV/JSON file import for Step 6 Mock Data Strategy
 *
 * Provides utilities for parsing CSV/JSON files and mapping imported
 * fields to the mockResponse schema for sample data import.
 */

// ============================================================================
// Constants
// ============================================================================

/** Maximum file size in bytes (1MB) */
export const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;

/** Maximum number of sample data rows per tool */
export const MAX_SAMPLE_ROWS = 5;

// ============================================================================
// Types
// ============================================================================

/**
 * Result of file import operation
 * Contains parsed rows, mapping info, and operation status
 */
export interface ImportResult {
  /** Whether the import was successful */
  success: boolean;
  /** Parsed and mapped rows (max 5) */
  rows: object[];
  /** Fields that were successfully mapped to schema */
  mappedFields: string[];
  /** Fields from import that did not match schema */
  ignoredFields: string[];
  /** Human-readable summary message */
  summary: string;
  /** Error message if import failed */
  error?: string;
}

/**
 * Result of field mapping operation
 */
export interface MappingResult {
  /** Rows with fields mapped to schema structure */
  rows: object[];
  /** Fields that were successfully mapped */
  mappedFields: string[];
  /** Fields that were not mapped (ignored) */
  ignoredFields: string[];
}

/**
 * Result of file size validation
 */
export interface FileSizeValidationResult {
  /** Whether file size is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
}

// ============================================================================
// Task 4.6: File Size Validation
// ============================================================================

/**
 * Validate file size against 1MB limit
 * @param sizeInBytes - Size of file in bytes
 * @returns Validation result with valid flag and optional error
 */
export function validateFileSize(sizeInBytes: number): FileSizeValidationResult {
  if (sizeInBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'File size exceeds maximum of 1MB',
    };
  }
  return { valid: true };
}

// ============================================================================
// Task 4.3: CSV Parsing
// ============================================================================

/**
 * Parse CSV string to array of objects
 * Uses first row as header for field names
 * Handles quoted values with commas
 * Limits to first 5 rows (max sample data constraint)
 *
 * @param csvContent - CSV file content as string
 * @returns Array of objects with field names from header
 */
export function parseCSV(csvContent: string): object[] {
  if (!csvContent || !csvContent.trim()) {
    return [];
  }

  const lines = csvContent.trim().split(/\r?\n/);

  if (lines.length === 0) {
    return [];
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  if (headers.length === 0) {
    return [];
  }

  // Parse data rows (limit to MAX_SAMPLE_ROWS)
  const result: object[] = [];
  const maxRows = Math.min(lines.length - 1, MAX_SAMPLE_ROWS);

  for (let i = 1; i <= maxRows; i++) {
    if (!lines[i] || !lines[i].trim()) {
      continue;
    }

    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] !== undefined ? values[j] : '';
    }

    result.push(row);
  }

  return result;
}

/**
 * Parse a single CSV line handling quoted values with commas
 * @param line - Single CSV line
 * @returns Array of field values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // End of quoted section
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }

  // Add last field
  result.push(current.trim());

  return result;
}

// ============================================================================
// Task 4.4: JSON Parsing
// ============================================================================

/**
 * Parse JSON string to array of objects
 * Validates array structure and limits to first 5 rows
 *
 * @param jsonContent - JSON file content as string
 * @returns Array of objects
 * @throws Error if JSON is invalid or not an array
 */
export function parseJSON(jsonContent: string): object[] {
  if (!jsonContent || !jsonContent.trim()) {
    return [];
  }

  const parsed = JSON.parse(jsonContent);

  if (!Array.isArray(parsed)) {
    throw new Error('JSON must be an array of objects');
  }

  // Limit to MAX_SAMPLE_ROWS
  return parsed.slice(0, MAX_SAMPLE_ROWS);
}

// ============================================================================
// Task 4.5: Field Auto-Mapping
// ============================================================================

/**
 * Normalize field name for case-insensitive matching
 * Removes underscores and converts to lowercase
 * @param fieldName - Original field name
 * @returns Normalized field name
 */
function normalizeFieldName(fieldName: string): string {
  return fieldName.toLowerCase().replace(/_/g, '');
}

/**
 * Get default value from schema, with deep cloning for arrays/objects
 * Uses the actual schema value as the default for missing fields
 * @param schemaValue - Value from schema to use as default
 * @returns Cloned default value
 */
function getDefaultValue(schemaValue: unknown): unknown {
  // Deep clone arrays and objects to prevent mutations
  if (Array.isArray(schemaValue)) {
    return [...schemaValue];
  }
  if (typeof schemaValue === 'object' && schemaValue !== null) {
    return { ...schemaValue };
  }
  // Primitives can be returned directly (strings, numbers, booleans)
  return schemaValue;
}

/**
 * Map imported fields to mockResponse schema
 * Case-insensitive matching with underscore normalization
 * Uses schema values as defaults for missing required fields
 *
 * @param importedRows - Rows parsed from CSV/JSON
 * @param schema - mockResponse schema object defining expected fields
 * @returns Mapping result with mapped rows and field tracking
 */
export function mapFieldsToSchema(
  importedRows: object[],
  schema: object
): MappingResult {
  const schemaKeys = Object.keys(schema);
  const schemaKeyLookup: Record<string, string> = {};

  // Build lookup table for case-insensitive matching
  for (const key of schemaKeys) {
    schemaKeyLookup[normalizeFieldName(key)] = key;
  }

  const mappedFieldsSet = new Set<string>();
  const ignoredFieldsSet = new Set<string>();
  const mappedRows: object[] = [];

  for (const row of importedRows) {
    const mappedRow: Record<string, unknown> = {};

    // Initialize with default values from schema
    for (const key of schemaKeys) {
      mappedRow[key] = getDefaultValue((schema as Record<string, unknown>)[key]);
    }

    // Map imported fields
    const importedFields = Object.keys(row);
    for (const importedField of importedFields) {
      const normalizedImport = normalizeFieldName(importedField);
      const schemaKey = schemaKeyLookup[normalizedImport];

      if (schemaKey) {
        // Field matches schema - map it
        mappedRow[schemaKey] = (row as Record<string, unknown>)[importedField];
        mappedFieldsSet.add(schemaKey);
      } else {
        // Field does not match - track as ignored
        ignoredFieldsSet.add(importedField);
      }
    }

    mappedRows.push(mappedRow);
  }

  return {
    rows: mappedRows,
    mappedFields: Array.from(mappedFieldsSet),
    ignoredFields: Array.from(ignoredFieldsSet),
  };
}

// ============================================================================
// Task 4.2: Main Import Function
// ============================================================================

/**
 * Parse import file and map to schema
 * Main entry point for file import functionality
 *
 * @param content - File content as string
 * @param fileType - File type ('csv' or 'json')
 * @param schema - mockResponse schema to map fields to
 * @returns ImportResult with parsed rows and operation status
 */
export function parseImportFile(
  content: string,
  fileType: 'csv' | 'json',
  schema: object
): ImportResult {
  try {
    // Parse file based on type
    let parsedRows: object[];

    if (fileType === 'csv') {
      parsedRows = parseCSV(content);
    } else {
      parsedRows = parseJSON(content);
    }

    if (parsedRows.length === 0) {
      return {
        success: true,
        rows: [],
        mappedFields: [],
        ignoredFields: [],
        summary: 'Imported 0 rows. No data found in file.',
      };
    }

    // Map fields to schema
    const mappingResult = mapFieldsToSchema(parsedRows, schema);

    // Build summary message
    const summary = buildImportSummary(
      mappingResult.rows.length,
      mappingResult.mappedFields,
      mappingResult.ignoredFields
    );

    return {
      success: true,
      rows: mappingResult.rows,
      mappedFields: mappingResult.mappedFields,
      ignoredFields: mappingResult.ignoredFields,
      summary,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
    return {
      success: false,
      rows: [],
      mappedFields: [],
      ignoredFields: [],
      summary: '',
      error: errorMessage,
    };
  }
}

/**
 * Build human-readable import summary
 * Format: "Imported X rows. Mapped: field1, field2. Ignored: field3"
 *
 * @param rowCount - Number of rows imported
 * @param mappedFields - Fields that were mapped
 * @param ignoredFields - Fields that were ignored
 * @returns Summary string
 */
function buildImportSummary(
  rowCount: number,
  mappedFields: string[],
  ignoredFields: string[]
): string {
  const parts: string[] = [`Imported ${rowCount} rows.`];

  if (mappedFields.length > 0) {
    parts.push(`Mapped: ${mappedFields.join(', ')}.`);
  }

  if (ignoredFields.length > 0) {
    parts.push(`Ignored: ${ignoredFields.join(', ')}.`);
  }

  return parts.join(' ');
}

// ============================================================================
// Task 4.6: File Import Handler for Logic Handler
// ============================================================================

/**
 * Process imported file for sample data
 * To be called from ideationStep6Logic.ts handleImportSampleData method
 *
 * @param fileContent - Raw file content as string
 * @param fileName - Original file name (used to detect file type)
 * @param fileSizeBytes - File size in bytes for validation
 * @param mockResponseSchema - Schema to map fields to
 * @returns ImportResult with processed data
 */
export function processImportedFile(
  fileContent: string,
  fileName: string,
  fileSizeBytes: number,
  mockResponseSchema: object
): ImportResult {
  // Validate file size
  const sizeValidation = validateFileSize(fileSizeBytes);
  if (!sizeValidation.valid) {
    return {
      success: false,
      rows: [],
      mappedFields: [],
      ignoredFields: [],
      summary: '',
      error: sizeValidation.error,
    };
  }

  // Determine file type from extension
  const lowerFileName = fileName.toLowerCase();
  let fileType: 'csv' | 'json';

  if (lowerFileName.endsWith('.csv')) {
    fileType = 'csv';
  } else if (lowerFileName.endsWith('.json')) {
    fileType = 'json';
  } else {
    return {
      success: false,
      rows: [],
      mappedFields: [],
      ignoredFields: [],
      summary: '',
      error: 'Unsupported file format. Please use CSV or JSON files.',
    };
  }

  // Parse and map
  return parseImportFile(fileContent, fileType, mockResponseSchema);
}
