# Raw Idea: Steering Generation Service

**Feature: Steering Generation Service**

Implement service that generates steering files using prompts from Item 28.1:

**Service Interface:**
```typescript
// src/services/steeringGenerationService.ts
interface GenerationResult {
  success: boolean;
  files: GeneratedFile[];
  errors?: { file: string; error: string }[];
}

interface GeneratedFile {
  fileName: string;
  filePath: string;
  content: string;
  status: 'created' | 'failed';
}

class SteeringGenerationService {
  async generateSteeringFiles(state: IdeationState): Promise<GenerationResult>;
  async generateDocument(promptName: string, context: object): Promise<string>;
}
```

**Generation Flow:**
1. Load all prompt files from `resources/prompts/steering/`
2. Extract relevant state sections for each document (per mapping in 28.1)
3. Generate all 8 documents in parallel using Bedrock
4. Return results with content and status per file

**Why Parallel Generation:**
- 8 independent documents with no cross-dependencies
- Reduces total generation time from ~40s (sequential) to ~5-8s (parallel)
- Individual failures don't block other documents

**Error Handling:**
- Catch per-document generation errors
- Continue generating remaining documents on failure
- Return partial results with error details for failed documents
- Step 8 UI handles display of partial success

**Relationship to Step 8:**
This service replaces the stub service from Item 24. Step 8 calls this service and handles UI/progress display. Service is responsible only for content generation, not file I/O.
