# Raw Idea: Wizard State Persistence

## Feature Description

Implement workspace storage for wizard progress so users can resume incomplete ideation sessions.

## Storage

- Save wizard state to `.agentify/wizard-state.json` on each step completion
- State includes: current step, all field values, conversation history, agent design, mock data config
- Exclude uploaded files (too large) — store file metadata only with "re-upload required" flag

## Resume Flow

- On Ideation Wizard open, check for existing `wizard-state.json`
- If found and less than 7 days old: prompt "Resume previous session?" with preview of business objective
- "Resume" → restore state, navigate to last completed step
- "Start Fresh" → delete state file, begin at step 1

## Auto-Save

- Debounced save (500ms after last change) within each step
- Explicit save on "Next" button click

## Clear State

- "Reset Wizard" command clears state file and restarts
- State automatically cleared when steering files successfully generated (Phase 4)
