import { describe, it, expect } from 'vitest'
import {
  TaskGraph,
  createTaskInstance,
  type TaskDefinition,
} from '../index'

function makeTask(id: string, deps: string[] = []): TaskDefinition {
  return {
    id,
    name: `Task ${id}`,
    type: 'agent',
    dependencies: deps,
    config: { type: 'agent', agentId: 'test', prompt: 'test' },
  }
}

describe('TaskGraph', () => {
  describe('addNode', () => {
    it('should add a task', () => {
      const graph = new TaskGraph()
      graph.addNode(makeTask('A'))
      expect(graph.size).toBe(1)
      expect(graph.has('A')).toBe(true)
    })

    it('should throw on duplicate task ID', () => {
      const graph = new TaskGraph()
      graph.addNode(makeTask('A'))
      expect(() => graph.addNode(makeTask('A'))).toThrow('already exists')
    })
  })

  describe('getExecutionOrder', () => {
    it('should return single task', () => {
      const graph = new TaskGraph()
      graph.addNode(makeTask('A'))
      expect(graph.getExecutionOrder()).toEqual([['A']])
    })

    it('should handle linear dependency', () => {
      const graph = new TaskGraph()
      graph.addNode(makeTask('A'))
      graph.addNode(makeTask('B', ['A']))
      graph.addNode(makeTask('C', ['B']))
      expect(graph.getExecutionOrder()).toEqual([['A'], ['B'], ['C']])
    })

    it('should handle parallel tasks', () => {
      const graph = new TaskGraph()
      graph.addNode(makeTask('A'))
      graph.addNode(makeTask('B', ['A']))
      graph.addNode(makeTask('C', ['A']))
      graph.addNode(makeTask('D', ['B', 'C']))

      const order = graph.getExecutionOrder()
      expect(order).toEqual([['A'], ['B', 'C'], ['D']])
    })

    it('should handle diamond DAG', () => {
      const graph = new TaskGraph()
      graph.addNode(makeTask('A'))
      graph.addNode(makeTask('B', ['A']))
      graph.addNode(makeTask('C', ['A']))
      graph.addNode(makeTask('D', ['B', 'C']))
      graph.addNode(makeTask('E', ['D']))

      const order = graph.getExecutionOrder()
      expect(order).toEqual([['A'], ['B', 'C'], ['D'], ['E']])
    })
  })

  describe('hasCycle', () => {
    it('should detect no cycle in DAG', () => {
      const graph = new TaskGraph()
      graph.addNode(makeTask('A'))
      graph.addNode(makeTask('B', ['A']))
      graph.addNode(makeTask('C', ['B']))
      expect(graph.hasCycle()).toBe(false)
    })
  })

  describe('getRoots and getLeaves', () => {
    it('should find roots and leaves', () => {
      const graph = new TaskGraph()
      graph.addNode(makeTask('A'))
      graph.addNode(makeTask('B', ['A']))
      graph.addNode(makeTask('C', ['A']))
      graph.addNode(makeTask('D', ['B', 'C']))

      expect(graph.getRoots()).toEqual(['A'])
      expect(graph.getLeaves()).toEqual(['D'])
    })
  })

  describe('getDependents and getDependencies', () => {
    it('should return correct relationships', () => {
      const graph = new TaskGraph()
      graph.addNode(makeTask('A'))
      graph.addNode(makeTask('B', ['A']))
      graph.addNode(makeTask('C', ['A']))
      graph.addNode(makeTask('D', ['B', 'C']))

      expect(graph.getDependents('A')).toEqual(
        expect.arrayContaining(['B', 'C']),
      )
      expect(graph.getDependencies('D')).toEqual(
        expect.arrayContaining(['B', 'C']),
      )
    })
  })

  describe('removeNode', () => {
    it('should remove a task and its edges', () => {
      const graph = new TaskGraph()
      graph.addNode(makeTask('A'))
      graph.addNode(makeTask('B', ['A']))
      graph.addNode(makeTask('C', ['B']))

      graph.removeNode('B')
      expect(graph.size).toBe(2)
      expect(graph.has('B')).toBe(false)
      expect(graph.getDependencies('C')).toEqual([])
    })
  })
})

describe('createTaskInstance', () => {
  it('should create instance with pending state', () => {
    const def = makeTask('A')
    const instance = createTaskInstance(def)
    expect(instance.state).toBe('pending')
    expect(instance.retries).toBe(0)
    expect(instance.definition).toBe(def)
  })

  it('should mark root tasks as dependenciesMet', () => {
    const instance = createTaskInstance(makeTask('A'))
    expect(instance.dependenciesMet).toBe(true)
  })

  it('should mark non-root tasks as dependencies not met', () => {
    const instance = createTaskInstance(makeTask('B', ['A']))
    expect(instance.dependenciesMet).toBe(false)
  })
})
