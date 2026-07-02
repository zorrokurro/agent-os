import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventBus, createEvent } from '../index'
import type { NotebookCreatedEvent, AgentStartedEvent, BaseEvent } from '../index'

describe('EventBus', () => {
  let bus: EventBus

  beforeEach(() => {
    bus = new EventBus()
  })

  describe('publish/subscribe', () => {
    it('should deliver events to subscribers', async () => {
      const handler = vi.fn()
      bus.subscribe('notebook:created', handler)

      const event = createEvent('notebook:created', {
        notebookId: '1',
        name: 'Test Notebook',
      })
      await bus.publish(event)

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(event)
    })

    it('should deliver to multiple subscribers', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      bus.subscribe('notebook:created', handler1)
      bus.subscribe('notebook:created', handler2)

      await bus.publish(createEvent('notebook:created', { notebookId: '1', name: 'Test' }))

      expect(handler1).toHaveBeenCalledOnce()
      expect(handler2).toHaveBeenCalledOnce()
    })

    it('should not deliver to unrelated subscribers', async () => {
      const handler = vi.fn()
      bus.subscribe('agent:started', handler)

      await bus.publish(createEvent('notebook:created', { notebookId: '1', name: 'Test' }))

      expect(handler).not.toHaveBeenCalled()
    })

    it('should support async handlers', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)
      bus.subscribe('notebook:created', handler)

      await bus.publish(createEvent('notebook:created', { notebookId: '1', name: 'Test' }))

      expect(handler).toHaveBeenCalledOnce()
    })

    it('should wait for async handlers to complete', async () => {
      let resolved = false
      const handler = vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10))
        resolved = true
      })
      bus.subscribe('notebook:created', handler)

      await bus.publish(createEvent('notebook:created', { notebookId: '1', name: 'Test' }))

      expect(resolved).toBe(true)
    })
  })

  describe('unsubscribe', () => {
    it('should stop receiving events after unsubscribe', async () => {
      const handler = vi.fn()
      const sub = bus.subscribe('notebook:created', handler)

      await bus.publish(createEvent('notebook:created', { notebookId: '1', name: 'Test' }))
      expect(handler).toHaveBeenCalledOnce()

      sub.unsubscribe()

      await bus.publish(createEvent('notebook:created', { notebookId: '2', name: 'Test 2' }))
      expect(handler).toHaveBeenCalledOnce() // Not called again
    })

    it('should not affect other subscribers when one unsubscribes', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const sub1 = bus.subscribe('notebook:created', handler1)
      bus.subscribe('notebook:created', handler2)

      sub1.unsubscribe()

      await bus.publish(createEvent('notebook:created', { notebookId: '1', name: 'Test' }))

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledOnce()
    })
  })

  describe('onAny (wildcard)', () => {
    it('should receive all events with onAny', async () => {
      const handler = vi.fn()
      bus.onAny(handler)

      await bus.publish(createEvent('notebook:created', { notebookId: '1', name: 'Test' }))
      await bus.publish(createEvent('agent:started', { agentId: 'a1', agentName: 'Agent 1' }))

      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('should receive events published before subscription', async () => {
      const handler = vi.fn()
      await bus.publish(createEvent('notebook:created', { notebookId: '1', name: 'Test' }))

      bus.onAny(handler)

      await bus.publish(createEvent('notebook:created', { notebookId: '2', name: 'Test 2' }))

      expect(handler).toHaveBeenCalledOnce()
    })

    it('should unsubscribe from wildcard', async () => {
      const handler = vi.fn()
      const sub = bus.onAny(handler)

      await bus.publish(createEvent('notebook:created', { notebookId: '1', name: 'Test' }))
      expect(handler).toHaveBeenCalledOnce()

      sub.unsubscribe()

      await bus.publish(createEvent('notebook:created', { notebookId: '2', name: 'Test 2' }))
      expect(handler).toHaveBeenCalledOnce()
    })
  })

  describe('clear', () => {
    it('should remove all subscriptions', async () => {
      const handler = vi.fn()
      bus.subscribe('notebook:created', handler)
      bus.onAny(handler)

      bus.clear()

      await bus.publish(createEvent('notebook:created', { notebookId: '1', name: 'Test' }))
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('subscriberCount', () => {
    it('should track subscriber count per event type', () => {
      expect(bus.subscriberCount('notebook:created')).toBe(0)

      const sub1 = bus.subscribe('notebook:created', vi.fn())
      expect(bus.subscriberCount('notebook:created')).toBe(1)

      bus.subscribe('notebook:created', vi.fn())
      expect(bus.subscriberCount('notebook:created')).toBe(2)

      sub1.unsubscribe()
      expect(bus.subscriberCount('notebook:created')).toBe(1)
    })

    it('should count wildcard handlers with "*"', () => {
      expect(bus.subscriberCount('*')).toBe(0)

      bus.onAny(vi.fn())
      expect(bus.subscriberCount('*')).toBe(1)

      bus.subscribe('notebook:created', vi.fn())
      expect(bus.subscriberCount('*')).toBe(2)
    })
  })

  describe('error handling', () => {
    it('should not throw if handler throws', async () => {
      bus.subscribe('notebook:created', () => {
        throw new Error('Handler error')
      })

      // Should not throw
      await bus.publish(createEvent('notebook:created', { notebookId: '1', name: 'Test' }))
    })

    it('should still call other handlers if one throws', async () => {
      const handler2 = vi.fn()
      bus.subscribe('notebook:created', () => {
        throw new Error('Handler error')
      })
      bus.subscribe('notebook:created', handler2)

      await bus.publish(createEvent('notebook:created', { notebookId: '1', name: 'Test' }))

      expect(handler2).toHaveBeenCalledOnce()
    })
  })

  describe('createEvent helper', () => {
    it('should create event with timestamp', () => {
      const event = createEvent('notebook:created', {
        notebookId: '1',
        name: 'Test',
      })

      expect(event.type).toBe('notebook:created')
      expect(event.notebookId).toBe('1')
      expect(event.name).toBe('Test')
      expect(event.timestamp).toBeTypeOf('number')
      expect(event.timestamp).toBeGreaterThan(0)
    })

    it('should include correlationId when provided', () => {
      const event = createEvent('notebook:created', {
        notebookId: '1',
        name: 'Test',
      }, 'req_abc123')

      expect(event.correlationId).toBe('req_abc123')
    })
  })

  describe('eventTypes', () => {
    it('should return registered event types', () => {
      bus.subscribe('notebook:created', vi.fn())
      bus.subscribe('agent:started', vi.fn())
      bus.subscribe('notebook:created', vi.fn()) // duplicate

      const types = bus.eventTypes()
      expect(types).toContain('notebook:created')
      expect(types).toContain('agent:started')
      expect(types.length).toBe(2)
    })
  })

  describe('unsubscribeAll', () => {
    it('should remove all handlers for a specific event type', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      bus.subscribe('notebook:created', handler1)
      bus.subscribe('agent:started', handler2)

      bus.unsubscribeAll('notebook:created')

      await bus.publish(createEvent('notebook:created', { notebookId: '1', name: 'Test' }))
      await bus.publish(createEvent('agent:started', { agentId: 'a1', agentName: 'Agent' }))

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledOnce()
    })
  })
})
