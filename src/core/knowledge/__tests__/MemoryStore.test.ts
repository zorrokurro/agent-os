import { describe, it, expect } from 'vitest'
import { InMemoryStore } from '../providers/MemoryStore'
import type { MemoryEntry } from '../KnowledgeTypes'

function makeEntry(overrides?: Partial<MemoryEntry>): MemoryEntry {
  return {
    id: `mem_${Math.random().toString(16).slice(2, 8)}`,
    type: 'semantic',
    content: 'Test memory content',
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    importance: 0.5,
    accessCount: 0,
    lastAccessedAt: Date.now(),
    tags: [],
    ...overrides,
  }
}

describe('InMemoryStore', () => {
  describe('set and get', () => {
    it('should store and retrieve an entry', async () => {
      const store = new InMemoryStore()
      const entry = makeEntry({ id: 'mem_1' })

      await store.set(entry)
      const result = await store.get('mem_1')

      expect(result).toBeDefined()
      expect(result?.id).toBe('mem_1')
      expect(result?.content).toBe('Test memory content')
    })

    it('should return undefined for unknown ID', async () => {
      const store = new InMemoryStore()
      expect(await store.get('unknown')).toBeUndefined()
    })
  })

  describe('delete', () => {
    it('should delete an entry', async () => {
      const store = new InMemoryStore()
      await store.set(makeEntry({ id: 'mem_1' }))

      expect(await store.delete('mem_1')).toBe(true)
      expect(await store.get('mem_1')).toBeUndefined()
    })

    it('should return false for unknown ID', async () => {
      const store = new InMemoryStore()
      expect(await store.delete('unknown')).toBe(false)
    })
  })

  describe('query', () => {
    it('should query by type', async () => {
      const store = new InMemoryStore()
      await store.set(makeEntry({ id: 'mem_1', type: 'semantic' }))
      await store.set(makeEntry({ id: 'mem_2', type: 'episodic' }))

      const results = await store.query({ type: 'semantic' })
      expect(results).toHaveLength(1)
      expect(results[0].entry.id).toBe('mem_1')
    })

    it('should query by tags', async () => {
      const store = new InMemoryStore()
      await store.set(makeEntry({ id: 'mem_1', tags: ['arch'] }))
      await store.set(makeEntry({ id: 'mem_2', tags: ['dev'] }))

      const results = await store.query({ tags: ['arch'] })
      expect(results).toHaveLength(1)
      expect(results[0].entry.id).toBe('mem_1')
    })

    it('should query by text', async () => {
      const store = new InMemoryStore()
      await store.set(makeEntry({ id: 'mem_1', content: 'plugin system' }))
      await store.set(makeEntry({ id: 'mem_2', content: 'memory engine' }))

      const results = await store.query({ text: 'plugin' })
      expect(results).toHaveLength(1)
      expect(results[0].entry.id).toBe('mem_1')
    })

    it('should query by min importance', async () => {
      const store = new InMemoryStore()
      await store.set(makeEntry({ id: 'mem_1', importance: 0.3 }))
      await store.set(makeEntry({ id: 'mem_2', importance: 0.8 }))

      const results = await store.query({ minImportance: 0.5 })
      expect(results).toHaveLength(1)
      expect(results[0].entry.id).toBe('mem_2')
    })
  })

  describe('count', () => {
    it('should count all entries', async () => {
      const store = new InMemoryStore()
      await store.set(makeEntry({ id: 'mem_1' }))
      await store.set(makeEntry({ id: 'mem_2' }))

      expect(await store.count()).toBe(2)
    })

    it('should count by type', async () => {
      const store = new InMemoryStore()
      await store.set(makeEntry({ id: 'mem_1', type: 'semantic' }))
      await store.set(makeEntry({ id: 'mem_2', type: 'episodic' }))

      expect(await store.count('semantic')).toBe(1)
    })
  })

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      const store = new InMemoryStore()
      await store.set(makeEntry({
        id: 'mem_1',
        expiresAt: Date.now() - 1000, // expired
      }))
      await store.set(makeEntry({
        id: 'mem_2',
        expiresAt: Date.now() + 100000, // not expired
      }))

      const removed = await store.cleanup()
      expect(removed).toBe(1)
      expect(await store.count()).toBe(1)
    })
  })

  describe('clear', () => {
    it('should clear all entries', async () => {
      const store = new InMemoryStore()
      await store.set(makeEntry({ id: 'mem_1' }))
      await store.set(makeEntry({ id: 'mem_2' }))

      await store.clear()
      expect(await store.count()).toBe(0)
    })
  })
})
