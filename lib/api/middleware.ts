import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { db } from '@/lib/db/client'
import { apiKeys } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { UnauthorizedError, DatabaseError } from '@/lib/errors'
import { logger, generateRequestId } from '@/lib/logger'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/response'
import { withRedisCache, checkRateLimit as checkRedisRateLimit, CacheKeys } from '@/lib/redis/client'

export interface ApiContext {
  merchantId: string
  apiKeyId: string
  requestId: string
  environment: 'live' | 'test'
}

// Fallback rate limiting store for when Redis is unavailable
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export async function validateApiKey(
  request: NextRequest
): Promise<{ valid: boolean; context?: ApiContext; error?: Error }> {
  const apiKey = request.headers.get('x-api-key')
  const requestId = generateRequestId()
  
  if (!apiKey) {
    return { 
      valid: false, 
      error: new UnauthorizedError('Missing API key header')
    }
  }
  
  // API keys are in format: tab_live_xxxxxx or tab_test_xxxxxx
  const keyPattern = /^tab_(live|test)_[a-zA-Z0-9]{32}$/
  const match = apiKey.match(keyPattern)
  
  if (!match) {
    return { 
      valid: false, 
      error: new UnauthorizedError('Invalid API key format')
    }
  }

  const environment = match[1] as 'live' | 'test'
  
  // Hash the API key
  const keyHash = createHash('sha256').update(apiKey).digest('hex')
  const keyPrefix = apiKey.substring(0, 8)
  
  try {
    // Try to get API key from cache first
    const apiKeyRecord = await withRedisCache(
      CacheKeys.apiKey(keyHash),
      async () => {
        // Find the API key
        return await db.query.apiKeys.findFirst({
          where: and(
            eq(apiKeys.keyHash, keyHash),
            eq(apiKeys.keyPrefix, keyPrefix),
            eq(apiKeys.isActive, true)
          ),
          with: {
            merchant: true,
          },
        })
      },
      300 // Cache for 5 minutes
    )
    
    if (!apiKeyRecord) {
      logger.warn('Invalid API key attempt', { 
        keyPrefix, 
        requestId,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      })
      return { 
        valid: false, 
        error: new UnauthorizedError('Invalid API key')
      }
    }
    
    // Update last used timestamp
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKeyRecord.id))
    
    return {
      valid: true,
      context: {
        merchantId: apiKeyRecord.merchantId,
        apiKeyId: apiKeyRecord.id,
        requestId,
        environment,
      },
    }
  } catch (error) {
    logger.error('Database error during API key validation', error as Error, { requestId })
    return { 
      valid: false, 
      error: new DatabaseError('Failed to validate API key', error)
    }
  }
}

// Rate limiting middleware with Redis fallback
export async function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000 // 1 minute
): Promise<{ allowed: boolean; retryAfter?: number }> {
  // Try Redis rate limiting first
  try {
    const allowed = await checkRedisRateLimit(identifier, limit, windowMs)
    
    if (!allowed) {
      return { allowed: false, retryAfter: Math.ceil(windowMs / 1000) }
    }
    
    return { allowed: true }
  } catch (error) {
    // Fallback to in-memory rate limiting if Redis fails
    logger.debug('Falling back to in-memory rate limiting', { identifier })
    
    const now = Date.now()
    const entry = rateLimitStore.get(identifier)

    if (!entry || entry.resetAt < now) {
      rateLimitStore.set(identifier, {
        count: 1,
        resetAt: now + windowMs,
      })
      return { allowed: true }
    }

    if (entry.count >= limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      return { allowed: false, retryAfter }
    }

    entry.count++
    return { allowed: true }
  }
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of Array.from(rateLimitStore.entries())) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Every minute

// Helper to parse JSON body safely with size limit
export async function parseJsonBody<T>(
  request: NextRequest,
  maxSizeBytes: number = 1048576 // 1MB default
): Promise<T> {
  const contentLength = request.headers.get('content-length')
  
  if (contentLength && parseInt(contentLength) > maxSizeBytes) {
    throw new Error(`Request body too large. Max size: ${maxSizeBytes} bytes`)
  }

  try {
    const body = await request.json()
    return body as T
  } catch (error) {
    throw new Error('Invalid JSON in request body')
  }
}

// Security headers middleware
export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com"
  )
  
  // CORS headers for API routes
  const origin = response.headers.get('origin')
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key')
    response.headers.set('Access-Control-Max-Age', '86400')
  }
  
  return response
}

// Check if origin is allowed for CORS
function isAllowedOrigin(origin: string): boolean {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || []
  
  // In development, allow localhost
  if (process.env.NODE_ENV === 'development') {
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return true
    }
  }
  
  return allowedOrigins.includes(origin)
}

// Combined API middleware
export async function withApiAuth(
  request: NextRequest,
  handler: (request: NextRequest, context: ApiContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const startTime = Date.now()
  
  try {
    // Validate API key
    const { valid, context, error } = await validateApiKey(request)
    
    if (!valid || !context) {
      return createErrorResponse(error || new UnauthorizedError())
    }
    
    // Check rate limit
    const { allowed, retryAfter } = await checkRateLimit(
      context.apiKeyId,
      process.env.RATE_LIMIT ? parseInt(process.env.RATE_LIMIT) : 100
    )
    
    if (!allowed) {
      const response = createErrorResponse(
        new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds`)
      )
      response.headers.set('Retry-After', retryAfter!.toString())
      return response
    }
    
    // Log request
    logger.logRequest(request, {
      merchantId: context.merchantId,
      requestId: context.requestId,
      environment: context.environment,
    })
    
    // Execute handler
    const response = await handler(request, context)
    
    // Add security headers
    addSecurityHeaders(response)
    
    // Log response
    const duration = Date.now() - startTime
    logger.logResponse(
      request,
      response.status,
      duration,
      {
        merchantId: context.merchantId,
        requestId: context.requestId,
      }
    )
    
    return response
  } catch (error) {
    const duration = Date.now() - startTime
    logger.logResponse(request, 500, duration)
    return createErrorResponse(error)
  }
}

// Deprecated - for backward compatibility
export function createApiResponse(
  data: any,
  status: number = 200,
  _headers?: HeadersInit
) {
  logger.warn('createApiResponse is deprecated. Use createSuccessResponse instead.', {
    deprecation: 'createApiResponse',
    replacement: 'createSuccessResponse'
  })
  return createSuccessResponse(data, undefined, status)
}

export function createApiError(
  message: string,
  _status: number = 400,
  _code?: string,
  _details?: any
) {
  logger.warn('createApiError is deprecated. Use AppError classes instead.', {
    deprecation: 'createApiError',
    replacement: 'AppError classes'
  })
  return createErrorResponse(new Error(message))
}