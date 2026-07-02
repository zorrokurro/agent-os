/**
 * Event Bus Types
 *
 * Core type definitions for the AgentOS Event Bus.
 * All events flow through this system.
 *
 * Design principles:
 *   - Every event has a type, timestamp, and optional correlationId
 *   - Events are plain objects (no class inheritance)
 *   - Handlers can be sync or async
 *   - publish() returns promises for async handlers
 */

// ─── Base Event ──────────────────────────────────────────────────────────────

/**
 * Base interface for all events.
 * Every event must have at minimum a `type` and `timestamp`.
 */
export interface BaseEvent {
  /** Event type identifier (e.g., 'notebook:created') */
  type: string
  /** Timestamp in milliseconds */
  timestamp: number
  /** Correlation ID for tracing across modules */
  correlationId?: string
  /** Source module that emitted the event */
  source?: string
}

// ─── Event Handler ───────────────────────────────────────────────────────────

/**
 * Event handler function.
 * Can be sync or async.
 */
export type EventHandler<T extends BaseEvent = BaseEvent> = (event: T) => void | Promise<void>

/**
 * Subscription handle returned by subscribe().
 * Call unsubscribe() to remove the handler.
 */
export interface Subscription {
  unsubscribe: () => void
}

// ─── Event Bus Interface ─────────────────────────────────────────────────────

/**
 * EventBus interface.
 * Framework-agnostic, can be implemented for different contexts.
 */
export interface IEventBus {
  /**
   * Publish an event to all subscribed handlers.
   * Returns promises for async handlers.
   */
  publish<T extends BaseEvent>(event: T): Promise<void>

  /**
   * Subscribe to events by type.
   * Returns a subscription handle.
   */
  subscribe<T extends BaseEvent>(
    eventType: T['type'],
    handler: EventHandler<T>,
  ): Subscription

  /**
   * Subscribe to all events (wildcard).
   * Useful for logging, debugging, and analytics.
   */
  onAny(handler: EventHandler<BaseEvent>): Subscription

  /**
   * Remove all subscriptions.
   */
  clear(): void

  /**
   * Get the number of subscribers for a given event type.
   */
  subscriberCount(eventType: string): number
}
