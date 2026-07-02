import { describe, it, expect } from 'vitest'
import { KnowledgeGraph } from '../KnowledgeGraph'

describe('KnowledgeGraph', () => {
  describe('addEntity', () => {
    it('should add an entity', async () => {
      const graph = new KnowledgeGraph()
      const entity = await graph.addEntity({
        id: 'agent1',
        name: 'Planner',
        type: 'agent',
        properties: {},
      })

      expect(entity.id).toBe('agent1')
      expect(entity.name).toBe('Planner')
    })

    it('should throw on duplicate ID', async () => {
      const graph = new KnowledgeGraph()
      await graph.addEntity({ id: 'e1', name: 'E1', type: 'test', properties: {} })
      expect(graph.addEntity({ id: 'e1', name: 'E2', type: 'test', properties: {} })).rejects.toThrow('already exists')
    })
  })

  describe('getEntity', () => {
    it('should get an entity', async () => {
      const graph = new KnowledgeGraph()
      await graph.addEntity({ id: 'e1', name: 'E1', type: 'test', properties: {} })

      const entity = graph.getEntity('e1')
      expect(entity?.name).toBe('E1')
    })

    it('should return undefined for unknown ID', () => {
      const graph = new KnowledgeGraph()
      expect(graph.getEntity('unknown')).toBeUndefined()
    })
  })

  describe('updateEntity', () => {
    it('should update an entity', async () => {
      const graph = new KnowledgeGraph()
      await graph.addEntity({ id: 'e1', name: 'E1', type: 'test', properties: {} })

      const updated = await graph.updateEntity('e1', { name: 'E2' })
      expect(updated?.name).toBe('E2')
    })
  })

  describe('deleteEntity', () => {
    it('should delete an entity', async () => {
      const graph = new KnowledgeGraph()
      await graph.addEntity({ id: 'e1', name: 'E1', type: 'test', properties: {} })

      expect(graph.deleteEntity('e1')).toBe(true)
      expect(graph.getEntity('e1')).toBeUndefined()
    })

    it('should remove related relations', async () => {
      const graph = new KnowledgeGraph()
      await graph.addEntity({ id: 'e1', name: 'E1', type: 'test', properties: {} })
      await graph.addEntity({ id: 'e2', name: 'E2', type: 'test', properties: {} })
      graph.addRelation({ sourceId: 'e1', targetId: 'e2', relationType: 'knows', properties: {}, weight: 1 })

      graph.deleteEntity('e1')
      expect(graph.stats().relations).toBe(0)
    })
  })

  describe('addRelation', () => {
    it('should add a relation', async () => {
      const graph = new KnowledgeGraph()
      await graph.addEntity({ id: 'e1', name: 'E1', type: 'test', properties: {} })
      await graph.addEntity({ id: 'e2', name: 'E2', type: 'test', properties: {} })

      const rel = graph.addRelation({
        sourceId: 'e1',
        targetId: 'e2',
        relationType: 'knows',
        properties: {},
        weight: 1,
      })

      expect(rel.sourceId).toBe('e1')
      expect(rel.targetId).toBe('e2')
    })

    it('should throw for missing source', async () => {
      const graph = new KnowledgeGraph()
      await graph.addEntity({ id: 'e2', name: 'E2', type: 'test', properties: {} })

      expect(() => graph.addRelation({
        sourceId: 'e1',
        targetId: 'e2',
        relationType: 'knows',
        properties: {},
        weight: 1,
      })).toThrow('not found')
    })
  })

  describe('getRelated', () => {
    it('should get related entities', async () => {
      const graph = new KnowledgeGraph()
      await graph.addEntity({ id: 'e1', name: 'E1', type: 'test', properties: {} })
      await graph.addEntity({ id: 'e2', name: 'E2', type: 'test', properties: {} })
      await graph.addEntity({ id: 'e3', name: 'E3', type: 'test', properties: {} })

      graph.addRelation({ sourceId: 'e1', targetId: 'e2', relationType: 'knows', properties: {}, weight: 1 })
      graph.addRelation({ sourceId: 'e2', targetId: 'e3', relationType: 'knows', properties: {}, weight: 1 })

      const related = graph.getRelated('e1')
      expect(related).toHaveLength(1)
      expect(related[0].id).toBe('e2')
    })

    it('should traverse depth', async () => {
      const graph = new KnowledgeGraph()
      await graph.addEntity({ id: 'e1', name: 'E1', type: 'test', properties: {} })
      await graph.addEntity({ id: 'e2', name: 'E2', type: 'test', properties: {} })
      await graph.addEntity({ id: 'e3', name: 'E3', type: 'test', properties: {} })

      graph.addRelation({ sourceId: 'e1', targetId: 'e2', relationType: 'knows', properties: {}, weight: 1 })
      graph.addRelation({ sourceId: 'e2', targetId: 'e3', relationType: 'knows', properties: {}, weight: 1 })

      const related = graph.getRelated('e1', { depth: 2 })
      expect(related).toHaveLength(2)
    })
  })

  describe('stats', () => {
    it('should return stats', async () => {
      const graph = new KnowledgeGraph()
      await graph.addEntity({ id: 'e1', name: 'E1', type: 'test', properties: {} })
      await graph.addEntity({ id: 'e2', name: 'E2', type: 'test', properties: {} })
      graph.addRelation({ sourceId: 'e1', targetId: 'e2', relationType: 'knows', properties: {}, weight: 1 })

      const stats = graph.stats()
      expect(stats.entities).toBe(2)
      expect(stats.relations).toBe(1)
    })
  })

  describe('clear', () => {
    it('should clear the graph', async () => {
      const graph = new KnowledgeGraph()
      await graph.addEntity({ id: 'e1', name: 'E1', type: 'test', properties: {} })
      await graph.addEntity({ id: 'e2', name: 'E2', type: 'test', properties: {} })
      graph.addRelation({ sourceId: 'e1', targetId: 'e2', relationType: 'knows', properties: {}, weight: 1 })

      graph.clear()
      expect(graph.stats()).toEqual({ entities: 0, relations: 0 })
    })
  })
})
