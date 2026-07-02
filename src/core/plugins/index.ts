/**
 * Plugin System
 *
 * Extension boundary for AgentOS.
 * Plugins provide capabilities without modifying Core.
 *
 * Architecture:
 *   PluginManager
 *   ├── PluginRegistry      (track all plugins)
 *   ├── PluginLoader         (discover from sources)
 *   ├── PluginContext        (shared context for plugins)
 *   └── Capabilities         (command, task, workflow, event, service)
 *
 * Usage:
 *   import { PluginManager } from '@/core'
 *
 *   const manager = new PluginManager({ logger, events, commandBus, runtime })
 *
 *   // Register a plugin directly
 *   await manager.register(manifest, {
 *     activate(ctx) {
 *       ctx.commands.register('greet', async (cmd) => `Hello!`)
 *       ctx.workflows.register(myWorkflow)
 *     },
 *     deactivate(ctx) {
 *       // cleanup
 *     },
 *   })
 *
 *   // Activate
 *   await manager.activate('my-plugin')
 */

// ─── Plugin Manager ──────────────────────────────────────────────────────────

export { PluginManager } from './PluginManager'

export type { PluginManagerOptions, PluginManagerStats, PluginHealthResult } from './PluginManager'

// ─── Plugin Registry ─────────────────────────────────────────────────────────

export { PluginRegistry } from './PluginRegistry'

export type { PluginEntry } from './PluginRegistry'

// ─── Plugin Interface ────────────────────────────────────────────────────────

export type { Plugin, PluginFactory, PluginHealth, PluginHealthStatus } from './Plugin'

// ─── Capability Registry ─────────────────────────────────────────────────────

export { CapabilityRegistry } from './CapabilityRegistry'

export type { CapabilitySummary } from './CapabilityRegistry'

// ─── Plugin Context ──────────────────────────────────────────────────────────

export { createPluginContext } from './PluginContext'

export type {
  PluginContext,
  PluginContextOptions,
  PluginCommandAPI,
  PluginWorkflowAPI,
  PluginTaskAPI,
  PluginConfigAPI,
  PluginStorageAPI,
  PluginServiceAPI,
} from './PluginContext'

// ─── Plugin Manifest ─────────────────────────────────────────────────────────

export { validateManifest } from './PluginManifest'

export type {
  PluginManifest,
  CapabilityType,
  PermissionType,
  ManifestValidationResult,
} from './PluginManifest'

// ─── Plugin Lifecycle ────────────────────────────────────────────────────────

export {
  PLUGIN_TRANSITIONS,
  isValidPluginTransition,
  isTerminalPluginState,
  isPluginActive,
} from './PluginLifecycle'

export type { PluginState } from './PluginLifecycle'

// ─── Capabilities ────────────────────────────────────────────────────────────

export {
  createCommandCapability,
  createTaskCapability,
  createWorkflowCapability,
  createEventCapability,
  createServiceCapability,
} from './capabilities/Capability'

export type {
  PluginCapability,
  CommandCapability,
  TaskCapability,
  WorkflowCapability,
  EventCapability,
  ServiceCapability,
  AnyCapability,
} from './capabilities/Capability'

// ─── Plugin Loader ───────────────────────────────────────────────────────────

export {
  FilesystemPluginSource,
  BuiltinPluginSource,
  RemotePluginSource,
} from './PluginLoader'

export type {
  PluginSource,
  PluginDiscoveryResult,
  PluginLoadResult,
  PluginModule,
} from './PluginLoader'
