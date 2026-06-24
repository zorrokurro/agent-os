import fs from 'fs'
import path from 'path'
import type { MemoryHub } from './ump/hub'
import { createMemory, UniversalMemory } from './ump/schemas'
import type { Source } from '../../shared/types'

export type { Source }

let hub: MemoryHub | null = null

export function setHub(h: MemoryHub) {
  hub = h
}

function ensureHub(): MemoryHub {
  if (!hub) throw new Error('Source hub not initialized')
  return hub
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function memoryToSource(m: UniversalMemory): Source {
  const meta = m.metadata as Record<string, unknown>
  return {
    id: m.id,
    title: (meta.title as string) || '未命名來源',
    type: (meta.type as 'pdf' | 'url' | 'text') || 'text',
    preview: m.content.substring(0, 100),
    content: m.content,
    tags: m.tags,
    createdAt: m.temporal.created_at,
    metadata: meta,
  }
}

export async function importPDF(filePath: string, notebookId: string): Promise<Source> {
  const hub = ensureHub()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { PDFParse } = (await import('pdf-parse')) as any
  const buffer = fs.readFileSync(filePath)
  const parser = new PDFParse({ verbosity: 0 })
  await parser.load(buffer)
  const data = await parser.getText()
  const content: string = (data.pages || []).map((p: any) => p.text).join('\n') || ''
  const title = path.basename(filePath, path.extname(filePath))
  const id = generateId('src')

  const memory = createMemory({
    id,
    content,
    memory_type: 'semantic',
    group_id: `source:${notebookId}`,
    tags: ['source', 'pdf'],
    metadata: { title, type: 'pdf', path: filePath, notebookId },
    importance: 0.5,
  })
  hub.addMemory(memory)
  return memoryToSource(memory)
}

export async function importURL(url: string, notebookId: string): Promise<Source> {
  const hub = ensureHub()
  const fetch = (await import('node-fetch')).default
  const response = await fetch(url)
  const html = await response.text()

  // Extract title from HTML
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  let title = titleMatch ? titleMatch[1].trim() : url
  if (title.length > 100) title = title.substring(0, 100)

  // Strip HTML tags, keep plain text
  const content = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()

  const id = generateId('src')
  const memory = createMemory({
    id,
    content,
    memory_type: 'semantic',
    group_id: `source:${notebookId}`,
    tags: ['source', 'url'],
    metadata: { title, type: 'url', url, notebookId },
    importance: 0.5,
  })
  hub.addMemory(memory)
  return memoryToSource(memory)
}

export function importText(text: string, notebookId: string): Source {
  const hub = ensureHub()
  const id = generateId('src')
  const title = text.substring(0, 30).replace(/\n/g, ' ')

  const memory = createMemory({
    id,
    content: text,
    memory_type: 'semantic',
    group_id: `source:${notebookId}`,
    tags: ['source', 'text'],
    metadata: { title, type: 'text', notebookId },
    importance: 0.5,
  })
  hub.addMemory(memory)
  return memoryToSource(memory)
}

export function getSources(notebookId: string): Source[] {
  const hub = ensureHub()
  const memories = hub.getMemoriesByGroup(`source:${notebookId}`, 1000)
  return memories
    .filter(m => m.tags.includes('source'))
    .map(memoryToSource)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function deleteSource(sourceId: string): boolean {
  const hub = ensureHub()
  return hub.deleteMemory(sourceId)
}
