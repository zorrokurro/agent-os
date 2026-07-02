/**
 * Knowledge Types
 *
 * Defines all knowledge/memory types and their schemas.
 * These types are fixed at v1 to ensure stability.
 */

// ─── Memory Types ────────────────────────────────────────────────────────────

export type MemoryType =
  | 'semantic'      // Facts and knowledge about the world
  | 'episodic'      // Past experiences and events
  | 'procedural'    // How-to knowledge and workflows
  | 'working'       // Short-term context for current task
  | 'conversation'  // Chat history and dialogue
  | 'knowledge'     // Structured domain knowledge
  | 'graph'         // Relational knowledge between entities

// ─── Memory Entry ────────────────────────────────────────────────────────────

export interface MemoryEntry {
  /** Unique identifier */
  id: string
  /** Memory type */
  type: MemoryType
  /** Content (text or structured data) */
  content: string
  /** Embedding vector (set after embedding) */
  embedding?: number[]
  /** Metadata */
  metadata: MemoryMetadata
  /** Timestamps */
  createdAt: number
  updatedAt: number
  /** Expiry time (0 = never) */
  expiresAt?: number
  /** Importance score (0-1) */
  importance: number
  /** Access count (for recency scoring) */
  accessCount: number
  /** Last accessed at */
  lastAccessedAt: number
  /** Source plugin or agent ID */
  source?: string
  /** Tags for categorization */
  tags: string[]
}

export interface MemoryMetadata {
  /** Agent ID that created this memory */
  agentId?: string
  /** Workflow ID if created during workflow execution */
  workflowId?: string
  /** Task ID if created during task execution */
  taskId?: string
  /** Conversation ID for conversation memory */
  conversationId?: string
  /** User ID if user-related */
  userId?: string
  /** Session ID */
  sessionId?: string
  /** Custom metadata */
  [key: string]: unknown
}

// ─── Memory Query ────────────────────────────────────────────────────────────

export interface MemoryQuery {
  /** Text query for semantic search */
  text?: string
  /** Filter by memory type */
  type?: MemoryType | MemoryType[]
  /** Filter by tags */
  tags?: string[]
  /** Filter by metadata */
  metadata?: Record<string, unknown>
  /** Minimum importance score */
  minImportance?: number
  /** Maximum age in milliseconds */
  maxAge?: number
  /** Limit results */
  limit?: number
  /** Offset for pagination */
  offset?: number
  /** Sort by */
  sortBy?: 'relevance' | 'recency' | 'importance' | 'accessCount'
}

// ─── Memory Search Result ────────────────────────────────────────────────────

export interface MemorySearchResult {
  /** Memory entry */
  entry: MemoryEntry
  /** Relevance score (0-1) */
  score: number
  /** Why this result matched */
  explanation?: string
}

// ─── Knowledge Entity ────────────────────────────────────────────────────────

export interface KnowledgeEntity {
  /** Unique identifier */
  id: string
  /** Entity name */
  name: string
  /** Entity type (person, place, concept, etc.) */
  type: string
  /** Entity description */
  description?: string
  /** Entity properties */
  properties: Record<string, unknown>
  /** Embedding vector */
  embedding?: number[]
  /** Timestamps */
  createdAt: number
  updatedAt: number
}

// ─── Knowledge Relation ──────────────────────────────────────────────────────

export interface KnowledgeRelation {
  /** Unique identifier */
  id: string
  /** Source entity ID */
  sourceId: string
  /** Target entity ID */
  targetId: string
  /** Relation type (e.g., "knows", "uses", "depends_on") */
  relationType: string
  /** Relation properties */
  properties: Record<string, unknown>
  /** Weight/strength (0-1) */
  weight: number
  /** Timestamps */
  createdAt: number
}

// ─── Embedding ───────────────────────────────────────────────────────────────

export interface EmbeddingResult {
  /** Embedding vector */
  vector: number[]
  /** Model used */
  model: string
  /** Token count */
  tokens: number
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SearchResult {
  /** Found items */
  items: SearchItem[]
  /** Total count */
  total: number
  /** Query time in ms */
  queryTime: number
}

export interface SearchItem {
  /** Item ID */
  id: string
  /** Item content */
  content: string
  /** Relevance score */
  score: number
  /** Item metadata */
  metadata?: Record<string, unknown>
}
