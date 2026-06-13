import type { MemoryHub } from './ump/hub'
import { createMemory, UniversalMemory } from './ump/schemas'

export interface Notebook {
  id: string
  name: string
  description: string
  icon: string
  color: string
  noteCount: number
  createdAt: string
  updatedAt: string
}

export interface Note {
  id: string
  title: string
  content: string
  notebookId: string
  tags: string[]
  pinned: boolean
  createdAt: string
  updatedAt: string
}

let hub: MemoryHub | null = null

export function setHub(h: MemoryHub) {
  hub = h
}

function ensureHub(): MemoryHub {
  if (!hub) throw new Error('Notebook hub not initialized')
  return hub
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function memoryToNotebook(m: UniversalMemory): Notebook {
  const meta = m.metadata as Record<string, unknown>
  return {
    id: m.id,
    name: (meta.name as string) || '未命名筆記本',
    description: (meta.description as string) || '',
    icon: (meta.icon as string) || '📓',
    color: (meta.color as string) || '#a078ff',
    noteCount: getNoteCountForNotebook(m.id),
    createdAt: m.temporal.created_at,
    updatedAt: m.temporal.updated_at || m.temporal.created_at,
  }
}

function memoryToNote(m: UniversalMemory): Note {
  const meta = m.metadata as Record<string, unknown>
  return {
    id: m.id,
    title: (meta.title as string) || '未命名筆記',
    content: m.content,
    notebookId: (meta.notebook_id as string) || '',
    tags: m.tags,
    pinned: (meta.pinned as boolean) || false,
    createdAt: m.temporal.created_at,
    updatedAt: m.temporal.updated_at || m.temporal.created_at,
  }
}

function getNoteCountForNotebook(notebookId: string): number {
  try {
    const hub = ensureHub()
    const notes = hub.getMemoriesByGroup(`note:${notebookId}`, 1000)
    return notes.length
  } catch {
    return 0
  }
}

export function listNotebooks(): Notebook[] {
  const hub = ensureHub()
  const all = hub.getAll()
  return all
    .filter(m => m.id.startsWith('nb_'))
    .map(memoryToNotebook)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getNotebook(id: string): Notebook | null {
  const hub = ensureHub()
  const m = hub.getMemory(id)
  if (!m || !m.id.startsWith('nb_')) return null
  return memoryToNotebook(m)
}

export function createNotebook(name: string, description = '', icon = '📓', color = '#a078ff'): Notebook {
  const hub = ensureHub()
  const id = generateId('nb')
  const memory = createMemory({
    id,
    content: description || name,
    memory_type: 'semantic',
    group_id: 'notebooks',
    tags: ['notebook'],
    metadata: { type: 'notebook', name, description, icon, color },
    importance: 0.5,
  })
  hub.addMemory(memory)
  return memoryToNotebook(memory)
}

export function updateNotebook(id: string, updates: Partial<Pick<Notebook, 'name' | 'description' | 'icon' | 'color'>>): Notebook | null {
  const hub = ensureHub()
  const m = hub.getMemory(id)
  if (!m) return null

  const meta = m.metadata as Record<string, unknown>
  if (updates.name !== undefined) meta.name = updates.name
  if (updates.description !== undefined) meta.description = updates.description
  if (updates.icon !== undefined) meta.icon = updates.icon
  if (updates.color !== undefined) meta.color = updates.color
  m.content = (meta.description as string) || (meta.name as string) || ''
  m.temporal.updated_at = new Date().toISOString()

  hub.updateMemory(m)
  return memoryToNotebook(m)
}

export function deleteNotebook(id: string): boolean {
  const hub = ensureHub()
  // Delete all notes in this notebook
  const notes = hub.getMemoriesByGroup(`note:${id}`, 10000)
  for (const note of notes) {
    hub.deleteMemory(note.id)
  }
  return hub.deleteMemory(id)
}

export function listNotes(notebookId: string): Note[] {
  const hub = ensureHub()
  const notes = hub.getMemoriesByGroup(`note:${notebookId}`, 1000)
  return notes
    .map(memoryToNote)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
}

export function getNote(id: string): Note | null {
  const hub = ensureHub()
  const m = hub.getMemory(id)
  if (!m || !m.id.startsWith('note_')) return null
  return memoryToNote(m)
}

export function createNote(notebookId: string, title: string, content = '', tags: string[] = []): Note {
  const hub = ensureHub()
  const id = generateId('note')
  const memory = createMemory({
    id,
    content,
    memory_type: 'episodic',
    group_id: `note:${notebookId}`,
    tags,
    metadata: { type: 'note', title, notebook_id: notebookId, pinned: false },
    importance: 0.5,
  })
  hub.addMemory(memory)
  return memoryToNote(memory)
}

export function updateNote(id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'tags' | 'pinned'>>): Note | null {
  const hub = ensureHub()
  const m = hub.getMemory(id)
  if (!m) return null

  const meta = m.metadata as Record<string, unknown>
  if (updates.title !== undefined) meta.title = updates.title
  if (updates.content !== undefined) m.content = updates.content
  if (updates.tags !== undefined) m.tags = updates.tags
  if (updates.pinned !== undefined) meta.pinned = updates.pinned
  m.temporal.updated_at = new Date().toISOString()

  hub.updateMemory(m)
  return memoryToNote(m)
}

export function deleteNote(id: string): boolean {
  const hub = ensureHub()
  return hub.deleteMemory(id)
}

export function searchNotes(query: string, notebookId?: string, limit = 20): Note[] {
  const hub = ensureHub()
  const results = hub.searchByContent(query, {
    memoryType: 'episodic',
    groupId: notebookId ? `note:${notebookId}` : undefined,
    limit,
  })
  return results
    .filter(m => m.id.startsWith('note_'))
    .map(memoryToNote)
}

export function getAllTags(): Array<{ tag: string; count: number }> {
  const hub = ensureHub()
  const all = hub.getAll()
  const tagCounts = new Map<string, number>()
  for (const m of all) {
    if (m.id.startsWith('note_')) {
      for (const tag of m.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      }
    }
  }
  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

export function getNotesByTag(tag: string, limit = 50): Note[] {
  const hub = ensureHub()
  const all = hub.getAll()
  return all
    .filter(m => m.id.startsWith('note_') && m.tags.includes(tag))
    .slice(0, limit)
    .map(memoryToNote)
}
