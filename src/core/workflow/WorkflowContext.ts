/**
 * Workflow Context
 *
 * Shared context passed to every task during execution.
 * Provides access to all Core SDK services without direct imports.
 *
 * Usage:
 *   const ctx = WorkflowContext.create({ workflowId: 'wf_1', correlationId: 'req_abc' })
 *   ctx.logger.info('Task starting')
 *   await ctx.events.publish({ type: 'task:started', ... })
 */

import type { Logger } from '../logger/Logger'
import type { IEventBus, BaseEvent } from '../events/types'

export interface WorkflowContextData {
  /** Unique workflow execution ID */
  workflowId: string
  /** Correlation ID for tracing across modules */
  correlationId: string
  /** Task ID within the workflow (set by executor) */
  taskId?: string
  /** Shared state between tasks */
  state: Record<string, unknown>
  /** Abort signal for cancellation */
  signal?: AbortSignal
}

export interface WorkflowContextOptions {
  workflowId: string
  correlationId?: string
  logger?: Logger
  events?: IEventBus
  signal?: AbortSignal
}

export class WorkflowContext {
  readonly workflowId: string
  readonly correlationId: string
  readonly logger: Logger
  readonly events: IEventBus
  readonly state: Record<string, unknown>
  readonly signal?: AbortSignal
  private _taskId?: string

  private constructor(data: WorkflowContextData, logger: Logger, events: IEventBus) {
    this.workflowId = data.workflowId
    this.correlationId = data.correlationId
    this.state = data.state
    this.signal = data.signal
    this.logger = logger
    this.events = events
  }

  /**
   * Create a new WorkflowContext.
   */
  static create(options: WorkflowContextOptions): WorkflowContext {
    const correlationId = options.correlationId ?? `wf_${Math.random().toString(16).slice(2, 10)}`
    const logger = options.logger?.child(correlationId) ?? { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as Logger

    return new WorkflowContext(
      {
        workflowId: options.workflowId,
        correlationId,
        state: {},
        signal: options.signal,
      },
      logger,
      options.events ?? { publish: async () => {}, subscribe: () => ({ unsubscribe: () => {} }), onAny: () => ({ unsubscribe: () => {} }), clear: () => {}, subscriberCount: () => 0 },
    )
  }

  /**
   * Create a child context for a specific task.
   */
  child(taskId: string): WorkflowContext {
    const childLogger = 'child' in this.logger
      ? (this.logger as Logger).child(taskId)
      : this.logger

    const child = new WorkflowContext(
      {
        workflowId: this.workflowId,
        correlationId: this.correlationId,
        taskId,
        state: { ...this.state },
        signal: this.signal,
      },
      childLogger,
      this.events,
    )
    child.setTaskId(taskId)
    return child
  }

  /**
   * Get the current task ID.
   */
  get taskId(): string | undefined {
    return this._taskId
  }

  /**
   * Set the task ID (called by executor).
   */
  setTaskId(taskId: string): void {
    this._taskId = taskId
  }

  /**
   * Check if the workflow has been cancelled.
   */
  get isCancelled(): boolean {
    return this.signal?.aborted ?? false
  }

  /**
   * Throw if cancelled. Use this in long-running tasks to check for cancellation.
   */
  throwIfCancelled(): void {
    if (this.isCancelled) {
      throw new DOMException('Workflow cancelled', 'AbortError')
    }
  }

  /**
   * Get a value from shared state.
   */
  get<T = unknown>(key: string): T | undefined {
    return this.state[key] as T | undefined
  }

  /**
   * Set a value in shared state.
   */
  set(key: string, value: unknown): void {
    this.state[key] = value
  }

  /**
   * Publish an event through the event bus.
   */
  async emit<T extends BaseEvent>(event: T): Promise<void> {
    await this.events.publish(event)
  }
}
