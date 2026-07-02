/**
 * Validation error for input validation failures.
 *
 * Used by IPC contract validation and domain-level validation.
 * Carries structured field-level error details.
 */

import { AppError, type ErrorCode } from './AppError'

export interface FieldError {
  field: string
  message: string
  code?: string
}

export class ValidationError extends AppError {
  readonly fields: FieldError[]

  constructor(
    message: string,
    options: {
      fields?: FieldError[]
      cause?: Error
      metadata?: Record<string, unknown>
    } = {},
  ) {
    super(message, {
      code: 'VALIDATION_ERROR' as ErrorCode,
      cause: options.cause,
      metadata: options.metadata,
    })
    this.name = 'ValidationError'
    this.fields = options.fields ?? []
  }

  static fieldError(field: string, message: string): ValidationError {
    return new ValidationError(`Validation failed: ${message}`, {
      fields: [{ field, message }],
    })
  }

  static multiple(fields: FieldError[]): ValidationError {
    const summary = fields.map((f) => `${f.field}: ${f.message}`).join('; ')
    return new ValidationError(`Validation failed: ${summary}`, { fields })
  }

  hasField(field: string): boolean {
    return this.fields.some((f) => f.field === field)
  }
}
