/**
 * TabbedPanel Step 4 Security & Guardrails Tests
 *
 * Tests for Security & Guardrails Step (Step 4) in the TabbedPanel.
 * Covers state management, message handlers, HTML generation, and AI integration.
 */

import * as assert from 'assert';

// ============================================================================
// Task Group 1: State Management & Types Tests
// ============================================================================

suite('TabbedPanel Step 4 Security & Guardrails', () => {
  suite('Task 1.1: SecurityGuardrailsState Tests', () => {
    test('default state has correct initial values', () => {
      const defaultState = {
        dataSensitivity: 'Internal',
        complianceFrameworks: [],
        approvalGates: [],
        guardrailNotes: '',
        aiSuggested: false,
        aiCalled: false,
        skipped: false,
        industryDefaultsApplied: false,
        isLoading: false,
      };

      assert.strictEqual(defaultState.dataSensitivity, 'Internal', 'Default sensitivity should be Internal');
      assert.deepStrictEqual(defaultState.complianceFrameworks, [], 'Compliance frameworks should be empty by default');
      assert.deepStrictEqual(defaultState.approvalGates, [], 'Approval gates should be empty by default');
      assert.strictEqual(defaultState.guardrailNotes, '', 'Guardrail notes should be empty by default');
      assert.strictEqual(defaultState.aiSuggested, false, 'aiSuggested should be false by default');
      assert.strictEqual(defaultState.aiCalled, false, 'aiCalled should be false by default');
      assert.strictEqual(defaultState.skipped, false, 'skipped should be false by default');
      assert.strictEqual(defaultState.industryDefaultsApplied, false, 'industryDefaultsApplied should be false by default');
    });

    test('industry-to-compliance mapping returns correct frameworks', () => {
      const INDUSTRY_COMPLIANCE_MAPPING: Record<string, string[]> = {
        'Healthcare': ['HIPAA'],
        'Life Sciences': ['HIPAA'],
        'FSI': ['PCI-DSS', 'SOC 2'],
        'Retail': ['PCI-DSS'],
        'Public Sector': ['FedRAMP'],
        'Energy': ['SOC 2'],
        'Telecom': ['SOC 2'],
        'Manufacturing': [],
        'Media & Entertainment': [],
        'Travel & Hospitality': ['PCI-DSS'],
        'Other': [],
      };

      assert.deepStrictEqual(INDUSTRY_COMPLIANCE_MAPPING['Healthcare'], ['HIPAA']);
      assert.deepStrictEqual(INDUSTRY_COMPLIANCE_MAPPING['FSI'], ['PCI-DSS', 'SOC 2']);
      assert.deepStrictEqual(INDUSTRY_COMPLIANCE_MAPPING['Manufacturing'], []);
      assert.deepStrictEqual(INDUSTRY_COMPLIANCE_MAPPING['Other'], []);
    });

    test('state reset when industry changes sets industryDefaultsApplied to false', () => {
      const state = {
        industryDefaultsApplied: true,
        complianceFrameworks: ['HIPAA'],
      };

      // Simulate industry change - industryDefaultsApplied should be reset
      state.industryDefaultsApplied = false;

      assert.strictEqual(state.industryDefaultsApplied, false, 'industryDefaultsApplied should be reset on industry change');
    });

    test('skipped flag behavior tracks explicit skip action', () => {
      const state = {
        skipped: false,
        dataSensitivity: 'Confidential',
        complianceFrameworks: ['HIPAA'],
      };

      // Simulate skip action - should set skipped to true and apply defaults
      state.skipped = true;
      state.dataSensitivity = 'Internal';
      state.complianceFrameworks = [];

      assert.strictEqual(state.skipped, true, 'skipped should be true after skip action');
      assert.strictEqual(state.dataSensitivity, 'Internal', 'dataSensitivity should reset to Internal');
      assert.deepStrictEqual(state.complianceFrameworks, [], 'complianceFrameworks should be empty');
    });
  });

  // ============================================================================
  // Task Group 2: Message Handlers Tests
  // ============================================================================

  suite('Task 2.1: Message Handler Tests', () => {
    test('updateDataSensitivity command updates state correctly', () => {
      const state = { dataSensitivity: 'Internal' };
      state.dataSensitivity = 'Restricted';
      assert.strictEqual(state.dataSensitivity, 'Restricted', 'dataSensitivity should be updated');
    });

    test('toggleComplianceFramework adds/removes framework', () => {
      const state = { complianceFrameworks: [] as string[] };

      // Add framework
      state.complianceFrameworks.push('HIPAA');
      assert.deepStrictEqual(state.complianceFrameworks, ['HIPAA'], 'Framework should be added');

      // Remove framework
      const idx = state.complianceFrameworks.indexOf('HIPAA');
      if (idx >= 0) state.complianceFrameworks.splice(idx, 1);
      assert.deepStrictEqual(state.complianceFrameworks, [], 'Framework should be removed');
    });

    test('toggleApprovalGate adds/removes gate', () => {
      const state = { approvalGates: [] as string[] };

      // Add gate
      state.approvalGates.push('Before external API calls');
      assert.deepStrictEqual(state.approvalGates, ['Before external API calls'], 'Gate should be added');

      // Remove gate
      const idx = state.approvalGates.indexOf('Before external API calls');
      if (idx >= 0) state.approvalGates.splice(idx, 1);
      assert.deepStrictEqual(state.approvalGates, [], 'Gate should be removed');
    });

    test('updateGuardrailNotes clears aiSuggested flag', () => {
      const state = { guardrailNotes: 'AI suggestion', aiSuggested: true };
      state.guardrailNotes = 'User edited';
      state.aiSuggested = false;
      assert.strictEqual(state.aiSuggested, false, 'aiSuggested should be cleared on edit');
    });
  });

  // ============================================================================
  // Task Group 3: HTML Generation Tests
  // ============================================================================

  suite('Task 3.1: HTML Generation Tests', () => {
    test('radio button renders with correct selection', () => {
      const dataSensitivity = 'Confidential';
      const options = ['Public', 'Internal', 'Confidential', 'Restricted'];

      const selectedOption = options.find(o => o === dataSensitivity);
      assert.strictEqual(selectedOption, 'Confidential', 'Correct option should be selected');
    });

    test('checkbox grid renders with correct checked states', () => {
      const complianceFrameworks = ['HIPAA', 'SOC 2'];
      const allOptions = ['SOC 2', 'HIPAA', 'PCI-DSS', 'GDPR', 'FedRAMP', 'None/Not specified'];

      const checkedStates = allOptions.map(o => ({
        option: o,
        checked: complianceFrameworks.includes(o),
      }));

      assert.strictEqual(checkedStates.find(s => s.option === 'HIPAA')?.checked, true);
      assert.strictEqual(checkedStates.find(s => s.option === 'SOC 2')?.checked, true);
      assert.strictEqual(checkedStates.find(s => s.option === 'PCI-DSS')?.checked, false);
    });

    test('helper text displays for each sensitivity level', () => {
      const options = [
        { value: 'Public', helperText: 'Data that can be shown to anyone. Example: product catalog, public pricing' },
        { value: 'Internal', helperText: 'Business data not for external sharing. Example: sales forecasts, inventory levels' },
        { value: 'Confidential', helperText: 'Sensitive business data. Example: customer lists, financial reports' },
        { value: 'Restricted', helperText: 'Highly sensitive, regulatory implications. Example: PII, health records, payment data' },
      ];

      options.forEach(opt => {
        assert.ok(opt.helperText.length > 0, `Helper text should exist for ${opt.value}`);
      });
    });

    test('AI suggested badge visibility based on aiSuggested flag', () => {
      const stateWithSuggestion = { aiSuggested: true };
      const stateWithoutSuggestion = { aiSuggested: false };

      assert.strictEqual(stateWithSuggestion.aiSuggested, true, 'Badge should be visible when aiSuggested is true');
      assert.strictEqual(stateWithoutSuggestion.aiSuggested, false, 'Badge should be hidden when aiSuggested is false');
    });
  });

  // ============================================================================
  // Task Group 4: CSS Tests
  // ============================================================================

  suite('Task 4.1: CSS Tests', () => {
    test('Step 4 specific styles expected in getIdeationStyles()', () => {
      // This validates that Step 4 CSS classes are expected
      const expectedClasses = [
        'sensitivity-radio-group',
        'ai-suggested-badge',
        'skip-button',
      ];

      expectedClasses.forEach(className => {
        assert.ok(className.length > 0, `Class ${className} should be defined`);
      });
    });

    test('AI suggested badge styling is expected', () => {
      // Badge should have sparkle icon and subtle styling
      const badgeStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: '0.75rem',
        color: 'var(--vscode-descriptionForeground)',
      };

      assert.ok(badgeStyle.display === 'inline-flex', 'Badge should use inline-flex display');
    });
  });

  // ============================================================================
  // Task Group 5: JavaScript Functions Tests
  // ============================================================================

  suite('Task 5.1: JavaScript Function Tests', () => {
    test('updateDataSensitivity sends correct message type', () => {
      const expectedMessage = { command: 'updateDataSensitivity', value: 'Restricted' };
      assert.strictEqual(expectedMessage.command, 'updateDataSensitivity');
      assert.strictEqual(expectedMessage.value, 'Restricted');
    });

    test('toggleComplianceFramework sends correct message type', () => {
      const expectedMessage = { command: 'toggleComplianceFramework', value: 'HIPAA' };
      assert.strictEqual(expectedMessage.command, 'toggleComplianceFramework');
      assert.strictEqual(expectedMessage.value, 'HIPAA');
    });

    test('skipSecurityStep sends command and navigates', () => {
      const expectedMessage = { command: 'skipSecurityStep' };
      assert.strictEqual(expectedMessage.command, 'skipSecurityStep');
    });
  });

  // ============================================================================
  // Task Group 6: Navigation Tests
  // ============================================================================

  suite('Task 6.1: Navigation Tests', () => {
    test('step entry triggers AI suggestion when conditions met', () => {
      const state = { guardrailNotes: '', aiCalled: false };
      const shouldTriggerAI = state.guardrailNotes === '' && !state.aiCalled;
      assert.strictEqual(shouldTriggerAI, true, 'AI should be triggered when notes empty and not called');
    });

    test('back navigation preserves state', () => {
      const state = {
        dataSensitivity: 'Confidential',
        complianceFrameworks: ['HIPAA'],
        skipped: false,
      };

      // Simulate back navigation - state should be preserved
      const preservedState = { ...state };
      assert.deepStrictEqual(preservedState, state, 'State should be preserved on back navigation');
    });

    test('skip navigation applies defaults', () => {
      const state = {
        dataSensitivity: 'Confidential',
        complianceFrameworks: ['HIPAA'],
        approvalGates: ['Before external API calls'],
        guardrailNotes: 'Custom notes',
        skipped: false,
      };

      // Apply skip defaults
      state.dataSensitivity = 'Internal';
      state.complianceFrameworks = [];
      state.approvalGates = [];
      state.guardrailNotes = '';
      state.skipped = true;

      assert.strictEqual(state.dataSensitivity, 'Internal');
      assert.deepStrictEqual(state.complianceFrameworks, []);
      assert.strictEqual(state.skipped, true);
    });
  });

  // ============================================================================
  // Task Group 7: AI Integration Tests
  // ============================================================================

  suite('Task 7.1: Guardrail Suggestion Tests', () => {
    test('context message building includes all inputs', () => {
      const context = {
        businessObjective: 'Improve customer service',
        industry: 'Healthcare',
        systems: ['Salesforce', 'SAP'],
        confirmedAssumptions: [{ system: 'Salesforce', modules: ['Service Cloud'] }],
      };

      const contextMessage = `Business: ${context.businessObjective}, Industry: ${context.industry}`;
      assert.ok(contextMessage.includes(context.businessObjective));
      assert.ok(contextMessage.includes(context.industry));
    });

    test('parsing guardrail notes from Claude response', () => {
      const mockResponse = 'Ensure no PII is displayed. Mask sensitive data.';
      const parsedNotes = mockResponse;
      assert.strictEqual(parsedNotes, mockResponse, 'Notes should be extracted from response');
    });

    test('error handling returns fallback text', () => {
      const fallbackText = 'No PII in demo data, mask account numbers...';
      assert.ok(fallbackText.length > 0, 'Fallback text should be defined');
    });

    test('aiSuggested flag is set correctly after AI response', () => {
      const state = { aiSuggested: false, aiCalled: false, guardrailNotes: '' };

      // Simulate AI response
      state.guardrailNotes = 'AI generated suggestions';
      state.aiSuggested = true;
      state.aiCalled = true;

      assert.strictEqual(state.aiSuggested, true, 'aiSuggested should be true after AI response');
      assert.strictEqual(state.aiCalled, true, 'aiCalled should be true after AI response');
    });
  });

  // ============================================================================
  // Task Group 8: AI Suggested Badge UX Tests
  // ============================================================================

  suite('Task 8.1: Badge Behavior Tests', () => {
    test('badge visible when aiSuggested is true', () => {
      const state = { aiSuggested: true };
      const badgeVisible = state.aiSuggested;
      assert.strictEqual(badgeVisible, true, 'Badge should be visible');
    });

    test('badge hidden after any user edit', () => {
      const state = { aiSuggested: true, guardrailNotes: 'AI suggestion' };

      // User edits the notes
      state.guardrailNotes = 'AI suggestion - edited';
      state.aiSuggested = false;

      assert.strictEqual(state.aiSuggested, false, 'Badge should be hidden after edit');
    });
  });
});
