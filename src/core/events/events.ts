/**
 * AgentOS Event Definitions
 *
 * All domain events in AgentOS are defined here.
 * This is the single source of truth for event types.
 *
 * Naming convention: 'domain:action'
 *   - notebook:created
 *   - agent:started
 *   - workflow:completed
 *   - memory:indexed
 */

import type { BaseEvent } from './types'

// ─── Notebook Events ─────────────────────────────────────────────────────────

export interface NotebookCreatedEvent extends BaseEvent {
  type: 'notebook:created'
  notebookId: string
  name: string
}

export interface NotebookDeletedEvent extends BaseEvent {
  type: 'notebook:deleted'
  notebookId: string
}

export interface NotebookUpdatedEvent extends BaseEvent {
  type: 'notebook:updated'
  notebookId: string
  changes: Record<string, unknown>
}

export interface NoteCreatedEvent extends BaseEvent {
  type: 'note:created'
  noteId: string
  notebookId: string
  title: string
}

export interface NoteUpdatedEvent extends BaseEvent {
  type: 'note:updated'
  noteId: string
  changes: Record<string, unknown>
}

export interface NoteDeletedEvent extends BaseEvent {
  type: 'note:deleted'
  noteId: string
  notebookId: string
}

// ─── Agent Events ────────────────────────────────────────────────────────────

export interface AgentStartedEvent extends BaseEvent {
  type: 'agent:started'
  agentId: string
  agentName: string
}

export interface AgentStoppedEvent extends BaseEvent {
  type: 'agent:stopped'
  agentId: string
}

export interface AgentErrorEvent extends BaseEvent {
  type: 'agent:error'
  agentId: string
  error: string
}

export interface AgentFinishedEvent extends BaseEvent {
  type: 'agent:finished'
  agentId: string
  result: string
  duration?: number
}

// ─── Chat / Streaming Events ────────────────────────────────────────────────

export interface ChatTokenEvent extends BaseEvent {
  type: 'chat:token'
  token: string
  model?: string
}

export interface ChatCompletedEvent extends BaseEvent {
  type: 'chat:completed'
  reply: string
  model?: string
  tokenCount?: number
}

export interface ChatErrorEvent extends BaseEvent {
  type: 'chat:error'
  error: string
  model?: string
}

// ─── Workflow Events ─────────────────────────────────────────────────────────

export interface WorkflowStartedEvent extends BaseEvent {
  type: 'workflow:started'
  workflowId: string
  prompt: string
}

export interface WorkflowTaskDecomposedEvent extends BaseEvent {
  type: 'workflow:task-decomposed'
  workflowId: string
  tasks: Array<{ id: string; description: string; agent: string }>
}

export interface WorkflowTaskStartedEvent extends BaseEvent {
  type: 'workflow:task-started'
  workflowId: string
  taskId: string
  agent: string
}

export interface WorkflowTaskCompletedEvent extends BaseEvent {
  type: 'workflow:task-completed'
  workflowId: string
  taskId: string
  result: string
}

export interface WorkflowTaskFailedEvent extends BaseEvent {
  type: 'workflow:task-failed'
  workflowId: string
  taskId: string
  error: string
}

export interface WorkflowCompletedEvent extends BaseEvent {
  type: 'workflow:completed'
  workflowId: string
  result: string
  duration?: number
}

export interface WorkflowFailedEvent extends BaseEvent {
  type: 'workflow:failed'
  workflowId: string
  error: string
}

// ─── Memory Events ───────────────────────────────────────────────────────────

export interface MemoryIndexedEvent extends BaseEvent {
  type: 'memory:indexed'
  memoryId: string
  content: string
  tags?: string[]
}

export interface MemoryUpdatedEvent extends BaseEvent {
  type: 'memory:updated'
  memoryId: string
}

export interface MemoryDeletedEvent extends BaseEvent {
  type: 'memory:deleted'
  memoryId: string
}

export interface MemorySearchedEvent extends BaseEvent {
  type: 'memory:searched'
  query: string
  resultCount: number
}

// ─── Plugin Events ───────────────────────────────────────────────────────────

export interface PluginActivatedEvent extends BaseEvent {
  type: 'plugin:activated'
  pluginId: string
  pluginName: string
}

export interface PluginDeactivatedEvent extends BaseEvent {
  type: 'plugin:deactivated'
  pluginId: string
}

export interface PluginErrorEvent extends BaseEvent {
  type: 'plugin:error'
  pluginId: string
  error: string
}

// ─── System Events ───────────────────────────────────────────────────────────

export interface SettingsChangedEvent extends BaseEvent {
  type: 'settings:changed'
  key: string
  oldValue: unknown
  newValue: unknown
}

export interface AppErrorEvent extends BaseEvent {
  type: 'app:error'
  errorCode: string
  message: string
  stack?: string
}

// ─── Union Type ──────────────────────────────────────────────────────────────

/**
 * All AgentOS events.
 * Use this for type-safe event handling.
 */
export type AgentOSEvent =
  | NotebookCreatedEvent
  | NotebookDeletedEvent
  | NotebookUpdatedEvent
  | NoteCreatedEvent
  | NoteUpdatedEvent
  | NoteDeletedEvent
  | AgentStartedEvent
  | AgentStoppedEvent
  | AgentErrorEvent
  | AgentFinishedEvent
  | ChatTokenEvent
  | ChatCompletedEvent
  | ChatErrorEvent
  | WorkflowStartedEvent
  | WorkflowTaskDecomposedEvent
  | WorkflowTaskStartedEvent
  | WorkflowTaskCompletedEvent
  | WorkflowTaskFailedEvent
  | WorkflowCompletedEvent
  | WorkflowFailedEvent
  | MemoryIndexedEvent
  | MemoryUpdatedEvent
  | MemoryDeletedEvent
  | MemorySearchedEvent
  | PluginActivatedEvent
  | PluginDeactivatedEvent
  | PluginErrorEvent
  | SettingsChangedEvent
  | AppErrorEvent

/**
 * Extract event type strings from the union.
 */
export type AgentOSEventType = AgentOSEvent['type']

/**
 * Get the event data type for a given event type string.
 */
export type EventData<T extends AgentOSEventType> = Extract<AgentOSEvent, { type: T }>

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Create an event with timestamp and optional correlationId.
 */
export function createEvent<T extends AgentOSEvent>(
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
