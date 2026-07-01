/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AgentInfo, OllamaStatus } from '../types'

const api = () => window.electronAPI as any

export async function getAgents(): Promise<AgentInfo[]> {
  return api().getAgents()
}

export async function getAgentStatus(id: string): Promise<{ status: string }> {
  return api().getAgentStatus(id)
}

export async function startAgent(id: string): Promise<{ success: boolean; error?: string }> {
  return api().startAgent(id)
}

export async function stopAgent(id: string): Promise<{ success: boolean; error?: string }> {
  return api().stopAgent(id)
}

export async function checkOllama(): Promise<OllamaStatus> {
  return api().checkOllama()
}

export async function getFavorites(): Promise<string[]> {
  return api().getFavorites()
}

export async function toggleFavorite(agentId: string): Promise<{ favorites: string[] }> {
  return api().toggleFavorite(agentId)
}

export async function listModels(): Promise<string[]> {
  return api().listModels()
}

export async function listApiModels(): Promise<string[]> {
  return api().listApiModels()
}

export async function chatStream(model: string, messages: Array<{ role: string; content: string }>): Promise<{ success: boolean; reply?: string; error?: string }> {
  return api().chatStream(model, messages)
}

export async function getAgentLogs(id: string): Promise<{ logs: string[] }> {
  return api().getAgentLogs(id)
}

export async function getAgentDocs(id: string): Promise<{ description: string; readme: string }> {
  return api().getAgentDocs(id)
}

export async function saveConversation(agentName: string, messages: Array<{ role: string; content: string }>): Promise<{ success: boolean }> {
  return api().saveConversation(agentName, messages)
}

export function onChatToken(cb: (token: string) => void): () => void {
  return api().onChatToken(cb)
}

export function onChatDone(cb: (reply: string) => void): () => void {
  return api().onChatDone(cb)
}

export function onChatError(cb: (error: string) => void): () => void {
  return api().onChatError(cb)
}
