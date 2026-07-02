/**
 * Workflow Model
 *
 * Defines the structure of a workflow.
 * A workflow is a named, versioned collection of tasks with metadata.
 *
 * Workflows can be:
 *   - Defined in code (TypeScript)
 *   - Loaded from YAML/JSON
 *   - Created dynamically at runtime
 */

import type { TaskDefinition } from '../tasks/Task'

// ─── Workflow Definition ─────────────────────────────────────────────────────

export interface WorkflowDefinition {
  /** Unique workflow ID */
  id: string
  /** Display name */
  name: string
  /** Version (semver) */
  version: string
  /** Description */
  description?: string
  /** Task definitions */
  tasks: TaskDefinition[]
  /** Workflow-level config */
  config?: WorkflowConfig
  /** Tags for categorization */
  tags?: string[]
  /** Author */
  author?: string
  /** Created at */
  createdAt?: number
  /** Updated at */
  updatedAt?: number
}

export interface WorkflowConfig {
  /** Maximum execution time in milliseconds (0 = no limit) */
  timeout?: number
  /** Maximum retry attempts for failed tasks */
  maxRetries?: number
  /** Whether to continue on non-critical task failure */
  continueOnFailure?: boolean
  /** Variables available to all tasks */
  variables?: Record<string, unknown>
}

// ─── Workflow Execution ──────────────────────────────────────────────────────

export interface WorkflowExecution {
  /** Unique execution ID */
  id: string
  /** Workflow definition ID */
  workflowId: string
  /** Execution state */
  state: WorkflowState
  /** Input data */
  input: Record<string, unknown>
  /** Output data (set on completion) */
  output?: Record<string, unknown>
  /** Error message (set on failure) */
  error?: string
  /** Task states */
  tasks: Map<string, TaskExecutionState>
  /** Start time */
  startedAt: number
  /** End time */
  completedAt?: number
  /** Correlation ID */
  correlationId: string
}

export type WorkflowState =
  | 'pending'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface TaskExecutionState {
  taskId: string
  state: string
  retries: number
  startedAt?: number
  completedAt?: number
  error?: string
  output?: unknown
}

// ─── Workflow Result ─────────────────────────────────────────────────────────

export interface WorkflowResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  duration: number
  taskResults: Map<string, TaskResult>
}

export interface TaskResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  duration: number
  retries: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a workflow definition from a simple task list.
 * Tasks are executed sequentially in order.
 */
export function createSequentialWorkflow(
  id: string,
  name: string,
  tasks: TaskDefinition[],
): WorkflowDefinition {
  // Add dependencies to make tasks sequential
  const sequentialTasks = tasks.map((task, index) => {
    if (index === 0) return task
    return {
      ...task,
      dependencies: [tasks[index - 1].id],
    }
  })

  return {
    id,
    name,
    version: '1.0.0',
    tasks: sequentialTasks,
  }
}

/**
 * Create a workflow definition from a parallel/sequential pattern.
 */
export function createParallelWorkflow(
  id: string,
  name: string,
  parallelGroups: TaskDefinition[][],
): WorkflowDefinition {
  const tasks: TaskDefinition[] = []
  let previousGroup: string[] = []

  for (const group of parallelGroups) {
    for (const task of group) {
      tasks.push({
        ...task,
        dependencies: previousGroup.length > 0 ? [...previousGroup] : task.dependencies,
      })
    }
    previousGroup = group.map((t) => t.id)
  }

  return {
    id,
    name,
    version: '1.0.0',
    tasks,
  }
}

/**
 * Generate a unique execution ID.
 */
export function generateExecutionId(): string {
  return `exec_${Math.random().toString(16).slice(2, 10)}`
}
