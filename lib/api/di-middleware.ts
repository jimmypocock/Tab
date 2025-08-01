/**
 * DI-Enhanced Organization Middleware
 */

import { NextRequest, NextResponse } from 'next/server'
import { withOrganizationAuth, OrganizationContext } from './organization-middleware'
import { RequestContext } from './request-context'
import { ApiResponseBuilder } from './response'
import { handleError } from '@/lib/errors'

export type RequestHandler<T = any> = (
  context: RequestContext
) => Promise<T | NextResponse>

interface MiddlewareOptions {
  requiredScope?: 'merchant' | 'corporate' | 'full'
  requiredRole?: 'owner' | 'admin' | 'member' | 'viewer'
  allowApiKey?: boolean
  allowDashboard?: boolean
}

/**
 * Enhanced middleware that provides DI context
 */
export function withDI(
  handler: RequestHandler,
  options: MiddlewareOptions = {}
): (request: NextRequest) => Promise<NextResponse> {
  return withOrganizationAuth(
    async (request: NextRequest, orgContext: OrganizationContext) => {
      // Create request context with DI
      const context = new RequestContext(request, orgContext)
      
      try {
        // Check role if required
        if (options.requiredRole && !context.hasRole(options.requiredRole)) {
          return new ApiResponseBuilder()
            .setStatus(403)
            .setError('Insufficient permissions', {
              required: options.requiredRole,
              current: context.userRole,
            })
            .build()
        }
        
        // Execute handler
        const result = await handler(context)
        
        // If handler returns NextResponse, use it directly
        if (result instanceof NextResponse) {
          return result
        }
        
        // Otherwise, wrap in success response
        return new ApiResponseBuilder()
          .setData(result)
          .build()
          
      } catch (error) {
        return handleError(error)
      }
    },
    options
  )
}

/**
 * Convenience wrappers for common patterns
 */
export const withMerchantDI = (handler: RequestHandler, options?: MiddlewareOptions) =>
  withDI(handler, { ...options, requiredScope: 'merchant' })

export const withAdminDI = (handler: RequestHandler, options?: MiddlewareOptions) =>
  withDI(handler, { ...options, requiredRole: 'admin' })

export const withOwnerDI = (handler: RequestHandler, options?: MiddlewareOptions) =>
  withDI(handler, { ...options, requiredRole: 'owner' })