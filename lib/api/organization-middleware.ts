import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { apiKeys, organizations } from '@/lib/db/schema'
import { hashApiKey } from '@/lib/utils/api-keys'
import { AppError, NotFoundError, UnauthorizedError, ForbiddenError, handleError } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { OrganizationService } from '@/lib/services/organization.service'

export interface OrganizationContext {
  organizationId: string
  organization: {
    id: string
    name: string
    isMerchant: boolean
    isCorporate: boolean
  }
  scope: 'merchant' | 'corporate' | 'full'
  authType: 'apiKey' | 'dashboard'
  userId?: string
  userRole?: 'owner' | 'admin' | 'member' | 'viewer'
}

/**
 * Middleware to handle organization-based authentication
 * Supports both API key authentication and dashboard (Supabase) authentication
 */
export async function withOrganizationAuth(
  request: NextRequest,
  handler: (request: NextRequest, context: OrganizationContext) => Promise<NextResponse>,
  options: {
    requiredScope?: 'merchant' | 'corporate' | 'full'
    requiredRole?: 'owner' | 'admin' | 'member' | 'viewer'
    allowApiKey?: boolean
    allowDashboard?: boolean
  } = {}
) {
  const {
    requiredScope,
    requiredRole = 'member',
    allowApiKey = true,
    allowDashboard = true
  } = options

  try {
    let context: OrganizationContext | null = null

    // Try API key authentication first
    if (allowApiKey) {
      const apiKey = request.headers.get('x-api-key')
      if (apiKey) {
        context = await authenticateWithApiKey(apiKey)
      }
    }

    // Try dashboard authentication if no API key
    if (!context && allowDashboard) {
      context = await authenticateWithDashboard(request, requiredRole)
    }

    // No valid authentication found
    if (!context) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check scope requirements
    if (requiredScope) {
      if (requiredScope === 'merchant' && !context.organization.isMerchant) {
        return NextResponse.json(
          { error: 'Organization does not have merchant capability' },
          { status: 403 }
        )
      }
      if (requiredScope === 'corporate' && !context.organization.isCorporate) {
        return NextResponse.json(
          { error: 'Organization does not have corporate capability' },
          { status: 403 }
        )
      }
      if (context.scope !== 'full' && context.scope !== requiredScope) {
        return NextResponse.json(
          { error: `API key does not have ${requiredScope} scope` },
          { status: 403 }
        )
      }
    }

    // Check role requirements (only for dashboard auth)
    if (context.authType === 'dashboard' && requiredRole && context.userRole) {
      const hasAccess = OrganizationService.checkRoleHierarchy(context.userRole, requiredRole)
      if (!hasAccess) {
        return NextResponse.json(
          { error: `Requires ${requiredRole} role or higher` },
          { status: 403 }
        )
      }
    }

    // Call the handler with the context
    return await handler(request, context)
  } catch (error) {
    console.error('Organization auth error:', error)
    
    // Handle specific error types properly
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }
    
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }
    
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      )
    }
    
    // Use the centralized error handler for all other errors
    const { statusCode, body } = handleError(error)
    return NextResponse.json(body, { status: statusCode })
  }
}

/**
 * Authenticate with API key
 */
async function authenticateWithApiKey(apiKey: string): Promise<OrganizationContext | null> {
  if (!apiKey || typeof apiKey !== 'string') {
    return null
  }

  // Hash the API key
  const keyHash = await hashApiKey(apiKey)

  // Look up the API key
  const [keyRecord] = await db
    .select({
      apiKey: apiKeys,
      organization: organizations
    })
    .from(apiKeys)
    .innerJoin(organizations, eq(apiKeys.organizationId, organizations.id))
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1)

  if (!keyRecord) {
    throw new UnauthorizedError('Invalid API key')
  }
  
  if (!keyRecord.apiKey.isActive) {
    throw new UnauthorizedError('API key is inactive')
  }

  // Update last used timestamp
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, keyRecord.apiKey.id))

  return {
    organizationId: keyRecord.organization.id,
    organization: {
      id: keyRecord.organization.id,
      name: keyRecord.organization.name,
      isMerchant: keyRecord.organization.isMerchant,
      isCorporate: keyRecord.organization.isCorporate
    },
    scope: keyRecord.apiKey.scope as 'merchant' | 'corporate' | 'full',
    authType: 'apiKey'
  }
}

/**
 * Authenticate with dashboard (Supabase) session
 */
async function authenticateWithDashboard(
  request: NextRequest,
  requiredRole: 'owner' | 'admin' | 'member' | 'viewer'
): Promise<OrganizationContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get organization ID from header or query param
  const organizationId = 
    request.headers.get('x-organization-id') || 
    request.nextUrl.searchParams.get('organizationId')

  if (!organizationId) {
    // TODO: Get default organization from user session
    return null
  }

  // Check user access to organization
  const { hasAccess, userRole } = await OrganizationService.checkUserAccess(
    user.id,
    organizationId,
    requiredRole
  )

  if (!hasAccess) {
    return null
  }

  // Get organization details
  const organization = await OrganizationService.getOrganizationById(organizationId)
  if (!organization) {
    throw new NotFoundError('Organization')
  }

  return {
    organizationId: organization.id,
    organization: {
      id: organization.id,
      name: organization.name,
      isMerchant: organization.isMerchant,
      isCorporate: organization.isCorporate
    },
    scope: 'full', // Dashboard users have full scope within their role permissions
    authType: 'dashboard',
    userId: user.id,
    userRole
  }
}

/**
 * Helper to extract organization context from request
 * Used in route handlers after middleware has run
 */
export function getOrganizationContext(request: NextRequest): OrganizationContext {
  // Context is stored in request headers by the middleware
  const contextHeader = request.headers.get('x-organization-context')
  if (!contextHeader) {
    throw new AppError('INTERNAL_ERROR', 'Organization context not found', 500)
  }
  
  return JSON.parse(contextHeader) as OrganizationContext
}

/**
 * Backward compatibility: Get merchant context from organization
 */
export async function getMerchantFromOrganization(organizationId: string) {
  const org = await OrganizationService.getOrganizationById(organizationId)
  if (!org || !org.isMerchant) {
    throw new AppError('BAD_REQUEST', 'Organization is not a merchant', 400)
  }

  // Return merchant-like object for backward compatibility
  return {
    id: org.id,
    businessName: org.name,
    email: org.primaryEmail || '',
    slug: org.slug,
    settings: org.settings,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt
  }
}