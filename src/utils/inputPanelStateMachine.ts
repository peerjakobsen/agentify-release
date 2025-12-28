/**
 * Input Panel State Machine
 * Manages valid state transitions for the workflow input panel
 */

import { InputPanelState } from '../types/inputPanel';

/**
 * Events that can trigger state transitions
 */
export type InputPanelEvent =
  | 'RUN_WORKFLOW'
  | 'WORKFLOW_COMPLETE'
  | 'WORKFLOW_ERROR'
  | 'RESET';

/**
 * Valid state transitions map
 * Key: current state, Value: array of valid next states
 */
const validTransitions: Record<InputPanelState, InputPanelState[]> = {
  [InputPanelState.Ready]: [InputPanelState.Running],
  [InputPanelState.Running]: [InputPanelState.Completed, InputPanelState.Error],
  [InputPanelState.Completed]: [InputPanelState.Ready, InputPanelState.Running],
  [InputPanelState.Error]: [InputPanelState.Ready, InputPanelState.Running],
};

/**
 * Event to state transition mapping
 */
const eventTransitions: Record<InputPanelEvent, Record<InputPanelState, InputPanelState | null>> = {
  RUN_WORKFLOW: {
    [InputPanelState.Ready]: InputPanelState.Running,
    [InputPanelState.Running]: null, // Cannot start while running
    [InputPanelState.Completed]: InputPanelState.Running,
    [InputPanelState.Error]: InputPanelState.Running,
  },
  WORKFLOW_COMPLETE: {
    [InputPanelState.Ready]: null,
    [InputPanelState.Running]: InputPanelState.Completed,
    [InputPanelState.Completed]: null,
    [InputPanelState.Error]: null,
  },
  WORKFLOW_ERROR: {
    [InputPanelState.Ready]: null,
    [InputPanelState.Running]: InputPanelState.Error,
    [InputPanelState.Completed]: null,
    [InputPanelState.Error]: null,
  },
  RESET: {
    [InputPanelState.Ready]: InputPanelState.Ready,
    [InputPanelState.Running]: null, // Cannot reset while running
    [InputPanelState.Completed]: InputPanelState.Ready,
    [InputPanelState.Error]: InputPanelState.Ready,
  },
};

/**
 * Checks if a state transition is valid
 *
 * @param from - Current state
 * @param to - Target state
 * @returns True if the transition is allowed
 */
export function canTransition(from: InputPanelState, to: InputPanelState): boolean {
  return validTransitions[from]?.includes(to) ?? false;
}

/**
 * Gets the next state for a given event
 *
 * @param current - Current panel state
 * @param event - Event that occurred
 * @returns The next state, or null if the transition is not valid
 */
export function getNextState(current: InputPanelState, event: InputPanelEvent): InputPanelState | null {
  return eventTransitions[event]?.[current] ?? null;
}

/**
 * Gets all valid events from a given state
 *
 * @param state - Current panel state
 * @returns Array of valid events from this state
 */
export function getValidEvents(state: InputPanelState): InputPanelEvent[] {
  const validEvents: InputPanelEvent[] = [];

  for (const event of Object.keys(eventTransitions) as InputPanelEvent[]) {
    if (eventTransitions[event][state] !== null) {
      validEvents.push(event);
    }
  }

  return validEvents;
}
