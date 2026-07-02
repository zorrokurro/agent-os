/**
 * IPC Transport Interface
 *
 * Abstract transport layer for IPC communication.
 * The IPCClient depends on this interface, not on Electron directly.
 *
 * Implementations:
 *   - ElectronTransport: Electron ipcRenderer (production)
 *   - MockTransport: In-memory mock (testing)
 *   - Future: WebSocketTransport, HTTPTransport
 */

export interface IPCTransport {
  /**
   * Send a request and receive a response.
   * Throws on transport-level errors.
   */
  invoke<T>(channel: string, ...args: unknown[]): Promise<T>

  /**
   * Subscribe to an event from the main process.
   * Returns an unsubscribe function.
   */
  subscribe<T>(channel: string, callback: (data: T) => void): () => void

  /**
   * Check if the transport is connected/available.
   */
  isConnected(): boolean

  /**
   * Clean up resources.
   */
  dispose(): void
}
