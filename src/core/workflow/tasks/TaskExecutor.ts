/**
 * Task Executor Interface
 *
 * Pluggable execution strategy for running tasks.
 * The workflow engine delegates actual execution to an executor.
 *
 * Built-in executors:
 *   - SequentialExecutor: Run tasks one at a time
 *   - ParallelExecutor: Run independent tasks concurrently
 *
 * Future executors:
 *   - DistributedExecutor: Run tasks across multiple machines
 *   - StreamingExecutor: Run tasks with streaming output
 */

import type { WorkflowContext } from '../WorkflowContext'
import type { TaskInstance } from './Task'

export interface TaskExecutor {
  /**
   * Execute a single task.
   * Returns the task output on success, throws on failure.
   */
  execute(
    task: TaskInstance,
    context: WorkflowContext,
  ): Promise<unknown>

  /**
   * Check if this executor can handle the given task type.
   */
  canExecute(taskType: string): boolean

  /**
   * Optional: Cancel a running task.
   */
  cancel?(taskId: string): Promise<void>
}

// ─── Built-in Executors ──────────────────────────────────────────────────────

/**
 * Sequential Executor
 *
 * Runs tasks one at a time.
 * Simple, predictable, good for debugging.
 */
export class SequentialExecutor implements TaskExecutor {
  private handlers = new Map<string, TaskHandler>()

  registerHandler(taskType: string, handler: TaskHandler): void {
    this.handlers.set(taskType, handler)
  }

  async execute(task: TaskInstance, context: WorkflowContext): Promise<unknown> {
    const handler = this.handlers.get(task.definition.type)
    if (!handler) {
      throw new Error(`No handler registered for task type: ${task.definition.type}`)
    }
    return handler(task, context)
  }

  canExecute(taskType: string): boolean {
    return this.handlers.has(taskType)
  }
}

/**
 * Parallel Executor
 *
 * Runs independent tasks concurrently.
 * Uses the TaskGraph to determine what can run in parallel.
 */
export class ParallelExecutor implements TaskExecutor {
  private handlers = new Map<string, TaskHandler>()
  private maxConcurrency: number

  constructor(maxConcurrency: number = 10) {
    this.maxConcurrency = maxConcurrency
  }

  registerHandler(taskType: string, handler: TaskHandler): void {
    this.handlers.set(taskType, handler)
  }

  async execute(task: TaskInstance, context: WorkflowContext): Promise<unknown> {
    const handler = this.handlers.get(task.definition.type)
    if (!handler) {
      throw new Error(`No handler registered for task type: ${task.definition.type}`)
    }
    return handler(task, context)
  }

  canExecute(taskType: string): boolean {
    return this.handlers.has(taskType)
  }

  /**
   * Execute multiple tasks in parallel (up to maxConcurrency).
   */
  async executeBatch(
    tasks: TaskInstance[],
    context: WorkflowContext,
  ): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>()
    const executing = new Set<Promise<void>>()

    for (const task of tasks) {
      const promise = this.execute(task, context)
        .then((result) => {
          results.set(task.definition.id, result)
        })
        .catch((error) => {
          results.set(task.definition.id, { error: error.message })
        })

      executing.add(promise)
      promise.finally(() => executing.delete(promise))

      if (executing.size >= this.maxConcurrency) {
        await Promise.race(executing)
      }
    }

    await Promise.all(executing)
    return results
  }
}

// ─── Task Handler ────────────────────────────────────────────────────────────

/**
 * A function that handles a specific task type.
 */
export type TaskHandler = (
  task: TaskInstance,
  context: WorkflowContext,
) => Promise<unknown>

/**
 * Simple task handler registry.
 * Use this to register handlers for different task types.
 */
export class TaskHandlerRegistry {
  private handlers = new Map<string, TaskHandler>()

  register(taskType: string, handler: TaskHandler): void {
    this.handlers.set(taskType, handler)
  }

  get(taskType: string): TaskHandler | undefined {
    return this.handlers.get(taskType)
  }

  has(taskType: string): boolean {
    return this.handlers.has(taskType)
  }

  /**
   * Create a SequentialExecutor with all registered handlers.
   */
  toExecutor(): SequentialExecutor {
    const executor = new SequentialExecutor()
    for (const [type, handler] of this.handlers) {
      executor.registerHandler(type, handler)
    }
    return executor
  }
}
