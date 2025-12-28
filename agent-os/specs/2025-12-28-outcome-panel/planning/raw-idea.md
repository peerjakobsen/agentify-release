# Raw Idea: Outcome Panel

**Feature Name:** Outcome Panel

**Description:** Build outcome display section in Demo Viewer (below Execution Log) showing: (1) success/failure status with ✅/❌ icon from `workflow_complete` or `workflow_error` stdout events, (2) workflow result rendered as markdown when result is a string, with formatted JSON fallback (syntax highlighting, collapsible) for structured objects, (3) "Sources" line listing data sources used if provided in outcome payload, (4) copy-to-clipboard button for result content. Panel starts hidden/collapsed until first workflow completes, clears immediately when new run starts (not waiting for new outcome). Error state displays error message prominently without stack trace — keep it clean for demo audiences. Does NOT duplicate execution duration (already shown in Input Panel timer).
