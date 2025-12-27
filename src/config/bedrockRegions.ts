/**
 * Bedrock supported regions constant module
 * Maintains the list of AWS regions where Amazon Bedrock is available
 */

/**
 * List of AWS regions that support Amazon Bedrock
 * Keep this list updated as AWS adds support for new regions
 * @see https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-regions.html
 */
export const BEDROCK_SUPPORTED_REGIONS = [
  'us-east-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-central-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-south-1',
  'ca-central-1',
  'sa-east-1',
] as const;

/**
 * Type representing a valid Bedrock-supported region
 */
export type BedrockRegion = (typeof BEDROCK_SUPPORTED_REGIONS)[number];

/**
 * Human-readable descriptions for each Bedrock-supported region
 * Used in UI elements like dropdowns and tooltips
 */
export const BEDROCK_REGION_DESCRIPTIONS: Record<BedrockRegion, string> = {
  'us-east-1': 'US East (N. Virginia)',
  'us-west-2': 'US West (Oregon)',
  'eu-west-1': 'Europe (Ireland)',
  'eu-west-2': 'Europe (London)',
  'eu-central-1': 'Europe (Frankfurt)',
  'ap-southeast-1': 'Asia Pacific (Singapore)',
  'ap-southeast-2': 'Asia Pacific (Sydney)',
  'ap-northeast-1': 'Asia Pacific (Tokyo)',
  'ap-south-1': 'Asia Pacific (Mumbai)',
  'ca-central-1': 'Canada (Central)',
  'sa-east-1': 'South America (Sao Paulo)',
};

/**
 * Check if a region string is a Bedrock-supported region
 * @param region The region string to check
 * @returns True if the region supports Amazon Bedrock
 */
export function isBedrockSupportedRegion(region: string): region is BedrockRegion {
  return BEDROCK_SUPPORTED_REGIONS.includes(region as BedrockRegion);
}
