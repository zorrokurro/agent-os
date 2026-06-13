import type { Database as SqlJsDatabase, SqlValue } from 'sql.js'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { createRequire } from 'module'
import { UniversalMemory, MemoryType, EpisodeType } from './schemas'

const require = createRequire(import.meta.url)

export interface Session {
  id: string
  agent_name: string
  agent_id: string
  created_at: string
  updated_at: string
  total_tokens: number
}

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  token_count: number
  created_at: string
  metadata: Record<string, unknown>
}

const DB_DIR = path.join(os.homedir(), 'AgentOS', 'data')
const DB_PATH = path.join(DB_DIR, 'ump.db')

const CREATE_MEMORIES_TABLE = `
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  memory_type TEXT NOT NULL DEFAULT 'semantic',
  group_id TEXT,
  episode_type TEXT,
  block_label TEXT,
  block_limit INTEGER,
  read_only INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  temporal TEXT NOT NULL DEFAULT '{}',
  provenance TEXT NOT NULL DEFAULT '{}',
  tags TEXT NOT NULL DEFAULT '[]',
  scope TEXT,
  importance REAL NOT NULL DEFAULT 0.5,
  relations TEXT NOT NULL DEFAULT '[]',
  embedding TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  conversion_warnings TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_group ON memories(group_id);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
`

const CREATE_SESSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL DEFAULT '',
  agent_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  total_tokens INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_name);
`

const CREATE_MESSAGES_TABLE = `
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL DEFAULT '',
  token_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
`

const CREATE_TASKS_TABLE = `
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT '',
  target TEXT NOT NULL DEFAULT '',
  result TEXT,
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_target ON tasks(target);
`

export interface Task {
  id: string
  title: string
  content: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  source: string
  target: string
  result: string | null
  created_at: string
  updated_at: string
}

function rowsToObjects(results: { columns: string[]; values: unknown[][] }): Record<string, unknown>[] {
  const { columns, values } = results
  return values.map(row => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col, i) => { obj[col] = row[i] })
    return obj
  })
}

export class MemoryHub {
  private db: SqlJsDatabase | null = null
  private _initialized = false
  private SQL: { Database: new (data?: ArrayLike<number>) => SqlJsDatabase } | null = null

  async initialize(): Promise<boolean> {
    if (this._initialized) return true
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

    const initSqlJs = require('sql.js') as typeof import('sql.js').default
    this.SQL = await initSqlJs()

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH)
      this.db = new this.SQL.Database(buffer)
    } else {
      this.db = new this.SQL.Database()
    }

    this.db.run(CREATE_MEMORIES_TABLE)
    this.db.run(CREATE_SESSIONS_TABLE)
    this.db.run(CREATE_MESSAGES_TABLE)
    this.db.run(CREATE_TASKS_TABLE)
    this.save()
    this._initialized = true
    return true
  }

  private ensureDb(): SqlJsDatabase {
    if (!this.db) throw new Error('MemoryHub not initialized. Call initialize() first.')
    return this.db
  }

  save(): void {
    if (!this.db) return
    const data = this.db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(DB_PATH, buffer)
  }

  addMemory(memory: UniversalMemory): boolean {
    const db = this.ensureDb()
    db.run(`
      INSERT OR REPLACE INTO memories
      (id, schema_version, content, memory_type, group_id, episode_type,
       block_label, block_limit, read_only, hidden, temporal, provenance,
       tags, scope, importance, relations, embedding, metadata,
       conversion_warnings, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      memory.id,
      memory.schema_version,
      memory.content,
      memory.memory_type,
      memory.group_id ?? null,
      memory.episode_type ?? null,
      memory.block_label ?? null,
      memory.block_limit ?? null,
      memory.read_only ? 1 : 0,
      memory.hidden ? 1 : 0,
      JSON.stringify(memory.temporal),
      JSON.stringify(memory.provenance),
      JSON.stringify(memory.tags),
      memory.scope ?? null,
      memory.importance,
      JSON.stringify(memory.relations),
      memory.embedding ? JSON.stringify(memory.embedding) : null,
      JSON.stringify(memory.metadata),
      JSON.stringify(memory.conversion_warnings),
      memory.temporal.created_at,
    ])
    this.save()
    return true
  }

  getMemory(id: string): UniversalMemory | undefined {
    const db = this.ensureDb()
    const results = db.exec('SELECT * FROM memories WHERE id = ?', [id])
    if (results.length === 0 || results[0].values.length === 0) return undefined
    const row = rowsToObjects(results[0])[0]
    return this.rowToMemory(row)
  }

  updateMemory(memory: UniversalMemory): boolean {
    const db = this.ensureDb()
    const results = db.exec('SELECT id FROM memories WHERE id = ?', [memory.id])
    if (results.length === 0 || results[0].values.length === 0) return false
    this.addMemory(memory)
    return true
  }

  deleteMemory(id: string): boolean {
    const db = this.ensureDb()
    const before = db.exec('SELECT COUNT(*) as cnt FROM memories WHERE id = ?', [id])
    db.run('DELETE FROM memories WHERE id = ?', [id])
    const after = db.exec('SELECT COUNT(*) as cnt FROM memories WHERE id = ?', [id])
    const hadRow = before.length > 0 && before[0].values[0][0] as number > 0
    const hasRow = after.length > 0 && after[0].values[0][0] as number > 0
    this.save()
    return hadRow && !hasRow
  }

  searchByContent(query: string, opts?: { memoryType?: MemoryType; groupId?: string; tags?: string[]; limit?: number }): UniversalMemory[] {
    const db = this.ensureDb()
    const limit = opts?.limit ?? 10
    const q = query.toLowerCase()

    const conditions: string[] = []
    const params: SqlValue[] = []

    if (opts?.memoryType) {
      conditions.push('memory_type = ?')
      params.push(opts.memoryType)
    }
    if (opts?.groupId) {
      conditions.push('group_id = ?')
      params.push(opts.groupId)
    }
    if (opts?.tags && opts.tags.length > 0) {
      for (const tag of opts.tags) {
        conditions.push('tags LIKE ?')
        params.push(`%${tag}%`)
      }
    }

    conditions.push('LOWER(content) LIKE ?')
    params.push(`%${q}%`)

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const results = db.exec(`SELECT * FROM memories ${where} ORDER BY importance DESC LIMIT ?`, [...params, limit])

    if (results.length === 0) return []
    return rowsToObjects(results[0]).map(r => this.rowToMemory(r))
  }

  getMemoriesByType(type: MemoryType, limit = 100): UniversalMemory[] {
    const db = this.ensureDb()
    const results = db.exec('SELECT * FROM memories WHERE memory_type = ? ORDER BY importance DESC LIMIT ?', [type, limit])
    if (results.length === 0) return []
    return rowsToObjects(results[0]).map(r => this.rowToMemory(r))
  }

  getMemoriesByGroup(groupId: string, limit = 100): UniversalMemory[] {
    const db = this.ensureDb()
    const results = db.exec('SELECT * FROM memories WHERE group_id = ? ORDER BY importance DESC LIMIT ?', [groupId, limit])
    if (results.length === 0) return []
    return rowsToObjects(results[0]).map(r => this.rowToMemory(r))
  }

  getStatistics(): Record<string, unknown> {
    const db = this.ensureDb()

    const totalResults = db.exec('SELECT COUNT(*) as cnt FROM memories')
    const totalRow = totalResults.length > 0 ? totalResults[0].values[0][0] as number : 0

    const typeResults = db.exec('SELECT memory_type, COUNT(*) as cnt FROM memories GROUP BY memory_type')
    const byType: Record<string, number> = {}
    if (typeResults.length > 0) {
      for (const row of typeResults[0].values) {
        byType[row[0] as string] = row[1] as number
      }
    }

    const groupResults = db.exec('SELECT group_id, COUNT(*) as cnt FROM memories WHERE group_id IS NOT NULL GROUP BY group_id')
    const byGroup: Record<string, number> = {}
    if (groupResults.length > 0) {
      for (const row of groupResults[0].values) {
        byGroup[row[0] as string] = row[1] as number
      }
    }

    const tagResults = db.exec('SELECT tags FROM memories')
    const tagCounts: Record<string, number> = {}
    if (tagResults.length > 0) {
      for (const row of tagResults[0].values) {
        const tags = JSON.parse(row[0] as string) as string[]
        for (const t of tags) tagCounts[t] = (tagCounts[t] || 0) + 1
      }
    }
    const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)

    const avgResults = db.exec('SELECT AVG(importance) as avg_imp FROM memories')
    const avgImp = avgResults.length > 0 ? (avgResults[0].values[0][0] as number ?? 0) : 0

    return {
      total_memories: totalRow,
      by_type: byType,
      by_group: byGroup,
      top_tags: Object.fromEntries(sortedTags),
      avg_importance: avgImp,
    }
  }

  getAll(): UniversalMemory[] {
    const db = this.ensureDb()
    const results = db.exec('SELECT * FROM memories ORDER BY created_at DESC')
    if (results.length === 0) return []
    return rowsToObjects(results[0]).map(r => this.rowToMemory(r))
  }

  clear(): void {
    const db = this.ensureDb()
    db.run('DELETE FROM memories')
    this.save()
  }

  count(): number {
    const db = this.ensureDb()
    const results = db.exec('SELECT COUNT(*) as cnt FROM memories')
    if (results.length === 0) return 0
    return results[0].values[0][0] as number
  }

  createSession(agentName: string, agentId: string): Session {
    const db = this.ensureDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    db.run('INSERT INTO sessions (id, agent_name, agent_id, created_at, updated_at, total_tokens) VALUES (?, ?, ?, ?, ?, 0)', [id, agentName, agentId, now, now])
    this.save()
    return { id, agent_name: agentName, agent_id: agentId, created_at: now, updated_at: now, total_tokens: 0 }
  }

  getSession(sessionId: string): Session | undefined {
    const db = this.ensureDb()
    const results = db.exec('SELECT * FROM sessions WHERE id = ?', [sessionId])
    if (results.length === 0 || results[0].values.length === 0) return undefined
    const row = rowsToObjects(results[0])[0]
    return this.rowToSession(row)
  }

  addMessage(sessionId: string, role: 'user' | 'assistant' | 'system', content: string, tokenCount = 0, metadata: Record<string, unknown> = {}): Message {
    const db = this.ensureDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    db.run('INSERT INTO messages (id, session_id, role, content, token_count, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, sessionId, role, content, tokenCount, now, JSON.stringify(metadata)])
    db.run('UPDATE sessions SET updated_at = ?, total_tokens = total_tokens + ? WHERE id = ?', [now, tokenCount, sessionId])
    this.save()
    return { id, session_id: sessionId, role, content, token_count: tokenCount, created_at: now, metadata }
  }

  getSessionMessages(sessionId: string): Message[] {
    const db = this.ensureDb()
    const results = db.exec('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC', [sessionId])
    if (results.length === 0) return []
    return rowsToObjects(results[0]).map(r => this.rowToMessage(r))
  }

  getSessions(agentName?: string, limit = 50): Session[] {
    const db = this.ensureDb()
    let results
    if (agentName) {
      results = db.exec('SELECT * FROM sessions WHERE agent_name = ? ORDER BY updated_at DESC LIMIT ?', [agentName, limit])
    } else {
      results = db.exec('SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ?', [limit])
    }
    if (results.length === 0) return []
    return rowsToObjects(results[0]).map(r => this.rowToSession(r))
  }

  deleteSession(sessionId: string): boolean {
    const db = this.ensureDb()
    db.run('DELETE FROM messages WHERE session_id = ?', [sessionId])
    const before = db.exec('SELECT COUNT(*) as cnt FROM sessions WHERE id = ?', [sessionId])
    db.run('DELETE FROM sessions WHERE id = ?', [sessionId])
    const after = db.exec('SELECT COUNT(*) as cnt FROM sessions WHERE id = ?', [sessionId])
    const hadRow = before.length > 0 && before[0].values[0][0] as number > 0
    const hasRow = after.length > 0 && after[0].values[0][0] as number > 0
    this.save()
    return hadRow && !hasRow
  }

  getSessionStats(): Record<string, unknown> {
    const db = this.ensureDb()

    const totalResults = db.exec('SELECT COUNT(*) as cnt FROM sessions')
    const totalSessions = totalResults.length > 0 ? totalResults[0].values[0][0] as number : 0

    const tokenResults = db.exec('SELECT COALESCE(SUM(total_tokens), 0) as total FROM sessions')
    const totalTokens = tokenResults.length > 0 ? tokenResults[0].values[0][0] as number : 0

    const msgResults = db.exec('SELECT COUNT(*) as cnt FROM messages')
    const totalMessages = msgResults.length > 0 ? msgResults[0].values[0][0] as number : 0

    return {
      total_sessions: totalSessions,
      total_messages: totalMessages,
      total_tokens: totalTokens,
    }
  }

  getConversationsForMemory(agentName?: string, limit = 50): Array<{ session: Session; messages: Message[] }> {
    const sessions = this.getSessions(agentName, limit)
    return sessions.map(s => ({ session: s, messages: this.getSessionMessages(s.id) }))
  }

  // === Task Queue ===

  createTask(title: string, content: string, target: string, source = 'AgentOS'): Task {
    const db = this.ensureDb()
    const id = `task_${crypto.randomUUID()}`
    const now = new Date().toISOString()
    db.run(
      'INSERT INTO tasks (id, title, content, status, source, target, result, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, content, 'pending', source, target, null, now, now]
    )
    this.save()
    return { id, title, content, status: 'pending', source, target, result: null, created_at: now, updated_at: now }
  }

  getTasks(target?: string, status?: string): Task[] {
    const db = this.ensureDb()
    const conditions: string[] = []
    const params: SqlValue[] = []
    if (target) { conditions.push('target = ?'); params.push(target) }
    if (status) { conditions.push('status = ?'); params.push(status) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const results = db.exec(`SELECT * FROM tasks ${where} ORDER BY created_at DESC`, params)
    if (results.length === 0) return []
    return rowsToObjects(results[0]).map(r => this.rowToTask(r))
  }

  updateTaskStatus(id: string, status: string, result?: string): boolean {
    const db = this.ensureDb()
    const now = new Date().toISOString()
    if (result !== undefined) {
      db.run('UPDATE tasks SET status = ?, result = ?, updated_at = ? WHERE id = ?', [status, result, now, id])
    } else {
      db.run('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', [status, now, id])
    }
    this.save()
    return true
  }

  getPendingTasks(target: string): Task[] {
    return this.getTasks(target, 'pending')
  }

  private rowToTask(row: Record<string, unknown>): Task {
    return {
      id: row.id as string,
      title: row.title as string,
      content: row.content as string,
      status: row.status as Task['status'],
      source: row.source as string,
      target: row.target as string,
      result: row.result as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    }
  }

  close(): void {
    if (this.db) {
      this.save()
      this.db.close()
      this.db = null
      this._initialized = false
    }
  }

  // === Adapter Registry ===

  private _adapters = new Map<string, { importMemory: (data: Record<string, unknown>) => UniversalMemory; exportMemory: (m: UniversalMemory) => Record<string, unknown> }>()

  registerAdapter(name: string, adapter: { importMemory: (data: Record<string, unknown>) => UniversalMemory; exportMemory: (m: UniversalMemory) => Record<string, unknown> }): void {
    this._adapters.set(name, adapter)
  }

  getAdapter(name: string) {
    return this._adapters.get(name)
  }

  listAdapters(): string[] {
    return Array.from(this._adapters.keys())
  }

  importFromAdapter(adapterName: string, data: Record<string, unknown>): UniversalMemory | null {
    const adapter = this._adapters.get(adapterName)
    if (!adapter) return null
    const memory = adapter.importMemory(data)
    this.addMemory(memory)
    return memory
  }

  exportToAdapter(memoryId: string, adapterName: string): Record<string, unknown> | null {
    const adapter = this._adapters.get(adapterName)
    if (!adapter) return null
    const memory = this.getMemory(memoryId)
    if (!memory) return null
    return adapter.exportMemory(memory)
  }

  // === Related Memories ===

  getRelatedMemories(memoryId: string, relationType?: string, limit = 10): UniversalMemory[] {
    const memory = this.getMemory(memoryId)
    if (!memory) return []

    const relatedIds = new Set<string>()

    // Outgoing relations
    for (const rel of memory.relations) {
      if (relationType && rel.relation_type !== relationType) continue
      relatedIds.add(rel.target_id)
    }

    // Incoming relations (scan all memories)
    const allMemories = this.getAll()
    for (const other of allMemories) {
      for (const rel of other.relations) {
        if (rel.target_id === memoryId) {
          if (relationType && rel.relation_type !== relationType) continue
          relatedIds.add(other.id)
        }
      }
    }

    const related: UniversalMemory[] = []
    for (const rid of relatedIds) {
      const m = this.getMemory(rid)
      if (m) related.push(m)
      if (related.length >= limit) break
    }
    return related
  }

  private rowToMemory(row: Record<string, unknown>): UniversalMemory {
    return {
      schema_version: row.schema_version as string,
      id: row.id as string,
      content: row.content as string,
      memory_type: row.memory_type as MemoryType,
      group_id: row.group_id as string | undefined,
      episode_type: row.episode_type as EpisodeType | undefined,
      block_label: row.block_label as string | undefined,
      block_limit: row.block_limit as number | undefined,
      read_only: (row.read_only as number) === 1,
      hidden: (row.hidden as number) === 1,
      temporal: JSON.parse(row.temporal as string),
      provenance: JSON.parse(row.provenance as string),
      tags: JSON.parse(row.tags as string),
      scope: row.scope as string | undefined,
      importance: row.importance as number,
      relations: JSON.parse(row.relations as string),
      embedding: row.embedding ? JSON.parse(row.embedding as string) : undefined,
      metadata: JSON.parse(row.metadata as string),
      conversion_warnings: JSON.parse(row.conversion_warnings as string),
    }
  }

  private rowToSession(row: Record<string, unknown>): Session {
    return {
      id: row.id as string,
      agent_name: row.agent_name as string,
      agent_id: row.agent_id as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      total_tokens: row.total_tokens as number,
    }
  }

  private rowToMessage(row: Record<string, unknown>): Message {
    return {
      id: row.id as string,
      session_id: row.session_id as string,
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content as string,
      token_count: row.token_count as number,
      created_at: row.created_at as string,
      metadata: JSON.parse(row.metadata as string),
    }
  }
}
