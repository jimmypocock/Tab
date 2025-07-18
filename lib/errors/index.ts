export enum ErrorCode {
  // Client errors
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // Business logic errors
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  TAB_ALREADY_PAID = 'TAB_ALREADY_PAID',
  TAB_VOID = 'TAB_VOID',
  INVALID_API_KEY = 'INVALID_API_KEY',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details)
    this.name = 'ValidationError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(ErrorCode.UNAUTHORIZED, message, 401)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(ErrorCode.FORBIDDEN, message, 403)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(ErrorCode.NOT_FOUND, `${resource} not found`, 404)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorCode.CONFLICT, message, 409, details)
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Too many requests',
      429,
      { retryAfter }
    )
    this.name = 'RateLimitError'
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: any) {
    super(
      ErrorCode.DATABASE_ERROR,
      'Database operation failed',
      500,
      { message, originalError: originalError?.message }
    )
    this.name = 'DatabaseError'
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: any) {
    super(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      `External service error: ${service}`,
      502,
      { service, originalError: originalError?.message }
    )
    this.name = 'ExternalServiceError'
  }
}

export class PaymentError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorCode.PAYMENT_FAILED, message, 400, details)
    this.name = 'PaymentError'
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

export function handleError(error: unknown): {
  statusCode: number
  body: any
} {
  // Handle known errors
  if (isAppError(error)) {
    return {
      statusCode: error.statusCode,
      body: error.toJSON(),
    }
  }

  // Handle Zod validation errors
  if (error && typeof error === 'object' && 'name' in error) {
    if (error.name === 'ZodError') {
      const zodError = error as any
      return {
        statusCode: 400,
        body: {
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Validation failed',
            details: zodError.errors,
          },
        },
      }
    }
  }

  // Handle Stripe errors
  if (error && typeof error === 'object' && 'type' in error) {
    const stripeError = error as any
    if (stripeError.type?.includes('Stripe')) {
      return {
        statusCode: 400,
        body: {
          error: {
            code: ErrorCode.PAYMENT_FAILED,
            message: stripeError.message || 'Payment processing error',
          },
        },
      }
    }
  }

  // Log unexpected errors (in production, use proper logging service)
  console.error('Unexpected error:', error)

  // Return generic error for unknown errors
  return {
    statusCode: 500,
    body: {
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
      },
    },
  }
}