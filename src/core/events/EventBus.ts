/**
 * EventBus Implementation
 *
 * Type-safe, framework-agnostic event bus for AgentOS.
 *
 * Features:
 *   - Type-safe publish/subscribe
 *   - Wildcard subscriptions (onAny)
 *   - Async handler support
 *   - Correlation ID propagation
 *   - Subscriber count tracking
 *   - Clear/remove capabilities
 *
 * Usage:
 *   const bus = new EventBus()
 *
 *   // Subscribe
 *   const sub = bus.subscribe('notebook:created', (event) => {
 *     console.log('Notebook created:', event.name)
 *   })
 *
 *   // Publish
 *   await bus.publish({ type: 'notebook:created', notebookId: '1', name: 'My Notebook', timestamp: Date.now() })
 *
 *   // Unsubscribe
 *   sub.unsubscribe()
 */

import type { BaseEvent, EventHandler, IEventBus, Subscription } from './types'

type HandlerEntry = {
  handler: EventHandler<BaseEvent>
  eventType: string | '*'  // '*' for wildcard
}

export class EventBus implements IEventBus {
  private handlers = new Map<string, Set<EventHandler<BaseEvent>>>()
  private wildcardHandlers = new Set<EventHandler<BaseEvent>>()
  private handlerCount = 0

  /**
   * Publish an event to all subscribed handlers.
   * Wildcard handlers receive all events.
   * Returns when all handlers have been called (async handlers are awaited).
   */
  async publish<T extends BaseEvent>(event: T): Promise<void> {
    const { type } = event
    const promises: Promise<void>[] = []

    // Call type-specific handlers
    const typeHandlers = this.handlers.get(type)
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        promises.push(this.invokeHandler(handler, event))
      }
    }

    // Call wildcard handlers
    for (const handler of this.wildcardHandlers) {
      promises.push(this.invokeHandler(handler, event))
    }

    // Wait for all handlers to complete
    await Promise.all(promises)
  }

  /**
   * Subscribe to events by type.
   * Returns a subscription handle.
   *
   * @example
   * const sub = bus.subscribe('notebook:created', (event) => {
   *   console.log(event.name)
   * })
   * sub.unsubscribe()
   */
  subscribe<T extends BaseEvent>(
    eventType: T['type'],
    handler: EventHandler<T>,
  ): Subscription {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
    }
    this.handlers.get(eventType)!.add(handler as EventHandler<BaseEvent>)
    this.handlerCount++

    return {
      unsubscribe: () => {
        this.handlers.get(eventType)?.delete(handler as EventHandler<BaseEvent>)
        this.handlerCount--
      },
    }
  }

  /**
   * Subscribe to all events (wildcard).
   * Useful for logging, debugging, and analytics.
   *
   * @example
   * const sub = bus.onAny((event) => {
   *   logger.debug('Event emitted', { type: event.type })
   * })
   */
  onAny(handler: EventHandler<BaseEvent>): Subscription {
    this.wildcardHandlers.add(handler)
    this.handlerCount++

    return {
      unsubscribe: () => {
        this.wildcardHandlers.delete(handler)
        this.handlerCount--
      },
    }
  }

  /**
   * Remove all subscriptions.
   */
  clear(): void {
    this.handlers.clear()
    this.wildcardHandlers.clear()
    this.handlerCount = 0
  }

  /**
   * Get the number of subscribers for a given event type.
   * Pass '*' to get total count including wildcard handlers.
   */
  subscriberCount(eventType: string): number {
    if (eventType === '*') {
      return this.handlerCount
    }
    return this.handlers.get(eventType)?.size ?? 0
  }

  /**
   * Get all registered event types.
   */
  eventTypes(): string[] {
    return Array.from(this.handlers.keys())
  }

  /**
   * Remove all handlers for a specific event type.
   */
  unsubscribeAll(eventType: string): void {
    const count = this.handlers.get(eventType)?.size ?? 0
    this.handlers.delete(eventType)
    this.handlerCount -= count
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async invokeHandler(
    handler: EventHandler<BaseEvent>,
    event: BaseEvent,
  ): Promise<void> {
    try {
      await handler(event)
    } catch (error) {
      // Prevent handler errors from breaking the bus
      // Log to console as fallback (Logger may not be available in Core)
      console.error(`[EventBus] Handler error for "${event.type}":`, error)
    }
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let globalBus: EventBus | null = null

/**
 * Get or create the global event bus.
 */
export function getGlobalEventBus(): EventBus {
  if (!globalBus) {
    globalBus = new EventBus()
  }
  return globalBus
}

/**
 * Set a custom global event bus.
 */
export function setGlobalEventBus(bus: EventBus): void {
  globalBus = bus
}
