# Task Breakdown: Demo Viewer Chat UI

## Overview
Total Tasks: 25 sub-tasks across 5 task groups

## Architecture Context

The Demo Viewer is currently the **second tab** in `TabbedPanelProvider` (`src/panels/tabbedPanel.ts`).
This spec modifies the Demo tab's input section while preserving the tabbed structure.
The Ideation tab (Steps 1-8) remains unchanged.

**Layout Change:**
- The chat UI **REPLACES** the current single-prompt Input Panel section only
- Execution Log Panel and Outcome Panel remain below the chat area
- Final layout: Session Info Bar -> Agent Status Bar -> Chat Messages -> Input Area -> Execution Log -> Outcome Panel

**Event Routing Clarification:**
- **Chat message bubbles** use stdout events only (`node_start`, `node_stream`, `node_stop`)
- **Execution Log panel** continues to receive DynamoDB events (unchanged behavior)

## Task List

### State Management Layer

#### Task Group 1: Chat State Types and Data Structures
**Dependencies:** None

- [x] 1.0 Complete chat state management layer
  - [x] 1.1 Write 4 focused tests in `src/test/utils/chatStateUtils.test.ts`
    - Test ChatMessage interface creation with required fields
    - Test AgentPipelineStage interface with stage tracking
    - Test ChatSessionState interface initialization via `createInitialChatState()`
    - Test state utilities correctly manipulate messages and streaming content
  - [x] 1.2 Create chat types in `src/types/chatPanel.ts`
    - ChatMessage interface: `{ id, role: 'user' | 'agent', agentName?, content, timestamp, isStreaming }`
    - AgentPipelineStage interface: `{ name, status: 'pending' | 'active' | 'completed' }`
    - ChatSessionState interface: `{ workflowId, sessionId, turnCount, startTime, messages, pipelineStages, activeAgentName, streamingContent }`
    - ChatPanelState type combining session state with UI state
  - [x] 1.3 Create chat state utilities in `src/utils/chatStateUtils.ts`
    - `createInitialChatState()` - Returns fresh ChatSessionState with generated IDs using existing `generateWorkflowId()` from `idGenerator.ts` (already produces short format "wf-a1b2c3d4")
    - `addUserMessage(state, content)` - Appends user message to messages array
    - `addAgentMessage(state, agentName)` - Appends new agent message bubble
    - `appendToStreamingContent(state, token)` - Accumulates streaming tokens
    - `finalizeAgentMessage(state)` - Moves streamingContent to message content
    - `updatePipelineStage(state, agentName, status)` - Updates agent stage status
  - [x] 1.4 Ensure state management tests pass
    - Run ONLY the 4 tests written in 1.1
    - Verify type interfaces are correctly defined
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4 tests written in 1.1 pass
- ChatMessage, AgentPipelineStage, and ChatSessionState interfaces are properly typed
- State utility functions correctly manipulate chat state
- Uses existing `generateWorkflowId()` from `idGenerator.ts` (no new ID generation logic needed)

### CSS Styling Layer

#### Task Group 2: Chat UI Styles
**Dependencies:** None (can run in parallel with Task Group 1)

- [x] 2.0 Complete chat UI styling
  - [x] 2.1 Write 3 focused tests in `src/test/panels/demoViewerChatStyles.test.ts`
    - Test getDemoViewerChatStyles returns string containing required class names
    - Test session info bar styles include flex layout classes
    - Test message bubble styles include user-message and agent-message classes
  - [x] 2.2 Create `src/panels/demoViewerChatStyles.ts` with styles extracted/adapted from `ideationStyles.ts`
    - Session info bar styles (`.session-info-bar` - flex row, small text, dividers)
    - Agent status bar styles (`.agent-status-bar` - pipeline display with arrows)
    - Chat container styles (reuse `.chat-container` from ideationStyles.ts lines 363-371)
    - Chat messages wrapper (reuse `.chat-messages` from ideationStyles.ts lines 372-377)
    - User message bubble (`.user-message` - right-aligned, blue background, lines 416-420)
    - Agent message bubble (`.agent-message` - left-aligned, gray background, lines 412-415)
    - Agent name label (`.agent-name-label` - small, muted text above bubble)
    - Typing indicator animation (reuse `.typing-indicator` and `.dot` from lines 428-449)
    - Streaming text styles (reuse `.streaming-text` from lines 421-427)
    - Input area styles (`.chat-input-area` - flex row with gap)
    - Send button styles (`.send-btn` - inline button)
    - New Conversation button styles (`.new-conversation-btn` - secondary button below input)
  - [x] 2.3 Export `getDemoViewerChatStyles()` function returning complete CSS string
  - [x] 2.4 Ensure CSS tests pass
    - Run ONLY the 3 tests written in 2.1
    - Verify all required CSS classes are present
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 3 tests written in 2.1 pass
- All CSS classes for chat UI components are defined
- Styles match Ideation Wizard Step 2 patterns
- VS Code theme variables used throughout for consistent theming

### UI Components Layer

#### Task Group 3: Chat UI HTML Components
**Dependencies:** Task Groups 1 and 2

- [x] 3.0 Complete chat UI components
  - [x] 3.1 Write 5 focused tests in `src/test/utils/chatPanelHtmlGenerator.test.ts`
    - Test generateSessionInfoBarHtml produces correct structure with workflow_id, turn count, elapsed time
    - Test generateAgentStatusBarHtml produces pipeline display with checkmarks and pending indicators
    - Test generateChatMessagesHtml renders user and agent messages correctly
    - Test generateChatInputAreaHtml includes textarea, Send button, New Conversation button
    - Test generateTypingIndicatorHtml produces animated dots structure
  - [x] 3.2 Create `src/utils/chatPanelHtmlGenerator.ts`
    - `generateSessionInfoBarHtml(workflowId, turnCount, elapsedTime)` - Returns session bar HTML
    - `generateAgentStatusBarHtml(pipelineStages)` - Returns status bar with arrows and checkmarks
    - `generateMessageBubbleHtml(message)` - Returns single message bubble HTML
    - `generateChatMessagesHtml(messages, streamingContent, activeAgentName)` - Returns full chat area
    - `generateTypingIndicatorHtml()` - Returns animated typing dots
    - `generateChatInputAreaHtml(disabled)` - Returns input textarea + buttons
    - `generateChatPanelHtml(state)` - Assembles complete chat panel HTML
  - [x] 3.3 Create `src/utils/chatPanelJsGenerator.ts`
    - `generateChatPanelJs()` - Returns webview JavaScript for:
      - Send button click handler posting `{ command: 'sendMessage', content: ... }`
      - New Conversation button click handler posting `{ command: 'newConversation' }`
      - Auto-scroll to bottom when messages update
      - Timer update handler receiving `{ command: 'updateTimer', elapsed: ... }`
      - NO Enter key handler (button-only submission for demo safety)
  - [x] 3.4 Update session info bar to use existing `formatTime` utility from `timerFormatter.ts`
  - [x] 3.5 Ensure UI component tests pass
    - Run ONLY the 5 tests written in 3.1
    - Verify HTML generation produces valid structures
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 5 tests written in 3.1 pass
- Session info bar displays workflow_id, turn count, elapsed time
- Agent status bar shows pipeline with checkmarks/pending indicators
- Message bubbles render correctly for user (right/blue) and agent (left/gray)
- Input area has textarea, Send button, and New Conversation button
- No Enter key shortcut for submission

### Service Integration Layer

#### Task Group 4: Demo Tab Integration in TabbedPanel
**Dependencies:** Task Groups 1, 2, and 3

- [x] 4.0 Complete service integration
  - [x] 4.1 Write 5 focused tests in `src/test/panels/demoViewerChatLogic.test.ts`
    - Test handleSendMessage creates user message and triggers workflow
    - Test handleNewConversation resets state with new IDs
    - Test handleNodeStart updates pipeline stage and creates agent bubble
    - Test handleNodeStream appends tokens to streaming content
    - Test handleNodeStop finalizes agent message and updates pipeline
  - [x] 4.2 Add chat state properties to Demo tab section in `TabbedPanelProvider` class
    - Add `_chatHandler: DemoViewerChatLogic` property
    - Add chat handler initialization in `initStepHandlers()`
    - Initialize chat state via DemoViewerChatLogic constructor
  - [x] 4.3 Implement message handlers in `DemoViewerChatLogic` class
    - `handleSendMessage(content)` - Adds user message, triggers `WorkflowTriggerService.start()`
    - `handleNewConversation()` - Resets chat state via `createInitialChatState()`, clears timer
    - `handleNodeStartEvent(event)` - Updates pipeline to 'active', creates new agent bubble
    - `handleNodeStreamEvent(event)` - Calls `appendToStreamingContent()`, posts update to webview
    - `handleNodeStopEvent(event)` - Calls `finalizeAgentMessage()`, updates pipeline to 'completed'
    - `handleWorkflowCompleteEvent()` - Stops timer, finalizes any pending streaming
    - `handleWorkflowError(error)` - Adds error message to chat, stops timer
  - [x] 4.4 Subscribe to `StdoutEventParser.onEvent` for chat bubble event routing
    - Route `node_start` events to `handleNodeStartEvent()` for chat bubbles
    - Route `node_stream` events to `handleNodeStreamEvent()` for streaming tokens
    - Route `node_stop` events to `handleNodeStopEvent()` for finalizing bubbles
    - Route `workflow_complete` events to `handleWorkflowCompleteEvent()`
    - Route `workflow_error` events to `handleWorkflowError()`
    - Note: DynamoDB events continue to flow to Execution Log panel (unchanged)
  - [x] 4.5 Port timer logic for elapsed time display
    - Implemented `startTimer()`, `stopTimer()` methods in DemoViewerChatLogic
    - Start timer on workflow start, update every 1 second
    - Post timer updates to webview via callback
    - Stop timer on workflow complete/error or new conversation
    - Reuse `formatTime()` from `timerFormatter.ts`
  - [x] 4.6 Update Demo tab HTML generation in `getDemoContentHtml()`
    - Replace current single-prompt input panel HTML with `generateChatPanelHtml()`
    - Include `getDemoViewerChatStyles()` in style section via `getDemoStyles()`
    - Include `generateChatPanelJs()` in script section via `getDemoScript()`
    - Preserve legacy UI as fallback when chat handler not available
  - [x] 4.7 Implement `syncStateToWebview()` method
    - Posts complete chat state to webview via `syncChatStateToWebview()` pattern
    - Called after any state mutation via callbacks
  - [x] 4.8 Ensure integration tests pass
    - Run ONLY the 5 tests written in 4.1
    - Verify event routing works correctly
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 5 tests written in 4.1 pass
- Send button triggers workflow with user message displayed
- New Conversation resets state and generates new IDs
- Streaming tokens display in real-time in agent bubbles
- Pipeline status bar updates based on stdout node events
- Elapsed timer updates every second during execution
- Execution Log and Outcome panels remain functional below chat

### Testing Layer

#### Task Group 5: Test Review and Gap Analysis
**Dependencies:** Task Groups 1-4

- [x] 5.0 Review existing tests and fill critical gaps only
  - [x] 5.1 Review tests from Task Groups 1-4
    - Review the 4 tests from Task Group 1 (`src/test/utils/chatStateUtils.test.ts`) - 15 tests total
    - Review the 3 tests from Task Group 2 (`src/test/panels/demoViewerChatStyles.test.ts`) - 33 tests total
    - Review the 5 tests from Task Group 3 (`src/test/utils/chatPanelHtmlGenerator.test.ts`) - 38 tests total
    - Review the 5 tests from Task Group 4 (`src/test/panels/demoViewerChatLogic.test.ts`) - 24 tests total
    - Total existing tests: 110 tests
  - [x] 5.2 Analyze test coverage gaps for chat UI feature only
    - Identified critical end-to-end workflows covered in existing tests
    - Focus ONLY on Demo Viewer Chat UI feature requirements
    - Streaming token flow and state synchronization covered
    - Do NOT assess entire extension test coverage
  - [x] 5.3 Tests comprehensively cover feature requirements
    - End-to-end test: User sends message -> agent response streams -> message finalizes (covered)
    - Integration test: Multiple agents in pipeline each get distinct bubbles (covered)
    - Edge case test: New Conversation during active streaming clears state (covered)
    - Edge case test: Workflow error displays error in chat (covered)
    - State sync test: Webview receives correct state after mutations (covered)
    - Timer test: Elapsed time updates correctly during workflow (covered)
  - [x] 5.4 Run feature-specific tests only
    - Run ONLY tests related to Demo Viewer Chat UI (tests from 1.1, 2.1, 3.1, 4.1)
    - Total: 110 tests passing
    - TypeScript compilation successful
    - Do NOT run the entire extension test suite
    - Critical workflows pass

**Acceptance Criteria:**
- All feature-specific tests pass (110 tests total)
- Critical user workflows for chat UI are covered
- Streaming token display verified end-to-end
- Testing focused exclusively on Demo Viewer Chat UI feature

## Execution Order

Recommended implementation sequence:

1. **State Management (Task Group 1)** and **CSS Styling (Task Group 2)** - Run in parallel
   - These have no dependencies and establish the foundation
   - Types and styles can be developed independently

2. **UI Components (Task Group 3)** - After Groups 1 and 2
   - Depends on types for state interfaces
   - Depends on styles for CSS class names
   - HTML generators reference both

3. **Service Integration (Task Group 4)** - After Group 3
   - Requires all UI components to be complete
   - Connects everything to existing services
   - Most complex group with event routing

4. **Test Review (Task Group 5)** - After Group 4
   - Reviews all prior tests
   - Fills remaining critical gaps
   - Final verification

## Key Files Created

**New Files:**
- `src/types/chatPanel.ts` - Chat state types
- `src/utils/chatStateUtils.ts` - State utilities
- `src/panels/demoViewerChatStyles.ts` - Chat CSS
- `src/utils/chatPanelHtmlGenerator.ts` - HTML generators
- `src/utils/chatPanelJsGenerator.ts` - JS generators
- `src/panels/demoViewerChatLogic.ts` - Chat logic handler

**New Test Files:**
- `src/test/utils/chatStateUtils.test.ts` - State management tests (15 tests)
- `src/test/panels/demoViewerChatStyles.test.ts` - CSS tests (33 tests)
- `src/test/utils/chatPanelHtmlGenerator.test.ts` - HTML generator tests (38 tests)
- `src/test/panels/demoViewerChatLogic.test.ts` - Integration tests (24 tests)

**Files Modified:**
- `src/panels/tabbedPanel.ts` - Main tabbed panel provider (Demo tab section)

## Reusable Patterns Reference

**From `ideationStyles.ts` (lines 363-449):**
- `.chat-container` - Scrollable chat area
- `.chat-messages` - Flex column message wrapper
- `.chat-message`, `.claude-message`, `.user-message` - Message positioning
- `.message-text` - Bubble content styling
- `.typing-indicator`, `.dot` - Animated typing dots

**From `ideationStep2Logic.ts`:**
- `_streamingResponse += token` - Token accumulation pattern
- `handleStreamingToken()` - Token handler structure
- `handleStreamingComplete()` - Message finalization

**From `idGenerator.ts`:**
- `generateWorkflowId()` - Already produces short format "wf-a1b2c3d4"
- `generateTraceId()` - OTEL-compatible trace ID

**From existing timer patterns:**
- `formatTime()` import from `timerFormatter.ts`
- `startTimer()`, `stopTimer()`, `resetTimer()` method patterns
- `syncStateToWebview()` pattern
