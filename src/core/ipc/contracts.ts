/**
 * IPC Contracts
 *
 * Type-safe request/response definitions for every IPC channel.
 * This is the single source of truth for IPC type safety.
 *
 * Usage:
 *   const client = new IPCClient(transport)
 *   const notebooks = await client.invoke('notebook:list')
 *   // TypeScript knows: notebooks is Notebook[]
 */

import type {
  HardwareInfo,
  ModelProvider,
  ProviderModel,
  AgentInfo,
  InstallOptions,
  InstallProgress,
  MemoryItem,
  MemoryStats,
  ProgressData,
  CatalogAgent,
  SystemAgent,
  Notebook,
  Note,
  Source,
  McpServerConfig,
  McpToolInfo,
  McpServerStatus,
} from '../../../shared/types'
import type { Councillor, Deliberation } from '../../types/council'
import type { IPC_EVENTS } from './channels'

// ─── Contract Definition ─────────────────────────────────────────────────────

export interface IPCContract {
  // ─── Hardware ──────────────────────────────────────────────────────────────
  'get-hardware-info': {
    request: void
    response: HardwareInfo
  }

  // ─── Providers ─────────────────────────────────────────────────────────────
  'get-providers': {
    request: void
    response: ModelProvider[]
  }
  'get-provider-models': {
    request: string
    response: ProviderModel[]
  }
  'get-default-model': {
    request: string
    response: string
  }

  // ─── Council ───────────────────────────────────────────────────────────────
  'council-get-councillor-responses': {
    request: { apiKey: string; model: string; question: string; mode: string }
    response: Array<{ id: string; name: string; response: string; error?: string }>
  }
  'council-get-peer-rankings': {
    request: { apiKey: string; model: string; question: string; councillorResponses: Array<{ id: string; name: string; response: string }> }
    response: Record<string, number>
  }
  'council-get-chairman-synthesis': {
    request: { apiKey: string; model: string; question: string; councillorResponses: Array<{ id: string; name: string; response: string }>; rankings: Record<string, number> }
    response: string
  }

  // ─── OpenRouter ────────────────────────────────────────────────────────────
  'openrouter-chat': {
    request: { apiKey: string; model: string; messages: Array<{ role: string; content: string }> }
    response: string
  }

  // ─── Hermes ────────────────────────────────────────────────────────────────
  'test-hermes-connection': {
    request: string
    response: { ok: boolean; message: string }
  }

  // ─── Ollama ────────────────────────────────────────────────────────────────
  'check-ollama': {
    request: void
    response: { installed: boolean; running: boolean }
  }
  'install-ollama': {
    request: void
    response: { success: boolean; error?: string }
  }
  'pull-model': {
    request: string
    response: { success: boolean; error?: string }
  }
  'list-models': {
    request: void
    response: string[]
  }
  'get-model-config': {
    request: void
    response: Record<string, string>
  }
  'set-model-config': {
    request: Record<string, string>
    response: boolean
  }
  'chat': {
    request: { model: string; messages: Array<{ role: string; content: string }> }
    response: string
  }
  'chat-stream': {
    request: { model: string; messages: Array<{ role: string; content: string }> }
    response: { success: boolean; reply?: string; error?: string }
  }
  'ai-chat': {
    request: { model: string; messages: Array<{ role: string; content: string }>; baseUrl?: string }
    response: string
  }
  'list-api-models': {
    request: void
    response: string[]
  }

  // ─── Agent Management ──────────────────────────────────────────────────────
  'get-agents': {
    request: void
    response: AgentInfo[]
  }
  'start-agent': {
    request: string
    response: { success: boolean; error?: string; port?: number }
  }
  'stop-agent': {
    request: string
    response: { success: boolean; error?: string }
  }
  'get-agent-status': {
    request: string
    response: { status: 'stopped' | 'running' | 'error' }
  }
  'import-agent-from-github': {
    request: string
    response: { success: boolean; message: string }
  }
  'install-agent': {
    request: InstallOptions
    response: { success: boolean; error?: string }
  }
  'upgrade-agent': {
    request: string
    response: { success: boolean; error?: string }
  }
  'get-favorites': {
    request: void
    response: string[]
  }
  'toggle-favorite': {
    request: string
    response: { success: boolean; favorites: string[] }
  }
  'is-favorite': {
    request: string
    response: boolean
  }
  'health-check-agent': {
    request: string
    response: { healthy: boolean }
  }
  'get-agent-logs': {
    request: string
    response: { logs: string[] }
  }
  'get-agent-docs': {
    request: string
    response: { description: string; readme: string }
  }

  // ─── Installation ──────────────────────────────────────────────────────────
  'run-installation': {
    request: InstallOptions
    response: { success: boolean; error?: string; hardware: HardwareInfo | null }
  }

  // ─── Settings ──────────────────────────────────────────────────────────────
  'get-settings': {
    request: void
    response: Record<string, unknown>
  }
  'set-settings': {
    request: Record<string, unknown>
    response: void
  }
  'get-full-settings': {
    request: void
    response: { ollamaUrl: string; apiProvider: string; apiKey: string; apiModel: string }
  }
  'set-full-settings': {
    request: Partial<{ ollamaUrl: string; apiProvider: string; apiKey: string; apiModel: string }>
    response: boolean
  }

  // ─── Memory ────────────────────────────────────────────────────────────────
  'get-memory-items': {
    request: void
    response: { items: MemoryItem[]; stats: MemoryStats }
  }
  'get-memory-item-content': {
    request: string
    response: { success: boolean; content: string }
  }
  'save-memory-item': {
    request: { filePath: string; content: string }
    response: { success: boolean }
  }
  'save-conversation': {
    request: { agentName: string; messages: Array<{ role: string; content: string }> }
    response: { success: boolean }
  }

  // ─── Research ──────────────────────────────────────────────────────────────
  'run-research': {
    request: { query: string; sources?: string[] }
    response: { research: unknown; report: unknown }
  }

  // ─── Auto Update ───────────────────────────────────────────────────────────
  'check-for-updates': {
    request: void
    response: { success: boolean; error?: string }
  }
  'download-update': {
    request: void
    response: { success: boolean; error?: string }
  }
  'quit-and-install': {
    request: void
    response: void
  }

  // ─── Agent Catalog ─────────────────────────────────────────────────────────
  'get-agent-catalog': {
    request: void
    response: { agents: CatalogAgent[] }
  }

  // ─── UMP Discovery ─────────────────────────────────────────────────────────
  'ump-discover-scan': {
    request: void
    response: unknown[]
  }
  'ump-discover-unregistered': {
    request: void
    response: unknown[]
  }
  'ump-discover-with-memory': {
    request: void
    response: unknown[]
  }
  'ump-discover-register-all': {
    request: void
    response: { registered: string[] }
  }
  'ump-discover-consolidate': {
    request: string
    response: { agent_id: string; memories_consolidated: number; files_processed: number; errors: string[] }
  }

  // ─── UMP Bridge ────────────────────────────────────────────────────────────
  'ump-bridge-connect': {
    request: void
    response: { success: boolean; status: unknown }
  }
  'ump-bridge-import': {
    request: void
    response: { success: boolean; count: number; hub_stats: unknown }
  }
  'ump-bridge-export': {
    request: void
    response: { success: boolean; files: string[] }
  }
  'ump-bridge-sync': {
    request: void
    response: { success: boolean; result: unknown }
  }
  'ump-bridge-status': {
    request: void
    response: unknown
  }

  // ─── UMP Hub ───────────────────────────────────────────────────────────────
  'ump-hub-search': {
    request: { query: string; opts?: { memoryType?: string; groupId?: string; limit?: number } }
    response: unknown[]
  }
  'ump-hub-stats': {
    request: void
    response: unknown
  }
  'ump-hub-all': {
    request: void
    response: unknown[]
  }

  // ─── UMP Exchange ──────────────────────────────────────────────────────────
  'ump-exchange-register': {
    request: { agentId: string; name: string; description: string }
    response: unknown
  }
  'ump-exchange-stats': {
    request: void
    response: unknown
  }
  'ump-add-memory': {
    request: { content: string; memoryType?: string; tags?: string[]; group_id?: string }
    response: boolean
  }

  // ─── UMP Conversations ─────────────────────────────────────────────────────
  'ump-conversations': {
    request: { agentName?: string; limit?: number }
    response: Array<{ session: { id: string; agent_name: string; agent_id: string; created_at: string; updated_at: string; total_tokens: number }; messages: Array<{ id: string; session_id: string; role: string; content: string; token_count: number; created_at: string; metadata: Record<string, unknown> }> }>
  }
  'ump-session-messages': {
    request: string
    response: Array<{ id: string; session_id: string; role: string; content: string; token_count: number; created_at: string; metadata: Record<string, unknown> }>
  }
  'ump-session-stats': {
    request: void
    response: { total_sessions: number; total_messages: number; total_tokens: number }
  }

  // ─── Task Queue ────────────────────────────────────────────────────────────
  'ump:create-task': {
    request: { title: string; content: string; target: string; source?: string }
    response: { id: string; title: string; content: string; status: string; source: string; target: string; result: string | null; created_at: string; updated_at: string }
  }
  'ump:get-tasks': {
    request: { target?: string; status?: string }
    response: Array<{ id: string; title: string; content: string; status: string; source: string; target: string; result: string | null; created_at: string; updated_at: string }>
  }
  'ump:update-task': {
    request: { id: string; status: string; result?: string }
    response: boolean
  }
  'ump:get-pending-tasks': {
    request: string
    response: Array<{ id: string; title: string; content: string; status: string; source: string; target: string; result: string | null; created_at: string; updated_at: string }>
  }

  // ─── System Detection ──────────────────────────────────────────────────────
  'system-detect-all': {
    request: void
    response: SystemAgent[]
  }
  'system-detect-directories': {
    request: string[]
    response: SystemAgent[]
  }
  'system-add-to-library': {
    request: { id: string; name: string; description: string; version?: string; icon?: string; configDirs?: string[]; dataDirs?: string[] }
    response: { success: boolean; agentId?: string; error?: string }
  }

  // ─── Notebook ──────────────────────────────────────────────────────────────
  'notebook:list': {
    request: void
    response: Notebook[]
  }
  'notebook:get': {
    request: string
    response: Notebook | null
  }
  'notebook:create': {
    request: { name: string; description?: string; icon?: string; color?: string }
    response: Notebook
  }
  'notebook:update': {
    request: { id: string; updates: Partial<Pick<Notebook, 'name' | 'description' | 'icon' | 'color'>> }
    response: Notebook | null
  }
  'notebook:delete': {
    request: string
    response: boolean
  }

  // ─── Note ──────────────────────────────────────────────────────────────────
  'note:list': {
    request: string
    response: Note[]
  }
  'note:get': {
    request: string
    response: Note | null
  }
  'note:create': {
    request: { notebookId: string; title: string; content?: string; tags?: string[] }
    response: Note
  }
  'note:update': {
    request: { id: string; updates: Partial<Pick<Note, 'title' | 'content' | 'tags' | 'pinned'>> }
    response: Note | null
  }
  'note:delete': {
    request: string
    response: boolean
  }
  'note:search': {
    request: { query: string; notebookId?: string; limit?: number }
    response: Note[]
  }
  'note:all-tags': {
    request: void
    response: Array<{ tag: string; count: number }>
  }
  'note:by-tag': {
    request: { tag: string; limit?: number }
    response: Note[]
  }

  // ─── Sources ───────────────────────────────────────────────────────────────
  'source:import-pdf': {
    request: string
    response: Source | { canceled: boolean } | { error: string }
  }
  'source:import-url': {
    request: { url: string; notebookId: string }
    response: Source | { error: string }
  }
  'source:import-text': {
    request: { text: string; notebookId: string }
    response: Source | { error: string }
  }
  'source:get': {
    request: string
    response: Source[]
  }
  'source:delete': {
    request: string
    response: boolean
  }

  // ─── Orchestrator ──────────────────────────────────────────────────────────
  'orchestrator:execute': {
    request: string
    response: string
  }

  // ─── GitHub Installer ──────────────────────────────────────────────────────
  'github:analyze': {
    request: string
    response: { name: string; description: string; stack: 'node' | 'python' | 'unknown'; installCommands: string[] }
  }
  'github:install': {
    request: string
    response: { success: boolean; path: string; error?: string }
  }

  // ─── Discord ───────────────────────────────────────────────────────────────
  'discord:start': {
    request: void
    response: { success: boolean; message: string }
  }
  'discord:stop': {
    request: void
    response: { success: boolean; message: string }
  }
  'discord:send': {
    request: string
    response: { success: boolean; message: string }
  }
  'discord:test': {
    request: void
    response: { success: boolean; message: string }
  }
  'discord:status': {
    request: void
    response: { running: boolean }
  }

  // ─── Obsidian Sync ─────────────────────────────────────────────────────────
  'obsidian:export': {
    request: void
    response: { exported: number; errors: string[] }
  }
  'obsidian:import': {
    request: void
    response: { imported: number; updated: number; skipped: number; errors: string[] }
  }
  'obsidian:sync': {
    request: void
    response: { imported: number; updated: number; skipped: number; exported: number; errors: string[] }
  }
  'obsidian:test': {
    request: string
    response: { ok: boolean; message: string }
  }
  'obsidian:watch': {
    request: void
    response: { success: boolean; message: string }
  }
  'obsidian:watch-stop': {
    request: void
    response: { success: boolean }
  }

  // ─── MCP ───────────────────────────────────────────────────────────────────
  'mcp:list-servers': {
    request: void
    response: McpServerConfig[]
  }
  'mcp:add-server': {
    request: McpServerConfig
    response: { success: boolean; error?: string }
  }
  'mcp:remove-server': {
    request: string
    response: { success: boolean }
  }
  'mcp:toggle-server': {
    request: { serverId: string; enabled: boolean }
    response: { success: boolean }
  }
  'mcp:list-tools': {
    request: { serverId?: string }
    response: McpToolInfo[]
  }
  'mcp:call-tool': {
    request: { serverId: string; toolName: string; args: Record<string, unknown> }
    response: { success: boolean; result?: unknown; error?: string }
  }
  'mcp:server-status': {
    request: void
    response: McpServerStatus[]
  }
}

// ─── Event Contracts ─────────────────────────────────────────────────────────

export interface IPCEventContract {
  'install-progress': ProgressData
  'chat-token': string
  'chat-done': string
  'chat-error': string
  'health-check-result': { healthy: boolean; services: unknown[]; issues: string[] }
  'theme-changed': boolean
  'update-status': { state: string; version?: string; releaseDate?: string; percent?: number; message?: string }
  'orchestrator:progress': { message: string; tasks?: Array<{ id: string; description: string; assignedAgent: string; dependencies: string[]; status: 'pending' | 'running' | 'done' | 'failed'; result?: string; error?: string }> }
  'orchestrator:task-start': { taskId: string; message: string }
  'orchestrator:task-complete': { taskId: string; message: string; result: string }
  'orchestrator:task-fail': { taskId: string; message: string }
  'orchestrator:result': { message: string; result: string }
  'github:install-log': string
}

// ─── Helper Types ────────────────────────────────────────────────────────────

/** Extract the request type for a given channel */
export type IPCRequest<K extends keyof IPCContract> = IPCContract[K]['request']

/** Extract the response type for a given channel */
export type IPCResponse<K extends keyof IPCContract> = IPCContract[K]['response']

/** Extract the event data type for a given event channel */
export type IPCEventData<K extends keyof IPCEventContract> = IPCEventContract[K]

/** All available channel keys */
export type IPCChannelKey = keyof IPCContract

/** All available event channel keys */
export type IPCEventChannelKey = keyof IPCEventContract
