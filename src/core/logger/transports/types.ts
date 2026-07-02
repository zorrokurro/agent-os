/**
 * Logger Transport Interface
 *
 * Abstract logging backend.
 * Implementations:
 *   - ConsoleTransport: browser/node console (default)
 *   - FileTransport: write to file (future)
 *   - SentryTransport: error reporting (future)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  context?: string
  data?: Record<string, unknown>
  timestamp: number
  error?: Error
  /** Correlation ID for tracing requests across modules */
  correlationId?: string
  /** Duration in ms for performance tracking */
  duration?: number
}

export interface LoggerTransport {
  log(entry: LogEntry): void
  dispose?(): void
}
