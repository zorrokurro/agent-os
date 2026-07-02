import { describe, it, expect, vi } from 'vitest'
import { WorkflowRuntime } from '../WorkflowRuntime'
import type { TaskDefinition } from '../tasks/Task'
import type { WorkflowDefinition } from '../models/Workflow'

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

describe('WorkflowRuntime', () => {
  describe('registerWorkflow', () => {
    it('should register a workflow', () => {
      const runtime = new WorkflowRuntime()
      runtime.registerWorkflow(makeWorkflow([makeTask('A')]))

      expect(runtime.getWorkflowIds()).toEqual(['test-workflow'])
    })

    it('should throw on duplicate registration', () => {
      const runtime = new WorkflowRuntime()
      runtime.registerWorkflow(makeWorkflow([makeTask('A')]))
      expect(() => runtime.registerWorkflow(makeWorkflow([makeTask('A')]))).toThrow(
        'already registered',
      )
    })

    it('should unregister a workflow', () => {
      const runtime = new WorkflowRuntime()
      runtime.registerWorkflow(makeWorkflow([makeTask('A')]))
      expect(runtime.unregisterWorkflow('test-workflow')).toBe(true)
      expect(runtime.getWorkflowIds()).toEqual([])
    })
  })

  describe('registerHandler', () => {
    it('should register a task handler', () => {
      const runtime = new WorkflowRuntime()
      runtime.registerHandler('agent', async () => ({ output: 'ok' }))

      const stats = runtime.getStats()
      expect(stats.registeredHandlers).toBe(1)
    })

    it('should throw on duplicate handler', () => {
      const runtime = new WorkflowRuntime()
      runtime.registerHandler('agent', async () => ({}))
      expect(() => runtime.registerHandler('agent', async () => ({}))).toThrow(
        'already registered',
      )
    })
  })

  describe('run', () => {
    it('should run a registered workflow', async () => {
      const runtime = new WorkflowRuntime()
      runtime.registerHandler('agent', async (task) => ({
        output: `done_${task.definition.id}`,
      }))
      runtime.registerWorkflow(makeWorkflow([makeTask('A'), makeTask('B', ['A'])]))

      const result = await runtime.run('test-workflow')

      expect(result.success).toBe(true)
      expect(result.taskResults.size).toBe(2)
    })

    it('should throw for unregistered workflow', async () => {
      const runtime = new WorkflowRuntime()
      await expect(runtime.run('unknown')).rejects.toThrow('not registered')
    })

    it('should track stats', async () => {
      const runtime = new WorkflowRuntime()
      runtime.registerHandler('agent', async () => ({}))
      runtime.registerWorkflow(makeWorkflow([makeTask('A')]))

      await runtime.run('test-workflow')

      const stats = runtime.getStats()
      expect(stats.totalExecuted).toBe(1)
      expect(stats.totalSucceeded).toBe(1)
    })

    it('should pass input to workflow', async () => {
      const runtime = new WorkflowRuntime()
      let receivedInput: unknown
      runtime.registerHandler('agent', async (_task, ctx) => {
        receivedInput = ctx.state
        return {}
      })
      runtime.registerWorkflow(makeWorkflow([makeTask('A')]))

      await runtime.run('test-workflow', { key: 'value' })
      expect(receivedInput).toBeDefined()
    })
  })

  describe('getCommandBus', () => {
    it('should return the command bus', () => {
      const runtime = new WorkflowRuntime()
      const bus = runtime.getCommandBus()
      expect(bus).toBeDefined()
    })

    it('should have builtin run:workflow command', () => {
      const runtime = new WorkflowRuntime()
      const bus = runtime.getCommandBus()
      expect(bus.has('run:workflow')).toBe(true)
      expect(bus.has('cancel:workflow')).toBe(true)
    })
  })

  describe('getStats', () => {
    it('should return initial stats', () => {
      const runtime = new WorkflowRuntime()
      const stats = runtime.getStats()

      expect(stats).toEqual({
        registeredWorkflows: 0,
        registeredHandlers: 0,
        activeExecutions: 0,
        totalExecuted: 0,
        totalSucceeded: 0,
        totalFailed: 0,
      })
    })
  })
})
