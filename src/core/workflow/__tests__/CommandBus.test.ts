import { describe, it, expect, vi } from 'vitest'
import { CommandBus, createCommand, type Command } from '../commands/CommandBus'
import { WorkflowContext } from '../WorkflowContext'

interface TestCommand extends Command {
  type: 'test:action'
  value: number
}

function createTestContext() {
  return WorkflowContext.create({ workflowId: 'test' })
}

describe('CommandBus', () => {
  describe('register and execute', () => {
    it('should execute a registered command', async () => {
      const bus = new CommandBus()
      bus.register('test:action', async (cmd) => {
        return { doubled: (cmd as TestCommand).value * 2 }
      })

      const ctx = createTestContext()
      const result = await bus.execute<TestCommand>(
        'test:action',
        { value: 21 },
        ctx,
      )

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ doubled: 42 })
    })

    it('should return error for unregistered command', async () => {
      const bus = new CommandBus()
      const ctx = createTestContext()
      const result = await bus.execute('unknown:cmd', {}, ctx)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No handler')
    })

    it('should handle command errors', async () => {
      const bus = new CommandBus()
      bus.register('fail:cmd', async () => {
        throw new Error('boom')
      })

      const ctx = createTestContext()
      const result = await bus.execute('fail:cmd', {}, ctx)

      expect(result.success).toBe(false)
      expect(result.error).toBe('boom')
    })

    it('should not allow duplicate registrations', () => {
      const bus = new CommandBus()
      bus.register('dup:cmd', async () => ({}))
      expect(() => bus.register('dup:cmd', async () => ({}))).toThrow(
        'already registered',
      )
    })
  })

  describe('helpers', () => {
    it('should check if handler exists', () => {
      const bus = new CommandBus()
      expect(bus.has('test')).toBe(false)
      bus.register('test', async () => ({}))
      expect(bus.has('test')).toBe(true)
    })

    it('should list registered types', () => {
      const bus = new CommandBus()
      bus.register('a', async () => ({}))
      bus.register('b', async () => ({}))
      expect(bus.registeredTypes()).toEqual(['a', 'b'])
    })

    it('should clear all handlers', () => {
      const bus = new CommandBus()
      bus.register('a', async () => ({}))
      bus.clear()
      expect(bus.registeredTypes()).toEqual([])
    })
  })
})

describe('createCommand', () => {
  it('should create a command with timestamp', () => {
    const cmd = createCommand('test:action', { value: 1 })
    expect(cmd.type).toBe('test:action')
    expect(cmd.timestamp).toBeTypeOf('number')
    expect((cmd as TestCommand).value).toBe(1)
  })

  it('should include correlationId if provided', () => {
    const cmd = createCommand('test:action', { value: 1 }, 'corr_123')
    expect(cmd.correlationId).toBe('corr_123')
  })
})
