import fs from 'fs'
import path from 'path'
import chokidar from 'chokidar'
import * as notebook from './notebook'

// ---------------------------------------------------------------------------
// Obsidian Sync Service
// ---------------------------------------------------------------------------

let watcher: fs.FSWatcher | null = null

function getVaultPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Store = require('electron-store')
    const store = new Store()
    return store.get('obsidianVault') || ''
  } catch {
    return ''
  }
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 200)
}

// === Frontmatter helpers ===

interface Frontmatter {
  tags: string[]
  created: string
  source: string
  [key: string]: unknown
}

function parseFrontmatter(content: string): { meta: Frontmatter; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return { meta: { tags: [], created: '', source: 'Obsidian' }, body: content }

  const lines = match[1].split(/\r?\n/)
  const meta: Frontmatter = { tags: [], created: '', source: 'Obsidian' }
  for (const line of lines) {
    const kv = line.match(/^(\w+):\s*(.+)$/)
    if (!kv) continue
    const [, key, val] = kv
    if (key === 'tags') {
      // Parse [tag1, tag2] or tag1, tag2
      const tagStr = val.replace(/[\[\]]/g, '').trim()
      meta.tags = tagStr ? tagStr.split(/,\s*/).map(t => t.trim()).filter(Boolean) : []
    } else if (key === 'created') {
      meta.created = val.trim()
    } else if (key === 'source') {
      meta.source = val.trim()
    } else {
      meta[key] = val.trim()
    }
  }
  return { meta, body: match[2] }
}

function buildFrontmatter(tags: string[], created: string): string {
  const tagLine = tags.length > 0 ? `[${tags.join(', ')}]` : '[]'
  return `---\ntags: ${tagLine}\ncreated: ${created}\nsource: AgentOS\n---\n`
}

// === Feature A: AgentOS → Obsidian (Export) ===

export function exportToObsidian(): { exported: number; errors: string[] } {
  const vaultPath = getVaultPath()
  if (!vaultPath) throw new Error('Obsidian Vault 路徑未設定')
  if (!fs.existsSync(vaultPath)) throw new Error(`Vault 路徑不存在：${vaultPath}`)

  const baseDir = path.join(vaultPath, 'AgentOS')
  ensureDir(baseDir)

  const notebooks = notebook.listNotebooks()
  let exported = 0
  const errors: string[] = []

  for (const nb of notebooks) {
    try {
      const nbDir = path.join(baseDir, sanitizeFilename(nb.name))
      ensureDir(nbDir)

      const notes = notebook.listNotes(nb.id)
      for (const note of notes) {
        try {
          const frontmatter = buildFrontmatter(note.tags, note.createdAt)
          const fileContent = frontmatter + '\n' + note.content
          const filePath = path.join(nbDir, sanitizeFilename(note.title) + '.md')
          fs.writeFileSync(filePath, fileContent, 'utf-8')
          exported++
        } catch (e) {
          errors.push(`匯出筆記失敗：${note.title} - ${e}`)
        }
      }
    } catch (e) {
      errors.push(`匯出筆記本失敗：${nb.name} - ${e}`)
    }
  }

  return { exported, errors }
}

// === Feature B: Obsidian → AgentOS (Import) ===

function scanMdFiles(dir: string, baseDir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // Skip the AgentOS folder to avoid circular sync
      if (fullPath === path.join(baseDir, 'AgentOS')) continue
      results.push(...scanMdFiles(fullPath, baseDir))
    } else if (entry.name.endsWith('.md')) {
      results.push(fullPath)
    }
  }
  return results
}

function parseNoteTitleFromPath(filePath: string, vaultPath: string): { notebookName: string; title: string } {
  const relative = path.relative(vaultPath, filePath)
  const parts = relative.split(/[\\/]/)
  // Remove .md extension from last part
  const title = parts[parts.length - 1].replace(/\.md$/, '')
  const notebookName = parts.length > 1 ? parts[parts.length - 2] : 'Obsidian Import'
  return { notebookName, title }
}

export function importFromObsidian(): { imported: number; updated: number; skipped: number; errors: string[] } {
  const vaultPath = getVaultPath()
  if (!vaultPath) throw new Error('Obsidian Vault 路徑未設定')
  if (!fs.existsSync(vaultPath)) throw new Error(`Vault 路徑不存在：${vaultPath}`)

  const mdFiles = scanMdFiles(vaultPath, vaultPath)
  let imported = 0
  let updated = 0
  let skipped = 0
  const errors: string[] = []

  // Get existing notebooks
  const existingNotebooks = notebook.listNotebooks()
  const notebookMap = new Map(existingNotebooks.map(nb => [nb.name, nb]))

  for (const filePath of mdFiles) {
    try {
      const { notebookName, title } = parseNoteTitleFromPath(filePath, vaultPath)

      // Read file
      const raw = fs.readFileSync(filePath, 'utf-8')
      const { meta, body } = parseFrontmatter(raw)
      const fileStat = fs.statSync(filePath)

      // Get or create notebook
      let nb = notebookMap.get(notebookName)
      if (!nb) {
        nb = notebook.createNotebook(notebookName, '', '📄', '#a078ff')
        notebookMap.set(notebookName, nb)
      }

      // Find existing note by title
      const existingNotes = notebook.listNotes(nb.id)
      const existingNote = existingNotes.find(n => n.title === title)

      if (existingNote) {
        // Check if file is newer
        const noteUpdated = new Date(existingNote.updatedAt).getTime()
        const fileUpdated = fileStat.mtimeMs
        if (fileUpdated > noteUpdated) {
          notebook.updateNote(existingNote.id, {
            content: body,
            tags: meta.tags.length > 0 ? meta.tags : existingNote.tags,
          })
          updated++
        } else {
          skipped++
        }
      } else {
        // Create new note
        notebook.createNote(nb.id, title, body, meta.tags)
        imported++
      }
    } catch (e) {
      errors.push(`匯入失敗：${filePath} - ${e}`)
    }
  }

  return { imported, updated, skipped, errors }
}

// === Feature C: Watch for changes ===

export function startWatching(): { success: boolean; message: string } {
  const vaultPath = getVaultPath()
  if (!vaultPath) return { success: false, message: 'Vault 路徑未設定' }
  if (!fs.existsSync(vaultPath)) return { success: false, message: `Vault 路徑不存在：${vaultPath}` }

  stopWatching()

  const watchDir = path.join(vaultPath, 'AgentOS')
  ensureDir(watchDir)

  watcher = chokidar.watch(watchDir, {
    ignored: /(^|[\/\\])\./,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 200 },
  })

  const processFile = (filePath: string) => {
    try {
      if (!filePath.endsWith('.md')) return
      const { notebookName, title } = parseNoteTitleFromPath(filePath, vaultPath)
      const raw = fs.readFileSync(filePath, 'utf-8')
      const { meta, body } = parseFrontmatter(raw)

      const existingNotebooks = notebook.listNotebooks()
      let nb = existingNotebooks.find(n => n.name === notebookName)
      if (!nb) {
        nb = notebook.createNotebook(notebookName, '', '📄', '#a078ff')
      }

      const existingNotes = notebook.listNotes(nb.id)
      const existingNote = existingNotes.find(n => n.title === title)

      if (existingNote) {
        notebook.updateNote(existingNote.id, {
          content: body,
          tags: meta.tags.length > 0 ? meta.tags : existingNote.tags,
        })
      } else {
        notebook.createNote(nb.id, title, body, meta.tags)
      }
      console.log(`[Obsidian Watch] 同步：${title}`)
    } catch (e) {
      console.error(`[Obsidian Watch] 錯誤：${e}`)
    }
  }

  watcher.on('add', processFile)
  watcher.on('change', processFile)

  return { success: true, message: `正在監聽 ${watchDir}` }
}

export function stopWatching() {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}

// === Test ===

export function testVaultPath(vaultPath: string): { ok: boolean; message: string } {
  if (!vaultPath) return { ok: false, message: '路徑為空' }
  if (!fs.existsSync(vaultPath)) return { ok: false, message: `路徑不存在：${vaultPath}` }
  try {
    const stat = fs.statSync(vaultPath)
    if (!stat.isDirectory()) return { ok: false, message: `不是資料夾：${vaultPath}` }
    // Check if it looks like an Obsidian vault
    const obsidianDir = path.join(vaultPath, '.obsidian')
    if (fs.existsSync(obsidianDir)) {
      return { ok: true, message: `✅ Obsidian Vault 偵測成功：${vaultPath}` }
    }
    return { ok: true, message: `✅ 資料夾存在（非標準 Obsidian Vault）：${vaultPath}` }
  } catch (e) {
    return { ok: false, message: `無法存取：${e}` }
  }
}
