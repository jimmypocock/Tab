import {
  AppError,
  ErrorCode,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  PaymentError,
  isAppError,
  handleError,
} from '../index'

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an AppError with correct properties', () => {
      const error = new AppError(
        ErrorCode.BAD_REQUEST,
        'Bad request',
        400,
        { field: 'test' }
      )

      expect(error.code).toBe(ErrorCode.BAD_REQUEST)
      expect(error.message).toBe('Bad request')
      expect(error.statusCode).toBe(400)
      expect(error.details).toEqual({ field: 'test' })
      expect(error.name).toBe('AppError')
    })

    it('should serialize to JSON correctly', () => {
      const error = new AppError(ErrorCode.INTERNAL_ERROR, 'Server error', 500)
      const json = error.toJSON()

      expect(json).toEqual({
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Server error',
        },
      })
    })

    it('should include details in JSON when provided', () => {
      const error = new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Validation failed',
        400,
        { errors: ['Field required'] }
      )
      const json = error.toJSON()

      expect(json).toEqual({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
          details: { errors: ['Field required'] },
        },
      })
    })
  })

  describe('ValidationError', () => {
    it('should create a ValidationError with default properties', () => {
      const error = new ValidationError('Invalid input')

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(error.message).toBe('Invalid input')
      expect(error.statusCode).toBe(400)
      expect(error.name).toBe('ValidationError')
    })

    it('should accept details parameter', () => {
      const details = { field: 'email', rule: 'required' }
      const error = new ValidationError('Email is required', details)

      expect(error.details).toEqual(details)
    })
  })

  describe('UnauthorizedError', () => {
    it('should use default message when not provided', () => {
      const error = new UnauthorizedError()

      expect(error.message).toBe('Unauthorized')
      expect(error.statusCode).toBe(401)
    })

    it('should use custom message when provided', () => {
      const error = new UnauthorizedError('Invalid credentials')

      expect(error.message).toBe('Invalid credentials')
    })
  })

  describe('ForbiddenError', () => {
    it('should use default message when not provided', () => {
      const error = new ForbiddenError()

      expect(error.message).toBe('Forbidden')
      expect(error.statusCode).toBe(403)
    })
  })

  describe('NotFoundError', () => {
    it('should format message with resource name', () => {
      const error = new NotFoundError('User')

      expect(error.message).toBe('User not found')
      expect(error.statusCode).toBe(404)
    })
  })

  describe('ConflictError', () => {
    it('should create a ConflictError', () => {
      const error = new ConflictError('Resource already exists')

      expect(error.code).toBe(ErrorCode.CONFLICT)
      expect(error.statusCode).toBe(409)
    })
  })

  describe('RateLimitError', () => {
    it('should include retry after in details', () => {
      const error = new RateLimitError(60)

      expect(error.message).toBe('Too many requests')
      expect(error.statusCode).toBe(429)
      expect(error.details).toEqual({ retryAfter: 60 })
    })
  })

  describe('DatabaseError', () => {
    it('should handle original error', () => {
      const originalError = new Error('Connection failed')
      const error = new DatabaseError('Query failed', originalError)

      expect(error.code).toBe(ErrorCode.DATABASE_ERROR)
      expect(error.statusCode).toBe(500)
      expect(error.details).toEqual({
        message: 'Query failed',
        originalError: 'Connection failed',
      })
    })
  })

  describe('ExternalServiceError', () => {
    it('should include service name', () => {
      const error = new ExternalServiceError('Stripe')

      expect(error.message).toBe('External service error: Stripe')
      expect(error.statusCode).toBe(502)
      expect(error.details).toEqual({ service: 'Stripe' })
    })
  })

  describe('PaymentError', () => {
    it('should create a PaymentError', () => {
      const error = new PaymentError('Card declined')

      expect(error.code).toBe(ErrorCode.PAYMENT_FAILED)
      expect(error.statusCode).toBe(400)
    })
  })
})

describe('Error Utilities', () => {
  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      const error = new ValidationError('Test')
      expect(isAppError(error)).toBe(true)
    })

    it('should return false for non-AppError instances', () => {
      const error = new Error('Test')
      expect(isAppError(error)).toBe(false)
    })

    it('should return false for non-error values', () => {
      expect(isAppError(null)).toBe(false)
      expect(isAppError(undefined)).toBe(false)
      expect(isAppError('string')).toBe(false)
      expect(isAppError(123)).toBe(false)
    })
  })

  describe('handleError', () => {
    it('should handle AppError instances', () => {
      const error = new ValidationError('Invalid data', { field: 'test' })
      const result = handleError(error)

      expect(result.statusCode).toBe(400)
      expect(result.body).toEqual({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid data',
          details: { field: 'test' },
        },
      })
    })

    it('should handle Zod errors', () => {
      const zodError = {
        name: 'ZodError',
        errors: [
          { path: ['email'], message: 'Invalid email' },
          { path: ['name'], message: 'Required' },
        ],
      }

      const result = handleError(zodError)

      expect(result.statusCode).toBe(400)
      expect(result.body).toEqual({
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
          details: zodError.errors,
        },
      })
    })

    it('should handle Stripe errors', () => {
      const stripeError = {
        type: 'StripeCardError',
        message: 'Your card was declined',
      }

      const result = handleError(stripeError)

      expect(result.statusCode).toBe(400)
      expect(result.body).toEqual({
        error: {
          code: ErrorCode.PAYMENT_FAILED,
          message: 'Your card was declined',
        },
      })
    })

    it('should handle unknown errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const error = { unknown: 'error' }

      const result = handleError(error)

      expect(result.statusCode).toBe(500)
      expect(result.body).toEqual({
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'An unexpected error occurred',
        },
      })
      expect(consoleSpy).toHaveBeenCalledWith('Unexpected error:', error)

      consoleSpy.mockRestore()
    })
  })
})