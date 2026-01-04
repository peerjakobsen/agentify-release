#!/usr/bin/env python3
"""
Extract Cedar statement from AgentCore policy generation assets.
Usage: python extract_cedar.py <policy_engine_id> <generation_id> <region> <output_file>
"""
import subprocess
import json
import sys
import re

def main():
    if len(sys.argv) != 5:
        print("Usage: extract_cedar.py <policy_engine_id> <generation_id> <region> <output_file>", file=sys.stderr)
        sys.exit(1)

    policy_engine_id = sys.argv[1]
    generation_id = sys.argv[2]
    region = sys.argv[3]
    output_file = sys.argv[4]

    # Run the agentcore command
    cmd = [
        'uv', 'run', 'agentcore', 'policy', 'list-policy-generation-assets',
        '--policy-engine-id', policy_engine_id,
        '--generation-id', generation_id,
        '--region', region
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        content = result.stdout + result.stderr
    except Exception as e:
        print(f"Command failed: {e}", file=sys.stderr)
        sys.exit(1)

    cedar_statement = None

    # Clean up terminal line wrapping before parsing
    # Remove newlines followed by non-JSON characters (terminal wrapping artifact)
    cleaned_content = re.sub(r'\n([a-zA-Z0-9_/-])', r'\1', content)

    # Try to parse JSON - the CLI outputs pretty-printed JSON
    try:
        # Find JSON object in output
        json_match = re.search(r'\{[\s\S]*\}', cleaned_content)
        if json_match:
            json_str = json_match.group()
            data = json.loads(json_str)
            assets = data.get('policyGenerationAssets', [])
            if assets:
                cedar_statement = assets[0].get('definition', {}).get('cedar', {}).get('statement', '')
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}", file=sys.stderr)
    except Exception as e:
        print(f"Parse error: {e}", file=sys.stderr)

    # Fallback: extract statement pattern from text
    if not cedar_statement:
        pattern = r'"statement":\s*"((?:[^"\\]|\\.)*)"'
        match = re.search(pattern, cleaned_content, re.DOTALL)
        if match:
            cedar_statement = match.group(1)
            # Unescape the string
            cedar_statement = cedar_statement.encode().decode('unicode_escape')

    if cedar_statement:
        # Clean up any remaining terminal wrapping artifacts in Cedar
        # Remove line breaks that appear in the middle of identifiers or ARNs
        cedar_statement = re.sub(r'\n(?=[a-zA-Z0-9_:/-])', '', cedar_statement)
        # Create policy definition JSON
        policy_def = json.dumps({'cedar': {'statement': cedar_statement}})
        with open(output_file, 'w') as f:
            f.write(policy_def)
        print(f"Extracted Cedar to {output_file}")
        sys.exit(0)

    print("Could not extract Cedar statement", file=sys.stderr)
    print("Raw output:", file=sys.stderr)
    print(content[:500], file=sys.stderr)
    sys.exit(1)

if __name__ == '__main__':
    main()
