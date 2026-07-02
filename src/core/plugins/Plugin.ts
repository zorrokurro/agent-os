/**
 * Plugin Interface
 *
 * The interface that every plugin must implement.
 * Plugins export these functions from their entry point.
 *
 * Example:
 *   // my-plugin/index.ts
 *   import type { PluginContext } from '@agentos/core'
 *
 *   export async function activate(ctx: PluginContext) {
 *     ctx.commands.register('greet', async (cmd) => {
 *       return `Hello, ${cmd.name}!`
 *     })
 *   }
 *
 *   export async function deactivate(ctx: PluginContext) {
 *     // cleanup
 *   }
 */

import type { PluginContext } from './PluginContext'

export interface Plugin {
  /**
   * Called when the plugin is activated.
   * Register commands, workflows, task handlers, and event subscriptions here.
   */
  activate(context: PluginContext): Promise<void> | void

  /**
   * Called when the plugin is deactivated.
   * Clean up resources, unsubscribe from events, etc.
   */
  deactivate?(context: PluginContext): Promise<void> | void

  /**
   * Health check for the plugin.
   * Returns health status and optional message.
   */
  health?(): Promise<PluginHealth> | PluginHealth
}

// ─── Health Types ────────────────────────────────────────────────────────────

export type PluginHealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface PluginHealth {
  status: PluginHealthStatus
  message?: string
  details?: Record<string, unknown>
}

/**
 * Plugin factory function.
 * Some plugins may export a factory instead of a static plugin.
 */
export type PluginFactory = (context: PluginContext) => Promise<Plugin> | Plugin
