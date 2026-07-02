import { describe, it, expect, vi } from 'vitest'
import { WorkflowEngine } from '../WorkflowEngine'
import { SequentialExecutor } from '../tasks/TaskExecutor'
import { EventBus } from '../../events'
import type { TaskDefinition } from '../tasks/Task'
import type { WorkflowDefinition } from '../models/Workflow'
import type { TaskExecutor } from '../tasks/TaskExecutor'
import type { WorkflowContext } from '../WorkflowContext'

function makeTask(id: string, deps: string[] = []): TaskDefinition {
  return {
    id,
    name: `Task ${id}`,
    type: 'agent',
    dependencies: deps,
    config: { type: 'agent', agentId: 'test', prompt: 'test' },
  }
}

function makeWorkflow(tasks: TaskDefinition[]): WorkflowDefinition {
  return {
    id: 'test-workflow',
    name: 'Test Workflow',
    version: '1.0.0',
    tasks,
  }
}

function createMockExecutor(results?: Record<string, unknown>): TaskExecutor {
  const handler = vi.fn().mockImplementation(async (task: { definition: { id: string } }) => {
    return results?.[task.definition.id] ?? { output: `done_${task.definition.id}` }
  })

  const executor: TaskExecutor = {
    execute: handler,
    canExecute: () => true,
  }
  return executor
}

describe('WorkflowEngine', () => {
  describe('buildGraph', () => {
    it('should build graph from workflow definition', () => {
      const engine = new WorkflowEngine()
      const workflow = makeWorkflow([makeTask('A'), makeTask('B', ['A'])])

      const graph = engine.buildGraph(workflow)
      expect(graph.size).toBe(2)
    })

    it('should throw on duplicate task IDs', () => {
      const engine = new WorkflowEngine()
      const workflow = makeWorkflow([makeTask('A'), makeTask('A')])

      expect(() => engine.buildGraph(workflow)).toThrow('Duplicate task ID')
    })

    it('should throw on missing dependency', () => {
      const engine = new WorkflowEngine()
      const workflow = makeWorkflow([makeTask('B', ['A'])])

      expect(() => engine.buildGraph(workflow)).toThrow('non-existent task')
    })
  })

  describe('execute', () => {
    it('should execute a simple workflow', async () => {
      const engine = new WorkflowEngine()
      const executor = createMockExecutor()
      const workflow = makeWorkflow([makeTask('A'), makeTask('B', ['A'])])

      const result = await engine.execute(workflow, {}, executor)

      expect(result.success).toBe(true)
      expect(result.taskResults.get('A')?.success).toBe(true)
      expect(result.taskResults.get('B')?.success).toBe(true)
    })

    it('should execute parallel tasks', async () => {
      const engine = new WorkflowEngine()
      const executor = createMockExecutor()
      const workflow = makeWorkflow([
        makeTask('A'),
        makeTask('B', ['A']),
        makeTask('C', ['A']),
        makeTask('D', ['B', 'C']),
      ])

      const result = await engine.execute(workflow, {}, executor)

      expect(result.success).toBe(true)
      expect(result.taskResults.size).toBe(4)
    })

    it('should handle task failure', async () => {
      const engine = new WorkflowEngine()
      const executor: TaskExecutor = {
        execute: vi.fn().mockRejectedValue(new Error('task failed')),
        canExecute: () => true,
      }
      const workflow = makeWorkflow([makeTask('A')])

      const result = await engine.execute(workflow, {}, executor)

      expect(result.success).toBe(false)
      expect(result.error).toContain('failed')
    })

    it('should retry failed tasks', async () => {
      const engine = new WorkflowEngine()
      let callCount = 0
      const executor: TaskExecutor = {
        execute: vi.fn().mockImplementation(async () => {
          callCount++
          if (callCount < 3) throw new Error('not yet')
          return { output: 'recovered' }
        }),
        canExecute: () => true,
      }

      const workflow: WorkflowDefinition = {
        id: 'retry-test',
        name: 'Retry Test',
        version: '1.0.0',
        tasks: [{ ...makeTask('A'), maxRetries: 3 }],
      }

      const result = await engine.execute(workflow, {}, executor)

      expect(result.success).toBe(true)
      expect(result.taskResults.get('A')?.retries).toBe(2)
    })

    it('should emit events during execution', async () => {
      const events = new EventBus()
      const engine = new WorkflowEngine({ events })
      const executor = createMockExecutor()
      const workflow = makeWorkflow([makeTask('A')])

      const startedEvents: unknown[] = []
      const completedEvents: unknown[] = []

      events.subscribe('workflow:started', (e) => startedEvents.push(e))
      events.subscribe('workflow:completed', (e) => completedEvents.push(e))

      await engine.execute(workflow, {}, executor)

      expect(startedEvents.length).toBe(1)
      expect(completedEvents.length).toBe(1)
    })

    it('should handle continueOnFailure config', async () => {
      const engine = new WorkflowEngine()
      const executor: TaskExecutor = {
        execute: vi.fn().mockImplementation(async (task: { definition: { id: string } }) => {
          if (task.definition.id === 'fail') throw new Error('fail')
          return { output: 'ok' }
        }),
        canExecute: () => true,
      }

      const workflow: WorkflowDefinition = {
        id: 'continue-test',
        name: 'Continue Test',
        version: '1.0.0',
        tasks: [makeTask('fail'), makeTask('ok', ['fail'])],
        config: { continueOnFailure: true },
      }

      const result = await engine.execute(workflow, {}, executor)

      expect(result.success).toBe(true)
    })
  })
})
