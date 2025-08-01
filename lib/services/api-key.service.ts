import { db } from '@/lib/db'
import { apiKeys, organizationUsers } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { generateApiKey, hashApiKey } from '@/lib/utils/api-keys'
import { DatabaseError, UnauthorizedError, ValidationError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export interface CreateApiKeyData {
  name: string
  scope?: 'merchant' | 'corporate' | 'full'
  permissions?: Record<string, any>
  environment?: 'test' | 'live'
}

export interface UpdateApiKeyData {
  name?: string
  isActive?: boolean
  permissions?: Record<string, any>
}

export interface ApiKeyWithMetadata {
  id: string
  name: string | null
  keyPrefix: string
  scope: string | null
  permissions: Record<string, any>
  isActive: boolean
  lastUsedAt: Date | null
  createdAt: Date
  revokedAt: Date | null
  usageCount: number
}

export class ApiKeyService {
  /**
   * Get all API keys for an organization
   */
  static async getOrganizationApiKeys(
    organizationId: string,
    userId: string
  ): Promise<ApiKeyWithMetadata[]> {
    try {
      // Verify user has access to this organization
      const userAccess = await db.query.organizationUsers.findFirst({
        where: and(
          eq(organizationUsers.organizationId, organizationId),
          eq(organizationUsers.userId, userId),
          eq(organizationUsers.status, 'active')
        ),
      })

      if (!userAccess) {
        throw new UnauthorizedError('You do not have access to this organization')
      }

      // Get API keys
      const keys = await db.query.apiKeys.findMany({
        where: eq(apiKeys.organizationId, organizationId),
        orderBy: [desc(apiKeys.createdAt)],
      })

      return keys.map(key => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        scope: key.scope,
        permissions: (key.permissions as Record<string, any>) || {},
        isActive: key.isActive,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt,
        revokedAt: key.revokedAt,
        usageCount: 0, // TODO: Implement usage tracking
      }))
    } catch (error) {
      logger.error('Failed to get organization API keys', error as Error, {
        organizationId,
        userId,
      })
      throw new DatabaseError('Failed to retrieve API keys', error)
    }
  }

  /**
   * Create a new API key for an organization
   */
  static async createApiKey(
    organizationId: string,
    userId: string,
    data: CreateApiKeyData
  ): Promise<{ apiKey: ApiKeyWithMetadata; key: string }> {
    try {
      // Verify user has admin access to this organization
      const userAccess = await db.query.organizationUsers.findFirst({
        where: and(
          eq(organizationUsers.organizationId, organizationId),
          eq(organizationUsers.userId, userId),
          eq(organizationUsers.status, 'active')
        ),
      })

      if (!userAccess || !['owner', 'admin'].includes(userAccess.role)) {
        throw new UnauthorizedError('You do not have permission to create API keys')
      }

      // Validate input
      if (!data.name || data.name.trim().length === 0) {
        throw new ValidationError('API key name is required')
      }

      if (data.name.length > 100) {
        throw new ValidationError('API key name must be less than 100 characters')
      }

      // Generate the API key
      const environment = data.environment || 'test'
      const key = generateApiKey('org', environment)
      const keyHash = await hashApiKey(key)
      const keyPrefix = key.substring(0, 12) // e.g., "org_test_ABC"

      // Create the API key record
      const [newApiKey] = await db
        .insert(apiKeys)
        .values({
          organizationId,
          keyHash,
          keyPrefix,
          name: data.name.trim(),
          scope: data.scope || 'merchant',
          permissions: data.permissions || {},
          createdBy: userId,
          isActive: true,
        })
        .returning()

      logger.info('API key created', {
        organizationId,
        userId,
        keyId: newApiKey.id,
        keyPrefix: newApiKey.keyPrefix,
      })

      return {
        apiKey: {
          id: newApiKey.id,
          name: newApiKey.name,
          keyPrefix: newApiKey.keyPrefix,
          scope: newApiKey.scope,
          permissions: (newApiKey.permissions as Record<string, any>) || {},
          isActive: newApiKey.isActive,
          lastUsedAt: newApiKey.lastUsedAt,
          createdAt: newApiKey.createdAt,
          revokedAt: newApiKey.revokedAt,
          usageCount: 0,
        },
        key, // Return the plain key only on creation
      }
    } catch (error) {
      logger.error('Failed to create API key', error as Error, {
        organizationId,
        userId,
        keyName: data.name,
      })
      
      if (error instanceof UnauthorizedError || error instanceof ValidationError) {
        throw error
      }
      
      throw new DatabaseError('Failed to create API key', error)
    }
  }

  /**
   * Update an API key
   */
  static async updateApiKey(
    keyId: string,
    organizationId: string,
    userId: string,
    data: UpdateApiKeyData
  ): Promise<ApiKeyWithMetadata> {
    try {
      // Verify user has admin access to this organization
      const userAccess = await db.query.organizationUsers.findFirst({
        where: and(
          eq(organizationUsers.organizationId, organizationId),
          eq(organizationUsers.userId, userId),
          eq(organizationUsers.status, 'active')
        ),
      })

      if (!userAccess || !['owner', 'admin'].includes(userAccess.role)) {
        throw new UnauthorizedError('You do not have permission to update API keys')
      }

      // Verify the API key belongs to this organization
      const existingKey = await db.query.apiKeys.findFirst({
        where: and(
          eq(apiKeys.id, keyId),
          eq(apiKeys.organizationId, organizationId)
        ),
      })

      if (!existingKey) {
        throw new ValidationError('API key not found')
      }

      // Validate input
      if (data.name !== undefined && data.name.trim().length === 0) {
        throw new ValidationError('API key name cannot be empty')
      }

      if (data.name && data.name.length > 100) {
        throw new ValidationError('API key name must be less than 100 characters')
      }

      // Update the API key
      const updateData: any = {}
      if (data.name !== undefined) updateData.name = data.name.trim()
      if (data.isActive !== undefined) updateData.isActive = data.isActive
      if (data.permissions !== undefined) updateData.permissions = data.permissions

      // If deactivating, set revokedAt
      if (data.isActive === false && existingKey.isActive) {
        updateData.revokedAt = new Date()
      }
      // If reactivating, clear revokedAt
      if (data.isActive === true && !existingKey.isActive) {
        updateData.revokedAt = null
      }

      const [updatedKey] = await db
        .update(apiKeys)
        .set(updateData)
        .where(eq(apiKeys.id, keyId))
        .returning()

      logger.info('API key updated', {
        organizationId,
        userId,
        keyId,
        changes: Object.keys(updateData),
      })

      return {
        id: updatedKey.id,
        name: updatedKey.name,
        keyPrefix: updatedKey.keyPrefix,
        scope: updatedKey.scope,
        permissions: (updatedKey.permissions as Record<string, any>) || {},
        isActive: updatedKey.isActive,
        lastUsedAt: updatedKey.lastUsedAt,
        createdAt: updatedKey.createdAt,
        revokedAt: updatedKey.revokedAt,
        usageCount: 0,
      }
    } catch (error) {
      logger.error('Failed to update API key', error as Error, {
        organizationId,
        userId,
        keyId,
      })
      
      if (error instanceof UnauthorizedError || error instanceof ValidationError) {
        throw error
      }
      
      throw new DatabaseError('Failed to update API key', error)
    }
  }

  /**
   * Delete/revoke an API key
   */
  static async revokeApiKey(
    keyId: string,
    organizationId: string,
    userId: string
  ): Promise<void> {
    try {
      // Verify user has admin access to this organization
      const userAccess = await db.query.organizationUsers.findFirst({
        where: and(
          eq(organizationUsers.organizationId, organizationId),
          eq(organizationUsers.userId, userId),
          eq(organizationUsers.status, 'active')
        ),
      })

      if (!userAccess || !['owner', 'admin'].includes(userAccess.role)) {
        throw new UnauthorizedError('You do not have permission to revoke API keys')
      }

      // Verify the API key belongs to this organization
      const existingKey = await db.query.apiKeys.findFirst({
        where: and(
          eq(apiKeys.id, keyId),
          eq(apiKeys.organizationId, organizationId)
        ),
      })

      if (!existingKey) {
        throw new ValidationError('API key not found')
      }

      // Revoke the API key (we don't delete, just deactivate)
      await db
        .update(apiKeys)
        .set({
          isActive: false,
          revokedAt: new Date(),
        })
        .where(eq(apiKeys.id, keyId))

      logger.info('API key revoked', {
        organizationId,
        userId,
        keyId,
        keyPrefix: existingKey.keyPrefix,
      })
    } catch (error) {
      logger.error('Failed to revoke API key', error as Error, {
        organizationId,
        userId,
        keyId,
      })
      
      if (error instanceof UnauthorizedError || error instanceof ValidationError) {
        throw error
      }
      
      throw new DatabaseError('Failed to revoke API key', error)
    }
  }

  /**
   * Get API key by prefix (for usage tracking)
   */
  static async getApiKeyByPrefix(keyPrefix: string): Promise<any> {
    try {
      return await db.query.apiKeys.findFirst({
        where: and(
          eq(apiKeys.keyPrefix, keyPrefix),
          eq(apiKeys.isActive, true)
        ),
        with: {
          organization: true,
        },
      })
    } catch (error) {
      logger.error('Failed to get API key by prefix', error as Error, {
        keyPrefix,
      })
      throw new DatabaseError('Failed to retrieve API key', error)
    }
  }

  /**
   * Update last used timestamp for an API key
   */
  static async updateLastUsed(keyId: string): Promise<void> {
    try {
      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, keyId))
    } catch (error) {
      // Don't throw on this - it's not critical
      logger.warn('Failed to update API key last used timestamp', {
        keyId,
        error: (error as Error).message,
      })
    }
  }
}