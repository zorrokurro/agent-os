/**
 * Plugin Registry
 *
 * Tracks all registered plugins, their state, and capabilities.
 * The registry is the source of truth for plugin metadata.
 */

import type { PluginManifest } from './PluginManifest'
import type { PluginState } from './PluginLifecycle'
import type { AnyCapability } from './capabilities/Capability'

// ─── Plugin Entry ────────────────────────────────────────────────────────────

export interface PluginEntry {
  /** Plugin manifest */
  manifest: PluginManifest
  /** Current lifecycle state */
  state: PluginState
  /** Capabilities provided by this plugin */
  capabilities: AnyCapability[]
  /** Error message if state is 'error' */
  error?: string
  /** Timestamp when plugin was loaded */
  loadedAt?: number
  /** Timestamp when plugin was activated */
  activatedAt?: number
  /** Timestamp when plugin was deactivated */
  deactivatedAt?: number
}

// ─── Plugin Registry ─────────────────────────────────────────────────────────

export class PluginRegistry {
  private plugins = new Map<string, PluginEntry>()

  /**
   * Register a plugin.
   */
  register(manifest: PluginManifest): PluginEntry {
    if (this.plugins.has(manifest.id)) {
      throw new Error(`Plugin "${manifest.id}" already registered`)
    }

    const entry: PluginEntry = {
      manifest,
      state: 'installed',
      capabilities: [],
    }

    this.plugins.set(manifest.id, entry)
    return entry
  }

  /**
   * Unregister a plugin.
   */
  unregister(pluginId: string): boolean {
    return this.plugins.delete(pluginId)
  }

  /**
   * Get a plugin entry.
   */
  get(pluginId: string): PluginEntry | undefined {
    return this.plugins.get(pluginId)
  }

  /**
   * Get all plugin entries.
   */
  getAll(): PluginEntry[] {
    return Array.from(this.plugins.values())
  }

  /**
   * Get all activated plugins.
   */
  getActive(): PluginEntry[] {
    return this.getAll().filter((e) => e.state === 'activated')
  }

  /**
   * Get plugins by capability type.
   */
  getByCapability(type: AnyCapability['type']): PluginEntry[] {
    return this.getAll().filter((e) =>
      e.capabilities.some((c) => c.type === type),
    )
  }

  /**
   * Get plugins that provide a specific command type.
   */
  getByCommand(commandType: string): PluginEntry[] {
    return this.getAll().filter((e) =>
      e.capabilities.some(
        (c) => c.type === 'command' && (c as { commandType: string }).commandType === commandType,
      ),
    )
  }

  /**
   * Get plugins that provide a specific task type.
   */
  getByTaskType(taskType: string): PluginEntry[] {
    return this.getAll().filter((e) =>
      e.capabilities.some(
        (c) => c.type === 'task' && (c as { taskType: string }).taskType === taskType,
      ),
    )
  }

  /**
   * Check if a plugin exists.
   */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId)
  }

  /**
   * Get the number of registered plugins.
   */
  get size(): number {
    return this.plugins.size
  }

  /**
   * Update a plugin's state.
   */
  setState(pluginId: string, state: PluginState, error?: string): void {
    const entry = this.plugins.get(pluginId)
    if (!entry) {
      throw new Error(`Plugin "${pluginId}" not found`)
    }

    const now = Date.now()
    entry.state = state

    if (state === 'loaded') entry.loadedAt = now
    if (state === 'activated') entry.activatedAt = now
    if (state === 'deactivated') entry.deactivatedAt = now
    if (state === 'error') entry.error = error

    if (state === 'loaded' || state === 'unloaded') entry.error = undefined
  }

  /**
   * Add capabilities to a plugin.
   */
  addCapabilities(pluginId: string, capabilities: AnyCapability[]): void {
    const entry = this.plugins.get(pluginId)
    if (!entry) {
      throw new Error(`Plugin "${pluginId}" not found`)
    }
    entry.capabilities.push(...capabilities)
  }

  /**
   * Clear the registry.
   */
  clear(): void {
    this.plugins.clear()
  }
}
