/**
 * Ideation Wizard Scripts
 * Client-side JavaScript for the ideation wizard panel
 */

/**
 * Get Ideation script
 */
export function getIdeationScript(): string {
  return `
      function nextStep() {
        vscode.postMessage({ command: 'nextStep' });
      }
      function previousStep() {
        vscode.postMessage({ command: 'previousStep' });
      }
      function goToStep(step) {
        vscode.postMessage({ command: 'goToStep', step });
      }
      function updateBusinessObjective(value) {
        vscode.postMessage({ command: 'updateBusinessObjective', value });
      }
      function updateIndustry(value) {
        vscode.postMessage({ command: 'updateIndustry', value });
      }
      function updateCustomIndustry(value) {
        vscode.postMessage({ command: 'updateCustomIndustry', value });
      }
      function toggleSystem(system) {
        vscode.postMessage({ command: 'toggleSystem', value: system });
      }
      function updateCustomSystems(value) {
        vscode.postMessage({ command: 'updateCustomSystems', value });
      }
      function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
          const arrayBuffer = e.target.result;
          const uint8Array = new Uint8Array(arrayBuffer);
          vscode.postMessage({
            command: 'uploadFile',
            file: {
              name: file.name,
              size: file.size,
              data: Array.from(uint8Array)
            }
          });
        };
        reader.readAsArrayBuffer(file);
      }
      function removeFile() {
        vscode.postMessage({ command: 'removeFile' });
      }
      function handleStateSync(message) {
        // State sync handled by full re-render
        // Auto-scroll chat to bottom after sync
        scrollChatToBottom();
      }
      function scrollChatToBottom() {
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }
      // Auto-scroll on initial load
      setTimeout(scrollChatToBottom, 100);
      // Step 2: AI Gap-Filling functions
      function sendChatMessage() {
        const input = document.getElementById('chatInput');
        if (input && input.value.trim()) {
          vscode.postMessage({ command: 'sendChatMessage', value: input.value.trim() });
          input.value = '';
        }
      }
      function handleChatKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendChatMessage();
        }
      }
      function acceptAssumptions() {
        vscode.postMessage({ command: 'acceptAssumptions' });
      }
      function regenerateAssumptions() {
        vscode.postMessage({ command: 'regenerateAssumptions' });
      }
      function retryLastMessage() {
        vscode.postMessage({ command: 'retryLastMessage' });
      }
      // Step 3: Outcome Definition functions
      function updatePrimaryOutcome(value) {
        vscode.postMessage({ command: 'updatePrimaryOutcome', value });
      }
      function addMetric() {
        vscode.postMessage({ command: 'addMetric' });
      }
      function removeMetric(index) {
        vscode.postMessage({ command: 'removeMetric', index });
      }
      function updateMetric(index, field, value) {
        vscode.postMessage({ command: 'updateMetric', index, field, value });
      }
      function toggleStakeholder(stakeholder) {
        vscode.postMessage({ command: 'toggleStakeholder', value: stakeholder });
      }
      function addCustomStakeholder() {
        const input = document.getElementById('customStakeholderInput');
        if (input && input.value.trim()) {
          vscode.postMessage({ command: 'addCustomStakeholder', value: input.value.trim() });
          input.value = '';
        }
      }
      function handleCustomStakeholderKeydown(event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          addCustomStakeholder();
        }
      }
      function regenerateOutcomeSuggestions() {
        vscode.postMessage({ command: 'regenerateOutcomeSuggestions' });
      }
      function dismissOutcomeError() {
        vscode.postMessage({ command: 'dismissOutcomeError' });
      }
      function acceptOutcomeSuggestions() {
        vscode.postMessage({ command: 'acceptOutcomeSuggestions' });
      }
      function sendOutcomeRefinement() {
        const input = document.getElementById('outcomeRefineInput');
        if (input && input.value.trim()) {
          vscode.postMessage({ command: 'sendOutcomeRefinement', value: input.value.trim() });
          input.value = '';
        }
      }
      function handleOutcomeRefineKeydown(event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          sendOutcomeRefinement();
        }
      }

      // Step 4: Security & Guardrails functions
      function updateDataSensitivity(value) {
        vscode.postMessage({ command: 'updateDataSensitivity', value });
      }
      function toggleComplianceFramework(framework) {
        vscode.postMessage({ command: 'toggleComplianceFramework', value: framework });
      }
      function toggleApprovalGate(gate) {
        vscode.postMessage({ command: 'toggleApprovalGate', value: gate });
      }
      function updateGuardrailNotes(value) {
        vscode.postMessage({ command: 'updateGuardrailNotes', value });
      }
      function skipSecurityStep() {
        vscode.postMessage({ command: 'skipSecurityStep' });
      }

      // Step 5: Agent Design functions - Phase 1
      function regenerateAgentProposal() {
        vscode.postMessage({ command: 'regenerateAgentProposal' });
      }
      function acceptAgentProposal() {
        vscode.postMessage({ command: 'acceptAgentProposal' });
      }
      function acceptSuggestionsPhase2() {
        vscode.postMessage({ command: 'acceptSuggestionsPhase2' });
      }
      function acceptAndContinue() {
        vscode.postMessage({ command: 'acceptAndContinue' });
      }
      function sendAgentDesignAdjustment() {
        const input = document.getElementById('adjustment-input');
        if (input && input.value.trim()) {
          vscode.postMessage({ command: 'sendAgentDesignAdjustment', value: input.value.trim() });
          input.value = '';
        }
      }
      function handleAdjustmentKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendAgentDesignAdjustment();
        }
      }
      function toggleOrchestrationReasoning() {
        const reasoningElement = document.querySelector('.orchestration-reasoning');
        if (reasoningElement) {
          reasoningElement.classList.toggle('expanded');
        }
        vscode.postMessage({ command: 'toggleOrchestrationReasoning' });
      }

      // Task 5.2: Step 5 Phase 2 - Agent Card Editing functions
      function updateAgentName(agentId, value) {
        vscode.postMessage({ command: 'updateAgentName', agentId, value });
      }
      function updateAgentRole(agentId, value) {
        vscode.postMessage({ command: 'updateAgentRole', agentId, value });
      }
      function removeAgentTool(agentId, toolIndex) {
        vscode.postMessage({ command: 'removeAgentTool', agentId, toolIndex });
      }
      function addAgentTool(agentId, tool) {
        vscode.postMessage({ command: 'addAgentTool', agentId, tool });
      }
      function handleToolInputKeydown(event, agentId) {
        // Handle Enter or comma to add tool
        if (event.key === 'Enter' || event.key === ',') {
          event.preventDefault();
          const input = event.target;
          let value = input.value.trim();
          // Remove trailing comma if comma was pressed
          if (value.endsWith(',')) {
            value = value.slice(0, -1).trim();
          }
          if (value) {
            addAgentTool(agentId, value);
            input.value = '';
          }
        }
      }

      // Task 5.3: Add/Remove Agent functions
      function addAgent() {
        vscode.postMessage({ command: 'addAgent' });
      }
      function removeAgent(agentId) {
        vscode.postMessage({ command: 'removeAgent', agentId });
      }

      // Task 5.4: Orchestration dropdown function
      function updateOrchestration(value) {
        vscode.postMessage({ command: 'updateOrchestration', value });
      }

      // Task 5.5: Edge suggestion functions
      function applyEdgeSuggestion() {
        vscode.postMessage({ command: 'applyEdgeSuggestion' });
      }
      function dismissEdgeSuggestion() {
        vscode.postMessage({ command: 'dismissEdgeSuggestion' });
      }

      // Task 5.6: Edge editing functions
      function updateEdge(index, field, value) {
        vscode.postMessage({ command: 'updateEdge', index, field, value });
      }
      function removeEdge(index) {
        vscode.postMessage({ command: 'removeEdge', index });
      }
      function addEdge() {
        vscode.postMessage({ command: 'addEdge' });
      }

      // Task 5.8: Confirm Design function
      function confirmDesign() {
        vscode.postMessage({ command: 'confirmDesign' });
      }

      // =========================================================================
      // Step 6: Mock Data Strategy functions (Task Group 6)
      // =========================================================================

      // Main dispatcher for Step 6 commands (called from HTML onclick handlers)
      function handleStep6Command(command, params) {
        switch (command) {
          case 'step6ToggleAccordion':
            vscode.postMessage({ command: 'step6ToggleAccordion', toolIndex: params.toolIndex });
            break;
          case 'step6UpdateRequest':
            vscode.postMessage({ command: 'step6UpdateRequest', toolIndex: params.toolIndex, value: params.value });
            break;
          case 'step6UpdateResponse':
            vscode.postMessage({ command: 'step6UpdateResponse', toolIndex: params.toolIndex, value: params.value });
            break;
          case 'step6AddRow':
            vscode.postMessage({ command: 'step6AddRow', toolIndex: params.toolIndex });
            break;
          case 'step6UpdateRow':
            vscode.postMessage({ command: 'step6UpdateRow', toolIndex: params.toolIndex, rowIndex: params.rowIndex, field: params.field, value: params.value });
            break;
          case 'step6DeleteRow':
            vscode.postMessage({ command: 'step6DeleteRow', toolIndex: params.toolIndex, rowIndex: params.rowIndex });
            break;
          case 'step6RegenerateAll':
            vscode.postMessage({ command: 'step6RegenerateAll' });
            break;
          case 'step6ImportData':
            vscode.postMessage({ command: 'step6ImportData', toolIndex: params.toolIndex });
            break;
          case 'step6ToggleTerminology':
            vscode.postMessage({ command: 'step6ToggleTerminology', enabled: params.enabled });
            break;
          default:
            console.warn('Unknown Step 6 command:', command);
        }
      }

      // Task 6.3: Toggle accordion for a tool definition
      function step6ToggleAccordion(toolIndex) {
        vscode.postMessage({ command: 'step6ToggleAccordion', toolIndex });
      }

      // Task 6.3: Update mock request schema
      function step6UpdateRequest(toolIndex, value) {
        vscode.postMessage({ command: 'step6UpdateRequest', toolIndex, value });
      }

      // Task 6.3: Update mock response schema
      function step6UpdateResponse(toolIndex, value) {
        vscode.postMessage({ command: 'step6UpdateResponse', toolIndex, value });
      }

      // Task 6.3: Add a new sample data row
      function step6AddRow(toolIndex) {
        vscode.postMessage({ command: 'step6AddRow', toolIndex });
      }

      // Task 6.3: Update a sample data row field
      function step6UpdateRow(toolIndex, rowIndex, field, value) {
        vscode.postMessage({ command: 'step6UpdateRow', toolIndex, rowIndex, field, value });
      }

      // Task 6.3: Delete a sample data row
      function step6DeleteRow(toolIndex, rowIndex) {
        vscode.postMessage({ command: 'step6DeleteRow', toolIndex, rowIndex });
      }

      // Task 6.3: Regenerate all mock definitions
      function step6RegenerateAll() {
        vscode.postMessage({ command: 'step6RegenerateAll' });
      }

      // Task 6.3: Import data for a specific tool
      function step6ImportData(toolIndex) {
        vscode.postMessage({ command: 'step6ImportData', toolIndex });
      }

      // Task 6.3: Toggle customer terminology refinement
      function step6ToggleTerminology(enabled) {
        vscode.postMessage({ command: 'step6ToggleTerminology', enabled });
      }
    `;
}
