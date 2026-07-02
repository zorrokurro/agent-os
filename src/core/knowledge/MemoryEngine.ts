/**
 * Memory Engine
 *
 * Core engine for memory operations.
 * Orchestrates MemoryStore, EmbeddingProvider, and SearchProvider.
 *
 * Responsibilities:
 *   - Create, read, update, delete memory entries
 *   - Generate embeddings for text content
 *   - Index and search memories
 *   - Handle memory lifecycle (expiry, importance)
 *
 * Usage:
 *   const engine = new MemoryEngine({ store, embedding, search })
 *
 *   // Store a memory
 *   await engine.remember({
 *     type: 'semantic',
 *     content: 'AgentOS uses a plugin system for extensibility',
 *     tags: ['architecture', 'plugins'],
 *   })
 *
 *   // Retrieve memories
 *   const results = await engine.recall({ text: 'plugin system' })
 */

import type { Logger } from '../logger/Logger'
import type { IEventBus } from '../events/types'
import type {
  MemoryEntry,
  MemoryQuery,
  MemorySearchResult,
  MemoryType,
  MemoryMetadata,
  EmbeddingResult,
} from './KnowledgeTypes'
import type { MemoryStore } from './providers/MemoryStore'
import type { EmbeddingProvider } from './providers/EmbeddingProvider'
import type { SearchProvider } from './providers/SearchProvider'

// ─── Memory Engine Options ───────────────────────────────────────────────────

export interface MemoryEngineOptions {
  store: MemoryStore
  embedding?: EmbeddingProvider
  search?: SearchProvider
  logger?: Logger
  events?: IEventBus
  /** Auto-generate embeddings for new memories */
  autoEmbed?: boolean
  /** Default importance score */
  defaultImportance?: number
}

// ─── Remember Options ────────────────────────────────────────────────────────

export interface RememberOptions {
  type: MemoryType
  content: string
  metadata?: MemoryMetadata
  tags?: string[]
  importance?: number
  expiresAt?: number
  source?: string
  /** Skip embedding generation */
  skipEmbed?: boolean
}

// ─── Recall Options ──────────────────────────────────────────────────────────

export interface RecallOptions {
  text?: string
  type?: MemoryType | MemoryType[]
  tags?: string[]
  limit?: number
  minImportance?: number
  maxAge?: number
  sortBy?: 'relevance' | 'recency' | 'importance' | 'accessCount'
}

// ─── Memory Engine Stats ─────────────────────────────────────────────────────

export interface MemoryEngineStats {
  totalMemories: number
  byType: Record<string, number>
  indexedCount: number
  embeddedCount: number
}

// ─── Memory Engine ───────────────────────────────────────────────────────────

export class MemoryEngine {
  private store: MemoryStore
  private embedding?: EmbeddingProvider
  private search?: SearchProvider
  private logger?: Logger
  private events?: IEventBus
  private autoEmbed: boolean
  private defaultImportance: number

  constructor(options: MemoryEngineOptions) {
    this.store = options.store
    this.embedding = options.embedding
    this.search = options.search
    this.logger = options.logger
    this.events = options.events
    this.autoEmbed = options.autoEmbed ?? true
    this.defaultImportance = options.defaultImportance ?? 0.5
  }

  // ─── Create ────────────────────────────────────────────────────────────

  /**
   * Store a new memory.
   */
  async remember(options: RememberOptions): Promise<MemoryEntry> {
    const now = Date.now()
    const id = `mem_${Math.random().toString(16).slice(2, 10)}`

    const entry: MemoryEntry = {
      id,
      type: options.type,
      content: options.content,
      metadata: options.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      expiresAt: options.expiresAt,
      importance: options.importance ?? this.defaultImportance,
      accessCount: 0,
      lastAccessedAt: now,
      source: options.source,
      tags: options.tags ?? [],
    }

    // Generate embedding
    if (this.embedding && !options.skipEmbed && this.autoEmbed) {
      try {
        const result = await this.embedding.embed(options.content)
        entry.embedding = result.vector
      } catch (error) {
        this.logger?.warn('Failed to generate embedding', error as Error)
      }
    }

    // Store
    await this.store.set(entry)

    // Index
    if (this.search) {
      await this.search.index(entry)
    }

    // Emit event
    await this.events?.publish({
      type: 'memory:indexed',
      timestamp: Date.now(),
      memoryId: entry.id,
      memoryType: entry.type,
    })

    this.logger?.debug(`Memory stored: ${entry.id}`, { type: entry.type })
    return entry
  }

  // ─── Read ──────────────────────────────────────────────────────────────

  /**
   * Get a memory by ID.
   */
  async get(id: string): Promise<MemoryEntry | undefined> {
    return this.store.get(id)
  }

  /**
   * Recall memories matching a query.
   */
  async recall(options: RecallOptions = {}): Promise<MemorySearchResult[]> {
    // If text search with embedding provider, use vector search
    if (options.text && this.embedding && this.search) {
      try {
        const queryEmbedding = await this.embedding.embed(options.text)
        const vectorResults = await this.search.searchByVector(queryEmbedding.vector, {
          limit: options.limit,
          type: options.type as string,
        })

        // Convert to MemorySearchResult format
        const results: MemorySearchResult[] = []
        for (const item of vectorResults.items) {
          const entry = await this.store.get(item.id)
          if (entry) {
            results.push({ entry, score: item.score })
          }
        }
        return results
      } catch (error) {
        this.logger?.warn('Vector search failed, falling back to text search', error as Error)
      }
    }

    // Fallback to store query
    return this.store.query({
      text: options.text,
      type: options.type,
      tags: options.tags,
      limit: options.limit,
      minImportance: options.minImportance,
      maxAge: options.maxAge,
      sortBy: options.sortBy,
    })
  }

  // ─── Update ────────────────────────────────────────────────────────────

  /**
   * Update a memory entry.
   */
  async update(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | undefined> {
    const existing = await this.store.get(id)
    if (!existing) return undefined

    const updated: MemoryEntry = {
      ...existing,
      ...updates,
      id, // prevent ID change
      updatedAt: Date.now(),
    }

    // Re-embed if content changed
    if (updates.content && this.embedding && this.autoEmbed) {
      try {
        const result = await this.embedding.embed(updates.content)
        updated.embedding = result.vector
      } catch (error) {
        this.logger?.warn('Failed to re-embed updated memory', error as Error)
      }
    }

    await this.store.set(updated)

    // Update index
    if (this.search) {
      await this.search.update(updated)
    }

    return updated
  }

  // ─── Delete ────────────────────────────────────────────────────────────

  /**
   * Delete a memory by ID.
   */
  async forget(id: string): Promise<boolean> {
    const existed = await this.store.delete(id)

    if (existed && this.search) {
      await this.search.remove(id)
    }

    return existed
  }

  // ─── Bulk Operations ───────────────────────────────────────────────────

  /**
   * Store multiple memories at once.
   */
  async rememberBatch(entries: RememberOptions[]): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = []
    for (const entry of entries) {
      results.push(await this.remember(entry))
    }
    return results
  }

  /**
   * Get memories by type.
   */
  async getByType(type: MemoryType, limit?: number): Promise<MemoryEntry[]> {
    return this.store.getAll({ type, limit })
  }

  /**
   * Get memory count.
   */
  async count(type?: MemoryType): Promise<number> {
    return this.store.count(type)
  }

  // ─── Maintenance ───────────────────────────────────────────────────────

  /**
   * Clean up expired entries.
   */
  async cleanup(): Promise<number> {
    return this.store.cleanup()
  }

  /**
   * Clear all memories.
   */
  async clear(): Promise<void> {
    await this.store.clear()
    await this.search?.clear()
  }

  /**
   * Get engine stats.
   */
  async stats(): Promise<MemoryEngineStats> {
    const totalCount = await this.store.count()
    const searchStats = await this.search?.stats()

    const byType: Record<string, number> = {}
    const types: MemoryType[] = ['semantic', 'episodic', 'procedural', 'working', 'conversation', 'knowledge', 'graph']
    for (const type of types) {
      const count = await this.store.count(type)
      if (count > 0) byType[type] = count
    }

    return {
      totalMemories: totalCount,
      byType,
      indexedCount: searchStats?.totalEntries ?? 0,
      embeddedCount: totalCount, // approximation
    }
  }
}
