/**
 * Search Provider
 *
 * Interface for indexing and searching memory entries.
 * Search is pluggable — swap SQLite FTS for LanceDB, Qdrant, etc.
 *
 * Usage:
 *   const search = new InMemorySearchProvider()
 *   await search.index(entry)
 *   const results = await search.search('hello world', { limit: 10 })
 */

import type { MemoryEntry, SearchResult, SearchItem } from '../KnowledgeTypes'

// ─── Search Provider Interface ───────────────────────────────────────────────

export interface SearchProvider {
  /** Provider name */
  readonly name: string

  /**
   * Index a memory entry.
   */
  index(entry: MemoryEntry): Promise<void>

  /**
   * Remove an entry from the index.
   */
  remove(id: string): Promise<void>

  /**
   * Update an indexed entry.
   */
  update(entry: MemoryEntry): Promise<void>

  /**
   * Search by text (keyword or semantic).
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult>

  /**
   * Search by vector similarity.
   */
  searchByVector(vector: number[], options?: SearchOptions): Promise<SearchResult>

  /**
   * Get index stats.
   */
  stats(): Promise<SearchStats>

  /**
   * Clear the index.
   */
  clear(): Promise<void>
}

// ─── Search Options ──────────────────────────────────────────────────────────

export interface SearchOptions {
  /** Maximum results */
  limit?: number
  /** Offset for pagination */
  offset?: number
  /** Minimum score threshold */
  minScore?: number
  /** Filter by type */
  type?: string
  /** Filter by tags */
  tags?: string[]
}

// ─── Search Stats ────────────────────────────────────────────────────────────

export interface SearchStats {
  /** Total indexed entries */
  totalEntries: number
  /** Index size in bytes (if applicable) */
  indexSize?: number
  /** Provider-specific stats */
  metadata?: Record<string, unknown>
}

// ─── In-Memory Search Provider ───────────────────────────────────────────────

export class InMemorySearchProvider implements SearchProvider {
  readonly name = 'in-memory'
  private entries = new Map<string, MemoryEntry>()

  async index(entry: MemoryEntry): Promise<void> {
    this.entries.set(entry.id, { ...entry })
  }

  async remove(id: string): Promise<void> {
    this.entries.delete(id)
  }

  async update(entry: MemoryEntry): Promise<void> {
    this.entries.set(entry.id, { ...entry })
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const startTime = Date.now()
    const limit = options?.limit ?? 10
    const offset = options?.offset ?? 0

    let results: SearchItem[] = []

    // Simple text search
    for (const entry of this.entries.values()) {
      if (options?.type && entry.type !== options.type) continue
      if (options?.tags && !options.tags.some((t) => entry.tags.includes(t))) continue

      const score = this.calculateTextScore(query, entry)
      if (score > 0 && (!options?.minScore || score >= options.minScore)) {
        results.push({
          id: entry.id,
          content: entry.content,
          score,
          metadata: entry.metadata,
        })
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score)

    // Apply pagination
    results = results.slice(offset, offset + limit)

    return {
      items: results,
      total: results.length,
      queryTime: Date.now() - startTime,
    }
  }

  async searchByVector(vector: number[], options?: SearchOptions): Promise<SearchResult> {
    const startTime = Date.now()
    const limit = options?.limit ?? 10
    const offset = options?.offset ?? 0

    let results: SearchItem[] = []

    for (const entry of this.entries.values()) {
      if (options?.type && entry.type !== options.type) continue
      if (!entry.embedding) continue

      const score = this.cosineSimilarity(vector, entry.embedding)
      if (score > 0 && (!options?.minScore || score >= options.minScore)) {
        results.push({
          id: entry.id,
          content: entry.content,
          score,
          metadata: entry.metadata,
        })
      }
    }

    results.sort((a, b) => b.score - a.score)
    results = results.slice(offset, offset + limit)

    return {
      items: results,
      total: results.length,
      queryTime: Date.now() - startTime,
    }
  }

  async stats(): Promise<SearchStats> {
    return {
      totalEntries: this.entries.size,
    }
  }

  async clear(): Promise<void> {
    this.entries.clear()
  }

  private calculateTextScore(query: string, entry: MemoryEntry): number {
    const queryLower = query.toLowerCase()
    const contentLower = entry.content.toLowerCase()

    // Exact match
    if (contentLower === queryLower) return 1.0

    // Contains match
    if (contentLower.includes(queryLower)) return 0.8

    // Word overlap
    const queryWords = queryLower.split(/\s+/)
    const contentWords = contentLower.split(/\s+/)
    const overlap = queryWords.filter((w) => contentWords.includes(w)).length
    if (overlap > 0) return overlap / queryWords.length * 0.6

    return 0
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) return 0
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}
