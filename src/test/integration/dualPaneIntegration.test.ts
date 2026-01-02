/**
 * Dual-Pane Conversation UI Integration Tests
 *
 * Task Group 6: Test Review and Integration Verification
 *
 * These tests verify the end-to-end integration of all layers:
 * - Type definitions (Task Group 1)
 * - CSS styles (Task Group 2)
 * - HTML generation (Task Group 3)
 * - Message routing and state management (Task Group 4)
 * - Python template event structure (Task Group 5)
 *
 * Focus on complete user workflows and integration points.
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialChatState,
  createInitialUiState,
  addUserMessage,
  addAgentMessage,
  appendToStreamingContent,
  finalizeAgentMessage,
  updatePipelineStage,
  determineMessagePane,
  addHandoffMessage,
  resetChatState,
} from '../../utils/chatStateUtils';
import {
  generateChatPanelHtml,
  generateDualPaneContainerHtml,
  generateConversationPaneHtml,
  generateCollaborationPaneHtml,
} from '../../utils/chatPanelHtmlGenerator';
import { getDemoViewerChatStyles } from '../../panels/demoViewerChatStyles';
import type {
  ChatMessage,
  ChatSessionState,
  ChatPanelState,
} from '../../types/chatPanel';
import type { NodeStartEvent } from '../../types/events';
import { isNodeStartEvent } from '../../types/events';

// ============================================================================
// Integration Test 1: Complete Flow - User Message to Entry Agent Response
// ============================================================================

describe('Integration Test 1: Complete user message to entry agent flow', () => {
  it('should route user message to conversation pane and generate correct HTML', () => {
    // Step 1: Create initial state
    let state = createInitialChatState();

    // Step 2: User sends message (state management)
    state = addUserMessage(state, 'Hello, I need help with my order');

    // Step 3: Verify state
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].pane).toBe('conversation');
    expect(state.messages[0].role).toBe('user');

    // Step 4: Generate HTML and verify
    const panelState: ChatPanelState = {
      session: state,
      ui: createInitialUiState(),
    };
    const html = generateChatPanelHtml(panelState);

    // Step 5: Verify HTML structure
    expect(html).toContain('dual-pane-container');
    expect(html).toContain('Hello, I need help with my order');
    expect(html).toContain('pane-left');
    expect(html).toContain('Conversation');
  });

  it('should route entry agent response to conversation pane with streaming', () => {
    let state = createInitialChatState();

    // User message
    state = addUserMessage(state, 'Analyze this data');

    // Entry agent starts (from_agent: null)
    const pane = determineMessagePane(null);
    expect(pane).toBe('conversation');

    state = { ...state, entryAgentName: 'Triage Agent' };
    state = addAgentMessage(state, 'Triage Agent', pane);

    // Verify activeMessagePane for streaming routing
    expect(state.activeMessagePane).toBe('conversation');

    // Stream tokens
    state = appendToStreamingContent(state, 'Routing to technical team...');
    expect(state.streamingContent).toBe('Routing to technical team...');

    // Finalize
    state = finalizeAgentMessage(state);

    // Verify final state
    expect(state.messages).toHaveLength(2);
    expect(state.messages[1].pane).toBe('conversation');
    expect(state.messages[1].content).toBe('Routing to technical team...');
    expect(state.activeMessagePane).toBeNull();

    // Generate HTML and verify entry agent in conversation pane
    const conversationHtml = generateConversationPaneHtml(
      state.messages,
      state.streamingContent,
      state.activeAgentName
    );
    expect(conversationHtml).toContain('Routing to technical team...');
    expect(conversationHtml).toContain('Triage Agent');
  });
});

// ============================================================================
// Integration Test 2: Single-Agent Scenario - Empty Collaboration Pane
// ============================================================================

describe('Integration Test 2: Single-agent workflow shows empty collaboration pane', () => {
  it('should show empty state in collaboration pane for single-agent workflow', () => {
    let state = createInitialChatState();

    // User message
    state = addUserMessage(state, 'Simple question');

    // Single entry agent responds
    state = { ...state, entryAgentName: 'Assistant' };
    state = addAgentMessage(state, 'Assistant', 'conversation');
    state = appendToStreamingContent(state, 'Here is your answer.');
    state = finalizeAgentMessage(state);

    // All messages should be in conversation pane
    const conversationMessages = state.messages.filter(m => m.pane === 'conversation');
    const collaborationMessages = state.messages.filter(m => m.pane === 'collaboration');

    expect(conversationMessages).toHaveLength(2);
    expect(collaborationMessages).toHaveLength(0);

    // Generate collaboration pane HTML - should show empty state
    const collaborationHtml = generateCollaborationPaneHtml(
      state.messages,
      state.streamingContent,
      state.activeAgentName,
      state.activeMessagePane
    );

    expect(collaborationHtml).toContain('collaboration-empty-state');
    expect(collaborationHtml).toContain('No agent collaboration in this workflow');
  });

  it('should generate complete dual-pane HTML with empty collaboration for single-agent', () => {
    let state = createInitialChatState();

    state = addUserMessage(state, 'Quick help');
    state = { ...state, entryAgentName: 'Helper' };
    state = addAgentMessage(state, 'Helper', 'conversation');
    state = appendToStreamingContent(state, 'Done!');
    state = finalizeAgentMessage(state);

    const panelState: ChatPanelState = {
      session: state,
      ui: createInitialUiState(),
    };
    const html = generateChatPanelHtml(panelState);

    // Conversation pane should have content
    expect(html).toContain('Quick help');
    expect(html).toContain('Done!');

    // Collaboration pane should show empty state
    expect(html).toContain('No agent collaboration in this workflow');
  });
});

// ============================================================================
// Integration Test 3: Multi-Agent Scenario - Handoffs in Collaboration Pane
// ============================================================================

describe('Integration Test 3: Multi-agent workflow routes handoffs to collaboration pane', () => {
  it('should correctly distribute messages across both panes in multi-agent workflow', () => {
    let state = createInitialChatState();

    // Step 1: User message -> conversation pane
    state = addUserMessage(state, 'Analyze sales data');

    // Step 2: Entry agent (from_agent: null) -> conversation pane
    state = { ...state, entryAgentName: 'Triage Agent' };
    const entryPane = determineMessagePane(null);
    state = addAgentMessage(state, 'Triage Agent', entryPane);
    state = appendToStreamingContent(state, 'Routing to technical team...');
    state = finalizeAgentMessage(state);

    // Step 3: Handoff prompt (from_agent: 'Triage Agent') -> collaboration pane
    state = addHandoffMessage(state, 'Triage Agent', 'Please analyze this sales data in detail');

    // Step 4: Technical agent response (from_agent !== null) -> collaboration pane
    const techPane = determineMessagePane('Triage Agent');
    state = addAgentMessage(state, 'Technical Agent', techPane);
    state = appendToStreamingContent(state, 'Analysis complete: Revenue up 15%');
    state = finalizeAgentMessage(state);

    // Verify message distribution
    expect(state.messages).toHaveLength(4);

    const conversationMessages = state.messages.filter(m => m.pane === 'conversation');
    const collaborationMessages = state.messages.filter(m => m.pane === 'collaboration');

    expect(conversationMessages).toHaveLength(2); // User + Entry Agent
    expect(collaborationMessages).toHaveLength(2); // Handoff + Technical Agent

    // Verify handoff message properties
    const handoffMessage = collaborationMessages.find(m => m.isSender === true);
    expect(handoffMessage).toBeDefined();
    expect(handoffMessage?.agentName).toBe('Triage Agent');
    expect(handoffMessage?.content).toBe('Please analyze this sales data in detail');
  });

  it('should generate correct HTML for both panes in multi-agent workflow', () => {
    let state = createInitialChatState();

    // Set up multi-agent messages
    state = addUserMessage(state, 'Complex request');
    state = { ...state, entryAgentName: 'Coordinator' };
    state = addAgentMessage(state, 'Coordinator', 'conversation');
    state = appendToStreamingContent(state, 'Delegating...');
    state = finalizeAgentMessage(state);
    state = addHandoffMessage(state, 'Coordinator', 'Handle the complex part');
    state = addAgentMessage(state, 'Specialist', 'collaboration');
    state = appendToStreamingContent(state, 'Specialist handling it.');
    state = finalizeAgentMessage(state);

    // Generate HTML for both panes
    const conversationHtml = generateConversationPaneHtml(
      state.messages,
      '',
      null
    );
    const collaborationHtml = generateCollaborationPaneHtml(
      state.messages,
      '',
      null,
      null
    );

    // Conversation pane should have user message and coordinator response
    expect(conversationHtml).toContain('Complex request');
    expect(conversationHtml).toContain('Delegating...');
    expect(conversationHtml).not.toContain('Handle the complex part');

    // Collaboration pane should have handoff and specialist response
    expect(collaborationHtml).toContain('Handle the complex part');
    expect(collaborationHtml).toContain('Specialist handling it.');
    expect(collaborationHtml).not.toContain('Complex request');
    expect(collaborationHtml).not.toContain('collaboration-empty-state');
  });
});

// ============================================================================
// Integration Test 4: Streaming Tokens Appear in Correct Pane
// ============================================================================

describe('Integration Test 4: Streaming tokens appear in correct pane using activeMessagePane', () => {
  it('should route streaming tokens to conversation pane for entry agent', () => {
    let state = createInitialChatState();

    state = addUserMessage(state, 'Question');
    state = { ...state, entryAgentName: 'Entry' };

    // Entry agent starts streaming
    state = addAgentMessage(state, 'Entry', 'conversation');
    expect(state.activeMessagePane).toBe('conversation');

    state = appendToStreamingContent(state, 'Token 1');
    state = appendToStreamingContent(state, ' Token 2');

    // Verify activeMessagePane persists during streaming
    expect(state.activeMessagePane).toBe('conversation');
    expect(state.streamingContent).toBe('Token 1 Token 2');

    // Generate conversation pane HTML with streaming content
    const conversationHtml = generateConversationPaneHtml(
      state.messages,
      state.streamingContent,
      state.activeAgentName
    );

    expect(conversationHtml).toContain('streaming');
    expect(conversationHtml).toContain('typing-indicator');
  });

  it('should route streaming tokens to collaboration pane for internal agent', () => {
    let state = createInitialChatState();

    // Set up with entry agent already completed
    state = addUserMessage(state, 'Request');
    state = { ...state, entryAgentName: 'Entry' };
    state = addAgentMessage(state, 'Entry', 'conversation');
    state = appendToStreamingContent(state, 'Routing...');
    state = finalizeAgentMessage(state);

    // Handoff
    state = addHandoffMessage(state, 'Entry', 'Process this');

    // Internal agent starts streaming
    state = addAgentMessage(state, 'Internal', 'collaboration');
    expect(state.activeMessagePane).toBe('collaboration');

    state = appendToStreamingContent(state, 'Processing');
    state = appendToStreamingContent(state, '...');

    // Verify activeMessagePane is collaboration
    expect(state.activeMessagePane).toBe('collaboration');

    // Generate collaboration pane HTML with streaming
    const collaborationHtml = generateCollaborationPaneHtml(
      state.messages,
      state.streamingContent,
      state.activeAgentName,
      state.activeMessagePane
    );

    expect(collaborationHtml).toContain('streaming');
    expect(collaborationHtml).toContain('typing-indicator');
  });

  it('should not show streaming indicator in wrong pane', () => {
    let state = createInitialChatState();

    state = addUserMessage(state, 'Test');
    state = { ...state, entryAgentName: 'Entry' };

    // Entry agent streaming in conversation pane
    state = addAgentMessage(state, 'Entry', 'conversation');
    state = appendToStreamingContent(state, 'Streaming content');

    // Collaboration pane should NOT show streaming indicator
    const collaborationHtml = generateCollaborationPaneHtml(
      state.messages,
      state.streamingContent,
      state.activeAgentName,
      state.activeMessagePane
    );

    // Should show empty state, not streaming
    expect(collaborationHtml).toContain('collaboration-empty-state');
    expect(collaborationHtml).not.toContain('streaming-text');
  });
});

// ============================================================================
// Integration Test 5: Pane Assignment Persists After Workflow Completion
// ============================================================================

describe('Integration Test 5: Pane assignment persists after workflow completion', () => {
  it('should maintain correct pane assignments after all agents complete', () => {
    let state = createInitialChatState();

    // Complete multi-agent workflow
    state = addUserMessage(state, 'Full workflow test');
    state = { ...state, entryAgentName: 'Entry' };
    state = addAgentMessage(state, 'Entry', 'conversation');
    state = appendToStreamingContent(state, 'Entry response');
    state = finalizeAgentMessage(state);

    state = addHandoffMessage(state, 'Entry', 'Handoff prompt');
    state = addAgentMessage(state, 'Middle', 'collaboration');
    state = appendToStreamingContent(state, 'Middle response');
    state = finalizeAgentMessage(state);

    state = addHandoffMessage(state, 'Middle', 'Second handoff');
    state = addAgentMessage(state, 'Final', 'collaboration');
    state = appendToStreamingContent(state, 'Final response');
    state = finalizeAgentMessage(state);

    // All streaming complete
    expect(state.activeAgentName).toBeNull();
    expect(state.activeMessagePane).toBeNull();
    expect(state.streamingContent).toBe('');

    // Verify all pane assignments persisted correctly
    expect(state.messages).toHaveLength(6);
    expect(state.messages[0].pane).toBe('conversation'); // User
    expect(state.messages[1].pane).toBe('conversation'); // Entry
    expect(state.messages[2].pane).toBe('collaboration'); // Handoff 1
    expect(state.messages[3].pane).toBe('collaboration'); // Middle
    expect(state.messages[4].pane).toBe('collaboration'); // Handoff 2
    expect(state.messages[5].pane).toBe('collaboration'); // Final

    // Generate and verify HTML
    const panelState: ChatPanelState = {
      session: state,
      ui: createInitialUiState(),
    };
    const html = generateChatPanelHtml(panelState);

    // All content should be present in correct panes
    expect(html).toContain('Full workflow test');
    expect(html).toContain('Entry response');
    expect(html).toContain('Handoff prompt');
    expect(html).toContain('Final response');
  });

  it('should clear activeMessagePane when message is finalized', () => {
    let state = createInitialChatState();

    state = addUserMessage(state, 'Test');
    state = addAgentMessage(state, 'Agent', 'conversation');
    expect(state.activeMessagePane).toBe('conversation');

    state = appendToStreamingContent(state, 'Content');
    expect(state.activeMessagePane).toBe('conversation');

    state = finalizeAgentMessage(state);
    expect(state.activeMessagePane).toBeNull();
  });
});

// ============================================================================
// Integration Test 6: CSS Styles Support Dual-Pane Layout
// ============================================================================

describe('Integration Test 6: CSS styles fully support dual-pane layout', () => {
  it('should include all required CSS classes for dual-pane rendering', () => {
    const styles = getDemoViewerChatStyles();

    // Dual-pane container classes
    expect(styles).toContain('.dual-pane-container');
    expect(styles).toContain('.pane-left');
    expect(styles).toContain('.pane-right');
    expect(styles).toContain('.pane-header');
    expect(styles).toContain('.pane-messages');

    // Empty state
    expect(styles).toContain('.collaboration-empty-state');

    // Sender message for handoffs
    expect(styles).toContain('.sender-message');
  });

  it('should have proper flexbox layout for 50/50 split', () => {
    const styles = getDemoViewerChatStyles();

    // Container should use flexbox
    expect(styles).toMatch(/\.dual-pane-container\s*\{[^}]*display:\s*flex/);

    // Both panes should have flex: 1 for equal width
    expect(styles).toMatch(/\.pane-left\s*\{[^}]*flex:\s*1/);
    expect(styles).toMatch(/\.pane-right\s*\{[^}]*flex:\s*1/);
  });
});

// ============================================================================
// Integration Test 7: NodeStartEvent Type Guards Work with New Fields
// ============================================================================

describe('Integration Test 7: NodeStartEvent type guards work with new fields', () => {
  it('should correctly identify NodeStartEvent with from_agent and handoff_prompt', () => {
    const eventWithNewFields: NodeStartEvent = {
      type: 'node_start',
      workflow_id: 'wf-test-123',
      timestamp: Date.now(),
      node_id: 'triage_agent',
      from_agent: null,
      handoff_prompt: 'User prompt text',
    };

    expect(isNodeStartEvent(eventWithNewFields)).toBe(true);
    expect(eventWithNewFields.from_agent).toBeNull();
    expect(eventWithNewFields.handoff_prompt).toBe('User prompt text');
  });

  it('should correctly identify NodeStartEvent for internal agent', () => {
    const internalAgentEvent: NodeStartEvent = {
      type: 'node_start',
      workflow_id: 'wf-test-456',
      timestamp: Date.now(),
      node_id: 'technical_agent',
      from_agent: 'triage_agent',
      handoff_prompt: 'Please analyze this data',
    };

    expect(isNodeStartEvent(internalAgentEvent)).toBe(true);
    expect(internalAgentEvent.from_agent).toBe('triage_agent');

    // Verify pane determination
    const pane = determineMessagePane(internalAgentEvent.from_agent);
    expect(pane).toBe('collaboration');
  });
});

// ============================================================================
// Integration Test 8: State Reset Clears All Dual-Pane State
// ============================================================================

describe('Integration Test 8: State reset clears all dual-pane state correctly', () => {
  it('should reset entryAgentName and activeMessagePane on new conversation', () => {
    let state = createInitialChatState();

    // Build up state
    state = addUserMessage(state, 'Initial question');
    state = { ...state, entryAgentName: 'Entry Agent' };
    state = addAgentMessage(state, 'Entry Agent', 'conversation');
    state = appendToStreamingContent(state, 'Response');
    state = finalizeAgentMessage(state);

    expect(state.entryAgentName).toBe('Entry Agent');
    expect(state.messages.length).toBeGreaterThan(0);

    // Reset state
    const newState = resetChatState();

    // Verify all dual-pane state is cleared
    expect(newState.entryAgentName).toBeNull();
    expect(newState.activeMessagePane).toBeNull();
    expect(newState.messages).toHaveLength(0);
    expect(newState.streamingContent).toBe('');

    // New workflow ID should be generated
    expect(newState.workflowId).not.toBe(state.workflowId);
  });

  it('should generate correct empty state HTML after reset', () => {
    const state = resetChatState();

    const panelState: ChatPanelState = {
      session: state,
      ui: createInitialUiState(),
    };
    const html = generateChatPanelHtml(panelState);

    // Both panes should show empty states
    expect(html).toContain('chat-empty-state');
    expect(html).toContain('collaboration-empty-state');
    expect(html).toContain('Enter a prompt');
    expect(html).toContain('No agent collaboration in this workflow');
  });
});
