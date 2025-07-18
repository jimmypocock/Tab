import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { logger } from '@/lib/logger'

// Redis client singleton
let redisClient: Redis | null = null
let ratelimitClient: Ratelimit | null = null

/**
 * Get Redis client instance
 * Uses Upstash Redis for serverless compatibility
 */
export function getRedisClient(): Redis | null {
  // Skip Redis in test environment
  if (process.env.NODE_ENV === 'test') {
    return null
  }

  if (!redisClient) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!redisUrl || !redisToken) {
      logger.warn('Redis credentials not configured. Caching disabled.')
      return null
    }

    try {
      redisClient = new Redis({
        url: redisUrl,
        token: redisToken,
      })
      
      logger.info('Redis client initialized')
    } catch (error) {
      logger.error('Failed to initialize Redis client', error as Error)
      return null
    }
  }

  return redisClient
}

/**
 * Get rate limit client
 */
export function getRateLimitClient(): Ratelimit | null {
  if (!ratelimitClient) {
    const redis = getRedisClient()
    if (!redis) {
      return null
    }

    ratelimitClient = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'), // Default: 100 requests per minute
      analytics: true,
      prefix: 'ratelimit',
    })
  }

  return ratelimitClient
}

/**
 * Cache wrapper for API responses
 */
export async function withRedisCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number // Time to live in seconds
    tags?: string[] // Cache tags for invalidation
  } = {}
): Promise<T> {
  const redis = getRedisClient()
  
  // If Redis is not available, just execute the fetcher
  if (!redis) {
    return fetcher()
  }

  const { ttl = 300, tags = [] } = options // Default 5 minutes

  try {
    // Try to get from cache
    const cached = await redis.get(key)
    if (cached) {
      logger.debug('Cache hit', { key })
      return cached as T
    }

    // Cache miss - fetch data
    logger.debug('Cache miss', { key })
    const data = await fetcher()

    // Store in cache with TTL
    if (ttl > 0) {
      await redis.setex(key, ttl, JSON.stringify(data))
      
      // Store tags for invalidation
      if (tags.length > 0) {
        for (const tag of tags) {
          await redis.sadd(`tag:${tag}`, key)
          await redis.expire(`tag:${tag}`, ttl)
        }
      }
    }

    return data
  } catch (error) {
    logger.error('Redis cache error', error as Error, { key })
    // On error, just execute the fetcher
    return fetcher()
  }
}

/**
 * Invalidate cache by key pattern or tags
 */
export async function invalidateCache(
  options: {
    keys?: string[]
    patterns?: string[]
    tags?: string[]
  }
): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return

  try {
    // Invalidate specific keys
    if (options.keys && options.keys.length > 0) {
      await redis.del(...options.keys)
    }

    // Invalidate by pattern
    if (options.patterns && options.patterns.length > 0) {
      for (const pattern of options.patterns) {
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
          await redis.del(...keys)
        }
      }
    }

    // Invalidate by tags
    if (options.tags && options.tags.length > 0) {
      for (const tag of options.tags) {
        const keys = await redis.smembers(`tag:${tag}`)
        if (keys.length > 0) {
          await redis.del(...keys)
          await redis.del(`tag:${tag}`)
        }
      }
    }

    logger.debug('Cache invalidated', options)
  } catch (error) {
    logger.error('Cache invalidation error', error as Error, options)
  }
}

/**
 * Rate limit by key (e.g., API key, IP address)
 */
export async function checkRateLimit(
  identifier: string,
  options: {
    requests?: number
    window?: string
  } = {}
): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: Date
}> {
  const ratelimit = getRateLimitClient()
  
  // If rate limiting is not available, allow all requests
  if (!ratelimit) {
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: new Date(),
    }
  }

  const { requests = 100, window = '1 m' } = options

  // Create a custom rate limiter if needed
  const limiter = requests === 100 && window === '1 m' 
    ? ratelimit 
    : new Ratelimit({
        redis: getRedisClient()!,
        limiter: Ratelimit.slidingWindow(requests, window as any),
        prefix: `ratelimit:custom:${requests}:${window}`,
      })

  const result = await limiter.limit(identifier)

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: new Date(result.reset),
  }
}

/**
 * Cache key builders
 */
export const CacheKeys = {
  // Tab cache keys
  tab: (id: string) => `tab:${id}`,
  tabList: (merchantId: string, params: any) => 
    `tabs:${merchantId}:${JSON.stringify(params)}`,
  
  // Payment cache keys
  payment: (id: string) => `payment:${id}`,
  paymentsByTab: (tabId: string) => `payments:tab:${tabId}`,
  
  // API key validation cache
  apiKey: (keyHash: string) => `apikey:${keyHash}`,
  
  // Public endpoints
  publicTab: (id: string) => `public:tab:${id}`,
} as const

/**
 * Cache tags for invalidation
 */
export const CacheTags = {
  tab: (id: string) => `tab:${id}`,
  merchant: (id: string) => `merchant:${id}`,
  apiKey: (id: string) => `apikey:${id}`,
} as const