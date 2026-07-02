/**
 * Plugin Loader
 *
 * Loads plugins from different sources:
 *   - Filesystem (local plugins)
 *   - Remote (marketplace)
 *   - Builtin (built-in plugins)
 *
 * Each source implements the PluginSource interface.
 */

import type { PluginManifest } from './PluginManifest'

// ─── Plugin Source Interface ─────────────────────────────────────────────────

export interface PluginSource {
  /** Source type identifier */
  readonly type: string

  /**
   * Discover available plugins from this source.
   */
  discover(): Promise<PluginDiscoveryResult[]>

  /**
   * Load a plugin's manifest and entry point.
   */
  load(pluginId: string): Promise<PluginLoadResult>
}

export interface PluginDiscoveryResult {
  /** Plugin manifest */
  manifest: PluginManifest
  /** Source type */
  source: string
  /** Source-specific metadata */
  metadata?: Record<string, unknown>
}

export interface PluginLoadResult {
  /** Plugin manifest */
  manifest: PluginManifest
  /** Plugin module (with activate/deactivate exports) */
  module: PluginModule
}

export interface PluginModule {
  activate?: (context: unknown) => Promise<void> | void
  deactivate?: (context: unknown) => Promise<void> | void
}

// ─── Filesystem Source ───────────────────────────────────────────────────────

export class FilesystemPluginSource implements PluginSource {
  readonly type = 'filesystem'
  private basePath: string

  constructor(basePath: string) {
    this.basePath = basePath
  }

  async discover(): Promise<PluginDiscoveryResult[]> {
    // In a real implementation, this would scan the filesystem
    // For now, return empty
    return []
  }

  async load(pluginId: string): Promise<PluginLoadResult> {
    // In a real implementation, this would import the plugin module
    throw new Error(`Filesystem source not implemented: ${pluginId}`)
  }
}

// ─── Builtin Source ──────────────────────────────────────────────────────────

export class BuiltinPluginSource implements PluginSource {
  readonly type = 'builtin'
  private plugins = new Map<string, { manifest: PluginManifest; module: PluginModule }>()

  /**
   * Register a builtin plugin.
   */
  register(manifest: PluginManifest, module: PluginModule): void {
    this.plugins.set(manifest.id, { manifest, module })
  }

  async discover(): Promise<PluginDiscoveryResult[]> {
    return Array.from(this.plugins.values()).map((p) => ({
      manifest: p.manifest,
      source: 'builtin',
    }))
  }

  async load(pluginId: string): Promise<PluginLoadResult> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Builtin plugin not found: ${pluginId}`)
    }
    return {
      manifest: plugin.manifest,
      module: plugin.module,
    }
  }
}

// ─── Remote Source (Placeholder) ─────────────────────────────────────────────

export class RemotePluginSource implements PluginSource {
  readonly type = 'remote'
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async discover(): Promise<PluginDiscoveryResult[]> {
    // Placeholder for future marketplace integration
    return []
  }

  async load(pluginId: string): Promise<PluginLoadResult> {
    throw new Error(`Remote source not implemented: ${pluginId}`)
  }
}
