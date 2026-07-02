/**
 * Workflow Engine
 *
 * Core engine that executes workflows.
 * Responsibilities:
 *   - Build TaskGraph from WorkflowDefinition
 *   - Manage task execution order
 *   - Handle retries and errors
 *   - Emit events
 *   - Track execution state
 *
 * The engine does NOT:
 *   - Handle scheduling (that's the Runtime's job)
 *   - Provide the execution environment (that's Context's job)
 */

import type { Logger } from '../logger/Logger'
import type { IEventBus } from '../events/types'
import type { WorkflowContext, WorkflowContextOptions } from './WorkflowContext'
import type { TaskExecutor } from './tasks/TaskExecutor'
import type { TaskInstance, TaskDefinition } from './tasks/Task'
import type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowResult,
  TaskResult,
  WorkflowState,
  TaskExecutionState,
} from './models/Workflow'
import { TaskGraph } from './tasks/TaskGraph'
import { WorkflowContext as WorkflowContextImpl } from './WorkflowContext'
import { generateExecutionId } from './models/Workflow'
import { createWorkflowEvent } from './events/WorkflowEvents'

export interface WorkflowEngineOptions {
  logger?: Logger
  events?: IEventBus
}

export class WorkflowEngine {
  private logger?: Logger
  private events?: IEventBus

  constructor(options: WorkflowEngineOptions = {}) {
    this.logger = options.logger
    this.events = options.events
  }

  /**
   * Create a TaskGraph from a workflow definition.
   */
  buildGraph(definition: WorkflowDefinition): TaskGraph {
    const graph = new TaskGraph()

    // Validate: check for duplicate task IDs
    const ids = new Set<string>()
    for (const task of definition.tasks) {
      if (ids.has(task.id)) {
        throw new Error(`Duplicate task ID: "${task.id}" in workflow "${definition.id}"`)
      }
      ids.add(task.id)
    }

    // Validate: check that all dependencies exist
    for (const task of definition.tasks) {
      for (const dep of task.dependencies) {
        if (!ids.has(dep)) {
          throw new Error(
            `Task "${task.id}" depends on non-existent task "${dep}" in workflow "${definition.id}"`,
          )
        }
      }
    }

    // Add tasks to graph
    graph.addNodes(definition.tasks)

    // Validate: no cycles
    if (graph.hasCycle()) {
      throw new Error(`Workflow "${definition.id}" contains a cycle`)
    }

    return graph
  }

  /**
   * Execute a workflow.
   * This is the main execution loop.
   */
  async execute(
    definition: WorkflowDefinition,
    input: Record<string, unknown>,
    executor: TaskExecutor,
    options?: {
      timeout?: number
      correlationId?: string
    },
  ): Promise<WorkflowResult> {
    const executionId = generateExecutionId()
    const correlationId = options?.correlationId ?? `wf_${Math.random().toString(16).slice(2, 10)}`

    // Create workflow context
    const ctx = WorkflowContextImpl.create({
      workflowId: definition.id,
      correlationId,
      logger: this.logger,
      events: this.events,
    })

    // Build task graph
    const graph = this.buildGraph(definition)

    // Track execution
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: definition.id,
      state: 'running',
      input,
      tasks: new Map(),
      startedAt: Date.now(),
      correlationId,
    }

    // Initialize task states
    for (const task of graph.getAllNodes()) {
      execution.tasks.set(task.definition.id, {
        taskId: task.definition.id,
        state: 'pending',
        retries: 0,
      })
    }

    // Emit workflow started event
    await this.events?.publish(
      createWorkflowEvent('workflow:started', {
        workflowId: definition.id,
        executionId,
        input,
      }),
    )

    try {
      // Get execution order (topological sort with parallel groups)
      const executionOrder = graph.getExecutionOrder()

      // Execute tasks level by level
      for (const level of executionOrder) {
        ctx.throwIfCancelled()

        // Execute tasks in this level (potentially parallel)
        const promises = level.map(async (taskId) => {
          const taskInstance = graph.getNode(taskId)
          if (!taskInstance) return

          // Check if dependencies are met
          const deps = graph.getDependencies(taskId)
          const depsMet = deps.every((depId) => {
            const depState = execution.tasks.get(depId)
            return depState?.state === 'completed' || depState?.state === 'skipped'
          })

          if (!depsMet) {
            execution.tasks.set(taskId, {
              ...execution.tasks.get(taskId)!,
              state: 'skipped',
            })
            return
          }

          // Execute the task
          await this.executeTask(taskInstance, executor, ctx, execution)
        })

        await Promise.all(promises)
      }

      // Check if all tasks completed
      const failedTasks = Array.from(execution.tasks.values()).filter(
        (t) => t.state === 'failed',
      )

      if (failedTasks.length > 0 && !definition.config?.continueOnFailure) {
        execution.state = 'failed'
        execution.error = `Tasks failed: ${failedTasks.map((t) => t.taskId).join(', ')}`
        execution.completedAt = Date.now()

        await this.events?.publish(
          createWorkflowEvent('workflow:failed', {
            workflowId: definition.id,
            executionId,
            error: execution.error,
          }),
        )

        return this.buildResult(execution)
      }

      // Success
      execution.state = 'completed'
      execution.completedAt = Date.now()
      execution.output = this.collectOutputs(graph, execution)

      await this.events?.publish(
        createWorkflowEvent('workflow:completed', {
          workflowId: definition.id,
          executionId,
          output: execution.output ?? {},
          duration: execution.completedAt - execution.startedAt,
        }),
      )

      return this.buildResult(execution)
    } catch (error) {
      execution.state = 'failed'
      execution.error = error instanceof Error ? error.message : String(error)
      execution.completedAt = Date.now()

      await this.events?.publish(
        createWorkflowEvent('workflow:failed', {
          workflowId: definition.id,
          executionId,
          error: execution.error,
        }),
      )

      return this.buildResult(execution)
    }
  }

  /**
   * Execute a single task with retry logic.
   */
  private async executeTask(
    task: TaskInstance,
    executor: TaskExecutor,
    ctx: WorkflowContext,
    execution: WorkflowExecution,
  ): Promise<void> {
    const taskId = task.definition.id
    const maxRetries = task.definition.maxRetries ?? 0
    const taskCtx = ctx.child(taskId)
    taskCtx.setTaskId(taskId)

    // Update task state
    execution.tasks.set(taskId, {
      ...execution.tasks.get(taskId)!,
      state: 'running',
      startedAt: Date.now(),
    })

    // Emit task started
    await this.events?.publish(
      createWorkflowEvent('task:started', {
        workflowId: execution.workflowId,
        executionId: execution.id,
        taskId,
        taskType: task.definition.type,
      }),
    )

    let lastError: string | undefined
    let retries = 0

    while (retries <= maxRetries) {
      try {
        const startTime = Date.now()
        const output = await executor.execute(task, taskCtx)
        const duration = Date.now() - startTime

        // Update task state
        execution.tasks.set(taskId, {
          ...execution.tasks.get(taskId)!,
          state: 'completed',
          output,
          completedAt: Date.now(),
          retries,
        })

        // Emit task completed
        await this.events?.publish(
          createWorkflowEvent('task:completed', {
            workflowId: execution.workflowId,
            executionId: execution.id,
            taskId,
            taskType: task.definition.type,
            output,
            duration,
          }),
        )

        return
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        retries++

        if (retries <= maxRetries) {
          // Emit retrying event
          await this.events?.publish(
            createWorkflowEvent('task:retrying', {
              workflowId: execution.workflowId,
              executionId: execution.id,
              taskId,
              retryCount: retries,
              maxRetries,
            }),
          )

          // Exponential backoff: 100ms, 200ms, 400ms, ...
          const delay = Math.min(100 * Math.pow(2, retries - 1), 5000)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    // All retries exhausted
    execution.tasks.set(taskId, {
      ...execution.tasks.get(taskId)!,
      state: 'failed',
      error: lastError,
      retries,
      completedAt: Date.now(),
    })

    // Emit task failed
    await this.events?.publish(
      createWorkflowEvent('task:failed', {
        workflowId: execution.workflowId,
        executionId: execution.id,
        taskId,
        taskType: task.definition.type,
        error: lastError ?? 'Unknown error',
        retries,
      }),
    )
  }

  /**
   * Collect outputs from all completed tasks.
   */
  private collectOutputs(
    graph: TaskGraph,
    execution: WorkflowExecution,
  ): Record<string, unknown> {
    const outputs: Record<string, unknown> = {}
    for (const [taskId, state] of execution.tasks) {
      if (state.state === 'completed' && state.output !== undefined) {
        outputs[taskId] = state.output
      }
    }
    return outputs
  }

  /**
   * Build the final result from execution.
   */
  private buildResult(execution: WorkflowExecution): WorkflowResult {
    const taskResults = new Map<string, TaskResult>()

    for (const [taskId, state] of execution.tasks) {
      taskResults.set(taskId, {
        success: state.state === 'completed',
        data: state.output,
        error: state.error,
        duration: (state.completedAt ?? Date.now()) - (state.startedAt ?? Date.now()),
        retries: state.retries,
      })
    }

    return {
      success: execution.state === 'completed',
      data: execution.output,
      error: execution.error,
      duration: (execution.completedAt ?? Date.now()) - execution.startedAt,
      taskResults,
    }
  }
}
