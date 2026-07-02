/**
 * Command Bus
 *
 * Implements the Command pattern:
 *   Command → Handler → Result + Events
 *
 * Rules:
 *   - Every command has exactly one handler
 *   - Commands are simple data objects
 *   - Handlers execute logic and publish events
 *   - Commands are processed sequentially (no parallel execution)
 *
 * Usage:
 *   const bus = new CommandBus()
 *
 *   bus.register('run:workflow', async (cmd, ctx) => {
 *     // execute workflow
 *     await ctx.events.publish({ type: 'workflow:completed', ... })
 *     return { success: true }
 *   })
 *
 *   const result = await bus.execute('run:workflow', { workflowId: '1' }, ctx)
 */

import type { WorkflowContext } from '../WorkflowContext'
import type { Logger } from '../../logger/Logger'

// ─── Command Types ───────────────────────────────────────────────────────────

/**
 * Base command interface.
 * All commands must have a `type` string.
 */
export interface Command {
  /** Command type identifier */
  type: string
  /** Timestamp */
  timestamp: number
  /** Correlation ID */
  correlationId?: string
}

/**
 * Command handler function.
 * Receives the command and workflow context.
 * Returns a result of type R.
 */
export type CommandHandler<C extends Command = Command, R = unknown> = (
  command: C,
  context: WorkflowContext,
) => Promise<R>

/**
 * Command result wrapper.
 */
export interface CommandResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ─── Built-in Commands ───────────────────────────────────────────────────────

export interface RunWorkflowCommand extends Command {
  type: 'run:workflow'
  workflowId: string
  input: Record<string, unknown>
}

export interface CancelWorkflowCommand extends Command {
  type: 'cancel:workflow'
  workflowId: string
  reason?: string
}

export interface PauseWorkflowCommand extends Command {
  type: 'pause:workflow'
  workflowId: string
}

export interface ResumeWorkflowCommand extends Command {
  type: 'resume:workflow'
  workflowId: string
}

export interface ExecuteTaskCommand extends Command {
  type: 'execute:task'
  workflowId: string
  taskId: string
  input: Record<string, unknown>
}

export interface CreateNotebookCommand extends Command {
  type: 'create:notebook'
  name: string
  description?: string
  icon?: string
  color?: string
}

export interface DeleteNotebookCommand extends Command {
  type: 'delete:notebook'
  notebookId: string
}

export interface StartAgentCommand extends Command {
  type: 'start:agent'
  agentId: string
}

export interface StopAgentCommand extends Command {
  type: 'stop:agent'
  agentId: string
}

// ─── Command Bus ─────────────────────────────────────────────────────────────

export class CommandBus {
  private handlers = new Map<string, CommandHandler>()
  private logger?: Logger

  constructor(logger?: Logger) {
    this.logger = logger
  }

  /**
   * Register a command handler.
   * Each command type can only have one handler.
   */
  register<C extends Command, R = unknown>(
    type: string,
    handler: CommandHandler<C, R>,
  ): void {
    if (this.handlers.has(type)) {
      throw new Error(`Handler already registered for command type: "${type}"`)
    }
    this.handlers.set(type, handler as CommandHandler)
  }

  /**
   * Execute a command.
   * Finds the registered handler and runs it.
   */
  async execute<C extends Command, R = unknown>(
    type: string,
    data: Omit<C, 'type' | 'timestamp'>,
    context: WorkflowContext,
  ): Promise<CommandResult<R>> {
    const handler = this.handlers.get(type)
    if (!handler) {
      return {
        success: false,
        error: `No handler registered for command type: "${type}"`,
      }
    }

    const command = {
      ...data,
      type,
      timestamp: Date.now(),
      correlationId: context.correlationId,
    } as C

    this.logger?.debug(`Executing command: ${type}`, {
      correlationId: context.correlationId,
    })

    try {
      const result = await handler(command, context)
      return { success: true, data: result }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.logger?.error(`Command failed: ${type}`, error instanceof Error ? error : undefined, {
        correlationId: context.correlationId,
      })
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Check if a command type has a registered handler.
   */
  has(type: string): boolean {
    return this.handlers.has(type)
  }

  /**
   * Get all registered command types.
   */
  registeredTypes(): string[] {
    return Array.from(this.handlers.keys())
  }

  /**
   * Remove all handlers.
   */
  clear(): void {
    this.handlers.clear()
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Create a command with timestamp and optional correlationId.
 */
export function createCommand<T extends Command>(
  type: T['type'],
  data: Omit<T, 'type' | 'timestamp'>,
  correlationId?: string,
): T {
  return {
    ...data,
    type,
    timestamp: Date.now(),
    correlationId,
  } as T
}
