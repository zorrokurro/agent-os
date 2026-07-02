/**
 * Memory Store
 *
 * Interface for persisting and retrieving memory entries.
 * Storage is pluggable — swap SQLite for DuckDB, Postgres, Vector DB.
 *
 * Usage:
 *   const store = new InMemoryStore()
 *   await store.set(entry)
 *   const result = await store.get('mem_123')
 */

import type { MemoryEntry, MemoryQuery, MemorySearchResult, MemoryType } from '../KnowledgeTypes'

// ─── Store Interface ─────────────────────────────────────────────────────────

export interface MemoryStore {
  /** Store name */
  readonly name: string

  /**
   * Store a memory entry (create or update).
   */
  set(entry: MemoryEntry): Promise<void>

  /**
   * Get a memory entry by ID.
   */
  get(id: string): Promise<MemoryEntry | undefined>

  /**
   * Delete a memory entry by ID.
   */
  delete(id: string): Promise<boolean>

  /**
   * Check if a memory entry exists.
   */
  has(id: string): Promise<boolean>

  /**
   * Query memory entries.
   */
  query(query: MemoryQuery): Promise<MemorySearchResult[]>

  /**
   * Get all memory entries (use with caution).
   */
  getAll(options?: { type?: MemoryType; limit?: number }): Promise<MemoryEntry[]>

  /**
   * Get memory count by type.
   */
  count(type?: MemoryType): Promise<number>

  /**
   * Delete expired entries.
   */
  cleanup(): Promise<number>

  /**
   * Clear all entries.
   */
  clear(): Promise<void>
}

// ─── In-Memory Store (for testing) ───────────────────────────────────────────

export class InMemoryStore implements MemoryStore {
  readonly name = 'in-memory'
  private entries = new Map<string, MemoryEntry>()

  async set(entry: MemoryEntry): Promise<void> {
    this.entries.set(entry.id, { ...entry })
  }

  async get(id: string): Promise<MemoryEntry | undefined> {
    const entry = this.entries.get(id)
    if (entry) {
      entry.accessCount++
      entry.lastAccessedAt = Date.now()
    }
    return entry ? { ...entry } : undefined
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id)
  }

  async has(id: string): Promise<boolean> {
    return this.entries.has(id)
  }

  async query(query: MemoryQuery): Promise<MemorySearchResult[]> {
    let results = Array.from(this.entries.values())

    // Filter by type
    if (query.type) {
      const types = Array.isArray(query.type) ? query.type : [query.type]
      results = results.filter((e) => types.includes(e.type))
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter((e) =>
        query.tags!.some((tag) => e.tags.includes(tag)),
      )
    }

    // Filter by min importance
    if (query.minImportance !== undefined) {
      results = results.filter((e) => e.importance >= query.minImportance!)
    }

    // Filter by max age
    if (query.maxAge !== undefined) {
      const cutoff = Date.now() - query.maxAge
      results = results.filter((e) => e.createdAt >= cutoff)
    }

    // Filter by text (simple contains)
    if (query.text) {
      const lowerText = query.text.toLowerCase()
      results = results.filter((e) =>
        e.content.toLowerCase().includes(lowerText),
      )
    }

    // Sort
    const sortBy = query.sortBy ?? 'relevance'
    results.sort((a, b) => {
      if (sortBy === 'recency') return b.createdAt - a.createdAt
      if (sortBy === 'importance') return b.importance - a.importance
      if (sortBy === 'accessCount') return b.accessCount - a.accessCount
      return 0 // relevance (default)
    })

    // Convert to search results
    let searchResults = results.map((entry) => ({
      entry,
      score: this.calculateScore(entry, query),
    }))

    // Sort by score
    searchResults.sort((a, b) => b.score - a.score)

    // Apply limit and offset
    const offset = query.offset ?? 0
    const limit = query.limit ?? 100
    searchResults = searchResults.slice(offset, offset + limit)

    return searchResults
  }

  async getAll(options?: { type?: MemoryType; limit?: number }): Promise<MemoryEntry[]> {
    let entries = Array.from(this.entries.values())
    if (options?.type) {
      entries = entries.filter((e) => e.type === options.type)
    }
    if (options?.limit) {
      entries = entries.slice(0, options.limit)
    }
    return entries
  }

  async count(type?: MemoryType): Promise<number> {
    if (!type) return this.entries.size
    return Array.from(this.entries.values()).filter((e) => e.type === type).length
  }

  async cleanup(): Promise<number> {
    const now = Date.now()
    let removed = 0
    for (const [id, entry] of this.entries) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.entries.delete(id)
        removed++
      }
    }
    return removed
  }

  async clear(): Promise<void> {
    this.entries.clear()
  }

  private calculateScore(entry: MemoryEntry, query: MemoryQuery): number {
    let score = 0.5

    // Text match bonus
    if (query.text) {
      const lowerText = query.text.toLowerCase()
      if (entry.content.toLowerCase().includes(lowerText)) {
        score += 0.3
      }
    }

    // Importance bonus
    score += entry.importance * 0.1

    // Recency bonus (decay over time)
    const age = Date.now() - entry.createdAt
    const recencyBonus = Math.max(0, 0.1 - age / (1000 * 60 * 60 * 24 * 30)) // 30 day decay
    score += recencyBonus

    // Access count bonus
    const accessBonus = Math.min(0.1, entry.accessCount * 0.01)
    score += accessBonus

    return Math.min(1, score)
  }
}
