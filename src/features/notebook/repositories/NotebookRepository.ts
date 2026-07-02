/**
 * NotebookRepository
 *
 * Data access layer for Notebook/Note operations.
 * Uses IPCClient for type-safe IPC calls.
 *
 * Note: Contract types define object-shaped requests.
 * The ElectronTransport maps these to the preload's positional args.
 */

import { IPCClient } from '../../../core/ipc/IPCClient'
import type { Notebook, Note, Source } from '../../../types'

export class NotebookRepository {
  constructor(private ipc: IPCClient) {}

  // ─── Notebook CRUD ───────────────────────────────────────────────────────

  async listNotebooks(): Promise<Notebook[]> {
    return this.ipc.invoke('notebook:list')
  }

  async getNotebook(id: string): Promise<Notebook | null> {
    return this.ipc.invoke('notebook:get', id)
  }

  async createNotebook(
    name: string,
    description: string,
    icon: string,
    color: string,
  ): Promise<Notebook> {
    return this.ipc.invoke('notebook:create', { name, description, icon, color })
  }

  async updateNotebook(
    id: string,
    updates: Partial<Pick<Notebook, 'name' | 'description' | 'icon' | 'color'>>,
  ): Promise<Notebook | null> {
    return this.ipc.invoke('notebook:update', { id, updates })
  }

  async deleteNotebook(id: string): Promise<boolean> {
    return this.ipc.invoke('notebook:delete', id)
  }

  // ─── Note CRUD ───────────────────────────────────────────────────────────

  async listNotes(notebookId: string): Promise<Note[]> {
    return this.ipc.invoke('note:list', notebookId)
  }

  async getNote(id: string): Promise<Note | null> {
    return this.ipc.invoke('note:get', id)
  }

  async createNote(
    notebookId: string,
    title: string,
    content?: string,
    tags?: string[],
  ): Promise<Note> {
    return this.ipc.invoke('note:create', { notebookId, title, content, tags })
  }

  async updateNote(
    id: string,
    updates: Partial<Pick<Note, 'title' | 'content' | 'tags' | 'pinned'>>,
  ): Promise<Note | null> {
    return this.ipc.invoke('note:update', { id, updates })
  }

  async deleteNote(id: string): Promise<boolean> {
    return this.ipc.invoke('note:delete', id)
  }

  async searchNotes(
    query: string,
    notebookId?: string,
    limit?: number,
  ): Promise<Note[]> {
    return this.ipc.invoke('note:search', { query, notebookId, limit })
  }

  async getAllTags(): Promise<Array<{ tag: string; count: number }>> {
    return this.ipc.invoke('note:all-tags')
  }

  async getNotesByTag(tag: string, limit?: number): Promise<Note[]> {
    return this.ipc.invoke('note:by-tag', { tag, limit })
  }

  // ─── Sources ─────────────────────────────────────────────────────────────

  async getSources(notebookId: string): Promise<Source[]> {
    return this.ipc.invoke('source:get', notebookId)
  }

  async importPDF(notebookId: string): Promise<Source | { canceled: boolean } | { error: string }> {
    return this.ipc.invoke('source:import-pdf', notebookId)
  }

  async importURL(url: string, notebookId: string): Promise<Source | { error: string }> {
    return this.ipc.invoke('source:import-url', { url, notebookId })
  }

  async importText(text: string, notebookId: string): Promise<Source | { error: string }> {
    return this.ipc.invoke('source:import-text', { text, notebookId })
  }

  async deleteSource(sourceId: string): Promise<boolean> {
    return this.ipc.invoke('source:delete', sourceId)
  }

  // ─── AI ──────────────────────────────────────────────────────────────────

  async aiChat(params: {
    model: string
    messages: Array<{ role: string; content: string }>
  }): Promise<string> {
    return this.ipc.invoke('ai-chat', params)
  }

  async saveConversation(
    key: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<void> {
    await this.ipc.invoke('save-conversation', { agentName: key, messages })
  }

  // ─── Settings ────────────────────────────────────────────────────────────

  async getSettings(): Promise<Record<string, unknown>> {
    return this.ipc.invoke('get-settings')
  }

  // ─── Obsidian ────────────────────────────────────────────────────────────

  async syncObsidian(): Promise<void> {
    await this.ipc.invoke('obsidian:sync')
  }
}
