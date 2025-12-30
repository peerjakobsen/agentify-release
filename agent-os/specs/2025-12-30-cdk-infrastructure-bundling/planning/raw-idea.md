# Raw Idea: CDK Infrastructure Bundling & Extraction

28.5. CDK Infrastructure Bundling & Extraction — Replace CloudFormation SDK deployment with bundled CDK infrastructure:

**File Extraction on "Initialize Project":**
- Extract bundled `resources/cdk/` to `{workspace}/cdk/` (full CDK project with NetworkingStack + ObservabilityStack)
- Extract bundled `resources/scripts/` to `{workspace}/scripts/` (setup.sh, destroy.sh, Dockerfile template)
- Auto-open `cdk/README.md` in editor with deployment instructions

**User-Driven Deployment:**
- User runs `./scripts/setup.sh --region {region}` manually
- setup.sh outputs to `.agentify/infrastructure.json` (deployment info)
- Clear instructions include CDK bootstrap (first-time), deployment command, cost estimate (~$32/mo)

**Config Architecture:**
- Keep separate files: `infrastructure.json` (deployment outputs), `config.json` (extension settings)
- Extension reads from `infrastructure.json` when present for DynamoDB table name/region

**Code Cleanup:**
- Remove `src/services/cloudFormationService.ts`
- Remove `infrastructure/dynamodb-table.yaml`
- Remove `infrastructure/` folder
- Update `initializeProject.ts` to use file extraction instead of SDK calls

**Bundling:**
- Ensure `resources/cdk/` and `resources/scripts/` included in VSIX package
- Add `cdk/README.md` with comprehensive deployment instructions
