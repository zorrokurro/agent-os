/**
 * Logger
 *
 * Structured logger with pluggable transports.
 * Replaces all console.log/console.error in the codebase.
 *
 * Features:
 *   - Log levels: debug, info, warn, error
 *   - Context tagging: each log entry can have a module context
 *   - Structured data: attach key-value data to any log entry
 *   - Correlation ID: trace requests across modules
 *   - Performance Timer: measure operation duration
 *   - Error wrapping: automatically captures stack traces
 *   - Pluggable transports: console, file, Sentry (future)
 *
 * Usage:
 *   const logger = new Logger({ context: 'NotebookService' })
 *   logger.info('Notebooks loaded', { count: notebooks.length })
 *
 *   // Correlation ID
 *   logger.withCorrelationId('req_abc123').info('Processing')
 *
 *   // Performance Timer
 *   const timer = logger.time('loadNotebook')
 *   // ... operation ...
 *   timer.end() // outputs: loadNotebook completed in 42ms
 */

import type { LoggerTransport, LogLevel, LogEntry } from './transports/types'
import { ConsoleTransport } from './transports/ConsoleTransport'

export interface LoggerOptions {
  /** Default context for all log entries (e.g., module name) */
  context?: string
  /** Minimum log level to output */
  minLevel?: LogLevel
  /** Custom transports. Defaults to [ConsoleTransport]. */
  transports?: LoggerTransport[]
  /** Default correlation ID for all log entries from this logger */
  correlationId?: string
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// ─── Performance Timer ───────────────────────────────────────────────────────

export interface PerfTimer {
  /** End the timer and log the duration */
  end(data?: Record<string, unknown>): number
  /** Get elapsed time without ending */
  elapsed(): number
}

/**
 * Generate a short correlation ID.
 * Format: `req_` + 8 hex chars
 */
function generateCorrelationId(): string {
  return `req_${Math.random().toString(16).slice(2, 10)}`
}

// ─── Logger ──────────────────────────────────────────────────────────────────

export class Logger {
  private context?: string
  private minLevel: number
  private transports: LoggerTransport[]
  private defaultCorrelationId?: string

  constructor(options: LoggerOptions = {}) {
    this.context = options.context
    this.minLevel = LEVEL_WEIGHT[options.minLevel ?? 'debug']
    this.transports = options.transports ?? [new ConsoleTransport(options.minLevel)]
    this.defaultCorrelationId = options.correlationId
  }

  // ─── Core Methods ────────────────────────────────────────────────────────

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data)
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data)
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data)
  }

  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const errorData = error instanceof Error
      ? { ...data, errorMessage: error.message, errorStack: error.stack }
      : data

    this.log('error', message, errorData, error instanceof Error ? error : undefined)
  }

  // ─── Correlation ID ──────────────────────────────────────────────────────

  /**
   * Create a new logger with a correlation ID.
   * All log entries from the returned logger will include this ID.
   *
   * @example
   * const reqLogger = logger.withCorrelationId()
   * reqLogger.info('Starting workflow')  // includes auto-generated ID
   *
   * const reqLogger = logger.withCorrelationId('req_abc123')
   * reqLogger.info('Starting workflow')  // includes 'req_abc123'
   */
  withCorrelationId(correlationId?: string): Logger {
    return new Logger({
      context: this.context,
      minLevel: this.getLevelName(),
      transports: this.transports,
      correlationId: correlationId ?? generateCorrelationId(),
    })
  }

  // ─── Performance Timer ───────────────────────────────────────────────────

  /**
   * Start a performance timer.
   * Call `timer.end()` to log the duration.
   *
   * @example
   * const timer = logger.time('loadNotebooks')
   * const notebooks = await db.query(...)
   * timer.end({ count: notebooks.length })
   * // outputs: loadNotebooks completed in 42ms { count: 5 }
   */
  time(label: string): PerfTimer {
    const start = performance.now()
    return {
      end: (data?: Record<string, unknown>): number => {
        const duration = Math.round(performance.now() - start)
        this.info(`${label} completed in ${duration}ms`, {
          ...data,
          duration,
          perfLabel: label,
        })
        return duration
      },
      elapsed: (): number => {
        return Math.round(performance.now() - start)
      },
    }
  }

  // ─── Child Logger ────────────────────────────────────────────────────────

  /**
   * Create a child logger with a sub-context.
   *
   * @example
   * const logger = new Logger({ context: 'Notebook' })
   * const child = logger.child('Repository')
   * child.info('Loaded') // [Notebook:Repository] Loaded
   */
  child(subContext: string): Logger {
    const parentContext = this.context ? `${this.context}:${subContext}` : subContext
    return new Logger({
      context: parentContext,
      minLevel: this.getLevelName(),
      transports: this.transports,
      correlationId: this.defaultCorrelationId,
    })
  }

  // ─── Transport Management ────────────────────────────────────────────────

  addTransport(transport: LoggerTransport): void {
    this.transports.push(transport)
  }

  removeTransport(transport: LoggerTransport): void {
    const idx = this.transports.indexOf(transport)
    if (idx >= 0) this.transports.splice(idx, 1)
  }

  dispose(): void {
    this.transports.forEach((t) => t.dispose?.())
    this.transports = []
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error,
  ): void {
    if (LEVEL_WEIGHT[level] < this.minLevel) return

    const entry: LogEntry = {
      level,
      message,
      context: this.context,
      data,
      timestamp: Date.now(),
      error,
      correlationId: this.defaultCorrelationId,
    }

    for (const transport of this.transports) {
      try {
        transport.log(entry)
      } catch {
        // Prevent transport errors from breaking the app
      }
    }
  }

  private getLevelName(): LogLevel {
    const names: LogLevel[] = ['debug', 'info', 'warn', 'error']
    return names[this.minLevel] ?? 'debug'
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a logger with the given context.
 * Shorthand for `new Logger({ context: '...' })`.
 */
export function createLogger(context: string, options?: Partial<LoggerOptions>): Logger {
  return new Logger({ ...options, context })
}

// ─── Global Logger Singleton ─────────────────────────────────────────────────

let globalLogger: Logger | null = null

/**
 * Get or create the global logger.
 * Used as the default logger throughout the app.
 */
export function getGlobalLogger(): Logger {
  if (!globalLogger) {
    const isDev = typeof process !== 'undefined'
      ? process.env?.NODE_ENV !== 'production'
      : true
    globalLogger = new Logger({
      context: 'AgentOS',
      minLevel: isDev ? 'debug' : 'info',
    })
  }
  return globalLogger
}

/**
 * Set a custom global logger.
 */
export function setGlobalLogger(logger: Logger): void {
  globalLogger = logger
}
