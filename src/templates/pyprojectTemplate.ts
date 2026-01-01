/**
 * pyproject.toml Template Generator
 *
 * Creates a pyproject.toml for Agentify projects with proper dependency separation.
 *
 * IMPORTANT: bedrock-agentcore-starter-toolkit MUST be in dev dependencies because:
 * - It requires GCC to build (ruamel-yaml-clibz dependency)
 * - The slim Docker image for agents doesn't have GCC
 * - It's only needed for CLI commands (agentcore configure/deploy), not at runtime
 *
 * Versioning strategy: Use minimum versions (>=X.Y.Z) only.
 * - uv resolves latest compatible versions at sync time
 * - uv.lock ensures reproducible builds
 * - Template only needs updates for breaking API changes
 */

/**
 * Creates pyproject.toml content for an Agentify project
 * @param projectName - The project name (used as package name)
 * @returns pyproject.toml content as a string
 */
export function createPyprojectToml(projectName: string): string {
  // Sanitize project name for Python package naming (replace hyphens, spaces)
  const packageName = projectName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  return `[project]
name = "${packageName}"
version = "1.0.0"
description = "Agentify demo project with AI agents deployed to AgentCore Runtime"
requires-python = ">=3.11"
dependencies = [
    "strands-agents>=0.1.0",
    "bedrock-agentcore>=1.0.0",
    "mcp>=1.0.0",
    "boto3>=1.26.0",
    "python-dotenv>=1.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "bedrock-agentcore-starter-toolkit>=0.2.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["agents"]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W"]
ignore = ["E501"]

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
addopts = "-v --tb=short"
`;
}
