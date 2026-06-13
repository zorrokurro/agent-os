import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import { UniversalMemory, MemoryType, AdapterCapabilities, createMemory, TemporalInfo } from './schemas'

const TYPE_MAP: Record<string, [string, string]> = {
  user_profile: ['semantic', 'profile'],
  brand_voice: ['semantic', 'brand'],
  projects: ['procedural', 'project'],
  conversations: ['episodic', 'conversation'],
  outputs: ['episodic', 'output'],
}

export interface AgentOSFileInput {
  path: string
  content: string
  type: string
  modified: string
}

export class AgentOSAdapter {
  readonly FORMAT_NAME = 'agentos'

  getCapabilities(): AdapterCapabilities {
    return { semantic: true, episodic: true, procedural: true, graph: false, temporal: false }
  }

  importMemory(raw: AgentOSFileInput): UniversalMemory {
    const { path: filePath, content, type: fileType, modified } = raw
    return this.parseFile(filePath, content, fileType, modified)
  }

  parseFile(filePath: string, content: string, fileType: string, modified: string = ''): UniversalMemory {
    const [memoryTypeStr, category] = this.resolveType(filePath, fileType)
    const memoryType = memoryTypeStr as MemoryType
    const memoryId = this.makeId(filePath)
    const title = this.extractTitle(content, filePath)
    const tags = this.extractTags(content)
    if (category) tags.unshift(`agentos:${category}`)
    const cleanContent = this.cleanContent(content)

    const temporal: TemporalInfo = { created_at: new Date().toISOString() }
    if (modified) {
      try { temporal.updated_at = new Date(modified).toISOString() } catch { /* ignore */ }
    }

    const importance = this.estimateImportance(fileType, content)

    return createMemory({
      id: memoryId,
      content: cleanContent,
      memory_type: memoryType,
      group_id: category,
      temporal,
      provenance: {
        source: 'agentos',
        original_format: 'agentos_markdown',
        source_description: `AgentOS ${fileType} file: ${filePath}`,
        confidence: 1.0,
        extracted_at: new Date().toISOString(),
      },
      tags,
      importance,
      metadata: { file_path: filePath, file_type: fileType, title, original_category: category },
    })
  }

  exportMemory(memory: UniversalMemory): { path: string; content: string; type: string; modified: string } {
    const fileType = (memory.metadata.file_type as string) || 'profile'
    const filePath = (memory.metadata.file_path as string) || `memory/${memory.id}.md`
    const title = (memory.metadata.title as string) || memory.id

    const mdLines = [`# ${title}`, '', memory.content]
    const contentTags = memory.tags.filter(t => !t.startsWith('agentos:'))
    for (const tag of contentTags) {
      mdLines.push('', `## ${tag.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`)
    }

    return {
      path: filePath,
      content: mdLines.join('\n'),
      type: fileType,
      modified: memory.temporal.updated_at || '',
    }
  }

  importDirectory(memoryBase: string): UniversalMemory[] {
    const memories: UniversalMemory[] = []
    const base = path.resolve(memoryBase)
    if (!fs.existsSync(base)) return memories

    // Top-level .md files
    for (const entry of fs.readdirSync(base)) {
      const fullPath = path.join(base, entry)
      if (!fs.statSync(fullPath).isFile() || !entry.endsWith('.md')) continue
      const content = this.safeRead(fullPath)
      if (!content) continue
      const fileType = this.resolveFileType(entry, '')
      const modified = fs.statSync(fullPath).mtime.toISOString()
      memories.push(this.parseFile(fullPath, content, fileType, modified))
    }

    // Subdirectories
    for (const subDir of ['projects', 'conversations', 'outputs']) {
      const dirPath = path.join(base, subDir)
      if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) continue
      for (const entry of fs.readdirSync(dirPath)) {
        const fullPath = path.join(dirPath, entry)
        if (!fs.statSync(fullPath).isFile() || !entry.endsWith('.md')) continue
        const content = this.safeRead(fullPath)
        if (!content) continue
        const modified = fs.statSync(fullPath).mtime.toISOString()
        memories.push(this.parseFile(fullPath, content, subDir, modified))
      }
    }

    return memories
  }

  exportToFiles(memories: UniversalMemory[], memoryBase: string): string[] {
    const written: string[] = []
    const base = path.resolve(memoryBase)
    fs.mkdirSync(base, { recursive: true })

    for (const memory of memories) {
      const exported = this.exportMemory(memory)
      let filePath = path.resolve(exported.path)
      if (!filePath.startsWith(base)) filePath = path.join(base, path.basename(exported.path))
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, exported.content, 'utf-8')
      written.push(filePath)
    }
    return written
  }

  private resolveType(filePath: string, fileType: string): [string, string] {
    if (fileType in TYPE_MAP) return TYPE_MAP[fileType]
    const p = filePath.toLowerCase().replace(/\\/g, '/')
    for (const [key, val] of Object.entries(TYPE_MAP)) {
      if (p.includes(key)) return val
    }
    return ['semantic', 'profile']
  }

  private makeId(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase()
    const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12)
    return `agentos_${hash}`
  }

  private extractTitle(content: string, filePath: string): string {
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('# ')) return trimmed.slice(2).trim()
    }
    return path.basename(filePath, path.extname(filePath)).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  private extractTags(content: string): string[] {
    const tags: string[] = []
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('## ')) {
        let tag = trimmed.slice(3).trim().toLowerCase()
        tag = tag.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')
        if (tag) tags.push(tag)
      }
    }
    return tags
  }

  private cleanContent(content: string): string {
    return content.split('\n').filter(line => !line.trim().startsWith('<!--')).join('\n').trim()
  }

  private estimateImportance(fileType: string, content: string): number {
    const base: Record<string, number> = { profile: 0.8, brand_voice: 0.7, projects: 0.6, conversations: 0.5, outputs: 0.5 }
    const b = base[fileType] || 0.5
    return Math.round(Math.min(b + Math.min(content.length / 5000, 0.2), 1.0) * 100) / 100
  }

  private safeRead(filePath: string): string | null {
    try { return fs.readFileSync(filePath, 'utf-8') } catch { return null }
  }

  private resolveFileType(filename: string, _dirName: string): string {
    const name = filename.toLowerCase().replace('.md', '')
    if (name.includes('profile')) return 'user_profile'
    if (name.includes('brand')) return 'brand_voice'
    if (_dirName) return _dirName
    return 'profile'
  }
}
