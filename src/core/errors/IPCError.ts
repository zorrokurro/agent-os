/**
 * IPC-specific error types.
 *
 * Wraps errors from IPC transport layer with structured context.
 * The IPCClient catches transport errors and wraps them in IPCError
 * so callers get consistent error types.
 */

import { AppError, type ErrorCode } from './AppError'

export type IPCErrorCode =
  | 'IPC_TIMEOUT'
  | 'IPC_CHANNEL_NOT_FOUND'
  | 'IPC_TRANSPORT_ERROR'
  | 'IPC_VALIDATION_ERROR'
  | 'IPC_SERIALIZATION_ERROR'
  | 'IPC_UNKNOWN'

export interface IPCErrorContext {
  channel: string
  code: IPCErrorCode
  timeout?: number
  request?: unknown
}

export class IPCError extends AppError {
  readonly channel: string
  readonly timeout?: number

  constructor(
    message: string,
    options: {
      channel: string
      code?: IPCErrorCode
      cause?: Error
      timeout?: number
      metadata?: Record<string, unknown>
    },
  ) {
    super(message, {
      code: options.code as ErrorCode ?? 'IPC_ERROR',
      cause: options.cause,
      metadata: {
        ...options.metadata,
        channel: options.channel,
      },
    })
    this.name = 'IPCError'
    this.channel = options.channel
    this.timeout = options.timeout
  }

  static timeout(channel: string, timeoutMs: number): IPCError {
    return new IPCError(
      `IPC call to "${channel}" timed out after ${timeoutMs}ms`,
      { channel, code: 'IPC_TIMEOUT', timeout: timeoutMs },
    )
  }

  static channelNotFound(channel: string): IPCError {
    return new IPCError(
      `IPC channel "${channel}" not found in contract`,
      { channel, code: 'IPC_CHANNEL_NOT_FOUND' },
    )
  }

  static transport(channel: string, cause: Error): IPCError {
    return new IPCError(
      `IPC transport error on "${channel}": ${cause.message}`,
      { channel, code: 'IPC_TRANSPORT_ERROR', cause },
    )
  }

  static from(channel: string, error: unknown): IPCError {
    if (error instanceof IPCError) return error
    if (error instanceof AppError) {
      return new IPCError(error.message, {
        channel,
        code: 'IPC_TRANSPORT_ERROR',
        cause: error,
      })
    }
    if (error instanceof Error) {
      // Check for timeout errors from Electron
      if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
        return IPCError.timeout(channel, 0)
      }
      return IPCError.transport(channel, error)
    }
    return new IPCError(String(error), { channel, code: 'IPC_UNKNOWN' })
  }
}
