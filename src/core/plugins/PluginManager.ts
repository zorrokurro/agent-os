/**
 * Plugin Manager
 *
 * Top-level manager for the plugin system.
 * Responsibilities:
 *   - Discover plugins from multiple sources
 *   - Load/unload plugin modules
 *   - Activate/deactivate plugins
 *   - Provide PluginContext to plugins
 *   - API version compatibility checks
 *   - Manage plugin lifecycle
 *
 * Usage:
 *   const manager = new PluginManager({ logger, events, commandBus, runtime })
 *
 *   // Discover and load plugins
 *   await manager.discover()
 *
 *   // Activate a plugin
 *   await manager.activate('my-plugin')
 *
 *   // Deactivate
 *   await manager.deactivate('my-plugin')
 */

import type { Logger } from '../logger/Logger'
import type { IEventBus } from '../events/types'
import type { CommandBus } from '../workflow/commands/CommandBus'
import type { WorkflowRuntime } from '../workflow/WorkflowRuntime'
import type { PluginManifest } from './PluginManifest'
import type { Plugin } from './Plugin'
import type { PluginContext, PluginCommandAPI, PluginWorkflowAPI, PluginTaskAPI, PluginConfigAPI, PluginStorageAPI, PluginServiceAPI } from './PluginContext'
import type { PluginHealth, PluginHealthStatus } from './Plugin'
import type { AnyCapability } from './capabilities/Capability'
import { PluginRegistry, type PluginEntry } from './PluginRegistry'
import { CapabilityRegistry } from './CapabilityRegistry'
import { createPluginContext } from './PluginContext'
import { BuiltinPluginSource, type PluginSource } from './PluginLoader'
import { validateManifest } from './PluginManifest'
import { createCommandCapability, createTaskCapability, createWorkflowCapability, createEventCapability } from './capabilities/Capability'
import { Metrics } from '../logger/Metrics'

// ─── Plugin Manager Options ──────────────────────────────────────────────────

export interface PluginManagerOptions {
  logger?: Logger
  events?: IEventBus
  commandBus?: CommandBus
  runtime?: WorkflowRuntime
  /** Current platform API version */
  apiVersion?: string
}

// ─── Plugin Manager Stats ────────────────────────────────────────────────────

export interface PluginManagerStats {
  totalDiscovered: number
  totalLoaded: number
  totalActivated: number
  totalFailed: number
  byState: Record<string, number>
  byCapability: Record<string, number>
}

export interface PluginHealthResult {
  pluginId: string
  status: PluginHealthStatus
  message?: string
  details?: Record<string, unknown>
}

// ─── Plugin Manager ──────────────────────────────────────────────────────────

export class PluginManager {
  private registry: PluginRegistry
  private capabilityRegistry: CapabilityRegistry
  private sources: PluginSource[] = []
  private modules = new Map<string, Plugin>()
  private pluginConfigs = new Map<string, Map<string, unknown>>()
  private pluginStorages = new Map<string, Map<string, unknown>>()
  private services = new Map<string, unknown>()
  private logger?: Logger
  private events?: IEventBus
  private commandBus?: CommandBus
  private runtime?: WorkflowRuntime
  private apiVersion: string
  private metrics: Metrics

  constructor(options: PluginManagerOptions = {}) {
    this.logger = options.logger
    this.events = options.events
    this.commandBus = options.commandBus
    this.runtime = options.runtime
    this.apiVersion = options.apiVersion ?? '1.0'
    this.registry = new PluginRegistry()
    this.capabilityRegistry = new CapabilityRegistry()
    this.metrics = new Metrics()

    // Register builtin source by default
    this.sources.push(new BuiltinPluginSource())
  }

  // ─── Source Management ──────────────────────────────────────────────────

  /**
   * Add a plugin source.
   */
  addSource(source: PluginSource): void {
    this.sources.push(source)
  }

  // ─── Discovery ─────────────────────────────────────────────────────────

  /**
   * Discover plugins from all registered sources.
   */
  async discover(): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = []

    for (const source of this.sources) {
      try {
        const results = await source.discover()
        for (const result of results) {
          const validation = validateManifest(result.manifest)
          if (!validation.valid) {
            this.logger?.warn(`Invalid manifest from ${source.type}: ${result.manifest.id}`, {
              errors: validation.errors,
            })
            continue
          }

          if (!this.registry.has(result.manifest.id)) {
            this.registry.register(result.manifest)
            manifests.push(result.manifest)
          }
        }
      } catch (error) {
        this.logger?.warn(`Failed to discover plugins from ${source.type}`, error as Error)
      }
    }

    this.logger?.info(`Discovered ${manifests.length} plugins`)
    return manifests
  }

  // ─── Loading ───────────────────────────────────────────────────────────

  /**
   * Load a plugin by ID.
   */
  async load(pluginId: string): Promise<void> {
    const entry = this.registry.get(pluginId)
    if (!entry) {
      throw new Error(`Plugin "${pluginId}" not registered`)
    }

    // Check API version compatibility
    if (!this.isApiCompatible(entry.manifest)) {
      throw new Error(
        `Plugin "${pluginId}" requires API version ${entry.manifest.apiVersion}, ` +
        `but platform provides ${this.apiVersion}`,
      )
    }

    // Find and load from source
    for (const source of this.sources) {
      try {
        const result = await source.load(pluginId)
        const plugin = result.module as unknown as Plugin

        if (typeof plugin.activate !== 'function') {
          throw new Error(`Plugin "${pluginId}" does not export an activate function`)
        }

        this.modules.set(pluginId, plugin)
        this.registry.setState(pluginId, 'loaded')
        this.logger?.info(`Plugin loaded: ${pluginId}`)
        return
      } catch {
        // Try next source
      }
    }

    throw new Error(`Plugin "${pluginId}" could not be loaded from any source`)
  }

  /**
   * Unload a plugin.
   */
  async unload(pluginId: string): Promise<void> {
    const entry = this.registry.get(pluginId)
    if (!entry) throw new Error(`Plugin "${pluginId}" not registered`)

    if (entry.state === 'activated') {
      await this.deactivate(pluginId)
    }

    this.modules.delete(pluginId)
    this.registry.setState(pluginId, 'unloaded')
    this.logger?.info(`Plugin unloaded: ${pluginId}`)
  }

  // ─── Activation ────────────────────────────────────────────────────────

  /**
   * Activate a plugin.
   */
  async activate(pluginId: string): Promise<void> {
    const entry = this.registry.get(pluginId)
    if (!entry) throw new Error(`Plugin "${pluginId}" not registered`)
    if (entry.state !== 'loaded') {
      throw new Error(`Plugin "${pluginId}" must be loaded before activation (current: ${entry.state})`)
    }

    // Check API version compatibility
    if (!this.isApiCompatible(entry.manifest)) {
      throw new Error(
        `Plugin "${pluginId}" requires API version ${entry.manifest.apiVersion}, ` +
        `but platform provides ${this.apiVersion}`,
      )
    }

    const plugin = this.modules.get(pluginId)
    if (!plugin) throw new Error(`Plugin "${pluginId}" module not loaded`)

    // Check dependencies
    for (const depId of entry.manifest.dependencies) {
      const depEntry = this.registry.get(depId)
      if (!depEntry || depEntry.state !== 'activated') {
        throw new Error(`Plugin "${pluginId}" depends on "${depId}" which is not activated`)
      }
    }

    // Create context
    const ctx = this.createContext(entry.manifest)

    try {
      await plugin.activate(ctx)

      // Register capabilities
      const capabilities = this.discoverCapabilities(pluginId, entry.manifest)
      this.registry.addCapabilities(pluginId, capabilities)
      this.registry.setState(pluginId, 'activated')

      this.logger?.info(`Plugin activated: ${pluginId}`)
    } catch (error) {
      this.registry.setState(pluginId, 'error', error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  /**
   * Deactivate a plugin.
   */
  async deactivate(pluginId: string): Promise<void> {
    const entry = this.registry.get(pluginId)
    if (!entry) throw new Error(`Plugin "${pluginId}" not registered`)
    if (entry.state !== 'activated') {
      throw new Error(`Plugin "${pluginId}" is not activated (current: ${entry.state})`)
    }

    const plugin = this.modules.get(pluginId)
    if (plugin?.deactivate) {
      const ctx = this.createContext(entry.manifest)
      await plugin.deactivate(ctx)
    }

    this.registry.setState(pluginId, 'deactivated')
    this.logger?.info(`Plugin deactivated: ${pluginId}`)
  }

  // ─── Direct Registration ───────────────────────────────────────────────

  /**
   * Register a plugin directly (without a source).
   * Useful for testing and builtin plugins.
   */
  async register(manifest: PluginManifest, plugin: Plugin): Promise<void> {
    const validation = validateManifest(manifest)
    if (!validation.valid) {
      throw new Error(`Invalid manifest: ${validation.errors.join(', ')}`)
    }

    this.registry.register(manifest)
    this.modules.set(manifest.id, plugin)
    this.registry.setState(manifest.id, 'loaded')
  }

  // ─── Query ─────────────────────────────────────────────────────────────

  /**
   * Get a plugin entry.
   */
  get(pluginId: string): PluginEntry | undefined {
    return this.registry.get(pluginId)
  }

  /**
   * Get all plugin entries.
   */
  getAll(): PluginEntry[] {
    return this.registry.getAll()
  }

  /**
   * Get active plugins.
   */
  getActive(): PluginEntry[] {
    return this.registry.getActive()
  }

  /**
   * Get the registry.
   */
  getRegistry(): PluginRegistry {
    return this.registry
  }

  // ─── Health Check ───────────────────────────────────────────────────────

  /**
   * Get health status for all plugins.
   */
  async healthCheck(): Promise<PluginHealthResult[]> {
    const results: PluginHealthResult[] = []

    for (const entry of this.registry.getAll()) {
      if (entry.state !== 'activated') {
        results.push({
          pluginId: entry.manifest.id,
          status: entry.state === 'error' ? 'unhealthy' : 'degraded',
          message: `State: ${entry.state}`,
        })
        continue
      }

      const plugin = this.modules.get(entry.manifest.id)
      if (plugin?.health) {
        try {
          const health = await plugin.health()
          results.push({
            pluginId: entry.manifest.id,
            ...health,
          })
        } catch (error) {
          results.push({
            pluginId: entry.manifest.id,
            status: 'unhealthy',
            message: error instanceof Error ? error.message : String(error),
          })
        }
      } else {
        results.push({
          pluginId: entry.manifest.id,
          status: 'healthy',
        })
      }
    }

    return results
  }

  /**
   * Get overall platform health.
   */
  async platformHealth(): Promise<PluginHealthStatus> {
    const results = await this.healthCheck()
    if (results.some((r) => r.status === 'unhealthy')) return 'unhealthy'
    if (results.some((r) => r.status === 'degraded')) return 'degraded'
    return 'healthy'
  }

  // ─── Metrics ───────────────────────────────────────────────────────────

  /**
   * Get metrics instance.
   */
  getMetrics(): Metrics {
    return this.metrics
  }

  // ─── Capability Registry ───────────────────────────────────────────────

  /**
   * Get capability registry.
   */
  getCapabilityRegistry(): CapabilityRegistry {
    return this.capabilityRegistry
  }

  // ─── Service Registry ──────────────────────────────────────────────────

  /**
   * Register a global service.
   */
  registerService<T = unknown>(name: string, service: T): void {
    this.services.set(name, service)
  }

  /**
   * Resolve a global service.
   */
  resolveService<T = unknown>(name: string): T | undefined {
    return this.services.get(name) as T | undefined
  }

  /**
   * Get stats.
   */
  getStats(): PluginManagerStats {
    const entries = this.registry.getAll()
    const byState: Record<string, number> = {}
    const byCapability: Record<string, number> = {}

    for (const entry of entries) {
      byState[entry.state] = (byState[entry.state] ?? 0) + 1
      for (const cap of entry.capabilities) {
        byCapability[cap.type] = (byCapability[cap.type] ?? 0) + 1
      }
    }

    return {
      totalDiscovered: entries.length,
      totalLoaded: entries.filter((e) => e.state === 'loaded' || e.state === 'activated').length,
      totalActivated: entries.filter((e) => e.state === 'activated').length,
      totalFailed: entries.filter((e) => e.state === 'error').length,
      byState,
      byCapability,
    }
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  private createContext(manifest: PluginManifest): PluginContext {
    const config = this.getOrCreateConfig(manifest.id)
    const storage = this.getOrCreateStorage(manifest.id)

    return createPluginContext({
      manifest,
      logger: this.logger ?? { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, child: () => ({ info: () => {}, warn: () => {}, error: () => {}, debug: () => {} }) } as Logger,
      events: this.events ?? { publish: async () => {}, subscribe: () => ({ unsubscribe: () => {} }), onAny: () => ({ unsubscribe: () => {} }), clear: () => {}, subscriberCount: () => 0 },
      commands: this.createCommandAPI(manifest.id),
      workflows: this.createWorkflowAPI(manifest.id),
      tasks: this.createTaskAPI(),
      config: this.createConfigAPI(config),
      storage: this.createStorageAPI(storage),
      services: this.createServiceAPI(),
    })
  }

  private createCommandAPI(pluginId: string): PluginCommandAPI {
    const prefix = `${pluginId}:`
    return {
      register: (type: string, handler) => {
        this.commandBus?.register(prefix + type, handler)
      },
      execute: async (type: string, data: Record<string, unknown>) => {
        const ctx = this.createContext({ id: pluginId } as PluginManifest)
        return this.commandBus?.execute(prefix + type, data, ctx)
      },
    }
  }

  private createWorkflowAPI(pluginId: string): PluginWorkflowAPI {
    return {
      register: (definition) => {
        this.runtime?.registerWorkflow({
          ...definition,
          id: `${pluginId}:${definition.id}`,
        })
      },
      unregister: (workflowId: string) => {
        this.runtime?.unregisterWorkflow(`${pluginId}:${workflowId}`)
      },
    }
  }

  private createTaskAPI(): PluginTaskAPI {
    return {
      registerHandler: (taskType: string, handler) => {
        this.runtime?.registerHandler(taskType, handler)
      },
    }
  }

  private getOrCreateConfig(pluginId: string): Map<string, unknown> {
    if (!this.pluginConfigs.has(pluginId)) {
      this.pluginConfigs.set(pluginId, new Map())
    }
    return this.pluginConfigs.get(pluginId)!
  }

  private getOrCreateStorage(pluginId: string): Map<string, unknown> {
    if (!this.pluginStorages.has(pluginId)) {
      this.pluginStorages.set(pluginId, new Map())
    }
    return this.pluginStorages.get(pluginId)!
  }

  private createConfigAPI(config: Map<string, unknown>): PluginConfigAPI {
    return {
      get: <T = unknown>(key: string) => config.get(key) as T | undefined,
      set: (key: string, value: unknown) => config.set(key, value),
      getAll: () => Object.fromEntries(config),
      has: (key: string) => config.has(key),
    }
  }

  private createStorageAPI(storage: Map<string, unknown>): PluginStorageAPI {
    return {
      get: <T = unknown>(key: string) => storage.get(key) as T | undefined,
      set: (key: string, value: unknown) => storage.set(key, value),
      delete: (key: string) => storage.delete(key),
      has: (key: string) => storage.has(key),
      keys: () => Array.from(storage.keys()),
      clear: () => storage.clear(),
    }
  }

  private createServiceAPI(): PluginServiceAPI {
    return {
      register: <T = unknown>(name: string, service: T) => {
        this.services.set(name, service)
      },
      resolve: <T = unknown>(name: string) => this.services.get(name) as T | undefined,
      has: (name: string) => this.services.has(name),
      list: () => Array.from(this.services.keys()),
    }
  }

  private isApiCompatible(manifest: PluginManifest): boolean {
    // Check min/max version constraints
    if (manifest.minVersion && this.compareVersions(this.apiVersion, manifest.minVersion) < 0) {
      return false
    }
    if (manifest.maxVersion && this.compareVersions(this.apiVersion, manifest.maxVersion) > 0) {
      return false
    }

    // Check major version compatibility
    const platformMajor = this.apiVersion.split('.')[0]
    const pluginMajor = manifest.apiVersion.split('.')[0]
    return platformMajor === pluginMajor
  }

  private compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)

    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] ?? 0
      const nb = pb[i] ?? 0
      if (na > nb) return 1
      if (na < nb) return -1
    }
    return 0
  }

  private discoverCapabilities(pluginId: string, manifest: PluginManifest): AnyCapability[] {
    const capabilities: AnyCapability[] = []

    if (manifest.capabilities.includes('command')) {
      capabilities.push(createCommandCapability(pluginId, '*'))
    }
    if (manifest.capabilities.includes('task')) {
      capabilities.push(createTaskCapability(pluginId, '*'))
    }
    if (manifest.capabilities.includes('workflow')) {
      capabilities.push(createWorkflowCapability(pluginId, '*'))
    }
    if (manifest.capabilities.includes('event')) {
      capabilities.push(createEventCapability(pluginId, ['*']))
    }
    if (manifest.capabilities.includes('service')) {
      capabilities.push({
        pluginId,
        type: 'service',
        name: `Service: ${pluginId}`,
        serviceName: pluginId,
      })
    }

    return capabilities
  }
}
