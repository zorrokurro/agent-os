/**
 * Workflow Events
 *
 * Events emitted by the workflow runtime.
 * All workflow-related events extend BaseEvent.
 */

import type { BaseEvent } from '../../events/types'

// ─── Workflow Events ─────────────────────────────────────────────────────────

export interface WorkflowStartedEvent extends BaseEvent {
  type: 'workflow:started'
  workflowId: string
  executionId: string
  input: Record<string, unknown>
}

export interface WorkflowCompletedEvent extends BaseEvent {
  type: 'workflow:completed'
  workflowId: string
  executionId: string
  output: Record<string, unknown>
  duration: number
}

export interface WorkflowFailedEvent extends BaseEvent {
  type: 'workflow:failed'
  workflowId: string
  executionId: string
  error: string
  taskId?: string
}

export interface WorkflowCancelledEvent extends BaseEvent {
  type: 'workflow:cancelled'
  workflowId: string
  executionId: string
  reason?: string
}

export interface WorkflowPausedEvent extends BaseEvent {
  type: 'workflow:paused'
  workflowId: string
  executionId: string
}

export interface WorkflowResumedEvent extends BaseEvent {
  type: 'workflow:resumed'
  workflowId: string
  executionId: string
}

// ─── Task Events ─────────────────────────────────────────────────────────────

export interface TaskStartedEvent extends BaseEvent {
  type: 'task:started'
  workflowId: string
  executionId: string
  taskId: string
  taskType: string
}

export interface TaskCompletedEvent extends BaseEvent {
  type: 'task:completed'
  workflowId: string
  executionId: string
  taskId: string
  taskType: string
  output: unknown
  duration: number
}

export interface TaskFailedEvent extends BaseEvent {
  type: 'task:failed'
  workflowId: string
  executionId: string
  taskId: string
  taskType: string
  error: string
  retries: number
}

export interface TaskRetryingEvent extends BaseEvent {
  type: 'task:retrying'
  workflowId: string
  executionId: string
  taskId: string
  retryCount: number
  maxRetries: number
}

export interface TaskSkippedEvent extends BaseEvent {
  type: 'task:skipped'
  workflowId: string
  executionId: string
  taskId: string
  reason: string
}

// ─── Type Union ──────────────────────────────────────────────────────────────

export type WorkflowEvent =
  | WorkflowStartedEvent
  | WorkflowCompletedEvent
  | WorkflowFailedEvent
  | WorkflowCancelledEvent
  | WorkflowPausedEvent
  | WorkflowResumedEvent
  | TaskStartedEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | TaskRetryingEvent
  | TaskSkippedEvent

export type WorkflowEventType = WorkflowEvent['type']

// ─── Event Factory ───────────────────────────────────────────────────────────

export function createWorkflowEvent<T extends WorkflowEvent>(
  type: T['type'],
  data: Omit<T, 'type' | 'timestamp'>,
): T {
  return {
    ...data,
    type,
    timestamp: Date.now(),
  } as T
}
