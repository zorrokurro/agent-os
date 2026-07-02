/**
 * Electron IPC Transport
 *
 * Wraps window.electronAPI for use with IPCClient.
 * This is the only file that touches Electron APIs directly.
 *
 * Maps contract-style object requests to preload's positional args.
 * e.g., ipc.invoke('notebook:create', { name, desc, icon, color })
 *    → window.electronAPI.notebookCreate(name, desc, icon, color)
 */

import type { IPCTransport } from './types'

declare global {
  interface Window {
    electronAPI: Record<string, (...args: unknown[]) => Promise<unknown> & { on?: unknown }>
  }
}

/**
 * Channel-to-method mapping and arg extraction.
 * Defines how to convert contract object args to preload positional args.
 */
const CHANNEL_MAP: Record<string, (args: unknown) => unknown[]> = {
  // Notebook - object to positional
  'notebook:create': (args) => {
    const o = args as Record<string, unknown>
    return [o.name, o.description, o.icon, o.color]
  },
  'notebook:update': (args) => {
    const o = args as Record<string, unknown>
    return [o.id, o.updates]
  },
  // Note - object to positional (skip undefined trailing args)
  'note:create': (args) => {
    const o = args as Record<string, unknown>
    const result = [o.notebookId, o.title]
    if (o.content !== undefined) result.push(o.content)
    if (o.tags !== undefined) result.push(o.tags)
    return result
  },
  'note:update': (args) => {
    const o = args as Record<string, unknown>
    return [o.id, o.updates]
  },
  'note:search': (args) => {
    const o = args as Record<string, unknown>
    return [o.query, o.notebookId, o.limit]
  },
  'note:by-tag': (args) => {
    const o = args as Record<string, unknown>
    return [o.tag, o.limit]
  },
  // Source - object to positional
  'source:import-url': (args) => {
    const o = args as Record<string, unknown>
    return [o.url, o.notebookId]
  },
  'source:import-text': (args) => {
    const o = args as Record<string, unknown>
    return [o.text, o.notebookId]
  },
  // AI - pass object as-is (preload accepts object)
  'ai-chat': (args) => [args],
  // Memory - object to positional
  'save-conversation': (args) => {
    const o = args as Record<string, unknown>
    return [o.agentName, o.messages]
  },
  'save-memory-item': (args) => {
    const o = args as Record<string, unknown>
    return [o.filePath, o.content]
  },
  // MCP - object to positional
  'mcp:add-server': (args) => [args],
  'mcp:toggle-server': (args) => {
    const o = args as Record<string, unknown>
    return [o.serverId, o.enabled]
  },
  'mcp:list-tools': (args) => {
    const o = args as Record<string, unknown>
    return [o.serverId]
  },
  'mcp:call-tool': (args) => {
    const o = args as Record<string, unknown>
    return [o.serverId, o.toolName, o.args]
  },
  // UMP - object to positional
  'ump-hub-search': (args) => {
    const o = args as Record<string, unknown>
    return [o.query, o.opts]
  },
  'ump-exchange-register': (args) => {
    const o = args as Record<string, unknown>
    return [o.agentId, o.name, o.description]
  },
  'ump:add-memory': (args) => [args],
  'ump-conversations': (args) => {
    const o = args as Record<string, unknown>
    return [o.agentName, o.limit]
  },
  'ump:create-task': (args) => {
    const o = args as Record<string, unknown>
    return [o.title, o.content, o.target, o.source]
  },
  'ump:get-tasks': (args) => {
    const o = args as Record<string, unknown>
    return [o.target, o.status]
  },
  'ump:update-task': (args) => {
    const o = args as Record<string, unknown>
    return [o.id, o.status, o.result]
  },
  // System - object to positional
  'system-add-to-library': (args) => [args],
  // Settings - object to positional
  'set-full-settings': (args) => [args],
  // Install - object to positional
  'install-agent': (args) => [args],
  'run-installation': (args) => [args],
}

export class ElectronTransport implements IPCTransport {
  private api: Record<string, (...args: unknown[]) => Promise<unknown>> | null = null

  constructor() {
    this.api = typeof window !== 'undefined' ? window.electronAPI : null
  }

  isConnected(): boolean {
    return this.api !== null && typeof this.api === 'object'
  }

  async invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
    if (!this.api) {
      throw new Error('ElectronTransport: window.electronAPI not available')
    }

    const methodName = this.toMethodName(channel)
    const handler = this.api[methodName]
    if (!handler) {
      throw new Error(`ElectronTransport: method "${methodName}" (channel "${channel}") not found on electronAPI`)
    }

    // Convert contract args to preload positional args
    const mappedArgs = args.length > 0 ? this.mapArgs(channel, args[0]) : []
    return handler(...mappedArgs) as Promise<T>
  }

  subscribe<T>(channel: string, callback: (data: T) => void): () => void {
    if (!this.api) {
      throw new Error('ElectronTransport: window.electronAPI not available')
    }

    const onMethodName = this.toOnMethodName(channel)
    const onMethod = this.api[onMethodName]

    if (typeof onMethod !== 'function') {
      console.warn(`ElectronTransport: no listener method found for event "${channel}" (tried "${onMethodName}")`)
      return () => {}
    }

    const result = onMethod(callback)
    if (typeof result === 'function') {
      return result as () => void
    }
    return () => {}
  }

  dispose(): void {
    this.api = null
  }

  /**
   * Convert IPC channel name to electronAPI method name.
   */
  private toMethodName(channel: string): string {
    if (!channel.includes(':') && !channel.includes('-')) {
      return channel
    }

    if (channel.includes(':')) {
      const [namespace, action] = channel.split(':')
      return namespace + this.toPascalCase(action)
    }

    return this.toCamelCase(channel)
  }

  private toOnMethodName(channel: string): string {
    const methodName = this.toMethodName(channel)
    return `on${methodName.charAt(0).toUpperCase()}${methodName.slice(1)}`
  }

  /**
   * Map contract object args to preload positional args.
   */
  private mapArgs(channel: string, arg: unknown): unknown[] {
    const mapper = CHANNEL_MAP[channel]
    if (mapper) {
      return mapper(arg)
    }
    // No mapping needed - pass through (for simple string/number args)
    return [arg]
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map((s) => {
        // Keep common acronyms uppercase
        const upper = s.toUpperCase()
        if (['URL', 'PDF', 'API', 'HTML', 'JSON', 'SQL', 'MCP', 'UMP'].includes(upper)) {
          return upper
        }
        return s.charAt(0).toUpperCase() + s.slice(1)
      })
      .join('')
  }

  private toCamelCase(str: string): string {
    const parts = str.split(/[-_]/)
    return parts
      .map((s, i) => (i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)))
      .join('')
  }
}
