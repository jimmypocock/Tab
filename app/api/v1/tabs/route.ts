/**
 * Tab Routes - Refactored with DI Pattern
 */

import { NextRequest } from 'next/server'
import { withMerchantDI } from '@/lib/api/di-middleware'
import { createTabSchema, tabQuerySchema, validateInput } from '@/lib/api/validation'
import { ApiResponseBuilder } from '@/lib/api/response'
import { CacheConfigs } from '@/lib/api/cache'
import { ValidationError } from '@/lib/errors'
import { parseJsonBody } from '@/lib/api/middleware'
import type { TabFilters } from '@/lib/repositories/tab.repository'

/**
 * GET /api/v1/tabs - List tabs
 */
export const GET = withMerchantDI(async (context) => {
  // Parse query parameters
  const { searchParams } = new URL(context.request.url)
  const queryParams = Object.fromEntries(searchParams.entries())
  
  const validation = validateInput(tabQuerySchema, queryParams)
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

  // Get tabs using service
  const result = await context.tabService.listTabs(context.organizationId, {
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
})

/**
 * POST /api/v1/tabs - Create tab
 */
export const POST = withMerchantDI(async (context) => {
  // Parse request body
  const body = await parseJsonBody(context.request)
  if (!body) {
    throw new ValidationError('Request body is required')
  }

  // Validate input
  const validation = validateInput(createTabSchema, body)
  if (!validation.success) {
    return new ApiResponseBuilder()
      .setStatus(400)
      .setError('Invalid request data', validation.errors)
      .build()
  }

  // Create tab using service
  const tab = await context.tabService.createTab(
    context.organizationId,
    validation.data
  )

  return new ApiResponseBuilder()
    .setStatus(201)
    .setData(tab)
    .build()
})

/**
 * OPTIONS - Handle CORS
 */
export async function OPTIONS(_request: NextRequest) {
  return new ApiResponseBuilder()
    .setStatus(204)
    .build()
}