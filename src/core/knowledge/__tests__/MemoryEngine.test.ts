import { describe, it, expect } from 'vitest'
import { MemoryEngine } from '../MemoryEngine'
import { InMemoryStore } from '../providers/MemoryStore'
import { MockEmbeddingProvider } from '../providers/EmbeddingProvider'
import { InMemorySearchProvider } from '../providers/SearchProvider'

function createEngine() {
  return new MemoryEngine({
    store: new InMemoryStore(),
    embedding: new MockEmbeddingProvider(),
    search: new InMemorySearchProvider(),
  })
}

describe('MemoryEngine', () => {
  describe('remember', () => {
    it('should store a memory', async () => {
      const engine = createEngine()
      const entry = await engine.remember({
        type: 'semantic',
        content: 'AgentOS uses plugins',
        tags: ['architecture'],
      })

      expect(entry.id).toMatch(/^mem_/)
      expect(entry.type).toBe('semantic')
      expect(entry.content).toBe('AgentOS uses plugins')
      expect(entry.tags).toEqual(['architecture'])
    })

    it('should generate embedding', async () => {
      const engine = createEngine()
      const entry = await engine.remember({
        type: 'semantic',
        content: 'Test content',
      })

      expect(entry.embedding).toBeDefined()
      expect(entry.embedding?.length).toBe(128)
    })

    it('should skip embedding if requested', async () => {
      const engine = createEngine()
      const entry = await engine.remember({
        type: 'semantic',
        content: 'Test',
        skipEmbed: true,
      })

      expect(entry.embedding).toBeUndefined()
    })
  })

  describe('get', () => {
    it('should retrieve a memory by ID', async () => {
      const engine = createEngine()
      const stored = await engine.remember({
        type: 'semantic',
        content: 'Test',
      })

      const retrieved = await engine.get(stored.id)
      expect(retrieved?.id).toBe(stored.id)
    })

    it('should return undefined for unknown ID', async () => {
      const engine = createEngine()
      expect(await engine.get('unknown')).toBeUndefined()
    })
  })

  describe('recall', () => {
    it('should recall memories by text', async () => {
      const engine = createEngine()
      await engine.remember({ type: 'semantic', content: 'plugin system' })
      await engine.remember({ type: 'semantic', content: 'memory engine' })

      // Without embedding provider, falls back to text search
      const engineNoEmbed = new MemoryEngine({
        store: new InMemoryStore(),
        search: new InMemorySearchProvider(),
      })
      await engineNoEmbed.remember({ type: 'semantic', content: 'plugin system' })
      await engineNoEmbed.remember({ type: 'semantic', content: 'memory engine' })

      const results = await engineNoEmbed.recall({ text: 'plugin' })
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].entry.content).toContain('plugin')
    })

    it('should recall by type', async () => {
      const engine = createEngine()
      await engine.remember({ type: 'semantic', content: 'fact' })
      await engine.remember({ type: 'episodic', content: 'event' })

      const results = await engine.recall({ type: 'semantic' })
      expect(results).toHaveLength(1)
    })

    it('should recall by tags', async () => {
      const engine = createEngine()
      await engine.remember({ type: 'semantic', content: 'a', tags: ['arch'] })
      await engine.remember({ type: 'semantic', content: 'b', tags: ['dev'] })

      const results = await engine.recall({ tags: ['arch'] })
      expect(results).toHaveLength(1)
    })
  })

  describe('update', () => {
    it('should update a memory', async () => {
      const engine = createEngine()
      const entry = await engine.remember({ type: 'semantic', content: 'old' })

      const updated = await engine.update(entry.id, { content: 'new' })
      expect(updated?.content).toBe('new')
    })

    it('should re-embed on content change', async () => {
      const engine = createEngine()
      const entry = await engine.remember({ type: 'semantic', content: 'old' })

      const updated = await engine.update(entry.id, { content: 'new content' })
      expect(updated?.embedding).toBeDefined()
    })
  })

  describe('forget', () => {
    it('should delete a memory', async () => {
      const engine = createEngine()
      const entry = await engine.remember({ type: 'semantic', content: 'test' })

      expect(await engine.forget(entry.id)).toBe(true)
      expect(await engine.get(entry.id)).toBeUndefined()
    })

    it('should return false for unknown ID', async () => {
      const engine = createEngine()
      expect(await engine.forget('unknown')).toBe(false)
    })
  })

  describe('count', () => {
    it('should count memories', async () => {
      const engine = createEngine()
      await engine.remember({ type: 'semantic', content: 'a' })
      await engine.remember({ type: 'episodic', content: 'b' })

      expect(await engine.count()).toBe(2)
      expect(await engine.count('semantic')).toBe(1)
    })
  })

  describe('clear', () => {
    it('should clear all memories', async () => {
      const engine = createEngine()
      await engine.remember({ type: 'semantic', content: 'a' })
      await engine.remember({ type: 'semantic', content: 'b' })

      await engine.clear()
      expect(await engine.count()).toBe(0)
    })
  })

  describe('stats', () => {
    it('should return stats', async () => {
      const engine = createEngine()
      await engine.remember({ type: 'semantic', content: 'a' })
      await engine.remember({ type: 'episodic', content: 'b' })

      const stats = await engine.stats()
      expect(stats.totalMemories).toBe(2)
      expect(stats.byType.semantic).toBe(1)
      expect(stats.byType.episodic).toBe(1)
    })
  })
})
