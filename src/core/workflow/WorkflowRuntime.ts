/**
 * Workflow Runtime
 *
 * Top-level orchestrator for all workflows.
 * Responsibilities:
 *   - Register and manage workflow definitions
 *   - Start/stop/pause/resume workflows
 *   - Queue and schedule workflow execution
 *   - Manage the Command Bus
 *   - Integrate with EventBus
 *
 * Usage:
 *   const runtime = new WorkflowRuntime({ logger, events })
 *
 *   // Register workflows
 *   runtime.registerWorkflow(myWorkflow)
 *
 *   // Execute
 *   const result = await runtime.run('my-workflow', { input: 'data' })
 *
 *   // Or use commands
 *   await runtime.execute('run:workflow', { workflowId: 'my-workflow', input: {} }, ctx)
 */

import type { Logger } from '../logger/Logger'
import type { IEventBus } from '../events/types'
import type { WorkflowContext } from './WorkflowContext'
import type { TaskExecutor, TaskHandler } from './tasks/TaskExecutor'
import type { WorkflowDefinition, WorkflowResult } from './models/Workflow'
import { CommandBus } from './commands/CommandBus'
import { WorkflowEngine } from './WorkflowEngine'
import { WorkflowContext as WorkflowContextImpl } from './WorkflowContext'
import { SequentialExecutor, ParallelExecutor } from './tasks/TaskExecutor'
import { createWorkflowEvent } from './events/WorkflowEvents'

export interface WorkflowRuntimeOptions {
  logger?: Logger
  events?: IEventBus
  /** Default executor type: 'sequential' or 'parallel' */
  defaultExecutor?: 'sequential' | 'parallel'
  /** Max parallel tasks (only for parallel executor) */
  maxConcurrency?: number
}

export interface WorkflowRuntimeStats {
  registeredWorkflows: number
  registeredHandlers: number
  activeExecutions: number
  totalExecuted: number
  totalSucceeded: number
  totalFailed: number
}

export class WorkflowRuntime {
  private workflows = new Map<string, WorkflowDefinition>()
  private handlerRegistry = new Map<string, TaskHandler>()
  private activeExecutions = new Map<string, AbortController>()
  private commandBus: CommandBus
  private engine: WorkflowEngine
  private logger?: Logger
  private events?: IEventBus
  private defaultExecutorType: 'sequential' | 'parallel'
  private maxConcurrency: number

  // Stats
  private stats = {
    totalExecuted: 0,
    totalSucceeded: 0,
    totalFailed: 0,
  }

  constructor(options: WorkflowRuntimeOptions = {}) {
    this.logger = options.logger
    this.events = options.events
    this.defaultExecutorType = options.defaultExecutor ?? 'sequential'
    this.maxConcurrency = options.maxConcurrency ?? 10

    this.engine = new WorkflowEngine({ logger: this.logger, events: this.events })
    this.commandBus = new CommandBus(this.logger)

    this.registerBuiltinCommands()
  }

  // ─── Workflow Management ─────────────────────────────────────────────────

  /**
   * Register a workflow definition.
   */
  registerWorkflow(definition: WorkflowDefinition): void {
    if (this.workflows.has(definition.id)) {
      throw new Error(`Workflow "${definition.id}" already registered`)
    }
    this.workflows.set(definition.id, definition)
    this.logger?.info(`Workflow registered: ${definition.id}`)
  }

  /**
   * Get a registered workflow.
   */
  getWorkflow(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id)
  }

  /**
   * Get all registered workflow IDs.
   */
  getWorkflowIds(): string[] {
    return Array.from(this.workflows.keys())
  }

  /**
   * Unregister a workflow.
   */
  unregisterWorkflow(id: string): boolean {
    return this.workflows.delete(id)
  }

  // ─── Task Handler Registration ──────────────────────────────────────────

  /**
   * Register a task handler for a specific task type.
   */
  registerHandler(taskType: string, handler: TaskHandler): void {
    if (this.handlerRegistry.has(taskType)) {
      throw new Error(`Handler already registered for task type: "${taskType}"`)
    }
    this.handlerRegistry.set(taskType, handler)
  }

  /**
   * Get the command bus.
   */
  getCommandBus(): CommandBus {
    return this.commandBus
  }

  // ─── Execution ──────────────────────────────────────────────────────────

  /**
   * Run a workflow by ID.
   * This is the main entry point for executing workflows.
   */
  async run(
    workflowId: string,
    input: Record<string, unknown> = {},
    options?: {
      timeout?: number
      correlationId?: string
      executor?: TaskExecutor
    },
  ): Promise<WorkflowResult> {
    const definition = this.workflows.get(workflowId)
    if (!definition) {
      throw new Error(`Workflow "${workflowId}" not registered`)
    }

    const executor = options?.executor ?? this.createExecutor()
    const executionId = `exec_${Math.random().toString(16).slice(2, 10)}`

    this.activeExecutions.set(executionId, new AbortController())
    this.stats.totalExecuted++

    try {
      const result = await this.engine.execute(definition, input, executor, {
        timeout: options?.timeout,
        correlationId: options?.correlationId,
      })

      if (result.success) {
        this.stats.totalSucceeded++
      } else {
        this.stats.totalFailed++
      }

      return result
    } finally {
      this.activeExecutions.delete(executionId)
    }
  }

  /**
   * Cancel a running workflow.
   */
  async cancel(executionId: string, reason?: string): Promise<void> {
    const controller = this.activeExecutions.get(executionId)
    if (controller) {
      controller.abort()
      this.logger?.info(`Workflow cancelled: ${executionId}`, { reason })
    }
  }

  // ─── Stats ──────────────────────────────────────────────────────────────

  /**
   * Get runtime statistics.
   */
  getStats(): WorkflowRuntimeStats {
    return {
      registeredWorkflows: this.workflows.size,
      registeredHandlers: this.handlerRegistry.size,
      activeExecutions: this.activeExecutions.size,
      totalExecuted: this.stats.totalExecuted,
      totalSucceeded: this.stats.totalSucceeded,
      totalFailed: this.stats.totalFailed,
    }
  }

  // ─── Builtin Commands ──────────────────────────────────────────────────

  private registerBuiltinCommands(): void {
    this.commandBus.register('run:workflow', async (cmd, ctx) => {
      const workflowId = (cmd as { workflowId: string }).workflowId
      const input = (cmd as { input?: Record<string, unknown> }).input ?? {}
      return this.run(workflowId, input, { correlationId: ctx.correlationId })
    })

    this.commandBus.register('cancel:workflow', async (cmd, ctx) => {
      const executionId = (cmd as { executionId: string }).executionId
      const reason = (cmd as { reason?: string }).reason
      await this.cancel(executionId, reason)
      return { cancelled: true }
    })
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private createExecutor(): TaskExecutor {
    if (this.defaultExecutorType === 'parallel') {
      return new ParallelExecutor(this.maxConcurrency)
    }

    const executor = new SequentialExecutor()
    for (const [type, handler] of this.handlerRegistry) {
      executor.registerHandler(type, handler)
    }
    return executor
  }
}
