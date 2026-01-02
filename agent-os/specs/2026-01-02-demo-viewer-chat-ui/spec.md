# Specification: Demo Viewer Chat UI

## Goal
Replace the single prompt textarea with a chat-style conversation interface in the Demo Viewer panel, reusing Ideation Wizard Step 2 patterns for message bubbles and streaming token display.

## User Stories
- As a developer, I want to see my prompts and agent responses in a conversation-style layout so that I can follow the workflow execution flow visually
- As a demo presenter, I want to see which agent is currently streaming output so that I can narrate the agent pipeline progress in real-time

## Specific Requirements

**Session Info Bar**
- Display at the top of the chat interface, above the status bar
- Show workflow_id in short format (e.g., "wf-a1b2c3d4")
- Show turn count (always 1 for this phase - multi-turn is Item 36)
- Show elapsed time using existing `formatTime` utility from `timerFormatter.ts`
- Update elapsed time in real-time during workflow execution

**Agent Status Bar**
- Display below session info bar, above the chat message area
- Show text-based pipeline progress (e.g., "Triage -> Technical (pending) -> Output")
- Use checkmark indicator for completed agents (e.g., "Triage checkmark")
- Use "(pending)" text indicator for waiting agents
- Update status based on `node_start` and `node_stop` stdout events from `StdoutEventParser.onEvent`

**Chat Message Area**
- Scrollable container in the middle section of the panel
- Auto-scroll to bottom when new messages arrive (reuse existing log panel auto-scroll logic)
- User messages: right-aligned, blue background bubbles
- Agent messages: left-aligned, gray background bubbles with agent name label above

**Agent Message Bubbles**
- Display agent name as a label header inside or above the bubble
- Each agent in multi-agent workflows gets its own distinct bubble sequence
- Show typing indicator (three animated dots) while agent is actively streaming
- Display streaming tokens in real-time within the active agent's bubble
- Use `_streamingResponse += token` accumulation pattern from Step 2

**Streaming Token Display**
- Subscribe to `StdoutEventParser.onEvent` for `node_stream` events
- Accumulate tokens per active agent using `handleStreamingToken` pattern
- Display partial response text with visible cursor/indicator during streaming
- Finalize message bubble when `node_stop` event received for that agent

**Input Area**
- Text input field at the bottom of the panel
- "Send" button positioned inline with the input field
- Button-only submission (no Enter key shortcut) for demo safety - prevents accidental workflow triggers
- "New Conversation" button below the Send button row

**New Conversation Reset**
- Clicking "New Conversation" clears visible chat history
- Generates new workflow_id and session_id
- Resets turn count to 0
- Clears any streaming state and pending agent bubbles
- Keeps the input panel visible and ready for new prompt

## Visual Design

**`planning/visuals/` ASCII Mockup**
- Three-tier layout: session info bar -> status bar -> chat area -> input area
- Session info bar shows: workflow_id (short format), turn count, elapsed time
- Status bar displays agent pipeline with checkmarks and pending indicators
- User messages positioned right-aligned in contained bubbles
- Agent messages positioned left-aligned with agent name header
- Streaming indicator (cursor or animation) shown in active agent bubble
- Input area at bottom with Send button inline, New Conversation button below

## Existing Code to Leverage

**Chat Container and Message Bubble CSS from `ideationStyles.ts`**
- Reuse `.chat-container` styles for scrollable chat area (lines 363-371)
- Reuse `.chat-message`, `.claude-message`, `.user-message` for bubble positioning
- Reuse `.message-text` styles for bubble content formatting with border-radius
- Adapt blue/gray color scheme from Step 2 message styling

**Streaming Token Handling from `ideationStep2Logic.ts`**
- Reuse `_streamingResponse` accumulation pattern (line 80)
- Reuse `handleStreamingToken()` method structure (lines 224-227)
- Reuse `handleStreamingComplete()` pattern for finalizing messages (lines 232-249)
- Reuse `postStreamingToken()` callback pattern for real-time webview updates

**Workflow Execution from `workflowTriggerService.ts`**
- Existing `start()` method returns `{workflowId, traceId}` (lines 127-225)
- Existing `onStdoutLine` event for raw stdout data streaming
- Existing `onProcessStateChange` for tracking workflow lifecycle
- Continue using singleton pattern via `getWorkflowTriggerService()`

**Event Parsing from `stdoutEventParser.ts`**
- Existing `onEvent` emitter for typed stdout events (line 111)
- Events include `node_start`, `node_stream`, `node_stop`, `workflow_complete`, `workflow_error`
- Use `MergedEvent` type wrapper with `source: 'stdout'`

**Timer and UI Patterns from `demoViewerPanel.ts`**
- Reuse `formatTime` import and timer display logic (lines 416-425)
- Reuse `startTimer()`, `stopTimer()`, `resetTimer()` methods
- Adapt `syncStateToWebview()` pattern for chat state synchronization

## Out of Scope
- Conversation history persistence across IDE restarts (not persisted to workspaceState)
- Editing or deleting previous messages after they are sent
- Multi-turn session continuation where context carries over (that is Item 36)
- The `--conversation-context` CLI argument for multi-turn (requires Item 36)
- Partial execution detection and resume (that is Item 37)
- Agent graph visualization component (Phase 4, Items 25-26)
- DynamoDB polling integration for chat messages (stdout events only)
- Voice input or speech-to-text capabilities
- Message reactions, threading, or other advanced chat features
- Markdown rendering in agent response bubbles (plain text only for this phase)
