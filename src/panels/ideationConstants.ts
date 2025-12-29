/**
 * Ideation Wizard Constants
 * Constants used across ideation wizard panel components
 */

/**
 * Wizard step configuration
 */
export const WIZARD_STEPS = [
  { step: 1, label: 'Business Context' },
  { step: 2, label: 'AI Gap Filling' },
  { step: 3, label: 'Outcomes' },
  { step: 4, label: 'Security' },
  { step: 5, label: 'Agent Design' },
  { step: 6, label: 'Mock Data' },
  { step: 7, label: 'Demo Strategy' },
  { step: 8, label: 'Generate' },
];

/**
 * Data sensitivity options with descriptions
 */
export const DATA_SENSITIVITY_OPTIONS = [
  { value: 'Public', label: 'Public', helperText: 'Data that can be shown to anyone. Example: product catalog, public pricing' },
  { value: 'Internal', label: 'Internal', helperText: 'Business data not for external sharing. Example: sales forecasts, inventory levels' },
  { value: 'Confidential', label: 'Confidential', helperText: 'Sensitive business data. Example: customer lists, financial reports' },
  { value: 'Restricted', label: 'Restricted', helperText: 'Highly sensitive, regulatory implications. Example: PII, health records, payment data' },
];

/**
 * Compliance framework options
 */
export const COMPLIANCE_FRAMEWORK_OPTIONS = ['SOC 2', 'HIPAA', 'PCI-DSS', 'GDPR', 'FedRAMP', 'None/Not specified'];

/**
 * Human approval gate options
 */
export const APPROVAL_GATE_OPTIONS = [
  'Before external API calls',
  'Before data modification',
  'Before sending recommendations',
  'Before financial transactions',
];

/**
 * Industry to compliance mapping
 */
export const INDUSTRY_COMPLIANCE_MAPPING: Record<string, string[]> = {
  'Healthcare': ['HIPAA'],
  'Life Sciences': ['HIPAA'],
  'FSI': ['PCI-DSS', 'SOC 2'],
  'Retail': ['PCI-DSS'],
  'Public Sector': ['FedRAMP'],
  'Energy': ['SOC 2'],
  'Telecom': ['SOC 2'],
  'Manufacturing': [],
  'Media & Entertainment': [],
  'Travel & Hospitality': ['PCI-DSS'],
  'Other': [],
};

/**
 * Industry vertical options
 */
export const INDUSTRY_OPTIONS = [
  'Retail',
  'FSI',
  'Healthcare',
  'Life Sciences',
  'Manufacturing',
  'Energy',
  'Telecom',
  'Public Sector',
  'Media & Entertainment',
  'Travel & Hospitality',
  'Other',
];

/**
 * System options grouped by category
 */
export const SYSTEM_OPTIONS: Record<string, string[]> = {
  CRM: ['Salesforce', 'HubSpot', 'Dynamics'],
  ERP: ['SAP S/4HANA', 'Oracle', 'NetSuite'],
  Data: ['Databricks', 'Snowflake', 'Redshift'],
  HR: ['Workday', 'SuccessFactors'],
  Service: ['ServiceNow', 'Zendesk'],
};

/**
 * Stakeholder options for outcome definition
 */
export const STAKEHOLDER_OPTIONS = [
  'Operations',
  'Finance',
  'Supply Chain',
  'Customer Service',
  'Executive',
  'IT',
  'Sales',
  'Marketing',
  'HR',
  'Legal',
];
