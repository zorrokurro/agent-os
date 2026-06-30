/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NotebookSettings } from '../types'

const api = () => window.electronAPI as any

export async function listNotebooks(): Promise<any[]> {
  return api().notebookList()
}

export async function createNotebook(name: string, desc: string, icon: string, color: string): Promise<any> {
  return api().notebookCreate(name, desc, icon, color)
}

export async function deleteNotebook(id: string): Promise<void> {
  return api().notebookDelete(id)
}

export async function listNotes(notebookId: string): Promise<any[]> {
  return api().noteList(notebookId)
}

export async function createNote(notebookId: string, title: string): Promise<any> {
  return api().noteCreate(notebookId, title)
}

export async function updateNote(noteId: string, patch: Record<string, unknown>): Promise<void> {
  return api().noteUpdate(noteId, patch)
}

export async function deleteNote(noteId: string): Promise<void> {
  return api().noteDelete(noteId)
}

export async function getAllTags(): Promise<Array<{ tag: string; count: number }>> {
  return api().noteAllTags()
}

export async function getSettings(): Promise<any> {
  return api().getSettings()
}

export function parseSettings(raw: any): NotebookSettings {
  if (!raw) return { modelId: '', obsidianVault: '' }
  return {
    modelId: ((raw.apiModel as string) || (raw.modelId as string) || ''),
    obsidianVault: ((raw.obsidianVault as string) || ''),
  }
}

export async function syncObsidian(): Promise<void> {
  return api().obsidianSync()
}

export async function getSources(notebookId: string): Promise<any[]> {
  return api().sourceGet(notebookId)
}

export async function importPDF(notebookId: string): Promise<any> {
  return api().sourceImportPDF(notebookId)
}

export async function importURL(url: string, notebookId: string): Promise<any> {
  return api().sourceImportURL(url, notebookId)
}

export async function importText(text: string, notebookId: string): Promise<any> {
  return api().sourceImportText(text, notebookId)
}

export async function deleteSource(sourceId: string): Promise<void> {
  return api().sourceDelete(sourceId)
}

export async function aiChat(params: { model: string; messages: Array<{ role: string; content: string }> }): Promise<string> {
  return api().aiChat(params)
}

export async function saveConversation(key: string, messages: Array<{ role: string; content: string }>): Promise<void> {
  return api().saveConversation(key, messages)
}
