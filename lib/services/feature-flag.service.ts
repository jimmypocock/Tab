/**
 * Feature Flag Service using Upstash Redis
 */

import { Redis } from '@upstash/redis'
import { logger } from '@/lib/logger'

export interface FeatureFlag {
  key: string
  enabled: boolean
  description?: string
  rolloutPercentage?: number // 0-100
  enabledForOrgs?: string[] // Specific org IDs
  enabledForUsers?: string[] // Specific user IDs
  metadata?: Record<string, any>
}

export interface FeatureFlagContext {
  organizationId?: string
  userId?: string
  email?: string
  // Add other context as needed
}

export class FeatureFlagService {
  private readonly REDIS_PREFIX = 'feature-flags:'
  private cache: Map<string, FeatureFlag> = new Map()
  private lastSync: number = 0
  private readonly CACHE_TTL = 60 * 1000 // 1 minute

  constructor(private redis: Redis) {}

  /**
   * Check if a feature is enabled
   */
  async isEnabled(key: string, context?: FeatureFlagContext): Promise<boolean> {
    try {
      const flag = await this.getFlag(key)
      
      if (!flag) {
        return false
      }

      // If globally disabled, return false
      if (!flag.enabled) {
        return false
      }

      // Check organization-specific enablement
      if (flag.enabledForOrgs && context?.organizationId) {
        return flag.enabledForOrgs.includes(context.organizationId)
      }

      // Check user-specific enablement
      if (flag.enabledForUsers && context?.userId) {
        return flag.enabledForUsers.includes(context.userId)
      }

      // Check rollout percentage
      if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
        return this.isInRolloutPercentage(
          flag.rolloutPercentage,
          context?.userId || context?.organizationId || 'anonymous'
        )
      }

      return true
    } catch (error) {
      logger.error('Failed to check feature flag', error as Error, { key })
      // Default to false on error
      return false
    }
  }

  /**
   * Get all feature flags
   */
  async getAllFlags(): Promise<FeatureFlag[]> {
    await this.syncCache()
    return Array.from(this.cache.values())
  }

  /**
   * Get a specific feature flag
   */
  async getFlag(key: string): Promise<FeatureFlag | null> {
    await this.syncCache()
    return this.cache.get(key) || null
  }

  /**
   * Set a feature flag
   */
  async setFlag(flag: FeatureFlag): Promise<void> {
    await this.redis.hset(this.REDIS_PREFIX + 'flags', {
      [flag.key]: JSON.stringify(flag)
    })
    
    // Update cache
    this.cache.set(flag.key, flag)
    
    logger.info('Feature flag updated', { key: flag.key, enabled: flag.enabled })
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(key: string): Promise<void> {
    await this.redis.hdel(this.REDIS_PREFIX + 'flags', key)
    this.cache.delete(key)
    
    logger.info('Feature flag deleted', { key })
  }

  /**
   * Sync cache with Redis
   */
  private async syncCache(): Promise<void> {
    const now = Date.now()
    
    // Check if cache is still valid
    if (now - this.lastSync < this.CACHE_TTL) {
      return
    }

    try {
      const flags = await this.redis.hgetall<Record<string, string>>(
        this.REDIS_PREFIX + 'flags'
      )

      this.cache.clear()
      
      if (flags) {
        Object.entries(flags).forEach(([key, value]) => {
          try {
            const flag = JSON.parse(value) as FeatureFlag
            this.cache.set(key, flag)
          } catch (error) {
            logger.error('Failed to parse feature flag', error as Error, { key })
          }
        })
      }

      this.lastSync = now
    } catch (error) {
      logger.error('Failed to sync feature flags', error as Error)
    }
  }

  /**
   * Check if a user/org is in the rollout percentage
   */
  private isInRolloutPercentage(percentage: number, identifier: string): boolean {
    // Simple hash-based rollout
    let hash = 0
    for (let i = 0; i < identifier.length; i++) {
      const char = identifier.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    const userPercentage = Math.abs(hash) % 100
    return userPercentage < percentage
  }

  /**
   * Common feature flags
   */
  static readonly FLAGS = {
    USE_NEW_PAYMENT_FLOW: 'use-new-payment-flow',
    ENABLE_BILLING_GROUPS: 'enable-billing-groups',
    USE_DI_PATTERN: 'use-di-pattern',
    ENABLE_CORPORATE_ACCOUNTS: 'enable-corporate-accounts',
    USE_ENHANCED_LOGGING: 'use-enhanced-logging',
    ENABLE_WEBHOOKS_V2: 'enable-webhooks-v2',
  } as const
}

/**
 * Helper to check feature flags in routes
 */
export async function checkFeatureFlag(
  flagService: FeatureFlagService,
  flag: string,
  context?: FeatureFlagContext
): Promise<boolean> {
  return flagService.isEnabled(flag, context)
}