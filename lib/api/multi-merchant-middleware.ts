import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { db } from '@/lib/db/client'
import { apiKeys, merchantUsers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { UnauthorizedError } from '@/lib/errors'
import { logger, generateRequestId } from '@/lib/logger'
import { UserMerchantService } from '@/lib/services/user-merchant.service'

export interface ApiContext {
  merchantId: string
  apiKeyId: string
  requestId: string
  environment: 'live' | 'test'
}

export interface DashboardContext {
  userId: string
  currentMerchantId: string
  userRole: string
  requestId: string
  permissions: Record<string, any>
}

/**
 * API Authentication Middleware (for API endpoints)
 * Validates API keys and provides merchant context
 */
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
  
  try {
    // Look up the API key in the database
    const result = await db
      .select({
        id: apiKeys.id,
        merchantId: apiKeys.merchantId,
        isActive: apiKeys.isActive,
      })
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.keyHash, keyHash),
          eq(apiKeys.isActive, true)
        )
      )
      .limit(1)

    if (result.length === 0) {
      return { 
        valid: false, 
        error: new UnauthorizedError('Invalid API key')
      }
    }

    const apiKeyData = result[0]

    // Update last used timestamp
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKeyData.id))

    logger.info('API key validated', {
      requestId,
      merchantId: apiKeyData.merchantId,
      environment,
    })

    return {
      valid: true,
      context: {
        merchantId: apiKeyData.merchantId,
        apiKeyId: apiKeyData.id,
        requestId,
        environment,
      }
    }
  } catch (error) {
    logger.error('Error validating API key', { error, requestId })
    return { 
      valid: false, 
      error: new Error('Internal server error during authentication')
    }
  }
}

/**
 * Dashboard Authentication Middleware (for dashboard routes)
 * Validates Supabase auth and provides user/merchant context
 */
export async function validateDashboardAuth(
  request: NextRequest,
  userId: string,
  merchantIdParam?: string
): Promise<{ valid: boolean; context?: DashboardContext; error?: Error }> {
  const requestId = generateRequestId()
  
  try {
    // Get user's merchants
    const userMerchants = await UserMerchantService.getUserMerchants(userId)
    
    if (userMerchants.length === 0) {
      return {
        valid: false,
        error: new UnauthorizedError('User has no access to any merchants')
      }
    }

    // Determine current merchant
    let currentMerchantId: string
    let userRole: string

    if (merchantIdParam) {
      // Specific merchant requested - verify access
      const access = await UserMerchantService.checkUserMerchantAccess(userId, merchantIdParam)
      if (!access.hasAccess) {
        return {
          valid: false,
          error: new UnauthorizedError('User does not have access to this merchant')
        }
      }
      currentMerchantId = merchantIdParam
      userRole = access.userRole!
    } else {
      // Use user's session merchant or default to first merchant
      const session = await UserMerchantService.getUserSession(userId)
      
      if (session.currentMerchantId) {
        // Verify access to session merchant
        const access = await UserMerchantService.checkUserMerchantAccess(userId, session.currentMerchantId)
        if (access.hasAccess) {
          currentMerchantId = session.currentMerchantId
          userRole = access.userRole!
        } else {
          // Session merchant no longer valid, use first available
          currentMerchantId = userMerchants[0].merchantId
          userRole = userMerchants[0].role
          // Update session
          await UserMerchantService.switchMerchantContext(userId, currentMerchantId)
        }
      } else {
        // No session merchant, use first available
        currentMerchantId = userMerchants[0].merchantId
        userRole = userMerchants[0].role
        // Update session
        await UserMerchantService.switchMerchantContext(userId, currentMerchantId)
      }
    }

    // Get user permissions for this role
    const permissions = UserMerchantService.getRolePermissions(userRole as any)

    logger.info('Dashboard auth validated', {
      requestId,
      userId,
      currentMerchantId,
      userRole,
    })

    return {
      valid: true,
      context: {
        userId,
        currentMerchantId,
        userRole,
        requestId,
        permissions,
      }
    }
  } catch (error) {
    logger.error('Error validating dashboard auth', { error, requestId, userId })
    return {
      valid: false,
      error: new Error('Internal server error during authentication')
    }
  }
}

/**
 * API Middleware wrapper for API endpoints
 */
export function withApiAuth<T extends any[]>(
  handler: (request: NextRequest, context: ApiContext, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const validation = await validateApiKey(request)
    
    if (!validation.valid || !validation.context) {
      logger.warn('API authentication failed', {
        error: validation.error?.message,
        url: request.url,
      })
      
      return NextResponse.json(
        { error: validation.error?.message || 'Authentication failed' },
        { status: 401 }
      )
    }

    try {
      return await handler(request, validation.context, ...args)
    } catch (error) {
      logger.error('API handler error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: validation.context.requestId,
        merchantId: validation.context.merchantId,
      })

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Dashboard Middleware wrapper for dashboard routes  
 */
export function withDashboardAuth<T extends any[]>(
  handler: (request: NextRequest, context: DashboardContext, ...args: T) => Promise<Response>,
  requiredRole?: string
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    // This would integrate with your Supabase auth
    // For now, assuming userId is passed in somehow (e.g., from session)
    const userId = request.headers.get('x-user-id') // Placeholder - implement proper session handling
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Extract merchant ID from URL or headers if needed
    const merchantId = request.headers.get('x-merchant-id') || undefined

    const validation = await validateDashboardAuth(request, userId, merchantId)
    
    if (!validation.valid || !validation.context) {
      logger.warn('Dashboard authentication failed', {
        error: validation.error?.message,
        userId,
        url: request.url,
      })
      
      return NextResponse.json(
        { error: validation.error?.message || 'Authentication failed' },
        { status: 401 }
      )
    }

    // Check role permission if required
    if (requiredRole) {
      const hasPermission = UserMerchantService.getRolePermissions(validation.context.userRole as any)
      // Add specific permission checking logic based on your needs
    }

    try {
      return await handler(request, validation.context, ...args)
    } catch (error) {
      logger.error('Dashboard handler error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: validation.context.requestId,
        userId: validation.context.userId,
        merchantId: validation.context.currentMerchantId,
      })

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Multi-merchant API endpoint - allows specifying merchant via header or endpoint
 */
export function withMultiMerchantApiAuth<T extends any[]>(
  handler: (request: NextRequest, context: ApiContext, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    // First try API key authentication
    const apiValidation = await validateApiKey(request)
    
    if (apiValidation.valid && apiValidation.context) {
      return await handler(request, apiValidation.context, ...args)
    }

    // If API key fails, could also support user+merchant auth for dashboard API calls
    // This would be useful for multi-merchant dashboard functionality
    
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    )
  }
}