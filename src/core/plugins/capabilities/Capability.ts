/**
 * Capability System
 *
 * Base interface for all plugin capabilities.
 * Each capability type (command, task, workflow, event, service)
 * implements this interface.
 *
 * Capabilities are how plugins extend the platform.
 * Plugins provide capabilities, not specific objects.
 */

import type { PluginManifest, CapabilityType } from '../PluginManifest'

// ─── Base Capability ─────────────────────────────────────────────────────────

export interface PluginCapability {
  /** The plugin that provides this capability */
  pluginId: string
  /** Capability type */
  type: CapabilityType
  /** Capability name (for display) */
  name: string
  /** Capability description */
  description?: string
}

// ─── Command Capability ──────────────────────────────────────────────────────

export interface CommandCapability extends PluginCapability {
  type: 'command'
  /** Command type this handler responds to */
  commandType: string
}

// ─── Task Capability ─────────────────────────────────────────────────────────

export interface TaskCapability extends PluginCapability {
  type: 'task'
  /** Task type this handler processes */
  taskType: string
}

// ─── Workflow Capability ─────────────────────────────────────────────────────

export interface WorkflowCapability extends PluginCapability {
  type: 'workflow'
  /** Workflow definition ID */
  workflowId: string
}

// ─── Event Capability ────────────────────────────────────────────────────────

export interface EventCapability extends PluginCapability {
  type: 'event'
  /** Event types this plugin subscribes to */
  eventTypes: string[]
}

// ─── Service Capability ──────────────────────────────────────────────────────

export interface ServiceCapability extends PluginCapability {
  type: 'service'
  /** Service name */
  serviceName: string
}

// ─── Union Type ──────────────────────────────────────────────────────────────

export type AnyCapability =
  | CommandCapability
  | TaskCapability
  | WorkflowCapability
  | EventCapability
  | ServiceCapability

// ─── Capability Helpers ──────────────────────────────────────────────────────

/**
 * Create a command capability.
 */
export function createCommandCapability(
  pluginId: string,
  commandType: string,
  name?: string,
): CommandCapability {
  return {
    pluginId,
    type: 'command',
    name: name ?? `Command: ${commandType}`,
    commandType,
  }
}

/**
 * Create a task capability.
 */
export function createTaskCapability(
  pluginId: string,
  taskType: string,
  name?: string,
): TaskCapability {
  return {
    pluginId,
    type: 'task',
    name: name ?? `Task: ${taskType}`,
    taskType,
  }
}

/**
 * Create a workflow capability.
 */
export function createWorkflowCapability(
  pluginId: string,
  workflowId: string,
  name?: string,
): WorkflowCapability {
  return {
    pluginId,
    type: 'workflow',
    name: name ?? `Workflow: ${workflowId}`,
    workflowId,
  }
}

/**
 * Create an event capability.
 */
export function createEventCapability(
  pluginId: string,
  eventTypes: string[],
  name?: string,
): EventCapability {
  return {
    pluginId,
    type: 'event',
    name: name ?? `Events: ${eventTypes.join(', ')}`,
    eventTypes,
  }
}

/**
 * Create a service capability.
 */
export function createServiceCapability(
  pluginId: string,
  serviceName: string,
  name?: string,
): ServiceCapability {
  return {
    pluginId,
    type: 'service',
    name: name ?? `Service: ${serviceName}`,
    serviceName,
  }
}
