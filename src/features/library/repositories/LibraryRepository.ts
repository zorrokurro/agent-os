/**
 * LibraryRepository
 *
 * Data access layer for Agent Library operations.
 * Uses IPCClient for type-safe IPC calls.
 *
 * Supports:
 *   - Request/Response (agent CRUD, status checks)
 *   - Streaming (chat with agents via events)
 *   - Event subscriptions (token, done, error)
 */

import { IPCClient } from '../../../core/ipc/IPCClient'
import type { IPCStreamHandle } from '../../../core/ipc/IPCClient'
import type { AgentInfo } from '../../../types'

export class LibraryRepository {
  constructor(private ipc: IPCClient) {}

  // ─── Agent CRUD ──────────────────────────────────────────────────────────

  async listAgents(): Promise<AgentInfo[]> {
    return this.ipc.invoke('get-agents')
  }

  async getAgentStatus(id: string): Promise<{ status: 'stopped' | 'running' | 'error' }> {
    return this.ipc.invoke('get-agent-status', id)
  }

  async startAgent(id: string): Promise<{ success: boolean; error?: string; port?: number }> {
    return this.ipc.invoke('start-agent', id)
  }

  async stopAgent(id: string): Promise<{ success: boolean; error?: string }> {
    return this.ipc.invoke('stop-agent', id)
  }

  async getAgentLogs(id: string): Promise<{ logs: string[] }> {
    return this.ipc.invoke('get-agent-logs', id)
  }

  async getAgentDocs(id: string): Promise<{ description: string; readme: string }> {
    return this.ipc.invoke('get-agent-docs', id)
  }

  // ─── Favorites ───────────────────────────────────────────────────────────

  async getFavorites(): Promise<string[]> {
    return this.ipc.invoke('get-favorites')
  }

  async toggleFavorite(agentId: string): Promise<{ success: boolean; favorites: string[] }> {
    return this.ipc.invoke('toggle-favorite', agentId)
  }

  // ─── Models ──────────────────────────────────────────────────────────────

  async listModels(): Promise<string[]> {
    return this.ipc.invoke('list-models')
  }

  async listApiModels(): Promise<string[]> {
    return this.ipc.invoke('list-api-models')
  }

  // ─── Ollama ──────────────────────────────────────────────────────────────

  async checkOllama(): Promise<{ installed: boolean; running: boolean }> {
    return this.ipc.invoke('check-ollama')
  }

  // ─── Chat (Streaming) ────────────────────────────────────────────────────

  /**
   * Send a chat message and receive streaming tokens via events.
   *
   * @example
   * const handle = repository.streamChat({
   *   model: 'llama3',
   *   messages: [{ role: 'user', content: 'Hello' }],
   *   onToken: (token) => setReply(prev => prev + token),
   *   onDone: (reply) => console.log('Complete:', reply),
   *   onError: (err) => console.error(err),
   * })
   *
   * // Cancel:
   * handle.dispose()
   */
  streamChat(options: {
    model: string
    messages: Array<{ role: string; content: string }>
    onToken?: (token: string) => void
    onDone?: (reply: string) => void
    onError?: (error: string) => void
  }): IPCStreamHandle {
    return this.ipc.stream('chat-stream', {
      request: { model: options.model, messages: options.messages },
      onToken: options.onToken,
      onDone: options.onDone,
      onError: options.onError,
    })
  }

  /**
   * Non-streaming chat (for simple request/response).
   */
  async chat(model: string, messages: Array<{ role: string; content: string }>): Promise<string> {
    return this.ipc.invoke('chat', { model, messages })
  }

  // ─── Conversation Persistence ────────────────────────────────────────────

  async saveConversation(
    agentName: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<{ success: boolean }> {
    return this.ipc.invoke('save-conversation', { agentName, messages })
  }
}
