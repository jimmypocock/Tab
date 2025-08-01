/**
 * API Key Repository
 */

import { eq, and, desc } from 'drizzle-orm'
import { apiKeys } from '@/lib/db/schema'
import { BaseRepository } from './base.repository'
import { hashApiKey } from '@/lib/utils/api-keys'

export interface ApiKeyWithOrganization {
  id: string
  organizationId: string
  name: string
  lastFour: string
  environment: 'test' | 'live'
  scope: string
  isActive: boolean
  lastUsedAt: Date | null
  usageCount: number
  createdAt: Date
  organization?: any
}

export class ApiKeyRepository extends BaseRepository {
  readonly name = 'ApiKeyRepository'

  async findMany(organizationId: string) {
    return this.db.query.apiKeys.findMany({
      where: eq(apiKeys.organizationId, organizationId),
      orderBy: desc(apiKeys.createdAt),
    })
  }

  async findById(id: string, organizationId: string) {
    return this.db.query.apiKeys.findFirst({
      where: and(
        eq(apiKeys.id, id),
        eq(apiKeys.organizationId, organizationId)
      )
    })
  }

  async findByKeyHash(keyHash: string): Promise<ApiKeyWithOrganization | null> {
    return this.db.query.apiKeys.findFirst({
      where: eq(apiKeys.keyHash, keyHash),
      with: {
        organization: true
      }
    })
  }

  async create(data: {
    organizationId: string
    name: string
    environment: 'test' | 'live'
    scope: string
  }): Promise<{ apiKey: ApiKeyWithOrganization; plainTextKey: string }> {
    // Generate the actual key
    const prefix = data.environment === 'live' ? 'tab_live_' : 'tab_test_'
    const randomPart = this.generateSecureToken(32)
    const plainTextKey = prefix + randomPart
    
    // Hash the key for storage
    const keyHash = await hashApiKey(plainTextKey)
    const lastFour = plainTextKey.slice(-4)
    
    const [apiKey] = await this.db.insert(apiKeys)
      .values({
        ...data,
        keyHash,
        lastFour,
        isActive: true,
      })
      .returning()
    
    return {
      apiKey,
      plainTextKey, // Only returned on creation
    }
  }

  async update(id: string, organizationId: string, updates: Partial<ApiKeyWithOrganization>) {
    const [updated] = await this.db
      .update(apiKeys)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(apiKeys.id, id),
        eq(apiKeys.organizationId, organizationId)
      ))
      .returning()
    
    return updated
  }

  async deactivate(id: string, organizationId: string) {
    return this.update(id, organizationId, { isActive: false })
  }

  async recordUsage(id: string) {
    const key = await this.db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, id)
    })
    
    if (!key) return null
    
    return this.db
      .update(apiKeys)
      .set({
        lastUsedAt: new Date(),
        usageCount: (key.usageCount || 0) + 1,
      })
      .where(eq(apiKeys.id, id))
      .returning()
  }

  async validateApiKey(plainTextKey: string): Promise<ApiKeyWithOrganization | null> {
    const keyHash = await hashApiKey(plainTextKey)
    const apiKey = await this.findByKeyHash(keyHash)
    
    if (!apiKey || !apiKey.isActive) {
      return null
    }
    
    // Record usage asynchronously
    this.recordUsage(apiKey.id).catch(err => {
      this.log('Failed to record API key usage', err)
    })
    
    return apiKey
  }

  private generateSecureToken(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    const values = new Uint8Array(length)
    
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(values)
    } else {
      // Node.js environment
      const crypto = require('crypto')
      crypto.randomFillSync(values)
    }
    
    for (let i = 0; i < length; i++) {
      token += chars[values[i] % chars.length]
    }
    
    return token
  }
}