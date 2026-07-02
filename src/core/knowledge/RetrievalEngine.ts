/**
 * Retrieval Engine
 *
 * Context-aware memory retrieval for agents.
 * Goes beyond simple search — considers:
 *   - Current task context
 *   - Conversation history
 *   - Agent's working memory
 *   - Temporal relevance
 *   - Importance decay
 *
 * Usage:
 *   const retrieval = new RetrievalEngine({ memory, logger })
 *
 *   const context = await retrieval.buildContext({
 *     agentId: 'planner',
 *     taskId: 'task_123',
 *     query: 'design patterns for microservices',
 *     maxTokens: 4000,
 *   })
 *
 *   console.log(context.memories) // Most relevant memories
 *   console.log(context.prompt)   // Formatted prompt for LLM
 */

import type { Logger } from '../logger/Logger'
import type { MemoryEngine } from './MemoryEngine'
import type { MemoryEntry, MemoryType, MemorySearchResult } from '../KnowledgeTypes'

// ─── Retrieval Options ───────────────────────────────────────────────────────

export interface RetrievalOptions {
  /** Agent ID for context */
  agentId?: string
  /** Current task ID */
  taskId?: string
  /** Workflow ID */
  workflowId?: string
  /** Conversation ID */
  conversationId?: string
  /** Search query */
  query: string
  /** Maximum tokens for context window */
  maxTokens?: number
  /** Memory types to retrieve */
  types?: MemoryType[]
  /** Minimum importance */
  minImportance?: number
  /** Maximum age in ms */
  maxAge?: number
  /** Number of memories to retrieve */
  limit?: number
  /** Include working memory */
  includeWorking?: boolean
  /** Include conversation history */
  includeConversation?: boolean
}

// ─── Retrieval Context ───────────────────────────────────────────────────────

export interface RetrievalContext {
  /** Retrieved memories */
  memories: MemoryEntry[]
  /** Formatted prompt for LLM */
  prompt: string
  /** Total tokens used */
  tokenCount: number
  /** Retrieval metadata */
  metadata: {
    query: string
    totalFound: number
    filteredCount: number
    retrievalTime: number
  }
}

// ─── Retrieval Engine ────────────────────────────────────────────────────────

export class RetrievalEngine {
  private memory: MemoryEngine
  private logger?: Logger

  constructor(options: { memory: MemoryEngine; logger?: Logger }) {
    this.memory = options.memory
    this.logger = options.logger
  }

  /**
   * Build a context window for an agent.
   * Retrieves and ranks memories based on the current context.
   */
  async buildContext(options: RetrievalOptions): Promise<RetrievalContext> {
    const startTime = Date.now()
    const maxTokens = options.maxTokens ?? 4000
    const limit = options.limit ?? 20

    // Collect memories from multiple sources
    const allMemories: MemorySearchResult[] = []

    // 1. Semantic search based on query
    if (options.query) {
      const semanticResults = await this.memory.recall({
        text: options.query,
        type: options.types,
        minImportance: options.minImportance,
        maxAge: options.maxAge,
        limit: limit,
      })
      allMemories.push(...semanticResults)
    }

    // 2. Working memory (recent context)
    if (options.includeWorking !== false) {
      const workingResults = await this.memory.recall({
        type: 'working',
        limit: 5,
        sortBy: 'recency',
      })
      allMemories.push(...workingResults)
    }

    // 3. Conversation history
    if (options.includeConversation !== false && options.conversationId) {
      const conversationResults = await this.memory.recall({
        type: 'conversation',
        tags: [`conversation:${options.conversationId}`],
        limit: 10,
        sortBy: 'recency',
      })
      allMemories.push(...conversationResults)
    }

    // 4. Agent-specific memories
    if (options.agentId) {
      const agentResults = await this.memory.recall({
        tags: [`agent:${options.agentId}`],
        limit: 5,
        sortBy: 'accessCount',
      })
      allMemories.push(...agentResults)
    }

    // Deduplicate and rank
    const ranked = this.rankMemories(allMemories, options)

    // Build context within token limit
    const selected = this.selectWithinTokenLimit(ranked, maxTokens)

    // Format as prompt
    const prompt = this.formatPrompt(selected, options)
    const tokenCount = this.estimateTokens(prompt)

    const context: RetrievalContext = {
      memories: selected.map((r) => r.entry),
      prompt,
      tokenCount,
      metadata: {
        query: options.query,
        totalFound: allMemories.length,
        filteredCount: selected.length,
        retrievalTime: Date.now() - startTime,
      },
    }

    this.logger?.debug('Context built', context.metadata)
    return context
  }

  /**
   * Get relevant memories for a specific task.
   */
  async forTask(
    taskId: string,
    query: string,
    options?: { limit?: number; types?: MemoryType[] },
  ): Promise<MemoryEntry[]> {
    const results = await this.memory.recall({
      text: query,
      type: options?.types,
      tags: [`task:${taskId}`],
      limit: options?.limit ?? 10,
    })
    return results.map((r) => r.entry)
  }

  /**
   * Get conversation history for context.
   */
  async forConversation(
    conversationId: string,
    limit?: number,
  ): Promise<MemoryEntry[]> {
    const results = await this.memory.recall({
      type: 'conversation',
      tags: [`conversation:${conversationId}`],
      limit: limit ?? 50,
      sortBy: 'recency',
    })
    return results.map((r) => r.entry)
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  private rankMemories(
    memories: MemorySearchResult[],
    options: RetrievalOptions,
  ): MemorySearchResult[] {
    // Deduplicate by ID
    const seen = new Set<string>()
    const unique = memories.filter((m) => {
      if (seen.has(m.entry.id)) return false
      seen.add(m.entry.id)
      return true
    })

    // Re-rank based on context
    return unique.map((m) => {
      let score = m.score

      // Boost agent-specific memories
      if (options.agentId && m.entry.metadata.agentId === options.agentId) {
        score *= 1.2
      }

      // Boost task-specific memories
      if (options.taskId && m.entry.tags.includes(`task:${options.taskId}`)) {
        score *= 1.3
      }

      // Boost workflow memories
      if (options.workflowId && m.entry.metadata.workflowId === options.workflowId) {
        score *= 1.1
      }

      // Importance boost
      score *= 0.7 + m.entry.importance * 0.3

      return { ...m, score }
    }).sort((a, b) => b.score - a.score)
  }

  private selectWithinTokenLimit(
    memories: MemorySearchResult[],
    maxTokens: number,
  ): MemorySearchResult[] {
    const selected: MemorySearchResult[] = []
    let tokenCount = 0

    for (const memory of memories) {
      const entryTokens = this.estimateTokens(memory.entry.content)
      if (tokenCount + entryTokens > maxTokens) break

      selected.push(memory)
      tokenCount += entryTokens
    }

    return selected
  }

  private formatPrompt(
    memories: MemorySearchResult[],
    options: RetrievalOptions,
  ): string {
    if (memories.length === 0) return ''

    const lines: string[] = []
    lines.push('## Relevant Knowledge')
    lines.push('')

    for (const memory of memories) {
      const type = memory.entry.type.toUpperCase()
      const importance = Math.round(memory.entry.importance * 100)
      lines.push(`[${type}] (importance: ${importance}%)`)
      lines.push(memory.entry.content)
      lines.push('')
    }

    return lines.join('\n')
  }

  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4)
  }
}
