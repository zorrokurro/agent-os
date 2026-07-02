/**
 * Knowledge Runtime
 *
 * Core module for knowledge management.
 * Handles memory storage, retrieval, embeddings, and knowledge graphs.
 *
 * Architecture:
 *   MemoryEngine        (orchestrates all memory operations)
 *   ├── MemoryStore     (persistence layer)
 *   ├── EmbeddingProvider (vector embeddings)
 *   └── SearchProvider  (indexing and search)
 *   RetrievalEngine     (context-aware retrieval for agents)
 *   KnowledgeGraph      (entity relationships)
 *
 * Usage:
 *   import { MemoryEngine, InMemoryStore, MockEmbeddingProvider } from '@/core'
 *
 *   const engine = new MemoryEngine({
 *     store: new InMemoryStore(),
 *     embedding: new MockEmbeddingProvider(),
 *   })
 *
 *   // Store knowledge
 *   await engine.remember({
 *     type: 'semantic',
 *     content: 'AgentOS uses a plugin system',
 *     tags: ['architecture'],
 *   })
 *
 *   // Retrieve knowledge
 *   const results = await engine.recall({ text: 'plugin system' })
 */

// ─── Memory Engine ───────────────────────────────────────────────────────────

export { MemoryEngine } from './MemoryEngine'

export type {
  MemoryEngineOptions,
  RememberOptions,
  RecallOptions,
  MemoryEngineStats,
} from './MemoryEngine'

// ─── Retrieval Engine ────────────────────────────────────────────────────────

export { RetrievalEngine } from './RetrievalEngine'

export type {
  RetrievalOptions,
  RetrievalContext,
} from './RetrievalEngine'

// ─── Knowledge Graph ─────────────────────────────────────────────────────────

export { KnowledgeGraph } from './KnowledgeGraph'

// ─── Knowledge Types ─────────────────────────────────────────────────────────

export type {
  MemoryType,
  MemoryEntry,
  MemoryMetadata,
  MemoryQuery,
  MemorySearchResult,
  KnowledgeEntity,
  KnowledgeRelation,
  EmbeddingResult,
  SearchResult,
  SearchItem,
} from './KnowledgeTypes'

// ─── Providers ───────────────────────────────────────────────────────────────

export {
  MockEmbeddingProvider,
  InMemoryEmbeddingProvider,
} from './providers/EmbeddingProvider'

export type { EmbeddingProvider, EmbeddingProviderOptions } from './providers/EmbeddingProvider'

export { InMemoryStore } from './providers/MemoryStore'

export type { MemoryStore } from './providers/MemoryStore'

export { InMemorySearchProvider } from './providers/SearchProvider'

export type {
  SearchProvider,
  SearchOptions,
  SearchStats,
} from './providers/SearchProvider'
