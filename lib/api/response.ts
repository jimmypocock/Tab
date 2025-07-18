import { NextResponse } from 'next/server'
import { handleError, isAppError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { withCache, CacheOptions } from './cache'

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    page?: number
    limit?: number
    total?: number
    [key: string]: any
  }
}

export function createSuccessResponse<T>(
  data: T,
  meta?: ApiResponse['meta'],
  statusCode: number = 200,
  cacheOptions?: CacheOptions
): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    data,
  }

  if (meta) {
    response.meta = meta
  }

  const nextResponse = NextResponse.json(response, { status: statusCode })
  
  // Apply caching if options provided
  if (cacheOptions) {
    return withCache(nextResponse, cacheOptions) as NextResponse<ApiResponse<T>>
  }
  
  return nextResponse as NextResponse<ApiResponse<T>>
}

export function createErrorResponse(
  error: unknown,
  requestContext?: any
): NextResponse<ApiResponse> {
  const { statusCode, body } = handleError(error)

  // Log error with context
  if (isAppError(error)) {
    logger.error(error.message, error, requestContext)
  } else if (error instanceof Error) {
    logger.error('Unhandled error', error, requestContext)
  } else {
    logger.error('Unknown error', undefined, { error, ...requestContext })
  }

  return NextResponse.json(body, { status: statusCode })
}

// Wrapper for API route handlers with error handling
export function withErrorHandler<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse<R>>
) {
  return async (...args: T): Promise<NextResponse<ApiResponse<R>>> => {
    try {
      return await handler(...args) as NextResponse<ApiResponse<R>>
    } catch (error) {
      return createErrorResponse(error)
    }
  }
}

// Type-safe API response builder
export class ApiResponseBuilder<T> {
  private data?: T
  private meta?: ApiResponse['meta']
  private statusCode: number = 200
  private cacheOptions?: CacheOptions

  setData(data: T): this {
    this.data = data
    return this
  }

  setMeta(meta: ApiResponse['meta']): this {
    this.meta = meta
    return this
  }

  setStatusCode(code: number): this {
    this.statusCode = code
    return this
  }

  setPagination(page: number, limit: number, total: number): this {
    this.meta = {
      ...this.meta,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }
    return this
  }
  
  setCache(options: CacheOptions): this {
    this.cacheOptions = options
    return this
  }

  build(): NextResponse<ApiResponse<T>> {
    if (!this.data) {
      throw new Error('Data is required for success response')
    }
    return createSuccessResponse(this.data, this.meta, this.statusCode, this.cacheOptions)
  }
}