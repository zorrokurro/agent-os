import { describe, it, expect, vi } from 'vitest'
import { WorkflowContext } from '../WorkflowContext'
import type { Logger } from '../../logger/Logger'
import type { IEventBus } from '../../events/types'

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as Logger
}

function createMockEventBus(): IEventBus {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    onAny: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    clear: vi.fn(),
    subscriberCount: vi.fn().mockReturnValue(0),
  }
}

describe('WorkflowContext', () => {
  describe('create', () => {
    it('should create context with workflowId', () => {
      const ctx = WorkflowContext.create({ workflowId: 'wf_1' })
      expect(ctx.workflowId).toBe('wf_1')
      expect(ctx.correlationId).toMatch(/^wf_/)
    })

    it('should use provided correlationId', () => {
      const ctx = WorkflowContext.create({
        workflowId: 'wf_1',
        correlationId: 'custom_id',
      })
      expect(ctx.correlationId).toBe('custom_id')
    })

    it('should initialize empty state', () => {
      const ctx = WorkflowContext.create({ workflowId: 'wf_1' })
      expect(ctx.state).toEqual({})
    })
  })

  describe('child', () => {
    it('should create child context with taskId', () => {
      const parent = WorkflowContext.create({ workflowId: 'wf_1' })
      const child = parent.child('task_1')

      expect(child.workflowId).toBe('wf_1')
      expect(child.taskId).toBe('task_1')
      expect(child.correlationId).toBe(parent.correlationId)
    })

    it('should share state with parent', () => {
      const parent = WorkflowContext.create({ workflowId: 'wf_1' })
      parent.set('key', 'value')

      const child = parent.child('task_1')
      expect(child.get('key')).toBe('value')
    })

    it('should not modify parent state when child changes', () => {
      const parent = WorkflowContext.create({ workflowId: 'wf_1' })
      const child = parent.child('task_1')
      child.set('new', 'data')

      expect(parent.get('new')).toBeUndefined()
    })
  })

  describe('state', () => {
    it('should get and set values', () => {
      const ctx = WorkflowContext.create({ workflowId: 'wf_1' })
      ctx.set('counter', 42)
      expect(ctx.get<number>('counter')).toBe(42)
    })

    it('should return undefined for missing keys', () => {
      const ctx = WorkflowContext.create({ workflowId: 'wf_1' })
      expect(ctx.get('missing')).toBeUndefined()
    })
  })

  describe('emit', () => {
    it('should publish events through event bus', async () => {
      const events = createMockEventBus()
      const ctx = WorkflowContext.create({
        workflowId: 'wf_1',
        events,
      })

      await ctx.emit({
        type: 'test:event',
        timestamp: Date.now(),
        data: 'hello',
      })

      expect(events.publish).toHaveBeenCalledOnce()
    })
  })

  describe('isCancelled', () => {
    it('should be false without signal', () => {
      const ctx = WorkflowContext.create({ workflowId: 'wf_1' })
      expect(ctx.isCancelled).toBe(false)
    })

    it('should be true when signal is aborted', () => {
      const controller = new AbortController()
      const ctx = WorkflowContext.create({
        workflowId: 'wf_1',
        signal: controller.signal,
      })

      expect(ctx.isCancelled).toBe(false)
      controller.abort()
      expect(ctx.isCancelled).toBe(true)
    })
  })

  describe('throwIfCancelled', () => {
    it('should not throw when not cancelled', () => {
      const ctx = WorkflowContext.create({ workflowId: 'wf_1' })
      expect(() => ctx.throwIfCancelled()).not.toThrow()
    })

    it('should throw when cancelled', () => {
      const controller = new AbortController()
      const ctx = WorkflowContext.create({
        workflowId: 'wf_1',
        signal: controller.signal,
      })
      controller.abort()
      expect(() => ctx.throwIfCancelled()).toThrow('cancelled')
    })
  })
})
