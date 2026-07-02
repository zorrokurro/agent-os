/**
 * Notebook Service
 *
 * Thin wrapper around NotebookRepository.
 * Provides the same function signatures as before for backward compatibility.
 *
 * Migration path:
 *   Phase 1 (now): Service uses IPCClient internally
 *   Phase 2: Hooks use Repository directly
 *   Phase 3: Remove this service layer
 */

import { IPCClient } from '../../../core/ipc/IPCClient'
import { ElectronTransport } from '../../../core/ipc/transports/ElectronTransport'
import { NotebookRepository } from '../repositories/NotebookRepository'
import type { NotebookSettings } from '../types'

// ─── Singleton IPC Client & Repository ───────────────────────────────────────

let _repo: NotebookRepository | null = null

function getRepo(): NotebookRepository {
  if (!_repo) {
    const transport = new ElectronTransport()
    const ipc = new IPCClient(transport)
    _repo = new NotebookRepository(ipc)
  }
  return _repo
}

// ─── Exported API (same signatures as before) ────────────────────────────────

export async function listNotebooks() {
  return getRepo().listNotebooks()
}

export async function createNotebook(name: string, desc: string, icon: string, color: string) {
  return getRepo().createNotebook(name, desc, icon, color)
}

export async function deleteNotebook(id: string) {
  return getRepo().deleteNotebook(id)
}

export async function listNotes(notebookId: string) {
  return getRepo().listNotes(notebookId)
}

export async function createNote(notebookId: string, title: string) {
  return getRepo().createNote(notebookId, title)
}

export async function updateNote(noteId: string, patch: Record<string, unknown>) {
  return getRepo().updateNote(noteId, patch as Parameters<NotebookRepository['updateNote']>[1])
}

export async function deleteNote(noteId: string) {
  return getRepo().deleteNote(noteId)
}

export async function getAllTags() {
  return getRepo().getAllTags()
}

export async function getSettings() {
  return getRepo().getSettings()
}

export function parseSettings(raw: Record<string, unknown> | null): NotebookSettings {
  if (!raw) return { modelId: '', obsidianVault: '' }
  return {
    modelId: ((raw.apiModel as string) || (raw.modelId as string) || ''),
    obsidianVault: ((raw.obsidianVault as string) || ''),
  }
}

export async function syncObsidian() {
  return getRepo().syncObsidian()
}

export async function getSources(notebookId: string) {
  return getRepo().getSources(notebookId)
}

export async function importPDF(notebookId: string) {
  return getRepo().importPDF(notebookId)
}

export async function importURL(url: string, notebookId: string) {
  return getRepo().importURL(url, notebookId)
}

export async function importText(text: string, notebookId: string) {
  return getRepo().importText(text, notebookId)
}

export async function deleteSource(sourceId: string) {
  return getRepo().deleteSource(sourceId)
}

export async function aiChat(params: { model: string; messages: Array<{ role: string; content: string }> }) {
  return getRepo().aiChat(params)
}

export async function saveConversation(key: string, messages: Array<{ role: string; content: string }>) {
  return getRepo().saveConversation(key, messages)
}
