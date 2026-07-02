/**
 * Capability Registry
 *
 * Tracks all capabilities across the system.
 * Provides a unified view of what the platform can do.
 *
 * Usage:
 *   const registry = new CapabilityRegistry()
 *
 *   // Register capabilities
 *   registry.register(createCommandCapability('plugin-a', 'greet'))
 *   registry.register(createTaskCapability('plugin-b', 'agent'))
 *
 *   // Query
 *   registry.getByType('command')  // all command capabilities
 *   registry.getByPlugin('plugin-a')  // all capabilities from plugin A
 *   registry.getAll()  // everything
 */

import type { CapabilityType } from './PluginManifest'
import type { AnyCapability } from './capabilities/Capability'

// ─── Capability Registry ─────────────────────────────────────────────────────

export class CapabilityRegistry {
  private capabilities = new Map<string, AnyCapability[]>()

  /**
   * Register a capability.
   */
  register(capability: AnyCapability): void {
    const existing = this.capabilities.get(capability.pluginId) ?? []
    existing.push(capability)
    this.capabilities.set(capability.pluginId, existing)
  }

  /**
   * Register multiple capabilities.
   */
  registerBatch(capabilities: AnyCapability[]): void {
    for (const cap of capabilities) {
      this.register(cap)
    }
  }

  /**
   * Unregister all capabilities for a plugin.
   */
  unregister(pluginId: string): void {
    this.capabilities.delete(pluginId)
  }

  /**
   * Get all capabilities.
   */
  getAll(): AnyCapability[] {
    const result: AnyCapability[] = []
    for (const caps of this.capabilities.values()) {
      result.push(...caps)
    }
    return result
  }

  /**
   * Get capabilities by type.
   */
  getByType(type: CapabilityType): AnyCapability[] {
    return this.getAll().filter((c) => c.type === type)
  }

  /**
   * Get capabilities by plugin ID.
   */
  getByPlugin(pluginId: string): AnyCapability[] {
    return this.capabilities.get(pluginId) ?? []
  }

  /**
   * Get capabilities by command type.
   */
  getByCommand(commandType: string): AnyCapability[] {
    return this.getAll().filter(
      (c) => c.type === 'command' && (c as { commandType: string }).commandType === commandType,
    )
  }

  /**
   * Get capabilities by task type.
   */
  getByTaskType(taskType: string): AnyCapability[] {
    return this.getAll().filter(
      (c) => c.type === 'task' && (c as { taskType: string }).taskType === taskType,
    )
  }

  /**
   * Get capabilities by workflow ID.
   */
  getByWorkflow(workflowId: string): AnyCapability[] {
    return this.getAll().filter(
      (c) => c.type === 'workflow' && (c as { workflowId: string }).workflowId === workflowId,
    )
  }

  /**
   * Check if a capability exists.
   */
  has(pluginId: string, type?: CapabilityType): boolean {
    const caps = this.capabilities.get(pluginId) ?? []
    if (!type) return caps.length > 0
    return caps.some((c) => c.type === type)
  }

  /**
   * Get capability count.
   */
  count(): number {
    return this.getAll().length
  }

  /**
   * Get capability summary (for UI/Marketplace).
   */
  summary(): CapabilitySummary {
    const all = this.getAll()
    const byType: Record<string, number> = {}
    const byPlugin: Record<string, number> = {}

    for (const cap of all) {
      byType[cap.type] = (byType[cap.type] ?? 0) + 1
      byPlugin[cap.pluginId] = (byPlugin[cap.pluginId] ?? 0) + 1
    }

    return {
      total: all.length,
      byType,
      byPlugin,
    }
  }

  /**
   * Clear the registry.
   */
  clear(): void {
    this.capabilities.clear()
  }
}

// ─── Summary Types ───────────────────────────────────────────────────────────

export interface CapabilitySummary {
  total: number
  byType: Record<string, number>
  byPlugin: Record<string, number>
}
