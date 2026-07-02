/**
 * Console Logger Transport
 *
 * Outputs log entries to the browser/node console.
 * Uses console.debug/info/warn/error for each level.
 * In production, debug messages are suppressed.
 */

import type { LoggerTransport, LogEntry } from './types'

const LEVEL_ICONS: Record<string, string> = {
  debug: '🔍',
  info: '📋',
  warn: '⚠️',
  error: '❌',
}

const LEVEL_METHODS: Record<string, 'debug' | 'info' | 'warn' | 'error'> = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
}

export class ConsoleTransport implements LoggerTransport {
  private minLevel: number
  private readonly levelOrder = ['debug', 'info', 'warn', 'error']

  constructor(minLevel: LogLevel = 'debug') {
    this.minLevel = this.levelOrder.indexOf(minLevel)
  }

  log(entry: LogEntry): void {
    const levelIndex = this.levelOrder.indexOf(entry.level)
    if (levelIndex < this.minLevel) return

    const method = LEVEL_METHODS[entry.level]
    const icon = LEVEL_ICONS[entry.level]
    const prefix = entry.context ? `[${entry.context}]` : ''
    const timestamp = new Date(entry.timestamp).toISOString().slice(11, 23)

    const args: unknown[] = [
      `${icon} ${timestamp} ${prefix} ${entry.message}`,
    ]

    if (entry.data && Object.keys(entry.data).length > 0) {
      args.push(entry.data)
    }

    if (entry.error) {
      args.push(entry.error)
    }

    console[method](...args)
  }

  dispose(): void {
    // No cleanup needed for console
  }
}

type LogLevel = import('./types').LogLevel
