/**
 * Payment Routes - Refactored with DI Pattern
 */

import { NextRequest } from 'next/server'
import { withMerchantDI } from '@/lib/api/di-middleware'
import { createPaymentSchema, validateInput } from '@/lib/api/validation'
import { ApiResponseBuilder } from '@/lib/api/response'
import { CacheConfigs } from '@/lib/api/cache'
import { ValidationError } from '@/lib/errors'
import { parseJsonBody } from '@/lib/api/middleware'
import type { PaymentFilters } from '@/lib/repositories/payment.repository'

/**
 * POST /api/v1/payments - Create payment
 */
export const POST = withMerchantDI(async (context) => {
  // Parse request body
  const body = await parseJsonBody(context.request)
  if (!body) {
    throw new ValidationError('Request body is required')
  }

  // Validate input
  const validation = validateInput(body, createPaymentSchema)
  if (!validation.success) {
    return new ApiResponseBuilder()
      .setStatus(400)
      .setError('Invalid request data', validation.errors)
      .build()
  }

  // Create payment using service
  const result = await context.paymentService.createPayment(
    context.organizationId,
    validation.data
  )

  return new ApiResponseBuilder()
    .setStatus(201)
    .setData(result)
    .build()
})

/**
 * GET /api/v1/payments - List payments
 */
export const GET = withMerchantDI(async (context) => {
  // Parse query parameters
  const { searchParams } = new URL(context.request.url)
  const tabId = searchParams.get('tab_id')
  const billingGroupId = searchParams.get('billing_group_id')
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

  // Build filters
  const filters: PaymentFilters = {}
  if (tabId) filters.tabId = tabId
  if (billingGroupId) filters.billingGroupId = billingGroupId
  if (status) filters.status = status as any

  // Get payments using service
  const result = await context.paymentService.listPayments(context.organizationId, {
    page,
    pageSize,
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
 * OPTIONS - Handle CORS
 */
export async function OPTIONS(_request: NextRequest) {
  return new ApiResponseBuilder()
    .setStatus(204)
    .build()
}