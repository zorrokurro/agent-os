/**
 * Plugin Context
 *
 * Shared context provided to every plugin.
 * Plugins never import Core directly — they only use this context.
 *
 * Usage:
 *   export async function activate(ctx: PluginContext) {
 *     ctx.commands.register('my:cmd', async (cmd) => { ... })
 *     ctx.events.subscribe('workflow:completed', (e) => { ... })
 *     ctx.workflows.register(myWorkflow)
 *   }
 *
 *   export async function deactivate(ctx: PluginContext) {
 *     // cleanup
 *   }
 */

import type { Logger } from '../logger/Logger'
import type { IEventBus, BaseEvent } from '../events/types'
import type { CommandHandler } from '../workflow/commands/CommandBus'
import type { TaskHandler } from '../workflow/tasks/TaskExecutor'
import type { WorkflowDefinition } from '../workflow/models/Workflow'
import type { PluginManifest } from './PluginManifest'

// ─── Plugin Context ──────────────────────────────────────────────────────────

export interface PluginContext {
  /** Plugin manifest */
  readonly manifest: PluginManifest
  /** Structured logger */
  readonly logger: Logger
  /** Event bus for pub/sub */
  readonly events: IEventBus
  /** Command registration */
  readonly commands: PluginCommandAPI
  /** Workflow registration */
  readonly workflows: PluginWorkflowAPI
  /** Task handler registration */
  readonly tasks: PluginTaskAPI
  /** Plugin-scoped config */
  readonly config: PluginConfigAPI
  /** Plugin-scoped storage */
  readonly storage: PluginStorageAPI
  /** Service registry for resolving shared services */
  readonly services: PluginServiceAPI
  /** Correlation ID for tracing */
  readonly correlationId: string
}

// ─── Command API ─────────────────────────────────────────────────────────────

export interface PluginCommandAPI {
  /**
   * Register a command handler.
   * The command will be namespaced with the plugin ID.
   */
  register(type: string, handler: CommandHandler): void

  /**
   * Execute a command.
   */
  execute(type: string, data: Record<string, unknown>): Promise<unknown>
}

// ─── Workflow API ────────────────────────────────────────────────────────────

export interface PluginWorkflowAPI {
  /**
   * Register a workflow definition.
   * The workflow ID will be namespaced with the plugin ID.
   */
  register(definition: WorkflowDefinition): void

  /**
   * Unregister a workflow.
   */
  unregister(workflowId: string): void
}

// ─── Task API ────────────────────────────────────────────────────────────────

export interface PluginTaskAPI {
  /**
   * Register a task handler for a specific task type.
   */
  registerHandler(taskType: string, handler: TaskHandler): void
}

// ─── Config API ──────────────────────────────────────────────────────────────

export interface PluginConfigAPI {
  /**
   * Get a config value by key.
   */
  get<T = unknown>(key: string): T | undefined

  /**
   * Set a config value.
   */
  set(key: string, value: unknown): void

  /**
   * Get all config values.
   */
  getAll(): Record<string, unknown>

  /**
   * Check if a config key exists.
   */
  has(key: string): boolean
}

// ─── Storage API ─────────────────────────────────────────────────────────────

export interface PluginStorageAPI {
  /**
   * Get a stored value by key.
   */
  get<T = unknown>(key: string): T | undefined

  /**
   * Set a stored value.
   */
  set(key: string, value: unknown): void

  /**
   * Remove a stored value.
   */
  delete(key: string): void

  /**
   * Check if a key exists.
   */
  has(key: string): boolean

  /**
   * Get all stored keys.
   */
  keys(): string[]

  /**
   * Clear all stored values.
   */
  clear(): void
}

// ─── Service API ─────────────────────────────────────────────────────────────

export interface PluginServiceAPI {
  /**
   * Register a service.
   */
  register<T = unknown>(name: string, service: T): void

  /**
   * Resolve a service by name.
   */
  resolve<T = unknown>(name: string): T | undefined

  /**
   * Check if a service is registered.
   */
  has(name: string): boolean

  /**
   * Get all service names.
   */
  list(): string[]
}

// ─── Plugin Context Factory ──────────────────────────────────────────────────

export interface PluginContextOptions {
  manifest: PluginManifest
  logger: Logger
  events: IEventBus
  commands: PluginCommandAPI
  workflows: PluginWorkflowAPI
  tasks: PluginTaskAPI
  config: PluginConfigAPI
  storage: PluginStorageAPI
  services: PluginServiceAPI
}

/**
 * Create a PluginContext from options.
 */
export function createPluginContext(options: PluginContextOptions): PluginContext {
  return {
    manifest: options.manifest,
    logger: options.logger,
    events: options.events,
    commands: options.commands,
    workflows: options.workflows,
    tasks: options.tasks,
    config: options.config,
    storage: options.storage,
    services: options.services,
    correlationId: `plugin_${options.manifest.id}_${Math.random().toString(16).slice(2, 8)}`,
  }
}
