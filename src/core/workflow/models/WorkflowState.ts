/**
 * Workflow & Task State Machine
 *
 * Defines all possible states for workflows and tasks.
 * Every state transition is explicit and auditable.
 *
 * State flow:
 *
 *   Pending → Queued → Running → Completed
 *                            ↓
 *                          Failed → Retrying → Running
 *                            ↓
 *                          Cancelled
 *                            ↓
 *                          Paused → Running
 */

// ─── Workflow States ─────────────────────────────────────────────────────────

export type WorkflowState =
  | 'pending'      // Created, not yet queued
  | 'queued'       // In the execution queue
  | 'running'      // Actively executing
  | 'paused'       // Temporarily suspended
  | 'completed'    // Finished successfully
  | 'failed'       // Finished with error
  | 'cancelled'    // Manually cancelled

// ─── Task States ─────────────────────────────────────────────────────────────

export type TaskState =
  | 'pending'      // Created, waiting for dependencies
  | 'ready'        // Dependencies met, ready to execute
  | 'queued'       // In the executor queue
  | 'running'      // Actively executing
  | 'paused'       // Temporarily suspended
  | 'completed'    // Finished successfully
  | 'failed'       // Finished with error
  | 'cancelled'    // Manually cancelled
  | 'skipped'      // Skipped (e.g., optional dependency failed)
  | 'retrying'     // Waiting to retry after failure

// ─── State Transitions ───────────────────────────────────────────────────────

/**
 * Valid state transitions for workflows.
 * Key = current state, Value = allowed next states.
 */
export const WORKFLOW_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  pending:   ['queued', 'cancelled'],
  queued:    ['running', 'cancelled'],
  running:   ['paused', 'completed', 'failed'],
  paused:    ['running', 'cancelled'],
  completed: [],
  failed:    ['retrying', 'cancelled'],
  cancelled: [],
}

/**
 * Valid state transitions for tasks.
 */
export const TASK_TRANSITIONS: Record<TaskState, TaskState[]> = {
  pending:   ['ready', 'cancelled', 'skipped'],
  ready:     ['queued', 'cancelled'],
  queued:    ['running', 'cancelled'],
  running:   ['paused', 'completed', 'failed'],
  paused:    ['running', 'cancelled'],
  completed: [],
  failed:    ['retrying', 'cancelled'],
  cancelled: [],
  skipped:   [],
  retrying:  ['queued'],
}

// ─── State Helpers ───────────────────────────────────────────────────────────

/**
 * Check if a state transition is valid.
 */
export function isValidTransition(
  current: WorkflowState,
  next: WorkflowState,
): boolean {
  return WORKFLOW_TRANSITIONS[current]?.includes(next) ?? false
}

export function isValidTaskTransition(
  current: TaskState,
  next: TaskState,
): boolean {
  return TASK_TRANSITIONS[current]?.includes(next) ?? false
}

/**
 * Check if a state is terminal (no further transitions).
 */
export function isTerminalState(state: WorkflowState): boolean {
  return state === 'completed' || state === 'cancelled'
}

export function isTerminalTaskState(state: TaskState): boolean {
  return state === 'completed' || state === 'cancelled' || state === 'skipped'
}

/**
 * Check if a state is active (currently doing work).
 */
export function isActiveState(state: WorkflowState | TaskState): boolean {
  return state === 'running' || state === 'paused'
}
