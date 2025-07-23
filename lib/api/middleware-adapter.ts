import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from './middleware'
import { withOrganizationAuth, type OrganizationContext } from './organization-middleware'
import { MigrationHelperService } from '@/lib/services/migration-helper.service'

/**
 * Backward-compatible middleware that supports both merchant and organization contexts
 * Gradually migrate endpoints to use withOrganizationAuth directly
 */
export async function withCompatibleAuth(
  request: NextRequest,
  handler: (request: NextRequest, context: any) => Promise<NextResponse>,
  options: {
    useOrganization?: boolean
    requiredScope?: 'merchant' | 'corporate' | 'full'
    requiredRole?: 'owner' | 'admin' | 'member' | 'viewer'
  } = {}
) {
  const { useOrganization = true, requiredScope, requiredRole } = options

  if (useOrganization) {
    // Use new organization auth
    return withOrganizationAuth(
      request,
      async (req, orgContext) => {
        // Add backward compatibility properties
        const context: any = { ...orgContext }
        
        if (orgContext.organization.isMerchant) {
          context.merchantId = orgContext.organizationId
          context.merchant = await MigrationHelperService.getMerchantById(orgContext.organizationId)
        }
        
        return handler(req, context)
      },
      {
        requiredScope,
        requiredRole,
        allowApiKey: true,
        allowDashboard: true
      }
    )
  } else {
    // Use legacy merchant auth
    return withApiAuth(request, handler)
  }
}

/**
 * Helper to extract context from request headers
 * Works with both old and new middleware
 */
export function getCompatibleContext(request: NextRequest): any {
  // Try to get organization context first
  const orgContextHeader = request.headers.get('x-organization-context')
  if (orgContextHeader) {
    return JSON.parse(orgContextHeader)
  }

  // Fall back to merchant context
  const merchantContextHeader = request.headers.get('x-merchant-context')
  if (merchantContextHeader) {
    return JSON.parse(merchantContextHeader)
  }

  throw new Error('No authentication context found')
}

/**
 * Type guard to check if context is organization-based
 */
export function isOrganizationContext(context: any): context is OrganizationContext {
  return context.organizationId && context.organization && 'isMerchant' in context.organization
}

/**
 * Migration utilities for route handlers
 */
export const MigrationUtils = {
  /**
   * Get merchant ID from context (works with both patterns)
   */
  getMerchantId(context: any): string {
    if (isOrganizationContext(context)) {
      if (!context.organization.isMerchant) {
        throw new Error('Organization does not have merchant capability')
      }
      return context.organizationId
    }
    return context.merchantId
  },

  /**
   * Get organization ID from context
   */
  getOrganizationId(context: any): string {
    if (isOrganizationContext(context)) {
      return context.organizationId
    }
    // For legacy contexts, merchant ID is organization ID
    return context.merchantId
  },

  /**
   * Check if user has required role
   */
  hasRole(context: any, requiredRole: 'owner' | 'admin' | 'member' | 'viewer'): boolean {
    const userRole = context.userRole
    if (!userRole) return false

    const roleHierarchy: Record<string, number> = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1
    }

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
  }
}