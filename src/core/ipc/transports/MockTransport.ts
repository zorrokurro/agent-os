/**
 * Mock IPC Transport
 *
 * In-memory transport for testing.
 * Allows registering handlers and simulating events.
 *
 * Usage in tests:
 *   const transport = new MockTransport()
 *   transport.registerHandler('notebook:list', async () => [mockNotebook])
 *   const client = new IPCClient(transport)
 *   const notebooks = await client.invoke('notebook:list')
 */

import type { IPCTransport } from './types'

type Handler = (...args: unknown[]) => Promise<unknown>
type EventCallback<T> = (data: T) => void

export class MockTransport implements IPCTransport {
  private handlers = new Map<string, Handler>()
  private eventListeners = new Map<string, Set<EventCallback<unknown>>>()
  private connected = true

  invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
    if (!this.connected) {
      return Promise.reject(new Error('MockTransport: disconnected'))
    }

    const handler = this.handlers.get(channel)
    if (!handler) {
      return Promise.reject(new Error(`MockTransport: no handler registered for "${channel}"`))
    }

    return handler(...args) as Promise<T>
  }

  subscribe<T>(channel: string, callback: (data: T) => void): () => void {
    if (!this.eventListeners.has(channel)) {
      this.eventListeners.set(channel, new Set())
    }
    this.eventListeners.get(channel)!.add(callback as EventCallback<unknown>)

    return () => {
      this.eventListeners.get(channel)?.delete(callback as EventCallback<unknown>)
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  dispose(): void {
    this.handlers.clear()
    this.eventListeners.clear()
    this.connected = false
  }

  // ─── Test Utilities ──────────────────────────────────────────────────────

  /**
   * Register a mock handler for a channel.
   * The handler receives the same args as the IPC call.
   */
  registerHandler(channel: string, handler: Handler): void {
    this.handlers.set(channel, handler)
  }

  /**
   * Simulate an event from the main process.
   */
  emitEvent<T>(channel: string, data: T): void {
    const listeners = this.eventListeners.get(channel)
    if (listeners) {
      listeners.forEach((cb) => cb(data))
    }
  }

  /**
   * Disconnect/reconnect the transport for testing error handling.
   */
  setConnected(connected: boolean): void {
    this.connected = connected
  }

  /**
   * Check if a handler is registered for a channel.
   */
  hasHandler(channel: string): boolean {
    return this.handlers.has(channel)
  }

  /**
   * Get all registered channel names.
   */
  getRegisteredChannels(): string[] {
    return Array.from(this.handlers.keys())
  }
}
