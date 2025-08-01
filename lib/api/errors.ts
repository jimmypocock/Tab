export { 
  AppError, 
  ValidationError, 
  UnauthorizedError, 
  ForbiddenError, 
  NotFoundError, 
  ConflictError, 
  RateLimitError, 
  DatabaseError, 
  ExternalServiceError, 
  PaymentError,
  ErrorCode,
  isAppError,
  handleError 
} from '@/lib/errors'

// Alias AppError as ApiError for API routes
export { AppError as ApiError } from '@/lib/errors'