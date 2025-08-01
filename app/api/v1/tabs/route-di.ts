/**
 * Tab Routes using Dependency Injection Pattern
 * This file demonstrates the new DI pattern alongside the existing implementation
 */

import { NextRequest } from 'next/server'
import { withOrganizationAuth, OrganizationContext } from '@/lib/api/organization-middleware'
import { parseJsonBody } from '@/lib/api/middleware'
import { createTabSchema, tabQuerySchema, validateInput } from '@/lib/api/validation'
import { createSuccessResponse, ApiResponseBuilder } from '@/lib/api/response'
import { CacheConfigs } from '@/lib/api/cache'
import { ValidationError } from '@/lib/errors'
import { getDI, DITokens } from '@/lib/di'
import { TabManagementService } from '@/lib/services/tab-management.service'
import { FeatureFlagService } from '@/lib/services/feature-flag.service'
import type { TabFilters } from '@/lib/repositories/tab.repository'

/**
 * GET /api/v1/tabs - List tabs with DI pattern
 */
export async function GET(request: NextRequest) {
  return withOrganizationAuth(request, async (req: NextRequest, context: OrganizationContext) => {
    // Get services from DI container
    const container = getDI()
    const tabService = container.resolve<TabManagementService>(DITokens.TabService)
    const featureFlags = container.resolve<FeatureFlagService>(DITokens.FeatureFlags)
    
    // Check if DI pattern is enabled
    const useDI = await featureFlags.isEnabled(
      FeatureFlagService.FLAGS.USE_DI_PATTERN,
      { organizationId: context.organizationId }
    )
    
    if (!useDI) {
      // Fall back to existing implementation
      const { GET: originalGET } = await import('./route')
      return originalGET(request)
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(req.url)
    const queryParams = Object.fromEntries(searchParams.entries())
    
    const validation = validateInput(queryParams, tabQuerySchema)
    if (!validation.success) {
      return new ApiResponseBuilder()
        .setStatus(400)
        .setError('Invalid query parameters', validation.errors)
        .build()
    }

    const query = validation.data
    
    // Build filters
    const filters: TabFilters = {}
    if (query.status) filters.status = query.status
    if (query.customerEmail) filters.customerEmail = query.customerEmail
    if (query.customerOrganizationId) filters.customerOrganizationId = query.customerOrganizationId
    if (query.externalReference) filters.externalReference = query.externalReference
    if (query.createdAfter) filters.createdAfter = new Date(query.createdAfter)
    if (query.createdBefore) filters.createdBefore = new Date(query.createdBefore)

    try {
      // Use service to get tabs
      const result = await tabService.listTabs(context.organizationId, {
        page: query.page,
        pageSize: query.limit,
        sortBy: query.sortBy as any,
        sortOrder: query.sortOrder as any,
        filters,
      })

      return new ApiResponseBuilder()
        .setData(result.data)
        .setPagination(
          result.pagination.page,
          result.pagination.pageSize,
          result.pagination.totalItems
        )
        .setCache(CacheConfigs.shortPrivate)
        .build()
    } catch (error) {
      throw error // Let middleware handle it
    }
  }, {
    requiredScope: 'merchant'
  })
}

/**
 * POST /api/v1/tabs - Create tab with DI pattern
 */
export async function POST(request: NextRequest) {
  return withOrganizationAuth(request, async (req: NextRequest, context: OrganizationContext) => {
    // Get services from DI container
    const container = getDI()
    const tabService = container.resolve<TabManagementService>(DITokens.TabService)
    const featureFlags = container.resolve<FeatureFlagService>(DITokens.FeatureFlags)
    
    // Check if DI pattern is enabled
    const useDI = await featureFlags.isEnabled(
      FeatureFlagService.FLAGS.USE_DI_PATTERN,
      { organizationId: context.organizationId }
    )
    
    if (!useDI) {
      // Fall back to existing implementation
      const { POST: originalPOST } = await import('./route')
      return originalPOST(request)
    }

    // Parse request body
    const body = await parseJsonBody(req)
    if (!body) {
      throw new ValidationError('Request body is required')
    }

    // Validate input
    const validation = validateInput(body, createTabSchema)
    if (!validation.success) {
      return new ApiResponseBuilder()
        .setStatus(400)
        .setError('Invalid request data', validation.errors)
        .build()
    }

    try {
      // Use service to create tab
      const tab = await tabService.createTab(
        context.organizationId,
        validation.data
      )

      return new ApiResponseBuilder()
        .setStatus(201)
        .setData(tab)
        .build()
    } catch (error) {
      throw error // Let middleware handle it
    }
  }, {
    requiredScope: 'merchant'
  })
}

// OPTIONS handler remains the same
export { OPTIONS } from './route'