# Raw Idea: Steering File Writer & Step 8 Integration

## Feature Description

28.3. [ ] Steering File Writer & Step 8 Integration — Write generated steering files to workspace and integrate with Step 8 UI:

**File Writing:**
- Create `.kiro/steering/` directory if not exists
- Write each generated document from Item 28.2 to corresponding file
- Emit progress events for Step 8 UI updates

**Conflict Handling:**
- Check if `.kiro/steering/` directory exists with files
- If exists, prompt: "Overwrite existing steering files?"
- Options: "Overwrite", "Backup & Overwrite", "Cancel"
- "Backup & Overwrite" copies existing to `.kiro/steering.backup-{timestamp}/`

**Step 8 Integration:**
- Replace stub service calls with real `SteeringGenerationService`
- Update progress UI to show per-file generation status
- Remove `isPlaceholderMode` flag and "Preview mode" indicator
- On success: show generated file list with "Open File" links
- On partial failure: show which files succeeded/failed with retry option

**Post-Generation Actions:**
- Clear wizard state (per Item 22) on full success only
- Keep wizard state on partial failure (allow retry)
- "Open in Kiro" button reveals `.kiro/steering/` folder
- If in Kiro IDE: TODO placeholder for `kiro.startSpecFlow` command (Item 34)

**Validation Before Generation:**
- Verify required wizard steps have content (Steps 1, 3, 5 minimum)
- Show validation errors in Step 8 summary cards
- Block generation if critical steps incomplete

**Files Written:**
```
.kiro/steering/
├── product.md
├── tech.md
├── structure.md
├── customer-context.md
├── integration-landscape.md
├── security-policies.md
├── demo-strategy.md
└── agentify-integration.md
```
