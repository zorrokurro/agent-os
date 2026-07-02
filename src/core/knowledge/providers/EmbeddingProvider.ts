/**
 * Embedding Provider
 *
 * Interface for generating vector embeddings from text.
 * Providers are pluggable — swap OpenAI for Ollama, Voyage, etc.
 *
 * Usage:
 *   const provider = new OpenAIEmbeddingProvider({ apiKey: '...' })
 *   const result = await provider.embed('Hello world')
 *   console.log(result.vector) // [0.1, 0.2, ...]
 */

import type { EmbeddingResult } from '../KnowledgeTypes'

// ─── Provider Interface ──────────────────────────────────────────────────────

export interface EmbeddingProvider {
  /** Provider name */
  readonly name: string
  /** Embedding dimensions */
  readonly dimensions: number
  /** Maximum tokens per request */
  readonly maxTokens: number

  /**
   * Generate embedding for a single text.
   */
  embed(text: string): Promise<EmbeddingResult>

  /**
   * Generate embeddings for multiple texts (batch).
   */
  embedBatch(texts: string[]): Promise<EmbeddingResult[]>

  /**
   * Check if the provider is available.
   */
  isAvailable(): Promise<boolean>
}

// ─── Provider Options ────────────────────────────────────────────────────────

export interface EmbeddingProviderOptions {
  /** API key (if required) */
  apiKey?: string
  /** API base URL (for custom endpoints) */
  baseUrl?: string
  /** Model name */
  model?: string
  /** Request timeout in ms */
  timeout?: number
}

// ─── Mock Provider (for testing) ─────────────────────────────────────────────

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'mock'
  readonly dimensions: number
  readonly maxTokens = 8192

  private dimensionCount: number

  constructor(options?: { dimensions?: number }) {
    this.dimensionCount = options?.dimensions ?? 128
    this.dimensions = this.dimensionCount
  }

  async embed(text: string): Promise<EmbeddingResult> {
    // Generate deterministic pseudo-random embedding from text
    const vector = this.generateVector(text)
    return {
      vector,
      model: 'mock',
      tokens: text.split(/\s+/).length,
    }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    return Promise.all(texts.map((t) => this.embed(t)))
  }

  async isAvailable(): Promise<boolean> {
    return true
  }

  private generateVector(text: string): number[] {
    const vector: number[] = []
    let seed = 0
    for (let i = 0; i < text.length; i++) {
      seed = ((seed << 5) - seed + text.charCodeAt(i)) | 0
    }
    for (let i = 0; i < this.dimensionCount; i++) {
      seed = ((seed * 1103515245 + 12345) & 0x7fffffff)
      vector.push((seed / 0x7fffffff) * 2 - 1)
    }
    return vector
  }
}

// ─── In-Memory Provider (for simple use cases) ───────────────────────────────

export class InMemoryEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'in-memory'
  readonly dimensions = 128
  readonly maxTokens = 8192

  private cache = new Map<string, number[]>()

  async embed(text: string): Promise<EmbeddingResult> {
    if (this.cache.has(text)) {
      return {
        vector: this.cache.get(text)!,
        model: 'in-memory',
        tokens: text.split(/\s+/).length,
      }
    }

    // Simple hash-based embedding
    const vector = new Array(this.dimensions).fill(0)
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i)
      vector[i % this.dimensions] += charCode / 1000
    }

    // Normalize
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
    const normalized = vector.map((v) => v / norm)

    this.cache.set(text, normalized)

    return {
      vector: normalized,
      model: 'in-memory',
      tokens: text.split(/\s+/).length,
    }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    return Promise.all(texts.map((t) => this.embed(t)))
  }

  async isAvailable(): Promise<boolean> {
    return true
  }

  clear(): void {
    this.cache.clear()
  }
}
