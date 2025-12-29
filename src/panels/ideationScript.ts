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

      // Step 5: Agent Design functions
      function regenerateAgentProposal() {
        vscode.postMessage({ command: 'regenerateAgentProposal' });
      }
      function acceptAgentProposal() {
        vscode.postMessage({ command: 'acceptAgentProposal' });
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
    `;
}
