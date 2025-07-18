import { NextResponse } from 'next/server'

export interface CacheOptions {
  /**
   * Cache duration in seconds
   * @default 0 (no cache)
   */
  maxAge?: number
  
  /**
   * Serve stale content while revalidating
   * @default false
   */
  staleWhileRevalidate?: number
  
  /**
   * Private cache (user-specific)
   * @default true for authenticated endpoints
   */
  private?: boolean
  
  /**
   * Revalidation time for ISR
   * @default undefined
   */
  revalidate?: number
  
  /**
   * Additional cache tags for invalidation
   * @default []
   */
  tags?: string[]
}

/**
 * Add cache headers to response
 */
export function withCache(response: NextResponse, options: CacheOptions = {}): NextResponse {
  const {
    maxAge = 0,
    staleWhileRevalidate,
    private: isPrivate = true,
    tags = []
  } = options
  
  // Build Cache-Control header
  const cacheControl: string[] = []
  
  if (maxAge === 0) {
    cacheControl.push('no-cache', 'no-store', 'must-revalidate')
  } else {
    cacheControl.push(isPrivate ? 'private' : 'public')
    cacheControl.push(`max-age=${maxAge}`)
    
    if (staleWhileRevalidate) {
      cacheControl.push(`stale-while-revalidate=${staleWhileRevalidate}`)
    }
  }
  
  response.headers.set('Cache-Control', cacheControl.join(', '))
  
  // Add cache tags for invalidation
  if (tags.length > 0) {
    response.headers.set('Cache-Tag', tags.join(', '))
  }
  
  // Add ETag for conditional requests
  // In production, this would be based on content hash
  if (maxAge > 0) {
    const etag = generateETag(response)
    if (etag) {
      response.headers.set('ETag', etag)
    }
  }
  
  return response
}

/**
 * Cache configurations for different endpoint types
 */
export const CacheConfigs = {
  // No cache for mutations
  noCache: { maxAge: 0 },
  
  // Short cache for authenticated list endpoints
  shortPrivate: { 
    maxAge: 30, 
    staleWhileRevalidate: 60,
    private: true 
  },
  
  // Medium cache for authenticated detail endpoints
  mediumPrivate: { 
    maxAge: 300, // 5 minutes
    staleWhileRevalidate: 600,
    private: true 
  },
  
  // Long cache for public endpoints
  publicLong: { 
    maxAge: 300, // 5 minutes
    staleWhileRevalidate: 3600, // 1 hour
    private: false 
  },
  
  // Static assets
  static: { 
    maxAge: 31536000, // 1 year
    private: false 
  }
}

/**
 * Generate ETag from response content
 */
function generateETag(response: NextResponse): string | null {
  try {
    // Get response body if available
    const body = response.body
    if (!body) return null
    
    // For now, use timestamp + size
    // In production, use proper content hash
    const timestamp = Date.now()
    const etag = `"${timestamp}"`
    
    return etag
  } catch {
    return null
  }
}

/**
 * Check if request has valid cache
 */
export function checkConditionalRequest(
  request: Request,
  etag?: string
): { notModified: boolean } {
  if (!etag) return { notModified: false }
  
  const ifNoneMatch = request.headers.get('If-None-Match')
  if (ifNoneMatch && ifNoneMatch === etag) {
    return { notModified: true }
  }
  
  return { notModified: false }
}

/**
 * Create 304 Not Modified response
 */
export function notModifiedResponse(): NextResponse {
  return new NextResponse(null, { status: 304 })
}