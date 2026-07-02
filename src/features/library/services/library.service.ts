/**
 * Library Service
 *
 * Thin wrapper around LibraryRepository.
 * Provides the same function signatures as before for backward compatibility.
 *
 * Migration path:
 *   Phase 1 (now): Service uses IPCClient internally
 *   Phase 2: Hooks use Repository directly
 *   Phase 3: Remove this service layer
 */

import { IPCClient } from '../../../core/ipc/IPCClient'
import { ElectronTransport } from '../../../core/ipc/transports/ElectronTransport'
import { LibraryRepository } from '../repositories/LibraryRepository'
import type { AgentInfo, OllamaStatus } from '../types'
import type { IPCStreamHandle } from '../../../core/ipc/IPCClient'

// ─── Singleton IPC Client & Repository ───────────────────────────────────────

let _repo: LibraryRepository | null = null

function getRepo(): LibraryRepository {
  if (!_repo) {
    const transport = new ElectronTransport()
    const ipc = new IPCClient(transport)
    _repo = new LibraryRepository(ipc)
  }
  return _repo
}

// ─── Exported API (same signatures as before) ────────────────────────────────

export async function getAgents(): Promise<AgentInfo[]> {
  return getRepo().listAgents()
}

export async function getAgentStatus(id: string): Promise<{ status: string }> {
  return getRepo().getAgentStatus(id)
}

export async function startAgent(id: string): Promise<{ success: boolean; error?: string }> {
  return getRepo().startAgent(id)
}

export async function stopAgent(id: string): Promise<{ success: boolean; error?: string }> {
  return getRepo().stopAgent(id)
}

export async function checkOllama(): Promise<OllamaStatus> {
  return getRepo().checkOllama()
}

export async function getFavorites(): Promise<string[]> {
  return getRepo().getFavorites()
}

export async function toggleFavorite(agentId: string): Promise<{ favorites: string[] }> {
  return getRepo().toggleFavorite(agentId)
}

export async function listModels(): Promise<string[]> {
  return getRepo().listModels()
}

export async function listApiModels(): Promise<string[]> {
  return getRepo().listApiModels()
}

export async function chatStream(model: string, messages: Array<{ role: string; content: string }>): Promise<{ success: boolean; reply?: string; error?: string }> {
  try {
    const reply = await getRepo().chat(model, messages)
    return { success: true, reply }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function getAgentLogs(id: string): Promise<{ logs: string[] }> {
  return getRepo().getAgentLogs(id)
}

export async function getAgentDocs(id: string): Promise<{ description: string; readme: string }> {
  return getRepo().getAgentDocs(id)
}

export async function saveConversation(agentName: string, messages: Array<{ role: string; content: string }>): Promise<{ success: boolean }> {
  return getRepo().saveConversation(agentName, messages)
}

// ─── Event Subscriptions ─────────────────────────────────────────────────────

export function onChatToken(cb: (token: string) => void): () => void {
  const ipc = new IPCClient(new ElectronTransport())
  return ipc.on('chat-token', cb)
}

export function onChatDone(cb: (reply: string) => void): () => void {
  const ipc = new IPCClient(new ElectronTransport())
  return ipc.on('chat-done', cb)
}

export function onChatError(cb: (error: string) => void): () => void {
  const ipc = new IPCClient(new ElectronTransport())
  return ipc.on('chat-error', cb)
}

/**
 * Stream chat with proper event handling.
 * Returns a handle that can be disposed to cancel subscriptions.
 */
export function streamChat(options: {
  model: string
  messages: Array<{ role: string; content: string }>
  onToken?: (token: string) => void
  onDone?: (reply: string) => void
  onError?: (error: string) => void
}): IPCStreamHandle {
  return getRepo().streamChat(options)
}
