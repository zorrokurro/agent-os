/**
 * IPC Client
 *
 * Type-safe IPC abstraction layer.
 * Uses Transport interface so it never depends on Electron directly.
 *
 * Features:
 *   - Contract-first: TypeScript infers request/response types
 *   - Timeout support: prevent hanging calls
 *   - AbortSignal support: cancel long-running calls
 *   - Streaming: combine invoke + event subscriptions
 *   - Error wrapping: all errors become IPCError
 *   - No retry: leave retry logic to React Query
 *
 * Usage:
 *   const client = new IPCClient(new ElectronTransport())
 *   const notebooks = await client.invoke('notebook:list')
 *   // TypeScript knows: notebooks is Notebook[]
 */

import type { IPCContract, IPCEventContract, IPCChannelKey, IPCEventChannelKey, IPCRequest, IPCResponse } from './contracts'
import type { IPCTransport } from './transports'
import { IPCError } from '../errors/IPCError'

export interface IPCInvokeOptions {
  /** Timeout in milliseconds. If not set, no timeout is applied. */
  timeout?: number
  /** AbortSignal to cancel the call. */
  signal?: AbortSignal
}

/**
 * Options for streaming IPC calls.
 * Combines a request channel with event subscriptions.
 */
export interface IPCStreamOptions<K extends IPCChannelKey> {
  /** The request to send (e.g., { model, messages }) */
  request: IPCRequest<K>
  /** Called for each streamed token */
  onToken?: (token: string) => void
  /** Called when streaming completes */
  onDone?: (reply: string) => void
  /** Called on error */
  onError?: (error: string) => void
  /** Timeout in milliseconds */
  timeout?: number
  /** AbortSignal to cancel */
  signal?: AbortSignal
}

/**
 * Handle for a streaming session.
 * Call dispose() to clean up all subscriptions.
 */
export interface IPCStreamHandle {
  /** Clean up all event subscriptions */
  dispose: () => void
  /** Whether the stream is still active */
  active: boolean
}

export class IPCClient {
  private transport: IPCTransport

  constructor(transport: IPCTransport) {
    this.transport = transport
  }

  /**
   * Invoke an IPC channel with type-safe request/response.
   *
   * @example
   * const notebooks = await ipc.invoke('notebook:list')
   * const notebook = await ipc.invoke('notebook:get', 'nb_123')
   * const created = await ipc.invoke('notebook:create', { name: 'My Notebook' })
   */
  async invoke<K extends IPCChannelKey>(
    channel: K,
    ...args: IPCRequest<K> extends void ? [] : [IPCRequest<K>]
  ): Promise<IPCResponse<K>> {
    try {
      if (args.length > 0) {
        return await this.transport.invoke<IPCResponse<K>>(channel, args[0])
      }
      return await this.transport.invoke<IPCResponse<K>>(channel)
    } catch (error) {
      throw IPCError.from(channel, error)
    }
  }

  /**
   * Invoke with options (timeout, abort signal).
   *
   * @example
   * const result = await ipc.invokeWith('notebook:list', { timeout: 5000 })
   * const result = await ipc.invokeWith('notebook:list', { signal: controller.signal })
   */
  async invokeWith<K extends IPCChannelKey>(
    channel: K,
    options: IPCInvokeOptions,
    ...args: IPCRequest<K> extends void ? [] : [IPCRequest<K>]
  ): Promise<IPCResponse<K>> {
    try {
      let promise: Promise<IPCResponse<K>>
      if (args.length > 0) {
        promise = this.transport.invoke<IPCResponse<K>>(channel, args[0])
      } else {
        promise = this.transport.invoke<IPCResponse<K>>(channel)
      }

      if (options.timeout !== undefined && options.timeout > 0) {
        promise = withTimeout(promise, options.timeout, channel)
      }

      if (options.signal) {
        promise = withAbort(promise, options.signal)
      }

      return await promise
    } catch (error) {
      throw IPCError.from(channel, error)
    }
  }

  /**
   * Subscribe to an event from the main process.
   * Returns an unsubscribe function.
   *
   * @example
   * const unsub = ipc.on('chat-token', (token) => {
   *   setMessages(prev => prev + token)
   * })
   * // Later:
   * unsub()
   */
  on<K extends IPCEventChannelKey>(
    channel: K,
    callback: (data: IPCEventContract[K]) => void,
  ): () => void {
    return this.transport.subscribe<IPCEventContract[K]>(channel, callback)
  }

  /**
   * Stream data via invoke + event subscriptions.
   *
   * This combines the request/response pattern with event-based streaming.
   * Common use case: trigger LLM chat, receive tokens via events.
   *
   * @example
   * const handle = ipc.stream('chat-stream', {
   *   request: { model: 'llama3', messages },
   *   onToken: (token) => setReply(prev => prev + token),
   *   onDone: (reply) => saveConversation(reply),
   *   onError: (err) => setError(err),
   * })
   *
   * // Later:
   * handle.dispose()  // clean up subscriptions
   */
  stream<K extends IPCChannelKey>(
    invokeChannel: K,
    options: IPCStreamOptions<K>,
  ): IPCStreamHandle {
    const cleanups: Array<() => void> = []
    let active = true

    const cleanup = () => {
      if (!active) return
      active = false
      cleanups.forEach((fn) => fn())
      cleanups.length = 0
    }

    // Subscribe to events BEFORE invoking
    if (options.onToken) {
      cleanups.push(this.on('chat-token', options.onToken))
    }
    if (options.onDone) {
      cleanups.push(this.on('chat-done', (reply) => {
        options.onDone!(reply)
        cleanup() // Auto-cleanup when done
      }))
    }
    if (options.onError) {
      cleanups.push(this.on('chat-error', (error) => {
        options.onError!(error)
        cleanup() // Auto-cleanup on error
      }))
    }

    // Apply timeout if specified
    let invokePromise: Promise<IPCResponse<K>>
    const transportInvoke = () => this.transport.invoke<IPCResponse<K>>(
      invokeChannel,
      options.request as unknown as void extends IPCRequest<K> ? never : IPCRequest<K>,
    )

    if (options.timeout !== undefined && options.timeout > 0) {
      invokePromise = withTimeout(transportInvoke(), options.timeout, invokeChannel as string)
    } else {
      invokePromise = transportInvoke()
    }

    // Apply abort signal
    if (options.signal) {
      invokePromise = withAbort(invokePromise, options.signal)
    }

    // Fire and forget - errors are handled by onError callback
    invokePromise.catch((error) => {
      if (active && options.onError) {
        options.onError(error instanceof Error ? error.message : String(error))
      }
      cleanup()
    })

    return { dispose: cleanup, get active() { return active } }
  }

  /**
   * Check if the underlying transport is connected.
   */
  isConnected(): boolean {
    return this.transport.isConnected()
  }

  /**
   * Clean up the transport.
   */
  dispose(): void {
    this.transport.dispose()
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, channel: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(IPCError.timeout(channel, ms))
    }, ms)

    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'))
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException('Aborted', 'AbortError'))
    }

    signal.addEventListener('abort', onAbort, { once: true })

    promise
      .then((value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      })
      .catch((error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      })
  })
}
