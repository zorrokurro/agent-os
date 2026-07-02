/**
 * Knowledge Graph
 *
 * Manages entities and relationships between them.
 * Supports:
 *   - Entity CRUD
 *   - Relationship management
 *   - Graph traversal
 *   - Vector-based entity search
 *
 * Usage:
 *   const graph = new KnowledgeGraph({ store, embedding })
 *
 *   // Add entities
 *   await graph.addEntity({ id: 'agent1', name: 'Planner', type: 'agent' })
 *   await graph.addEntity({ id: 'task1', name: 'Design', type: 'task' })
 *
 *   // Add relationships
 *   await graph.addRelation({ sourceId: 'agent1', targetId: 'task1', relationType: 'performs' })
 *
 *   // Traverse
 *   const related = await graph.getRelated('agent1')
 */

import type { Logger } from '../logger/Logger'
import type { KnowledgeEntity, KnowledgeRelation } from './KnowledgeTypes'
import type { EmbeddingProvider } from './providers/EmbeddingProvider'

// ─── Knowledge Graph ─────────────────────────────────────────────────────────

export class KnowledgeGraph {
  private entities = new Map<string, KnowledgeEntity>()
  private relations = new Map<string, KnowledgeRelation>()
  private adjacency = new Map<string, Set<string>>() // entity -> relation IDs
  private reverseAdj = new Map<string, Set<string>>() // entity -> relation IDs (incoming)
  private embedding?: EmbeddingProvider
  private logger?: Logger

  constructor(options?: { embedding?: EmbeddingProvider; logger?: Logger }) {
    this.embedding = options?.embedding
    this.logger = options?.logger
  }

  // ─── Entity Operations ────────────────────────────────────────────────

  /**
   * Add an entity to the graph.
   */
  async addEntity(entity: Omit<KnowledgeEntity, 'createdAt' | 'updatedAt'>): Promise<KnowledgeEntity> {
    if (this.entities.has(entity.id)) {
      throw new Error(`Entity "${entity.id}" already exists`)
    }

    const now = Date.now()
    const fullEntity: KnowledgeEntity = {
      ...entity,
      createdAt: now,
      updatedAt: now,
    }

    // Generate embedding if provider available
    if (this.embedding && entity.description) {
      try {
        const result = await this.embedding.embed(entity.description)
        fullEntity.embedding = result.vector
      } catch (error) {
        this.logger?.warn('Failed to embed entity', error as Error)
      }
    }

    this.entities.set(entity.id, fullEntity)
    this.adjacency.set(entity.id, new Set())
    this.reverseAdj.set(entity.id, new Set())

    return fullEntity
  }

  /**
   * Get an entity by ID.
   */
  getEntity(id: string): KnowledgeEntity | undefined {
    return this.entities.get(id)
  }

  /**
   * Update an entity.
   */
  async updateEntity(id: string, updates: Partial<KnowledgeEntity>): Promise<KnowledgeEntity | undefined> {
    const existing = this.entities.get(id)
    if (!existing) return undefined

    const updated: KnowledgeEntity = {
      ...existing,
      ...updates,
      id, // prevent ID change
      updatedAt: Date.now(),
    }

    // Re-embed if description changed
    if (updates.description && this.embedding) {
      try {
        const result = await this.embedding.embed(updates.description)
        updated.embedding = result.vector
      } catch (error) {
        this.logger?.warn('Failed to re-embed entity', error as Error)
      }
    }

    this.entities.set(id, updated)
    return updated
  }

  /**
   * Delete an entity and its relations.
   */
  deleteEntity(id: string): boolean {
    const existed = this.entities.delete(id)
    if (!existed) return false

    // Remove all relations involving this entity
    const outgoing = this.adjacency.get(id) ?? new Set()
    for (const relId of outgoing) {
      this.relations.delete(relId)
    }

    const incoming = this.reverseAdj.get(id) ?? new Set()
    for (const relId of incoming) {
      this.relations.delete(relId)
    }

    this.adjacency.delete(id)
    this.reverseAdj.delete(id)

    return true
  }

  /**
   * Get all entities.
   */
  getAllEntities(): KnowledgeEntity[] {
    return Array.from(this.entities.values())
  }

  /**
   * Get entities by type.
   */
  getEntitiesByType(type: string): KnowledgeEntity[] {
    return this.getAllEntities().filter((e) => e.type === type)
  }

  /**
   * Search entities by text similarity.
   */
  async searchEntities(query: string, limit?: number): Promise<KnowledgeEntity[]> {
    if (!this.embedding) {
      // Fallback to text search
      const lowerQuery = query.toLowerCase()
      return this.getAllEntities()
        .filter((e) =>
          e.name.toLowerCase().includes(lowerQuery) ||
          e.description?.toLowerCase().includes(lowerQuery),
        )
        .slice(0, limit ?? 10)
    }

    // Vector search
    const queryEmbedding = await this.embedding.embed(query)
    const scored = this.getAllEntities()
      .filter((e) => e.embedding)
      .map((e) => ({
        entity: e,
        score: this.cosineSimilarity(queryEmbedding.vector, e.embedding!),
      }))
      .sort((a, b) => b.score - a.score)

    return scored.slice(0, limit ?? 10).map((s) => s.entity)
  }

  // ─── Relation Operations ──────────────────────────────────────────────

  /**
   * Add a relation between two entities.
   */
  addRelation(relation: Omit<KnowledgeRelation, 'createdAt'>): KnowledgeRelation {
    if (!this.entities.has(relation.sourceId)) {
      throw new Error(`Source entity "${relation.sourceId}" not found`)
    }
    if (!this.entities.has(relation.targetId)) {
      throw new Error(`Target entity "${relation.targetId}" not found`)
    }

    const id = `rel_${Math.random().toString(16).slice(2, 10)}`
    const fullRelation: KnowledgeRelation = {
      ...relation,
      id,
      createdAt: Date.now(),
    }

    this.relations.set(id, fullRelation)

    // Update adjacency
    this.adjacency.get(relation.sourceId)?.add(id)
    this.reverseAdj.get(relation.targetId)?.add(id)

    return fullRelation
  }

  /**
   * Get a relation by ID.
   */
  getRelation(id: string): KnowledgeRelation | undefined {
    return this.relations.get(id)
  }

  /**
   * Delete a relation.
   */
  deleteRelation(id: string): boolean {
    const relation = this.relations.get(id)
    if (!relation) return false

    this.relations.delete(id)
    this.adjacency.get(relation.sourceId)?.delete(id)
    this.reverseAdj.get(relation.targetId)?.delete(id)

    return true
  }

  /**
   * Get all relations for an entity.
   */
  getRelations(entityId: string): KnowledgeRelation[] {
    const outgoing = this.adjacency.get(entityId) ?? new Set()
    const incoming = this.reverseAdj.get(entityId) ?? new Set()

    const relations: KnowledgeRelation[] = []
    for (const relId of outgoing) {
      const rel = this.relations.get(relId)
      if (rel) relations.push(rel)
    }
    for (const relId of incoming) {
      const rel = this.relations.get(relId)
      if (rel) relations.push(rel)
    }

    return relations
  }

  /**
   * Get related entities (traverse graph).
   */
  getRelated(
    entityId: string,
    options?: { relationType?: string; depth?: number; limit?: number },
  ): KnowledgeEntity[] {
    const depth = options?.depth ?? 1
    const limit = options?.limit ?? 10
    const visited = new Set<string>()
    const result: KnowledgeEntity[] = []

    const traverse = (currentId: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(currentId) || result.length >= limit) return
      visited.add(currentId)

      const relations = this.getRelations(currentId)
      for (const rel of relations) {
        if (options?.relationType && rel.relationType !== options.relationType) continue

        const relatedId = rel.sourceId === currentId ? rel.targetId : rel.sourceId
        if (!visited.has(relatedId)) {
          const entity = this.entities.get(relatedId)
          if (entity) result.push(entity)
          traverse(relatedId, currentDepth + 1)
        }
      }
    }

    traverse(entityId, 1)
    return result
  }

  // ─── Stats ────────────────────────────────────────────────────────────

  /**
   * Get graph stats.
   */
  stats(): { entities: number; relations: number } {
    return {
      entities: this.entities.size,
      relations: this.relations.size,
    }
  }

  /**
   * Clear the graph.
   */
  clear(): void {
    this.entities.clear()
    this.relations.clear()
    this.adjacency.clear()
    this.reverseAdj.clear()
  }

  // ─── Internal ──────────────────────────────────────────────────────────

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
