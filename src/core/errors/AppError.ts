/**
 * Base application error.
 *
 * All custom errors in AgentOS extend this class.
 * Provides structured error context for logging and debugging.
 */

export type ErrorCode =
  | 'APP_ERROR'
  | 'IPC_ERROR'
  | 'IPC_TIMEOUT'
  | 'IPC_CHANNEL_NOT_FOUND'
  | 'IPC_TRANSPORT_ERROR'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'AGENT_ERROR'
  | 'UNKNOWN_ERROR'

export interface AppErrorContext {
  code: ErrorCode
  message: string
  cause?: Error
  metadata?: Record<string, unknown>
  timestamp: number
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly metadata?: Record<string, unknown>
  readonly timestamp: number
  readonly cause?: Error

  constructor(
    message: string,
    options: {
      code?: ErrorCode
      cause?: Error
      metadata?: Record<string, unknown>
    } = {},
  ) {
    super(message)
    this.name = 'AppError'
    this.code = options.code ?? 'APP_ERROR'
    this.cause = options.cause
    this.metadata = options.metadata
    this.timestamp = Date.now()

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }

  toJSON(): AppErrorContext {
    return {
      code: this.code,
      message: this.message,
      cause: this.cause,
      metadata: this.metadata,
      timestamp: this.timestamp,
    }
  }

  static from(error: unknown, code: ErrorCode = 'UNKNOWN_ERROR'): AppError {
    if (error instanceof AppError) return error
    if (error instanceof Error) {
      return new AppError(error.message, { code, cause: error })
    }
    return new AppError(String(error), { code })
  }
}
