const ERROR_MAP = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  PAYMENT_FAILED: 402,
  INSUFFICIENT_STOCK: 409,
  VENDOR_INACTIVE: 403,
  INTERNAL_ERROR: 500,
} as const

export type ErrorCode = keyof typeof ERROR_MAP

export class AppError extends Error {
  readonly code: ErrorCode
  readonly statusCode: number
  readonly details?: unknown[]

  constructor(code: ErrorCode, statusCodeOverride?: number, details?: unknown[]) {
    super(code)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCodeOverride ?? ERROR_MAP[code]
    this.details = details
    Object.setPrototypeOf(this, AppError.prototype)
  }

  static unauthorized(message?: string) {
    const err = new AppError('UNAUTHORIZED')
    if (message) err.message = message
    return err
  }

  static forbidden(message?: string) {
    const err = new AppError('FORBIDDEN')
    if (message) err.message = message
    return err
  }

  static notFound(resource = 'Resource') {
    const err = new AppError('NOT_FOUND')
    err.message = `${resource} not found`
    return err
  }

  static conflict(message = 'Resource already exists') {
    const err = new AppError('CONFLICT')
    err.message = message
    return err
  }

  static from(code: ErrorCode, statusCode?: number, message?: string) {
    const err = new AppError(code, statusCode)
    if (message) err.message = message
    return err
  }
}
