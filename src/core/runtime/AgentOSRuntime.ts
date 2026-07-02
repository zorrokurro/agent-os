/**
 * AgentOS Runtime
 *
 * Single entry point that initializes and manages all runtimes.
 * Orchestrates lifecycle, context injection, and health aggregation.
 *
 * Usage:
 *   const agentOS = new AgentOSRuntime({
 *     logger,
 *     eventBus,
 *     enableWorkflow: true,
 *     enablePlugins: true,
 *     enableKnowledge: true,
 *     enableAgents: true,
 *   })
 *
 *   await agentOS.start()
 *   // ... use runtimes ...
 *   await agentOS.stop()
 */

import { EventEmitter } from 'events'
import type { Logger } from '../logger/Logger'
import { getGlobalLogger } from '../logger'
import type { IEventBus } from '../events/types'
import { EventBus, getGlobalEventBus } from '../events'
import { AgentRuntime, type AgentRuntimeOptions } from '../agents/AgentRuntime'
import { PluginManager, type PluginManagerOptions } from '../plugins/PluginManager'
import { WorkflowRuntime, type WorkflowRuntimeOptions } from '../workflow/WorkflowRuntime'
import { MemoryEngine, type MemoryEngineOptions } from '../knowledge/MemoryEngine'
import { InMemoryStore } from '../knowledge/providers/MemoryStore'

// ─── Runtime State ───────────────────────────────────────────────────────────

export type AgentOSState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'

// ─── Runtime Health ──────────────────────────────────────────────────────────

export interface RuntimeHealth {
  /** Runtime name */
  name: string
  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy'
  /** Message */
  message?: string
  /** Metrics */
  metrics?: Record<string, unknown>
}

// ─── AgentOS Options ─────────────────────────────────────────────────────────

export interface AgentOSOptions {
  /** Logger */
  logger?: Logger
  /** Event bus */
  eventBus?: IEventBus
  /** Enable workflow runtime */
  enableWorkflow?: boolean
  /** Enable plugin system */
  enablePlugins?: boolean
  /** Enable knowledge runtime */
  enableKnowledge?: boolean
  /** Enable agent runtime */
  enableAgents?: boolean
  /** Agent runtime options */
  agentOptions?: Partial<AgentRuntimeOptions>
  /** Plugin manager options */
  pluginOptions?: Partial<PluginManagerOptions>
  /** Workflow runtime options */
  workflowOptions?: Partial<WorkflowRuntimeOptions>
  /** Knowledge engine options */
  knowledgeOptions?: Partial<MemoryEngineOptions>
}

// ─── AgentOS Runtime ─────────────────────────────────────────────────────────

export class AgentOSRuntime extends EventEmitter {
  private state: AgentOSState = 'stopped'
  private logger: Logger
  private eventBus: IEventBus
  private agentRuntime?: AgentRuntime
  private pluginManager?: PluginManager
  private workflowRuntime?: WorkflowRuntime
  private knowledgeEngine?: MemoryEngine
  private options: Required<Omit<AgentOSOptions, 'agentOptions' | 'pluginOptions' | 'workflowOptions' | 'knowledgeOptions'>> & {
    agentOptions?: Partial<AgentRuntimeOptions>
    pluginOptions?: Partial<PluginManagerOptions>
    workflowOptions?: Partial<WorkflowRuntimeOptions>
    knowledgeOptions?: Partial<MemoryEngineOptions>
  }

  constructor(options?: AgentOSOptions) {
    super()
    this.options = {
      enableWorkflow: true,
      enablePlugins: true,
      enableKnowledge: true,
      enableAgents: true,
      agentOptions: undefined,
      pluginOptions: undefined,
      workflowOptions: undefined,
      knowledgeOptions: undefined,
      ...options,
    }

    this.logger = options?.logger ?? getGlobalLogger()
    this.eventBus = options?.eventBus ?? getGlobalEventBus()
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Start all runtimes.
   */
  async start(): Promise<void> {
    if (this.state !== 'stopped' && this.state !== 'error') {
      throw new Error(`Cannot start AgentOS in state: ${this.state}`)
    }

    this.setState('starting')
    this.logger.info('AgentOS starting')

    try {
      // Initialize runtimes in order
      if (this.options.enableAgents) {
        this.agentRuntime = new AgentRuntime({
          logger: this.logger,
          eventBus: this.eventBus,
          ...this.options.agentOptions,
        })
        await this.agentRuntime.start()
        this.logger.info('Agent Runtime started')
      }

      if (this.options.enableWorkflow) {
        this.workflowRuntime = new WorkflowRuntime({
          logger: this.logger,
          events: this.eventBus,
          ...this.options.workflowOptions,
        })
        this.logger.info('Workflow Runtime initialized')
      }

      if (this.options.enablePlugins) {
        this.pluginManager = new PluginManager({
          logger: this.logger,
          ...this.options.pluginOptions,
        })
        this.logger.info('Plugin Manager initialized')
      }

      if (this.options.enableKnowledge) {
        this.knowledgeEngine = new MemoryEngine({
          store: new InMemoryStore(),
          logger: this.logger,
          ...this.options.knowledgeOptions,
        })
        this.logger.info('Knowledge Engine initialized')
      }

      this.setState('running')
      this.logger.info('AgentOS started')

      // Emit startup event
      this.eventBus.publish({
        type: 'app:ready',
        data: { mode: 'agentos' },
        timestamp: Date.now(),
      })

      this.emit('started')
    } catch (error) {
      this.setState('error')
      this.logger.error('AgentOS failed to start', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  /**
   * Stop all runtimes.
   */
  async stop(): Promise<void> {
    if (this.state !== 'running') {
      throw new Error(`Cannot stop AgentOS in state: ${this.state}`)
    }

    this.setState('stopping')
    this.logger.info('AgentOS stopping')

    // Stop in reverse order
    if (this.knowledgeEngine) {
      await this.knowledgeEngine.clear()
      this.logger.info('Knowledge Engine cleared')
    }

    if (this.pluginManager) {
      const active = this.pluginManager.getActive()
      for (const entry of active) {
        try {
          await this.pluginManager.deactivate(entry.manifest.id)
        } catch {
          // Ignore errors during shutdown
        }
      }
      this.logger.info('Plugin Manager stopped')
    }

    if (this.agentRuntime) {
      await this.agentRuntime.stop()
      this.logger.info('Agent Runtime stopped')
    }

    this.setState('stopped')
    this.logger.info('AgentOS stopped')
    this.emit('stopped')
  }

  // ─── State ─────────────────────────────────────────────────────────────────

  /**
   * Get AgentOS state.
   */
  getState(): AgentOSState {
    return this.state
  }

  /**
   * Get health status of all runtimes.
   */
  async health(): Promise<RuntimeHealth[]> {
    const health: RuntimeHealth[] = []

    if (this.agentRuntime) {
      const stats = this.agentRuntime.getStats()
      health.push({
        name: 'AgentRuntime',
        status: stats.state === 'running' ? 'healthy' : 'unhealthy',
        metrics: stats,
      })
    }

    if (this.workflowRuntime) {
      const stats = this.workflowRuntime.getStats()
      health.push({
        name: 'WorkflowRuntime',
        status: 'healthy',
        metrics: stats,
      })
    }

    if (this.pluginManager) {
      const stats = this.pluginManager.getStats()
      health.push({
        name: 'PluginManager',
        status: stats.running === stats.total ? 'healthy' : 'degraded',
        metrics: stats,
      })
    }

    if (this.knowledgeEngine) {
      const stats = await this.knowledgeEngine.stats()
      health.push({
        name: 'KnowledgeEngine',
        status: 'healthy',
        metrics: stats,
      })
    }

    return health
  }

  /**
   * Get aggregate stats.
   */
  async getStats() {
    return {
      state: this.state,
      runtimes: {
        agents: this.agentRuntime?.getStats(),
        workflow: this.workflowRuntime?.getStats(),
        plugins: this.pluginManager?.getStats(),
        knowledge: this.knowledgeEngine ? await this.knowledgeEngine.stats() : undefined,
      },
    }
  }

  // ─── Runtime Access ────────────────────────────────────────────────────────

  /**
   * Get the Agent Runtime.
   */
  getAgentRuntime(): AgentRuntime | undefined {
    return this.agentRuntime
  }

  /**
   * Get the Plugin Manager.
   */
  getPluginManager(): PluginManager | undefined {
    return this.pluginManager
  }

  /**
   * Get the Workflow Runtime.
   */
  getWorkflowRuntime(): WorkflowRuntime | undefined {
    return this.workflowRuntime
  }

  /**
   * Get the Knowledge Engine.
   */
  getKnowledgeEngine(): MemoryEngine | undefined {
    return this.knowledgeEngine
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private setState(state: AgentOSState): void {
    this.state = state
    this.emit('stateChange', state)
  }
}
